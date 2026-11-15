import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'family_tabs.dart';
import 'i18n.dart';
import 'theme.dart';
import 'widgets.dart';

/// Вкладки сім’ї, як на сайті: «Статут», «Вікі», «Союзи й війни», «Історія».
/// Дані — ті самі props, що віддає сайт через міст (/api/v1/site/f/{slug}/…).

class CharterTab extends StatelessWidget {
  const CharterTab({required this.ctx, super.key});
  final FamilyContext ctx;

  @override
  Widget build(BuildContext context) {
    final text0 = text(ctx.data['text']);
    final quiz = maps(ctx.data['quiz']);
    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        CardTitle(tr('Статут сім’ї'), icon: LucideIcons.scale),
        const SizedBox(height: 10),
        if (text0 == null)
          QuietEmpty(icon: LucideIcons.scale, text: tr('Лідер ще не написав статут'))
        else
          Text(text0, style: body(14, color: fg.withValues(alpha: 0.86)).copyWith(height: 1.5)),
        if (quiz.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(tr('Перед заявкою кандидат проходить тест за статутом: {n} питань, потрібно {pass}% правильних.', {'n': quiz.length, 'pass': intOf(ctx.data['pass'])}), style: body(12, color: muted)),
        ],
        if (ctx.data['edit'] != null) ...[
          const SizedBox(height: 12),
          Text(tr('Редагувати статут і тест можна на сайті: Сім’я → Статут.'), style: body(12, color: muted)),
        ],
      ]),
    );
  }
}

class WikiTab extends StatelessWidget {
  const WikiTab({required this.ctx, super.key});
  final FamilyContext ctx;

  Future<void> _edit(BuildContext context, Map<String, dynamic>? page) async {
    final title = TextEditingController(text: text(page?['title']) ?? '');
    final bodyText = TextEditingController(text: text(page?['body']) ?? '');
    final ok = await showGcSheet<bool>(
      context,
      title: page == null ? tr('Нова сторінка') : tr('Редагувати'),
      builder: (sheet) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        GcField(controller: title, label: tr('Назва сторінки')),
        const SizedBox(height: 10),
        GcField(controller: bodyText, label: tr('Текст сторінки'), maxLines: 10, minLines: 5),
        const SizedBox(height: 12),
        PrimaryButton(label: tr('Зберегти'), onPressed: () => Navigator.pop(sheet, true)),
      ]),
    );
    if (ok != true || !context.mounted || title.text.trim().isEmpty) return;
    await ctx.act(context, () => ctx.api.post(ctx.path('wiki'), {'slug': text(page?['slug']) ?? '', 'title': title.text.trim(), 'body': bodyText.text}));
  }

  @override
  Widget build(BuildContext context) {
    final pages = maps(ctx.data['pages']);
    final page = ctx.data['page'] is Map ? mapOf(ctx.data['page']) : null;
    final canEdit = ctx.data['can_edit'] == true;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (pages.isNotEmpty)
        SizedBox(
          height: 40,
          child: ListView(scrollDirection: Axis.horizontal, children: [
            for (final p in pages)
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: GestureDetector(
                  onTap: () => ctx.reload(extra: {'page': text(p['slug']) ?? ''}),
                  child: Pill(label: text(p['title']) ?? '', color: text(p['slug']) == text(page?['slug']) ? primary : muted),
                ),
              ),
          ]),
        ),
      const SizedBox(height: 8),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: CardTitle(text(page?['title']) ?? tr('Вікі сім’ї'), icon: LucideIcons.bookOpen)),
            if (canEdit) RoundIcon(icon: LucideIcons.plus, onTap: () => _edit(context, null)),
            if (canEdit && page != null) ...[const SizedBox(width: 6), RoundIcon(icon: LucideIcons.pencil, onTap: () => _edit(context, page))],
          ]),
          const SizedBox(height: 10),
          if (page == null)
            QuietEmpty(icon: LucideIcons.bookOpen, text: tr('Тут будуть гайди сім’ї: як подавати звіти, правила складу, корисні посилання.'))
          else
            Text(text(page['body']) ?? tr('Сторінка порожня.'), style: body(14, color: fg.withValues(alpha: 0.86)).copyWith(height: 1.5)),
        ]),
      ),
    ]);
  }
}

class RelationsTab extends StatelessWidget {
  const RelationsTab({required this.ctx, super.key});
  final FamilyContext ctx;

