// Редактор запису: компактна панель, інструменти під «+» і меню видимості — як на сайті.
// Знімки — лише локально: GC_SHOTS=dir.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/account.dart';
import 'package:gamecon/posts.dart';
import 'package:gamecon/shell.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:gamecon/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fonts.dart';

class _Feed extends StatelessWidget {
  const _Feed();

  @override
  Widget build(BuildContext context) => ScreenScroll(children: [Composer(onPosted: () {})]);
}

void main() {
  final out = Platform.environment['GC_SHOTS'];

  setUpAll(() async {
    if (out == null) return;
    await loadTestFonts();
  });

  for (final (mode, light) in [('tools', false), ('tools', true), ('visibility', false), ('closed', false)]) {
    final label = 'composer-$mode-${light ? 'light' : 'dark'}';
    testWidgets('редактор запису малюється: $label', (tester) async {
      await http.runWithClient(() async {
        SharedPreferences.setMockInitialValues({'whats_new': whatsNewVersion});
        final prefs = await SharedPreferences.getInstance();
        palette = light ? arcticPalette : neonPalette;
        addTearDown(() => palette = neonPalette);
        final session = Session(prefs)
          ..me = {'id': 1, 'name': 'Тоні Старк', 'first_name': 'Тоні', 'username': 'tonny', 'role': 'user', 'plugins': {'gif_search': true, 'author_subscriptions': true, 'scheduled_posts': true, 'open_polls': true}};
        tester.view.physicalSize = const Size(1170, 2532);
        tester.view.devicePixelRatio = 3;
        tester.view.padding = const FakeViewPadding(top: 120, bottom: 60);
        addTearDown(tester.view.reset);
        final router = GoRouter(initialLocation: '/feed', routes: [
          ShellRoute(
            builder: (_, _, child) => AppShell(session: session, player: TrackPlayer()..session = session, child: child),
            routes: [GoRoute(path: '/feed', builder: (_, _) => const _Feed())],
          ),
        ]);
        final key = GlobalKey();
        await tester.pumpWidget(RepaintBoundary(key: key, child: MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router)));
        for (var i = 0; i < 8; i++) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        if (mode == 'tools') {
          await tester.tap(find.byIcon(LucideIcons.plus).first);
          await tester.pumpAndSettle();
          for (final t in ['Стікер', 'GIF', 'Опитування', 'Картка', 'Спойлер', 'Підписникам', 'Розклад', 'Чернетка', 'Мої чернетки']) {
            expect(find.text(t), findsOneWidget);
          }
        }
        if (mode == 'visibility') {
          await tester.tap(find.byTooltip('Хто бачить запис'));
          await tester.pumpAndSettle();
          expect(find.text('Тільки мені'), findsOneWidget);
        }
        if (out != null) {
          await tester.runAsync(() async {
            final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
            final image = await boundary.toImage(pixelRatio: 1);
            final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
            File('$out/$label.png').writeAsBytesSync(bytes!.buffer.asUint8List());
          });
        }
        await tester.pumpWidget(const SizedBox());
      }, () => MockClient((request) async {
        final gifs = [
          for (var i = 0; i < 12; i++) {'id': '$i', 'title': 'GG $i', 'url': '', 'preview': ''},
        ];
        return http.Response(jsonEncode({'configured': true, 'gifs': gifs}), 200, headers: {'content-type': 'application/json; charset=utf-8'});
      }));
    });
  }
}
