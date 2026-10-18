import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'feed.dart';
import 'posts.dart';
import 'shell.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';
import 'i18n.dart';

final albumPrivacy = {
  'public': (LucideIcons.globe, tr('Усім')),
  'friends': (LucideIcons.usersRound, tr('Друзям')),
  'private': (LucideIcons.lock, tr('Тільки мені')),
};

// ───────────────────────── Фото користувача / спільноти ─────────────────────────

class PhotosScreen extends StatefulWidget {
  const PhotosScreen({this.username, this.community, super.key});
  final String? username;
  final String? community;

  @override
  State<PhotosScreen> createState() => _PhotosScreenState();
}

class _PhotosScreenState extends State<PhotosScreen> {
  Map<String, dynamic>? page;
  final photos = <Map<String, dynamic>>[];
  int current = 0;
  bool more = false;
  String tab = 'albums';
  Object? error;

  String get path => widget.community != null
      ? '/c/${widget.community}/photos'
      : '/photos/u/${widget.username ?? AppScope.read(context).session.username}';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load(reset: true));
  }

  Future<void> _load({bool reset = false}) async {
    final api = AppScope.read(context).session.api;
    try {
      final data = await api.get(Api.site('$path?page=${reset ? 1 : current + 1}'));
      final listing = Listing.parse(data['photos']);
      if (!mounted) return;
      setState(() {
        page = data;
        if (reset) photos.clear();
        photos.addAll(listing.items);
        current = listing.current;
        more = listing.more;
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  Future<void> _create() async {
    final id = await editAlbum(context, community: widget.community, privacyOptions: [for (final p in (page?['privacyOptions'] as List? ?? albumPrivacy.keys)) '$p']);
    if (id != null && mounted) {
      await context.push('/albums/$id');
      _load(reset: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = page;
    if (data == null) {
      return error == null
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2.4))
          : Center(child: Padding(padding: const EdgeInsets.all(20), child: EmptyState(icon: LucideIcons.images, title: tr('Фото недоступні'), text: '$error')));
    }
    final owner = mapOf(data['owner']);
    final albums = maps(data['albums']);
    final total = intOf(data['total']);
    final canCreate = mapOf(data['can'])['create'] == true;
    final viewerUrls = [for (final p in photos) absolute(p['url'])!];

    return ScreenScroll(
      onRefresh: () => _load(reset: true),
      children: [
        Glass(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            GestureDetector(
              onTap: () => context.push(appPathFor(text(owner['href']))),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(LucideIcons.arrowLeft, size: 14, color: muted),
                const SizedBox(width: 4),
                Text(owner['type'] == 'community' ? tr('До спільноти') : tr('До профілю'), style: body(12, color: muted)),
              ]),
            ),
            const SizedBox(height: 10),
            Row(children: [
              Avatar(url: text(owner['avatar_url']), name: text(owner['name']) ?? '?', size: 52, square: owner['type'] == 'community'),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(text(owner['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: display(17)),
                  const SizedBox(height: 2),
                  Text('${albums.length} ${plural(albums.length, 'альбом', 'альбоми', 'альбомів')} · $total ${plural(total, 'фотографія', 'фотографії', 'фотографій')}', style: body(12.5, color: muted)),
                ]),
              ),
            ]),
            if (canCreate) ...[
              const SizedBox(height: 14),
              PrimaryButton(label: tr('Створити альбом'), icon: LucideIcons.folderPlus, onPressed: _create),
            ],
          ]),
        ),
        const SizedBox(height: 12),
        if (albums.isEmpty)
          EmptyState(
            icon: LucideIcons.camera,
            title: tr('Тут поки немає альбомів'),
            text: canCreate ? tr('Створіть перший альбом і поділіться найкращими кадрами.') : tr('Альбомів, доступних вам, поки немає.'),
            action: canCreate ? tr('Створити альбом') : null,
            onAction: _create,
          )
        else ...[
          Segmented(
            options: [SegmentOption('albums', tr('Альбоми'), count: albums.length), SegmentOption('photos', tr('Усі фото'), count: total)],
            selected: tab,
            onSelect: (value) => setState(() => tab = value),
          ),
          const SizedBox(height: 12),
          if (tab == 'albums')
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 0.86,
              children: [
                for (final album in albums)
                  AlbumTile(album: album, onTap: () async {
                    await context.push('/albums/${album['id']}');
                    _load(reset: true);
                  }),
              ],
            )
          else ...[
            PhotoGrid(photos: photos, onOpen: (i) => openPhoto(context, photos, i, urls: viewerUrls, onChanged: () => _load(reset: true))),
            LoadMore(more: more, onMore: _load),
          ],
        ],
      ],
    );
  }
}

