import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// Мікрошум матового скла (як SVG feTurbulence з opacity 0.015): плитка 96×96
/// випадкових світлих і темних точок, згенерована один раз і повторена по поверхні.
class ArcticNoisePainter extends CustomPainter {
  const ArcticNoisePainter(this.shape);
  final BorderRadius shape;

  static ui.Image? _tile;

  static ui.Image get tile => _tile ??= _build();

  static ui.Image _build() {
    const size = 96;
    final random = math.Random(7);
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    // Прозорість закладено в саму плитку: кожен піксель світліший чи темніший рівно на 1.5% (як opacity 0.015).
    final light = Paint()..color = const Color.fromRGBO(255, 255, 255, 0.015);
    final dark = Paint()..color = const Color.fromRGBO(0, 0, 0, 0.015);
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        final v = random.nextDouble();
        if (v < 0.5) canvas.drawRect(Rect.fromLTWH(x.toDouble(), y.toDouble(), 1, 1), light);
        if (v >= 0.5) canvas.drawRect(Rect.fromLTWH(x.toDouble(), y.toDouble(), 1, 1), dark);
      }
    }
    return recorder.endRecording().toImageSync(size, size);
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final rect = Offset.zero & size;
    canvas.save();
    canvas.clipRRect(shape.toRRect(rect));
    canvas.drawRect(
      rect,
      Paint()
        ..shader = ImageShader(tile, TileMode.repeated, TileMode.repeated, Matrix4.identity().storage),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(ArcticNoisePainter old) => old.shape != shape;
}
