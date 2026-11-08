import 'package:flutter/material.dart';

// Дизайн-система застосунку: теми «Неоновий синій» (темна) і «Крижана Арктика» (світла), як на сайті:
// суцільні матові картки з великим радіусом, небесний акцент, тло #04070D / #F1F5F9, картки #0B1220 / #FFFFFF.
// Імена класів лишилися від «Spatial Glass», щоб не чіпати сотні викликів.
// Лише крижані й сапфірові відтінки — без фіолетового й рожевого. Палітра теми (theme.dart)
// та віджети core/widgets/arctic_glass беруть кольори звідси; відмінності темної й світлої
// теми — в ArcticGlassThemeExtension.

abstract final class AppColors {
  // Тло
  static const bgBase = Color(0xFF04070D);
  static const bgElevated = Color(0xFF080D18);

  // Скло: tier1 — елементи списків, tier2 — картки й поля, tier3 — шторки та поповери.
  static const glassTier1 = Color(0xFF0B1220);
  static const glassTier2 = Color(0xFF0B1220);
  static const glassTier3 = Color(0xFF121D31);

  // Рамки
  static const borderHairline = Color.fromRGBO(255, 255, 255, 0.08);
  static const borderSpecularTop = Color.fromRGBO(255, 255, 255, 0.32);
  static const borderSapphire = Color.fromRGBO(14, 165, 233, 0.40);

  // Акценти
  static const accentPrimary = Color(0xFF0EA5E9);
  static const accentCyan = Color(0xFF38BDF8);
  static const accentGradient = LinearGradient(colors: [accentPrimary, accentPrimary]);

  /// Неоново-кораловий бейдж (лічильники сповіщень).
  static const badge = Color(0xFFFF4D6D);

  // Текст темної теми
  static const textPrimary = Color(0xFFF8FAFC);
  static const textSecondary = Color(0xFF94A3B8);
  static const textMuted = Color(0xFF64748B);

  // Текст світлої теми
  static const lightTitle = Color(0xFF0F172A);
  static const lightBody = Color(0xFF334155);
  static const lightMuted = Color(0xFF64748B);

  /// Мерехтіння скелетонів: ледь помітне скло → крижаний ціан → скло.
  static const shimmer = [Color.fromRGBO(255, 255, 255, 0.04), Color.fromRGBO(255, 255, 255, 0.10), Color.fromRGBO(255, 255, 255, 0.04)];
}

/// Радіуси One UI: картки — 26, нижнє меню й шторки — 30, кнопки й поля — пігулки (24).
abstract final class AppRadii {
  static const card = 26.0;
  static const dock = 30.0;
  static const control = 24.0;
}

/// Розмиття «iOS Frosted Material»: картки й блоки — 22, кнопки й поля — 16,
/// шапка, док і шторки — 28, розгорнуте меню доку — 32.
abstract final class AppBlur {
  // One UI: картки й поля суцільні (без розмиття); розмиття лише в плаваючих панелях.
  static const card = 0.0;
  static const control = 0.0;
  static const fixed = 28.0;
  static const dock = 28.0;
  static const sheet = 28.0;
  static const menu = 32.0;
}

/// Пляма світла на тлі: центр (Alignment), радіус градієнта, колір і прозорість.
class ArcticGlow {
  const ArcticGlow(this.center, this.radius, this.color, this.alpha);
  final Alignment center;
  final double radius;
  final Color color;
  final double alpha;
}

/// Токени скла для поточної теми: «Deep Arctic Void» (темна) і «Alpine Glacier Daylight» (світла).
@immutable
class ArcticGlassThemeExtension extends ThemeExtension<ArcticGlassThemeExtension> {
  const ArcticGlassThemeExtension({
    required this.light,
    required this.background,
    required this.glows,
    required this.glassFill,
    required this.pressedFill,
    required this.innerFill,
    required this.border,
    required this.outline,
    required this.specular,
    required this.shadows,
    required this.barFill,
    required this.sheetFill,
    required this.title,
    required this.body,
    required this.muted,
  });

