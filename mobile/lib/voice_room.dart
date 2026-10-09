import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_background/flutter_background.dart';
import 'package:go_router/go_router.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:record/record.dart';

import 'api.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';
import 'i18n.dart';

/// Висота панелі розмови над міні-плеєром.
const voiceBarExtent = 64.0;

/// Розмова в голосовій кімнаті. Одна на весь застосунок і живе поза екранами,
/// тому не обривається під час переходів між розділами й коли застосунок згорнуто.
class VoiceCall extends ChangeNotifier {
  VoiceCall._();
  static final instance = VoiceCall._();

  Room? _room;
  EventsListener<RoomEvent>? _events;
  Api? _api;

  /// idle | connecting | connected
  String status = 'idle';

  /// room — голосова кімната сім’ї чи спільноти; call — дзвінок у бесіді.
  String? kind;
  int? roomId;
  int? callId;
  int? conversationId;
  String roomName = '';
  String label = '';
  String route = '';
  bool micOn = false;
  bool micBlocked = false;
  bool deafened = false;
  Set<String> speaking = {};
  DateTime? connectedAt;

  bool get active => status != 'idle';

  /// Голосова кімната сім’ї чи спільноти.
  Future<void> join(Api api, Map<String, dynamic> room, {required String label, required String route, void Function(Object error)? onError}) async {
    final id = intOf(room['id']);
    if (kind == 'room' && roomId == id && active) return;
    await _connect(
      api,
      () => api.post('/api/v1/voice/rooms/$id/join'),
      onError: onError,
      failure: tr('Не вдалося підключитися до голосової кімнати.'),
      meta: () {
        kind = 'room';
        roomId = id;
        roomName = text(room['name']) ?? tr('Кімната');
        this.label = label;
        this.route = route;
      },
    );
  }

  /// Голос під час спільного перегляду фільму.
  Future<void> watch(Api api, String code, String title, {void Function(Object error)? onError}) async {
    await _connect(
      api,
      () => api.post('/api/v1/watch/$code/voice'),
      onError: onError,
      failure: tr('Не вдалося підключити голос.'),
      meta: () {
        kind = 'room';
        roomId = null;
        roomName = title;
        label = tr('Спільний перегляд');
        route = '/watch/$code';
      },
    );
  }

  /// Подзвонити в бесіду або приєднатися до дзвінка, що вже триває.
  Future<void> call(Api api, int conversation, String title, {void Function(Object error)? onError}) async {
    if (kind == 'call' && conversationId == conversation && active) return;
    await _connect(
      api,
      () => api.post('/api/v1/messages/$conversation/call'),
      onError: onError,
      failure: tr('Не вдалося зателефонувати.'),
      meta: () => _callMeta(conversation, title),
    );
  }

  /// Відповісти на вхідний дзвінок.
  Future<void> answer(Api api, int call, int conversation, String title, {void Function(Object error)? onError}) async {
    if (kind == 'call' && callId == call && active) return;
    await _connect(
      api,
      () => api.post('/api/v1/calls/$call/join'),
      onError: onError,
      failure: tr('Не вдалося відповісти на дзвінок.'),
      meta: () {
        _callMeta(conversation, title);
        callId = call;
      },
    );
  }

  void _callMeta(int conversation, String title) {
    kind = 'call';
    conversationId = conversation;
    roomName = title;
    label = tr('Дзвінок');
    route = '/messages/$conversation';
  }

  /// Якість звуку: Opus 96 кбіт/с, RED (надлишкові пакети від втрат), DTX (тиша не передається),
  /// шумо- й ехоподавлення, автопідсилення й фільтр низьких частот.
  static const _options = RoomOptions(
    adaptiveStream: true,
    dynacast: true,
    defaultAudioCaptureOptions: AudioCaptureOptions(noiseSuppression: true, echoCancellation: true, autoGainControl: true, highPassFilter: true),
    defaultAudioPublishOptions: AudioPublishOptions(encoding: AudioEncoding.presetMusicHighQuality, dtx: true, red: true),
  );

