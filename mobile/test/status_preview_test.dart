// Екран статусу й банер про збій у стрічці — з підставленою відповіддю мосту сайту.
// Знімки — лише локально: GC_SHOTS=dir.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/account.dart';
import 'package:gamecon/shell.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/status.dart';
import 'package:gamecon/theme.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fonts.dart';

Map<String, dynamic> _respond(http.Request request) {
  if (request.url.path.endsWith('/site/status')) {
    return {
      'overall': 'degraded',
      'checked_at': '2026-10-31T18:42:00Z',
      'components': [
        {'key': 'site', 'status': 'operational', 'latency_ms': null},
        {'key': 'database', 'status': 'operational', 'latency_ms': 2},
        {'key': 'cache', 'status': 'operational', 'latency_ms': 1},
        {'key': 'queue', 'status': 'degraded', 'latency_ms': 4},
        {'key': 'storage', 'status': 'operational', 'latency_ms': 3},
      ],
      'active': [
        {
          'id': 3, 'title': 'Сповіщення приходять із затримкою', 'severity': 'minor', 'status': 'identified',
          'updates': [
            {'status': 'identified', 'message': 'Черга фонових задач переповнена — додаємо обробників.', 'at': '2026-10-31T18:30:00Z'},
            {'status': 'investigating', 'message': 'Дивимося, чому push надходять пізно.', 'at': '2026-10-31T18:05:00Z'},
          ],
          'started_at': '2026-10-31T18:05:00Z', 'resolved_at': null,
        },
      ],
      'history': [
        {
          'id': 2, 'title': 'Не вантажилася музика', 'severity': 'major', 'status': 'resolved',
          'updates': [{'status': 'resolved', 'message': 'Сховище файлів знову доступне.', 'at': '2026-10-24T12:40:00Z'}],
          'started_at': '2026-10-24T12:10:00Z', 'resolved_at': '2026-10-24T12:40:00Z',
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

  for (final light in [false, true]) {
    final label = 'status-${light ? 'light' : 'dark'}';
    testWidgets('екран статусу малюється: $label', (tester) async {
      await http.runWithClient(() async {
        SharedPreferences.setMockInitialValues({'whats_new': whatsNewVersion});
        final prefs = await SharedPreferences.getInstance();
        palette = light ? arcticPalette : neonPalette;
        addTearDown(() => palette = neonPalette);
        final session = Session(prefs)
          ..me = {
            'id': 1, 'name': 'Тоні Старк', 'first_name': 'Тоні', 'username': 'tonny', 'role': 'user',
            'incident': {'id': 3, 'title': 'Сповіщення приходять із затримкою', 'severity': 'minor', 'status': 'identified'},
          };
        tester.view.physicalSize = const Size(1170, 2532);
        tester.view.devicePixelRatio = 3;
        tester.view.padding = const FakeViewPadding(top: 120, bottom: 60);
        addTearDown(tester.view.reset);
        final router = GoRouter(initialLocation: '/x', routes: [
          ShellRoute(
            builder: (_, _, child) => AppShell(session: session, player: TrackPlayer()..session = session, child: child),
            routes: [
              GoRoute(path: '/x', builder: (_, _) => const Padding(padding: EdgeInsets.only(top: 140, left: 16, right: 16), child: Column(children: [IncidentBanner()]))),
              GoRoute(path: '/status', builder: (_, _) => const StatusScreen()),
            ],
          ),
        ]);
        final key = GlobalKey();
        await tester.pumpWidget(RepaintBoundary(key: key, child: MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router)));
        await tester.pump(const Duration(milliseconds: 300));
        // Банер веде на екран статусу.
        expect(find.text('Сповіщення приходять із затримкою'), findsOneWidget);
        await tester.tap(find.text('Подробиці'));
        for (var i = 0; i < 8; i++) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        expect(find.text('Частина функцій працює повільніше'), findsOneWidget);
        expect(find.text('Фонові задачі й сповіщення'), findsOneWidget);
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