  final bool light;

  /// Тло під усім застосунком (вертикальний градієнт).
  final List<Color> background;
  final List<ArcticGlow> glows;
  final Gradient glassFill;

  /// Картка під пальцем — світліший лід (замість тіні чи обводки).
  final Gradient pressedFill;

  /// Картка в картці — легка внутрішня плашка без розмиття.
  final Color innerFill;

  /// Грань скла (1px).
  final Color border;

  /// Зовнішній контур 0.5px — щоб край читався на світлому тлі (у темній темі немає).
  final Color? outline;

  /// Верхній дзеркальний блік (1px, згасає до країв).
  final Color specular;
  final List<BoxShadow> shadows;

  /// Нерухомі панелі (шапка, док) — щільніше скло під розмиттям.
  final Gradient barFill;
  final Color sheetFill;
  final Color title;
  final Color body;
  final Color muted;

  static const dark = ArcticGlassThemeExtension(
    light: false,
    background: [Color(0xFF04070D), Color(0xFF04070D)],
    glows: [],
    // Картка «Неонового синього» — суцільна #0B1220, натиснута — #18263F, вкладене — #121D31.
    glassFill: LinearGradient(colors: [Color(0xFF0B1220), Color(0xFF0B1220)]),
    pressedFill: LinearGradient(colors: [Color(0xFF18263F), Color(0xFF18263F)]),
    innerFill: Color(0xFF121D31),
    border: Color(0x00000000),
    outline: null,
    specular: Color(0x00000000),
    shadows: [],
    // Плаваючі панелі (нижнє меню, кнопки шапки при прокрутці) — напівпрозорі з розмиттям.
    barFill: LinearGradient(colors: [Color.fromRGBO(9, 16, 29, 0.82), Color.fromRGBO(9, 16, 29, 0.82)]),
    sheetFill: Color(0xFF0B1220),
    title: AppColors.textPrimary,
    body: Color(0xFFCBD5E1),
    muted: AppColors.textSecondary,
  );

  static const daylight = ArcticGlassThemeExtension(
    light: true,
    background: [Color(0xFFF1F5F9), Color(0xFFF1F5F9)],
    glows: [],
    glassFill: LinearGradient(colors: [Color(0xFFFFFFFF), Color(0xFFFFFFFF)]),
    pressedFill: LinearGradient(colors: [Color(0xFFE2E8F0), Color(0xFFE2E8F0)]),
    innerFill: Color(0xFFF1F5F9),
    border: Color(0x00000000),
    outline: null,
    specular: Color(0x00000000),
    shadows: [],
    barFill: LinearGradient(colors: [Color.fromRGBO(255, 255, 255, 0.86), Color.fromRGBO(255, 255, 255, 0.86)]),
    sheetFill: Color(0xFFFFFFFF),
    title: AppColors.lightTitle,
    body: AppColors.lightBody,
    muted: AppColors.lightMuted,
  );

  /// Токени з теми; без теми (напр. у тестах окремих віджетів) — за яскравістю.
  static ArcticGlassThemeExtension of(BuildContext context) {
    final theme = Theme.of(context);
    return theme.extension<ArcticGlassThemeExtension>() ?? (theme.brightness == Brightness.light ? daylight : dark);
  }

  @override
  ArcticGlassThemeExtension copyWith() => this;

  @override
  ArcticGlassThemeExtension lerp(ArcticGlassThemeExtension? other, double t) => t < 0.5 || other == null ? this : other;
}

/// Крижане світіння навколо активного елемента (вкладка доку, кнопка ШІ).
// One UI без світіння: лишилося ім'я для сумісності.
List<BoxShadow> iceGlow({double strength = 1}) => const [];

/// М'яке крижане (#00D2FF) світіння індикатора доку.
List<BoxShadow> sapphireGlow({double strength = 1}) => const [];
