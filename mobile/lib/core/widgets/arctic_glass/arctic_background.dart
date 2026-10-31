import 'dart:io' show Platform;
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/arctic_glass_theme.dart';

/// Тло всіх екранів: градієнт теми і три плями світла, що повільно «дихають» (цикл 12 с).
/// Малюється окремим шаром (RepaintBoundary), тож дихання не перебудовує вміст екрана.
class ArcticBackground extends StatefulWidget {
  const ArcticBackground({required this.child, super.key});
  final Widget child;

  /// У тестах тло не дихає: нескінченна анімація не дала б екранам «заспокоїтися».
  static bool breathing = !Platform.environment.containsKey('FLUTTER_TEST');

  @override
  State<ArcticBackground> createState() => _ArcticBackgroundState();
}

class _ArcticBackgroundState extends State<ArcticBackground> with SingleTickerProviderStateMixin {
  late final AnimationController _breath = AnimationController(vsync: this, duration: const Duration(seconds: 12));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final still = MediaQuery.disableAnimationsOf(context) || !ArcticBackground.breathing;
    if (still) {
      _breath.stop();
    } else if (!_breath.isAnimating) {
      _breath.repeat();
    }
  }

  @override
  void dispose() {
    _breath.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = ArcticGlassThemeExtension.of(context);
    return Stack(
      children: [
        Positioned.fill(
          child: RepaintBoundary(child: CustomPaint(painter: _GlowPainter(tokens, _breath))),
        ),
        // Спільне розмиття для всіх скляних карток екрана: фон зчитується один раз.
        BackdropGroup(child: widget.child),
      ],
    );
  }
}

class _GlowPainter extends CustomPainter {
  _GlowPainter(this.tokens, this.breath) : super(repaint: breath);
  final ArcticGlassThemeExtension tokens;
  final Animation<double> breath;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.drawRect(rect, Paint()..shader = LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: tokens.background).createShader(rect));
    final t = breath.value * 2 * math.pi;
    for (var i = 0; i < tokens.glows.length; i++) {
      final glow = tokens.glows[i];
      // Кожна пляма дихає зі своєю фазою: трохи пливе й міняє яскравість.
      final phase = t + i * 2.1;
      final center = glow.center + Alignment(math.sin(phase) * 0.06, math.cos(phase) * 0.05);
      final alpha = glow.alpha * (0.82 + 0.18 * math.sin(phase));
      final shortest = size.shortestSide;
      final paint = Paint()
        ..shader = RadialGradient(
          center: center,
          radius: glow.radius * (size.longestSide / shortest) * 0.75,
          colors: [
            glow.color.withValues(alpha: alpha),
            glow.color.withValues(alpha: 0),
          ],
        ).createShader(rect);
      canvas.drawRect(rect, paint);
    }
  }

  @override
  bool shouldRepaint(_GlowPainter old) => old.tokens != tokens;
}
