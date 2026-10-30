import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'player_view.dart';
import 'plus.dart';
import 'shell.dart';
import 'state.dart';
import 'theme.dart';
import 'track_edit.dart';
import 'widgets.dart';
import 'i18n.dart';
import 'language_picker.dart';

final _visibility = {
  'public': (LucideIcons.globe, tr('Усім')),
  'friends': (LucideIcons.usersRound, tr('Друзям')),
  'private': (LucideIcons.lock, tr('Тільки мені')),
};

// ───────────────────────── Картка запису ─────────────────────────

class PostCard extends StatefulWidget {
  const PostCard({required this.post, this.onDeleted, this.onChanged, this.expanded = false, super.key});
  final Map<String, dynamic> post;
  final VoidCallback? onDeleted;
  final VoidCallback? onChanged;
  final bool expanded;

  @override
  State<PostCard> createState() => _PostCardState();
}

class _PostCardState extends State<PostCard> {
  late bool liked = widget.post['liked'] == true;
  late String? reaction = text(widget.post['reaction']) ?? (liked ? 'like' : null);
  late int likes = intOf(widget.post['likes_count']);
  late int comments = intOf(widget.post['comments_count']);
  late bool showComments = widget.expanded || maps(widget.post['comments']).isNotEmpty;
  bool fullText = false;
  bool deleted = false;

  Map<String, dynamic> get post => widget.post;

  /// Реакція як на сайті: та сама — знімає, інша — замінює.
  Future<void> _react(String next) async {
    final api = AppScope.read(context).session.api;
    final previous = reaction;
    final previousLikes = likes;
    final removing = previous == next;
    setState(() {
      reaction = removing ? null : next;
      liked = reaction != null;
      likes += previous == null ? 1 : (removing ? -1 : 0);
    });
    try {
      final result = await api.post('/api/v1/posts/${post['id']}/like', {'reaction': next});
      if (mounted) {
        setState(() {
          reaction = text(result['reaction']);
          liked = result['liked'] == true;
          likes = intOf(result['likes_count'], likes);
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          reaction = previous;
          liked = previous != null;
          likes = previousLikes;
        });
        toast(context, e);
      }
    }
  }

  void _copyLink() {
    Clipboard.setData(ClipboardData(text: '${Api.root}/posts/${post['id']}'));
    toast(context, tr('Посилання скопійовано.'));
  }

