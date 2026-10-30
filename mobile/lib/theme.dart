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
  bar: Color.fromRGBO(8, 14, 26, 0.72),
  line: AppColors.borderHairline,
  lineStrong: Color.fromRGBO(255, 255, 255, 0.12),
  fg: Colors.white,
  brand: [AppColors.accentPrimary, Color(0xFF05ABFF), AppColors.accentCyan],
);

/// «Крижана Арктика» — холодне біле скло, блакитний лід, чорнильний текст.
const arcticPalette = GcPalette(
  brightness: Brightness.light,
  voidColor: Color(0xFFE9F1F8),
  abyss: Color(0xFFF3F8FC),
  deep: Color(0xFFF7FBFF),
  popover: Color(0xFFF7FBFF),
  ink: Color(0xFF0D1B2E),
  soft: Color(0xFF24364F),
  muted: Color(0xFF5A6D85),
  faint: Color(0xFF8797AB),
  primary: Color(0xFF0A6FE0),
  card: Color(0xFFFBFDFF),
  cardTop: Color(0xFFFBFDFF),
  raised: Color(0xFFFFFFFF),
  field: Color(0xFFEDF2F8),
  bar: Color(0xFFFCFEFF),
  line: Color(0x170D1B2E),
  lineStrong: Color(0x1F0D1B2E),
  fg: Color(0xFF0D1B2E),
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

/// Скло карток: діагональ білий .09 → .02 (у світлій темі — молочне скло).
LinearGradient get glassGradient => palette.isLight
    ? LinearGradient(colors: [cardTop, card], begin: Alignment.topCenter, end: Alignment.bottomCenter)
    : AppColors.glassFill;

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
    textTheme: base.textTheme.apply(fontFamily: 'Montserrat', bodyColor: ink, displayColor: ink),
    splashColor: cyan.withValues(alpha: 0.10),
    highlightColor: Colors.white.withValues(alpha: 0.03),
    dividerColor: line,
    textSelectionTheme: TextSelectionThemeData(cursorColor: primary, selectionColor: primary.withValues(alpha: 0.40), selectionHandleColor: primary),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: popover,
      contentTextStyle: onest.copyWith(color: ink),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: lineStrong)),
    ),
    bottomSheetTheme: BottomSheetThemeData(backgroundColor: popover, surfaceTintColor: Colors.transparent, showDragHandle: false, elevation: 0),
    appBarTheme: AppBarTheme(backgroundColor: Colors.transparent, surfaceTintColor: Colors.transparent, elevation: 0, scrolledUnderElevation: 0, foregroundColor: ink),
    dialogTheme: DialogThemeData(
      backgroundColor: popover,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.dock), side: BorderSide(color: lineStrong)),
      titleTextStyle: display(18),
      contentTextStyle: body(14, color: soft),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: popover,
      surfaceTintColor: Colors.transparent,
      textStyle: body(14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: lineStrong)),
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

/// Сторінки прозорі (фон — спільна «аврора»), тож замість зуму — м’який перехресний фейд зі зсувом.
class _FadeThrough extends PageTransitionsBuilder {
  const _FadeThrough();

  @override
  Duration get transitionDuration => const Duration(milliseconds: 280);

  @override
  Widget buildTransitions<T>(PageRoute<T> route, BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation, Widget child) {
    final enter = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic, reverseCurve: Curves.easeInCubic);
    final leave = CurvedAnimation(parent: secondaryAnimation, curve: Curves.easeOutCubic);
    return FadeTransition(
      opacity: ReverseAnimation(leave),
      child: FadeTransition(
        opacity: enter,
        child: SlideTransition(
          position: Tween(begin: const Offset(0, 0.025), end: Offset.zero).animate(enter),
          child: child,
        ),
      ),
    );
  }
}
