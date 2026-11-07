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

/// Акцент кінопорталу — фірмовий колір проекту (теми «Неоновий синій» / «Крижана Арктика»);
/// компонування — як в Animax: пігулки, рейтинг на постері, контурні чипи.
Color get cinemaAccent => primary;
LinearGradient get cinemaGradient => buttonGradient;

const releaseLabels = {'announced': 'Анонс', 'ongoing': 'Виходить', 'released': 'Завершено'};

String? releaseLabel(Object? key) => releaseLabels[key] == null ? null : tr(releaseLabels[key]!);

/// Динамічні бейджі на постері: % переглянутого, статус виходу, кількість серій, вік.
class PosterBadges extends StatelessWidget {
  const PosterBadges({required this.movie, this.small = false, this.showAge = false, super.key});
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
    final rating = movie['rating'] is num && (movie['rating'] as num) > 0 ? (movie['rating'] as num).toDouble() : null;
    return Stack(children: [
      // Рейтинг — зелена пігулка вгорі ліворуч (як в Animax).
      if (rating != null)
        Positioned(left: 6, top: 6, child: chip(rating.toStringAsFixed(1), cinemaAccent, Colors.white)),
      // Скільки переглянуто — тонка зелена смужка внизу постера.
      if (pctValue != null && pctValue > 0)
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Container(
            height: 4,
            color: Colors.black.withValues(alpha: 0.45),
            alignment: Alignment.centerLeft,
            child: FractionallySizedBox(widthFactor: (pctValue / 100).clamp(0.04, 1.0), child: Container(color: cinemaAccent)),
          ),
        ),
      if (releaseLabel(release) != null)
        Positioned(
          right: 6,
          top: 6,
          child: chip(
            releaseLabel(release)!,
            switch (release) { 'announced' => const Color(0xE60EA5E9), 'ongoing' => const Color(0xFF10B981), _ => Colors.black.withValues(alpha: 0.7) },
            release == 'released' ? const Color(0xFFFCD34D) : Colors.white,
          ),
        ),
      Positioned(
        left: 6,
        bottom: pctValue != null && pctValue > 0 ? 10 : 6,
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
                Text(t.$2, style: body(15, color: t.$1 == active ? cinemaAccent : muted, weight: t.$1 == active ? FontWeight.w700 : FontWeight.w500)),
                const SizedBox(height: 8),
                AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  height: 3,
                  width: t.$1 == active ? 34 : 0,
                  decoration: BoxDecoration(color: cinemaAccent, borderRadius: BorderRadius.circular(2)),
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
        painter: _RingPainter(value / 10, cinemaAccent),
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
    final reduce = MediaQuery.of(context).disableAnimations;

    return ClipRRect(
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
        Align(
          alignment: Alignment.bottomLeft,
          child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 18),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(text(movie['title']) ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: display(28, color: Colors.white)),
            const SizedBox(height: 6),
            Row(children: [
              if (rating != null && rating > 0) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(color: cinemaAccent, borderRadius: BorderRadius.circular(6)),
                  child: Text(rating.toStringAsFixed(1), style: body(11.5, color: Colors.white, weight: FontWeight.w800)),
                ),
                const SizedBox(width: 8),
              ],
              Expanded(child: Text(meta, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12.5, color: Colors.white70))),
            ]),
            if (text(movie['title_original']) != null && movie['title_original'] != movie['title'])
              Text(text(movie['title_original'])!, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, color: Colors.white54)),
            if (text(movie['description']) != null)
              Padding(padding: const EdgeInsets.only(top: 8), child: Text(text(movie['description'])!, maxLines: 2, overflow: TextOverflow.ellipsis, style: body(13.5, color: Colors.white70).copyWith(height: 1.4))),
            const SizedBox(height: 14),
            Wrap(spacing: 8, runSpacing: 8, children: [
              _HeroButton(label: tr('Дивитися'), icon: LucideIcons.play, primaryStyle: true, onTap: () => context.push('/cinema/${movie['slug']}')),
              if (text(movie['trailer_url']) != null) _HeroButton(label: tr('Трейлер'), icon: LucideIcons.clapperboard, onTap: () => context.push('/cinema/${movie['slug']}?trailer=1')),
              _HeroButton(label: tr('Мій список'), icon: LucideIcons.plus, onTap: () => _addToList(movie)),
            ]),
            if (movies.length > 1) ...[
              const SizedBox(height: 14),
              Row(children: [
                for (var i = 0; i < movies.length; i++)
                  GestureDetector(
                    onTap: () => setState(() => index = i),
                    child: AnimatedContainer(duration: const Duration(milliseconds: 220), margin: const EdgeInsets.only(right: 5), width: i == index ? 22 : 8, height: 8, decoration: BoxDecoration(color: i == index ? cinemaAccent : Colors.white38, borderRadius: BorderRadius.circular(4))),
                  ),
              ]),
            ],
          ]),
        ),
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
        // Animax: «Дивитися» — суцільна зелена пігулка, решта — пігулки з білим контуром.
        decoration: BoxDecoration(
          color: primaryStyle ? cinemaAccent : Colors.transparent,
          border: primaryStyle ? null : Border.all(color: Colors.white, width: 2),
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
                        child: LinearProgressIndicator(value: math.max(pct, 4) / 100, minHeight: 4, color: cinemaAccent, backgroundColor: line.isEmpty ? raised : fg.withValues(alpha: 0.1)),
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
          decoration: BoxDecoration(color: cinemaAccent.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, size: 16, color: cinemaAccent),
        ),
        const SizedBox(width: 10),
        Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text(title, style: display(16)),
          const SizedBox(height: 3),
          Container(width: 22, height: 3, decoration: BoxDecoration(color: cinemaAccent, borderRadius: BorderRadius.circular(2))),
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
                            decoration: BoxDecoration(color: cinemaAccent, shape: BoxShape.circle),
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

