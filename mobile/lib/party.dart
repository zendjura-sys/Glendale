import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'teammates.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'voice_room.dart';
import 'widgets.dart';

Map<String, String> partyPlatforms() => {'pc': tr('ПК'), 'playstation': 'PlayStation', 'xbox': 'Xbox', 'switch': 'Switch', 'mobile': tr('Мобільні')};

/// «Зараз» або «12.10 · 20:00».
String partyWhen(dynamic startsAt) {
  final at = DateTime.tryParse(text(startsAt) ?? '')?.toLocal();
  if (at == null || !at.isAfter(DateTime.now())) return tr('Зараз');
  final now = DateTime.now();
  String two(int n) => n.toString().padLeft(2, '0');
  final time = '${two(at.hour)}:${two(at.minute)}';
  if (at.year == now.year && at.month == now.month && at.day == now.day) return '${tr('Сьогодні')} · $time';
  return '${two(at.day)}.${two(at.month)} · $time';
}

class PartyBoardScreen extends StatefulWidget {
  const PartyBoardScreen({super.key});

  @override
  State<PartyBoardScreen> createState() => _PartyBoardScreenState();
}

class _PartyBoardScreenState extends State<PartyBoardScreen> {
  Map<String, dynamic>? page;
  String game = '';
  String server = '';
  String platform = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final api = AppScope.read(context).session.api;
    final query = Uri(queryParameters: {if (game.isNotEmpty) 'game': game, if (server.isNotEmpty) 'server': server, if (platform.isNotEmpty) 'platform': platform}).query;
    try {
      final data = await api.get(Api.site('/party${query.isEmpty ? '' : '?$query'}'));
      if (mounted) setState(() => page = data);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _create() async {
    final options = mapOf(page?['options']);
    final id = await showGcSheet<int>(
      context,
      title: tr('Шукаю паті'),
      subtitle: tr('Оголошення зникне через 3 години після старту.'),
      builder: (sheet) => _PartyForm(options: options, onDone: (id) => Navigator.pop(sheet, id)),
    );
    await _load();
    if (id != null && mounted) context.push('/party/$id');
  }

  @override
  Widget build(BuildContext context) {
    final data = page;
    if (data == null) return const Center(child: CircularProgressIndicator(strokeWidth: 2.4));
    final options = mapOf(data['options']);
    final parties = maps(data['parties']);
    return ScreenScroll(
      onRefresh: _load,
      children: [
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(tr('Пошук паті'), style: display(22)),
            const SizedBox(height: 4),
            Text(tr('Знайдіть, з ким зіграти: гра, сервер, час і ролі. У кожної паті — своя голосова кімната.'), style: body(13, color: muted)),
            const SizedBox(height: 12),
            GcSelect<String>(
              value: game,
              expand: true,
              items: [('', tr('Усі ігри')), for (final g in maps(options['games'])) ('${g['slug']}', '${g['name']}')],
              onChanged: (value) {
                setState(() => game = value ?? '');
                _load();
              },
            ),
            const SizedBox(height: 8),
            GcSelect<String>(
              value: server,
              expand: true,
              items: [('', tr('Усі сервери')), for (final s in maps(options['servers'])) ('${s['slug']}', '${s['name']}')],
              onChanged: (value) {
                setState(() => server = value ?? '');
                _load();
              },
            ),
            const SizedBox(height: 8),
            GcSelect<String>(
              value: platform,
              expand: true,
              items: [('', tr('Усі платформи')), for (final e in partyPlatforms().entries) (e.key, e.value)],
              onChanged: (value) {
                setState(() => platform = value ?? '');
                _load();
              },
            ),
            const SizedBox(height: 12),
            PrimaryButton(label: tr('Шукаю паті'), icon: LucideIcons.plus, onPressed: _create),
            const SizedBox(height: 8),
            GhostButton(label: tr('Підбір тиммейтів'), icon: LucideIcons.radar, onPressed: () => context.push('/party/match')),
          ]),
        ),
        const SizedBox(height: 12),
        if (parties.isEmpty)
          EmptyState(icon: LucideIcons.userRoundSearch, title: tr('Поки ніхто не шукає'), text: tr('Створіть оголошення першим — друзі й гравці побачать його тут.'))
        else
          for (final party in parties) Padding(padding: const EdgeInsets.only(bottom: 10), child: PartyCard(party: party)),
      ],
    );
  }
}

