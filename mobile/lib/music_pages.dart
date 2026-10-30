import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'downloads.dart';
import 'feed.dart';
import 'i18n.dart';
import 'music.dart';
import 'music_home.dart';
import 'music_ui.dart';
import 'offline_music.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';
import 'skeletons.dart';

// Сторінки розділу «Музика», як на сайті (pages/music/*): виконавець, альбом, мікс, жанр, чарти,
// Replay, розділи медіатеки й пошук. Дані — з мосту /api/v1/site/music/*.

Widget _page(BuildContext context, String path, Widget Function(Map<String, dynamic> data, Future<void> Function() reload) builder) {
  return Remote(load: () => AppScope.read(context).session.api.get(Api.site(path)), builder: builder);
}

String _songs(int n) => tr('{n} пісень', {'n': n});

// ───────────────────────── Виконавець ─────────────────────────

class ArtistScreen extends StatelessWidget {
  const ArtistScreen({required this.name, super.key});
  final String name;

  @override
  Widget build(BuildContext context) {
    return _page(context, '/music/artist?${Uri(queryParameters: {'name': name}).query}', (data, reload) {
      final artist = mapOf(data['artist']);
      final top = maps(artist['top_songs']);
      final albums = maps(artist['albums']);
      final singles = maps(artist['singles']);
      final similar = maps(artist['similar']);
      final latest = artist['latest'] is Map ? mapOf(artist['latest']) : null;
      final station = mapOf(artist['station']);
      return MusicList(onRefresh: reload, children: [
        _ArtistHero(artist: artist, tracks: top),
        if (latest != null) ...[
          SectionHeader(tr('Останній реліз')),
          _LatestRelease(track: latest),
        ],
        if (top.isNotEmpty) ...[
          SectionHeader(tr('Топ-пісні')),
          SongColumns(tracks: top),
        ],
        if (albums.isNotEmpty) ...[
          SectionHeader(tr('Альбоми')),
          Shelf(children: [for (final a in albums) AlbumTile(album: a, showYear: true)]),
        ],
        if (singles.isNotEmpty) ...[
          SectionHeader(tr('Сингли та EP')),
          Shelf(children: [for (var i = 0; i < singles.length; i++) TrackTile(tracks: singles, index: i, subtitle: singles[i]['year'] == null ? null : '${singles[i]['year']}')]),
        ],
        if (station.isNotEmpty) ...[
          SectionHeader(tr('Станція')),
          Padding(padding: const EdgeInsets.symmetric(horizontal: gutter), child: StationTile(station: station, width: double.infinity, aspect: 2.4)),
        ],
        if (similar.isNotEmpty) ...[
          SectionHeader(tr('Схожі виконавці')),
          Shelf(children: [for (final a in similar) ArtistTile(artist: a)]),
        ],
        _ArtistAbout(name: text(artist['name']) ?? name, listeners: intOf(artist['listeners'])),
        if (intOf(artist['tracks_count']) > 0)
          Padding(padding: const EdgeInsets.fromLTRB(gutter, 18, gutter, 0), child: Text(tr('{n} пісень у GameCon', {'n': artist['tracks_count']}), style: body(13, color: muted))),
      ]);
    });
  }
}

/// Шапка виконавця: фото на всю ширину, ім’я поверх, «Перемішати» й «Слухати».
class _ArtistHero extends StatefulWidget {
  const _ArtistHero({required this.artist, required this.tracks});
  final Map<String, dynamic> artist;
  final List<Map<String, dynamic>> tracks;

  @override
  State<_ArtistHero> createState() => _ArtistHeroState();
}

