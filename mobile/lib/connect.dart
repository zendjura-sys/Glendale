import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'core/widgets/arctic_glass/arctic_glass.dart';
import 'dlna.dart';
import 'full_player.dart' show showAudioOutput;
import 'i18n.dart';
import 'listen_together.dart' show startListening;
import 'player_view.dart' show TrackCover;
import 'state.dart';
import 'theme.dart';
import 'track_edit.dart' show artistOf;
import 'widgets.dart';

// GameCon Connect (як Spotify Connect): застосунок і сайт бачать одне одного, керують
// відтворенням і передають музику між пристроями. Вебсокета в застосунку немає — опитуємо
// міст `/api/v1/site/music/connect/*`: кожні 3 с на екрані, ~10 с у фоні, поки грає музика.

double _number(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;

/// Що грає на пристрої (знімок, який пристрій надсилає в heartbeat).
class ConnectState {
  ConnectState({required this.track, this.playing = false, this.position = 0, this.duration = 0, this.volume = 1, this.shuffle = false, this.repeat = 'off', this.updatedAt, DateTime? received})
      : received = received ?? DateTime.now();

  final Map<String, dynamic> track;
  bool playing;

  /// Позиція й тривалість — у секундах, станом на [updatedAt].
  double position;
  final double duration;
  double volume;
  final bool shuffle;
  final String repeat;
  DateTime? updatedAt;

  /// Коли знімок дійшов до нас (якщо годинник пристрою розбігається з нашим).
  DateTime received;

  static ConnectState? fromJson(dynamic json) {
    if (json is! Map || json['track'] is! Map) return null;
    return ConnectState(
      track: Map<String, dynamic>.from(json['track'] as Map),
      playing: json['playing'] == true,
      position: _number(json['position']),
      duration: _number(json['duration']),
      volume: json['volume'] == null ? 1 : _number(json['volume']).clamp(0.0, 1.0),
      shuffle: json['shuffle'] == true,
      repeat: text(json['repeat']) ?? 'off',
      updatedAt: DateTime.tryParse('${json['updated_at']}'),
    );
  }

  String get title => text(track['title']) ?? tr('Без назви');
  String get artist => text(track['artist']) ?? '';
  String? get cover => absolute(track['cover_url']);
  String get key => trackKey(track);

  /// Позиція зараз: під час відтворення додаємо час, що минув від знімка.
  double positionAt(DateTime now) {
    if (!playing) return position;
    var since = updatedAt == null ? -1 : now.difference(updatedAt!).inMilliseconds / 1000;
    // Годинник іншого пристрою розходиться з нашим — рахуємо від отримання.
    if (since < 0 || since > 60) since = now.difference(received).inMilliseconds / 1000;
    final at = position + max(0, since);
    return duration > 0 ? min(at, duration) : at;
  }

  /// Переписати позицію «від цієї миті» (після власної команди, до наступної відповіді сервера).
  void rebase(double at) {
    position = at;
    updatedAt = DateTime.now();
    received = DateTime.now();
  }
}

class ConnectDevice {
  ConnectDevice({required this.id, required this.name, required this.kind, this.lastSeen, this.isActive = false, this.state});

  final String id;
  final String name;

  /// `web` — сайт у браузері, `app` — застосунок.
  final String kind;
  final DateTime? lastSeen;
  final bool isActive;
  final ConnectState? state;

  static ConnectDevice? fromJson(Map<String, dynamic> json) {
    final id = text(json['id']);
    if (id == null) return null;
    return ConnectDevice(
      id: id,
      name: text(json['name']) ?? 'GameCon',
      kind: text(json['kind']) ?? 'web',
      lastSeen: DateTime.tryParse('${json['last_seen']}'),
      isActive: json['is_active'] == true,
      state: ConnectState.fromJson(json['state']),
    );
  }

  IconData get icon => kind == 'app' ? LucideIcons.smartphone : LucideIcons.monitor;
}

class GameConnect extends ChangeNotifier with WidgetsBindingObserver {
  GameConnect(this.session, this.player) : deviceId = deviceIdFor(session.prefs);

  /// Один на застосунок (створюється в main.dart), як [VoiceCall.instance].
  static GameConnect? instance;

  static const _kDevice = 'connect.device_id';

  final Session session;
  final TrackPlayer player;

  /// Постійний id цього телефона для Connect (UUID, створюється один раз).
  final String deviceId;
  String get deviceName => '${tr('Телефон')} · GameCon';

  /// Інші пристрої акаунта й цей (як їх бачить сервер).
  List<ConnectDevice> devices = [];
  String? activeDeviceId;

  Timer? _timer;
  Timer? _debounce;
  bool _started = false;
  bool _foreground = true;
  Future<void>? _running;
  bool _wantPlay = false;
  bool _again = false;
  final _done = <String>[];

  /// Що відправили останнім — щоб помітити зміну (новий трек, пауза, перемотування).
  String? _sentSignature;
  double _sentPosition = 0;
  DateTime _sentAt = DateTime.now();

  static String deviceIdFor(SharedPreferences prefs) {
    final saved = prefs.getString(_kDevice);
    if (saved != null && saved.isNotEmpty) return saved;
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = [for (final b in bytes) b.toRadixString(16).padLeft(2, '0')].join();
    final id = '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
    unawaited(prefs.setString(_kDevice, id));
    return id;
  }

  void start() {
    if (_started) return;
    _started = true;
    session.addListener(_onSession);
    player.addListener(_onPlayer);
    WidgetsBinding.instance.addObserver(this);
    if (session.token != null) unawaited(heartbeat());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (_foreground) {
      unawaited(heartbeat());
    } else {
      _arm();
    }
  }

  void _onSession() {
    if (session.token == null) {
      _timer?.cancel();
      _debounce?.cancel();
      if (devices.isNotEmpty || activeDeviceId != null) {
        devices = [];
        activeDeviceId = null;
        notifyListeners();
      }
    } else if (_foreground && _timer?.isActive != true && _running == null) {
      unawaited(heartbeat());
    }
  }

  /// Наступне опитування: 3 с на екрані, 10 с у фоні під час відтворення, інакше — до повернення.
  void _arm() {
    _timer?.cancel();
    if (!_started || session.token == null) return;
    final every = _foreground ? const Duration(seconds: 3) : (player.playing ? const Duration(seconds: 10) : null);
    if (every != null) _timer = Timer(every, () => unawaited(heartbeat()));
  }

  String _signature() {
    final t = player.current;
    return '${t?.key}|${player.playing}|${player.volume.toStringAsFixed(2)}|${player.shuffle}|${player.repeatMode}';
  }

  /// Локальна зміна (трек, пауза, гучність, перемотування) — повідомити інші пристрої за 400 мс.
  void _onPlayer() {
    if (!_started || session.token == null) return;
    var changed = _signature() != _sentSignature;
    if (!changed && player.current != null) {
      final elapsed = player.playing ? DateTime.now().difference(_sentAt).inMilliseconds / 1000 : 0;
      final expected = _sentPosition + elapsed;
      changed = (player.position.inMilliseconds / 1000 - expected).abs() > 2.5;
    }
    if (!changed) return;
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () => unawaited(heartbeat()));
  }

  /// Стан цього пристрою для heartbeat (null — нічого не грає).
  Map<String, dynamic>? localState() {
    final track = player.current;
    if (track == null) return null;
    final total = player.duration.inMilliseconds > 0 ? player.duration.inMilliseconds / 1000 : track.seconds.toDouble();
    // Черга (до 200 треків навколо поточного) — щоб передача на інший пристрій грала далі те саме.
    final from = max(0, player.index - 50);
    final to = min(player.queue.length, from + 200);
    return {
      'track': track.toCard(),
      'queue': [for (final t in player.queue.sublist(from, to)) t.toCard()],
      'index': player.index - from,
      'playing': player.playing,
      'position': player.position.inMilliseconds / 1000,
      'duration': total,
      'volume': player.volume,
      'shuffle': player.shuffle,
      'repeat': player.repeatMode,
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    };
  }

  /// Опитування: свій стан → пристрої, активний пристрій і команди для цього телефона.
  Future<void> heartbeat() {
    if (session.token == null) return Future.value();
    final running = _running;
    if (running != null) {
      _again = true;
      return running;
    }
    return _running = _beat().whenComplete(() {
      _running = null;
      _arm();
      if (_again) {
        _again = false;
        unawaited(heartbeat());
      }
    });
  }

  /// Дочекатися, поки сервер отримає свіжий стан цього телефона.
  Future<void> _flush() async {
    final running = _running;
    if (running != null) await running;
    await heartbeat();
  }

  Future<void> _beat() async {
    _debounce?.cancel();
    final state = localState();
    _sentSignature = _signature();
    _sentPosition = player.position.inMilliseconds / 1000;
    _sentAt = DateTime.now();
    try {
      final data = await session.api.post(Api.site('/music/connect/heartbeat'), {
        'device_id': deviceId,
        'name': deviceName,
        'kind': 'app',
        'state': ?state,
      });
      _take(data);
      for (final command in maps(data['commands'])) {
        await apply(command);
      }
    } catch (_) {
      // Немає мережі чи сайт ще без Connect — спробуємо наступного разу.
    }
  }

  void _take(Map<String, dynamic> data) {
    devices = [for (final d in maps(data['devices'])) ?ConnectDevice.fromJson(d)];
    activeDeviceId = text(data['active_device_id']) ?? devices.where((d) => d.isActive).firstOrNull?.id;
    notifyListeners();
  }

  /// Команда з іншого пристрою для цього телефона.
  Future<void> apply(Map<String, dynamic> command) async {
    final id = text(command['id']);
    if (id != null) {
      if (_done.contains(id)) return;
      _done.add(id);
      if (_done.length > 50) _done.removeAt(0);
    }
    final value = command['value'];
    try {
      switch (text(command['action'])) {
        case 'toggle':
          await player.toggle();
        case 'play':
          await player.toggle(forcePlay: true);
        case 'pause':
          await player.pause();
        case 'next':
          await player.next();
        case 'prev':
          await player.prev();
        case 'seek':
          await player.seek(Duration(milliseconds: (_number(value) * 1000).round()));
        case 'volume':
          await player.setVolume(_number(value));
        case 'transfer':
          if (value is Map) await receive(Map<String, dynamic>.from(value));
      }
    } catch (_) {}
  }

  /// Музику передали сюди: {track, queue?, index?, position, playing}.
  Future<void> receive(Map<String, dynamic> value) async {
    final track = value['track'];
    if (track is! Map) return;
    final card = Map<String, dynamic>.from(track);
    var list = maps(value['queue']);
    var at = value['index'] is int ? value['index'] as int : list.indexWhere((t) => trackKey(t) == trackKey(card));
    if (list.isEmpty || at < 0 || at >= list.length || trackKey(list[at]) != trackKey(card)) {
      list = [card];
      at = 0;
    }
    final position = Duration(milliseconds: (_number(value['position']) * 1000).round());
    // «Грати тут» — граємо, навіть якщо там стояла пауза.
    final play = value['playing'] != false || _wantPlay;
    _wantPlay = false;
    if (player.isCurrentCard(card)) {
      await player.seek(position);
    } else {
      await player.playList(list, at, from: PlayFrom(tr('GameCon Connect')));
      if (position > const Duration(seconds: 1)) await player.seek(position);
    }
    if (play) {
      await player.toggle(forcePlay: true);
    } else {
      await player.pause();
    }
    activeDeviceId = deviceId;
    notifyListeners();
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () => unawaited(heartbeat()));
  }

  ConnectDevice? device(String? id) => id == null ? null : devices.where((d) => d.id == id).firstOrNull;

  /// Активний пристрій (той, що грає чи грав останнім).
  ConnectDevice? get active => device(activeDeviceId) ?? devices.where((d) => d.isActive).firstOrNull;

  /// Активний — інший пристрій, а тут нічого не грає: міні-плеєр керує ним дистанційно.
  ConnectDevice? get remote {
    final d = active;
    final state = d?.state;
    // Тут грає своє — показуємо свій плеєр; на паузі активним лишається той пристрій.
    if (d == null || d.id == deviceId || state == null || player.playing) return null;
    return d;
  }

  /// Надіслати команду пристрою; стан у міні-плеєрі оновлюється одразу. [value] — число
  /// (позиція в секундах, гучність 0–1); «transfer» сервер збирає сам зі стану активного пристрою.
  Future<bool> command(String target, String action, [num? value]) async {
    final state = device(target)?.state;
    if (state != null) {
      final now = DateTime.now();
      switch (action) {
        case 'toggle' || 'play' || 'pause':
          final at = state.positionAt(now);
          state.playing = action == 'toggle' ? !state.playing : action == 'play';
          state.rebase(at);
        case 'seek':
          state.rebase(_number(value));
        case 'volume':
          state.volume = _number(value).clamp(0.0, 1.0);
      }
      notifyListeners();
    }
    try {
      await session.api.post(Api.site('/music/connect/command'), {'target_device_id': target, 'device_id': deviceId, 'action': action, 'value': ?value});
      return true;
    } on ApiException catch (e) {
      session.toast(e.message);
      return false;
    }
  }

  /// Перемкнути музику на [target]: сервер передає туди трек, чергу й позицію з активного
  /// пристрою і ставить його на паузу.
  Future<void> transferTo(String target) async {
    if (target == deviceId) return playHere();
    final fromHere = player.current != null && (player.playing || active == null || active!.id == deviceId);
    // Грає тут — спершу сервер має знати свіжу позицію й чергу цього телефона.
    if (fromHere) await _flush();
    if (!await command(target, 'transfer')) return;
    if (fromHere) await player.pause();
    activeDeviceId = target;
    notifyListeners();
    unawaited(heartbeat());
  }

  /// «Грати тут»: забрати музику з активного пристрою на телефон (команда «transfer» прийде
  /// з наступним heartbeat — запитуємо його одразу).
  Future<void> playHere() async {
    final source = active;
    if (source == null || source.id == deviceId || source.state == null) {
      if (player.current != null) await player.toggle(forcePlay: true);
      return;
    }
    _wantPlay = true;
    if (await command(deviceId, 'transfer')) {
      await _flush();
    } else {
      _wantPlay = false;
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _debounce?.cancel();
    if (_started) {
      session.removeListener(_onSession);
      player.removeListener(_onPlayer);
      WidgetsBinding.instance.removeObserver(this);
    }
    super.dispose();
  }
}

