import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'i18n.dart';
import 'listen_together.dart';
import 'lyrics.dart';
import 'music.dart';
import 'posts.dart';
import 'shell.dart';
import 'state.dart';
import 'theme.dart';
import 'track_edit.dart';
import 'widgets.dart';

// Спільні частини розділу «Музика» в стилі Apple Music — як components/am/* на сайті:
// великі заголовки, горизонтальні полиці, плитки міксів і станцій, рядки пісень з меню «⋯».
// Кольори — палітра проєкту (неоновий синій / крижана арктика), без «яблучного» червоного.

/// Бічний відступ розділу; полиці гортаються на всю ширину екрана.
const gutter = 16.0;

/// Назви й підписи міксів — тут, через tr(): сервер віддає лише ключі.
(String, String) mixTitle(String? key) => switch (key) {
      'favorites' => (tr('Мікс улюбленого'), tr('Те, що ти слухаєш найчастіше')),
      'discovery' => (tr('Мікс відкриттів'), tr('Нове для тебе у твоїх жанрах')),
      'new' => (tr('Мікс новинок'), tr('Свіжі треки, що можуть сподобатись')),
      'friends' => (tr('Мікс друзів'), tr('Що слухають твої друзі')),
      _ => (tr('Мікс для відпочинку'), tr('Спокійна музика без поспіху')),
    };

(String, String) stationTitle(Map<String, dynamic> station) {
  final key = text(station['key']) ?? '';
  final name = text(station['name']) ?? '';
  if (key == 'me') return (tr('Станція {name}', {'name': name}), tr('На основі того, що ти слухаєш'));
  if (key.startsWith('artist:')) return (tr('Станція «{name}»', {'name': name}), tr('Виконавець і схожа музика'));
  return (tr('{name}: станція', {'name': name}), tr('Безкінечний потік жанру'));
}

String artistPath(String name) => '/music/artist?${Uri(queryParameters: {'name': name}).query}';
String albumPath(String artist, String title) => '/music/album?${Uri(queryParameters: {'artist': artist, 'title': title}).query}';

/// Посилання сайту (`href` у картках) → екран застосунку.
void openMusic(BuildContext context, String? href) {
  if (href != null) context.push(appPathFor(href));
}

/// «Грає з…» за маршрутом екрана (як pageSource() на сайті — назва сторінки й посилання).
PlayFrom? playFromRoute(Uri uri) {
  final q = uri.queryParameters;
  final path = uri.toString();
  final segments = uri.pathSegments;
  if (segments.isEmpty || segments.first != 'music') return null;
  if (q['user'] != null) return PlayFrom(tr('Аудіозаписи @{v}', {'v': q['user']}), path);
  final label = switch (segments.length > 1 ? segments[1] : '') {
    'album' => text(q['title']),
    'artist' || 'genre' => text(q['name']),
    'mix' when segments.length > 2 => mixTitle(segments[2]).$1,
    'playlists' => tr('Плейлист'),
    'search' => text(q['q']) == null ? tr('Пошук') : tr('Пошук: «{q}»', {'q': q['q']!.trim()}),
    'charts' => tr('Чарти'),
    'replay' => segments.length > 2 ? tr('Replay {year}', {'year': segments[2]}) : 'Replay',
    'library' => tr('Медіатека'),
    'new' => tr('Нове'),
    'radio' => tr('Радіо'),
    _ => tr('Музика'),
  };
  return label == null ? null : PlayFrom(label, path);
}

/// «Грає з…» для запуску з цього місця: явне джерело сторінки ([PlaySource]) або маршрут.
PlayFrom? playFromHere(BuildContext context) {
  final own = PlaySource.of(context);
  if (own != null) return own;
  try {
    final uri = GoRouter.maybeOf(context)?.state.uri;
    return uri == null ? null : playFromRoute(uri);
  } catch (_) {
    return null;
  }
}

/// Підпис станції для «Грає з…».
String stationLabel(String key) {
  final name = key.contains(':') ? key.substring(key.indexOf(':') + 1) : '';
  if (key.startsWith('artist:')) return tr('Станція «{name}»', {'name': name});
  if (key.startsWith('genre:')) return tr('{name}: станція', {'name': name});
  if (key.startsWith('track:')) return tr('Станція за треком');
  return tr('Твоя станція');
}

/// Безкінечна станція: перша порція одразу, далі плеєр дописує чергу сам.
Future<void> startStation(BuildContext context, String key, {String? label}) async {
  final player = AppScope.read(context).player;
  try {
    if (!await player.playStation(key, from: PlayFrom(label ?? stationLabel(key))) && context.mounted) toast(context, tr('На цій станції поки немає треків.'), kind: ToastKind.info);
  } catch (_) {
    if (context.mounted) toast(context, tr('Не вдалося запустити станцію.'), kind: ToastKind.error);
  }
}

Color hexColor(dynamic value, Color fallback) {
  final raw = (text(value) ?? '').replaceFirst('#', '');
  final parsed = raw.length == 6 ? int.tryParse(raw, radix: 16) : null;
  return parsed == null ? fallback : Color(0xFF000000 | parsed);
}

List<String> coversOf(dynamic list) => [for (final c in (list is List ? list : const [])) ?absolute(c)];

/// Ширина звичайної плитки на полиці: дві з чвертю на екран телефона.
double tileWidth(BuildContext context) => math.min((MediaQuery.sizeOf(context).width - gutter * 2) / 2.25, 190);

// ───────────────────────── Каркас сторінки ─────────────────────────

