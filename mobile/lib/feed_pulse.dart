import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'extras.dart' show QuestsInline;
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Стрічка за макетом (як на сайті): смуга «серія · готовий грати · завдання» і віджети між записами.

const _sky = Color(0xFF38BDF8);
const _emerald = Color(0xFF34D399);
const _amber = Color(0xFFFBBF24);

String _days(int n) => plural(n, tr('день'), tr('дні'), tr('днів'));

String _left(String? until) {
  final end = DateTime.tryParse(until ?? '');
  if (end == null) return '';
  final minutes = end.difference(DateTime.now()).inMinutes.clamp(1, 100000);
  if (minutes < 60) return tr('ще {n} хв', {'n': minutes});
  final rest = minutes % 60;
  return rest > 0
      ? tr('ще {h} год {m} хв', {'h': minutes ~/ 60, 'm': rest})
      : tr('ще {h} год', {'h': minutes ~/ 60});
}

bool _alive(Map<String, dynamic> r) =>
    DateTime.tryParse(text(r['until']) ?? '')?.isAfter(DateTime.now()) ?? false;

/// Одна смуга над стрічкою: вогник серії, «Я готовий грати», завдання дня; кнопки розгортають панель під собою.
class FeedPulse extends StatefulWidget {
  const FeedPulse({super.key});

  @override
  State<FeedPulse> createState() => FeedPulseState();
}

class FeedPulseState extends State<FeedPulse> {
  Map<String, dynamic>? ready;
  List<Map<String, dynamic>> quests = const [];
  String? panel;
  bool busy = false;
  String? game;
  int minutes = 60;
  final note = TextEditingController();