  Future<void> _menu() async {
    final can = mapOf(post['can']);
    final api = AppScope.read(context).session.api;
    final choice = await showGcSheet<String>(
      context,
      builder: (sheet) => Padding(
        padding: EdgeInsets.fromLTRB(12, 0, 12, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _SheetAction(icon: LucideIcons.link, label: tr('Копіювати посилання'), onTap: () => Navigator.pop(sheet, 'link')),
            _SheetAction(
              icon: post['saved'] == true ? LucideIcons.bookmarkCheck : LucideIcons.bookmark,
              label: post['saved'] == true ? tr('Прибрати зі збереженого') : tr('Зберегти'),
              onTap: () => Navigator.pop(sheet, 'save'),
            ),
            _SheetAction(icon: LucideIcons.clock, label: tr('Прочитати пізніше'), onTap: () => Navigator.pop(sheet, 'later')),
            if (can['edit'] == true) _SheetAction(icon: LucideIcons.pencil, label: tr('Редагувати'), onTap: () => Navigator.pop(sheet, 'edit')),
            if (can['share'] == true) _SheetAction(icon: LucideIcons.share2, label: tr('Поділитися на стіні'), onTap: () => Navigator.pop(sheet, 'share')),
            if (can['quote'] == true) _SheetAction(icon: LucideIcons.quote, label: tr('Цитувати'), onTap: () => Navigator.pop(sheet, 'quote')),
            if (can['hide'] == true) _SheetAction(icon: LucideIcons.eyeOff, label: tr('Не цікаво'), onTap: () => Navigator.pop(sheet, 'hide')),
            if (can['mute'] == true)
              _SheetAction(
                icon: post['muted'] == true ? LucideIcons.volume2 : LucideIcons.volumeX,
                label: post['muted'] == true ? tr('Зняти заглушку') : tr('Заглушити'),
                onTap: () => Navigator.pop(sheet, 'mute'),
              ),
            if (can['pin'] == true)
              _SheetAction(
                icon: post['is_pinned'] == true ? LucideIcons.pinOff : LucideIcons.pin,
                label: post['is_pinned'] == true ? tr('Відкріпити') : tr('Закріпити'),
                onTap: () => Navigator.pop(sheet, 'pin'),
              ),
            if (can['delete'] == true) _SheetAction(icon: LucideIcons.trash2, label: tr('Видалити запис'), color: dangerSoft, onTap: () => Navigator.pop(sheet, 'delete')),
          ],
        ),
      ),
    );
    if (!mounted || choice == null) return;
    if (choice == 'link') return _copyLink();
    if (choice == 'save') {
      try {
        final result = await api.post(Api.site('/saved'), {'kind': 'post', 'id': post['id']});
        if (!mounted) return;
        setState(() => post['saved'] = result['saved'] == true);
        toast(context, post['saved'] == true ? tr('Збережено.') : tr('Прибрано зі збереженого.'));
      } catch (e) {
        if (mounted) toast(context, e);
      }
      return;
    }
    if (choice == 'later') {
      try {
        final result = await api.post(Api.site('/posts/${post['id']}/later'));
        if (mounted) toast(context, result['later'] == true ? tr('Додано до «Прочитати пізніше»') : tr('Прибрано зі списку «Прочитати пізніше»'));
      } catch (e) {
        if (mounted) toast(context, e);
      }
      return;
    }
    if (choice == 'edit') {
      final body = await askText(context, tr('Редагувати запис'), initial: text(post['body']) ?? '', maxLines: 8);
      if (body == null || body.trim().isEmpty || !mounted) return;
      if (await attempt(context, () => api.patch(Api.site('/posts/${post['id']}'), {'body': body.trim()}))) {
        setState(() => post['body'] = body.trim());
        widget.onChanged?.call();
      }
      return;
    }
    if (choice == 'share') {
      await attempt(context, () => api.post(Api.site('/posts/${post['id']}/share')), success: tr('Запис опубліковано на вашій стіні.'));
      return;
    }
    if (choice == 'quote') {
      final body = await askText(context, tr('Цитувати'), hint: tr('Ваш коментар до цитати…'), action: tr('Опублікувати'), maxLines: 5);
      if (body == null || body.trim().isEmpty || !mounted) return;
      await attempt(context, () => api.post(Api.site('/posts/${post['id']}/quote'), {'body': body.trim()}), success: tr('Цитату опубліковано.'));
      return;
    }
    if (choice == 'hide') {
      if (await attempt(context, () => api.post(Api.site('/posts/${post['id']}/hide')), success: tr('Більше не покажемо цей запис.'))) {
        setState(() => deleted = true);
        widget.onDeleted?.call();
      }
      return;
    }
    if (choice == 'mute') {
      final wasMuted = post['muted'] == true;
      if (await attempt(context, () => api.post(Api.site('/posts/${post['id']}/mute')), success: wasMuted ? tr('Заглушку знято.') : tr('Записи автора більше не з’являтимуться в стрічці.'))) {
        setState(() => post['muted'] = !wasMuted);
        widget.onChanged?.call();
      }
      return;
    }
    if (choice == 'pin') {
      if (await attempt(context, () => api.post(Api.site('/posts/${post['id']}/pin')))) {
        setState(() => post['is_pinned'] = post['is_pinned'] != true);
        widget.onChanged?.call();
      }
      return;
    }
    if (choice == 'delete') {
      if (!await confirm(context, tr('Видалити запис?'), action: tr('Видалити'), danger: true)) return;
      if (!mounted) return;
      if (await attempt(context, () => api.delete('/api/v1/posts/${post['id']}'))) {
        setState(() => deleted = true);
        widget.onDeleted?.call();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (deleted) return SizedBox.shrink();
    final author = mapOf(post['author']);
    final publisher = post['publisher'] is Map ? mapOf(post['publisher']) : null;
    final wall = post['wall'] is Map ? mapOf(post['wall']) : null;
    final who = publisher ?? author;
    final name = text(who['name']) ?? 'GameCon';
    final session = AppScope.read(context).session;
    final bodyText = maskProfanity(text(post['body']) ?? '', text(session.me?['profanity_mask']));
    final badge = post['badge'] is Map ? mapOf(post['badge']) : null;
    final tag = post['tag'] is Map ? mapOf(post['tag']) : null;
    final lang = text(post['lang']);
    final long = bodyText.length > 420 && !fullText && !widget.expanded;
    final vis = _visibility[text(post['visibility']) ?? 'public'] ?? _visibility['public']!;
    final images = maps(post['attachments']).where((a) => absolute(a['url']) != null).toList();
    final music = post['music'] is Map ? mapOf(post['music']) : null;
    final movie = post['movie'] is Map ? mapOf(post['movie']) : null;
    final views = intOf(post['views_count']);
    final commentsEnabled = post['comments_enabled'] != false;

    void openWho() {
      final href = text(who['href']);
      if (href != null) {
        context.push(appPathFor(href));
      } else if (text(author['username']) != null) {
        context.push('/u/${author['username']}');
      }
    }

    return Padding(
      padding: EdgeInsets.only(bottom: 12),
      child: Glass(
        padding: EdgeInsets.fromLTRB(16, 16, 16, 14),
        radius: 24,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GestureDetector(
                  onTap: openWho,
                  child: Avatar(url: text(who['avatar_url']), name: name, size: 44, online: publisher == null && author['is_online'] == true, square: publisher != null, frame: publisher == null ? avatarFrameOf(author) : null),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 4,
                        children: [
                          GestureDetector(onTap: openWho, child: PlusName(name, plus: publisher == null ? nameMarkOf(author) : null, style: body(15, weight: FontWeight.w700), maxLines: null)),
                          if (who['is_verified'] == true) Icon(LucideIcons.badgeCheck, size: 15, color: primary),
                          if (publisher == null && PlusMark.of(author) != null) PlusBadge(size: 15),
                          if (publisher == null) SeasonBadge(user: author),
                          if (badge != null) RoleBadge(title: text(badge['title']) ?? '', color: text(badge['color'])),
                          if (wall != null) ...[
                            Icon(LucideIcons.chevronRight, size: 16, color: faint),
                            GestureDetector(
                              onTap: () => context.push(appPathFor(text(wall['href']))),
                              child: Text(text(wall['name']) ?? '', style: body(15, color: soft, weight: FontWeight.w600)),
                            ),
                          ],
                        ],
                      ),
                      SizedBox(height: 4),
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          GestureDetector(
                            onTap: () => context.push('/posts/${post['id']}'),
                            child: Text(ago(post['created_at']), style: body(12, color: muted)),
                          ),
                          Icon(vis.$1, size: 13, color: muted),
                          if (tag != null)
                            GestureDetector(
                              onTap: () => context.push(appPathFor(text(tag['href']))),
                              child: Pill(label: '#${tag['name']}', color: soft),
                            ),
                          if (post['pending'] == true) Pill(label: tr('На перевірці'), icon: LucideIcons.clock, color: Color(0xFFF5B342)),
                          if (post['is_pinned'] == true) Pill(label: tr('Закріплено'), icon: LucideIcons.pin, color: Color(0xFF9FB6FF)),
                        ],
                      ),
                    ],
                  ),
                ),
                IconButton(onPressed: _menu, icon: Icon(LucideIcons.ellipsis, color: muted), visualDensity: VisualDensity.compact),
              ],
            ),
            if (bodyText.isNotEmpty && lang != null && lang != I18n.locale.split('-').first)
              Padding(
                padding: EdgeInsets.only(top: 10),
                child: Text(tr('Оригінал: {language}', {'language': languageName(lang)}), style: body(11.5, color: faint)),
              ),
            if (bodyText.isNotEmpty)
              Padding(
                padding: EdgeInsets.only(top: 12),
                child: Translatable(
                  api: AppScope.read(context).session.api,
                  type: 'post',
                  id: intOf(post['id']),
                  original: bodyText,
                  builder: (context, shownText) => GestureDetector(
                    onTap: long ? () => setState(() => fullText = true) : null,
                    child: Text.rich(
                      TextSpan(children: [
                        TextSpan(text: long && shownText.length > 420 ? '${shownText.substring(0, 420).trimRight()}… ' : shownText),
                        if (long) TextSpan(text: tr('Показати повністю'), style: body(15, color: Color(0xFF9AA8FF), weight: FontWeight.w600)),
                      ]),
                      style: body(15, color: ink.withValues(alpha: 0.92)).copyWith(height: 1.5),
                    ),
                  ),
                ),
              ),
            if (post['shared'] is Map) _SharedCard(shared: mapOf(post['shared']), ownText: bodyText),
            if (images.isNotEmpty) Padding(padding: EdgeInsets.only(top: 12), child: MediaGrid(items: images)),
            if (music != null) Padding(padding: EdgeInsets.only(top: 12), child: MusicAttachment(track: music)),
            if (movie != null) Padding(padding: EdgeInsets.only(top: 12), child: MovieAttachment(movie: movie)),
            if (post['card'] is Map) Padding(padding: EdgeInsets.only(top: 12), child: _PostCardLink(card: mapOf(post['card']))),
            if (post['poll'] is Map) Padding(padding: EdgeInsets.only(top: 12), child: _PollBox(postId: intOf(post['id']), poll: mapOf(post['poll']))),
            if (post['locked'] == true) Padding(padding: EdgeInsets.only(top: 12), child: _LockedNotice(author: text(author['name']) ?? '')),
            if (post['subscribers_only'] == true && post['locked'] != true)
              Padding(padding: EdgeInsets.only(top: 10), child: Pill(label: tr('Для підписників'), icon: LucideIcons.lock)),
            SizedBox(height: 14),
            Row(
              children: [
                ReactionButton(reaction: reaction, count: likes, onPick: _react),
                SizedBox(width: 8),
                _ActionPill(
                  icon: LucideIcons.messageCircle,
                  label: comments > 0 ? compact(comments) : null,
                  onTap: commentsEnabled ? () => setState(() => showComments = true) : null,
                ),
                SizedBox(width: 8),
                _ActionPill(icon: LucideIcons.link, onTap: _copyLink),
                Spacer(),
                if (views > 0) ...[
                  Icon(LucideIcons.eye, size: 16, color: faint),
                  SizedBox(width: 4),
                  Text(compact(views), style: body(12, color: faint)),
                ],
              ],
            ),
            if (showComments)
              Padding(
                padding: EdgeInsets.only(top: 12),
                child: CommentsThread(
                  endpoint: '/api/v1/posts/${post['id']}/comments',
                  initial: maps(post['comments']),
                  total: comments,
                  canComment: mapOf(post['can'])['comment'] != false && commentsEnabled,
                  onCount: (value) => setState(() => comments = value),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ActionPill extends StatelessWidget {
  const _ActionPill({required this.icon, required this.onTap, this.label});
  final IconData icon;
  final VoidCallback? onTap;
  final String? label;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: onTap == null ? 0.4 : 1,
      child: Material(
        color: fg.withValues(alpha: 0.045),
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 18, color: soft.withValues(alpha: 0.7)),
                if (label != null) ...[SizedBox(width: 6), Text(label!, style: body(13.5, color: soft.withValues(alpha: 0.75), weight: FontWeight.w600))],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SheetAction extends StatelessWidget {
  _SheetAction({required this.icon, required this.label, required this.onTap, Color? color}) : color = color ?? ink;
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: color == ink ? muted : color),
      title: Text(label, style: body(15, color: color, weight: FontWeight.w500)),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      onTap: onTap,
    );
  }
}