class _ArtistHeroState extends State<_ArtistHero> {
  /// Фото з «Про виконавця» (Spotify/Вікіпедія) краще за обкладинку треку.
  String? photo;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _info());
  }

  Future<void> _info() async {
    final info = await artistInfo(AppScope.read(context).session.api, text(widget.artist['name']) ?? '');
    if (mounted && info != null) setState(() => photo = text(info['image_url']));
  }

  @override
  Widget build(BuildContext context) {
    final name = text(widget.artist['name']) ?? '';
    final image = photo ?? text(widget.artist['cover_url']);
    final tracks = widget.tracks;
    return Padding(
      padding: const EdgeInsets.fromLTRB(gutter, 0, gutter, 0),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Align(alignment: Alignment.centerLeft, child: RoundIcon(icon: LucideIcons.chevronLeft, tooltip: tr('Назад'), onTap: () => context.pop())),
        const SizedBox(height: 10),
        AspectRatio(
          aspectRatio: 1.1,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: Stack(fit: StackFit.expand, children: [
              image == null ? MusicPlaceholder(seed: name, icon: LucideIcons.micVocal, iconSize: 64) : NetImage(image),
              const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x00000000), Color(0xB3000000)], stops: [0.45, 1]))),
              Positioned(
                left: 16,
                right: 16,
                bottom: 14,
                child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                      Text(name, maxLines: 2, overflow: TextOverflow.ellipsis, style: display(30, color: Colors.white).copyWith(letterSpacing: -0.6)),
                      if (text(widget.artist['genre']) != null) Text(text(widget.artist['genre'])!, style: body(13, color: Colors.white70)),
                    ]),
                  ),
                  if (tracks.length > 1) ...[
                    _HeroButton(icon: LucideIcons.shuffle, label: tr('Перемішати'), onTap: () => playTracks(context, tracks, math.Random().nextInt(tracks.length), shuffle: true)),
                    const SizedBox(width: 10),
                  ],
                  _HeroButton(
                    icon: LucideIcons.play,
                    label: tr('Слухати'),
                    filled: true,
                    // Немає треків у каталозі — вмикаємо станцію виконавця.
                    onTap: () => tracks.isEmpty ? startStation(context, 'artist:$name') : playTracks(context, tracks, 0),
                  ),
                ]),
              ),
            ]),
          ),
        ),
      ]),
    );
  }
}

class _HeroButton extends StatelessWidget {
  const _HeroButton({required this.icon, required this.label, required this.onTap, this.filled = false});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: label,
      child: Semantics(
        button: true,
        label: label,
        child: InkResponse(
          onTap: onTap,
          radius: 28,
          child: Container(
            width: filled ? 52 : 44,
            height: filled ? 52 : 44,
            decoration: BoxDecoration(shape: BoxShape.circle, color: filled ? primary : Colors.white.withValues(alpha: 0.2)),
            child: Icon(icon, color: Colors.white, size: filled ? 24 : 20),
          ),
        ),
      ),
    );
  }
}

class _LatestRelease extends StatelessWidget {
  const _LatestRelease({required this.track});
  final Map<String, dynamic> track;

  @override
  Widget build(BuildContext context) {
    final album = text(track['album']);
    return InkWell(
      onTap: () => album == null ? playTracks(context, [track], 0) : context.push(albumPath(text(track['artist']) ?? '', album)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: gutter),
        child: Row(children: [
          SizedBox(width: 96, child: Artwork(url: text(track['cover_url']), seed: trackKey(track))),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(track['year'] == null ? tr('Останній реліз') : '${track['year']}', style: body(12, color: muted, weight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text(album ?? text(track['title']) ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(16, weight: FontWeight.w700)),
              Text(album == null ? tr('Сингл') : text(track['title']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(13, color: muted)),
            ]),
          ),
          IconButton(tooltip: tr('Ще'), onPressed: () => showTrackMenu(context, track), icon: Icon(LucideIcons.ellipsis, color: muted)),
        ]),
      ),
    );
  }
}

final _artistInfo = <String, Map<String, dynamic>?>{};

/// «Про виконавця» — окремим запитом (зовнішні джерела повільні); відповідь пам’ятаємо.
Future<Map<String, dynamic>?> artistInfo(Api api, String name) async {
  if (_artistInfo.containsKey(name)) return _artistInfo[name];
  try {
    final data = await api.get(Api.site('/music/artist/info?${Uri(queryParameters: {'name': name}).query}'));
    return _artistInfo[name] = data['info'] is Map ? mapOf(data['info']) : null;
  } catch (_) {
    return null;
  }
}

class _ArtistAbout extends StatefulWidget {
  const _ArtistAbout({required this.name, required this.listeners});
  final String name;
  final int listeners;

  @override
  State<_ArtistAbout> createState() => _ArtistAboutState();
}

