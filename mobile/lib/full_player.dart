import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'audio.dart';
import 'i18n.dart';
import 'lyrics.dart';
import 'music_ui.dart';
import 'state.dart';
import 'theme.dart';
import 'track_edit.dart';
import 'widgets.dart';

// «Зараз грає» в стилі iOS 26 — як components/am/now-playing.tsx на сайті: обкладинка на всю
// ширину вгорі тане в тло кольору обкладинки; назва, виконавець (дотик — сторінка виконавця),
// зірочка й «⋯»; тонкий прогрес зі значком якості чи LIVE; керування; гучність; знизу —
// текст пісні, вивід звуку й черга. Телефон — одна колонка, планшет — дві. Плеєр завжди темний.

const _ease = Cubic(0.22, 1, 0.36, 1);
const _channel = MethodChannel('gamecon/app');

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
    // Виїжджає знизу, як аркуш «Зараз грає» в iOS.
    transitionsBuilder: (_, animation, _, child) {
      final t = CurvedAnimation(parent: animation, curve: _ease, reverseCurve: Curves.easeIn);
      return SlideTransition(position: Tween(begin: const Offset(0, 1), end: Offset.zero).animate(t), child: child);
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
  bool lyricsLoading = false;

  /// Що відкрито замість обкладинки: null, 'lyrics' чи 'queue'.
  String? view;

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

  void _onPlayer() {
    final track = player.current;
    if (track == null) {
      if (mounted) Navigator.of(context).maybePop();
      return;
    }
    if (track.key == _key) return;
    final key = _key = track.key;
    lyrics = null;
    final cover = track.cover;
    if (cover != null) {
      coverColor(cover).then((color) {
        if (mounted && _key == key) setState(() => tint = color);
      });
    } else {
      tint = null;
    }
    // Текст для всіх пісень: свої — з каталогу (сервер дошукає), інші — пошуком за назвою.
    final api = player.session?.api;
    if (api == null || track.live) return;
    lyricsLoading = true;
    fetchLyrics(api, id: track.id, artist: track.artist, title: track.title, seconds: track.seconds).then((found) {
      if (mounted && _key == key) setState(() => lyrics = found);
    }).catchError((_) {}).whenComplete(() {
      if (mounted && _key == key) setState(() => lyricsLoading = false);
    });
  }

  void _toggle(String panel) => setState(() => view = view == panel ? null : panel);

  void _close() => Navigator.of(context).maybePop();

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: player,
      builder: (context, _) {
        final track = player.current;
        if (track == null) return const SizedBox.shrink();
        final media = MediaQuery.of(context);
        final wide = media.size.width >= tabletWidth;
        final base = Color.lerp(tint ?? const Color(0xFF1A2F7A), Colors.black, 0.35)!;
        final reduce = media.disableAnimations;
        final live = track.live;
        final panel = view == 'lyrics' && live ? null : view;

        final controls = Column(mainAxisSize: MainAxisSize.min, children: [
          _Progress(player: player, track: track),
          const SizedBox(height: 10),
          _Controls(player: player),
          const SizedBox(height: 14),
          _Volume(player: player),
          const SizedBox(height: 8),
          _BottomRow(view: panel, live: live, onView: _toggle, onOutput: () => showAudioOutput(context)),
        ]);

        Widget panelBody() => panel == 'lyrics' ? _lyricsArea() : _QueuePanel(player: player);

        final Widget content;
        if (wide) {
          content = Row(children: [
            Expanded(
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Flexible(
                  child: AnimatedScale(
                    scale: player.playing || live ? 1 : 0.86,
                    duration: reduce ? Duration.zero : const Duration(milliseconds: 450),
                    curve: Curves.easeOutBack,
                    child: ConstrainedBox(
                      constraints: BoxConstraints(maxWidth: math.min(media.size.height * 0.5, 520)),
                      child: DecoratedBox(
                        decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), boxShadow: const [BoxShadow(color: Color(0x99000000), blurRadius: 60, offset: Offset(0, 24), spreadRadius: -18)]),
                        child: Artwork(url: track.cover, seed: track.key, radius: 12, icon: track.live ? LucideIcons.radio : LucideIcons.music),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 560),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [_TitleRow(player: player, track: track, onArtist: _openArtist), const SizedBox(height: 14), controls]),
                ),
              ]),
            ),
            const SizedBox(width: 56),
            Expanded(child: view == 'queue' || live ? _QueuePanel(player: player) : _lyricsArea()),
          ]);
        } else {
          content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Expanded(
              child: AnimatedSwitcher(
                duration: reduce ? Duration.zero : const Duration(milliseconds: 220),
                child: panel == null
                    ? GestureDetector(
                        key: const ValueKey('art'),
                        behavior: HitTestBehavior.opaque,
                        // Свайп по обкладинці вбік — інший трек.
                        onHorizontalDragEnd: (d) {
                          final v = d.primaryVelocity ?? 0;
                          if (v < -500) player.next();
                          if (v > 500) player.prev();
                        },
                        child: Align(alignment: Alignment.bottomLeft, child: _TitleRow(player: player, track: track, onArtist: _openArtist)),
                      )
                    : Column(key: ValueKey(panel), children: [
                        _CompactHeader(player: player, track: track, onArtist: _openArtist),
                        const SizedBox(height: 10),
                        Expanded(child: panelBody()),
                      ]),
              ),
            ),
            const SizedBox(height: 12),
            controls,
            if (GcAudioHandler.failure != null) ...[
              const SizedBox(height: 6),
              Text(tr('Фонове відтворення недоступне: {failure}', {'failure': GcAudioHandler.failure}), textAlign: TextAlign.center, style: body(11, color: Colors.white38)),
            ],
          ]);
        }

        return Material(
          color: base,
          child: GestureDetector(
            // Свайп униз згортає плеєр (коли не відкрито список).
            onVerticalDragEnd: panel != null && !wide
                ? null
                : (d) {
                    if ((d.primaryVelocity ?? 0) > 700) _close();
                  },
            child: Stack(fit: StackFit.expand, children: [
              // Тло: колір обкладинки, затемнений донизу, щоб білий текст читався завжди.
              const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x0D000000), Color(0x73000000)]))),
              if (!wide)
                AnimatedSwitcher(
                  duration: reduce ? Duration.zero : const Duration(milliseconds: 300),
                  child: panel == null ? _Hero(key: ValueKey('hero-${track.key}'), track: track, height: media.size.height * 0.68) : _Blur(key: const ValueKey('blur'), cover: track.cover),
                ),
              SafeArea(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1200),
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(wide ? 48 : 24, 0, wide ? 48 : 24, 8),
                      child: Column(children: [
                        Semantics(
                          button: true,
                          label: tr('Згорнути'),
                          child: GestureDetector(
                            onTap: _close,
                            behavior: HitTestBehavior.opaque,
                            child: SizedBox(
                              height: 32,
                              width: 72,
                              child: Center(
                                child: wide
                                    ? const Icon(LucideIcons.chevronDown, color: Colors.white70, size: 26)
                                    : Container(width: 36, height: 5, decoration: BoxDecoration(color: Colors.white60, borderRadius: BorderRadius.circular(3))),
                              ),
                            ),
                          ),
                        ),
                        Expanded(child: content),
                      ]),
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

  Widget _lyricsArea() {
    final current = lyrics;
    if (current == null) {
      if (lyricsLoading) return const Center(child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white70));
      return const NoLyrics(color: Colors.white70);
    }
    return _LyricsView(lyrics: current, position: player.position.inMilliseconds / 1000, onSeek: (s) => player.seek(Duration(milliseconds: (s * 1000).round())));
  }

  /// Сторінка виконавця: згортаємо плеєр і відкриваємо її в розділі «Музика».
  void _openArtist(String name) {
    final router = GoRouter.of(context);
    _close();
    router.push(artistPath(name));
  }
}

