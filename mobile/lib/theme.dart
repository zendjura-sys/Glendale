import 'package:flutter/material.dart';

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

/// «Неоновий синій» — нічне тло, неоново-синій акцент.
const neonPalette = GcPalette(
  brightness: Brightness.dark,
  voidColor: Color(0xFF050913),
  abyss: Color(0xFF070D1C),
  deep: Color(0xFF0C1428),
  popover: Color(0xFF0C1428),
  ink: Color(0xFFE9F0FF),
  soft: Color(0xFFC9D5F0),
  muted: Color(0xFF8C9CC2),
  faint: Color(0xFF5A6A8F),
  primary: Color(0xFF2F7BFF),
  card: Color(0xFF101A32),
  cardTop: Color(0xFF111C36),
  raised: Color(0xFF16223F),
  field: Color(0xFF131D34),
  bar: Color(0xFF101931),
  line: Color(0x12FFFFFF),
  lineStrong: Color(0x1AFFFFFF),
  fg: Colors.white,
  brand: [Color(0xFF2A6CFF), Color(0xFF2F8CFF), Color(0xFF22C4F0)],
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
  primary: Color(0xFF1D6FE0),
  card: Color(0xFFFBFDFF),
  cardTop: Color(0xFFFBFDFF),
  raised: Color(0xFFFFFFFF),
  field: Color(0xFFEDF2F8),
  bar: Color(0xFFFCFEFF),
  line: Color(0x170D1B2E),
  lineStrong: Color(0x1F0D1B2E),
  fg: Color(0xFF0D1B2E),
  brand: [Color(0xFF1D6FE0), Color(0xFF1C8FE6), Color(0xFF22B5E3)],
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
Color get primary => palette.primary;
Color get fg => palette.fg;
Color get fgSoft => palette.fg.withValues(alpha: 0.7);

// Акценти однакові в обох темах.
const neonBlue = Color(0xFF2F7BFF);
const indigo = Color(0xFF3D63FF);
const violet = Color(0xFFA855F7);
const pink = Color(0xFFF04FD8);
const cyan = Color(0xFF22D3EE);
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
  begin: Alignment.centerLeft,
  end: Alignment.centerRight,
);

/// Кнопки — суцільний акцент, без градієнта й світіння (як .btn-glow у стилі «GameCon»).
LinearGradient get buttonGradient => LinearGradient(colors: [primary, primary]);

LinearGradient get glassGradient => LinearGradient(
  colors: [cardTop, card],
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
);

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
        ? ColorScheme.light(primary: primary, onPrimary: Colors.white, secondary: violet, surface: popover, onSurface: ink, error: danger)
        : ColorScheme.dark(primary: primary, onPrimary: Colors.white, secondary: violet, surface: popover, onSurface: ink, error: danger),
    fontFamily: 'Montserrat',
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(fontFamily: 'Montserrat', bodyColor: ink, displayColor: ink),
    splashColor: indigo.withValues(alpha: 0.16),
    highlightColor: Colors.white.withValues(alpha: 0.03),
    dividerColor: line,
    textSelectionTheme: TextSelectionThemeData(cursorColor: primary, selectionColor: indigo.withValues(alpha: 0.45), selectionHandleColor: primary),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: popover,
      contentTextStyle: onest.copyWith(color: ink),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: lineStrong)),
    ),
    bottomSheetTheme: BottomSheetThemeData(backgroundColor: popover, surfaceTintColor: Colors.transparent, showDragHandle: false),
    dialogTheme: DialogThemeData(
      backgroundColor: popover,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22), side: BorderSide(color: lineStrong)),
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
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? primary : const Color(0xFF2A3050)),
      trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
    ),
    sliderTheme: SliderThemeData(activeTrackColor: primary, thumbColor: Colors.white, inactiveTrackColor: Color(0xFF2A3050), overlayColor: Color(0x226D7DFF)),
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