  Future<void> _connect(Api api, Future<Map<String, dynamic>> Function() access, {required void Function() meta, required String failure, void Function(Object error)? onError}) async {
    if (_room != null) await leave();
    _api = api;
    meta();
    status = 'connecting';
    notifyListeners();

    try {
      final recorder = AudioRecorder();
      final allowed = await recorder.hasPermission();
      await recorder.dispose();
      if (!allowed) throw ApiException(tr('Дозвольте мікрофон, щоб говорити.'));

      final data = await access();
      final call = mapOf(data['call']);
      if (call.isNotEmpty) callId = intOf(call['id']);
      final next = Room(roomOptions: _options);
      _room = next;
      final events = next.createListener();
      _events = events;
      events
        ..on<ActiveSpeakersChangedEvent>((e) {
          speaking = {for (final p in e.speakers) p.identity};
          notifyListeners();
        })
        ..on<TrackSubscribedEvent>((e) {
          if (deafened && e.track is RemoteAudioTrack) e.track.disable();
        })
        ..on<ParticipantPermissionsUpdatedEvent>((e) {
          if (e.participant != next.localParticipant) return;
          micBlocked = !e.permissions.canPublish;
          if (micBlocked) micOn = false;
          notifyListeners();
        })
        ..on<RoomDisconnectedEvent>((e) {
          if (_room != next) return;
          if (e.reason == DisconnectReason.participantRemoved) onError?.call(tr('Вас виключили з голосової кімнати.'));
          unawaited(_reset());
        });

      await next.connect(text(data['url']) ?? '', text(data['token']) ?? '');
      if (_room != next) {
        await next.disconnect();
        return;
      }
      await _keepAlive(true);
      micBlocked = next.localParticipant?.permissions.canPublish == false;
      status = 'connected';
      connectedAt = DateTime.now();
      notifyListeners();
      if (!micBlocked) await _setMic(true);
    } catch (e) {
      await _room?.disconnect();
      await _reset();
      onError?.call(e is ApiException ? e : failure);
    }
  }

  Future<void> leave() async {
    final room = _room;
    final call = kind == 'call' ? callId : null;
    final api = _api;
    _room = null;
    await room?.disconnect();
    await _reset();
    // Співрозмовник побачить кінець дзвінка одразу, не чекаючи вебхука LiveKit.
    if (call != null && api != null) unawaited(api.post('/api/v1/calls/$call/leave').then((_) => null, onError: (_) => null));
  }

  Future<void> _reset() async {
    _room = null;
    await _events?.dispose();
    _events = null;
    await _keepAlive(false);
    status = 'idle';
    kind = null;
    roomId = null;
    callId = null;
    conversationId = null;
    connectedAt = null;
    micOn = false;
    micBlocked = false;
    speaking = {};
    notifyListeners();
  }

  /// Foreground-сервіс із мікрофоном: Android не вимикає розмову у згорнутому застосунку.
  Future<void> _keepAlive(bool on) async {
    try {
      if (on) {
        final ready = await FlutterBackground.initialize(
          androidConfig: FlutterBackgroundAndroidConfig(
            notificationTitle: 'GameCon',
            notificationText: tr('Ви в голосовій розмові'),
            notificationIcon: AndroidResource(name: 'ic_notification', defType: 'drawable'),
            shouldRequestBatteryOptimizationsOff: false,
          ),
        );
        if (ready && !FlutterBackground.isBackgroundExecutionEnabled) await FlutterBackground.enableBackgroundExecution();
      } else if (FlutterBackground.isBackgroundExecutionEnabled) {
        await FlutterBackground.disableBackgroundExecution();
      }
    } catch (_) {
      // Без фонового режиму розмова все одно працює, поки застосунок відкрито.
    }
  }

