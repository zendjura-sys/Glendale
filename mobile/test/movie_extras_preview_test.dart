// Добірки й рецензії кіно, пісня профілю, «Що нового» — з підставленими відповідями. Знімки — GC_SHOTS=dir.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/account.dart';
import 'package:gamecon/movie_extras.dart';
import 'package:gamecon/shell.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fonts.dart';

Map<String, dynamic> _user(int id, String name) => {'id': id, 'username': 'u$id', 'name': name, 'avatar_url': null};
Map<String, dynamic> _movie(String slug, String title) => {'id': slug.length, 'slug': slug, 'title': title, 'poster': null, 'year': 1999, 'type_label': 'Фільм'};

Map<String, dynamic> _respond(http.Request request) {
  if (request.url.path.endsWith('/site/cinema/lists')) {
    return {
      'lists': {
        'data': [
          {'id': 1, 'title': 'Найкраща фантастика', 'is_public': true, 'items_count': 12, 'likes_count': 48, 'followers_count': 9, 'posters': [], 'user': _user(2, 'Олег Коваль')},
          {'id': 2, 'title': 'Хорори на вечір', 'is_public': false, 'items_count': 5, 'likes_count': 0, 'followers_count': 0, 'posters': [], 'user': _user(1, 'Тоні Старк')},
        ],
      },
    };
  }
  if (request.url.path.endsWith('/site/cinema/reviews')) {
    return {
      'reviews': {
        'data': [
          {'id': 1, 'body': 'Класика кіберпанку: досі виглядає свіжо, а сцена з ложкою — шедевр.', 'score': 10, 'spoiler': false, 'likes_count': 12, 'liked': true, 'mine': false, 'user': _user(2, 'Олег Коваль'), 'movie': _movie('matrix', 'Матриця')},
          {'id': 2, 'body': 'Фінал перевертає все.', 'score': 8, 'spoiler': true, 'likes_count': 3, 'liked': false, 'mine': false, 'user': _user(3, 'Ірина Мельник'), 'movie': _movie('fight-club', 'Бійцівський клуб')},
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
    ('movie-lists', '/lists', 'Найкраща фантастика'),
    ('movie-reviews', '/reviews', 'Спойлер — показати'),
    ('profile-track', '/track', 'Paparazzi'),
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
              GoRoute(path: '/lists', builder: (_, _) => const MovieListsScreen()),
              GoRoute(path: '/reviews', builder: (_, _) => const MovieReviewsFeedScreen()),
              GoRoute(
                path: '/track',
                builder: (_, _) => Padding(
                  padding: const EdgeInsets.only(top: 140, left: 16, right: 16),
                  child: Column(children: [
                    ProfileTrackPanel(track: {'id': 1, 'key': 'local:1', 'title': 'Paparazzi', 'artist': 'Xzibit', 'cover_url': null}, isSelf: true, onSaved: () {}),
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
