import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'i18n.dart';
import 'skeletons.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// Нові розділи сайту в застосунку (міст /api/v1/site, ті самі контролери):
// рівень профілю, нагороди за вхід, колекційні картки, подія сезону, «В ефірі», звіт прозорості,
// імпорт бібліотеки Steam і списків аніме. Нічого не купується — кристали й картки лише за активність.

/// Спільна заготовка екрана: завантаження, помилка, оновлення.
abstract class _SiteScreenState<T extends StatefulWidget> extends State<T> {
  Map<String, dynamic>? data;
  Object? error;
  String? busy;

  Api get api => AppScope.read(context).session.api;
  String get path;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => load());
  }

  Future<void> load() async {
    try {
      final result = await api.get(Api.site(path));
      if (mounted) setState(() => (data = result, error = null));
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  Future<bool> run(String key, Future<dynamic> Function() action, {String? success}) async {
    setState(() => busy = key);
    final ok = await attempt(context, action, success: success);
    if (mounted) setState(() => busy = null);
    if (ok) await load();
    return ok;
  }

  Widget content(Map<String, dynamic> d);

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) {
      if (error != null) {
        return ScreenScroll(onRefresh: load, children: [
          EmptyState(icon: LucideIcons.wifiOff, title: tr('Не вдалося завантажити'), text: '$error', action: tr('Спробувати ще'), onAction: load),
        ]);
      }
      return const ScreenSkeleton();
    }
    return content(d);
  }
}

Widget _progress(double value, {Color? color}) => ClipRRect(
      borderRadius: BorderRadius.circular(4),
      child: LinearProgressIndicator(value: value.clamp(0, 1), minHeight: 6, color: color ?? primary, backgroundColor: fg.withValues(alpha: 0.08)),
    );

// ───────────────────────── Рівень профілю ─────────────────────────

String _sourceLabel(String? key) => switch (key) {
      'posts' => tr('Пости'),
      'comments' => tr('Коментарі'),
      'likes' => tr('Отримані вподобайки'),
      'friends' => tr('Друзі'),
      'quests' => tr('Виконані завдання'),
      'days' => tr('Дні на сайті'),
      'plays' => tr('Прослухані треки'),
      'moments' => tr('Моменти'),
      'achievements' => tr('Досягнення'),
      _ => key ?? '',
    };

class LevelScreen extends StatefulWidget {
  const LevelScreen({super.key});

  @override
  State<LevelScreen> createState() => _LevelScreenState();
}

class _LevelScreenState extends _SiteScreenState<LevelScreen> {
  @override
  String get path => '/level';

  @override
  Widget content(Map<String, dynamic> d) {
    final xp = intOf(d['xp']);
    final from = intOf(d['level_xp']);
    final to = intOf(d['next_xp']);
    final span = to - from;
    return ScreenScroll(onRefresh: load, children: [
      PageTitle(tr('Рівень профілю'), subtitle: tr('Досвід за активність на сайті й у застосунку')),
      Glass(
        padding: const EdgeInsets.all(18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(tr('Рівень {n}', {'n': intOf(d['level'])}), style: display(28)),
            const SizedBox(width: 10),
            Padding(padding: const EdgeInsets.only(bottom: 4), child: Pill(label: text(d['title']) ?? '', color: primary)),
          ]),
          const SizedBox(height: 14),
          _progress(span > 0 ? (xp - from) / span : 1),
          const SizedBox(height: 6),
          Text(tr('{have} / {need} XP до наступного рівня', {'have': xp, 'need': to}), style: body(12, color: muted)),
        ]),
      ),
      const SizedBox(height: 14),
      SectionLabel(tr('Звідки досвід')),
      Glass(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        child: Column(children: [
          for (final s in maps(d['sources']))
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(children: [
                Expanded(child: Text(_sourceLabel(text(s['key'])), style: body(13.5, weight: FontWeight.w600))),
                Text('${intOf(s['count'])} × ${intOf(s['per'])}', style: body(12, color: muted)),
                const SizedBox(width: 12),
                Text('${intOf(s['xp'])} XP', style: body(13, weight: FontWeight.w700, color: primary)),
              ]),
            ),
        ]),
      ),
      const SizedBox(height: 14),
      SectionLabel(tr('Нагороди за рівні')),
      for (final r in maps(d['rewards'])) ...[
        Glass(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Icon(r['reached'] == true ? LucideIcons.badgeCheck : LucideIcons.lock, size: 18, color: r['reached'] == true ? Colors.green : muted),
            const SizedBox(width: 12),
            Expanded(child: Text(text(mapOf(r['reward'])['name']) ?? '', style: body(13.5, weight: FontWeight.w600))),
            Text(tr('Рівень {n}', {'n': intOf(r['level'])}), style: body(12, color: muted)),
          ]),
        ),
        const SizedBox(height: 8),
      ],
    ]);
  }
}

