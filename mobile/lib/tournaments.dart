import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// Турніри й челенджі серверів — як на сайті (/tournaments, App\Services\Servers\Tournaments):
// сітка на вибування й челендж із таблицею результатів. Створює турнір власник сервера на сайті;
// тут — реєстрація, сітка, таблиця, надсилання результату й керування для організатора.

String tournamentStatus(String? status) => switch (status) {
      'open' => tr('Реєстрація'),
      'running' => tr('Триває'),
      'finished' => tr('Завершено'),
      _ => tr('Скасовано'),
    };

String _when(dynamic iso) {
  final raw = text(iso);
  final dt = raw == null ? null : DateTime.tryParse(raw)?.toLocal();
  if (dt == null) return '';
  return '${dt.day} ${monthsGenitive[dt.month - 1]}, ${clock(raw)}';
}

String _number(dynamic value) {
  final n = value is num ? value : num.tryParse('$value') ?? 0;
  return n == n.roundToDouble() ? n.toInt().toString() : n.toStringAsFixed(2).replaceFirst(RegExp(r'0$'), '');
}

class TournamentStatusPill extends StatelessWidget {
  const TournamentStatusPill({required this.status, super.key});
  final String? status;

  @override
  Widget build(BuildContext context) {
    final live = status == 'running';
    final open = status == 'open';
    return Pill(label: tournamentStatus(status), color: live ? primary : (open ? soft : muted));
  }
}

/// Рядок турніру в списку (сторінка сервера й розділ «Турніри»).
class TournamentTile extends StatelessWidget {
  const TournamentTile({required this.tournament, this.showServer = true, super.key});
  final Map<String, dynamic> tournament;
  final bool showServer;

  @override
  Widget build(BuildContext context) {
    final bracket = tournament['kind'] == 'bracket';
    final server = mapOf(tournament['server']);
    final count = bracket ? '${tournament['entries_count'] ?? 0}/${tournament['size'] ?? 0}' : '${tournament['entries_count'] ?? 0}';
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: () => context.push('/tournaments/${tournament['id']}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 9),
        child: Row(children: [
          if (showServer)
            Avatar(url: text(server['icon']), name: text(server['name']) ?? '?', size: 40, square: true)
          else
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: fg.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(10)),
              child: Icon(bracket ? LucideIcons.trophy : LucideIcons.gauge, size: 19, color: soft),
            ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(text(tournament['title']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14.5, weight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text(
                [if (showServer) text(server['name']), bracket ? tr('Сітка') : tr('Челендж'), _when(tournament['starts_at'])].whereType<String>().join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: body(12, color: muted),
              ),
            ]),
          ),
          const SizedBox(width: 8),
          Icon(LucideIcons.usersRound, size: 13, color: muted),
          const SizedBox(width: 3),
          Text(count, style: body(12, color: muted)),
          const SizedBox(width: 8),
          TournamentStatusPill(status: text(tournament['status'])),
        ]),
      ),
    );
  }
}

/// Розділ «Турніри»: активні й завершені.
class TournamentsScreen extends StatefulWidget {
  const TournamentsScreen({super.key});

  @override
  State<TournamentsScreen> createState() => _TournamentsScreenState();
}

class _TournamentsScreenState extends State<TournamentsScreen> {
  String status = 'active';

  @override
  Widget build(BuildContext context) {
    final api = AppScope.of(context).session.api;
    return Remote(
      watch: status,
      load: () => api.get(Api.site(status == 'finished' ? '/tournaments?status=finished' : '/tournaments')),
      builder: (data, reload) {
        final list = maps(data['tournaments']);
        return ScreenScroll(onRefresh: reload, children: [
          PageTitle(tr('Турніри'), subtitle: tr('Сітки на вибування й челенджі серверів.')),
          const SizedBox(height: 14),
          Segmented(
            selected: status,
            options: [SegmentOption('active', tr('Активні')), SegmentOption('finished', tr('Завершені'))],
            onSelect: (v) => setState(() => status = v),
          ),
          const SizedBox(height: 14),
          if (list.isEmpty)
            EmptyState(
              icon: LucideIcons.trophy,
              title: status == 'active' ? tr('Зараз турнірів немає') : tr('Завершених турнірів ще немає'),
              text: tr('Коли сервер оголосить турнір чи челендж, він з’явиться тут.'),
            )
          else
            Glass(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              radius: 12,
              child: Column(children: [for (final t in list) TournamentTile(tournament: t)]),
            ),
        ]);
      },
    );
  }
}

