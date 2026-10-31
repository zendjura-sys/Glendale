import 'dart:io' show Platform;
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'theme.dart';

// Сезонні прикраси — як на сайті (components/gc/seasonal.tsx, сезон із сервера — App\Support\Seasons):
//  newyear      — сніг, хвойна гірлянда й вогники над шапкою, гілка з кульками, ялинковий кут, шапка Санти на аватарах;
//  valentine    — серця, що повільно спливають;
//  easter       — пелюстки;
//  independence — синьо-жовта стрічка під шапкою;
//  halloween    — кажани й осіннє листя.
// Фон теж «святкує»: відтінок і світло сезону лягають на тло. Прикраси не перехоплюють дотики;
// за «зменшити рух» стоять нерухомо.

/// Сезон, який зараз бачить людина (ставить оболонка з `/me`), — для шапки Санти на аватарах.
final currentSeason = ValueNotifier<String?>(null);

/// У тестах прикраси нерухомі: нескінченна анімація не дала б екранам «заспокоїтися».
bool _still(BuildContext context) => MediaQuery.disableAnimationsOf(context) || Platform.environment.containsKey('FLUTTER_TEST');

/// Детермінований псевдовипадок: прикраси не «стрибають» між кадрами.
double _rand(int seed) {
  final x = math.sin(seed * 78.233 + 12.9898) * 43758.5453;
  return x - x.floorToDouble();
}

// ───────────────────────── Тло сезону ─────────────────────────

/// Відтінок і світло сезону поверх тла (під вмістом), а для Нового року — ялинковий кут.
class SeasonBackdrop extends StatelessWidget {
  const SeasonBackdrop({required this.season, super.key});
  final String? season;

  @override
  Widget build(BuildContext context) {
    final s = season;
    if (s == null) return const SizedBox.shrink();
    final bottom = MediaQuery.viewPaddingOf(context).bottom;
    return IgnorePointer(
      child: Stack(children: [
        Positioned.fill(child: CustomPaint(painter: _TintPainter(s, palette.isLight))),
        if (s == 'newyear')
          Positioned(left: 0, bottom: bottom + 72, width: 150, child: Opacity(opacity: 0.95, child: Image.asset('assets/seasons/corner-bottom.webp'))),
      ]),
    );
  }
}

class _TintPainter extends CustomPainter {
  _TintPainter(this.season, this.light);
  final String season;
  final bool light;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    // Відтінок усього фону (на сайті — mix-blend-mode: color).
    final (List<Color> tint, double strength) = switch (season) {
      'newyear' => (const [Color(0xFF1E3A8A), Color(0xFF0E7490)], 0.22),
      'valentine' => (const [Color(0xFFBE185D), Color(0xFFF472B6)], 0.18),
      'easter' => (const [Color(0xFF7DD3FC), Color(0xFF86EFAC)], 0.16),
      'independence' => (const [Color(0xFF0057B7), Color(0xFFFFD700)], 0.16),
      'halloween' => (const [Color(0xFF4C1D95), Color(0xFFC2410C)], 0.26),
      _ => (const [Color(0x00000000), Color(0x00000000)], 0.0),
    };
    final k = light ? 0.5 : 1.0;
    canvas.drawRect(
      rect,
      Paint()
        ..shader = ui.Gradient.linear(rect.topCenter, rect.bottomCenter, [
          tint[0].withValues(alpha: strength * k),
          tint[1].withValues(alpha: strength * k),
        ]),
    );
    // «Земля» чи світло сезону.
    void glow(Alignment at, double rx, double ry, Color color) {
      final c = at.alongSize(size);
      canvas.save();
      canvas.translate(c.dx, c.dy);
      canvas.scale(rx * size.width, ry * size.height);
      canvas.drawCircle(Offset.zero, 1, Paint()..shader = ui.Gradient.radial(Offset.zero, 1, [color, color.withValues(alpha: 0)]));
      canvas.restore();
    }