// ───────────────────────── Нагороди за вхід ─────────────────────────

class LoginRewardsScreen extends StatefulWidget {
  const LoginRewardsScreen({super.key});

  @override
  State<LoginRewardsScreen> createState() => _LoginRewardsScreenState();
}

class _LoginRewardsScreenState extends _SiteScreenState<LoginRewardsScreen> {
  @override
  String get path => '/rewards';

  String _kind(Map<String, dynamic> c) => switch (text(c['kind'])) {
        'shards' => tr('{n} кристалів', {'n': intOf(c['amount'])}),
        'pack' => tr('Набір карток'),
        'points' => tr('{n} очок сезону', {'n': intOf(c['amount'])}),
        _ => text(c['label']) ?? '',
      };

  @override
  Widget content(Map<String, dynamic> d) {
    final cells = maps(d['cells']);
    return ScreenScroll(onRefresh: load, children: [
      PageTitle(tr('Нагороди за вхід'), subtitle: tr('Заходьте щодня — нагорода за кожен день місяця')),
      Glass(
        padding: const EdgeInsets.all(16),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr('Отримано днів: {n}', {'n': intOf(d['claimed'])}), style: body(15, weight: FontWeight.w700)),
              const SizedBox(height: 2),
              Text(tr('До кінця місяця: {n} дн.', {'n': intOf(d['days_left'])}), style: body(12, color: muted)),
            ]),
          ),
          PrimaryButton(
            label: d['today_claimed'] == true ? tr('Сьогодні вже отримано') : tr('Забрати'),
            icon: LucideIcons.gift,
            expand: false,
            busy: busy == 'claim',
            onPressed: d['can_claim'] == true ? () => run('claim', () => api.post(Api.site('/rewards/claim'))) : null,
          ),
        ]),
      ),
      const SizedBox(height: 12),
      GridView.count(
        crossAxisCount: 4,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        childAspectRatio: 0.9,
        children: [
          for (final c in cells)
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: c['claimed'] == true ? primary.withValues(alpha: 0.14) : card,
                borderRadius: BorderRadius.circular(12),
                border: c['next'] == true ? Border.all(color: primary, width: 1.5) : null,
              ),
              child: Column(mainAxisAlignment: MainAxisAlignment.spaceBetween, crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Text('${intOf(c['day'])}', style: body(12, weight: FontWeight.w700, color: muted)),
                  const Spacer(),
                  if (c['claimed'] == true) Icon(LucideIcons.check, size: 14, color: primary),
                ]),
                Text(_kind(c), style: body(11.5, weight: FontWeight.w600), maxLines: 2, overflow: TextOverflow.ellipsis),
              ]),
            ),
        ],
      ),
    ]);
  }
}

// ───────────────────────── Колекційні картки ─────────────────────────

