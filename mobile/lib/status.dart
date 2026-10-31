import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Сторінка статусу GameCon (та сама, що /status на сайті): загальний стан, складники й інциденти.

String _componentLabel(String key) => switch (key) {
  'site' => tr('Сайт і застосунок'),
  'database' => tr('База даних'),
  'cache' => tr('Кеш'),
  'queue' => tr('Фонові задачі й сповіщення'),
  'storage' => tr('Файли й медіа'),
  _ => key,
};

String _healthLabel(String status) => switch (status) {
  'degraded' => tr('Із затримками'),
  'down' => tr('Не працює'),
  _ => tr('Працює'),
};

String _overallLabel(String status) => switch (status) {
  'degraded' => tr('Частина функцій працює повільніше'),
  'down' => tr('Збій — ми вже працюємо над ним'),
  _ => tr('Усе працює'),
};

String _incidentLabel(String status) => switch (status) {
  'investigating' => tr('З’ясовуємо'),
  'identified' => tr('Причину знайдено'),
  'monitoring' => tr('Спостерігаємо'),
  'resolved' => tr('Вирішено'),
  _ => status,
};

/// Кольори станів; у світлій темі — темніші, щоб читалися на світлому склі.
Color _healthColor(String status) => switch (status) {
  'degraded' => palette.isLight ? const Color(0xFFB45309) : const Color(0xFFFCD34D),
  'down' => palette.isLight ? const Color(0xFFDC2626) : const Color(0xFFF87171),
  _ => palette.isLight ? const Color(0xFF059669) : const Color(0xFF34D399),
};

String _stamp(String? iso) {
  final d = DateTime.tryParse(iso ?? '')?.toLocal();
  if (d == null) return '';
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(d.day)}.${two(d.month)} ${two(d.hour)}:${two(d.minute)}';
}

/// Тонкий банер про активний збій (з /me): веде на екран статусу.
class IncidentBanner extends StatelessWidget {
  const IncidentBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final incident = mapOf(AppScope.of(context).session.me?['incident']);
    final title = text(incident['title']);
    if (title == null) return const SizedBox.shrink();
    final color = incident['severity'] == 'major' ? _healthColor('down') : _healthColor('degraded');
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Glass(
        onTap: () => context.push('/status'),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(children: [
          Icon(LucideIcons.triangleAlert, size: 18, color: color),
          const SizedBox(width: 10),
          Expanded(child: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis, style: body(13.5))),
          const SizedBox(width: 8),
          Text(tr('Подробиці'), style: body(12, color: muted)),
        ]),
      ),
    );
  }
}

class StatusScreen extends StatelessWidget {
  const StatusScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/status')),
      builder: (d, reload) {
        final overall = text(d['overall']) ?? 'operational';
        final active = maps(d['active']);
        final history = maps(d['history']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Статус')),
            Glass(
              child: Row(children: [
                Icon(overall == 'operational' ? LucideIcons.circleCheck : LucideIcons.triangleAlert, size: 30, color: _healthColor(overall)),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_overallLabel(overall), style: display(18)),
                    const SizedBox(height: 4),
                    Text(tr('Перевірено о {time}', {'time': _stamp(text(d['checked_at'])).split(' ').last}), style: body(12.5, color: muted)),
                  ]),
                ),
              ]),
            ),
            const SizedBox(height: 12),
            for (final incident in active) Padding(padding: const EdgeInsets.only(bottom: 12), child: _IncidentCard(incident: incident)),
            Glass(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Column(children: [
                for (final c in maps(d['components']))
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Row(children: [
                      Container(width: 8, height: 8, decoration: BoxDecoration(color: _healthColor(text(c['status']) ?? ''), shape: BoxShape.circle)),
                      const SizedBox(width: 12),
                      Expanded(child: Text(_componentLabel(text(c['key']) ?? ''), style: body(14))),
                      const SizedBox(width: 10),
                      Text(_healthLabel(text(c['status']) ?? ''), style: body(12.5, color: muted)),
                    ]),
                  ),
              ]),
            ),
            const SizedBox(height: 16),
            SectionLabel(tr('Останні 30 днів')),
            if (history.isEmpty)
              Glass(child: Text(tr('Жодного збою за цей час.'), style: body(14, color: soft)))
            else
              for (final incident in history) Padding(padding: const EdgeInsets.only(bottom: 12), child: _IncidentCard(incident: incident, compact: true)),
          ],
        );
      },
    );
  }
}

class _IncidentCard extends StatelessWidget {
  const _IncidentCard({required this.incident, this.compact = false});
  final Map<String, dynamic> incident;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final status = text(incident['status']) ?? '';
    final updates = maps(incident['updates']);
    final color = status == 'resolved' ? _healthColor('operational') : (incident['severity'] == 'major' ? _healthColor('down') : _healthColor('degraded'));
    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Text(text(incident['title']) ?? '', style: body(15, weight: FontWeight.w600))),
          const SizedBox(width: 8),
          Text(_incidentLabel(status), style: body(12, color: color, weight: FontWeight.w600)),
        ]),
        const SizedBox(height: 2),
        Text(_stamp(text(incident['started_at'])), style: body(12, color: muted)),
        for (final u in compact ? updates.take(1) : updates) ...[
          const SizedBox(height: 10),
          Text('${_incidentLabel(text(u['status']) ?? '')} · ${_stamp(text(u['at']))}', style: body(12, color: muted)),
          const SizedBox(height: 2),
          Text(text(u['message']) ?? '', style: body(14, color: soft)),
        ],
      ]),
    );
  }
}
