// «Гра року» й ігрові ID у профілі — з підставленими відповідями. Знімки — GC_SHOTS=dir.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/account.dart';
import 'package:gamecon/awards.dart';
import 'package:gamecon/shell.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fonts.dart';

Map<String, dynamic> _game(int id, String slug, String name, [int percent = 0]) => {'id': id, 'slug': slug, 'name': name, 'cover': null, 'year': 2026, 'genres': ['Шутер'], 'percent': percent, 'votes': percent};

Map<String, dynamic> _respond(http.Request request) {
  if (request.url.path.endsWith('/site/games/awards')) {
    return {
      'year': 2026,
      'phase': 'voting',
      'voters': 128,
      'archive': [2025],
      'opens_on': '2026-12-01',
      'closes_on': '2026-12-31',
      'categories': [
        {'key': 'goty', 'label': 'Гра року', 'hint': 'Головна номінація — будь-яка гра, у яку ви грали цього року.', 'mine': _game(1, 'cs2', 'Counter-Strike 2'), 'results': null},
        {'key': 'newcomer', 'label': 'Новинка року', 'hint': 'Ігри, що вийшли цього року.', 'mine': null, 'results': null},
      ],
    };
  }
  if (request.url.path.endsWith('/site/games/awards/2025')) {
    return {
      'year': 2025,
      'phase': 'results',
      'voters': 412,
      'archive': [2025],
      'categories': [
        {
          'key': 'goty',
          'label': 'Гра року',
          'hint': 'Головна номінація.',
          'mine': null,
          'results': {
            'total': 412,
            'top': [_game(1, 'cs2', 'Counter-Strike 2', 46), _game(2, 'dota-2', 'Dota 2', 31), _game(3, 'rust', 'Rust', 23)],
          },
        },
      ],
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

  final screens = <(String, String, String)>[
    ('awards-voting', '/awards', 'Обрати гру'),
    ('awards-results', '/awards/2025', 'Dota 2'),
    ('gamer-ids', '/ids', 'Shadow#EUW'),
  ];
  for (final (name, location, expected) in screens) {
    testWidgets('розділ малюється: $name', (tester) async {
      await http.runWithClient(() async {
        SharedPreferences.setMockInitialValues({'whats_new': whatsNewVersion});
        final session = Session(await SharedPreferences.getInstance())..me = {'id': 1, 'name': 'Тоні Старк', 'first_name': 'Тоні', 'username': 'tonny', 'role': 'user'};
        tester.view.physicalSize = const Size(1170, 2532);
        tester.view.devicePixelRatio = 3;
        tester.view.padding = const FakeViewPadding(top: 120, bottom: 60);
        addTearDown(tester.view.reset);
        final router = GoRouter(initialLocation: location, routes: [
          ShellRoute(
            builder: (_, _, child) => AppShell(session: session, player: TrackPlayer()..session = session, child: child),
            routes: [
              GoRoute(path: '/awards', builder: (_, _) => const AwardsScreen()),
              GoRoute(path: '/awards/2025', builder: (_, _) => const AwardsScreen(year: 2025)),
              GoRoute(
                path: '/ids',
                builder: (_, _) => Padding(
                  padding: const EdgeInsets.only(top: 140, left: 16, right: 16),
                  child: Column(children: [
                    GamerIdsPanel(
                      platforms: {
                        'steam': 'https://steamcommunity.com/profiles/1',
                        'ids': [
                          {'key': 'playstation', 'label': 'PlayStation', 'value': 'psn_hero', 'url': null},
                          {'key': 'riot', 'label': 'Riot ID', 'value': 'Shadow#EUW', 'url': null},
                          {'key': 'battlenet', 'label': 'Battle.net', 'value': 'Hero#21345', 'url': null},
                        ],
                      },
                      isSelf: true,
                      onSaved: () {},
                    ),
                  ]),
                ),
              ),
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
