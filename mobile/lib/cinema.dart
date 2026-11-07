import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'cinema_ui.dart';
import 'feed.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';
import 'i18n.dart';
import 'skeletons.dart';

final _sorts = [('updated', tr('Нещодавно оновлені')), ('new', tr('Нові на сайті')), ('popular', tr('Популярні')), ('rating', tr('За рейтингом'))];

// ───────────────────────── Каталог ─────────────────────────

class CinemaScreen extends StatefulWidget {
  const CinemaScreen({this.query, super.key});
  /// Запит із загального пошуку застосунку («…» у кіно).
  final String? query;

  @override
  State<CinemaScreen> createState() => _CinemaScreenState();
}

class _CinemaScreenState extends State<CinemaScreen> {
  Map<String, dynamic>? page;
  final movies = <Map<String, dynamic>>[];
  late String? query = widget.query;
  String? type;
  String? genre;
  int? year;
  String? release;
  String sort = 'new';
  bool list = false;
  int current = 0;
  bool more = false;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load(reset: true));
  }

  Future<void> _load({bool reset = false}) async {
    final api = AppScope.read(context).session.api;
    if (reset) {
      setState(() => loading = true);
      current = 0;
    }
    final params = Uri(queryParameters: {
      'type': ?type,
      'genre': ?genre,
      if (year != null) 'year': '$year',
      'release': ?release,
      'sort': sort,
      if ((query ?? '').trim().isNotEmpty) 'q': query!.trim(),
      'page': '${current + 1}',
    }).query;
    try {
      final data = await api.get(Api.site('/cinema?$params'));
      final listing = Listing.parse(data['movies']);
      if (!mounted) return;
      setState(() {
        page = data;
        if (reset) movies.clear();
        movies.addAll(listing.items);
        current = listing.current;
        more = listing.more;
      });
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  void _set(VoidCallback change) {
    setState(change);
    _load(reset: true);
  }

  @override
  Widget build(BuildContext context) {
    final data = page;
    if (data == null) return const ScreenSkeleton();
    final featured = maps(data['featured']);
    final rows = maps(data['rows']);
    final continueRow = rows.where((r) => r['key'] == 'continue' && maps(r['movies']).isNotEmpty).firstOrNull;
    final types = maps(data['types']);
    final typeCounts = mapOf(data['typeCounts']);
    final genres = maps(data['genres']);
    final years = [for (final y in (data['years'] as List? ?? const [])) intOf(y)];
    final filtered = data['filtered'] == true;
    final wide = MediaQuery.sizeOf(context).width >= 900;

    final top = maps(rows.where((r) => r['key'] == 'top').firstOrNull?['movies']);
    final popular = maps(rows.where((r) => r['key'] == 'popular').firstOrNull?['movies']);
    final later = maps(rows.where((r) => r['key'] == 'later').firstOrNull?['movies']);
    final typeLabel = {for (final t in types) '${t['key']}': '${t['label']}'};
    final active = [
      if (sort != 'new') (_sorts.firstWhere((s) => s.$1 == sort, orElse: () => _sorts.first).$2, () => _set(() => sort = 'new')),
      if (type != null) (typeLabel[type] ?? type!, () => _set(() => type = null)),
      if (release != null) (releaseLabel(release) ?? release!, () => _set(() => release = null)),
      if (genre != null) (genre!, () => _set(() => genre = null)),
      if (year != null) ('$year', () => _set(() => year = null)),
      if ((query ?? '').isNotEmpty) ('«$query»', () => _set(() => query = null)),
    ];

    final main = <Widget>[
      // Animax: великий банер на всю ширину, далі навігація, пошук із фільтром і стрічки.
      if (!filtered && featured.isNotEmpty) ...[CinemaBleed(height: 460, child: CinemaHero(movies: featured)), const SizedBox(height: 16)],
      const CinemaNav(active: 'home'),
      const SizedBox(height: 14),
      CinemaSearchBar(
        initial: query ?? '',
        filterActive: sort != 'new' || type != null || release != null || genre != null || year != null,
        onSubmit: (v) => _set(() => query = v.trim().isEmpty ? null : v.trim()),
        onFilter: () async {
          final picked = await showCinemaFilter(
            context,
            current: CinemaFilter(sort: sort, type: type, release: release, genre: genre, year: year),
            sorts: _sorts,
            types: [for (final t in types) if (intOf(typeCounts['${t['key']}']) > 0) t],
            genres: genres,
            years: years,
          );
          if (picked != null) {
            _set(() {
              sort = picked.sort;
              type = picked.type;
              release = picked.release;
              genre = picked.genre;
              year = picked.year;
            });
          }
        },
      ),
      if (active.isNotEmpty) ...[
        const SizedBox(height: 12),
        SizedBox(
          height: 38,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: active.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (_, i) => GestureDetector(
              onTap: active[i].$2,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                alignment: Alignment.center,
                decoration: BoxDecoration(color: cinemaAccent, borderRadius: BorderRadius.circular(100)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(active[i].$1, style: body(13.5, color: Colors.white, weight: FontWeight.w600)),
                  const SizedBox(width: 6),
                  const Icon(LucideIcons.x, size: 14, color: Colors.white),
                ]),
              ),
            ),
          ),
        ),
      ],
      const SizedBox(height: 18),
      if (!filtered && continueRow != null) ...[
        CinemaSectionTitle(tr('Продовжити перегляд'), onAll: () => context.push('/cinema/my?status=history')),
        ContinueCards(movies: maps(continueRow['movies'])),
        const SizedBox(height: 20),
      ],
      if (!filtered && top.isNotEmpty) ...[
        CinemaSectionTitle(tr('Топ за рейтингом'), onAll: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => CinemaTopScreen(title: tr('Топ за рейтингом'), movies: top)))),
        AnimaxRow(movies: top.take(10).toList(), ranked: true),
        const SizedBox(height: 20),
      ],
      if (!filtered && popular.isNotEmpty) ...[
        CinemaSectionTitle(tr('Популярне зараз'), onAll: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => CinemaTopScreen(title: tr('Популярне зараз'), movies: popular, grid: true)))),
        AnimaxRow(movies: popular, episodes: true),
        const SizedBox(height: 20),
      ],
      if (!filtered && later.isNotEmpty) ...[
        CinemaSectionTitle(tr('Буду дивитися'), onAll: () => context.push('/cinema/my?status=planned')),
        AnimaxRow(movies: later),
        const SizedBox(height: 20),
      ],
      Row(children: [
        Expanded(child: Text(filtered ? tr('Знайдено: {v}', {'v': data['total'] ?? movies.length}) : tr('Каталог'), style: display(18))),
        RoundIcon(icon: list ? LucideIcons.layoutGrid : LucideIcons.list, tooltip: list ? tr('Сіткою') : tr('Списком'), onTap: () => setState(() => list = !list)),
      ]),
      const SizedBox(height: 12),
      if (loading && movies.isEmpty)
        const ListSkeleton(rows: 5)
      else if (movies.isEmpty)
        EmptyState(icon: LucideIcons.clapperboard, title: tr('Нічого не знайдено'), text: tr('Спробуйте змінити фільтри або запит.'))
      else if (list)
        for (final m in movies) Padding(padding: const EdgeInsets.only(bottom: 16), child: MovieDetailRow(movie: m))
      else
        AnimaxGrid(movies: movies),
      if (movies.isNotEmpty) LoadMore(more: more && !loading, onMore: _load),
      if (!wide) ...[const SizedBox(height: 14), const CinemaSideWidgets()],
    ];

    if (!wide) return ScreenScroll(onRefresh: () => _load(reset: true), children: main);
    // Планшет / широкий екран: віджети — колонкою праворуч, як бічна колонка сайту.
    return ScreenScroll(
      onRefresh: () => _load(reset: true),
      children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: main)),
          const SizedBox(width: 16),
          const SizedBox(width: 300, child: CinemaSideWidgets()),
        ]),
      ],
    );
  }
}

