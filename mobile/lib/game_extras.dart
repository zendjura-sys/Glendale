import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'core/widgets/arctic_glass/arctic_glass.dart';
import 'i18n.dart';
import 'skeletons.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// Блоки сторінки гри, як на сайті (pages/games/show.tsx): мій беклог, оцінка спільноти, лідерборд,
// музика гри й розділи, що вантажаться при відкритті — ціни й бажане, «чи потягне ПК», новини патчів,
// цілі, FPS гравців, питання й відповіді, наставники, мої досягнення Steam.
// Дані — ті самі маршрути мосту /site/games/{slug}/…; вимкнений плагін сервер просто не віддає.

class GameExtras extends StatefulWidget {
  const GameExtras({required this.slug, required this.name, super.key});
  final String slug;
  final String name;

  @override
  State<GameExtras> createState() => _GameExtrasState();
}

class _GameExtrasState extends State<GameExtras> {
  Map<String, dynamic>? data;

  Api get api => AppScope.read(context).session.api;
  String get base => '/games/${widget.slug}';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final d = await api.get(Api.site(base));
      if (mounted) setState(() => data = d);
    } catch (_) {
      if (mounted) setState(() => data = {});
    }
  }

  Future<void> _backlog(String? status) async {
    await attempt(context, () => api.put(Api.site('$base/backlog'), {'status': status}));
    await _load();
  }

  Future<void> _ratingAction(Future<Map<String, dynamic>> Function() call) async {
    try {
      final summary = await call();
      if (mounted) setState(() => data = {...?data, 'community_rating': summary});
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) return const Padding(padding: EdgeInsets.only(top: 12), child: SkeletonShimmer(child: Sk(height: 120, radius: 20)));
    final rating = mapOf(d['community_rating']);
    final board = mapOf(d['leaderboard']);
    final soundtracks = maps(d['soundtracks']);
    final statuses = {'want': tr('Хочу'), 'playing': tr('Граю'), 'done': tr('Пройшов'), 'dropped': tr('Кинув')};
    final current = text(mapOf(d['backlog'])['status']) ?? text(d['backlog']);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (d['backlog_on'] == true) ...[
        const SizedBox(height: 12),
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CardTitle(tr('Мій беклог'), icon: LucideIcons.listChecks),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final e in statuses.entries) SelectPill(label: e.value, selected: current == e.key, onTap: () => _backlog(current == e.key ? null : e.key)),
            ]),
          ]),
        ),
      ],
      if (rating.isNotEmpty) ...[
        const SizedBox(height: 12),
        _RatingCard(
          rating: rating,
          onPlayed: () => _ratingAction(() => api.post(Api.site('$base/played'))),
          onRate: (score) => _ratingAction(() => api.post(Api.site('$base/rating'), {'score': score})),
        ),
      ],
      if (maps(board['top']).isNotEmpty) ...[
        const SizedBox(height: 12),
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CardTitle(tr('Лідерборд'), icon: LucideIcons.trophy),
            for (final row in maps(board['top']).take(10))
              InkWell(
                onTap: () => context.push('/u/${mapOf(row['user'])['username']}'),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(children: [
                    SizedBox(width: 28, child: Text('${row['place']}', style: body(14, color: intOf(row['place']) <= 3 ? gold : muted, weight: FontWeight.w700))),
                    Avatar(url: text(mapOf(row['user'])['avatar_url']), name: text(mapOf(row['user'])['name']) ?? '?', size: 32),
                    const SizedBox(width: 10),
                    Expanded(child: Text(text(mapOf(row['user'])['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, weight: FontWeight.w600))),
                    Text(tr('{n} дн.', {'n': '${row['days']}'}), style: body(12.5, color: muted)),
                  ]),
                ),
              ),
            if (board['me'] is Map) Text(tr('Ви на {p} місці', {'p': '${mapOf(board['me'])['place']}'}), style: body(13, color: accent)),
          ]),
        ),
      ],
      if (soundtracks.isNotEmpty) ...[
        const SizedBox(height: 12),
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CardTitle(tr('Музика гри'), icon: LucideIcons.music),
            for (final p in soundtracks)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: ClipRRect(borderRadius: BorderRadius.circular(8), child: SizedBox(width: 44, height: 44, child: NetImage(text(p['cover_url']) ?? text(p['cover'])))),
                title: Text(text(p['title']) ?? '', style: body(14.5, weight: FontWeight.w600)),
                subtitle: Text(text(p['author']) ?? '', style: body(12, color: faint)),
                onTap: () => context.push('/music/playlists/${p['id']}'),
              ),
          ]),
        ),
      ],
      _Lazy(title: tr('Ціни й бажане'), icon: LucideIcons.badgePercent, load: () => api.get(Api.site('$base/prices')), builder: (d, reload) => _Prices(d: d, base: base, reload: reload)),
      _Lazy(title: tr('Чи потягне мій ПК'), icon: LucideIcons.cpu, load: () => api.get(Api.site('$base/pc-check')), builder: (d, reload) => _PcCheck(d: d, reload: reload)),
      _Lazy(title: tr('Новини й патчі'), icon: LucideIcons.newspaper, load: () => api.get(Api.site('$base/news')), builder: (d, _) => _News(d: d)),
      _Lazy(title: tr('Мої цілі'), icon: LucideIcons.target, load: () => api.get(Api.site('$base/goals')), builder: (d, reload) => _Goals(d: d, base: base, reload: reload)),
      _Lazy(title: tr('FPS у гравців'), icon: LucideIcons.gauge, load: () => api.get(Api.site('$base/fps')), builder: (d, _) => _Fps(d: d)),
      _Lazy(title: tr('Питання й відповіді'), icon: LucideIcons.messageCircleQuestion, load: () => api.get(Api.site('$base/questions')), builder: (d, reload) => _Questions(d: d, base: base, reload: reload)),
      _Lazy(title: tr('Наставники'), icon: LucideIcons.graduationCap, load: () => api.get(Api.site('$base/mentors')), builder: (d, reload) => _Mentors(d: d, base: base, game: widget.name, reload: reload)),
      _Lazy(title: tr('Мої досягнення Steam'), icon: LucideIcons.award, load: () => api.get(Api.site('$base/achievements')), builder: (d, _) => _Achievements(d: d)),
    ]);
  }
}

