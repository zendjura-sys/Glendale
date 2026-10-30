import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'feed.dart';
import 'music_ui.dart';
import 'offline_music.dart';
import 'posts.dart';
import 'state.dart';
import 'theme.dart';
import 'track_edit.dart';
import 'widgets.dart';
import 'i18n.dart';
import 'skeletons.dart';

/// Грає список треків GameCon і радіостанцій (Spotify-треки відкриваються в Spotify).
/// [from] — «Грає з…»; без нього — екран, з якого запустили ([playFromHere]).
Future<void> playTracks(BuildContext context, List<Map<String, dynamic>> tracks, int index, {bool shuffle = false, String? station, PlayFrom? from}) async {
  final track = tracks[index];
  if (text(track['source']) == 'spotify') {
    final link = text(track['url']) ?? 'https://open.spotify.com/track/${track['id']}';
    await launchUrl(Uri.parse(link), mode: LaunchMode.externalApplication);
    return;
  }
  final player = AppScope.read(context).player;
  final local = tracks.where((t) => text(t['source']) != 'spotify').toList();
  final start = local.indexWhere((t) => trackKey(t) == trackKey(track));
  if (shuffle != player.shuffle) player.toggleShuffle();
  await player.playList(local, start < 0 ? 0 : start, station: station, from: from ?? playFromHere(context));
}

/// «Завантажити трек»: файл, теги, обкладинка з каталогу. Повертає true, якщо трек додано.
Future<bool> uploadTrack(BuildContext context, {Map<String, dynamic>? limits}) async {
  var info = limits;
  if (info == null) {
    try {
      info = mapOf((await AppScope.read(context).session.api.get(Api.site('/music?tab=mine')))['limits']);
    } catch (_) {
      info = const {};
    }
  }
  if (!context.mounted) return false;
  final formats = [for (final f in (info['formats'] as List? ?? ['mp3', 'm4a', 'ogg', 'wav', 'flac'])) '$f'];
  // Трек, завантажений за посиланням, теж оновлює список, навіть якщо аркуш закрили хрестиком.
  var imported = false;
  final done = await showGcSheet<bool>(
    context,
    title: tr('Завантажити трек'),
    subtitle: tr('До {v} МБ · {v2}', {'v': info['max_mb'] ?? 20, 'v2': formats.join(', ')}),
    builder: (sheet) => _UploadTrack(formats: formats, onDone: () => Navigator.pop(sheet, true), onImported: () => imported = true),
  );
  return done == true || imported;
}

String minutesLabel(dynamic seconds) {
  final total = intOf(seconds);
  if (total >= 3600) return tr('{v} год {v2} хв', {'v': total ~/ 3600, 'v2': (total % 3600) ~/ 60});
  return tr('{v} хв', {'v': (total / 60).round()});
}

// ───────────────────────── Музика ─────────────────────────

class MusicScreen extends StatefulWidget {
  const MusicScreen({this.username, this.tab, super.key});

  /// Аудіозаписи іншого користувача (`/music/u/{username}` на сайті).
  final String? username;
  final String? tab;

  @override
  State<MusicScreen> createState() => _MusicScreenState();
}

class _MusicScreenState extends State<MusicScreen> {
  late String tab = widget.tab ?? 'mine';
  final query = TextEditingController();
  Map<String, dynamic>? page;
  final tracks = <Map<String, dynamic>>[];
  int current = 0;
  bool more = false;
  bool loading = true;
  Timer? debounce;
  int spotifyStamp = 0;
  Session? session;

