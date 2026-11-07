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

String? _ratingLabel(dynamic value) {
  final rating = value is num ? value.toDouble() : double.tryParse('$value');
  if (rating == null || rating <= 0) return null;
  return rating.toStringAsFixed(rating >= 10 ? 0 : 1);
}

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
    final byType = maps(data['byType']).where((g) => maps(g['movies']).isNotEmpty).toList();
    final types = maps(data['types']);
    final typeCounts = mapOf(data['typeCounts']);
    final genres = maps(data['genres']);
    final years = [for (final y in (data['years'] as List? ?? const [])) intOf(y)];
    final filtered = data['filtered'] == true;
    final total = typeCounts.values.fold<int>(0, (sum, v) => sum + intOf(v));
    final wide = MediaQuery.sizeOf(context).width >= 900;

    final main = <Widget>[
      const CinemaNav(active: 'home'),
      const SizedBox(height: 12),
      if (!filtered && featured.isNotEmpty) ...[CinemaHero(movies: featured), const SizedBox(height: 14)],
      if (!filtered && continueRow != null) ...[
        Row(children: [
          Expanded(child: Text(tr('Продовжити перегляд'), style: display(18))),
          GestureDetector(onTap: () => context.push('/cinema/my?status=history'), child: Text(tr('Усі'), style: body(13, color: primary, weight: FontWeight.w600))),
        ]),
        const SizedBox(height: 10),
        ContinueCards(movies: maps(continueRow['movies'])),
        const SizedBox(height: 14),
      ],
      if (!filtered && byType.isNotEmpty) ...[TypeCarousel(groups: byType), const SizedBox(height: 14)],
      Segmented(
        scroll: true,
        options: [
          SegmentOption('', tr('Усе'), count: total),
          for (final t in types)
            if (intOf(typeCounts['${t['key']}']) > 0) SegmentOption('${t['key']}', '${t['label']}', count: typeCounts['${t['key']}']),
        ],
        selected: type ?? '',
        onSelect: (value) => _set(() => type = value.isEmpty ? null : value),
      ),
      const SizedBox(height: 10),
      Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
        if ((query ?? '').isNotEmpty) GestureDetector(onTap: () => _set(() => query = null), child: Pill(label: '«$query» ×', color: primary)),
        GcSelect<String>(
          value: genre ?? '',
          items: [('', tr('Усі жанри')), for (final g in genres) ('${g['name']}', '${g['name']}')],
          onChanged: (value) => _set(() => genre = (value ?? '').isEmpty ? null : value),
        ),
        GcSelect<int>(
          value: year ?? 0,
          items: [(0, tr('Будь-який рік')), for (final y in years) (y, '$y')],
          onChanged: (value) => _set(() => year = value == 0 ? null : value),
        ),
        GcSelect<String>(
          value: release ?? '',
          items: [('', tr('Будь-який статус')), for (final e in releaseLabels.entries) (e.key, tr(e.value))],
          onChanged: (value) => _set(() => release = (value ?? '').isEmpty ? null : value),
        ),
      ]),
      const SizedBox(height: 14),
      Glass(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Expanded(child: Text(filtered ? tr('Знайдено: {v}', {'v': data['total'] ?? movies.length}) : tr('Каталог'), style: display(18))),
            RoundIcon(icon: list ? LucideIcons.layoutGrid : LucideIcons.list, tooltip: list ? tr('Сіткою') : tr('Списком'), onTap: () => setState(() => list = !list)),
          ]),
          const SizedBox(height: 8),
          Segmented(
            scroll: true,
            options: [for (final s in _sorts) SegmentOption(s.$1, s.$2)],
            selected: sort,
            onSelect: (value) => _set(() => sort = value),
          ),
          const SizedBox(height: 14),
          if (loading && movies.isEmpty)
            const ListSkeleton(rows: 5)
          else if (movies.isEmpty)
            EmptyState(icon: LucideIcons.clapperboard, title: tr('Нічого не знайдено'), text: tr('Спробуйте змінити фільтри або запит.'))
          else if (list)
            for (final m in movies) Padding(padding: const EdgeInsets.only(bottom: 16), child: MovieDetailRow(movie: m))
          else
            PosterGrid(movies: movies),
          if (movies.isNotEmpty) LoadMore(more: more && !loading, onMore: _load),
        ]),
      ),
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
          footer ?? [_ratingLabel(movie['rating']) == null ? null : '★ ${_ratingLabel(movie['rating'])}', movie['year'], text(movie['type_label'])].whereType<Object>().join(' · '),
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
        return ScreenScroll(
          onRefresh: reload,
          children: [
            const CinemaNav(active: 'schedule'),
            const SizedBox(height: 12),
            Glass(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text(tr('Розклад нових серій на тиждень'), style: display(17)),
                UnderlineTabs(
                  tabs: [for (var d = 1; d <= 7; d++) ('$d', d == today ? tr('Сьогодні') : _days[d - 1])],
                  active: '$active',
                  onSelect: (k) => setState(() => day = int.parse(k)),
                ),
                const SizedBox(height: 14),
                if (movies.isEmpty)
                  EmptyState(icon: LucideIcons.calendarDays, title: tr('Цього дня нових серій немає'), text: tr('Тут з’являться серіали й аніме, у яких зараз виходять нові серії.'))
                else
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 160, mainAxisSpacing: 14, crossAxisSpacing: 10, childAspectRatio: 0.56),
                    itemCount: movies.length,
                    itemBuilder: (_, i) {
                      final m = movies[i];
                      final at = DateTime.tryParse('${m['last_at']}')?.toLocal();
                      return GestureDetector(
                        onTap: () => context.push('/cinema/${m['slug']}'),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          AspectRatio(
                            aspectRatio: 2 / 3,
                            child: Stack(fit: StackFit.expand, children: [
                              BadgedPoster(movie: {...m, 'age_rating': null}, small: true),
                              if (at != null)
                                Positioned(
                                  left: 6,
                                  bottom: 6,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                    decoration: BoxDecoration(color: primary, borderRadius: BorderRadius.circular(7)),
                                    child: Text('${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}', style: body(10.5, color: Colors.white, weight: FontWeight.w800)),
                                  ),
                                ),
                            ]),
                          ),
                          const SizedBox(height: 6),
                          Text(text(m['title']) ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(12.5, weight: FontWeight.w700)),
                        ]),
                      );
                    },
                  ),
              ]),
            ),
          ],
        );
      },
    );
  }
}
