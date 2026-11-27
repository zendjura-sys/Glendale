import 'dart:async';
import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_overlay_window/flutter_overlay_window.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'i18n.dart';

/// Ігровий оверлей GameCon на Android (#17): крапля поверх гри, натиск — панель з розділами,
/// які людина обрала (друзі онлайн, чати, «Готовий грати», хто з друзів у грі, завдання).
/// Лише якщо людина ввімкнула (і дала дозвіл «Поверх інших застосунків»).
///
/// Режими: «Лише в іграх» — крапля з’являється, коли GameCon іде у фон і на екрані гра
/// (визначає PlayingDetector, потрібен «Доступ до використання»); «Завжди у фоні» — щоразу,
/// коли GameCon у фоні. Повернулися в GameCon — крапля ховається.
class GameOverlay {
  static const _channel = MethodChannel('gamecon/app');

  static const enabledKey = 'game_overlay';
  static const modeKey = 'game_overlay_mode';
  static const sectionsKey = 'game_overlay_sections';

  /// Вкладка оверлею → модуль сайту, без якого її немає (null — є завжди). Порядок — як у панелі.
  static const sections = <String, String?>{
    'ready': null,
    'friends': 'friends',
    'playing': 'friends',
    'chats': 'messages',
    'family': 'families',
    'clans': 'clans',
    'notifications': null,
    'quests': 'quests',
  };

  static const defaults = ['ready', 'friends', 'chats', 'family', 'notifications'];

  /// Назви вкладок (для налаштувань і самої панелі).
  static Map<String, String> labels() => {
        'ready': tr('«Готовий грати»'),
        'friends': tr('Друзі'),
        'playing': tr('Хто з друзів у грі'),
        'chats': tr('Чати'),
        'family': tr("Сім'я"),
        'clans': tr('Клани'),
        'notifications': tr('Сповіщення'),
        'quests': tr('Завдання дня'),
      };

  static Future<bool> enabled() async => (await SharedPreferences.getInstance()).getBool(enabledKey) ?? false;

  /// 'games' (лише в іграх) або 'background' (завжди, коли GameCon у фоні).
  static Future<String> mode() async => (await SharedPreferences.getInstance()).getString(modeKey) ?? 'games';

  static Future<List<String>> chosen() async =>
      (await SharedPreferences.getInstance()).getStringList(sectionsKey) ?? defaults;

  static Future<bool> hasPermission() async {
    try {
      return await FlutterOverlayWindow.isPermissionGranted();
    } catch (_) {
      return false;
    }
  }

  static Future<bool> requestPermission() async {
    try {
      return await FlutterOverlayWindow.requestPermission() ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Модулі людини (режими й вимкнені розділи) — оверлей показує лише доступне.
  static Future<void> saveModules(Set<String>? modules) async {
    final prefs = await SharedPreferences.getInstance();
    if (modules != null) await prefs.setStringList('game_overlay_modules', modules.toList());
  }

  /// GameCon пішов у фон чи повернувся (викликає головний застосунок).
  static Future<void> onLifecycle(AppLifecycleState state) async {
    if (state == AppLifecycleState.resumed) {
      if (await _active()) await FlutterOverlayWindow.closeOverlay();
      return;
    }
    if (state != AppLifecycleState.paused || !await enabled() || !await hasPermission()) return;
    if (await mode() == 'games') {
      // Гра встигає вийти на передній план — тоді питаємо, що на екрані.
      await Future<void>.delayed(const Duration(milliseconds: 1500));
      String? game;
      try {
        game = await _channel.invokeMethod<String>('foregroundGame');
      } catch (_) {}
      if (game == null) return;
    }
    await show();
  }

  /// Головний застосунок: оверлей просить відкрити розділ — виводимо GameCon наперед і переходимо.
  static void listen(void Function(String path) go) {
    FlutterOverlayWindow.overlayListener.listen((data) async {
      if (data is! Map || data['open'] is! String) return;
      try {
        await _channel.invokeMethod('bringToFront');
      } catch (_) {}
      go(data['open'] as String);
    });
  }

  static Future<void> show() async {
    if (await _active()) return;
    await FlutterOverlayWindow.showOverlay(
      height: 168,
      width: 168,
      alignment: OverlayAlignment.centerRight,
      enableDrag: true,
      positionGravity: PositionGravity.auto,
      overlayTitle: 'GameCon',
      overlayContent: tr('Оверлей поверх гри'),
      flag: OverlayFlag.defaultFlag,
      visibility: NotificationVisibility.visibilitySecret,
    );
  }

  static Future<bool> _active() async {
    try {
      return await FlutterOverlayWindow.isActive();
    } catch (_) {
      return false;
    }
  }
}

/// Точка входу оверлею (окремий рушій Flutter; назва має бути саме overlayMain — див. main.dart).
class GameOverlayApp extends StatelessWidget {
  const GameOverlayApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: ThemeData(brightness: Brightness.dark, fontFamily: 'Onest', colorScheme: const ColorScheme.dark(primary: _accent)),
        home: const Material(type: MaterialType.transparency, child: _OverlayRoot()),
      );
}

const _accent = Color(0xFF6B8AFD);
const _text = TextStyle(color: Colors.white, fontSize: 13.5);
const _muted = TextStyle(color: Color(0xA6FFFFFF), fontSize: 12);

class _OverlayRoot extends StatefulWidget {
  const _OverlayRoot();