class AlbumTile extends StatelessWidget {
  const AlbumTile({required this.album, required this.onTap, super.key});
  final Map<String, dynamic> album;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final count = intOf(album['photos_count']);
    final privacy = albumPrivacy[album['privacy']];
    return Glass(
      padding: const EdgeInsets.all(8),
      onTap: onTap,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
          child: text(album['cover_url']) != null
              ? NetImage(text(album['cover_url']), radius: 14, width: double.infinity)
              : CoverPlaceholder(seed: album['id'] ?? 0, icon: LucideIcons.images, radius: 14, iconSize: 30),
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(children: [
            Expanded(child: Text(text(album['title']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, weight: FontWeight.w700))),
            if (privacy != null && album['privacy'] != 'public') Icon(privacy.$1, size: 14, color: muted),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 2, 4, 2),
          child: Text('$count ${plural(count, 'фото', 'фото', 'фото')}', style: body(12, color: muted)),
        ),
      ]),
    );
  }
}

class PhotoGrid extends StatelessWidget {
  const PhotoGrid({required this.photos, required this.onOpen, super.key});
  final List<Map<String, dynamic>> photos;
  final ValueChanged<int> onOpen;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, mainAxisSpacing: 4, crossAxisSpacing: 4),
      itemCount: photos.length,
      itemBuilder: (_, i) => GestureDetector(onTap: () => onOpen(i), child: NetImage(text(photos[i]['url']), radius: 10)),
    );
  }
}

/// Створення (без [album]) або редагування альбому. Повертає id альбому.
Future<int?> editAlbum(BuildContext context, {Map<String, dynamic>? album, String? community, List<String> privacyOptions = const ['public', 'friends', 'private']}) {
  return showGcSheet<int>(
    context,
    title: album == null ? tr('Новий альбом') : tr('Налаштування альбому'),
    builder: (sheet) => _AlbumForm(album: album, community: community, privacyOptions: privacyOptions, onDone: (id) => Navigator.pop(sheet, id)),
  );
}

class _AlbumForm extends StatefulWidget {
  const _AlbumForm({required this.album, required this.community, required this.privacyOptions, required this.onDone});
  final Map<String, dynamic>? album;
  final String? community;
  final List<String> privacyOptions;
  final ValueChanged<int> onDone;

  @override
  State<_AlbumForm> createState() => _AlbumFormState();
}

class _AlbumFormState extends State<_AlbumForm> {
  late final title = TextEditingController(text: text(widget.album?['title']) ?? '');
  late final description = TextEditingController(text: text(widget.album?['description']) ?? '');
  late String privacy = text(widget.album?['privacy']) ?? 'public';
  late bool comments = widget.album?['comments_enabled'] != false;
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
    final payload = {
      'title': title.text.trim(),
      'description': description.text.trim(),
      'privacy': privacy,
      'comments_enabled': comments,
      'community': ?widget.community,
    };
    try {
      if (widget.album == null) {
        final result = await api.post(Api.site('/albums'), payload);
        final id = int.tryParse((text(result['redirect']) ?? '').split('/').last) ?? 0;
        widget.onDone(id);
      } else {
        await api.patch(Api.site('/albums/${widget.album!['id']}'), payload);
        widget.onDone(intOf(widget.album!['id']));
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
        LabeledField(label: tr('Назва'), child: GcField(controller: title, label: tr('Наприклад, «Літо 2026»'), onChanged: (_) => setState(() {}))),
        const SizedBox(height: 10),
        LabeledField(label: tr('Опис'), child: GcField(controller: description, label: tr('Необов’язково'), maxLines: 4, minLines: 2)),
        const SizedBox(height: 12),
        Text(tr('Хто бачить'), style: body(13, color: muted)),
        const SizedBox(height: 6),
        Segmented(
          options: [
            for (final p in widget.privacyOptions)
              if (albumPrivacy[p] != null) SegmentOption(p, albumPrivacy[p]!.$2, icon: albumPrivacy[p]!.$1),
          ],
          selected: privacy,
          onSelect: (value) => setState(() => privacy = value),
        ),
        const SizedBox(height: 8),
        SwitchListTile(
          value: comments,
          contentPadding: EdgeInsets.zero,
          title: Text(tr('Дозволити коментарі'), style: body(14.5)),
          onChanged: (value) => setState(() => comments = value),
        ),
        const SizedBox(height: 8),
        PrimaryButton(label: widget.album == null ? tr('Створити альбом') : tr('Зберегти'), busy: busy, onPressed: title.text.trim().isEmpty ? null : _save),
      ]),
    );
  }
}

