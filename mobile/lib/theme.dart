import 'package:flutter/material.dart';

const voidColor = Color(0xFF05070F);
const abyss = Color(0xFF0A0E1C);
const deep = Color(0xFF0F1426);
const ink = Color(0xFFEEF1FF);
const muted = Color(0xFF8B93B3);
const neonBlue = Color(0xFF4F8BFF);
const indigo = Color(0xFF6D5DFC);
const pink = Color(0xFFF04FD8);
const cyan = Color(0xFF38E1FF);
const gold = Color(0xFFF5C451);

const brand = LinearGradient(
  colors: [neonBlue, Color(0xFF8B6BFF), pink],
  begin: Alignment.centerLeft,
  end: Alignment.centerRight,
);

const onest = TextStyle(fontFamily: 'Onest', color: ink);
const unbounded = TextStyle(fontFamily: 'Unbounded', color: ink, fontWeight: FontWeight.w700);

ThemeData gameConTheme() {
  final base = ThemeData(
    brightness: Brightness.dark,
    useMaterial3: true,
    scaffoldBackgroundColor: Colors.transparent,
    colorScheme: const ColorScheme.dark(
      primary: indigo,
      onPrimary: Colors.white,
      surface: deep,
      onSurface: ink,
    ),
    fontFamily: 'Onest',
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(fontFamily: 'Onest', bodyColor: ink, displayColor: ink),
    splashColor: indigo.withValues(alpha: 0.2),
  );
}