  @override
  State<_OverlayRoot> createState() => _OverlayRootState();
}

/// Панель оверлею: крапля → панель із вкладками, які людина обрала в налаштуваннях (лише з
/// увімкнених їй розділів). Кожна вкладка — живі дані з тих самих API, що й застосунок, і дії
/// просто з гри: відповісти в чат, «Готовий грати», забрати нагороду, прочитати сповіщення.
class _OverlayRootState extends State<_OverlayRoot> {
  static const base = String.fromEnvironment('GC_API', defaultValue: 'https://gamecon.online');
  static const bubbleSize = 168;
  bool open = false;
  String? token;
  int? meId;
  List<String> tabs = const [];
  String tab = 'home';
  Map<String, dynamic> pulse = const {};
  final data = <String, Object?>{};
  bool ready = false;
  Timer? timer;

  // Відкрита бесіда у вкладці «Чати».
  Map<String, dynamic>? chat;
  List<Map<String, dynamic>> history = const [];
  final input = TextEditingController();
  bool sending = false;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
    timer = Timer.periodic(const Duration(seconds: 30), (_) => _refresh());
  }

  @override
  void dispose() {
    timer?.cancel();
    input.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final modules = prefs.getStringList('game_overlay_modules');
    final chosen = prefs.getStringList(GameOverlay.sectionsKey) ?? GameOverlay.defaults;
    setState(() {
      token = prefs.getString('token');
      // Вкладку без свого модуля (вимкнено в режимі людини) не показуємо.
      tabs = [
        for (final s in GameOverlay.sections.keys)
          if (chosen.contains(s) && (GameOverlay.sections[s] == null || modules == null || modules.contains(GameOverlay.sections[s]))) s,
      ];
    });
    await _refresh();
  }