// ───────────────────────── Альбом ─────────────────────────

class AlbumScreen extends StatefulWidget {
  const AlbumScreen({required this.id, this.openPhoto, super.key});
  final int id;
  final int? openPhoto;

  @override
  State<AlbumScreen> createState() => _AlbumScreenState();
}

class _AlbumScreenState extends State<AlbumScreen> {
  Map<String, dynamic>? page;
  final photos = <Map<String, dynamic>>[];
  int current = 0;
  bool more = false;
  bool uploading = false;
  Object? error;
  bool opened = false;

  Api get api => AppScope.read(context).session.api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load(reset: true));
  }

  Future<void> _load({bool reset = false}) async {
    try {
      final data = await api.get(Api.site('/albums/${widget.id}?page=${reset ? 1 : current + 1}'));
      final listing = Listing.parse(data['photos']);
      if (!mounted) return;
      setState(() {
        page = data;
        if (reset) photos.clear();
        photos.addAll(listing.items);
        current = listing.current;
        more = listing.more;
        error = null;
      });
      if (!opened && widget.openPhoto != null) {
        opened = true;
        WidgetsBinding.instance.addPostFrameCallback((_) => _openById(widget.openPhoto!));
      }
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  void _openById(int id) {
    final index = photos.indexWhere((p) => intOf(p['id']) == id);
    if (index >= 0) {
      openPhoto(context, photos, index, onChanged: () => _load(reset: true));
    } else {
      Navigator.of(context).push(MaterialPageRoute<void>(fullscreenDialog: true, builder: (_) => PhotoScreen(id: id)));
    }
  }

  Future<void> _upload() async {
    final limit = intOf(mapOf(page?['limits'])['upload'], 30);
    final picked = await ImagePicker().pickMultiImage(imageQuality: 90, limit: limit);
    if (picked.isEmpty || !mounted) return;
    setState(() => uploading = true);
    try {
      final files = [for (final image in picked.take(limit)) await http.MultipartFile.fromPath('photos[]', image.path, filename: image.name)];
      final result = await api.upload(Api.site('/albums/${widget.id}/photos'), {}, files);
      if (mounted) toast(context, text(result['message']) ?? tr('Фото завантажено.'));
      await _load(reset: true);
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => uploading = false);
    }
  }

  Future<void> _menu() async {
    final album = mapOf(page?['album']);
    final choice = await showGcSheet<String>(
      context,
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          SheetAction(icon: LucideIcons.pencil, label: tr('Редагувати альбом'), onTap: () => Navigator.pop(sheet, 'edit')),
          SheetAction(icon: LucideIcons.trash2, label: tr('Видалити альбом'), color: dangerSoft, onTap: () => Navigator.pop(sheet, 'delete')),
        ]),
      ),
    );
    if (!mounted || choice == null) return;
    if (choice == 'edit') {
      final saved = await editAlbum(context, album: album, privacyOptions: [for (final p in (page?['privacyOptions'] as List? ?? albumPrivacy.keys)) '$p']);
      if (saved != null) _load(reset: true);
    } else {
      final count = intOf(album['photos_count']);
      if (!await confirm(context, tr('Видалити альбом?'), text: count > 0 ? tr('Разом з ним зникнуть {count} фото.', {'count': count}) : null, action: tr('Видалити'), danger: true)) return;
      if (!mounted) return;
      if (await attempt(context, () => api.delete(Api.site('/albums/${widget.id}')))) {
        if (mounted) context.pop();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = page;
    if (data == null) {
      return error == null
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2.4))
          : Center(child: Padding(padding: const EdgeInsets.all(20), child: EmptyState(icon: LucideIcons.images, title: tr('Альбом недоступний'), text: '$error')));
    }
    final album = mapOf(data['album']);
    final owner = mapOf(album['owner']);
    final can = mapOf(data['can']);
    final count = intOf(album['photos_count']);
    final privacy = albumPrivacy[album['privacy']];
    return ScreenScroll(
      onRefresh: () => _load(reset: true),
      children: [
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              RoundIcon(icon: LucideIcons.arrowLeft, onTap: () => context.canPop() ? context.pop() : context.push(appPathFor(text(owner['photos_href'])))),
              const SizedBox(width: 6),
              Avatar(url: text(owner['avatar_url']), name: text(owner['name']) ?? '?', size: 28, square: owner['type'] == 'community'),
              const SizedBox(width: 8),
              Expanded(child: Text(text(owner['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(13, color: muted))),
              if (can['manage'] == true) IconButton(onPressed: _menu, icon: Icon(LucideIcons.ellipsis, color: muted)),
            ]),
            const SizedBox(height: 10),
            Text(text(album['title']) ?? '', style: display(20)),
            if (text(album['description']) != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(text(album['description'])!, style: body(14, color: soft))),
            const SizedBox(height: 10),
            Wrap(spacing: 8, runSpacing: 6, children: [
              Pill(label: tr('{count} фото', {'count': count}), icon: LucideIcons.image),
              if (privacy != null) Pill(label: privacy.$2, icon: privacy.$1),
              if (album['comments_enabled'] == false) Pill(label: tr('Без коментарів'), icon: LucideIcons.messageCircleOff),
            ]),
            if (can['upload'] == true) ...[
              const SizedBox(height: 14),
              PrimaryButton(label: uploading ? tr('Завантажуємо…') : tr('Додати фото'), icon: LucideIcons.imagePlus, busy: uploading, onPressed: uploading ? null : _upload),
            ],
          ]),
        ),
        const SizedBox(height: 12),
        if (photos.isEmpty)
          EmptyState(
            icon: LucideIcons.camera,
            title: tr('Альбом порожній'),
            text: can['upload'] == true ? tr('Додайте перші фотографії.') : null,
            action: can['upload'] == true ? tr('Додати фото') : null,
            onAction: _upload,
          )
        else ...[
          PhotoGrid(photos: photos, onOpen: (i) => openPhoto(context, photos, i, onChanged: () => _load(reset: true))),
          LoadMore(more: more, onMore: _load),
        ],
      ],
    );
  }
}

