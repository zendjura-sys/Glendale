import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Спільні елементи кінопорталу (як на сайті): бейджі постера, навігація розділів,
/// слайдер з мініатюрами, «Продовжити перегляд», вкладки за типом, рядок «списком», віджети.

const releaseLabels = {'announced': 'Анонс', 'ongoing': 'Виходить', 'released': 'Завершено'};

String? releaseLabel(Object? key) => releaseLabels[key] == null ? null : tr(releaseLabels[key]!);

/// Динамічні бейджі на постері: % переглянутого, статус виходу, кількість серій, вік.
class PosterBadges extends StatelessWidget {
  const PosterBadges({required this.movie, this.small = false, this.showAge = true, super.key});
  final Map<String, dynamic> movie;
  final bool small;
  final bool showAge;

  @override
  Widget build(BuildContext context) {
    final pct = movie['progress_pct'];
    final release = '${movie['release'] ?? ''}';
    final episodes = intOf(movie['episodes_count']);
    final series = movie['type'] != 'movie' && episodes > 1;
    final age = text(movie['age_rating']);
    Widget chip(String label, Color bg, Color fgColor) => Container(
          padding: EdgeInsets.symmetric(horizontal: small ? 5 : 7, vertical: small ? 2 : 3),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(7)),
          child: Text(label, style: body(small ? 9.5 : 10.5, color: fgColor, weight: FontWeight.w800)),
        );
    final pctValue = pct is num ? pct.round() : null;
    return Stack(children: [
      if (pctValue != null)
        Positioned(
          left: 6,
          top: 6,
          child: chip(
            '$pctValue%',
            pctValue >= 100 ? const Color(0xE610B981) : (pctValue > 0 ? primary : Colors.white.withValues(alpha: 0.85)),
            pctValue > 0 ? Colors.white : Colors.black54,
          ),
        ),
      if (releaseLabel(release) != null)
        Positioned(
          right: 6,
          top: 6,
          child: chip(
            releaseLabel(release)!,
            switch (release) { 'announced' => const Color(0xE60EA5E9), 'ongoing' => const Color(0xE610B981), _ => Colors.black.withValues(alpha: 0.7) },
            release == 'released' ? const Color(0xFFFCD34D) : Colors.white,
          ),
        ),
      Positioned(
        left: 6,
        bottom: 6,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          if (series) chip(tr('{n} серій', {'n': episodes}), Colors.white.withValues(alpha: 0.9), Colors.black),
          if (series && showAge && age != null) const SizedBox(height: 3),
          if (showAge && age != null) chip(RegExp(r'^\d+$').hasMatch(age) ? '$age+' : age, const Color(0xE6F43F5E), Colors.white),
        ]),
      ),
    ]);
  }
}

/// Постер з бейджами (або плейсхолдер).
class BadgedPoster extends StatelessWidget {
  const BadgedPoster({required this.movie, this.radius = 14, this.small = false, super.key});
  final Map<String, dynamic> movie;
  final double radius;
  final bool small;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: Stack(fit: StackFit.expand, children: [
        text(movie['poster']) != null ? NetImage(text(movie['poster'])) : CoverPlaceholder(seed: movie['id'] ?? 0, icon: LucideIcons.film, radius: 0, iconSize: 26),
        PosterBadges(movie: movie, small: small),
      ]),
    );
  }
}

/// Навігація кінопорталу: вкладки Головна / Огляд / Закладки / Розклад і «Рандом».
/// Окремого пошуку немає — шукає один загальний пошук застосунку (у т.ч. кіно).
class CinemaNav extends StatelessWidget {
  const CinemaNav({required this.active, super.key});
  final String active;

  static Future<void> random(BuildContext context) async {
    try {
      final r = await AppScope.read(context).session.api.get(Api.site('/cinema/random'));
      final to = text(mapOf(r)['redirect']);
      if (to != null && context.mounted) context.push(to);
    } catch (e) {
      if (context.mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tabs = [('home', tr('Головна'), '/cinema'), ('overview', tr('Огляд'), '/cinema/overview'), ('my', tr('Закладки'), '/cinema/my'), ('schedule', tr('Розклад'), '/cinema/schedule')];
    return Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
      Expanded(
        child: UnderlineTabs(
          tabs: [for (final t in tabs) (t.$1, t.$2)],
          active: active,
          onSelect: (key) {
            if (key == active) return;
            final to = tabs.firstWhere((t) => t.$1 == key).$3;
            key == 'home' ? context.go(to) : context.push(to);
          },
        ),
      ),
      RoundIcon(icon: LucideIcons.shuffle, onTap: () => random(context)),
    ]);
  }
}