/// «Усі» зі стрічки (Animax «Top Hits»): рядок — постер з номером, назва, рік і країна,
/// жанри й «+ Мій список»; або сітка 2 колонки.
class CinemaTopScreen extends StatefulWidget {
  const CinemaTopScreen({required this.title, required this.movies, this.grid = false, super.key});
  final String title;
  final List<Map<String, dynamic>> movies;
  final bool grid;

  @override
  State<CinemaTopScreen> createState() => _CinemaTopScreenState();
}

class _CinemaTopScreenState extends State<CinemaTopScreen> {
  final added = <Object?>{};

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: abyss,
      appBar: AppBar(
        backgroundColor: abyss,
        surfaceTintColor: Colors.transparent,
        title: Text(widget.title, style: display(20)),
        leading: IconButton(icon: const Icon(LucideIcons.arrowLeft), onPressed: () => Navigator.pop(context)),
      ),
      body: widget.grid
          ? ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 24), children: [AnimaxGrid(movies: widget.movies)])
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              itemCount: widget.movies.length,
              separatorBuilder: (_, _) => const SizedBox(height: 16),
              itemBuilder: (_, i) {
                final m = widget.movies[i];
                final place = [m['year'], ...((m['countries'] as List?) ?? const []).take(1)].whereType<Object>().join(' | ');
                final genres = ((m['genres'] as List?) ?? const []).join(', ');
                return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  SizedBox(width: 130, height: 175, child: AnimaxPoster(movie: m, rank: i + 1)),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const SizedBox(height: 8),
                      GestureDetector(onTap: () => context.push('/cinema/${m['slug']}'), child: Text(text(m['title']) ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: display(17))),
                      if (place.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text(place, style: body(13, color: soft))),
                      if (genres.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text('${tr('Жанр')}: $genres', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(12, color: muted))),
                      const SizedBox(height: 12),
                      AnimaxListButton(
                        added: added.contains(m['id']),
                        onTap: () async {
                          if (added.contains(m['id'])) return;
                          if (await addToCinemaList(context, m) && mounted) setState(() => added.add(m['id']));
                        },
                      ),
                    ]),
                  ),
                ]);
              },
            ),
    );
  }
}