class PartyCard extends StatelessWidget {
  const PartyCard({required this.party, super.key});
  final Map<String, dynamic> party;

  @override
  Widget build(BuildContext context) {
    final host = mapOf(party['host']);
    final game = mapOf(party['game']);
    final server = mapOf(party['server']);
    final roles = (party['roles'] as List? ?? const []).whereType<String>().toList();
    final taken = (party['taken_roles'] as List? ?? const []).whereType<String>().toSet();
    final full = intOf(party['count']) >= intOf(party['slots']);
    return GestureDetector(
      onTap: () => context.push('/party/${party['id']}'),
      child: Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Avatar(url: text(host['avatar_url']), name: text(host['name']) ?? '?', size: 42),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(text(party['title']) ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(15, weight: FontWeight.w700)),
                Text(text(host['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
              ]),
            ),
            Pill(label: '${party['count']}/${party['slots']}', icon: LucideIcons.users, color: full ? muted : green),
          ]),
          const SizedBox(height: 10),
          Wrap(spacing: 6, runSpacing: 6, children: [
            Pill(label: partyWhen(party['starts_at']), icon: LucideIcons.clock3, color: const Color(0xFFC4B5FD)),
            if (game.isNotEmpty) Pill(label: text(game['name']) ?? '', icon: LucideIcons.gamepad2),
            if (server.isNotEmpty) Pill(label: text(server['name']) ?? '', icon: LucideIcons.server),
            if (text(party['platform']) != null) Pill(label: partyPlatforms()[party['platform']] ?? '${party['platform']}'),
          ]),
          if (text(party['note']) != null) ...[
            const SizedBox(height: 8),
            Text(text(party['note'])!, maxLines: 2, overflow: TextOverflow.ellipsis, style: body(13, color: soft)),
          ],
          if (roles.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final role in roles)
                Text(
                  role,
                  style: body(12.5, color: taken.contains(role) ? faint : gold).copyWith(decoration: taken.contains(role) ? TextDecoration.lineThrough : null),
                ),
            ]),
          ],
        ]),
      ),
    );
  }
}

class _PartyForm extends StatefulWidget {
  const _PartyForm({required this.options, required this.onDone});
  final Map<String, dynamic> options;
  final ValueChanged<int?> onDone;

  @override
  State<_PartyForm> createState() => _PartyFormState();
}

class _PartyFormState extends State<_PartyForm> {
  final title = TextEditingController();
  final note = TextEditingController();
  final role = TextEditingController();
  String game = '';
  String server = '';
  String platform = '';
  int slots = 4;
  DateTime? startsAt;
  final roles = <String>[];
  bool saving = false;

  @override
  void dispose() {
    title.dispose();
    note.dispose();
    role.dispose();
    super.dispose();
  }

  void _addRole() {
    final value = role.text.trim();
    if (value.isEmpty || roles.contains(value) || roles.length >= 5) return;
    setState(() {
      roles.add(value);
      role.clear();
    });
  }

