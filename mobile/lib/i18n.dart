import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Переклад застосунку. Джерело — українська: сам текст і є ключем (`tr('Друзі')`).
/// Словник приходить із сервера (/api/v1/i18n) і зберігається на телефоні, тож нова мова
/// з адмінки з’являється без оновлення застосунку.
class I18n {
  I18n._();

  static const _kChoice = 'i18n_choice';
  static const _kLocale = 'i18n_locale';
  static const _kDict = 'i18n_dict';
  static const _kLocales = 'i18n_locales';
  static const _kVersion = 'i18n_version';

  static SharedPreferences? _prefs;

  /// Поточна мова інтерфейсу («uk», «en», «pt-BR»).
  static String locale = 'uk';

  /// Вибрана вручну мова (null — як у телефоні).
  static String? choice;

  static Map<String, String> _dict = {};

  /// Доступні мови: [{code, native}].
  static List<Map<String, dynamic>> locales = const [];

  /// Кнопка «Перекласти» під записами (є ключ DeepL і її не вимкнено).
  static bool translate = false;

  /// Змінюється після зміни мови — корінь застосунку перебудовується.
  static final ValueNotifier<int> revision = ValueNotifier(0);

  /// Мова, яку просимо в сервера: вибрана або мова телефону.
  static String get requested => choice ?? ui.PlatformDispatcher.instance.locale.toLanguageTag();

  static Future<void> restore(SharedPreferences prefs) async {
    _prefs = prefs;
    choice = prefs.getString(_kChoice);
    locale = prefs.getString(_kLocale) ?? 'uk';
    try {
      final dict = jsonDecode(prefs.getString(_kDict) ?? '{}');
      if (dict is Map) _dict = dict.map((k, v) => MapEntry('$k', '$v'));
      final list = jsonDecode(prefs.getString(_kLocales) ?? '[]');
      if (list is List) locales = list.whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList();
    } catch (_) {
      _dict = {};
    }
  }

  /// Оновити словник із сервера. true — мова чи переклади змінилися.
  static Future<bool> apply(Map<String, dynamic> data) async {
    final next = '${data['locale'] ?? 'uk'}';
    final version = '${data['version'] ?? ''}';
    final list = data['locales'] is List ? (data['locales'] as List).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList() : <Map<String, dynamic>>[];
    final dict = data['dict'] is Map ? (data['dict'] as Map).map((k, v) => MapEntry('$k', '$v')) : <String, String>{};
    final changed = next != locale || version != (_prefs?.getString(_kVersion) ?? '');
    locales = list;
    translate = data['translate'] == true;
    final prefs = _prefs;
    if (prefs != null) {
      await prefs.setString(_kLocales, jsonEncode(list));
      if (changed) {
        await prefs.setString(_kLocale, next);
        await prefs.setString(_kVersion, version);
        await prefs.setString(_kDict, jsonEncode(dict));
      }
    }
    if (changed) {
      locale = next;
      _dict = dict;
    }
    return changed;
  }

  static Future<void> choose(String? code) async {
    choice = code;
    final prefs = _prefs;
    if (prefs == null) return;
    if (code == null) {
      await prefs.remove(_kChoice);
    } else {
      await prefs.setString(_kChoice, code);
    }
  }

  static void rebuild() => revision.value++;

  static String? lookup(String source) => _dict[source];
}

/// Свіжий словник із сервера; якщо змінився — перебудовуємо інтерфейс.
Future<void> refreshLanguage(dynamic api) async {
  try {
    final data = await api.get('/api/v1/i18n') as Map<String, dynamic>;
    if (await I18n.apply(data)) I18n.rebuild();
  } catch (_) {
    // Немає мережі — лишається збережений словник.
  }
}

/// Переклад рядка. Підстановки — у фігурних дужках: tr('Іде: {count}', {'count': 3}).
String tr(String source, [Map<String, Object?>? params]) {
  var text = I18n.lookup(source) ?? source;
  if (params != null) {
    text = text.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) => params.containsKey(m[1]) ? '${params[m[1]] ?? ''}' : m[0]!);
  }
  return text;
}
