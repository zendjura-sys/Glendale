// Мапа тривог і кнопка «Мапа тривог» — з підставленими відповідями. Знімки — GC_SHOTS=dir.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/account.dart';
import 'package:gamecon/alerts.dart';
import 'package:gamecon/shell.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fonts.dart';

Map<String, dynamic> _region(String slug, String name, double lat, double lng, [String? type]) => {
  'slug': slug,
  'name': name,
  'lat': lat,
  'lng': lng,
  'active': type != null,
  'type': type,
  'kind': type,
  'started_at': type == null ? null : DateTime.now().subtract(const Duration(minutes: 65)).toIso8601String(),
  'minutes': type == null ? null : 65,
};

Map<String, dynamic> _respond(http.Request request) {
  if (!request.url.path.endsWith('/site/alerts/state')) return {};
  final now = DateTime.now();
  return {
    'regions': [
      _region('kharkiv', 'Харківська область', 49.99, 36.23, 'air_raid'),
      _region('poltava', 'Полтавська область', 49.59, 34.55, 'partial'),
      _region('kyiv', 'м. Київ', 50.45, 30.52),
      _region('lviv', 'Львівська область', 49.84, 24.03),
      _region('odesa', 'Одеська область', 46.48, 30.73),
      _region('crimea', 'Автономна Республіка Крим', 45.04, 34.0, 'air_raid'),
    ],
    'active_count': 2,
    'mig_active': true,
    'ballistic_threat': false,
    'threats': [
      {'id': 1, 'type': 'uav', 'region': 'poltava', 'place': 'Полтава', 'title': 'БпЛА на Полтаву', 'lat': 49.59, 'lng': 34.55, 'course': 250, 'speed': 180, 'confidence': 100, 'sources': ['kpszsu', 'PoltavaRadar'], 'detected_at': now.subtract(const Duration(minutes: 12)).toIso8601String(), 'expires_at': now.add(const Duration(minutes: 20)).toIso8601String()},
      {'id': 2, 'type': 'missile', 'region': 'kharkiv', 'place': 'Харків', 'title': 'Ракета', 'lat': 49.99, 'lng': 36.23, 'course': null, 'speed': 750, 'confidence': 25, 'sources': ['monitor_ukr'], 'detected_at': now.toIso8601String(), 'expires_at': now.add(const Duration(minutes: 5)).toIso8601String()},
    ],
    'feed': [
      {'ref': 'kpszsu/1', 'channel': 'kpszsu', 'group': 'official', 'text': 'Ударні БпЛА з Сумщини курсом на Полтавщину.', 'at': now.toIso8601String()},
    ],
    'source': 'UkraineAlarm',
    'stale': false,
    'updated_at': now.toIso8601String(),
    'prefs': {'region': 'poltava', 'push': true, 'shelter': false},
    'region_list': [
      {'slug': 'kharkiv', 'name': 'Харківська область'},
      {'slug': 'poltava', 'name': 'Полтавська область'},
    ],
    'sources': [
      {
        'group': 'official',
        'title': 'Офіційні',
        'about': 'Повітряні Сили ЗСУ.',
        'enabled': true,
        'channels': [
          {'name': 'kpszsu', 'regions': <String>[]},
        ],
      },
    ],
  };
}

void main() {
  final out = Platform.environment['GC_SHOTS'];

  setUpAll(() async {
    if (out == null) return;
    await loadTestFonts();
  });

  final screens = <(String, String, String)>[
    ('alerts-map', '/alerts', 'Мапа тривог'),
    ('alerts-button', '/button', 'Тривога: 3'),
    ('alerts-mapview', '/mapview', 'Мапа'),
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
              GoRoute(path: '/alerts', builder: (_, _) => const AlertsScreen()),
              GoRoute(
                path: '/mapview',
                builder: (_, _) {
                  final d = _respond(http.Request('GET', Uri.parse('https://x/api/v1/site/alerts/state')));
                  return Padding(
                    padding: const EdgeInsets.only(top: 140, left: 8, right: 8),
                    child: Column(children: [
                      const Text('Мапа'),
                      AspectRatio(
                        aspectRatio: 1000 / 680,
                        child: AlertMapView(regions: List<Map<String, dynamic>>.from(d['regions'] as List), threats: List<Map<String, dynamic>>.from(d['threats'] as List), mine: 'poltava'),
                      ),
                    ]),
                  );
                },
              ),
              GoRoute(
                path: '/button',
                builder: (_, _) => Padding(
                  padding: const EdgeInsets.only(top: 140, left: 16, right: 16),
                  child: Column(children: [AlertMapButton(onTap: () {})]),
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