  Future<void> _setMic(bool on) async {
    final local = _room?.localParticipant;
    if (local == null) return;
    try {
      await local.setMicrophoneEnabled(on);
      micOn = on;
    } catch (_) {
      micOn = false;
    }
    notifyListeners();
  }

  /// Повертає текст підказки, якщо мікрофон забрав модератор.
  String? toggleMic() {
    if (micBlocked) return tr('Модератор вимкнув вам мікрофон.');
    unawaited(_setMic(!micOn));
    return null;
  }

  Future<void> toggleDeafen() async {
    deafened = !deafened;
    for (final p in _room?.remoteParticipants.values ?? const <RemoteParticipant>[]) {
      for (final pub in p.audioTrackPublications) {
        final track = pub.track;
        if (track == null) continue;
        deafened ? await track.disable() : await track.enable();
      }
    }
    notifyListeners();
  }
}

/// Голосові кімнати сім’ї чи спільноти: хто де сидить, вхід одним дотиком,
/// для керівників — створення, перейменування, вимкнення мікрофона й виключення.
class VoiceRoomsPanel extends StatefulWidget {
  const VoiceRoomsPanel({required this.type, required this.id, required this.label, required this.route, super.key});
  final String type;
  final int id;
  final String label;
  final String route;

  @override
  State<VoiceRoomsPanel> createState() => _VoiceRoomsPanelState();
}

class _VoiceRoomsPanelState extends State<VoiceRoomsPanel> {
  Map<String, dynamic>? data;
  Timer? _poll;
  final call = VoiceCall.instance;
  String _seen = '';