  bool get other => widget.username != null && widget.username != AppScope.read(context).session.username;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      session = AppScope.read(context).session;
      spotifyStamp = session!.spotifyStamp;
      session!.addListener(_onSession);
      _load(reset: true);
    });
  }

  void _onSession() {
    final stamp = session?.spotifyStamp ?? 0;
    if (stamp != spotifyStamp) {
      spotifyStamp = stamp;
      setState(() => tab = 'spotify');
      _load(reset: true);
    }
  }

  @override
  void dispose() {
    query.dispose();
    debounce?.cancel();
    session?.removeListener(_onSession);
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    final api = AppScope.read(context).session.api;
    if (reset) {
      setState(() => loading = true);
      current = 0;
    }
    final path = other
        ? '/music/u/${widget.username}?page=${current + 1}'
        : '/music?${Uri(queryParameters: {'tab': tab == 'spotify' || tab == 'playlists' ? 'mine' : tab, if (query.text.trim().isNotEmpty) 'q': query.text.trim(), 'page': '${current + 1}'}).query}';
    try {
      final data = await api.get(Api.site(path));
      final listing = Listing.parse(data['tracks']);
      if (!mounted) return;
      setState(() {
        page = data;
        if (reset) tracks.clear();
        tracks.addAll(listing.items);
        current = listing.current;
        more = listing.more;
      });
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _upload() async {
    if (await uploadTrack(context, limits: mapOf(page?['limits'])) && mounted) _load(reset: true);
  }

  Future<void> _newPlaylist() async {
    final id = await editPlaylist(context);
    if (id != null && mounted) {
      await context.push('/music/playlists/$id');
      _load(reset: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = page;
    if (data == null) return const ScreenSkeleton();
    if (other) return _otherUser(data);

    final stats = mapOf(data['stats']);
    final spotify = mapOf(data['spotify']);
    final account = spotify['account'] is Map ? mapOf(spotify['account']) : null;
    final playlists = maps(data['playlists']);

    return ScreenScroll(
      onRefresh: () => _load(reset: true),
      children: [
        HeroCard(
          badge: tr('МУЗИКА GAMECON'),
          badgeIcon: LucideIcons.music,
          title: tr('Ваш'),
          accent: tr('звук,'),
          after: tr('ваші правила'),
          text: tr('Завантажуйте треки, збирайте плейлисти, діліться музикою на стіні та слухайте Spotify прямо тут.'),
          children: [
            Wrap(spacing: 8, runSpacing: 8, children: [
              Pill(label: '${stats['tracks'] ?? 0} ${plural(intOf(stats['tracks']), 'трек', 'треки', 'треків')}'),
              Pill(label: tr('{v} музики', {'v': minutesLabel(stats['duration'])})),
              Pill(label: '${stats['playlists'] ?? 0} ${plural(intOf(stats['playlists']), 'плейлист', 'плейлисти', 'плейлистів')}'),
              if (account != null) Pill(label: text(account['display_name']) ?? 'Spotify', icon: LucideIcons.audioLines, color: Color(0xFF1ED760)),
            ]),
            SizedBox(height: 14),
            Row(children: [
              Expanded(child: GhostButton(label: tr('Плейлист'), icon: LucideIcons.listPlus, onPressed: _newPlaylist)),
              SizedBox(width: 10),
              Expanded(child: PrimaryButton(label: tr('Завантажити'), icon: LucideIcons.upload, onPressed: _upload)),
            ]),
          ],
        ),
        SizedBox(height: 12),
        Glass(
          padding: EdgeInsets.all(12),
          child: Column(children: [
            Segmented(
              scroll: true,
              options: [
                SegmentOption('mine', tr('Мої аудіозаписи'), icon: LucideIcons.headphones),
                SegmentOption('discover', tr('Огляд'), icon: LucideIcons.compass),
                SegmentOption('playlists', tr('Плейлисти'), icon: LucideIcons.listMusic, count: playlists.isEmpty ? null : playlists.length),
                SegmentOption('spotify', 'Spotify', icon: LucideIcons.audioLines),
              ],
              selected: tab,
              onSelect: (value) {
                setState(() => tab = value);
                if (value == 'mine' || value == 'discover') _load(reset: true);
              },
            ),
            if (tab == 'mine' || tab == 'discover') ...[
              const SizedBox(height: 10),
              GcField(
                controller: query,
                label: tab == 'mine' ? tr('Пошук у моїх аудіозаписах') : tr('Пошук по всій музиці GameCon'),
                icon: LucideIcons.search,
                dense: true,
                onChanged: (_) {
                  debounce?.cancel();
                  debounce = Timer(const Duration(milliseconds: 350), () => _load(reset: true));
                },
              ),
            ],
          ]),
        ),
        const SizedBox(height: 12),
        if (tab == 'playlists')
          PlaylistGrid(playlists: playlists, onCreate: _newPlaylist, onChanged: () => _load(reset: true))
        else if (tab == 'spotify')
          SpotifyPanel(configured: spotify['configured'] == true, account: account, onChanged: () => _load(reset: true))
        else
          _trackList(tab == 'mine' ? tr('Мої аудіозаписи') : (query.text.trim().isEmpty ? tr('Популярне на GameCon') : tr('Результати пошуку')), playlists),
      ],
    );
  }

  Widget _trackList(String title, List<Map<String, dynamic>> playlists) {
    return Glass(
      padding: const EdgeInsets.fromLTRB(10, 14, 10, 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6),
          child: Wrap(spacing: 10, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
            Text(title.toUpperCase(), style: display(14)),
            if (tracks.isNotEmpty) PrimaryButton(label: tr('Слухати все'), icon: LucideIcons.play, compact: true, expand: false, onPressed: () => playTracks(context, tracks, 0)),
            if (tracks.length > 1) GhostButton(label: tr('Перемішати'), icon: LucideIcons.shuffle, compact: true, expand: false, onPressed: () => playTracks(context, tracks, DateTime.now().millisecond % tracks.length, shuffle: true)),
          ]),
        ),
        const SizedBox(height: 8),
        if (loading && tracks.isEmpty)
          const ListSkeleton(rows: 5)
        else if (tracks.isEmpty)
          QuietEmpty(
            icon: LucideIcons.volumeOff,
            text: tab == 'mine' && query.text.isEmpty ? tr('Тут поки тихо. Завантажте трек або додайте з огляду.') : tr('Нічого не знайдено'),
          )
        else ...[
          for (var i = 0; i < tracks.length; i++) LibraryTrack(key: ValueKey('t-${tracks[i]['id']}'), tracks: tracks, index: i, playlists: playlists, onChanged: () => _load(reset: true)),
          LoadMore(more: more && !loading, onMore: _load),
        ],
      ]),
    );
  }

  Widget _otherUser(Map<String, dynamic> data) {
    final owner = mapOf(data['owner']);
    final playlists = maps(data['playlists']);
    final total = intOf(data['total']);
    return ScreenScroll(
      onRefresh: () => _load(reset: true),
      children: [
        Glass(
          child: Row(children: [
            RoundIcon(icon: LucideIcons.arrowLeft, onTap: () => context.pop()),
            const SizedBox(width: 8),
            Avatar(url: text(owner['avatar_url']), name: text(owner['name']) ?? '?', size: 46),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr('Аудіозаписи'), style: body(12.5, color: muted)),
                Text(text(owner['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: display(17)),
                Text('$total ${plural(total, 'трек', 'треки', 'треків')}', style: body(12.5, color: muted)),
              ]),
            ),
          ]),
        ),
        if (playlists.isNotEmpty) ...[
          const SizedBox(height: 12),
          PlaylistGrid(playlists: playlists, onChanged: () => _load(reset: true)),
        ],
        const SizedBox(height: 12),
        _trackList(tr('Аудіозаписи'), const []),
      ],
    );
  }
}

