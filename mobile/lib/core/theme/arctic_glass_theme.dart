import 'package:flutter/material.dart';

// Дизайн-система «Spatial Glass» (Arctic Ice & Electric Sapphire): токени застосунку.
// Лише крижані й сапфірові відтінки — без фіолетового й рожевого. Палітра теми (theme.dart)
// та віджети core/widgets/arctic_glass беруть кольори звідси; відмінності темної й світлої
// теми — в ArcticGlassThemeExtension.

abstract final class AppColors {
  // Тло
  static const bgBase = Color(0xFF04070D);
  static const bgElevated = Color(0xFF080E1A);

  // Скло: tier1 — елементи списків, tier2 — картки й поля, tier3 — шторки та поповери.
  static const glassTier1 = Color.fromRGBO(255, 255, 255, 0.04);
  static const glassTier2 = Color.fromRGBO(255, 255, 255, 0.07);
  static const glassTier3 = Color.fromRGBO(12, 20, 36, 0.78);

  // Рамки
  static const borderHairline = Color.fromRGBO(255, 255, 255, 0.10);
  static const borderSpecularTop = Color.fromRGBO(255, 255, 255, 0.32);
  static const borderSapphire = Color.fromRGBO(0, 210, 255, 0.40);

  // Акценти
  static const accentPrimary = Color(0xFF0A84FF);
  static const accentCyan = Color(0xFF00D2FF);
  static const accentGradient = LinearGradient(colors: [accentPrimary, accentCyan], begin: Alignment.topLeft, end: Alignment.bottomRight);

  /// Неоново-кораловий бейдж (лічильники сповіщень).
  static const badge = Color(0xFFFF4D6D);

  // Текст темної теми
  static const textPrimary = Color(0xFFF8FAFC);
  static const textSecondary = Color(0xFF94A3B8);
  static const textMuted = Color(0xFF64748B);

  // Текст світлої теми
  static const lightTitle = Color(0xFF0B1528);
  static const lightBody = Color(0xFF334155);
  static const lightMuted = Color(0xFF64748B);

  /// Мерехтіння скелетонів: ледь помітне скло → крижаний ціан → скло.
  static const shimmer = [Color.fromRGBO(255, 255, 255, 0.03), Color.fromRGBO(0, 210, 255, 0.10), Color.fromRGBO(255, 255, 255, 0.03)];
}

/// Радіуси: картки — 20, док, шапка й шторки — 28, кнопки й поля — 14.
abstract final class AppRadii {
  static const card = 20.0;
  static const dock = 28.0;
  static const control = 14.0;
}

/// Розмиття «iOS Frosted Material»: картки й блоки — 22, кнопки й поля — 16,
/// шапка, док і шторки — 28, розгорнуте меню доку — 32.
abstract final class AppBlur {
  static const card = 22.0;
  static const control = 16.0;
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
    background: [AppColors.bgBase, AppColors.bgBase],
    glows: [
      ArcticGlow(Alignment(-1, -1), 1.1, AppColors.accentPrimary, 0.18),
      ArcticGlow(Alignment(1, 0), 0.95, AppColors.accentCyan, 0.13),
      ArcticGlow(Alignment(0, 1.15), 1.0, AppColors.accentPrimary, 0.16),
    ],
    // Матова тонировка скла: розмите тло під нею лишається видимим.
    glassFill: LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [Color.fromRGBO(255, 255, 255, 0.11), Color.fromRGBO(10, 132, 255, 0.04), Color.fromRGBO(255, 255, 255, 0.03)],
    ),
    pressedFill: LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [Color.fromRGBO(255, 255, 255, 0.16), Color.fromRGBO(10, 132, 255, 0.07), Color.fromRGBO(255, 255, 255, 0.05)],
    ),
    innerFill: Color.fromRGBO(255, 255, 255, 0.05),
    border: Color.fromRGBO(255, 255, 255, 0.14),
    outline: null,
    specular: Color.fromRGBO(255, 255, 255, 0.38),
    // Без тіней: глибину дають розмиття, грань і блік.
    shadows: [],
    barFill: LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [Color.fromRGBO(255, 255, 255, 0.11), Color.fromRGBO(10, 132, 255, 0.04), Color.fromRGBO(255, 255, 255, 0.03)],
    ),
    sheetFill: Color.fromRGBO(12, 18, 30, 0.55),
    title: AppColors.textPrimary,
    body: Color(0xFFCBD5E1),
    muted: AppColors.textSecondary,
  );

  static const daylight = ArcticGlassThemeExtension(
    light: true,
    // Прохолодний льодовиковий градієнт і сфери світла: під білим склом завжди грає крижаний тон.
    background: [Color(0xFFDFECFA), Color(0xFFEDF4FC), Color(0xFFD6E6F8)],
    glows: [
      ArcticGlow(Alignment(-1, -0.9), 1.0, AppColors.accentPrimary, 0.12),
      ArcticGlow(Alignment(1, 0.1), 0.9, AppColors.accentCyan, 0.10),
      ArcticGlow(Alignment(0, 1.15), 0.8, AppColors.accentPrimary, 0.12),
    ],
    glassFill: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color.fromRGBO(255, 255, 255, 0.65), Color.fromRGBO(232, 242, 255, 0.45)]),
    pressedFill: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color.fromRGBO(255, 255, 255, 0.80), Color.fromRGBO(232, 242, 255, 0.60)]),
    innerFill: Color.fromRGBO(255, 255, 255, 0.45),
    border: Color.fromRGBO(255, 255, 255, 0.88),
    // Найтонший контур 0.5px — край картки читається на світлому тлі.
    outline: Color.fromRGBO(10, 132, 255, 0.14),
    specular: Color.fromRGBO(255, 255, 255, 0.95),
    shadows: [],
    barFill: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color.fromRGBO(255, 255, 255, 0.65), Color.fromRGBO(232, 242, 255, 0.45)]),
    sheetFill: Color.fromRGBO(246, 250, 255, 0.72),
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
List<BoxShadow> iceGlow({double strength = 1}) => [BoxShadow(color: AppColors.accentCyan.withValues(alpha: 0.45 * strength), blurRadius: 14, spreadRadius: -2)];

/// М'яке крижане (#00D2FF) світіння індикатора доку.
List<BoxShadow> sapphireGlow({double strength = 1}) => [
  BoxShadow(color: AppColors.accentCyan.withValues(alpha: 0.38 * strength), blurRadius: 16, spreadRadius: -4),
  BoxShadow(color: AppColors.accentPrimary.withValues(alpha: 0.22 * strength), blurRadius: 8, spreadRadius: -2),
];