  Api get api => AppScope.read(context).session.api;
  String get path => '/api/v1/voice/${widget.type}/${widget.id}';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    // Хто зайшов і вийшов — оновлюємо раз на кілька секунд, поки панель на екрані.
    _poll = Timer.periodic(const Duration(seconds: 8), (_) => _load());
    call.addListener(_onCall);
  }

  @override
  void dispose() {
    _poll?.cancel();
    call.removeListener(_onCall);
    super.dispose();
  }

  void _onCall() {
    final key = '${call.status}:${call.roomId}';
    if (key != _seen && call.status != 'connecting') _load();
    _seen = key;
    if (mounted) setState(() {});
  }

  Future<void> _load() async {
    try {
      final result = await api.get(path);
      if (mounted) setState(() => data = result);
    } catch (_) {
      // Немає доступу або голос вимкнено — панель просто не показуємо.
    }
  }

  Future<void> _run(Future<Map<String, dynamic>> Function() action) async {
    try {
      final result = await action();
      if (mounted) setState(() => data = result);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _create() async {
    final name = (await askText(context, tr('Нова кімната'), hint: tr('Назва'), action: tr('Створити')))?.trim();
    if (name != null && name.isNotEmpty) await _run(() => api.post(path, {'name': name}));
  }

  Future<void> _roomMenu(Map<String, dynamic> room) async {
    final action = await showGcSheet<String>(
      context,
      title: text(room['name']),
      builder: (sheet) => Column(mainAxisSize: MainAxisSize.min, children: [
        _SheetAction(icon: LucideIcons.pencil, label: tr('Перейменувати'), onTap: () => Navigator.pop(sheet, 'rename')),
        if (room['system'] != true) _SheetAction(icon: LucideIcons.trash2, label: tr('Видалити'), danger: true, onTap: () => Navigator.pop(sheet, 'delete')),
      ]),
    );
    if (!mounted || action == null) return;
    final id = intOf(room['id']);
    if (action == 'rename') {
      final name = (await askText(context, tr('Нова назва'), initial: text(room['name']) ?? ''))?.trim();
      if (name != null && name.isNotEmpty) await _run(() => api.patch('/api/v1/voice/rooms/$id', {'name': name}));
    } else if (action == 'delete' && await confirm(context, tr('Видалити кімнату «{v}»?', {'v': text(room['name'])}), danger: true, action: tr('Видалити'))) {
      await _run(() => api.delete('/api/v1/voice/rooms/$id'));
    }
  }

  Future<void> _memberMenu(Map<String, dynamic> room, Map<String, dynamic> person) async {
    final muted = person['muted'] == true;
    final action = await showGcSheet<String>(
      context,
      title: text(person['name']),
      builder: (sheet) => Column(mainAxisSize: MainAxisSize.min, children: [
        _SheetAction(icon: muted ? LucideIcons.mic : LucideIcons.micOff, label: muted ? tr('Дозволити мікрофон') : tr('Вимкнути мікрофон'), onTap: () => Navigator.pop(sheet, muted ? 'unmute' : 'mute')),
        _SheetAction(icon: LucideIcons.userX, label: tr('Виключити з кімнати'), danger: true, onTap: () => Navigator.pop(sheet, 'kick')),
      ]),
    );
    if (!mounted || action == null) return;
    await _run(() => api.post('/api/v1/voice/rooms/${intOf(room['id'])}/members/${intOf(person['id'])}', {'action': action}));
  }

  @override
  Widget build(BuildContext context) {
    final page = data;
    if (page == null) return const SizedBox.shrink();
    final enabled = page['enabled'] == true;
    final manage = page['can_manage'] == true;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Glass(
        padding: const EdgeInsets.fromLTRB(14, 12, 8, 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            const Icon(LucideIcons.volume2, size: 18, color: primary),
            const SizedBox(width: 8),
            Expanded(child: Text(tr('Голосові кімнати'), style: body(15, weight: FontWeight.w700))),
            if (manage) IconButton(onPressed: _create, icon: const Icon(LucideIcons.plus, size: 20, color: muted), tooltip: tr('Нова кімната')),
          ]),
          if (!enabled)
            Padding(
              padding: const EdgeInsets.only(top: 4, bottom: 6, right: 6),
              child: Text(tr('Голосовий сервер ще не підключено адміністрацією сайту.'), style: body(12.5, color: muted)),
            ),
          for (final room in maps(page['rooms'])) _room(room, enabled, manage),
        ]),
      ),
    );
  }

  Widget _room(Map<String, dynamic> room, bool enabled, bool manage) {
    final id = intOf(room['id']);
    final locked = room['locked'] == true;
    final here = call.kind == 'room' && call.roomId == id && call.active;
    final people = maps(room['participants']);
    final count = intOf(room['count']);

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Material(
        color: here ? primary.withValues(alpha: 0.14) : Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: locked || !enabled || here
              ? (locked ? () => toast(context, tr('Ця кімната закрита для вашого рангу.')) : null)
              : () => call.join(api, room, label: widget.label, route: widget.route, onError: (e) {
                    if (mounted) toast(context, e);
                  }),
          onLongPress: manage ? () => _roomMenu(room) : null,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
            child: Row(children: [
              if (here && call.status == 'connecting')
                const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              else
                Icon(locked ? LucideIcons.lock : LucideIcons.volume2, size: 18, color: locked ? faint : (here ? green : muted)),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  text(room['name']) ?? '',
                  overflow: TextOverflow.ellipsis,
                  style: body(14.5, color: locked ? faint : (here ? ink : soft), weight: here ? FontWeight.w700 : FontWeight.w500),
                ),
              ),
              if (count > 0) Text('$count', style: body(12.5, color: muted)),
              if (manage) ...[
                const SizedBox(width: 4),
                InkResponse(onTap: () => _roomMenu(room), radius: 18, child: const Icon(LucideIcons.ellipsis, size: 18, color: faint)),
              ],
            ]),
          ),
        ),
      ),
      for (final person in people)
        Padding(
          padding: const EdgeInsets.only(left: 34, right: 4, bottom: 2),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: manage ? () => _memberMenu(room, person) : null,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5),
              child: Row(children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: call.speaking.contains('u${intOf(person['id'])}') ? green : Colors.transparent, width: 2),
                  ),
                  child: Avatar(name: text(person['name']) ?? '', url: absolute(person['avatar_url']), size: 26),
                ),
                const SizedBox(width: 8),
                Expanded(child: Text(text(person['name']) ?? '', overflow: TextOverflow.ellipsis, style: body(13, color: soft))),
                if (person['muted'] == true) const Icon(LucideIcons.micOff, size: 15, color: dangerSoft),
              ]),
            ),
          ),
        ),
    ]);
  }
}