const _rankColors = <String, Color>{
  'N': Color(0xFF94A3B8),
  'G': Color(0xFF84CC16),
  'F': Color(0xFF22C55E),
  'E': Color(0xFF14B8A6),
  'D': Color(0xFF06B6D4),
  'C': Color(0xFF0EA5E9),
  'B': Color(0xFF3B82F6),
  'A': Color(0xFF6366F1),
  'R': Color(0xFF8B5CF6),
  'SR': Color(0xFFA855F7),
  'SSR': Color(0xFFD946EF),
  'S': Color(0xFFF59E0B),
  'SS': Color(0xFFF97316),
  'SSS': Color(0xFFEF4444),
  'EX': Color(0xFFF43F5E),
  'U': Color(0xFFFDE047),
};

Color rankColor(String? rank) => _rankColors[rank] ?? const Color(0xFF94A3B8);

/// Одна картка колекції: обкладинка, ранг кольором рамки, назва.
class CollectibleCard extends StatelessWidget {
  const CollectibleCard({required this.card, this.onTap, super.key});
  final Map<String, dynamic> card;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color = rankColor(text(card['rarity']));
    final copies = intOf(card['copies']);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(2.5),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: LinearGradient(colors: [color, const Color(0xFF0B1220), color], begin: Alignment.topLeft, end: Alignment.bottomRight),
          boxShadow: [BoxShadow(color: color.withValues(alpha: 0.35), blurRadius: 12, offset: const Offset(0, 4))],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: Stack(fit: StackFit.expand, children: [
            Container(color: const Color(0xFF0B1220)),
            NetImage(text(card['cover'])),
            const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(colors: [Colors.transparent, Color(0xDD0B1220)], begin: Alignment.center, end: Alignment.bottomCenter))),
            Positioned(
              left: 6,
              top: 6,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(5)),
                child: Text(text(card['rarity']) ?? '', style: body(10, weight: FontWeight.w900, color: color)),
              ),
            ),
            if (copies > 1)
              Positioned(
                right: 6,
                top: 6,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(5)),
                  child: Text('×$copies', style: body(10, weight: FontWeight.w700, color: Colors.white)),
                ),
              ),
            Positioned(
              left: 7,
              right: 7,
              bottom: 6,
              child: Text(text(card['name']) ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(11, weight: FontWeight.w700, color: Colors.white)),
            ),
          ]),
        ),
      ),
    );
  }
}

class CardsScreen extends StatefulWidget {
  const CardsScreen({super.key});

  @override
  State<CardsScreen> createState() => _CardsScreenState();
}

class _CardsScreenState extends _SiteScreenState<CardsScreen> {
  String? collection;

  @override
  String get path => '/cards';

  Future<void> _reveal(Future<Map<String, dynamic>> request, String key) async {
    setState(() => busy = key);
    try {
      final result = await request;
      final got = maps(result['cards']);
      if (mounted && got.isNotEmpty) {
        await showGcSheet<void>(
          context,
          title: tr('Нові картки'),
          builder: (_) => Wrap(spacing: 10, runSpacing: 10, children: [
            for (final c in got) SizedBox(width: 104, height: 146, child: CollectibleCard(card: c)),
          ]),
        );
      }
    } catch (e) {
      if (mounted) toast(context, e, kind: ToastKind.error);
    }
    if (mounted) setState(() => busy = null);
    await load();
  }

