import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'api.dart';
import 'state.dart';
import 'theme.dart';
import 'voice_room.dart';
import 'widgets.dart';

/// Розходження з ведучим, після якого перемотуємо (секунди).
const _drift = 2.5;

String _clock(double seconds) {
  final s = seconds.isFinite ? seconds.floor().clamp(0, 1 << 31) : 0;
  final h = s ~/ 3600;
  final m = (s % 3600) ~/ 60;
  final rest = (s % 60).toString().padLeft(2, '0');
  return h > 0 ? '$h:${m.toString().padLeft(2, '0')}:$rest' : '$m:$rest';
}

/// Спільний перегляд у застосунку: той самий плеєр, що на сайті, керований через міст `/play/embed`.
/// Стан ведучого — опитуванням раз на 2 секунди (на сайті — миттєво через Reverb).
class WatchPartyScreen extends StatefulWidget {
  const WatchPartyScreen({required this.code, super.key});
  final String code;

  @override
  State<WatchPartyScreen> createState() => _WatchPartyScreenState();
}

class _WatchPartyScreenState extends State<WatchPartyScreen> {
  Map<String, dynamic>? movie;
  List<Map<String, dynamic>> players = [];
  List<Map<String, dynamic>> friends = [];
  Map<String, dynamic> party = {};
  final messages = <Map<String, dynamic>>[];
  Object? error;
  WebViewController? web;
  String? loadedKey;
  Timer? poll;
  final input = TextEditingController();
  final voice = VoiceCall.instance;

  double localTime = 0;
  bool synced = false;
  int offsetMs = 0;
  int applyingUntil = 0;
  int lastSeek = 0;
  String lastStateSig = '';

  Api get api => AppScope.read(context).session.api;
  String get base => '/api/v1/watch/${widget.code}';
  Map<String, dynamic> get state => mapOf(party['state']);
  bool get control => party['can_control'] == true && party['ended'] != true;
  int get now => DateTime.now().millisecondsSinceEpoch;

  Map<String, dynamic>? get player {
    final key = text(state['player_key']);
    return players.where((p) => text(p['key']) == key).firstOrNull ?? players.firstOrNull;
  }