    switch (season) {
      case 'newyear':
        glow(const Alignment(-0.6, 1.08), 0.9, 0.16, Color.fromRGBO(241, 245, 255, 0.45 * k));
        glow(const Alignment(0.7, 1.12), 0.8, 0.15, Color.fromRGBO(241, 245, 255, 0.4 * k));
      case 'valentine':
        glow(const Alignment(0, 1), 0.7, 0.35, const Color.fromRGBO(251, 113, 133, 0.25));
      case 'easter':
        glow(const Alignment(0, 1.08), 1.0, 0.18, const Color.fromRGBO(134, 239, 172, 0.35));
        glow(const Alignment(0.6, -1), 0.45, 0.25, const Color.fromRGBO(254, 240, 138, 0.22));
      case 'independence':
        glow(const Alignment(0, 1.1), 1.0, 0.3, const Color.fromRGBO(255, 215, 0, 0.18));
      case 'halloween':
        glow(const Alignment(0.7, -1), 0.55, 0.3, const Color.fromRGBO(254, 215, 170, 0.16));
        glow(const Alignment(0, 1), 0.8, 0.25, const Color.fromRGBO(234, 88, 12, 0.2));
    }
  }

  @override
  bool shouldRepaint(_TintPainter old) => old.season != season || old.light != light;
}

// ───────────────────────── Прикраси поверх вмісту ─────────────────────────

/// Частинки (сніг, листя, пелюстки, серця) і кажани — над вмістом, під шапкою й доком.
class SeasonOverlay extends StatefulWidget {
  const SeasonOverlay({required this.season, super.key});
  final String? season;

  @override
  State<SeasonOverlay> createState() => _SeasonOverlayState();
}

class _SeasonOverlayState extends State<SeasonOverlay> with SingleTickerProviderStateMixin {
  // Один довгий цикл на всі частинки: кожна має свою тривалість, кратну циклу.
  late final AnimationController _t = AnimationController(vsync: this, duration: const Duration(seconds: 120));
  ui.Image? _bat;

  @override
  void initState() {
    super.initState();
    _loadBat();
  }

  Future<void> _loadBat() async {
    final data = await rootBundle.load('assets/seasons/bat.png');
    final codec = await ui.instantiateImageCodec(data.buffer.asUint8List());
    final frame = await codec.getNextFrame();
    if (mounted) setState(() => _bat = frame.image);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(SeasonOverlay old) {
    super.didUpdateWidget(old);
    _sync();
  }

  void _sync() {
    final run = widget.season != null && !_still(context);
    if (run && !_t.isAnimating) _t.repeat();
    if (!run) {
      _t.stop();
      // Нерухомий кадр — частинки розкидані по екрану, а не зібрані вгорі.
      _t.value = 0.37;
    }
  }

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.season;
    if (s == null) return const SizedBox.shrink();
    return IgnorePointer(
      child: RepaintBoundary(
        child: CustomPaint(size: Size.infinite, painter: _ParticlesPainter(s, _t, _bat, palette.isLight, still: _still(context))),
      ),
    );
  }
}

class _ParticlesPainter extends CustomPainter {
  _ParticlesPainter(this.season, this.t, this.bat, this.light, {required this.still}) : super(repaint: t);
  final String season;
  final Animation<double> t;
  final ui.Image? bat;
  final bool light;
  final bool still;

  static const _cycle = 120.0; // секунд у циклі контролера

  @override
  void paint(Canvas canvas, Size size) {
    final seconds = t.value * _cycle;
    switch (season) {
      case 'newyear':
        _fall(canvas, size, seconds, count: 18, seed: 7, draw: (c, s, rot) {
          final r = s * 3;
          if (light) c.drawCircle(Offset.zero, r + 1, Paint()..color = const Color(0xCCFFFFFF));
          c.drawCircle(Offset.zero, r, Paint()..color = light ? const Color(0xFFBCD6EE) : const Color(0xBFFFFFFF));
        });
      case 'easter':
        _fall(canvas, size, seconds, count: 8, seed: 31, draw: (c, s, rot) {
          c.rotate(rot);
          c.drawOval(Rect.fromCenter(center: Offset.zero, width: s * 10, height: s * 7), Paint()..color = const Color(0xB3F9A8D4));
        });
      case 'halloween':
        _fall(canvas, size, seconds, count: 7, seed: 53, draw: (c, s, rot) {
          c.rotate(rot);
          final w = s * 9;
          final leaf = Path()
            ..moveTo(-w / 2, w / 2)
            ..quadraticBezierTo(-w / 2, -w / 2, w / 2, -w / 2)
            ..quadraticBezierTo(w / 2, w / 2, -w / 2, w / 2);
          c.drawPath(leaf, Paint()..color = const Color(0x99F97316));
        });
        _bats(canvas, size, seconds);
      case 'valentine':
        _rise(canvas, size, seconds);
    }
  }

