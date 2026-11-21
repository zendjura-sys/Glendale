import 'dart:async';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:video_player/video_player.dart';

import 'api.dart';
import 'state.dart';
import 'widgets.dart';
import 'i18n.dart';

/// Як на сайті: кружок не довший за хвилину, файл — до 30 МБ (`MessageController::MAX_VIDEO_NOTE_KB`).
const videoNoteMaxSeconds = 60;
const videoNoteMaxBytes = 30720 * 1024;

/// Ім’я для поля `video_note`. Сервер приймає лише mp4, quicktime і webm.
/// Порожнє — формат не підходить.
String? videoNoteUploadName(String name, String? mime) {
  final type = mime?.toLowerCase().split(';').first.trim();
  final ext = name.contains('.') ? name.split('.').last.toLowerCase() : '';
  if (type == 'video/mp4' || ext == 'mp4' || ext == 'm4v' || ext == 'mp4v') return 'note.mp4';
  if (type == 'video/quicktime' || ext == 'mov' || ext == 'qt') return 'note.mov';
  if (type == 'video/webm' || ext == 'webm') return 'note.webm';
  return null;
}

/// Файл, який можна надіслати як відеокружок, або текст помилки для тосту.
class PreparedVideoNote {
  const PreparedVideoNote.ok(this.path, this.filename, this.seconds) : error = null;
  const PreparedVideoNote.fail(this.error) : path = null, filename = null, seconds = null;

  final String? error;
  final String? path;
  final String? filename;
  final int? seconds;
}

/// Перевіряє формат, розмір і тривалість. Запис іде системною камерою (`image_picker`), без окремого пакета.
Future<PreparedVideoNote> prepareVideoNote({required String path, required String name, String? mime}) async {
  final filename = videoNoteUploadName(name, mime);
  if (filename == null) return PreparedVideoNote.fail(tr('Непідтримуваний формат відео.'));
  try {
    final bytes = await File(path).length();
    if (bytes > videoNoteMaxBytes) return PreparedVideoNote.fail(tr('Відеоповідомлення завелике.'));
  } catch (_) {}
  final probe = VideoPlayerController.networkUrl(Uri.file(path));
  try {
    await probe.initialize();
    final raw = (probe.value.duration.inMilliseconds / 1000).round();
    if (raw > videoNoteMaxSeconds) return PreparedVideoNote.fail(tr('Відео довше за 60 секунд — оберіть коротше.'));
    return PreparedVideoNote.ok(path, filename, raw < 1 ? 1 : raw);
  } catch (_) {
    return PreparedVideoNote.fail(tr('Не вдалося прочитати відео.'));
  } finally {
    await probe.dispose();
  }
}

/// Кружок у чаті: беззвучне прев’ю по колу; дотик — зі звуком від початку, ще дотик — пауза.
/// З «економія трафіку» саме не грає, поки не торкнутися.
class VideoNotePlayer extends StatefulWidget {
  const VideoNotePlayer({required this.note, super.key});
  final Map<String, dynamic> note;

  @override
  State<VideoNotePlayer> createState() => _VideoNotePlayerState();
}

class _VideoNotePlayerState extends State<VideoNotePlayer> {
  VideoPlayerController? controller;
  bool closed = false;
  bool ready = false;
  bool failed = false;
  bool active = false;
  bool heardPlay = false;
  bool resetting = false;
  double progress = 0;

  bool get _saver {
    final prefs = AppScope.read(context).session.me?['prefs'];
    return prefs is Map && prefs['data_saver'] == true;
  }

  @override
  void initState() {
    super.initState();
    if (!_saver) unawaited(_open(sound: false));
  }

  @override
  void dispose() {
    closed = true;
    final current = controller;
    controller = null;
    current?.removeListener(_tick);
    unawaited(current?.dispose() ?? Future<void>.value());
    super.dispose();
  }

  String? _source() {
    final direct = absolute(widget.note['url']);
    if (direct != null) return direct;
    final id = int.tryParse('${widget.note['id']}');
    if (id == null || id <= 0) return null;
    return '${Api.root}/api/v1/messages/attachments/$id';
  }

