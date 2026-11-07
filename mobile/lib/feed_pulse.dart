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
const _red = Color(0xFFEF4444);

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

/// Дані для віджетів у стрічці: /me/rail (голос, сервери, сезон) і /me/hub (тривоги).
class FeedExtras {
  Map<String, dynamic> rail = const {};
  Map<String, dynamic> hub = const {};

  Future<void> load(Api api) async {
    await Future.wait([
      api
          .get(Api.site('/me/rail'))
          .then((d) => rail = mapOf(d))
          .catchError((_) => rail),
      api
          .get(Api.site('/me/hub'))
          .then((d) => hub = mapOf(d))
          .catchError((_) => hub),
    ]);
  }
}

/// Віджет між записами: після 2-го — голосовий штаб, 4-го — тривога, 6-го — топ серверів, 8-го — сезон.
class FeedInsert extends StatelessWidget {
  const FeedInsert({required this.index, required this.extras, super.key});
  final int index;
  final FeedExtras extras;

  @override
  Widget build(BuildContext context) {
    final child = switch (index) {
      1 => _voice(context),
      3 => _AlertCard(alerts: mapOf(extras.hub['alerts'])),
      5 => _servers(context),
      7 => _season(context),
      _ => null,
    };
    return child == null
        ? const SizedBox.shrink()
        : Padding(padding: const EdgeInsets.only(bottom: 12), child: child);
  }

