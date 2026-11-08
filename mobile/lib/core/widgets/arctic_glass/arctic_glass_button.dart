import 'package:flutter/material.dart';

import '../../../theme.dart' show ink, body;
import '../../theme/arctic_glass_theme.dart';
import 'arctic_glass_container.dart';
import 'arctic_pressable.dart';

enum ArcticButtonKind { primary, glass, danger }

/// Кнопка «Silk Glass» — капсула. primary — скляний сапфір (ArcticGlassPill), glass — гладке скло,
/// danger — скляна червона. Вимкнений стан — приглушені кольори, а не Opacity поверх скла.
class ArcticGlassButton extends StatelessWidget {
  const ArcticGlassButton({
    required this.label,
    required this.onPressed,
    this.icon,
    this.kind = ArcticButtonKind.primary,
    this.expand = true,
    this.compact = false,
    this.busy = false,
    this.color,
    this.iconColor,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final ArcticButtonKind kind;
  final bool expand;
  final bool compact;
  final bool busy;

  /// Колір підпису скляної кнопки.
  final Color? color;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !busy;
    final height = kind == ArcticButtonKind.glass ? (compact ? 40.0 : 48.0) : (compact ? 40.0 : 50.0);
    final solid = kind != ArcticButtonKind.glass;
    final dim = enabled ? 1.0 : 0.45;
    final textColor = solid ? Colors.white.withValues(alpha: enabled ? 1 : 0.6) : (color ?? ink).withValues(alpha: dim);
    final content = Row(
      mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (busy)
          SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: textColor))
        else if (icon != null)
          Icon(icon, color: solid ? textColor : (iconColor ?? textColor), size: compact ? 16 : 18),
        if (busy || icon != null) const SizedBox(width: 8),
        // Довгий підпис чи великий системний шрифт — текст трохи зменшується, а не обрізається «…».
        Flexible(
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              label,
              maxLines: 1,
              style: body(compact ? 13.5 : 15, color: textColor, weight: FontWeight.w600),
            ),
          ),
        ),
      ],
    );
    final padding = EdgeInsets.symmetric(horizontal: compact ? 12 : 16);
    if (!solid) {
      return ArcticGlassContainer(radius: height / 2, blur: AppBlur.control, height: height, padding: padding, onTap: enabled ? onPressed : null, child: content);
    }
    return ArcticGlassPill(
      height: height,
      padding: padding,
      onTap: enabled ? onPressed : null,
      tint: kind == ArcticButtonKind.danger ? ArcticPillTint.danger : ArcticPillTint.sapphire,
      dim: dim,
      child: content,
    );
  }
}

enum ArcticPillTint { sapphire, danger }

/// Гладка скляна капсула головних кнопок («Пост», «Продовжити», «Я готовий грати»):
/// напівпрозорий сапфір 135° (.45 → .35) поверх розмиття 24 — без обводки й світіння.
class ArcticGlassPill extends StatelessWidget {
  const ArcticGlassPill({required this.child, this.height = 50, this.padding, this.onTap, this.tint = ArcticPillTint.sapphire, this.dim = 1, super.key});

  final Widget child;
  final double height;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final ArcticPillTint tint;

  /// Вимкнена кнопка — приглушена заливка.
  final double dim;

  static const _danger = Color(0xFFFF4D6D);

  @override
  Widget build(BuildContext context) {
    final colors = tint == ArcticPillTint.danger
        ? [_danger.withValues(alpha: 0.55 * dim), _danger.withValues(alpha: 0.42 * dim)]
        : [Color.fromRGBO(14, 165, 233, 0.45 * dim), Color.fromRGBO(37, 99, 235, 0.35 * dim)];
    final shape = BorderRadius.circular(height / 2);
    return ArcticPressable(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: shape,
        child: BackdropFilter(
          filter: arcticGlassFilter(AppBlur.button),
          child: Container(
            height: height,
            padding: padding,
            decoration: BoxDecoration(
              borderRadius: shape,
              gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: colors),
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}
