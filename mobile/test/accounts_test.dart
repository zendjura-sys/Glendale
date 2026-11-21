import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/account_store.dart';
import 'package:gamecon/state.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('сховище: до 5 акаунтів, оновлення токена не зсуває список, битий json — порожньо', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    expect(AccountVault.read(prefs), isEmpty);

    for (var i = 1; i <= 6; i++) {
      await AccountVault.remember(prefs, 'tok-$i', {
        'id': i,
        'name': 'Гравець $i',
        'username': 'u$i',
        'plugins': {'account_switcher': true},
      });
    }
    final list = AccountVault.read(prefs);
    expect(list.map((a) => a.id).toList(), [1, 2, 3, 4, 5]);
    expect(list.first.profile.containsKey('plugins'), isFalse);
    expect(list.first.username, 'u1');

    await AccountVault.remember(prefs, 'fresh', {
      'id': 3,
      'name': 'Троє',
      'avatar_url': '/3.png',
    });
    final updated = AccountVault.read(prefs);
    expect(updated.map((a) => a.id).toList(), [1, 2, 3, 4, 5]);
    expect(updated[2].token, 'fresh');
    expect(updated[2].name, 'Троє');
    expect(updated[2].avatarUrl, '/3.png');

    await AccountVault.touch(prefs, 'nope', {'id': 9, 'name': 'Дев’ятий'});
    expect(AccountVault.read(prefs).map((a) => a.id).toList(), [1, 2, 3, 4, 5]);

    expect((await AccountVault.forget(prefs, 2)).map((a) => a.id).toList(), [
      1,
      3,
      4,
      5,
    ]);
    expect((await AccountVault.forget(prefs, 99)).map((a) => a.id).toList(), [
      1,
      3,
      4,
      5,
    ]);

    await prefs.setString(AccountVault.storageKey, '{');
    expect(AccountVault.read(prefs), isEmpty);
    await prefs.setString(
      AccountVault.storageKey,
      jsonEncode([
        {
          'id': 8,
          'token': 'ok',
          'profile': {'name': 'Вісім'},
        },
        {'id': 'ні', 'token': 'bad', 'profile': {}},
        {'token': 'no-id'},
      ]),
    );
    expect(AccountVault.read(prefs).single.id, 8);
  });

  test(
    'додавання лишає попередній токен, вихід забирає лише поточний',
    () async {
      SharedPreferences.setMockInitialValues({'token': 'tok-a'});
      final session = Session(await SharedPreferences.getInstance())
        ..me = {
          'id': 1,
          'name': 'Аня',
          'username': 'anya',
          'avatar_url': '/a.png',
        };
      var wiped = 0;
      session.logoutHooks.add(() async => wiped++);

      await session.prepareAddAccount();
      expect(session.token, isNull);
      expect(session.me, isNull);
      expect(session.addingAccount, isTrue);
      expect(session.returnAccountId, 1);
      expect(session.prefs.getBool(AccountVault.addingKey), isTrue);
      expect(session.prefs.getString('token'), isNull);
      expect(wiped, 1);
      expect(session.accounts.single.token, 'tok-a');
      expect(session.accounts.single.name, 'Аня');
      expect(session.accounts.single.avatarUrl, '/a.png');
      expect(session.shellEpoch, 1);

      await AccountVault.remember(session.prefs, 'tok-b', {
        'id': 2,
        'name': 'Богдан',
        'username': 'bo',
      });
      session.me = {'id': 2, 'name': 'Богдан'};
      await session.clear();
      expect(session.accounts.map((a) => a.id).toList(), [1]);
      expect(session.accounts.single.token, 'tok-a');
      expect(session.addingAccount, isFalse);
      expect(session.token, isNull);
      expect(wiped, 2);
    },
  );
}