class _ArtistAboutState extends State<_ArtistAbout> {
  Map<String, dynamic>? info;
  bool open = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final found = await artistInfo(AppScope.read(context).session.api, widget.name);
      if (mounted) setState(() => info = found);
    });
  }

  @override
  Widget build(BuildContext context) {
    final data = info ?? const <String, dynamic>{};
    final bio = text(data['bio']);
    final genres = [for (final g in (data['genres'] as List? ?? const [])) '$g'].join(', ');
    final facts = <(IconData, String, String)>[
      if (text(data['origin']) != null) (LucideIcons.mapPin, text(data['born']) != null ? tr('Місце народження') : tr('Звідки'), text(data['origin'])!),
      if (text(data['born']) != null) (LucideIcons.cake, tr('Дата народження'), text(data['born'])!),
      if (text(data['formed']) != null) (LucideIcons.calendar, tr('Засновано'), text(data['formed'])!),
      if (genres.isNotEmpty) (LucideIcons.music2, tr('Жанр'), genres),
      if (intOf(data['followers']) > 0) (LucideIcons.users, tr('Підписники у Spotify'), compact(data['followers'])),
      if (widget.listeners > 0) (LucideIcons.headphones, tr('Слухачів у GameCon за місяць'), compact(widget.listeners)),
    ];
    if (bio == null && facts.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SectionHeader(tr('Про виконавця {name}', {'name': widget.name})),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: gutter),
        child: Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (bio != null) ...[
              Text(bio, maxLines: open ? null : 5, overflow: open ? null : TextOverflow.ellipsis, style: body(14.5, color: soft).copyWith(height: 1.5)),
              Row(children: [
                TextButton(onPressed: () => setState(() => open = !open), child: Text(open ? tr('Згорнути') : tr('Ще'), style: body(13.5, color: accent, weight: FontWeight.w600))),
                const Spacer(),
                if (text(data['bio_url']) != null)
                  TextButton(onPressed: () => launchUrl(Uri.parse(text(data['bio_url'])!), mode: LaunchMode.externalApplication), child: Text(tr('Джерело: Вікіпедія'), style: body(12, color: muted))),
              ]),
            ],
            for (final (icon, label, value) in facts)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(icon, size: 18, color: accent),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(label, style: body(12, color: muted)),
                      Text(value, style: body(14.5, weight: FontWeight.w600)),
                    ]),
                  ),
                ]),
              ),
            if (text(data['spotify_url']) != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: GhostButton(label: tr('Відкрити у Spotify'), icon: LucideIcons.externalLink, onPressed: () => launchUrl(Uri.parse(text(data['spotify_url'])!), mode: LaunchMode.externalApplication)),
              ),
          ]),
        ),
      ),
    ]);
  }
}

// ───────────────────────── Альбом ─────────────────────────

class MusicAlbumScreen extends StatelessWidget {
  const MusicAlbumScreen({required this.artist, required this.title, super.key});
  final String artist;
  final String title;

