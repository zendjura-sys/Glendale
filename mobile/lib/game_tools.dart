import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'core/widgets/arctic_glass/arctic_glass.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// ───────────────────────── Вибір гри ─────────────────────────

/// Шторка пошуку гри в каталозі (як «Ігри» на сайті). Повертає картку гри або null.
Future<Map<String, dynamic>?> pickGame(BuildContext context) {
  return showGcSheet<Map<String, dynamic>>(context, title: tr('Оберіть гру'), height: 460, builder: (_) => const _GameSearchSheet());
}

class _GameSearchSheet extends StatefulWidget {
  const _GameSearchSheet();

  @override
  State<_GameSearchSheet> createState() => _GameSearchSheetState();
}

class _GameSearchSheetState extends State<_GameSearchSheet> {
  final query = TextEditingController();
  List<Map<String, dynamic>> games = [];

  @override
  void dispose() {
    query.dispose();
    super.dispose();
  }

  Future<void> _search(String q) async {
    if (q.trim().length < 2) return;
    try {
      final d = await AppScope.read(context).session.api.get('/api/v1/games/search?q=${Uri.encodeQueryComponent(q.trim())}');
      if (mounted) setState(() => games = maps(d['games']));
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Column(children: [
        SearchField(controller: query, hint: tr('Назва гри'), onSearch: _search),
        const SizedBox(height: 8),
        Expanded(
          child: ListView(children: [
            for (final g in games)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: ClipRRect(borderRadius: BorderRadius.circular(6), child: SizedBox(width: 32, height: 42, child: NetImage(text(g['cover'])))),
                title: Text(text(g['name']) ?? '', style: body(14.5, weight: FontWeight.w600)),
                onTap: () => Navigator.pop(context, g),
              ),
          ]),
        ),
      ]),
    );
  }
}

/// Дата й час коротко: «31.10 · 20:00».
String _when(String? iso) {
  final at = DateTime.tryParse(iso ?? '')?.toLocal();
  if (at == null) return '';
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(at.day)}.${two(at.month)} · ${two(at.hour)}:${two(at.minute)}';
}

/// Невелика «пігулка» з текстом (вид конфігу, статус).
Widget _tag(String label, Color color) => Container(
  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
  decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(999)),
  child: Text(label, style: body(11, color: color, weight: FontWeight.w600)),
);

// ───────────────────────── Конфіги й приціли ─────────────────────────

String _kindName(String kind) => switch (kind) {
  'crosshair' => tr('Приціл'),
  'config' => tr('Конфіг'),
  'binds' => tr('Бінди'),
  'graphics' => tr('Графіка'),
  'sensitivity' => tr('Чутливість'),
  _ => kind,
};

const _kinds = ['crosshair', 'config', 'binds', 'graphics', 'sensitivity'];

/// Конфіги й приціли гравців: коди прицілів, конфіги, бінди — скопіювати одним дотиком.
class ConfigsScreen extends StatefulWidget {
  const ConfigsScreen({this.game, super.key});
  final String? game;

  @override
  State<ConfigsScreen> createState() => _ConfigsScreenState();
}

class _ConfigsScreenState extends State<ConfigsScreen> {
  String tab = 'top';
  String? kind;
  Map<String, dynamic>? game;
  int _version = 0;

  String get _query => Uri(queryParameters: {
    'tab': tab,
    'kind': ?kind,
    if (game != null) 'game': text(game!['slug']) ?? '' else if (widget.game != null) 'game': widget.game!,
  }).query;

