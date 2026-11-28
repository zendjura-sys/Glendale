import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// Поверхня оверлею GameCon SDK для Flutter-ігор і застосунку: безбарвне матове скло
/// (як .gc-sdk-frosted-glass на вебі) — розмиття 34, графітова димка 80 % і світлий кант угорі.
/// Без кольорових відтінків: під ним видно гру, а не «пляму» інтерфейсу.
class GcGlassOverlaySurface extends StatelessWidget {
  const GcGlassOverlaySurface({required this.child, this.radius = 22, this.padding = const EdgeInsets.all(14), this.blur = true, super.key});

  final Widget child;
  final double radius;
  final EdgeInsetsGeometry padding;

  /// Вимкнути розмиття (слабкі пристрої, CEF без доступу до кадру гри) — тоді щільніша димка.
  final bool blur;

  static const Color tint = Color(0xFF12141A);

  @override
  Widget build(BuildContext context) {
    final shape = BorderRadius.circular(radius);
    final body = DecoratedBox(
      decoration: BoxDecoration(
        color: tint.withValues(alpha: blur ? .80 : .92),
        borderRadius: shape,
        border: Border(top: BorderSide(color: Colors.white.withValues(alpha: .24), width: 1)),
      ),
      child: Padding(padding: padding, child: child),
    );
    return ClipRRect(
      borderRadius: shape,
      child: blur ? BackdropFilter(filter: ui.ImageFilter.blur(sigmaX: 34, sigmaY: 34), child: body) : body,
    );
  }
}

/// Капсула HUD: компактний рядок поверх гри, поки панель закрита (паті, онлайн, повідомлення).
class GcOverlayHud extends StatelessWidget {
  const GcOverlayHud({required this.items, super.key});

  /// Іконка й підпис для кожного пункту капсули.
  final List<(IconData, String)> items;

  @override
  Widget build(BuildContext context) {
    return GcGlassOverlaySurface(
      radius: 999,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) Container(width: 1, height: 14, margin: const EdgeInsets.symmetric(horizontal: 10), color: Colors.white.withValues(alpha: .14)),
          Icon(items[i].$1, size: 15, color: Colors.white.withValues(alpha: .85)),
          const SizedBox(width: 6),
          Text(items[i].$2, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Colors.white.withValues(alpha: .92))),
        ],
      ]),
    );
  }
}
