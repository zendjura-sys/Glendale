import 'package:flutter/material.dart';

// Палітра та сама, що в resources/css/app.css сайту.
const voidColor = Color(0xFF05070F);
const abyss = Color(0xFF0A0E1C);
const deep = Color(0xFF0F1426);
const popover = Color(0xFF0D1222);
const ink = Color(0xFFEEF1FF);
const soft = Color(0xFFDFE3F7);
const muted = Color(0xFF8B93B3);
const faint = Color(0xFF5C6385);
const neonBlue = Color(0xFF4F8BFF);
const indigo = Color(0xFF6D5DFC);
const violet = Color(0xFFA855F7);
const primary = Color(0xFF6D7DFF);
const pink = Color(0xFFF04FD8);
const cyan = Color(0xFF38E1FF);
const gold = Color(0xFFF5C451);
const green = Color(0xFF34D399);
const danger = Color(0xFFFF4D6D);
const dangerSoft = Color(0xFFFF8FA3);

/// Скляна поверхня на темному тлі (`.glass`): rgb(10 14 30 / .55) + біла поволока.
const card = Color(0xFF10142A);
const cardTop = Color(0xFF151A30);
const raised = Color(0xFF181D35);
const field = Color(0xFF0C1022);
const bar = Color(0xFF080B18);
const line = Color(0x13FFFFFF); // white 7.5%
const lineStrong = Color(0x1AFFFFFF); // white 10%

/// `--gc-gradient`
const brand = LinearGradient(
  colors: [neonBlue, indigo, violet, pink],
  stops: [0, 0.45, 0.8, 1],
  begin: Alignment.centerLeft,
  end: Alignment.centerRight,
);

/// Кнопки на сайті показують ліву частину градієнта (background-size: 180%).
const buttonGradient = LinearGradient(
  colors: [Color(0xFF5A86FF), Color(0xFF7062FB), Color(0xFF9257F6)],
  begin: Alignment.centerLeft,
  end: Alignment.centerRight,
);

const glassGradient = LinearGradient(
  colors: [cardTop, card],
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
);

const onest = TextStyle(fontFamily: 'Onest', color: ink);
const unbounded = TextStyle(fontFamily: 'Unbounded', color: ink, fontWeight: FontWeight.w700);

TextStyle display(double size, {Color color = ink}) => unbounded.copyWith(fontSize: size, color: color, height: 1.15, letterSpacing: -0.3);
TextStyle body(double size, {Color color = ink, FontWeight weight = FontWeight.w400}) => onest.copyWith(fontSize: size, color: color, fontWeight: weight);

ThemeData gameConTheme() {
  final base = ThemeData(
    brightness: Brightness.dark,
    useMaterial3: true,
    scaffoldBackgroundColor: Colors.transparent,
    colorScheme: const ColorScheme.dark(
      primary: primary,
      onPrimary: Colors.white,
      secondary: violet,
      surface: popover,
      onSurface: ink,
      error: danger,
    ),
    fontFamily: 'Onest',
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(fontFamily: 'Onest', bodyColor: ink, displayColor: ink),
    splashColor: indigo.withValues(alpha: 0.16),
    highlightColor: Colors.white.withValues(alpha: 0.03),
    dividerColor: line,
    textSelectionTheme: TextSelectionThemeData(cursorColor: primary, selectionColor: indigo.withValues(alpha: 0.45), selectionHandleColor: primary),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: popover,
      contentTextStyle: onest.copyWith(color: ink),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: lineStrong)),
    ),
    bottomSheetTheme: const BottomSheetThemeData(backgroundColor: popover, surfaceTintColor: Colors.transparent, showDragHandle: false),
    dialogTheme: DialogThemeData(
      backgroundColor: popover,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22), side: const BorderSide(color: lineStrong)),
      titleTextStyle: display(18),
      contentTextStyle: body(14, color: soft),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: popover,
      surfaceTintColor: Colors.transparent,
      textStyle: body(14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: lineStrong)),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) => Colors.white),
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? primary : const Color(0xFF2A3050)),
      trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
    ),
    sliderTheme: const SliderThemeData(activeTrackColor: primary, thumbColor: Colors.white, inactiveTrackColor: Color(0xFF2A3050), overlayColor: Color(0x226D7DFF)),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: primary),
  );
}