  void _details(Map<String, dynamic> c) {
    final key = text(c['key'])!;
    final copies = intOf(c['copies']);
    showGcSheet<void>(
      context,
      title: text(c['name']),
      subtitle: '${text(c['rarity']) ?? ''} · ${text(c['set']) ?? ''}',
      builder: (sheet) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Center(child: SizedBox(width: 150, height: 210, child: CollectibleCard(card: c))),
        const SizedBox(height: 14),
        GhostButton(
          label: c['showcase'] == true ? tr('Прибрати з вітрини профілю') : tr('Показати на вітрині профілю'),
          icon: LucideIcons.star,
          onPressed: () {
            Navigator.pop(sheet);
            run('showcase', () => api.post(Api.site('/cards/$key/showcase')));
          },
        ),
        if (copies > 1) ...[
          const SizedBox(height: 8),
          GhostButton(
            label: tr('Розщепити дублікат на кристали'),
            icon: LucideIcons.gem,
            onPressed: () {
              Navigator.pop(sheet);
              run('split', () => api.post(Api.site('/cards/$key/split'), {'count': 1}));
            },
          ),
        ],
      ]),
    );
  }

  @override
  Widget content(Map<String, dynamic> d) {
    final next = DateTime.tryParse(text(d['next_pack_at']) ?? '')?.toLocal();
    final ready = next == null || next.isBefore(DateTime.now());
    final collections = maps(d['collections']);
    final cards = [for (final c in maps(d['cards'])) if (collection == null || text(c['theme']) == collection) c];
    final drops = maps(d['drops']);

    return ScreenScroll(onRefresh: load, children: [
      PageTitle(tr('Колекційні картки'), subtitle: tr('Персонажі ігор і світів — 16 рангів від N до U')),
      Glass(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: _stat(tr('Карток'), '${maps(d['cards']).length}')),
            Expanded(child: _stat(tr('Кристали'), compact(d['shards']))),
            Expanded(child: _stat(tr('Дублікати'), '${intOf(d['duplicates'])}')),
          ]),
          const SizedBox(height: 14),
          PrimaryButton(
            label: ready ? tr('Відкрити набір ({n} картки)', {'n': intOf(d['pack_size'], 4)}) : tr('Новий набір о {time}', {'time': '${next.hour.toString().padLeft(2, '0')}:${next.minute.toString().padLeft(2, '0')}'}),
            icon: LucideIcons.layers,
            busy: busy == 'open',
            onPressed: ready ? () => _reveal(api.post(Api.site('/cards/open'), {'crystals': 0}), 'open') : null,
          ),
        ]),
      ),
      if (drops.isNotEmpty) ...[
        const SizedBox(height: 14),
        SectionLabel(tr('Картки за активність')),
        for (final drop in drops) ...[
          Glass(
            padding: const EdgeInsets.all(12),
            child: Row(children: [
              Icon(text(drop['source']) == 'play' ? LucideIcons.gamepad2 : LucideIcons.film, size: 18, color: primary),
              const SizedBox(width: 10),
              Expanded(child: Text(text(drop['title']) ?? '', style: body(13.5, weight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis)),
              PrimaryButton(
                label: tr('Відкрити'),
                expand: false,
                compact: true,
                busy: busy == 'drop${drop['id']}',
                onPressed: () => _reveal(api.post(Api.site('/cards/drops/${drop['id']}/open'), {'crystals': 0}), 'drop${drop['id']}'),
              ),
            ]),
          ),
          const SizedBox(height: 8),
        ],
      ],
      if (collections.isNotEmpty) ...[
        const SizedBox(height: 14),
        SectionLabel(tr('Колекції')),
        SizedBox(
          height: 36,
          child: ListView(scrollDirection: Axis.horizontal, children: [
            SelectPill(label: tr('Усі'), selected: collection == null, onTap: () => setState(() => collection = null)),
            for (final c in collections) ...[
              const SizedBox(width: 6),
              SelectPill(
                label: '${text(c['name'])} ${intOf(c['owned'])}/${intOf(c['total'])}',
                selected: collection == text(c['name']),
                onTap: () => setState(() => collection = text(c['name'])),
              ),
            ],
          ]),
        ),
      ],
      const SizedBox(height: 12),
      if (cards.isEmpty)
        QuietEmpty(icon: LucideIcons.layers, text: tr('Тут з’являться ваші картки: відкривайте набори й дивіться, грайте, пишіть.'))
      else
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 130, childAspectRatio: 5 / 7, mainAxisSpacing: 10, crossAxisSpacing: 10),
          itemCount: cards.length,
          itemBuilder: (_, i) => CollectibleCard(card: cards[i], onTap: () => _details(cards[i])),
        ),
    ]);
  }

  Widget _stat(String label, String value) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(value, style: display(20)),
        Text(label, style: body(12, color: muted)),
      ]);
}