/// Вкладки з підкресленням активної (як на сайті), горизонтальна прокрутка.
class UnderlineTabs extends StatelessWidget {
  const UnderlineTabs({required this.tabs, required this.active, required this.onSelect, super.key});
  final List<(String, String)> tabs;
  final String active;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(children: [
        for (final t in tabs)
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => onSelect(t.$1),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 10, 10, 0),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Text(t.$2, style: body(15, color: t.$1 == active ? ink : muted, weight: t.$1 == active ? FontWeight.w700 : FontWeight.w500)),
                const SizedBox(height: 8),
                AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  height: 3,
                  width: t.$1 == active ? 34 : 0,
                  decoration: BoxDecoration(color: primary, borderRadius: BorderRadius.circular(2)),
                ),
              ]),
            ),
          ),
      ]),
    );
  }
}

/// Кільце рейтингу (частка кола = оцінка з 10).
class RatingRing extends StatelessWidget {
  const RatingRing(this.value, {super.key});
  final double value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 34,
      height: 34,
      child: CustomPaint(
        painter: _RingPainter(value / 10, primary),
        child: Center(child: Text(value.toStringAsFixed(1), style: body(10.5, color: Colors.white, weight: FontWeight.w800))),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.part, this.color);
  final double part;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.drawCircle(rect.center, size.width / 2, Paint()..color = Colors.black.withValues(alpha: 0.55));
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;
    final inner = rect.deflate(3);
    canvas.drawArc(inner, 0, math.pi * 2, false, stroke..color = Colors.white24);
    canvas.drawArc(inner, -math.pi / 2, math.pi * 2 * part.clamp(0, 1), false, stroke..color = color);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.part != part || old.color != color;
}

/// Головний слайдер: банер на тлі, зірки, рік · країна · жанри, назва, опис, кнопки
/// «Дивитися» / «Трейлер» / «У списки», риски слайдів і мініатюри наступних.
class CinemaHero extends StatefulWidget {
  const CinemaHero({required this.movies, super.key});
  final List<Map<String, dynamic>> movies;

  @override
  State<CinemaHero> createState() => _CinemaHeroState();
}

class _CinemaHeroState extends State<CinemaHero> {
  int index = 0;
  Timer? timer;