/// Відкриває фото на повний екран: лайки, підпис, коментарі, обкладинка, видалення.
Future<void> openPhoto(BuildContext context, List<Map<String, dynamic>> photos, int index, {List<String>? urls, VoidCallback? onChanged}) async {
  await Navigator.of(context).push(MaterialPageRoute<void>(
    fullscreenDialog: true,
    builder: (_) => PhotoScreen(id: intOf(photos[index]['id']), ids: [for (final p in photos) intOf(p['id'])]),
  ));
  onChanged?.call();
}

class PhotoScreen extends StatefulWidget {
  const PhotoScreen({required this.id, this.ids, super.key});
  final int id;

  /// Порядок гортання; якщо не задано — prev/next з сервера.
  final List<int>? ids;

  @override
  State<PhotoScreen> createState() => _PhotoScreenState();
}

class _PhotoScreenState extends State<PhotoScreen> {
  late int id = widget.id;
  Map<String, dynamic>? data;
  bool showInfo = true;

  Api get api => AppScope.read(context).session.api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final result = await api.get(Api.site('/photos/$id'));
      if (mounted) setState(() => data = result);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  void _go(int? next) {
    if (next == null || next == 0) return;
    setState(() {
      id = next;
      data = null;
    });
    _load();
  }

  int? _neighbour(int step) {
    final ids = widget.ids;
    if (ids != null) {
      final i = ids.indexOf(id);
      final j = i + step;
      return i >= 0 && j >= 0 && j < ids.length ? ids[j] : null;
    }
    final photo = mapOf(data?['photo']);
    return step > 0 ? intOf(photo['next_id']) : intOf(photo['prev_id']);
  }