  @override
  Widget build(BuildContext context) {
    return _page(context, '/music/album?${Uri(queryParameters: {'artist': artist, 'title': title}).query}', (data, reload) {
      final album = mapOf(data['album']);
      final tracks = maps(album['tracks']);
      final more = maps(album['more_by']);
      final meta = [text(album['genre']), if (album['year'] != null) '${album['year']}'].whereType<String>().join(' · ');
      return MusicList(onRefresh: reload, children: [
        const LargeTitle('', back: true),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 48),
          child: DecoratedBox(
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), boxShadow: const [BoxShadow(color: Color(0x66000000), blurRadius: 40, offset: Offset(0, 18), spreadRadius: -16)]),
            child: Artwork(url: text(album['cover_url']), seed: '$artist|$title', radius: 12, icon: LucideIcons.disc3),
          ),
        ),
        const SizedBox(height: 16),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: gutter),
          child: Column(children: [
            Text(text(album['title']) ?? title, textAlign: TextAlign.center, style: display(22)),
            const SizedBox(height: 2),
            GestureDetector(onTap: () => context.push(artistPath(text(album['artist']) ?? artist)), child: Text(text(album['artist']) ?? artist, style: body(18, color: accent))),
            if (meta.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(meta, style: body(12.5, color: muted))),
            if (QualityBadge.label(text(album['quality'])) != null) Padding(padding: const EdgeInsets.only(top: 8), child: QualityBadge(text(album['quality']))),
          ]),
        ),
        PlayShuffle(tracks: tracks),
        Padding(
          padding: const EdgeInsets.fromLTRB(gutter, 8, gutter, 0),
          child: Center(
            child: CollectionDownloadButton(
              collectionKey: albumDownloadKey(text(album['artist']) ?? artist, text(album['title']) ?? title),
              kind: 'album',
              title: text(album['title']) ?? title,
              subtitle: text(album['artist']) ?? artist,
              coverUrl: text(album['cover_url']),
              path: albumPath(artist, title),
              tracks: tracks,
            ),
          ),
        ),
        const SizedBox(height: 8),
        for (var i = 0; i < tracks.length; i++) SongRow(tracks: tracks, index: i, rank: intOf(tracks[i]['track_no'], i + 1), cover: false, onChanged: reload),
        Padding(
          padding: const EdgeInsets.fromLTRB(gutter, 14, gutter, 0),
          child: Text(tr('{n} пісень, {length}', {'n': tracks.length, 'length': minutesLabel(album['duration'])}), style: body(13, color: muted)),
        ),
        if (more.isNotEmpty) ...[
          SectionHeader(tr('Ще від: {artist}', {'artist': text(album['artist']) ?? artist})),
          Shelf(children: [for (final a in more) AlbumTile(album: a, showYear: true)]),
        ],
      ]);
    });
  }
}

// ───────────────────────── Мікс, жанр, чарти ─────────────────────────

class MixScreen extends StatelessWidget {
  const MixScreen({required this.mixKey, super.key});
  final String mixKey;

  @override
  Widget build(BuildContext context) {
    return _page(context, '/music/mix/$mixKey', (data, reload) {
      final mix = mapOf(data['mix']);
      final tracks = maps(data['tracks']);
      final (title, subtitle) = mixTitle(mixKey);
      final colors = [for (final c in (mix['colors'] as List? ?? const [])) hexColor(c, primary)];
      return MusicList(onRefresh: reload, children: [
        const LargeTitle('', back: true),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 48),
          child: MixArt(colors: colors.isEmpty ? [primary] : colors, covers: coversOf(mix['covers']), label: title),
        ),
        const SizedBox(height: 14),
        Center(child: Text(title, style: display(22))),
        Center(child: Padding(padding: const EdgeInsets.only(top: 4), child: Text(subtitle, style: body(13.5, color: muted)))),
        PlayShuffle(tracks: tracks),
        const SizedBox(height: 8),
        for (var i = 0; i < tracks.length; i++) SongRow(tracks: tracks, index: i, onChanged: reload),
      ]);
    });
  }
}

class GenreScreen extends StatelessWidget {
  const GenreScreen({required this.name, super.key});
  final String name;

  @override
  Widget build(BuildContext context) {
    return _page(context, '/music/genre?${Uri(queryParameters: {'name': name}).query}', (data, reload) {
      final genre = mapOf(data['genre']);
      final popular = maps(genre['popular']);
      final latest = maps(genre['latest']);
      final albums = maps(genre['albums']);
      return MusicList(onRefresh: reload, children: [
        LargeTitle(text(genre['name']) ?? name, back: true),
        Padding(
          padding: const EdgeInsets.fromLTRB(gutter, 10, gutter, 0),
          child: PrimaryButton(label: tr('Станція жанру'), icon: LucideIcons.radio, onPressed: () => startStation(context, 'genre:$name')),
        ),
        if (popular.isNotEmpty) ...[SectionHeader(tr('Популярне')), SongColumns(tracks: popular)],
        if (latest.isNotEmpty) ...[SectionHeader(tr('Новинки')), SongColumns(tracks: latest)],
        if (albums.isNotEmpty) ...[SectionHeader(tr('Альбоми')), Shelf(children: [for (final a in albums) AlbumTile(album: a)])],
      ]);
    });
  }
}

class ChartsScreen extends StatefulWidget {
  const ChartsScreen({super.key});

  @override
  State<ChartsScreen> createState() => _ChartsScreenState();
}

class _ChartsScreenState extends State<ChartsScreen> {
  String scope = 'week';

