import 'core/widgets/notched_card.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Лобі на головній застосунку (#3): ті самі живі блоки й той самий порядок, що людина задала
/// на сайті (home_layout). Кожен блок — графітова картка з міткою «у вирізі» кута, як на сайті;
/// порожній блок не показуємо. Розділи вимкнених модулів не з’являються.
class LobbyBlocks extends StatefulWidget {
  const LobbyBlocks({super.key});

  @override
  State<LobbyBlocks> createState() => _LobbyBlocksState();
}

class _LobbyBlocksState extends State<LobbyBlocks> {
  Map<String, dynamic> pulse = const {};
  List<Map<String, dynamic>> weekly = const [];
  bool ready = false;
  bool busy = false;
  Timer? timer;

  /// Ключ віджета на сайті → модуль, без якого блоку немає.
  static const _modules = <String, String?>{
    'pulse': 'quests',
    'weekly': 'quests',
    'online': 'friends',
    'playing': 'friends',
    'requests': 'friends',
    'season': 'quests',
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    timer = Timer.periodic(const Duration(minutes: 1), (_) => _load());
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final session = AppScope.read(context).session;
    if (session.token == null) return;
    try {
      final p = await session.api.get('/api/v1/me/pulse-widget');
      List<Map<String, dynamic>> w = const [];
      if (session.modules?.contains('quests') ?? true) {
        try {
          w = maps((await session.api.get(Api.site('/quests')))['weekly']);
        } catch (_) {}
      }
      bool r = ready;
      try {
        r = (await session.api.get(Api.site('/ready')))['mine'] is Map;
      } catch (_) {}
      if (mounted) {
        setState(() {
          pulse = p;
          weekly = w;
          ready = r;
        });
      }
    } catch (_) {
      // Немає мережі — оновимо за хвилину.
    }
  }

  Future<void> _toggleReady() async {
    final api = AppScope.read(context).session.api;
    setState(() => busy = true);
    try {
      ready ? await api.delete(Api.site('/ready')) : await api.put(Api.site('/ready'), {'minutes': 60});
      if (mounted) setState(() => ready = !ready);
    } catch (e) {
      if (mounted) toast(context, e, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  int _int(String key) => intOf(pulse[key]);

  @override
  Widget build(BuildContext context) {
    final session = AppScope.of(context).session;
    final modules = session.modules;
    final layout = maps(session.me?['home_layout']);
    final order = layout.isEmpty ? const ['pulse', 'weekly', 'online', 'playing', 'requests'] : [for (final l in layout) '${l['key']}'];
    bool allowed(String key) => _modules.containsKey(key) && (_modules[key] == null || modules == null || modules.contains(_modules[key]));

    final blocks = <Widget>[
      // «Готовий грати» — головна дія лобі, завжди першою (як hero на сайті).
      _LobbyCard(
        badge: ready ? tr('Готовий') : null,
        tone: _Tone.live,
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(ready ? tr('Ви готові грати') : tr('Пограємо?'), style: body(16, weight: FontWeight.w700)),
              const SizedBox(height: 2),
              Text(tr('Друзі побачать, що ви шукаєте компанію.'), style: body(12.5, color: muted)),
            ]),
          ),
          const SizedBox(width: 12),
          PrimaryButton(
            label: ready ? tr('Зняти') : tr('Готовий грати'),
            icon: ready ? LucideIcons.circlePause : LucideIcons.gamepad2,
            compact: true,
            expand: false,
            busy: busy,
            onPressed: busy ? null : _toggleReady,
          ),
        ]),
      ),
      ...[for (final key in order) if (allowed(key)) _block(context, key)].whereType<Widget>(),
    ];

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (final block in blocks) ...[block, const SizedBox(height: 10)],
    ]);
  }

  Widget? _block(BuildContext context, String key) {
    switch (key) {
      case 'pulse':
        final quests = pulse['quests'] is Map ? mapOf(pulse['quests']) : null;
        if (quests == null || intOf(quests['total']) == 0) return null;
        return _LobbyCard(
          badge: tr('Завдання'),
          tone: _Tone.accent,
          onTap: () => context.push('/quests'),
          child: _line(LucideIcons.target, tr('Завдання дня'), '${quests['done']}/${quests['total']}'),
        );
      case 'weekly':
        final open = weekly.where((c) => c['claimed'] != true).toList();
        if (open.isEmpty) return null;
        return _LobbyCard(
          badge: tr('Тиждень'),
          tone: _Tone.accent,
          onTap: () => context.push('/quests'),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (final c in open) _line(LucideIcons.flame, '${c['title']}', '${c['progress']}/${c['target']}'),
          ]),
        );
      case 'online':
        if (_int('friends_online') == 0) return null;
        return _LobbyCard(
          badge: tr('Онлайн'),
          tone: _Tone.live,
          onTap: () => context.push('/friends?tab=online'),
          child: _line(LucideIcons.usersRound, tr('Друзі онлайн'), '${_int('friends_online')}'),
        );
      case 'playing':
        final playing = pulse['playing'] is List ? pulse['playing'] as List : const [];
        if (playing.isEmpty) return null;
        return _LobbyCard(
          badge: tr('У грі'),
          tone: _Tone.live,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (final p in playing.take(4))
              if (p is Map) _line(LucideIcons.gamepad2, '${p['name']}', '${p['label']}'),
          ]),
        );
      case 'requests':
        if (_int('friend_requests') == 0) return null;
        return _LobbyCard(
          badge: tr('Заявки'),
          tone: _Tone.alert,
          onTap: () => context.push('/friends?tab=requests'),
          child: _line(LucideIcons.userPlus, tr('Заявки в друзі'), '${_int('friend_requests')}'),
        );
      case 'season':
        final season = pulse['season'] is Map ? mapOf(pulse['season']) : null;
        if (season == null) return null;
        return _LobbyCard(
          badge: tr('Сезон'),
          onTap: () => context.push('/season'),
          child: _line(LucideIcons.ticket, tr('Сезонний пропуск'), tr('рівень {v} з {v2}', {'v': season['level'], 'v2': season['max']})),
        );
    }

    return null;
  }

  Widget _line(IconData icon, String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(children: [
          Icon(icon, size: 18, color: soft),
          const SizedBox(width: 10),
          Expanded(child: Text(label, style: body(14, weight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis)),
          const SizedBox(width: 8),
          Flexible(child: Text(value, style: body(13.5, color: accent, weight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis)),
        ]),
      );
}

enum _Tone { live, accent, alert }

/// Блок лобі: суцільна графітова картка, мітка «у вирізі» правого верхнього кута (як на сайті).
class _LobbyCard extends StatelessWidget {
  const _LobbyCard({required this.child, this.badge, this.tone, this.onTap});
  final Widget child;
  final String? badge;
  final _Tone? tone;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final dot = switch (tone) {
      _Tone.live => const Color(0xFF3EE0A8),
      _Tone.alert => const Color(0xFFFF7A55),
      _Tone.accent => primary,
      null => null,
    };
    // Одна фігура з вирізом (NotchedCard): перший рядок блоку — на рівні мітки, без порожньої смуги зверху.
    return NotchedCard(
      title: child,
      badge: badge == null ? null : NotchBadge(badge!, dot: dot),
      onTap: onTap,
    );
  }
}
