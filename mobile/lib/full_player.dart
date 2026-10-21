import 'dart:math' as math;
import 'dart:ui' as ui;

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

// Повноекранний плеєр («Зараз грає») у фірмовому стилі — як на сайті (components/music/full-player.tsx):
// фіолетове тло з пурпурним сяйвом унизу, кругла обкладинка з м'яким сяйвом, біла хвиля прогресу,
// кнопки з плаского матового скла. Свайп по обкладинці — інший трек, караоке-текст (LRC) і черга.
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

// ───────────────────────── Матове скло ─────────────────────────

/// Пласке матове скло: молочна заливка, сильне розмиття й тонкий світлий обідок — без тіней і відблисків.
class _Glass extends StatelessWidget {
  const _Glass({required this.size, required this.child});
  final double size;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ClipOval(
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 24, sigmaY: 24),
        child: Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white.withValues(alpha: 0.14),
            border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
          ),
          child: child,
        ),
      ),
    );
  }
}

/// Кругла скляна кнопка шапки (згорнути, улюблене).
class _GlassButton extends StatelessWidget {
  const _GlassButton({required this.icon, required this.label, required this.onTap, this.color = Colors.white, this.filled = false});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: label,
      child: Semantics(
        button: true,
        toggled: filled,
        label: label,
        child: GestureDetector(
          onTap: onTap,
          child: _Glass(size: 48, child: Icon(icon, size: 22, color: color, fill: filled ? 1 : 0)),
        ),
      ),
    );
  }
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
  Lyrics? lyrics;
  bool showLyrics = false;
  int direction = 1;
  // Серце: що людина натиснула в плеєрі, поверх того, що прийшло з сервера.
  final _saved = <int, bool>{};

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

  Future<void> _toggleLibrary(QueueTrack track) async {
    final id = track.id;
    final session = player.session;
    if (id == null || session == null) return;
    final saved = !(_saved[id] ?? track.inLibrary);
    setState(() => _saved[id] = saved);
    try {
      final path = Api.site('/music/tracks/$id/library');
      saved ? await session.api.post(path) : await session.api.delete(path);
      if (mounted) toast(context, saved ? tr('Додано до ваших аудіозаписів.') : tr('Прибрано з ваших аудіозаписів.'));
    } catch (e) {
      if (!mounted) return;
      setState(() => _saved[id] = !saved);
      toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: player,
      builder: (context, _) {
        final track = player.current;
        if (track == null) return const SizedBox.shrink();
        final media = MediaQuery.of(context);
        final wide = media.size.width >= tabletWidth;
        final lyricsOn = showLyrics && lyrics != null;
        final position = player.position.inMilliseconds / 1000;
        final saved = track.id != null && (_saved[track.id] ?? track.inLibrary);

        final header = SizedBox(
          height: 56,
          child: Row(children: [
            _GlassButton(icon: LucideIcons.chevronLeft, label: tr('Згорнути плеєр'), onTap: () => Navigator.of(context).maybePop()),
            Expanded(child: Text(tr('Зараз грає'), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(17, color: Colors.white, weight: FontWeight.w500))),
            if (track.id != null && player.session != null)
              _GlassButton(
                icon: LucideIcons.heart,
                label: saved ? tr('Прибрати з моїх аудіозаписів') : tr('Додати до моїх аудіозаписів'),
                color: saved ? const Color(0xFFF472D0) : Colors.white,
                filled: saved,
                onTap: () => _toggleLibrary(track),
              )
            else
              const SizedBox(width: 48),
          ]),
        );

        final stage = _Stage(track: track, direction: direction, wide: wide, onSwipe: _go);
        final info = _Info(track: track, wide: wide);
        final progress = _Progress(player: player, seed: _trackKey(track));
        final controls = _Controls(player: player, onSkip: _go, onQueue: wide || player.queue.length <= 1 ? null : () => _showQueue(context));
        final extras = _Extras(
          player: player,
          track: track,
          wide: wide,
          lyricsOn: lyricsOn,
          onLyrics: lyrics == null || wide ? null : () => setState(() => showLyrics = !showLyrics),
        );

        final Widget content;
        if (wide) {
          content = Row(children: [
            Expanded(child: Center(child: stage)),
            const SizedBox(width: 56),
            SizedBox(
              width: 460,
              child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                info,
                const SizedBox(height: 24),
                progress,
                const SizedBox(height: 24),
                controls,
                const SizedBox(height: 12),
                extras,
                const SizedBox(height: 16),
                SizedBox(
                  height: math.min(media.size.height * 0.28, 260),
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
            const SizedBox(height: 28),
            info,
            const SizedBox(height: 24),
            progress,
            const SizedBox(height: 24),
            controls,
            const SizedBox(height: 8),
            extras,
            if (GcAudioHandler.failure != null) ...[
              const SizedBox(height: 6),
              Text(tr('Фонове відтворення недоступне: {failure}', {'failure': GcAudioHandler.failure}), textAlign: TextAlign.center, style: body(11, color: Colors.white38)),
            ],
          ]);
        }

        return Material(
          color: const Color(0xFF170F55),
          child: GestureDetector(
            // Свайп униз згортає плеєр.
            onVerticalDragEnd: (d) {
              if ((d.primaryVelocity ?? 0) > 700) Navigator.of(context).maybePop();
            },
            child: Stack(fit: StackFit.expand, children: [
              const _Backdrop(),
              SafeArea(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1152),
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(wide ? 40 : 24, 12, wide ? 40 : 24, 16),
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

/// Тло як у фірмовому плеєрі: бузковий верх, глибокий індиго посередині, пурпурне сяйво внизу.
class _Backdrop extends StatelessWidget {
  const _Backdrop();

  static Widget _glow(Alignment center, double rx, double ry, List<Color> colors, List<double> stops) => Positioned.fill(
        child: LayoutBuilder(
          builder: (_, box) => DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: center,
                radius: 1,
                colors: colors,
                stops: stops,
                transform: _Ellipse(rx, ry, box.biggest, center),
              ),
            ),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Stack(fit: StackFit.expand, children: [
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFF2B1A86), Color(0xFF170F55), Color(0xFF1B1063), Color(0xFF5B21B6)],
              stops: [0, 0.45, 0.68, 1],
            ),
          ),
        ),
        _glow(const Alignment(0, -1.1), 1.2, 0.55, const [Color(0xF26E48E6), Color(0x006E48E6)], const [0, 0.62]),
        _glow(const Alignment(-0.84, -0.24), 0.7, 0.45, const [Color(0x8C7C3AED), Color(0x007C3AED)], const [0, 0.7]),
        _glow(const Alignment(0.9, -0.1), 0.7, 0.45, const [Color(0x994338CA), Color(0x004338CA)], const [0, 0.7]),
        _glow(const Alignment(0, 1.16), 1.3, 0.5, const [Color(0xF2C026D3), Color(0x8C9333EA), Color(0x009333EA)], const [0, 0.4, 0.72]),
      ]),
    );
  }
}

/// Еліптичне сяйво (як radial-gradient(rx ry at …) на сайті): коло розтягується до rx×ry розміру екрана.
class _Ellipse extends GradientTransform {
  const _Ellipse(this.rx, this.ry, this.size, this.center);
  final double rx;
  final double ry;
  final Size size;
  final Alignment center;

  @override
  Matrix4? transform(Rect bounds, {TextDirection? textDirection}) {
    final c = center.withinRect(bounds);
    final base = bounds.shortestSide / 2;
    final sx = rx * size.width / base;
    final sy = ry * size.height / base;
    return Matrix4.identity()
      ..translateByDouble(c.dx, c.dy, 0, 1)
      ..scaleByDouble(sx, sy, 1, 1)
      ..translateByDouble(-c.dx, -c.dy, 0, 1);
  }
}

/// Обкладинка-коло з м'яким сяйвом її ж кольору; свайп убік — інший трек.
class _Stage extends StatefulWidget {
  const _Stage({required this.track, required this.direction, required this.wide, required this.onSwipe});
  final QueueTrack track;
  final int direction;
  final bool wide;
  final ValueChanged<int> onSwipe;

  @override
  State<_Stage> createState() => _StageState();
}

class _StageState extends State<_Stage> {
  double drag = 0;
  bool dragging = false;

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.disableAnimationsOf(context);
    return LayoutBuilder(builder: (context, box) {
      final screen = MediaQuery.sizeOf(context);
      final size = widget.wide
          ? math.min(math.min(screen.width * 0.32, screen.height * 0.58), 460.0)
          : math.min(math.min(screen.width * 0.76, math.min(screen.height * 0.40, box.maxHeight)), 380.0);
      final key = ValueKey(widget.track.id ?? widget.track.url);
      return SizedBox.square(
        dimension: size,
        child: Stack(clipBehavior: Clip.none, children: [
          // Сяйво: та сама обкладинка, сильно розмита, за колом.
          Positioned.fill(
            child: Transform.translate(
              offset: Offset(0, size * 0.06),
              child: Padding(
                padding: EdgeInsets.all(size * 0.06),
                child: Opacity(
                  opacity: 0.6,
                  child: ImageFiltered(
                    imageFilter: ui.ImageFilter.blur(sigmaX: 36, sigmaY: 36, tileMode: TileMode.decal),
                    child: ClipOval(child: TrackCover(url: widget.track.cover, seed: widget.track.id ?? widget.track.title, size: size * 0.88, radius: size)),
                  ),
                ),
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
                  final dx = (child.key == key ? widget.direction : -widget.direction) * 70.0;
                  return AnimatedBuilder(
                    animation: animation,
                    child: child,
                    builder: (_, child) {
                      final t = 1 - animation.value;
                      return Opacity(
                        opacity: animation.value,
                        child: Transform.translate(offset: Offset(dx * t, 0), child: Transform.scale(scale: 1 - 0.06 * t, child: child)),
                      );
                    },
                  );
                },
                child: Container(
                  key: key,
                  foregroundDecoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.white.withValues(alpha: 0.2))),
                  child: ClipOval(child: TrackCover(url: widget.track.cover, seed: widget.track.id ?? widget.track.title, size: size, radius: size)),
                ),
              ),
            ),
          ),
        ]),
      );
    });
  }
}

