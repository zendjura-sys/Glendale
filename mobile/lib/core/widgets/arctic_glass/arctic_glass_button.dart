import 'package:flutter/material.dart';

import '../../../theme.dart' show palette, ink, body;
import '../../theme/arctic_glass_theme.dart';
import 'arctic_glass_container.dart';

enum ArcticButtonKind { primary, glass, danger }

/// Кнопка «Spatial Glass» (радіус 14). primary — сапфіровий градієнт, glass — скло з рамкою,
/// danger — червона. Вимкнений стан — приглушені кольори, а не Opacity поверх скла.
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

  static const _danger = Color(0xFFFF4D6D);

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
      return ArcticGlassContainer(radius: AppRadii.control, height: height, padding: padding, onTap: enabled ? onPressed : null, child: content);
    }
    final gradient = kind == ArcticButtonKind.danger
        ? LinearGradient(
            colors: [
              _danger.withValues(alpha: dim),
              _danger.withValues(alpha: dim),
            ],
          )
        : LinearGradient(
            colors: [
              AppColors.accentPrimary.withValues(alpha: dim),
              (palette.isLight ? const Color(0xFF00A8E0) : AppColors.accentCyan).withValues(alpha: dim),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          );
    final glow = kind == ArcticButtonKind.danger ? _danger : AppColors.accentPrimary;
    final shape = BorderRadius.circular(AppRadii.control);
    return Material(
      type: MaterialType.transparency,
      child: InkWell(
        onTap: enabled ? onPressed : null,
        borderRadius: shape,
        child: Ink(
          height: height,
          padding: padding,
          decoration: BoxDecoration(
            gradient: gradient,
            borderRadius: shape,
            border: Border(
              top: BorderSide(color: Colors.white.withValues(alpha: enabled ? 0.28 : 0.1)),
            ),
            boxShadow: enabled ? [BoxShadow(color: glow.withValues(alpha: 0.45), blurRadius: 22, offset: const Offset(0, 8), spreadRadius: -10)] : const [],
          ),
          child: content,
        ),
      ),
    );
  }
}
