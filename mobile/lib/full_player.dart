import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'audio.dart';
import 'i18n.dart';
import 'listen_together.dart';
import 'lyrics.dart';
import 'player_view.dart';
import 'state.dart';
import 'theme.dart';
import 'track_edit.dart';
import 'widgets.dart';

// Повноекранний плеєр («Зараз грає») — як на сайті (components/music/full-player.tsx): тло в кольорі
// обкладинки, вініл визирає з-за обкладинки й крутиться під час гри, прогрес-хвиля, свайп по
// обкладинці — інший трек, скляна панель керування, караоке-текст (LRC).
// Телефон — одна колонка (обкладинка ↔ текст), планшет — дві. Плеєр завжди темний, як на сайті.

const _swipe = 80.0;
const _ease = Cubic(0.22, 1, 0.36, 1);

Future<void> showFullPlayer(BuildContext context, TrackPlayer player) {
  final scope = context.getInheritedWidgetOfExactType<AppScope>();
  final reduce = MediaQuery.disableAnimationsOf(context);
  return Navigator.of(context, rootNavigator: true).push(PageRouteBuilder<void>(
    opaque: false,
    barrierColor: Colors.transparent,
    transitionDuration: reduce ? Duration.zero : const Duration(milliseconds: 420),
    reverseTransitionDuration: reduce ? Duration.zero : const Duration(milliseconds: 280),
    pageBuilder: (_, _, _) {
      final page = FullPlayer(player: player);
      return scope == null ? page : AppScope(session: scope.session, player: scope.player, child: page);
    },
    // Поява знизу, як RISE на сайті: трохи піднімається й проявляється.
    transitionsBuilder: (_, animation, _, child) {
      final t = CurvedAnimation(parent: animation, curve: _ease, reverseCurve: Curves.easeIn);
      return AnimatedBuilder(
        animation: t,
        builder: (_, child) => Opacity(
          opacity: t.value.clamp(0.0, 1.0),
          child: Transform.translate(offset: Offset(0, (1 - t.value) * 40), child: child),
        ),
        child: child,
      );
    },
  ));
}

// ───────────────────────── Колір обкладинки ─────────────────────────

final _tints = <String, Color?>{};

/// Переважний колір обкладинки (як useCoverColor на сайті): середнє зі зваженням на насиченість.
Future<Color?> coverColor(String url) async {
  if (_tints.containsKey(url)) return _tints[url];
  final completer = Completer<ui.Image?>();
  final stream = ResizeImage(CachedNetworkImageProvider(url), width: 16, height: 16).resolve(ImageConfiguration.empty);
  late final ImageStreamListener listener;
  listener = ImageStreamListener((info, _) {
    if (!completer.isCompleted) completer.complete(info.image);
    stream.removeListener(listener);
  }, onError: (_, _) {
    if (!completer.isCompleted) completer.complete(null);
    stream.removeListener(listener);
  });
  stream.addListener(listener);
  final image = await completer.future.timeout(const Duration(seconds: 8), onTimeout: () => null);
  if (image == null) return _tints[url] = null;
  final data = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
  if (data == null) return _tints[url] = null;
  double r = 0, g = 0, b = 0, weight = 0;
  for (var i = 0; i + 3 < data.lengthInBytes; i += 4) {
    final cr = data.getUint8(i), cg = data.getUint8(i + 1), cb = data.getUint8(i + 2);
    final hi = math.max(cr, math.max(cg, cb)), lo = math.min(cr, math.min(cg, cb));
    // Насичені й не надто темні пікселі важать більше — тло не «сіріє».
    final w = 0.05 + (hi - lo) / 255 * (hi / 255);
    r += cr * w;
    g += cg * w;
    b += cb * w;
    weight += w;
  }
  final color = Color.fromARGB(255, (r / weight).round(), (g / weight).round(), (b / weight).round());
  return _tints[url] = color;
}

// ───────────────────────── Екран ─────────────────────────

class FullPlayer extends StatefulWidget {
  const FullPlayer({required this.player, super.key});
  final TrackPlayer player;

  @override
  State<FullPlayer> createState() => _FullPlayerState();
}