  Future<void> _open({required bool sound}) async {
    if (controller != null || failed) return;
    final url = _source();
    if (url == null) {
      if (mounted) setState(() => failed = true);
      return;
    }
    final headers = <String, String>{};
    if (absolute(widget.note['url']) == null) {
      final token = AppScope.read(context).session.token;
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }
    final next = VideoPlayerController.networkUrl(Uri.parse(url), httpHeaders: headers, videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true));
    controller = next;
    next.addListener(_tick);
    try {
      await next.initialize();
      if (closed || !mounted || controller != next) {
        if (!closed && controller != next) {
          next.removeListener(_tick);
          await next.dispose();
        }
        return;
      }
      if (sound) {
        active = true;
        heardPlay = false;
        _duck();
        await next.setLooping(false);
        await next.setVolume(1);
      } else {
        await next.setVolume(0);
        await next.setLooping(true);
      }
      await next.play();
      if (mounted) setState(() => ready = true);
    } catch (_) {
      if (closed) return;
      next.removeListener(_tick);
      if (controller == next) controller = null;
      await next.dispose();
      if (mounted) setState(() => failed = true);
    }
  }

  void _duck() {
    final player = AppScope.read(context).player;
    if (player.playing) unawaited(player.engine.pause());
  }

  void _tick() {
    final current = controller;
    if (current == null || !mounted || !current.value.isInitialized) return;
    final value = current.value;
    if (active && value.isPlaying) heardPlay = true;
    final ended = active &&
        heardPlay &&
        !resetting &&
        !value.isPlaying &&
        value.duration > Duration.zero &&
        value.position + const Duration(milliseconds: 120) >= value.duration;
    if (ended) {
      unawaited(_toPreview());
      return;
    }
    if (!active) return;
    final next = value.duration.inMilliseconds == 0 ? 0.0 : (value.position.inMilliseconds / value.duration.inMilliseconds).clamp(0.0, 1.0);
    if ((next - progress).abs() < 0.008) return;
    setState(() => progress = next);
  }

  Future<void> _toPreview() async {
    final current = controller;
    if (current == null || resetting) return;
    resetting = true;
    active = false;
    heardPlay = false;
    progress = 0;
    try {
      await current.setVolume(0);
      await current.setLooping(true);
      await current.play();
    } catch (_) {}
    resetting = false;
    if (mounted) setState(() {});
  }

  Future<void> _toggle() async {
    if (failed) return;
    final current = controller;
    if (current == null || !current.value.isInitialized) {
      await _open(sound: true);
      return;
    }
    if (!active) {
      active = true;
      heardPlay = false;
      _duck();
      await current.setLooping(false);
      await current.setVolume(1);
      await current.seekTo(Duration.zero);
      await current.play();
      if (mounted) setState(() {});
      return;
    }
    if (current.value.isPlaying) {
      await current.pause();
    } else {
      await current.play();
    }
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final seconds = int.tryParse('${widget.note['duration']}');
    return LayoutBuilder(builder: (context, constraints) {
      final cap = constraints.maxWidth.isFinite ? constraints.maxWidth : 200.0;
      final side = math.min(200.0, math.max(0.0, cap));
      final loading = controller != null && !ready && !failed;
      return Semantics(
        button: true,
        container: true,
        label: tr('Відеоповідомлення'),
        child: GestureDetector(
          onTap: () => unawaited(_toggle()),
          child: SizedBox(
            width: side,
            height: side,
            child: DecoratedBox(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.black,
                border: Border.all(color: Colors.white.withValues(alpha: 0.35), width: 2),
              ),
              child: ClipOval(
                child: Stack(fit: StackFit.expand, children: [
                  if (ready && controller != null)
                    FittedBox(
                      fit: BoxFit.cover,
                      clipBehavior: Clip.hardEdge,
                      child: SizedBox(width: controller!.value.size.width, height: controller!.value.size.height, child: VideoPlayer(controller!)),
                    ),
                  if (loading) const Center(child: SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white70))),
                  if (!ready && !loading)
                    Center(child: Icon(failed ? LucideIcons.videoOff : LucideIcons.play, color: Colors.white, size: side * 0.22)),
                  if (active)
                    Positioned.fill(child: IgnorePointer(child: CustomPaint(painter: _NoteRingPainter(progress)))),
                  if (!active && seconds != null && seconds > 0)
                    Align(
                      alignment: Alignment.bottomCenter,
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: DecoratedBox(
                          decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.55), borderRadius: BorderRadius.circular(999)),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            child: Text(duration(seconds), style: const TextStyle(color: Colors.white, fontSize: 11, fontFeatures: [FontFeature.tabularFigures()])),
                          ),
                        ),
                      ),
                    ),
                ]),
              ),
            ),
          ),
        ),
      );
    });
  }
}

class _NoteRingPainter extends CustomPainter {
  const _NoteRingPainter(this.progress);
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = math.max(2.5, size.width * 0.028);
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.9)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    final rect = Rect.fromLTWH(stroke, stroke, size.width - stroke * 2, size.height - stroke * 2);
    canvas.drawArc(rect, -math.pi / 2, 2 * math.pi * progress.clamp(0.0, 1.0), false, paint);
  }

  @override
  bool shouldRepaint(_NoteRingPainter oldDelegate) => oldDelegate.progress != progress;
}