  Future<void> _share() async {
    final title = TextEditingController();
    final code = TextEditingController();
    final note = TextEditingController();
    final api = AppScope.read(context).session.api;
    var picked = game;
    var pickedKind = kind ?? 'crosshair';
    final sent = await showGcSheet<bool>(
      context,
      title: tr('Поділитися конфігом'),
      subtitle: tr('Код прицілу, конфіг, бінди чи налаштування — інші скопіюють одним дотиком.'),
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheet) => SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            GhostButton(
              label: picked == null ? tr('Оберіть гру') : text(picked!['name']) ?? '',
              icon: LucideIcons.gamepad2,
              onPressed: () async {
                final g = await pickGame(sheet);
                if (g != null) setSheet(() => picked = g);
              },
            ),
            const SizedBox(height: 10),
            Segmented(scroll: true, options: [for (final k in _kinds) SegmentOption(k, _kindName(k))], selected: pickedKind, onSelect: (v) => setSheet(() => pickedKind = v)),
            const SizedBox(height: 10),
            GcField(controller: title, label: tr('Назва, напр. «Маленький зелений»')),
            const SizedBox(height: 10),
            GcField(controller: code, label: tr('Код прицілу чи текст конфігу'), maxLines: 5),
            const SizedBox(height: 10),
            GcField(controller: note, label: tr('Для чого й як застосувати (необов’язково)'), maxLines: 3),
            const SizedBox(height: 14),
            PrimaryButton(
              label: tr('Опублікувати'),
              icon: LucideIcons.send,
              onPressed: () async {
                if (picked == null) return toast(sheet, tr('Оберіть гру.'));
                final ok = await attempt(
                  sheet,
                  () => api.post(Api.site('/configs'), {'game_id': picked!['id'], 'kind': pickedKind, 'title': title.text.trim(), 'code': code.text, 'description': note.text.trim()}),
                  success: tr('Конфіг опубліковано.'),
                );
                if (ok && sheet.mounted) Navigator.pop(sheet, true);
              },
            ),
          ]),
        ),
      ),
    );
    title.dispose();
    code.dispose();
    note.dispose();
    if (sent == true && mounted) setState(() => _version++);
  }

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      watch: '$_query-$_version',
      load: () => api.get(Api.site('/configs?$_query')),
      builder: (d, reload) {
        final configs = maps(mapOf(d['configs'])['data']);
        final current = d['game'] is Map ? mapOf(d['game']) : game;
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Конфіги й приціли'), subtitle: tr('Коди прицілів, конфіги, бінди й налаштування від гравців.')),
            Row(children: [
              Expanded(
                child: GhostButton(
                  label: current == null ? tr('Усі ігри') : text(current['name']) ?? '',
                  icon: LucideIcons.gamepad2,
                  compact: true,
                  onPressed: () async {
                    final g = await pickGame(context);
                    if (g != null) setState(() => game = g);
                  },
                ),
              ),
              if (current != null) ...[
                const SizedBox(width: 8),
                IconButton(tooltip: tr('Усі ігри'), onPressed: () => setState(() => game = {'slug': ''}), icon: Icon(LucideIcons.x, color: muted)),
              ],
              const SizedBox(width: 8),
              PrimaryButton(label: tr('Поділитися'), icon: LucideIcons.plus, compact: true, expand: false, onPressed: _share),
            ]),
            const SizedBox(height: 10),
            Segmented(options: [SegmentOption('top', tr('Популярні')), SegmentOption('new', tr('Нові')), SegmentOption('mine', tr('Мої'))], selected: tab, onSelect: (v) => setState(() => tab = v)),
            const SizedBox(height: 8),
            Segmented(scroll: true, options: [SegmentOption('', tr('Усі')), for (final k in _kinds) SegmentOption(k, _kindName(k))], selected: kind ?? '', onSelect: (v) => setState(() => kind = v.isEmpty ? null : v)),
            const SizedBox(height: 12),
            if (configs.isEmpty) EmptyState(icon: LucideIcons.crosshair, title: tr('Тут поки порожньо'), text: tr('Поділіться своїм прицілом чи конфігом першим.')),
            for (final c in configs) Padding(padding: const EdgeInsets.only(bottom: 10), child: _ConfigCard(config: c, onChanged: () => setState(() => _version++))),
          ],
        );
      },
    );
  }
}

class _ConfigCard extends StatefulWidget {
  const _ConfigCard({required this.config, required this.onChanged});
  final Map<String, dynamic> config;
  final VoidCallback onChanged;

  @override
  State<_ConfigCard> createState() => _ConfigCardState();
}

class _ConfigCardState extends State<_ConfigCard> {
  late bool liked = widget.config['liked'] == true;
  late int likes = (widget.config['likes'] as num?)?.toInt() ?? 0;