/// Прокрутка сторінки музики: під прозору шапку, без бічних полів (полиці — на всю ширину).
class MusicList extends StatelessWidget {
  const MusicList({required this.children, this.onRefresh, this.extraBottom = 0, super.key});
  final List<Widget> children;
  final Future<void> Function()? onRefresh;

  /// Місце під власну панель вкладок розділу.
  final double extraBottom;

  @override
  Widget build(BuildContext context) {
    final list = ListView(
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      padding: EdgeInsets.only(top: siteHeaderInset(context), bottom: ShellChrome.bottomOf(context) + extraBottom + 20),
      children: children,
    );
    if (onRefresh == null) return list;
    return RefreshIndicator(color: primary, backgroundColor: popover, onRefresh: onRefresh!, child: list);
  }
}

/// Великий заголовок (як у iOS) з кнопкою «назад» і діями праворуч.
class LargeTitle extends StatelessWidget {
  const LargeTitle(this.title, {this.back = false, this.subtitle, this.actions = const [], super.key});
  final String title;
  final String? subtitle;
  final bool back;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(gutter, 4, gutter - 4, 4),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (back || actions.isNotEmpty)
          Row(children: [
            if (back) RoundIcon(icon: LucideIcons.chevronLeft, tooltip: tr('Назад'), onTap: () => context.pop()),
            const Spacer(),
            ...actions,
          ]),
        if (back || actions.isNotEmpty) const SizedBox(height: 8),
        Text(title, style: display(31).copyWith(letterSpacing: -0.6)),
        if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(subtitle!, style: body(14, color: muted))),
      ]),
    );
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {this.subtitle, this.onMore, super.key});
  final String title;
  final String? subtitle;
  final VoidCallback? onMore;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(gutter, 24, gutter, 10),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onMore,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Flexible(child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: display(20))),
            if (onMore != null) Padding(padding: const EdgeInsets.only(left: 2, top: 2), child: Icon(LucideIcons.chevronRight, size: 20, color: muted)),
          ]),
          if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(subtitle!, style: body(13, color: muted))),
        ]),
      ),
    );
  }
}

/// Горизонтальна полиця плиток.
class Shelf extends StatelessWidget {
  const Shelf({required this.children, this.gap = 12, super.key});
  final List<Widget> children;
  final double gap;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: gutter),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        for (var i = 0; i < children.length; i++) ...[if (i > 0) SizedBox(width: gap), children[i]],
      ]),
    );
  }
}

/// Сітка плиток у два стовпці (розділи медіатеки, жанри).
class TileGrid extends StatelessWidget {
  const TileGrid({required this.children, this.columns = 2, super.key});
  final List<Widget> children;
  final int columns;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: gutter),
      child: LayoutBuilder(builder: (context, box) {
        const gap = 12.0;
        final width = (box.maxWidth - gap * (columns - 1)) / columns;
        return Wrap(spacing: gap, runSpacing: 16, children: [for (final c in children) SizedBox(width: width, child: c)]);
      }),
    );
  }
}

// ───────────────────────── Обкладинки ─────────────────────────

class Artwork extends StatelessWidget {
  const Artwork({required this.url, required this.seed, this.round = false, this.radius = 10, this.icon = LucideIcons.music, super.key});
  final String? url;
  final Object seed;
  final bool round;
  final double radius;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final src = absolute(url);
    final image = src == null ? MusicPlaceholder(seed: seed, icon: icon) : NetImage(src);
    return AspectRatio(
      aspectRatio: 1,
      child: round ? ClipOval(child: image) : ClipRRect(borderRadius: BorderRadius.circular(radius), child: image),
    );
  }
}

/// Обкладинка без картинки — градієнт у синіх кольорах проєкту (як colorsFor у MusicCatalog).
class MusicPlaceholder extends StatelessWidget {
  const MusicPlaceholder({required this.seed, this.icon = LucideIcons.music, this.iconSize = 28, super.key});
  final Object seed;
  final IconData icon;
  final double iconSize;

  static const _pairs = [
    [Color(0xFF2F7BFF), Color(0xFF1A2F7A)],
    [Color(0xFF3D63FF), Color(0xFF0B1638)],
    [Color(0xFF22C4F0), Color(0xFF2A6CFF)],
    [Color(0xFF4D9BFF), Color(0xFF123A8C)],
    [Color(0xFF38E1FF), Color(0xFF3D63FF)],
    [Color(0xFF1D6FE0), Color(0xFF22D3EE)],
    [Color(0xFF7AA8FF), Color(0xFF0D1B4A)],
  ];

  @override
  Widget build(BuildContext context) {
    final colors = _pairs['$seed'.hashCode.abs() % _pairs.length];
    return DecoratedBox(
      decoration: BoxDecoration(gradient: LinearGradient(colors: colors, begin: Alignment.topLeft, end: Alignment.bottomRight)),
      child: Center(child: Icon(icon, color: Colors.white.withValues(alpha: 0.85), size: iconSize)),
    );
  }
}