/// Рядок треку бібліотеки: відтворення, «у моїх» (галочка), меню.
class LibraryTrack extends StatefulWidget {
  const LibraryTrack({required this.tracks, required this.index, this.playlists = const [], this.playlistId, this.canManagePlaylist = false, this.onChanged, super.key});
  final List<Map<String, dynamic>> tracks;
  final int index;
  final List<Map<String, dynamic>> playlists;
  final int? playlistId;
  final bool canManagePlaylist;
  final VoidCallback? onChanged;

  @override
  State<LibraryTrack> createState() => _LibraryTrackState();
}

class _LibraryTrackState extends State<LibraryTrack> {
  Map<String, dynamic> get track => widget.tracks[widget.index];
  Api get api => AppScope.read(context).session.api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _repair());
  }

  Future<void> _repair() async {
    if (!mounted) return;
    final scope = AppScope.read(context);
    if (intOf(track['user_id']) != scope.session.myId) return;
    final fixed = await repairTrackMeta(scope.session, track);
    if (fixed == null || !mounted) return;
    setState(() => track.addAll(fixed));
    scope.player.updateMeta(fixed);
  }

  Future<void> _toggleLibrary() async {
    final inLibrary = track['in_library'] == true;
    try {
      if (inLibrary) {
        await api.delete(Api.site('/music/tracks/${track['id']}/library'));
      } else {
        await api.post(Api.site('/music/tracks/${track['id']}/library'));
      }
      setState(() => track['in_library'] = !inLibrary);
      if (mounted) toast(context, inLibrary ? tr('Видалено з ваших аудіозаписів.') : tr('Додано до ваших аудіозаписів.'));
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _menu() async {
    final detach = widget.playlistId != null && widget.canManagePlaylist;
    await showTrackMenu(
      context,
      track,
      onChanged: () {
        if (mounted) setState(() {});
        widget.onChanged?.call();
      },
      removeLabel: tr('Прибрати з плейлиста'),
      onRemove: !detach
          ? null
          : () async {
              if (await attempt(context, () => api.delete(Api.site('/music/playlists/${widget.playlistId}/tracks/${track['id']}')), success: tr('Прибрано з плейлиста.'))) widget.onChanged?.call();
            },
    );
  }

  @override
  Widget build(BuildContext context) {
    final player = AppScope.of(context).player;
    return ListenableBuilder(
      listenable: musicRowListenable(player),
      builder: (context, _) => Opacity(
        opacity: dimmedOffline(track) ? 0.4 : 1,
        child: TrackRow(
        track: track,
        playing: player.isCurrentCard(track),
        onTap: () => playTracks(context, widget.tracks, widget.index),
        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
          DownloadBadge(track),
          if (text(track['source']) != 'spotify')
            IconButton(
              visualDensity: VisualDensity.compact,
              tooltip: track['in_library'] == true ? tr('У ваших аудіозаписах') : tr('Додати до моїх'),
              onPressed: _toggleLibrary,
              icon: Icon(track['in_library'] == true ? LucideIcons.check : LucideIcons.plus, size: 18, color: track['in_library'] == true ? accent : muted),
            ),
          IconButton(visualDensity: VisualDensity.compact, onPressed: _menu, icon: Icon(LucideIcons.ellipsis, color: muted, size: 20)),
        ]),
      ),
      ),
    );
  }
}

class _UploadTrack extends StatefulWidget {
  const _UploadTrack({required this.formats, required this.onDone, this.onImported});
  final List<String> formats;
  final VoidCallback onDone;
  final VoidCallback? onImported;

  @override
  State<_UploadTrack> createState() => _UploadTrackState();
}

class _UploadTrackState extends State<_UploadTrack> {
  PlatformFile? audio;
  XFile? cover;

  /// Обкладинка з каталогу (якщо свою не обрали) — сервер завантажить її за посиланням.
  String? catalogCover;
  final title = TextEditingController();
  final artist = TextEditingController();
  final album = TextEditingController();
  final genre = TextEditingController();
  bool busy = false;
  bool searching = false;

  /// «Файл» з телефона чи «За посиланням» (сервер сам завантажить файл).
  String mode = 'file';

  @override
  void dispose() {
    for (final c in [title, artist, album, genre]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pick() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: widget.formats);
    final file = result?.files.single;
    if (file == null) return;
    setState(() {
      audio = file;
      searching = true;
    });
    final tags = await discoverMeta(path: file.path, fileName: file.name, title: title.text, artist: artist.text);
    if (!mounted) return;
    setState(() {
      searching = false;
      applyMeta(tags, title: title, artist: artist, album: album, genre: genre);
      catalogCover ??= tags.cover;
    });
  }

  void _picked(TrackTags tags) {
    setState(() {
      applyMeta(tags, title: title, artist: artist, album: album, genre: genre, overwrite: true);
      if (tags.cover != null) catalogCover = tags.cover;
    });
  }