/// Розділ, що вантажиться лише при першому відкритті (сторінка гри лишається легкою).
class _Lazy extends StatefulWidget {
  const _Lazy({required this.title, required this.icon, required this.load, required this.builder});
  final String title;
  final IconData icon;
  final Future<Map<String, dynamic>> Function() load;
  final Widget Function(Map<String, dynamic> d, Future<void> Function() reload) builder;

  @override
  State<_Lazy> createState() => _LazyState();
}

class _LazyState extends State<_Lazy> {
  bool open = false;
  Map<String, dynamic>? data;
  Object? error;

  Future<void> _load() async {
    try {
      final d = await widget.load();
      if (mounted) {
        setState(() {
          data = d;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final still = MediaQuery.disableAnimationsOf(context);
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Glass(
        padding: EdgeInsets.zero,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ArcticPressable(
            onTap: () {
              setState(() => open = !open);
              if (open && data == null) _load();
            },
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                Icon(widget.icon, color: accent, size: 20),
                const SizedBox(width: 12),
                Expanded(child: Text(widget.title, style: body(15, weight: FontWeight.w700))),
                AnimatedRotation(turns: open ? 0.5 : 0, duration: still ? Duration.zero : const Duration(milliseconds: 220), child: Icon(LucideIcons.chevronDown, color: muted, size: 20)),
              ]),
            ),
          ),
          AnimatedSize(
            duration: still ? Duration.zero : const Duration(milliseconds: 240),
            curve: Curves.easeOutCubic,
            alignment: Alignment.topCenter,
            child: !open
                ? const SizedBox(width: double.infinity)
                : Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    child: error != null
                        ? Text('$error'.replaceFirst(RegExp(r'^Exception: '), ''), style: body(13, color: muted))
                        : data == null
                            ? const SkeletonShimmer(child: Column(children: [Sk(height: 12), SizedBox(height: 8), Sk(height: 12, width: 200)]))
                            : widget.builder(data!, _load),
                  ),
          ),
        ]),
      ),
    );
  }
}

