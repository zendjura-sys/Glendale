import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/plus.dart';

void main() {
  test('читає оформлення GameCon+ з картки користувача', () {
    final mark = PlusMark.of({
      'plus': {'name': ['#4f8bff', '#a855f7'], 'frame': ['#f59e0b', 'bad'], 'fx': 'flow'},
    })!;
    expect(mark.name, [const Color(0xFF4F8BFF), const Color(0xFFA855F7)]);
    expect(mark.frame, [const Color(0xFFF59E0B)]);
    expect(mark.fx, 'flow');
    expect(PlusMark.of({'plus': null}), isNull);
    expect(PlusMark.from({'fx': 'spin'})!.fx, isNull);
  });

  test('кольори шапки: палітра сторінки, далі колір ніку', () {
    expect(plusHeaderColors({'accent': ['#111111']}), [const Color(0xFF111111)]);
    expect(plusHeaderColors({'plus': {'name': ['#222222']}}).first, const Color(0xFF222222));
    expect(plusHeaderColors({}).length, 3);
  });

  testWidgets('анімований нік, значок і ефекти шапки малюються', (tester) async {
    final user = {
      'name': 'Tonny Stark',
      'is_verified': true,
      'plus': {'name': ['#4f8bff', '#a855f7'], 'fx': 'shine'},
    };
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Column(children: [
          PlusNameRow(user: user, style: const TextStyle(fontSize: 15), animate: true),
          const SizedBox(width: 200, height: 80, child: PlusHeaderGlow(effect: 'aurora', colors: [Colors.red, Colors.blue])),
          const SizedBox(width: 200, height: 80, child: PlusHeaderGlow(effect: 'rim', colors: [Colors.red, Colors.blue])),
        ]),
      ),
    ));
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('Tonny Stark'), findsOneWidget);
    expect(find.byType(PlusBadge), findsOneWidget);
    expect(find.byType(ShaderMask), findsWidgets);
  });
}