// ───────────────────────── Подія сезону ─────────────────────────

String _metricLabel(String? metric) => switch (metric) {
      'posts' => tr('Пости'),
      'comments' => tr('Коментарі'),
      'plays' => tr('Прослухані треки'),
      'moments' => tr('Моменти'),
      'likes' => tr('Вподобайки'),
      'quests' => tr('Завдання'),
      _ => metric ?? '',
    };

class SiteEventScreen extends StatefulWidget {
  const SiteEventScreen({this.slug, super.key});
  final String? slug;

  @override
  State<SiteEventScreen> createState() => _SiteEventScreenState();
}

class _SiteEventScreenState extends _SiteScreenState<SiteEventScreen> {
  String? slug;

  @override
  String get path => slug == null ? '/season-events' : '/season-events/$slug';

  @override
  void initState() {
    slug = widget.slug;
    super.initState();
  }

  @override
  Future<void> load() async {
    await super.load();
    // Без slug сайт перенаправляє на активну подію — йдемо за посиланням.
    final redirect = text(data?['redirect']);
    if (slug == null && redirect != null && redirect.startsWith('/season-events/')) {
      slug = redirect.split('/').last;
      await super.load();
    }
  }

  @override
  Widget content(Map<String, dynamic> d) {
    final e = mapOf(d['event']);
    if (e.isEmpty) {
      return ScreenScroll(onRefresh: load, children: [
        EmptyState(icon: LucideIcons.calendarDays, title: tr('Зараз немає події'), text: tr('Слідкуйте за новинами — сезонні події з нагородами проходять кілька разів на рік.')),
      ]);
    }
    final goal = mapOf(e['goal']);
    final ends = DateTime.tryParse(text(e['ends_at']) ?? '')?.toLocal();
    return ScreenScroll(onRefresh: load, children: [
      Glass(
        padding: const EdgeInsets.all(18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(text(e['title']) ?? '', style: display(24)),
          const SizedBox(height: 6),
          Text(text(e['description']) ?? '', style: body(13.5, color: soft)),
          if (ends != null) ...[
            const SizedBox(height: 8),
            Pill(label: tr('До кінця: {n} дн.', {'n': ends.difference(DateTime.now()).inDays.clamp(0, 999)}), icon: LucideIcons.clock, color: primary),
          ],
        ]),
      ),
      const SizedBox(height: 14),
      SectionLabel(tr('Ваші завдання')),
      for (final t in maps(e['tasks'])) ...[
        Glass(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(_metricLabel(text(t['metric'])), style: body(13.5, weight: FontWeight.w600))),
              Text('${intOf(t['done'])} / ${intOf(t['target'])}', style: body(12.5, color: muted)),
            ]),
            const SizedBox(height: 8),
            _progress(intOf(t['target']) > 0 ? intOf(t['done']) / intOf(t['target']) : 0),
          ]),
        ),
        const SizedBox(height: 8),
      ],
      if (goal.isNotEmpty) ...[
        const SizedBox(height: 6),
        SectionLabel(tr('Спільна мета сайту')),
        Glass(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${_metricLabel(text(goal['metric']))}: ${intOf(goal['done'])} / ${intOf(goal['target'])}', style: body(13.5, weight: FontWeight.w600)),
            const SizedBox(height: 8),
            _progress(intOf(goal['target']) > 0 ? intOf(goal['done']) / intOf(goal['target']) : 0, color: Colors.green),
          ]),
        ),
      ],
      const SizedBox(height: 14),
      SectionLabel(tr('Нагорода')),
      Glass(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          for (final r in maps(e['reward']))
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(children: [
                Icon(LucideIcons.gift, size: 16, color: primary),
                const SizedBox(width: 8),
                Expanded(child: Text(text(r['name']) ?? '', style: body(13.5, weight: FontWeight.w600))),
              ]),
            ),
          const SizedBox(height: 8),
          PrimaryButton(
            label: e['claimed'] == true ? tr('Нагороду отримано') : tr('Забрати нагороду'),
            icon: LucideIcons.gift,
            busy: busy == 'claim',
            onPressed: e['complete'] == true && e['claimed'] != true ? () => run('claim', () => api.post(Api.site('/season-events/${e['slug']}/claim'))) : null,
          ),
        ]),
      ),
    ]);
  }
}

