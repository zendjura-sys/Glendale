import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'music.dart';
import 'music_ui.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// Розділ «Музика» в стилі Apple Music, як на сайті (pages/music/home, new, radio, library):
// власна панель вкладок унизу — Головна, Нове, Радіо, Медіатека — і кнопка пошуку поруч.

/// Висота панелі вкладок розділу разом із відступом над нижнім меню застосунку.
const _tabsExtent = 68.0;

class MusicHub extends StatefulWidget {
  const MusicHub({this.tab = 'home', super.key});
  final String tab;

  /// Старі вкладки сайту (?tab=…) і шляхи `/music/new` тощо → вкладка розділу.
  static String tabFor(String? value) => switch (value) {
        'new' || 'discover' => 'new',
        'radio' => 'radio',
        'library' || 'mine' || 'playlists' || 'spotify' => 'library',
        _ => 'home',
      };

  @override
  State<MusicHub> createState() => _MusicHubState();
}

class _MusicHubState extends State<MusicHub> {
  late String tab = widget.tab;

  /// Вкладки будуються при першому відкритті й далі тримають свій стан і прокрутку.
  late final opened = <String>{tab};

  static const _tabs = ['home', 'new', 'radio', 'library'];

  void _select(String value) => setState(() {
        tab = value;
        opened.add(value);
      });

  @override
  Widget build(BuildContext context) {
    final labels = {
      'home': (tr('Головна'), LucideIcons.house),
      'new': (tr('Нове'), LucideIcons.sparkles),
      'radio': (tr('Радіо'), LucideIcons.radio),
      'library': (tr('Медіатека'), LucideIcons.library),
    };
    Widget page(String key) => switch (key) {
          'new' => const _NewTab(),
          'radio' => const _RadioTab(),
          'library' => const _LibraryTab(),
          _ => _HomeTab(onRadio: () => _select('radio')),
        };
    return Stack(children: [
      Positioned.fill(
        child: IndexedStack(index: _tabs.indexOf(tab), children: [for (final key in _tabs) opened.contains(key) ? page(key) : const SizedBox.shrink()]),
      ),
      Positioned(
        left: 12,
        right: 12,
        bottom: ShellChrome.bottomOf(context) + 4,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Row(children: [
              Expanded(
                child: _GlassBar(
                  child: Row(children: [
                    for (final key in _tabs)
                      Expanded(
                        child: _TabButton(icon: labels[key]!.$2, label: labels[key]!.$1, selected: tab == key, onTap: () => _select(key)),
                      ),
                  ]),
                ),
              ),
              const SizedBox(width: 8),
              _GlassBar(
                round: true,
                child: Semantics(
                  button: true,
                  label: tr('Пошук'),
                  child: InkResponse(onTap: () => context.push('/music/search'), radius: 28, child: SizedBox.square(dimension: 56, child: Icon(LucideIcons.search, size: 22, color: ink))),
                ),
              ),
            ]),
          ),
        ),
      ),
    ]);
  }
}

/// Скляна плашка панелі вкладок (iOS 26: матове скло, що «пливе» над контентом).
class _GlassBar extends StatelessWidget {
  const _GlassBar({required this.child, this.round = false});
  final Widget child;
  final bool round;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(28);
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: [palette.isLight ? const BoxShadow(color: Color(0x26102A50), blurRadius: 24, offset: Offset(0, 8), spreadRadius: -12) : const BoxShadow(color: Color(0x99000000), blurRadius: 28, offset: Offset(0, 10), spreadRadius: -14)],
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 24, sigmaY: 24),
          child: Container(
            height: 56,
            padding: round ? EdgeInsets.zero : const EdgeInsets.symmetric(horizontal: 4),
            decoration: BoxDecoration(color: bar.withValues(alpha: 0.82), borderRadius: radius, border: Border.all(color: line)),
            child: child,
          ),
        ),
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({required this.icon, required this.label, required this.selected, required this.onTap});
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? accent : muted;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : const Duration(milliseconds: 200),
          margin: const EdgeInsets.symmetric(vertical: 4),
          decoration: BoxDecoration(color: selected ? primary.withValues(alpha: 0.14) : Colors.transparent, borderRadius: BorderRadius.circular(24)),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(height: 2),
            Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(10.5, color: color, weight: FontWeight.w600)),
          ]),
        ),
      ),
    );
  }
}

/// Завантаження сторінки розділу з мосту сайту.
Widget _remote(BuildContext context, String path, Widget Function(Map<String, dynamic> data, Future<void> Function() reload) builder) {
  return Remote(load: () => AppScope.read(context).session.api.get(Api.site(path)), builder: builder);
}