  Future<void> _submit() async {
    final file = audio;
    if (file?.path == null) return;
    setState(() => busy = true);
    try {
      final api = AppScope.read(context).session.api;
      final parts = [
        await http.MultipartFile.fromPath('audio', file!.path!, filename: file.name),
        if (cover != null) await http.MultipartFile.fromPath('cover', cover!.path, filename: cover!.name),
      ];
      await api.upload(Api.site('/music/tracks'), {
        'title': title.text.trim(),
        'artist': artist.text.trim(),
        if (album.text.trim().isNotEmpty) 'album': album.text.trim(),
        if (genre.text.trim().isNotEmpty) 'genre': genre.text.trim(),
        if (cover == null && catalogCover != null) 'cover_url': catalogCover!,
      }, parts);
      if (mounted) toast(context, tr('Трек завантажено 🎵'));
      widget.onDone();
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final modes = Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Segmented(
        options: [SegmentOption('file', tr('Файл'), icon: LucideIcons.fileAudio), SegmentOption('link', tr('За посиланням'), icon: LucideIcons.link)],
        selected: mode,
        onSelect: busy ? (_) {} : (v) => setState(() => mode = v),
      ),
    );
    if (mode == 'link') {
      return SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [modes, TrackLinkImport(onImported: widget.onImported)]),
      );
    }
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        modes,
        GhostButton(label: audio == null ? tr('Обрати аудіофайл') : audio!.name, icon: LucideIcons.fileAudio, onPressed: busy ? null : _pick),
        if (searching) Padding(padding: const EdgeInsets.only(top: 8), child: Row(children: [const SizedBox.square(dimension: 14, child: CircularProgressIndicator(strokeWidth: 2)), const SizedBox(width: 8), Text(tr('Читаю теги й шукаю альбом…'), style: body(12.5, color: muted))])),
        const SizedBox(height: 12),
        Row(children: [
          GestureDetector(
            onTap: () async {
              final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1200, imageQuality: 90);
              if (picked != null) setState(() => cover = picked);
            },
            child: CoverPreview(image: cover == null ? null : XFileImage(cover!), url: catalogCover),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              cover == null && catalogCover != null
                  ? tr('Обкладинка з каталогу. Торкніться, щоб обрати свою.')
                  : tr('Обкладинка (необов’язково). Якщо у файлі є вбудована — сервер візьме її.'),
              style: body(12.5, color: muted),
            ),
          ),
        ]),
        const SizedBox(height: 12),
        CatalogSearch(onPick: _picked),
        const SizedBox(height: 12),
        LabeledField(label: tr('Назва'), child: GcField(controller: title, label: tr('Назва треку'), onChanged: (_) => setState(() {}))),
        const SizedBox(height: 10),
        LabeledField(label: tr('Виконавець'), child: GcField(controller: artist, label: tr('Виконавець'), onChanged: (_) => setState(() {}))),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: GcField(controller: album, label: tr('Альбом'), dense: true)),
          const SizedBox(width: 10),
          Expanded(child: GcField(controller: genre, label: tr('Жанр'), dense: true)),
        ]),
        const SizedBox(height: 16),
        PrimaryButton(
          label: tr('Завантажити'),
          icon: LucideIcons.upload,
          busy: busy,
          onPressed: audio != null && !searching && title.text.trim().isNotEmpty && artist.text.trim().isNotEmpty ? _submit : null,
        ),
      ]),
    );
  }
}

/// «Завантажити за посиланням»: пряме посилання на файл чи хмарний диск — сервер сам
/// завантажує трек у фоні. Нижче — останні імпорти зі статусом; поки якийсь іще в роботі
/// й аркуш на екрані, список оновлюється кожні 3 с.
class TrackLinkImport extends StatefulWidget {
  const TrackLinkImport({this.onImported, super.key});

  /// Якийсь імпорт щойно завершився — список треків варто оновити.
  final VoidCallback? onImported;

  @override
  State<TrackLinkImport> createState() => TrackLinkImportState();
}

class TrackLinkImportState extends State<TrackLinkImport> {
  static const poll = Duration(seconds: 3);
  static const active = {'pending', 'downloading', 'processing'};

  final url = TextEditingController();
  final title = TextEditingController();
  final artist = TextEditingController();
  List<Map<String, dynamic>> imports = [];
  bool busy = false;
  String? error;
  Timer? timer;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    timer?.cancel();
    for (final c in [url, title, artist]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final json = await AppScope.read(context).session.api.get(Api.site('/music/imports'));
      if (!mounted) return;
      final next = maps(json['imports']);
      final was = {for (final i in imports) i['id']: text(i['status'])};
      if (next.any((i) => text(i['status']) == 'done' && was.containsKey(i['id']) && was[i['id']] != 'done')) widget.onImported?.call();
      setState(() => imports = next);
    } catch (_) {
      // Мережа зникла — спробуємо на наступному колі.
    }
    _schedule();
  }

  /// Наступне опитування — лише поки є незавершені імпорти й екран видно.
  void _schedule() {
    timer?.cancel();
    if (!mounted || !imports.any((i) => active.contains(text(i['status'])))) return;
    timer = Timer(poll, () {
      if (!mounted) return;
      if (TickerMode.valuesOf(context).enabled) {
        _load();
      } else {
        _schedule();
      }
    });
  }

  Future<void> _paste() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final value = text(data?.text);
    if (value == null || !mounted) return;
    setState(() {
      url.text = value;
      error = null;
    });
  }

  Future<void> _submit() async {
    final link = url.text.trim();
    if (link.isEmpty) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final json = await AppScope.read(context).session.api.post(Api.site('/music/tracks/import'), {
        'url': link,
        if (title.text.trim().isNotEmpty) 'title': title.text.trim(),
        if (artist.text.trim().isNotEmpty) 'artist': artist.text.trim(),
      });
      if (!mounted) return;
      final card = mapOf(json['import']);
      setState(() {
        if (card.isNotEmpty) imports = [card, ...imports.where((i) => i['id'] != card['id'])];
        for (final c in [url, title, artist]) {
          c.clear();
        }
      });
      toast(context, tr('Посилання додано — трек завантажується'));
      _schedule();
    } catch (e) {
      // Повідомлення сервера (422) показуємо як є: воно пояснює, що не так із посиланням.
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _dismiss(Map<String, dynamic> item) async {
    setState(() => imports = imports.where((i) => i['id'] != item['id']).toList());
    try {
      await AppScope.read(context).session.api.delete(Api.site('/music/imports/${item['id']}'));
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Expanded(child: GcField(controller: url, label: tr('https://…'), icon: LucideIcons.link, keyboard: TextInputType.url, onChanged: (_) => setState(() => error = null))),
        const SizedBox(width: 8),
        GhostButton(label: tr('Вставити'), icon: LucideIcons.clipboardPaste, expand: false, compact: true, onPressed: busy ? null : _paste),
      ]),
      const SizedBox(height: 8),
      Text(tr('Пряме посилання на файл або посилання Google Диска, Dropbox чи OneDrive (доступ «усім, хто має посилання»).'), style: body(12.5, color: muted).copyWith(height: 1.4)),
      if (error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(error!, style: body(13, color: danger).copyWith(height: 1.35))),
      const SizedBox(height: 12),
      Row(children: [
        Expanded(child: GcField(controller: title, label: tr('Назва (необов’язково)'), dense: true)),
        const SizedBox(width: 10),
        Expanded(child: GcField(controller: artist, label: tr('Виконавець (необов’язково)'), dense: true)),
      ]),
      const SizedBox(height: 16),
      PrimaryButton(label: tr('Завантажити'), icon: LucideIcons.download, busy: busy, onPressed: url.text.trim().isEmpty ? null : _submit),
      if (imports.isNotEmpty) ...[
        const SizedBox(height: 20),
        Text(tr('Останні завантаження'), style: body(14, weight: FontWeight.w700)),
        const SizedBox(height: 8),
        for (final item in imports) Padding(padding: const EdgeInsets.only(bottom: 8), child: _ImportCard(item: item, onDismiss: () => _dismiss(item))),
      ],
    ]);
  }
}