// ───────────────────────── В ефірі ─────────────────────────

class LiveNowScreen extends StatefulWidget {
  const LiveNowScreen({super.key});

  @override
  State<LiveNowScreen> createState() => _LiveNowScreenState();
}

class _LiveNowScreenState extends _SiteScreenState<LiveNowScreen> {
  @override
  String get path => '/streams/live';

  @override
  Widget content(Map<String, dynamic> d) {
    final streams = maps(d['streams']);
    return ScreenScroll(onRefresh: load, children: [
      PageTitle(tr('В ефірі'), subtitle: tr('Стріми людей GameCon просто зараз')),
      if (streams.isEmpty)
        EmptyState(icon: LucideIcons.radio, title: tr('Зараз ніхто не стрімить'), text: tr('Підключіть Twitch у налаштуваннях — і друзі побачать, коли ви в ефірі.'))
      else
        for (final s in streams) ...[
          Glass(
            padding: const EdgeInsets.all(14),
            onTap: () => launchUrl(Uri.parse(text(s['url']) ?? ''), mode: LaunchMode.externalApplication),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              UserTile(user: mapOf(s['user']), size: 40, subtitle: text(s['game']), trailing: Pill(label: tr('{n} глядачів', {'n': compact(s['viewers'])}), icon: LucideIcons.eye, color: Colors.redAccent)),
              const SizedBox(height: 8),
              Text(text(s['title']) ?? '', style: body(13.5, weight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text(text(s['platform_label']) ?? '', style: body(12, color: muted)),
            ]),
          ),
          const SizedBox(height: 8),
        ],
    ]);
  }
}

// ───────────────────────── Звіт прозорості ─────────────────────────

class TransparencyScreen extends StatefulWidget {
  const TransparencyScreen({super.key});

  @override
  State<TransparencyScreen> createState() => _TransparencyScreenState();
}

class _TransparencyScreenState extends _SiteScreenState<TransparencyScreen> {
  String? quarter;

  @override
  String get path => quarter == null ? '/transparency' : '/transparency?q=$quarter';

  Widget _row(String label, dynamic value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(children: [
          Expanded(child: Text(label, style: body(13.5, color: soft))),
          Text('${value ?? '—'}', style: body(13.5, weight: FontWeight.w700)),
        ]),
      );

  @override
  Widget content(Map<String, dynamic> d) {
    final r = mapOf(d['report']);
    final reports = mapOf(r['reports']);
    final actions = mapOf(r['actions']);
    final appeals = mapOf(r['appeals']);
    return ScreenScroll(onRefresh: load, children: [
      PageTitle(tr('Звіт прозорості'), subtitle: tr('Як ми модеруємо: скарги, рішення, апеляції')),
      SizedBox(
        height: 36,
        child: ListView(scrollDirection: Axis.horizontal, children: [
          for (final q in maps(d['quarters'])) ...[
            SelectPill(
              label: text(q['label']) ?? '',
              selected: text(q['key']) == text(r['key']),
              onTap: () {
                quarter = text(q['key']);
                load();
              },
            ),
            const SizedBox(width: 6),
          ],
        ]),
      ),
      const SizedBox(height: 12),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CardTitle(tr('Скарги'), icon: LucideIcons.flag),
          _row(tr('Усього'), reports['total']),
          _row(tr('Вирішено'), reports['resolved']),
          _row(tr('Відхилено'), reports['dismissed']),
          _row(tr('На розгляді'), reports['pending']),
        ]),
      ),
      const SizedBox(height: 10),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CardTitle(tr('Дії модерації'), icon: LucideIcons.shieldCheck),
          _row(tr('Попередження'), actions['strikes']),
          _row(tr('Блокування'), actions['bans']),
          _row(tr('Блокування за IP'), actions['ip_bans']),
          _row(tr('Приховано коментарів'), actions['comments_hidden']),
          _row(tr('Повернуто коментарів'), actions['comments_restored']),
        ]),
      ),
      const SizedBox(height: 10),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CardTitle(tr('Апеляції'), icon: LucideIcons.scale),
          _row(tr('Усього'), appeals['total']),
          _row(tr('Задоволено'), appeals['accepted']),
          _row(tr('Відхилено'), appeals['rejected']),
          _row(tr('Медіана відповіді, год'), appeals['median_hours']),
        ]),
      ),
    ]);
  }
}