/// Обкладинка на всю ширину вгорі, що тане в колір тла (iOS 26).
class _Hero extends StatelessWidget {
  const _Hero({required this.track, required this.height, super.key});
  final QueueTrack track;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topCenter,
      child: IgnorePointer(
        child: SizedBox(
          height: height,
          width: double.infinity,
          child: ShaderMask(
            blendMode: BlendMode.dstIn,
            shaderCallback: (rect) => const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.black, Colors.black, Colors.transparent], stops: [0, 0.5, 0.98]).createShader(rect),
            child: track.cover == null ? MusicPlaceholder(seed: track.key, iconSize: 72, icon: track.live ? LucideIcons.radio : LucideIcons.music) : NetImage(track.cover, fit: BoxFit.cover),
          ),
        ),
      ),
    );
  }
}

/// Тло під текстом і чергою: розмита обкладинка.
class _Blur extends StatelessWidget {
  const _Blur({required this.cover, super.key});
  final String? cover;

  @override
  Widget build(BuildContext context) {
    if (cover == null) return const SizedBox.expand();
    return IgnorePointer(
      child: Opacity(
        opacity: 0.55,
        child: Transform.scale(
          scale: 1.5,
          child: ImageFiltered(imageFilter: ui.ImageFilter.blur(sigmaX: 60, sigmaY: 60, tileMode: TileMode.decal), child: NetImage(cover, fit: BoxFit.cover)),
        ),
      ),
    );
  }
}