/// Пункт у шторці дій (використовується різними екранами).
class SheetAction extends _SheetAction {
  // ignore: use_key_in_widget_constructors
  SheetAction({required super.icon, required super.label, required super.onTap, super.color});
}

// ───────────────────────── Вкладення ─────────────────────────

/// Сітка фото як `MediaGrid` сайту: 1 — на всю ширину, 2 — поруч, 3+ — мозаїка.
class MediaGrid extends StatelessWidget {
  const MediaGrid({required this.items, super.key});
  final List<Map<String, dynamic>> items;

  void _open(BuildContext context, int index) {
    Navigator.of(context).push(MaterialPageRoute<void>(
      fullscreenDialog: true,
      builder: (_) => PhotoViewer(urls: [for (final item in items) absolute(item['url'])!], initial: index),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final shown = items.take(4).toList();
    Widget tile(int i, {double? height}) => GestureDetector(
          onTap: () => _open(context, i),
          child: Stack(
            fit: StackFit.passthrough,
            children: [
              NetImage(text(shown[i]['url']), height: height, width: double.infinity),
              if (i == 3 && items.length > 4)
                Positioned.fill(
                  child: Container(color: Colors.black54, alignment: Alignment.center, child: Text('+${items.length - 4}', style: display(22))),
                ),
            ],
          ),
        );
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: switch (shown.length) {
        1 => () {
            final w = intOf(shown[0]['width']);
            final h = intOf(shown[0]['height']);
            final ratio = w > 0 && h > 0 ? (w / h).clamp(0.75, 1.9) : 4 / 3;
            return AspectRatio(aspectRatio: ratio.toDouble(), child: tile(0));
          }(),
        2 => SizedBox(height: 220, child: Row(children: [Expanded(child: tile(0, height: 220)), const SizedBox(width: 3), Expanded(child: tile(1, height: 220))])),
        3 => SizedBox(
            height: 260,
            child: Row(children: [
              Expanded(flex: 2, child: tile(0, height: 260)),
              const SizedBox(width: 3),
              Expanded(child: Column(children: [Expanded(child: tile(1)), const SizedBox(height: 3), Expanded(child: tile(2))])),
            ]),
          ),
        _ => SizedBox(
            height: 280,
            child: Column(children: [
              Expanded(child: Row(children: [Expanded(child: tile(0)), const SizedBox(width: 3), Expanded(child: tile(1))])),
              const SizedBox(height: 3),
              Expanded(child: Row(children: [Expanded(child: tile(2)), const SizedBox(width: 3), Expanded(child: tile(3))])),
            ]),
          ),
      },
    );
  }
}

class PhotoViewer extends StatefulWidget {
  const PhotoViewer({required this.urls, this.initial = 0, this.captions, super.key});
  final List<String> urls;
  final int initial;
  final List<String?>? captions;

  @override
  State<PhotoViewer> createState() => _PhotoViewerState();
}

class _PhotoViewerState extends State<PhotoViewer> {
  late final controller = PageController(initialPage: widget.initial);
  late int index = widget.initial;

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final caption = widget.captions != null && index < widget.captions!.length ? widget.captions![index] : null;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(tr('{v} з {v2}', {'v': index + 1, 'v2': widget.urls.length}), style: body(15)),
      ),
      body: Stack(
        children: [
          PageView.builder(
            controller: controller,
            itemCount: widget.urls.length,
            onPageChanged: (value) => setState(() => index = value),
            itemBuilder: (_, i) => InteractiveViewer(maxScale: 4, child: Center(child: NetImage(widget.urls[i], fit: BoxFit.contain))),
          ),
          if (caption != null && caption.isNotEmpty)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 24, 16, 28),
                decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Colors.black87])),
                child: Text(caption, style: body(14)),
              ),
            ),
        ],
      ),
    );
  }
}