// ───────────────────────── Стиль Animax ─────────────────────────

/// Тло на всю ширину екрана (виходить за бічні відступи ScreenScroll).
class CinemaBleed extends StatelessWidget {
  const CinemaBleed({required this.height, required this.child, super.key});
  final double height;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    return SizedBox(height: height, child: OverflowBox(minWidth: width, maxWidth: width, child: SizedBox(width: width, height: height, child: child)));
  }
}

/// Заголовок секції: назва жирно, «Усі» зеленим праворуч.
class CinemaSectionTitle extends StatelessWidget {
  const CinemaSectionTitle(this.title, {this.onAll, super.key});
  final String title;
  final VoidCallback? onAll;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(children: [
        Expanded(child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: display(18))),
        if (onAll != null) GestureDetector(onTap: onAll, child: Text(tr('Усі'), style: body(13.5, color: cinemaAccent, weight: FontWeight.w700))),
      ]),
    );
  }
}

/// Зелена пігулка рейтингу (як у постерах Animax).
Widget cinemaRatingPill(Object? value, {double size = 11}) {
  final rating = value is num ? value.toDouble() : double.tryParse('$value');
  if (rating == null || rating <= 0) return const SizedBox.shrink();
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
    decoration: BoxDecoration(color: cinemaAccent, borderRadius: BorderRadius.circular(6)),
    child: Text(rating.toStringAsFixed(1), style: body(size, color: Colors.white, weight: FontWeight.w800)),
  );
}

