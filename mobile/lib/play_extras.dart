import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'core/widgets/arctic_glass/arctic_glass.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// Розділи сайту, яких бракувало застосунку (той самий міст `/api/v1/site/*`):
//  дошка ідей (/ideas)  — пропозиції й голоси, статус від команди;
//  дуелі (/duels)       — виклик гравця, підтвердження переможця обома, рахунок перемог;
//  тір-листи (/tierlists) — рейтинги S/A/B…, свої й чужі, створення.

String _ago(dynamic iso) {
  final at = DateTime.tryParse(text(iso) ?? '');
  if (at == null) return '';
  final d = DateTime.now().difference(at);
  if (d.inMinutes < 60) return tr('{n} хв тому', {'n': '${d.inMinutes.clamp(1, 59)}'});
  if (d.inHours < 24) return tr('{n} год тому', {'n': '${d.inHours}'});
  return tr('{n} дн тому', {'n': '${d.inDays}'});
}

// ───────────────────────── Дошка ідей ─────────────────────────

class IdeasScreen extends StatefulWidget {
  const IdeasScreen({super.key});

  @override
  State<IdeasScreen> createState() => _IdeasScreenState();
}

class _IdeasScreenState extends State<IdeasScreen> {
  String sort = 'top';
  int _version = 0;

  static Map<String, (String, Color)> get _status => {
    'new': (tr('Нова'), muted),
    'planned': (tr('У планах'), AppColors.accentCyan),
    'in_progress': (tr('У роботі'), AppColors.accentPrimary),
    'done': (tr('Готово'), green),
    'declined': (tr('Відхилено'), dangerSoft),
  };

  Future<void> _propose() async {
    final title = TextEditingController();
    final details = TextEditingController();
    final api = AppScope.read(context).session.api;
    final sent = await showGcSheet<bool>(
      context,
      title: tr('Запропонувати ідею'),
      subtitle: tr('Коротко: що додати чи змінити й навіщо. Інші проголосують.'),
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          GcField(controller: title, label: tr('Назва ідеї')),
          const SizedBox(height: 10),
          GcField(controller: details, label: tr('Подробиці (необов’язково)'), maxLines: 4),
          const SizedBox(height: 14),
          PrimaryButton(
            label: tr('Надіслати'),
            icon: LucideIcons.send,
            onPressed: () async {
              final ok = await attempt(sheet, () => api.post(Api.site('/ideas'), {'title': title.text.trim(), 'body': details.text.trim()}), success: tr('Ідею додано.'));
              if (ok && sheet.mounted) Navigator.pop(sheet, true);
            },
          ),
        ]),
      ),
    );
    title.dispose();
    details.dispose();
    if (sent == true && mounted) setState(() => _version++);
  }

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      watch: '$sort-$_version',
      load: () => api.get(Api.site('/ideas?sort=$sort')),
      builder: (d, reload) {
        final ideas = maps(mapOf(d['ideas'])['data']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Дошка ідей'), subtitle: tr('Пропонуйте, що покращити в GameCon, і голосуйте за ідеї інших.')),
            Row(children: [
              Expanded(
                child: Segmented(
                  options: [SegmentOption('top', tr('Популярні')), SegmentOption('new', tr('Нові'))],
                  selected: sort,
                  onSelect: (v) => setState(() => sort = v),
                ),
              ),
              const SizedBox(width: 10),
              PrimaryButton(label: tr('Ідея'), icon: LucideIcons.plus, compact: true, expand: false, onPressed: _propose),
            ]),
            const SizedBox(height: 12),
            if (ideas.isEmpty) EmptyState(icon: LucideIcons.lightbulb, title: tr('Ідей поки немає'), text: tr('Будьте першим — запропонуйте, що додати.')),
            for (final idea in ideas)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Glass(
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _VoteButton(
                      votes: intOf(idea['votes']),
                      voted: idea['voted'] == true,
                      onTap: () async {
                        await attempt(context, () => api.post(Api.site('/ideas/${idea['id']}/vote')));
                        await reload();
                      },
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(text(idea['title']) ?? '', style: body(15.5, weight: FontWeight.w700)),
                        if (text(idea['body']) case final b?) Padding(padding: const EdgeInsets.only(top: 4), child: Text(b, style: body(13.5, color: soft).copyWith(height: 1.4))),
                        const SizedBox(height: 8),
                        Wrap(spacing: 8, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                          if (_status[text(idea['status']) ?? 'new'] case (final label, final color)) Pill(label: label, color: color),
                          Text('${text(mapOf(idea['author'])['name']) ?? ''} · ${_ago(idea['created_at'])}', style: body(12, color: faint)),
                        ]),
                        if (text(idea['answer']) case final a?)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Text(tr('Відповідь команди: {a}', {'a': a}), style: body(13, color: accent).copyWith(height: 1.4)),
                          ),
                      ]),
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

