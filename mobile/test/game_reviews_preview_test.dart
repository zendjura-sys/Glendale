// Трейлери й «Гравець місяця» в клані — з підставленими відповідями. Знімки — GC_SHOTS=dir.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/account.dart';
import 'package:gamecon/game_reviews.dart';
import 'package:gamecon/shell.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fonts.dart';

Map<String, dynamic> _user(int id, String name) => {'id': id, 'username': 'u$id', 'name': name, 'avatar_url': null};

Map<String, dynamic> _respond(http.Request request) {
  if (request.url.path.endsWith('/site/games/trailers')) {
    return {
      'games': {
        'data': [
          {'id': 1, 'slug': 'cs2', 'name': 'Counter-Strike 2', 'videos': [{'id': 'abc', 'name': 'Офіційний трейлер'}]},
          {'id': 2, 'slug': 'dota-2', 'name': 'Dota 2', 'videos': [{'id': 'def', 'name': 'Новий герой'}]},
        ],
      },
    };
  }
  if (request.url.path.endsWith('/site/games/cs2/reviews')) {
    return {
      'summary': {'count': 2, 'recommended': 2, 'average': 9.0},
      'mine': null,
      'reviews': {
        'data': [
          {'id': 1, 'body': 'Найкращий тактичний шутер, але новачкам важко.', 'score': 9, 'recommended': true, 'helpful_count': 4, 'helpful': false, 'mine': false, 'user': _user(2, 'Олег Коваль')},
        ],
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

  final screens = <(String, String, String)>[
    ('trailers', '/trailers', 'Counter-Strike 2'),
    ('clan-mvp', '/mvp', 'Ірина Мельник'),
    ('game-reviews', '/reviews', 'Найкращий тактичний шутер, але новачкам важко.'),
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
              GoRoute(path: '/trailers', builder: (_, _) => const TrailersScreen()),
              GoRoute(
                path: '/mvp',
                builder: (_, _) => Padding(
                  padding: const EdgeInsets.only(top: 140, left: 16, right: 16),
                  child: Column(children: [
                    ClanMvpCard(
                      mvp: {
                        'month': '2026-11',
                        'winner': {'user': _user(3, 'Ірина Мельник'), 'votes': 7, 'month': '2026-10'},
                        'leaders': [{'user': _user(2, 'Олег Коваль'), 'votes': 3}],
                        'my_vote': 2,
                      },
                      members: [
                        {'id': 1, 'user': _user(2, 'Олег Коваль'), 'nickname': null},
                        {'id': 2, 'user': _user(3, 'Ірина Мельник'), 'nickname': 'Ira'},
                      ],
                      myUserId: 1,
                      onVote: (_) async {},
                    ),
                  ]),
                ),
              ),
              GoRoute(path: '/reviews', builder: (_, _) => const SingleChildScrollView(padding: EdgeInsets.only(top: 130, left: 16, right: 16), child: GameReviewsSection(slug: 'cs2'))),
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