  Future<void> _copy() async {
    final c = widget.config;
    await Clipboard.setData(ClipboardData(text: text(c['code']) ?? ''));
    if (!mounted) return;
    toast(context, tr('Скопійовано.'));
    AppScope.read(context).session.api.post(Api.site('/configs/${c['id']}/copied')).ignore();
  }

  Future<void> _like() async {
    try {
      final r = await AppScope.read(context).session.api.post(Api.site('/configs/${widget.config['id']}/like'));
      if (mounted) {
        setState(() {
          liked = r['liked'] == true;
          likes = (r['likes'] as num?)?.toInt() ?? likes;
        });
      }
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.config;
    final game = mapOf(c['game']);
    final author = mapOf(c['author']);
    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          _tag(_kindName(text(c['kind']) ?? ''), AppColors.accentCyan),
          const SizedBox(width: 8),
          Expanded(child: FitText(text(c['title']) ?? '', style: body(15, weight: FontWeight.w600))),
        ]),
        if (text(game['name']) != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(text(game['name'])!, style: body(12, color: muted))),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(12),
          constraints: const BoxConstraints(maxHeight: 180),
          decoration: BoxDecoration(color: Colors.black.withValues(alpha: palette.isLight ? 0.05 : 0.25), borderRadius: BorderRadius.circular(12)),
          child: SingleChildScrollView(child: SelectableText(text(c['code']) ?? '', style: const TextStyle(fontFamily: 'monospace', fontSize: 13).copyWith(color: soft))),
        ),
        if (text(c['description']) != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(text(c['description'])!, style: body(13.5, color: soft))),
        const SizedBox(height: 10),
        // Кнопки переносяться на вузькому екрані чи з великим системним шрифтом.
        Row(children: [
          Expanded(
            child: Wrap(spacing: 8, runSpacing: 8, children: [
              PrimaryButton(label: tr('Копіювати'), icon: LucideIcons.copy, compact: true, expand: false, onPressed: _copy),
              GhostButton(label: '${tr('Корисно')} · $likes', icon: liked ? LucideIcons.heartHandshake : LucideIcons.heart, compact: true, expand: false, color: liked ? AppColors.accentCyan : ink, onPressed: _like),
            ]),
          ),
          if (c['mine'] == true)
            IconButton(
              tooltip: tr('Видалити'),
              icon: Icon(LucideIcons.trash2, size: 18, color: muted),
              onPressed: () async {
                if (!await confirm(context, tr('Видалити конфіг?'), danger: true)) return;
                if (!context.mounted) return;
                final ok = await attempt(context, () => AppScope.read(context).session.api.delete(Api.site('/configs/${c['id']}')));
                if (ok) widget.onChanged();
              },
            ),
        ]),
        if (c['mine'] != true && text(author['name']) != null)
          Padding(padding: const EdgeInsets.only(top: 8), child: FitText(text(author['name'])!, style: body(12, color: muted))),
      ]),
    );
  }
}

// ───────────────────────── Ігровий вечір ─────────────────────────

/// Ігрові вечори: найближчі й минулі; «Запланувати» — покликати друзів і запропонувати час і гру.
class GameNightsScreen extends StatefulWidget {
  const GameNightsScreen({super.key});

  @override
  State<GameNightsScreen> createState() => _GameNightsScreenState();
}

class _GameNightsScreenState extends State<GameNightsScreen> {
  int _version = 0;

