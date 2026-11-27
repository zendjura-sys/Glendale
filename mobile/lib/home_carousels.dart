import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Головна: угорі каруселі — кіно, серіали й аніме; нижче ігри; ще нижче музика (топ тижня).
/// Лише розділи, увімкнені людині; трек грає одразу, фільм і гра відкривають сторінку.
class HomeCarousels extends StatefulWidget {
  const HomeCarousels({super.key});

  @override
  State<HomeCarousels> createState() => HomeCarouselsState();
}

class HomeCarouselsState extends State<HomeCarousels> {
  List<Map<String, dynamic>> movies = const [];
  List<Map<String, dynamic>> games = const [];
  List<Map<String, dynamic>> tracks = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => unawaited(reload()));
  }

  Future<void> reload() async {
    final session = AppScope.read(context).session;
    final modules = session.modules;
    bool on(String m) => modules == null || modules.contains(m);
    final api = session.api;
    Future<Map<String, dynamic>> safe(String path) => api.get(path).catchError((_) => <String, dynamic>{});
    final results = await Future.wait([
      on('cinema') ? safe('/api/v1/cinema') : Future.value(<String, dynamic>{}),
      on('games') ? safe('/api/v1/games?sort=popular') : Future.value(<String, dynamic>{}),
      on('music') ? safe(Api.site('/music/charts')) : Future.value(<String, dynamic>{}),
    ]);
    if (!mounted) return;
    final popular = maps(results[0]['popular']);
    setState(() {
      movies = popular.isNotEmpty ? popular : maps(mapOf(results[0]['movies'])['data']);
      games = maps(mapOf(results[1]['games'])['data']);
      tracks = maps(mapOf(results[2]['charts'])['week']);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (movies.isNotEmpty)
        _Row(
          title: tr('Кіно, серіали й аніме'),
          icon: LucideIcons.clapperboard,
          onMore: () => context.go('/cinema'),
          height: 214,
          children: [
            for (final m in movies.take(20))
              _Tile(
                width: 112,
                ratio: 2 / 3,
                image: text(m['poster']),
                icon: LucideIcons.clapperboard,
                title: text(m['title']) ?? '',
                subtitle: [text(m['type_label']), if (m['year'] != null) '${m['year']}'].whereType<String>().join(' · '),
                badge: m['rating'] == null ? null : '★ ${m['rating']}',
                onTap: () => context.push('/cinema/${text(m['slug'])}'),
              ),
          ],
        ),
      if (games.isNotEmpty)
        _Row(
          title: tr('Ігри'),
          icon: LucideIcons.gamepad2,
          onMore: () => context.go('/games'),
          height: 140,
          children: [
            for (final g in games.take(20))
              _Tile(
                width: 184,
                ratio: 460 / 215,
                image: text(g['cover']),
                icon: LucideIcons.gamepad2,
                title: text(g['name']) ?? '',
                subtitle: text(g['category_label']) ?? '',
                onTap: () => context.push('/games/${text(g['slug'])}'),
              ),
          ],
        ),
      if (tracks.isNotEmpty)
        _Row(
          title: tr('Музика · топ тижня'),
          icon: LucideIcons.music,
          onMore: () => context.go('/music'),
          height: 176,
          children: [
            for (final (i, t) in tracks.take(20).indexed)
              _Tile(
                width: 124,
                ratio: 1,
                image: text(t['cover_url']),
                icon: LucideIcons.music,
                title: text(t['title']) ?? '',
                subtitle: text(t['artist']) ?? '',
                badge: '#${i + 1}',
                play: true,
                onTap: () => unawaited(AppScope.read(context).player.playList(tracks, i)),
              ),
          ],
        ),
    ]);
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.title, required this.icon, required this.children, required this.height, this.onMore});
  final String title;
  final IconData icon;
  final List<Widget> children;
  final double height;
  final VoidCallback? onMore;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Icon(icon, size: 17, color: accent),
            const SizedBox(width: 8),
            Expanded(child: Text(title, style: body(15.5, weight: FontWeight.w700))),
            if (onMore != null) TextButton(onPressed: onMore, child: Text(tr('Усі'), style: body(13, color: muted))),
          ]),
          const SizedBox(height: 6),
          SizedBox(
            height: height,
            child: ListView.separated(scrollDirection: Axis.horizontal, itemCount: children.length, separatorBuilder: (_, _) => const SizedBox(width: 10), itemBuilder: (_, i) => children[i]),
          ),
        ]),
      );
}

class _Tile extends StatelessWidget {
  const _Tile({required this.width, required this.ratio, required this.image, required this.icon, required this.title, required this.subtitle, required this.onTap, this.badge, this.play = false});
  final double width;
  final double ratio;
  final String? image;
  final IconData icon;
  final String title;
  final String subtitle;
  final String? badge;
  final bool play;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      decoration: const BoxDecoration(gradient: LinearGradient(colors: [Color(0x553D63FF), Color(0x55A855F7)], begin: Alignment.topLeft, end: Alignment.bottomRight)),
      child: Center(child: Icon(icon, color: Colors.white54)),
    );
    return SizedBox(
      width: width,
      child: GestureDetector(
        onTap: onTap,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          AspectRatio(
            aspectRatio: ratio,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Stack(fit: StackFit.expand, children: [
                image == null ? placeholder : Image.network(image!, fit: BoxFit.cover, errorBuilder: (_, _, _) => placeholder),
                if (badge != null)
                  Positioned(
                    top: 6,
                    left: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(6)),
                      child: Text(badge!, style: body(11, color: const Color(0xFFFCD34D), weight: FontWeight.w700)),
                    ),
                  ),
                if (play)
                  const Positioned(right: 6, bottom: 6, child: CircleAvatar(radius: 15, backgroundColor: Colors.white, child: Icon(LucideIcons.play, size: 15, color: Colors.black))),
              ]),
            ),
          ),
          const SizedBox(height: 5),
          Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(13, weight: FontWeight.w600)),
          Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(11.5, color: muted)),
        ]),
      ),
    );
  }
}
