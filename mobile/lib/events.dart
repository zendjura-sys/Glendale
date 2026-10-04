import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'shell.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

const _kindIcons = {'family': LucideIcons.crown, 'clan': LucideIcons.swords, 'server': LucideIcons.server};

const _months = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const _weekdays = ['понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота', 'неділя'];

/// Календар: події сімей, кланів і серверів; «піду / не піду» — через ті самі дії сайту.
class EventsScreen extends StatefulWidget {
  const EventsScreen({super.key});

  @override
  State<EventsScreen> createState() => _EventsScreenState();
}

class _EventsScreenState extends State<EventsScreen> {
  Map<String, dynamic>? data;
  String kind = '';

  Api get api => AppScope.read(context).session.api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final result = await api.get(Api.site('/events${kind.isEmpty ? '' : '?kind=$kind'}'));
      if (mounted) setState(() => data = result);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _rsvp(Map<String, dynamic> e, bool going) async {
    final url = text(e['rsvp_url']);
    if (url == null) return;
    final body = e['kind'] == 'clan' ? <String, dynamic>{} : {'going': going};
    if (await attempt(context, () => api.post(Api.site(url), body))) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) return const Center(child: CircularProgressIndicator(strokeWidth: 2.4));
    final events = maps(d['events']);
    final kinds = mapOf(d['kinds']);
    final days = <String, List<Map<String, dynamic>>>{};
    for (final e in events) {
      final at = DateTime.tryParse(text(e['starts_at']) ?? '')?.toLocal();
      if (at == null) continue;
      final label = '${_weekdays[at.weekday - 1]}, ${at.day} ${_months[at.month - 1]}';
      (days[label] ??= []).add(e);
    }

    return ScreenScroll(
      onRefresh: _load,
      children: [
        const PageTitle('Календар подій', subtitle: 'Події ваших сімей, кланів і серверів. За пів години до початку прийде нагадування.'),
        ChipRow(
          options: [('', 'Усі'), for (final e in kinds.entries) (e.key, '${e.value}')],
          selected: kind,
          onSelect: (v) {
            setState(() => kind = v);
            _load();
          },
        ),
        const SizedBox(height: 12),
        if (events.isEmpty)
          const EmptyState(icon: LucideIcons.calendarDays, title: 'Найближчих подій немає', text: 'Події з’являються, коли їх створюють у сім’ї, клані або на сторінці сервера.'),
        for (final day in days.entries) ...[
          Padding(
            padding: const EdgeInsets.only(top: 6, bottom: 8),
            child: Text(day.key[0].toUpperCase() + day.key.substring(1), style: body(14, color: soft, weight: FontWeight.w700)),
          ),
          for (final e in day.value) Padding(padding: const EdgeInsets.only(bottom: 8), child: _EventTile(event: e, onRsvp: (going) => _rsvp(e, going))),
        ],
      ],
    );
  }
}

class _EventTile extends StatelessWidget {
  const _EventTile({required this.event, required this.onRsvp});
  final Map<String, dynamic> event;
  final void Function(bool going) onRsvp;

  @override
  Widget build(BuildContext context) {
    final at = DateTime.tryParse(text(event['starts_at']) ?? '')?.toLocal();
    final where = mapOf(event['where']);
    final status = text(event['status']);
    final isClan = event['kind'] == 'clan';
    return Glass(
      padding: const EdgeInsets.all(12),
      radius: 18,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 56,
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.04), borderRadius: BorderRadius.circular(12)),
            child: Column(children: [
              Text(at == null ? '—' : '${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}', style: body(15, weight: FontWeight.w700)),
              const SizedBox(height: 4),
              Icon(_kindIcons[event['kind']] ?? LucideIcons.calendarDays, size: 15, color: primary),
            ]),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                Pill(label: text(event['type_label']) ?? ''),
                GestureDetector(
                  onTap: () => context.push(appPathFor(text(where['url']))),
                  child: Text(text(where['name']) ?? '', style: body(12, color: muted)),
                ),
                if (text(event['host']) != null) Text('· ${event['host']}', style: body(12, color: faint)),
              ]),
              const SizedBox(height: 4),
              Text(text(event['title']) ?? '', style: body(15, weight: FontWeight.w600)),
              if (text(event['description']) != null) Text(text(event['description'])!, maxLines: 2, overflow: TextOverflow.ellipsis, style: body(13, color: muted)),
              const SizedBox(height: 4),
              Text('Іде: ${event['going_count'] ?? 0}', style: body(12, color: faint)),
            ]),
          ),
        ]),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(
            child: status == 'going'
                ? PrimaryButton(label: 'Піду', icon: LucideIcons.check, compact: true, onPressed: isClan ? () => onRsvp(false) : null)
                : GhostButton(label: 'Піду', icon: LucideIcons.check, compact: true, onPressed: () => onRsvp(true)),
          ),
          if (event['can_decline'] == true) ...[
            const SizedBox(width: 8),
            Expanded(
              child: GhostButton(
                label: 'Не піду',
                icon: LucideIcons.x,
                compact: true,
                color: status == 'declined' ? dangerSoft : ink,
                onPressed: status == 'declined' ? null : () => onRsvp(false),
              ),
            ),
          ],
        ]),
      ]),
    );
  }
}