// ───────────────────────── Головна ─────────────────────────

class _HomeTab extends StatelessWidget {
  const _HomeTab({required this.onRadio});
  final VoidCallback onRadio;

  @override
  Widget build(BuildContext context) {
    return _remote(context, '/music/home', (data, reload) {
      final home = mapOf(data['home']);
      final picks = maps(home['top_picks']);
      final recent = maps(home['recently_played']);
      final mixes = maps(home['made_for_you']);
      final replay = mapOf(home['replay']);
      final replayTracks = maps(replay['tracks']);
      final friends = maps(home['friends']);
      final stations = maps(home['stations']);
      final wide = MediaQuery.sizeOf(context).width;
      return MusicList(onRefresh: reload, extraBottom: _tabsExtent, children: [
        LargeTitle(tr('Головна')),
        if (picks.isNotEmpty) ...[
          SectionHeader(tr('Найкраще для тебе')),
          Shelf(children: [for (final item in picks) _TopPick(item: item, width: wide * 0.62 > 280 ? 280 : wide * 0.62)]),
        ],
        if (recent.isNotEmpty) ...[
          SectionHeader(tr('Нещодавно прослухане')),
          Shelf(children: [for (var i = 0; i < recent.length; i++) TrackTile(tracks: recent, index: i)]),
        ] else
          Padding(
            padding: const EdgeInsets.fromLTRB(gutter, 24, gutter, 0),
            child: Glass(
              padding: const EdgeInsets.all(18),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr('Почни слухати'), style: body(16, weight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(tr('Тут з’являться нещодавно прослухані треки, а міксы й станції підлаштуються під твій смак.'), style: body(13.5, color: muted)),
              ]),
            ),
          ),
        if (mixes.isNotEmpty) ...[
          SectionHeader(tr('Створено для тебе'), subtitle: tr('Оновлюється щопонеділка')),
          Shelf(children: [for (final mix in mixes) MixTile(mix: mix)]),
        ],
        if (replayTracks.isNotEmpty) ...[
          SectionHeader(tr('Replay {year}', {'year': replay['year']}), subtitle: tr('Твої найчастіші пісні року'), onMore: () => context.push('/music/replay')),
          SongColumns(tracks: replayTracks, ranked: true),
        ],
        if (friends.isNotEmpty) ...[
          SectionHeader(tr('Друзі слухають')),
          Shelf(children: [
            for (final f in friends)
              Builder(builder: (context) {
                final user = mapOf(f['user']);
                final track = mapOf(f['track']);
                final name = text(user['first_name']) ?? text(user['name']) ?? '';
                return TrackTile(
                  tracks: [track],
                  index: 0,
                  subtitle: '$name · ${text(track['artist']) ?? ''}',
                  badge: Container(
                    decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: voidColor, width: 2)),
                    child: Avatar(url: text(user['avatar_url']), name: name.isEmpty ? '?' : name, size: 30),
                  ),
                );
              }),
          ]),
        ],
        if (stations.isNotEmpty) ...[
          SectionHeader(tr('Станції для тебе'), onMore: onRadio),
          Shelf(children: [for (final s in stations) StationTile(station: s)]),
        ],
      ]);
    });
  }
}

/// Велика картка «Найкраще для тебе»: підпис над нею й обкладинка 4:5.
class _TopPick extends StatelessWidget {
  const _TopPick({required this.item, required this.width});
  final Map<String, dynamic> item;
  final double width;

  @override
  Widget build(BuildContext context) {
    final station = text(item['kind']) == 'station';
    final (title, subtitle) = station ? stationTitle(item) : mixTitle(text(item['key']));
    final colors = [for (final c in (item['colors'] as List? ?? const [])) hexColor(c, primary)];
    return SizedBox(
      width: width,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(station ? tr('Твоя станція') : tr('Створено для тебе'), style: body(12.5, color: muted, weight: FontWeight.w500)),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: () => station ? startStation(context, text(item['key']) ?? 'me') : openMusic(context, text(item['href'])),
          child: MixArt(colors: colors.isEmpty ? [primary] : colors, covers: coversOf(item['covers']), label: title, footnote: subtitle, aspect: 4 / 5, icon: station ? LucideIcons.radio : null),
        ),
      ]),
    );
  }
}

// ───────────────────────── Нове ─────────────────────────

class _NewTab extends StatelessWidget {
  const _NewTab();