/// Перемальовує прогрес віддаленого пристрою щосекунди (позицію рахуємо самі між опитуваннями).
class _Ticker extends StatefulWidget {
  const _Ticker({required this.builder});
  final WidgetBuilder builder;

  @override
  State<_Ticker> createState() => _TickerState();
}

class _TickerState extends State<_Ticker> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context);
}

String _clock(double seconds) {
  final s = seconds.isFinite ? seconds.round() : 0;
  return '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
}

/// «Грає на: …» — акцентний рядок під назвою.
Widget _playingOn(ConnectDevice device, {double size = 12.5}) => Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(LucideIcons.monitorSpeaker, size: size + 1, color: accent),
      const SizedBox(width: 5),
      Flexible(child: FitText(tr('Грає на: {device}', {'device': device.name}), style: body(size, color: accent, weight: FontWeight.w600).copyWith(height: 1.2))),
    ]);

/// Міні-плеєр, коли музика грає на іншому пристрої: та сама капсула, кнопки керують ним.
class RemoteMiniPlayer extends StatelessWidget {
  const RemoteMiniPlayer({required this.connect, required this.device, super.key});
  final GameConnect connect;
  final ConnectDevice device;

  @override
  Widget build(BuildContext context) {
    final state = device.state!;
    Widget control(IconData icon, String label, VoidCallback onPressed, {double size = 24, Color? color}) => SizedBox.square(
          dimension: 40,
          child: IconButton(padding: EdgeInsets.zero, tooltip: label, onPressed: onPressed, icon: Icon(icon, color: color ?? soft, size: size)),
        );
    return SizedBox(
      height: miniPlayerExtent,
      child: Padding(
        padding: ArcticDock.sidesOf(context).copyWith(bottom: 8),
        child: GestureDetector(
          onTap: () => showRemotePlayer(context, connect),
          child: MatteGlass(
            borderRadius: barRadius,
            child: Stack(children: [
              Positioned.fill(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 11),
                  child: Row(children: [
                    TrackCover(url: state.cover, seed: state.key, size: 46, radius: 12),
                    const SizedBox(width: 11),
                    Expanded(
                      child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                        FitText(state.title, style: body(14.5, weight: FontWeight.w700).copyWith(height: 1.2)),
                        const SizedBox(height: 2),
                        _playingOn(device),
                      ]),
                    ),
                    control(LucideIcons.skipBack, tr('Назад'), () => connect.command(device.id, 'prev')),
                    RoundIcon(icon: state.playing ? LucideIcons.pause : LucideIcons.play, onTap: () => connect.command(device.id, 'toggle'), filled: true, size: 44, tooltip: state.playing ? tr('Пауза') : tr('Відтворити')),
                    control(LucideIcons.skipForward, tr('Далі'), () => connect.command(device.id, 'next')),
                    control(LucideIcons.smartphone, tr('Грати тут'), connect.playHere, size: 20, color: accent),
                  ]),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                top: 0,
                child: _Ticker(builder: (_) {
                  final progress = state.duration <= 0 ? 0.0 : (state.positionAt(DateTime.now()) / state.duration).clamp(0.0, 1.0);
                  return LinearProgressIndicator(value: progress, minHeight: 2.5, backgroundColor: fg.withValues(alpha: 0.06), color: primary);
                }),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// «Зараз грає» для іншого пристрою: перемотування, гучність, кнопки й «Грати тут».
Future<void> showRemotePlayer(BuildContext context, GameConnect connect) {
  return showGcSheet<void>(
    context,
    builder: (sheet) => ListenableBuilder(
      listenable: connect,
      builder: (sheet, _) {
        final device = connect.remote ?? connect.active;
        final state = device?.state;
        if (device == null || state == null || device.id == connect.deviceId) {
          return Padding(padding: const EdgeInsets.fromLTRB(24, 12, 24, 32), child: Text(tr('Зараз нічого не грає на інших пристроях.'), style: body(14, color: muted)));
        }
        return Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Center(child: TrackCover(url: state.cover, seed: state.key, size: 220, radius: 18)),
            const SizedBox(height: 18),
            FitText(state.title, style: display(20), maxLines: 2),
            const SizedBox(height: 4),
            FitText(artistOf(state.artist), style: body(14, color: muted)),
            const SizedBox(height: 8),
            _playingOn(device, size: 13),
            const SizedBox(height: 10),
            _RemoteSeek(connect: connect, device: device),
            Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
              IconButton(tooltip: tr('Назад'), onPressed: () => connect.command(device.id, 'prev'), icon: Icon(LucideIcons.skipBack, size: 28, color: ink)),
              RoundIcon(icon: state.playing ? LucideIcons.pause : LucideIcons.play, onTap: () => connect.command(device.id, 'toggle'), filled: true, size: 58, tooltip: state.playing ? tr('Пауза') : tr('Відтворити')),
              IconButton(tooltip: tr('Далі'), onPressed: () => connect.command(device.id, 'next'), icon: Icon(LucideIcons.skipForward, size: 28, color: ink)),
            ]),
            const SizedBox(height: 8),
            _RemoteVolume(connect: connect, device: device),
            const SizedBox(height: 14),
            PrimaryButton(label: tr('Грати тут'), icon: LucideIcons.smartphone, onPressed: () {
              Navigator.pop(sheet);
              unawaited(connect.playHere());
            }),
            const SizedBox(height: 8),
            GhostButton(label: tr('Пристрої'), icon: LucideIcons.monitorSpeaker, onPressed: () {
              Navigator.pop(sheet);
              unawaited(showConnectDevices(context));
            }),
          ]),
        );
      },
    ),
  );
}

class _RemoteSeek extends StatefulWidget {
  const _RemoteSeek({required this.connect, required this.device});
  final GameConnect connect;
  final ConnectDevice device;

