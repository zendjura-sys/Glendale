// Карта гравців, «Цього дня» й картка серії над стрічкою. Знімки — GC_SHOTS=dir.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/account.dart';
import 'package:gamecon/engagement.dart';
import 'package:gamecon/shell.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fonts.dart';

Map<String, dynamic> _respond(http.Request request) {
  final p = request.url.path;
  if (p.endsWith('/site/map')) {
    return {
      'countries': [
        {'code': 'UA', 'name': 'Україна', 'count': 1840},
        {'code': 'PL', 'name': 'Польща', 'count': 412},
        {'code': 'DE', 'name': 'Німеччина', 'count': 305},
        {'code': 'CZ', 'name': 'Чехія', 'count': 96},
        {'code': 'US', 'name': 'США', 'count': 41},
        {'code': 'FR', 'name': 'Франція', 'count': 0},
      ],
    };
  }
  if (p.endsWith('/site/memories')) return {'date': '2026-10-31', 'posts': [], 'streak': {'days': 12, 'best': 30}};
  return {};
}

void main() {
  final out = Platform.environment['GC_SHOTS'];

  setUpAll(() async {
    if (out == null) return;
    await loadTestFonts();
  });

  final screens = <(String, String, String)>[
    ('players-map', '/map', 'Україна'),
    ('memories', '/memories', 'Сьогодні спогадів немає'),
    ('engagement-card', '/card', '12 днів поспіль на GameCon'),
  ];
  for (final (name, location, expected) in screens) {
    testWidgets('розділ малюється: $name', (tester) async {
      await http.runWithClient(() async {
        SharedPreferences.setMockInitialValues({'whats_new': whatsNewVersion});
        final session = Session(await SharedPreferences.getInstance())
          ..me = {'id': 1, 'name': 'Тоні Старк', 'first_name': 'Тоні', 'username': 'tonny', 'role': 'user', 'streak': {'days': 12, 'best': 30}, 'memories': 2};
        tester.view.physicalSize = const Size(1170, 2532);
        tester.view.devicePixelRatio = 3;
        tester.view.padding = const FakeViewPadding(top: 120, bottom: 60);
        addTearDown(tester.view.reset);
        final router = GoRouter(initialLocation: location, routes: [
          ShellRoute(
            builder: (_, _, child) => AppShell(session: session, player: TrackPlayer()..session = session, child: child),
            routes: [
              GoRoute(path: '/map', builder: (_, _) => const PlayersMapScreen()),
              GoRoute(path: '/memories', builder: (_, _) => const MemoriesScreen()),
              GoRoute(path: '/card', builder: (_, _) => const Padding(padding: EdgeInsets.only(top: 140, left: 16, right: 16), child: Column(children: [EngagementCard()]))),
            ],
          ),
        ]);
        final key = GlobalKey();
        await tester.pumpWidget(RepaintBoundary(key: key, child: MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router)));
        for (var i = 0; i < 8; i++) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        expect(find.text(expected), findsWidgets);
        if (out != null) {
          await tester.runAsync(() async {
            final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
            final image = await boundary.toImage(pixelRatio: 1);
            final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
            File('$out/$name.png').writeAsBytesSync(bytes!.buffer.asUint8List());
          });
        }
        await tester.pumpWidget(const SizedBox());
      }, () => MockClient((request) async => http.Response(jsonEncode(_respond(request)), 200, headers: {'content-type': 'application/json; charset=utf-8'})));
    });
  }
}
