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

/// Матриця насичення [sat] і яскравості [bright] (як CSS saturate() brightness()).
ColorFilter _frost(double sat, double bright) {
  const r = 0.2126, g = 0.7152, b = 0.0722;
  final i = 1 - sat;
  List<double> row(double rr, double gg, double bb) => [rr * bright, gg * bright, bb * bright, 0, 0];
  return ColorFilter.matrix(<double>[
    ...row(r * i + sat, g * i, b * i),
    ...row(r * i, g * i + sat, b * i),
    ...row(r * i, g * i, b * i + sat),
    0, 0, 0, 1, 0,
  ]);
}

// Silk Glass: насичення ×1.9 — крізь гладке скло видно кольори тла, без сірості.
final _silkFrost = _frost(1.9, 1.04);

/// Фільтр скла: насичення, потім велике розмиття (mirror — без темних ореолів на краях).
/// Картки й панелі — blur 42 saturate 190%, кнопки — 24; дрібного розмиття немає, тож текст під склом не «рябить».
ImageFilter arcticGlassFilter(double sigma) => ImageFilter.compose(
  outer: ImageFilter.blur(sigmaX: sigma, sigmaY: sigma, tileMode: TileMode.mirror),
  inner: _silkFrost,
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
    final plainInner = nested && w.fill == null && w.color == null;
    // Плитки в картці — заокруглення 18 (концентрично до картки 26), якщо радіус не задано явно.
    final shape = w.borderRadius ?? BorderRadius.circular(plainInner && w.radius == AppRadii.card ? AppRadii.tile : w.radius);
    final still = MediaQuery.disableAnimationsOf(context);
    final plain = w.fill == null && w.color == null;
    final inner = nested && plain;

    final Gradient? gradient = w.color != null || inner ? null : (w.fill ?? (pressed ? tokens.pressedFill : tokens.glassFill));
    final Color? color = inner ? (pressed ? tokens.innerFill.withValues(alpha: (tokens.innerFill.a * 1.6).clamp(0, 1)) : tokens.innerFill) : w.color;
    // Явна грань (borderColor) чи сяйво фокусу; інакше — матова фаска теми (ArcticMatteEdgePainter нижче).
    final edge = w.glowing ? AppColors.accentCyan.withValues(alpha: 0.55) : w.borderColor;

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
    // Матовий акрил: фаска 1px (верх яскравіший, боки тихші, низ ледь видно) і внутрішнє світло
    // вздовж верхньої грані; від дотику верхня грань трохи світлішає. Вкладені плашки — без фаски.
    if (!inner && tokens.outline != null) {
      body = CustomPaint(foregroundPainter: ArcticSpecularBorderPainter(borderRadius: shape, outline: tokens.outline), child: body);
    }
    if (!inner && edge == null && tokens.border.a > 0) {
      body = CustomPaint(
        foregroundPainter: ArcticMatteEdgePainter(
          borderRadius: shape,
          edge: tokens.border,
          inset: w.specular ? tokens.specular : null,
          pressed: pressed,
        ),
        child: body,
      );
    }
    if (t < 1) body = Opacity(opacity: t.clamp(0, 1), child: body);
    if (w.enableBlur && t > 0 && (inner ? AppBlur.control : w.blur) > 0) {
      final sigma = (inner ? AppBlur.control : w.blur) * t;
      // Картки екрана ділять одне тло (BackdropGroup у ScreenScroll) — розмиття читає його один раз.
      body = ClipRRect(borderRadius: shape, child: BackdropFilter.grouped(filter: arcticGlassFilter(sigma), child: body));
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

/// Кришталева грань і внутрішній іній «Frosted Ice Glass»:
/// грань 1px [edge] (верх ×2, ліво ×1.4 — як border-top/left-color), внутрішній блік угорі [inset]
/// (inset 0 1px 1px) і м'яке світіння інею всередині по периметру (inset 0 0 24px / 5%).
class ArcticMatteEdgePainter extends CustomPainter {
  const ArcticMatteEdgePainter({required this.borderRadius, required this.edge, this.inset, this.pressed = false});
  final BorderRadius borderRadius;
  final Color edge;
  final Color? inset;
  final bool pressed;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final rect = Offset.zero & size;
    final outer = borderRadius.toRRect(rect);
    final rrect = outer.deflate(0.5);
    final boost = pressed ? 1.25 : 1.0;
    Color a(double k) => edge.withValues(alpha: (edge.a * k * boost).clamp(0, 1));
    final corner = (borderRadius.topLeft.y + 8).clamp(0.0, size.shortestSide / 2);
    canvas.save();
    canvas.clipRRect(outer);
    // Іній: світла смуга вздовж країв усередині, розмита до 24px.
    canvas.drawRRect(
      outer,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 24
        ..color = Color.fromRGBO(255, 255, 255, edge.computeLuminance() > 0.5 && edge.a > 0.5 ? 0.0 : 0.05)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 10),
    );
    // Внутрішній блік під верхньою гранню (inset 0 1px 1px).
    if (inset case final c?) {
      canvas.drawRRect(
        outer.shift(const Offset(0, 1)),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 0.6)
          ..shader = LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [c.withValues(alpha: (c.a * boost).clamp(0, 1)), c.withValues(alpha: 0)], stops: [0, corner / size.height]).createShader(rect),
      );
    }
    canvas.restore();
    // Базова грань .16 по всьому периметру.
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    canvas.drawRRect(rrect, stroke..color = a(1));
    // Верх яскравіший (≈ .32), ліво — ≈ .22: доливаємо світло градієнтами від цих країв.
    canvas.drawRRect(
      rrect,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..shader = LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [a(1), a(1).withValues(alpha: 0)], stops: [0, corner / size.height]).createShader(rect),
    );
    canvas.drawRRect(
      rrect,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..shader = LinearGradient(colors: [a(0.4), a(0.4).withValues(alpha: 0)], stops: [0, corner / size.width]).createShader(rect),
    );
  }

  @override
  bool shouldRepaint(ArcticMatteEdgePainter old) => old.borderRadius != borderRadius || old.edge != edge || old.inset != inset || old.pressed != pressed;
}

/// Дзеркальний блік 1px по верхній грані (прозорий → [specular] → прозорий) і, у світлій темі,
/// найтонший зовнішній контур 0.5px, щоб край картки читався на світлому тлі.
class ArcticSpecularBorderPainter extends CustomPainter {
  const ArcticSpecularBorderPainter({required this.borderRadius, this.specular, this.outline});
  final BorderRadius borderRadius;
  final Color? specular;
  final Color? outline;

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = borderRadius.toRRect(Offset.zero & size);
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
  bool shouldRepaint(ArcticSpecularBorderPainter old) => old.borderRadius != borderRadius || old.specular != specular || old.outline != outline;
}