class _VoteButton extends StatelessWidget {
  const _VoteButton({required this.votes, required this.voted, required this.onTap});
  final int votes;
  final bool voted;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final on = voted ? (palette.isLight ? AppColors.accentPrimary : AppColors.accentCyan) : muted;
    return ArcticPressable(
      onTap: onTap,
      scale: 0.9,
      child: Container(
        width: 52,
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(color: on.withValues(alpha: voted ? 0.14 : 0.06), borderRadius: BorderRadius.circular(14)),
        child: Column(children: [
          Icon(LucideIcons.chevronUp, color: on, size: 20),
          Text('$votes', style: body(14, color: on, weight: FontWeight.w700)),
        ]),
      ),
    );
  }
}

// ───────────────────────── Дуелі ─────────────────────────

class DuelsScreen extends StatefulWidget {
  const DuelsScreen({this.to, super.key});

  /// Кого викликати одразу (з профілю: /duels?to=username).
  final String? to;

  @override
  State<DuelsScreen> createState() => _DuelsScreenState();
}

class _DuelsScreenState extends State<DuelsScreen> {
  int _version = 0;
  bool _opened = false;

  static Map<String, String> get _status => {
    'pending': tr('Чекає відповіді'),
    'accepted': tr('Триває'),
    'finished': tr('Завершено'),
    'disputed': tr('Спірний результат'),
    'declined': tr('Відхилено'),
    'cancelled': tr('Скасовано'),
  };

  Future<void> _challenge(List<Map<String, dynamic>> games, {String? to}) async {
    final api = AppScope.read(context).session.api;
    final user = TextEditingController(text: to ?? '');
    final terms = TextEditingController();
    String? game;
    final sent = await showGcSheet<bool>(
      context,
      title: tr('Викликати на дуель'),
      subtitle: tr('Домовтеся про умови; після гри обидва вкажуть переможця.'),
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheet) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            GcField(controller: user, label: tr('Нік суперника'), icon: LucideIcons.atSign),
            const SizedBox(height: 10),
            GcSelect<String?>(
              value: game,
              items: [(null, tr('Будь-яка гра')), for (final g in games) (text(g['slug']), text(g['name']) ?? '')],
              onChanged: (v) => setSheet(() => game = v),
            ),
            const SizedBox(height: 10),
            GcField(controller: terms, label: tr('Умови: напр. 1×1 на Mirage до 16')),
            const SizedBox(height: 14),
            PrimaryButton(
              label: tr('Надіслати виклик'),
              icon: LucideIcons.swords,
              onPressed: () async {
                final ok = await attempt(sheet, () => api.post(Api.site('/duels'), {'username': user.text.trim(), 'game': ?game, 'terms': terms.text.trim()}), success: tr('Виклик надіслано.'));
                if (ok && sheet.mounted) Navigator.pop(sheet, true);
              },
            ),
          ]),
        ),
      ),
    );
    user.dispose();
    terms.dispose();
    if (sent == true && mounted) setState(() => _version++);
  }

  @override
  Widget build(BuildContext context) {
    final session = AppScope.read(context).session;
    final api = session.api;
    return Remote(
      watch: _version,
      load: () => api.get(Api.site('/duels')),
      builder: (d, reload) {
        final duels = maps(d['duels']);
        final stats = mapOf(d['stats']);
        final games = maps(d['games']);
        if (widget.to != null && !_opened) {
          _opened = true;
          WidgetsBinding.instance.addPostFrameCallback((_) => _challenge(games, to: widget.to));
        }
        Future<void> act(Map<String, dynamic> duel, String action, {int? winner}) async {
          await attempt(context, () => api.post(Api.site('/duels/${duel['id']}'), {'action': action, 'winner': ?winner}));
          await reload();
        }

        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Дуелі'), subtitle: tr('Викликайте друзів 1 на 1 — переможця підтверджують обидва.')),
            Glass(
              child: Row(children: [
                StatColumn('${stats['wins'] ?? 0}', tr('Перемоги')),
                StatColumn('${stats['losses'] ?? 0}', tr('Поразки')),
                PrimaryButton(label: tr('Виклик'), icon: LucideIcons.swords, compact: true, expand: false, onPressed: () => _challenge(games)),
              ]),
            ),
            const SizedBox(height: 12),
            if (duels.isEmpty) EmptyState(icon: LucideIcons.swords, title: tr('Дуелей ще не було'), text: tr('Киньте виклик другові — хто кого?')),
            for (final duel in duels)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _DuelCard(duel: duel, me: session.myId, status: _status, onAct: (action, {winner}) => act(duel, action, winner: winner)),
              ),
          ],
        );
      },
    );
  }
}