/// Один імпорт: джерело, статус, смужка прогресу, помилка чи «Слухати».
class _ImportCard extends StatelessWidget {
  const _ImportCard({required this.item, required this.onDismiss});
  final Map<String, dynamic> item;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final status = text(item['status']) ?? 'pending';
    final track = mapOf(item['track']);
    final progress = item['progress'] == null ? null : intOf(item['progress']).clamp(0, 100);
    final finished = status == 'done' || status == 'failed';
    final label = switch (status) {
      'downloading' => progress == null ? tr('Завантажується…') : tr('Завантажується… {v}%', {'v': progress}),
      'processing' => tr('Обробка…'),
      'done' => tr('Готово'),
      'failed' => tr('Не вдалося'),
      _ => tr('У черзі'),
    };
    final (icon, color) = switch (status) {
      'done' => (LucideIcons.circleCheck, green),
      'failed' => (LucideIcons.circleAlert, danger),
      _ => (LucideIcons.loaderCircle, accent),
    };
    final name = track.isEmpty ? (text(item['host']) ?? text(item['url']) ?? '') : '${text(track['title']) ?? ''} · ${text(track['artist']) ?? ''}';
    return Glass(
      padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
      radius: 18,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, weight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text(label, style: body(12.5, color: status == 'failed' ? danger : muted)),
            ]),
          ),
          if (finished) IconButton(visualDensity: VisualDensity.compact, tooltip: tr('Прибрати'), onPressed: onDismiss, icon: Icon(LucideIcons.x, size: 18, color: muted)),
        ]),
        if (!finished)
          Padding(
            padding: const EdgeInsets.fromLTRB(28, 10, 8, 0),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(minHeight: 4, value: status == 'downloading' && progress != null ? progress / 100 : null, color: primary, backgroundColor: fg.withValues(alpha: 0.08)),
            ),
          ),
        if (status == 'failed')
          Padding(
            padding: const EdgeInsets.fromLTRB(28, 6, 8, 0),
            child: Text(text(item['error']) ?? tr('Не вдалося завантажити файл за посиланням.'), style: body(12.5, color: dangerSoft).copyWith(height: 1.35)),
          ),
        if (status == 'done' && track.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(28, 10, 8, 0),
            child: Align(alignment: Alignment.centerLeft, child: GhostButton(label: tr('Слухати'), icon: LucideIcons.play, expand: false, compact: true, onPressed: () => playTracks(context, [track], 0))),
          ),
      ]),
    );
  }
}

// ───────────────────────── Плейлисти ─────────────────────────

class PlaylistGrid extends StatelessWidget {
  const PlaylistGrid({required this.playlists, this.onCreate, this.onChanged, super.key});
  final List<Map<String, dynamic>> playlists;
  final VoidCallback? onCreate;
  final VoidCallback? onChanged;

  @override
  Widget build(BuildContext context) {
    if (playlists.isEmpty) {
      return EmptyState(
        icon: LucideIcons.listMusic,
        title: tr('Плейлистів поки немає'),
        text: onCreate == null ? null : tr('Зберіть треки під настрій: для катки, дороги чи вечора.'),
        action: onCreate == null ? null : tr('Створити плейлист'),
        onAction: onCreate,
      );
    }
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 0.8,
      children: [
        for (final p in playlists)
          Glass(
            padding: const EdgeInsets.all(8),
            onTap: () async {
              await context.push('/music/playlists/${p['id']}');
              onChanged?.call();
            },
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: PlaylistCover(playlist: p)),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Row(children: [
                  Expanded(child: Text(text(p['title']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, weight: FontWeight.w700))),
                  if (p['is_public'] == false) Icon(LucideIcons.lock, size: 14, color: muted),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 2, 4, 2),
                child: Text('${p['tracks_count'] ?? 0} ${plural(intOf(p['tracks_count']), 'трек', 'треки', 'треків')}', style: body(12, color: muted)),
              ),
            ]),
          ),
      ],
    );
  }
}