/// Трек у записі: локальний грає в програвачі застосунку, Spotify відкривається в Spotify.
class MusicAttachment extends StatelessWidget {
  const MusicAttachment({required this.track, this.list, this.onRemove, super.key});
  final Map<String, dynamic> track;
  final List<Map<String, dynamic>>? list;
  final VoidCallback? onRemove;

  bool get spotify => text(track['source']) == 'spotify';

  Future<void> _play(BuildContext context) async {
    if (spotify) {
      final link = text(track['url']) ?? text(track['external_url']) ?? 'https://open.spotify.com/track/${track['id']}';
      await launchUrl(Uri.parse(link), mode: LaunchMode.externalApplication);
      return;
    }
    final player = AppScope.read(context).player;
    final items = list ?? [track];
    await player.playList(items, items.indexWhere((t) => '${t['id']}' == '${track['id']}').clamp(0, items.length - 1));
  }

  @override
  Widget build(BuildContext context) {
    final player = AppScope.of(context).player;
    return ListenableBuilder(
      listenable: player,
      builder: (context, _) {
        final current = !spotify && player.isCurrent(track['id']);
        final playing = current && player.playing;
        return Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: current ? primary.withValues(alpha: 0.1) : fg.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: current ? primary.withValues(alpha: 0.35) : line),
          ),
          child: Row(
            children: [
              GestureDetector(
                onTap: () => _play(context),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    TrackCover(url: absolute(track['cover_url']), seed: track['id'] ?? track['title'] ?? '', size: 48, radius: 12),
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.35), borderRadius: BorderRadius.circular(12)),
                      child: Icon(playing ? LucideIcons.pause : LucideIcons.play, color: Colors.white),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(text(track['title']) ?? tr('Трек'), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14.5, weight: FontWeight.w700)),
                    Text(artistOf(track['artist']), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12.5, color: muted)),
                  ],
                ),
              ),
              if (spotify) const Padding(padding: EdgeInsets.only(right: 6), child: SpotifyMark(size: 18)),
              if (!spotify && intOf(track['duration']) > 0) Text(duration(track['duration']), style: body(12, color: muted)),
              if (onRemove != null) IconButton(onPressed: onRemove, icon: Icon(LucideIcons.x, color: muted, size: 20)),
            ],
          ),
        );
      },
    );
  }
}

class SpotifyMark extends StatelessWidget {
  const SpotifyMark({this.size = 20, super.key});
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(color: Color(0xFF1ED760), shape: BoxShape.circle),
      child: Icon(LucideIcons.audioLines, size: size * 0.66, color: Colors.black),
    );
  }
}

class MovieAttachment extends StatelessWidget {
  const MovieAttachment({required this.movie, super.key});
  final Map<String, dynamic> movie;

  @override
  Widget build(BuildContext context) {
    return Glass(
      padding: const EdgeInsets.all(10),
      radius: 18,
      onTap: () {
        final slug = text(movie['slug']);
        if (slug != null) context.push('/cinema/$slug');
      },
      child: Row(
        children: [
          SizedBox(width: 56, height: 80, child: NetImage(text(movie['poster']), radius: 10)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(text(movie['title']) ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(15, weight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text([movie['year'], text(movie['type_label'])].whereType<Object>().join(' · '), style: body(12.5, color: muted)),
              ],
            ),
          ),
          Icon(LucideIcons.circlePlay, color: primary, size: 30),
        ],
      ),
    );
  }
}

// ───────────────────────── Коментарі ─────────────────────────

class CommentsThread extends StatefulWidget {
  const CommentsThread({
    required this.endpoint,
    required this.initial,
    required this.total,
    required this.canComment,
    required this.onCount,
    this.deletePath,
    this.likePath,
    super.key,
  });

  /// GET/POST коментарів (`/api/v1/posts/1/comments`, `/api/v1/site/photos/3/comments`).
  final String endpoint;
  final List<Map<String, dynamic>> initial;
  final int total;
  final bool canComment;
  final ValueChanged<int> onCount;
  final String Function(dynamic id)? deletePath;
  final String Function(dynamic id)? likePath;

  @override
  State<CommentsThread> createState() => _CommentsThreadState();
}

class _CommentsThreadState extends State<CommentsThread> {
  late List<Map<String, dynamic>> comments = [...widget.initial];
  late bool loadedAll = widget.initial.length >= widget.total;
  final input = TextEditingController();
  final focus = FocusNode();
  Map<String, dynamic>? replyTo;
  bool sending = false;

  @override
  void initState() {
    super.initState();
    if (comments.isEmpty && widget.total > 0) _loadAll();
  }

  @override
  void dispose() {
    input.dispose();
    focus.dispose();
    super.dispose();
  }

  Api get api => AppScope.read(context).session.api;

