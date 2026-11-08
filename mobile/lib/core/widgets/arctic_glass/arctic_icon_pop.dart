import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Мікровзаємодія іконки Lucide: коли стан вмикається ([active] → true) або змінюється [trigger]
/// (нове сповіщення, плей/пауза), іконка «прорисовується» — проявляється круговим штрихом від
/// верхньої точки за годинниковою стрілкою (як анімація контуру) — і коротко пружно клацає.
/// Із «Зменшити рух» (disableAnimations) — просто стоїть.
class ArcticIconPop extends StatefulWidget {
  const ArcticIconPop({required this.child, this.active = false, this.trigger, super.key});
  final bool active;
  final Object? trigger;
  final Widget child;

  @override
  State<ArcticIconPop> createState() => _ArcticIconPopState();
}

class _ArcticIconPopState extends State<ArcticIconPop> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 360), value: 1);

  @override
  void didUpdateWidget(ArcticIconPop old) {
    super.didUpdateWidget(old);
    final turnedOn = widget.active && !old.active;
    final changed = widget.trigger != null && widget.trigger != old.trigger;
    if ((turnedOn || changed) && !MediaQuery.disableAnimationsOf(context)) _c.forward(from: 0);
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
        if (t >= 1) return child!;
        // Прорисовка: кругова маска відкриває іконку за 0–70% часу.
        final draw = Curves.easeOutCubic.transform((t / 0.7).clamp(0.0, 1.0));
        // Клац: 0 → 0.3 стиск до 0.86, далі пружний вихід до 1.
        final scale = t < 0.3 ? 1 - 0.14 * (t / 0.3) : 0.86 + 0.14 * Curves.easeOutBack.transform((t - 0.3) / 0.7);
        final tilt = (1 - t) * -0.1 * math.sin(t * math.pi);
        return Transform.rotate(
          angle: tilt,
          child: Transform.scale(
            scale: scale,
            child: ShaderMask(
              blendMode: BlendMode.dstIn,
              shaderCallback: (rect) => SweepGradient(
                // Від верхньої точки (12 годин) за годинниковою стрілкою.
                transform: const GradientRotation(-math.pi / 2),
                colors: const [Colors.white, Colors.white, Colors.transparent, Colors.transparent],
                stops: [0, draw, (draw + 0.001).clamp(0.0, 1.0), 1],
              ).createShader(rect),
              child: child,
            ),
          ),
        );
      },
      child: widget.child,
    );
  }
}