class PosterCard extends StatelessWidget {
  const PosterCard({required this.movie, this.footer, super.key});
  final Map<String, dynamic> movie;
  final String? footer;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/cinema/${movie['slug']}'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        AspectRatio(aspectRatio: 2 / 3, child: BadgedPoster(movie: movie, small: true)),
        const SizedBox(height: 6),
        Text(text(movie['title']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(13, weight: FontWeight.w700)),
        Text(
          footer ?? [movie['year'], text(movie['type_label'])].whereType<Object>().join(' · '),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: body(11.5, color: muted),
        ),
      ]),
    );
  }
}

class PosterGrid extends StatelessWidget {
  const PosterGrid({required this.movies, this.footer, super.key});
  final List<Map<String, dynamic>> movies;
  final String? Function(Map<String, dynamic> movie)? footer;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, mainAxisSpacing: 14, crossAxisSpacing: 10, childAspectRatio: 0.52),
      itemCount: movies.length,
      itemBuilder: (_, i) => PosterCard(movie: movies[i], footer: footer?.call(movies[i])),
    );
  }
}

// ───────────────────────── Мої списки ─────────────────────────

class MyCinemaScreen extends StatefulWidget {
  const MyCinemaScreen({this.status = 'all', super.key});
  final String status;

  @override
  State<MyCinemaScreen> createState() => _MyCinemaScreenState();
}

