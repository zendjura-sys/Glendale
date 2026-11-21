import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/api.dart';
import 'package:gamecon/tournaments.dart';

Map<String, dynamic> _entry(int id, String name) => {'id': id, 'name': name, 'avatar': null, 'url': '/u$id', 'family': false};

Map<String, dynamic> _bracket() => {
      'tournament': {
        'id': 1, 'title': 'Кубок вулиць', 'kind': 'bracket', 'entry': 'solo', 'status': 'running', 'size': 4, 'prize': '500 000 \$',
        'starts_at': '2026-10-23T18:00:00+03:00', 'ends_at': null, 'entries_count': 3, 'server': {'slug': 'quant-rp', 'name': 'Quant RP', 'icon': null},
        'description': null, 'lower_is_better': false, 'organizer': {'name': 'Катерина'},
      },
      'entries': [_entry(1, 'Віктор'), _entry(2, 'Марко'), _entry(3, 'Олена')],
      'rounds': [
        [
          {'id': 10, 'round': 1, 'slot': 0, 'a': _entry(1, 'Віктор'), 'b': null, 'winner_id': 1, 'score': null},
          {'id': 11, 'round': 1, 'slot': 1, 'a': _entry(2, 'Марко'), 'b': _entry(3, 'Олена'), 'winner_id': 2, 'score': '2:1'},
        ],
        [
          {'id': 12, 'round': 2, 'slot': 0, 'a': _entry(1, 'Віктор'), 'b': _entry(2, 'Марко'), 'winner_id': null, 'score': null},
        ],
      ],
      'leaderboard': [],
      'winner': null,
      'me': {'entry_id': null, 'can_manage': true, 'families': [], 'submissions': []},
      'pending': [],
    };

void main() {
  testWidgets('сітка: раунди, вільний прохід, рахунок; організатор бачить керування', (tester) async {
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: TournamentView(data: _bracket(), api: Api(() => 'test'), reload: () async {}))));
    expect(find.text('Кубок вулиць'), findsOneWidget);
    expect(find.text('Півфінал'), findsOneWidget);
    expect(find.text('Фінал'), findsOneWidget);
    expect(find.text('Вільний прохід'), findsOneWidget);
    expect(find.text('2:1'), findsOneWidget);
    expect(find.text('Скасувати'), findsOneWidget);
    expect(find.text('Взяти участь'), findsNothing);
  });

  testWidgets('челендж: таблиця з місцями й кнопка результату', (tester) async {
    final data = _bracket();
    data['tournament'] = {...data['tournament'] as Map<String, dynamic>, 'kind': 'challenge', 'metric': 'Час, с', 'lower_is_better': true, 'ends_at': '2026-10-28T18:00:00+03:00'};
    data['rounds'] = [];
    data['leaderboard'] = [
      {'place': 1, 'entry': _entry(2, 'Марко'), 'value': 61.5},
      {'place': 2, 'entry': _entry(1, 'Віктор'), 'value': 64},
    ];
    data['me'] = {'entry_id': 1, 'can_manage': false, 'families': [], 'submissions': [{'id': 1, 'value': 64, 'status': 'approved', 'created_at': '2026-10-23T18:00:00+03:00'}]};
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: TournamentView(data: data, api: Api(() => 'test'), reload: () async {}))));
    expect(find.text('Найкращий — найменший результат'), findsOneWidget);
    expect(find.text('61.5'), findsOneWidget);
    expect(find.text('Надіслати результат'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Зараховано'), 200, scrollable: find.byType(Scrollable).first);
    expect(find.text('Зараховано'), findsOneWidget);
  });
}
