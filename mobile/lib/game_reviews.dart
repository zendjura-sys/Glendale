import 'package:flutter/material.dart';

import 'core/widgets/arctic_glass/arctic_fit_text.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Огляди гравців (сторінка гри), стрічка трейлерів і «Гравець місяця» в клані — як на сайті.

class GameReviewsSection extends StatefulWidget {
  const GameReviewsSection({required this.slug, super.key});
  final String slug;

  @override
  State<GameReviewsSection> createState() => _GameReviewsSectionState();
}

class _GameReviewsSectionState extends State<GameReviewsSection> {
  Map<String, dynamic>? data;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final d = await AppScope.read(context).session.api.get(Api.site('/games/${widget.slug}/reviews'));
      if (mounted) setState(() => data = d);
    } catch (_) {}
  }

  Future<void> _write() async {
    final mine = mapOf(data?['mine']);
    final note = TextEditingController(text: text(mine['body']) ?? '');
    final hours = TextEditingController(text: mine['hours'] == null ? '' : '${mine['hours']}');
    var score = mine['score'] == null ? 8.0 : intOf(mine['score']).toDouble();
    var recommended = mine['recommended'] != false;
    final saved = await showGcSheet<bool>(
      context,
      title: mine.isEmpty ? tr('Написати огляд') : tr('Редагувати мій огляд'),
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheet) => Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Segmented(
            options: [SegmentOption('yes', tr('Раджу'), icon: LucideIcons.thumbsUp), SegmentOption('no', tr('Не раджу'), icon: LucideIcons.thumbsDown)],
            selected: recommended ? 'yes' : 'no',
            onSelect: (v) => setSheet(() => recommended = v == 'yes'),
          ),
          const SizedBox(height: 10),
          Row(children: [
            Text(tr('Оцінка'), style: body(14)),
            Expanded(child: Slider(value: score, min: 1, max: 10, divisions: 9, label: '${score.round()}', onChanged: (v) => setSheet(() => score = v))),
            Text('${score.round()}/10', style: body(14, weight: FontWeight.w600)),
          ]),
          GcField(controller: hours, label: tr('Годин у грі'), keyboard: TextInputType.number, icon: LucideIcons.clock),
          const SizedBox(height: 10),
          GcField(controller: note, label: tr('Що сподобалось, що ні, кому порадите?'), maxLines: 6, minLines: 4),
          const SizedBox(height: 12),
          PrimaryButton(
            label: tr('Опублікувати'),
            onPressed: () async {
              final ok = await attempt(
                sheet,
                () => AppScope.read(sheet).session.api.post(Api.site('/games/${widget.slug}/reviews'), {
                  'body': note.text.trim(),
                  'score': score.round(),
                  'recommended': recommended,
                  'hours': int.tryParse(hours.text.trim()),
                }),
              );
              if (ok && sheet.mounted) Navigator.of(sheet).pop(true);
            },
          ),
        ]),
      ),
    );
    if (saved == true) await _load();
  }

  Future<void> _helpful(Map<String, dynamic> review) async {
    try {
      final r = await AppScope.read(context).session.api.post(Api.site('/games/reviews/${review['id']}/helpful'));
      if (!mounted) return;
      setState(() {
        review['helpful'] = r['helpful'];
        review['helpful_count'] = r['helpful_count'];
      });
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) return const SizedBox.shrink();
    final summary = mapOf(d['summary']);
    final count = intOf(summary['count']);
    final share = count == 0 ? 0 : (intOf(summary['recommended']) * 100 / count).round();
    final reviews = maps(mapOf(d['reviews'])['data']);
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CardTitle(tr('Огляди гравців'), icon: LucideIcons.star),
          const SizedBox(height: 8),
          Text(
            count == 0 ? tr('Оглядів ще немає — будьте першими.') : tr('{share}% радять · середня {avg}/10 · {count} оглядів', {'share': '$share', 'avg': '${summary['average']}', 'count': '$count'}),
            style: body(13.5, color: muted),
          ),
          const SizedBox(height: 10),
          GhostButton(label: d['mine'] is Map ? tr('Редагувати мій огляд') : tr('Написати огляд'), icon: LucideIcons.pencil, onPressed: _write),
          for (final r in reviews) ...[
            const SizedBox(height: 12),
            Row(children: [
              Avatar(name: text(mapOf(r['user'])['name']) ?? '', url: text(mapOf(r['user'])['avatar_url']), size: 32),
              const SizedBox(width: 10),
              Expanded(child: FitText(text(mapOf(r['user'])['name']) ?? '', style: body(14, weight: FontWeight.w600))),
              Icon(r['recommended'] == true ? LucideIcons.thumbsUp : LucideIcons.thumbsDown, size: 15, color: r['recommended'] == true ? const Color(0xFF34D399) : const Color(0xFFF87171)),
              const SizedBox(width: 4),
              Text('${intOf(r['score'])}/10', style: body(13, weight: FontWeight.w600)),
            ]),
            const SizedBox(height: 6),
            Text(text(r['body']) ?? '', style: body(14, color: soft)),
            if (r['mine'] != true)
              TextButton(
                onPressed: () => _helpful(r),
                child: Text('${tr('Корисно')} · ${intOf(r['helpful_count'])}', style: body(12.5, color: r['helpful'] == true ? primary : muted)),
              ),
          ],
        ]),
      ),
    );
  }
}