/// Сторінка турніру.
class TournamentScreen extends StatelessWidget {
  const TournamentScreen({required this.id, super.key});
  final int id;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.of(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/tournaments/$id')),
      builder: (data, reload) => TournamentView(data: data, api: api, reload: reload),
    );
  }
}

class TournamentView extends StatelessWidget {
  const TournamentView({required this.data, required this.api, required this.reload, super.key});
  final Map<String, dynamic> data;
  final Api api;
  final Future<void> Function() reload;

  Future<void> _act(BuildContext context, Future<dynamic> Function() action, {String? success}) async {
    if (await attempt(context, action, success: success)) await reload();
  }

  @override
  Widget build(BuildContext context) {
    final t = mapOf(data['tournament']);
    final id = t['id'];
    final me = mapOf(data['me']);
    final entries = maps(data['entries']);
    final rounds = data['rounds'] is List ? [for (final r in data['rounds'] as List) maps(r)] : <List<Map<String, dynamic>>>[];
    final leaderboard = maps(data['leaderboard']);
    final winner = data['winner'] is Map ? mapOf(data['winner']) : null;
    final families = maps(me['families']);
    final bracket = t['kind'] == 'bracket';
    final status = text(t['status']);
    final open = status == 'open';
    final running = status == 'running';
    final manage = me['can_manage'] == true;
    final joined = me['entry_id'] != null;
    final full = bracket && entries.length >= intOf(t['size']);
    final canJoin = !joined && (open || (!bracket && running)) && !full && (t['entry'] != 'family' || families.isNotEmpty);
    final server = mapOf(t['server']);

    return ScreenScroll(onRefresh: reload, children: [
      Row(children: [
        RoundIcon(icon: LucideIcons.arrowLeft, onTap: () => context.canPop() ? context.pop() : context.go('/servers/${server['slug']}')),
        const SizedBox(width: 8),
        Expanded(child: Text(text(server['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, color: muted))),
      ]),
      const SizedBox(height: 14),
      Wrap(spacing: 8, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
        TournamentStatusPill(status: status),
        Text(
          bracket ? (t['entry'] == 'family' ? tr('Сітка сімей') : tr('Сітка гравців')) : tr('Челендж · {metric}', {'metric': text(t['metric']) ?? ''}),
          style: body(13, color: muted),
        ),
      ]),
      const SizedBox(height: 4),
      Text(text(t['ends_at']) != null ? '${_when(t['starts_at'])} — ${_when(t['ends_at'])}' : _when(t['starts_at']), style: body(13, color: muted)),
      const SizedBox(height: 8),
      Text(text(t['title']) ?? '', style: display(26)),
      const SizedBox(height: 8),
      Wrap(spacing: 14, runSpacing: 4, children: [
        _Meta(icon: LucideIcons.usersRound, label: bracket ? tr('{n} з {max} учасників', {'n': entries.length, 'max': t['size']}) : tr('Учасників: {n}', {'n': entries.length})),
        if (text(t['prize']) != null) _Meta(icon: LucideIcons.gift, label: text(t['prize'])!),
        if (t['organizer'] is Map) _Meta(icon: LucideIcons.user, label: tr('Організатор: {name}', {'name': text(mapOf(t['organizer'])['name']) ?? ''})),
      ]),
      if (text(t['description']) != null) ...[
        const SizedBox(height: 10),
        Text(text(t['description'])!, style: body(14, color: soft).copyWith(height: 1.45)),
      ],
      const SizedBox(height: 14),
      if (canJoin)
        PrimaryButton(
          label: t['entry'] == 'family' ? tr('Записати сім’ю') : tr('Взяти участь'),
          icon: LucideIcons.flag,
          onPressed: () async {
            int? family;
            if (t['entry'] == 'family') {
              family = families.length == 1 ? intOf(families.first['id']) : await _pickFamily(context, families);
              if (family == null) return;
            }
            if (!context.mounted) return;
            await _act(context, () => api.post(Api.site('/tournaments/$id/join'), {'family_id': family}), success: tr('Ви в турнірі.'));
          },
        ),
      if (joined && open)
        GhostButton(label: tr('Вийти з турніру'), icon: LucideIcons.logOut, onPressed: () => _act(context, () => api.delete(Api.site('/tournaments/$id/join')))),
      if (manage && (open || running)) ...[
        const SizedBox(height: 8),
        Row(children: [
          if (open)
            Expanded(
              child: GhostButton(
                label: bracket ? tr('Запустити') : tr('Відкрити челендж'),
                icon: LucideIcons.play,
                compact: true,
                onPressed: () => _act(context, () => api.post(Api.site('/tournaments/$id/start')), success: tr('Турнір запущено.')),
              ),
            ),
          if (running && !bracket)
            Expanded(
              child: GhostButton(label: tr('Завершити челендж'), icon: LucideIcons.flag, compact: true, onPressed: () => _act(context, () => api.post(Api.site('/tournaments/$id/finish')))),
            ),
          const SizedBox(width: 8),
          GhostButton(
            label: tr('Скасувати'),
            compact: true,
            expand: false,
            color: dangerSoft,
            onPressed: () async {
              if (await confirm(context, tr('Скасувати турнір?'), text: tr('Учасники отримають сповіщення.'), action: tr('Скасувати турнір'), danger: true) && context.mounted) {
                await _act(context, () => api.delete(Api.site('/tournaments/$id')));
              }
            },
          ),
        ]),
      ],
      if (winner != null) ...[
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12), border: Border.all(color: primary.withValues(alpha: 0.25))),
          child: Row(children: [
            Icon(LucideIcons.trophy, color: primary, size: 26),
            const SizedBox(width: 12),
            Avatar(url: text(winner['avatar']), name: text(winner['name']) ?? '?', size: 40, square: winner['family'] == true),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr('Переможець'), style: body(12, color: muted)),
                Text(text(winner['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: display(18)),
              ]),
            ),
          ]),
        ),
      ],
      if (bracket && rounds.isNotEmpty) ...[
        SectionLabel(tr('Сітка')),
        if (manage && running) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(tr('Торкніться матчу, щоб внести переможця.'), style: body(12, color: muted))),
        TournamentBracket(rounds: rounds, onPick: manage ? (match) => _report(context, id, match) : null),
      ],
      if (bracket && rounds.isEmpty) ...[
        SectionLabel(tr('Учасники')),
        if (entries.isEmpty)
          QuietEmpty(icon: LucideIcons.usersRound, text: tr('Поки ніхто не записався — будьте першими.'))
        else
          Glass(
            radius: 12,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Column(children: [for (final e in entries) _EntryRow(entry: e)]),
          ),
      ],
      if (!bracket) ...[
        SectionLabel(tr('Таблиця')),
        Text(t['lower_is_better'] == true ? tr('Найкращий — найменший результат') : tr('Найкращий — найбільший результат'), style: body(12, color: muted)),
        const SizedBox(height: 8),
        if (leaderboard.isEmpty)
          QuietEmpty(icon: LucideIcons.listOrdered, text: tr('Тут з’являться результати після перевірки організатором.'))
        else
          Glass(
            radius: 12,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Column(children: [
              for (final row in leaderboard)
                _EntryRow(
                  entry: mapOf(row['entry']),
                  place: intOf(row['place']),
                  trailing: _number(row['value']),
                  mine: mapOf(row['entry'])['id'] == me['entry_id'],
                ),
            ]),
          ),
        if (running) ...[
          const SizedBox(height: 12),
          PrimaryButton(label: tr('Надіслати результат'), icon: LucideIcons.upload, onPressed: () => _submit(context, id, text(t['metric']))),
        ],
        if (maps(me['submissions']).isNotEmpty) ...[
          SectionLabel(tr('Мої результати')),
          Glass(
            radius: 12,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            child: Column(children: [
              for (final s in maps(me['submissions']))
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(children: [
                    Text(_number(s['value']), style: body(14, weight: FontWeight.w700)),
                    const SizedBox(width: 10),
                    Expanded(child: Text(_when(s['created_at']), style: body(12, color: muted))),
                    Text(
                      switch (s['status']) { 'approved' => tr('Зараховано'), 'rejected' => tr('Відхилено'), _ => tr('На перевірці') },
                      style: body(12, color: s['status'] == 'approved' ? primary : (s['status'] == 'rejected' ? dangerSoft : muted)),
                    ),
                  ]),
                ),
            ]),
          ),
        ],
      ],
      if (manage && maps(data['pending']).isNotEmpty) ...[
        SectionLabel(tr('На перевірці: {n}', {'n': maps(data['pending']).length})),
        Glass(
          radius: 12,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Column(children: [
            for (final s in maps(data['pending']))
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(children: [
                  if (text(s['proof_url']) != null)
                    GestureDetector(
                      onTap: () => _proof(context, text(s['proof_url'])!),
                      child: ClipRRect(borderRadius: BorderRadius.circular(8), child: NetImage(text(s['proof_url']), width: 64, height: 44)),
                    )
                  else
                    Container(width: 64, height: 44, alignment: Alignment.center, decoration: BoxDecoration(color: fg.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(8)), child: Icon(LucideIcons.imageOff, size: 16, color: muted)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(text(mapOf(s['entry'])['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(13.5, weight: FontWeight.w600)),
                      Text(_number(s['value']), style: body(13, weight: FontWeight.w700)),
                      if (text(s['note']) != null) Text(text(s['note'])!, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
                    ]),
                  ),
                  RoundIcon(icon: LucideIcons.check, onTap: () => _act(context, () => api.post(Api.site('/tournaments/$id/submissions/${s['id']}'), {'approve': true}))),
                  const SizedBox(width: 6),
                  RoundIcon(icon: LucideIcons.x, onTap: () => _act(context, () => api.post(Api.site('/tournaments/$id/submissions/${s['id']}'), {'approve': false}))),
                ]),
              ),
          ]),
        ),
      ],
    ]);
  }

  Future<int?> _pickFamily(BuildContext context, List<Map<String, dynamic>> families) {
    return showGcSheet<int>(
      context,
      title: tr('Яку сім’ю записати?'),
      builder: (sheet) => Column(mainAxisSize: MainAxisSize.min, children: [
        for (final f in families)
          ListTile(
            leading: const Icon(LucideIcons.crown),
            title: Text(text(f['name']) ?? '', style: body(15, weight: FontWeight.w600)),
            onTap: () => Navigator.pop(sheet, intOf(f['id'])),
          ),
      ]),
    );
  }

  Future<void> _report(BuildContext context, dynamic id, Map<String, dynamic> match) async {
    final a = match['a'] is Map ? mapOf(match['a']) : null;
    final b = match['b'] is Map ? mapOf(match['b']) : null;
    if (a == null || b == null) return;
    final score = TextEditingController(text: text(match['score']) ?? '');
    final winner = await showGcSheet<int>(
      context,
      title: tr('Хто переміг?'),
      builder: (sheet) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        GcField(controller: score, label: tr('Рахунок, наприклад 2:1 (необов’язково)')),
        const SizedBox(height: 12),
        for (final e in [a, b]) ...[
          GhostButton(label: text(e['name']) ?? '', icon: LucideIcons.crown, onPressed: () => Navigator.pop(sheet, intOf(e['id']))),
          const SizedBox(height: 8),
        ],
      ]),
    );
    if (winner == null || !context.mounted) return;
    await _act(context, () => api.post(Api.site('/tournaments/$id/matches/${match['id']}'), {'winner_id': winner, 'score': score.text.trim().isEmpty ? null : score.text.trim()}));
  }

  Future<void> _submit(BuildContext context, dynamic id, String? metric) async {
    final value = TextEditingController();
    final note = TextEditingController();
    XFile? proof;
    final ok = await showGcSheet<bool>(
      context,
      title: tr('Надіслати результат'),
      subtitle: tr('Організатор перевірить і зарахує результат.'),
      builder: (sheet) => StatefulBuilder(
        builder: (context, set) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          GcField(controller: value, label: metric ?? tr('Результат'), keyboard: const TextInputType.numberWithOptions(decimal: true)),
          const SizedBox(height: 10),
          GcField(controller: note, label: tr('Коментар для організатора (необов’язково)')),
          const SizedBox(height: 10),
          GhostButton(
            label: proof == null ? tr('Скриншот-доказ') : tr('Скриншот додано'),
            icon: LucideIcons.image,
            onPressed: () async {
              final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 88);
              if (picked != null) set(() => proof = picked);
            },
          ),
          const SizedBox(height: 14),
          PrimaryButton(label: tr('Надіслати'), icon: LucideIcons.send, onPressed: () => Navigator.pop(sheet, true)),
        ]),
      ),
    );
    final number = double.tryParse(value.text.trim().replaceAll(',', '.'));
    if (ok != true || !context.mounted) return;
    if (number == null) {
      toast(context, tr('Вкажіть результат числом.'), kind: ToastKind.error);
      return;
    }
    final files = [if (proof != null) await http.MultipartFile.fromPath('proof', proof!.path, filename: proof!.name)];
    if (!context.mounted) return;
    await _act(
      context,
      () => api.upload(Api.site('/tournaments/$id/submissions'), {'value': '$number', if (note.text.trim().isNotEmpty) 'note': note.text.trim()}, files),
      success: tr('Результат надіслано на перевірку.'),
    );
  }

  void _proof(BuildContext context, String url) {
    showDialog<void>(
      context: context,
      builder: (dialog) => GestureDetector(onTap: () => Navigator.pop(dialog), child: InteractiveViewer(child: NetImage(url, fit: BoxFit.contain))),
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 14, color: muted),
      const SizedBox(width: 5),
      Flexible(child: Text(label, style: body(13, color: soft))),
    ]);
  }
}