  @override
  State<_RemoteSeek> createState() => _RemoteSeekState();
}

class _RemoteSeekState extends State<_RemoteSeek> {
  double? dragging;

  @override
  Widget build(BuildContext context) {
    final state = widget.device.state!;
    return _Ticker(builder: (_) {
      final total = state.duration;
      final at = dragging ?? state.positionAt(DateTime.now());
      return Column(children: [
        Slider(
          value: total <= 0 ? 0 : at.clamp(0.0, total),
          max: total <= 0 ? 1 : total,
          onChanged: total <= 0 ? null : (v) => setState(() => dragging = v),
          onChangeEnd: total <= 0
              ? null
              : (v) {
                  setState(() => dragging = null);
                  unawaited(widget.connect.command(widget.device.id, 'seek', v));
                },
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Row(children: [
            Text(_clock(at), style: body(12, color: muted)),
            const Spacer(),
            Text(total <= 0 ? '' : _clock(total), style: body(12, color: muted)),
          ]),
        ),
      ]);
    });
  }
}

class _RemoteVolume extends StatefulWidget {
  const _RemoteVolume({required this.connect, required this.device});
  final GameConnect connect;
  final ConnectDevice device;

  @override
  State<_RemoteVolume> createState() => _RemoteVolumeState();
}

class _RemoteVolumeState extends State<_RemoteVolume> {
  double? dragging;

