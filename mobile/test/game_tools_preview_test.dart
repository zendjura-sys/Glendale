// Конфіги й приціли, ігровий вечір — з підставленими відповідями мосту сайту.
// Знімки — лише локально: GC_SHOTS=dir.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/account.dart';
import 'package:gamecon/game_tools.dart';
import 'package:gamecon/shell.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fonts.dart';

Map<String, dynamic> _user(int id, String name) => {'id': id, 'username': 'u$id', 'name': name, 'first_name': name.split(' ').first, 'avatar_url': null};
const _cs = {'id': 1, 'slug': 'cs2', 'name': 'Counter-Strike 2', 'cover': null};
final _requests = <String>[];

Map<String, dynamic> _respond(http.Request request) {
  final p = request.url.path;
  _requests.add('${request.method} $p');
  if (p.endsWith('/site/configs')) {
    return {
      'configs': {
        'data': [
          {'id': 1, 'kind': 'crosshair', 'title': 'Маленький зелений', 'code': 'CSGO-SG5jT-BDmQF-Mq6Ny-hNnbx-oNWXD', 'description': 'Для AWP і rifle — не закриває голову.', 'likes': 42, 'copies': 310, 'liked': true, 'mine': false, 'author': _user(2, 'Олег Коваль'), 'game': _cs, 'created_at': '2026-10-28T10:00:00Z'},
          {'id': 2, 'kind': 'sensitivity', 'title': '800 DPI · 1.1', 'code': 'sensitivity "1.1"\nm_yaw "0.022"', 'description': null, 'likes': 7, 'copies': 21, 'liked': false, 'mine': true, 'author': _user(1, 'Тоні Старк'), 'game': _cs, 'created_at': '2026-10-29T10:00:00Z'},
        ],
      },
      'game': null,
      'kind': null,
      'tab': 'top',
      'kinds': ['crosshair', 'config', 'binds', 'graphics', 'sensitivity'],
    };
  }
  if (p.endsWith('/site/game-nights')) {
    return {
      'upcoming': [
        {'id': 7, 'title': 'П’ятниця в CS', 'status': 'planning', 'starts_at': null, 'game': null, 'host': _user(1, 'Тоні Старк'), 'members_count': 3},
        {'id': 8, 'title': 'Рейд у Destiny', 'status': 'set', 'starts_at': '2026-11-02T18:00:00Z', 'game': {'id': 2, 'slug': 'destiny-2', 'name': 'Destiny 2'}, 'host': _user(2, 'Олег Коваль'), 'members_count': 5},
      ],
      'past': [],
      'friends': [_user(2, 'Олег Коваль'), _user(3, 'Ірина Мельник')],
    };
  }
  if (p.endsWith('/site/game-nights/7')) {
    return {
      'night': {
        'id': 7,
        'title': 'П’ятниця в CS',
        'status': 'planning',
        'starts_at': null,
        'game': null,
        'host': _user(1, 'Тоні Старк'),
        'members_count': 2,
        'note': 'Збираємось у Discord, канал «Лобі».',
        'is_host': true,
        'my_status': null,
        'members': [
          {..._user(2, 'Олег Коваль'), 'status': 'going'},
          {..._user(3, 'Ірина Мельник'), 'status': 'invited'},
        ],
        'times': [
          {'id': 11, 'starts_at': '2026-11-06T18:00:00Z', 'game': null, 'votes': 2, 'voted': true, 'voters': [_user(2, 'Олег Коваль')]},
          {'id': 12, 'starts_at': '2026-11-07T19:00:00Z', 'game': null, 'votes': 1, 'voted': false, 'voters': []},
        ],
        'games': [
          {'id': 13, 'starts_at': null, 'game': _cs, 'votes': 2, 'voted': true, 'voters': []},
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
    ('configs', '/configs', 'Маленький зелений'),
    ('game-nights', '/game-nights', 'П’ятниця в CS'),
    ('game-night', '/game-nights/7', 'Призначити вечір'),
  ];
  for (final (name, location, expected) in screens) {
    for (final light in [false, true]) {
      if (light && name != 'configs') continue;
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
                GoRoute(path: '/configs', builder: (_, _) => const ConfigsScreen()),
                GoRoute(path: '/game-nights', builder: (_, _) => const GameNightsScreen()),
                GoRoute(path: '/game-nights/:id', builder: (_, s) => GameNightScreen(id: int.parse(s.pathParameters['id']!))),
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
          if (name == 'game-night') {
            // Голос за варіант часу йде на міст сайту.
            await tester.tap(find.text('Підходить').first);
            await tester.pump(const Duration(milliseconds: 300));
            expect(_requests, contains('POST /api/v1/site/game-nights/7/options/12/vote'));
          }
          await tester.pumpWidget(const SizedBox());
        }, () => MockClient((request) async => http.Response(jsonEncode(_respond(request)), 200, headers: {'content-type': 'application/json; charset=utf-8'})));
      });
    }
  }
}