class _MyCinemaScreenState extends State<MyCinemaScreen> {
  late String status = widget.status;
  Map<String, dynamic>? page;
  final movies = <Map<String, dynamic>>[];
  int current = 0;
  bool more = false;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load(reset: true));
  }

  Future<void> _load({bool reset = false}) async {
    final api = AppScope.read(context).session.api;
    if (reset) {
      setState(() => loading = true);
      current = 0;
    }
    try {
      final data = await api.get(Api.site('/cinema/my?status=$status&page=${current + 1}'));
      final listing = Listing.parse(data['movies']);
      if (!mounted) return;
      setState(() {
        page = data;
        if (reset) movies.clear();
        movies.addAll(listing.items);
        current = listing.current;
        more = listing.more;
      });
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final counts = mapOf(page?['counts']);
    final statuses = maps(page?['statuses']);
    final labels = {for (final s in statuses) '${s['key']}': '${s['label']}'};
    return ScreenScroll(
      onRefresh: () => _load(reset: true),
      children: [
        const CinemaNav(active: 'my'),
        const SizedBox(height: 12),
        Segmented(
          scroll: true,
          options: [
            SegmentOption('lists', tr('Колекції'), icon: LucideIcons.listVideo),
            SegmentOption('history', tr('Історія'), icon: LucideIcons.history),
            SegmentOption('saved', tr('Обране'), icon: LucideIcons.bookmark),
            for (final s in statuses) SegmentOption('${s['key']}', '${s['label']}', count: counts['${s['key']}']),
            SegmentOption('all', tr('Усі'), count: counts['all']),
            SegmentOption('rated', tr('Оцінені'), count: counts['rated']),
          ],
          selected: status,
          onSelect: (value) {
            setState(() => status = value);
            _load(reset: true);
          },
        ),
        const SizedBox(height: 12),
        if (status == 'lists' && maps(page?['lists']).isNotEmpty)
          for (final list in maps(page?['lists']))
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GestureDetector(
                onTap: () => context.push('/cinema/lists/${list['id']}'),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: SizedBox(
                    height: 120,
                    child: Stack(fit: StackFit.expand, children: [
                      NetImage(text((list['posters'] as List?)?.firstOrNull)),
                      const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x22000000), Color(0xD9000000)]))),
                      Positioned(
                        left: 14,
                        right: 14,
                        bottom: 12,
                        child: Row(children: [
                          Expanded(child: Text(text(list['title']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(16, color: Colors.white, weight: FontWeight.w700))),
                          Pill(label: '${list['items_count'] ?? 0}', icon: LucideIcons.film, color: Colors.white),
                        ]),
                      ),
                    ]),
                  ),
                ),
              ),
            )
        else if (status == 'lists')
          EmptyState(icon: LucideIcons.listVideo, title: tr('Колекцій ще немає'), text: tr('Збирайте фільми в добірки на сторінці тайтлу.'), action: tr('До каталогу'), onAction: () => context.go('/cinema'))
        else if (loading && movies.isEmpty)
          const ListSkeleton(rows: 5)
        else if (status == 'history' && movies.isNotEmpty) ...[
          for (final m in movies) Padding(padding: const EdgeInsets.only(bottom: 14), child: MovieDetailRow(movie: m)),
          LoadMore(more: more && !loading, onMore: _load),
        ] else if (movies.isEmpty)
          EmptyState(icon: LucideIcons.bookmark, title: tr('Список порожній'), text: tr('Позначайте фільми статусами «В планах», «Дивлюся» тощо — вони з’являться тут.'), action: tr('До каталогу'), onAction: () => context.go('/cinema'))
        else ...[
          PosterGrid(
            movies: movies,
            footer: (m) => [labels[m['my_status']], if (m['my_rating'] != null) '★ ${m['my_rating']}'].whereType<String>().join(' · '),
          ),
          LoadMore(more: more && !loading, onMore: _load),
        ],
      ],
    );
  }
}

// ───────────────────────── Фільм ─────────────────────────

// ───────────────────────── Огляд і розклад ─────────────────────────