/// Постер Animax: картинка з рейтингом угорі ліворуч; знизу — великий номер у топі або «Серія N».
class AnimaxPoster extends StatelessWidget {
  const AnimaxPoster({required this.movie, this.rank, this.episodeLabel = false, this.radius = 12, super.key});
  final Map<String, dynamic> movie;
  final int? rank;
  final bool episodeLabel;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final episodes = intOf(movie['episodes_count']);
    final pct = movie['progress_pct'] is num ? (movie['progress_pct'] as num).toDouble() : 0.0;
    return GestureDetector(
      onTap: () => context.push('/cinema/${movie['slug']}'),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: Stack(fit: StackFit.expand, children: [
          text(movie['poster']) != null ? NetImage(text(movie['poster'])) : CoverPlaceholder(seed: movie['id'] ?? 0, icon: LucideIcons.film, radius: 0, iconSize: 26),
          if (rank != null || (episodeLabel && episodes > 0))
            const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.center, end: Alignment.bottomCenter, colors: [Colors.transparent, Color(0xB3000000)]))),
          Positioned(left: 8, top: 8, child: cinemaRatingPill(movie['rating'])),
          // Ярлики стану: «Новинка» (рік виходу — цей) і «Анонс» / «Виходить» / «Завершено». Вік не показуємо.
          Positioned(right: 8, top: 8, child: CinemaStatusTags(movie: movie)),
          if (rank != null)
            Positioned(left: 8, bottom: 2, child: Text('$rank', style: display(40, color: Colors.white).copyWith(height: 1))),
          if (rank == null && episodeLabel && episodes > 0 && movie['type'] != 'movie')
            Positioned(left: 8, bottom: 8, child: Text(tr('Серія {n}', {'n': episodes}), style: body(11.5, color: Colors.white, weight: FontWeight.w600))),
          if (pct > 0)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                height: 4,
                color: Colors.black45,
                alignment: Alignment.centerLeft,
                child: FractionallySizedBox(widthFactor: (pct / 100).clamp(0.04, 1.0), child: Container(color: cinemaAccent)),
              ),
            ),
        ]),
      ),
    );
  }
}

/// Ярлики стану тайтлу у правому верхньому куті постера.
class CinemaStatusTags extends StatelessWidget {
  const CinemaStatusTags({required this.movie, super.key});
  final Map<String, dynamic> movie;

  @override
  Widget build(BuildContext context) {
    final release = '${movie['release'] ?? ''}';
    final fresh = intOf(movie['year']) >= DateTime.now().year && release != 'announced';
    Widget tag(String label, Color bg, Color fg) => Container(
          margin: const EdgeInsets.only(bottom: 4),
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
          child: Text(label, style: body(10.5, color: fg, weight: FontWeight.w800)),
        );
    return Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
      if (fresh) tag(tr('Новинка'), const Color(0xFFEF4444), Colors.white),
      if (releaseLabel(release) != null)
        tag(
          releaseLabel(release)!,
          switch (release) { 'announced' => const Color(0xFF0EA5E9), 'ongoing' => const Color(0xFF10B981), _ => Colors.black.withValues(alpha: 0.72) },
          release == 'released' ? const Color(0xFFFCD34D) : Colors.white,
        ),
    ]);
  }
}

/// Горизонтальна стрічка постерів 150×200 (топ — з номерами, нові серії — з «Серія N»).
class AnimaxRow extends StatelessWidget {
  const AnimaxRow({required this.movies, this.ranked = false, this.episodes = false, super.key});
  final List<Map<String, dynamic>> movies;
  final bool ranked;
  final bool episodes;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 200,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: movies.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (_, i) => SizedBox(width: 150, child: AnimaxPoster(movie: movies[i], rank: ranked ? i + 1 : null, episodeLabel: episodes)),
      ),
    );
  }
}

/// Сітка 2 колонки: високі постери з рейтингом, назва під постером.
class AnimaxGrid extends StatelessWidget {
  const AnimaxGrid({required this.movies, super.key});
  final List<Map<String, dynamic>> movies;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 220, mainAxisSpacing: 14, crossAxisSpacing: 12, childAspectRatio: 0.62),
      itemCount: movies.length,
      itemBuilder: (_, i) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: AnimaxPoster(movie: movies[i], episodeLabel: true)),
        const SizedBox(height: 6),
        Text(text(movies[i]['title']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(13, weight: FontWeight.w700)),
      ]),
    );
  }
}

/// Пігулка-чип фільтра: вибраний — суцільний зелений, інші — зелений контур.
class AnimaxChip extends StatelessWidget {
  const AnimaxChip({required this.label, required this.selected, required this.onTap, super.key});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? cinemaAccent : Colors.transparent,
          border: Border.all(color: cinemaAccent, width: 2),
          borderRadius: BorderRadius.circular(100),
        ),
        child: Text(label, style: body(13.5, color: selected ? Colors.white : cinemaAccent, weight: FontWeight.w600)),
      ),
    );
  }
}