  Future<void> _pickTime() async {
    final now = DateTime.now();
    final date = await showDatePicker(context: context, firstDate: now, lastDate: now.add(const Duration(days: 6)), initialDate: startsAt ?? now);
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(startsAt ?? now.add(const Duration(hours: 1))));
    if (time == null) return;
    setState(() => startsAt = DateTime(date.year, date.month, date.day, time.hour, time.minute));
  }

  Future<void> _save() async {
    if (title.text.trim().isEmpty) return;
    setState(() => saving = true);
    try {
      final result = await AppScope.read(context).session.api.post(Api.site('/party'), {
        'title': title.text.trim(),
        'note': note.text.trim(),
        'game': game.isEmpty ? null : game,
        'server': server.isEmpty ? null : server,
        'platform': platform.isEmpty ? null : platform,
        'roles': roles,
        'slots': slots,
        'starts_at': startsAt?.toUtc().toIso8601String(),
      });
      final redirect = text(result['redirect']) ?? '';
      widget.onDone(int.tryParse(redirect.split('/').last));
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      GcField(controller: title, label: tr('Наприклад, рейд на склад, потрібен снайпер')),
      const SizedBox(height: 10),
      GcSelect<String>(
        value: game,
        expand: true,
        items: [('', tr('Гра (необов’язково)')), for (final g in maps(widget.options['games'])) ('${g['slug']}', '${g['name']}')],
        onChanged: (value) => setState(() => game = value ?? ''),
      ),
      const SizedBox(height: 8),
      GcSelect<String>(
        value: server,
        expand: true,
        items: [('', tr('Сервер (необов’язково)')), for (final s in maps(widget.options['servers'])) ('${s['slug']}', '${s['name']}')],
        onChanged: (value) => setState(() => server = value ?? ''),
      ),
      const SizedBox(height: 8),
      GcSelect<String>(
        value: platform,
        expand: true,
        items: [('', tr('Будь-яка платформа')), for (final e in partyPlatforms().entries) (e.key, e.value)],
        onChanged: (value) => setState(() => platform = value ?? ''),
      ),
      const SizedBox(height: 10),
      Row(children: [
        Expanded(child: Text(tr('Гравців'), style: body(14, color: soft))),
        RoundIcon(icon: LucideIcons.minus, onTap: slots > 2 ? () => setState(() => slots--) : null),
        SizedBox(width: 40, child: Text('$slots', textAlign: TextAlign.center, style: body(16, weight: FontWeight.w700))),
        RoundIcon(icon: LucideIcons.plus, onTap: slots < 20 ? () => setState(() => slots++) : null),
      ]),
      const SizedBox(height: 10),
      GhostButton(
        label: startsAt == null ? tr('Зараз · обрати час') : partyWhen(startsAt!.toIso8601String()),
        icon: LucideIcons.clock3,
        onPressed: _pickTime,
      ),
      const SizedBox(height: 10),
      Row(children: [
        Expanded(child: GcField(controller: role, label: tr('Роль: медик, водій, снайпер…'), onSubmit: _addRole)),
        const SizedBox(width: 8),
        RoundIcon(icon: LucideIcons.plus, onTap: _addRole),
      ]),
      if (roles.isNotEmpty) ...[
        const SizedBox(height: 8),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final item in roles)
            InputChip(label: Text(item), onDeleted: () => setState(() => roles.remove(item))),
        ]),
      ],
      const SizedBox(height: 10),
      GcField(controller: note, label: tr('Деталі: рівень, мікрофон, мова…'), maxLines: 4, minLines: 2),
      const SizedBox(height: 14),
      PrimaryButton(label: tr('Опублікувати'), busy: saving, onPressed: saving ? null : _save),
    ]);
  }
}

