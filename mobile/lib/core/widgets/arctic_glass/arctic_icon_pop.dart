import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Мікровзаємодія іконки Lucide: коли стан вмикається ([active] → true), іконка коротко «клацає» —
/// стискається, пружно перебільшує розмір і злегка доводить нахил (240 мс, без «желе»).
/// Із «Зменшити рух» (disableAnimations) — просто стоїть.
class ArcticIconPop extends StatefulWidget {
  const ArcticIconPop({required this.active, required this.child, super.key});
  final bool active;
  final Widget child;

  @override
  State<ArcticIconPop> createState() => _ArcticIconPopState();
}

class _ArcticIconPopState extends State<ArcticIconPop> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 240), value: 1);

  @override
  void didUpdateWidget(ArcticIconPop old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active && !MediaQuery.disableAnimationsOf(context)) _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        final t = _c.value;
        // 0 → 0.35: стиск до 0.84; далі пружний вихід через 1.08 до 1.
        final scale = t < 0.35 ? 1 - 0.16 * (t / 0.35) : 0.84 + 0.16 * Curves.easeOutBack.transform((t - 0.35) / 0.65);
        final tilt = (1 - t) * -0.12 * math.sin(t * math.pi);
        return Transform.rotate(angle: tilt, child: Transform.scale(scale: scale, child: child));
      },
      child: widget.child,
    );
  }
}