/// Кнопка-пігулка «+ Мій список» (суцільна) або «✓ Мій список» (контур), як в Animax.
class AnimaxListButton extends StatelessWidget {
  const AnimaxListButton({required this.added, required this.onTap, super.key});
  final bool added;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: added ? Colors.transparent : cinemaAccent,
          border: Border.all(color: cinemaAccent, width: 2),
          borderRadius: BorderRadius.circular(100),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(added ? LucideIcons.check : LucideIcons.plus, size: 14, color: added ? cinemaAccent : Colors.white),
          const SizedBox(width: 6),
          Text(tr('Мій список'), style: body(12.5, color: added ? cinemaAccent : Colors.white, weight: FontWeight.w700)),
        ]),
      ),
    );
  }
}

/// Додати тайтл до «Буду дивитися».
Future<bool> addToCinemaList(BuildContext context, Map<String, dynamic> movie) async {
  try {
    await AppScope.read(context).session.api.patch(Api.site('/cinema/${movie['slug']}/status'), {'status': 'planned'});
    if (context.mounted) toast(context, tr('Додано до списку «Буду дивитися».'), kind: ToastKind.success);
    return true;
  } catch (e) {
    if (context.mounted) toast(context, e);
    return false;
  }
}

/// Вибір у «Сортування й фільтр».
class CinemaFilter {
  const CinemaFilter({this.sort = 'new', this.type, this.release, this.genre, this.year});
  final String sort;
  final String? type;
  final String? release;
  final String? genre;
  final int? year;
}

/// Екран «Сортування й фільтр» (Animax): секції чипів і кнопки «Скинути» / «Застосувати».
Future<CinemaFilter?> showCinemaFilter(
  BuildContext context, {
  required CinemaFilter current,
  required List<(String, String)> sorts,
  required List<Map<String, dynamic>> types,
  required List<Map<String, dynamic>> genres,
  required List<int> years,
}) {
  return Navigator.of(context, rootNavigator: true).push<CinemaFilter>(MaterialPageRoute(
    builder: (_) => _FilterScreen(current: current, sorts: sorts, types: types, genres: genres, years: years),
  ));
}

class _FilterScreen extends StatefulWidget {
  const _FilterScreen({required this.current, required this.sorts, required this.types, required this.genres, required this.years});
  final CinemaFilter current;
  final List<(String, String)> sorts;
  final List<Map<String, dynamic>> types;
  final List<Map<String, dynamic>> genres;
  final List<int> years;

  @override
  State<_FilterScreen> createState() => _FilterScreenState();
}

class _FilterScreenState extends State<_FilterScreen> {
  late String sort = widget.current.sort;
  late String? type = widget.current.type;
  late String? release = widget.current.release;
  late String? genre = widget.current.genre;
  late int? year = widget.current.year;
  bool allGenres = false;
  bool allYears = false;