class _DuelCard extends StatelessWidget {
  const _DuelCard({required this.duel, required this.me, required this.status, required this.onAct});
  final Map<String, dynamic> duel;
  final int? me;
  final Map<String, String> status;
  final Future<void> Function(String action, {int? winner}) onAct;

  @override
  Widget build(BuildContext context) {
    final a = mapOf(duel['challenger']);
    final b = mapOf(duel['opponent']);
    final state = text(duel['status']) ?? 'pending';
    final incoming = duel['incoming'] == true;
    final winner = duel['winner_id'];
    Widget side(Map<String, dynamic> u) => Expanded(
      child: Column(children: [
        Avatar(url: text(u['avatar_url']), name: text(u['name']) ?? '?', size: 44, ring: winner != null && winner == u['id']),
        const SizedBox(height: 6),
        Text(text(u['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(13, weight: FontWeight.w600)),
        if (winner != null && winner == u['id']) Text(tr('Переможець'), style: body(11.5, color: gold, weight: FontWeight.w700)),
      ]),
    );
    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          side(a),
          Text('VS', style: display(18, color: accent)),
          side(b),
        ]),
        const SizedBox(height: 10),
        Text(text(duel['terms']) ?? '', textAlign: TextAlign.center, style: body(14, color: soft)),
        const SizedBox(height: 8),
        Wrap(alignment: WrapAlignment.center, spacing: 8, children: [
          Pill(label: status[state] ?? state, color: state == 'finished' ? green : (state == 'disputed' ? gold : accent)),
          if (text(mapOf(duel['game'])['name']) case final g?) Pill(label: g, icon: LucideIcons.gamepad2, color: muted),
        ]),
        if (state == 'pending' && incoming) ...[
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: GhostButton(label: tr('Відхилити'), compact: true, onPressed: () => onAct('decline'))),
            const SizedBox(width: 10),
            Expanded(child: PrimaryButton(label: tr('Прийняти'), compact: true, onPressed: () => onAct('accept'))),
          ]),
        ],
        if (state == 'pending' && !incoming) ...[
          const SizedBox(height: 12),
          GhostButton(label: tr('Скасувати виклик'), compact: true, onPressed: () => onAct('cancel')),
        ],
        if (state == 'accepted' || state == 'disputed') ...[
          const SizedBox(height: 12),
          Text(duel['my_pick'] == null ? tr('Хто переміг?') : tr('Ваш вибір записано — чекаємо суперника.'), textAlign: TextAlign.center, style: body(13, color: muted)),
          if (duel['my_pick'] == null) ...[
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: GhostButton(label: text(a['first_name']) ?? text(a['name']) ?? '', compact: true, onPressed: () => onAct('report', winner: intOf(a['id'])))),
              const SizedBox(width: 10),
              Expanded(child: GhostButton(label: text(b['first_name']) ?? text(b['name']) ?? '', compact: true, onPressed: () => onAct('report', winner: intOf(b['id'])))),
            ]),
          ],
        ],
      ]),
    );
  }
}