  Future<void> _like() async {
    final photo = mapOf(data?['photo']);
    try {
      final result = await api.post(Api.site('/photos/$id/like'));
      setState(() {
        photo['liked'] = result['liked'] == true;
        photo['likes_count'] = intOf(result['likes_count']);
        data!['photo'] = photo;
      });
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _menu() async {
    final photo = mapOf(data?['photo']);
    final can = mapOf(photo['can']);
    final choice = await showGcSheet<String>(
      context,
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (can['edit'] == true) SheetAction(icon: LucideIcons.textAlignStart, label: tr('Змінити підпис'), onTap: () => Navigator.pop(sheet, 'caption')),
          if (can['cover'] == true && photo['is_cover'] != true) SheetAction(icon: LucideIcons.image, label: tr('Зробити обкладинкою альбому'), onTap: () => Navigator.pop(sheet, 'cover')),
          if (can['delete'] == true) SheetAction(icon: LucideIcons.trash2, label: tr('Видалити фото'), color: dangerSoft, onTap: () => Navigator.pop(sheet, 'delete')),
        ]),
      ),
    );
    if (!mounted || choice == null) return;
    switch (choice) {
      case 'caption':
        final caption = await askText(context, tr('Підпис до фото'), initial: text(photo['caption']) ?? '', maxLines: 3);
        if (caption == null || !mounted) return;
        if (await attempt(context, () => api.patch(Api.site('/photos/$id'), {'caption': caption}))) _load();
      case 'cover':
        if (await attempt(context, () => api.post(Api.site('/photos/$id/cover')), success: tr('Обкладинку змінено.'))) _load();
      case 'delete':
        if (!await confirm(context, tr('Видалити фото?'), action: tr('Видалити'), danger: true)) return;
        if (!mounted) return;
        if (await attempt(context, () => api.delete(Api.site('/photos/$id')))) {
          if (mounted) Navigator.pop(context);
        }
    }
  }

  @override
  Widget build(BuildContext context) {
    final photo = mapOf(data?['photo']);
    final album = mapOf(photo['album']);
    final can = mapOf(photo['can']);
    final user = mapOf(photo['user']);
    final prev = _neighbour(-1);
    final next = _neighbour(1);
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(photo.isEmpty ? '' : tr('{v} з {v2}', {'v': photo['position'], 'v2': album['photos_count']}), style: body(15)),
        actions: [
          if (can['edit'] == true || can['delete'] == true || can['cover'] == true) IconButton(onPressed: _menu, icon: const Icon(LucideIcons.ellipsisVertical)),
        ],
      ),
      body: data == null
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2.4))
          : Column(children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => showInfo = !showInfo),
                  onHorizontalDragEnd: (details) {
                    final v = details.primaryVelocity ?? 0;
                    if (v < -200) _go(next);
                    if (v > 200) _go(prev);
                  },
                  child: Stack(children: [
                    Positioned.fill(child: InteractiveViewer(maxScale: 4, child: Center(child: NetImage(text(photo['url']), fit: BoxFit.contain)))),
                    if (prev != null) Positioned(left: 4, top: 0, bottom: 0, child: Center(child: IconButton(onPressed: () => _go(prev), icon: Icon(LucideIcons.chevronLeft, size: 34, color: fgSoft)))),
                    if (next != null) Positioned(right: 4, top: 0, bottom: 0, child: Center(child: IconButton(onPressed: () => _go(next), icon: Icon(LucideIcons.chevronRight, size: 34, color: fgSoft)))),
                  ]),
                ),
              ),
              if (showInfo)
                Container(
                  constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.45),
                  decoration: BoxDecoration(color: popover, border: Border(top: BorderSide(color: lineStrong))),
                  child: ListView(
                    shrinkWrap: true,
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 16),
                    children: [
                      Row(children: [
                        if (user.isNotEmpty) ...[
                          Avatar(url: text(user['avatar_url']), name: text(user['name']) ?? '?', size: 32),
                          const SizedBox(width: 10),
                        ],
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(text(user['name']) ?? text(mapOf(album['owner'])['name']) ?? '', style: body(13.5, weight: FontWeight.w700)),
                            Text('${album['title']} · ${ago(photo['created_at'])}', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
                          ]),
                        ),
                        IconButton(
                          onPressed: _like,
                          icon: Icon(photo['liked'] == true ? LucideIcons.heart600 : LucideIcons.heart, color: photo['liked'] == true ? const Color(0xFFFB7185) : soft),
                        ),
                        Text(compact(photo['likes_count']), style: body(13, color: soft)),
                        const SizedBox(width: 10),
                        Icon(LucideIcons.eye, size: 16, color: faint),
                        const SizedBox(width: 4),
                        Text(compact(photo['views_count']), style: body(12, color: faint)),
                      ]),
                      if (text(photo['caption']) != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(text(photo['caption'])!, style: body(14, color: soft))),
                      const SizedBox(height: 8),
                      CommentsThread(
                        key: ValueKey('photo-comments-$id'),
                        endpoint: Api.site('/photos/$id/comments'),
                        initial: maps(data!['comments']),
                        total: intOf(photo['comments_count']),
                        canComment: can['comment'] != false,
                        onCount: (value) => setState(() => photo['comments_count'] = value),
                      ),
                    ],
                  ),
                ),
            ]),
    );
  }
}
