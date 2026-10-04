import 'dart:async';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:video_player/video_player.dart';

import 'api.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Кільце довкола аватарки: кольорове — є нові історії, сіре — усе переглянуто.
class _Ring extends StatelessWidget {
  const _Ring({required this.seen, required this.child});
  final bool seen;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(2.5),
      decoration: BoxDecoration(shape: BoxShape.circle, gradient: seen ? null : brand, color: seen ? Colors.white24 : null),
      child: Container(padding: const EdgeInsets.all(2), decoration: const BoxDecoration(shape: BoxShape.circle, color: abyss), child: child),
    );
  }
}

/// Смуга історій над стрічкою.
class StoriesStrip extends StatefulWidget {
  const StoriesStrip({super.key});

  @override
  State<StoriesStrip> createState() => StoriesStripState();
}

class StoriesStripState extends State<StoriesStrip> {
  List<Map<String, dynamic>>? groups;
  List<String> reactions = const [];

  Api get api => AppScope.read(context).session.api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => reload());
  }

  Future<void> reload() async {
    try {
      final data = await api.get('/api/v1/stories');
      if (!mounted) return;
      setState(() {
        groups = maps(data['groups']);
        reactions = (data['reactions'] as List? ?? const []).map((e) => '$e').toList();
      });
    } catch (_) {
      if (mounted) setState(() => groups = const []);
    }
  }

  Future<void> _open(int index) async {
    final list = groups;
    if (list == null) return;
    await Navigator.of(context, rootNavigator: true).push(PageRouteBuilder(
      opaque: true,
      transitionDuration: const Duration(milliseconds: 220),
      pageBuilder: (_, _, _) => StoryViewerPage(groups: list, start: index, reactions: reactions, api: api),
      transitionsBuilder: (_, animation, _, child) => FadeTransition(opacity: animation, child: child),
    ));
    await reload();
  }

  Future<void> _compose() async {
    final posted = await showStoryComposer(context, api);
    if (posted == true) await reload();
  }

  @override
  Widget build(BuildContext context) {
    final list = groups;
    if (list == null) return const SizedBox.shrink();
    final me = AppScope.of(context).session.me ?? const {};
    final ownIndex = list.indexWhere((g) => g['own'] == true);
    final others = [for (var i = 0; i < list.length; i++) if (list[i]['own'] != true) i];

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Glass(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: SizedBox(
          height: 86,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            children: [
              _Tile(
                label: 'Ваша історія',
                onTap: ownIndex >= 0 ? () => _open(ownIndex) : _compose,
                badge: GestureDetector(
                  onTap: _compose,
                  child: Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(shape: BoxShape.circle, gradient: buttonGradient, border: Border.all(color: abyss, width: 2)),
                    child: const Icon(LucideIcons.plus, size: 13, color: Colors.white),
                  ),
                ),
                child: ownIndex >= 0
                    ? _Ring(seen: list[ownIndex]['all_seen'] == true, child: Avatar(name: text(me['name']) ?? '', url: absolute(me['avatar_url']), size: 54))
                    : Padding(padding: const EdgeInsets.all(4.5), child: Avatar(name: text(me['name']) ?? '', url: absolute(me['avatar_url']), size: 54)),
              ),
              for (final i in others)
                _Tile(
                  label: text(mapOf(list[i]['user'])['first_name']) ?? '',
                  onTap: () => _open(i),
                  child: _Ring(
                    seen: list[i]['all_seen'] == true,
                    child: Avatar(name: text(mapOf(list[i]['user'])['name']) ?? '', url: absolute(mapOf(list[i]['user'])['avatar_url']), size: 54),
                  ),
                ),
              if (others.isEmpty)
                Center(child: Padding(padding: const EdgeInsets.only(left: 8), child: Text('Історії друзів — тут на 24 години', style: body(12.5, color: muted)))),
            ],
          ),
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.label, required this.onTap, required this.child, this.badge});
  final String label;
  final VoidCallback onTap;
  final Widget child;
  final Widget? badge;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 72,
        child: Column(children: [
          Stack(clipBehavior: Clip.none, children: [
            child,
            if (badge != null) Positioned(right: -2, bottom: -2, child: badge!),
          ]),
          const SizedBox(height: 5),
          Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(11.5, color: soft)),
        ]),
      ),
    );
  }
}

