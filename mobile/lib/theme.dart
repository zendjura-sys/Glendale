import 'package:flutter/material.dart';

import 'core/theme/arctic_glass_theme.dart';

// Палітра та сама, що в resources/css/app.css сайту (стиль «GameCon»): дві теми —
// темна «Неоновий синій» і світла «Крижана Арктика». Кольори нижче — геттери поточної палітри,
// тож після перемикання теми застосунок перебудовується й бере нові значення (див. ThemeController).

class GcPalette {
  const GcPalette({
    required this.brightness,
    required this.voidColor,
    required this.abyss,
    required this.deep,
    required this.popover,
    required this.ink,
    required this.soft,
    required this.muted,
    required this.faint,
    required this.primary,
    required this.card,
    required this.cardTop,
    required this.raised,
    required this.field,
    required this.bar,
    required this.line,
    required this.lineStrong,
    required this.fg,
    required this.brand,
  });

  final Brightness brightness;
  final Color voidColor, abyss, deep, popover, ink, soft, muted, faint, primary;
  final Color card, cardTop, raised, field, bar, line, lineStrong;

  /// «Білий» інтерфейсу (як --color-white на сайті): білий у темній темі, чорнило — у світлій.
  /// Напівпрозорі заливки й підкладки беруть його з альфою.
  final Color fg;
  final List<Color> brand;

  bool get isLight => brightness == Brightness.light;
}

/// Темна тема — «Spatial Glass» (Arctic Ice & Electric Sapphire): глибоке тло, напівпрозоре скло,
/// сапфірово-ціанові акценти. Значення — з токенів AppColors (core/theme/arctic_glass_theme.dart).
const neonPalette = GcPalette(
  brightness: Brightness.dark,
  voidColor: AppColors.bgBase,
  abyss: AppColors.bgElevated,
  deep: Color(0xFF0A1222),
  // Непрозорий відповідник glassTier3 — діалоги, снекбари, меню без розмиття.
  popover: Color(0xFF0C1424),
  ink: AppColors.textPrimary,
  soft: Color(0xFFCBD5E1),
  muted: AppColors.textSecondary,
  faint: AppColors.textMuted,
  primary: AppColors.accentPrimary,
  // Скло: tier2 (.07) з бліком угорі (.09).
  card: AppColors.glassTier2,
  cardTop: Color.fromRGBO(255, 255, 255, 0.09),
  raised: Color.fromRGBO(255, 255, 255, 0.10),
  field: AppColors.glassTier2,
  bar: Color.fromRGBO(20, 20, 22, 0.55),
  line: AppColors.borderHairline,
  lineStrong: Color.fromRGBO(255, 255, 255, 0.12),
  fg: Colors.white,
  brand: [AppColors.accentPrimary, Color(0xFF05ABFF), AppColors.accentCyan],
);

/// Світла тема — «Alpine Glacier Daylight»: льодовикове блакитне тло, оптичне молочне скло
/// з білою гранню й сапфіровим контуром, чорнильні заголовки.
const arcticPalette = GcPalette(
  brightness: Brightness.light,
  voidColor: Color(0xFFE2ECF8),
  abyss: Color(0xFFEEF4FC),
  deep: Color(0xFFF4F8FD),
  popover: Color(0xFFF6FAFF),
  ink: AppColors.lightTitle,
  soft: AppColors.lightBody,
  muted: AppColors.lightMuted,
  faint: Color(0xFF8A9AB0),
  primary: Color(0xFF0A6FE0),
  card: Color.fromRGBO(255, 255, 255, 0.46),
  cardTop: Color.fromRGBO(255, 255, 255, 0.72),
  raised: Color(0xFFFFFFFF),
  field: Color.fromRGBO(255, 255, 255, 0.70),
  bar: Color.fromRGBO(255, 255, 255, 0.78),
  line: Color(0x170B1528),
  lineStrong: Color(0x1F0B1528),
  fg: AppColors.lightTitle,
  brand: [Color(0xFF0A6FE0), Color(0xFF0A8FE6), Color(0xFF00A8E0)],
);

/// Поточна палітра (ставить ThemeController).
GcPalette palette = neonPalette;

Color get voidColor => palette.voidColor;
Color get abyss => palette.abyss;
Color get deep => palette.deep;
Color get popover => palette.popover;
Color get ink => palette.ink;
Color get soft => palette.soft;
Color get muted => palette.muted;
Color get faint => palette.faint;

/// Акцентний текст та іконки (`text-gc-lilac-400` на сайті): у світлій темі темніший, щоб читався на білому.
Color get accent => palette.isLight ? Color.lerp(palette.primary, palette.ink, 0.12)! : const Color(0xFF7CC8FF);
Color get primary => palette.primary;
Color get fg => palette.fg;
Color get fgSoft => palette.fg.withValues(alpha: 0.7);

// Акценти однакові в обох темах. Лише сапфір і крижаний ціан — без фіолетового й рожевого:
// старі імена (violet, pink) лишилися для сумісності, але ведуть у ту саму холодну гаму.
const neonBlue = AppColors.accentPrimary;
const indigo = Color(0xFF1F6BFF);
const violet = Color(0xFF38BDF8);
const pink = Color(0xFFFF4D6D);
const cyan = AppColors.accentCyan;
const gold = Color(0xFFF5C451);
const green = Color(0xFF34D399);
const danger = Color(0xFFFF4D6D);
const dangerSoft = Color(0xFFFF8FA3);

