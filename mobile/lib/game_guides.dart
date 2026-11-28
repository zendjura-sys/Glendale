import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'core/widgets/arctic_glass/arctic_fit_text.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Гіди на сторінці гри — той самий розділ, що на сайті (`game_guides`).
class GameGuidesScreen extends StatelessWidget {
  const GameGuidesScreen({required this.slug, super.key});
  final String slug;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    final canWrite = AppScope.of(context).session.pluginOn('game_guides');
    return Remote(
      load: () => api.get(Api.site('/games/$slug')),
      builder: (data, reload) {
        final guides = maps(data['guides']);
        final name = text(mapOf(data['game'])['name']) ?? slug;
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Гіди'), subtitle: name),
            if (canWrite)
              Align(
                alignment: Alignment.centerLeft,
                child: PrimaryButton(label: tr('Опублікувати гід'), icon: LucideIcons.penLine, expand: false, compact: true, onPressed: () => writeGuide(context, slug, reload)),
              ),
            const SizedBox(height: 12),
            if (guides.isEmpty) EmptyState(icon: LucideIcons.bookOpen, title: tr('Гідів ще немає. Напишіть перший.')),
            for (final guide in guides) Padding(padding: const EdgeInsets.only(bottom: 10), child: GuideCard(slug: slug, guide: guide, onChanged: reload)),
          ],
        );
      },
    );
  }
}

/// Один гід: текст, автор, подяка й видалення свого.
class GameGuideScreen extends StatelessWidget {
  const GameGuideScreen({required this.slug, required this.id, super.key});
  final String slug;
  final int id;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/games/$slug')),
      builder: (data, reload) {
        final guide = maps(data['guides']).where((g) => intOf(g['id']) == id).firstOrNull;
        final name = text(mapOf(data['game'])['name']) ?? slug;
        if (guide == null) {
          return ScreenScroll(
            onRefresh: reload,
            children: [
              PageTitle(tr('Гід'), subtitle: name),
              EmptyState(icon: LucideIcons.bookOpen, title: tr('Гід не знайдено')),
            ],
          );
        }
        final user = mapOf(guide['user']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(text(guide['title']) ?? tr('Гід'), subtitle: name),
            if (text(user['name']) != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: GestureDetector(
                  onTap: text(user['username']) == null ? null : () => context.push('/u/${user['username']}'),
                  child: Row(children: [
                    Avatar(url: text(user['avatar_url']), name: text(user['name']) ?? '', size: 32),
                    const SizedBox(width: 10),
                    Expanded(child: FitText(text(user['name']) ?? '', style: body(14, weight: FontWeight.w600))),
                    Text(ago(guide['created_at']), style: body(12, color: faint)),
                  ]),
                ),
              ),
            Glass(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SelectableText(text(guide['body']) ?? '', style: body(15, color: soft).copyWith(height: 1.45)),
                const SizedBox(height: 12),
                Row(children: [
                  guideThanks(guide),
                  const Spacer(),
                  if (guide['mine'] == true)
                    GestureDetector(
                      onTap: () async {
                        final ok = await deleteGuide(context, slug, guide);
                        if (ok && context.mounted && context.canPop()) context.pop();
                      },
                      child: Text(tr('Видалити'), style: body(13, color: dangerSoft, weight: FontWeight.w600)),
                    ),
                ]),
                GuideVotes(slug: slug, guide: guide),
              ]),
            ),
          ],
        );
      },
    );
  }
}

class GuideCard extends StatelessWidget {
  const GuideCard({required this.slug, required this.guide, required this.onChanged, super.key});
  final String slug;
  final Map<String, dynamic> guide;
  final Future<void> Function() onChanged;

  @override
  Widget build(BuildContext context) {
    final user = mapOf(guide['user']);
    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () async {
            await context.push('/games/$slug/guides/${guide['id']}');
            if (context.mounted) await onChanged();
          },
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(text(guide['title']) ?? '', style: body(16, weight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(
              [text(user['name']), ago(guide['created_at'])].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
              style: body(12.5, color: faint),
            ),
            if (text(guide['body']) != null) ...[
              const SizedBox(height: 8),
              Text(text(guide['body'])!, maxLines: 4, overflow: TextOverflow.ellipsis, style: body(14, color: soft).copyWith(height: 1.4)),
            ],
          ]),
        ),
        const SizedBox(height: 8),
        Row(children: [
          guideThanks(guide),
          const Spacer(),
          if (guide['mine'] == true)
            GestureDetector(
              onTap: () async {
                if (await deleteGuide(context, slug, guide) && context.mounted) await onChanged();
              },
              child: Text(tr('Видалити'), style: body(12.5, color: dangerSoft, weight: FontWeight.w600)),
            ),
        ]),
        GuideVotes(key: ValueKey('votes-${guide['id']}'), slug: slug, guide: guide),
      ]),
    );
  }
}