  bool get kodik => player?['provider'] == 'kodik';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    poll = Timer.periodic(const Duration(seconds: 2), (_) => _poll());
    voice.addListener(_onVoice);
  }

  @override
  void dispose() {
    poll?.cancel();
    input.dispose();
    voice.removeListener(_onVoice);
    SystemChrome.setPreferredOrientations(const []);
    super.dispose();
  }

  void _onVoice() {
    if (mounted) setState(() {});
  }

  Future<void> _load() async {
    try {
      final data = await api.get(base);
      if (!mounted) return;
      setState(() {
        movie = mapOf(data['movie']);
        players = maps(data['players']);
        friends = maps(data['friends']);
        _absorb(mapOf(data['party']), initial: true);
        error = null;
      });
      _ensurePlayer();
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  Future<void> _poll() async {
    if (movie == null) return;
    final last = messages.isEmpty ? 0 : intOf(messages.last['id']);
    try {
      final data = await api.get('$base/state?after=$last');
      if (!mounted) return;
      setState(() => _absorb(data));
      _ensurePlayer();
    } catch (_) {}
  }

  void _absorb(Map<String, dynamic> fresh, {bool initial = false}) {
    final wasEnded = party['ended'] == true;
    final incoming = maps(fresh['messages']);
    party = {...fresh};
    if (initial) messages.clear();
    for (final m in incoming) {
      if (!messages.any((x) => x['id'] == m['id'])) messages.add(m);
    }
    final s = mapOf(fresh['state']);
    offsetMs = intOf(s['server_ms']) - now;
    final sig = '${s['playing']}:${s['position']}:${s['state_ms']}';
    if (sig != lastStateSig) {
      lastStateSig = sig;
      if (!initial) _apply();
    }
    if (!wasEnded && fresh['ended'] == true && !initial) toast(context, 'Ведучий завершив спільний перегляд');
  }

  double _expected() {
    final s = state;
    final position = (s['position'] as num?)?.toDouble() ?? 0;
    if (s['playing'] != true) return position;
    return position + (now + offsetMs - intOf(s['state_ms'])) / 1000;
  }

  void _ensurePlayer() {
    final p = player;
    final key = text(p?['key']);
    if (p == null || key == loadedKey) return;
    final raw = text(p['link']);
    if (raw == null) return;
    loadedKey = key;
    synced = false;
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..setUserAgent('Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36')
      ..addJavaScriptChannel('GcBridge', onMessageReceived: (m) => _onPlayer(m.message))
      ..loadRequest(Uri.parse('${Api.root}/play/embed').replace(queryParameters: {'src': absolute(raw) ?? raw}));
    setState(() => web = controller);
  }

  /// Подія плеєра з мосту (Kodik: kodik_player_*; Playerjs: event).
  void _onPlayer(String raw) {
    Map<String, dynamic> data;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return;
      data = Map<String, dynamic>.from(decoded);
    } catch (_) {
      return;
    }
    final name = '${data['key'] ?? data['event'] ?? ''}';
    final value = data['value'] ?? data['data'];
    final time = value is num ? value.toDouble() : (value is Map && value['time'] is num ? (value['time'] as num).toDouble() : null);

    if (RegExp(r'time_update|^time$|timeupdate', caseSensitive: false).hasMatch(name)) {
      if (time == null) return;
      localTime = time;
      if (!synced) setState(() => synced = true);
      if (!control && (time - _expected()).abs() > _drift && now - lastSeek > 4000) {
        lastSeek = now;
        applyingUntil = now + 1500;
        _send('seek', _expected());
      }
      return;
    }
    if (now < applyingUntil) return;
    final event = RegExp('pause', caseSensitive: false).hasMatch(name)
        ? 'pause'
        : (RegExp('seek', caseSensitive: false).hasMatch(name) ? 'seek' : (RegExp('play', caseSensitive: false).hasMatch(name) ? 'play' : null));
    if (event == null) return;

    if (control) {
      final playing = event == 'play' ? true : (event == 'pause' ? false : state['playing'] == true);
      _post(playing, time ?? localTime);
    } else {
      Timer(const Duration(milliseconds: 300), _apply);
    }
  }

  void _send(String method, [double? seconds]) {
    final controller = web;
    if (controller == null) return;
    final msg = kodik
        ? {'key': 'kodik_player_api', 'value': method == 'seek' ? {'method': method, 'seconds': seconds} : {'method': method}}
        : (method == 'seek' ? {'api': 'seek', 'set': seconds} : {'api': method});
    unawaited(controller.runJavaScript('window.gcSend && window.gcSend(${jsonEncode(msg)});').catchError((_) {}));
  }

  void _apply() {
    if (web == null) return;
    applyingUntil = now + 1500;
    final target = _expected();
    if ((localTime - target).abs() > _drift) _send('seek', target);
    _send(state['playing'] == true ? 'play' : 'pause');
  }

  Future<void> _post(bool playing, double position, {String? playerKey}) async {
    try {
      final result = await api.post('$base/state', {'playing': playing, 'position': position, 'player_key': playerKey ?? text(player?['key'])});
      if (!mounted) return;
      final s = mapOf(result['state']);
      setState(() {
        party = {...party, 'state': s};
        offsetMs = intOf(s['server_ms']) - now;
        lastStateSig = '${s['playing']}:${s['position']}:${s['state_ms']}';
      });
      _ensurePlayer();
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _say() async {
    final body = input.text.trim();
    if (body.isEmpty) return;
    input.clear();
    try {
      await api.post('$base/messages', {'body': body});
      await _poll();
    } catch (e) {
      input.text = body;
      if (mounted) toast(context, e);
    }
  }

  Future<void> _invite() async {
    final picked = <int>{};
    final send = await showGcSheet<bool>(
      context,
      title: 'Запросити друзів',
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheet) => Column(mainAxisSize: MainAxisSize.min, children: [
          if (friends.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text('Друзів поки немає — надішліть посилання.', style: body(13.5, color: muted))),
          for (final f in friends)
            CheckboxListTile(
              value: picked.contains(intOf(f['id'])),
              onChanged: (on) => setSheet(() => on == true ? picked.add(intOf(f['id'])) : picked.remove(intOf(f['id']))),
              secondary: Avatar(name: text(f['name']) ?? '', url: absolute(f['avatar_url']), size: 36),
              title: Text(text(f['name']) ?? '', style: body(14.5)),
            ),
          const SizedBox(height: 8),
          PrimaryButton(label: 'Надіслати', icon: LucideIcons.send, onPressed: () => Navigator.pop(sheet, true)),
        ]),
      ),
    );
    if (send != true || picked.isEmpty || !mounted) return;
    try {
      final result = await api.post('$base/invite', {'user_ids': picked.toList()});
      if (mounted) toast(context, 'Запрошення надіслано: ${result['sent']}');
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _end() async {
    if (!await confirm(context, 'Завершити спільний перегляд для всіх?', danger: true, action: 'Завершити')) return;
    try {
      await api.delete(base);
      if (mounted) context.pop();
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final film = movie;
    if (film == null) {
      return error == null
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2.4))
          : Center(child: Padding(padding: const EdgeInsets.all(20), child: EmptyState(icon: LucideIcons.popcorn, title: 'Перегляд недоступний', text: '$error', action: 'Спробувати знову', onAction: _load)));
    }
    final ended = party['ended'] == true;
    final members = maps(party['members']);
    final playing = state['playing'] == true;
    final inVoice = voice.kind == 'room' && voice.route == '/watch/${widget.code}' && voice.active;
    final title = text(film['title']) ?? 'Фільм';

    return ScreenScroll(
      onRefresh: _poll,
      children: [
        Row(children: [
          IconButton(onPressed: () => context.canPop() ? context.pop() : context.go('/cinema'), icon: const Icon(LucideIcons.arrowLeft, color: soft)),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(16, weight: FontWeight.w700)),
              Text('Разом · ведучий ${text(mapOf(party['host'])['name']) ?? '—'}', style: body(12, color: muted)),
            ]),
          ),
          if (!ended) IconButton(tooltip: 'Запросити', onPressed: _invite, icon: const Icon(LucideIcons.userPlus, color: primary)),
          IconButton(
            tooltip: 'Скопіювати посилання',
            onPressed: () {
              Clipboard.setData(ClipboardData(text: text(party['url']) ?? ''));
              toast(context, 'Посилання скопійовано');
            },
            icon: const Icon(LucideIcons.copy, color: muted),
          ),
        ]),
        const SizedBox(height: 8),
        if (ended)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Glass(child: Text('Спільний перегляд завершено.', style: body(13.5, color: soft))),
          ),
        Glass(
          padding: EdgeInsets.zero,
          child: Column(children: [
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: web == null ? const ColoredBox(color: Colors.black) : WebViewWidget(controller: web!),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(color: (playing ? green : Colors.white).withValues(alpha: playing ? 0.15 : 0.06), borderRadius: BorderRadius.circular(10)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(playing ? LucideIcons.play : LucideIcons.pause, size: 14, color: playing ? green : muted),
                    const SizedBox(width: 6),
                    Text('Ведучий: ${_clock(_expected())}', style: body(12.5, color: playing ? green : muted, weight: FontWeight.w600)),
                  ]),
                ),
                Text(
                  kodik ? (synced ? 'Синхронізовано' : 'Натисніть Play у плеєрі') : 'Тисніть Play разом за сигналом «Старт»',
                  style: body(12, color: kodik ? muted : gold),
                ),
                if (control) ...[
                  FilledButton.icon(
                    onPressed: () => _post(true, kodik ? localTime : 0),
                    style: FilledButton.styleFrom(backgroundColor: green, minimumSize: const Size(0, 36)),
                    icon: const Icon(LucideIcons.play, size: 16),
                    label: const Text('Старт разом'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () => _post(false, kodik ? localTime : _expected()),
                    style: OutlinedButton.styleFrom(minimumSize: const Size(0, 36), foregroundColor: soft),
                    icon: const Icon(LucideIcons.pause, size: 16),
                    label: const Text('Пауза для всіх'),
                  ),
                ],
              ]),
            ),
            if (control && players.length > 1)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                child: Wrap(spacing: 6, runSpacing: 6, children: [
                  for (final p in players)
                    ChoiceChip(
                      label: Text('${p['provider_label']}${text(p['translation']) != null ? ' · ${p['translation']}' : ''}'),
                      selected: text(p['key']) == text(player?['key']),
                      onSelected: (_) => _post(false, 0, playerKey: text(p['key'])),
                    ),
                ]),
              ),
          ]),
        ),
        if (party['is_host'] == true && !ended)
          Row(children: [
            Expanded(
              child: SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: state['shared_control'] == true,
                onChanged: (on) async {
                  await api.post('$base/shared', {'shared': on}).catchError((_) => <String, dynamic>{});
                  await _poll();
                },
                title: Text('Керувати можуть усі', style: body(13.5, color: soft)),
              ),
            ),
            TextButton.icon(onPressed: _end, icon: const Icon(LucideIcons.x, color: dangerSoft, size: 18), label: Text('Завершити', style: body(13.5, color: dangerSoft))),
          ]),
        const SizedBox(height: 10),
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Icon(LucideIcons.users, size: 18, color: primary),
              const SizedBox(width: 8),
              Expanded(child: Text('Дивляться (${members.length})', style: body(14.5, weight: FontWeight.w700))),
              if (party['voice_enabled'] == true && !ended)
                FilledButton.icon(
                  onPressed: () => inVoice
                      ? voice.leave()
                      : voice.watch(api, widget.code, title, onError: (e) {
                          if (mounted) toast(context, e);
                        }),
                  style: FilledButton.styleFrom(backgroundColor: inVoice ? danger : green, minimumSize: const Size(0, 34)),
                  icon: const Icon(LucideIcons.headphones, size: 16),
                  label: Text(inVoice ? 'Вийти з голосу' : 'Голос'),
                ),
            ]),
            const SizedBox(height: 8),
            for (final m in members)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(children: [
                  Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: voice.speaking.contains('u${m['id']}') ? green : Colors.transparent, width: 2)),
                    child: Avatar(name: text(m['name']) ?? '', url: absolute(m['avatar_url']), size: 28),
                  ),
                  const SizedBox(width: 8),
                  Expanded(child: Text(text(m['name']) ?? '', overflow: TextOverflow.ellipsis, style: body(13.5, color: soft))),
                  if (m['is_host'] == true) const Icon(LucideIcons.crown, size: 15, color: gold),
                ]),
              ),
          ]),
        ),
        const SizedBox(height: 10),
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              const Icon(LucideIcons.messageCircle, size: 18, color: primary),
              const SizedBox(width: 8),
              Text('Чат перегляду', style: body(14.5, weight: FontWeight.w700)),
            ]),
            const SizedBox(height: 8),
            if (messages.isEmpty) Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Text('Обговорюйте фільм тут', textAlign: TextAlign.center, style: body(12.5, color: muted))),
            for (final m in messages.length > 40 ? messages.sublist(messages.length - 40) : messages)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: RichText(
                  text: TextSpan(children: [
                    TextSpan(text: '${text(mapOf(m['user'])['first_name']) ?? '—'}  ', style: body(13, weight: FontWeight.w700, color: soft)),
                    TextSpan(text: text(m['body']) ?? '', style: body(13.5, color: soft)),
                  ]),
                ),
              ),
            if (!ended) ...[
              const SizedBox(height: 8),
              Row(children: [
                Expanded(
                  child: TextField(
                    controller: input,
                    maxLength: 500,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _say(),
                    decoration: const InputDecoration(hintText: 'Повідомлення', counterText: '', isDense: true),
                  ),
                ),
                IconButton(onPressed: _say, icon: const Icon(LucideIcons.send, color: primary)),
              ]),
            ],
          ]),
        ),
      ],
    );
  }
}