  Future<void> _plan(List<Map<String, dynamic>> friends) async {
    if (friends.isEmpty) return toast(context, tr('Спершу додайте друзів — кликати можна лише їх.'));
    final title = TextEditingController();
    final note = TextEditingController();
    final api = AppScope.read(context).session.api;
    final now = DateTime.now();
    final times = <DateTime>[DateTime(now.year, now.month, now.day + ((5 - now.weekday + 7) % 7 == 0 ? 7 : (5 - now.weekday + 7) % 7), 20)];
    final games = <Map<String, dynamic>>[];
    final invited = <int>{};
    final path = await showGcSheet<String>(
      context,
      title: tr('Запланувати вечір'),
      subtitle: tr('Запропонуйте кілька варіантів — друзі проголосують.'),
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheet) {
          Future<void> addTime() async {
            final day = await showDatePicker(context: sheet, initialDate: times.last, firstDate: now, lastDate: now.add(const Duration(days: 120)));
            if (day == null || !sheet.mounted) return;
            final at = await showTimePicker(context: sheet, initialTime: const TimeOfDay(hour: 20, minute: 0));
            if (at == null) return;
            setSheet(() => times.add(DateTime(day.year, day.month, day.day, at.hour, at.minute)));
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              GcField(controller: title, label: tr('Назва, напр. «П’ятниця в CS»')),
              const SizedBox(height: 14),
              Text(tr('Коли (до 6 варіантів)'), style: body(13, color: muted)),
              const SizedBox(height: 6),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final (i, t) in times.indexed)
                  InputChip(
                    label: Text(_when(t.toIso8601String())),
                    onDeleted: times.length > 1 ? () => setSheet(() => times.removeAt(i)) : null,
                  ),
                if (times.length < 6) ActionChip(avatar: const Icon(LucideIcons.plus, size: 16), label: Text(tr('Час')), onPressed: addTime),
              ]),
              const SizedBox(height: 14),
              Text(tr('У що граємо (необов’язково)'), style: body(13, color: muted)),
              const SizedBox(height: 6),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final g in games) InputChip(label: Text(text(g['name']) ?? ''), onDeleted: () => setSheet(() => games.remove(g))),
                if (games.length < 6)
                  ActionChip(
                    avatar: const Icon(LucideIcons.gamepad2, size: 16),
                    label: Text(tr('Гра')),
                    onPressed: () async {
                      final g = await pickGame(sheet);
                      if (g != null && !games.any((x) => x['id'] == g['id'])) setSheet(() => games.add(g));
                    },
                  ),
              ]),
              const SizedBox(height: 14),
              Text(tr('Кого кличемо'), style: body(13, color: muted)),
              const SizedBox(height: 6),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final f in friends)
                  FilterChip(
                    avatar: Avatar(url: text(f['avatar_url']), name: text(f['name']) ?? '', size: 24),
                    label: Text(text(f['name']) ?? ''),
                    selected: invited.contains(f['id']),
                    onSelected: (on) => setSheet(() => on ? invited.add((f['id'] as num).toInt()) : invited.remove(f['id'])),
                  ),
              ]),
              const SizedBox(height: 14),
              GcField(controller: note, label: tr('Примітка: голосовий канал, режим… (необов’язково)'), maxLines: 2),
              const SizedBox(height: 14),
              PrimaryButton(
                label: tr('Покликати друзів'),
                icon: LucideIcons.send,
                onPressed: () async {
                  if (invited.isEmpty) return toast(sheet, tr('Оберіть когось із друзів.'));
                  try {
                    final r = await api.post(Api.site('/game-nights'), {
                      'title': title.text.trim(),
                      'note': note.text.trim(),
                      'friends': invited.toList(),
                      'times': [for (final t in times) t.toUtc().toIso8601String()],
                      'games': [for (final g in games) g['id']],
                    });
                    if (sheet.mounted) Navigator.pop(sheet, text(r['redirect']) ?? '');
                  } catch (e) {
                    if (sheet.mounted) toast(sheet, e);
                  }
                },
              ),
            ]),
          );
        },
      ),
    );
    title.dispose();
    note.dispose();
    if (path == null || !mounted) return;
    setState(() => _version++);
    if (path.startsWith('/game-nights/')) context.push(path);
  }

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      watch: _version,
      load: () => api.get(Api.site('/game-nights')),
      builder: (d, reload) {
        final upcoming = maps(d['upcoming']);
        final past = maps(d['past']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Ігровий вечір'), subtitle: tr('Покличте друзів, запропонуйте час і гру — оберіть те, що зручно всім.')),
            PrimaryButton(label: tr('Запланувати'), icon: LucideIcons.plus, onPressed: () => _plan(maps(d['friends']))),
            const SizedBox(height: 14),
            if (upcoming.isEmpty) EmptyState(icon: LucideIcons.calendarClock, title: tr('Поки нічого не заплановано'), text: tr('Створіть вечір — друзі проголосують за час і гру.')),
            for (final n in upcoming) _NightTile(night: n),
            if (past.isNotEmpty) ...[
              const SizedBox(height: 8),
              SectionLabel(tr('Минулі')),
              for (final n in past) _NightTile(night: n),
            ],
          ],
        );
      },
    );
  }
}

