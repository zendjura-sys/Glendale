import 'dart:io' show Platform;
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/arctic_glass_theme.dart';

/// Тло всіх екранів: колір теми і великі плями світла, розмиті на 120 — переходи гладкі, як у
/// розфокусі камери, без сходинок градієнта. Малюється один раз окремим шаром (RepaintBoundary):
/// під час прокрутки тло не перемальовується й не мерехтить.
class ArcticBackground extends StatelessWidget {
  const ArcticBackground({required this.child, super.key});
  final Widget child;

  /// Лишилося для сумісності з тестами: тло більше не анімується.
  static bool breathing = !Platform.environment.containsKey('FLUTTER_TEST');

  @override
  Widget build(BuildContext context) {
    final tokens = ArcticGlassThemeExtension.of(context);
    return Stack(
      children: [
        Positioned.fill(
          child: RepaintBoundary(child: CustomPaint(painter: _GlowPainter(tokens), isComplex: true)),
        ),
        child,
      ],
    );
  }
}

class _GlowPainter extends CustomPainter {
  _GlowPainter(this.tokens);
  final ArcticGlassThemeExtension tokens;

  /// Розмиття плям (як CSS blur(120px)).
  static const _blur = 120.0;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.drawRect(rect, Paint()..shader = LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: tokens.background).createShader(rect));
    for (final glow in tokens.glows) {
      // Пляма — суцільне коло (діаметр щонайменше 320) під гаусовим розмиттям: жодних різких кілець.
      final radius = math.max(160.0, glow.radius * size.longestSide * 0.42);
      canvas.drawCircle(
        glow.center.alongSize(size),
        radius,
        Paint()
          ..color = glow.color.withValues(alpha: (glow.alpha * 1.25).clamp(0, 1))
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, _blur),
      );
    }
  }

  @override
  bool shouldRepaint(_GlowPainter old) => old.tokens != tokens;
}
