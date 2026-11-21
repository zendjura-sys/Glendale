import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/plus.dart';
import 'package:gamecon/season.dart';

Map<String, dynamic> _level(int n, {bool freeClaimed = false}) => {
      'level': n,
      'cost': 50,
      'total': n * 50,
      'free': n == 1 ? {'type': 'frame', 'value': 'pass_mint', 'name': 'М’ята', 'colors': ['#34d399', '#06b6d4']} : (n == 2 ? {'type': 'xp', 'value': 'xp_100', 'name': '+100 XP', 'xp': 100} : null),
      'plus': n == 1 ? {'type': 'badge', 'value': 'pass_crown', 'name': 'Корона сезону', 'icon': 'crown', 'color': '#f59e0b'} : null,
      'free_claimed': freeClaimed,
      'plus_claimed': false,
    };

Map<String, dynamic> _data({bool plus = false, bool claimed = false}) => {
      'season': {'key': '2026-10', 'title': 'Неонова ніч', 'theme': 'neon', 'colors': ['#1e1b4b', '#4338ca'], 'ends_at': DateTime.now().add(const Duration(days: 3)).toIso8601String()},
      'max_level': 30,
      'points': 75,
      'level': 1,
      'into': 25,
      'need': 50,
      'plus': plus,
      'levels': [for (var i = 1; i <= 30; i++) _level(i, freeClaimed: claimed && i == 1)],
      'inventory': claimed ? [{'type': 'frame', 'value': 'pass_mint', 'name': 'М’ята', 'colors': ['#34d399', '#06b6d4'], 'equippable': true, 'equipped': false}] : [],
    };

void main() {
  testWidgets('пропуск: забрати безкоштовну нагороду, GameCon+ веде в шторку, вдягнути з інвентаря', (tester) async {
    final claims = <String>[];
    var plusOpened = 0;
    Map<String, dynamic>? equipped;
    Widget view(Map<String, dynamic> data) => MaterialApp(
          home: Scaffold(
            body: SeasonPassView(
              data: data,
              onClaim: (level, track) => claims.add('$level:$track'),
              onEquip: (item) => equipped = item,
              onPlus: () => plusOpened++,
              onQuests: () {},
            ),
          ),
        );

    await tester.pumpWidget(view(_data()));
    expect(find.text('Неонова ніч'), findsOneWidget);
    expect(find.text('Рівень 1'), findsOneWidget);
    // Рівень 1 пройдено: безкоштовну можна забрати, преміальна — замкнена без GameCon+.
    await tester.tap(find.text('Забрати').first);
    expect(claims, ['1:free']);
    expect(find.text('Забрати'), findsOneWidget);
    await tester.tap(find.text('GameCon+').first);
    expect(plusOpened, 1);

    await tester.pumpWidget(view(_data(plus: true, claimed: true)));
    await tester.pump();
    expect(find.text('Отримано'), findsOneWidget);
    await tester.tap(find.text('Забрати').first);
    expect(claims.last, '1:plus');
    await tester.scrollUntilVisible(find.text('Вдягнути'), 200, scrollable: find.byType(Scrollable).first);
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -300));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Вдягнути'));
    expect(equipped?['value'], 'pass_mint');
  });

  test('косметика пропуску з картки користувача', () {
    final user = {
      'cosmetics': {'frame': ['#34d399', '#06b6d4'], 'name': ['#38bdf8'], 'badge': {'icon': 'crown', 'color': '#f59e0b', 'name': 'Корона'}},
    };
    expect(avatarFrameOf(user), [const Color(0xFF34D399), const Color(0xFF06B6D4)]);
    expect(nameMarkOf(user)?.name, [const Color(0xFF38BDF8)]);
    expect(PlusMark.of(user), isNull);
    expect(SeasonCosmetics.of(user)?.badgeIcon, 'crown');
    expect(avatarFrameOf({'plus': {'frame': ['#111111']}, ...user}), [const Color(0xFF111111)]);
  });
}
