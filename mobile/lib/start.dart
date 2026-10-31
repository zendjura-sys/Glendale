import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'settings.dart' show ModePicker;
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// Перші кроки новачка — як /start на сайті: номер → режим соцмережі → ігри й сервери.
// Крок приходить із сервера (/me.onboarding), тож сайт і застосунок ведуть людину однаково.

class StartScreen extends StatefulWidget {
  const StartScreen({super.key});

  @override
  State<StartScreen> createState() => _StartScreenState();
}

class _StartScreenState extends State<StartScreen> {
  bool busy = false;

  Future<void> _run(Future<dynamic> Function() action) async {
    final session = AppScope.read(context).session;
    setState(() => busy = true);
    if (await attempt(context, action)) await session.refreshMe();
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final session = AppScope.of(context).session;
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) {
        final step = text(session.me?['onboarding']);
        if (step == null) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) context.go('/feed');
          });
          return const SizedBox.shrink();
        }
        final api = session.api;
        final skip = TextButton(onPressed: busy ? null : () => _run(() => api.post(Api.site('/start/skip'))), child: Text(tr('Пропустити'), style: body(14, color: muted)));
        return ScreenScroll(children: [
          PageTitle(tr('Ласкаво просимо в GameCon!'), subtitle: tr('Кілька кроків — і стрічка буде саме для вас.')),
          _Steps(step: step),
          const SizedBox(height: 12),
          switch (step) {
            'phone' => Glass(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  CardTitle(tr('Ваш номер у GameCon'), icon: LucideIcons.phone),
                  Text(tr('Безкоштовний внутрішній номер: дзвінки й повідомлення друзям за номером. Можна взяти зараз або пізніше.'), style: body(13.5, color: soft)),
                  const SizedBox(height: 12),
                  PrimaryButton(label: tr('Отримати номер'), icon: LucideIcons.phone, onPressed: () => context.push('/phone')),
                  const SizedBox(height: 8),
                  GhostButton(label: tr('Далі'), onPressed: busy ? null : () => _run(() => api.post(Api.site('/start/phone')))),
                ]),
              ),
            'mode' => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text(tr('Що вам цікаво? Режим показує потрібні розділи — змінити можна будь-коли в налаштуваннях.'), style: body(13.5, color: soft)),
                const SizedBox(height: 10),
                const ModePicker(),
              ]),
            _ => _Interests(busy: busy, onDone: (games, servers) => _run(() => api.post(Api.site('/start'), {'games': games, 'servers': servers}))),
          },
          Align(alignment: Alignment.center, child: skip),
        ]);
      },
    );
  }
}

class _Steps extends StatelessWidget {
  const _Steps({required this.step});
  final String step;

  @override
  Widget build(BuildContext context) {
    const order = ['phone', 'mode', 'interests'];
    final labels = [tr('Номер'), tr('Режим'), tr('Ігри')];
    final at = order.indexOf(step);
    return Row(children: [
      for (var i = 0; i < order.length; i++) ...[
        Expanded(
          child: Column(children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              height: 4,
              decoration: BoxDecoration(color: i <= at ? primary : fg.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(2)),
            ),
            const SizedBox(height: 6),
            Text(labels[i], style: body(12, color: i == at ? ink : faint, weight: i == at ? FontWeight.w700 : FontWeight.w500)),
          ]),
        ),
        if (i < order.length - 1) const SizedBox(width: 8),
      ],
    ]);
  }
}

class _Interests extends StatefulWidget {
  const _Interests({required this.busy, required this.onDone});
  final bool busy;
  final void Function(List<int> games, List<int> servers) onDone;

  @override
  State<_Interests> createState() => _InterestsState();
}

class _InterestsState extends State<_Interests> {
  final games = <int>{};
  final servers = <int>{};

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/start')),
      builder: (d, _) {
        final gameList = maps(d['games']);
        final serverList = maps(d['servers']);
        Widget grid(List<Map<String, dynamic>> items, Set<int> picked, String? Function(Map<String, dynamic>) image) => Wrap(spacing: 8, runSpacing: 8, children: [
          for (final item in items)
            SelectPill(
              label: text(item['name']) ?? '',
              selected: picked.contains(intOf(item['id'])),
              onTap: () => setState(() => picked.contains(intOf(item['id'])) ? picked.remove(intOf(item['id'])) : picked.add(intOf(item['id']))),
            ),
        ]);
        return Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (gameList.isNotEmpty) ...[
              CardTitle(tr('У що граєте?'), icon: LucideIcons.gamepad2),
              grid(gameList, games, (g) => text(g['cover'])),
              const SizedBox(height: 14),
            ],
            if (serverList.isNotEmpty) ...[
              CardTitle(tr('Сервери GTA'), icon: LucideIcons.server),
              grid(serverList, servers, (s) => text(s['logo_url'])),
              const SizedBox(height: 14),
            ],
            PrimaryButton(label: tr('Готово'), icon: LucideIcons.check, busy: widget.busy, onPressed: () => widget.onDone(games.toList(), servers.toList())),
          ]),
        );
      },
    );
  }
}