  Widget _section(String title, List<Widget> chips, {VoidCallback? onAll, bool open = false}) => Padding(
        padding: const EdgeInsets.only(bottom: 18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(title, style: body(16.5, weight: FontWeight.w700))),
            if (onAll != null) GestureDetector(onTap: onAll, child: Text(open ? tr('Згорнути') : tr('Усі'), style: body(13, color: cinemaAccent, weight: FontWeight.w700))),
          ]),
          const SizedBox(height: 12),
          Wrap(spacing: 10, runSpacing: 10, children: chips),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final genres = allGenres ? widget.genres : widget.genres.take(8).toList();
    final years = allYears ? widget.years : widget.years.take(5).toList();
    return Scaffold(
      backgroundColor: abyss,
      appBar: AppBar(
        backgroundColor: abyss,
        surfaceTintColor: Colors.transparent,
        title: Text(tr('Сортування й фільтр'), style: display(20)),
        leading: IconButton(icon: const Icon(LucideIcons.arrowLeft), onPressed: () => Navigator.pop(context)),
      ),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 24), children: [
        _section(tr('Сортування'), [for (final s in widget.sorts) AnimaxChip(label: s.$2, selected: sort == s.$1, onTap: () => setState(() => sort = s.$1))]),
        _section(tr('Категорії'), [
          AnimaxChip(label: tr('Усі'), selected: type == null, onTap: () => setState(() => type = null)),
          for (final t in widget.types) AnimaxChip(label: '${t['label']}', selected: type == '${t['key']}', onTap: () => setState(() => type = '${t['key']}')),
        ]),
        _section(tr('Статус'), [
          AnimaxChip(label: tr('Усі'), selected: release == null, onTap: () => setState(() => release = null)),
          for (final e in releaseLabels.entries) AnimaxChip(label: tr(e.value), selected: release == e.key, onTap: () => setState(() => release = e.key)),
        ]),
        if (widget.genres.isNotEmpty)
          _section(
            tr('Жанр'),
            [
              AnimaxChip(label: tr('Усі'), selected: genre == null, onTap: () => setState(() => genre = null)),
              for (final g in genres) AnimaxChip(label: '${g['name']}', selected: genre == '${g['name']}', onTap: () => setState(() => genre = '${g['name']}')),
            ],
            onAll: widget.genres.length > 8 ? () => setState(() => allGenres = !allGenres) : null,
            open: allGenres,
          ),
        if (widget.years.isNotEmpty)
          _section(
            tr('Рік виходу'),
            [
              AnimaxChip(label: tr('Усі'), selected: year == null, onTap: () => setState(() => year = null)),
              for (final y in years) AnimaxChip(label: '$y', selected: year == y, onTap: () => setState(() => year = y)),
            ],
            onAll: widget.years.length > 5 ? () => setState(() => allYears = !allYears) : null,
            open: allYears,
          ),
      ]),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: Row(children: [
            Expanded(
              child: _PillButton(
                label: tr('Скинути'),
                filled: false,
                onTap: () => Navigator.pop(context, const CinemaFilter()),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _PillButton(
                label: tr('Застосувати'),
                filled: true,
                onTap: () => Navigator.pop(context, CinemaFilter(sort: sort, type: type, release: release, genre: genre, year: year)),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

class _PillButton extends StatelessWidget {
  const _PillButton({required this.label, required this.filled, required this.onTap});
  final String label;
  final bool filled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 54,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: filled ? cinemaAccent : cinemaAccent.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(100)),
        child: Text(label, style: body(15.5, color: filled ? Colors.white : cinemaAccent, weight: FontWeight.w700)),
      ),
    );
  }
}

/// Рядок пошуку кіно (Animax): поле з лупою й квадратна кнопка фільтра праворуч.
class CinemaSearchBar extends StatefulWidget {
  const CinemaSearchBar({required this.initial, required this.onSubmit, required this.onFilter, this.filterActive = false, super.key});
  final String initial;
  final ValueChanged<String> onSubmit;
  final VoidCallback onFilter;
  final bool filterActive;

  @override
  State<CinemaSearchBar> createState() => _CinemaSearchBarState();
}

class _CinemaSearchBarState extends State<CinemaSearchBar> {
  late final controller = TextEditingController(text: widget.initial);
  final focus = FocusNode();

  @override
  void initState() {
    super.initState();
    focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    controller.dispose();
    focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final on = focus.hasFocus;
    return Row(children: [
      Expanded(
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          height: 52,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: on ? cinemaAccent.withValues(alpha: 0.08) : raised,
            border: Border.all(color: on ? cinemaAccent : Colors.transparent, width: 1.5),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(children: [
            Icon(LucideIcons.search, size: 19, color: on ? cinemaAccent : muted),
            const SizedBox(width: 10),
            Expanded(
              child: TextField(
                controller: controller,
                focusNode: focus,
                textInputAction: TextInputAction.search,
                onSubmitted: widget.onSubmit,
                style: body(14.5),
                decoration: InputDecoration(isCollapsed: true, border: InputBorder.none, hintText: tr('Пошук фільмів, серіалів, аніме'), hintStyle: body(14.5, color: muted)),
              ),
            ),
          ]),
        ),
      ),
      const SizedBox(width: 10),
      GestureDetector(
        onTap: widget.onFilter,
        child: Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(color: widget.filterActive ? cinemaAccent : cinemaAccent.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14)),
          child: Icon(LucideIcons.slidersHorizontal, color: widget.filterActive ? Colors.white : cinemaAccent),
        ),
      ),
    ]);
  }
}