/// Огляд: рекомендації, обговорюване, «зараз дивляться», колекції, коментарі — як на сайті.
class CinemaOverviewScreen extends StatelessWidget {
  const CinemaOverviewScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Remote(
      load: () => AppScope.read(context).session.api.get(Api.site('/cinema/overview')),
      builder: (data, reload) {
        final featured = maps(data['featured']);
        final recommended = maps(data['recommended']);
        final watching = maps(data['watchingNow']);
        final discussed = maps(data['discussed']);
        final collections = maps(data['collections']);
        Widget row(String title, List<Map<String, dynamic>> items) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              SectionLabel(title),
              SizedBox(
                height: 250,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 10),
                  itemBuilder: (_, i) => SizedBox(width: 132, child: PosterCard(movie: items[i])),
                ),
              ),
            ]);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            const CinemaNav(active: 'overview'),
            const SizedBox(height: 12),
            if (featured.isNotEmpty) CinemaHero(movies: featured),
            if (recommended.isNotEmpty) row(tr('Рекомендації для вас'), recommended),
            if (discussed.isNotEmpty) row(tr('Обговорюють'), discussed),
            if (watching.isNotEmpty) row(tr('Зараз дивляться'), watching),
            if (collections.isNotEmpty) ...[
              SectionLabel(tr('Колекції'), trailing: tr('Усі'), onTrailing: () => context.push('/cinema/lists')),
              for (final list in collections)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: GestureDetector(
                    onTap: () => context.push('/cinema/lists/${list['id']}'),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(18),
                      child: SizedBox(
                        height: 110,
                        child: Stack(fit: StackFit.expand, children: [
                          NetImage(text((list['posters'] as List?)?.firstOrNull)),
                          const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x22000000), Color(0xD9000000)]))),
                          Positioned(
                            left: 14,
                            right: 14,
                            bottom: 12,
                            child: Row(children: [
                              Expanded(child: Text(text(list['title']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(16, color: Colors.white, weight: FontWeight.w700))),
                              Pill(label: '${list['items_count'] ?? 0}', icon: LucideIcons.film, color: Colors.white),
                            ]),
                          ),
                        ]),
                      ),
                    ),
                  ),
                ),
            ],
            const SizedBox(height: 12),
            const CinemaSideWidgets(),
          ],
        );
      },
    );
  }
}

/// Розклад: вкладки днів тижня (сьогодні — першим), постери з бейджами й часом виходу.
class CinemaScheduleScreen extends StatefulWidget {
  const CinemaScheduleScreen({super.key});

  @override
  State<CinemaScheduleScreen> createState() => _CinemaScheduleScreenState();
}

class _CinemaScheduleScreenState extends State<CinemaScheduleScreen> {
  int? day;
  final _added = <Object?>{};