/// Назва, виконавець, зірочка й «⋯».
class _TitleRow extends StatelessWidget {
  const _TitleRow({required this.player, required this.track, required this.onArtist});
  final TrackPlayer player;
  final QueueTrack track;
  final ValueChanged<String> onArtist;

  @override
  Widget build(BuildContext context) {
    final artist = artistOf(track.artist, track.live ? tr('Пряма трансляція') : 'Невідомий виконавець');
    return Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text(track.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: display(22, color: Colors.white).copyWith(letterSpacing: -0.3)),
          const SizedBox(height: 2),
          GestureDetector(
            onTap: track.live || junkMeta(track.artist) ? null : () => onArtist(track.artist),
            child: Text(artist, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(18, color: Colors.white.withValues(alpha: 0.65))),
          ),
        ]),
      ),
      if (track.local) _Round(icon: LucideIcons.star, label: track.favorite ? tr('Прибрати з улюбленого') : tr('Улюблене'), active: track.favorite, onTap: () => toggleFavorite(context, track.toCard())),
      const SizedBox(width: 8),
      _Round(icon: LucideIcons.ellipsis, label: tr('Ще'), onTap: () => _menu(context)),
    ]);
  }

  Future<void> _menu(BuildContext context) async {
    final card = track.toCard();
    await showTrackMenu(context, card, onChanged: () => player.updateMeta(card), beforeNavigate: () => Navigator.of(context).maybePop());
  }
}

/// Шапка над текстом і чергою: маленька обкладинка, назва, зірочка, «⋯».
class _CompactHeader extends StatelessWidget {
  const _CompactHeader({required this.player, required this.track, required this.onArtist});
  final TrackPlayer player;
  final QueueTrack track;
  final ValueChanged<String> onArtist;

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      SizedBox(width: 56, child: Artwork(url: track.cover, seed: track.key, radius: 6)),
      const SizedBox(width: 12),
      Expanded(child: _TitleRow(player: player, track: track, onArtist: onArtist)),
    ]);
  }
}

class _Round extends StatelessWidget {
  const _Round({required this.icon, required this.label, required this.onTap, this.active = false});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool active;

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
          radius: 22,
          child: Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(shape: BoxShape.circle, color: active ? primary : Colors.white.withValues(alpha: 0.16)),
            child: Icon(icon, size: 17, color: Colors.white),
          ),
        ),
      ),
    );
  }
}

