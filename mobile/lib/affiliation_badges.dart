import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'shell.dart' show appPathFor;
import 'theme.dart';
import 'widgets.dart';

/// Значки біля ніка: логотипи сім'ї, клану (гільдії), сервера й гри з відповідних розділів.
/// Дотик — картка з назвою, роллю й відомостями та кнопкою переходу в розділ.
class AffiliationBadges extends StatelessWidget {
  const AffiliationBadges({required this.user, this.size = 18, super.key});
  final Map<String, dynamic> user;
  final double size;

  static const _kinds = {
    'family': (LucideIcons.shield, 'Сім’я'),
    'clan': (LucideIcons.swords, 'Клан / гільдія'),
    'server': (LucideIcons.server, 'Сервер'),
    'game': (LucideIcons.gamepad2, 'Гра'),
  };

  @override
  Widget build(BuildContext context) {
    final badges = maps(user['badges']);
    if (badges.isEmpty) return const SizedBox.shrink();
    return Row(mainAxisSize: MainAxisSize.min, children: [
      for (final b in badges)
        Padding(
          padding: const EdgeInsets.only(right: 4),
          child: Semantics(
            button: true,
            label: text(b['name']) ?? '',
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => _show(context, b),
              // Зона дотику не менше 32×32 навколо маленького значка.
              child: Padding(padding: EdgeInsets.all((32 - size).clamp(0, 14) / 2), child: _Logo(badge: b, size: size)),
            ),
          ),
        ),
    ]);
  }

  static void _show(BuildContext context, Map<String, dynamic> b) {
    final kind = _kinds[text(b['kind'])] ?? _kinds['game']!;
    final href = text(b['href']) ?? '';
    final name = text(b['name']) ?? '';
    final tag = text(b['tag']);
    final role = text(b['role']);
    final lines = (b['lines'] as List?)?.map((e) => '$e').toList() ?? const <String>[];
    showGcSheet<void>(
      context,
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            _Logo(badge: b, size: 52),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(kind.$2), style: body(12, color: muted)),
                const SizedBox(height: 2),
                Text(tag != null && b['kind'] != 'game' && !name.contains(tag) ? '$name [$tag]' : name, style: display(18)),
              ]),
            ),
          ]),
          if (role != null) ...[
            const SizedBox(height: 12),
            Pill(label: role, color: accent),
          ],
          if (lines.isNotEmpty) ...[
            const SizedBox(height: 10),
            for (final line in lines) Padding(padding: const EdgeInsets.only(bottom: 3), child: Text(line, style: body(14, color: soft))),
          ],
          if (href.isNotEmpty) ...[
            const SizedBox(height: 16),
            PrimaryButton(
              label: tr('Відкрити'),
              icon: kind.$1,
              onPressed: () {
                Navigator.pop(sheet);
                context.push(appPathFor(href));
              },
            ),
          ],
        ]),
      ),
    );
  }
}

/// Логотип значка: картинка з розділу, а без неї — тег або іконка виду.
class _Logo extends StatelessWidget {
  const _Logo({required this.badge, required this.size});
  final Map<String, dynamic> badge;
  final double size;

  @override
  Widget build(BuildContext context) {
    final logo = text(badge['logo']);
    final radius = size * 0.28;
    if (logo != null && logo.isNotEmpty) {
      return SizedBox(width: size, height: size, child: NetImage(logo, radius: radius));
    }
    final kind = AffiliationBadges._kinds[text(badge['kind'])] ?? AffiliationBadges._kinds['game']!;
    final tag = text(badge['tag']);
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: const Color(0xFF38BDF8).withValues(alpha: 0.15), borderRadius: BorderRadius.circular(radius)),
      child: tag != null && size >= 30
          ? Text(tag.length > 4 ? tag.substring(0, 4) : tag, style: body(size * 0.26, color: const Color(0xFF38BDF8), weight: FontWeight.w800))
          : Icon(kind.$1, size: size * 0.66, color: const Color(0xFF38BDF8)),
    );
  }
}