/// Скляна поверхня (`.glass` стилю «GameCon»): матове скло без рамки.
Color get card => palette.card;
Color get cardTop => palette.cardTop;
Color get raised => palette.raised;
Color get field => palette.field;
Color get bar => palette.bar;
Color get line => palette.line;
Color get lineStrong => palette.lineStrong;

/// `--gc-gradient` стилю «GameCon»: неоновий синій → блакить.
LinearGradient get brand => LinearGradient(
  colors: palette.brand,
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
);

/// Кнопки — сапфіровий градієнт accentGradient.
LinearGradient get buttonGradient => palette.isLight ? LinearGradient(colors: [primary, primary]) : AppColors.accentGradient;

/// Скло карток — з токенів теми (ArcticGlassThemeExtension).
Gradient get glassGradient => (palette.isLight ? ArcticGlassThemeExtension.daylight : ArcticGlassThemeExtension.dark).glassFill;

/// Montserrat — той самий шрифт, що й на сайті, вбудований у застосунок.
TextStyle get onest => TextStyle(fontFamily: 'Montserrat', color: ink);
TextStyle get unbounded => TextStyle(fontFamily: 'Montserrat', color: ink, fontWeight: FontWeight.w700);

TextStyle display(double size, {Color? color}) => unbounded.copyWith(fontSize: size, color: color ?? ink, height: 1.15, letterSpacing: -0.3);
TextStyle body(double size, {Color? color, FontWeight weight = FontWeight.w400}) => onest.copyWith(fontSize: size, color: color ?? ink, fontWeight: weight);

ThemeData gameConTheme() {
  final base = ThemeData(
    brightness: palette.brightness,
    useMaterial3: true,
    scaffoldBackgroundColor: Colors.transparent,
    colorScheme: palette.isLight
        ? ColorScheme.light(primary: primary, onPrimary: Colors.white, secondary: cyan, surface: popover, onSurface: ink, error: danger)
        : ColorScheme.dark(primary: primary, onPrimary: Colors.white, secondary: cyan, surface: popover, onSurface: ink, error: danger),
    fontFamily: 'Montserrat',
  );
  return base.copyWith(
    extensions: [palette.isLight ? ArcticGlassThemeExtension.daylight : ArcticGlassThemeExtension.dark],
    textTheme: base.textTheme.apply(fontFamily: 'Montserrat', bodyColor: ink, displayColor: ink),
    splashColor: cyan.withValues(alpha: 0.10),
    highlightColor: Colors.white.withValues(alpha: 0.03),
    dividerColor: line,
    textSelectionTheme: TextSelectionThemeData(cursorColor: primary, selectionColor: primary.withValues(alpha: 0.40), selectionHandleColor: primary),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: popover,
      contentTextStyle: onest.copyWith(color: ink),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    bottomSheetTheme: BottomSheetThemeData(backgroundColor: popover, surfaceTintColor: Colors.transparent, showDragHandle: false, elevation: 0),
    appBarTheme: AppBarTheme(backgroundColor: Colors.transparent, surfaceTintColor: Colors.transparent, elevation: 0, scrolledUnderElevation: 0, foregroundColor: ink),
    dialogTheme: DialogThemeData(
      backgroundColor: popover,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.dock)),
      titleTextStyle: display(18),
      contentTextStyle: body(14, color: soft),
    ),
    // Меню без тіні й обводки — лише скляна заливка.
    popupMenuTheme: PopupMenuThemeData(
      elevation: 0,
      shadowColor: Colors.transparent,
      color: popover,
      surfaceTintColor: Colors.transparent,
      textStyle: body(14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) => Colors.white),
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? primary : const Color(0x1FFFFFFF)),
      trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
    ),
    sliderTheme: SliderThemeData(activeTrackColor: primary, thumbColor: Colors.white, inactiveTrackColor: Color(0x1FFFFFFF), overlayColor: Color(0x2200D2FF)),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: primary),
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.android: _FadeThrough(),
      TargetPlatform.iOS: _FadeThrough(),
    }),
  );
}

/// Сторінки прозорі (фон — спільне тло), тож замість зуму — м’який перехресний фейд зі зсувом (220 мс):
/// і переходи між вкладками доку, і відкриття екранів.
class _FadeThrough extends PageTransitionsBuilder {
  const _FadeThrough();

  @override
  Duration get transitionDuration => const Duration(milliseconds: 220);

  @override
  Widget buildTransitions<T>(PageRoute<T> route, BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation, Widget child) {
    final enter = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic, reverseCurve: Curves.easeInCubic);
    final leave = CurvedAnimation(parent: secondaryAnimation, curve: Curves.easeOutCubic);
    // Opacity замість FadeTransition: у спокої (повна видимість) сторінка без шару прозорості,
    // тож скло на ній розмиває спільне тло й сезонні прикраси під нею.
    return AnimatedBuilder(
      animation: Listenable.merge([enter, leave]),
      child: SlideTransition(
        position: Tween(begin: const Offset(0, 0.025), end: Offset.zero).animate(enter),
        child: child,
      ),
      builder: (context, child) => Opacity(opacity: (enter.value * (1 - leave.value)).clamp(0, 1), child: child),
    );
  }
}

/// «Яблучна» прокрутка всюди: пружний відскок на краях, і список тягнеться навіть короткий.
class ArcticScrollBehavior extends MaterialScrollBehavior {
  const ArcticScrollBehavior();

  @override
  ScrollPhysics getScrollPhysics(BuildContext context) => const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics());
}