  Future<void> _loadAll() async {
    try {
      final data = await api.get(widget.endpoint);
      if (mounted) {
        setState(() {
          comments = maps(data['comments']);
          loadedAll = true;
        });
      }
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _send() async {
    final value = input.text.trim();
    if (value.isEmpty || sending) return;
    setState(() => sending = true);
    try {
      final data = await api.post(widget.endpoint, {'body': value, 'parent_id': replyTo?['id']});
      if (data['comment'] is Map) comments.add(mapOf(data['comment']));
      widget.onCount(intOf(data['comments_count'], comments.length));
      input.clear();
      replyTo = null;
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Future<void> _remove(Map<String, dynamic> comment) async {
    if (!await confirm(context, tr('Видалити коментар?'), action: tr('Видалити'), danger: true)) return;
    try {
      final path = widget.deletePath?.call(comment['id']) ?? Api.site('/comments/${comment['id']}');
      final data = await api.delete(path);
      setState(() => comments.removeWhere((c) => '${c['id']}' == '${comment['id']}' || '${c['parent_id']}' == '${comment['id']}'));
      widget.onCount(intOf(data['comments_count'], comments.length));
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _like(Map<String, dynamic> comment) async {
    final was = comment['liked'] == true;
    setState(() {
      comment['liked'] = !was;
      comment['likes_count'] = intOf(comment['likes_count']) + (was ? -1 : 1);
    });
    try {
      final path = widget.likePath?.call(comment['id']) ?? Api.site('/comments/${comment['id']}/like');
      final data = await api.post(path);
      setState(() {
        comment['liked'] = data['liked'] == true;
        comment['likes_count'] = intOf(data['likes_count'], intOf(comment['likes_count']));
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final me = AppScope.of(context).session.me ?? {};
    final byId = {for (final c in comments) '${c['id']}': c};
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Divider(height: 1, color: line),
        const SizedBox(height: 10),
        if (!loadedAll && widget.total > comments.length)
          TextButton(
            onPressed: _loadAll,
            child: Text(tr('Показати всі {total} {v}', {'total': widget.total, 'v': plural(widget.total, 'коментар', 'коментарі', 'коментарів')}), style: body(13, color: const Color(0xFF9AA8FF), weight: FontWeight.w600)),
          ),
        for (final comment in comments) _comment(comment, byId[text(comment['parent_id']) ?? '']),
        if (widget.canComment) ...[
          if (replyTo != null)
            Padding(
              padding: const EdgeInsets.only(left: 44, bottom: 4),
              child: Row(children: [
                Icon(LucideIcons.cornerDownRight, size: 14, color: muted),
                const SizedBox(width: 4),
                Expanded(child: Text(tr('Відповідь {v}', {'v': text(mapOf(replyTo!['user'])['first_name']) ?? ''}), style: body(12, color: muted))),
                GestureDetector(onTap: () => setState(() => replyTo = null), child: Icon(LucideIcons.x, size: 16, color: muted)),
              ]),
            ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Avatar(url: text(me['avatar_url']), name: text(me['name']) ?? tr('Я'), size: 34),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: input,
                  focusNode: focus,
                  minLines: 1,
                  maxLines: 5,
                  style: body(16),
                  decoration: InputDecoration(
                    hintText: tr('Написати коментар…'),
                    hintStyle: body(14.5, color: faint),
                    filled: true,
                    fillColor: field,
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(18), borderSide: BorderSide(color: lineStrong)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(18), borderSide: BorderSide(color: lineStrong)),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(18), borderSide: BorderSide(color: primary, width: 1.4)),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              RoundIcon(icon: LucideIcons.send, onTap: sending ? null : _send, filled: true, size: 40),
            ],
          ),
        ],
      ],
    );
  }

  Widget _comment(Map<String, dynamic> comment, Map<String, dynamic>? parent) {
    final user = mapOf(comment['user']);
    final name = text(user['name']) ?? tr('Гравець');
    return Padding(
      padding: EdgeInsets.only(bottom: 10, left: comment['parent_id'] != null ? 36 : 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(onTap: () => context.push('/u/${user['username']}'), child: Avatar(url: text(user['avatar_url']), name: name, size: 32)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
                  decoration: BoxDecoration(
                    color: fg.withValues(alpha: 0.045),
                    borderRadius: const BorderRadius.only(topLeft: Radius.circular(6), topRight: Radius.circular(18), bottomLeft: Radius.circular(18), bottomRight: Radius.circular(18)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: body(13, weight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Translatable(
                        api: AppScope.read(context).session.api,
                        type: 'comment',
                        id: intOf(comment['id']),
                        original: maskProfanity(text(comment['body']) ?? '', text(AppScope.read(context).session.me?['profanity_mask'])),
                        builder: (context, shownText) => Text.rich(
                          TextSpan(children: [
                            if (parent != null) TextSpan(text: '${text(mapOf(parent['user'])['first_name']) ?? ''}, ', style: body(14, color: const Color(0xFF9AA8FF))),
                            TextSpan(text: shownText),
                          ]),
                          style: body(14, color: ink.withValues(alpha: 0.88)).copyWith(height: 1.35),
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(left: 8, top: 4),
                  child: Row(
                    children: [
                      Text(ago(comment['created_at']), style: body(11.5, color: faint)),
                      if (widget.canComment) ...[
                        const SizedBox(width: 12),
                        GestureDetector(
                          onTap: () {
                            setState(() => replyTo = comment);
                            focus.requestFocus();
                          },
                          child: Text(tr('Відповісти'), style: body(11.5, color: muted, weight: FontWeight.w600)),
                        ),
                      ],
                      if (comment['can_delete'] == true) ...[
                        const SizedBox(width: 12),
                        GestureDetector(onTap: () => _remove(comment), child: Icon(LucideIcons.trash2, size: 15, color: faint)),
                      ],
                      const Spacer(),
                      GestureDetector(
                        onTap: () => _like(comment),
                        child: Row(children: [
                          Icon(comment['liked'] == true ? LucideIcons.heart600 : LucideIcons.heart, size: 15, color: comment['liked'] == true ? const Color(0xFFFB7185) : faint),
                          if (intOf(comment['likes_count']) > 0) ...[const SizedBox(width: 3), Text(compact(comment['likes_count']), style: body(11.5, color: muted))],
                        ]),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ───────────────────────── Редактор запису ─────────────────────────

/// «Що нового, Tonny?» — як PostComposer сайту: текст, фото, музика, видимість, стіна друга або спільноти.
class Composer extends StatefulWidget {
  const Composer({this.wall, this.wallName, this.community, this.communityName, this.canPostAsCommunity = false, this.communityAvatar, required this.onPosted, super.key});

  /// Стіна друга (username) — пишемо йому на стіну.
  final String? wall;
  final String? wallName;

  /// Спільнота (slug) — запис у стрічку спільноти.
  final String? community;
  final String? communityName;
  final String? communityAvatar;
  final bool canPostAsCommunity;
  final VoidCallback onPosted;

  @override
  State<Composer> createState() => _ComposerState();
}

class _ComposerState extends State<Composer> {
  final input = TextEditingController();
  final images = <XFile>[];
  Map<String, dynamic>? track;
  String visibility = 'public';
  late bool asCommunity = widget.canPostAsCommunity;
  bool busy = false;
  bool focused = false;

  @override
  void dispose() {
    input.dispose();
    super.dispose();
  }

  bool get ready => input.text.trim().isNotEmpty || images.isNotEmpty || track != null;

  Future<void> _pickImages() async {
    final picked = await ImagePicker().pickMultiImage(imageQuality: 88);
    if (picked.isNotEmpty) setState(() => images.addAll(picked.take(10 - images.length)));
  }

  Future<void> _pickMusic() async {
    final picked = await pickMusic(context);
    if (picked != null) setState(() => track = picked);
  }

  Future<void> _publish() async {
    if (!ready || busy) return;
    final api = AppScope.read(context).session.api;
    setState(() => busy = true);
    try {
      final fields = <String, String>{
        'body': input.text.trim(),
        'visibility': visibility,
        if (widget.wall != null) 'wall': widget.wall!,
        if (widget.community != null) 'community': widget.community!,
        if (widget.community != null) 'as_community': asCommunity ? '1' : '0',
        ...musicFields(track),
      };
      final files = [for (final image in images) await http.MultipartFile.fromPath('images[]', image.path, filename: image.name)];
      await api.upload('/api/v1/posts', fields, files);
      input.clear();
      images.clear();
      track = null;
      FocusManager.instance.primaryFocus?.unfocus();
      widget.onPosted();
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = AppScope.of(context).session.me ?? {};
    final first = text(me['first_name']) ?? text(me['name']) ?? '';
    final placeholder = widget.community != null
        ? (asCommunity ? tr('Новина від імені «{v}»…', {'v': widget.communityName ?? ''}) : tr('Напишіть у спільноту…'))
        : widget.wall != null
            ? tr('Напишіть щось {v}…', {'v': widget.wallName ?? ''})
            : (first.isEmpty ? tr('Що нового?') : tr('Що нового, {first}?', {'first': first}));
    final expanded = focused || ready;
    return Glass(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
      radius: 24,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              asCommunity && widget.community != null
                  ? Avatar(url: widget.communityAvatar, name: widget.communityName ?? '?', size: 40, square: true)
                  : Avatar(url: text(me['avatar_url']), name: text(me['name']) ?? tr('Я'), size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Focus(
                  onFocusChange: (value) => setState(() => focused = value),
                  child: TextField(
                    controller: input,
                    minLines: expanded ? 3 : 1,
                    maxLines: 12,
                    onChanged: (_) => setState(() {}),
                    style: body(16).copyWith(height: 1.45),
                    decoration: InputDecoration(
                      hintText: placeholder,
                      hintStyle: body(15, color: faint),
                      filled: true,
                      fillColor: field,
                      isDense: true,
                      contentPadding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: lineStrong)),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: lineStrong)),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: primary, width: 1.4)),
                    ),
                  ),
                ),
              ),
            ],
          ),
          if (images.isNotEmpty)
            SizedBox(
              height: 84,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.only(top: 8),
                itemCount: images.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (_, i) => Stack(
                  children: [
                    ClipRRect(borderRadius: BorderRadius.circular(12), child: Image(image: XFileImage(images[i]), width: 76, height: 76, fit: BoxFit.cover)),
                    Positioned(
                      right: 2,
                      top: 2,
                      child: GestureDetector(
                        onTap: () => setState(() => images.removeAt(i)),
                        child: Container(decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle), child: const Icon(LucideIcons.x, size: 16)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          if (track != null) Padding(padding: const EdgeInsets.only(top: 10), child: MusicAttachment(track: track!, onRemove: () => setState(() => track = null))),
          const SizedBox(height: 10),
          Row(
            children: [
              _ToolIcon(icon: LucideIcons.image, onTap: _pickImages, tooltip: tr('Фото')),
              _ToolIcon(icon: LucideIcons.music, onTap: _pickMusic, tooltip: tr('Музика')),
              if (widget.wall == null && widget.community == null) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(color: fg.withValues(alpha: 0.04), borderRadius: BorderRadius.circular(14), border: Border.all(color: line)),
                  child: Row(
                    children: [
                      for (final entry in _visibility.entries)
                        Tooltip(
                          message: entry.value.$2,
                          child: GestureDetector(
                            onTap: () => setState(() => visibility = entry.key),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
                              decoration: BoxDecoration(color: visibility == entry.key ? fg.withValues(alpha: 0.1) : Colors.transparent, borderRadius: BorderRadius.circular(10)),
                              child: Icon(entry.value.$1, size: 16, color: visibility == entry.key ? ink : muted),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
              if (widget.community != null && widget.canPostAsCommunity)
                GestureDetector(
                  onTap: () => setState(() => asCommunity = !asCommunity),
                  child: Padding(
                    padding: const EdgeInsets.only(left: 6),
                    child: Pill(label: asCommunity ? tr('Від спільноти') : tr('Від себе'), icon: LucideIcons.arrowLeftRight, color: accent),
                  ),
                ),
              const Spacer(),
              PrimaryButton(label: tr('Пост'), icon: LucideIcons.sparkles, onPressed: ready ? _publish : null, busy: busy, expand: false, compact: true),
            ],
          ),
        ],
      ),
    );
  }
}

class _ToolIcon extends StatelessWidget {
  const _ToolIcon({required this.icon, required this.onTap, required this.tooltip});
  final IconData icon;
  final VoidCallback onTap;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: tooltip,
      onPressed: onTap,
      visualDensity: VisualDensity.compact,
      icon: Icon(icon, color: accent, size: 21),
    );
  }
}

/// `XFile` як ImageProvider (прев’ю перед відправкою).
class XFileImage extends FileImageProxy {
  XFileImage(XFile file) : super(file.path);
}

class FileImageProxy extends ResizeImage {
  FileImageProxy(String path) : super(FileImageLoader(path), width: 240);
}

class FileImageLoader extends ImageProvider<FileImageLoader> {
  FileImageLoader(this.path);
  final String path;

  @override
  Future<FileImageLoader> obtainKey(ImageConfiguration configuration) async => this;

  @override
  ImageStreamCompleter loadImage(FileImageLoader key, ImageDecoderCallback decode) {
    return OneFrameImageStreamCompleter(_load(decode));
  }

  Future<ImageInfo> _load(ImageDecoderCallback decode) async {
    final bytes = await XFile(path).readAsBytes();
    final buffer = await ImmutableBuffer.fromUint8List(bytes);
    final codec = await decode(buffer);
    final frame = await codec.getNextFrame();
    return ImageInfo(image: frame.image);
  }

  @override
  bool operator ==(Object other) => other is FileImageLoader && other.path == path;

  @override
  int get hashCode => path.hashCode;
}

Map<String, String> musicFields(Map<String, dynamic>? track) {
  if (track == null) return const {};
  final spotify = text(track['source']) == 'spotify';
  return {
    'music[source]': spotify ? 'spotify' : 'local',
    'music[id]': '${track['id']}',
    if (spotify) ...{
      'music[title]': text(track['title']) ?? '',
      'music[artist]': text(track['artist']) ?? '',
      if (text(track['album']) != null) 'music[album]': text(track['album'])!,
      if (track['duration'] != null) 'music[duration]': '${intOf(track['duration'])}',
      if (text(track['cover_url']) != null) 'music[cover_url]': text(track['cover_url'])!,
    },
  };
}

/// «Прикріпити музику»: вкладки Мої / Усі на GameCon / Spotify, як MusicPicker сайту.
Future<Map<String, dynamic>?> pickMusic(BuildContext context) {
  return showGcSheet<Map<String, dynamic>>(
    context,
    title: tr('Прикріпити музику'),
    subtitle: tr('Оберіть трек — він з’явиться у записі з плеєром.'),
    height: MediaQuery.sizeOf(context).height * 0.8,
    builder: (sheet) => _MusicPicker(onPick: (track) => Navigator.pop(sheet, track)),
  );
}

class _MusicPicker extends StatefulWidget {
  const _MusicPicker({required this.onPick});
  final ValueChanged<Map<String, dynamic>> onPick;

  @override
  State<_MusicPicker> createState() => _MusicPickerState();
}

class _MusicPickerState extends State<_MusicPicker> {
  final query = TextEditingController();
  String source = 'mine';
  List<Map<String, dynamic>> tracks = [];
  bool loading = false;
  String? error;
  Timer? debounce;

  @override
  void initState() {
    super.initState();
    _search();
  }

  @override
  void dispose() {
    query.dispose();
    debounce?.cancel();
    super.dispose();
  }

  Future<void> _search() async {
    final api = AppScope.read(context).session.api;
    final q = query.text.trim();
    if (source == 'spotify' && q.isEmpty) {
      setState(() {
        tracks = [];
        error = null;
      });
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final params = Uri(queryParameters: {'q': q, if (source != 'spotify') 'scope': source == 'all' ? 'all' : 'mine'}).query;
      final data = await api.get(source == 'spotify' ? Api.site('/music/spotify/search?$params') : Api.site('/music/search?$params'));
      if (mounted) setState(() => tracks = maps(data['tracks']));
    } catch (e) {
      if (mounted) {
        setState(() {
          tracks = [];
          error = '$e';
        });
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 4, 16, 16),
      child: Column(
        children: [
          Segmented(
            options: [SegmentOption('mine', tr('Мої')), SegmentOption('all', tr('Усі на GameCon')), SegmentOption('spotify', 'Spotify')],
            selected: source,
            onSelect: (value) {
              setState(() => source = value);
              _search();
            },
          ),
          const SizedBox(height: 12),
          GcField(
            controller: query,
            label: source == 'spotify' ? tr('Пошук у Spotify') : tr('Назва або виконавець'),
            icon: LucideIcons.search,
            dense: true,
            onChanged: (_) {
              debounce?.cancel();
              debounce = Timer(const Duration(milliseconds: 350), _search);
            },
          ),
          const SizedBox(height: 10),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                : error != null
                    ? QuietEmpty(icon: LucideIcons.circleAlert, text: error!)
                    : tracks.isEmpty
                        ? QuietEmpty(
                            icon: source == 'spotify' ? LucideIcons.audioLines : LucideIcons.volumeOff,
                            text: source == 'spotify' && query.text.trim().isEmpty ? tr('Почніть вводити назву треку') : tr('Нічого не знайдено'),
                          )
                        : ListView.builder(
                            itemCount: tracks.length,
                            itemBuilder: (_, i) => TrackRow(track: tracks[i], onTap: () => widget.onPick(tracks[i]), compactRow: true),
                          ),
          ),
        ],
      ),
    );
  }
}

/// Рядок треку (обкладинка, назва, виконавець, тривалість).
class TrackRow extends StatelessWidget {
  const TrackRow({required this.track, this.onTap, this.trailing, this.playing = false, this.compactRow = false, super.key});
  final Map<String, dynamic> track;
  final VoidCallback? onTap;
  final Widget? trailing;
  final bool playing;
  final bool compactRow;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
        decoration: BoxDecoration(color: playing ? primary.withValues(alpha: 0.08) : Colors.transparent, borderRadius: BorderRadius.circular(14)),
        child: Row(
          children: [
            Stack(
              alignment: Alignment.center,
              children: [
                TrackCover(url: absolute(track['cover_url']), seed: track['id'] ?? track['title'] ?? '', size: 46, radius: 12),
                if (playing) const Icon(LucideIcons.audioLines, color: Colors.white),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(text(track['title']) ?? tr('Без назви'), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14.5, color: playing ? accent : ink, weight: FontWeight.w600)),
                  Text(artistOf(track['artist'], '—'), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12.5, color: muted)),
                ],
              ),
            ),
            if (text(track['source']) == 'spotify') const Padding(padding: EdgeInsets.only(right: 8), child: SpotifyMark(size: 16)),
            if (intOf(track['duration']) > 0) Text(duration(track['duration']), style: body(12, color: muted)),
            ?trailing,
          ],
        ),
      ),
    );
  }
}


const reactionGlyphs = [
  ('like', '❤️', 'Подобається'),
  ('fire', '🔥', 'Вогонь'),
  ('laugh', '😂', 'Смішно'),
  ('gg', '🎮', 'Добре зіграно'),
  ('sad', '😢', 'Шкода'),
];

/// Одна кнопка реакції: дотик — «подобається» (або зняти свою), довге натискання — смужка емоцій.
class ReactionButton extends StatelessWidget {
  const ReactionButton({super.key, required this.reaction, required this.count, required this.onPick});
  final String? reaction;
  final int count;
  final ValueChanged<String> onPick;

  Future<void> _openPicker(BuildContext context) async {
    final box = context.findRenderObject() as RenderBox?;
    if (box == null) return;
    final anchor = box.localToGlobal(Offset.zero);
    HapticFeedback.selectionClick();
    final picked = await showGeneralDialog<String>(
      context: context,
      barrierDismissible: true,
      barrierLabel: tr('Закрити'),
      barrierColor: Colors.transparent,
      transitionDuration: const Duration(milliseconds: 160),
      pageBuilder: (ctx, _, _) {
        final width = MediaQuery.sizeOf(ctx).width;
        const stripWidth = 5 * 48.0 + 12;
        final left = anchor.dx.clamp(8.0, width - stripWidth - 8);
        return Stack(children: [
          Positioned(
            left: left,
            top: anchor.dy - 62,
            child: Material(
              color: popover,
              elevation: 8,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30), side: BorderSide(color: lineStrong)),
              child: Padding(
                padding: const EdgeInsets.all(6),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  for (final (id, glyph, label) in reactionGlyphs)
                    Tooltip(
                      message: tr(label),
                      child: InkResponse(
                        onTap: () => Navigator.of(ctx).pop(id),
                        radius: 24,
                        child: Container(
                          width: 48,
                          height: 44,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: reaction == id ? fg.withValues(alpha: 0.12) : null,
                            shape: BoxShape.circle,
                          ),
                          child: Text(glyph, style: const TextStyle(fontSize: 24)),
                        ),
                      ),
                    ),
                ]),
              ),
            ),
          ),
        ]);
      },
      transitionBuilder: (ctx, animation, _, child) => FadeTransition(
        opacity: animation,
        child: SlideTransition(position: Tween(begin: const Offset(0, 0.02), end: Offset.zero).animate(animation), child: child),
      ),
    );
    if (picked != null) onPick(picked);
  }

  @override
  Widget build(BuildContext context) {
    final current = reactionGlyphs.where((r) => r.$1 == reaction).firstOrNull;
    return Material(
      color: current != null ? fg.withValues(alpha: 0.1) : fg.withValues(alpha: 0.045),
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: () => onPick(reaction ?? 'like'),
        onLongPress: () => _openPicker(context),
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            if (current != null)
              Text(current.$2, style: const TextStyle(fontSize: 16, height: 1.1))
            else
              Icon(LucideIcons.heart, size: 18, color: soft.withValues(alpha: 0.7)),
            if (count > 0) ...[const SizedBox(width: 6), Text(compact(count), style: body(13.5, color: current != null ? ink : soft.withValues(alpha: 0.75), weight: FontWeight.w600))],
          ]),
        ),
      ),
    );
  }
}


