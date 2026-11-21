// Розваги: «Що подивитися?», «Вгадай пісню», вікторина дня, ігровий щоденник — з підставленими відповідями мосту.
// Знімки — лише локально: GC_SHOTS=dir.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/account.dart';
import 'package:gamecon/fun.dart';
import 'package:gamecon/shell.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fonts.dart';

Map<String, dynamic> _user(int id, String name) => {'id': id, 'username': 'u$id', 'name': name, 'avatar_url': null};
final _top = [
  {'user': _user(2, 'Олег Коваль'), 'score': 5, 'total': 5},
  {'user': _user(3, 'Ірина Мельник'), 'score': 4, 'total': 5},
];
final _requests = <String>[];

Map<String, dynamic> _respond(http.Request request) {
  final p = request.url.path;
  _requests.add('${request.method} $p');
  if (p.endsWith('/site/cinema/roulette/spin')) {
    return {
      'movie': {
        'id': 4, 'slug': 'interstellar', 'type_label': 'Фільм', 'title': 'Інтерстеллар', 'year': 2014, 'poster': null, 'genres': ['фантастика', 'драма'], 'rating': 8.7,
        'description': 'Команда дослідників вирушає крізь червоточину в пошуках нового дому для людства.',
      },
    };
  }
  if (p.endsWith('/site/cinema/roulette')) return {'types': {'movie': 'Фільм', 'serial': 'Серіал', 'anime': 'Аніме'}, 'genres': ['фантастика', 'драма', 'комедія']};
  if (p.endsWith('/site/music/quiz')) return {'top': _top, 'best': 3, 'clip': 15};
  if (p.endsWith('/site/games/trivia') && request.method == 'POST') return {'score': 3, 'total': 3, 'answers': [1, 0, 2], 'already': false, 'top': _top};
  if (p.endsWith('/site/games/trivia')) {
    return {
      'questions': [
        {'type': 'year', 'question': 'У якому році вийшла The Witcher 3?', 'image': null, 'options': ['2013', '2015', '2016', '2018']},
        {'type': 'genre', 'question': 'Який жанр у Factorio?', 'image': null, 'options': ['Стратегія', 'Шутер', 'Гонки', 'Файтинг']},
        {'type': 'platform', 'question': 'На якій із платформ є Halo Infinite?', 'image': null, 'options': ['Nintendo Switch', 'PlayStation', 'Xbox', 'iOS']},
      ],
      'played': null,
      'top': _top,
    };
  }
  if (p.endsWith('/site/journal')) {
    return {
      'owner': _user(1, 'Тоні Старк'),
      'mine': true,
      'stats': {'entries': 2, 'minutes': 210, 'games': 2},
      'moods': ['great', 'good', 'meh', 'bad'],
      'entries': {
        'data': [
          {'id': 1, 'body': 'Нарешті пройшов Малению. Сорок спроб, але воно того варте.', 'mood': 'great', 'minutes': 150, 'played_on': '2026-10-31', 'is_public': true, 'game': {'id': 1, 'name': 'Elden Ring'}},
          {'id': 2, 'body': 'Три поразки поспіль на Mirage — треба тренувати гранати.', 'mood': 'meh', 'minutes': 60, 'played_on': '2026-10-30', 'is_public': false, 'game': {'id': 2, 'name': 'Counter-Strike 2'}},
        ],
      },
    };
  }
  return {'ok': true};
}

void main() {
  final out = Platform.environment['GC_SHOTS'];

  setUpAll(() async {
    if (out == null) return;
    await loadTestFonts();
  });

  final screens = <(String, String, String)>[
    ('roulette', '/cinema/roulette', 'Що подивитися?'),
    ('music-quiz', '/music/quiz', 'Вгадай пісню'),
    ('trivia', '/games/trivia', 'Вікторина дня'),
    ('journal', '/journal', 'Ігровий щоденник'),
  ];
  for (final (name, location, expected) in screens) {
    for (final light in [false, true]) {
      if (light && name != 'journal') continue;
      final label = '$name-${light ? 'light' : 'dark'}';
      testWidgets('розділ малюється: $label', (tester) async {
        await http.runWithClient(() async {
          _requests.clear();
          SharedPreferences.setMockInitialValues({'whats_new': whatsNewVersion});
          final prefs = await SharedPreferences.getInstance();
          palette = light ? arcticPalette : neonPalette;
          addTearDown(() => palette = neonPalette);
          final session = Session(prefs)..me = {'id': 1, 'name': 'Тоні Старк', 'first_name': 'Тоні', 'username': 'tonny', 'role': 'user'};
          tester.view.physicalSize = const Size(1170, 2532);
          tester.view.devicePixelRatio = 3;
          tester.view.padding = const FakeViewPadding(top: 120, bottom: 60);
          addTearDown(tester.view.reset);
          final router = GoRouter(initialLocation: location, routes: [
            ShellRoute(
              builder: (_, _, child) => AppShell(session: session, player: TrackPlayer()..session = session, child: child),
              routes: [
                GoRoute(path: '/cinema/roulette', builder: (_, _) => const RouletteScreen()),
                GoRoute(path: '/music/quiz', builder: (_, _) => const MusicQuizScreen()),
                GoRoute(path: '/games/trivia', builder: (_, _) => const TriviaScreen()),
                GoRoute(path: '/journal', builder: (_, _) => const JournalScreen()),
              ],
            ),
          ]);
          final key = GlobalKey();
          await tester.pumpWidget(RepaintBoundary(key: key, child: MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router)));
          for (var i = 0; i < 8; i++) {
            await tester.pump(const Duration(milliseconds: 100));
          }
          expect(find.text(expected), findsWidgets);
          if (name == 'roulette') {
            await tester.tap(find.text('Крутити'));
            for (var i = 0; i < 6; i++) {
              await tester.pump(const Duration(milliseconds: 100));
            }
            expect(find.text('Інтерстеллар'), findsOneWidget);
          }
          if (name == 'trivia') {
            for (final option in ['2015', 'Стратегія', 'Xbox']) {
              final scroll = tester.state<ScrollableState>(find.ancestor(of: find.text(option), matching: find.byType(Scrollable)).first);
              final y = tester.getRect(find.text(option)).top;
              scroll.position.jumpTo((scroll.position.pixels + y - 400).clamp(0, scroll.position.maxScrollExtent));
              await tester.pump(const Duration(milliseconds: 100));
              await tester.tap(find.text(option));
              await tester.pump();
            }
            final scroll0 = tester.state<ScrollableState>(find.ancestor(of: find.text('Перевірити'), matching: find.byType(Scrollable)).first);
            scroll0.position.jumpTo((scroll0.position.pixels + tester.getRect(find.text('Перевірити')).top - 400).clamp(0, scroll0.position.maxScrollExtent));
            await tester.pump(const Duration(milliseconds: 100));
            await tester.tap(find.text('Перевірити'));
            for (var i = 0; i < 6; i++) {
              await tester.pump(const Duration(milliseconds: 100));
            }
            expect(_requests, contains('POST /api/v1/site/games/trivia'));
            scroll0.position.jumpTo(0);
            for (var i = 0; i < 10; i++) {
              await tester.pump(const Duration(milliseconds: 100));
            }
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
        }, () => MockClient((request) async => http.Response(jsonEncode(_respond(request)), 200, headers: {'content-type': 'application/json; charset=utf-8'})));
      });
    }
  }
}