  static final _days = [tr('Пн'), tr('Вт'), tr('Ср'), tr('Чт'), tr('Пт'), tr('Сб'), tr('Нд')];

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now().weekday;
    return Remote(
      load: () => AppScope.read(context).session.api.get(Api.site('/cinema/schedule')),
      builder: (data, reload) {
        final days = maps(data['days']);
        final active = day ?? (days.any((d) => intOf(d['day']) == today) ? today : (days.isEmpty ? today : intOf(days.first['day'])));
        final movies = maps(days.where((d) => intOf(d['day']) == active).firstOrNull?['movies']);
        final now = DateTime.now();
        // Дати поточного тижня (Пн–Нд) для капсул днів.
        final monday = DateTime(now.year, now.month, now.day).subtract(Duration(days: now.weekday - 1));
        final sorted = [...movies]..sort((x, y) => '${x['last_at']}'.compareTo('${y['last_at']}'));
        var currentShown = false;
        return ScreenScroll(
          onRefresh: reload,
          children: [
            const CinemaNav(active: 'schedule'),
            const SizedBox(height: 14),
            SizedBox(
              height: 72,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: 7,
                separatorBuilder: (_, _) => const SizedBox(width: 10),
                itemBuilder: (_, i) {
                  final d = i + 1;
                  final on = d == active;
                  return GestureDetector(
                    onTap: () => setState(() => day = d),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 160),
                      width: 54,
                      decoration: BoxDecoration(
                        color: on ? cinemaAccent : Colors.transparent,
                        border: Border.all(color: on ? cinemaAccent : muted.withValues(alpha: 0.5), width: 1.5),
                        borderRadius: BorderRadius.circular(100),
                      ),
                      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Text(_days[i], style: body(12, color: on ? Colors.white : muted, weight: FontWeight.w600)),
                        const SizedBox(height: 2),
                        Text('${monday.add(Duration(days: i)).day}', style: body(16, color: on ? Colors.white : (d == today ? cinemaAccent : soft), weight: FontWeight.w800)),
                      ]),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 18),
            if (movies.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 48),
                child: Column(children: [
                  Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(color: cinemaAccent.withValues(alpha: 0.14), shape: BoxShape.circle),
                    child: Icon(LucideIcons.calendarX2, size: 52, color: cinemaAccent),
                  ),
                  const SizedBox(height: 20),
                  Text(tr('Немає розкладу'), style: display(19, color: cinemaAccent)),
                  const SizedBox(height: 8),
                  Text(tr('Цього дня нових серій немає.'), textAlign: TextAlign.center, style: body(14, color: soft)),
                ]),
              )
            else
              for (final m in sorted) ...() {
                final at = DateTime.tryParse('${m['last_at']}')?.toLocal();
                final hhmm = at == null ? null : '${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}';
                // Лінія «Зараз» — перед першою серією, що виходить пізніше (лише сьогодні).
                final showNow = !currentShown && active == today && at != null && (at.hour * 60 + at.minute) > (now.hour * 60 + now.minute);
                if (showNow) currentShown = true;
                return [
                  if (showNow)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Row(children: [
                        Expanded(child: Container(height: 2, color: cinemaAccent)),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          child: Text(tr('Зараз · {t}', {'t': '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}'}), style: body(12.5, color: soft)),
                        ),
                        Expanded(child: Container(height: 2, color: cinemaAccent)),
                      ]),
                    ),
                  if (hhmm != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(children: [
                        Container(width: 12, height: 4, decoration: BoxDecoration(color: cinemaAccent, borderRadius: BorderRadius.circular(2))),
                        const SizedBox(width: 8),
                        Text(hhmm, style: body(13, weight: FontWeight.w600)),
                      ]),
                    ),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Row(children: [
                      SizedBox(
                        width: 150,
                        height: 96,
                        child: Stack(fit: StackFit.expand, children: [
                          ClipRRect(borderRadius: BorderRadius.circular(12), child: NetImage(text(m['backdrop']) ?? text(m['poster']))),
                          Center(
                            child: Container(
                              width: 30,
                              height: 30,
                              decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                              child: const Icon(LucideIcons.play, size: 15, color: Colors.black),
                            ),
                          ),
                          Positioned.fill(child: Material(color: Colors.transparent, child: InkWell(borderRadius: BorderRadius.circular(12), onTap: () => context.push('/cinema/${m['slug']}')))),
                        ]),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(text(m['title']) ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(15, weight: FontWeight.w700)),
                          if (intOf(m['episodes_count']) > 0) Padding(padding: const EdgeInsets.only(top: 6), child: Text(tr('Серій: {n}', {'n': intOf(m['episodes_count'])}), style: body(12.5, color: soft))),
                          const SizedBox(height: 10),
                          AnimaxListButton(
                            added: _added.contains(m['id']),
                            onTap: () async {
                              if (_added.contains(m['id'])) return;
                              if (await addToCinemaList(context, m) && mounted) setState(() => _added.add(m['id']));
                            },
                          ),
                        ]),
                      ),
                    ]),
                  ),
                ];
              }(),
          ],
        );
      },
    );
  }
}