/// Нова історія: фото чи відео з галереї, підпис і «Друзям» / «Усім».
Future<bool?> showStoryComposer(BuildContext context, Api api) async {
  final kind = await showGcSheet<String>(
    context,
    title: 'Нова історія',
    builder: (sheet) => Column(mainAxisSize: MainAxisSize.min, children: [
      ListTile(leading: const Icon(LucideIcons.image, color: primary), title: Text('Фото', style: body(15)), onTap: () => Navigator.pop(sheet, 'image')),
      ListTile(leading: const Icon(LucideIcons.video, color: primary), title: Text('Відео до 60 с', style: body(15)), onTap: () => Navigator.pop(sheet, 'video')),
      ListTile(leading: const Icon(LucideIcons.camera, color: primary), title: Text('Зняти фото', style: body(15)), onTap: () => Navigator.pop(sheet, 'camera')),
    ]),
  );
  if (kind == null) return false;
  final picker = ImagePicker();
  final file = switch (kind) {
    'video' => await picker.pickVideo(source: ImageSource.gallery, maxDuration: const Duration(seconds: 60)),
    'camera' => await picker.pickImage(source: ImageSource.camera, maxWidth: 1920, imageQuality: 90),
    _ => await picker.pickImage(source: ImageSource.gallery, maxWidth: 1920, imageQuality: 90),
  };
  if (file == null || !context.mounted) return false;
  final video = kind == 'video';

  int? duration;
  if (video) {
    final probe = VideoPlayerController.networkUrl(Uri.file(file.path));
    try {
      await probe.initialize();
      duration = probe.value.duration.inSeconds;
    } catch (_) {
    } finally {
      await probe.dispose();
    }
    if (duration != null && duration > 60) {
      if (context.mounted) toast(context, 'Відео довше за 60 секунд — оберіть коротше.');
      return false;
    }
  }
  if (!context.mounted) return false;

  final caption = TextEditingController();
  var privacy = 'friends';
  final publish = await showGcSheet<bool>(
    context,
    title: video ? 'Відео в історію' : 'Фото в історію',
    builder: (sheet) => StatefulBuilder(
      builder: (sheet, setSheet) => Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        TextField(controller: caption, maxLength: 200, decoration: const InputDecoration(hintText: 'Підпис (необов’язково)')),
        const SizedBox(height: 8),
        Segmented(
          options: const [SegmentOption('friends', 'Друзям', icon: LucideIcons.users), SegmentOption('everyone', 'Усім', icon: LucideIcons.globe)],
          selected: privacy,
          onSelect: (v) => setSheet(() => privacy = v),
        ),
        const SizedBox(height: 14),
        PrimaryButton(label: 'Опублікувати', icon: LucideIcons.send, onPressed: () => Navigator.pop(sheet, true)),
      ]),
    ),
  );
  if (publish != true || !context.mounted) return false;
  try {
    await api.upload(
      '/api/v1/stories',
      {
        if (caption.text.trim().isNotEmpty) 'caption': caption.text.trim(),
        'privacy': privacy,
        if (duration != null && duration > 0) 'duration': '$duration',
      },
      [await http.MultipartFile.fromPath('media', file.path, filename: file.name)],
    );
    if (context.mounted) toast(context, 'Історію опубліковано на 24 години');
    return true;
  } catch (e) {
    if (context.mounted) toast(context, e);
    return false;
  }
}

/// Повноекранний перегляд історій: смужки прогресу, дотик ліворуч/праворуч, утримання — пауза.
class StoryViewerPage extends StatefulWidget {
  const StoryViewerPage({required this.groups, required this.start, required this.reactions, required this.api, super.key});
  final List<Map<String, dynamic>> groups;
  final int start;
  final List<String> reactions;
  final Api api;

  @override
  State<StoryViewerPage> createState() => _StoryViewerPageState();
}

