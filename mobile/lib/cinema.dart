import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'feed.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';
import 'i18n.dart';

final _sorts = [('new', tr('Нові на сайті')), ('popular', tr('Популярні')), ('rating', tr('За рейтингом')), ('year', tr('За роком'))];

String? _ratingLabel(dynamic value) {
  final rating = value is num ? value.toDouble() : double.tryParse('$value');
  if (rating == null || rating <= 0) return null;
  return rating.toStringAsFixed(rating >= 10 ? 0 : 1);
}

// ───────────────────────── Каталог ─────────────────────────

class CinemaScreen extends StatefulWidget {
  const CinemaScreen({super.key});

  @override
  State<CinemaScreen> createState() => _CinemaScreenState();
}

class _CinemaScreenState extends State<CinemaScreen> {
  Map<String, dynamic>? page;
  final movies = <Map<String, dynamic>>[];
  final query = TextEditingController();
  String? type;
  String? genre;
  int? year;
  String sort = 'new';
  int current = 0;
  bool more = false;
  bool loading = true;
  Timer? debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load(reset: true));
  }

  @override
  void dispose() {
    query.dispose();
    debounce?.cancel();
    super.dispose();
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
      'sort': sort,
      if (query.text.trim().isNotEmpty) 'q': query.text.trim(),
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

  @override
  Widget build(BuildContext context) {
    final data = page;
    if (data == null) return const Center(child: CircularProgressIndicator(strokeWidth: 2.4));
    final featured = maps(data['featured']);
    final rows = maps(data['rows']).where((row) => maps(row['movies']).isNotEmpty).toList();
    final types = maps(data['types']);
    final typeCounts = mapOf(data['typeCounts']);
    final genres = maps(data['genres']);
    final years = [for (final y in (data['years'] as List? ?? const [])) intOf(y)];
    final myCounts = mapOf(data['myCounts']);
    final filtered = data['filtered'] == true;
    final total = typeCounts.values.fold<int>(0, (sum, v) => sum + intOf(v));

    return ScreenScroll(
      onRefresh: () => _load(reset: true),
      children: [
        if (featured.isNotEmpty) ...[
          _Featured(movies: featured),
          const SizedBox(height: 12),
        ],
        Glass(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            GcField(
              controller: query,
              label: tr('Назва фільму, серіалу чи аніме'),
              icon: LucideIcons.search,
              dense: true,
              onChanged: (_) {
                debounce?.cancel();
                debounce = Timer(const Duration(milliseconds: 400), () => _load(reset: true));
              },
            ),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(
                child: GhostButton(
                  label: intOf(myCounts['all']) > 0 ? tr('Мої списки · {v}', {'v': myCounts['all']}) : tr('Мої списки'),
                  icon: LucideIcons.bookmark,
                  onPressed: () => context.push('/cinema/my'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: GhostButton(
                  label: tr('Мої десять'),
                  icon: LucideIcons.trophy,
                  onPressed: () {
                    final me = text(AppScope.read(context).session.me?['username']);
                    if (me != null) context.push('/cinema/ten/$me');
                  },
                ),
              ),
            ]),
            const SizedBox(height: 10),
            Segmented(
              scroll: true,
              options: [
                SegmentOption('', tr('Усе'), count: total),
                for (final t in types) SegmentOption('${t['key']}', '${t['label']}', count: typeCounts['${t['key']}']),
              ],
              selected: type ?? '',
              onSelect: (value) {
                setState(() => type = value.isEmpty ? null : value);
                _load(reset: true);
              },
            ),
            const SizedBox(height: 10),
            Wrap(spacing: 8, runSpacing: 8, children: [
              GcSelect<String>(
                value: genre ?? '',
                items: [('', tr('Усі жанри')), for (final g in genres) ('${g['name']}', '${g['name']}')],
                onChanged: (value) {
                  setState(() => genre = (value ?? '').isEmpty ? null : value);
                  _load(reset: true);
                },
              ),
              GcSelect<int>(
                value: year ?? 0,
                items: [(0, tr('Будь-який рік')), for (final y in years) (y, '$y')],
                onChanged: (value) {
                  setState(() => year = value == 0 ? null : value);
                  _load(reset: true);
                },
              ),
              GcSelect<String>(
                value: sort,
                items: _sorts,
                onChanged: (value) {
                  setState(() => sort = value ?? 'new');
                  _load(reset: true);
                },
              ),
            ]),
          ]),
        ),
        const SizedBox(height: 12),
        if (!filtered)
          for (final row in rows) ...[
            Glass(
              padding: const EdgeInsets.fromLTRB(14, 14, 0, 14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(
                  padding: const EdgeInsets.only(right: 14),
                  child: Row(children: [
                    if (row['key'] == 'continue') const Padding(padding: EdgeInsets.only(right: 6), child: Icon(LucideIcons.play, color: Color(0xFF9AA6FF))),
                    Expanded(child: Text('${row['title']}', style: display(17))),
                    if (row['key'] == 'continue') GestureDetector(onTap: () => context.push('/cinema/my?status=watching'), child: Text(tr('Усі'), style: body(13, color: primary, weight: FontWeight.w600))),
                  ]),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 250,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: maps(row['movies']).length,
                    separatorBuilder: (_, _) => const SizedBox(width: 10),
                    itemBuilder: (_, i) => SizedBox(width: 132, child: PosterCard(movie: maps(row['movies'])[i])),
                  ),
                ),
              ]),
            ),
            const SizedBox(height: 12),
          ],
        if (filtered) Padding(padding: const EdgeInsets.only(left: 4, bottom: 10), child: Text(tr('Знайдено: {v}', {'v': data['total'] ?? movies.length}), style: body(13, color: muted))),
        if (filtered || rows.isEmpty) ...[
          if (filtered) const SizedBox.shrink() else SectionLabel(tr('Каталог')),
          if (loading && movies.isEmpty)
            const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator(strokeWidth: 2)))
          else if (movies.isEmpty)
            EmptyState(icon: LucideIcons.clapperboard, title: tr('Нічого не знайдено'), text: tr('Спробуйте змінити фільтри або запит.'))
          else ...[
            PosterGrid(movies: movies),
            LoadMore(more: more && !loading, onMore: _load),
          ],
        ] else ...[
          SectionLabel(tr('Увесь каталог')),
          PosterGrid(movies: movies),
          LoadMore(more: more && !loading, onMore: _load),
        ],
      ],
    );
  }
}