class _FullPlayerState extends State<FullPlayer> {
  TrackPlayer get player => widget.player;
  String? _key;
  Color? tint;
  Lyrics? lyrics;
  bool showLyrics = false;
  int direction = 1;

  @override
  void initState() {
    super.initState();
    player.addListener(_onPlayer);
    _onPlayer();
  }

  @override
  void dispose() {
    player.removeListener(_onPlayer);
    super.dispose();
  }

  String _trackKey(QueueTrack t) => '${t.id ?? t.url}';

  void _onPlayer() {
    final track = player.current;
    if (track == null) {
      if (mounted) Navigator.of(context).maybePop();
      return;
    }
    final key = _trackKey(track);
    if (key == _key) return;
    _key = key;
    lyrics = null;
    final cover = track.cover;
    if (cover != null) {
      coverColor(cover).then((color) {
        if (mounted && _key == key) setState(() => tint = color);
      });
    } else {
      tint = null;
    }
    final id = track.id;
    final session = player.session;
    if (track.hasLyrics && id != null && session != null) {
      session.api.get(Api.site('/music/tracks/$id/lyrics')).then((data) {
        final source = text(data['lyrics'])?.trim();
        if (mounted && _key == key) setState(() => lyrics = source == null || source.isEmpty ? null : parseLyrics(source));
      }).catchError((_) {});
    }
  }

  void _go(int d) {
    setState(() => direction = d);
    d == 1 ? player.next() : player.prev();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: player,
      builder: (context, _) {
        final track = player.current;
        if (track == null) return const SizedBox.shrink();
        final tintColor = tint ?? primary;
        final media = MediaQuery.of(context);
        final wide = media.size.width >= tabletWidth;
        final lyricsOn = showLyrics && lyrics != null;
        final position = player.position.inMilliseconds / 1000;

        final header = SizedBox(
          height: 56,
          child: Row(children: [
            _Control(icon: LucideIcons.chevronDown, label: tr('Згорнути плеєр'), size: 24, onTap: () => Navigator.of(context).maybePop()),
            Expanded(child: Text(tr('Зараз грає'), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, color: Colors.white60, weight: FontWeight.w500))),
            if (!wide && player.queue.length > 1) _Control(icon: LucideIcons.listMusic, label: tr('Черга відтворення'), onTap: () => _showQueue(context)),
            if (lyrics != null && !wide)
              _Control(icon: LucideIcons.micVocal, label: tr('Текст пісні'), active: lyricsOn, onTap: () => setState(() => showLyrics = !showLyrics))
            else if (wide || player.queue.length <= 1)
              const SizedBox(width: 44),
          ]),
        );

        final stage = _Stage(
          player: player,
          track: track,
          tint: tintColor,
          direction: direction,
          wide: wide,
          onSwipe: _go,
        );

        final info = _Info(player: player, track: track);
        final progress = _Progress(player: player, seed: _trackKey(track));
        final controls = _Controls(player: player, onSkip: _go);

        final Widget content;
        if (wide) {
          content = Row(children: [
            Expanded(child: Center(child: stage)),
            const SizedBox(width: 56),
            SizedBox(
              width: 440,
              child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                info,
                const SizedBox(height: 20),
                progress,
                const SizedBox(height: 20),
                controls,
                const SizedBox(height: 20),
                SizedBox(
                  height: math.min(media.size.height * 0.32, 300),
                  child: lyrics != null ? _LyricsView(lyrics: lyrics!, position: position, onSeek: (s) => player.seek(Duration(milliseconds: (s * 1000).round()))) : _UpNext(player: player),
                ),
              ]),
            ),
          ]);
        } else {
          content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Expanded(
              child: Center(
                child: lyricsOn ? _LyricsView(lyrics: lyrics!, position: position, onSeek: (s) => player.seek(Duration(milliseconds: (s * 1000).round()))) : stage,
              ),
            ),
            const SizedBox(height: 24),
            info,
            const SizedBox(height: 20),
            progress,
            const SizedBox(height: 20),
            controls,
            if (GcAudioHandler.failure != null) ...[
              const SizedBox(height: 10),
              Text(tr('Фонове відтворення недоступне: {failure}', {'failure': GcAudioHandler.failure}), textAlign: TextAlign.center, style: body(11, color: Colors.white38)),
            ],
          ]);
        }

        return Material(
          color: const Color(0xFF05070F),
          child: GestureDetector(
            // Свайп униз згортає плеєр.
            onVerticalDragEnd: (d) {
              if ((d.primaryVelocity ?? 0) > 700) Navigator.of(context).maybePop();
            },
            child: Stack(fit: StackFit.expand, children: [
              _Backdrop(cover: track.cover, tint: tintColor),
              SafeArea(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1152),
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(wide ? 40 : 20, 8, wide ? 40 : 20, 20),
                      child: Column(children: [header, Expanded(child: content)]),
                    ),
                  ),
                ),
              ),
            ]),
          ),
        );
      },
    );
  }

  void _showQueue(BuildContext context) {
    showGcSheet<void>(
      context,
      title: tr('Черга відтворення'),
      builder: (sheet) => ListenableBuilder(listenable: player, builder: (_, _) => PlayerQueue(player: player)),
    );
  }
}