// ───────────────────────── Імпорт бібліотеки Steam ─────────────────────────

class SteamImportScreen extends StatefulWidget {
  const SteamImportScreen({super.key});

  @override
  State<SteamImportScreen> createState() => _SteamImportScreenState();
}

class _SteamImportScreenState extends _SiteScreenState<SteamImportScreen> {
  final picked = <String>{};
  bool seeded = false;

  @override
  String get path => '/games/steam-import';

  @override
  Widget content(Map<String, dynamic> d) {
    final matched = maps(d['matched']);
    if (!seeded) {
      seeded = true;
      picked.addAll([for (final g in matched) if (g['current'] == null) text(g['slug']) ?? '']);
    }
    if (d['connected'] != true) {
      return ScreenScroll(onRefresh: load, children: [
        EmptyState(
          icon: LucideIcons.gamepad2,
          title: tr('Підключіть Steam'),
          text: tr('Прив’яжіть Steam у налаштуваннях підключень, і ми знайдемо ваші ігри в каталозі.'),
          action: tr('Підключення'),
          onAction: () => context.push('/settings/connections'),
        ),
      ]);
    }
    return ScreenScroll(onRefresh: load, children: [
      PageTitle(tr('Імпорт зі Steam'), subtitle: tr('Знайдено в каталозі: {n} з {total}', {'n': matched.length, 'total': intOf(d['total'])})),
      for (final g in matched) ...[
        Glass(
          padding: const EdgeInsets.all(10),
          child: Row(children: [
            NetImage(text(g['cover']), width: 72, height: 34, radius: 6),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(text(g['name']) ?? '', style: body(13.5, weight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                Text(g['current'] != null ? tr('Уже в беклозі') : tr('{n} год', {'n': intOf(g['hours'])}), style: body(11.5, color: muted)),
              ]),
            ),
            Checkbox(
              value: picked.contains(text(g['slug'])),
              onChanged: g['current'] != null ? null : (v) => setState(() => v == true ? picked.add(text(g['slug'])!) : picked.remove(text(g['slug']))),
            ),
          ]),
        ),
        const SizedBox(height: 6),
      ],
      const SizedBox(height: 10),
      PrimaryButton(
        label: tr('Додати в беклог: {n}', {'n': picked.length}),
        icon: LucideIcons.download,
        busy: busy == 'import',
        onPressed: picked.isEmpty ? null : () => run('import', () => api.post(Api.site('/games/steam-import'), {'games': picked.toList()})),
      ),
    ]);
  }
}

// ───────────────────────── Імпорт списків аніме ─────────────────────────

class AnimeImportScreen extends StatefulWidget {
  const AnimeImportScreen({super.key});

  @override
  State<AnimeImportScreen> createState() => _AnimeImportScreenState();
}

class _AnimeImportScreenState extends State<AnimeImportScreen> {
  final nickname = TextEditingController();
  String source = 'shikimori';
  Map<String, dynamic>? preview;
  final picked = <int>{};
  bool busy = false;

  Api get api => AppScope.read(context).session.api;

