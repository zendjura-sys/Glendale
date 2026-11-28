import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Тактильна обгортка: від дотику елемент м'яко стискається до 0.98 (150 мс), дає легкий
/// тактильний відгук і плавно повертається (220 мс). [pressed] — для підсвітки грані.
class ArcticPressable extends StatefulWidget {
  const ArcticPressable({required this.child, this.onTap, this.onLongPress, this.scale = 0.98, this.haptic = true, this.onPressed, super.key});
  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double scale;
  final bool haptic;

  /// Зміна стану натискання (напр. підсвітити блік картки).
  final ValueChanged<bool>? onPressed;

  @override
  State<ArcticPressable> createState() => _ArcticPressableState();
}

class _ArcticPressableState extends State<ArcticPressable> {
  bool down = false;

  void _set(bool value) {
    if (value == down) return;
    setState(() => down = value);
    widget.onPressed?.call(value);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null || widget.onLongPress != null;
    final still = MediaQuery.disableAnimationsOf(context);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: enabled
          ? (_) {
              _set(true);
              if (widget.haptic) HapticFeedback.lightImpact();
            }
          : null,
      onTapUp: enabled ? (_) => _set(false) : null,
      onTapCancel: enabled ? () => _set(false) : null,
      onTap: widget.onTap,
      onLongPress: widget.onLongPress,
      child: AnimatedScale(
        scale: down && !still ? widget.scale : 1,
        // Lucian UX: 150 мс на стиск, 220 мс на повернення, cubic-bezier(0.22, 1, 0.36, 1) — без «желе».
        duration: Duration(milliseconds: down ? 150 : 220),
        curve: const Cubic(0.22, 1, 0.36, 1),
        child: widget.child,
      ),
    );
  }
}