/// Тло: розмита обкладинка + колір обкладинки + затемнення під текст.
class _Backdrop extends StatelessWidget {
  const _Backdrop({required this.cover, required this.tint});
  final String? cover;
  final Color tint;

  @override
  Widget build(BuildContext context) {
    final duration = MediaQuery.disableAnimationsOf(context) ? Duration.zero : const Duration(milliseconds: 700);
    return IgnorePointer(
      child: Stack(fit: StackFit.expand, children: [
        if (cover != null)
          AnimatedSwitcher(
            duration: duration,
            child: Opacity(
              key: ValueKey(cover),
              opacity: 0.45,
              child: Transform.scale(
                scale: 1.5,
                child: ImageFiltered(
                  imageFilter: ui.ImageFilter.blur(sigmaX: 45, sigmaY: 45, tileMode: TileMode.decal),
                  child: NetImage(cover, fit: BoxFit.cover),
                ),
              ),
            ),
          ),
        TweenAnimationBuilder<Color?>(
          tween: ColorTween(end: tint),
          duration: duration,
          builder: (_, color, _) => DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: const Alignment(-0.4, -0.6),
                radius: 1.1,
                colors: [(color ?? tint).withValues(alpha: 0.55), (color ?? tint).withValues(alpha: 0)],
                stops: const [0, 0.65],
              ),
            ),
          ),
        ),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0x26000000), Color(0x59000000), Color(0xBF000000)],
              stops: [0, 0.45, 1],
            ),
          ),
        ),
      ]),
    );
  }
}

/// Обкладинка + вініл, що визирає праворуч; зсув ліворуч центрує всю композицію.
class _Stage extends StatefulWidget {
  const _Stage({required this.player, required this.track, required this.tint, required this.direction, required this.wide, required this.onSwipe});
  final TrackPlayer player;
  final QueueTrack track;
  final Color tint;
  final int direction;
  final bool wide;
  final ValueChanged<int> onSwipe;

  @override
  State<_Stage> createState() => _StageState();
}

