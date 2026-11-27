import 'dart:async';
import 'dart:convert';

import 'package:fluent_ui/fluent_ui.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api.dart';
import '../i18n.dart';
import '../state.dart';
import '../voice_room.dart';
import 'package:flutter/material.dart' show ReorderableListView, ReorderableDragStartListener;

import '../widgets.dart' show intOf, mapOf;

/// Модуль головної ПК-версії: що показує, які розділи потрібні (вимкнений модуль чи плагін — модуля немає).
class DesktopModule {
  const DesktopModule(this.key, this.title, this.icon, {this.module, this.plugin, this.wide = false});
  final String key;
  final String title;
  final IconData icon;
  final String? module;
  final String? plugin;
  final bool wide;
}

List<DesktopModule> desktopModules() => [
      DesktopModule('pulse', tr('Пульс'), FluentIcons.chart, wide: true),
      DesktopModule('playing', tr('Друзі в грі'), FluentIcons.game, module: 'friends'),
      DesktopModule('voice', tr('Голос'), FluentIcons.microphone),
      DesktopModule('music', tr('Зараз грає'), FluentIcons.music_note, module: 'music'),
      DesktopModule('quests', tr('Завдання'), FluentIcons.trophy2, module: 'quests'),
      DesktopModule('gamecast', 'GameCast', FluentIcons.microphone, plugin: 'live_shows'),
      DesktopModule('livecast', 'LiveCast', FluentIcons.streaming, plugin: 'livecast'),
    ];

/// Модульна головна ПК-версії: плитки Fluent, які людина вмикає, вимикає й переставляє
/// («Налаштувати модулі»). Розклад зберігається на ПК. Дані оновлюються раз на 30 с.
class DesktopHome extends StatefulWidget {
  const DesktopHome({super.key});

  @override
  State<DesktopHome> createState() => _DesktopHomeState();
}

class _DesktopHomeState extends State<DesktopHome> {
  static const _prefKey = 'desktop_modules';
  List<String>? order;
  Map<String, dynamic> pulse = const {};
  Map<String, dynamic> quests = const {};
  Map<String, dynamic> cast = const {};
  Map<String, dynamic> live = const {};
  Timer? timer;

