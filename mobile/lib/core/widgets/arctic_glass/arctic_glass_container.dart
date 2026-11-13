import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import '../../theme/arctic_glass_theme.dart';
import 'arctic_cascade.dart';
import 'arctic_pressable.dart';

/// Базова поверхня «Spatial Glass» — матеріал iOS (UIVisualEffectView): справжнє розмиття
/// фону з підсиленням насичення, матова тонировка й дзеркальний блік угорі — без обводки
/// й тіней. Розмиття є в КОЖНОЇ поверхні (картки 22, кнопки й поля 16,
/// панелі 28); картка в картці — світліша плашка з власним розмиттям, без тіні.
/// З [onTap] картка пружно стискається від дотику (ArcticPressable), а лід і блік світлішають.
class ArcticGlassContainer extends StatefulWidget {
  const ArcticGlassContainer({
    required this.child,
    this.radius = AppRadii.card,
    this.padding,
    this.margin,
    this.width,
    this.height,
    this.enableBlur = true,
    this.blur = AppBlur.card,
    this.fill,
    this.color,
    this.borderColor,
    this.specular = true,
    this.shadows,
    this.onTap,
    this.onLongPress,
    this.borderRadius,
    this.glowing = false,
    super.key,
  });

  final Widget child;
  final double radius;

  /// Інша форма (напр. лише верхні кути шторки); інакше — [radius] з усіх боків.
  final BorderRadius? borderRadius;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double? width;
  final double? height;

  /// Справжнє розмиття фону під склом (за замовчуванням увімкнене всюди).
  final bool enableBlur;
  final double blur;

  /// Своя заливка замість скла теми (напр. скло панелей).
  final Gradient? fill;
  final Color? color;

  /// Обводка — лише якщо задана явно (за замовчуванням її немає).
  final Color? borderColor;

  /// Дзеркальний блік по верхній грані.
  final bool specular;

  /// Свої тіні замість тіней теми (`const []` — без тіні).
  final List<BoxShadow>? shadows;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  /// Сапфірове сяйво грані (фокус поля пошуку).
  final bool glowing;

  @override
  State<ArcticGlassContainer> createState() => _ArcticGlassContainerState();
}

/// Позначка «я всередині скляної картки» — вкладені картки стають внутрішньою плашкою.
class _InsideGlass extends InheritedWidget {
  const _InsideGlass({required super.child});

  @override
  bool updateShouldNotify(_InsideGlass oldWidget) => false;
}

/// Підсилення насичення перед розмиттям Гаусса — як у матеріалах iOS.
const _saturate = ColorFilter.matrix(<double>[
  1.35, -0.18, -0.18, 0, 0, //
  -0.09, 1.26, -0.18, 0, 0, //
  -0.09, -0.18, 1.45, 0, 0, //
  0, 0, 0, 1, 0,
]);

/// Фільтр скла: насичення, потім розмиття (mirror — без темних ореолів на краях).
ImageFilter arcticGlassFilter(double sigma) => ImageFilter.compose(
  outer: ImageFilter.blur(sigmaX: sigma, sigmaY: sigma, tileMode: TileMode.mirror),
  inner: _saturate,
);

class _ArcticGlassContainerState extends State<ArcticGlassContainer> {
  bool pressed = false;

  @override
  Widget build(BuildContext context) {
    final nested = context.getInheritedWidgetOfExactType<_InsideGlass>() != null;
    // Каскадна поява: скло проявляється саме (розмиття й вміст), а не під шаром прозорості,
    // крізь який BackdropFilter не бачить тла.
    final appear = nested ? null : ArcticCascade.claim(context);
    final w = widget;
    final body = appear == null ? _surface(context, nested, 1) : AnimatedBuilder(animation: appear, builder: (context, _) => _surface(context, nested, appear.value));
    final pressable = w.onTap != null || w.onLongPress != null
        ? ArcticPressable(onTap: w.onTap, onLongPress: w.onLongPress, onPressed: (v) => setState(() => pressed = v), child: body)
        : body;
    return w.margin == null ? pressable : Padding(padding: w.margin!, child: pressable);
  }

