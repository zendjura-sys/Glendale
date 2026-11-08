import 'package:flutter/material.dart';

// Дизайн-система застосунку «iOS Frosted Ice Glass»: теми «Неоновий синій» (темна) і «Крижана Арктика» (світла).
// Картки — «Frosted Ice Glass»: молочний лід поверх розмиття 32 (насичення й яскравість) і шум 1.5%,
// без обводок і тіней; панелі — щільне скло з розмиттям 40; акцент — сапфір #0A84FF / #00D2FF.
// Імена класів лишилися від «Spatial Glass», щоб не чіпати сотні викликів.
// Лише крижані й сапфірові відтінки — без фіолетового й рожевого. Палітра теми (theme.dart)
// та віджети core/widgets/arctic_glass беруть кольори звідси; відмінності темної й світлої
// теми — в ArcticGlassThemeExtension.

abstract final class AppColors {
  // Тло
  static const bgBase = Color(0xFF04070D);
  static const bgElevated = Color(0xFF090A0F);

  // Скло: tier1 — елементи списків, tier2 — картки й поля, tier3 — шторки та поповери.
  static const glassTier1 = Color(0xFF0F1420);
  static const glassTier2 = Color(0xFF0F1420);
  static const glassTier3 = Color(0xFF131926);

  // Рамки
  static const borderHairline = Color.fromRGBO(255, 255, 255, 0.09);
  static const borderSpecularTop = Color.fromRGBO(255, 255, 255, 0.32);
  static const borderSapphire = Color.fromRGBO(0, 210, 255, 0.40);

  // Акценти
  static const accentPrimary = Color(0xFF0A84FF);
  static const accentCyan = Color(0xFF00D2FF);
  static const accentGradient = LinearGradient(colors: [accentPrimary, accentCyan], begin: Alignment.topLeft, end: Alignment.bottomRight);

  /// Неоново-кораловий бейдж (лічильники сповіщень).
  static const badge = Color(0xFFDC2626);

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

/// Радіуси iOS (концентричні: вкладене = зовнішнє − відступ): картки — 26, нижнє меню й шторки — 30, кнопки й поля — пігулки (24).
abstract final class AppRadii {
  static const card = 20.0;
  static const dock = 30.0;
  static const control = 12.0;
}

/// Розмиття «iOS Frosted Material»: картки й блоки — 22, кнопки й поля — 16,
/// шапка, док і шторки — 28, розгорнуте меню доку — 32.
abstract final class AppBlur {
  // Frosted Ice Glass: картки — розмиття 32 з насиченням ×1.8 і яскравістю ×1.18 (молочний лід);
  // панелі (шапка, док, плеєр, шторки) — 40 з ×1.9 / ×1.15; вкладені плашки й кнопки — без розмиття.
  static const card = 32.0;
  static const control = 0.0;
  static const fixed = 40.0;
  static const dock = 40.0;
  static const sheet = 40.0;
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

  // Темна «Frosted Ice Glass»: тло #060B14 з блакитними плямами (#0EA5E9 / #1D4ED8, 22%);
  // картка — рівний (пласкій) молочний лід поверх сильного розмиття; без обводок, тіней і переливів.
  static const dark = ArcticGlassThemeExtension(
    light: false,
    background: [Color(0xFF060B14), Color(0xFF060B14)],
    glows: [
      ArcticGlow(Alignment(-0.95, -0.75), 0.85, Color(0xFF0EA5E9), 0.22),
      ArcticGlow(Alignment(1.0, 0.15), 0.8, Color(0xFF1D4ED8), 0.22),
      ArcticGlow(Alignment(-0.7, 1.0), 0.75, Color(0xFF0EA5E9), 0.16),
    ],
    // Пласка заливка: рівний молочний лід без діагонального переливу й об'єму.
    glassFill: LinearGradient(colors: [Color.fromRGBO(200, 222, 255, 0.09), Color.fromRGBO(200, 222, 255, 0.09)]),
    pressedFill: LinearGradient(colors: [Color.fromRGBO(200, 222, 255, 0.14), Color.fromRGBO(200, 222, 255, 0.14)]),
    innerFill: Color.fromRGBO(200, 222, 255, 0.07),
    border: Color(0x00000000),
    outline: null,
    specular: Color(0x00000000),
    shadows: [],
    barFill: LinearGradient(colors: [Color.fromRGBO(16, 25, 42, 0.84), Color.fromRGBO(16, 25, 42, 0.84)]),
    sheetFill: Color.fromRGBO(10, 17, 30, 0.74),
    title: AppColors.textPrimary,
    body: Color(0xFFCBD5E1),
    muted: AppColors.textSecondary,
  );

  // Світла «Крижана Арктика»: та сама формула інею на льодовому тлі — біле матове скло.
  static const daylight = ArcticGlassThemeExtension(
    light: true,
    background: [Color(0xFFEFF4FA), Color(0xFFE6EEF8)],
    glows: [
      ArcticGlow(Alignment(-0.95, -0.75), 0.85, Color(0xFF0EA5E9), 0.18),
      ArcticGlow(Alignment(1.0, 0.15), 0.8, Color(0xFF1D4ED8), 0.12),
    ],
    glassFill: LinearGradient(colors: [Color.fromRGBO(255, 255, 255, 0.72), Color.fromRGBO(255, 255, 255, 0.72)]),
    pressedFill: LinearGradient(colors: [Color.fromRGBO(255, 255, 255, 0.88), Color.fromRGBO(255, 255, 255, 0.88)]),
    innerFill: Color.fromRGBO(15, 23, 42, 0.04),
    border: Color(0x00000000),
    outline: null,
    specular: Color(0x00000000),
    shadows: [],
    barFill: LinearGradient(colors: [Color.fromRGBO(255, 255, 255, 0.84), Color.fromRGBO(255, 255, 255, 0.84)]),
    sheetFill: Color.fromRGBO(244, 248, 253, 0.8),
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