  @override
  void initState() {
    super.initState();
    unawaited(_restore());
    WidgetsBinding.instance.addPostFrameCallback((_) => unawaited(_load()));
    timer = Timer.periodic(const Duration(seconds: 30), (_) => unawaited(_load()));
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  Future<void> _restore() async {
    final raw = (await SharedPreferences.getInstance()).getString(_prefKey);
    final saved = raw == null ? null : (jsonDecode(raw) as List).map((e) => '$e').toList();
    if (mounted) setState(() => order = saved ?? [for (final m in desktopModules()) m.key]);
  }

  Future<void> _save(List<String> next) async {
    setState(() => order = next);
    await (await SharedPreferences.getInstance()).setString(_prefKey, jsonEncode(next));
  }

  Future<void> _load() async {
    final session = AppScope.read(context).session;
    final api = session.api;
    Future<Map<String, dynamic>> safe(Future<Map<String, dynamic>> f) => f.catchError((_) => <String, dynamic>{});
    final r = await Future.wait([
      safe(api.get('/api/v1/me/pulse-widget')),
      if (session.modules?.contains('quests') ?? true) safe(api.get(Api.site('/quests'))) else Future.value(<String, dynamic>{}),
      if (session.pluginOn('live_shows')) safe(api.get(Api.site('/shows/pulse'))) else Future.value(<String, dynamic>{}),
      if (session.pluginOn('livecast')) safe(api.get(Api.site('/livecast/pulse'))) else Future.value(<String, dynamic>{}),
    ]);
    if (!mounted) return;
    setState(() {
      pulse = r[0];
      quests = r[1];
      cast = r[2];
      live = r[3];
    });
  }

  List<DesktopModule> _available(Session session) => [
        for (final m in desktopModules())
          if ((m.module == null || (session.modules?.contains(m.module) ?? true)) && (m.plugin == null || session.pluginOn(m.plugin!))) m,
      ];

  @override
  Widget build(BuildContext context) {
    final session = AppScope.of(context).session;
    final player = AppScope.of(context).player;
    final available = {for (final m in _available(session)) m.key: m};
    final shown = [for (final k in order ?? const <String>[]) if (available[k] != null) available[k]!];
    final name = text(session.me?['first_name']) ?? text(session.me?['name']) ?? '';
    return ScaffoldPage.scrollable(
      header: PageHeader(
        title: Text(name.isEmpty ? tr('Головна') : tr('Привіт, {name}', {'name': name})),
        commandBar: Row(mainAxisSize: MainAxisSize.min, children: [
          Button(onPressed: () => unawaited(_load()), child: Row(mainAxisSize: MainAxisSize.min, children: [const Icon(FluentIcons.refresh, size: 14), const SizedBox(width: 8), Text(tr('Оновити'))])),
          const SizedBox(width: 8),
          FilledButton(onPressed: () => _customize(available.values.toList()), child: Row(mainAxisSize: MainAxisSize.min, children: [const Icon(FluentIcons.edit, size: 14), const SizedBox(width: 8), Text(tr('Налаштувати модулі'))])),
        ]),
      ),
      children: [
        LayoutBuilder(builder: (context, box) {
          // Сітка: колонки ~360 px, широкі модулі на дві колонки.
          final cols = (box.maxWidth / 360).floor().clamp(1, 4);
          final cell = (box.maxWidth - (cols - 1) * 12) / cols;
          return Wrap(spacing: 12, runSpacing: 12, children: [
            for (final m in shown)
              SizedBox(
                width: m.wide && cols > 1 ? cell * 2 + 12 : cell,
                child: _ModuleCard(module: m, child: _body(context, m, player)),
              ),
          ]);
        }),
      ],
    );
  }

  Widget _body(BuildContext context, DesktopModule m, TrackPlayer player) {
    switch (m.key) {
      case 'pulse':
        Widget stat(String label, int value, String route, IconData icon) => Expanded(
              child: HoverButton(
                onPressed: () => context.go(route),
                builder: (context, states) => Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: states.isHovered ? const Color(0x1AFFFFFF) : const Color(0x0DFFFFFF),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(children: [
                    Icon(icon, size: 18),
                    const SizedBox(width: 10),
                    Expanded(child: Text(label, overflow: TextOverflow.ellipsis)),
                    Text('$value', style: FluentTheme.of(context).typography.subtitle),
                  ]),
                ),
              ),
            );
        return Row(children: [
          stat(tr('Чати'), intOf(pulse['messages']), '/messages', FluentIcons.chat),
          const SizedBox(width: 8),
          stat(tr('Сповіщення'), intOf(pulse['notifications']), '/notifications', FluentIcons.ringer),
          const SizedBox(width: 8),
          stat(tr('Онлайн'), intOf(pulse['friends_online']), '/friends', FluentIcons.people),
          const SizedBox(width: 8),
          stat(tr('Заявки'), intOf(pulse['friend_requests']), '/friends', FluentIcons.add_friend),
        ]);
      case 'playing':
        final playing = maps(pulse['playing']);
        if (playing.isEmpty) return Text(tr('Зараз ніхто з друзів не грає.'));
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          for (final p in playing.take(5))
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(children: [
                const Icon(FluentIcons.game, size: 14),
                const SizedBox(width: 8),
                Expanded(child: Text('${p['name']}', overflow: TextOverflow.ellipsis)),
                Text(text(p['label']) ?? '', style: const TextStyle(color: Color(0xB3FFFFFF))),
              ]),
            ),
        ]);
      case 'voice':
        return ListenableBuilder(
          listenable: VoiceCall.instance,
          builder: (context, _) {
            final call = VoiceCall.instance;
            if (!call.active) return Text(tr('Ви не в голосовій кімнаті. Ctrl+Shift+M — мікрофон, F9 — «натисни й говори».'));
            return Row(children: [
              Expanded(child: Text(call.micOn ? tr('Мікрофон увімкнено') : tr('Мікрофон вимкнено'))),
              ToggleButton(checked: call.micOn, onChanged: (_) => call.toggleMic(), child: Icon(call.micOn ? FluentIcons.microphone : FluentIcons.mic_off)),
              const SizedBox(width: 8),
              Button(onPressed: () => unawaited(call.leave()), child: Text(tr('Вийти'))),
            ]);
          },
        );
      case 'music':
        return ListenableBuilder(
          listenable: player,
          builder: (context, _) {
            final track = player.current;
            if (track == null) return HyperlinkButton(onPressed: () => context.go('/music'), child: Text(tr('Увімкнути музику')));
            return Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(track.title, overflow: TextOverflow.ellipsis, style: FluentTheme.of(context).typography.bodyStrong),
                  Text(track.artist, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xB3FFFFFF))),
                ]),
              ),
              IconButton(icon: Icon(player.playing ? FluentIcons.pause : FluentIcons.play, size: 18), onPressed: () => unawaited(player.toggle())),
            ]);
          },
        );
      case 'quests':
        final weekly = maps(quests['weekly']);
        final daily = mapOf(pulse['quests']);
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (daily.isNotEmpty) ...[
            Text(tr('Завдання дня: {done} з {total}', {'done': daily['done'], 'total': daily['total']})),
            const SizedBox(height: 6),
            ProgressBar(value: intOf(daily['total']) == 0 ? 0 : intOf(daily['done']) * 100 / intOf(daily['total'])),
          ],
          for (final w in weekly.take(2)) ...[
            const SizedBox(height: 10),
            Text('${w['title']} · ${w['progress']}/${w['target']}', overflow: TextOverflow.ellipsis),
          ],
          const SizedBox(height: 8),
          Align(alignment: Alignment.centerLeft, child: HyperlinkButton(onPressed: () => context.go('/quests'), child: Text(tr('Усі завдання')))),
        ]);
      case 'gamecast':
        return _liveLine(context, intOf(cast['live']), intOf(cast['listeners']), tr('слухають'), '/shows');
      case 'livecast':
        return _liveLine(context, intOf(live['live']), intOf(live['viewers']), tr('дивляться'), '/livecast');
    }
    return const SizedBox.shrink();
  }

  Widget _liveLine(BuildContext context, int rooms, int people, String verb, String route) => Row(children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: rooms > 0 ? const Color(0xFFFF4D6A) : const Color(0x66FFFFFF), shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Expanded(child: Text(rooms == 0 ? tr('Зараз ніхто не в ефірі') : tr('{n} в ефірі · {p} {verb}', {'n': rooms, 'p': people, 'verb': verb}))),
        FilledButton(onPressed: () => context.go(route), child: Text(tr('Відкрити'))),
      ]);

  /// «Налаштувати модулі»: увімкнути/вимкнути й перетягнути в потрібному порядку.
  void _customize(List<DesktopModule> available) {
    final current = [...?order];
    final all = [
      for (final k in current) ?available.where((m) => m.key == k).firstOrNull,
      for (final m in available) if (!current.contains(m.key)) m,
    ];
    final on = {...current};
    unawaited(showDialog<void>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (dialog, setDialog) => ContentDialog(
          title: Text(tr('Модулі головної')),
          constraints: const BoxConstraints(maxWidth: 440),
          content: SizedBox(
            height: 380,
            child: ReorderableListView(
              buildDefaultDragHandles: false,
              onReorderItem: (from, to) => setDialog(() => all.insert(to, all.removeAt(from))),
              children: [
                for (var i = 0; i < all.length; i++)
                  ListTile(
                    key: ValueKey(all[i].key),
                    leading: Icon(all[i].icon),
                    title: Text(all[i].title),
                    trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                      ToggleSwitch(checked: on.contains(all[i].key), onChanged: (v) => setDialog(() => v ? on.add(all[i].key) : on.remove(all[i].key))),
                      const SizedBox(width: 8),
                      ReorderableDragStartListener(index: i, child: const Icon(FluentIcons.gripper_dots_vertical)),
                    ]),
                  ),
              ],
            ),
          ),
          actions: [
            Button(child: Text(tr('Скасувати')), onPressed: () => Navigator.pop(dialog)),
            FilledButton(
              child: Text(tr('Зберегти')),
              onPressed: () {
                unawaited(_save([for (final m in all) if (on.contains(m.key)) m.key]));
                Navigator.pop(dialog);
              },
            ),
          ],
        ),
      ),
    ));
  }
}

/// Картка модуля: напівпрозора поверхня Fluent (Mica просвічує), заголовок з іконкою.
class _ModuleCard extends StatelessWidget {
  const _ModuleCard({required this.module, required this.child});
  final DesktopModule module;
  final Widget child;

  @override
  Widget build(BuildContext context) => Card(
        backgroundColor: const Color(0x0FFFFFFF),
        borderColor: const Color(0x1AFFFFFF),
        borderRadius: BorderRadius.circular(8),
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Icon(module.icon, size: 16, color: FluentTheme.of(context).accentColor),
            const SizedBox(width: 8),
            Text(module.title, style: FluentTheme.of(context).typography.bodyStrong),
          ]),
          const SizedBox(height: 12),
          child,
        ]),
      );
}