/// Обкладинка міксу чи станції: обкладинки треків на весь розмір, зверху — тонування в кольорах
/// картки й підпис, як в Apple Music.
class MixArt extends StatelessWidget {
  const MixArt({required this.colors, required this.covers, required this.label, this.icon, this.aspect = 1, this.radius = 12, this.footnote, super.key});
  final List<Color> colors;
  final List<String> covers;
  final String label;
  final String? footnote;
  final IconData? icon;
  final double aspect;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final a = colors.first, b = colors.length > 1 ? colors[1] : colors.first;
    return AspectRatio(
      aspectRatio: aspect,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: Stack(fit: StackFit.expand, children: [
          DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(colors: [a, b], begin: Alignment.topLeft, end: Alignment.bottomRight))),
          if (covers.length >= 4)
            GridView.count(crossAxisCount: 2, physics: const NeverScrollableScrollPhysics(), padding: EdgeInsets.zero, children: [for (final c in covers.take(4)) NetImage(c)])
          else if (covers.isNotEmpty)
            NetImage(covers.first),
          // Тонування: колір картки знизу, щоб підпис читався на будь-якій обкладинці.
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [a.withValues(alpha: covers.isEmpty ? 0 : 0.25), b.withValues(alpha: covers.isEmpty ? 0.2 : 0.92)],
                stops: const [0.25, 1],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (icon != null) Icon(icon, size: 20, color: Colors.white.withValues(alpha: 0.9)),
              const Spacer(),
              Text(label, maxLines: 3, overflow: TextOverflow.ellipsis, style: display(16, color: Colors.white).copyWith(height: 1.1)),
              if (footnote != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(footnote!, maxLines: 2, overflow: TextOverflow.ellipsis, style: body(12, color: Colors.white70))),
            ]),
          ),
        ]),
      ),
    );
  }
}

// ───────────────────────── Плитки ─────────────────────────

class Tile extends StatelessWidget {
  const Tile({required this.art, required this.title, this.subtitle, this.onTap, this.width, this.center = false, super.key});
  final Widget art;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final double? width;
  final bool center;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Column(crossAxisAlignment: center ? CrossAxisAlignment.center : CrossAxisAlignment.start, children: [
          art,
          const SizedBox(height: 7),
          Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: center ? TextAlign.center : TextAlign.start, style: body(13.5, weight: FontWeight.w600)),
          if (subtitle != null) Text(subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: center ? TextAlign.center : TextAlign.start, style: body(12.5, color: muted)),
        ]),
      ),
    );
  }
}

class MixTile extends StatelessWidget {
  const MixTile({required this.mix, this.width, super.key});
  final Map<String, dynamic> mix;
  final double? width;

  @override
  Widget build(BuildContext context) {
    final (title, subtitle) = mixTitle(text(mix['key']));
    final colors = [for (final c in (mix['colors'] as List? ?? const [])) hexColor(c, primary)];
    return Tile(
      width: width ?? tileWidth(context),
      onTap: () => openMusic(context, text(mix['href']) ?? '/music/mix/${mix['key']}'),
      art: MixArt(colors: colors.isEmpty ? [primary] : colors, covers: coversOf(mix['covers']), label: title),
      title: title,
      subtitle: subtitle,
    );
  }
}

class StationTile extends StatelessWidget {
  const StationTile({required this.station, this.width, this.aspect = 1, super.key});
  final Map<String, dynamic> station;
  final double? width;
  final double aspect;

  @override
  Widget build(BuildContext context) {
    final (title, subtitle) = stationTitle(station);
    final colors = [for (final c in (station['colors'] as List? ?? const [])) hexColor(c, primary)];
    return Tile(
      width: width ?? tileWidth(context),
      onTap: () => startStation(context, text(station['key']) ?? 'me', label: title),
      art: MixArt(colors: colors.isEmpty ? [primary] : colors, covers: coversOf(station['covers']), label: title, icon: LucideIcons.radio, aspect: aspect),
      title: title,
      subtitle: subtitle,
    );
  }
}

/// Трек на полиці («Нещодавно прослухане», сингли): дотик — грати всю полицю з нього.
class TrackTile extends StatelessWidget {
  const TrackTile({required this.tracks, required this.index, this.width, this.subtitle, this.badge, super.key});
  final List<Map<String, dynamic>> tracks;
  final int index;
  final double? width;
  final String? subtitle;
  final Widget? badge;

  @override
  Widget build(BuildContext context) {
    final t = tracks[index];
    return Tile(
      width: width ?? tileWidth(context),
      onTap: () => playTracks(context, tracks, index),
      art: Stack(clipBehavior: Clip.none, children: [
        Artwork(url: text(t['cover_url']), seed: trackKey(t), icon: t['live'] == true ? LucideIcons.radio : LucideIcons.music),
        if (badge != null) Positioned(left: -4, bottom: -4, child: badge!),
      ]),
      title: text(t['title']) ?? tr('Без назви'),
      subtitle: subtitle ?? artistOf(t['artist'], '—'),
    );
  }
}

class AlbumTile extends StatelessWidget {
  const AlbumTile({required this.album, this.width, this.showYear = false, super.key});
  final Map<String, dynamic> album;
  final double? width;
  final bool showYear;

  @override
  Widget build(BuildContext context) {
    final title = text(album['title']) ?? '';
    final artist = text(album['artist']) ?? '';
    return Tile(
      width: width ?? tileWidth(context),
      onTap: () => context.push(albumPath(artist, title)),
      art: Artwork(url: text(album['cover_url']), seed: '$artist|$title', icon: LucideIcons.disc3),
      title: title,
      subtitle: showYear && album['year'] != null ? '${album['year']}' : artistOf(artist, '—'),
    );
  }
}

class ArtistTile extends StatelessWidget {
  const ArtistTile({required this.artist, this.width, super.key});
  final Map<String, dynamic> artist;
  final double? width;