  @override
  Widget build(BuildContext context) {
    return _page(context, '/music/charts', (data, reload) {
      final charts = mapOf(data['charts']);
      final country = text(charts['country_name']);
      final tracks = maps(charts[scope == 'country' ? 'country' : 'week']);
      return MusicList(onRefresh: reload, children: [
        LargeTitle(tr('Чарти'), back: true),
        if (country != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(gutter, 10, gutter, 0),
            child: Segmented(
              options: [SegmentOption('week', tr('Топ-100: GameCon')), SegmentOption('country', tr('Топ-50: {country}', {'country': country}))],
              selected: scope,
              onSelect: (v) => setState(() => scope = v),
            ),
          ),
        PlayShuffle(tracks: tracks),
        const SizedBox(height: 6),
        if (tracks.isEmpty) MusicEmpty(icon: LucideIcons.chartNoAxesColumn, title: tr('Чарт поки порожній'), text: tr('Слухайте музику — чарт складається з того, що грає найчастіше за тиждень.')),
        for (var i = 0; i < tracks.length; i++) SongRow(tracks: tracks, index: i, rank: i + 1),
      ]);
    });
  }
}

// ───────────────────────── Replay ─────────────────────────

class ReplayScreen extends StatelessWidget {
  const ReplayScreen({this.year, super.key});
  final int? year;

  @override
  Widget build(BuildContext context) {
    final months = [tr('Січень'), tr('Лютий'), tr('Березень'), tr('Квітень'), tr('Травень'), tr('Червень'), tr('Липень'), tr('Серпень'), tr('Вересень'), tr('Жовтень'), tr('Листопад'), tr('Грудень')];
    return _page(context, '/music/replay${year == null ? '' : '/$year'}', (data, reload) {
      final replay = mapOf(data['replay']);
      final current = intOf(replay['year'], year ?? DateTime.now().year);
      final years = [for (final y in (replay['years'] as List? ?? const [])) intOf(y)];
      final tracks = maps(replay['tracks']);
      final artists = maps(replay['artists']);
      return MusicList(onRefresh: reload, children: [
        LargeTitle(tr('Replay {year}', {'year': current}), back: true, subtitle: tr('Твої найчастіші пісні року')),
        if (years.length > 1)
          Padding(
            padding: const EdgeInsets.fromLTRB(gutter, 10, gutter, 0),
            child: ChipRowYears(years: years, selected: current, onSelect: (y) => context.pushReplacement('/music/replay/$y')),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(gutter, 14, gutter, 0),
          child: Row(children: [
            Expanded(child: MetricTile(icon: LucideIcons.clock, label: tr('Хвилин'), value: compact(replay['minutes']))),
            const SizedBox(width: 10),
            Expanded(child: MetricTile(icon: LucideIcons.play, label: tr('Прослуховувань'), value: compact(replay['plays']))),
          ]),
        ),
        if (tracks.isEmpty) MusicEmpty(icon: LucideIcons.history, title: tr('Ще нічого не прослухано'), text: tr('Слухайте музику на GameCon — Replay збере ваші найчастіші пісні.')),
        if (tracks.isNotEmpty) ...[
          PlayShuffle(tracks: tracks),
          SectionHeader(tr('Топ-пісні')),
          for (var i = 0; i < tracks.length; i++) SongRow(tracks: tracks, index: i, rank: i + 1),
        ],
        if (artists.isNotEmpty) ...[
          SectionHeader(tr('Топ-виконавці')),
          Shelf(children: [for (final a in artists) ArtistTile(artist: a)]),
        ],
        for (final month in maps(replay['months']).reversed) ...[
          SectionHeader(months[(intOf(month['month'], 1) - 1).clamp(0, 11)]),
          SongColumns(tracks: maps(month['tracks']), ranked: true),
        ],
      ]);
    });
  }
}

/// Перемикач років Replay.
class ChipRowYears extends StatelessWidget {
  const ChipRowYears({required this.years, required this.selected, required this.onSelect, super.key});
  final List<int> years;
  final int selected;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return Wrap(spacing: 8, runSpacing: 8, children: [
      for (final y in years.reversed) SelectPill(label: '$y', selected: y == selected, onTap: () => onSelect(y)),
    ]);
  }
}

// ───────────────────────── Медіатека: розділ ─────────────────────────

