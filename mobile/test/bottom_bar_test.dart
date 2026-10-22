// Нижня панель: у «Музиці» вкладки розділу стоять на місці острова (одна панель за раз),
// а міні-плеєр — завжди над панеллю.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/account.dart';
import 'package:gamecon/music_home.dart';
import 'package:gamecon/player_view.dart';
import 'package:gamecon/shell.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:gamecon/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Видимі нижні панелі: острів і вкладки «Музики» (схована панель має прозорість 0).
List<String> _visibleBars(WidgetTester tester) => [
      for (final key in const ['bottom-bar-nav', 'bottom-bar-music'])
        for (final w in tester.widgetList<AnimatedOpacity>(find.byKey(ValueKey(key))))
          if (w.opacity > 0) key,
    ];

void main() {
  for (final light in [false, true]) {
    testWidgets('у «Музиці» одна нижня панель, міні-плеєр над нею (${light ? 'світла' : 'темна'})', (tester) async {
      await http.runWithClient(() async {
        SharedPreferences.setMockInitialValues({'whats_new': whatsNewVersion});
        final prefs = await SharedPreferences.getInstance();
        palette = light ? arcticPalette : neonPalette;
        addTearDown(() => palette = neonPalette);
        final session = Session(prefs)..me = {'id': 1, 'name': 'Тоні Старк', 'first_name': 'Тоні', 'username': 'tonny', 'role': 'user'};
        final player = TrackPlayer()..session = session;
        player.queue = [QueueTrack(id: 1, url: 'https://example.com/1.mp3', title: 'Neon Skyline', artist: 'Nightdrive Kyiv')];
        player.index = 0;
        tester.view.physicalSize = const Size(1170, 2532);
        tester.view.devicePixelRatio = 3;
        tester.view.padding = const FakeViewPadding(top: 120, bottom: 60);
        addTearDown(tester.view.reset);
        final router = GoRouter(initialLocation: '/feed', routes: [
          ShellRoute(
            builder: (_, _, child) => AppShell(session: session, player: player, child: child),
            routes: [
              GoRoute(path: '/feed', builder: (_, _) => const ScreenScroll(children: [SizedBox(height: 200)])),
              GoRoute(path: '/music', builder: (_, _) => const MusicHub()),
            ],
          ),
        ]);
        await tester.pumpWidget(MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router));
        await tester.pump(const Duration(milliseconds: 400));

        // Стрічка: лише острів, плеєр над ним.
        expect(_visibleBars(tester), ['bottom-bar-nav']);
        final island = tester.getRect(find.byKey(const ValueKey('bottom-bar-nav')));
        expect(tester.getRect(find.byType(MiniPlayer)).bottom, lessThanOrEqualTo(island.top + 0.5));

        // «Музика»: острів ховається, вкладки розділу — на тому самому місці й того самого розміру.
        router.go('/music');
        for (var i = 0; i < 8; i++) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        expect(_visibleBars(tester), ['bottom-bar-music']);
        expect(find.text('Медіатека'), findsWidgets);
        final tabs = tester.getRect(find.byKey(const ValueKey('bottom-bar-music')));
        expect(tabs.bottom, closeTo(island.bottom, 0.5));
        expect(tabs.height, closeTo(island.height, 0.5));
        expect(tester.getRect(find.byType(MiniPlayer)).bottom, lessThanOrEqualTo(tabs.top + 0.5));

        // Назад у стрічку — знову острів.
        router.go('/feed');
        for (var i = 0; i < 8; i++) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        expect(_visibleBars(tester), ['bottom-bar-nav']);
        await tester.pumpWidget(const SizedBox());
      }, () => MockClient((request) async => http.Response(jsonEncode({'home': {}}), 200, headers: {'content-type': 'application/json; charset=utf-8'})));
    });
  }
}