  Widget _surface(BuildContext context, bool nested, double t) {
    final tokens = ArcticGlassThemeExtension.of(context);
    final w = widget;
    final still = MediaQuery.disableAnimationsOf(context);
    final plain = w.fill == null && w.color == null;
    final inner = nested && plain;
    // Блоки майже квадратні: радіус не більший за 12 (вкладені — 10), хоч би що задав екран.
    // Панелі (шапка, док, шторки — зі своєю заливкою) лишаються капсулами.
    final radius = plain ? math.min(w.radius, inner ? AppRadii.inner : AppRadii.card) : w.radius;
    final shape = w.borderRadius ?? BorderRadius.circular(radius);
    // Суцільні картки (темна iOS 27): без розмиття й бліку, лише кант; панелі (з fill) — скло.
    final solid = tokens.solidCards && w.fill == null;

    final Gradient? gradient = w.color != null || inner ? null : (w.fill ?? (pressed ? tokens.pressedFill : tokens.glassFill));
    final Color? color = inner ? (pressed ? tokens.innerFill.withValues(alpha: (tokens.innerFill.a * 1.6).clamp(0, 1)) : tokens.innerFill) : w.color;
    // Без обводки: грань лише явно задана ([borderColor]) або сяйво фокусу.
    final edge = w.glowing ? AppColors.accentCyan.withValues(alpha: 0.55) : (w.borderColor ?? (solid && !inner && w.color == null ? tokens.cardBorder : null));

    Widget body = AnimatedContainer(
      duration: still ? Duration.zero : const Duration(milliseconds: 180),
      curve: Curves.easeOutCubic,
      width: w.width,
      height: w.height,
      padding: w.padding,
      decoration: BoxDecoration(
        borderRadius: shape,
        color: color,
        gradient: gradient,
      ),
      // Грань поверх (foregroundDecoration): не додає внутрішнього відступу й не змінює розмірів.
      foregroundDecoration: edge == null ? null : BoxDecoration(borderRadius: shape, border: Border.all(color: edge, width: w.glowing ? 1.2 : 1)),
      child: _InsideGlass(child: w.child),
    );
    // Кант-блік і внутрішнє світіння Liquid Glass — лише в карток (не в плашок усередині й не в панелей).
    final plainCard = !inner && !solid && w.fill == null && w.color == null && w.borderColor == null;
    final rim = plainCard ? tokens.rim : null;
    final glow = plainCard ? tokens.innerGlow : null;
    if ((w.specular && !solid) || tokens.outline != null || rim != null || glow != null) {
      body = CustomPaint(
        foregroundPainter: ArcticSpecularBorderPainter(
          rim: rim,
          glow: glow,
          borderRadius: shape,
          specular: w.specular && !solid ? tokens.specular.withValues(alpha: (tokens.specular.a * (pressed ? 1.25 : 1)).clamp(0, 1)) : null,
          outline: inner ? null : tokens.outline,
        ),
        child: body,
      );
    }
    if (t < 1) body = Opacity(opacity: t.clamp(0, 1), child: body);
    if (w.enableBlur && !solid && t > 0) {
      final sigma = (inner ? AppBlur.control : w.blur) * t;
      body = ClipRRect(borderRadius: shape, child: BackdropFilter(filter: arcticGlassFilter(sigma), child: body));
    }
    final shadows = inner ? const <BoxShadow>[] : (w.glowing ? [...?w.shadows, ...iceGlow(strength: 0.6)] : (w.shadows ?? tokens.shadows));
    if (shadows.isNotEmpty && t > 0) {
      body = CustomPaint(painter: _OuterShadowPainter(shape, shadows, t), child: body);
    }
    return body;
  }
}

/// Тінь лише ЗОВНІ скла: під напівпрозорою карткою вона не просвічує й не бруднить розмиття.
class _OuterShadowPainter extends CustomPainter {
  _OuterShadowPainter(this.shape, this.shadows, this.t);
  final BorderRadius shape;
  final List<BoxShadow> shadows;
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = shape.toRRect(Offset.zero & size);
    final hole = Path()..addRRect(rrect);
    final area = Path()..addRect((Offset.zero & size).inflate(80));
    canvas.save();
    canvas.clipPath(Path.combine(PathOperation.difference, area, hole));
    for (final s in shadows) {
      final shadow = t < 1 ? s.copyWith(color: s.color.withValues(alpha: s.color.a * t)) : s;
      canvas.drawRRect(rrect.shift(shadow.offset).inflate(shadow.spreadRadius), shadow.toPaint());
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_OuterShadowPainter old) => old.shape != shape || old.shadows != shadows || old.t != t;
}

/// Дзеркальний блік 1px по верхній грані (прозорий → [specular] → прозорий) і, у світлій темі,
/// найтонший зовнішній контур 0.5px, щоб край картки читався на світлому тлі.
class ArcticSpecularBorderPainter extends CustomPainter {
  const ArcticSpecularBorderPainter({required this.borderRadius, this.specular, this.outline, this.rim, this.glow});
  final BorderRadius borderRadius;
  final Color? specular;
  final Color? outline;
  final Color? rim;
  final Color? glow;

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = borderRadius.toRRect(Offset.zero & size);
    if (glow case final g?) {
      // Внутрішнє світіння: розмита світла смуга вздовж країв, обрізана формою скла.
      canvas.save();
      canvas.clipRRect(rrect);
      canvas.drawRRect(
        rrect,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 10
          ..color = g
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8),
      );
      canvas.restore();
    }
    if (rim case final r?) {
      // Кант-блік 1px: яскравіший угорі ліворуч, тьмяніший унизу праворуч.
      canvas.drawRRect(
        rrect.deflate(0.5),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..shader = LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [r, r.withValues(alpha: r.a * 0.35), r.withValues(alpha: r.a * 0.6)],
            stops: const [0, 0.55, 1],
          ).createShader(Offset.zero & size),
      );
    }
    if (outline case final o?) {
      canvas.drawRRect(
        rrect.deflate(0.25),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.5
          ..color = o,
      );
    }
    if (specular case final s?) {
      final left = borderRadius.topLeft.x * 0.6;
      final right = size.width - borderRadius.topRight.x * 0.6;
      if (right <= left) return;
      final line = Rect.fromLTWH(left, 0, right - left, 1);
      canvas.drawRect(line, Paint()..shader = LinearGradient(colors: [s.withValues(alpha: 0), s, s.withValues(alpha: 0)]).createShader(line));
    }
  }

  @override
  bool shouldRepaint(ArcticSpecularBorderPainter old) => old.borderRadius != borderRadius || old.specular != specular || old.outline != outline || old.rim != rim || old.glow != glow;
}
