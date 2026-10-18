// Знімки оболонки (шапка, острів, бічне меню) для перевірки вигляду (лише локально: GC_SHOTS=dir).
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/account.dart';
import 'package:gamecon/shell.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:gamecon/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<void> _font(String family, String path) async {
  final loader = FontLoader(family)..addFont(Future.value(ByteData.sublistView(File(path).readAsBytesSync())));
  await loader.load();
}

class _Feed extends StatelessWidget {
  const _Feed();

  @override
  Widget build(BuildContext context) {
    return ScreenScroll(children: [
      for (var i = 0; i < 4; i++)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Glass(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Запис $i', style: body(15, weight: FontWeight.w600)),
              const SizedBox(height: 8),
              Text('Текст запису в стрічці, щоб видно було, як картка лежить на тлі.', style: body(14, color: soft)),
              const SizedBox(height: 60),
            ]),
          ),
        ),
    ]);
  }
}

void main() {
  final out = Platform.environment['GC_SHOTS'];

  setUpAll(() async {
    if (out == null) return;
    for (final w in ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold']) {
      await _font('Montserrat', 'fonts/Montserrat-$w.ttf');
    }
    final lucide = '${Platform.environment['HOME']}/.pub-cache/hosted/pub.dev/lucide_icons_flutter-3.1.21/assets';
    await _font('packages/lucide_icons_flutter/Lucide', '$lucide/lucide.ttf');
    for (final w in ['w500', 'w600']) {
      final f = File('$lucide/build_font/LucideVariable-$w.ttf');
      if (f.existsSync()) await _font('packages/lucide_icons_flutter/Lucide${w.substring(1)}', f.path);
    }
  });

  for (final (name, size, ratio) in [('phone', const Size(1170, 2532), 3.0), ('tablet', const Size(2360, 1640), 2.0)]) {
    for (final light in [false, true]) {
      for (final open in name == 'phone' ? [false, true] : [false]) {
        final label = '$name-${light ? 'light' : 'dark'}${open ? '-menu' : ''}';
        testWidgets('оболонка малюється: $label', (tester) async {
          SharedPreferences.setMockInitialValues({'whats_new': whatsNewVersion});
          final prefs = await SharedPreferences.getInstance();
          palette = light ? arcticPalette : neonPalette;
          addTearDown(() => palette = neonPalette);
          final session = Session(prefs)
            ..me = {'id': 1, 'name': 'Тоні Старк', 'first_name': 'Тоні', 'username': 'tonny', 'role': 'admin', 'email': 'tony@example.com'}
            ..unreadChats = 3
            ..unreadNotifications = 2;
          tester.view.physicalSize = size;
          tester.view.devicePixelRatio = ratio;
          tester.view.padding = const FakeViewPadding(top: 120, bottom: 60);
          addTearDown(tester.view.reset);
          final router = GoRouter(initialLocation: '/feed', routes: [
            ShellRoute(
              builder: (_, _, child) => AppShell(session: session, player: TrackPlayer(), child: child),
              routes: [GoRoute(path: '/feed', builder: (_, _) => const _Feed())],
            ),
          ]);
          final key = GlobalKey();
          await tester.pumpWidget(RepaintBoundary(key: key, child: MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router)));
          await tester.pump(const Duration(milliseconds: 300));
          expect(find.text('Новини'), findsWidgets);
          if (open) {
            await tester.tap(find.bySemanticsLabel('Меню'));
            await tester.pumpAndSettle(const Duration(milliseconds: 100));
            expect(find.text('Налаштувати нижню панель'), findsOneWidget);
          }
          if (out != null) {
            await tester.runAsync(() async {
              final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
              final image = await boundary.toImage(pixelRatio: 1);
              final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
              File('$out/shell-$label.png').writeAsBytesSync(bytes!.buffer.asUint8List());
            });
          }
          await tester.pumpWidget(const SizedBox());
        });
      }
    }
  }
}
