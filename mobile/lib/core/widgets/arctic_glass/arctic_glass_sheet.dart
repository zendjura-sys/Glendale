import 'package:flutter/material.dart';

import '../../../theme.dart' show palette, popover;
import '../../theme/arctic_glass_theme.dart';
import 'arctic_glass_container.dart';

/// Поверхня шторки чи ШІ-поповера: glassTier3 з розмиттям 28 і ручкою 36×4.
/// Використовується всередині прозорого showModalBottomSheet (див. [showArcticGlassSheet]).
class ArcticGlassSheetSurface extends StatelessWidget {
  const ArcticGlassSheetSurface({required this.child, this.handle = true, super.key});
  final Widget child;
  final bool handle;

  @override
  Widget build(BuildContext context) {
    final light = palette.isLight;
    return ArcticGlassContainer(
      enableBlur: true,
      blur: AppBlur.sheet,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadii.dock)),
      color: light ? popover.withValues(alpha: 0.92) : AppColors.glassTier3,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (handle)
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 10, bottom: 6),
                width: 36,
                height: 4,
                decoration: BoxDecoration(color: light ? const Color(0x3D0D1B2E) : Colors.white24, borderRadius: BorderRadius.circular(4)),
              ),
            ),
          Flexible(child: child),
        ],
      ),
    );
  }
}

/// Прозора модальна шторка «Spatial Glass» (isScrollControlled) — для меню, ШІ-відповідей тощо.
Future<T?> showArcticGlassSheet<T>(BuildContext context, {required WidgetBuilder builder, bool useRootNavigator = true}) {
  return showModalBottomSheet<T>(
    context: context,
    useRootNavigator: useRootNavigator,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    elevation: 0,
    barrierColor: Colors.black.withValues(alpha: 0.45),
    builder: (sheet) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(sheet).bottom),
      child: ArcticGlassSheetSurface(
        child: Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.viewPaddingOf(sheet).bottom),
          child: Builder(builder: builder),
        ),
      ),
    ),
  );
}