  /// Падіння зверху вниз зі зносом убік і обертанням (season-fall).
  void _fall(Canvas canvas, Size size, double seconds, {required int count, required int seed, required void Function(Canvas c, double s, double rot) draw}) {
    for (var i = 0; i < count; i++) {
      final left = _rand(seed + i) * size.width;
      final scale = 0.6 + _rand(seed + i * 3) * 0.9;
      final duration = 9 + _rand(seed + i * 7) * 12;
      final delay = _rand(seed + i * 11) * 20;
      final drift = (_rand(seed + i * 13) - 0.5) * 80;
      final p = ((seconds + delay) / duration) % 1;
      canvas.save();
      canvas.translate(left + drift * p, -40 + (size.height * 1.1 + 40) * p);
      draw(canvas, scale, p * 240 * math.pi / 180);
      canvas.restore();
    }
  }

  /// Серця спливають знизу вгору й гаснуть (season-rise).
  void _rise(Canvas canvas, Size size, double seconds) {
    for (var i = 0; i < 7; i++) {
      final left = _rand(19 + i) * size.width;
      final s = 0.6 + _rand(19 + i * 3) * 0.9;
      final duration = 9 + _rand(19 + i * 7) * 12;
      final delay = _rand(19 + i * 11) * 20;
      final drift = (_rand(19 + i * 13) - 0.5) * 80;
      final p = ((seconds + delay) / duration) % 1;
      final alpha = (p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85) * 0.55;
      canvas.save();
      canvas.translate(left + drift * p, size.height + 40 - (size.height * 1.1 + 40) * p);
      canvas.scale(s * 22 / 24);
      canvas.translate(-12, -12);
      final heart = Path()
        ..moveTo(12, 21)
        ..cubicTo(12, 21, 4.5, 16.4, 2.5, 11.7)
        ..cubicTo(1, 8, 3.3, 4.5, 7, 4.5)
        ..cubicTo(9, 4.5, 10.6, 5.6, 12, 7.5)
        ..cubicTo(13.4, 5.6, 15, 4.5, 17, 4.5)
        ..cubicTo(20.7, 4.5, 23, 8, 21.5, 11.7)
        ..cubicTo(19.5, 16.4, 12, 21, 12, 21);
      canvas.drawPath(heart, Paint()..color = const Color(0xFFFB7185).withValues(alpha: alpha.clamp(0, 1)));
      canvas.restore();
    }
  }

  /// Кажани перелітають екран (season-fly) і змахують крилами (season-flap).
  void _bats(Canvas canvas, Size size, double seconds) {
    final image = bat;
    if (image == null) return;
    for (var i = 0; i < 4; i++) {
      final s = 0.6 + _rand(43 + i * 3) * 0.9;
      final duration = 9 + _rand(43 + i * 7) * 12;
      final delay = _rand(43 + i * 11) * 20;
      final p = ((seconds + delay) / duration) % 1;
      // Траєкторія: -20% → 50% (трохи нижче) → 120% ширини.
      final x = p < 0.5 ? -0.2 + 1.4 * p : 0.5 + 1.4 * (p - 0.5);
      final y = 0.22 + (p < 0.5 ? 0.16 * p : 0.08 - 0.24 * (p - 0.5)) + _rand(43 + i * 17) * 0.25;
      final w = s * 64, h = s * 28;
      final flap = still ? 1.0 : 0.775 + 0.225 * math.cos(seconds * 2 * math.pi / 0.64);
      canvas.save();
      canvas.translate(x * size.width, y * size.height);
      canvas.scale(0.96 + 0.04 * flap, flap);
      final dst = Rect.fromCenter(center: Offset.zero, width: w, height: h);
      final src = Rect.fromLTWH(0, 0, image.width.toDouble(), image.height.toDouble());
      final fitted = applyBoxFit(BoxFit.contain, src.size, dst.size);
      final out = Alignment.center.inscribe(fitted.destination, dst);
      // Силует (PNG як маска) у темному кольорі з теплим ореолом.
      canvas.drawImageRect(image, src, out.inflate(2), Paint()..colorFilter = const ColorFilter.mode(Color(0x59F97316), BlendMode.srcIn)..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4));
      canvas.drawImageRect(image, src, out, Paint()..colorFilter = const ColorFilter.mode(Color(0xE0120E1A), BlendMode.srcIn));
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_ParticlesPainter old) => old.season != season || old.bat != bat || old.light != light;
}

