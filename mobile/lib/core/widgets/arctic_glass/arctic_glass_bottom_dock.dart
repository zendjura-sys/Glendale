import 'package:flutter/material.dart';

import '../../../theme.dart' show palette, ink, muted, body;
import '../../theme/arctic_glass_theme.dart';
import 'arctic_glass_container.dart';
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
  const ArcticDockSurface({required this.child, this.height, this.radius = ArcticDock.radius, this.glowing = false, this.blur = AppBlur.dock, super.key});
  final Widget child;
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
      fill: tokens.barFill,
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

/// Ряд вкладок доку з перетічною світловою капсулою під активною вкладкою
/// (AnimatedAlign, easeOutBack, 280 мс): без обводки — м'яка неонова пляма, а іконка й підпис
/// активної вкладки світяться неоном. [current] null — без підсвітки.
class ArcticDockTabs extends StatelessWidget {
  const ArcticDockTabs({required this.items, required this.current, required this.onTap, this.height = 56, super.key});
  final List<ArcticDockItem> items;
  final int? current;
  final ValueChanged<int> onTap;
  final double height;

  @override
  Widget build(BuildContext context) {
    final still = MediaQuery.disableAnimationsOf(context);
    final n = items.length;
    final at = current;
    final light = palette.isLight;
    return SizedBox(
      height: height,
      child: Stack(
        children: [
          if (n > 0)
            AnimatedAlign(
              duration: still ? Duration.zero : const Duration(milliseconds: 280),
              curve: Curves.easeOutBack,
              alignment: Alignment(n == 1 ? 0 : -1 + 2 * (at ?? 0) / (n - 1), 0),
              child: FractionallySizedBox(
                widthFactor: 1 / n,
                child: AnimatedOpacity(
                  duration: still ? Duration.zero : const Duration(milliseconds: 200),
                  opacity: at == null ? 0 : 1,
                  // Без обводки й заливки: м'яка неонова пляма світла під активною вкладкою.
                  child: Center(
                    child: Container(
                      width: 64,
                      height: height,
                      decoration: BoxDecoration(
                        gradient: RadialGradient(
                          radius: 0.6,
                          colors: [(light ? AppColors.accentPrimary : AppColors.accentCyan).withValues(alpha: light ? 0.16 : 0.22), (light ? AppColors.accentPrimary : AppColors.accentCyan).withValues(alpha: 0)],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
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
    final on = palette.isLight ? AppColors.accentPrimary : AppColors.accentCyan;
    final color = active ? on : idle;
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
            Stack(
              clipBehavior: Clip.none,
              children: [
                AnimatedSwitcher(
                  duration: still ? Duration.zero : const Duration(milliseconds: 200),
                  child: Icon(active ? (item.activeIcon ?? item.icon) : item.icon, key: ValueKey(active), size: 22, color: color, shadows: active ? _neon(on) : null),
                ),
                if (item.badge case final b?) Positioned(right: -10, top: -4, child: b),
              ],
            ),
            const SizedBox(height: 3),
            AnimatedDefaultTextStyle(
              duration: still ? Duration.zero : const Duration(milliseconds: 200),
              style: body(10.5, color: color, weight: active ? FontWeight.w700 : FontWeight.w500).copyWith(shadows: active ? _neon(on, soft: true) : const []),
              child: Text(item.label, maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
          ],
        ),
      ),
    );
  }
}

/// Неонове світіння активної вкладки.
List<Shadow> _neon(Color color, {bool soft = false}) => [
  Shadow(color: color.withValues(alpha: soft ? 0.6 : 0.85), blurRadius: soft ? 6 : 10),
  Shadow(color: color.withValues(alpha: soft ? 0.25 : 0.4), blurRadius: soft ? 14 : 22),
];