  @override
  void initState() {
    super.initState();
    if (widget.movies.length > 1) {
      timer = Timer.periodic(const Duration(seconds: 8), (_) {
        if (mounted) setState(() => index = (index + 1) % widget.movies.length);
      });
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  Future<void> _addToList(Map<String, dynamic> movie) async {
    try {
      await AppScope.read(context).session.api.patch(Api.site('/cinema/${movie['slug']}/status'), {'status': 'planned'});
      if (mounted) toast(context, tr('Додано до списку «В планах».'), kind: ToastKind.success);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final movies = widget.movies;
    final movie = movies[index];
    final rating = (movie['rating'] is num) ? (movie['rating'] as num).toDouble() : null;
    final meta = [movie['year'], ...((movie['countries'] as List?) ?? const []), text(movie['type_label']), ...((movie['genres'] as List?) ?? const [])].whereType<Object>().join(' · ');
    final next = [...movies.skip(index), ...movies.take(index)].take(4).toList();
    final reduce = MediaQuery.of(context).disableAnimations;

    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: Stack(children: [
        Positioned.fill(
          child: AnimatedSwitcher(
            duration: reduce ? Duration.zero : const Duration(milliseconds: 700),
            child: KeyedSubtree(key: ValueKey(movie['id']), child: SizedBox.expand(child: NetImage(text(movie['backdrop']) ?? text(movie['poster'])))),
          ),
        ),
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x330D0E12), Color(0xCC0D0E12), Color(0xFF0D0E12)], stops: [0, 0.45, 1]),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 120, 18, 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              for (var i = 0; i < 10; i++) Icon(LucideIcons.star, size: 13, color: rating != null && i < rating.round() ? const Color(0xFFFBBF24) : Colors.white30),
              if (rating != null) Padding(padding: const EdgeInsets.only(left: 6), child: Text(rating.toStringAsFixed(1), style: body(12, color: Colors.white70))),
            ]),
            const SizedBox(height: 6),
            Text(meta, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: Colors.white60)),
            const SizedBox(height: 6),
            Text(text(movie['title']) ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: display(26, color: Colors.white)),
            if (text(movie['title_original']) != null && movie['title_original'] != movie['title'])
              Text(text(movie['title_original'])!, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, color: Colors.white54)),
            if (text(movie['description']) != null)
              Padding(padding: const EdgeInsets.only(top: 8), child: Text(text(movie['description'])!, maxLines: 3, overflow: TextOverflow.ellipsis, style: body(13.5, color: Colors.white70).copyWith(height: 1.4))),
            const SizedBox(height: 14),
            Wrap(spacing: 8, runSpacing: 8, children: [
              _HeroButton(label: tr('Дивитися'), icon: LucideIcons.play, primaryStyle: true, onTap: () => context.push('/cinema/${movie['slug']}')),
              if (text(movie['trailer_url']) != null) _HeroButton(label: tr('Трейлер'), icon: LucideIcons.clapperboard, onTap: () => context.push('/cinema/${movie['slug']}?trailer=1')),
              _HeroButton(label: tr('У списки'), icon: LucideIcons.bookmark, onTap: () => _addToList(movie)),
            ]),
            if (movies.length > 1) ...[
              const SizedBox(height: 14),
              Row(children: [
                for (var i = 0; i < movies.length; i++)
                  GestureDetector(
                    onTap: () => setState(() => index = i),
                    child: Container(margin: const EdgeInsets.only(right: 5), width: 26, height: 4, decoration: BoxDecoration(color: i == index ? primary : Colors.white24, borderRadius: BorderRadius.circular(2))),
                  ),
              ]),
              const SizedBox(height: 12),
              SizedBox(
                height: 92,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: next.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (_, i) {
                    final item = next[i];
                    final r = item['rating'] is num ? (item['rating'] as num).toDouble() : null;
                    return GestureDetector(
                      onTap: () => setState(() => index = movies.indexOf(item)),
                      child: Opacity(
                        opacity: i == 0 ? 1 : 0.5,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: SizedBox(
                            width: 160,
                            child: Stack(fit: StackFit.expand, children: [
                              NetImage(text(item['backdrop']) ?? text(item['poster'])),
                              const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Color(0xCC000000)]))),
                              Positioned(
                                left: 8,
                                right: 8,
                                bottom: 6,
                                child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                                  Expanded(
                                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                                      Text(text(item['title']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(11.5, color: Colors.white, weight: FontWeight.w700)),
                                      if (item['year'] != null) Text('${item['year']}', style: body(10.5, color: Colors.white60)),
                                    ]),
                                  ),
                                  if (r != null && r > 0) RatingRing(r),
                                ]),
                              ),
                            ]),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ]),
        ),
      ]),
    );
  }
}

class _HeroButton extends StatelessWidget {
  const _HeroButton({required this.label, required this.icon, required this.onTap, this.primaryStyle = false});
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final bool primaryStyle;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 42,
        padding: const EdgeInsets.symmetric(horizontal: 18),
        decoration: BoxDecoration(
          color: primaryStyle ? null : Colors.white.withValues(alpha: 0.12),
          gradient: primaryStyle ? LinearGradient(colors: [primary, accent]) : null,
          borderRadius: BorderRadius.circular(21),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 16, color: Colors.white),
          const SizedBox(width: 6),
          Text(label, style: body(13.5, color: Colors.white, weight: FontWeight.w700)),
        ]),
      ),
    );
  }
}

