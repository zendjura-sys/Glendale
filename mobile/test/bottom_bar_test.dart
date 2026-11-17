// Нижня панель і шапка: у «Музиці» лишаються острів і TopBar (як на сайті);
// розділи музики — пігулками зверху в контенті (`MusicNav`).
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/account.dart';
import 'package:gamecon/chrome.dart';
import 'package:gamecon/music_home.dart';
import 'package:gamecon/music_nav.dart';
import 'package:gamecon/player_view.dart';
import 'package:gamecon/shell.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:gamecon/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Видимі нижні панелі: острів (схована панель має прозорість 0).
List<String> _visibleBars(WidgetTester tester) => [
      for (final key in const ['bottom-bar-nav'])
        for (final w in tester.widgetList<Opacity>(find.descendant(of: find.byKey(ValueKey(key)), matching: find.byType(Opacity))).take(1))
          if (w.opacity > 0) key,
    ];

void main() {
  test('привітання на Головній «Музики» — за часом доби, з ім\'ям, як на сайті', () {
    final me = {'name': 'Тоні Старк', 'first_name': 'Тоні'};
    expect(musicGreeting(me, DateTime(2026, 1, 1, 7)), 'Доброго ранку, Тоні');
    expect(musicGreeting(me, DateTime(2026, 1, 1, 13)), 'Добрий день, Тоні');
    expect(musicGreeting(me, DateTime(2026, 1, 1, 20)), 'Добрий вечір, Тоні');
    expect(musicGreeting(me, DateTime(2026, 1, 1, 2)), 'Доброї ночі, Тоні');
    expect(musicGreeting({'name': 'Тоні Старк'}, DateTime(2026, 1, 1, 23)), 'Доброї ночі, Тоні Старк');
  });

  for (final light in [false, true]) {
    testWidgets('у «Музиці» острів і TopBar лишаються, пігулки зверху (${light ? 'світла' : 'темна'})', (tester) async {
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
              GoRoute(path: '/music/radio', builder: (_, _) => const MusicHub(tab: 'radio')),
            ],
          ),
        ]);
        await tester.pumpWidget(MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router));
        await tester.pump(const Duration(milliseconds: 400));

        // Стрічка: острів, плеєр над ним.
        expect(_visibleBars(tester), ['bottom-bar-nav']);
        final island = tester.getRect(find.byKey(const ValueKey('bottom-bar-nav')));
        expect(tester.getRect(find.byType(MiniPlayer)).bottom, lessThanOrEqualTo(island.top + 0.5));
        expect(find.byType(TopBar), findsOneWidget);

        // «Музика»: той самий острів і TopBar; пігулки розділу — зверху.
        router.go('/music');
        for (var i = 0; i < 8; i++) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        expect(_visibleBars(tester), ['bottom-bar-nav']);
        expect(find.byType(TopBar), findsOneWidget);
        expect(find.byType(MusicNav), findsOneWidget);
        expect(find.text('Медіатека'), findsWidgets);
        expect(find.text('Чарти'), findsWidgets);
        expect(find.text('Завантажити'), findsWidgets);
        expect(tester.getRect(find.byType(MiniPlayer)).bottom, lessThanOrEqualTo(island.top + 0.5));

        // Пігулка «Радіо» веде на /music/radio.
        await tester.tap(find.descendant(of: find.byType(MusicNav), matching: find.text('Радіо')));
        for (var i = 0; i < 8; i++) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        expect(router.routerDelegate.currentConfiguration.uri.path, '/music/radio');
        expect(find.byType(MusicNav), findsOneWidget);
        expect(MusicNav.activeFor('/music/radio', '/music/radio'), isTrue);

        // Назад у стрічку — знову острів і TopBar.
        router.go('/feed');
        for (var i = 0; i < 8; i++) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        expect(_visibleBars(tester), ['bottom-bar-nav']);
        expect(find.byType(TopBar), findsOneWidget);
        expect(find.byType(MusicNav), findsNothing);
        await tester.pumpWidget(const SizedBox());
      }, () => MockClient((request) async {
        final path = Uri.parse(request.url.toString()).path;
        final body = path.contains('/music/radio') ? {'data': {}} : {'home': {}};
        return http.Response(jsonEncode(body), 200, headers: {'content-type': 'application/json; charset=utf-8'});
      }));
    });
  }

  test('MusicNav.activeFor — як exact/prefix на сайті', () {
    expect(MusicNav.activeFor('/music', '/music', exact: true), isTrue);
    expect(MusicNav.activeFor('/music/new', '/music', exact: true), isFalse);
    expect(MusicNav.activeFor('/music/library/songs', '/music/library'), isTrue);
    expect(MusicNav.activeFor('/music/playlists/1', '/music/library'), isTrue);
    expect(MusicNav.activeFor('/music/charts', '/music/charts'), isTrue);
  });
}