class _NightTile extends StatelessWidget {
  const _NightTile({required this.night});
  final Map<String, dynamic> night;

  @override
  Widget build(BuildContext context) {
    final set = night['status'] == 'set';
    final game = mapOf(night['game']);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Glass(
        onTap: () => context.push('/game-nights/${night['id']}'),
        child: Row(children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: AppColors.accentPrimary.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(14)),
            child: Icon(set ? LucideIcons.calendarCheck : LucideIcons.calendarClock, color: AppColors.accentCyan, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              FitText(text(night['title']) ?? '', style: body(15, weight: FontWeight.w600)),
              const SizedBox(height: 2),
              FitText([set ? _when(text(night['starts_at'])) : tr('Голосування за час'), ?text(game['name'])].join(' · '), style: body(12.5, color: muted)),
            ]),
          ),
          Icon(LucideIcons.users, size: 15, color: muted),
          const SizedBox(width: 4),
          Text('${((night['members_count'] as num?)?.toInt() ?? 0) + 1}', style: body(12.5, color: muted)),
        ]),
      ),
    );
  }
}

/// Сторінка вечора: голоси за час і гру, «Буду / Не зможу»; організатор призначає чи скасовує.
class GameNightScreen extends StatefulWidget {
  const GameNightScreen({required this.id, super.key});
  final int id;

  @override
  State<GameNightScreen> createState() => _GameNightScreenState();
}