const _badgeColors = {
  'indigo': Color(0xFF9AA8FF),
  'sky': Color(0xFF9CBCFF),
  'emerald': Color(0xFF22D3A6),
  'amber': Color(0xFFF5B342),
  'rose': Color(0xFFFF7A59),
  'violet': Color(0xFFA58BFF),
};

/// Підпис ролі учасника спільноти з кольором (як на сайті).
class RoleBadge extends StatelessWidget {
  const RoleBadge({super.key, required this.title, this.color});
  final String title;
  final String? color;

  @override
  Widget build(BuildContext context) {
    final tone = _badgeColors[color] ?? _badgeColors['indigo']!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: tone.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(20)),
      child: Text(title, style: body(11, color: tone, weight: FontWeight.w600)),
    );
  }
}


/// Поширений запис: звідки він (спільнота або людина) і його текст.
class _SharedCard extends StatelessWidget {
  const _SharedCard({required this.shared, required this.ownText});
  final Map<String, dynamic> shared;
  final String ownText;

  @override
  Widget build(BuildContext context) {
    final community = shared['community'] is Map ? mapOf(shared['community']) : null;
    final source = text(shared['body']) ?? '';
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push(appPathFor(text(shared['post_href']) ?? text(shared['href']))),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(color: fg.withValues(alpha: 0.04), borderRadius: BorderRadius.circular(16), border: Border.all(color: line)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              if (community != null) ...[Icon(LucideIcons.usersRound, size: 13, color: muted), const SizedBox(width: 4)],
              Flexible(
                child: Text(
                  community != null ? tr('Із спільноти «{name}»', {'name': community['name']}) : tr('Запис'),
                  style: body(11.5, color: muted),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ]),
            const SizedBox(height: 2),
            Text(text(shared['name']) ?? '', style: body(13.5, weight: FontWeight.w600)),
            if (source.isNotEmpty && source != ownText) ...[
              const SizedBox(height: 4),
              Text(source, maxLines: 3, overflow: TextOverflow.ellipsis, style: body(13.5, color: soft)),
            ],
          ]),
        ),
      ),
    );
  }
}