  Map<String, String> get _headers => {'Accept': 'application/json', 'Authorization': 'Bearer $token', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'};

  Future<Map<String, dynamic>?> _get(String path) async {
    try {
      final res = await http.get(Uri.parse('$base$path'), headers: _headers).timeout(const Duration(seconds: 12));
      if (res.statusCode != 200) return null;
      final body = jsonDecode(res.body);
      return body is Map ? Map<String, dynamic>.from(body) : null;
    } catch (_) {
      return null; // Немає мережі — оновимо пізніше.
    }
  }

  Future<bool> _send(String method, String path, [Object? body]) async {
    try {
      final req = http.Request(method, Uri.parse('$base$path'))..headers.addAll(_headers);
      if (body != null) req.body = jsonEncode(body);
      final res = await http.Response.fromStream(await req.send()).timeout(const Duration(seconds: 12));
      return res.statusCode < 400;
    } catch (_) {
      return false;
    }
  }

  /// Пульс — завжди (бейдж краплі); дані вкладки — лише відкритої.
  Future<void> _refresh() async {
    if (token == null) return;
    final p = await _get('/api/v1/me/pulse-widget');
    if (p != null) pulse = p;
    if (open) await _loadTab(tab);
    if (mounted) setState(() {});
  }

  Future<void> _loadTab(String key) async {
    switch (key) {
      case 'home':
        if (tabs.contains('ready')) ready = (await _get('/api/v1/site/ready'))?['mine'] is Map;
      case 'friends':
        data[key] = await _get('/api/v1/friends?tab=online');
      case 'chats':
        meId ??= (((await _get('/api/v1/me'))?['user'] as Map?)?['id'] as num?)?.toInt();
        data[key] = await _get('/api/v1/messages');
        if (chat != null) await _loadChat();
      case 'family':
        final w = await _get('/api/v1/me/family-widget');
        final first = (w?['families'] as List?)?.whereType<Map>().firstOrNull;
        // Сім'я в API — за slug (як на сайті), не за id.
        final slug = (first?['family'] as Map?)?['slug'];
        data[key] = {'widget': first, 'details': slug == null ? null : await _get('/api/v1/families/$slug')};
      case 'clans':
        data[key] = await _get('/api/v1/site/clans');
      case 'notifications':
        data[key] = await _get('/api/v1/notifications');
      case 'quests':
        data[key] = await _get('/api/v1/site/quests');
    }
  }

  Future<void> _loadChat() async {
    final id = chat?['id'];
    final h = await _get('/api/v1/messages/$id');
    history = [for (final m in (((h?['history'] as Map?)?['messages'] as List?) ?? const [])) if (m is Map) Map<String, dynamic>.from(m)];
    final last = history.isEmpty ? null : history.last['id'];
    if (last != null) unawaited(_send('POST', '/api/v1/messages/$id/read', {'message_id': last}));
  }

  Future<void> _select(String key) async {
    setState(() {
      tab = key;
      chat = null;
    });
    await _loadTab(key);
    if (mounted) setState(() {});
  }

  Future<void> _toggle() async {
    final next = !open;
    if (next) {
      await FlutterOverlayWindow.resizeOverlay(340, 540, false);
      // Відкрита панель приймає клавіатуру (відповідь у чат); крапля — ні, щоб не забирати фокус у гри.
      await FlutterOverlayWindow.updateFlag(OverlayFlag.focusPointer);
    } else {
      FocusManager.instance.primaryFocus?.unfocus();
      await FlutterOverlayWindow.updateFlag(OverlayFlag.defaultFlag);
      await FlutterOverlayWindow.resizeOverlay(bubbleSize, bubbleSize, true);
    }
    setState(() => open = next);
    if (next) unawaited(_refresh());
  }

  /// Відкрити розділ у застосунку (GameCon виходить наперед, крапля ховається).
  Future<void> _openInApp(String path) async {
    await FlutterOverlayWindow.shareData({'open': path});
  }

  Future<void> _toggleReady() async {
    final ok = ready ? await _send('DELETE', '/api/v1/site/ready') : await _send('PUT', '/api/v1/site/ready', {'minutes': 60});
    if (ok) setState(() => ready = !ready);
  }

  Future<void> _reply() async {
    final body = input.text.trim();
    if (body.isEmpty || chat == null || sending) return;
    setState(() => sending = true);
    final ok = await _send('POST', '/api/v1/messages/${chat!['id']}', {'body': body});
    if (ok) {
      input.clear();
      await _loadChat();
    }
    if (mounted) setState(() => sending = false);
  }

  int _int(String key) => (pulse[key] as num?)?.toInt() ?? 0;

  @override
  Widget build(BuildContext context) {
    final unread = _int('messages') + _int('notifications');
    return Align(alignment: Alignment.topRight, child: open ? _panel() : _bubble(unread));
  }

  Widget _bubble(int unread) => GestureDetector(
        onTap: _toggle,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Stack(clipBehavior: Clip.none, children: [
            _glass(
              radius: 999,
              child: const SizedBox(width: 52, height: 52, child: Center(child: Text('G', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)))),
            ),
            if (unread > 0)
              Positioned(
                right: -2,
                top: -2,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: const Color(0xFFFF5A5F), borderRadius: BorderRadius.circular(99)),
                  child: Text('$unread', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                ),
              ),
          ]),
        ),
      );

  static const _icons = <String, IconData>{
    'home': Icons.dashboard_rounded,
    'friends': Icons.people_alt_rounded,
    'chats': Icons.chat_bubble_rounded,
    'family': Icons.family_restroom_rounded,
    'clans': Icons.shield_rounded,
    'notifications': Icons.notifications_rounded,
    'quests': Icons.flag_rounded,
  };

  /// Вкладки панелі: «Огляд» (готовність, хто в грі, лічильники) + окремі розділи.
  List<String> get _panelTabs => ['home', for (final t in tabs) if (_icons.containsKey(t) && t != 'home') t];

  Widget _panel() {
    final labels = {...GameOverlay.labels(), 'home': tr('Огляд')};
    return Padding(
      padding: const EdgeInsets.all(8),
      child: _glass(
        radius: 22,
        child: SizedBox(
          width: 324,
          height: 524,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 4, 0),
              child: Row(children: [
                const Text('GameCon', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                const Spacer(),
                IconButton(onPressed: () => _openInApp(tab == 'chats' && chat != null ? '/messages/${chat!['id']}' : _paths[tab] ?? '/feed'), icon: const Icon(Icons.open_in_new_rounded, color: Colors.white70, size: 19), tooltip: tr('Відкрити в GameCon')),
                IconButton(onPressed: _toggle, icon: const Icon(Icons.close_rounded, color: Colors.white70, size: 20), tooltip: tr('Згорнути')),
              ]),
            ),
            SizedBox(
              height: 40,
              child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 10), children: [
                for (final t in _panelTabs)
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: _Chip(icon: _icons[t]!, label: labels[t] ?? t, selected: tab == t, badge: _badge(t), onTap: () => _select(t)),
                  ),
              ]),
            ),
            const SizedBox(height: 6),
            Expanded(
              child: token == null
                  ? Padding(padding: const EdgeInsets.all(16), child: Text(tr('Увійдіть у застосунок GameCon, щоб бачити друзів і чати.'), style: _muted))
                  : _body(),
            ),
          ]),
        ),
      ),
    );
  }

  static const _paths = {'home': '/feed', 'friends': '/friends', 'chats': '/messages', 'family': '/families', 'clans': '/clans', 'notifications': '/notifications', 'quests': '/quests'};

  int _badge(String t) => switch (t) {
        'chats' => _int('messages'),
        'notifications' => _int('notifications'),
        'friends' => _int('friends_online'),
        _ => 0,
      };

  Widget _body() => switch (tab) {
        'friends' => _friends(),
        'chats' => chat == null ? _chats() : _chat(),
        'family' => _family(),
        'clans' => _clans(),
        'notifications' => _notifications(),
        'quests' => _quests(),
        _ => _home(),
      };

  Widget _list(List<Widget> children, {String? empty}) => children.isEmpty
      ? Padding(padding: const EdgeInsets.all(16), child: Text(empty ?? tr('Завантажуємо…'), style: _muted))
      : ListView(padding: const EdgeInsets.fromLTRB(14, 0, 14, 14), children: children);

  Widget _home() {
    final playing = (pulse['playing'] as List?) ?? const [];
    final quests = pulse['quests'];
    return _list([
      if (tabs.contains('ready'))
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: FilledButton.icon(
            onPressed: _toggleReady,
            style: FilledButton.styleFrom(backgroundColor: ready ? const Color(0x33FFFFFF) : _accent, foregroundColor: Colors.white),
            icon: Icon(ready ? Icons.pause_rounded : Icons.sports_esports_rounded, size: 18),
            label: Text(ready ? tr('Зняти «Готовий грати»') : tr('Готовий грати')),
          ),
        ),
      if (tabs.contains('friends')) _row(Icons.people_alt_rounded, tr('Друзі онлайн'), '${_int('friends_online')}', onTap: () => _select('friends')),
      if (tabs.contains('chats')) _row(Icons.chat_bubble_rounded, tr('Непрочитані чати'), '${_int('messages')}', onTap: () => _select('chats')),
      if (tabs.contains('notifications')) _row(Icons.notifications_rounded, tr('Нові сповіщення'), '${_int('notifications')}', onTap: () => _select('notifications')),
      if (tabs.contains('quests') && quests is Map) _row(Icons.flag_rounded, tr('Завдання дня'), '${quests['done']}/${quests['total']}', onTap: () => _select('quests')),
      if (tabs.contains('playing') && playing.isNotEmpty) ...[
        const SizedBox(height: 8),
        Text(tr('Друзі в грі'), style: _muted),
        for (final p in playing.take(6))
          if (p is Map) Padding(padding: const EdgeInsets.only(top: 6), child: Text('${p['name']} — ${p['label'] ?? ''}', style: _text, maxLines: 1, overflow: TextOverflow.ellipsis)),
      ],
    ], empty: tr('Оберіть вкладки оверлею в налаштуваннях GameCon.'));
  }

  Widget _friends() {
    final d = data['friends'] as Map?;
    final users = ((d?['users'] as Map?)?['data'] as List?) ?? const [];
    final playing = {for (final p in (pulse['playing'] as List? ?? const [])) if (p is Map) p['name']: p['label']};
    return _list([
      for (final u in users)
        if (u is Map)
          _person(u, subtitle: playing[u['name']]?.toString() ?? tr('У мережі'), onTap: () => _openInApp('/u/${u['username'] ?? u['id']}')),
    ], empty: d == null ? null : tr('Зараз ніхто з друзів не в мережі.'));
  }

  Widget _chats() {
    final d = data['chats'] as Map?;
    final list = (d?['conversations'] as List?) ?? const [];
    return _list([
      for (final c in list.take(30))
        if (c is Map)
          _tile(
            avatar: c['avatar_url'] as String?,
            name: (c['title'] ?? tr('Бесіда')).toString(),
            subtitle: ((c['last_message'] as Map?)?['preview'] ?? (c['last_message'] as Map?)?['body'] ?? '').toString(),
            trailing: ((c['unread'] as num?) ?? 0) > 0 ? _count((c['unread'] as num).toInt()) : null,
            onTap: () async {
              setState(() {
                chat = Map<String, dynamic>.from(c);
                history = const [];
              });
              await _loadChat();
              if (mounted) setState(() {});
            },
          ),
    ], empty: d == null ? null : tr('Ще немає бесід.'));
  }

  Widget _chat() => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6),
          child: Row(children: [
            IconButton(onPressed: () => setState(() => chat = null), icon: const Icon(Icons.arrow_back_rounded, size: 19, color: Colors.white70), tooltip: tr('Назад')),
            Expanded(child: Text((chat!['title'] ?? '').toString(), style: _text.copyWith(fontWeight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis)),
          ]),
        ),
        Expanded(
          child: ListView(reverse: true, padding: const EdgeInsets.symmetric(horizontal: 12), children: [
            for (final m in history.reversed.take(40))
              Builder(builder: (_) {
                final mine = (m['user'] as Map?)?['id'] == meId;
                return Align(
                  alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.symmetric(vertical: 3),
                    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
                    constraints: const BoxConstraints(maxWidth: 240),
                    decoration: BoxDecoration(color: mine ? _accent.withValues(alpha: .85) : Colors.white.withValues(alpha: .09), borderRadius: BorderRadius.circular(14)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      if (!mine && chat!['type'] != 'direct') Text(((m['user'] as Map?)?['name'] ?? '').toString(), style: _muted.copyWith(fontSize: 11)),
                      Text((m['body'] ?? m['preview'] ?? '…').toString(), style: _text),
                    ]),
                  ),
                );
              }),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 6, 8, 12),
          child: Row(children: [
            Expanded(
              child: TextField(
                controller: input,
                style: _text,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _reply(),
                decoration: InputDecoration(
                  hintText: tr('Повідомлення'),
                  hintStyle: _muted,
                  isDense: true,
                  filled: true,
                  fillColor: Colors.white.withValues(alpha: .07),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(99), borderSide: BorderSide.none),
                ),
              ),
            ),
            IconButton(onPressed: sending ? null : _reply, icon: const Icon(Icons.send_rounded, color: _accent), tooltip: tr('Надіслати')),
          ]),
        ),
      ]);

  Widget _family() {
    final d = data['family'] as Map?;
    final w = d?['widget'] as Map?;
    if (d != null && w == null) {
      return _list([], empty: tr('Ви ще не в сім’ї. Знайдіть свою в розділі «Сім’ї».'));
    }
    if (w == null) return _list([]);
    final f = w['family'] as Map? ?? const {};
    final member = w['member'] as Map? ?? const {};
    final rating = w['rating'] as Map? ?? const {};
    final next = w['next_event'] as Map?;
    final events = ((d?['details'] as Map?)?['events'] as List?) ?? const [];
    final warns = (w['warns'] as num?)?.toInt() ?? 0;
    return _list([
      _tile(avatar: f['logo_url'] as String?, name: '${f['name']}${f['tag'] != null ? ' [${f['tag']}]' : ''}', subtitle: '${member['rank_title'] ?? ''} · ${member['display'] ?? ''}', onTap: () => _openInApp('/families/${f['slug'] ?? f['id']}')),
      const SizedBox(height: 6),
      Wrap(spacing: 8, runSpacing: 8, children: [
        _stat(tr('Баланс'), '${w['balance'] ?? 0}'),
        _stat(tr('За тиждень'), '${w['week_earned'] ?? 0}'),
        _stat(tr('Місце'), rating['place'] == null ? '—' : '${rating['place']}/${rating['of']}'),
        _stat(tr('Бали'), '${rating['points'] ?? 0}'),
        _stat(tr('Бізвари'), '${rating['bizwar_wins'] ?? 0}:${rating['bizwar_losses'] ?? 0}'),
        _stat(tr('Варни'), '$warns/${w['warn_limit'] ?? 3}', alert: warns > 0),
        if (w['treasury'] != null) _stat(tr('Казна'), '${w['treasury']}'),
        if (((w['pending_reports'] as num?) ?? 0) > 0) _stat(tr('Звіти чекають'), '${w['pending_reports']}'),
      ]),
      const SizedBox(height: 12),
      Text(tr('Події'), style: _muted),
      if (events.isEmpty && next != null) _event(next),
      for (final e in events.take(5)) if (e is Map) _event(e),
      if (events.isEmpty && next == null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(tr('Найближчих подій немає.'), style: _muted)),
      const SizedBox(height: 12),
      OutlinedButton.icon(
        onPressed: () => _openInApp('/families/${f['slug'] ?? f['id']}?tab=reports'),
        style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: BorderSide(color: Colors.white.withValues(alpha: .2))),
        icon: const Icon(Icons.add_task_rounded, size: 18),
        label: Text(tr('Здати звіт')),
      ),
    ]);
  }

  Widget _event(Map e) {
    final at = DateTime.tryParse('${e['starts_at']}')?.toLocal();
    final when = at == null ? '' : '${at.day.toString().padLeft(2, '0')}.${at.month.toString().padLeft(2, '0')} ${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}';
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(children: [
        const Icon(Icons.event_rounded, size: 16, color: Colors.white60),
        const SizedBox(width: 8),
        Expanded(child: Text('${e['title']}', style: _text, maxLines: 1, overflow: TextOverflow.ellipsis)),
        Text(when, style: _muted),
      ]),
    );
  }

  Widget _clans() {
    final d = data['clans'] as Map?;
    final mine = (d?['mine'] as List?) ?? const [];
    return _list([
      for (final c in mine)
        if (c is Map)
          _tile(
            avatar: c['logo_url'] as String?,
            name: '${c['display_name'] ?? c['name']}${c['tag'] != null ? ' [${c['tag']}]' : ''}',
            subtitle: '${c['type_label'] ?? ''} · ${tr('учасників')}: ${c['members_count'] ?? 0}${c['pending'] == true ? ' · ${tr('заявка на розгляді')}' : ''}',
            onTap: () => _openInApp('/clans/${c['slug'] ?? c['id']}'),
          ),
    ], empty: d == null ? null : tr('Ви ще не в клані.'));
  }

  Widget _notifications() {
    final d = data['notifications'] as Map?;
    final list = (d?['notifications'] as List?) ?? const [];
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (_int('notifications') > 0)
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: () async {
              if (await _send('POST', '/api/v1/notifications/read')) await _refresh();
            },
            child: Text(tr('Прочитати все')),
          ),
        ),
      Expanded(
        child: _list([
          for (final n in list.take(30))
            if (n is Map)
              _tile(
                avatar: (n['actor'] as Map?)?['avatar_url'] as String?,
                name: '${n['text']}',
                subtitle: (n['excerpt'] ?? '').toString(),
                dim: n['read_at'] != null,
                onTap: n['url'] is String ? () => _openInApp(Uri.tryParse(n['url'] as String)?.path ?? '/notifications') : null,
              ),
        ], empty: d == null ? null : tr('Поки тихо.')),
      ),
    ]);
  }

  Widget _quests() {
    final d = data['quests'] as Map?;
    final list = (d?['quests'] as List?) ?? const [];
    return _list([
      for (final q in list)
        if (q is Map)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 7),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Expanded(child: Text('${q['title']}', style: _text)),
                if (q['claimed'] == true)
                  const Icon(Icons.check_circle_rounded, size: 18, color: Color(0xFF34D399))
                else if (q['done'] == true)
                  TextButton(
                    onPressed: () async {
                      if (await _send('POST', '/api/v1/site/quests/${q['key']}/claim')) await _select('quests');
                    },
                    child: Text('+${q['xp']} XP'),
                  )
                else
                  Text('${q['progress']}/${q['target']}', style: _muted),
              ]),
              const SizedBox(height: 5),
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(
                  minHeight: 4,
                  value: ((q['progress'] as num?) ?? 0) / (((q['target'] as num?) ?? 1) == 0 ? 1 : (q['target'] as num)),
                  backgroundColor: Colors.white.withValues(alpha: .08),
                  color: q['done'] == true ? const Color(0xFF34D399) : _accent,
                ),
              ),
            ]),
          ),
    ], empty: d == null ? null : tr('Завдань на сьогодні немає.'));
  }

  Widget _person(Map u, {required String subtitle, VoidCallback? onTap}) => _tile(avatar: u['avatar_url'] as String?, name: '${u['name']}', subtitle: subtitle, onTap: onTap, online: true);

  Widget _tile({String? avatar, required String name, String subtitle = '', Widget? trailing, VoidCallback? onTap, bool online = false, bool dim = false}) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
          child: Row(children: [
            Stack(children: [
              CircleAvatar(
                radius: 17,
                backgroundColor: Colors.white.withValues(alpha: .1),
                backgroundImage: avatar == null || avatar.isEmpty ? null : NetworkImage(avatar.startsWith('http') ? avatar : '$base$avatar'),
                child: avatar == null || avatar.isEmpty ? Text(name.isEmpty ? '?' : name.characters.first.toUpperCase(), style: _text) : null,
              ),
              if (online) Positioned(right: 0, bottom: 0, child: Container(width: 9, height: 9, decoration: BoxDecoration(color: const Color(0xFF34D399), shape: BoxShape.circle, border: Border.all(color: const Color(0xFF12141A), width: 1.5)))),
            ]),
            const SizedBox(width: 10),
            Expanded(
              child: Opacity(
                opacity: dim ? .6 : 1,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(name, style: _text.copyWith(fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                  if (subtitle.isNotEmpty) Text(subtitle, style: _muted, maxLines: 1, overflow: TextOverflow.ellipsis),
                ]),
              ),
            ),
            ?trailing,
          ]),
        ),
      );

  Widget _count(int n) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(color: _accent, borderRadius: BorderRadius.circular(99)),
        child: Text('$n', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
      );

  Widget _stat(String label, String value, {bool alert = false}) => Container(
        width: 92,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(color: Colors.white.withValues(alpha: .06), borderRadius: BorderRadius.circular(12)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value, style: TextStyle(color: alert ? const Color(0xFFFF7A7F) : Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
          Text(label, style: _muted.copyWith(fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
        ]),
      );

  Widget _row(IconData icon, String label, String value, {VoidCallback? onTap}) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 2),
          child: Row(children: [
            Icon(icon, size: 18, color: Colors.white70),
            const SizedBox(width: 12),
            Expanded(child: Text(label, style: _text)),
            Text(value, style: const TextStyle(color: Color(0xFF8FA6FF), fontSize: 14, fontWeight: FontWeight.w800)),
          ]),
        ),
      );

  /// Безбарвне матове скло, як у веб-SDK: розмиття й графітова димка, видно гру.
  Widget _glass({required double radius, required Widget child}) => ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 24, sigmaY: 24),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: const Color(0xD912141A),
              borderRadius: BorderRadius.circular(radius),
              border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
            ),
            child: child,
          ),
        ),
      );
}

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.label, required this.selected, required this.badge, required this.onTap});
  final IconData icon;
  final String label;
  final bool selected;
  final int badge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(99),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
          decoration: BoxDecoration(
            color: selected ? _accent.withValues(alpha: .22) : Colors.white.withValues(alpha: .05),
            borderRadius: BorderRadius.circular(99),
            border: Border.all(color: selected ? _accent.withValues(alpha: .6) : Colors.white.withValues(alpha: .08)),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 15, color: selected ? Colors.white : Colors.white70),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(color: selected ? Colors.white : Colors.white70, fontSize: 12.5, fontWeight: FontWeight.w600)),
            if (badge > 0) ...[
              const SizedBox(width: 6),
              Text('$badge', style: const TextStyle(color: Color(0xFF8FA6FF), fontSize: 11.5, fontWeight: FontWeight.w800)),
            ],
          ]),
        ),
      );
}
