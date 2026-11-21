import 'package:flutter/material.dart';

import 'arctic_fit_text.dart';

import '../../../theme.dart' show palette, ink, muted, body;
import '../../theme/arctic_glass_theme.dart';
import 'arctic_glass_container.dart';
import 'arctic_icon_pop.dart';
import 'arctic_pressable.dart';

/// Розміри плаваючого доку: висота 64, радіус 32, відступ знизу 6 (над системною смугою).
/// Бічні поля адаптивні ([sideOf]): вузький телефон — 6, звичайний — 8, планшет — 12,
/// плюс виріз камери чи системні кнопки збоку в горизонтальному положенні.
abstract final class ArcticDock {
  static const height = 64.0;
  static const bottom = 6.0;
  static const radius = 32.0;

  static double sideOf(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    return width < 360 ? 6 : (width < 600 ? 8 : 12);
  }

  /// Бічні поля шапки й доку з урахуванням вирізу/системних смуг збоку.
  static EdgeInsets sidesOf(BuildContext context) {
    final pad = MediaQuery.viewPaddingOf(context);
    final side = sideOf(context);
    return EdgeInsets.only(left: side + pad.left, right: side + pad.right);
  }
}

/// Поверхня нерухомих панелей (док, шапка, міні-плеєр): щільніше скло з розмиттям 24
/// без тіні: панель відділяє від стрічки лише розмиття й грань.
class ArcticDockSurface extends StatelessWidget {
  const ArcticDockSurface({required this.child, this.height, this.radius = ArcticDock.radius, this.glowing = false, this.blur = AppBlur.dock, this.fill, super.key});
  final Widget child;

  /// Своя заливка замість щільного скла панелей (напр. розгорнуте меню — прозоріше).
  final Gradient? fill;
  final double blur;
  final double? height;
  final double radius;
  final bool glowing;

  @override
  Widget build(BuildContext context) {
    final tokens = ArcticGlassThemeExtension.of(context);
    return ArcticGlassContainer(
      enableBlur: true,
      blur: blur,
      radius: radius,
      height: height,
      glowing: glowing,
      fill: fill ?? tokens.barFill,
      borderColor: tokens.barBorder,
      shadows: tokens.barShadows,
      child: child,
    );
  }
}

class ArcticDockItem {
  const ArcticDockItem({required this.icon, required this.label, this.activeIcon, this.badge});
  final IconData icon;
  final IconData? activeIcon;
  final String label;
  final Widget? badge;
}

/// Ряд вкладок доку: без капсули під активною вкладкою — її іконка й підпис світяться неоном.
/// [current] null — без підсвітки.
class ArcticDockTabs extends StatelessWidget {
  const ArcticDockTabs({required this.items, required this.current, required this.onTap, this.height = 56, super.key});
  final List<ArcticDockItem> items;
  final int? current;
  final ValueChanged<int> onTap;
  final double height;

  @override
  Widget build(BuildContext context) {
    final n = items.length;
    final at = current;
    return SizedBox(
      height: height,
      child: Stack(
        children: [
          Row(
            children: [
              for (var i = 0; i < n; i++)
                Expanded(
                  child: ArcticDockTab(item: items[i], active: i == at, onTap: () => onTap(i)),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Плаваючий док із вкладками.
class ArcticFloatingDock extends StatelessWidget {
  const ArcticFloatingDock({required this.items, required this.current, required this.onTap, super.key});
  final List<ArcticDockItem> items;
  final int current;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: ArcticDock.sidesOf(context).copyWith(bottom: ArcticDock.bottom),
      child: ArcticDockSurface(
        height: ArcticDock.height,
        child: Padding(
          padding: const EdgeInsets.all(4),
          child: ArcticDockTabs(items: items, current: current, onTap: onTap),
        ),
      ),
    );
  }
}

/// Вкладка доку: іконка й підпис; активна — крижаний колір поверх світлової капсули.
class ArcticDockTab extends StatelessWidget {
  const ArcticDockTab({required this.item, required this.active, required this.onTap, super.key});
  final ArcticDockItem item;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final still = MediaQuery.disableAnimationsOf(context);
    final idle = palette.isLight ? ink.withValues(alpha: 0.55) : muted;
    // Активна вкладка (iOS 27): білий текст і іконка, без кольорового неону; над нею — срібляста риска.
    final on = palette.isLight ? AppColors.accentPrimary : Colors.white;
    final color = active ? on : idle;
    const glow = <Shadow>[];
    return Semantics(
      selected: active,
      button: true,
      label: item.label,
      child: ArcticPressable(
        onTap: onTap,
        scale: 0.92,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Індикатор активної вкладки: 22×3, срібно-біла риска з м'яким світінням.
            AnimatedOpacity(
              duration: still ? Duration.zero : const Duration(milliseconds: 220),
              opacity: active ? 1 : 0,
              child: Container(
                width: 22,
                height: 3,
                margin: const EdgeInsets.only(bottom: 5),
                decoration: BoxDecoration(
                  color: palette.isLight ? AppColors.accentPrimary : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(999),
                  boxShadow: [BoxShadow(color: (palette.isLight ? AppColors.accentPrimary : Colors.white).withValues(alpha: 0.45), blurRadius: 10)],
                ),
              ),
            ),
            Stack(
              clipBehavior: Clip.none,
              children: [
                ArcticIconPop(
                  active: active,
                  child: AnimatedSwitcher(
                    duration: still ? Duration.zero : const Duration(milliseconds: 200),
                    child: Icon(active ? (item.activeIcon ?? item.icon) : item.icon, key: ValueKey(active), size: 22, color: color, shadows: glow),
                  ),
                ),
                if (item.badge case final b?) Positioned(right: -10, top: -4, child: b),
              ],
            ),
            const SizedBox(height: 3),
            AnimatedDefaultTextStyle(
              duration: still ? Duration.zero : const Duration(milliseconds: 200),
              style: body(10.5, color: color, weight: active ? FontWeight.w700 : FontWeight.w500).copyWith(shadows: glow),
              child: FitText(item.label, wrap: false),
            ),
          ],
        ),
      ),
    );
  }
}