/// Тонкий прогрес: дотик чи перетягування — перемотка; посередині — якість або LIVE.
class _Progress extends StatefulWidget {
  const _Progress({required this.player, required this.track});
  final TrackPlayer player;
  final QueueTrack track;

  @override
  State<_Progress> createState() => _ProgressState();
}

class _ProgressState extends State<_Progress> {
  double? drag;

  @override
  Widget build(BuildContext context) {
    final player = widget.player;
    if (widget.track.live) {
      return SizedBox(
        height: 46,
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(color: primary, borderRadius: BorderRadius.circular(5)),
            child: Text('LIVE', style: body(11, color: Colors.white, weight: FontWeight.w800).copyWith(letterSpacing: 0.8)),
          ),
          const SizedBox(width: 8),
          Text(tr('Пряма трансляція'), style: body(13, color: Colors.white70)),
        ]),
      );
    }
    final total = player.duration.inMilliseconds > 0 ? player.duration.inMilliseconds / 1000 : widget.track.seconds.toDouble();
    final position = drag ?? player.position.inMilliseconds / 1000;
    final active = drag != null;
    final figures = body(12, color: Colors.white54, weight: FontWeight.w500).copyWith(fontFeatures: const [ui.FontFeature.tabularFigures()]);
    return Column(children: [
      SizedBox(
        height: 24,
        child: SliderTheme(
          data: SliderThemeData(
            trackHeight: active ? 9 : 6,
            activeTrackColor: Colors.white.withValues(alpha: active ? 0.95 : 0.7),
            inactiveTrackColor: Colors.white.withValues(alpha: 0.2),
            thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 0, elevation: 0, pressedElevation: 0),
            overlayShape: SliderComponentShape.noOverlay,
            trackShape: const RoundedRectSliderTrackShape(),
          ),
          child: Slider(
            value: total <= 0 ? 0 : position.clamp(0, total),
            max: total <= 0 ? 1 : total,
            semanticFormatterCallback: (v) => duration(v.round()),
            onChanged: total <= 0 ? null : (v) => setState(() => drag = v),
            onChangeEnd: (v) {
              player.seek(Duration(milliseconds: (v * 1000).round()));
              setState(() => drag = null);
            },
          ),
        ),
      ),
      const SizedBox(height: 4),
      Row(children: [
        SizedBox(width: 56, child: Text(duration(position.round()), style: figures)),
        Expanded(child: Center(child: QualityBadge(widget.track.quality, color: Colors.white70))),
        SizedBox(width: 56, child: Text('-${duration(math.max(0, total - position).round())}', textAlign: TextAlign.right, style: figures)),
      ]),
    ]);
  }
}

/// Назад, грати/пауза, далі — білі знаки без кружечків, як в iOS.
class _Controls extends StatelessWidget {
  const _Controls({required this.player});
  final TrackPlayer player;

  @override
  Widget build(BuildContext context) {
    Widget button(String label, VoidCallback onTap, Widget child) => Semantics(
          button: true,
          label: label,
          child: InkResponse(onTap: onTap, radius: 40, child: SizedBox(width: 76, height: 64, child: Center(child: child))),
        );
    return Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
      button(tr('Попередній'), player.prev, const CustomPaint(size: Size(40, 26), painter: _SkipGlyph(forward: false))),
      button(
        player.playing ? tr('Пауза') : tr('Відтворити'),
        player.toggle,
        AnimatedSwitcher(
          duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : const Duration(milliseconds: 180),
          transitionBuilder: (child, animation) => ScaleTransition(scale: Tween(begin: 0.6, end: 1.0).animate(animation), child: FadeTransition(opacity: animation, child: child)),
          child: CustomPaint(key: ValueKey(player.playing), size: const Size.square(40), painter: _PlayGlyph(player.playing)),
        ),
      ),
      button(tr('Наступний'), player.next, const CustomPaint(size: Size(40, 26), painter: _SkipGlyph(forward: true))),
    ]);
  }
}