class _RatingCard extends StatelessWidget {
  const _RatingCard({required this.rating, required this.onPlayed, required this.onRate});
  final Map<String, dynamic> rating;
  final VoidCallback onPlayed;
  final ValueChanged<int> onRate;

  @override
  Widget build(BuildContext context) {
    final dist = [for (final v in (rating['distribution'] as List? ?? const [])) intOf(v)];
    final max = dist.isEmpty ? 1 : dist.reduce((a, b) => a > b ? a : b).clamp(1, 1 << 30);
    final mine = rating['mine'] == null ? null : intOf(rating['mine']);
    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CardTitle(tr('Оцінка гравців'), icon: LucideIcons.star),
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text(rating['average'] == null ? '—' : '${rating['average']}', style: display(32)),
          const SizedBox(width: 8),
          Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(tr('{n} оцінок', {'n': '${rating['count'] ?? 0}'}), style: body(12.5, color: muted))),
          const Spacer(),
          if (dist.isNotEmpty)
            SizedBox(
              height: 36,
              child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                for (final v in dist) Container(width: 6, height: 4 + 32 * v / max, margin: const EdgeInsets.only(left: 2), decoration: BoxDecoration(color: accent.withValues(alpha: 0.7), borderRadius: BorderRadius.circular(2))),
              ]),
            ),
        ]),
        const SizedBox(height: 10),
        if (rating['played'] != true)
          GhostButton(label: tr('Я грав у цю гру'), icon: LucideIcons.gamepad2, compact: true, onPressed: onPlayed)
        else ...[
          Text(mine == null ? tr('Ваша оцінка') : tr('Ваша оцінка: {n}', {'n': '$mine'}), style: body(13, color: muted)),
          const SizedBox(height: 8),
          // Десять кнопок на всю ширину картки — без переносу «10» на новий рядок.
          Row(children: [
            for (var i = 1; i <= 10; i++)
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(right: i < 10 ? 4 : 0),
                  child: ArcticPressable(
                    onTap: () => onRate(i),
                    scale: 0.9,
                    child: Container(
                      height: 32,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: mine == i ? primary : fg.withValues(alpha: 0.07), borderRadius: BorderRadius.circular(10)),
                      child: Text('$i', style: body(13, color: mine == i ? Colors.white : soft, weight: FontWeight.w700)),
                    ),
                  ),
                ),
              ),
          ]),
        ],
      ]),
    );
  }
}

class _Prices extends StatelessWidget {
  const _Prices({required this.d, required this.base, required this.reload});
  final Map<String, dynamic> d;
  final String base;
  final Future<void> Function() reload;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    final steam = mapOf(d['steam']);
    final deals = maps(d['deals']);
    final giveaway = mapOf(d['giveaway']);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (d['free'] == true) Text(tr('Гра безкоштовна.'), style: body(14, color: green, weight: FontWeight.w600)),
      if (giveaway.isNotEmpty)
        _row(context, LucideIcons.gift, tr('Роздача: {s}', {'s': text(giveaway['store_label']) ?? ''}), tr('Безкоштовно'), text(giveaway['url']), color: green),
      if (steam.isNotEmpty) _row(context, LucideIcons.store, 'Steam', '${steam['final']}${intOf(steam['discount']) > 0 ? '  −${steam['discount']}%' : ''}', text(d['steam_url'])),
      for (final deal in deals.take(5)) _row(context, LucideIcons.tag, text(deal['store']) ?? '', '\$${deal['price']}${(deal['savings'] is num && (deal['savings'] as num) > 0) ? '  −${(deal['savings'] as num).round()}%' : ''}', text(deal['url'])),
      if (d['lowest_ever'] != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(tr('Найнижча ціна за весь час: \${p}', {'p': '${d['lowest_ever']}'}), style: body(12.5, color: muted))),
      if (deals.isEmpty && steam.isEmpty && d['free'] != true && giveaway.isEmpty) Text(tr('Цін поки немає.'), style: body(13, color: muted)),
      const SizedBox(height: 10),
      d['wished'] == true
          ? GhostButton(label: tr('У бажаному — сповістимо про знижку'), icon: LucideIcons.heart, compact: true, onPressed: () async {
              await attempt(context, () => api.post(Api.site('$base/wish'), {'on': false}));
              await reload();
            })
          : PrimaryButton(label: tr('Додати в бажане'), icon: LucideIcons.heart, compact: true, onPressed: () async {
              await attempt(context, () => api.post(Api.site('$base/wish'), {'on': true}), success: tr('Сповістимо, коли подешевшає.'));
              await reload();
            }),
    ]);
  }

  Widget _row(BuildContext context, IconData icon, String store, String price, String? url, {Color? color}) => ListTile(
    contentPadding: EdgeInsets.zero,
    dense: true,
    leading: Icon(icon, color: color ?? accent, size: 20),
    title: Text(store, style: body(14, weight: FontWeight.w600)),
    trailing: Text(price, style: body(14, color: color ?? ink, weight: FontWeight.w700)),
    onTap: url == null ? null : () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
  );
}