class _Featured extends StatefulWidget {
  const _Featured({required this.movies});
  final List<Map<String, dynamic>> movies;

  @override
  State<_Featured> createState() => _FeaturedState();
}

class _FeaturedState extends State<_Featured> {
  final controller = PageController();
  int index = 0;

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 420,
      child: Stack(children: [
        PageView.builder(
          controller: controller,
          itemCount: widget.movies.length,
          onPageChanged: (value) => setState(() => index = value),
          itemBuilder: (_, i) {
            final movie = widget.movies[i];
            final rating = _ratingLabel(movie['rating']);
            return Glass(
              padding: EdgeInsets.zero,
              radius: 26,
              child: Stack(children: [
                Positioned.fill(child: ClipRRect(borderRadius: BorderRadius.circular(26), child: NetImage(text(movie['backdrop']) ?? text(movie['poster'])))),
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(26),
                      gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x33050712), Color(0xE6050712), Color(0xFF050712)], stops: [0, 0.55, 1]),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Pill(label: tr('РЕКОМЕНДУЄМО'), icon: LucideIcons.sparkles, color: gold),
                    const Spacer(),
                    Text(text(movie['title']) ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: display(26)),
                    if (text(movie['title_original']) != null) Text(text(movie['title_original'])!, style: body(13, color: muted)),
                    const SizedBox(height: 8),
                    Wrap(spacing: 8, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                      if (rating != null) _RatingBadge(rating),
                      if (movie['year'] != null) Text('${movie['year']}', style: body(12.5, color: soft)),
                      if (text(movie['type_label']) != null) Text(text(movie['type_label'])!, style: body(12.5, color: soft)),
                      if (intOf(movie['duration']) > 0) Text(tr('{v} хв', {'v': movie['duration']}), style: body(12.5, color: soft)),
                      if (text(movie['age_rating']) != null) Pill(label: text(movie['age_rating'])!),
                    ]),
                    if ((movie['genres'] as List?)?.isNotEmpty == true) Padding(padding: const EdgeInsets.only(top: 6), child: Text((movie['genres'] as List).join(' · '), style: body(12, color: muted))),
                    if (text(movie['description']) != null)
                      Padding(padding: const EdgeInsets.only(top: 8), child: Text(text(movie['description'])!, maxLines: 3, overflow: TextOverflow.ellipsis, style: body(13.5, color: soft).copyWith(height: 1.4))),
                    const SizedBox(height: 14),
                    Row(children: [
                      Expanded(child: PrimaryButton(label: tr('Дивитися'), icon: LucideIcons.play, onPressed: () => context.push('/cinema/${movie['slug']}'))),
                      const SizedBox(width: 10),
                      Expanded(child: GhostButton(label: tr('Детальніше'), icon: LucideIcons.info, onPressed: () => context.push('/cinema/${movie['slug']}'))),
                    ]),
                  ]),
                ),
              ]),
            );
          },
        ),
        if (widget.movies.length > 1)
          Positioned(
            top: 22,
            right: 20,
            child: Row(children: [
              for (var i = 0; i < widget.movies.length; i++)
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.only(left: 4),
                  width: i == index ? 18 : 6,
                  height: 6,
                  decoration: BoxDecoration(color: i == index ? Colors.white : fg.withValues(alpha: 0.38), borderRadius: BorderRadius.circular(4)),
                ),
            ]),
          ),
      ]),
    );
  }
}