/// «Продовжити перегляд»: мініатюра, назва, «Сезон N · Серія M» і смужка прогресу.
class ContinueCards extends StatelessWidget {
  const ContinueCards({required this.movies, super.key});
  final List<Map<String, dynamic>> movies;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 96,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: movies.length,
        separatorBuilder: (_, _) => const SizedBox(width: 10),
        itemBuilder: (_, i) {
          final movie = movies[i];
          final progress = mapOf(movie['progress']);
          final pct = movie['progress_pct'] is num ? (movie['progress_pct'] as num).toDouble() : 0.0;
          final line = progress.isEmpty
              ? (text(movie['type_label']) ?? '')
              : [if (progress['season'] != null) tr('Сезон {n}', {'n': progress['season']}), tr('Серія {n}', {'n': progress['episode']})].join(' · ');
          return GestureDetector(
            onTap: () => context.push('/cinema/${movie['slug']}'),
            child: Glass(
              padding: const EdgeInsets.all(8),
              child: SizedBox(
                width: 250,
                child: Row(children: [
                  SizedBox(width: 56, height: 80, child: BadgedPoster(movie: {...movie, 'release': null, 'progress_pct': null, 'age_rating': null, 'episodes_count': null}, radius: 10, small: true)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text(text(movie['title']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, weight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(line, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
                      const SizedBox(height: 10),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(2),
                        child: LinearProgressIndicator(value: math.max(pct, 4) / 100, minHeight: 4, color: primary, backgroundColor: line.isEmpty ? raised : fg.withValues(alpha: 0.1)),
                      ),
                    ]),
                  ),
                ]),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Вкладки за типом (Серіали / Фільми / Аніме…) і стрічка плиток: постер — тло, назва поверх.
class TypeCarousel extends StatefulWidget {
  const TypeCarousel({required this.groups, super.key});
  final List<Map<String, dynamic>> groups;

  @override
  State<TypeCarousel> createState() => _TypeCarouselState();
}

class _TypeCarouselState extends State<TypeCarousel> {
  late String active = '${widget.groups.first['key']}';

  @override
  Widget build(BuildContext context) {
    final group = widget.groups.firstWhere((g) => '${g['key']}' == active, orElse: () => widget.groups.first);
    final movies = maps(group['movies']);
    return Glass(
      padding: const EdgeInsets.fromLTRB(4, 0, 0, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        UnderlineTabs(tabs: [for (final g in widget.groups) ('${g['key']}', '${g['label']}')], active: active, onSelect: (k) => setState(() => active = k)),
        const SizedBox(height: 10),
        SizedBox(
          height: 210,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.only(left: 8, right: 12),
            itemCount: movies.length,
            separatorBuilder: (_, _) => const SizedBox(width: 6),
            itemBuilder: (_, i) {
              final movie = movies[i];
              return GestureDetector(
                onTap: () => context.push('/cinema/${movie['slug']}'),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: SizedBox(
                    width: 150,
                    child: Stack(fit: StackFit.expand, children: [
                      BadgedPoster(movie: {...movie, 'age_rating': null, 'episodes_count': null}, radius: 0, small: true),
                      const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.center, end: Alignment.bottomCenter, colors: [Colors.transparent, Color(0xE6000000)]))),
                      Positioned(
                        left: 8,
                        right: 8,
                        bottom: 10,
                        child: Column(mainAxisSize: MainAxisSize.min, children: [
                          Text(text(movie['type_label']) ?? '', style: body(10.5, color: accent, weight: FontWeight.w600)),
                          Text(text(movie['title']) ?? '', maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis, style: body(12.5, color: Colors.white, weight: FontWeight.w700)),
                        ]),
                      ),
                    ]),
                  ),
                ),
              );
            },
          ),
        ),
      ]),
    );
  }
}

/// Рядок каталогу «списком»: постер з бейджами, тип, назва, рік, країна, жанр, опис.
class MovieDetailRow extends StatelessWidget {
  const MovieDetailRow({required this.movie, super.key});
  final Map<String, dynamic> movie;

  @override
  Widget build(BuildContext context) {
    final facts = <(String, String)>[
      if (movie['year'] != null) (tr('Рік'), '${movie['year']}'),
      if (((movie['countries'] as List?) ?? const []).isNotEmpty) (tr('Країна'), (movie['countries'] as List).join(', ')),
      if (((movie['genres'] as List?) ?? const []).isNotEmpty) (tr('Жанр'), (movie['genres'] as List).join(', ')),
    ];
    return GestureDetector(
      onTap: () => context.push('/cinema/${movie['slug']}'),
      behavior: HitTestBehavior.opaque,
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(width: 112, child: AspectRatio(aspectRatio: 2 / 3, child: BadgedPoster(movie: movie, small: true))),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(text(movie['type_label']) ?? '', style: body(11.5, color: muted)),
            Text(text(movie['title']) ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(16, weight: FontWeight.w700)),
            const SizedBox(height: 6),
            for (final f in facts)
              Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Text.rich(
                  TextSpan(children: [TextSpan(text: '${f.$1}: ', style: body(12.5, weight: FontWeight.w700)), TextSpan(text: f.$2, style: body(12.5, color: soft))]),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            if (text(movie['description']) != null)
              Padding(padding: const EdgeInsets.only(top: 4), child: Text(text(movie['description'])!, maxLines: 3, overflow: TextOverflow.ellipsis, style: body(12.5, color: muted).copyWith(height: 1.35))),
          ]),
        ),
      ]),
    );
  }
}

