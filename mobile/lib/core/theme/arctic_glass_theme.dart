import 'package:flutter/material.dart';

// Дизайн-система «Spatial Glass» (Arctic Ice & Electric Sapphire): токени застосунку.
// Лише крижані й сапфірові відтінки — без фіолетового й рожевого. Палітра теми (theme.dart)
// та віджети core/widgets/arctic_glass беруть кольори звідси.

abstract final class AppColors {
  // Тло
  static const bgBase = Color(0xFF04070D);
  static const bgElevated = Color(0xFF080E1A);

  // Скло: tier1 — елементи списків, tier2 — картки й поля, tier3 — шторки та поповери.
  static const glassTier1 = Color.fromRGBO(255, 255, 255, 0.04);
  static const glassTier2 = Color.fromRGBO(255, 255, 255, 0.07);
  static const glassTier3 = Color.fromRGBO(12, 20, 36, 0.78);

  // Рамки
  static const borderHairline = Color.fromRGBO(255, 255, 255, 0.09);
  static const borderSpecularTop = Color.fromRGBO(255, 255, 255, 0.22);
  static const borderSapphire = Color.fromRGBO(0, 210, 255, 0.40);

  // Акценти
  static const accentPrimary = Color(0xFF0A84FF);
  static const accentCyan = Color(0xFF00D2FF);
  static const accentGradient = LinearGradient(colors: [accentPrimary, accentCyan], begin: Alignment.topLeft, end: Alignment.bottomRight);

  // Текст
  static const textPrimary = Color(0xFFF8FAFC);
  static const textSecondary = Color(0xFF94A3B8);
  static const textMuted = Color(0xFF64748B);

  /// Діагональна заливка скла: білий .09 → .02.
  static const glassFill = LinearGradient(colors: [Color.fromRGBO(255, 255, 255, 0.09), Color.fromRGBO(255, 255, 255, 0.02)], begin: Alignment.topLeft, end: Alignment.bottomRight);

  /// Мерехтіння скелетонів: ледь помітне скло → крижаний ціан → скло.
  static const shimmer = [Color.fromRGBO(255, 255, 255, 0.03), Color.fromRGBO(0, 210, 255, 0.10), Color.fromRGBO(255, 255, 255, 0.03)];
}

/// Радіуси: картки — 20, док і шторки — 28, кнопки й поля — 14.
abstract final class AppRadii {
  static const card = 20.0;
  static const dock = 28.0;
  static const control = 14.0;
}

/// Розмиття: нерухомі елементи (шапка, док) — 20, шторки — 28, док — 24.
abstract final class AppBlur {
  static const fixed = 20.0;
  static const dock = 24.0;
  static const sheet = 28.0;
}

/// Крижане світіння навколо активного елемента (вкладка доку, кнопка ШІ).
List<BoxShadow> iceGlow({double strength = 1}) => [BoxShadow(color: AppColors.accentCyan.withValues(alpha: 0.45 * strength), blurRadius: 14, spreadRadius: -2)];