/// Картка в записі (гра, фільм, сервер…); GIF показується як зображення.
class _PostCardLink extends StatelessWidget {
  const _PostCardLink({required this.card});
  final Map<String, dynamic> card;

  @override
  Widget build(BuildContext context) {
    final image = text(card['image']);
    if (card['kind'] == 'gif' && image != null) {
      return ClipRRect(borderRadius: BorderRadius.circular(16), child: Image.network(image, fit: BoxFit.cover, width: double.infinity, gaplessPlayback: true));
    }
    return Glass(
      padding: const EdgeInsets.all(10),
      radius: 16,
      onTap: text(card['href']) == null ? null : () => context.push(appPathFor(text(card['href']))),
      child: Row(children: [
        SizedBox(width: 48, height: 48, child: image != null ? NetImage(image, radius: 12) : CoverPlaceholder(seed: card['title'] ?? '', radius: 12, icon: LucideIcons.sparkles)),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr(text(card['hint']) ?? ''), style: body(11.5, color: muted)),
            Text(text(card['title']) ?? '', style: body(14, weight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
          ]),
        ),
      ]),
    );
  }
}

/// Опитування в записі: голос одним дотиком, відсотки після голосу; у відкритому — хто як голосував.
class _PollBox extends StatefulWidget {
  const _PollBox({required this.postId, required this.poll});
  final int postId;
  final Map<String, dynamic> poll;