/// Заголовок віджета: значок в акцентному квадраті й назва з рискою.
class SideTitle extends StatelessWidget {
  const SideTitle(this.icon, this.title, {super.key});
  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(color: primary.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, size: 16, color: primary),
        ),
        const SizedBox(width: 10),
        Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text(title, style: display(16)),
          const SizedBox(height: 3),
          Container(width: 22, height: 3, decoration: BoxDecoration(color: primary, borderRadius: BorderRadius.circular(2))),
        ]),
      ]),
    );
  }
}

/// Віджети кінопорталу (як бічна колонка сайту): популярне за тиждень/місяць, трейлери,
/// найобговорюване. Дані — `/cinema/side`.
class CinemaSideWidgets extends StatefulWidget {
  const CinemaSideWidgets({super.key});

  @override
  State<CinemaSideWidgets> createState() => _CinemaSideWidgetsState();
}

class _CinemaSideWidgetsState extends State<CinemaSideWidgets> {
  Map<String, dynamic>? side;
  String range = 'week';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final data = await AppScope.read(context).session.api.get(Api.site('/cinema/side'));
        if (mounted) setState(() => side = mapOf(data));
      } catch (_) {
        // віджети — не критично
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final data = side;
    if (data == null) return const SizedBox.shrink();
    final popular = maps(mapOf(data['popular'])[range]);
    final trailers = maps(data['trailers']);
    final discussed = maps(data['discussed']);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (popular.isNotEmpty) ...[
        Glass(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            SideTitle(LucideIcons.flame, tr('Найпопулярніше')),
            Segmented(
              options: [SegmentOption('week', tr('За тиждень')), SegmentOption('month', tr('За місяць'))],
              selected: range,
              onSelect: (v) => setState(() => range = v),
            ),
            const SizedBox(height: 10),
            for (var i = 0; i < popular.length; i++)
              GestureDetector(
                onTap: () => context.push('/cinema/${popular[i]['slug']}'),
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(children: [
                    Expanded(child: Text(text(popular[i]['title']) ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(13.5, color: soft))),
                    const SizedBox(width: 10),
                    SizedBox(
                      width: 44,
                      height: 58,
                      child: Stack(clipBehavior: Clip.none, children: [
                        Positioned.fill(child: text(popular[i]['poster']) != null ? NetImage(text(popular[i]['poster']), radius: 8) : CoverPlaceholder(seed: popular[i]['id'] ?? i, icon: LucideIcons.film, radius: 8, iconSize: 16)),
                        Positioned(
                          right: -5,
                          bottom: -5,
                          child: Container(
                            width: 20,
                            height: 20,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: primary, shape: BoxShape.circle),
                            child: Text('${i + 1}', style: body(10, color: Colors.white, weight: FontWeight.w800)),
                          ),
                        ),
                      ]),
                    ),
                  ]),
                ),
              ),
          ]),
        ),
        const SizedBox(height: 12),
      ],
      if (trailers.isNotEmpty) ...[
        Glass(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            SideTitle(LucideIcons.clapperboard, tr('Трейлери')),
            SizedBox(
              height: 150,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: trailers.length,
                separatorBuilder: (_, _) => const SizedBox(width: 10),
                itemBuilder: (_, i) => GestureDetector(
                  onTap: () => context.push('/cinema/${trailers[i]['slug']}?trailer=1'),
                  child: SizedBox(
                    width: 210,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      AspectRatio(aspectRatio: 16 / 9, child: NetImage(text(trailers[i]['backdrop']) ?? text(trailers[i]['poster']), radius: 12)),
                      const SizedBox(height: 6),
                      Text(text(trailers[i]['title']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(13, weight: FontWeight.w600)),
                    ]),
                  ),
                ),
              ),
            ),
          ]),
        ),
        const SizedBox(height: 12),
      ],
      if (discussed.isNotEmpty)
        Glass(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            SideTitle(LucideIcons.messagesSquare, tr('Найобговорюване')),
            for (final item in discussed)
              GestureDetector(
                onTap: () => context.push('${item['href']}'),
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(children: [
                    Expanded(child: Text('${item['title']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(13.5, color: soft))),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: fg.withValues(alpha: 0.07), borderRadius: BorderRadius.circular(8)),
                      child: Text('${item['count']}', style: body(12, color: muted)),
                    ),
                  ]),
                ),
              ),
          ]),
        ),
    ]);
  }
}
