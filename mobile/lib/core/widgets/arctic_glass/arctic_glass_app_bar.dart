import 'package:flutter/material.dart';

import 'arctic_fit_text.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../i18n.dart';
import '../../../theme.dart' show display, ink, muted;
import '../../theme/arctic_glass_theme.dart';
import 'arctic_glass_container.dart';

/// Шапка без тіні: розмите скло поверх контенту (Scaffold з extendBodyBehindAppBar).
class ArcticGlassAppBar extends StatelessWidget implements PreferredSizeWidget {
  const ArcticGlassAppBar({this.title, this.actions = const [], this.leading, this.showBack = true, super.key});
  final String? title;
  final List<Widget> actions;
  final Widget? leading;
  final bool showBack;

  static const height = 56.0;

  @override
  Size get preferredSize => const Size.fromHeight(height);

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.viewPaddingOf(context).top;
    final canPop = showBack && Navigator.of(context).canPop();
    return ArcticGlassContainer(
      enableBlur: true,
      radius: 0,
      specular: false,
      borderRadius: BorderRadius.zero,
      blur: AppBlur.fixed,
      // Молочне скло, як шапка-капсула й док; без лінії знизу.
      fill: ArcticGlassThemeExtension.of(context).barFill,
      child: Container(
        height: top + height,
        padding: EdgeInsets.only(top: top, left: 4, right: 4),
        child: Row(
          children: [
            if (leading != null)
              leading!
            else if (canPop)
              IconButton(
                tooltip: tr('Назад'),
                onPressed: () => Navigator.of(context).maybePop(),
                icon: Icon(LucideIcons.chevronLeft, color: ink),
              ),
            if (leading == null && !canPop) const SizedBox(width: 12),
            Expanded(
              child: title == null ? const SizedBox() : FitText(title!, style: display(17)),
            ),
            ...actions,
            IconTheme.merge(
              data: IconThemeData(color: muted),
              child: const SizedBox(width: 4),
            ),
          ],
        ),
      ),
    );
  }
}