class _Volume extends StatelessWidget {
  const _Volume({required this.player});
  final TrackPlayer player;

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      GestureDetector(onTap: () => player.setVolume(0), child: const Icon(LucideIcons.volume, size: 16, color: Colors.white60)),
      Expanded(
        child: SliderTheme(
          data: SliderThemeData(
            trackHeight: 6,
            activeTrackColor: Colors.white.withValues(alpha: 0.75),
            inactiveTrackColor: Colors.white.withValues(alpha: 0.2),
            thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 0, elevation: 0, pressedElevation: 0),
            overlayShape: SliderComponentShape.noOverlay,
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Slider(value: player.volume, semanticFormatterCallback: (v) => tr('Гучність {v}%', {'v': (v * 100).round()}), onChanged: player.setVolume),
          ),
        ),
      ),
      GestureDetector(onTap: () => player.setVolume(1), child: const Icon(LucideIcons.volume2, size: 18, color: Colors.white60)),
    ]);
  }
}

/// Текст пісні, вивід звуку й черга.
class _BottomRow extends StatelessWidget {
  const _BottomRow({required this.view, required this.live, required this.onView, required this.onOutput});
  final String? view;
  final bool live;
  final ValueChanged<String> onView;
  final VoidCallback onOutput;

  @override
  Widget build(BuildContext context) {
    Widget item(IconData icon, String label, VoidCallback? onTap, {bool active = false}) => Tooltip(
          message: label,
          child: Semantics(
            button: true,
            toggled: active,
            label: label,
            child: InkResponse(
              onTap: onTap,
              radius: 26,
              child: Container(
                width: 46,
                height: 40,
                decoration: BoxDecoration(color: active ? Colors.white.withValues(alpha: 0.18) : Colors.transparent, borderRadius: BorderRadius.circular(12)),
                child: Icon(icon, size: 21, color: onTap == null ? Colors.white24 : (active ? Colors.white : Colors.white70)),
              ),
            ),
          ),
        );
    return Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
      item(LucideIcons.messageSquareQuote, tr('Текст пісні'), live ? null : () => onView('lyrics'), active: view == 'lyrics'),
      item(LucideIcons.airplay, tr('Вивід звуку'), onOutput),
      item(LucideIcons.listMusic, tr('Далі в черзі'), () => onView('queue'), active: view == 'queue'),
    ]);
  }
}

/// «Вивід звуку»: системний перемикач Android (навушники, колонки, Cast), а де його немає — пояснення.
Future<void> showAudioOutput(BuildContext context) async {
  try {
    if (await _channel.invokeMethod<bool>('audioOutput') == true) return;
  } catch (_) {}
  if (!context.mounted) return;
  await showGcSheet<void>(
    context,
    title: tr('Вивід звуку'),
    builder: (sheet) => Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        ListTile(leading: Icon(LucideIcons.smartphone, color: accent), title: Text(tr('Цей пристрій'), style: body(15, weight: FontWeight.w600)), trailing: Icon(LucideIcons.check, color: accent)),
        ListTile(
          leading: Icon(LucideIcons.bluetooth, color: muted),
          title: Text(tr('Навушники чи колонка…'), style: body(15)),
          onTap: () {
            Navigator.pop(sheet);
            unawaited(_channel.invokeMethod<bool>('bluetoothSettings').catchError((_) => false));
          },
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Text(
            tr('Bluetooth-навушники й колонки під’єднуються в налаштуваннях телефона — звук перейде на них сам. Транслювати на Chromecast чи телевізор можна з системного перемикача звуку в шторці Android.'),
            style: body(13, color: muted).copyWith(height: 1.45),
          ),
        ),
      ]),
    ),
  );
}

/// Черга: «Далі в черзі» з перемішуванням, повтором і ∞, перетягування, історія.
class _QueuePanel extends StatefulWidget {
  const _QueuePanel({required this.player});
  final TrackPlayer player;