class _PcCheck extends StatelessWidget {
  const _PcCheck({required this.d, required this.reload});
  final Map<String, dynamic> d;
  final Future<void> Function() reload;

  Future<void> _edit(BuildContext context) async {
    final api = AppScope.read(context).session.api;
    final pc = mapOf(d['pc']);
    final cpu = TextEditingController(text: text(pc['cpu']) ?? '');
    final gpu = TextEditingController(text: text(pc['gpu']) ?? '');
    final ram = TextEditingController(text: pc['ram'] == null ? '' : '${pc['ram']}');
    final saved = await showGcSheet<bool>(
      context,
      title: tr('Мій ПК'),
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          GcField(controller: cpu, label: tr('Процесор: напр. Ryzen 5 5600')),
          const SizedBox(height: 10),
          GcField(controller: gpu, label: tr('Відеокарта: напр. RTX 3060')),
          const SizedBox(height: 10),
          GcField(controller: ram, label: tr('Оперативна пам’ять, ГБ'), keyboard: TextInputType.number),
          const SizedBox(height: 12),
          PrimaryButton(
            label: tr('Зберегти'),
            icon: LucideIcons.check,
            onPressed: () async {
              final ok = await attempt(sheet, () => api.put(Api.site('/games/pc'), {'cpu': cpu.text.trim(), 'gpu': gpu.text.trim(), 'ram': int.tryParse(ram.text.trim())}));
              if (ok && sheet.mounted) Navigator.pop(sheet, true);
            },
          ),
        ]),
      ),
    );
    cpu.dispose();
    gpu.dispose();
    ram.dispose();
    if (saved == true) await reload();
  }

  @override
  Widget build(BuildContext context) {
    final summary = text(d['summary']);
    final (label, color) = switch (summary) {
      'recommended' => (tr('Потягне на рекомендованих налаштуваннях'), green),
      'minimum' => (tr('Потягне на мінімальних'), gold),
      'below' => (tr('Ваш ПК слабший за мінімальні вимоги'), dangerSoft),
      _ => (d['configured'] == true ? tr('Не вдалося порівняти — вимог гри ще немає') : tr('Вкажіть свій ПК, щоб перевірити'), muted),
    };
    Widget level(String title, Map<String, dynamic> req) => req.isEmpty
        ? const SizedBox.shrink()
        : Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: body(12.5, color: faint, weight: FontWeight.w700)),
              for (final e in req.entries) Text('${e.key}: ${e.value}', style: body(13, color: soft)),
            ]),
          );
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(label, style: body(14, color: color, weight: FontWeight.w600)),
      level(tr('Мінімальні'), mapOf(mapOf(d['requirements'])['minimum'])),
      level(tr('Рекомендовані'), mapOf(mapOf(d['requirements'])['recommended'])),
      const SizedBox(height: 10),
      GhostButton(label: d['configured'] == true ? tr('Змінити мій ПК') : tr('Вказати мій ПК'), icon: LucideIcons.monitor, compact: true, onPressed: () => _edit(context)),
    ]);
  }
}

class _News extends StatelessWidget {
  const _News({required this.d});
  final Map<String, dynamic> d;

