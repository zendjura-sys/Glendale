// «Що нового» — картками з прокруткою. Знімок — GC_SHOTS=dir.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/account.dart';
import 'package:gamecon/theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fonts.dart';

void main() {
  final out = Platform.environment['GC_SHOTS'];

  setUpAll(() async {
    if (out == null) return;
    await loadTestFonts();
  });

  testWidgets('«Що нового» прокручується й показує нове окремо', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final key = GlobalKey();
    await tester.pumpWidget(RepaintBoundary(
      key: key,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: gameConTheme(),
        home: Builder(builder: (context) => Scaffold(body: Center(child: TextButton(onPressed: () => showWhatsNew(context, prefs), child: const Text('open'))))),
      ),
    ));
    await tester.tap(find.text('open'));
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(find.text('Нове в цій версії'), findsOneWidget);
    expect(find.byType(ListView), findsOneWidget);
    if (out != null) {
      await tester.runAsync(() async {
        final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
        final image = await boundary.toImage(pixelRatio: 1);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        File('$out/whats-new.png').writeAsBytesSync(bytes!.buffer.asUint8List());
      });
    }
    // Список прокручується до історії попередніх версій.
    await tester.scrollUntilVisible(find.text('Раніше'), 200, scrollable: find.descendant(of: find.byType(ListView), matching: find.byType(Scrollable)));
    expect(find.text('Раніше'), findsOneWidget);
  });
}