class _StageState extends State<_Stage> with TickerProviderStateMixin {
  late final spin = AnimationController(vsync: this, duration: const Duration(seconds: 8));
  // Вініл виїжджає з-за обкладинки трохи згодом після відкриття (як RISE з затримкою на сайті).
  late final slide = AnimationController(vsync: this, duration: const Duration(milliseconds: 650));
  double drag = 0;
  bool dragging = false;

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 150), () {
      if (mounted) slide.forward();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) slide.value = 1;
  }

  @override
  void dispose() {
    spin.dispose();
    slide.dispose();
    super.dispose();
  }

  void _syncSpin() {
    final run = widget.player.playing && !MediaQuery.disableAnimationsOf(context);
    if (run && !spin.isAnimating) spin.repeat();
    if (!run && spin.isAnimating) spin.stop();
  }

  @override
  Widget build(BuildContext context) {
    _syncSpin();
    final reduce = MediaQuery.disableAnimationsOf(context);
    return LayoutBuilder(builder: (context, box) {
      final screen = MediaQuery.sizeOf(context);
      final size = widget.wide
          ? math.min(math.min(screen.width * 0.30, screen.height * 0.62), 440.0)
          : math.min(math.min(screen.width * 0.64, math.min(screen.height * 0.40, box.maxHeight)), 360.0);
      final cover = TrackCover(url: widget.track.cover, seed: widget.track.id ?? widget.track.title, size: size, radius: 22);
      return Transform.translate(
        offset: Offset(-size * 0.16, 0),
        child: SizedBox.square(
          dimension: size,
          child: Stack(clipBehavior: Clip.none, children: [
            AnimatedBuilder(
              animation: Listenable.merge([spin, slide]),
              builder: (_, _) => Transform.translate(
                offset: Offset(size * 0.34 * Curves.easeOutBack.transform(slide.value).clamp(0.0, 1.1), 0),
                child: Padding(
                  padding: EdgeInsets.all(size * 0.03),
                  child: Transform.rotate(angle: spin.value * 2 * math.pi, child: _Vinyl(cover: widget.track.cover, tint: widget.tint)),
                ),
              ),
            ),
            GestureDetector(
              onHorizontalDragUpdate: (d) => setState(() {
                dragging = true;
                drag += d.delta.dx * 0.65;
              }),
              onHorizontalDragEnd: (d) {
                final v = d.primaryVelocity ?? 0;
                if (drag < -_swipe || v < -600) {
                  widget.onSwipe(1);
                } else if (drag > _swipe || v > 600) {
                  widget.onSwipe(-1);
                }
                setState(() {
                  drag = 0;
                  dragging = false;
                });
              },
              child: AnimatedContainer(
                duration: dragging || reduce ? Duration.zero : const Duration(milliseconds: 300),
                curve: _ease,
                transform: Matrix4.translationValues(drag, 0, 0),
                child: AnimatedSwitcher(
                  duration: reduce ? Duration.zero : const Duration(milliseconds: 350),
                  switchInCurve: _ease,
                  switchOutCurve: _ease,
                  transitionBuilder: (child, animation) {
                    final incoming = child.key == ValueKey(widget.track.id ?? widget.track.url);
                    final dx = (incoming ? widget.direction : -widget.direction) * 70.0;
                    return AnimatedBuilder(
                      animation: animation,
                      child: child,
                      builder: (_, child) {
                        final t = 1 - animation.value;
                        return Opacity(
                          opacity: animation.value,
                          child: Transform.translate(
                            offset: Offset(dx * t, 0),
                            child: ImageFiltered(imageFilter: ui.ImageFilter.blur(sigmaX: 8 * t + 0.001, sigmaY: 8 * t + 0.001), child: child),
                          ),
                        );
                      },
                    );
                  },
                  child: DecoratedBox(
                    key: ValueKey(widget.track.id ?? widget.track.url),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: const [BoxShadow(color: Color(0xE6000000), blurRadius: 70, offset: Offset(0, 30), spreadRadius: -25)],
                    ),
                    child: cover,
                  ),
                ),
              ),
            ),
          ]),
        ),
      );
    });
  }
}

/// Вініл: борозни, відблиск і «яблуко» з обкладинкою.
class _Vinyl extends StatelessWidget {
  const _Vinyl({required this.cover, required this.tint});
  final String? cover;
  final Color tint;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, box) {
      final d = box.maxWidth;
      return Container(
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          boxShadow: [BoxShadow(color: Color(0xE6000000), blurRadius: 50, offset: Offset(0, 20), spreadRadius: -20)],
        ),
        child: Stack(alignment: Alignment.center, children: [
          CustomPaint(size: Size.square(d), painter: _GroovesPainter()),
          Container(
            width: d * 0.34,
            height: d * 0.34,
            decoration: BoxDecoration(shape: BoxShape.circle, color: tint, border: Border.all(color: Colors.black.withValues(alpha: 0.4), width: 4)),
            clipBehavior: Clip.antiAlias,
            child: cover == null ? null : NetImage(cover, fit: BoxFit.cover),
          ),
          Container(width: d * 0.34 * 0.09, height: d * 0.34 * 0.09, decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFF0B0B10))),
        ]),
      );
    });
  }
}