  @override
  Widget build(BuildContext context) {
    final items = maps(d['items']);
    if (items.isEmpty) return Text(tr('Новин поки немає.'), style: body(13, color: muted));
    return Column(children: [
      for (final n in items.take(8))
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(n['patch'] == true ? LucideIcons.wrench : LucideIcons.newspaper, color: n['patch'] == true ? gold : accent, size: 20),
          title: Text(text(n['title']) ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(14, weight: FontWeight.w600)),
          subtitle: text(n['excerpt']) == null ? null : Text(text(n['excerpt'])!, maxLines: 2, overflow: TextOverflow.ellipsis, style: body(12.5, color: faint)),
          onTap: text(n['url']) == null ? null : () => launchUrl(Uri.parse(text(n['url'])!), mode: LaunchMode.externalApplication),
        ),
    ]);
  }
}

class _Goals extends StatelessWidget {
  const _Goals({required this.d, required this.base, required this.reload});
  final Map<String, dynamic> d;
  final String base;
  final Future<void> Function() reload;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    final goals = maps(d['goals']);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (final g in goals)
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          value: g['done'] == true,
          activeColor: primary,
          title: Text(text(g['title']) ?? '', style: body(14, weight: FontWeight.w600).copyWith(decoration: g['done'] == true ? TextDecoration.lineThrough : null)),
          onChanged: (v) async {
            await attempt(context, () => api.patch(Api.site('$base/goals/${g['id']}'), {'done': v == true}));
            await reload();
          },
        ),
      if (goals.isEmpty) Text(tr('Поставте собі ціль у цій грі — ранг, проходження, досягнення.'), style: body(13, color: muted)),
      const SizedBox(height: 8),
      GhostButton(
        label: tr('Нова ціль'),
        icon: LucideIcons.plus,
        compact: true,
        onPressed: () async {
          final title = await askText(context, tr('Нова ціль'), hint: tr('Напр. дійти до Global Elite'), action: tr('Додати'));
          if (title == null || title.trim().isEmpty || !context.mounted) return;
          await attempt(context, () => api.post(Api.site('$base/goals'), {'title': title.trim()}));
          await reload();
        },
      ),
    ]);
  }
}

class _Fps extends StatelessWidget {
  const _Fps({required this.d});
  final Map<String, dynamic> d;

  @override
  Widget build(BuildContext context) {
    final rows = maps(d['rows']);
    final presets = mapOf(d['presets']);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(tr('{r}, налаштування «{p}» · звітів: {n}', {'r': text(d['resolution']) ?? '', 'p': '${presets[d['preset']] ?? d['preset']}', 'n': '${d['total'] ?? 0}'}), style: body(12.5, color: faint)),
      const SizedBox(height: 6),
      if (rows.isEmpty) Text(tr('Звітів поки немає.'), style: body(13, color: muted)),
      for (final r in rows.take(10))
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(children: [
            Expanded(child: Text(text(r['gpu']) ?? '', style: body(13.5))),
            Text('${r['fps']} FPS', style: body(13.5, color: accent, weight: FontWeight.w700)),
          ]),
        ),
    ]);
  }
}

class _Questions extends StatelessWidget {
  const _Questions({required this.d, required this.base, required this.reload});
  final Map<String, dynamic> d;
  final String base;
  final Future<void> Function() reload;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    final questions = maps(d['questions']);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (final q in questions.take(10))
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              if (q['solved_answer_id'] != null) Padding(padding: const EdgeInsets.only(right: 6), child: Icon(LucideIcons.circleCheck, size: 16, color: green)),
              Expanded(child: Text(text(q['title']) ?? '', style: body(14, weight: FontWeight.w700))),
            ]),
            if (text(q['body']) case final b?) Text(b, style: body(13, color: soft)),
            for (final a in maps(q['answers']).take(3))
              Padding(
                padding: const EdgeInsets.only(top: 6, left: 10),
                child: Text('— ${text(a['body']) ?? ''}', style: body(13, color: a['id'] == q['solved_answer_id'] ? green : soft)),
              ),
            TextButton(
              onPressed: () async {
                final answer = await askText(context, tr('Ваша відповідь'), maxLines: 4, action: tr('Відповісти'));
                if (answer == null || answer.trim().isEmpty || !context.mounted) return;
                await attempt(context, () => api.post(Api.site('$base/questions/${q['id']}/answers'), {'body': answer.trim()}));
                await reload();
              },
              child: Text(tr('Відповісти'), style: body(13, color: accent, weight: FontWeight.w600)),
            ),
          ]),
        ),
      if (questions.isEmpty) Text(tr('Питань поки немає — спитайте першим.'), style: body(13, color: muted)),
      GhostButton(
        label: tr('Поставити питання'),
        icon: LucideIcons.messageCirclePlus,
        compact: true,
        onPressed: () async {
          final title = await askText(context, tr('Ваше питання'), hint: tr('Напр. як пройти другого боса?'), action: tr('Спитати'));
          if (title == null || title.trim().isEmpty || !context.mounted) return;
          await attempt(context, () => api.post(Api.site('$base/questions'), {'title': title.trim()}));
          await reload();
        },
      ),
    ]);
  }
}