class LibrarySectionScreen extends StatefulWidget {
  const LibrarySectionScreen({required this.section, super.key});
  final String section;

  @override
  State<LibrarySectionScreen> createState() => _LibrarySectionScreenState();
}

class _LibrarySectionScreenState extends State<LibrarySectionScreen> {
  final query = TextEditingController();
  Timer? debounce;
  String sort = 'added';
  Map<String, dynamic>? page;
  final songs = <Map<String, dynamic>>[];
  int current = 0;
  bool more = false;
  bool loading = true;
  Object? error;

  bool get songList => widget.section == 'songs' || widget.section == 'favorites';

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
    if (reset) {
      setState(() => loading = true);
      current = 0;
    }
    final params = {if (songList) 'sort': sort, if (songList && query.text.trim().isNotEmpty) 'q': query.text.trim(), if (songList) 'page': '${current + 1}'};
    try {
      final data = await AppScope.read(context).session.api.get(Api.site('/music/library/${widget.section}${params.isEmpty ? '' : '?${Uri(queryParameters: params).query}'}'));
      final listing = Listing.parse(data['songs']);
      if (!mounted) return;
      setState(() {
        page = data;
        error = null;
        if (reset) songs.clear();
        songs.addAll(listing.items);
        current = listing.current;
        more = listing.more;
      });
    } catch (e) {
      if (mounted) setState(() => error = e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = page;
    final (label, icon) = librarySection(widget.section);
    final title = widget.section == 'favorites' ? tr('Улюблені пісні') : label;
    if (data == null) {
      return error == null
          ? const ListSkeleton(rows: 6)
          : Center(child: Padding(padding: const EdgeInsets.all(20), child: EmptyState(icon: icon, title: tr('Не вдалося завантажити'), text: '$error', action: tr('Спробувати знову'), onAction: () => _load(reset: true))));
    }
    final items = maps(data['items']);
    Future<void> reload() => _load(reset: true);
    final children = <Widget>[
      LargeTitle(title, back: true, actions: [
        if (widget.section == 'playlists')
          RoundIcon(icon: LucideIcons.plus, tooltip: tr('Новий плейлист'), onTap: () async {
            final id = await editPlaylist(context);
            if (id != null && id > 0 && context.mounted) {
              await context.push('/music/playlists/$id');
              await reload();
            }
          }),
        if (songList)
          RoundIcon(icon: LucideIcons.upload, tooltip: tr('Завантажити музику'), onTap: () async {
            if (await uploadTrack(context)) await reload();
          }),
      ]),
    ];
    switch (widget.section) {
      case 'songs' || 'favorites':
        children.addAll([
          Padding(
            padding: const EdgeInsets.fromLTRB(gutter, 10, gutter, 0),
            child: GcField(
              controller: query,
              label: widget.section == 'favorites' ? tr('Шукати в улюблених') : tr('Шукати в піснях'),
              icon: LucideIcons.search,
              dense: true,
              onChanged: (_) {
                debounce?.cancel();
                debounce = Timer(const Duration(milliseconds: 350), reload);
              },
            ),
          ),
          SizedBox(
            height: 46,
            child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.fromLTRB(gutter, 8, gutter, 0), children: [
              for (final (value, name) in [('added', tr('Нещодавно додані')), ('title', tr('Назва')), ('artist', tr('Виконавець')), ('plays', tr('Найпопулярніші'))])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: SelectPill(label: name, selected: sort == value, onTap: () {
                    setState(() => sort = value);
                    reload();
                  }),
                ),
            ]),
          ),
          PlayShuffle(tracks: songs),
          const SizedBox(height: 6),
          if (loading && songs.isEmpty)
            const ListSkeleton(rows: 5)
          else if (songs.isEmpty)
            MusicEmpty(
              icon: widget.section == 'favorites' ? LucideIcons.star : LucideIcons.music,
              title: widget.section == 'favorites' ? tr('Немає улюблених пісень') : (query.text.isEmpty ? tr('Тут поки тихо') : tr('Нічого не знайдено')),
              text: widget.section == 'favorites' ? tr('Позначайте пісні зірочкою — вони з’являться тут.') : tr('Додавайте пісні в медіатеку через меню «⋯» або завантажте свої.'),
            )
          else ...[
            for (var i = 0; i < songs.length; i++)
              Padding(padding: const EdgeInsets.symmetric(horizontal: 6), child: LibraryTrack(key: ValueKey('ls-${songs[i]['id']}'), tracks: songs, index: i, onChanged: reload)),
            LoadMore(more: more && !loading, onMore: _load),
          ],
        ]);
      case 'playlists':
        children.add(Padding(padding: const EdgeInsets.fromLTRB(gutter, 12, gutter, 0), child: PlaylistGrid(playlists: items, onChanged: reload, onCreate: () async {
          final id = await editPlaylist(context);
          if (id != null && id > 0 && context.mounted) {
            await context.push('/music/playlists/$id');
            await reload();
          }
        })));
      case 'artists':
        if (items.isEmpty) children.add(MusicEmpty(icon: icon, title: tr('Немає виконавців'), text: tr('Виконавці з’являться, коли ви додасте пісні в медіатеку.')));
        for (final a in items) {
          children.add(InkWell(
            onTap: () => context.push(artistPath(text(a['name']) ?? '')),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: gutter, vertical: 6),
              child: Row(children: [
                SizedBox(width: 52, child: Artwork(url: text(a['cover_url']), seed: text(a['name']) ?? '', round: true, icon: LucideIcons.micVocal)),
                const SizedBox(width: 14),
                Expanded(child: Text(text(a['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(16, weight: FontWeight.w500))),
                Text(_songs(intOf(a['tracks_count'])), style: body(12.5, color: muted)),
                Icon(LucideIcons.chevronRight, size: 18, color: faint),
              ]),
            ),
          ));
        }
      case 'albums':
        children.add(items.isEmpty
            ? MusicEmpty(icon: icon, title: tr('Немає альбомів'), text: tr('Альбоми збираються з тегів пісень у вашій медіатеці.'))
            : Padding(padding: const EdgeInsets.only(top: 12), child: TileGrid(children: [for (final a in items) AlbumTile(album: a)])));
      case 'genres':
        children.add(items.isEmpty
            ? MusicEmpty(icon: icon, title: tr('Немає жанрів'))
            : Padding(padding: const EdgeInsets.only(top: 12), child: TileGrid(children: [for (var i = 0; i < items.length; i++) GenreTile(genre: items[i], index: i)])));
      case 'spotify':
        final spotify = mapOf(data['spotify']);
        children.add(Padding(
          padding: const EdgeInsets.fromLTRB(gutter, 12, gutter, 0),
          child: SpotifyPanel(configured: spotify['configured'] == true, account: spotify['account'] is Map ? mapOf(spotify['account']) : null, onChanged: reload),
        ));
    }
    return MusicList(onRefresh: reload, children: children);
  }
}

// ───────────────────────── Пошук ─────────────────────────

class MusicSearchScreen extends StatefulWidget {
  const MusicSearchScreen({this.initial = '', super.key});
  final String initial;

