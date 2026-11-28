import 'package:flutter/material.dart';

// Дизайн-система «Лобі» (графіт і один акцент індиго, як на сайті — DESIGN.md): токени застосунку.
// Графіт #131313 / #22252c / #2e333d, акцент #6b8afd; лічильники — #ff7a55. Палітра теми (theme.dart)
// та віджети core/widgets/arctic_glass беруть кольори звідси; відмінності темної й світлої
// теми — в ArcticGlassThemeExtension.

abstract final class AppColors {
  // Тло
  static const bgBase = Color(0xFF131313);
  static const bgElevated = Color(0xFF22252C);

  // Скло: tier1 — елементи списків, tier2 — картки й поля, tier3 — шторки та поповери.
  static const glassTier1 = Color.fromRGBO(255, 255, 255, 0.04);
  static const glassTier2 = Color.fromRGBO(255, 255, 255, 0.07);
  static const glassTier3 = Color.fromRGBO(34, 37, 44, 0.86);

  // Рамки
  static const borderHairline = Color.fromRGBO(255, 255, 255, 0.06);
  static const borderSpecularTop = Color.fromRGBO(255, 255, 255, 0.32);
  static const borderSapphire = Color.fromRGBO(107, 138, 253, 0.45);

  // Акценти
  static const accentPrimary = Color(0xFF6B8AFD);
  static const accentCyan = Color(0xFF8FA5FF);
  static const accentGradient = LinearGradient(colors: [accentPrimary, accentCyan], begin: Alignment.topLeft, end: Alignment.bottomRight);

  /// Кораловий бейдж (лічильники сповіщень), як на сайті.
  static const badge = Color(0xFFFF7A55);

  // Текст темної теми
  static const textPrimary = Color(0xFFFFFFFF);
  static const textSecondary = Color(0xFF9AA1AD);
  static const textMuted = Color(0xFF6E7480);

  // Текст світлої теми
  static const lightTitle = Color(0xFF202022);
  static const lightBody = Color(0xFF3C3E48);
  static const lightMuted = Color(0xFF6B6D7A);

  /// Мерехтіння скелетонів: графіт → ледь світліший → графіт.
  static const shimmer = [Color.fromRGBO(255, 255, 255, 0.03), Color.fromRGBO(255, 255, 255, 0.08), Color.fromRGBO(255, 255, 255, 0.03)];
}

/// Радіуси: картки — 12 (майже квадратні), вкладені — 10, док, шапка й шторки — 28, кнопки й поля — 14.
abstract final class AppRadii {
  static const card = 12.0;
  static const inner = 10.0;
  static const dock = 28.0;
  static const control = 8.0;
}

/// Розмиття «iOS Frosted Material»: картки й блоки — 22, кнопки й поля — 16,
/// шапка, док і шторки — 28, розгорнуте меню доку — 32.
abstract final class AppBlur {
  static const card = 22.0;
  static const control = 16.0;
  static const fixed = 20.0;
  static const dock = 40.0;
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
    this.solidCards = false,
    this.cardBorder,
    this.barBorder,
    this.barShadows = const [],
    this.rim,
    this.innerGlow,
  });

  /// Кант-блік Liquid Glass (Medium): світліший угорі ліворуч, згасає до правого низу.
  final Color? rim;

  /// М'яке внутрішнє світіння біля країв скла.
  final Color? innerGlow;

  /// Картки суцільні, без розмиття (темна iOS 27: читабельність без просвічування).
  final bool solidCards;

  /// Тонкий кант карток (1px).
  final Color? cardBorder;

  /// Грань нерухомих панелей (шапка, док, міні-плеєр).
  final Color? barBorder;
  final List<BoxShadow> barShadows;

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

  // Темна «iOS 27 Achromatic»: тло #07090E без кольорових плям; картки суцільні #0D1017 з кантом;
  // скло (розмиття) — лише в нерухомих панелей: шапки, доку, міні-плеєра й шторок.
  // Темна «Liquid Glass — Medium»: тло #07090E без кольорових плям; блоки — густе матове скло
  // (сильне розмиття + графітова молочна тонировка), тонкий світлий кант-блік, внутрішнє світіння
  // й м'яка зовнішня тінь. Шапка й док — щільніше безбарвне скло.
  // «Лобі» (темна): картки — суцільний графіт L1 #22252c, натиснуто — L2 #2e333d, кант ледь помітний;
  // док і шапка — матове скло над полотном #131313 (як на сайті).
  static const dark = ArcticGlassThemeExtension(
    light: false,
    background: [Color(0xFF131313), Color(0xFF131313)],
    glows: [],
    glassFill: LinearGradient(colors: [Color(0xFF22252C), Color(0xFF22252C)]),
    pressedFill: LinearGradient(colors: [Color(0xFF2E333D), Color(0xFF2E333D)]),
    innerFill: Color(0xFF2E333D),
    border: Color.fromRGBO(255, 255, 255, 0.06),
    outline: null,
    specular: Color.fromRGBO(255, 255, 255, 0),
    shadows: [],
    barFill: LinearGradient(colors: [Color.fromRGBO(19, 19, 19, 0.86), Color.fromRGBO(19, 19, 19, 0.86)]),
    sheetFill: Color.fromRGBO(34, 37, 44, 0.97),
    title: AppColors.textPrimary,
    body: Color(0xFFD6D9DF),
    muted: AppColors.textSecondary,
  );

  // «Лобі» (світла): полотно #f9fafc, білі картки, поля #f0f1f8, акцент #7678ed.
  static const daylight = ArcticGlassThemeExtension(
    light: true,
    background: [Color(0xFFF9FAFC), Color(0xFFF9FAFC)],
    glows: [],
    glassFill: LinearGradient(colors: [Color(0xFFFFFFFF), Color(0xFFFFFFFF)]),
    pressedFill: LinearGradient(colors: [Color(0xFFF0F1F8), Color(0xFFF0F1F8)]),
    innerFill: Color(0xFFF0F1F8),
    border: Color.fromRGBO(32, 32, 34, 0.08),
    outline: null,
    specular: Color.fromRGBO(255, 255, 255, 0),
    shadows: [],
    barFill: LinearGradient(colors: [Color.fromRGBO(249, 250, 252, 0.86), Color.fromRGBO(249, 250, 252, 0.86)]),
    sheetFill: Color.fromRGBO(255, 255, 255, 0.97),
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
