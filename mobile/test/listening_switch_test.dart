// «Показувати, що я слухаю»: початкове значення з профілю (/api/v1/me), PATCH через міст сайту
// й повернення перемикача, якщо сервер відмовив. API — підмінений MockClient.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/music.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

http.Response _json(Object body, [int status = 200]) => http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json; charset=utf-8'});

Future<Session> _pump(WidgetTester tester, {required bool show}) async {
  SharedPreferences.setMockInitialValues({'token': 'test'});
  final session = Session(await SharedPreferences.getInstance())..me = {'id': 1, 'name': 'Тоні', 'username': 'tonny', 'role': 'user', 'show_listening': show};
  final player = TrackPlayer()..session = session;
  await tester.pumpWidget(MaterialApp(
    theme: gameConTheme(),
    home: AppScope(session: session, player: player, child: const Scaffold(body: ListeningSwitch())),
  ));
  await tester.pump();
  return session;
}

bool _value(WidgetTester tester) => tester.widget<SwitchListTile>(find.byType(SwitchListTile)).value;

void main() {
  testWidgets('перемикач бере значення з профілю й надсилає PATCH', (tester) async {
    final sent = <Map<String, dynamic>>[];
    await http.runWithClient(() async {
      final session = await _pump(tester, show: true);
      expect(find.text('Показувати, що я слухаю'), findsOneWidget);
      expect(_value(tester), isTrue);

      await tester.tap(find.byType(SwitchListTile));
      await tester.pump();
      expect(_value(tester), isFalse);
      await tester.pump();
      await tester.pump();
      expect(sent, [
        {'show_listening': false},
      ]);
      expect(session.me?['show_listening'], isFalse);
      expect(_value(tester), isFalse);
    }, () => MockClient((request) async {
          if (request.method == 'PATCH' && request.url.path == '/api/v1/site/settings/listening') {
            sent.add(Map<String, dynamic>.from(jsonDecode(request.body) as Map));
            return _json({'ok': true, 'message': null, 'redirect': null});
          }
          if (request.method == 'GET' && request.url.path == '/api/v1/me') {
            return _json({
              'user': {'id': 1, 'name': 'Тоні', 'username': 'tonny', 'role': 'user', 'show_listening': sent.last['show_listening']},
            });
          }
          return _json({}, 404);
        }));
  });

  testWidgets('помилка сервера повертає перемикач назад', (tester) async {
    await http.runWithClient(() async {
      await _pump(tester, show: false);
      expect(_value(tester), isFalse);
      await tester.tap(find.byType(SwitchListTile));
      await tester.pump();
      await tester.pump();
      await tester.pump();
      expect(_value(tester), isFalse);
      await tester.pump(const Duration(seconds: 5));
    }, () => MockClient((request) async => _json({'message': 'Помилка'}, 500)));
  });
}