  @override
  State<MusicSearchScreen> createState() => _MusicSearchScreenState();
}

class _MusicSearchScreenState extends State<MusicSearchScreen> {
  late final query = TextEditingController(text: widget.initial);
  Timer? debounce;
  String scope = 'all';
  String filter = 'all';
  Map<String, dynamic>? data;
  bool loading = false;
  int _seq = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    query.dispose();
    debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final seq = ++_seq;
    setState(() => loading = true);
    try {
      final q = query.text.trim();
      final result = await AppScope.read(context).session.api.get(Api.site('/music/find?${Uri(queryParameters: {if (q.isNotEmpty) 'q': q, 'scope': scope}).query}'));
      if (mounted && seq == _seq) setState(() => data = result);
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted && seq == _seq) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final page = data ?? const <String, dynamic>{};
    final results = page['results'] is Map ? mapOf(page['results']) : null;
    final categories = maps(page['categories']);
    final q = query.text.trim();
    return MusicList(children: [
      LargeTitle(tr('Пошук'), back: true),
      Padding(
        padding: const EdgeInsets.fromLTRB(gutter, 10, gutter, 0),
        child: GcField(
          controller: query,
          label: tr('Виконавці, пісні, тексти та інше'),
          icon: LucideIcons.search,
          dense: true,
          autofocus: widget.initial.isEmpty,
          onChanged: (_) {
            setState(() {});
            debounce?.cancel();
            debounce = Timer(const Duration(milliseconds: 350), _load);
          },
        ),
      ),
      if (q.isNotEmpty) ...[
        Padding(
          padding: const EdgeInsets.fromLTRB(gutter, 10, gutter, 0),
          child: Segmented(
            options: [SegmentOption('all', tr('Каталог GameCon')), SegmentOption('library', tr('Ваша медіатека'))],
            selected: scope,
            onSelect: (v) {
              setState(() => scope = v);
              _load();
            },
          ),
        ),
        if (results != null) _filters(results),
      ],
      if (loading && data == null) const ListSkeleton(rows: 6, square: true),
      if (q.isEmpty && categories.isNotEmpty) ...[
        SectionHeader(tr('Перегляд за категоріями')),
        TileGrid(children: [for (var i = 0; i < categories.length; i++) GenreTile(genre: categories[i], index: i)]),
      ],
      if (q.isNotEmpty && results != null) ..._results(results, q),
    ]);
  }