class _RatingBadge extends StatelessWidget {
  const _RatingBadge(this.value);
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(color: const Color(0xFF16A34A), borderRadius: BorderRadius.circular(8)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        const Icon(LucideIcons.star, size: 12, color: Colors.white),
        const SizedBox(width: 2),
        Text(value, style: body(11.5, weight: FontWeight.w700)),
      ]),
    );
  }
}

class PosterCard extends StatelessWidget {
  const PosterCard({required this.movie, this.footer, super.key});
  final Map<String, dynamic> movie;
  final String? footer;

  @override
  Widget build(BuildContext context) {
    final rating = _ratingLabel(movie['rating']);
    return GestureDetector(
      onTap: () => context.push('/cinema/${movie['slug']}'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        AspectRatio(
          aspectRatio: 2 / 3,
          child: Stack(children: [
            Positioned.fill(
              child: text(movie['poster']) != null
                  ? NetImage(text(movie['poster']), radius: 14)
                  : CoverPlaceholder(seed: movie['id'] ?? 0, icon: LucideIcons.film, radius: 14, iconSize: 30),
            ),
            if (rating != null) Positioned(left: 6, top: 6, child: _RatingBadge(rating)),
            if (text(movie['age_rating']) != null)
              Positioned(
                right: 6,
                top: 6,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(8)),
                  child: Text(text(movie['age_rating'])!, style: body(11, weight: FontWeight.w700)),
                ),
              ),
          ]),
        ),
        const SizedBox(height: 6),
        Text(text(movie['title']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(13, weight: FontWeight.w700)),
        Text(
          footer ?? [movie['year'], text(movie['type_label']), ...((movie['genres'] as List?) ?? const []).take(1)].whereType<Object>().join(' · '),
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
        Row(children: [
          RoundIcon(icon: LucideIcons.arrowLeft, onTap: () => context.pop()),
          const SizedBox(width: 8),
          Text(tr('Мої списки'), style: display(19)),
        ]),
        const SizedBox(height: 12),
        Segmented(
          scroll: true,
          options: [
            SegmentOption('all', tr('Усі'), count: counts['all']),
            for (final s in statuses) SegmentOption('${s['key']}', '${s['label']}', count: counts['${s['key']}']),
            SegmentOption('rated', tr('Оцінені'), count: counts['rated']),
          ],
          selected: status,
          onSelect: (value) {
            setState(() => status = value);
            _load(reset: true);
          },
        ),
        const SizedBox(height: 12),
        if (loading && movies.isEmpty)
          const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator(strokeWidth: 2)))
        else if (movies.isEmpty)
          EmptyState(icon: LucideIcons.bookmark, title: tr('Список порожній'), text: tr('Позначайте фільми статусами «Буду дивитися», «Дивлюся» тощо — вони з’являться тут.'), action: tr('До каталогу'), onAction: () => context.go('/cinema'))
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