  @override
  Widget build(BuildContext context) {
    final name = text(artist['name']) ?? '';
    return Tile(
      width: width ?? tileWidth(context) * 0.82,
      center: true,
      onTap: () => context.push(artistPath(name)),
      art: Artwork(url: text(artist['cover_url']), seed: name, round: true, icon: LucideIcons.micVocal),
      title: name,
    );
  }
}

class PlaylistTile extends StatelessWidget {
  const PlaylistTile({required this.playlist, this.width, super.key});
  final Map<String, dynamic> playlist;
  final double? width;

  @override
  Widget build(BuildContext context) {
    final count = intOf(playlist['tracks_count']);
    return Tile(
      width: width ?? tileWidth(context),
      onTap: () => context.push('/music/playlists/${playlist['id']}'),
      art: AspectRatio(aspectRatio: 1, child: PlaylistCover(playlist: playlist, radius: 10)),
      title: text(playlist['title']) ?? '',
      subtitle: tr('{n} пісень', {'n': count}),
    );
  }
}

/// Плитка жанру: синій прямокутник у кольорах проєкту з назвою й обкладинкою під кутом.
class GenreTile extends StatelessWidget {
  const GenreTile({required this.genre, required this.index, super.key});
  final Map<String, dynamic> genre;
  final int index;

  static const _colors = [Color(0xFF2F7BFF), Color(0xFF1D6FE0), Color(0xFF3D63FF), Color(0xFF22A6E6), Color(0xFF0E7FC0), Color(0xFF4D6BFF), Color(0xFF1B4FD1), Color(0xFF2B8CD8), Color(0xFF3A58C9), Color(0xFF167AB8)];

  @override
  Widget build(BuildContext context) {
    final name = text(genre['name']) ?? '';
    final cover = text(genre['cover_url']);
    return GestureDetector(
      onTap: () => context.push('/music/genre?${Uri(queryParameters: {'name': name}).query}'),
      child: AspectRatio(
        aspectRatio: 16 / 10,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: ColoredBox(
            color: _colors[index % _colors.length],
            child: LayoutBuilder(builder: (context, box) {
              return Stack(children: [
                if (cover != null)
                  Positioned(
                    right: -12,
                    bottom: -12,
                    width: box.maxWidth * 0.5,
                    height: box.maxWidth * 0.5,
                    child: Transform.rotate(angle: 0.38, child: NetImage(cover, radius: 6)),
                  ),
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: SizedBox(width: box.maxWidth * 0.7, child: Text(name, maxLines: 2, overflow: TextOverflow.ellipsis, style: display(16, color: Colors.white))),
                ),
              ]);
            }),
          ),
        ),
      ),
    );
  }
}

/// Значок якості: «Без втрат» / «Hi-Res без втрат».
class QualityBadge extends StatelessWidget {
  const QualityBadge(this.quality, {this.color, super.key});
  final String? quality;
  final Color? color;

  static String? label(String? quality) => switch (quality) {
        'lossless' => tr('Без втрат'),
        'hires' => tr('Hi-Res без втрат'),
        _ => null,
      };

  @override
  Widget build(BuildContext context) {
    final value = label(quality);
    if (value == null) return const SizedBox.shrink();
    final c = color ?? muted;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(5), border: Border.all(color: c.withValues(alpha: 0.6))),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(LucideIcons.audioWaveform, size: 11, color: c),
        const SizedBox(width: 4),
        Text(value, style: body(10.5, color: c, weight: FontWeight.w600)),
      ]),
    );
  }
}

// ───────────────────────── Пісні ─────────────────────────

/// Рядок пісні: обкладинка (або номер), назва й виконавець, зірочка, меню «⋯».
class SongRow extends StatefulWidget {
  const SongRow({required this.tracks, required this.index, this.rank, this.cover = true, this.onChanged, this.onRemove, this.removeLabel, this.subtitle, this.horizontal = gutter, super.key});
  final List<Map<String, dynamic>> tracks;
  final int index;
  final int? rank;
  final bool cover;
  final VoidCallback? onChanged;
  final VoidCallback? onRemove;
  final String? removeLabel;

  /// Додатковий рядок під назвою (рядок з тексту пісні в пошуку).
  final String? subtitle;
  final double horizontal;

  @override
  State<SongRow> createState() => _SongRowState();
}

class _SongRowState extends State<SongRow> {
  Map<String, dynamic> get track => widget.tracks[widget.index];

