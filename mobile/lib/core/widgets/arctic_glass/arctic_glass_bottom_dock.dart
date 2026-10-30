import 'package:flutter/material.dart';

import '../../../theme.dart' show palette, ink, muted, body;
import '../../theme/arctic_glass_theme.dart';
import 'arctic_glass_container.dart';

/// Розміри плаваючого доку: відступи 16 з боків і 20 знизу, висота 64, радіус 32.
abstract final class ArcticDock {
  static const height = 64.0;
  static const side = 16.0;
  static const bottom = 20.0;
  static const radius = 32.0;
}

/// Поверхня плаваючого доку: сильніше розмиття (24) і тінь, що відриває його від стрічки.
/// Вміст (вкладки, розгорнуте меню) — будь-який.
class ArcticDockSurface extends StatelessWidget {
  const ArcticDockSurface({required this.child, this.height, this.radius = ArcticDock.radius, super.key});
  final Widget child;
  final double? height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final light = palette.isLight;
    return ArcticGlassContainer(
      enableBlur: true,
      blur: AppBlur.dock,
      radius: radius,
      height: height,
      fill: light
          ? const LinearGradient(colors: [Color.fromRGBO(255, 255, 255, 0.88), Color.fromRGBO(244, 248, 252, 0.78)], begin: Alignment.topLeft, end: Alignment.bottomRight)
          : const LinearGradient(colors: [Color.fromRGBO(16, 24, 40, 0.72), Color.fromRGBO(8, 14, 26, 0.82)], begin: Alignment.topLeft, end: Alignment.bottomRight),
      shadows: [
        BoxShadow(
          color: Colors.black.withValues(alpha: light ? 0.10 : 0.55),
          blurRadius: 32,
          offset: const Offset(0, 14),
          spreadRadius: -8,
        ),
      ],
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

/// Плаваючий док із вкладками: активна — ціанова іконка з крижаною крапкою-світінням під нею.
class ArcticFloatingDock extends StatelessWidget {
  const ArcticFloatingDock({required this.items, required this.current, required this.onTap, super.key});
  final List<ArcticDockItem> items;
  final int current;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(ArcticDock.side, 0, ArcticDock.side, ArcticDock.bottom),
      child: ArcticDockSurface(
        height: ArcticDock.height,
        child: Row(
          children: [
            for (var i = 0; i < items.length; i++)
              Expanded(
                child: ArcticDockTab(item: items[i], active: i == current, onTap: () => onTap(i)),
              ),
          ],
        ),
      ),
    );
  }
}

/// Вкладка доку (використовує й острів-меню застосунку).
class ArcticDockTab extends StatelessWidget {
  const ArcticDockTab({required this.item, required this.active, required this.onTap, this.height = 52, super.key});
  final ArcticDockItem item;
  final bool active;
  final VoidCallback onTap;
  final double height;

  @override
  Widget build(BuildContext context) {
    final still = MediaQuery.disableAnimationsOf(context);
    final idle = palette.isLight ? ink.withValues(alpha: 0.55) : muted;
    final on = palette.isLight ? AppColors.accentPrimary : AppColors.accentCyan;
    return Semantics(
      selected: active,
      button: true,
      label: item.label,
      child: InkResponse(
        onTap: onTap,
        highlightShape: BoxShape.rectangle,
        borderRadius: BorderRadius.circular(18),
        splashColor: AppColors.accentCyan.withValues(alpha: 0.10),
        child: SizedBox(
          height: height,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  AnimatedSwitcher(
                    duration: still ? Duration.zero : const Duration(milliseconds: 180),
                    child: Icon(active ? (item.activeIcon ?? item.icon) : item.icon, key: ValueKey(active), size: 22, color: active ? on : idle),
                  ),
                  if (item.badge case final b?) Positioned(right: -10, top: -4, child: b),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                item.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: body(10.5, color: active ? on : idle, weight: active ? FontWeight.w600 : FontWeight.w500),
              ),
              const SizedBox(height: 3),
              // Крижана крапка під активною вкладкою.
              AnimatedContainer(
                duration: still ? Duration.zero : const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                width: active ? 4 : 0,
                height: 4,
                decoration: BoxDecoration(color: on, shape: BoxShape.circle, boxShadow: active ? iceGlow() : const []),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