  @override
  State<_QueuePanel> createState() => _QueuePanelState();
}

class _QueuePanelState extends State<_QueuePanel> {
  bool history = false;

  @override
  Widget build(BuildContext context) {
    final player = widget.player;
    final start = player.index + 1;
    final upcoming = start < player.queue.length ? player.queue.sublist(start) : <QueueTrack>[];
    final live = player.current?.live == true;
    Widget toggle(IconData icon, String label, bool on, VoidCallback onTap) => Expanded(
          child: Semantics(
            button: true,
            toggled: on,
            label: label,
            child: GestureDetector(
              onTap: onTap,
              child: Container(
                height: 38,
                decoration: BoxDecoration(color: on ? Colors.white.withValues(alpha: 0.9) : Colors.white.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(12)),
                child: Icon(icon, size: 18, color: on ? Colors.black87 : Colors.white),
              ),
            ),
          ),
        );
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        toggle(LucideIcons.shuffle, tr('Перемішати'), player.shuffle, player.toggleShuffle),
        const SizedBox(width: 8),
        toggle(player.repeatMode == 'one' ? LucideIcons.repeat1 : LucideIcons.repeat, tr('Повтор'), player.repeatMode != 'off', player.toggleRepeat),
        const SizedBox(width: 8),
        toggle(LucideIcons.infinity, tr('Автовідтворення'), player.autoplay, player.toggleAutoplay),
        const SizedBox(width: 8),
        toggle(LucideIcons.history, tr('Історія'), history, () => setState(() => history = !history)),
      ]),
      const SizedBox(height: 14),
      if (history) ...[
        Text(tr('Історія'), style: display(17, color: Colors.white)),
        const SizedBox(height: 6),
        Expanded(
          child: player.history.isEmpty
              ? Center(child: Text(tr('Ще нічого не грало'), style: body(14, color: Colors.white54)))
              : ListView(padding: EdgeInsets.zero, children: [for (final t in player.history) _QueueRow(track: t, onTap: () => player.replay(t))]),
        ),
      ] else ...[
        Row(children: [
          Expanded(child: Text(tr('Далі в черзі'), style: display(17, color: Colors.white))),
          if (upcoming.isNotEmpty) GestureDetector(onTap: player.clearUpNext, child: Text(tr('Очистити'), style: body(14, color: Colors.white70))),
        ]),
        if (player.station != null)
          Text(tr('Зі станції — нові треки додаються самі'), style: body(13, color: Colors.white54))
        else if (player.autoplay && !live)
          Text(tr('∞ Автовідтворення: після черги гратимуть схожі треки'), style: body(13, color: Colors.white54)),
        const SizedBox(height: 6),
        Expanded(
          child: upcoming.isEmpty
              ? Center(child: Text(tr('Черга порожня'), style: body(14, color: Colors.white54)))
              : ReorderableListView.builder(
                  padding: EdgeInsets.zero,
                  buildDefaultDragHandles: false,
                  itemCount: upcoming.length,
                  onReorderItem: (from, to) => player.move(start + from, start + to),
                  proxyDecorator: (child, _, _) => Material(color: Colors.white.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12), child: child),
                  itemBuilder: (context, i) => _QueueRow(
                    key: ObjectKey(upcoming[i]),
                    track: upcoming[i],
                    onTap: () => player.playAt(start + i),
                    onRemove: () => player.removeAt(start + i),
                    dragIndex: i,
                  ),
                ),
        ),
      ],
    ]);
  }
}

