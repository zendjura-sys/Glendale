import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';

/// Збережений на цьому телефоні акаунт: токен API й коротка картка профілю для меню.
///
/// Як cookie `gc_accounts` на сайті ([AccountSwitcher]): до [AccountVault.maxAccounts] акаунтів,
/// перемикання не просить пароль, «прибрати» забуває токен на пристрої.
class StoredAccount {
  const StoredAccount({
    required this.id,
    required this.token,
    required this.profile,
  });

  final int id;
  final String token;
  final Map<String, dynamic> profile;

  String get name =>
      text(profile['name']) ?? text(profile['username']) ?? '#$id';
  String? get username => text(profile['username']);
  String? get avatarUrl => text(profile['avatar_url']);

  Map<String, dynamic> toJson() => {
    'id': id,
    'token': token,
    'profile': profile,
  };

  static StoredAccount? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final id = raw['id'] is int
        ? raw['id'] as int
        : int.tryParse('${raw['id']}');
    final token = text(raw['token']);
    final profile = raw['profile'] is Map
        ? Map<String, dynamic>.from(raw['profile'] as Map)
        : null;
    if (id == null || token == null || profile == null) return null;
    return StoredAccount(id: id, token: token, profile: profile);
  }
}

/// Список акаунтів у SharedPreferences. Окремого secure storage у застосунку немає —
/// поточний токен уже лежить у тих самих prefs (`token`), тож і решта токенів тут.
class AccountVault {
  static const maxAccounts = 5;
  static const storageKey = 'accounts.v1';
  static const addingKey = 'accounts.adding';
  static const returnKey = 'accounts.return';

  static const _cardKeys = [
    'id',
    'name',
    'username',
    'first_name',
    'avatar_url',
    'email',
  ];

  static List<StoredAccount> read(SharedPreferences prefs) {
    try {
      final raw = jsonDecode(prefs.getString(storageKey) ?? '');
      if (raw is! List) return [];
      final list = <StoredAccount>[];
      for (final item in raw) {
        final account = StoredAccount.fromJson(item);
        if (account == null || list.any((a) => a.id == account.id)) continue;
        list.add(account);
        if (list.length == maxAccounts) break;
      }
      return list;
    } catch (_) {
      return [];
    }
  }

  /// Картка для меню — без усього профілю (плагіни, фон, модулі).
  static Map<String, dynamic> snapshot(Map<String, dynamic> profile) {
    final card = <String, dynamic>{};
    for (final key in _cardKeys) {
      final value = key == 'id'
          ? (profile['id'] is int
                ? profile['id'] as int
                : int.tryParse('${profile['id']}'))
          : text(profile[key]);
      if (value != null) card[key] = value;
    }
    return card;
  }

  /// Додати або оновити. Новий понад [maxAccounts] не записується (як на сайті).
  static Future<List<StoredAccount>> remember(
    SharedPreferences prefs,
    String token,
    Map<String, dynamic> profile, {
    bool allowNew = true,
  }) async {
    final id = profile['id'] is int
        ? profile['id'] as int
        : int.tryParse('${profile['id']}');
    if (id == null || token.isEmpty) return read(prefs);
    final list = read(prefs);
    final card = snapshot({...profile, 'id': id});
    final index = list.indexWhere((account) => account.id == id);
    if (index >= 0) {
      list[index] = StoredAccount(id: id, token: token, profile: card);
    } else if (!allowNew || list.length >= maxAccounts) {
      return list;
    } else {
      list.add(StoredAccount(id: id, token: token, profile: card));
    }
    await _write(prefs, list);
    return list;
  }

  /// Оновити картку й токен, якщо акаунт уже в списку. Новий не додає.
  static Future<List<StoredAccount>> touch(
    SharedPreferences prefs,
    String token,
    Map<String, dynamic> profile,
  ) {
    return remember(prefs, token, profile, allowNew: false);
  }

  static Future<List<StoredAccount>> forget(
    SharedPreferences prefs,
    int id,
  ) async {
    final list = read(prefs).where((account) => account.id != id).toList();
    await _write(prefs, list);
    return list;
  }

  static Future<void> _write(
    SharedPreferences prefs,
    List<StoredAccount> list,
  ) async {
    if (list.isEmpty) {
      await prefs.remove(storageKey);
      return;
    }
    await prefs.setString(
      storageKey,
      jsonEncode([for (final account in list) account.toJson()]),
    );
  }
}
