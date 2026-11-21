import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'shell.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

String _stepLabel(String key) => switch (key) {
      'avatar' => tr('Поставте аватар'),
      'about' => tr('Напишіть статус чи пару слів про себе'),
      'games' => tr('Додайте свої ігри'),
      'friend' => tr('Знайдіть першого друга'),
      'community' => tr('Вступіть у спільноту'),
      'post' => tr('Опублікуйте перший запис'),
      'party' => tr('Зберіть або знайдіть паті'),
      _ => key,
    };

/// «Тиждень новачка» у стрічці — кроки з прогресом (дані з `/api/v1/feed`).
class NewcomerWeekCard extends StatelessWidget {
  const NewcomerWeekCard({required this.data, required this.onHide, super.key});
  final Map<String, dynamic> data;
  final VoidCallback onHide;

  @override
  Widget build(BuildContext context) {
    final done = intOf(data['done']);
    final total = intOf(data['total']).clamp(1, 99);
    final complete = done >= total;
    final steps = maps(data['steps']);
    return Glass(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (complete) ...[
                          Icon(LucideIcons.partyPopper, size: 18, color: gold),
                          const SizedBox(width: 6),
                        ],
                        Flexible(
                          child: Text(
                            complete ? tr('Тиждень новачка пройдено!') : tr('Тиждень новачка'),
                            style: body(15, weight: FontWeight.w700),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      complete
                          ? tr('Ви вже свій на GameCon. Гарних ігор!')
                          : tr('День {day} з {days} · виконано {done} з {total}', {
                              'day': intOf(data['day']),
                              'days': intOf(data['days']),
                              'done': done,
                              'total': total,
                            }),
                      style: body(12.5, color: muted),
                    ),
                  ],
                ),
              ),
              RoundIcon(icon: LucideIcons.x, size: 28, onTap: onHide),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: done / total,
              minHeight: 5,
              backgroundColor: line,
              color: primary,
            ),
          ),
          if (!complete) ...[
            const SizedBox(height: 10),
            for (final step in steps)
              InkWell(
                onTap: step['done'] == true ? null : () => context.push(appPathFor(text(step['href']))),
                borderRadius: BorderRadius.circular(10),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
                  child: Row(
                    children: [
                      Container(
                        width: 22,
                        height: 22,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: step['done'] == true ? green.withValues(alpha: 0.18) : card,
                          shape: BoxShape.circle,
                        ),
                        child: step['done'] == true
                            ? Icon(LucideIcons.check, size: 12, color: green)
                            : null,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _stepLabel(text(step['key']) ?? ''),
                          style: body(
                            13,
                            color: step['done'] == true ? muted : ink,
                            weight: FontWeight.w500,
                          ).copyWith(
                            decoration: step['done'] == true ? TextDecoration.lineThrough : null,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

Future<void> hideNewcomerWeek(BuildContext context) async {
  final api = AppScope.read(context).session.api;
  try {
    await api.post(Api.site('/newcomer/hide'));
  } catch (e) {
    if (context.mounted) toast(context, e, kind: ToastKind.error);
  }
}