class _QueueRow extends StatelessWidget {
  const _QueueRow({required this.track, required this.onTap, this.onRemove, this.dragIndex, super.key});
  final QueueTrack track;
  final VoidCallback onTap;
  final VoidCallback? onRemove;
  final int? dragIndex;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(children: [
            SizedBox(width: 44, child: Artwork(url: track.cover, seed: track.key, radius: 6, icon: track.live ? LucideIcons.radio : LucideIcons.music)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(track.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14.5, color: Colors.white, weight: FontWeight.w500)),
                Text(artistOf(track.artist, '—'), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12.5, color: Colors.white54)),
              ]),
            ),
            if (onRemove != null) IconButton(tooltip: tr('Прибрати з черги'), visualDensity: VisualDensity.compact, onPressed: onRemove, icon: const Icon(LucideIcons.circleMinus, size: 18, color: Colors.white54)),
            if (dragIndex != null)
              ReorderableDragStartListener(
                index: dragIndex!,
                child: Semantics(label: tr('Перетягнути'), child: const Padding(padding: EdgeInsets.symmetric(horizontal: 6, vertical: 8), child: Icon(LucideIcons.gripHorizontal, size: 18, color: Colors.white54))),
              ),
          ]),
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
        if (ctx != null) Scrollable.ensureVisible(ctx, alignment: 0.35, duration: reduce ? Duration.zero : const Duration(milliseconds: 400), curve: _ease);
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
          stops: [0, 0.08, 0.9, 1],
        ).createShader(rect),
        child: LayoutBuilder(
          builder: (context, box) => SingleChildScrollView(
            padding: EdgeInsets.only(top: 16, bottom: box.maxHeight * 0.5),
            child: lyrics.timed
                ? Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    for (var i = 0; i < lyrics.lines.length; i++)
                      GestureDetector(
                        key: _key(i),
                        behavior: HitTestBehavior.opaque,
                        onTap: () => widget.onSeek(lyrics.lines[i].time ?? 0),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 7),
                          child: AnimatedDefaultTextStyle(
                            duration: reduce ? Duration.zero : const Duration(milliseconds: 300),
                            style: display(26, color: i == current ? Colors.white : Colors.white.withValues(alpha: i < current ? 0.3 : 0.42)).copyWith(height: 1.25, letterSpacing: -0.4),
                            child: Text(lyrics.lines[i].text.isEmpty ? '♪' : lyrics.lines[i].text),
                          ),
                        ),
                      ),
                  ])
                : Text(lyrics.lines.map((l) => l.text).join('\n'), style: body(19, color: Colors.white.withValues(alpha: 0.85), weight: FontWeight.w600).copyWith(height: 1.55)),
          ),
        ),
      ),
    );
  }
}

/// Знак «грати» / «пауза» — білий, залитий, з м'якими кутами.
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
      final w = size.width * 0.24;
      final r = Radius.circular(w * 0.3);
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(size.width * 0.2, size.height * 0.1, w, size.height * 0.8), r), paint);
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(size.width * 0.56, size.height * 0.1, w, size.height * 0.8), r), paint);
      return;
    }
    final path = Path()
      ..moveTo(size.width * 0.18, size.height * 0.1)
      ..lineTo(size.width * 0.9, size.height * 0.5)
      ..lineTo(size.width * 0.18, size.height * 0.9)
      ..close();
    canvas.drawPath(path, paint);
    canvas.drawPath(path, Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * 0.1
      ..strokeJoin = StrokeJoin.round);
  }

  @override
  bool shouldRepaint(_PlayGlyph old) => old.playing != playing;
}

/// Подвійний трикутник «назад» / «далі», як в iOS.
class _SkipGlyph extends CustomPainter {
  const _SkipGlyph({required this.forward});
  final bool forward;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill
      ..strokeJoin = StrokeJoin.round
      ..isAntiAlias = true;
    final half = size.width / 2;
    for (var k = 0; k < 2; k++) {
      final x0 = k * half;
      final path = forward
          ? (Path()
            ..moveTo(x0, 0)
            ..lineTo(x0 + half, size.height / 2)
            ..lineTo(x0, size.height)
            ..close())
          : (Path()
            ..moveTo(x0 + half, 0)
            ..lineTo(x0, size.height / 2)
            ..lineTo(x0 + half, size.height)
            ..close());
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(_SkipGlyph old) => old.forward != forward;
}

