import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'shell.dart';
import 'state.dart';
import 'teammates.dart';
import 'theme.dart';
import 'widgets.dart';

// ШІ-помічники, як на сайті: «Сьогодні» (/today), помічник у довідці (/help-assistant)
// і підбір тиммейтів словами (/party/match/ai). Дані — через міст /api/v1/site/*.

IconData _factIcon(String? kind) => switch (kind) {
      'shift' => LucideIcons.calendarClock,
      'tournament' => LucideIcons.trophy,
      'birthday' => LucideIcons.cake,
      'quest' => LucideIcons.target,
      'unread' => LucideIcons.messageCircle,
      'post' => LucideIcons.newspaper,
      _ => LucideIcons.calendarDays,
    };

/// «Сьогодні»: факти дня й короткий переказ від ШІ.
class TodayScreen extends StatefulWidget {
  const TodayScreen({super.key});

  @override
  State<TodayScreen> createState() => _TodayScreenState();
}

class _TodayScreenState extends State<TodayScreen> {
  int _version = 0;
  bool _refresh = false;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      watch: _version,
      load: () {
        // «Оновити» переписує зведення один раз; звичайне потягування — з кешу.
        final refresh = _refresh;
        _refresh = false;
        return api.get(Api.site(refresh ? '/today?refresh=1' : '/today'));
      },
      builder: (d, reload) {
        final facts = maps(d['facts']);
        final summary = text(d['summary']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Сьогодні'), subtitle: shortStamp(d['date'])),
            if (d['ai'] == true && facts.isNotEmpty) ...[
              Glass(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Icon(LucideIcons.sparkles, size: 18, color: primary),
                    const SizedBox(width: 8),
                    Expanded(child: Text(tr('Зведення дня'), style: body(14.5, weight: FontWeight.w600))),
                    RoundIcon(
                      icon: LucideIcons.refreshCw,
                      tooltip: tr('Оновити зведення'),
                      onTap: () => setState(() {
                        _refresh = true;
                        _version++;
                      }),
                    ),
                  ]),
                  const SizedBox(height: 8),
                  Text(summary ?? tr('ШІ зараз не відповідає — нижче все, що чекає на вас сьогодні.'), style: body(14.5, color: fg.withValues(alpha: 0.86)).copyWith(height: 1.5)),
                ]),
              ),
              const SizedBox(height: 12),
            ],
            if (facts.isEmpty)
              EmptyState(icon: LucideIcons.calendarDays, title: tr('Сьогодні тихо'), text: tr('Подій, змін і непрочитаного немає. Загляньте в стрічку або знайдіть, з ким пограти.'))
            else
              Glass(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Column(children: [
                  for (final f in facts)
                    ListTile(
                      leading: Icon(_factIcon(text(f['icon'])), color: primary, size: 20),
                      title: Text(text(f['text']) ?? '', style: body(14)),
                      trailing: text(f['href']) == null ? null : Icon(LucideIcons.chevronRight, size: 18, color: muted),
                      onTap: text(f['href']) == null ? null : () => context.push(appPathFor(text(f['href']))),
                    ),
                ]),
              ),
          ],
        );
      },
    );
  }
}

/// Помічник по сайту в довідці: питання словами — відповідь за статтями з посиланнями.
class SiteAssistantCard extends StatefulWidget {
  const SiteAssistantCard({super.key});

  @override
  State<SiteAssistantCard> createState() => _SiteAssistantCardState();
}

class _SiteAssistantCardState extends State<SiteAssistantCard> {
  final _question = TextEditingController();
  final List<Map<String, dynamic>> _turns = [];
  bool _busy = false;

  @override
  void dispose() {
    _question.dispose();
    super.dispose();
  }

