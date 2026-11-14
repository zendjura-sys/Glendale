import 'package:flutter/material.dart';

import 'core/widgets/arctic_glass/arctic_fit_text.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'api.dart';
import 'i18n.dart';
import 'posts.dart' show PostCard;
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Серія днів поспіль, «Цього дня», карта гравців і рамка свята — як на сайті.

String _days(int n) => n % 10 == 1 && n % 100 != 11 ? tr('день') : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? tr('дні') : tr('днів'));

/// Тонка картка над стрічкою: вогник серії й посилання на спогади (дані з /me).
class EngagementCard extends StatelessWidget {
  const EngagementCard({super.key});

  @override
  Widget build(BuildContext context) {
    final me = AppScope.of(context).session.me ?? const {};
    final streak = mapOf(me['streak']);
    final days = intOf(streak['days']);
    final memories = intOf(me['memories']);
    if (days < 2 && memories == 0) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Glass(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (days >= 2)
            Row(children: [
              const Icon(LucideIcons.flame, size: 18, color: Color(0xFFF97316)),
              const SizedBox(width: 8),
              Expanded(child: Text(tr('{days} {word} поспіль на GameCon', {'days': '$days', 'word': _days(days)}), style: body(14))),
              if (intOf(streak['best']) > days) Text(tr('рекорд {best}', {'best': '${intOf(streak['best'])}'}), style: body(12, color: muted)),
            ]),
          if (days >= 2 && memories > 0) const SizedBox(height: 8),
          if (memories > 0)
            GestureDetector(
              onTap: () => context.push('/memories'),
              child: Row(children: [
                Icon(LucideIcons.history, size: 18, color: primary),
                const SizedBox(width: 8),
                Expanded(child: Text(tr('Цього дня: {count} з минулих років', {'count': '$memories'}), style: body(14, color: primary, weight: FontWeight.w600))),
              ]),
            ),
        ]),
      ),
    );
  }
}

class MemoriesScreen extends StatelessWidget {
  const MemoriesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/memories')),
      builder: (d, reload) {
        final posts = maps(d['posts']);
        final year = DateTime.tryParse(text(d['date']) ?? '')?.year ?? DateTime.now().year;
        final streak = mapOf(d['streak']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Цього дня')),
            if (intOf(streak['days']) > 0)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(children: [
                  const Icon(LucideIcons.flame, size: 16, color: Color(0xFFF97316)),
                  const SizedBox(width: 6),
                  Expanded(child: Text(tr('{days} {word} поспіль · рекорд {best}', {'days': '${intOf(streak['days'])}', 'word': _days(intOf(streak['days'])), 'best': '${intOf(streak['best'])}'}), style: body(13, color: muted))),
                ]),
              ),
            if (posts.isEmpty) EmptyState(icon: LucideIcons.history, title: tr('Сьогодні спогадів немає'), text: tr('Тут з’являться ваші записи, опубліковані цієї дати в минулі роки.')),
            for (final post in posts) ...[
              Padding(
                padding: const EdgeInsets.only(left: 4, bottom: 6),
                child: Text(tr('{years} р. тому', {'years': '${year - (DateTime.tryParse(text(post['created_at']) ?? '')?.year ?? year)}'}), style: body(12.5, color: primary, weight: FontWeight.w600)),
              ),
              Padding(padding: const EdgeInsets.only(bottom: 12), child: PostCard(post: post, onChanged: () => reload())),
            ],
          ],
        );
      },
    );
  }
}

/// Карта гравців у застосунку — список країн зі смугами (карта світу — на сайті).
class PlayersMapScreen extends StatelessWidget {
  const PlayersMapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/map')),
      builder: (d, reload) {
        final rows = maps(d['countries']).where((c) => intOf(c['count']) > 0).toList();
        final max = rows.isEmpty ? 1 : rows.map((c) => intOf(c['count'])).reduce((a, b) => a > b ? a : b);
        final total = rows.fold<int>(0, (sum, c) => sum + intOf(c['count']));
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Карта гравців')),
            Text(tr('{total} гравців у {count} країнах', {'total': '$total', 'count': '${rows.length}'}), style: body(13.5, color: muted)),
            const SizedBox(height: 12),
            Glass(
              child: Column(children: [
                for (final c in rows)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 7),
                    child: Row(children: [
                      SizedBox(width: 120, child: FitText(text(c['name']) ?? '', style: body(14))),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: LinearProgressIndicator(value: intOf(c['count']) / max, minHeight: 8, backgroundColor: ink.withValues(alpha: 0.07), color: const Color(0xFF38BDF8)),
                        ),
                      ),
                      SizedBox(width: 44, child: Text('${intOf(c['count'])}', textAlign: TextAlign.right, style: body(13, color: muted))),
                    ]),
                  ),
                if (rows.isEmpty) Text(tr('Поки ніхто не вказав країну в профілі.'), style: body(14, color: muted)),
              ]),
            ),
          ],
        );
      },
    );
  }
}

/// Перемикач рамки свята (налаштування) — видно лише під час свята.
class EventFrameToggle extends StatefulWidget {
  const EventFrameToggle({super.key});

  @override
  State<EventFrameToggle> createState() => _EventFrameToggleState();
}

class _EventFrameToggleState extends State<EventFrameToggle> {
  bool? on;

  @override
  Widget build(BuildContext context) {
    final session = AppScope.of(context).session;
    final frame = mapOf(session.me?['event_frame']);
    if (text(frame['season']) == null) return const SizedBox.shrink();
    final value = on ?? frame['on'] == true;
    return SwitchListTile.adaptive(
      contentPadding: EdgeInsets.zero,
      value: value,
      title: Text(tr('Рамка свята на аватарі'), style: body(15)),
      subtitle: Text(tr('Святкова рамка, поки триває свято'), style: body(12.5, color: muted)),
      onChanged: (next) async {
        setState(() => on = next);
        try {
          await session.api.put(Api.site('/settings/event-frame'), {'on': next});
          final me = session.me;
          if (me != null) me['event_frame'] = {...frame, 'on': next};
        } catch (e) {
          if (!mounted) return;
          setState(() => on = !next);
          toast(this.context, e);
        }
      },
    );
  }
}