class _SheetAction extends StatelessWidget {
  const _SheetAction({required this.icon, required this.label, required this.onTap, this.danger = false});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final color = danger ? dangerSoft : ink;
    return ListTile(
      leading: Icon(icon, color: color),
      title: Text(label, style: body(15, color: color, weight: FontWeight.w600)),
      onTap: onTap,
    );
  }
}

/// Панель поточної розмови над нижнім меню: видно на всіх екранах, поки ви в кімнаті.
class VoiceBar extends StatefulWidget {
  const VoiceBar({super.key});

  @override
  State<VoiceBar> createState() => _VoiceBarState();
}

class _VoiceBarState extends State<VoiceBar> {
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    // Тривалість дзвінка на панелі оновлюється щосекунди.
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && VoiceCall.instance.kind == 'call') setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  String _elapsed(DateTime? since) {
    if (since == null) return '';
    final seconds = DateTime.now().difference(since).inSeconds;
    return '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final call = VoiceCall.instance;
    return ListenableBuilder(
      listenable: call,
      builder: (context, _) {
        if (!call.active) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.fromLTRB(10, 0, 10, 6),
          child: SizedBox(
            height: voiceBarExtent - 6,
            child: Glass(
              radius: 18,
              padding: const EdgeInsets.fromLTRB(12, 6, 6, 6),
              onTap: call.route.isEmpty ? null : () => context.go(call.route),
              child: Row(children: [
                if (call.status == 'connecting')
                  const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                else
                  const Icon(LucideIcons.volume2, size: 18, color: green),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(call.roomName, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, weight: FontWeight.w700)),
                    Text(call.status == 'connecting' ? tr('Підключення…') : (call.kind == 'call' ? '${call.label} · ${_elapsed(call.connectedAt)}' : call.label), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
                  ]),
                ),
                _BarButton(
                  icon: call.micOn ? LucideIcons.mic : LucideIcons.micOff,
                  active: call.micOn,
                  tooltip: call.micOn ? tr('Вимкнути мікрофон') : tr('Увімкнути мікрофон'),
                  onTap: call.status == 'connected'
                      ? () {
                          final hint = call.toggleMic();
                          if (hint != null) toast(context, hint);
                        }
                      : null,
                ),
                _BarButton(
                  icon: call.deafened ? LucideIcons.headphoneOff : LucideIcons.headphones,
                  active: !call.deafened,
                  tooltip: call.deafened ? tr('Увімкнути звук') : tr('Вимкнути звук'),
                  onTap: call.toggleDeafen,
                ),
                _BarButton(icon: LucideIcons.phoneOff, tooltip: call.kind == 'call' ? tr('Покласти слухавку') : tr('Вийти з кімнати'), leave: true, onTap: call.leave),
              ]),
            ),
          ),
        );
      },
    );
  }
}

class _BarButton extends StatelessWidget {
  const _BarButton({required this.icon, required this.tooltip, required this.onTap, this.active = true, this.leave = false});
  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;
  final bool active;
  final bool leave;

  @override
  Widget build(BuildContext context) {
    final bg = leave ? danger : (active ? Colors.white.withValues(alpha: 0.06) : danger.withValues(alpha: 0.16));
    final fg = leave ? Colors.white : (active ? ink : dangerSoft);
    return Padding(
      padding: const EdgeInsets.only(left: 6),
      child: Tooltip(
        message: tooltip,
        child: Material(
          color: bg,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: onTap,
            child: SizedBox(width: 40, height: 40, child: Icon(icon, size: 18, color: fg)),
          ),
        ),
      ),
    );
  }
}