class PlaylistCover extends StatelessWidget {
  const PlaylistCover({required this.playlist, this.radius = 14, super.key});
  final Map<String, dynamic> playlist;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final cover = text(playlist['cover_url']);
    final covers = [for (final c in (playlist['covers'] as List? ?? const [])) '$c'];
    if (cover != null) return NetImage(cover, radius: radius, width: double.infinity);
    if (covers.length >= 4) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: GridView.count(
          crossAxisCount: 2,
          physics: const NeverScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          children: [for (final c in covers.take(4)) NetImage(c)],
        ),
      );
    }
    if (covers.isNotEmpty) return NetImage(covers.first, radius: radius, width: double.infinity);
    return CoverPlaceholder(seed: playlist['id'] ?? 0, icon: LucideIcons.listMusic, radius: radius, iconSize: 32);
  }
}

/// Створення (без [playlist]) або редагування плейлиста. Повертає id.
Future<int?> editPlaylist(BuildContext context, {Map<String, dynamic>? playlist}) {
  return showGcSheet<int>(
    context,
    title: playlist == null ? tr('Новий плейлист') : tr('Редагувати плейлист'),
    builder: (sheet) => _PlaylistForm(playlist: playlist, onDone: (id) => Navigator.pop(sheet, id)),
  );
}

class _PlaylistForm extends StatefulWidget {
  const _PlaylistForm({required this.playlist, required this.onDone});
  final Map<String, dynamic>? playlist;
  final ValueChanged<int> onDone;

  @override
  State<_PlaylistForm> createState() => _PlaylistFormState();
}

class _PlaylistFormState extends State<_PlaylistForm> {
  late final title = TextEditingController(text: text(widget.playlist?['title']) ?? '');
  late final description = TextEditingController(text: text(widget.playlist?['description']) ?? '');
  late bool isPublic = widget.playlist?['is_public'] != false;
  XFile? cover;
  bool busy = false;

  @override
  void dispose() {
    title.dispose();
    description.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final api = AppScope.read(context).session.api;
    setState(() => busy = true);
    final fields = {'title': title.text.trim(), 'description': description.text.trim(), 'is_public': isPublic ? '1' : '0'};
    try {
      if (widget.playlist == null) {
        final result = await api.post(Api.site('/music/playlists'), {...fields, 'is_public': isPublic});
        widget.onDone(int.tryParse((text(result['redirect']) ?? '').split('/').last) ?? 0);
      } else {
        final files = [if (cover != null) await http.MultipartFile.fromPath('cover', cover!.path, filename: cover!.name)];
        await api.upload(Api.site('/music/playlists/${widget.playlist!['id']}'), fields, files);
        widget.onDone(intOf(widget.playlist!['id']));
      }
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (widget.playlist != null) ...[
          GhostButton(
            label: cover == null ? tr('Змінити обкладинку') : tr('Обкладинку обрано'),
            icon: LucideIcons.image,
            onPressed: () async {
              final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1200, imageQuality: 90);
              if (picked != null) setState(() => cover = picked);
            },
          ),
          const SizedBox(height: 12),
        ],
        LabeledField(label: tr('Назва'), child: GcField(controller: title, label: tr('Наприклад, «Для катки»'), onChanged: (_) => setState(() {}))),
        const SizedBox(height: 10),
        LabeledField(label: tr('Опис'), child: GcField(controller: description, label: tr('Необов’язково'), maxLines: 3, minLines: 2)),
        SwitchListTile(
          value: isPublic,
          contentPadding: EdgeInsets.zero,
          title: Text(tr('Видно іншим у профілі'), style: body(14.5)),
          onChanged: (value) => setState(() => isPublic = value),
        ),
        const SizedBox(height: 8),
        PrimaryButton(label: widget.playlist == null ? tr('Створити') : tr('Зберегти'), busy: busy, onPressed: title.text.trim().isEmpty ? null : _save),
      ]),
    );
  }
}

class PlaylistScreen extends StatefulWidget {
  const PlaylistScreen({required this.id, super.key});
  final int id;

  @override
  State<PlaylistScreen> createState() => _PlaylistScreenState();
}

class _PlaylistScreenState extends State<PlaylistScreen> {
  Map<String, dynamic>? data;
  Object? error;