/// Прикраси біля шапки: новорічні вогники над капсулою, хвойна гірлянда й гілка під нею,
/// синьо-жовта стрічка на День Незалежності.
class SeasonHeader extends StatefulWidget {
  const SeasonHeader({required this.season, required this.headerBottom, super.key});
  final String? season;

  /// Нижній край капсули шапки (від верху екрана).
  final double headerBottom;

  @override
  State<SeasonHeader> createState() => _SeasonHeaderState();
}

class _SeasonHeaderState extends State<SeasonHeader> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: const Duration(milliseconds: 2600));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (widget.season == 'newyear' && !_still(context)) {
      if (!_t.isAnimating) _t.repeat(reverse: true);
    } else {
      _t.stop();
      _t.value = 0.6;
    }
  }

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.viewPaddingOf(context).top;
    return IgnorePointer(
      child: Stack(children: [
        if (widget.season == 'newyear') ...[
          // Гірлянда під шапкою.
          Positioned(
            top: widget.headerBottom - 2,
            left: 12,
            right: 12,
            height: 30,
            child: ShaderMask(
              shaderCallback: (r) => const LinearGradient(colors: [Color(0x00000000), Color(0xFF000000), Color(0xFF000000), Color(0x00000000)], stops: [0, 0.04, 0.96, 1]).createShader(r),
              blendMode: BlendMode.dstIn,
              child: Image.asset('assets/seasons/pine-garland.webp', repeat: ImageRepeat.repeatX, alignment: Alignment.centerLeft, fit: BoxFit.fitHeight),
            ),
          ),
          // Гілка з кульками праворуч — гойдається.
          Positioned(
            top: widget.headerBottom - 4,
            right: -4,
            width: 92,
            child: AnimatedBuilder(
              animation: _t,
              builder: (_, child) => Transform.rotate(angle: (-2 + 5 * _t.value) * math.pi / 180, alignment: const Alignment(0.8, -1), child: child),
              child: Image.asset('assets/seasons/branch-baubles.webp'),
            ),
          ),
          // Вогники: дріт по верхньому краю екрана, лампочки звисають на капсулу; мерехтять.
          Positioned(
            top: top - 7,
            left: 0,
            right: 0,
            height: 32,
            child: AnimatedBuilder(
              animation: _t,
              builder: (_, child) {
                final b = 0.8 + 0.45 * _t.value;
                return ColorFiltered(
                  colorFilter: ColorFilter.matrix([b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 0.95, 0]),
                  child: child,
                );
              },
              child: Image.asset('assets/seasons/lights.webp', repeat: ImageRepeat.repeatX, alignment: Alignment.topLeft, fit: BoxFit.fitHeight),
            ),
          ),
        ],
        if (widget.season == 'independence')
          Positioned(
            top: widget.headerBottom + 2,
            left: 16,
            right: 16,
            height: 4,
            child: const DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.all(Radius.circular(4)),
                gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF0057B7), Color(0xFF0057B7), Color(0xFFFFD700), Color(0xFFFFD700)], stops: [0, 0.5, 0.5, 1]),
              ),
            ),
          ),
      ]),
    );
  }
}

/// Шапка Санти на аватарі (Новий рік): сидить на маківці, трохи набік — як `.santa-hat` на сайті.
class SantaHat extends StatelessWidget {
  const SantaHat({required this.size, super.key});
  final double size;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: -0.01 * size,
      top: -0.43 * size,
      width: 0.96 * size,
      child: IgnorePointer(child: Transform.rotate(angle: -16 * math.pi / 180, child: Image.asset('assets/seasons/santa-hat.webp'))),
    );
  }
}
