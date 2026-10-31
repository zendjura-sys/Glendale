import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import '../../theme/arctic_glass_theme.dart';
import 'arctic_pressable.dart';

/// Базова поверхня «Arctic Glass», як на сайті: матове скло — холодна напівпрозора заливка
/// з розмиттям фону й насиченням, без обводки й тіней. Картка в картці — легка внутрішня
/// плашка без розмиття (вкладене розмиття дороге й «мутне»). Розмиття карток спільне на екран
/// (BackdropGroup у ArcticBackground), тож прокрутка лишається плавною.
/// З [onTap] картка пружно стискається від дотику (ArcticPressable), а лід світлішає.
class ArcticGlassContainer extends StatefulWidget {
  const ArcticGlassContainer({
    required this.child,
    this.radius = AppRadii.card,
    this.padding,
    this.margin,
    this.width,
    this.height,
    this.enableBlur = false,
    this.blur = AppBlur.card,
    this.fill,
    this.color,
    this.borderColor,
    this.specular = false,
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

  /// Матове розмиття фону під склом.
  final bool enableBlur;
  final double blur;

  /// Своя заливка замість скла теми (напр. щільніше скло панелей).
  final Gradient? fill;
  final Color? color;

  /// Обводка — лише якщо задана явно (за замовчуванням її немає).
  final Color? borderColor;

  /// Тонкий блік угорі (за замовчуванням вимкнений).
  final bool specular;

  /// Тінь — лише якщо задана явно (за замовчуванням її немає).
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

/// Насичення під склом (saturate 170%, як на сайті).
const _saturate = ColorFilter.matrix([
  1.5003, -0.4573, -0.0430, 0, 0, //
  -0.1497, 1.1427, 0.0070, 0, 0, //
  -0.1497, -0.4573, 1.6070, 0, 0, //
  0, 0, 0, 1, 0,
]);

class _ArcticGlassContainerState extends State<ArcticGlassContainer> {
  bool pressed = false;

  @override
  Widget build(BuildContext context) {
    final tokens = ArcticGlassThemeExtension.of(context);
    final w = widget;
    final shape = w.borderRadius ?? BorderRadius.circular(w.radius);
    final still = MediaQuery.disableAnimationsOf(context);
    final nested = context.getInheritedWidgetOfExactType<_InsideGlass>() != null;
    // Вкладена картка теми — плашка без розмиття; панелі й шторки (свій fill/color) — як задано.
    final plain = w.fill == null && w.color == null;
    final inner = nested && plain;
    final blur = w.enableBlur && !inner;

    final Gradient? gradient = w.color != null || inner ? null : (w.fill ?? (pressed ? tokens.pressedFill : tokens.glassFill));
    final Color? color = inner ? (pressed ? tokens.innerFill.withValues(alpha: tokens.innerFill.a * 1.8) : tokens.innerFill) : w.color;

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
        border: w.glowing
            ? Border.all(color: AppColors.accentCyan.withValues(alpha: 0.45), width: 1.2)
            : (w.borderColor == null ? null : Border.all(color: w.borderColor!)),
      ),
      child: _InsideGlass(child: w.child),
    );
    if (w.specular) {
      body = Stack(fit: StackFit.passthrough, children: [
        body,
        Positioned(
          top: 0,
          left: shape.topLeft.x * 0.5,
          right: shape.topRight.x * 0.5,
          height: 1,
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: [tokens.specular.withValues(alpha: 0), tokens.specular, tokens.specular.withValues(alpha: 0)]),
              ),
            ),
          ),
        ),
      ]);
    }
    if (blur) {
      final filter = ImageFilter.compose(outer: _saturate, inner: ImageFilter.blur(sigmaX: w.blur, sigmaY: w.blur));
      // Картки списку ділять один знімок фону (BackdropGroup); панелі й шторки (свій fill/color)
      // мають бачити картки, що пропливають під ними, — їм окреме розмиття.
      body = ClipRRect(borderRadius: shape, child: plain ? BackdropFilter.grouped(filter: filter, child: body) : BackdropFilter(filter: filter, child: body));
    }
    if (w.shadows case final shadows? when shadows.isNotEmpty) {
      body = DecoratedBox(decoration: BoxDecoration(borderRadius: shape, boxShadow: shadows), child: body);
    }
    if (w.onTap != null || w.onLongPress != null) {
      body = ArcticPressable(onTap: w.onTap, onLongPress: w.onLongPress, onPressed: (v) => setState(() => pressed = v), child: body);
    }
    return w.margin == null ? body : Padding(padding: w.margin!, child: body);
  }
}