  static const _kinds = ['tracks', 'artists', 'albums', 'playlists', 'stations', 'lyrics'];

  Widget _filters(Map<String, dynamic> results) {
    final labels = {'all': tr('Усе'), 'tracks': tr('Пісні'), 'artists': tr('Виконавці'), 'albums': tr('Альбоми'), 'playlists': tr('Плейлисти'), 'stations': tr('Радіостанції'), 'lyrics': tr('Тексти')};
    final present = ['all', for (final k in _kinds) if (maps(results[k]).isNotEmpty) k];
    if (present.length <= 2) return const SizedBox(height: 4);
    return SizedBox(
      height: 46,
      child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.fromLTRB(gutter, 8, gutter, 0), children: [
        for (final k in present) Padding(padding: const EdgeInsets.only(right: 8), child: SelectPill(label: labels[k]!, selected: filter == k, onTap: () => setState(() => filter = k))),
      ]),
    );
  }

  List<Widget> _results(Map<String, dynamic> results, String q) {
    bool show(String kind) => (filter == 'all' || filter == kind) && maps(results[kind]).isNotEmpty;
    final tracks = maps(results['tracks']);
    final lyrics = maps(results['lyrics']);
    final artists = maps(results['artists']);
    final albums = maps(results['albums']);
    final playlists = maps(results['playlists']);
    final stations = maps(results['stations']);
    if ([tracks, lyrics, artists, albums, playlists, stations].every((l) => l.isEmpty)) {
      return [MusicEmpty(icon: LucideIcons.searchX, title: tr('Нічого не знайдено за запитом «{q}».', {'q': q}))];
    }
    final all = filter == 'all';
    return [
      if (show('artists')) ...[SectionHeader(tr('Виконавці')), Shelf(children: [for (final a in artists) ArtistTile(artist: a)])],
      if (show('tracks')) ...[
        SectionHeader(tr('Пісні')),
        for (var i = 0; i < (all ? math.min(tracks.length, 8) : tracks.length); i++) SongRow(tracks: tracks, index: i),
        if (all && tracks.length > 8)
          Padding(padding: const EdgeInsets.symmetric(horizontal: gutter), child: TextButton(onPressed: () => setState(() => filter = 'tracks'), child: Text(tr('Усі пісні'), style: body(14, color: accent, weight: FontWeight.w600)))),
      ],
      if (show('lyrics')) ...[
        SectionHeader(tr('Збіг у тексті пісні')),
        for (var i = 0; i < lyrics.length; i++) SongRow(tracks: lyrics, index: i, subtitle: text(lyrics[i]['lyric'])),
      ],
      if (show('albums')) ...[SectionHeader(tr('Альбоми')), Shelf(children: [for (final a in albums) AlbumTile(album: a)])],
      if (show('playlists')) ...[SectionHeader(tr('Плейлисти')), Shelf(children: [for (final p in playlists) PlaylistTile(playlist: p)])],
      if (show('stations')) ...[SectionHeader(tr('Радіостанції')), Shelf(children: [for (var i = 0; i < stations.length; i++) TrackTile(tracks: stations, index: i)])],
    ];
  }
}
