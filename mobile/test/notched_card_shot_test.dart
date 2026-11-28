// Скриншот карток з вирізом (NotchedCard) у темній і світлій темі — для огляду дизайну.
// Запуск: SHOTS=1 flutter test test/notched_card_shot_test.dart --update-goldens
// Без SHOTS тест пропускається (знімки залежать від шрифтів і не порівнюються в CI).
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/core/widgets/notched_card.dart';
import 'package:gamecon/events.dart';
import 'package:gamecon/people.dart';
import 'package:gamecon/posts.dart';
import 'package:gamecon/state.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:gamecon/theme.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

Future<void> _fonts() async {
  final onest = FontLoader('Onest');
  for (final w in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
    onest.addFont(rootBundle.load('fonts/Onest-$w.ttf'));
  }
  await onest.load();
  // Значки Lucide (пакетний шрифт) — інакше в тесті замість іконок квадратики.
  final lucide = FontLoader('packages/lucide_icons_flutter/Lucide')..addFont(rootBundle.load('packages/lucide_icons_flutter/assets/lucide.ttf'));
  await lucide.load();
}

Widget _gallery() {
  Widget title(IconData icon, String text) => Row(children: [
        Icon(icon, size: 16, color: primary),
        const SizedBox(width: 8),
        Flexible(child: Text(text, style: body(15, weight: FontWeight.w700), overflow: TextOverflow.ellipsis)),
      ]);
  Widget person(String name, String sub) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(children: [
          CircleAvatar(radius: 17, backgroundColor: primary.withValues(alpha: 0.35), child: Text(name[0], style: body(13, weight: FontWeight.w700))),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(name, style: body(14, weight: FontWeight.w600)), Text(sub, style: body(12, color: muted))])),
        ]),
      );
  return ListView(padding: const EdgeInsets.all(14), children: [
    NotchedCard(
      title: Row(children: [
        CircleAvatar(radius: 18, backgroundColor: primary.withValues(alpha: 0.35), child: Text('О', style: body(14, weight: FontWeight.w700))),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Олена Коваленко', style: body(14, weight: FontWeight.w700)), Text('20 листопада о 12:15', style: body(12, color: muted))])),
      ]),
      actions: [Icon(LucideIcons.ellipsis, size: 18, color: muted)],
      badge: const NotchBadge('Допис'),
      child: Text('Якщо ще не бачили «Sintel» — це must watch на вечір. Тільки готуйте серветки 🐉', style: body(14)),
    ),
    const SizedBox(height: 12),
    NotchedCard(
      title: title(LucideIcons.target, 'Завдання дня'),
      badge: NotchBadge('Завдання', dot: primary),
      child: Text('2 з 4 виконано · +40 XP до рівня', style: body(13, color: soft)),
    ),
    const SizedBox(height: 12),
    NotchedCard(
      title: title(LucideIcons.radio, 'Зараз онлайн'),
      badge: const NotchBadge('11', dot: Color(0xFF3EE0A8)),
      child: SizedBox(
        height: 44,
        child: Row(children: [for (final n in ['Катерина', 'Максим', 'Софія', 'Дмитро', 'Юлія']) Padding(padding: const EdgeInsets.only(right: 10), child: CircleAvatar(radius: 21, backgroundColor: primary.withValues(alpha: 0.3), child: Text(n[0], style: body(14, weight: FontWeight.w700))))]),
      ),
    ),
    const SizedBox(height: 12),
    NotchedCard(
      title: title(LucideIcons.sparkles, 'Можливо, ви знайомі'),
      actions: [Padding(padding: const EdgeInsets.only(top: 2), child: Text('Усі', style: body(12, color: muted)))],
      badge: const NotchBadge('Люди'),
      child: Column(children: [person('Ірина Павленко', '3 спільних друзі'), person('Богдан Руденко', 'Тернопіль')]),
    ),
    const SizedBox(height: 12),
    NotchedCard(
      title: title(LucideIcons.calendarDays, 'Турнір з дрифту'),
      badge: const NotchBadge('Подія', dot: Color(0xFFFF7A55)),
      child: Text('Сб, 28 листопада · 20:00 · Quant RP\nЗбір біля мерії, беріть рацію.', style: body(13, color: soft)),
    ),
  ]);
}