  @override
  Widget build(BuildContext context) {
    final volume = dragging ?? widget.device.state!.volume;
    return Row(children: [
      Icon(LucideIcons.volume, size: 16, color: muted),
      Expanded(
        child: Slider(
          value: volume.clamp(0.0, 1.0),
          semanticFormatterCallback: (v) => tr('Гучність {v}%', {'v': (v * 100).round()}),
          onChanged: (v) => setState(() => dragging = v),
          onChangeEnd: (v) {
            setState(() => dragging = null);
            unawaited(widget.connect.command(widget.device.id, 'volume', double.parse(v.toStringAsFixed(2))));
          },
        ),
      ),
      Icon(LucideIcons.volume2, size: 18, color: muted),
    ]);
  }
}

/// Пристрій для відтворення в «GameCon Connect»: інший GameCon, DLNA, Bluetooth, Cast, Wi-Fi Direct.
class _Target {
  const _Target({required this.key, required this.icon, required this.name, this.detail, this.onTap, this.badge});
  final String key;
  final IconData icon;
  final String name;
  final String? detail;
  final String? badge;
  final VoidCallback? onTap;
}

const _native = MethodChannel('gamecon/app');

Future<T?> _call<T>(String method, [Map<String, dynamic>? args]) async {
  try {
    return await _native.invokeMethod<T>(method, args);
  } catch (_) {
    return null;
  }
}

List<Map<String, dynamic>> _list(dynamic value) => [
      for (final item in (value is List ? value : const []))
        if (item is Map) Map<String, dynamic>.from(item),
    ];

/// GameCon Connect, як у Spotify: зверху — де грає зараз, нижче — джем і всі пристрої
/// (інші GameCon акаунта, телевізори й колонки в мережі, Bluetooth, Cast, Wi-Fi Direct).
Future<void> showConnectDevices(BuildContext context) async {
  final connect = GameConnect.instance;
  if (connect == null) return showAudioOutput(context);
  unawaited(connect.heartbeat());
  await showGcSheet<void>(context, title: tr('GameCon Connect'), builder: (sheet) => _ConnectSheet(connect: connect, host: context));
}

class _ConnectSheet extends StatefulWidget {
  const _ConnectSheet({required this.connect, required this.host});
  final GameConnect connect;