  Api get api => AppScope.read(context).session.api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => reload());
  }

  @override
  void dispose() {
    note.dispose();
    super.dispose();
  }

  Future<void> reload() async {
    final modules = AppScope.read(context).session.modules;
    await Future.wait([
      api
          .get(Api.site('/ready'))
          .then<void>((d) => ready = d)
          .catchError((_) => ready = null),
      if (modules == null || modules.contains('quests'))
        api
            .get(Api.site('/quests'))
            .then<void>((d) => quests = maps(d['quests']))
            .catchError((_) => quests = const []),
    ]);
    if (mounted) setState(() {});
  }

  Future<void> _send(bool start) async {
    setState(() => busy = true);
    try {
      final next = start
          ? await api.put(Api.site('/ready'), {
              'game': game,
              'minutes': minutes,
              'note': note.text,
            })
          : await api.delete(Api.site('/ready'));
      if (!mounted) return;
      setState(() {
        ready = mapOf(next);
        if (start) panel = null;
      });
      toast(
        context,
        start
            ? tr('Друзі бачать, що ви готові грати.')
            : tr('Готовність знято.'),
      );
    } catch (_) {
      if (mounted) toast(context, tr('Не вдалося оновити статус.'), kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void _toggle(String key) => setState(() => panel = panel == key ? null : key);

  @override
  Widget build(BuildContext context) {
    final me = AppScope.of(context).session.me ?? const {};
    final streak = intOf(mapOf(me['streak'])['days']);
    final state = ready;
    final mine =
        state != null && state['mine'] is Map && _alive(mapOf(state['mine']))
        ? mapOf(state['mine'])
        : null;
    final friends = state == null
        ? <Map<String, dynamic>>[]
        : maps(state['friends']).where(_alive).toList();
    final showQuests =
        quests.isNotEmpty && !quests.every((q) => q['claimed'] == true);
    final done = quests.where((q) => q['done'] == true).length;
    if (streak < 1 && state == null && !showQuests) return const SizedBox.shrink();
    final narrow = MediaQuery.sizeOf(context).width < 400;

    Widget pill({required Widget child, VoidCallback? onTap}) =>
        GestureDetector(
          onTap: onTap,
          child: Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: raised,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Center(child: child),
          ),
        );

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Glass(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                if (streak > 0) ...[
                  pill(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(LucideIcons.flame, size: 16, color: _amber),
                        const SizedBox(width: 5),
                        Text(
                          narrow ? '$streak' : '$streak ${_days(streak)}',
                          style: body(
                            14,
                            color: _amber,
                            weight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                if (state != null)
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _toggle('ready'),
                      child: Container(
                        height: 44,
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(14),
                          color: mine != null
                              ? _emerald.withValues(alpha: 0.15)
                              : null,
                          gradient: mine != null
                              ? null
                              : const LinearGradient(
                                  colors: [
                                    Color(0xFF0EA5E9),
                                    Color(0xFF22D3EE),
                                  ],
                                ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              mine != null
                                  ? LucideIcons.circleDot
                                  : LucideIcons.gamepad2,
                              size: 16,
                              color: mine != null
                                  ? _emerald
                                  : const Color(0xFF04121F),
                            ),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                mine != null
                                    ? '${tr('Готові')} · ${_left(text(mine['until']))}'
                                    : tr('Я готовий грати'),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: body(
                                  14,
                                  color: mine != null
                                      ? _emerald
                                      : const Color(0xFF04121F),
                                  weight: FontWeight.w700,
                                ),
                              ),
                            ),
                            if (mine == null && friends.isNotEmpty) ...[
                              const SizedBox(width: 6),
                              for (final f in friends.take(3))
                                Align(
                                  widthFactor: 0.7,
                                  child: Avatar(
                                    name: text(mapOf(f['user'])['name']) ?? '',
                                    url: absolute(
                                      mapOf(f['user'])['avatar_url'],
                                    ),
                                    size: 24,
                                  ),
                                ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  )
                else
                  const Spacer(),
                if (showQuests) ...[
                  const SizedBox(width: 8),
                  pill(
                    onTap: () => _toggle('quests'),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(LucideIcons.target, size: 16, color: _sky),
                        const SizedBox(width: 5),
                        Text(
                          '$done/${quests.length}${narrow ? '' : ' XP'}',
                          style: body(14, color: _sky, weight: FontWeight.w800),
                        ),
                        AnimatedRotation(
                          turns: panel == 'quests' ? 0.5 : 0,
                          duration: const Duration(milliseconds: 200),
                          child: const Icon(
                            LucideIcons.chevronDown,
                            size: 16,
                            color: _sky,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
            AnimatedSize(
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOutCubic,
              alignment: Alignment.topCenter,
              child: panel == null
                  ? const SizedBox(width: double.infinity)
                  : Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: panel == 'quests'
                          ? Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                QuestsInline(quests: quests, onChanged: reload),
                                GestureDetector(
                                  onTap: () => context.push('/season'),
                                  child: Padding(
                                    padding: const EdgeInsets.all(4),
                                    child: Text(
                                      tr('Сезонний пропуск'),
                                      style: body(
                                        13,
                                        color: _sky,
                                        weight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            )
                          : _readyPanel(state!, mine, friends),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _chip(String label, bool active, VoidCallback onTap) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
          decoration: BoxDecoration(
            color: active ? _sky : raised,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            label,
            style: body(
              12.5,
              color: active ? const Color(0xFF04121F) : soft,
              weight: FontWeight.w600,
            ),
          ),
        ),
      );

  Widget _readyPanel(
    Map<String, dynamic> state,
    Map<String, dynamic>? mine,
    List<Map<String, dynamic>> friends,
  ) {
    final games = maps(state['games']);
    final durations = (state['durations'] as List? ?? const [30, 60, 120])
        .map((d) => intOf(d))
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (mine != null)
          Container(
            padding: const EdgeInsets.fromLTRB(12, 6, 6, 6),
            decoration: BoxDecoration(
              color: _emerald.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    mapOf(mine['game'])['name'] != null
                        ? tr('Готові грати в {game}', {
                            'game': mapOf(mine['game'])['name'],
                          })
                        : tr('Готові грати'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: body(14, weight: FontWeight.w600),
                  ),
                ),
                TextButton.icon(
                  onPressed: busy ? null : () => _send(false),
                  icon: Icon(LucideIcons.power, size: 15, color: soft),
                  label: Text(tr('Зняти'), style: body(13, color: soft)),
                ),
              ],
            ),
          )
        else ...[
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _chip(
                tr('Будь-яка гра'),
                game == null,
                () => setState(() => game = null),
              ),
              for (final g in games)
                _chip(
                  text(g['name']) ?? '',
                  game == text(g['slug']),
                  () => setState(() => game = text(g['slug'])),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final d in durations)
                _chip(
                  d < 60
                      ? tr('{n} хв', {'n': d})
                      : tr('{n} год', {'n': d ~/ 60}),
                  minutes == d,
                  () => setState(() => minutes = d),
                ),
            ],
          ),
          const SizedBox(height: 8),
          GcField(
            controller: note,
            label: tr('Примітка: «є мікро, граю спокійно»'),
            dense: true,
          ),
          const SizedBox(height: 8),
          PrimaryButton(
            label: tr('Почати'),
            icon: LucideIcons.gamepad2,
            busy: busy,
            onPressed: busy ? null : () => _send(true),
          ),
        ],
        const SizedBox(height: 10),
        if (friends.isEmpty)
          Text(
            tr('Зараз ніхто з друзів не позначив, що вільний. Будьте першим.'),
            style: body(12.5, color: muted),
          )
        else
          for (final f in friends)
            InkWell(
              onTap: () => context.push('/u/${mapOf(f['user'])['username']}'),
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(
                  children: [
                    Avatar(
                      name: text(mapOf(f['user'])['name']) ?? '',
                      url: absolute(mapOf(f['user'])['avatar_url']),
                      size: 34,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${text(mapOf(f['user'])['first_name']) ?? ''}${mapOf(f['game'])['name'] != null ? ' · ${mapOf(f['game'])['name']}' : ''}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: body(14, weight: FontWeight.w600),
                          ),
                          Text(
                            _left(text(f['until'])),
                            style: body(12, color: muted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
      ],
    );
  }
}