  @override
  Widget build(BuildContext context) {
    final player = AppScope.of(context).player;
    return ListenableBuilder(
      listenable: player,
      builder: (context, _) {
        final on = player.isCurrentCard(track);
        final album = text(track['album']);
        return InkWell(
          onTap: () => playTracks(context, widget.tracks, widget.index),
          onLongPress: _menu,
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: widget.horizontal, vertical: 5),
            child: Row(children: [
              if (widget.rank != null)
                SizedBox(width: 28, child: Text('${widget.rank}', style: body(15, color: muted, weight: FontWeight.w600))),
              if (widget.cover)
                SizedBox(
                  width: 48,
                  child: Stack(alignment: Alignment.center, children: [
                    Artwork(url: text(track['cover_url']), seed: trackKey(track), radius: 7, icon: track['live'] == true ? LucideIcons.radio : LucideIcons.music),
                    if (on) Container(width: 48, height: 48, decoration: BoxDecoration(color: Colors.black38, borderRadius: BorderRadius.circular(7)), child: Icon(player.playing ? LucideIcons.audioLines : LucideIcons.pause, size: 18, color: Colors.white)),
                  ]),
                )
              else if (on)
                Padding(padding: const EdgeInsets.only(right: 8), child: Icon(LucideIcons.audioLines, size: 16, color: accent)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(text(track['title']) ?? tr('Без назви'), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(15, color: on ? accent : ink, weight: FontWeight.w500)),
                  Text(
                    widget.cover ? [artistOf(track['artist'], '—'), ?album].join(' · ') : artistOf(track['artist'], '—'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: body(12.5, color: muted),
                  ),
                  if (widget.subtitle != null && widget.subtitle!.isNotEmpty)
                    Text('«${widget.subtitle}»', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: faint).copyWith(fontStyle: FontStyle.italic)),
                ]),
              ),
              if (track['favorite'] == true) Padding(padding: const EdgeInsets.only(left: 6), child: Icon(LucideIcons.star, size: 13, color: accent)),
              if (text(track['source']) == 'spotify') const Padding(padding: EdgeInsets.only(left: 6), child: SpotifyMark(size: 15)),
              IconButton(visualDensity: VisualDensity.compact, tooltip: tr('Ще'), onPressed: _menu, icon: Icon(LucideIcons.ellipsis, size: 20, color: muted)),
            ]),
          ),
        );
      },
    );
  }

  Future<void> _menu() async {
    await showTrackMenu(context, track, onChanged: () {
      if (mounted) setState(() {});
      widget.onChanged?.call();
    }, onRemove: widget.onRemove, removeLabel: widget.removeLabel);
  }
}

/// Пісні стовпчиками по чотири, що гортаються вбік (як «Нові пісні» й чарти в Apple Music).
class SongColumns extends StatelessWidget {
  const SongColumns({required this.tracks, this.rows = 4, this.ranked = false, this.limit = 20, super.key});
  final List<Map<String, dynamic>> tracks;
  final int rows;
  final bool ranked;
  final int limit;

  @override
  Widget build(BuildContext context) {
    final list = tracks.take(limit).toList();
    final width = math.min(MediaQuery.sizeOf(context).width * 0.84, 380.0);
    final columns = (list.length / rows).ceil();
    if (columns <= 1) {
      return Column(children: [for (var i = 0; i < list.length; i++) SongRow(tracks: list, index: i, rank: ranked ? i + 1 : null)]);
    }
    return Shelf(gap: 4, children: [
      for (var c = 0; c < columns; c++)
        SizedBox(
          width: width,
          child: Column(children: [
            for (var i = c * rows; i < math.min((c + 1) * rows, list.length); i++) SongRow(tracks: list, index: i, rank: ranked ? i + 1 : null, horizontal: 0),
          ]),
        ),
    ]);
  }
}

/// «Слухати» й «Перемішати» під заголовком сторінки (альбом, мікс, плейлист).
class PlayShuffle extends StatelessWidget {
  const PlayShuffle({required this.tracks, super.key});
  final List<Map<String, dynamic>> tracks;

  @override
  Widget build(BuildContext context) {
    if (tracks.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(gutter, 14, gutter, 4),
      child: Row(children: [
        Expanded(child: PrimaryButton(label: tr('Слухати'), icon: LucideIcons.play, onPressed: () => playTracks(context, tracks, 0))),
        const SizedBox(width: 10),
        Expanded(child: GhostButton(label: tr('Перемішати'), icon: LucideIcons.shuffle, onPressed: () => playTracks(context, tracks, math.Random().nextInt(tracks.length), shuffle: true))),
      ]),
    );
  }
}

// ───────────────────────── Меню треку ─────────────────────────