  @override
  Widget build(BuildContext context) {
    return _remote(context, '/music/new', (raw, reload) {
      final data = mapOf(raw['data']);
      final featured = maps(data['featured']);
      final latest = maps(data['latest_songs']);
      final albums = maps(data['new_albums']);
      final charts = maps(data['chart_cards']);
      final moods = maps(data['moods']);
      final genres = maps(data['genres']);
      final empty = featured.isEmpty && latest.isEmpty && albums.isEmpty && charts.isEmpty;
      return MusicList(onRefresh: reload, extraBottom: _tabsExtent, children: [
        LargeTitle(tr('Нове')),
        if (empty) MusicEmpty(icon: LucideIcons.sparkles, title: tr('Тут поки тихо'), text: tr('Щойно на GameCon з’являться треки, тут будуть новинки й чарти.')),
        if (featured.isNotEmpty) Shelf(children: [for (final p in featured) PlaylistTile(playlist: p, width: tileWidth(context) * 1.5)]),
        if (latest.isNotEmpty) ...[
          SectionHeader(tr('Нові пісні')),
          SongColumns(tracks: latest),
        ],
        if (albums.isNotEmpty) ...[
          SectionHeader(tr('Нові альбоми')),
          Shelf(children: [for (final a in albums) AlbumTile(album: a)]),
        ],
        if (charts.isNotEmpty) ...[
          SectionHeader(tr('Чарти'), subtitle: tr('Найбільше слухачів за тиждень'), onMore: () => context.push('/music/charts')),
          SongColumns(tracks: charts, ranked: true),
        ],
        for (final mood in moods) ...[
          SectionHeader(text(mood['category']) ?? ''),
          Shelf(children: [for (final p in maps(mood['playlists'])) PlaylistTile(playlist: p)]),
        ],
        if (genres.isNotEmpty) ...[
          SectionHeader(tr('Жанри')),
          TileGrid(children: [for (var i = 0; i < genres.length; i++) GenreTile(genre: genres[i], index: i)]),
        ],
      ]);
    });
  }
}

// ───────────────────────── Радіо ─────────────────────────

class _RadioTab extends StatelessWidget {
  const _RadioTab();

  @override
  Widget build(BuildContext context) {
    return _remote(context, '/music/radio', (raw, reload) {
      final data = mapOf(raw['data']);
      final mine = mapOf(data['my_station']);
      final live = maps(data['live']);
      final byGenre = maps(data['by_genre']);
      final genres = maps(data['genre_stations']);
      final width = MediaQuery.sizeOf(context).width - gutter * 2;
      return MusicList(onRefresh: reload, extraBottom: _tabsExtent, children: [
        LargeTitle(tr('Радіо')),
        if (mine.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(gutter, 12, gutter, 0),
            child: GestureDetector(
              onTap: () => startStation(context, 'me'),
              child: Builder(builder: (context) {
                final (title, subtitle) = stationTitle(mine);
                final colors = [for (final c in (mine['colors'] as List? ?? const [])) hexColor(c, primary)];
                return MixArt(colors: colors.isEmpty ? [primary] : colors, covers: coversOf(mine['covers']), label: title, footnote: subtitle, icon: LucideIcons.radio, aspect: width > 500 ? 3 : 16 / 9);
              }),
            ),
          ),
        if (live.isNotEmpty) ...[
          SectionHeader(tr('Прямий ефір'), subtitle: tr('Інтернет-радіостанції')),
          Shelf(children: [for (var i = 0; i < live.length; i++) TrackTile(tracks: live, index: i)]),
        ],
        for (final group in byGenre)
          if (maps(group['stations']).length > 1) ...[
            SectionHeader(text(group['genre']) ?? ''),
            Builder(builder: (context) {
              final stations = maps(group['stations']);
              return Shelf(children: [for (var i = 0; i < stations.length; i++) TrackTile(tracks: stations, index: i)]);
            }),
          ],
        if (genres.isNotEmpty) ...[
          SectionHeader(tr('Станції за жанрами'), subtitle: tr('Безкінечний потік треків GameCon')),
          Shelf(children: [for (final s in genres) StationTile(station: s)]),
        ],
        if (live.isEmpty && genres.isEmpty) MusicEmpty(icon: LucideIcons.radio, title: tr('Станцій поки немає'), text: tr('Увімкніть свою станцію — вона підбирає музику за тим, що ви слухаєте.')),
      ]);
    });
  }
}

// ───────────────────────── Медіатека ─────────────────────────