class _GroovesPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.width / 2;
    canvas.drawCircle(center, radius, Paint()..color = const Color(0xFF0B0B10));
    final groove = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..color = const Color(0xFF15151C);
    for (var r = radius * 0.36; r < radius; r += 3) {
      canvas.drawCircle(center, r, groove);
    }
    // Відблиск — два м'які сектори, як conic-gradient на сайті.
    final rect = Rect.fromCircle(center: center, radius: radius);
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..shader = SweepGradient(
          startAngle: 0,
          endAngle: math.pi * 2,
          transform: const GradientRotation(math.pi / 6 - math.pi / 2),
          colors: const [Color(0x00FFFFFF), Color(0x17FFFFFF), Color(0x00FFFFFF), Color(0x00FFFFFF), Color(0x12FFFFFF), Color(0x00FFFFFF), Color(0x00FFFFFF)],
          stops: const [0, 40 / 360, 90 / 360, 180 / 360, 220 / 360, 270 / 360, 1],
        ).createShader(rect),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Назва, виконавець і альбом; міняються з легким зсувом. Поруч — «Слухати разом» і редагування.
class _Info extends StatelessWidget {
  const _Info({required this.player, required this.track});
  final TrackPlayer player;
  final QueueTrack track;

  @override
  Widget build(BuildContext context) {
    final session = player.session;
    final own = track.id != null && session != null && (track.userId == session.myId || session.isAdmin);
    final reduce = MediaQuery.disableAnimationsOf(context);
    return Row(children: [
      Expanded(
        child: AnimatedSwitcher(
          duration: reduce ? Duration.zero : const Duration(milliseconds: 250),
          switchInCurve: _ease,
          layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerLeft, children: [...previous, ?current]),
          transitionBuilder: (child, animation) => FadeTransition(
            opacity: animation,
            child: SlideTransition(position: Tween(begin: const Offset(0, 0.12), end: Offset.zero).animate(animation), child: child),
          ),
          child: Column(
            key: ValueKey(track.id ?? track.url),
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(track.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: display(24, color: Colors.white).copyWith(letterSpacing: -0.3)),
              const SizedBox(height: 4),
              Text.rich(
                TextSpan(children: [
                  TextSpan(text: artistOf(track.artist)),
                  if (track.album != null) TextSpan(text: ' · ${track.album}', style: const TextStyle(color: Colors.white38)),
                ]),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: body(16, color: Colors.white60),
              ),
            ],
          ),
        ),
      ),
      if (track.id != null)
        _Control(
          icon: LucideIcons.headphones,
          label: tr('Слухати разом'),
          onTap: () {
            Navigator.of(context).maybePop();
            startListening(context, trackId: track.id);
          },
        ),
      if (own)
        _Control(
          icon: LucideIcons.pencil,
          label: tr('Редагувати метадані'),
          onTap: () async {
            final card = await editTrackSheet(context, track.toCard());
            if (card != null) player.updateMeta(card);
          },
        ),
    ]);
  }
}

/// Прогрес у вигляді хвилі; перемотка — дотиком або перетягуванням.
class _Progress extends StatelessWidget {
  const _Progress({required this.player, required this.seed});
  final TrackPlayer player;
  final String seed;

  @override
  Widget build(BuildContext context) {
    final total = player.duration.inMilliseconds;
    final progress = total == 0 ? 0.0 : (player.position.inMilliseconds / total).clamp(0.0, 1.0);
    void seekTo(double dx, double width) {
      if (total <= 0) return;
      player.seek(Duration(milliseconds: ((dx / width).clamp(0.0, 1.0) * total).round()));
    }

    return Column(children: [
      Semantics(
        slider: true,
        label: tr('Перемотати'),
        value: duration(player.position.inSeconds),
        child: LayoutBuilder(
          builder: (context, box) => GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: (d) => seekTo(d.localPosition.dx, box.maxWidth),
            onHorizontalDragUpdate: (d) => seekTo(d.localPosition.dx, box.maxWidth),
            child: SizedBox(height: 48, width: double.infinity, child: CustomPaint(painter: _WavePainter(waveformBars(seed, 72), progress))),
          ),
        ),
      ),
      const SizedBox(height: 6),
      Row(children: [
        Text(duration(player.position.inSeconds), style: body(12, color: Colors.white54).copyWith(fontFeatures: const [ui.FontFeature.tabularFigures()])),
        const Spacer(),
        Text(duration(player.duration.inSeconds), style: body(12, color: Colors.white54).copyWith(fontFeatures: const [ui.FontFeature.tabularFigures()])),
      ]),
    ]);
  }
}

