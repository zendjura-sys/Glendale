// Шторка GameCon+: переваги картками, оформлення (колір і анімація ніку, рамка, кольори, шапка)
// і кнопки над системною смугою жестів. Знімки — лише локально: GC_SHOTS=dir.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/account.dart';
import 'package:gamecon/shell.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/subscription.dart';
import 'package:gamecon/theme.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fonts.dart';

final _saved = <Map<String, dynamic>>[];

Map<String, dynamic> _respond(http.Request request) {
  final p = request.url.path;
  if (p.endsWith('/user/subscription-status')) {
    return {'is_pro': true, 'expires_at': '2026-11-09T12:00:00Z', 'plan_name': 'GameCon+', 'style': {'name': ['#38bdf8', '#818cf8']}};
  }
  if (p.endsWith('/api/v1/me')) {
    return {'user': {'id': 1, 'name': 'Тоні Старк', 'first_name': 'Тоні', 'username': 'tonny', 'role': 'user'}};
  }
  if (p.endsWith('/site/plus/style')) {
    _saved.add(jsonDecode(request.body) as Map<String, dynamic>);
    return {'ok': true, 'message': 'Оформлення збережено.'};
  }
  if (p.endsWith('/site/plus')) {
    return {
      'state': {'active': true},
      'style': {'name': 'sky', 'fx': 'flow'},
      'options': {
        'names': {'sky': ['#38bdf8'], 'mint': ['#34d399'], 'gold': ['#fbbf24'], 'ice': ['#38bdf8', '#818cf8']},
        'frames': {'sapphire': ['#0a84ff', '#00d2ff'], 'gold': ['#fbbf24', '#f97316'], 'season': ['#f97316', '#fde68a']},
        'accents': {'ocean': ['#0a84ff', '#00d2ff'], 'forest': ['#10b981', '#065f46']},
        'effects': ['flow', 'shine', 'neon', 'rainbow'],
        'headers': ['aurora', 'rim'],
      },
    };
  }
  return {};
}

void main() {
  final out = Platform.environment['GC_SHOTS'];

  setUpAll(() async {
    if (out == null) return;
    await loadTestFonts();
  });

  for (final light in [false, true]) {
    final label = 'plus-sheet-${light ? 'light' : 'dark'}';
    testWidgets('шторка GameCon+ малюється: $label', (tester) async {
      await http.runWithClient(() async {
        _saved.clear();
        SharedPreferences.setMockInitialValues({'whats_new': whatsNewVersion});
        final prefs = await SharedPreferences.getInstance();
        palette = light ? arcticPalette : neonPalette;
        addTearDown(() => palette = neonPalette);
        final session = Session(prefs)..me = {'id': 1, 'name': 'Тоні Старк', 'first_name': 'Тоні', 'username': 'tonny', 'role': 'user'};
        await tester.runAsync(() => session.subscription.refreshSubscriptionStatus());
        tester.view.physicalSize = const Size(1170, 2532);
        tester.view.devicePixelRatio = 3;
        tester.view.padding = const FakeViewPadding(top: 120, bottom: 60);
        addTearDown(tester.view.reset);
        final router = GoRouter(initialLocation: '/x', routes: [
          ShellRoute(
            builder: (_, _, child) => AppShell(session: session, player: TrackPlayer()..session = session, child: child),
            routes: [GoRoute(path: '/x', builder: (_, _) => Builder(builder: (context) => Center(child: TextButton(onPressed: () => showProFeatures(context), child: const Text('open')))))],
          ),
        ]);
        final key = GlobalKey();
        await tester.pumpWidget(RepaintBoundary(key: key, child: MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router)));
        await tester.pump(const Duration(milliseconds: 300));
        await tester.tap(find.text('open'));
        for (var i = 0; i < 10; i++) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        expect(find.text('Що дає GameCon+'), findsOneWidget);
        expect(find.text('Анімований нік'), findsOneWidget);

        Future<void> shot(String name) async {
          if (out == null) return;
          await tester.runAsync(() async {
            final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
            final image = await boundary.toImage(pixelRatio: 1);
            final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
            File('$out/$name.png').writeAsBytesSync(bytes!.buffer.asUint8List());
          });
        }

        await shot(label);
        // Оформлення: вибрати «Неон» і зберегти — на сервер іде новий стиль.
        final sheet = tester.state<ScrollableState>(find.ancestor(of: find.text('Що дає GameCon+'), matching: find.byType(Scrollable)).first);
        sheet.position.jumpTo(sheet.position.maxScrollExtent * 0.62);
        await tester.pump(const Duration(milliseconds: 300));
        expect(find.text('Оформлення'), findsOneWidget);
        await tester.tap(find.text('Неон'));
        await tester.pump(const Duration(milliseconds: 300));
        await shot('$label-style');
        await tester.ensureVisible(find.text('Зберегти оформлення'));
        await tester.pump(const Duration(milliseconds: 300));
        await tester.tap(find.text('Зберегти оформлення'));
        for (var i = 0; i < 6; i++) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        expect(_saved.single['fx'], 'neon');
        expect(_saved.single['name'], 'sky');

        // Кінець шторки: «Зрозуміло» над системною смугою жестів (60 логічних px = 20 dp), не під нею.
        sheet.position.jumpTo(sheet.position.maxScrollExtent);
        await tester.pump(const Duration(milliseconds: 300));
        final bottom = tester.getRect(find.text('Зрозуміло')).bottom;
        expect(bottom, lessThan(2532 / 3 - 60 / 3));
        await shot('$label-end');
        await tester.pumpWidget(const SizedBox());
      }, () => MockClient((request) async => http.Response(jsonEncode(_respond(request)), 200, headers: {'content-type': 'application/json; charset=utf-8'})));
    });
  }
}