  @override
  State<_PollBox> createState() => _PollBoxState();
}

class _PollBoxState extends State<_PollBox> {
  late Map<String, dynamic> poll = widget.poll;
  bool busy = false;

  Future<void> _vote(int optionId) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final next = await AppScope.read(context).session.api.post(Api.site('/posts/${widget.postId}/poll'), {'option_id': optionId});
      if (mounted) setState(() => poll = next);
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = intOf(poll['total']);
    final voted = poll['voted'];
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: card.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(16)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(text(poll['question']) ?? '', style: body(14.5, weight: FontWeight.w600)),
        const SizedBox(height: 10),
        for (final o in maps(poll['options']))
          Builder(builder: (context) {
            final share = total > 0 ? (intOf(o['votes']) / total) : 0.0;
            final chosen = voted == o['id'];
            final voters = maps(o['voters']);
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => _vote(intOf(o['id'])),
                child: Container(
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: chosen ? primary : line)),
                  child: Stack(children: [
                    if (voted != null) Positioned.fill(child: FractionallySizedBox(alignment: Alignment.centerLeft, widthFactor: share, child: Container(color: primary.withValues(alpha: 0.22)))),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      child: Row(children: [
                        Expanded(child: Text(text(o['label']) ?? '', style: body(14))),
                        for (final v in voters.take(3)) Padding(padding: const EdgeInsets.only(left: 2), child: Avatar(url: text(v['avatar_url']), name: text(v['name']) ?? '', size: 20)),
                        if (voted != null) Padding(padding: const EdgeInsets.only(left: 8), child: Text('${(share * 100).round()}%', style: body(12, color: muted))),
                      ]),
                    ),
                  ]),
                ),
              ),
            );
          }),
        Text('${tr('{total} голосів', {'total': '$total'})} · ${poll['anonymous'] == false ? tr('відкрите опитування') : tr('анонімне')}', style: body(12, color: muted)),
      ]),
    );
  }
}

/// Запис лише для платних підписників автора. Підписки продаються тільки на сайті (правила Google Play),
/// тому тут — лише пояснення, без посилань на оплату.
class _LockedNotice extends StatelessWidget {
  const _LockedNotice({required this.author});
  final String author;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        Icon(LucideIcons.lock, size: 20, color: accent),
        const SizedBox(width: 12),
        Expanded(child: Text(tr('Запис лише для підписників {name}.', {'name': author}), style: body(14))),
      ]),
    );
  }
}