  Future<void> _propose(BuildContext context) async {
    final candidates = maps(ctx.data['candidates']);
    var type = 'alliance';
    int? other;
    final note = TextEditingController();
    final ok = await showGcSheet<bool>(
      context,
      title: tr('Новий союз чи війна'),
      subtitle: tr('Лише сім’ї вашого сервера. Союз діє, коли друга сім’я прийме пропозицію; війна починається одразу.'),
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheet) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Segmented(
            options: [SegmentOption('alliance', tr('Союз'), icon: LucideIcons.handshake), SegmentOption('war', tr('Війна'), icon: LucideIcons.swords)],
            selected: type,
            onSelect: (v) => setSheet(() => type = v),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<int>(
            initialValue: other,
            hint: Text(tr('Сім’я вашого сервера…')),
            items: [for (final c in candidates) DropdownMenuItem(value: intOf(c['id']), child: Text('[${text(c['tag'])}] ${text(c['name'])}'))],
            onChanged: (v) => setSheet(() => other = v),
          ),
          const SizedBox(height: 10),
          GcField(controller: note, label: tr('Умови чи причина (необов’язково)')),
          const SizedBox(height: 12),
          PrimaryButton(label: type == 'war' ? tr('Оголосити війну') : tr('Запропонувати союз'), onPressed: other == null ? null : () => Navigator.pop(sheet, true)),
        ]),
      ),
    );
    if (ok != true || other == null || !context.mounted) return;
    await ctx.act(context, () => ctx.api.post(ctx.path('relations'), {'type': type, 'other_family_id': other, 'note': note.text.trim()}));
  }

  @override
  Widget build(BuildContext context) {
    final relations = maps(ctx.data['relations']);
    final canManage = ctx.data['can_manage'] == true;
    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(child: CardTitle(tr('Союзи й війни'), icon: LucideIcons.handshake)),
          if (canManage && maps(ctx.data['candidates']).isNotEmpty) GhostButton(label: tr('Нова'), icon: LucideIcons.plus, compact: true, expand: false, onPressed: () => _propose(context)),
        ]),
        const SizedBox(height: 8),
        if (relations.isEmpty) QuietEmpty(icon: LucideIcons.handshake, text: tr('Ні союзів, ні воєн — поки що мир.')),
        for (final r in relations)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(children: [
              Icon(r['type'] == 'war' ? LucideIcons.swords : LucideIcons.handshake, color: r['type'] == 'war' ? dangerSoft : green, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${r['type'] == 'war' ? tr('Війна') : tr('Союз')} · [${text(mapOf(r['family'])['tag'])}] ${text(mapOf(r['family'])['name'])}', style: body(14, weight: FontWeight.w600)),
                  Text(
                    r['status'] == 'pending'
                        ? (r['incoming'] == true ? tr('Пропонують вам союз') : tr('Чекаємо на відповідь'))
                        : r['status'] == 'ended'
                            ? tr('Завершено')
                            : tr('З {date}', {'date': shortStamp(r['started_at'])}),
                    style: body(12, color: muted),
                  ),
                ]),
              ),
              if (canManage && r['incoming'] == true) ...[
                PrimaryButton(label: tr('Прийняти'), compact: true, expand: false, onPressed: () => ctx.act(context, () => ctx.api.post(ctx.path('relations/${r['id']}/respond'), {'accept': true}))),
                IconButton(icon: Icon(LucideIcons.x, color: muted), onPressed: () => ctx.act(context, () => ctx.api.post(ctx.path('relations/${r['id']}/respond'), {'accept': false}))),
              ] else if (canManage && r['status'] == 'active')
                GhostButton(
                  label: r['type'] == 'war' ? tr('Завершити війну') : tr('Розірвати союз'),
                  compact: true,
                  expand: false,
                  onPressed: () async {
                    if (await confirm(context, r['type'] == 'war' ? tr('Завершити війну?') : tr('Розірвати союз?'), danger: true) && context.mounted) {
                      await ctx.act(context, () => ctx.api.post(ctx.path('relations/${r['id']}/end')));
                    }
                  },
                ),
            ]),
          ),
      ]),
    );
  }
}

class HistoryTab extends StatelessWidget {
  const HistoryTab({required this.ctx, super.key});
  final FamilyContext ctx;

  @override
  Widget build(BuildContext context) {
    final achievements = maps(ctx.data['achievements']);
    final events = maps(ctx.data['events']);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CardTitle(tr('Досягнення'), icon: LucideIcons.trophy),
          const SizedBox(height: 8),
          for (final a in achievements)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Icon(a['done'] == true ? LucideIcons.award : LucideIcons.lock, size: 16, color: a['done'] == true ? gold : muted),
                  const SizedBox(width: 8),
                  Expanded(child: Text(tr(text(a['title']) ?? ''), style: body(13.5, weight: FontWeight.w600))),
                  Text('${intOf(a['progress']).clamp(0, intOf(a['target']))}/${intOf(a['target'])}', style: body(12, color: muted)),
                ]),
                const SizedBox(height: 4),
                LinearProgressIndicator(
                  value: intOf(a['target']) == 0 ? 0 : (intOf(a['progress']) / intOf(a['target'])).clamp(0, 1).toDouble(),
                  minHeight: 5,
                  borderRadius: BorderRadius.circular(9),
                  color: a['done'] == true ? gold : primary,
                  backgroundColor: fg.withValues(alpha: 0.08),
                ),
              ]),
            ),
        ]),
      ),
      const SizedBox(height: 10),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CardTitle(tr('Шкала часу'), icon: LucideIcons.history),
          const SizedBox(height: 8),
          for (final e in events)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(e['kind'] == 'war' ? LucideIcons.swords : LucideIcons.flag, size: 16, color: primary),
                const SizedBox(width: 10),
                Expanded(child: Text(tr(text(e['text']) ?? ''), style: body(13.5))),
                Text(shortStamp(e['at']), style: body(12, color: muted)),
              ]),
            ),
        ]),
      ),
    ]);
  }
}