class _GameNightScreenState extends State<GameNightScreen> {
  int? time;
  int? game;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/game-nights/${widget.id}')),
      builder: (d, reload) {
        final night = mapOf(d['night']);
        final planning = night['status'] == 'planning';
        final host = night['is_host'] == true;
        final times = maps(night['times']);
        final games = maps(night['games']);
        int? best(List<Map<String, dynamic>> list) => list.isEmpty ? null : ((list.toList()..sort((a, b) => ((b['votes'] as num?) ?? 0).compareTo((a['votes'] as num?) ?? 0))).first['id'] as num).toInt();
        final pickedTime = time ?? best(times);
        final pickedGame = game ?? best(games);
        Future<void> act(Future<dynamic> Function() call, {String? success}) async {
          if (await attempt(context, call, success: success)) await reload();
        }

        Widget options(String title, List<Map<String, dynamic>> list, IconData icon, int? picked, ValueChanged<int> pick) {
          final most = list.fold<int>(1, (m, o) => ((o['votes'] as num?)?.toInt() ?? 0) > m ? (o['votes'] as num).toInt() : m);
          return Glass(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(title, style: body(13, color: muted, weight: FontWeight.w500)),
              const SizedBox(height: 8),
              for (final o in list)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Stack(children: [
                      Positioned.fill(
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: (((o['votes'] as num?) ?? 0) / most).clamp(0, 1).toDouble(),
                          child: ColoredBox(color: AppColors.accentPrimary.withValues(alpha: 0.16)),
                        ),
                      ),
                      Container(
                        color: fg.withValues(alpha: 0.04),
                        padding: const EdgeInsets.fromLTRB(12, 8, 6, 8),
                        child: Row(children: [
                          Icon(icon, size: 16, color: AppColors.accentCyan),
                          const SizedBox(width: 10),
                          Expanded(child: Text(text(o['starts_at']) != null ? _when(text(o['starts_at'])) : text(mapOf(o['game'])['name']) ?? '', style: body(14))),
                          Text('${o['votes']}', style: body(14, weight: FontWeight.w700)),
                          if (planning) ...[
                            const SizedBox(width: 8),
                            ArcticPressable(
                              onTap: () => act(() => api.post(Api.site('/game-nights/${widget.id}/options/${o['id']}/vote'))),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(color: o['voted'] == true ? primary : fg.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(10)),
                                child: Text(o['voted'] == true ? tr('Мій голос') : tr('Підходить'), style: body(12, color: o['voted'] == true ? Colors.white : soft, weight: FontWeight.w600)),
                              ),
                            ),
                          ],
                          if (planning && host)
                            IconButton(
                              tooltip: tr('Обрати для призначення'),
                              onPressed: () => pick((o['id'] as num).toInt()),
                              icon: Icon(picked == o['id'] ? LucideIcons.circleCheck : LucideIcons.circle, size: 20, color: picked == o['id'] ? AppColors.accentCyan : muted),
                            ),
                        ]),
                      ),
                    ]),
                  ),
                ),
            ]),
          );
        }

        final status = text(night['my_status']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(text(night['title']) ?? tr('Ігровий вечір'), subtitle: tr('Організатор — {name}', {'name': text(mapOf(night['host'])['name']) ?? ''})),
            if (!planning && text(night['starts_at']) != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Glass(
                  child: Row(children: [
                    Icon(LucideIcons.calendarCheck, color: green),
                    const SizedBox(width: 10),
                    Expanded(child: Text([_when(text(night['starts_at'])), ?text(mapOf(night['game'])['name'])].join(' · '), style: body(15, color: green, weight: FontWeight.w600))),
                  ]),
                ),
              ),
            if (text(night['note']) != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: Glass(child: Text(text(night['note'])!, style: body(14, color: soft)))),
            if (status != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(children: [
                  Expanded(
                    child: status == 'going'
                        ? PrimaryButton(label: tr('Буду'), icon: LucideIcons.check, onPressed: null)
                        : GhostButton(label: tr('Буду'), icon: LucideIcons.check, onPressed: () => act(() => api.post(Api.site('/game-nights/${widget.id}/respond'), {'status': 'going'}))),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: GhostButton(
                      label: status == 'declined' ? tr('Не зможу ✓') : tr('Не зможу'),
                      icon: LucideIcons.x,
                      onPressed: status == 'declined' ? null : () => act(() => api.post(Api.site('/game-nights/${widget.id}/respond'), {'status': 'declined'})),
                    ),
                  ),
                ]),
              ),
            options(tr('Коли'), times, LucideIcons.calendarClock, pickedTime, (v) => setState(() => time = v)),
            if (games.isNotEmpty) ...[const SizedBox(height: 10), options(tr('У що граємо'), games, LucideIcons.gamepad2, pickedGame, (v) => setState(() => game = v))],
            if (planning && host) ...[
              const SizedBox(height: 12),
              PrimaryButton(
                label: tr('Призначити вечір'),
                icon: LucideIcons.calendarCheck,
                onPressed: pickedTime == null ? null : () => act(() => api.post(Api.site('/game-nights/${widget.id}/finalize'), {'time': pickedTime, 'game': ?pickedGame}), success: tr('Вечір призначено — друзі отримали сповіщення.')),
              ),
              const SizedBox(height: 8),
              GhostButton(
                label: tr('Скасувати вечір'),
                color: dangerSoft,
                onPressed: () async {
                  if (!await confirm(context, tr('Скасувати вечір?'), danger: true)) return;
                  if (!context.mounted) return;
                  if (await attempt(context, () => api.delete(Api.site('/game-nights/${widget.id}'))) && context.mounted) context.pop();
                },
              ),
            ],
            const SizedBox(height: 12),
            SectionLabel(tr('Хто йде')),
            for (final m in maps(night['members']))
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Avatar(url: text(m['avatar_url']), name: text(m['name']) ?? '', size: 36),
                title: Text(text(m['name']) ?? '', style: body(14.5)),
                trailing: switch (text(m['status'])) {
                  'going' => _tag(tr('Буде'), green),
                  'declined' => _tag(tr('Не зможе'), muted),
                  _ => _tag(tr('Ще не відповів'), AppColors.accentCyan),
                },
              ),
          ],
        );
      },
    );
  }
}