class _WavePainter extends CustomPainter {
  _WavePainter(this.bars, this.progress);
  final List<double> bars;
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    const gap = 2.0;
    final w = (size.width - gap * (bars.length - 1)) / bars.length;
    final rest = Paint()..color = Colors.white.withValues(alpha: 0.2);
    final played = Paint()..color = Colors.white;
    final split = size.width * progress;
    for (var i = 0; i < bars.length; i++) {
      final h = size.height * bars[i];
      final x = i * (w + gap);
      final rect = RRect.fromRectAndRadius(Rect.fromLTWH(x, (size.height - h) / 2, w, h), Radius.circular(w / 2));
      canvas.drawRRect(rect, rest);
      if (x < split) {
        // Зіграна частина — той самий ряд, обрізаний по прогресу.
        canvas.save();
        canvas.clipRect(Rect.fromLTWH(0, 0, split, size.height));
        canvas.drawRRect(rect, played);
        canvas.restore();
      }
    }
  }

  @override
  bool shouldRepaint(_WavePainter old) => old.progress != progress || old.bars != bars;
}

class _Control extends StatelessWidget {
  const _Control({required this.icon, required this.label, required this.onTap, this.active = false, this.size = 20});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool active;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: label,
      child: Semantics(
        button: true,
        toggled: active,
        label: label,
        child: InkResponse(
          onTap: onTap,
          radius: 24,
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(shape: BoxShape.circle, color: active ? Colors.white.withValues(alpha: 0.15) : Colors.transparent),
            child: Icon(icon, size: size, color: active ? Colors.white : Colors.white70),
          ),
        ),
      ),
    );
  }
}

/// Скляна панель керування: перемішати, назад, грати, далі, повтор.
class _Controls extends StatelessWidget {
  const _Controls({required this.player, required this.onSkip});
  final TrackPlayer player;
  final ValueChanged<int> onSkip;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(26),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 24, sigmaY: 24),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          color: Colors.white.withValues(alpha: 0.08),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _Control(icon: LucideIcons.shuffle, label: tr('Перемішати'), size: 18, active: player.shuffle, onTap: player.toggleShuffle),
              _Control(icon: LucideIcons.skipBack, label: tr('Попередній'), size: 24, onTap: () => onSkip(-1)),
              _PlayButton(player: player),
              _Control(icon: LucideIcons.skipForward, label: tr('Наступний'), size: 24, onTap: () => onSkip(1)),
              _Control(icon: player.repeat ? LucideIcons.repeat1 : LucideIcons.repeat, label: player.repeat ? tr('Повторювати трек') : tr('Без повтору'), size: 18, active: player.repeat, onTap: player.toggleRepeat),
            ],
          ),
        ),
      ),
    );
  }
}

class _PlayButton extends StatefulWidget {
  const _PlayButton({required this.player});
  final TrackPlayer player;

  @override
  State<_PlayButton> createState() => _PlayButtonState();
}

class _PlayButtonState extends State<_PlayButton> {
  bool pressed = false;

  @override
  Widget build(BuildContext context) {
    final playing = widget.player.playing;
    return Semantics(
      button: true,
      label: playing ? tr('Пауза') : tr('Відтворити'),
      child: GestureDetector(
        onTapDown: (_) => setState(() => pressed = true),
        onTapCancel: () => setState(() => pressed = false),
        onTapUp: (_) => setState(() => pressed = false),
        onTap: widget.player.toggle,
        child: AnimatedScale(
          scale: pressed && !MediaQuery.disableAnimationsOf(context) ? 0.92 : 1,
          duration: const Duration(milliseconds: 160),
          curve: Curves.easeOutBack,
          child: Container(
            width: 64,
            height: 64,
            decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white),
            child: Padding(
              padding: EdgeInsets.only(left: playing ? 0 : 3),
              child: Icon(playing ? Icons.pause_rounded : Icons.play_arrow_rounded, size: 34, color: const Color(0xFF0B0D1D)),
            ),
          ),
        ),
      ),
    );
  }
}