class TrailersScreen extends StatelessWidget {
  const TrailersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/games/trailers')),
      builder: (d, reload) {
        final games = maps(mapOf(d['games'])['data']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Трейлери')),
            if (games.isEmpty) EmptyState(icon: LucideIcons.clapperboard, title: tr('Трейлерів поки немає')),
            for (final g in games)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Glass(
                  padding: EdgeInsets.zero,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    GestureDetector(
                      onTap: () => launchUrl(Uri.parse('https://www.youtube.com/watch?v=${maps(g['videos']).first['id']}'), mode: LaunchMode.externalApplication),
                      child: AspectRatio(
                        aspectRatio: 16 / 9,
                        child: Stack(fit: StackFit.expand, alignment: Alignment.center, children: [
                          ClipRRect(
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
                            child: Image.network('https://i.ytimg.com/vi/${maps(g['videos']).first['id']}/hqdefault.jpg', fit: BoxFit.cover, errorBuilder: (_, _, _) => Container(color: Colors.black)),
                          ),
                          Center(
                            child: Container(
                              width: 54,
                              height: 54,
                              decoration: const BoxDecoration(color: Color(0x99000000), shape: BoxShape.circle),
                              child: const Icon(LucideIcons.play, color: Colors.white),
                            ),
                          ),
                        ]),
                      ),
                    ),
                    ListTile(
                      onTap: () => context.push('/games/${g['slug']}'),
                      title: Text(text(g['name']) ?? '', style: body(15, weight: FontWeight.w600)),
                      subtitle: FitText(text(maps(g['videos']).first['name']) ?? '', style: body(12.5, color: muted)),
                      trailing: Icon(LucideIcons.chevronRight, color: muted),
                    ),
                  ]),
                ),
              ),
          ],
        );
      },
    );
  }
}

/// «Гравець місяця» на вкладці учасників клану.
class ClanMvpCard extends StatelessWidget {
  const ClanMvpCard({required this.mvp, required this.members, required this.myUserId, required this.onVote, super.key});
  final Map<String, dynamic> mvp;
  final List<Map<String, dynamic>> members;
  final int? myUserId;
  final Future<void> Function(int userId) onVote;

  @override
  Widget build(BuildContext context) {
    final winner = mapOf(mvp['winner']);
    final leaders = maps(mvp['leaders']);
    final myVote = mvp['my_vote'] == null ? null : intOf(mvp['my_vote']);
    final candidates = members.where((m) => m['user'] is Map && intOf(mapOf(m['user'])['id']) != myUserId).toList();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CardTitle(tr('Гравець місяця'), icon: LucideIcons.trophy),
          const SizedBox(height: 8),
          if (winner.isNotEmpty)
            Row(children: [
              Avatar(name: text(mapOf(winner['user'])['name']) ?? '', url: text(mapOf(winner['user'])['avatar_url']), size: 40, frame: const [Color(0xFFFACC15), Color(0xFFF59E0B)]),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(tr('Гравець місяця · {month}', {'month': text(winner['month']) ?? ''}), style: body(12, color: const Color(0xFFFCD34D))),
                  Text(text(mapOf(winner['user'])['name']) ?? '', style: body(15, weight: FontWeight.w600)),
                ]),
              ),
            ])
          else
            Text(tr('Голосуйте за найкращого гравця клану — переможця оголосимо на початку наступного місяця.'), style: body(13.5, color: muted)),
          for (final (i, l) in leaders.indexed)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(children: [
                SizedBox(width: 18, child: Text('${i + 1}', style: body(12, color: muted))),
                Expanded(child: Text(text(mapOf(l['user'])['name']) ?? '', style: body(14))),
                Text('${intOf(l['votes'])}', style: body(13, color: muted)),
              ]),
            ),
          const SizedBox(height: 10),
          GcSelect<int>(
            value: myVote,
            expand: true,
            hint: tr('Оберіть учасника'),
            items: [for (final m in candidates) (intOf(mapOf(m['user'])['id']), text(m['nickname']) ?? text(mapOf(m['user'])['name']) ?? '')],
            onChanged: (v) {
              if (v != null && v != myVote) onVote(v);
            },
          ),
        ]),
      ),
    );
  }
}