/// Кнопка «Дякую», коли сервер дозволяє (`can_thank`); інакше лише лічильник, як на сайті.
Widget guideThanks(Map<String, dynamic> guide) {
  final count = intOf(guide['thanks']);
  if (guide['can_thank'] == true) {
    return ThanksButton(
      key: ValueKey('thanks-guide-${guide['id']}'),
      kind: 'guide',
      id: intOf(guide['id']),
      thanked: guide['thanked'] == true,
      count: count,
    );
  }
  if (count > 0) return Text(tr('Подяк: {n}', {'n': '$count'}), style: body(13, color: muted));
  return const SizedBox.shrink();
}

Future<void> writeGuide(BuildContext context, String slug, Future<void> Function() reload) async {
  final title = TextEditingController();
  final body = TextEditingController();
  final saved = await showGcSheet<bool>(
    context,
    title: tr('Новий гід'),
    builder: (sheet) => Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      GcField(controller: title, label: tr('Назва гіда'), autofocus: true),
      const SizedBox(height: 10),
      GcField(controller: body, label: tr('Коротко: як почати, що зібрати, чого уникати'), maxLines: 6, minLines: 4),
      const SizedBox(height: 12),
      PrimaryButton(
        label: tr('Опублікувати гід'),
        onPressed: () async {
          final ok = await attempt(sheet, () => AppScope.read(sheet).session.api.post(Api.site('/games/$slug/guides'), {'title': title.text.trim(), 'body': body.text.trim()}));
          if (ok && sheet.mounted) Navigator.of(sheet).pop(true);
        },
      ),
    ]),
  );
  title.dispose();
  body.dispose();
  if (saved == true && context.mounted) await reload();
}

Future<bool> deleteGuide(BuildContext context, String slug, Map<String, dynamic> guide) async {
  if (!await confirm(context, tr('Видалити гід?'), action: tr('Видалити'), danger: true)) return false;
  if (!context.mounted) return false;
  return attempt(context, () => AppScope.read(context).session.api.delete(Api.site('/games/$slug/guides/${guide['id']}')));
}

/// «Корисно / Не дуже» під гідом (№259), як на сайті: частка корисних і свій голос (повторний натиск — зняти).
class GuideVotes extends StatefulWidget {
  const GuideVotes({required this.slug, required this.guide, super.key});
  final String slug;
  final Map<String, dynamic> guide;

  @override
  State<GuideVotes> createState() => _GuideVotesState();
}

class _GuideVotesState extends State<GuideVotes> {
  late int helpful = intOf(widget.guide['helpful']);
  late int unhelpful = intOf(widget.guide['unhelpful']);
  late bool? mine = widget.guide['my_vote'] is bool ? widget.guide['my_vote'] as bool : null;

  Future<void> _vote(bool value) async {
    final next = mine == value ? null : value;
    try {
      final r = await AppScope.read(context).session.api.post(Api.site('/games/${widget.slug}/guides/${widget.guide['id']}/vote'), {'helpful': next});
      if (!mounted) return;
      setState(() {
        helpful = intOf(r['helpful']);
        unhelpful = intOf(r['unhelpful']);
        mine = r['my_vote'] is bool ? r['my_vote'] as bool : null;
      });
    } catch (_) {
      if (mounted) toast(context, tr('Не вдалося зберегти оцінку.'), kind: ToastKind.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = helpful + unhelpful;
    final canVote = widget.guide['can_vote'] == true;
    if (!canVote && total == 0) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
        if (total > 0)
          Text(tr('Корисно для {pct} % · {n} оцінок', {'pct': (helpful * 100 / total).round(), 'n': total}), style: body(12.5, color: muted)),
        if (canVote) ...[
          SelectPill(label: tr('Корисно'), icon: LucideIcons.thumbsUp, selected: mine == true, onTap: () => _vote(true)),
          SelectPill(label: tr('Не дуже'), icon: LucideIcons.thumbsDown, selected: mine == false, onTap: () => _vote(false)),
        ],
      ]),
    );
  }
}