void main() {
  final shots = Platform.environment.containsKey('SHOTS');
  for (final light in [false, true]) {
    testWidgets('NotchedCard — ${light ? 'світла' : 'темна'} тема', skip: !shots, (tester) async {
      await _fonts();
      palette = light ? arcticPalette : neonPalette;
      tester.view.physicalSize = const Size(412 * 2, 900 * 2);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: gameConTheme(),
        home: Scaffold(backgroundColor: voidColor, body: RepaintBoundary(key: const Key('shot'), child: ColoredBox(color: voidColor, child: _gallery()))),
      ));
      await tester.pumpAndSettle();
      await expectLater(find.byKey(const Key('shot')), matchesGoldenFile('shots/notched_card_${light ? 'light' : 'dark'}.png'));
    });
  }
  testWidgets('NotchedCard у справжніх екранах: допис і подія', skip: !shots, (tester) async {
    await _fonts();
    palette = neonPalette;
    SharedPreferences.setMockInitialValues({});
    final session = Session(await SharedPreferences.getInstance());
    tester.view.physicalSize = const Size(412 * 2, 720 * 2);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    final now = DateTime.now().toUtc();
    final post = {
      'id': 1,
      'body': 'Нарешті пройшов Elden Ring на 100%. 168 годин, 0 шкодувань. Хто наступний — Malenia чи Messmer?',
      'author': {'id': 2, 'name': 'Марк Шевченко', 'username': 'mark', 'is_online': true, 'is_verified': true},
      'created_at': now.subtract(const Duration(hours: 3)).toIso8601String(),
      'visibility': 'public',
      'likes_count': 7,
      'comments_count': 2,
      'views_count': 4050,
      'attachments': [],
    };
    final event = {
      'key': 'server:1',
      'kind': 'server',
      'title': 'Турнір з дрифту',
      'type_label': 'Турнір',
      'description': 'Збір біля мерії, беріть рацію.',
      'starts_at': now.add(const Duration(days: 1)).toIso8601String(),
      'where': {'name': 'Quant RP', 'url': '/servers/quant-rp'},
      'host': 'GameCon',
      'status': 'going',
      'going_count': 12,
      'can_decline': true,
    };
    await tester.pumpWidget(MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: gameConTheme(),
      home: AppScope(
        session: session,
        player: TrackPlayer(),
        child: Scaffold(
          backgroundColor: voidColor,
          body: RepaintBoundary(
            key: const Key('real'),
            child: ColoredBox(
              color: voidColor,
              child: ListView(padding: const EdgeInsets.all(14), children: [
                PostCard(post: post),
                EventTile(event: event, onRsvp: (_) {}),
              ]),
            ),
          ),
        ),
      ),
    ));
    await tester.pump(const Duration(milliseconds: 600));
    await expectLater(find.byKey(const Key('real')), matchesGoldenFile('shots/notched_card_real.png'));
  });

  testWidgets('Сітка людей з великим шрифтом: кнопка не обрізається', skip: !shots, (tester) async {
    await _fonts();
    palette = neonPalette;
    SharedPreferences.setMockInitialValues({});
    final session = Session(await SharedPreferences.getInstance());
    tester.view.physicalSize = const Size(412 * 2, 900 * 2);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    final people = [
      for (final (n, m, c) in [('Вячеслав Скоблей', 1, null), ('Google Access', 4, null), ('брендон Ovsyanka', 0, 'Миколаїв'), ('Morgan Kraken', 4, null), ('Hikaro Haruko', 2, null), ('olof Reex', 3, null)])
        {'id': n.hashCode, 'name': n, 'username': n.toLowerCase().replaceAll(' ', '.'), 'mutual': m, 'city': c, 'relation': 'friends', 'is_online': false},
    ];
    await tester.pumpWidget(MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: gameConTheme(),
      builder: (context, child) => MediaQuery(data: MediaQuery.of(context).copyWith(textScaler: const TextScaler.linear(1.35)), child: child!),
      home: AppScope(
        session: session,
        player: TrackPlayer(),
        child: Scaffold(
          backgroundColor: voidColor,
          body: RepaintBoundary(
            key: const Key('people'),
            child: ColoredBox(color: voidColor, child: ListView(padding: const EdgeInsets.all(14), children: [TwoColumns(children: [for (final u in people) PersonCard(user: u)])])),
          ),
        ),
      ),
    ));
    await tester.pump(const Duration(milliseconds: 600));
    expect(tester.takeException(), isNull);
    await expectLater(find.byKey(const Key('people')), matchesGoldenFile('shots/people_grid_large_font.png'));
  });

  test('NotchedCard: шлях з вирізом замкнений і не виходить за межі картки', () {
    const r = Rect.fromLTWH(0, 0, 300, 120);
    final path = notchedCardPath(r, notch: const Size(70, 34), radius: 16);
    expect(path.getBounds().width, closeTo(300, 0.5));
    expect(path.getBounds().height, closeTo(120, 0.5));
    // Точка всередині вирізу — поза карткою, нижче вирізу — всередині.
    expect(path.contains(const Offset(290, 10)), isFalse);
    expect(path.contains(const Offset(290, 60)), isTrue);
    expect(path.contains(const Offset(20, 10)), isTrue);
  });
}
