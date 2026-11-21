import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'theme.dart';
import 'widgets.dart';

/// «Поки тебе не було» — зведення непрочитаного в групі (дані з бесіди / catch_up).
class CatchUpCard extends StatelessWidget {
  const CatchUpCard({required this.data, required this.onJump, required this.onClose, super.key});
  final Map<String, dynamic> data;
  final ValueChanged<int> onJump;
  final VoidCallback onClose;

  String _sectionTitle(String key) => switch (key) {
        'mentions' => tr('Тебе згадали'),
        'plans' => tr('Домовленості'),
        'popular' => tr('Найбільше реакцій'),
        'links' => tr('Посилання'),
        _ => key,
      };

  IconData _sectionIcon(String key) => switch (key) {
        'mentions' => LucideIcons.atSign,
        'plans' => LucideIcons.calendarClock,
        'popular' => LucideIcons.flame,
        'links' => LucideIcons.link2,
        _ => LucideIcons.messageSquare,
      };

  @override
  Widget build(BuildContext context) {
    final count = intOf(data['count']);
    final people = intOf(data['people']);
    final sections = maps(data['sections']);
    return Material(
      color: card.withValues(alpha: 0.96),
      elevation: 8,
      shadowColor: Colors.black54,
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 8, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(tr('Поки тебе не було'), style: body(14, weight: FontWeight.w700)),
                      Text(
                        '$count ${plural(count, tr('повідомлення'), tr('повідомлення'), tr('повідомлень'))} ${tr('від')} $people ${plural(people, tr('людини'), tr('людей'), tr('людей'))}',
                        style: body(11.5, color: muted),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: tr('Закрити'),
                  onPressed: onClose,
                  icon: Icon(LucideIcons.x, size: 16, color: muted),
                ),
              ],
            ),
            for (final section in sections) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(_sectionIcon(text(section['key']) ?? ''), size: 13, color: primary),
                  const SizedBox(width: 6),
                  Text(_sectionTitle(text(section['key']) ?? ''), style: body(11, color: muted, weight: FontWeight.w600)),
                ],
              ),
              for (final item in maps(section['items']))
                InkWell(
                  onTap: () => onJump(intOf(item['id'])),
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
                    child: Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(text: '${text(item['author']) ?? ''}: ', style: body(12.5, weight: FontWeight.w700)),
                          TextSpan(
                            text: text(section['key']) == 'links' ? (text(item['link']) ?? text(item['text']) ?? '') : (text(item['text']) ?? ''),
                            style: body(12.5, color: soft),
                          ),
                        ],
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
            ],
            const SizedBox(height: 8),
            GhostButton(
              label: tr('До першого непрочитаного'),
              compact: true,
              onPressed: () => onJump(intOf(data['first_id'])),
            ),
          ],
        ),
      ),
    );
  }
}