class _StoryViewerPageState extends State<StoryViewerPage> with SingleTickerProviderStateMixin {
  late int g = widget.start;
  late int i = _firstUnseen(widget.start);
  late final AnimationController timer = AnimationController(vsync: this)..addStatusListener((s) {
      if (s == AnimationStatus.completed) _next();
    });
  VideoPlayerController? video;
  final reply = TextEditingController();
  final focus = FocusNode();

  Map<String, dynamic> get group => widget.groups[g];
  List<Map<String, dynamic>> get stories => maps(group['stories']);
  Map<String, dynamic> get story => stories[i];
  bool get own => group['own'] == true;

  int _firstUnseen(int index) {
    final list = maps(widget.groups[index]['stories']);
    final n = list.indexWhere((s) => s['seen'] != true);
    return n < 0 ? 0 : n;
  }

  @override
  void initState() {
    super.initState();
    focus.addListener(() => focus.hasFocus ? _pause() : _resume());
    _show();
  }

  @override
  void dispose() {
    timer.dispose();
    video?.dispose();
    reply.dispose();
    focus.dispose();
    super.dispose();
  }

  Future<void> _show() async {
    timer.stop();
    timer.value = 0;
    await video?.dispose();
    video = null;
    final current = story;
    if (!own && current['seen'] != true) {
      current['seen'] = true;
      unawaited(widget.api.post('/api/v1/stories/${current['id']}/view').then((_) => null, onError: (_) => null));
    }
    if (current['media_type'] == 'video') {
      final controller = VideoPlayerController.networkUrl(Uri.parse(absolute(current['url']) ?? ''));
      video = controller;
      setState(() {});
      try {
        await controller.initialize();
        if (!mounted || video != controller) return;
        timer.duration = controller.value.duration;
        await controller.play();
        timer.forward(from: 0);
      } catch (_) {
        timer.duration = const Duration(seconds: 6);
        timer.forward(from: 0);
      }
    } else {
      timer.duration = Duration(seconds: intOf(current['duration'], 6).clamp(1, 60));
      timer.forward(from: 0);
    }
    if (mounted) setState(() {});
  }

  void _next() {
    if (i < stories.length - 1) {
      i++;
    } else if (g < widget.groups.length - 1) {
      g++;
      i = 0;
    } else {
      Navigator.of(context).maybePop();
      return;
    }
    _show();
  }

  void _prev() {
    if (i > 0) {
      i--;
    } else if (g > 0) {
      g--;
      i = 0;
    }
    _show();
  }

  void _pause() {
    timer.stop();
    video?.pause();
  }

  void _resume() {
    if (focus.hasFocus) return;
    timer.forward();
    video?.play();
  }