  /// Контекст екрана під шторкою — для переходу в джем після закриття.
  final BuildContext host;

  @override
  State<_ConnectSheet> createState() => _ConnectSheetState();
}

class _ConnectSheetState extends State<_ConnectSheet> {
  static const _kAsked = 'connect.permissions_asked';

  List<Map<String, dynamic>> outputs = [];
  List<Map<String, dynamic>>? bonded = [];
  List<DlnaRenderer> renderers = [];
  List<Map<String, dynamic>> casts = [];
  List<Map<String, dynamic>>? nearby = [];
  bool scanning = true;
  bool autoInvite = false;
  int nearbyFriends = 0;

  GameConnect get connect => widget.connect;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _scan());
    unawaited(_loadJam());
  }

  Future<void> _loadJam() async {
    try {
      final data = await connect.session.api.get(Api.site('/music/jam'));
      if (!mounted) return;
      setState(() {
        autoInvite = data['auto_invite'] == true;
        nearbyFriends = intOf(data['nearby']);
      });
    } catch (_) {}
  }

  Future<void> _setJam(bool value) async {
    setState(() => autoInvite = value);
    try {
      await connect.session.api.put(Api.site('/music/jam'), {'auto_invite': value});
    } catch (e) {
      if (mounted) {
        setState(() => autoInvite = !value);
        toast(context, e);
      }
    }
  }

  Future<void> _scan({bool ask = false}) async {
    setState(() => scanning = true);
    final prefs = connect.session.prefs;
    // Дозволи на Bluetooth і Wi-Fi поруч питаємо один раз; далі — лише з кнопки.
    if (ask || prefs.getBool(_kAsked) != true) {
      await prefs.setBool(_kAsked, true);
      await _call<bool>('connectPermissions');
    }
    final outs = _list(await _call<List<dynamic>>('connectOutputs'));
    final paired = await _call<List<dynamic>>('connectBonded');
    if (mounted) {
      setState(() {
        outputs = outs;
        bonded = paired == null ? null : _list(paired);
      });
    }
    await _call<bool>('connectMulticast', {'held': true});
    final results = await Future.wait<Object?>([
      Dlna.discover(),
      _call<List<dynamic>>('connectCast', {'ms': 3000}),
      _call<List<dynamic>>('connectWifiDirect', {'ms': 5000}),
    ]);
    await _call<bool>('connectMulticast', {'held': false});
    if (!mounted) return;
    setState(() {
      renderers = (results[0] as List<DlnaRenderer>?) ?? [];
      casts = _list(results[1]);
      nearby = results[2] == null ? null : _list(results[2]);
      scanning = false;
    });
  }

  void _close() => Navigator.of(context).pop();

  Future<void> _castTo(DlnaRenderer renderer) async {
    final player = connect.player;
    if (player.current == null) {
      toast(context, tr('Спершу увімкніть трек — і він заграє на {name}.', {'name': renderer.name}));
      return;
    }
    if (player.current!.source == 'radio') {
      toast(context, tr('Радіо на телевізор поки не передається — лише треки.'));
      return;
    }
    // Музика грала на іншому пристрої акаунта — забираємо її сюди, а звідси вже на телевізор.
    if (!player.playing && connect.active != null && connect.active!.id != connect.deviceId) await connect.playHere();
    await DlnaCast.instance.start(renderer, player);
    if (!player.playing) await player.toggle(forcePlay: true);
  }

  Future<void> _thisPhone() async {
    _close();
    if (DlnaCast.instance.active) {
      await DlnaCast.instance.stop();
      return;
    }
    final out = _activeOutput;
    // Android сам веде звук на останні підключені навушники — перемкнути назад допоможе системний перемикач.
    if (out != null && out['kind'] != 'phone') {
      await _call<bool>('audioOutput');
      return;
    }
    await connect.playHere();
  }

  Map<String, dynamic>? get _activeOutput => outputs.where((o) => o['active'] == true).firstOrNull;

  IconData _outputIcon(String? kind) => switch (kind) {
        'bluetooth' => LucideIcons.headphones,
        'wired' => LucideIcons.headphones,
        'usb' => LucideIcons.usb,
        _ => LucideIcons.smartphone,
      };

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([connect, connect.player, DlnaCast.instance]),
      builder: (context, _) {
        final player = connect.player;
        final cast = DlnaCast.instance;
        final remote = connect.active;
        final out = _activeOutput;
        final local = player.current;

        // Де грає зараз: телевізор (DLNA) → інший GameCon → навушники чи колонка → цей телефон.
        late final String nowName;
        late final IconData nowIcon;
        String? nowBadge;
        String? nowTrack;
        var nowPlaying = false;
        if (cast.active) {
          nowName = cast.renderer!.name;
          nowIcon = LucideIcons.tv;
          nowBadge = 'DLNA';
          nowTrack = local == null ? null : _line(local.title, local.artist);
          nowPlaying = player.playing;
        } else if (remote != null && remote.id != connect.deviceId && remote.state != null && !player.playing) {
          nowName = remote.name;
          nowIcon = remote.icon;
          nowBadge = 'GameCon';
          nowTrack = _line(remote.state!.title, remote.state!.artist);
          nowPlaying = remote.state!.playing;
        } else {
          final kind = text(out?['kind']);
          nowName = kind == null || kind == 'phone' ? tr('Цей телефон') : (text(out?['name']) ?? tr('Навушники'));
          nowIcon = _outputIcon(kind);
          nowBadge = switch (kind) { 'bluetooth' => 'Bluetooth', 'wired' => tr('Дротові'), 'usb' => 'USB', _ => null };
          nowTrack = local == null ? null : _line(local.title, local.artist);
          nowPlaying = player.playing;
        }

        final targets = <_Target>[
          if (cast.active || (out != null && out['kind'] != 'phone') || (remote != null && remote.id != connect.deviceId && !player.playing))
            _Target(key: 'phone', icon: LucideIcons.smartphone, name: tr('Цей телефон'), onTap: () => unawaited(_thisPhone())),
          for (final o in outputs)
            if (o['active'] != true && o['kind'] != 'phone')
              _Target(
                key: 'out:${o['id']}',
                icon: _outputIcon(text(o['kind'])),
                name: text(o['name']) ?? tr('Навушники'),
                detail: tr('Підключено'),
                onTap: () {
                  _close();
                  unawaited(_call<bool>('audioOutput'));
                },
              ),
          for (final d in connect.devices)
            if (d.id != connect.deviceId && !(d.id == remote?.id && nowBadge == 'GameCon'))
              _Target(
                key: 'gc:${d.id}',
                icon: d.icon,
                name: d.name,
                badge: 'GameCon',
                detail: d.state == null ? null : _line(d.state!.title, d.state!.artist),
                onTap: () {
                  _close();
                  unawaited(() async {
                    if (cast.active) await cast.stop();
                    await connect.transferTo(d.id);
                  }());
                },
              ),
          for (final r in renderers)
            if (r.id != cast.renderer?.id)
              _Target(
                key: 'dlna:${r.id}',
                icon: LucideIcons.tv,
                name: r.name,
                detail: r.model.isEmpty ? tr('У вашій мережі') : r.model,
                onTap: () {
                  _close();
                  unawaited(_castTo(r));
                },
              ),
          for (final c in casts)
            _Target(
              key: 'cast:${c['id']}',
              icon: LucideIcons.cast,
              name: text(c['name']) ?? 'Chromecast',
              detail: tr('Google Cast · через системний перемикач'),
              onTap: () {
                _close();
                unawaited(_call<bool>('audioOutput'));
              },
            ),
          for (final b in bonded ?? const <Map<String, dynamic>>[])
            if (!outputs.any((o) => text(o['name']) == text(b['name'])))
              _Target(
                key: 'bt:${b['address']}',
                icon: LucideIcons.bluetooth,
                name: text(b['name']) ?? 'Bluetooth',
                detail: tr('Спарено · торкніться, щоб підключити'),
                onTap: () {
                  _close();
                  unawaited(_call<bool>('bluetoothSettings'));
                },
              ),
          for (final p in nearby ?? const <Map<String, dynamic>>[])
            _Target(
              key: 'p2p:${p['id']}',
              icon: p['kind'] == 'display' ? LucideIcons.monitor : (p['kind'] == 'audio' ? LucideIcons.speaker : LucideIcons.wifi),
              name: text(p['name']) ?? 'Wi-Fi Direct',
              detail: 'Wi-Fi Direct',
              onTap: () {
                _close();
                unawaited(_call<bool>('castSettings'));
              },
            ),
        ];

        return Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _NowCard(name: nowName, icon: nowIcon, badge: nowBadge, track: nowTrack, playing: nowPlaying, cast: cast.active ? cast : null, player: player),
            const SizedBox(height: 6),
            ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 8),
              leading: Icon(LucideIcons.usersRound, color: muted),
              title: Text(tr('Автоматично запрошувати друзів поблизу в джем'), style: body(15)),
              subtitle: nearbyFriends > 0 ? Text(tr('Поруч друзів: {n}', {'n': '$nearbyFriends'}), style: body(13, color: muted)) : null,
              trailing: GcSwitch(value: autoInvite, onChanged: _setJam),
              onTap: () => _setJam(!autoInvite),
            ),
            Divider(height: 1, color: ink.withValues(alpha: 0.08)),
            const SizedBox(height: 4),
            for (final t in targets)
              ListTile(
                key: ValueKey(t.key),
                contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                leading: Icon(t.icon, color: ink.withValues(alpha: 0.85)),
                title: Row(children: [
                  Flexible(child: FitText(t.name, style: body(16, weight: FontWeight.w600))),
                  if (t.badge != null) ...[const SizedBox(width: 8), _Badge(t.badge!)],
                ]),
                subtitle: t.detail == null ? null : FitText(t.detail!, style: body(13, color: muted)),
                onTap: t.onTap,
              ),
            if (scanning)
              ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                leading: const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2)),
                title: Text(tr('Шукаємо пристрої поруч…'), style: body(14, color: muted)),
              )
            else if (targets.isEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
                child: Text(
                  tr('Поруч нічого не знайдено. Відкрийте GameCon на комп’ютері чи іншому телефоні, увімкніть телевізор або колонку в тій самій Wi-Fi-мережі.'),
                  style: body(13, color: muted).copyWith(height: 1.45),
                ),
              ),
            if (!scanning && (bonded == null || nearby == null))
              ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                leading: Icon(LucideIcons.radar, color: accent),
                title: Text(tr('Дозволити пошук пристроїв поруч'), style: body(15, color: accent)),
                subtitle: Text(tr('Bluetooth-навушники й колонки, телевізори через Wi-Fi Direct'), style: body(13, color: muted)),
                onTap: () => unawaited(_scan(ask: true)),
              ),
            if (!scanning)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => unawaited(_scan()),
                  icon: Icon(LucideIcons.refreshCw, size: 16, color: muted),
                  label: Text(tr('Шукати ще раз'), style: body(13, color: muted)),
                ),
              ),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(
                child: _BigButton(
                  icon: LucideIcons.usersRound,
                  label: tr('Почати джем'),
                  onTap: () {
                    final id = local?.source == 'local' ? local?.id : null;
                    _close();
                    unawaited(startListening(widget.host, trackId: id));
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _BigButton(
                  icon: LucideIcons.bluetooth,
                  label: 'Bluetooth',
                  color: accent,
                  onTap: () => unawaited(_call<bool>('bluetoothSettings')),
                ),
              ),
            ]),
          ]),
        );
      },
    );
  }

  String _line(String title, String artist) {
    final who = artistOf(artist);
    return who.isEmpty ? title : '$title — $who';
  }
}

