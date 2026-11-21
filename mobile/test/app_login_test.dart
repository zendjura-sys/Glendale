// Вхід на сайт через застосунок: екран «Запит на вхід» (API — підмінений MockClient) і розбір посилань.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/api.dart';
import 'package:gamecon/app_login.dart';
import 'package:gamecon/push.dart';
import 'package:gamecon/shell.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

http.Response _json(Object body, [int status = 200]) => http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json; charset=utf-8'});

Map<String, dynamic> _request() => {
      'id': 'req-1',
      'browser': 'Chrome',
      'os': 'Windows',
      'ip_country': 'Україна',
      'ip_city': 'Київ',
      'created_at': DateTime.now().toUtc().toIso8601String(),
      'expires_at': DateTime.now().add(const Duration(minutes: 5)).toUtc().toIso8601String(),
      'code_choices': [17, 42, 85],
    };

Future<void> _pump(WidgetTester tester) async {
  await tester.pumpWidget(MaterialApp(home: AppLoginScreen(api: Api(() => 'test'), id: 'req-1', onDone: () {})));
  await tester.pump();
  await tester.pump();
}

void main() {
  testWidgets('показує подробиці запиту й три числа', (tester) async {
    await http.runWithClient(() async {
      await _pump(tester);
      expect(find.text('Хтось намагається увійти у ваш акаунт'), findsOneWidget);
      expect(find.text('Chrome · Windows'), findsOneWidget);
      expect(find.textContaining('Київ, Україна'), findsOneWidget);
      expect(find.text('Виберіть число, яке показано на сайті'), findsOneWidget);
      for (final n in ['17', '42', '85']) {
        expect(find.text(n), findsOneWidget);
      }
    }, () => MockClient((request) async {
          expect(request.method, 'GET');
          expect(request.url.path, '/api/v1/auth/app-login/req-1');
          expect(request.headers['Authorization'], 'Bearer test');
          return _json(_request());
        }));
  });

  testWidgets('«Увійти» — лише після вибору числа; підтвердження надсилає код', (tester) async {
    final approved = <Map<String, dynamic>>[];
    await http.runWithClient(() async {
      await _pump(tester);
      // Без вибраного числа «Увійти» нічого не робить.
      await tester.tap(find.text('Увійти'));
      await tester.pump();
      expect(approved, isEmpty);

      await tester.tap(find.text('42'));
      await tester.pump();
      await tester.ensureVisible(find.text('Увійти'));
      await tester.tap(find.text('Увійти'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      expect(approved.single['code'], '42');
      expect(find.text('Вхід підтверджено'), findsOneWidget);
      expect(find.text('Можете повернутися до браузера.'), findsOneWidget);
    }, () => MockClient((request) async {
          if (request.method == 'GET') return _json(_request());
          expect(request.url.path, '/api/v1/auth/app-login/req-1/approve');
          approved.add(jsonDecode(request.body) as Map<String, dynamic>);
          return _json({'ok': true});
        }));
  });

  testWidgets('неправильне число — повідомлення сервера, запит лишається відкритим', (tester) async {
    await http.runWithClient(() async {
      await _pump(tester);
      await tester.tap(find.text('17'));
      await tester.pump();
      await tester.ensureVisible(find.text('Увійти'));
      await tester.tap(find.text('Увійти'));
      await tester.pump();
      await tester.pump();
      expect(find.text('Невірне число. Спробуйте ще раз.'), findsOneWidget);
      expect(find.text('Хтось намагається увійти у ваш акаунт'), findsOneWidget);
    }, () => MockClient((request) async {
          if (request.method == 'GET') return _json(_request());
          return _json({'message': 'Невірне число. Спробуйте ще раз.'}, 422);
        }));
  });

  testWidgets('«Скасувати» відхиляє запит', (tester) async {
    final calls = <String>[];
    await http.runWithClient(() async {
      await _pump(tester);
      await tester.ensureVisible(find.text('Скасувати'));
      await tester.tap(find.text('Скасувати'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      expect(calls, ['/api/v1/auth/app-login/req-1/deny']);
      expect(find.text('Вхід скасовано'), findsOneWidget);
    }, () => MockClient((request) async {
          if (request.method == 'GET') return _json(_request());
          calls.add(request.url.path);
          return _json({'ok': true});
        }));
  });

  testWidgets('застарілий запит (410) — «Запит застарів»', (tester) async {
    await http.runWithClient(() async {
      await _pump(tester);
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text('Запит застарів'), findsOneWidget);
      expect(find.text('17'), findsNothing);
    }, () => MockClient((request) async => _json({'message': 'Запит застарів.'}, 410)));
  });

  testWidgets('без анімацій (reduced motion) підсумок з’являється одразу', (tester) async {
    await http.runWithClient(() async {
      await tester.pumpWidget(MaterialApp(
        home: MediaQuery(data: const MediaQueryData(disableAnimations: true), child: AppLoginScreen(api: Api(() => 'test'), id: 'req-1', onDone: () {})),
      ));
      await tester.pump();
      await tester.pump();
      expect(find.text('Запит застарів'), findsOneWidget);
      expect(find.byType(TweenAnimationBuilder<double>), findsNothing);
    }, () => MockClient((request) async => _json({'message': 'gone'}, 410)));
  });

  test('посилання входу: gamecon://app-login/{id} і https://gamecon.online/app-login/{id}', () {
    expect(appLoginIdFrom(Uri.parse('gamecon://app-login/abc-123')), 'abc-123');
    expect(appLoginIdFrom(Uri.parse('https://gamecon.online/app-login/01J9ZK7Q')), '01J9ZK7Q');
    expect(appLoginIdFrom(Uri.parse('https://www.gamecon.online/app-login/x_1?from=qr')), 'x_1');
    expect(appLoginIdFrom(Uri.parse('/app-login/abc')), 'abc');
    expect(appLoginIdFrom(Uri.parse('gamecon://auth?code=1')), isNull);
    expect(appLoginIdFrom(Uri.parse('gamecon://app-login/')), isNull);
    expect(appLoginIdFrom(Uri.parse('https://evil.example/app-login/abc')), isNull);
    expect(appLoginIdFrom(Uri.parse('https://gamecon.online/app-login/a/b')), isNull);
    expect(appLoginIdFrom(Uri.parse('https://gamecon.online/feed')), isNull);
    expect(appPathFor('/app-login/abc'), '/app-login/abc');
  });

  test('push {type: app_login, id} веде на екран підтвердження', () {
    expect(pushTarget({'type': 'app_login', 'id': 'req-9'}), '/app-login/req-9');
    expect(pushTarget({'type': 'app_login', 'id': 'req-9', 'url': '/app-login/req-9'}), '/app-login/req-9');
    expect(pushTarget({'type': 'like', 'url': '/posts/5'}), '/posts/5');
    expect(pushTarget({'type': 'like'}), isNull);
  });
}