  Future<void> _react(String reaction) async {
    try {
      await widget.api.post('/api/v1/stories/${story['id']}/react', {'reaction': reaction});
      if (mounted) toast(context, '$reaction надіслано');
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _reply() async {
    final body = reply.text.trim();
    if (body.isEmpty) return;
    try {
      await widget.api.post('/api/v1/stories/${story['id']}/reply', {'body': body});
      reply.clear();
      focus.unfocus();
      if (mounted) toast(context, 'Відповідь надіслано в особисті');
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _delete() async {
    _pause();
    if (!await confirm(context, 'Видалити історію?', danger: true, action: 'Видалити')) {
      _resume();
      return;
    }
    try {
      await widget.api.delete('/api/v1/stories/${story['id']}');
      if (mounted) Navigator.of(context).maybePop();
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _viewers() async {
    _pause();
    try {
      final data = await widget.api.get('/api/v1/stories/${story['id']}/viewers');
      if (!mounted) return;
      final list = maps(data['viewers']);
      await showGcSheet<void>(
        context,
        title: 'Переглянули (${list.length})',
        builder: (sheet) => Column(mainAxisSize: MainAxisSize.min, children: [
          if (list.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text('Ще ніхто не переглянув', style: body(13.5, color: muted))),
          for (final v in list)
            ListTile(
              leading: Avatar(name: text(v['name']) ?? '', url: absolute(v['avatar_url']), size: 38),
              title: Text(text(v['name']) ?? '', style: body(14.5)),
              trailing: text(v['reaction']) != null ? Text(v['reaction'], style: const TextStyle(fontSize: 20)) : null,
            ),
        ]),
      );
    } catch (e) {
      if (mounted) toast(context, e);
    }
    _resume();
  }

  @override
  Widget build(BuildContext context) {
    final user = mapOf(group['user']);
    final current = story;
    final controller = video;
    final top = MediaQuery.paddingOf(context).top;

    return Scaffold(
      backgroundColor: Colors.black,
      resizeToAvoidBottomInset: true,
      body: Column(children: [
        Expanded(
          child: GestureDetector(
            onLongPressStart: (_) => _pause(),
            onLongPressEnd: (_) => _resume(),
            onTapUp: (d) => d.localPosition.dx < MediaQuery.sizeOf(context).width / 3 ? _prev() : _next(),
            onVerticalDragEnd: (d) {
              if ((d.primaryVelocity ?? 0) > 400) Navigator.of(context).maybePop();
            },
            child: Stack(fit: StackFit.expand, children: [
              Center(
                child: current['media_type'] == 'video'
                    ? (controller != null && controller.value.isInitialized
                        ? AspectRatio(aspectRatio: controller.value.aspectRatio, child: VideoPlayer(controller))
                        : const CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                    : Image.network(absolute(current['url']) ?? '', fit: BoxFit.contain, loadingBuilder: (_, child, progress) => progress == null ? child : const CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white)),
              ),
              Positioned(
                top: top + 8,
                left: 8,
                right: 8,
                child: AnimatedBuilder(
                  animation: timer,
                  builder: (context, _) => Row(children: [
                    for (var n = 0; n < stories.length; n++)
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 2),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(2),
                            child: LinearProgressIndicator(
                              minHeight: 3,
                              value: n < i ? 1 : (n == i ? timer.value : 0),
                              color: Colors.white,
                              backgroundColor: Colors.white24,
                            ),
                          ),
                        ),
                      ),
                  ]),
                ),
              ),
              Positioned(
                top: top + 20,
                left: 12,
                right: 4,
                child: Row(children: [
                  Avatar(name: text(user['name']) ?? '', url: absolute(user['avatar_url']), size: 36),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(text(user['name']) ?? '', style: body(14, color: Colors.white, weight: FontWeight.w700)),
                      Text(ago(current['created_at']), style: body(12, color: Colors.white70)),
                    ]),
                  ),
                  if (own) IconButton(onPressed: _delete, icon: const Icon(LucideIcons.trash2, color: Colors.white)),
                  IconButton(onPressed: () => Navigator.of(context).maybePop(), icon: const Icon(LucideIcons.x, color: Colors.white, size: 26)),
                ]),
              ),
              if (text(current['caption']) != null)
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 16,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(color: Colors.black45, borderRadius: BorderRadius.circular(12)),
                    child: Text(current['caption'], textAlign: TextAlign.center, style: body(14, color: Colors.white)),
                  ),
                ),
            ]),
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
            child: own
                ? Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: _viewers,
                      icon: const Icon(LucideIcons.eye, color: Colors.white70, size: 18),
                      label: Text('${intOf(current['views_count'])} переглядів', style: body(13.5, color: Colors.white70)),
                    ),
                  )
                : Column(mainAxisSize: MainAxisSize.min, children: [
                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      for (final r in widget.reactions)
                        InkResponse(onTap: () => _react(r), child: Padding(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4), child: Text(r, style: const TextStyle(fontSize: 26)))),
                    ]),
                    const SizedBox(height: 6),
                    Row(children: [
                      Expanded(
                        child: TextField(
                          controller: reply,
                          focusNode: focus,
                          maxLength: 1000,
                          style: body(14, color: Colors.white),
                          textInputAction: TextInputAction.send,
                          onSubmitted: (_) => _reply(),
                          decoration: InputDecoration(
                            hintText: 'Відповісти ${text(user['first_name']) ?? ''}',
                            counterText: '',
                            isDense: true,
                            hintStyle: body(14, color: Colors.white54),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: const BorderSide(color: Colors.white38)),
                            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: const BorderSide(color: Colors.white38)),
                          ),
                        ),
                      ),
                      IconButton(onPressed: _reply, icon: const Icon(LucideIcons.send, color: Colors.white)),
                    ]),
                  ]),
          ),
        ),
      ]),
    );
  }
}
