import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'core/widgets/arctic_glass/arctic_glass.dart';
import 'full_player.dart' show showAudioOutput;
import 'i18n.dart';
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
      Flexible(child: Text(tr('Грає на: {device}', {'device': device.name}), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(size, color: accent, weight: FontWeight.w600).copyWith(height: 1.2))),
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
        padding: const EdgeInsets.fromLTRB(ArcticDock.side, 0, ArcticDock.side, 8),
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
                        Text(state.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14.5, weight: FontWeight.w700).copyWith(height: 1.2)),
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
            Text(state.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: display(20)),
            const SizedBox(height: 4),
            Text(artistOf(state.artist), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, color: muted)),
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

/// «Пристрої»: цей телефон і інші пристрої акаунта; дотик — перемкнути музику туди.
Future<void> showConnectDevices(BuildContext context) async {
  final connect = GameConnect.instance;
  if (connect == null) return showAudioOutput(context);
  unawaited(connect.heartbeat());
  await showGcSheet<void>(
    context,
    title: tr('Пристрої'),
    subtitle: tr('GameCon Connect'),
    builder: (sheet) => ListenableBuilder(
      listenable: Listenable.merge([connect, connect.player]),
      builder: (sheet, _) {
        final player = connect.player;
        final activeId = player.playing ? connect.deviceId : connect.active?.id;
        final others = [for (final d in connect.devices) if (d.id != connect.deviceId) d];
        final local = player.current;
        Widget row({required IconData icon, required String title, required String subtitle, required bool active, VoidCallback? onTap}) => ListTile(
              leading: Icon(icon, color: active ? accent : muted),
              title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(15, weight: FontWeight.w600, color: active ? accent : ink)),
              subtitle: Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(13, color: muted)),
              trailing: active ? Icon(LucideIcons.audioLines, color: accent, size: 20) : null,
              onTap: onTap,
            );
        String line(String title, String artist, bool playing) {
          final who = artistOf(artist);
          final base = who.isEmpty ? title : '$title — $who';
          return playing ? base : '$base · ${tr('пауза')}';
        }

        return Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            row(
              icon: LucideIcons.smartphone,
              title: tr('Цей пристрій'),
              subtitle: local == null ? connect.deviceName : line(local.title, local.artist, player.playing),
              active: activeId == connect.deviceId || (activeId == null && local != null),
              onTap: () {
                Navigator.pop(sheet);
                unawaited(connect.playHere());
              },
            ),
            for (final d in others)
              row(
                icon: d.icon,
                title: d.name,
                subtitle: d.state == null ? tr('Нічого не грає') : line(d.state!.title, d.state!.artist, d.state!.playing),
                active: d.id == activeId,
                onTap: () {
                  Navigator.pop(sheet);
                  unawaited(connect.transferTo(d.id));
                },
              ),
            if (others.isEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),
                child: Text(tr('Відкрийте GameCon на комп’ютері чи іншому телефоні з цим акаунтом — він з’явиться тут.'), style: body(13, color: muted).copyWith(height: 1.45)),
              ),
            ListTile(
              leading: Icon(LucideIcons.bluetooth, color: muted),
              title: Text(tr('Навушники чи колонка…'), style: body(15)),
              onTap: () {
                Navigator.pop(sheet);
                unawaited(showAudioOutput(context));
              },
            ),
          ]),
        );
      },
    ),
  );
}