/// Розділи медіатеки: ключ → назва й іконка (як на сайті).
(String, IconData) librarySection(String key) => switch (key) {
      'playlists' => (tr('Плейлисти'), LucideIcons.listMusic),
      'artists' => (tr('Виконавці'), LucideIcons.micVocal),
      'albums' => (tr('Альбоми'), LucideIcons.disc3),
      'songs' => (tr('Пісні'), LucideIcons.music),
      'favorites' => (tr('Улюблене'), LucideIcons.star),
      'genres' => (tr('Жанри'), LucideIcons.guitar),
      _ => ('Spotify', LucideIcons.audioLines),
    };

class _LibraryTab extends StatelessWidget {
  const _LibraryTab();

  @override
  Widget build(BuildContext context) {
    return _remote(context, '/music/library', (raw, reload) {
      final data = mapOf(raw['data']);
      final counts = mapOf(data['counts']);
      final recent = maps(data['recently_added']);
      final sections = [for (final s in (raw['sections'] as List? ?? const ['playlists', 'artists', 'albums', 'songs', 'favorites', 'genres', 'spotify'])) '$s'];
      return MusicList(onRefresh: reload, extraBottom: _tabsExtent, children: [
        LargeTitle(tr('Медіатека'), actions: [
          RoundIcon(icon: LucideIcons.listPlus, tooltip: tr('Новий плейлист'), onTap: () async {
            final id = await editPlaylist(context);
            if (id != null && id > 0 && context.mounted) {
              await context.push('/music/playlists/$id');
              await reload();
            }
          }),
          const SizedBox(width: 8),
          RoundIcon(icon: LucideIcons.upload, tooltip: tr('Завантажити трек'), onTap: () async {
            if (await uploadTrack(context)) await reload();
          }),
          const SizedBox(width: 8),
          RoundIcon(icon: LucideIcons.slidersHorizontal, tooltip: tr('Змінити'), onTap: () async {
            if (await _editSections(context, sections)) await reload();
          }),
        ]),
        const SizedBox(height: 8),
        for (final key in sections)
          Builder(builder: (context) {
            final (label, icon) = librarySection(key);
            return LinkRow(icon: icon, label: label, count: counts[key] == null ? null : intOf(counts[key]), onTap: () async {
              await context.push('/music/library/$key');
              await reload();
            });
          }),
        if (recent.isNotEmpty) ...[
          SectionHeader(tr('Нещодавно додане')),
          TileGrid(children: [for (final item in recent) _RecentTile(item: item)]),
        ] else
          MusicEmpty(icon: LucideIcons.library, title: tr('Медіатека порожня'), text: tr('Додавайте пісні через меню «⋯» або завантажте свої треки.')),
      ]);
    });
  }

  /// «Змінити»: які розділи видно в медіатеці (зберігається в акаунті, як на сайті).
  Future<bool> _editSections(BuildContext context, List<String> visible) async {
    final picked = {...visible};
    final ok = await showGcSheet<bool>(
      context,
      title: tr('Розділи медіатеки'),
      builder: (sheet) => StatefulBuilder(
        builder: (context, setSheet) => Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            for (final key in const ['playlists', 'artists', 'albums', 'songs', 'favorites', 'genres', 'spotify'])
              CheckboxListTile(
                value: picked.contains(key),
                activeColor: primary,
                title: Text(librarySection(key).$1, style: body(15)),
                secondary: Icon(librarySection(key).$2, color: accent),
                onChanged: (on) => setSheet(() => on == true ? picked.add(key) : picked.remove(key)),
              ),
            const SizedBox(height: 8),
            PrimaryButton(label: tr('Готово'), onPressed: () => Navigator.pop(sheet, true)),
          ]),
        ),
      ),
    );
    if (ok != true || !context.mounted) return false;
    return attempt(context, () => AppScope.read(context).session.api.post(Api.site('/music/library/sections'), {'sections': picked.toList()}));
  }
}

/// «Нещодавно додане»: альбом, пісня без альбому чи плейлист.
class _RecentTile extends StatelessWidget {
  const _RecentTile({required this.item});
  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final kind = text(item['kind']);
    if (kind == 'playlist') return PlaylistTile(playlist: mapOf(item['playlist']));
    if (kind == 'track') return TrackTile(tracks: [mapOf(item['track'])], index: 0);
    return Tile(
      onTap: () => openMusic(context, text(item['href'])),
      art: Artwork(url: text(item['cover_url']), seed: '${item['subtitle']}|${item['title']}', icon: LucideIcons.disc3),
      title: text(item['title']) ?? '',
      subtitle: text(item['subtitle']),
    );
  }
}