  Api get api => AppScope.read(context).session.api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final result = await api.get(Api.site('/music/playlists/${widget.id}'));
      if (mounted) setState(() => data = result);
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final page = data;
    if (page == null) {
      return error == null
          ? const ListSkeleton(rows: 6)
          : Center(child: Padding(padding: const EdgeInsets.all(20), child: EmptyState(icon: LucideIcons.listMusic, title: tr('Плейлист недоступний'), text: '$error')));
    }
    final playlist = mapOf(page['playlist']);
    final owner = mapOf(playlist['owner']);
    final tracks = maps(page['tracks']);
    final manage = mapOf(page['can'])['manage'] == true;
    final count = intOf(playlist['tracks_count'], tracks.length);
    return PlaySource(
      from: PlayFrom(text(playlist['title']) ?? tr('Плейлист'), '/music/playlists/${widget.id}'),
      child: ScreenScroll(
        onRefresh: _load,
        children: [
          Glass(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                RoundIcon(icon: LucideIcons.arrowLeft, onTap: () => context.pop()),
                const Spacer(),
                if (manage)
                  IconButton(
                    onPressed: () async {
                      final choice = await showGcSheet<String>(
                        context,
                        builder: (sheet) => Padding(
                          padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
                          child: Column(mainAxisSize: MainAxisSize.min, children: [
                            SheetAction(icon: LucideIcons.pencil, label: tr('Редагувати'), onTap: () => Navigator.pop(sheet, 'edit')),
                            SheetAction(icon: LucideIcons.trash2, label: tr('Видалити плейлист'), color: dangerSoft, onTap: () => Navigator.pop(sheet, 'delete')),
                          ]),
                        ),
                      );
                      if (!context.mounted || choice == null) return;
                      if (choice == 'edit') {
                        if (await editPlaylist(context, playlist: playlist) != null) _load();
                      } else if (await confirm(context, tr('Видалити плейлист?'), text: tr('Треки залишаться у ваших аудіозаписах.'), action: tr('Видалити'), danger: true)) {
                        if (!context.mounted) return;
                        if (await attempt(context, () => api.delete(Api.site('/music/playlists/${widget.id}'))) && context.mounted) context.pop();
                      }
                    },
                    icon: Icon(LucideIcons.ellipsis, color: muted),
                  ),
              ]),
              const SizedBox(height: 8),
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SizedBox(width: 110, height: 110, child: PlaylistCover(playlist: playlist, radius: 18)),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(playlist['is_public'] == false ? tr('Приватний плейлист') : tr('Плейлист'), style: body(12, color: muted)),
                    const SizedBox(height: 4),
                    Text(text(playlist['title']) ?? '', style: display(19)),
                    const SizedBox(height: 6),
                    GestureDetector(
                      onTap: () => context.push('/u/${owner['username']}'),
                      child: Text(text(owner['name']) ?? '', style: body(13, color: const Color(0xFF9AA8FF), weight: FontWeight.w600)),
                    ),
                    Text('$count ${plural(count, 'трек', 'треки', 'треків')} · ${minutesLabel(playlist['duration'])}', style: body(12.5, color: muted)),
                  ]),
                ),
              ]),
              if (text(playlist['description']) != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(text(playlist['description'])!, style: body(14, color: soft))),
              if (tracks.isNotEmpty) ...[
                const SizedBox(height: 14),
                Row(children: [
                  Expanded(child: PrimaryButton(label: tr('Слухати'), icon: LucideIcons.play, onPressed: () => playTracks(context, tracks, 0))),
                  const SizedBox(width: 10),
                  Expanded(child: GhostButton(label: tr('Перемішати'), icon: LucideIcons.shuffle, onPressed: () => playTracks(context, tracks, DateTime.now().millisecond % tracks.length, shuffle: true))),
                ]),
                const SizedBox(height: 10),
                CollectionDownloadButton(
                  collectionKey: 'playlist:${widget.id}',
                  kind: 'playlist',
                  title: text(playlist['title']) ?? tr('Плейлист'),
                  subtitle: text(owner['name']),
                  coverUrl: text(playlist['cover_url']),
                  path: '/music/playlists/${widget.id}',
                  tracks: tracks,
                ),
              ],
            ]),
          ),
          const SizedBox(height: 12),
          if (tracks.isEmpty)
            EmptyState(icon: LucideIcons.volumeOff, title: tr('Плейлист порожній'), text: manage ? tr('Додавайте треки через меню «⋯» у списку музики.') : null)
          else
            Glass(
              padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
              child: Column(children: [
                for (var i = 0; i < tracks.length; i++) LibraryTrack(key: ValueKey('pl-${tracks[i]['id']}'), tracks: tracks, index: i, playlistId: widget.id, canManagePlaylist: manage, onChanged: _load),
              ]),
            ),
        ],
      ),
    );
  }
}

// ───────────────────────── Spotify ─────────────────────────

/// Чи бачать інші, що людина слухає: одне налаштування сайту й застосунку для всієї музики.
bool showsListening(Map<String, dynamic>? me) => me?['show_listening'] != false;

/// «Показувати, що я слухаю» (треки GameCon, радіо й Spotify). Перемикається одразу,
/// а якщо сервер відмовив — повертається назад.
class ListeningSwitch extends StatefulWidget {
  const ListeningSwitch({super.key});

  @override
  State<ListeningSwitch> createState() => _ListeningSwitchState();
}

class _ListeningSwitchState extends State<ListeningSwitch> {
  bool? pending;

  Future<void> _toggle(bool value) async {
    final session = AppScope.read(context).session;
    setState(() => pending = value);
    if (!await attempt(context, () => session.api.patch(Api.site('/settings/listening'), {'show_listening': value}))) {
      if (mounted) setState(() => pending = null);
      return;
    }
    try {
      await session.refreshMe();
      if (mounted) setState(() => pending = null);
    } catch (_) {
      // Збережено, а профіль не оновився — лишаємо нове значення до наступного оновлення.
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = AppScope.read(context).session;
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) => SwitchListTile(
        value: pending ?? showsListening(session.me),
        contentPadding: EdgeInsets.zero,
        title: Text(tr('Показувати, що я слухаю'), style: body(14.5, weight: FontWeight.w600)),
        subtitle: Text(tr('Друзі бачать трек у профілі й у «Зараз слухають»'), style: body(12.5, color: muted)),
        onChanged: _toggle,
      ),
    );
  }
}

class SpotifyPanel extends StatefulWidget {
  const SpotifyPanel({required this.configured, required this.account, required this.onChanged, super.key});
  final bool configured;
  final Map<String, dynamic>? account;
  final VoidCallback onChanged;

  @override
  State<SpotifyPanel> createState() => _SpotifyPanelState();
}

class _SpotifyPanelState extends State<SpotifyPanel> {
  String section = 'top';
  List<Map<String, dynamic>> items = [];
  bool loading = false;
  String? error;
  final query = TextEditingController();
  Timer? debounce;

  Api get api => AppScope.read(context).session.api;