class PartyScreen extends StatelessWidget {
  const PartyScreen({required this.id, super.key});
  final String id;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.of(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/party/$id')),
      builder: (data, reload) {
        final party = mapOf(data['party']);
        final host = mapOf(party['host']);
        final roles = (party['roles'] as List? ?? const []).whereType<String>().toList();
        final taken = (party['taken_roles'] as List? ?? const []).whereType<String>().toSet();
        final free = roles.where((r) => !taken.contains(r)).toList();
        final open = party['open'] == true;
        final joined = party['joined'] == true;
        final mine = party['mine'] == true;
        final full = intOf(party['count']) >= intOf(party['slots']);

        Future<void> join() async {
          String? role;
          if (free.isNotEmpty) {
            role = await showGcSheet<String>(
              context,
              title: tr('Оберіть роль'),
              builder: (sheet) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                for (final item in free) Padding(padding: const EdgeInsets.only(bottom: 8), child: GhostButton(label: item, onPressed: () => Navigator.pop(sheet, item))),
              ]),
            );
            if (role == null) return;
          }
          if (!context.mounted) return;
          if (await attempt(context, () => api.post(Api.site('/party/$id/join'), {'role': role}), success: tr('Ви в паті. Заходьте в голосову кімнату.'))) await reload();
        }

        return ScreenScroll(
          onRefresh: reload,
          children: [
            Row(children: [
              RoundIcon(icon: LucideIcons.arrowLeft, onTap: () => context.canPop() ? context.pop() : context.go('/party')),
              const SizedBox(width: 8),
              Text(tr('Пошук паті'), style: body(14, color: muted)),
            ]),
            const SizedBox(height: 10),
            PartyCard(party: party),
            const SizedBox(height: 10),
            if (!open)
              Glass(child: Text(tr('Оголошення закрите.'), style: body(14, color: muted)))
            else if (!joined && !full)
              PrimaryButton(label: tr('Приєднатися'), icon: LucideIcons.userPlus, onPressed: join)
            else if (!joined && full)
              Text(tr('Місць більше немає.'), style: body(13, color: muted)),
            if (joined && !mine) ...[
              const SizedBox(height: 8),
              GhostButton(label: tr('Вийти з паті'), icon: LucideIcons.logOut, onPressed: () async {
                if (await attempt(context, () => api.delete(Api.site('/party/$id/join')))) await reload();
              }),
            ],
            if (mine && open) ...[
              const SizedBox(height: 8),
              GhostButton(label: tr('Закрити оголошення'), icon: LucideIcons.circleX, color: danger, onPressed: () async {
                if (await attempt(context, () => api.delete(Api.site('/party/$id')), success: tr('Оголошення закрито.')) && context.mounted) context.go('/party');
              }),
            ],
            SectionLabel('${tr('Склад')} · ${party['count']}/${party['slots']}'),
            Glass(
              padding: const EdgeInsets.fromLTRB(10, 6, 10, 6),
              child: Column(children: [
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                  leading: Avatar(url: text(host['avatar_url']), name: text(host['name']) ?? '?', size: 38),
                  title: Text(text(host['name']) ?? '', style: body(14, weight: FontWeight.w600)),
                  trailing: const Icon(LucideIcons.crown, size: 16, color: gold),
                  onTap: () => context.push('/u/${host['username']}'),
                ),
                for (final member in maps(party['members']))
                  ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                    leading: Avatar(url: text(member['avatar_url']), name: text(member['name']) ?? '?', size: 38),
                    title: Text(text(member['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14)),
                    trailing: text(member['role']) == null ? null : Pill(label: text(member['role'])!, color: gold),
                    onTap: () => context.push('/u/${member['username']}'),
                  ),
              ]),
            ),
            if (maps(data['suggestions']).isNotEmpty) ...[
              SectionLabel(tr('Підходять у паті'), trailing: tr('Підбір тиммейтів'), onTrailing: () => context.push('/party/match')),
              Glass(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                child: Column(children: [
                  for (final match in maps(data['suggestions']))
                    TeammateTile(match: match, onMessage: () => messageTeammate(context, match), onInvite: () => inviteTeammate(context, intOf(party['id']), match)),
                ]),
              ),
            ],
            if (joined && open) ...[
              const SizedBox(height: 12),
              VoiceRoomsPanel(key: ValueKey('voice-party-$id'), type: 'party', id: intOf(party['id']), label: text(party['title']) ?? '', route: '/party/$id'),
            ],
          ],
        );
      },
    );
  }
}