class _Mentors extends StatelessWidget {
  const _Mentors({required this.d, required this.base, required this.game, required this.reload});
  final Map<String, dynamic> d;
  final String base;
  final String game;
  final Future<void> Function() reload;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    final mentors = maps(d['mentors']);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (final m in mentors.take(8))
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Avatar(url: text(m['avatar_url']), name: text(m['name']) ?? '?', size: 38),
          title: Text(text(m['name']) ?? '', style: body(14, weight: FontWeight.w600)),
          subtitle: Text(text(m['about']) ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(12.5, color: faint)),
          trailing: IconButton(
            tooltip: tr('Написати'),
            icon: Icon(LucideIcons.messageCircle, color: accent),
            onPressed: () async {
              try {
                final r = await api.post('/api/v1/messages/with/${m['username']}');
                final id = intOf(r['id']);
                if (id > 0 && context.mounted) context.push('/messages/$id');
              } catch (e) {
                if (context.mounted) toast(context, e);
              }
            },
          ),
        ),
      if (mentors.isEmpty) Text(tr('Наставників у цій грі ще немає.'), style: body(13, color: muted)),
      const SizedBox(height: 8),
      d['me'] != null
          ? GhostButton(label: tr('Перестати бути наставником'), compact: true, onPressed: () async {
              await attempt(context, () => api.delete(Api.site('$base/mentors')));
              await reload();
            })
          : GhostButton(
              label: tr('Стати наставником'),
              icon: LucideIcons.graduationCap,
              compact: true,
              onPressed: () async {
                final about = await askText(context, tr('Чим можете допомогти в {g}?', {'g': game}), maxLines: 3, action: tr('Зберегти'));
                if (about == null || about.trim().isEmpty || !context.mounted) return;
                await attempt(context, () => api.post(Api.site('$base/mentors'), {'about': about.trim()}));
                await reload();
              },
            ),
    ]);
  }
}

class _Achievements extends StatelessWidget {
  const _Achievements({required this.d});
  final Map<String, dynamic> d;

  @override
  Widget build(BuildContext context) {
    if (d['linked'] != true) return Text(tr('Під’єднайте Steam у налаштуваннях профілю на сайті, щоб бачити свої досягнення.'), style: body(13, color: muted));
    final a = mapOf(d['data']);
    if (a.isEmpty) return Text(tr('У цій грі досягнень ще немає.'), style: body(13, color: muted));
    final unlocked = intOf(a['unlocked']), total = intOf(a['total']);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(tr('{u} з {t} досягнень', {'u': '$unlocked', 't': '$total'}), style: body(14, weight: FontWeight.w700)),
      const SizedBox(height: 8),
      ClipRRect(borderRadius: BorderRadius.circular(4), child: LinearProgressIndicator(value: total == 0 ? 0 : unlocked / total, minHeight: 6, backgroundColor: fg.withValues(alpha: 0.08))),
      const SizedBox(height: 10),
      for (final r in maps(a['rarest']).take(5))
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: ClipRRect(borderRadius: BorderRadius.circular(8), child: SizedBox(width: 36, height: 36, child: NetImage(text(r['icon'])))),
          title: Text(text(r['name']) ?? '', style: body(13.5, weight: FontWeight.w600)),
          trailing: Text('${r['percent']}%', style: body(12.5, color: gold)),
        ),
    ]);
  }
}
