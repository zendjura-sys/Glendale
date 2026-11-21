import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/teammates.dart';

void main() {
  testWidgets('тиммейт: відсоток, причини й дії', (tester) async {
    var messaged = 0;
    var invited = 0;
    final match = {
      'user': {'id': 2, 'name': 'Богдан Руденко', 'username': 'bogdan', 'avatar_url': null},
      'score': 97,
      'reasons': [
        {'type': 'game', 'name': 'Counter-Strike 2'},
        {'type': 'time', 'times': ['evening']},
        {'type': 'mic'},
      ],
      'games': ['Counter-Strike 2', 'Dota 2'],
      'skill': 'mid',
      'mic': true,
      'note': 'Шукаю стак на ранкед',
      'looking': true,
      'friend': false,
    };
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: TeammateTile(match: match, onMessage: () => messaged++, onInvite: () => invited++))));
    expect(find.text('97%'), findsOneWidget);
    expect(find.text('Обидва граєте в Counter-Strike 2'), findsOneWidget);
    expect(find.text('Граєте: ввечері'), findsOneWidget);
    expect(find.text('Шукає зараз'), findsOneWidget);
    await tester.tap(find.text('Написати'));
    await tester.tap(find.text('Покликати в паті'));
    expect((messaged, invited), (1, 1));
  });
}