class _EntryRow extends StatelessWidget {
  const _EntryRow({required this.entry, this.place, this.trailing, this.mine = false});
  final Map<String, dynamic> entry;
  final int? place;
  final String? trailing;
  final bool mine;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(children: [
        if (place != null) SizedBox(width: 26, child: Text('$place', style: body(13, weight: FontWeight.w800, color: place! <= 3 ? ink : muted))),
        Avatar(url: text(entry['avatar']), name: text(entry['name']) ?? '?', size: 32, square: entry['family'] == true),
        const SizedBox(width: 10),
        Expanded(child: Text(text(entry['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, weight: FontWeight.w600, color: mine ? primary : null))),
        if (trailing != null) Text(trailing!, style: body(14, weight: FontWeight.w700)),
      ]),
    );
  }
}

/// Сітка на вибування: раунди колонками, гортається вбік.
class TournamentBracket extends StatelessWidget {
  const TournamentBracket({required this.rounds, this.onPick, super.key});
  final List<List<Map<String, dynamic>>> rounds;
  final void Function(Map<String, dynamic> match)? onPick;

  String _name(int index) {
    final left = rounds.length - index;
    if (left == 1) return tr('Фінал');
    if (left == 2) return tr('Півфінал');
    if (left == 3) return tr('Чвертьфінал');
    return tr('Раунд {n}', {'n': index + 1});
  }

  @override
  Widget build(BuildContext context) {
    const matchHeight = 76.0;
    const gap = 10.0;
    final first = rounds.isEmpty ? 0 : rounds.first.length;
    final height = first * matchHeight + (first - 1).clamp(0, 999) * gap + 26;
    return SizedBox(
      height: height,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: rounds.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (context, i) => SizedBox(
          width: 190,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(height: 22, child: Text(_name(i), style: body(12, color: muted))),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [for (final m in rounds[i]) _MatchBox(match: m, height: matchHeight, onTap: onPick == null ? null : () => onPick!(m))],
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

class _MatchBox extends StatelessWidget {
  const _MatchBox({required this.match, required this.height, this.onTap});
  final Map<String, dynamic> match;
  final double height;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final a = match['a'] is Map ? mapOf(match['a']) : null;
    final b = match['b'] is Map ? mapOf(match['b']) : null;
    final ready = a != null && b != null;
    final winner = match['winner_id'];
    Widget side(Map<String, dynamic>? e) {
      final won = e != null && e['id'] == winner;
      return SizedBox(
        height: height / 2,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 9),
          child: Row(children: [
            if (e != null) ...[
              Avatar(url: text(e['avatar']), name: text(e['name']) ?? '?', size: 20, square: e['family'] == true),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  text(e['name']) ?? '',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: body(13, weight: won ? FontWeight.w700 : FontWeight.w500, color: winner != null && !won ? muted : ink),
                ),
              ),
              if (won && text(match['score']) != null) Text(text(match['score'])!, style: body(11, color: muted)),
              if (won) ...[const SizedBox(width: 4), Icon(LucideIcons.check, size: 13, color: primary)],
            ] else
              Expanded(child: Text(intOf(match['round']) == 1 || (winner != null && !ready) ? tr('Вільний прохід') : tr('Очікується'), style: body(12.5, color: muted))),
          ]),
        ),
      );
    }

    return GestureDetector(
      onTap: ready ? onTap : null,
      child: Container(
        height: height,
        decoration: BoxDecoration(
          color: fg.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: ready && winner == null ? primary.withValues(alpha: 0.35) : fg.withValues(alpha: 0.07)),
        ),
        child: Column(children: [side(a), Divider(height: 1, color: fg.withValues(alpha: 0.06)), Expanded(child: side(b))]),
      ),
    );
  }
}
