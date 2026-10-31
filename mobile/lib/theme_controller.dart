import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'theme.dart';

/// Тема застосунку, як на сайті: system (як на пристрої), dark («Неоновий синій») або light
/// («Крижана Арктика»). Вибір зберігається в акаунті (міст `/settings/theme`) і на телефоні —
/// щоб перший кадр одразу був у потрібній темі. Перемикання перебудовує весь застосунок на місці:
/// екрани, прокрутка й навігація не скидаються.
class ThemeController with WidgetsBindingObserver {
  ThemeController._();
  static final instance = ThemeController._();
  static const values = ['system', 'dark', 'light'];

  SharedPreferences? _prefs;
  String pref = 'system';

  /// Зміни теми (для екранів, яким треба знати про перемикання, напр. налаштування).
  final revision = ValueNotifier<int>(0);

  bool get isLight => palette.isLight;

  void init(SharedPreferences prefs) {
    _prefs = prefs;
    pref = _valid(prefs.getString('theme'));
    WidgetsBinding.instance.addObserver(this);
    _resolve(rebuild: false);
  }

  /// Вибір людини (з налаштувань, швидкого перемикача або з акаунта на сервері).
  void setPref(String? value, {bool save = true}) {
    final next = _valid(value);
    final changed = next != pref;
    pref = next;
    if (save && changed) _prefs?.setString('theme', next);
    _resolve(rebuild: true);
  }

  /// Тема, яку зараз видно (system розкривається в light/dark за пристроєм).
  String get resolved => isLight ? 'light' : 'dark';

  @override
  void didChangePlatformBrightness() {
    if (pref == 'system') _resolve(rebuild: true);
  }

  String _valid(String? value) => values.contains(value) ? value! : 'system';

  void _resolve({required bool rebuild}) {
    final light = pref == 'light' || (pref == 'system' && WidgetsBinding.instance.platformDispatcher.platformBrightness == Brightness.light);
    final next = light ? arcticPalette : neonPalette;
    final changed = !identical(next, palette);
    palette = next;
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle(
      statusBarColor: const Color(0x00000000),
      statusBarIconBrightness: light ? Brightness.dark : Brightness.light,
      statusBarBrightness: light ? Brightness.light : Brightness.dark,
      systemNavigationBarColor: const Color(0x00000000),
      systemNavigationBarIconBrightness: light ? Brightness.dark : Brightness.light,
      systemNavigationBarContrastEnforced: false,
    ));
    if (rebuild && changed) {
      revision.value++;
      _rebuildAll();
    }
  }

  /// Кольори — геттери поточної палітри, тож досить перебудувати кожен елемент дерева.
  void _rebuildAll() {
    final root = WidgetsBinding.instance.rootElement;
    if (root == null) return;
    void visit(Element element) {
      element.markNeedsBuild();
      element.visitChildren(visit);
    }

    root.visitChildren(visit);
  }
}
