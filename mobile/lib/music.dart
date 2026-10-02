import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'feed.dart';
import 'posts.dart';
import 'state.dart';
import 'theme.dart';
import 'track_edit.dart';
import 'widgets.dart';

/// Грає список локальних треків (Spotify-треки відкриваються в Spotify).
Future<void> playTracks(BuildContext context, List<Map<String, dynamic>> tracks, int index, {bool shuffle = false}) async {
  final track = tracks[index];
  if (text(track['source']) == 'spotify') {
    final link = text(track['url']) ?? 'https://open.spotify.com/track/${track['id']}';
    await launchUrl(Uri.parse(link), mode: LaunchMode.externalApplication);
    return;
  }
  final player = AppScope.read(context).player;
  final local = tracks.where((t) => text(t['source']) != 'spotify').toList();
  final start = local.indexWhere((t) => '${t['id']}' == '${track['id']}');
  if (shuffle && !player.shuffle) player.toggleShuffle();
  if (!shuffle && player.shuffle) player.toggleShuffle();
  await player.playList(local, start < 0 ? 0 : start);
}

String minutesLabel(dynamic seconds) {
  final total = intOf(seconds);
  if (total >= 3600) return '${total ~/ 3600} год ${(total % 3600) ~/ 60} хв';
  return '${(total / 60).round()} хв';
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
    final limits = mapOf(page?['limits']);
    final done = await showGcSheet<bool>(
      context,
      title: 'Завантажити трек',
      subtitle: 'До ${limits['max_mb'] ?? 20} МБ · ${(limits['formats'] as List? ?? const ['mp3']).join(', ')}',
      builder: (sheet) => _UploadTrack(formats: [for (final f in (limits['formats'] as List? ?? const ['mp3', 'm4a', 'ogg', 'wav', 'flac'])) '$f'], onDone: () => Navigator.pop(sheet, true)),
    );
    if (done == true) _load(reset: true);
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
    if (data == null) return const Center(child: CircularProgressIndicator(strokeWidth: 2.4));
    if (other) return _otherUser(data);

    final stats = mapOf(data['stats']);
    final spotify = mapOf(data['spotify']);
    final account = spotify['account'] is Map ? mapOf(spotify['account']) : null;
    final playlists = maps(data['playlists']);

    return ScreenScroll(
      onRefresh: () => _load(reset: true),
      children: [
        HeroCard(
          badge: 'МУЗИКА GAMECON',
          badgeIcon: LucideIcons.music,
          title: 'Ваш',
          accent: 'звук,',
          after: 'ваші правила',
          text: 'Завантажуйте треки, збирайте плейлисти, діліться музикою на стіні та слухайте Spotify прямо тут.',
          children: [
            Wrap(spacing: 8, runSpacing: 8, children: [
              Pill(label: '${stats['tracks'] ?? 0} ${plural(intOf(stats['tracks']), 'трек', 'треки', 'треків')}'),
              Pill(label: '${minutesLabel(stats['duration'])} музики'),
              Pill(label: '${stats['playlists'] ?? 0} ${plural(intOf(stats['playlists']), 'плейлист', 'плейлисти', 'плейлистів')}'),
              if (account != null) Pill(label: text(account['display_name']) ?? 'Spotify', icon: LucideIcons.audioLines, color: const Color(0xFF1ED760)),
            ]),
            const SizedBox(height: 14),
            Row(children: [
              Expanded(child: GhostButton(label: 'Плейлист', icon: LucideIcons.listPlus, onPressed: _newPlaylist)),
              const SizedBox(width: 10),
              Expanded(child: PrimaryButton(label: 'Завантажити', icon: LucideIcons.upload, onPressed: _upload)),
            ]),
          ],
        ),
        const SizedBox(height: 12),
        Glass(
          padding: const EdgeInsets.all(12),
          child: Column(children: [
            Segmented(
              scroll: true,
              options: [
                const SegmentOption('mine', 'Мої аудіозаписи', icon: LucideIcons.headphones),
                const SegmentOption('discover', 'Огляд', icon: LucideIcons.compass),
                SegmentOption('playlists', 'Плейлисти', icon: LucideIcons.listMusic, count: playlists.isEmpty ? null : playlists.length),
                const SegmentOption('spotify', 'Spotify', icon: LucideIcons.audioLines),
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
                label: tab == 'mine' ? 'Пошук у моїх аудіозаписах' : 'Пошук по всій музиці GameCon',
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
          _trackList(tab == 'mine' ? 'Мої аудіозаписи' : (query.text.trim().isEmpty ? 'Популярне на GameCon' : 'Результати пошуку'), playlists),
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
            if (tracks.isNotEmpty) PrimaryButton(label: 'Слухати все', icon: LucideIcons.play, compact: true, expand: false, onPressed: () => playTracks(context, tracks, 0)),
            if (tracks.length > 1) GhostButton(label: 'Перемішати', icon: LucideIcons.shuffle, compact: true, expand: false, onPressed: () => playTracks(context, tracks, DateTime.now().millisecond % tracks.length, shuffle: true)),
          ]),
        ),
        const SizedBox(height: 8),
        if (loading && tracks.isEmpty)
          const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator(strokeWidth: 2)))
        else if (tracks.isEmpty)
          QuietEmpty(
            icon: LucideIcons.volumeOff,
            text: tab == 'mine' && query.text.isEmpty ? 'Тут поки тихо. Завантажте трек або додайте з огляду.' : 'Нічого не знайдено',
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
                Text('Аудіозаписи', style: body(12.5, color: muted)),
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
        _trackList('Аудіозаписи', const []),
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
      if (mounted) toast(context, inLibrary ? 'Видалено з ваших аудіозаписів.' : 'Додано до ваших аудіозаписів.');
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _menu() async {
    final me = AppScope.read(context).session;
    final own = intOf(track['user_id']) == me.myId || me.isAdmin;
    final choice = await showGcSheet<String>(
      context,
      title: text(track['title']),
      subtitle: text(track['artist']),
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          SheetAction(icon: LucideIcons.play, label: 'Слухати', onTap: () => Navigator.pop(sheet, 'play')),
          if (text(track['source']) != 'spotify') ...[
            SheetAction(icon: LucideIcons.listStart, label: 'Грати наступним', onTap: () => Navigator.pop(sheet, 'next')),
            SheetAction(icon: LucideIcons.listEnd, label: 'Додати в чергу', onTap: () => Navigator.pop(sheet, 'queue')),
          ],
          SheetAction(icon: track['in_library'] == true ? LucideIcons.circleMinus : LucideIcons.circlePlus, label: track['in_library'] == true ? 'Прибрати з моїх' : 'Додати до моїх', onTap: () => Navigator.pop(sheet, 'library')),
          SheetAction(icon: LucideIcons.listPlus, label: 'Додати до плейлиста', onTap: () => Navigator.pop(sheet, 'playlist')),
          if (widget.playlistId != null && widget.canManagePlaylist) SheetAction(icon: LucideIcons.listMinus, label: 'Прибрати з плейлиста', onTap: () => Navigator.pop(sheet, 'detach')),
          if (own) SheetAction(icon: LucideIcons.pencil, label: 'Редагувати', onTap: () => Navigator.pop(sheet, 'edit')),
          if (own) SheetAction(icon: LucideIcons.trash2, label: 'Видалити трек', color: dangerSoft, onTap: () => Navigator.pop(sheet, 'delete')),
        ]),
      ),
    );
    if (!mounted || choice == null) return;
    switch (choice) {
      case 'play':
        await playTracks(context, widget.tracks, widget.index);
      case 'next' || 'queue':
        await AppScope.read(context).player.enqueue(track, next: choice == 'next');
        if (mounted) toast(context, choice == 'next' ? 'Заграє наступним.' : 'Додано в чергу.');
      case 'library':
        await _toggleLibrary();
      case 'playlist':
        await _addToPlaylist();
      case 'detach':
        if (await attempt(context, () => api.delete(Api.site('/music/playlists/${widget.playlistId}/tracks/${track['id']}')), success: 'Прибрано з плейлиста.')) widget.onChanged?.call();
      case 'edit':
        if (await _edit() == true) widget.onChanged?.call();
      case 'delete':
        if (!await confirm(context, 'Видалити трек?', text: 'Він зникне в усіх, хто додав його собі.', action: 'Видалити', danger: true)) return;
        if (!mounted) return;
        if (await attempt(context, () => api.delete(Api.site('/music/tracks/${track['id']}')), success: 'Трек видалено.')) widget.onChanged?.call();
    }
  }

  Future<void> _addToPlaylist() async {
    var playlists = widget.playlists;
    if (playlists.isEmpty) {
      try {
        playlists = maps((await api.get(Api.site('/music?tab=mine')))['playlists']);
      } catch (_) {}
    }
    if (!mounted) return;
    final mine = playlists.where((p) => intOf(p['user_id']) == AppScope.read(context).session.myId).toList();
    final picked = await showGcSheet<int>(
      context,
      title: 'Додати до плейлиста',
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          for (final p in mine)
            SheetAction(icon: LucideIcons.listMusic, label: '${p['title']} · ${p['tracks_count']}', onTap: () => Navigator.pop(sheet, intOf(p['id']))),
          SheetAction(icon: LucideIcons.plus, label: 'Новий плейлист', onTap: () => Navigator.pop(sheet, -1)),
        ]),
      ),
    );
    if (picked == null || !mounted) return;
    final id = picked == -1 ? await editPlaylist(context) : picked;
    if (id == null || !mounted) return;
    try {
      final result = await api.post(Api.site('/music/playlists/$id/tracks/${track['id']}'));
      if (mounted) toast(context, result['added'] == false ? 'Трек уже є в плейлисті.' : 'Додано до плейлиста.');
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<bool?> _edit() async {
    final player = AppScope.read(context).player;
    final card = await editTrackSheet(context, track);
    if (card == null) return false;
    player.updateMeta(card);
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final player = AppScope.of(context).player;
    return ListenableBuilder(
      listenable: player,
      builder: (context, _) => TrackRow(
        track: track,
        playing: player.isCurrent(track['id']),
        onTap: () => playTracks(context, widget.tracks, widget.index),
        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
          if (text(track['source']) != 'spotify')
            IconButton(
              visualDensity: VisualDensity.compact,
              tooltip: track['in_library'] == true ? 'У ваших аудіозаписах' : 'Додати до моїх',
              onPressed: _toggleLibrary,
              icon: Icon(track['in_library'] == true ? LucideIcons.check : LucideIcons.plus, size: 18, color: track['in_library'] == true ? const Color(0xFF9AA6FF) : muted),
            ),
          IconButton(visualDensity: VisualDensity.compact, onPressed: _menu, icon: const Icon(LucideIcons.ellipsis, color: muted, size: 20)),
        ]),
      ),
    );
  }
}