  @override
  void dispose() {
    nickname.dispose();
    super.dispose();
  }

  Future<void> _preview() async {
    setState(() => busy = true);
    try {
      Map<String, dynamic> result;
      if (source == 'shikimori') {
        result = await api.post(Api.site('/cinema/import/preview'), {'source': 'shikimori', 'nickname': nickname.text.trim()});
      } else {
        final file = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: source == 'mal' ? ['xml', 'gz'] : ['csv']);
        final path = file?.files.single.path;
        if (path == null) {
          setState(() => busy = false);
          return;
        }
        result = await api.upload(Api.site('/cinema/import/preview'), {'source': source}, [await http.MultipartFile.fromPath('file', path)]);
      }
      final p = mapOf(result['preview']);
      setState(() {
        preview = p;
        picked
          ..clear()
          ..addAll([for (final m in maps(p['matched'])) if (m['current'] == null) intOf(m['movie_id'])]);
      });
    } catch (e) {
      if (mounted) toast(context, e, kind: ToastKind.error);
    }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final p = preview;
    final matched = p == null ? const <Map<String, dynamic>>[] : maps(p['matched']);
    final missing = p == null ? const <dynamic>[] : (p['missing'] is List ? p['missing'] as List : const []);
    return ScreenScroll(children: [
      PageTitle(tr('Імпорт списків аніме'), subtitle: tr('Shikimori, MyAnimeList або закладки Anixart')),
      Segmented(
        selected: source,
        options: [
          SegmentOption('shikimori', tr('Shikimori')),
          SegmentOption('mal', tr('MyAnimeList')),
          SegmentOption('anixart', tr('Anixart')),
        ],
        onSelect: (v) => setState(() => (source = v, preview = null)),
      ),
      const SizedBox(height: 12),
      if (source == 'shikimori') ...[
        GcField(controller: nickname, label: tr('Нікнейм на Shikimori'), icon: LucideIcons.user),
        const SizedBox(height: 10),
      ] else
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Text(source == 'mal' ? tr('Файл експорту MyAnimeList (XML).') : tr('Файл експорту закладок Anixart (CSV).'), style: body(12.5, color: muted)),
        ),
      PrimaryButton(label: source == 'shikimori' ? tr('Знайти список') : tr('Обрати файл'), icon: LucideIcons.search, busy: busy, onPressed: _preview),
      if (p != null) ...[
        const SizedBox(height: 16),
        SectionLabel(tr('Знайдено в каталозі: {n} з {total}', {'n': matched.length, 'total': intOf(p['total'])})),
        for (final m in matched)
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            value: picked.contains(intOf(m['movie_id'])),
            onChanged: m['current'] != null ? null : (v) => setState(() => v == true ? picked.add(intOf(m['movie_id'])) : picked.remove(intOf(m['movie_id']))),
            title: Text(text(m['title']) ?? '', style: body(13.5, weight: FontWeight.w600)),
            subtitle: Text(m['current'] != null ? tr('Уже у ваших списках') : (text(m['status']) ?? ''), style: body(11.5, color: muted)),
          ),
        const SizedBox(height: 8),
        PrimaryButton(
          label: tr('Додати в списки: {n}', {'n': picked.length}),
          icon: LucideIcons.listPlus,
          onPressed: picked.isEmpty
              ? null
              : () async {
                  final ok = await attempt(context, () => api.post(Api.site('/cinema/import'), {'movies': picked.toList()}));
                  if (ok && context.mounted) context.go('/cinema');
                },
        ),
        if (missing.isNotEmpty) ...[
          const SizedBox(height: 10),
          GhostButton(
            label: tr('Попросити додати відсутні: {n}', {'n': missing.length}),
            icon: LucideIcons.send,
            onPressed: () => attempt(context, () => api.post(Api.site('/cinema/import/requests'), {'titles': [for (final t in missing.take(40)) '$t']})),
          ),
        ],
      ],
    ]);
  }
}