/// Меню «⋯» треку, як TrackMenu на сайті: медіатека, зірочка, плейлист, черга, станція, альбом,
/// виконавець, текст, стіна, «Слухати разом», Spotify, сайт станції, редагування й видалення.
/// [beforeNavigate] — що зробити перед переходом на іншу сторінку (плеєр «Зараз грає» згортається).
Future<void> showTrackMenu(BuildContext context, Map<String, dynamic> track, {VoidCallback? onChanged, VoidCallback? onRemove, String? removeLabel, VoidCallback? beforeNavigate}) async {
  final scope = AppScope.read(context);
  final api = scope.session.api;
  final player = scope.player;
  final source = text(track['source']) ?? 'local';
  final local = source == 'local' && intOf(track['id']) > 0;
  final radio = source == 'radio' || track['live'] == true;
  final spotify = source == 'spotify';
  final id = intOf(track['id']);
  final artist = text(track['artist']);
  final album = text(track['album']);
  final me = scope.session;
  final own = local && (intOf(track['user_id']) == me.myId || me.isAdmin || me.me?['role'] == 'moderator');

  final choice = await showGcSheet<String>(
    context,
    title: text(track['title']) ?? tr('Без назви'),
    subtitle: [artistOf(artist, '—'), ?album].join(' · '),
    builder: (sheet) {
      Widget item(String value, IconData icon, String label, {Color? color}) => SheetAction(icon: icon, label: label, color: color, onTap: () => Navigator.pop(sheet, value));
      return SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (local) ...[
            item('library', track['in_library'] == true ? LucideIcons.circleMinus : LucideIcons.circlePlus, track['in_library'] == true ? tr('Видалити з медіатеки') : tr('Додати в медіатеку')),
            item('favorite', LucideIcons.star, track['favorite'] == true ? tr('Прибрати з улюбленого') : tr('Улюблене')),
            item('playlist', LucideIcons.listPlus, tr('Додати в плейлист…')),
          ],
          if (!radio && !spotify) ...[
            item('next', LucideIcons.listStart, tr('Грати наступним')),
            item('last', LucideIcons.listEnd, tr('Грати останнім')),
          ],
          if (local) item('station', LucideIcons.radio, tr('Створити станцію')),
          if (local && album != null) item('album', LucideIcons.disc3, tr('Перейти до альбому')),
          if (!radio && artist != null && !junkMeta(artist)) item('artist', LucideIcons.userRound, tr('Перейти до виконавця')),
          item('info', LucideIcons.info, tr('Відомості про пісню')),
          if (!radio) item('lyrics', LucideIcons.fileText, tr('Переглянути текст')),
          if (!radio) item('share', LucideIcons.share2, tr('Поділитися на стіні')),
          if (local) item('together', LucideIcons.headphones, tr('Слухати разом')),
          if (spotify) item('spotify', LucideIcons.externalLink, tr('Відкрити у Spotify')),
          if (radio && text(track['homepage']) != null) item('homepage', LucideIcons.externalLink, tr('Сайт станції')),
          if (own) item('edit', LucideIcons.pencil, tr('Редагувати')),
          if (onRemove != null) item('remove', LucideIcons.listMinus, removeLabel ?? tr('Прибрати')),
          if (own) item('delete', LucideIcons.trash2, tr('Видалити з сайту'), color: dangerSoft),
        ]),
      );
    },
  );
  if (choice == null || !context.mounted) return;
  switch (choice) {
    case 'library':
      final inLibrary = track['in_library'] == true;
      try {
        if (inLibrary) {
          await api.delete(Api.site('/music/tracks/$id/library'));
        } else {
          await api.post(Api.site('/music/tracks/$id/library'));
        }
        track['in_library'] = !inLibrary;
        if (inLibrary) track['favorite'] = false;
        player.markTrack(id, inLibrary: !inLibrary, favorite: inLibrary ? false : null);
        onChanged?.call();
        if (context.mounted) toast(context, inLibrary ? tr('Видалено з медіатеки.') : tr('Додано в медіатеку.'));
      } catch (e) {
        if (context.mounted) toast(context, e);
      }
    case 'favorite':
      await toggleFavorite(context, track);
      onChanged?.call();
    case 'playlist':
      await addToPlaylist(context, track);
    case 'next' || 'last':
      await player.enqueue(track, next: choice == 'next');
      if (context.mounted) toast(context, choice == 'next' ? tr('Трек буде наступним.') : tr('Трек гратиме останнім.'));
    case 'station':
      await startStation(context, 'track:$id');
    case 'album' || 'artist':
      final router = GoRouter.of(context);
      beforeNavigate?.call();
      router.push(choice == 'album' ? albumPath(artist ?? '', album ?? '') : artistPath(artist ?? ''));
    case 'info':
      await showSongInfo(context, track, beforeNavigate: beforeNavigate);
    case 'lyrics':
      await showLyricsSheet(context, track);
    case 'share':
      await shareToWall(context, track);
    case 'together':
      beforeNavigate?.call();
      await startListening(context, trackId: id);
    case 'spotify' || 'homepage':
      final link = choice == 'homepage' ? text(track['homepage']) : (text(track['url']) ?? 'https://open.spotify.com/track/${track['id']}');
      if (link != null) await launchUrl(Uri.parse(link), mode: LaunchMode.externalApplication);
    case 'edit':
      final card = await editTrackSheet(context, track);
      if (card != null) {
        track.addAll(card);
        player.updateMeta(card);
        onChanged?.call();
      }
    case 'remove':
      onRemove?.call();
    case 'delete':
      if (!await confirm(context, tr('Видалити «{title}» з GameCon?', {'title': text(track['title']) ?? ''}), text: tr('Він зникне в усіх, хто додав його собі.'), action: tr('Видалити'), danger: true)) return;
      if (!context.mounted) return;
      if (await attempt(context, () => api.delete(Api.site('/music/tracks/$id')), success: tr('Трек видалено.'))) onChanged?.call();
  }
}

/// Зірочка «Улюблене»: трек одразу потрапляє й у медіатеку.
Future<void> toggleFavorite(BuildContext context, Map<String, dynamic> track) async {
  final scope = AppScope.read(context);
  final id = intOf(track['id']);
  final on = track['favorite'] == true;
  try {
    final result = on ? await scope.session.api.delete(Api.site('/music/tracks/$id/favorite')) : await scope.session.api.post(Api.site('/music/tracks/$id/favorite'));
    track['favorite'] = result['favorite'] == true;
    track['in_library'] = result['in_library'] == true;
    scope.player.markTrack(id, favorite: track['favorite'] as bool, inLibrary: track['in_library'] as bool);
    if (context.mounted) toast(context, on ? tr('Прибрано з «Улюбленого».') : tr('Додано в «Улюблене».'));
  } catch (e) {
    if (context.mounted) toast(context, e);
  }
}

