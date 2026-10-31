// Знімки оболонки (шапка, острів, бічне меню) для перевірки вигляду (лише локально: GC_SHOTS=dir).
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/account.dart';
import 'package:gamecon/phone.dart';
import 'package:gamecon/seasonal.dart';
import 'package:gamecon/settings.dart';
import 'package:gamecon/shell.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:gamecon/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fonts.dart';

class _Feed extends StatelessWidget {
  const _Feed();

  @override
  Widget build(BuildContext context) {
    return ScreenScroll(children: [
      for (var i = 0; i < 4; i++)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Glass(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Avatar(name: 'Гравець $i', size: 40),
                const SizedBox(width: 10),
                Text('Запис $i', style: body(15, weight: FontWeight.w600)),
              ]),
              const SizedBox(height: 8),
              Text('Текст запису в стрічці, щоб видно було, як картка лежить на тлі.', style: body(14, color: soft)),
              const SizedBox(height: 60),
            ]),
          ),
        ),
    ]);
  }
}

void main() {
  final out = Platform.environment['GC_SHOTS'];

  setUpAll(() async {
    if (out == null) return;
    await loadTestFonts();
  });

  // Сезонні прикраси (Хелловін, Новий рік) у стрічці телефона — темна й світла теми.
  for (final season in ['halloween', 'newyear']) {
    for (final light in [false, true]) {
      final label = 'season-$season-${light ? 'light' : 'dark'}';
      testWidgets('сезонні прикраси малюються: $label', (tester) async {
        SharedPreferences.setMockInitialValues({'whats_new': whatsNewVersion});
        final prefs = await SharedPreferences.getInstance();
        palette = light ? arcticPalette : neonPalette;
        addTearDown(() => palette = neonPalette);
        final session = Session(prefs)
          ..me = {'id': 1, 'name': 'Тоні Старк', 'first_name': 'Тоні', 'username': 'tonny', 'role': 'admin', 'email': 'tony@example.com', 'season': season}
          ..unreadChats = 3
          ..unreadNotifications = 2;
        tester.view.physicalSize = const Size(1170, 2532);
        tester.view.devicePixelRatio = 3.0;
        tester.view.padding = const FakeViewPadding(top: 120, bottom: 60);
        addTearDown(tester.view.reset);
        addTearDown(() => currentSeason.value = null);
        final router = GoRouter(initialLocation: '/feed', routes: [
          ShellRoute(
            builder: (_, _, child) => AppShell(session: session, player: TrackPlayer(), child: child),
            routes: [GoRoute(path: '/feed', builder: (_, _) => const _Feed())],
          ),
        ]);
        final key = GlobalKey();
        await tester.pumpWidget(RepaintBoundary(key: key, child: MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router)));
        await tester.pump(const Duration(milliseconds: 300));
        expect(currentSeason.value, season);
        // Картинки прикрас і кажан вантажаться асинхронно — даємо їм декодуватися.
        await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 400)));
        await tester.pump(const Duration(milliseconds: 100));
        await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
        await tester.pump(const Duration(milliseconds: 100));
        if (out != null) {
          await tester.runAsync(() async {
            final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
            final image = await boundary.toImage(pixelRatio: 1);
            final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
            File('$out/$label.png').writeAsBytesSync(bytes!.buffer.asUint8List());
          });
        }
        await tester.pumpWidget(const SizedBox());
      });
    }
  }

  for (final (name, size, ratio) in [('phone', const Size(1170, 2532), 3.0), ('tablet', const Size(2360, 1640), 2.0)]) {
    for (final light in [false, true]) {
      for (final open in name == 'phone' ? [false, true] : [false]) {
        final label = '$name-${light ? 'light' : 'dark'}${open ? '-menu' : ''}';
        testWidgets('оболонка малюється: $label', (tester) async {
          SharedPreferences.setMockInitialValues({'whats_new': whatsNewVersion});
          final prefs = await SharedPreferences.getInstance();
          palette = light ? arcticPalette : neonPalette;
          addTearDown(() => palette = neonPalette);
          final session = Session(prefs)
            ..me = {'id': 1, 'name': 'Тоні Старк', 'first_name': 'Тоні', 'username': 'tonny', 'role': 'admin', 'email': 'tony@example.com'}
            ..unreadChats = 3
            ..unreadNotifications = 2;
          tester.view.physicalSize = size;
          tester.view.devicePixelRatio = ratio;
          tester.view.padding = const FakeViewPadding(top: 120, bottom: 60);
          addTearDown(tester.view.reset);
          final router = GoRouter(initialLocation: '/feed', routes: [
            ShellRoute(
              builder: (_, _, child) => AppShell(session: session, player: TrackPlayer(), child: child),
              routes: [GoRoute(path: '/feed', builder: (_, _) => const _Feed())],
            ),
          ]);
          final key = GlobalKey();
          await tester.pumpWidget(RepaintBoundary(key: key, child: MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router)));
          await tester.pump(const Duration(milliseconds: 300));
          expect(find.text('Новини'), findsWidgets);
          if (open) {
            await tester.tap(find.bySemanticsLabel('Меню'));
            await tester.pumpAndSettle(const Duration(milliseconds: 100));
            expect(find.text('Налаштувати нижню панель'), findsOneWidget);
          }
          if (out != null) {
            await tester.runAsync(() async {
              final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
              final image = await boundary.toImage(pixelRatio: 1);
              final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
              File('$out/shell-$label.png').writeAsBytesSync(bytes!.buffer.asUint8List());
            });
          }
          await tester.pumpWidget(const SizedBox());
        });
      }
    }
  }

  testWidgets('налаштування: тема видно одразу, зберігається панеллю змін', (tester) async {
    SharedPreferences.setMockInitialValues({'whats_new': whatsNewVersion});
    final session = Session(await SharedPreferences.getInstance())..me = {'id': 1, 'name': 'Тоні Старк', 'first_name': 'Тоні', 'username': 'tonny'};
    palette = neonPalette;
    addTearDown(() => palette = neonPalette);
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
    addTearDown(tester.view.reset);
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
    final router = GoRouter(initialLocation: '/settings', routes: [
      ShellRoute(
        builder: (_, _, child) => AppShell(session: session, player: TrackPlayer(), child: child),
        routes: [GoRoute(path: '/settings', builder: (_, _) => const SettingsScreen(initialTab: 'appearance'))],
      ),
    ]);
    final key = GlobalKey();
    await tester.pumpWidget(RepaintBoundary(key: key, child: MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router)));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Неоновий синій'), findsOneWidget);
    expect(find.text('Скасувати'), findsOneWidget);
    expect(tester.widget<PendingBar>(find.byType(PendingBar)).count, 0);

    await tester.tap(find.text('Крижана Арктика'));
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(palette.isLight, isTrue);
    expect(find.text('1 зміна'), findsOneWidget);
    if (out != null) {
      await tester.runAsync(() async {
        final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
        final image = await boundary.toImage(pixelRatio: 1);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        File('$out/settings-appearance.png').writeAsBytesSync(bytes!.buffer.asUint8List());
      });
    }

    await tester.tap(find.text('Скасувати'));
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(palette.isLight, isFalse);
    expect(tester.widget<PendingBar>(find.byType(PendingBar)).count, 0);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('тости угорі, як на сайті: тип, хрестик і смужка часу', (tester) async {
    SharedPreferences.setMockInitialValues({'whats_new': whatsNewVersion});
    final session = Session(await SharedPreferences.getInstance())..me = {'id': 1, 'name': 'Тоні Старк', 'first_name': 'Тоні', 'username': 'tonny'};
    palette = arcticPalette;
    addTearDown(() => palette = neonPalette);
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final router = GoRouter(initialLocation: '/feed', routes: [
      ShellRoute(
        builder: (_, _, child) => AppShell(session: session, player: TrackPlayer(), child: child),
        routes: [GoRoute(path: '/feed', builder: (_, _) => const _Feed())],
      ),
    ]);
    final key = GlobalKey();
    await tester.pumpWidget(RepaintBoundary(key: key, child: MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router)));
    await tester.pump(const Duration(milliseconds: 300));
    final context = tester.element(find.byType(_Feed));
    toast(context, 'Вигляд збережено.');
    toast(context, Exception('Не вдалося зберегти зміни.'));
    toast(context, 'Нові функції вже доступні.', kind: ToastKind.info);
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 1200));
    expect(find.text('Вигляд збережено.'), findsOneWidget);
    expect(find.text('Не вдалося зберегти зміни.'), findsOneWidget);
    if (out != null) {
      await tester.runAsync(() async {
        final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
        final image = await boundary.toImage(pixelRatio: 1);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        File('$out/toasts-app.png').writeAsBytesSync(bytes!.buffer.asUint8List());
      });
    }
    // Самі зникають, коли спливе час.
    await tester.pump(const Duration(seconds: 5));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Вигляд збережено.'), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('телефон: набирач, мій номер, подарунок і дзвінки', (tester) async {
    SharedPreferences.setMockInitialValues({'whats_new': whatsNewVersion});
    final session = Session(await SharedPreferences.getInstance())..me = {'id': 1, 'name': 'Тоні Старк', 'first_name': 'Тоні', 'username': 'tonny'};
    palette = neonPalette;
    tester.view.physicalSize = const Size(1170, 4200);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final friend = {'id': 2, 'name': 'Пеппер Поттс', 'first_name': 'Пеппер', 'username': 'pepper'};
    final data = {
      'phone': {'number': '+555 (05) 777-45-45', 'tier': 'gold', 'kind': 'random'},
      'codes': {'premium': '777', 'random': '555'},
      'chances': {'bronze': 5, 'silver': 1, 'gold': 0.2, 'platinum': 0.05, 'diamond': 0.01},
      'nextRandomAt': null,
      'cooldownDays': 7,
      'privacy': 'friends',
      'visible': true,
      'incoming': [
        {'id': 9, 'kind': 'gift', 'phone': {'number': '+777 (77) 777-77-77', 'tier': 'diamond'}, 'from': friend, 'to': {}},
      ],
      'outgoing': [],
      'gifts': [],
      'friends': [friend],
      'history': [
        {'id': 1, 'direction': 'missed', 'at': '2026-10-18T19:20:00Z', 'seconds': null, 'conversation_id': 4, 'user': friend, 'phone': {'number': '+555 (12) 345-67-89', 'tier': 'regular'}},
        {'id': 2, 'direction': 'out', 'at': '2026-10-18T18:02:00Z', 'seconds': 125, 'conversation_id': 4, 'user': friend, 'phone': null},
      ],
    };
    final router = GoRouter(initialLocation: '/phone', routes: [
      ShellRoute(
        builder: (_, _, child) => AppShell(session: session, player: TrackPlayer(), child: child),
        routes: [GoRoute(path: '/phone', builder: (_, _) => PhoneScreen(dial: '+77705', preview: data))],
      ),
    ]);
    final key = GlobalKey();
    await tester.pumpWidget(RepaintBoundary(key: key, child: MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router)));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Мій номер'), findsOneWidget);
    expect(find.text('Пеппер дарує вам номер'), findsOneWidget);
    expect(find.text('+777 (05)'), findsOneWidget);
    await tester.tap(find.text('1'));
    await tester.pump();
    expect(find.text('+777 (05) 1'), findsOneWidget);
    if (out != null) {
      await tester.runAsync(() async {
        final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
        final image = await boundary.toImage(pixelRatio: 1);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        File('$out/phone.png').writeAsBytesSync(bytes!.buffer.asUint8List());
      });
    }
    await tester.pumpWidget(const SizedBox());
  });
}