/// Назва й виконавець по центру (на планшеті — ліворуч); міняються з легким зсувом.
class _Info extends StatelessWidget {
  const _Info({required this.track, required this.wide});
  final QueueTrack track;
  final bool wide;

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.disableAnimationsOf(context);
    final align = wide ? TextAlign.left : TextAlign.center;
    return AnimatedSwitcher(
      duration: reduce ? Duration.zero : const Duration(milliseconds: 250),
      switchInCurve: _ease,
      layoutBuilder: (current, previous) => Stack(alignment: wide ? Alignment.centerLeft : Alignment.center, children: [...previous, ?current]),
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: SlideTransition(position: Tween(begin: const Offset(0, 0.12), end: Offset.zero).animate(animation), child: child),
      ),
      child: Column(
        key: ValueKey(track.id ?? track.url),
        crossAxisAlignment: wide ? CrossAxisAlignment.start : CrossAxisAlignment.center,
        children: [
          Text(track.title, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: align, style: display(wide ? 32 : 26, color: Colors.white).copyWith(letterSpacing: -0.3, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Text.rich(
            TextSpan(children: [
              TextSpan(text: artistOf(track.artist)),
              if (track.album != null) TextSpan(text: ' · ${track.album}', style: const TextStyle(color: Colors.white38)),
            ]),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: align,
            style: body(15, color: Colors.white70),
          ),
        ],
      ),
    );
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

    final time = body(14, color: Colors.white70).copyWith(fontFeatures: const [ui.FontFeature.tabularFigures()]);
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
            child: SizedBox(height: 56, width: double.infinity, child: CustomPaint(painter: _WavePainter(waveformBars(seed, 64), progress))),
          ),
        ),
      ),
      const SizedBox(height: 8),
      Row(children: [
        Text(duration(player.position.inSeconds), style: time),
        const Spacer(),
        Text(duration(player.duration.inSeconds), style: time),
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
    const gap = 3.0;
    final w = (size.width - gap * (bars.length - 1)) / bars.length;
    final rest = Paint()..color = Colors.white.withValues(alpha: 0.35);
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

/// Іконка-кнопка без підкладки; увімкнена — біла з крапкою знизу.
class _Control extends StatelessWidget {
  const _Control({required this.icon, required this.label, required this.onTap, this.active = false, this.size = 22, this.filled = false});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool active;
  final double size;
  final bool filled;

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
          radius: 26,
          child: SizedBox(
            width: 48,
            height: 48,
            child: Stack(alignment: Alignment.center, children: [
              Icon(icon, size: size, color: active || filled ? Colors.white : Colors.white.withValues(alpha: 0.75), fill: filled ? 1 : 0),
              if (active) Positioned(bottom: 3, child: Container(width: 4, height: 4, decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white))),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Керування: перемішати, назад, велика скляна «грати», далі, черга.
class _Controls extends StatelessWidget {
  const _Controls({required this.player, required this.onSkip, required this.onQueue});
  final TrackPlayer player;
  final ValueChanged<int> onSkip;
  final VoidCallback? onQueue;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        _Control(icon: LucideIcons.shuffle, label: tr('Перемішати'), active: player.shuffle, onTap: player.toggleShuffle),
        _Control(icon: LucideIcons.skipBack, label: tr('Попередній'), size: 28, filled: true, onTap: () => onSkip(-1)),
        _PlayButton(player: player),
        _Control(icon: LucideIcons.skipForward, label: tr('Наступний'), size: 28, filled: true, onTap: () => onSkip(1)),
        if (onQueue != null) _Control(icon: LucideIcons.listMusic, label: tr('Черга відтворення'), onTap: onQueue!) else const SizedBox(width: 48),
      ],
    );
  }
}

/// Другорядне: повтор, текст пісні, «Слухати разом», редагування свого треку.
class _Extras extends StatelessWidget {
  const _Extras({required this.player, required this.track, required this.wide, required this.lyricsOn, required this.onLyrics});
  final TrackPlayer player;
  final QueueTrack track;
  final bool wide;
  final bool lyricsOn;
  final VoidCallback? onLyrics;

  @override
  Widget build(BuildContext context) {
    final session = player.session;
    final own = track.id != null && session != null && (track.userId == session.myId || session.isAdmin);
    return Row(mainAxisAlignment: wide ? MainAxisAlignment.start : MainAxisAlignment.center, children: [
      _Control(icon: player.repeat ? LucideIcons.repeat1 : LucideIcons.repeat, label: player.repeat ? tr('Повторювати трек') : tr('Без повтору'), size: 18, active: player.repeat, onTap: player.toggleRepeat),
      if (onLyrics != null) _Control(icon: LucideIcons.micVocal, label: tr('Текст пісні'), size: 18, active: lyricsOn, onTap: onLyrics!),
      if (track.id != null)
        _Control(
          icon: LucideIcons.headphones,
          label: tr('Слухати разом'),
          size: 18,
          onTap: () {
            Navigator.of(context).maybePop();
            startListening(context, trackId: track.id);
          },
        ),
      if (own)
        _Control(
          icon: LucideIcons.pencil,
          label: tr('Редагувати метадані'),
          size: 18,
          onTap: () async {
            final card = await editTrackSheet(context, track.toCard());
            if (card != null) player.updateMeta(card);
          },
        ),
    ]);
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
          child: _Glass(
            size: 84,
            child: Padding(
              padding: EdgeInsets.only(left: playing ? 0 : 4),
              child: AnimatedSwitcher(
                duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : const Duration(milliseconds: 180),
                transitionBuilder: (child, animation) => ScaleTransition(scale: Tween(begin: 0.6, end: 1.0).animate(animation), child: FadeTransition(opacity: animation, child: child)),
                child: CustomPaint(key: ValueKey(playing), size: const Size.square(30), painter: _PlayGlyph(playing)),
              ),
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

/// Знак «грати» / «пауза» на скляній кнопці — білий, залитий, з м'якими кутами (як fill-current на сайті).
class _PlayGlyph extends CustomPainter {
  _PlayGlyph(this.playing);
  final bool playing;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill
      ..isAntiAlias = true;
    if (playing) {
      final w = size.width * 0.26;
      final r = Radius.circular(w * 0.35);
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(size.width * 0.18, size.height * 0.12, w, size.height * 0.76), r), paint);
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(size.width * 0.56, size.height * 0.12, w, size.height * 0.76), r), paint);
      return;
    }
    final path = Path()
      ..moveTo(size.width * 0.16, size.height * 0.1)
      ..lineTo(size.width * 0.9, size.height * 0.5)
      ..lineTo(size.width * 0.16, size.height * 0.9)
      ..close();
    canvas.drawPath(path, paint);
    // Округлені кути — обведенням тим самим кольором.
    canvas.drawPath(path, Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * 0.12
      ..strokeJoin = StrokeJoin.round);
  }

  @override
  bool shouldRepaint(_PlayGlyph old) => old.playing != playing;
}