/// «Додати в плейлист…»: свої плейлисти й ті, де людина співавтор, або новий.
Future<void> addToPlaylist(BuildContext context, Map<String, dynamic> track) async {
  final api = AppScope.read(context).session.api;
  var playlists = <Map<String, dynamic>>[];
  try {
    playlists = maps((await api.get(Api.site('/music/playlists/mine')))['playlists']);
  } catch (_) {}
  if (!context.mounted) return;
  final picked = await showGcSheet<int>(
    context,
    title: tr('Додати в плейлист…'),
    builder: (sheet) => SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        SheetAction(icon: LucideIcons.plus, label: tr('Новий плейлист…'), onTap: () => Navigator.pop(sheet, -1)),
        for (final p in playlists) SheetAction(icon: LucideIcons.listMusic, label: text(p['title']) ?? '', onTap: () => Navigator.pop(sheet, intOf(p['id']))),
      ]),
    ),
  );
  if (picked == null || !context.mounted) return;
  final id = picked == -1 ? await editPlaylist(context) : picked;
  if (id == null || id == 0 || !context.mounted) return;
  final title = text(playlists.where((p) => intOf(p['id']) == id).firstOrNull?['title']) ?? tr('плейлист');
  try {
    final result = await api.post(Api.site('/music/playlists/$id/tracks/${track['id']}'));
    if (context.mounted) toast(context, result['added'] == false ? tr('Трек уже є в «{title}».', {'title': title}) : tr('Додано в «{title}».', {'title': title}));
  } catch (e) {
    if (context.mounted) toast(context, e);
  }
}

/// Текст пісні: свій трек — з нашого каталогу (сервер сам дошукає), інший (Spotify) — пошук за назвою.
// ───────────────────────── Відомості про пісню ─────────────────────────

/// Назви кодеків для людей, як на сайті (song-info.tsx): «flac» → «FLAC», «alac» → «Apple Lossless (ALAC)».
String codecName(String codec) {
  if (codec.startsWith('pcm_')) return tr('PCM (без стиснення)');
  return switch (codec) {
    'flac' => 'FLAC',
    'alac' => 'Apple Lossless (ALAC)',
    'aac' => 'AAC',
    'mp3' => 'MP3',
    'opus' => 'Opus',
    'vorbis' => 'Ogg Vorbis',
    'ape' => 'Monkey’s Audio',
    'wavpack' => 'WavPack',
    'wmav2' => 'WMA',
    'ac3' => 'Dolby Digital (AC-3)',
    'eac3' => 'Dolby Digital Plus',
    _ => codec.toUpperCase(),
  };
}

/// Рядок формату: «FLAC · 96 кГц · 24 біт · стерео».
String? formatLine(dynamic audio) {
  if (audio is! Map || text(audio['codec']) == null) return null;
  final rate = intOf(audio['sample_rate']), depth = intOf(audio['bit_depth']), bitrate = intOf(audio['bitrate']), channels = intOf(audio['channels']);
  final khz = (rate / 1000).toStringAsFixed(rate % 1000 == 0 ? 0 : 1).replaceAll('.', ',');
  return [
    codecName(text(audio['codec'])!),
    if (rate > 0) tr('{n} кГц', {'n': khz}),
    if (depth > 0) tr('{n} біт', {'n': depth}),
    if (bitrate > 0) tr('{n} кбіт/с', {'n': bitrate}),
    if (channels > 0) channels == 1 ? tr('моно') : (channels == 2 ? tr('стерео') : tr('{n} каналів', {'n': channels})),
  ].join(' · ');
}

/// «Відомості про пісню», як в Apple Music: альбом, рік, жанр, тривалість, формат звуку, прослуховування.
Future<void> showSongInfo(BuildContext context, Map<String, dynamic> track, {VoidCallback? beforeNavigate}) {
  final source = text(track['source']) ?? 'local';
  final local = source == 'local';
  final artist = text(track['artist']) ?? '';
  final album = text(track['album']);
  final homepage = text(track['homepage']);
  final format = local ? formatLine(track['audio']) : null;
  final router = GoRouter.maybeOf(context);
  return showGcSheet<void>(
    context,
    builder: (sheet) {
      Widget row(String label, Widget value) => Container(
            padding: const EdgeInsets.symmetric(vertical: 11),
            decoration: BoxDecoration(border: Border(bottom: BorderSide(color: line))),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: body(14, color: muted)),
              const SizedBox(width: 16),
              Expanded(child: Align(alignment: Alignment.centerRight, child: value)),
            ]),
          );
      Text value(String v) => Text(v, textAlign: TextAlign.right, style: body(14.5));
      Widget link(String v, VoidCallback onTap) => GestureDetector(onTap: onTap, child: Text(v, textAlign: TextAlign.right, style: body(14.5, color: accent, weight: FontWeight.w600)));
      Future<void> open(String url) => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      final seconds = intOf(track['duration']);
      final plays = intOf(track['plays_count']);
      return Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            SizedBox(width: 72, child: Artwork(url: text(track['cover_url']), seed: trackKey(track), radius: 10, icon: source == 'radio' ? LucideIcons.radio : LucideIcons.music)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(text(track['title']) ?? tr('Без назви'), maxLines: 2, overflow: TextOverflow.ellipsis, style: display(17)),
                Text(artistOf(artist, '—'), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, color: muted)),
                if (local && QualityBadge.label(text(track['quality'])) != null) Padding(padding: const EdgeInsets.only(top: 6), child: QualityBadge(text(track['quality']))),
              ]),
            ),
          ]),
          const SizedBox(height: 8),
          if (album != null)
            row(
              tr('Альбом'),
              router == null
                  ? value(album)
                  : link(album, () {
                      Navigator.pop(sheet);
                      beforeNavigate?.call();
                      router.push(albumPath(artist, album));
                    }),
            ),
          if (local && track['year'] != null) row(tr('Рік'), value('${track['year']}')),
          if (text(track['genre']) != null) row(tr('Жанр'), value(text(track['genre'])!)),
          if (seconds > 0) row(tr('Тривалість'), value(duration(seconds))),
          if (format != null) row(tr('Формат'), value(format)),
          if (local && plays > 0) row(tr('Прослуховувань'), value('$plays')),
          if (source == 'spotify') row(tr('Джерело'), link('Spotify', () => open(text(track['url']) ?? 'https://open.spotify.com/track/${track['id']}'))),
          if (homepage != null) row(tr('Сайт станції'), link(Uri.tryParse(homepage)?.host ?? homepage, () => open(homepage))),
        ]),
      );
    },
  );
}