/// Караоке: поточний рядок яскравий і по центру; дотик до рядка — перемотка до нього.
class _LyricsView extends StatefulWidget {
  const _LyricsView({required this.lyrics, required this.position, required this.onSeek});
  final Lyrics lyrics;
  final double position;
  final ValueChanged<double> onSeek;

  @override
  State<_LyricsView> createState() => _LyricsViewState();
}

class _LyricsViewState extends State<_LyricsView> {
  final keys = <int, GlobalKey>{};
  DateTime touched = DateTime(0);
  int shown = -2;

  GlobalKey _key(int i) => keys.putIfAbsent(i, GlobalKey.new);

  @override
  Widget build(BuildContext context) {
    final lyrics = widget.lyrics;
    final current = lyrics.timed ? activeLine(lyrics.lines, widget.position) : -1;
    final reduce = MediaQuery.disableAnimationsOf(context);
    // Тримаємо поточний рядок по центру, але не заважаємо, якщо людина щойно гортала сама.
    if (current != shown && current >= 0 && DateTime.now().difference(touched).inSeconds >= 3) {
      shown = current;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final ctx = keys[current]?.currentContext;
        if (ctx != null) Scrollable.ensureVisible(ctx, alignment: 0.5, duration: reduce ? Duration.zero : const Duration(milliseconds: 400), curve: _ease);
      });
    }
    return NotificationListener<UserScrollNotification>(
      onNotification: (_) {
        touched = DateTime.now();
        return false;
      },
      child: ShaderMask(
        blendMode: BlendMode.dstIn,
        shaderCallback: (rect) => const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0x00000000), Color(0xFF000000), Color(0xFF000000), Color(0x00000000)],
          stops: [0, 0.14, 0.86, 1],
        ).createShader(rect),
        child: LayoutBuilder(
          builder: (context, box) => SingleChildScrollView(
            padding: EdgeInsets.symmetric(vertical: box.maxHeight * 0.3),
            child: lyrics.timed
                ? Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    for (var i = 0; i < lyrics.lines.length; i++)
                      GestureDetector(
                        key: _key(i),
                        behavior: HitTestBehavior.opaque,
                        onTap: () => widget.onSeek(lyrics.lines[i].time ?? 0),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: AnimatedScale(
                            scale: i == current ? 1 : 0.97,
                            alignment: Alignment.centerLeft,
                            duration: reduce ? Duration.zero : const Duration(milliseconds: 300),
                            child: AnimatedDefaultTextStyle(
                              duration: reduce ? Duration.zero : const Duration(milliseconds: 300),
                              style: display(23, color: i == current ? Colors.white : i < current ? Colors.white30 : Colors.white.withValues(alpha: 0.45)).copyWith(height: 1.3, letterSpacing: -0.3),
                              child: Text(lyrics.lines[i].text.isEmpty ? '♪' : lyrics.lines[i].text),
                            ),
                          ),
                        ),
                      ),
                  ])
                : Text(lyrics.lines.map((l) => l.text).join('\n'), style: body(18, color: Colors.white.withValues(alpha: 0.8)).copyWith(height: 1.6)),
          ),
        ),
      ),
    );
  }
}

/// «Далі в черзі» (планшет, коли тексту немає).
class _UpNext extends StatelessWidget {
  const _UpNext({required this.player});
  final TrackPlayer player;

  @override
  Widget build(BuildContext context) {
    final start = player.index + 1;
    final upcoming = player.queue.skip(start).take(5).toList();
    if (upcoming.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(tr('Далі в черзі'), style: body(14, color: Colors.white54, weight: FontWeight.w500)),
      const SizedBox(height: 8),
      for (var i = 0; i < upcoming.length; i++)
        InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => player.playAt(start + i),
          child: Padding(
            padding: const EdgeInsets.all(6),
            child: Row(children: [
              TrackCover(url: upcoming[i].cover, seed: upcoming[i].id ?? upcoming[i].title, size: 40, radius: 8),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(upcoming[i].title, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, color: Colors.white, weight: FontWeight.w500)),
                  Text(artistOf(upcoming[i].artist), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: Colors.white54)),
                ]),
              ),
            ]),
          ),
        ),
    ]);
  }
}
