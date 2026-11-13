// Матеріал Liquid Glass «Medium» на трьох тлах (біле, синє, «фото») — для звірки з еталоном. Знімки — GC_SHOTS=dir.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/core/widgets/arctic_glass/arctic_glass.dart';
import 'package:gamecon/theme.dart';

import 'support/fonts.dart';

void main() {
  for (final light in [false, true]) {
    testWidgets('liquid glass medium: ${light ? 'light' : 'dark'}', (tester) async {
      await loadTestFonts();
      palette = light ? arcticPalette : neonPalette;
      tester.view.physicalSize = const Size(1200, 900);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      final key = GlobalKey();
      await tester.pumpWidget(MaterialApp(
        theme: gameConTheme(),
        home: RepaintBoundary(
          key: key,
          child: Stack(children: [
            Positioned.fill(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const Expanded(child: ColoredBox(color: Colors.white)),
              const Expanded(child: ColoredBox(color: Color(0xFF0A84FF))),
              // «Фото»: теплі плями, як вулиця на еталоні.
              Expanded(
                child: DecoratedBox(
                  decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFB8A48A), Color(0xFF6B5B45), Color(0xFFE0A050), Color(0xFF8A4A2A)])),
                  child: Stack(children: [
                    for (final (x, y, c) in [(30.0, 200.0, Color(0xFFD9692E)), (120.0, 420.0, Color(0xFFF2C14E)), (60.0, 600.0, Color(0xFF3C2A1E))])
                      Positioned(left: x, top: y, child: Container(width: 90, height: 90, decoration: BoxDecoration(color: c, shape: BoxShape.circle))),
                  ]),
                ),
              ),
            ])),
            Padding(
              padding: const EdgeInsets.fromLTRB(40, 60, 40, 40),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                for (final h in [130.0, 130.0]) ...[
                  ArcticGlassContainer(height: h, radius: 28, child: const SizedBox.expand()),
                  const SizedBox(height: 40),
                ],
              ]),
            ),
          ]),
        ),
      ));
      await tester.pumpAndSettle();
      final out = Platform.environment['GC_SHOTS'];
      if (out == null) return;
      await tester.runAsync(() async {
        final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
        final image = await boundary.toImage(pixelRatio: 1);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        File('$out/liquid-glass-${light ? 'light' : 'dark'}.png').writeAsBytesSync(bytes!.buffer.asUint8List());
      });
    });
  }
}