  Future<void> _ask() async {
    final q = _question.text.trim();
    if (q.length < 2 || _busy) return;
    final history = [for (final t in _turns) {'role': t['role'], 'content': t['content']}];
    setState(() {
      _turns.add({'role': 'user', 'content': q});
      _question.clear();
      _busy = true;
    });
    try {
      final res = await AppScope.read(context).session.api.post(Api.site('/help-assistant'), {'question': q, 'history': history});
      if (!mounted) return;
      setState(() => _turns.add({'role': 'assistant', 'content': text(res['answer']) ?? '', 'sources': maps(res['sources'])}));
    } catch (e) {
      if (!mounted) return;
      setState(() => _turns.add({'role': 'assistant', 'content': e is ApiException ? e.message : tr('Не вдалося отримати відповідь. Спробуйте ще раз.')}));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Посилання виду [Назва](/help/…) показуємо назвою; самі переходи — чипами джерел нижче.
  String _plain(String value) => value.replaceAllMapped(RegExp(r'\[([^\]]+)\]\((/[^)\s]+)\)'), (m) => m.group(1) ?? '').replaceAll('**', '');

  @override
  Widget build(BuildContext context) {
    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CardTitle(tr('Помічник по сайту'), icon: LucideIcons.messageCircleQuestion),
        Text(tr('Запитайте словами, як щось зробити, — помічник відповість за статтями довідки.'), style: body(12.5, color: muted)),
        const SizedBox(height: 10),
        for (final t in _turns)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: t['role'] == 'user'
                ? Align(
                    alignment: Alignment.centerRight,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(color: primary.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(14)),
                      child: Text('${t['content']}', style: body(14)),
                    ),
                  )
                : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_plain('${t['content']}'), style: body(14, color: fg.withValues(alpha: 0.86)).copyWith(height: 1.45)),
                    if (maps(t['sources']).isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Wrap(spacing: 6, runSpacing: 6, children: [
                        for (final s in maps(t['sources']))
                          ActionChip(
                            avatar: Icon(LucideIcons.bookOpen, size: 14, color: primary),
                            label: Text(text(s['title']) ?? '', style: body(12.5)),
                            onPressed: () => context.push(appPathFor(text(s['url']))),
                          ),
                      ]),
                    ],
                  ]),
          ),
        if (_busy)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(tr('Шукаю в довідці…'), style: body(13, color: muted)),
          ),
        Row(children: [
          Expanded(child: GcField(controller: _question, label: tr('Напр.: як взяти зміну в сім’ї?'), onSubmit: _ask, dense: true)),
          const SizedBox(width: 8),
          RoundIcon(icon: LucideIcons.send, filled: true, tooltip: tr('Запитати'), onTap: _busy ? null : _ask),
        ]),
      ]),
    );
  }
}

/// Підбір тиммейтів словами: ШІ розбирає запит у критерії й пояснює вибір.
class TeammateFinderCard extends StatefulWidget {
  const TeammateFinderCard({required this.onInvite, super.key});

  /// Запросити гравця у своє паті (null — відкритих паті немає).
  final void Function(Map<String, dynamic> match)? onInvite;

  @override
  State<TeammateFinderCard> createState() => _TeammateFinderCardState();
}

class _TeammateFinderCardState extends State<TeammateFinderCard> {
  final _query = TextEditingController();
  Map<String, dynamic>? _result;
  bool _busy = false;

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  Future<void> _find() async {
    final q = _query.text.trim();
    if (q.length < 3 || _busy) return;
    setState(() => _busy = true);
    try {
      final res = await AppScope.read(context).session.api.post(Api.site('/party/match/ai'), {'query': q});
      if (mounted) setState(() => _result = res);
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = mapOf(_result?['criteria']);
    final chips = <String>[
      for (final g in (c['games'] as List? ?? const [])) '$g',
      for (final t in (c['times'] as List? ?? const [])) teammateTimes()['$t'] ?? '$t',
      if (text(c['skill']) != null) teammateSkills()[c['skill']] ?? '${c['skill']}',
      if (c['mic'] == true) tr('з мікрофоном'),
    ];
    final matches = maps(_result?['matches']);
    return Glass(
      radius: 12,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CardTitle(tr('Опишіть, кого шукаєте'), icon: LucideIcons.sparkles),
        Text(tr('Словами, як другу: гра, час, рівень, мікрофон. ШІ знайде, хто підходить, і пояснить чому.'), style: body(12.5, color: muted)),
        const SizedBox(height: 10),
        GcField(controller: _query, label: tr('Напр.: двоє в CS2 ввечері, з мікрофоном, без токсиків'), onSubmit: _find, maxLines: 2, minLines: 1),
        const SizedBox(height: 8),
        PrimaryButton(label: tr('Підібрати'), icon: LucideIcons.sparkles, busy: _busy, onPressed: _busy ? null : _find),
        if (_result != null) ...[
          const SizedBox(height: 10),
          if (chips.isNotEmpty) Wrap(spacing: 6, runSpacing: 6, children: [for (final chip in chips) Pill(label: chip)]),
          const SizedBox(height: 6),
          if (matches.isEmpty)
            Text(tr('Поки нікого під такий запит — спробуйте менше умов або іншу гру.'), style: body(13, color: muted))
          else
            for (final m in matches) ...[
              TeammateTile(
                match: m,
                onMessage: () => messageTeammate(context, m),
                onInvite: widget.onInvite == null ? null : () => widget.onInvite!(m),
              ),
              if (text(m['why']) != null)
                Padding(
                  padding: const EdgeInsets.only(left: 4, bottom: 8),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Icon(LucideIcons.sparkles, size: 14, color: primary),
                    const SizedBox(width: 6),
                    Expanded(child: Text(text(m['why'])!, style: body(13, color: soft))),
                  ]),
                ),
            ],
        ],
      ]),
    );
  }
}
