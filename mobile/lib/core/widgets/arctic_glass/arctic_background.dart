import 'package:flutter/material.dart';

import '../../../theme.dart' show palette, voidColor;
import '../../theme/arctic_glass_theme.dart';

/// Тло всіх екранів: глибокий bgBase і два тихі радіальні сяйва —
/// сапфірове вгорі ліворуч (12%) і крижане ціанове внизу праворуч (8%).
class ArcticBackground extends StatelessWidget {
  const ArcticBackground({required this.child, super.key});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final light = palette.isLight;
    return DecoratedBox(
      decoration: BoxDecoration(color: light ? voidColor : AppColors.bgBase),
      child: Stack(
        children: [
          Positioned.fill(
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: const Alignment(-1, -1),
                    radius: 1.1,
                    colors: [
                      AppColors.accentPrimary.withValues(alpha: light ? 0.16 : 0.12),
                      AppColors.accentPrimary.withValues(alpha: 0),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Positioned.fill(
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: const Alignment(1, 1),
                    radius: 1.0,
                    colors: [
                      AppColors.accentCyan.withValues(alpha: light ? 0.12 : 0.08),
                      AppColors.accentCyan.withValues(alpha: 0),
                    ],
                  ),
                ),
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}
