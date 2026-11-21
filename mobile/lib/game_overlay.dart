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

  /// Розділ → модуль сайту, без якого розділу немає (null — є завжди).
  static const sections = <String, String?>{
    'friends': 'friends',
    'chats': 'messages',
    'ready': null,
    'playing': 'friends',
    'quests': 'quests',
  };

  static Future<bool> enabled() async => (await SharedPreferences.getInstance()).getBool(enabledKey) ?? false;

  /// 'games' (лише в іграх) або 'background' (завжди, коли GameCon у фоні).
  static Future<String> mode() async => (await SharedPreferences.getInstance()).getString(modeKey) ?? 'games';

  static Future<List<String>> chosen() async =>
      (await SharedPreferences.getInstance()).getStringList(sectionsKey) ?? ['friends', 'chats', 'ready'];

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
  Widget build(BuildContext context) => const MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Material(type: MaterialType.transparency, child: _OverlayRoot()),
      );
}

class _OverlayRoot extends StatefulWidget {
  const _OverlayRoot();

  @override
  State<_OverlayRoot> createState() => _OverlayRootState();
}

class _OverlayRootState extends State<_OverlayRoot> {
  static const base = 'https://gamecon.online';
  bool open = false;
  String? token;
  List<String> sections = const [];
  Map<String, dynamic> pulse = const {};
  List<Map<String, dynamic>> chats = const [];
  bool ready = false;
  Timer? timer;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
    timer = Timer.periodic(const Duration(seconds: 45), (_) => _refresh());
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final modules = prefs.getStringList('game_overlay_modules');
    final chosen = prefs.getStringList(GameOverlay.sectionsKey) ?? ['friends', 'chats', 'ready'];
    setState(() {
      token = prefs.getString('token');
      // Розділ без свого модуля (вимкнено в режимі людини) не показуємо.
      sections = [
        for (final s in chosen)
          if (GameOverlay.sections.containsKey(s) && (GameOverlay.sections[s] == null || modules == null || modules.contains(GameOverlay.sections[s]))) s,
      ];
    });
    await _refresh();
  }

  Map<String, String> get _headers => {'Accept': 'application/json', 'Authorization': 'Bearer $token', 'Content-Type': 'application/json'};

  Future<void> _refresh() async {
    if (token == null) return;
    try {
      final res = await http.get(Uri.parse('$base/api/v1/me/pulse-widget'), headers: _headers);
      if (res.statusCode == 200) pulse = Map<String, dynamic>.from(jsonDecode(res.body) as Map);
      if (sections.contains('chats')) {
        final c = await http.get(Uri.parse('$base/api/v1/messages'), headers: _headers);
        if (c.statusCode == 200) {
          chats = [
            for (final x in ((jsonDecode(c.body) as Map)['conversations'] as List? ?? []))
              if (x is Map && ((x['unread'] as num?) ?? 0) > 0) Map<String, dynamic>.from(x),
          ].take(3).toList();
        }
      }
      if (sections.contains('ready')) {
        final r = await http.get(Uri.parse('$base/api/v1/site/ready'), headers: _headers);
        if (r.statusCode == 200) ready = (jsonDecode(r.body) as Map)['mine'] is Map;
      }
      if (mounted) setState(() {});
    } catch (_) {
      // Немає мережі — оновимо за хвилину.
    }
  }

  Future<void> _toggleReady() async {
    final uri = Uri.parse('$base/api/v1/site/ready');
    final res = ready ? await http.delete(uri, headers: _headers) : await http.put(uri, headers: _headers, body: jsonEncode({'minutes': 60}));
    if (res.statusCode < 400) setState(() => ready = !ready);
  }

  Future<void> _toggle() async {
    final next = !open;
    if (next) {
      await FlutterOverlayWindow.resizeOverlay(320, 460, false);
    } else {
      await FlutterOverlayWindow.resizeOverlay(168, 168, true);
    }
    setState(() => open = next);
    if (next) unawaited(_refresh());
  }

  int _int(String key) => (pulse[key] as num?)?.toInt() ?? 0;

  @override
  Widget build(BuildContext context) {
    final unread = _int('messages') + _int('notifications');
    return Align(
      alignment: Alignment.topRight,
      child: open ? _panel() : _bubble(unread),
    );
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

  Widget _panel() {
    const text = TextStyle(color: Colors.white, fontSize: 13.5);
    const muted = TextStyle(color: Color(0xB3FFFFFF), fontSize: 12);
    final playing = (pulse['playing'] as List?) ?? const [];
    return Padding(
      padding: const EdgeInsets.all(8),
      child: _glass(
        radius: 22,
        child: SizedBox(
          width: 300,
          height: 440,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                const Text('GameCon', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                const Spacer(),
                IconButton(onPressed: _toggle, icon: const Icon(Icons.close_rounded, color: Colors.white70, size: 20), tooltip: tr('Згорнути')),
              ]),
              if (token == null) Text(tr('Увійдіть у застосунок GameCon, щоб бачити друзів і чати.'), style: muted),
              Expanded(
                child: ListView(padding: EdgeInsets.zero, children: [
                  if (sections.contains('friends')) _row(Icons.people_alt_rounded, tr('Друзі онлайн'), '${_int('friends_online')}'),
                  if (sections.contains('chats')) ...[
                    _row(Icons.chat_bubble_rounded, tr('Непрочитані чати'), '${_int('messages')}'),
                    for (final c in chats)
                      Padding(
                        padding: const EdgeInsets.only(left: 30, bottom: 6),
                        child: Text('${c['title'] ?? tr('Бесіда')}: ${(c['last_message'] as Map?)?['preview'] ?? ''}', style: muted, maxLines: 1, overflow: TextOverflow.ellipsis),
                      ),
                  ],
                  if (sections.contains('playing') && playing.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(tr('Друзі в грі'), style: muted),
                    for (final p in playing.take(4))
                      if (p is Map) Padding(padding: const EdgeInsets.only(top: 4), child: Text('${p['name']} — ${p['label']}', style: text, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  ],
                  if (sections.contains('quests') && pulse['quests'] is Map)
                    _row(Icons.flag_rounded, tr('Завдання дня'), '${(pulse['quests'] as Map)['done']}/${(pulse['quests'] as Map)['total']}'),
                ]),
              ),
              if (sections.contains('ready') && token != null)
                FilledButton.icon(
                  onPressed: _toggleReady,
                  style: FilledButton.styleFrom(backgroundColor: ready ? const Color(0x33FFFFFF) : const Color(0xFF6B8AFD)),
                  icon: Icon(ready ? Icons.pause_rounded : Icons.sports_esports_rounded, size: 18),
                  label: Text(ready ? tr('Зняти «Готовий грати»') : tr('Готовий грати')),
                ),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _row(IconData icon, String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(children: [
          Icon(icon, size: 18, color: Colors.white70),
          const SizedBox(width: 12),
          Expanded(child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 13.5))),
          Text(value, style: const TextStyle(color: Color(0xFF8FA6FF), fontSize: 14, fontWeight: FontWeight.w800)),
        ]),
      );

  /// Безбарвне матове скло, як у веб-SDK: розмиття й графітова димка, видно гру.
  Widget _glass({required double radius, required Widget child}) => ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 24, sigmaY: 24),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: const Color(0xCC12141A),
              borderRadius: BorderRadius.circular(radius),
              border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
            ),
            child: child,
          ),
        ),
      );
}