// ───────────────────────── Тір-листи ─────────────────────────

/// Кольори рівнів, як на сайті (TierListController::COLORS); фіолетовий у застосунку — блакитний.
Color tierColor(String? name) => switch (name) {
  'rose' => const Color(0xFFFB7185),
  'amber' => const Color(0xFFFBBF24),
  'lime' => const Color(0xFFA3E635),
  'sky' => const Color(0xFF38BDF8),
  'violet' => const Color(0xFF60A5FA),
  _ => const Color(0xFF94A3B8),
};

class TierListsScreen extends StatefulWidget {
  const TierListsScreen({super.key});

  @override
  State<TierListsScreen> createState() => _TierListsScreenState();
}

class _TierListsScreenState extends State<TierListsScreen> {
  String tab = 'top';

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      watch: tab,
      load: () => api.get(Api.site('/tierlists?tab=$tab')),
      builder: (d, reload) {
        final lists = maps(mapOf(d['lists'])['data']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Тір-листи'), subtitle: tr('Розставте ігри, героїв чи зброю по рівнях S, A, B — і порівняйте з іншими.')),
            Row(children: [
              Expanded(
                child: Segmented(
                  options: [SegmentOption('top', tr('Топ')), SegmentOption('new', tr('Нові')), SegmentOption('mine', tr('Мої'))],
                  selected: tab,
                  onSelect: (v) => setState(() => tab = v),
                ),
              ),
              const SizedBox(width: 10),
              PrimaryButton(
                label: tr('Створити'),
                icon: LucideIcons.plus,
                compact: true,
                expand: false,
                onPressed: () async {
                  final made = await context.push<bool>('/tierlists/new');
                  if (made == true) await reload();
                },
              ),
            ]),
            const SizedBox(height: 12),
            if (lists.isEmpty) EmptyState(icon: LucideIcons.listOrdered, title: tr('Тір-листів поки немає'), text: tr('Створіть перший — S для найкращих.')),
            for (final list in lists)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Glass(
                  onTap: () => context.push('/tierlists/${list['id']}'),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(text(list['title']) ?? '', style: body(15.5, weight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text(
                      [text(mapOf(list['author'])['name']), text(mapOf(list['game'])['name']), tr('{n} переглядів', {'n': '${list['views'] ?? 0}'})].whereType<String>().join(' · '),
                      style: body(12.5, color: faint),
                    ),
                    const SizedBox(height: 10),
                    Row(children: [
                      for (final tier in maps(list['preview']))
                        Expanded(
                          flex: 1 + intOf(tier['count']),
                          child: Container(
                            height: 22,
                            margin: const EdgeInsets.only(right: 4),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: tierColor(text(tier['color'])).withValues(alpha: 0.85), borderRadius: BorderRadius.circular(6)),
                            child: Text(text(tier['label']) ?? '', style: body(11.5, color: const Color(0xFF0B1528), weight: FontWeight.w800)),
                          ),
                        ),
                    ]),
                  ]),
                ),
              ),
          ],
        );
      },
    );
  }
}

class TierListScreen extends StatelessWidget {
  const TierListScreen({required this.id, super.key});
  final int id;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/tierlists/$id')),
      builder: (d, reload) {
        final list = mapOf(d['list']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(text(list['title']) ?? tr('Тір-лист'), subtitle: [text(mapOf(list['author'])['name']), text(mapOf(list['game'])['name'])].whereType<String>().join(' · ')),
            if (d['own'] == true)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: GhostButton(
                    label: tr('Редагувати'),
                    icon: LucideIcons.pencil,
                    expand: false,
                    compact: true,
                    onPressed: () async {
                      final changed = await context.push<bool>('/tierlists/$id/edit');
                      if (changed == true) await reload();
                    },
                  ),
                ),
              ),
            Glass(
              padding: const EdgeInsets.all(10),
              child: Column(children: [
                for (final tier in maps(list['tiers']))
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: IntrinsicHeight(
                      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        Container(
                          width: 56,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: tierColor(text(tier['color'])), borderRadius: BorderRadius.circular(12)),
                          child: Text(text(tier['label']) ?? '', style: display(20, color: const Color(0xFF0B1528))),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Container(
                            constraints: const BoxConstraints(minHeight: 56),
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(color: fg.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(12)),
                            child: Wrap(spacing: 6, runSpacing: 6, children: [
                              for (final item in (tier['items'] as List? ?? const []))
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                  decoration: BoxDecoration(color: fg.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(10)),
                                  child: Text('$item', style: body(13, weight: FontWeight.w600)),
                                ),
                            ]),
                          ),
                        ),
                      ]),
                    ),
                  ),
              ]),
            ),
          ],
        );
      },
    );
  }
}

