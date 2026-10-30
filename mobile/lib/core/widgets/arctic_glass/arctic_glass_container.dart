import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import '../../../theme.dart' show palette, ink;
import '../../theme/arctic_glass_theme.dart';

/// Базова поверхня «Spatial Glass»: діагональне скло, рамка-волосинка й верхній блік.
/// Розмиття (BackdropFilter) — лише для нерухомих елементів (шапка, док, шторки):
/// в елементах списків `enableBlur` лишається вимкненим, щоб прокрутка не гальмувала.
class ArcticGlassContainer extends StatelessWidget {
  const ArcticGlassContainer({
    required this.child,
    this.radius = AppRadii.card,
    this.padding,
    this.margin,
    this.width,
    this.height,
    this.enableBlur = false,
    this.blur = AppBlur.fixed,
    this.fill,
    this.color,
    this.borderColor,
    this.specular = true,
    this.shadows,
    this.onTap,
    this.borderRadius,
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
  final bool enableBlur;
  final double blur;

  /// Своя заливка замість діагонального скла (напр. glassTier3 для шторок).
  final Gradient? fill;
  final Color? color;
  final Color? borderColor;
  final bool specular;
  final List<BoxShadow>? shadows;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final light = palette.isLight;
    final shape = borderRadius ?? BorderRadius.circular(radius);
    final surface = Ink(
      width: width,
      height: height,
      padding: padding,
      decoration: BoxDecoration(borderRadius: shape, color: fill == null ? color : null, gradient: color != null ? null : (fill ?? (light ? _lightFill : AppColors.glassFill))),
      child: child,
    );
    Widget body = Stack(
      fit: StackFit.passthrough,
      children: [
        Material(
          type: MaterialType.transparency,
          child: onTap == null ? surface : InkWell(onTap: onTap, borderRadius: shape, splashColor: AppColors.accentCyan.withValues(alpha: 0.10), child: surface),
        ),
        // Рамка-волосинка поверх, щоб не зсувала вміст.
        Positioned.fill(
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: shape,
                border: Border.all(color: borderColor ?? (light ? ink.withValues(alpha: 0.08) : AppColors.borderHairline)),
              ),
            ),
          ),
        ),
        // Верхній дзеркальний блік: світло падає згори, до країв згасає.
        if (specular)
          Positioned(
            top: 0,
            left: shape.topLeft.x * 0.6,
            right: shape.topRight.x * 0.6,
            height: 1,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: [Colors.white.withValues(alpha: 0), light ? Colors.white.withValues(alpha: 0.95) : AppColors.borderSpecularTop, Colors.white.withValues(alpha: 0)]),
                ),
              ),
            ),
          ),
      ],
    );
    body = ClipRRect(
      borderRadius: shape,
      child: enableBlur
          ? BackdropFilter(
              filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
              child: body,
            )
          : body,
    );
    if (shadows != null) {
      body = DecoratedBox(
        decoration: BoxDecoration(borderRadius: shape, boxShadow: shadows),
        child: body,
      );
    }
    return margin == null ? body : Padding(padding: margin!, child: body);
  }
}

/// Світла тема («Крижана Арктика»): те саме скло, але молочне, щоб читалося на світлому тлі.
const _lightFill = LinearGradient(colors: [Color.fromRGBO(255, 255, 255, 0.86), Color.fromRGBO(255, 255, 255, 0.62)], begin: Alignment.topLeft, end: Alignment.bottomRight);
