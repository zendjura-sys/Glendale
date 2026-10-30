// Нижня панель: у «Музиці» вкладки розділу стоять на місці острова (одна панель за раз),
// а міні-плеєр — завжди над панеллю.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/core/widgets/arctic_glass/arctic_glass.dart';
import 'package:gamecon/account.dart';
import 'package:gamecon/chrome.dart';
import 'package:gamecon/music_home.dart';
import 'package:gamecon/player_view.dart';
import 'package:gamecon/shell.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:gamecon/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Видимі нижні панелі: острів і вкладки «Музики» (схована панель має прозорість 0).
List<String> _visibleBars(WidgetTester tester) => [
      for (final key in const ['bottom-bar-nav', 'bottom-bar-music'])
        for (final w in tester.widgetList<AnimatedOpacity>(find.byKey(ValueKey(key))))
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
        expect(tabs.left, closeTo(island.left, 0.5));
        expect(tabs.width, closeTo(island.width, 0.5));
        // Пошук — п'ята вкладка всередині тієї самої капсули, окремої круглої кнопки немає.
        expect(find.descendant(of: find.byKey(const ValueKey('bottom-bar-music')), matching: find.text('Пошук')), findsOneWidget);
        expect(find.descendant(of: find.byKey(const ValueKey('bottom-bar-music')), matching: find.byType(MatteGlass)), findsOneWidget);
        expect(tester.getRect(find.byType(MiniPlayer)).bottom, lessThanOrEqualTo(tabs.top + 0.5));

        // Обидві панелі й міні-плеєр — скляний док однакової скругленості (капсула: радіус = половина висоти).
        double radiusOf(Finder of) => tester.widget<ArcticDockSurface>(find.descendant(of: of, matching: find.byType(ArcticDockSurface)).first).radius;
        final musicGlass = find.descendant(of: find.byKey(const ValueKey('bottom-bar-music')), matching: find.byType(ArcticDockSurface)).first;
        expect(radiusOf(find.byKey(const ValueKey('bottom-bar-music'))), closeTo(tester.getSize(musicGlass).height / 2, 0.5));
        expect(radiusOf(find.byKey(const ValueKey('bottom-bar-nav'))), radiusOf(find.byKey(const ValueKey('bottom-bar-music'))));
        expect(radiusOf(find.byType(MiniPlayer)), closeTo(tester.getSize(find.descendant(of: find.byType(MiniPlayer), matching: find.byType(ArcticDockSurface))).height / 2, 0.5));

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

  testWidgets('шапка «Музики»: «Назад» на попередній маршрут, дзвіночок і аватар із меню розділів', (tester) async {
    await http.runWithClient(() async {
      SharedPreferences.setMockInitialValues({'whats_new': whatsNewVersion});
      final prefs = await SharedPreferences.getInstance();
      final session = Session(prefs)..me = {'id': 1, 'name': 'Тоні Старк', 'first_name': 'Тоні', 'username': 'tonny', 'role': 'user'};
      final player = TrackPlayer()..session = session;
      tester.view.physicalSize = const Size(1170, 2532);
      tester.view.devicePixelRatio = 3;
      tester.view.padding = const FakeViewPadding(top: 120, bottom: 60);
      addTearDown(tester.view.reset);
      MusicTopBar.exit = null;
      final router = GoRouter(initialLocation: '/people', routes: [
        ShellRoute(
          builder: (_, _, child) => AppShell(session: session, player: player, child: child),
          routes: [
            GoRoute(path: '/feed', builder: (_, _) => const ScreenScroll(children: [SizedBox(height: 200)])),
            GoRoute(path: '/people', builder: (_, _) => const ScreenScroll(children: [SizedBox(height: 200)])),
            GoRoute(path: '/music', builder: (_, _) => const MusicHub(), routes: [GoRoute(path: 'radio', builder: (_, _) => const MusicHub(tab: 'radio'))]),
          ],
        ),
      ]);
      Future<void> settle() async {
        for (var i = 0; i < 8; i++) {
          await tester.pump(const Duration(milliseconds: 100));
        }
      }

      await tester.pumpWidget(MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router));
      await settle();
      expect(find.byType(TopBar), findsOneWidget);
      expect(find.byType(MusicTopBar), findsNothing);

      // У «Музиці» (і на її підсторінках) — своя шапка: «Назад» ліворуч, дзвіночок і аватар праворуч.
      router.go('/music');
      await settle();
      router.go('/music/radio');
      await settle();
      expect(find.byType(TopBar), findsNothing);
      final header = find.byType(MusicTopBar);
      expect(header, findsOneWidget);
      final menu = find.byKey(const ValueKey('music-menu'));
      final bell = find.descendant(of: header, matching: find.byIcon(LucideIcons.bell));
      final back = find.descendant(of: header, matching: find.text('Назад'));
      expect(menu, findsOneWidget);
      expect(bell, findsOneWidget);
      expect(back, findsOneWidget);
      expect(find.descendant(of: header, matching: find.byIcon(LucideIcons.chevronLeft)), findsOneWidget);
      expect(tester.getCenter(back).dx, lessThan(tester.getCenter(bell).dx));
      expect(tester.getCenter(bell).dx, lessThan(tester.getCenter(menu).dx));

      // Аватар відкриває меню розділів — те саме, що в острові.
      await tester.tap(menu);
      await settle();
      expect(find.byType(MenuContent), findsOneWidget);
      expect(find.text('Налаштування'), findsWidgets);
      Navigator.of(tester.element(find.byType(MenuContent))).pop();
      await settle();
      expect(find.byType(MenuContent), findsNothing);

      // «Назад» виходить із «Музики» туди, звідки прийшли.
      await tester.tap(back);
      await settle();
      expect(router.routerDelegate.currentConfiguration.uri.path, '/people');
      expect(find.byType(MusicTopBar), findsNothing);
      expect(find.byType(TopBar), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    }, () => MockClient((request) async => http.Response(jsonEncode({'home': {}}), 200, headers: {'content-type': 'application/json; charset=utf-8'})));
  });
}