/// Новий тір-лист: назва й рівні S/A/B/C/D, елементи через кому.
class TierListCreateScreen extends StatefulWidget {
  const TierListCreateScreen({this.id, super.key});

  /// Редагування свого тір-листа (інакше — новий).
  final int? id;

  @override
  State<TierListCreateScreen> createState() => _TierListCreateScreenState();
}

class _TierListCreateScreenState extends State<TierListCreateScreen> {
  final title = TextEditingController();
  List<({String label, String color, TextEditingController items})> tiers = [
    for (final (label, color) in [('S', 'rose'), ('A', 'amber'), ('B', 'lime'), ('C', 'sky'), ('D', 'slate')]) (label: label, color: color, items: TextEditingController()),
  ];
  bool public = true;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    if (widget.id != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        try {
          final d = await AppScope.read(context).session.api.get(Api.site('/tierlists/${widget.id}'));
          final list = mapOf(d['list']);
          if (!mounted) return;
          setState(() {
            title.text = text(list['title']) ?? '';
            public = list['is_public'] != false;
            for (final t in tiers) {
              t.items.dispose();
            }
            tiers = [
              for (final t in maps(list['tiers'])) (label: text(t['label']) ?? '', color: text(t['color']) ?? 'slate', items: TextEditingController(text: ((t['items'] as List?) ?? const []).join(', '))),
            ];
          });
        } catch (e) {
          if (mounted) toast(context, e);
        }
      });
    }
  }

  @override
  void dispose() {
    title.dispose();
    for (final t in tiers) {
      t.items.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final api = AppScope.read(context).session.api;
    setState(() => busy = true);
    final ok = await attempt(
      context,
      () => (widget.id == null ? api.post : api.put)(Api.site(widget.id == null ? '/tierlists' : '/tierlists/${widget.id}'), {
        'title': title.text.trim(),
        'is_public': public,
        'tiers': [
          for (final t in tiers) {'label': t.label, 'color': t.color, 'items': t.items.text.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList()},
        ],
      }),
      success: tr('Тір-лист збережено.'),
    );
    if (!mounted) return;
    setState(() => busy = false);
    if (ok) context.pop(true);
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScroll(children: [
      PageTitle(widget.id == null ? tr('Новий тір-лист') : tr('Редагувати тір-лист'), subtitle: tr('Перелічіть через кому, що потрапляє на кожен рівень.')),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          GcField(controller: title, label: tr('Назва: напр. Найкращі шутери 2026')),
          const SizedBox(height: 12),
          for (final t in tiers)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(children: [
                Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: tierColor(t.color), borderRadius: BorderRadius.circular(12)),
                  child: Text(t.label, style: display(17, color: const Color(0xFF0B1528))),
                ),
                const SizedBox(width: 8),
                Expanded(child: GcField(controller: t.items, label: tr('Через кому'))),
              ]),
            ),
          const SizedBox(height: 4),
          Row(children: [
            Expanded(child: Text(tr('Показувати всім'), style: body(14))),
            GcSwitch(value: public, onChanged: (v) => setState(() => public = v)),
          ]),
          const SizedBox(height: 12),
          PrimaryButton(label: tr('Зберегти'), icon: LucideIcons.check, busy: busy, onPressed: _save),
        ]),
      ),
    ]);
  }
}