  Widget _head(IconData icon, Color tone, String title, {Widget? aside}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(
          children: [
            Icon(icon, size: 19, color: tone),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: body(15.5, weight: FontWeight.w800),
              ),
            ),
            ?aside,
          ],
        ),
      );

  Widget? _voice(BuildContext context) {
    final rooms = maps(extras.rail['voice']);
    if (rooms.isEmpty) return null;
    final total = rooms.fold<int>(0, (sum, r) => sum + intOf(r['count']));
    return Glass(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _head(
            LucideIcons.mic,
            _emerald,
            tr('Голосовий штаб'),
            aside: Text(
              '● ${tr('{n} у войсі', {'n': total})}',
              style: body(12.5, color: _emerald, weight: FontWeight.w700),
            ),
          ),
          for (final room in rooms.take(2)) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: raised,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Icon(LucideIcons.volume2, size: 16, color: soft),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          text(room['name']) ?? '',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: body(14, weight: FontWeight.w700),
                        ),
                      ),
                      Container(
                        constraints: const BoxConstraints(maxWidth: 120),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: _sky.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          text(room['owner']) ?? '',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: body(
                            11.5,
                            color: _sky,
                            weight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      for (final p in maps(room['people']).take(3))
                        Align(
                          widthFactor: 0.75,
                          child: Avatar(
                            name: text(p['name']) ?? '',
                            url: absolute(p['avatar_url']),
                            size: 28,
                          ),
                        ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          maps(room['people'])
                                  .take(2)
                                  .map((p) => text(p['first_name']) ?? '')
                                  .join(', ') +
                              (intOf(room['count']) > 2
                                  ? ' +${intOf(room['count']) - 2}'
                                  : ''),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: body(12.5, color: muted),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  GestureDetector(
                    onTap: () =>
                        context.push(text(room['href']) ?? '/families'),
                    child: Container(
                      height: 40,
                      decoration: BoxDecoration(
                        color: _emerald.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Center(
                        child: Text(
                          tr('Приєднатися в 1 клік'),
                          style: body(
                            14,
                            color: _emerald,
                            weight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }

  Widget? _servers(BuildContext context) {
    final servers = maps(extras.rail['servers']);
    if (servers.isEmpty) return null;
    return Glass(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _head(
            LucideIcons.server,
            _sky,
            tr('Топ серверів'),
            aside: GestureDetector(
              onTap: () => context.go('/servers'),
              child: Text(
                'Live',
                style: body(13, color: _sky, weight: FontWeight.w700),
              ),
            ),
          ),
          for (final s in servers) ...[
            GestureDetector(
              onTap: () => context.push(text(s['href']) ?? '/servers'),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: raised,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Flexible(
                                    child: Text(
                                      text(s['name']) ?? '',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: body(
                                        14.5,
                                        weight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                  if (s['featured'] == true) ...[
                                    const SizedBox(width: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 6,
                                        vertical: 2,
                                      ),
                                      decoration: BoxDecoration(
                                        color: _amber.withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        tr('Партнер'),
                                        style: body(
                                          10.5,
                                          color: _amber,
                                          weight: FontWeight.w800,
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                              if ((text(s['tagline']) ?? text(s['website'])) !=
                                  null)
                                Text(
                                  text(s['tagline']) ??
                                      (text(s['website']) ?? '').replaceFirst(
                                        RegExp(r'^https?://'),
                                        '',
                                      ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: body(12, color: muted),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '${intOf(s['online'])}${s['max'] != null ? ' / ${intOf(s['max'])}' : ''}',
                              style: body(
                                14,
                                color: _emerald,
                                weight: FontWeight.w800,
                              ),
                            ),
                            Text(tr('онлайн'), style: body(11, color: muted)),
                          ],
                        ),
                      ],
                    ),
                    if (intOf(s['max']) > 0) ...[
                      const SizedBox(height: 10),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: Stack(
                          children: [
                            Container(height: 6, color: abyss),
                            FractionallySizedBox(
                              widthFactor:
                                  (intOf(s['online']) / intOf(s['max'])).clamp(
                                    0.0,
                                    1.0,
                                  ),
                              child: Container(
                                height: 6,
                                decoration: const BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [_sky, _emerald],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }

  Widget? _season(BuildContext context) {
    final season = mapOf(extras.rail['season']);
    if (season.isEmpty) return null;
    final streak = intOf(mapOf(extras.rail['me'])['streak']);
    final need = intOf(season['need']);
    final into = intOf(season['into']);
    final level = intOf(season['level']);
    return Glass(
      onTap: () => context.push('/season'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(LucideIcons.trophy, size: 19, color: _amber),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '${text(season['title']) ?? ''} · ${tr('Рів. {n}', {'n': level})}',
                  style: body(15.5, weight: FontWeight.w800),
                ),
              ),
              if (streak > 0)
                Text(
                  '🔥 ${tr('Стрік {n} {word}', {'n': streak, 'word': _days(streak)})}',
                  style: body(12.5, color: _sky, weight: FontWeight.w700),
                ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(5),
            child: LinearProgressIndicator(
              value: need > 0 ? (into / need).clamp(0.03, 1.0) : 1,
              minHeight: 8,
              color: _sky,
              backgroundColor: raised,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            need > 0
                ? tr('Залишилося {xp} XP до рівня {level}', {
                    'xp': need - into,
                    'level': level + 1,
                  })
                : tr('Максимальний рівень сезону'),
            style: body(13, color: muted),
          ),
        ],
      ),
    );
  }
}

/// Тривога в області людини з таймером «00:34:18», останнє повідомлення моніторингу й «Радар цілей».
class _AlertCard extends StatefulWidget {
  const _AlertCard({required this.alerts});
  final Map<String, dynamic> alerts;

  @override
  State<_AlertCard> createState() => _AlertCardState();
}

class _AlertCardState extends State<_AlertCard> {
  Timer? timer;

  @override
  void initState() {
    super.initState();
    timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && mapOf(widget.alerts['region'])['started_at'] != null) setState(() {});
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final alerts = widget.alerts;
    final count = intOf(alerts['active_count']);
    final region = mapOf(alerts['region']);
    final active = region['active'] == true;
    if (alerts.isEmpty || (count == 0 && !active)) return const SizedBox.shrink();
    String? elapsed;
    final since = DateTime.tryParse(text(region['started_at']) ?? '');
    if (active && since != null) {
      final s = DateTime.now().difference(since).inSeconds.clamp(0, 1 << 30);
      String pad(int n) => n.toString().padLeft(2, '0');
      elapsed = '${pad(s ~/ 3600)}:${pad(s % 3600 ~/ 60)}:${pad(s % 60)}';
    }
    final light = palette.isLight;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: light ? const Color(0xFFFEF2F2) : const Color(0xFF1C0D12),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: _red.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(LucideIcons.siren, color: _red, size: 21),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: active
                                ? '${text(region['name']) ?? ''} — ${text(region['label']) ?? tr('Повітряна тривога')}'
                                : tr('Тривога в {n} {word}', {
                                    'n': count,
                                    'word': plural(
                                      count,
                                      tr('області'),
                                      tr('областях'),
                                      tr('областях'),
                                    ),
                                  }),
                          ),
                          if (elapsed != null)
                            TextSpan(
                              text: '  $elapsed',
                              style: body(
                                15,
                                color: const Color(0xFFF87171),
                                weight: FontWeight.w700,
                              ),
                            ),
                        ],
                      ),
                      style: body(15, weight: FontWeight.w800),
                    ),
                    if (active && count > 1)
                      Text(
                        tr('Областей у тривозі: {n}', {'n': count}),
                        style: body(12, color: muted),
                      ),
                    if (text(alerts['latest']) case final latest?
                        when latest.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        latest,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: body(13, color: soft),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () => context.push('/alerts'),
            child: Container(
              height: 40,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: const Color(0xFFDC2626),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(LucideIcons.radar, size: 16, color: Colors.white),
                  const SizedBox(width: 8),
                  Text(
                    tr('Радар цілей'),
                    style: body(
                      14,
                      color: Colors.white,
                      weight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