/// Картка «де грає зараз»: назва пристрою, позначка, трек з еквалайзером і велика іконка.
class _NowCard extends StatelessWidget {
  const _NowCard({required this.name, required this.icon, required this.badge, required this.track, required this.playing, required this.cast, required this.player});
  final String name;
  final IconData icon;
  final String? badge;
  final String? track;
  final bool playing;
  final DlnaCast? cast;
  final TrackPlayer player;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 16, 14, 16),
      decoration: BoxDecoration(color: ink.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(24)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: FitText(name, style: display(26))),
                if (badge != null) ...[const SizedBox(width: 10), _Badge(badge!)],
              ]),
              if (track != null) ...[
                const SizedBox(height: 6),
                Row(children: [
                  _Equalizer(active: playing, color: accent),
                  const SizedBox(width: 8),
                  Expanded(child: Text(track!, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(15, color: accent, weight: FontWeight.w600))),
                ]),
              ],
            ]),
          ),
          const SizedBox(width: 12),
          Icon(icon, size: 56, color: accent),
        ]),
        if (cast != null) ...[
          const SizedBox(height: 12),
          Row(children: [
            IconButton(
              onPressed: () => unawaited(player.toggle()),
              icon: Icon(player.playing ? LucideIcons.pause : LucideIcons.play, color: ink),
              tooltip: player.playing ? tr('Пауза') : tr('Грати'),
            ),
            Icon(LucideIcons.volume1, size: 18, color: muted),
            Expanded(
              child: Slider(
                value: cast!.volume,
                onChanged: (v) => cast!.previewVolume(v),
                onChangeEnd: (v) => unawaited(cast!.setVolume(v)),
              ),
            ),
            TextButton(onPressed: () => unawaited(cast!.stop()), child: Text(tr('Відключити'), style: body(14, color: accent, weight: FontWeight.w600))),
          ]),
          if (cast!.status == 'error')
            Text(tr('Пристрій не прийняв трек. Перевірте, що він увімкнений і в тій самій мережі.'), style: body(12, color: muted)),
        ],
      ]),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge(this.label);
  final String label;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: ink.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
        child: Text(label, style: body(12, color: ink.withValues(alpha: 0.75), weight: FontWeight.w600)),
      );
}