Future<Lyrics?> fetchLyrics(Api api, {int? id, required String artist, required String title, int seconds = 0}) async {
  final data = id != null && id > 0
      ? await api.get(Api.site('/music/tracks/$id/lyrics'))
      : await api.get(Api.site('/music/lyrics/find?${Uri(queryParameters: {'artist': artist, 'title': title, if (seconds > 0) 'duration': '$seconds'}).query}'));
  final raw = data['lyrics'] is String ? data['lyrics'] as String : '';
  final source = raw.trim();
  return source.isEmpty ? null : parseLyrics(source, raw: raw);
}

Future<void> showLyricsSheet(BuildContext context, Map<String, dynamic> track) {
  final api = AppScope.read(context).session.api;
  final local = (text(track['source']) ?? 'local') == 'local';
  final future = fetchLyrics(api, id: local ? intOf(track['id']) : null, artist: text(track['artist']) ?? '', title: text(track['title']) ?? '', seconds: intOf(track['duration']));
  return showGcSheet<void>(
    context,
    title: text(track['title']) ?? tr('Текст пісні'),
    subtitle: artistOf(track['artist'], '—'),
    height: MediaQuery.sizeOf(context).height * 0.75,
    builder: (sheet) => FutureBuilder<Lyrics?>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator(strokeWidth: 2));
        final lyrics = snapshot.data;
        if (lyrics == null) return NoLyrics(color: muted);
        return SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          child: Text(lyrics.lines.map((l) => l.text).join('\n'), style: body(16, color: soft).copyWith(height: 1.6)),
        );
      },
    ),
  );
}

class NoLyrics extends StatelessWidget {
  const NoLyrics({required this.color, super.key});
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(LucideIcons.micVocal, size: 34, color: color),
          const SizedBox(height: 12),
          Text(tr('Тексту поки немає'), style: display(18, color: color)),
          const SizedBox(height: 6),
          Text(tr('Для цієї пісні текст ще не додали.'), textAlign: TextAlign.center, style: body(13.5, color: color.withValues(alpha: 0.8))),
        ]),
      ),
    );
  }
}

/// «Поділитися на стіні»: запис із треком і необов’язковим підписом.
Future<void> shareToWall(BuildContext context, Map<String, dynamic> track) {
  return showGcSheet<void>(
    context,
    title: tr('Поділитися на стіні'),
    subtitle: '${text(track['title']) ?? ''} · ${artistOf(track['artist'], '—')}',
    builder: (sheet) => _ShareForm(track: track, onDone: () => Navigator.pop(sheet)),
  );
}

class _ShareForm extends StatefulWidget {
  const _ShareForm({required this.track, required this.onDone});
  final Map<String, dynamic> track;
  final VoidCallback onDone;

  @override
  State<_ShareForm> createState() => _ShareFormState();
}

class _ShareFormState extends State<_ShareForm> {
  final input = TextEditingController();
  bool busy = false;

  @override
  void dispose() {
    input.dispose();
    super.dispose();
  }

  Future<void> _post() async {
    setState(() => busy = true);
    try {
      await AppScope.read(context).session.api.upload('/api/v1/posts', {'body': input.text.trim(), 'visibility': 'public', ...musicFields(widget.track)}, []);
      if (mounted) toast(context, tr('Запис опубліковано на вашій стіні.'));
      widget.onDone();
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        MusicAttachment(track: widget.track),
        const SizedBox(height: 12),
        GcField(controller: input, label: tr('Що скажете про трек?'), maxLines: 4, minLines: 2),
        const SizedBox(height: 14),
        PrimaryButton(label: tr('Опублікувати'), icon: LucideIcons.send, busy: busy, onPressed: _post),
      ]),
    );
  }
}

/// Рядок-посилання медіатеки (Плейлисти, Виконавці…): іконка в акценті, назва, лічильник, шеврон.
class LinkRow extends StatelessWidget {
  const LinkRow({required this.icon, required this.label, this.count, required this.onTap, super.key});
  final IconData icon;
  final String label;
  final int? count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: gutter, vertical: 12),
        child: Row(children: [
          Icon(icon, size: 22, color: accent),
          const SizedBox(width: 14),
          Expanded(child: Text(label, style: body(17, weight: FontWeight.w500))),
          if (count != null) Text('$count', style: body(15, color: muted)),
          const SizedBox(width: 4),
          Icon(LucideIcons.chevronRight, size: 18, color: faint),
        ]),
      ),
    );
  }
}

/// Порожній розділ з поясненням.
class MusicEmpty extends StatelessWidget {
  const MusicEmpty({required this.icon, required this.title, this.text, super.key});
  final IconData icon;
  final String title;
  final String? text;

  @override
  Widget build(BuildContext context) {
    return Padding(padding: const EdgeInsets.fromLTRB(gutter, 24, gutter, 0), child: EmptyState(icon: icon, title: title, text: text));
  }
}