  @override
  void initState() {
    super.initState();
    if (widget.account != null) WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    query.dispose();
    debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final q = query.text.trim();
      final data = q.isNotEmpty
          ? await api.get(Api.site('/music/spotify/search?q=${Uri.encodeQueryComponent(q)}'))
          : await api.get(Api.site('/music/spotify/library/$section'));
      if (mounted) setState(() => items = maps(data[section == 'playlists' && q.isEmpty ? 'playlists' : 'tracks']));
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _connect() async {
    try {
      final json = await api.post('/api/v1/music/spotify/connect');
      final url = text(json['url']);
      if (url != null) await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _openPlaylist(Map<String, dynamic> playlist) async {
    await showGcSheet<void>(
      context,
      title: text(playlist['name']),
      subtitle: text(playlist['owner']),
      height: MediaQuery.sizeOf(context).height * 0.8,
      builder: (sheet) => FutureBuilder<Map<String, dynamic>>(
        future: api.get(Api.site('/music/spotify/playlists/${playlist['id']}')),
        builder: (context, snapshot) {
          if (!snapshot.hasData) return snapshot.hasError ? QuietEmpty(icon: LucideIcons.circleAlert, text: '${snapshot.error}') : const Center(child: CircularProgressIndicator(strokeWidth: 2));
          final tracks = maps(snapshot.data!['tracks']);
          return ListView(padding: const EdgeInsets.fromLTRB(10, 0, 10, 20), children: [
            for (var i = 0; i < tracks.length; i++) TrackRow(track: tracks[i], onTap: () => playTracks(context, tracks, i)),
          ]);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.configured) {
      return EmptyState(icon: LucideIcons.audioLines, title: tr('Spotify ще не підключено'), text: tr('Адміністратор ще не налаштував інтеграцію зі Spotify.'));
    }
    final account = widget.account;
    if (account == null) {
      return EmptyState(
        icon: LucideIcons.audioLines,
        title: tr('Під’єднайте Spotify'),
        text: tr('Ваші топ-треки, плейлисти й нещодавнє — прямо в GameCon. Пошук Spotify для записів на стіні.'),
        action: tr('Під’єднати Spotify'),
        onAction: _connect,
      );
    }
    return Column(children: [
      Glass(
        padding: const EdgeInsets.all(14),
        child: Column(children: [
          Row(children: [
            Avatar(url: text(account['avatar_url']), name: text(account['display_name']) ?? 'Spotify', size: 44),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(text(account['display_name']) ?? 'Spotify', style: body(15, weight: FontWeight.w700)),
                Text(account['premium'] == true ? 'Spotify Premium' : 'Spotify Free', style: body(12.5, color: muted)),
              ]),
            ),
            const SpotifyMark(size: 26),
          ]),
          // Spotify — додатковий перемикач: діє, лише коли ввімкнено «Показувати, що я слухаю».
          ListenableBuilder(
            listenable: AppScope.read(context).session,
            builder: (context, _) {
              final main = showsListening(AppScope.read(context).session.me);
              return SwitchListTile(
                value: main && account['show_now_playing'] == true,
                contentPadding: EdgeInsets.zero,
                title: Text(tr('Показувати «Зараз грає» зі Spotify'), style: body(14)),
                subtitle: Text(main ? tr('У профілі й у друзів') : tr('Вимкнено в налаштуваннях «Показувати, що я слухаю» — для всієї музики.'), style: body(12, color: muted)),
                onChanged: main
                    ? (value) async {
                        if (await attempt(context, () => api.patch(Api.site('/music/spotify'), {'show_now_playing': value}))) widget.onChanged();
                      }
                    : null,
              );
            },
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () async {
                if (!await confirm(context, tr('Від’єднати Spotify?'), action: tr('Від’єднати'), danger: true)) return;
                if (!context.mounted) return;
                if (await attempt(context, () => api.delete('/api/v1/music/spotify'), success: tr('Spotify від’єднано.'))) widget.onChanged();
              },
              icon: const Icon(LucideIcons.unlink, size: 18, color: dangerSoft),
              label: Text(tr('Від’єднати'), style: body(13, color: dangerSoft)),
            ),
          ),
        ]),
      ),
      const SizedBox(height: 12),
      Glass(
        padding: EdgeInsets.all(12),
        child: Column(children: [
          GcField(
            controller: query,
            label: tr('Пошук у Spotify'),
            icon: LucideIcons.search,
            dense: true,
            onChanged: (_) {
              debounce?.cancel();
              debounce = Timer(Duration(milliseconds: 400), _load);
            },
          ),
          if (query.text.trim().isEmpty) ...[
            SizedBox(height: 10),
            Segmented(
              scroll: true,
              options: [SegmentOption('top', tr('Топ')), SegmentOption('recent', tr('Нещодавні')), SegmentOption('saved', tr('Збережені')), SegmentOption('playlists', tr('Плейлисти'))],
              selected: section,
              onSelect: (value) {
                setState(() => section = value);
                _load();
              },
            ),
          ],
          const SizedBox(height: 8),
          if (loading)
            const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator(strokeWidth: 2)))
          else if (error != null)
            QuietEmpty(icon: LucideIcons.circleAlert, text: error!)
          else if (items.isEmpty)
            QuietEmpty(icon: LucideIcons.audioLines, text: tr('Тут поки порожньо'))
          else if (section == 'playlists' && query.text.trim().isEmpty)
            for (final p in items)
              ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                leading: SizedBox(width: 46, height: 46, child: NetImage(text(p['cover_url']), radius: 10)),
                title: Text(text(p['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14.5, weight: FontWeight.w600)),
                subtitle: Text(tr('{v} треків', {'v': p['tracks_count'] ?? 0}), style: body(12, color: muted)),
                onTap: () => _openPlaylist(p),
              )
          else
            for (var i = 0; i < items.length; i++) TrackRow(track: items[i], onTap: () => playTracks(context, items, i)),
        ]),
      ),
    ]);
  }
}
