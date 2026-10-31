// Дошка ідей, дуелі й тір-листи малюються з даних мосту сайту (відповіді підставлені).
// Знімки — лише локально: GC_SHOTS=dir.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/account.dart';
import 'package:gamecon/play_extras.dart';
import 'package:gamecon/shell.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fonts.dart';

Map<String, dynamic> _user(int id, String name) => {'id': id, 'username': 'u$id', 'name': name, 'first_name': name.split(' ').first, 'avatar_url': null};

Map<String, dynamic> _respond(Uri url) {
  final p = url.path;
  if (p.endsWith('/ideas')) {
    return {
      'ideas': {
        'data': [
          {'id': 1, 'title': 'Темна тема для профілю', 'body': 'Щоб сторінка гравця теж могла бути в неоні.', 'status': 'planned', 'answer': 'Беремо в наступний сезон.', 'votes': 128, 'voted': true, 'author': _user(2, 'Олег Коваль'), 'created_at': '2026-10-28T10:00:00Z'},
          {'id': 2, 'title': 'Таймер респавну в паті', 'body': 'Спільний таймер для всієї паті у голосовій.', 'status': 'new', 'answer': null, 'votes': 41, 'voted': false, 'author': _user(3, 'Ірина Мельник'), 'created_at': '2026-10-29T18:00:00Z'},
          {'id': 3, 'title': 'Експорт тір-листа картинкою', 'body': null, 'status': 'done', 'answer': null, 'votes': 17, 'voted': false, 'author': _user(4, 'Макс Бондар'), 'created_at': '2026-10-20T08:00:00Z'},
        ],
      },
      'sort': 'top',
    };
  }
  if (p.endsWith('/duels')) {
    return {
      'duels': [
        {'id': 1, 'terms': '1×1 на Mirage до 16', 'status': 'pending', 'game': {'slug': 'cs2', 'name': 'CS2'}, 'challenger': _user(2, 'Олег Коваль'), 'opponent': _user(1, 'Тоні Старк'), 'incoming': true, 'my_pick': null, 'winner_id': null},
        {'id': 2, 'terms': 'Мід 1×1, до першої крові', 'status': 'accepted', 'game': {'slug': 'dota-2', 'name': 'Dota 2'}, 'challenger': _user(1, 'Тоні Старк'), 'opponent': _user(3, 'Ірина Мельник'), 'incoming': false, 'my_pick': null, 'winner_id': null},
        {'id': 3, 'terms': 'Три раунди в Tekken', 'status': 'finished', 'game': null, 'challenger': _user(1, 'Тоні Старк'), 'opponent': _user(4, 'Макс Бондар'), 'incoming': false, 'my_pick': 1, 'winner_id': 1},
      ],
      'stats': {'wins': 7, 'losses': 3},
      'games': [{'slug': 'cs2', 'name': 'CS2'}],
    };
  }
  if (RegExp(r'/tierlists/\d+$').hasMatch(p)) {
    return {
      'list': {
        'id': 1,
        'title': 'Шутери 2026',
        'author': _user(2, 'Олег Коваль'),
        'game': null,
        'tiers': [
          {'label': 'S', 'color': 'rose', 'items': ['CS2', 'Valorant']},
          {'label': 'A', 'color': 'amber', 'items': ['Apex Legends', 'Overwatch 2', 'Rainbow Six']},
          {'label': 'B', 'color': 'lime', 'items': ['PUBG', 'The Finals']},
          {'label': 'C', 'color': 'sky', 'items': ['Warzone']},
          {'label': 'D', 'color': 'slate', 'items': <String>[]},
        ],
      },
    };
  }
  return {
    'lists': {
      'data': [
        for (final (i, t) in ['Шутери 2026', 'Герої Dota 2', 'Зброя Valorant'].indexed)
          {
            'id': i + 1,
            'title': t,
            'author': _user(2 + i, ['Олег Коваль', 'Ірина Мельник', 'Макс Бондар'][i]),
            'game': null,
            'views': 1240 - i * 300,
            'preview': [
              {'label': 'S', 'color': 'rose', 'count': 2},
              {'label': 'A', 'color': 'amber', 'count': 3 + i},
              {'label': 'B', 'color': 'lime', 'count': 2},
              {'label': 'C', 'color': 'sky', 'count': 1},
            ],
          },
      ],
    },
  };
}

void main() {
  final out = Platform.environment['GC_SHOTS'];

  setUpAll(() async {
    if (out == null) return;
    await loadTestFonts();
  });

  final screens = <(String, String, String)>[
    ('ideas', '/ideas', 'Дошка ідей'),
    ('duels', '/duels', 'Дуелі'),
    ('tierlists', '/tierlists', 'Тір-листи'),
    ('tierlist', '/tierlists/1', 'Шутери 2026'),
  ];
  for (final (name, location, expected) in screens) {
    for (final light in [false, true]) {
      final label = '$name-${light ? 'light' : 'dark'}';
      testWidgets('розділ малюється: $label', (tester) async {
        await http.runWithClient(() async {
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
                GoRoute(path: '/ideas', builder: (_, _) => const IdeasScreen()),
                GoRoute(path: '/duels', builder: (_, _) => const DuelsScreen()),
                GoRoute(path: '/tierlists', builder: (_, _) => const TierListsScreen()),
                GoRoute(path: '/tierlists/:id', builder: (_, state) => TierListScreen(id: int.parse(state.pathParameters['id']!))),
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
              File('$out/$label.png').writeAsBytesSync(bytes!.buffer.asUint8List());
            });
          }
          await tester.pumpWidget(const SizedBox());
        }, () => MockClient((request) async => http.Response(jsonEncode(_respond(request.url)), 200, headers: {'content-type': 'application/json; charset=utf-8'})));
      });
    }
  }
}