class _UploadTrack extends StatefulWidget {
  const _UploadTrack({required this.formats, required this.onDone});
  final List<String> formats;
  final VoidCallback onDone;

  @override
  State<_UploadTrack> createState() => _UploadTrackState();
}

class _UploadTrackState extends State<_UploadTrack> {
  PlatformFile? audio;
  XFile? cover;
  final title = TextEditingController();
  final artist = TextEditingController();
  final album = TextEditingController();
  final genre = TextEditingController();
  bool busy = false;
  bool searching = false;

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
      }, parts);
      if (mounted) toast(context, 'Трек завантажено 🎵');
      widget.onDone();
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
        GhostButton(label: audio == null ? 'Обрати аудіофайл' : audio!.name, icon: LucideIcons.fileAudio, onPressed: busy ? null : _pick),
        if (searching) Padding(padding: const EdgeInsets.only(top: 8), child: Row(children: [const SizedBox.square(dimension: 14, child: CircularProgressIndicator(strokeWidth: 2)), const SizedBox(width: 8), Text('Читаю теги й шукаю альбом…', style: body(12.5, color: muted))])),
        const SizedBox(height: 12),
        Row(children: [
          GestureDetector(
            onTap: () async {
              final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1200, imageQuality: 90);
              if (picked != null) setState(() => cover = picked);
            },
            child: SizedBox(
              width: 72,
              height: 72,
              child: cover == null
                  ? Container(
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(14), border: Border.all(color: line)),
                      child: const Icon(LucideIcons.imagePlus, color: muted),
                    )
                  : ClipRRect(borderRadius: BorderRadius.circular(14), child: Image(image: XFileImage(cover!), fit: BoxFit.cover)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text('Обкладинка (необов’язково). Якщо у файлі є вбудована — сервер візьме її.', style: body(12.5, color: muted))),
        ]),
        const SizedBox(height: 12),
        LabeledField(label: 'Назва', child: GcField(controller: title, label: 'Назва треку', onChanged: (_) => setState(() {}))),
        const SizedBox(height: 10),
        LabeledField(label: 'Виконавець', child: GcField(controller: artist, label: 'Виконавець', onChanged: (_) => setState(() {}))),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: GcField(controller: album, label: 'Альбом', dense: true)),
          const SizedBox(width: 10),
          Expanded(child: GcField(controller: genre, label: 'Жанр', dense: true)),
        ]),
        const SizedBox(height: 16),
        PrimaryButton(
          label: 'Завантажити',
          icon: LucideIcons.upload,
          busy: busy,
          onPressed: audio != null && !searching && title.text.trim().isNotEmpty && artist.text.trim().isNotEmpty ? _submit : null,
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
        title: 'Плейлистів поки немає',
        text: onCreate == null ? null : 'Зберіть треки під настрій: для катки, дороги чи вечора.',
        action: onCreate == null ? null : 'Створити плейлист',
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
                  if (p['is_public'] == false) const Icon(LucideIcons.lock, size: 14, color: muted),
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
    title: playlist == null ? 'Новий плейлист' : 'Редагувати плейлист',
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
            label: cover == null ? 'Змінити обкладинку' : 'Обкладинку обрано',
            icon: LucideIcons.image,
            onPressed: () async {
              final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1200, imageQuality: 90);
              if (picked != null) setState(() => cover = picked);
            },
          ),
          const SizedBox(height: 12),
        ],
        LabeledField(label: 'Назва', child: GcField(controller: title, label: 'Наприклад, «Для катки»', onChanged: (_) => setState(() {}))),
        const SizedBox(height: 10),
        LabeledField(label: 'Опис', child: GcField(controller: description, label: 'Необов’язково', maxLines: 3, minLines: 2)),
        SwitchListTile(
          value: isPublic,
          contentPadding: EdgeInsets.zero,
          title: Text('Видно іншим у профілі', style: body(14.5)),
          onChanged: (value) => setState(() => isPublic = value),
        ),
        const SizedBox(height: 8),
        PrimaryButton(label: widget.playlist == null ? 'Створити' : 'Зберегти', busy: busy, onPressed: title.text.trim().isEmpty ? null : _save),
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
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2.4))
          : Center(child: Padding(padding: const EdgeInsets.all(20), child: EmptyState(icon: LucideIcons.listMusic, title: 'Плейлист недоступний', text: '$error')));
    }
    final playlist = mapOf(page['playlist']);
    final owner = mapOf(playlist['owner']);
    final tracks = maps(page['tracks']);
    final manage = mapOf(page['can'])['manage'] == true;
    final count = intOf(playlist['tracks_count'], tracks.length);
    return ScreenScroll(
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
                          SheetAction(icon: LucideIcons.pencil, label: 'Редагувати', onTap: () => Navigator.pop(sheet, 'edit')),
                          SheetAction(icon: LucideIcons.trash2, label: 'Видалити плейлист', color: dangerSoft, onTap: () => Navigator.pop(sheet, 'delete')),
                        ]),
                      ),
                    );
                    if (!context.mounted || choice == null) return;
                    if (choice == 'edit') {
                      if (await editPlaylist(context, playlist: playlist) != null) _load();
                    } else if (await confirm(context, 'Видалити плейлист?', text: 'Треки залишаться у ваших аудіозаписах.', action: 'Видалити', danger: true)) {
                      if (!context.mounted) return;
                      if (await attempt(context, () => api.delete(Api.site('/music/playlists/${widget.id}'))) && context.mounted) context.pop();
                    }
                  },
                  icon: const Icon(LucideIcons.ellipsis, color: muted),
                ),
            ]),
            const SizedBox(height: 8),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SizedBox(width: 110, height: 110, child: PlaylistCover(playlist: playlist, radius: 18)),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(playlist['is_public'] == false ? 'Приватний плейлист' : 'Плейлист', style: body(12, color: muted)),
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
                Expanded(child: PrimaryButton(label: 'Слухати', icon: LucideIcons.play, onPressed: () => playTracks(context, tracks, 0))),
                const SizedBox(width: 10),
                Expanded(child: GhostButton(label: 'Перемішати', icon: LucideIcons.shuffle, onPressed: () => playTracks(context, tracks, DateTime.now().millisecond % tracks.length, shuffle: true))),
              ]),
            ],
          ]),
        ),
        const SizedBox(height: 12),
        if (tracks.isEmpty)
          EmptyState(icon: LucideIcons.volumeOff, title: 'Плейлист порожній', text: manage ? 'Додавайте треки через меню «⋯» у списку музики.' : null)
        else
          Glass(
            padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
            child: Column(children: [
              for (var i = 0; i < tracks.length; i++) LibraryTrack(key: ValueKey('pl-${tracks[i]['id']}'), tracks: tracks, index: i, playlistId: widget.id, canManagePlaylist: manage, onChanged: _load),
            ]),
          ),
      ],
    );
  }
}

