import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/game_card.dart';

void main() {
  testWidgets('Game Card: довгі назви без обрізання, рівень, сім’я й статистика', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: GameCardBody(
            profile: const {'name': 'Катерина Петренко-Коваленко', 'username': 'tonny', 'avatar_url': null},
            game: const {
              'level': 7,
              'title': 'Завсідник',
              'badges': {'earned': 5, 'total': 23},
              'since': 2026,
              'family': {'name': 'Scaletta Family', 'tag': 'SCL'},
              'clan': null,
              'season': {'level': 4, 'max': 30},
              'games': ['Grand Theft Auto V', 'Counter-Strike 2'],
              'servers': [],
              'artist': 'AC/DC',
            },
            url: 'https://gamecon.online/tonny',
          ),
        ),
      ),
    ));
    expect(find.text('Катерина Петренко-Коваленко'), findsOneWidget);
    expect(find.text('Рівень 7'), findsOneWidget);
    expect(find.text('[SCL] Scaletta Family'), findsOneWidget);
    expect(find.text('Grand Theft Auto V, Counter-Strike 2'), findsOneWidget);
    expect(find.text('4/30'), findsOneWidget);
    expect(find.text('gamecon.online/tonny'), findsOneWidget);
  });
}
