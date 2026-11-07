import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Тактильна обгортка: від дотику елемент м'яко стискається до 0.97 (120 мс), дає легкий
/// тактильний відгук і пружно повертається (easeOutBack). [pressed] — для підсвітки грані.
class ArcticPressable extends StatefulWidget {
  const ArcticPressable({required this.child, this.onTap, this.onLongPress, this.scale = 0.97, this.haptic = true, this.onPressed, super.key});
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
        duration: Duration(milliseconds: down ? 120 : 260),
        curve: down ? Curves.easeOutCubic : Curves.easeOutBack,
        child: widget.child,
      ),
    );
  }
}