// ───────────────────────── Spotify ─────────────────────────

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
      return const EmptyState(icon: LucideIcons.audioLines, title: 'Spotify ще не підключено', text: 'Адміністратор ще не налаштував інтеграцію зі Spotify.');
    }
    final account = widget.account;
    if (account == null) {
      return EmptyState(
        icon: LucideIcons.audioLines,
        title: 'Під’єднайте Spotify',
        text: 'Ваші топ-треки, плейлисти й нещодавнє — прямо в GameCon. Пошук Spotify для записів на стіні.',
        action: 'Під’єднати Spotify',
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
          SwitchListTile(
            value: account['show_now_playing'] == true,
            contentPadding: EdgeInsets.zero,
            title: Text('Показувати, що я слухаю', style: body(14)),
            subtitle: Text('У профілі й у друзів', style: body(12, color: muted)),
            onChanged: (value) async {
              if (await attempt(context, () => api.patch(Api.site('/music/spotify'), {'show_now_playing': value}))) widget.onChanged();
            },
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () async {
                if (!await confirm(context, 'Від’єднати Spotify?', action: 'Від’єднати', danger: true)) return;
                if (!context.mounted) return;
                if (await attempt(context, () => api.delete('/api/v1/music/spotify'), success: 'Spotify від’єднано.')) widget.onChanged();
              },
              icon: const Icon(LucideIcons.unlink, size: 18, color: dangerSoft),
              label: Text('Від’єднати', style: body(13, color: dangerSoft)),
            ),
          ),
        ]),
      ),
      const SizedBox(height: 12),
      Glass(
        padding: const EdgeInsets.all(12),
        child: Column(children: [
          GcField(
            controller: query,
            label: 'Пошук у Spotify',
            icon: LucideIcons.search,
            dense: true,
            onChanged: (_) {
              debounce?.cancel();
              debounce = Timer(const Duration(milliseconds: 400), _load);
            },
          ),
          if (query.text.trim().isEmpty) ...[
            const SizedBox(height: 10),
            Segmented(
              scroll: true,
              options: const [SegmentOption('top', 'Топ'), SegmentOption('recent', 'Нещодавні'), SegmentOption('saved', 'Збережені'), SegmentOption('playlists', 'Плейлисти')],
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
            const QuietEmpty(icon: LucideIcons.audioLines, text: 'Тут поки порожньо')
          else if (section == 'playlists' && query.text.trim().isEmpty)
            for (final p in items)
              ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                leading: SizedBox(width: 46, height: 46, child: NetImage(text(p['cover_url']), radius: 10)),
                title: Text(text(p['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14.5, weight: FontWeight.w600)),
                subtitle: Text('${p['tracks_count'] ?? 0} треків', style: body(12, color: muted)),
                onTap: () => _openPlaylist(p),
              )
          else
            for (var i = 0; i < items.length; i++) TrackRow(track: items[i], onTap: () => playTracks(context, items, i)),
        ]),
      ),
    ]);
  }
}