class _BigButton extends StatelessWidget {
  const _BigButton({required this.icon, required this.label, required this.onTap, this.color});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) => Material(
        color: ink.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Column(children: [
              Icon(icon, color: color ?? ink, size: 26),
              const SizedBox(height: 8),
              Text(label, style: body(14, color: color ?? ink, weight: FontWeight.w600)),
            ]),
          ),
        ),
      );
}

/// Три стовпчики «грає зараз»; без анімацій у системі — нерухомі.
class _Equalizer extends StatefulWidget {
  const _Equalizer({required this.active, required this.color});
  final bool active;
  final Color color;

  @override
  State<_Equalizer> createState() => _EqualizerState();
}

class _EqualizerState extends State<_Equalizer> with SingleTickerProviderStateMixin {
  late final _anim = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(_Equalizer old) {
    super.didUpdateWidget(old);
    _sync();
  }

  void _sync() {
    final still = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (widget.active && !still) {
      if (!_anim.isAnimating) _anim.repeat(reverse: true);
    } else {
      _anim.stop();
    }
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _anim,
        builder: (_, _) => SizedBox(
          width: 16,
          height: 14,
          child: Row(crossAxisAlignment: CrossAxisAlignment.end, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            for (final phase in const [0.0, 0.45, 0.8])
              Container(
                width: 3.5,
                height: 4 + 10 * (widget.active ? (0.35 + 0.65 * ((_anim.value + phase) % 1.0)) : 0.4),
                decoration: BoxDecoration(color: widget.color, borderRadius: BorderRadius.circular(1)),
              ),
          ]),
        ),
      );
}
