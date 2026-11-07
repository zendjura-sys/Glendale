import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'party.dart' show partyPlatforms;
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// Підбір тиммейтів — як на сайті (/party/match, App\Services\Party\Teammates): анкета гравця,
// «Шукаю зараз», сумісні гравці з поясненням «чому підходить» і запрошення у своє паті.

Map<String, String> teammateTimes() => {'morning': tr('Вранці'), 'day': tr('Вдень'), 'evening': tr('Ввечері'), 'night': tr('Вночі'), 'weekend': tr('На вихідних')};

Map<String, String> teammateSkills() => {'new': tr('Новачок'), 'casual': tr('Для душі'), 'mid': tr('Впевнено'), 'pro': tr('Профі')};

const teammateLanguages = {'uk': 'Українська', 'en': 'English', 'pl': 'Polski', 'de': 'Deutsch'};

String teammateReason(Map<String, dynamic> reason) => switch (reason['type']) {
      'game' => tr('Обидва граєте в {game}', {'game': text(reason['name']) ?? ''}),
      'time' => tr('Граєте: {when}', {'when': [for (final t in (reason['times'] as List? ?? [])) teammateTimes()['$t'] ?? '$t'].join(', ').toLowerCase()}),
      'language' => tr('Спільна мова'),
      'skill_same' => tr('Однаковий рівень'),
      'skill_near' => tr('Схожий рівень'),
      'platform' => tr('Та сама платформа'),
      'mic' => tr('Обидва з мікрофоном'),
      'looking' => tr('Шукає зараз'),
      _ => '',
    };

/// Сумісний гравець: відсоток, причини, «Написати» й «Покликати в паті».
class TeammateTile extends StatelessWidget {
  const TeammateTile({required this.match, required this.onMessage, this.onInvite, super.key});
  final Map<String, dynamic> match;
  final VoidCallback onMessage;
  final VoidCallback? onInvite;

  @override
  Widget build(BuildContext context) {
    final user = mapOf(match['user']);
    final score = intOf(match['score']);
    final reasons = [for (final r in maps(match['reasons'])) teammateReason(r)].where((r) => r.isNotEmpty).take(4).toList();
    final meta = [
      (match['games'] as List? ?? []).take(3).join(', '),
      if (text(match['skill']) != null) teammateSkills()[match['skill']],
      if (match['mic'] == true) tr('з мікрофоном'),
    ].whereType<String>().where((s) => s.isNotEmpty).join(' · ');
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        GestureDetector(
          onTap: () => context.push('/u/${user['username']}'),
          child: Avatar(url: text(user['avatar_url']), name: text(user['name']) ?? '?', size: 46, online: user['is_online'] == true),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
              Text(text(user['name']) ?? '', style: body(15, weight: FontWeight.w700)),
              if (match['looking'] == true) Pill(label: tr('Шукає зараз'), icon: LucideIcons.radar, color: primary),
              if (match['friend'] == true) Pill(label: tr('Друг')),
            ]),
            if (meta.isNotEmpty) ...[const SizedBox(height: 2), Text(meta, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: muted))],
            if (text(match['note']) != null) ...[const SizedBox(height: 4), Text(text(match['note'])!, maxLines: 2, overflow: TextOverflow.ellipsis, style: body(13.5, color: soft))],
            if (reasons.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(spacing: 6, runSpacing: 6, children: [
                for (final r in reasons)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: fg.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(6)),
                    child: Text(r, style: body(11.5, color: soft)),
                  ),
              ]),
            ],
            const SizedBox(height: 10),
            Row(children: [
              GhostButton(label: tr('Написати'), icon: LucideIcons.messageCircle, compact: true, expand: false, onPressed: onMessage),
              if (onInvite != null) ...[
                const SizedBox(width: 8),
                GhostButton(label: tr('Покликати в паті'), icon: LucideIcons.userPlus, compact: true, expand: false, color: primary, onPressed: onInvite),
              ],
            ]),
          ]),
        ),
        const SizedBox(width: 8),
        Container(
          width: 48,
          height: 48,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(width: 2, color: score >= 70 ? primary.withValues(alpha: 0.6) : fg.withValues(alpha: score >= 40 ? 0.25 : 0.1)),
          ),
          child: Text('$score%', style: body(12.5, weight: FontWeight.w800, color: score >= 70 ? primary : (score >= 40 ? ink : muted))),
        ),
      ]),
    );
  }
}

/// Відкрити особисте листування з гравцем.
Future<void> messageTeammate(BuildContext context, Map<String, dynamic> match) async {
  final api = AppScope.read(context).session.api;
  final username = mapOf(match['user'])['username'];
  try {
    final chat = await api.post('/api/v1/messages/with/$username');
    if (context.mounted) context.push('/messages/${intOf(chat['id'])}');
  } catch (e) {
    if (context.mounted) toast(context, e);
  }
}

/// Покликати гравця в паті (сповіщення з посиланням).
Future<bool> inviteTeammate(BuildContext context, int partyId, Map<String, dynamic> match) {
  final api = AppScope.read(context).session.api;
  return attempt(context, () => api.post(Api.site('/party/$partyId/invite'), {'user_id': mapOf(match['user'])['id']}), success: tr('Запрошення надіслано.'));
}

class TeammatesScreen extends StatefulWidget {
  const TeammatesScreen({super.key});

  @override
  State<TeammatesScreen> createState() => _TeammatesScreenState();
}

class _TeammatesScreenState extends State<TeammatesScreen> {
  String game = '';

  Api get api => AppScope.read(context).session.api;

  @override
  Widget build(BuildContext context) {
    final session = AppScope.of(context).session;
    return Remote(
      watch: game,
      load: () => session.api.get(Api.site(game.isEmpty ? '/party/match' : '/party/match?game=$game')),
      builder: (data, reload) {
        final profile = data['profile'] is Map ? mapOf(data['profile']) : null;
        final matches = maps(data['matches']);
        final parties = maps(data['parties']);
        final options = mapOf(data['options']);
        final looking = profile != null && text(profile['looking_until']) != null;
        return ScreenScroll(onRefresh: reload, children: [
          Row(children: [
            RoundIcon(icon: LucideIcons.arrowLeft, onTap: () => context.canPop() ? context.pop() : context.go('/party')),
            const SizedBox(width: 8),
            Text(tr('Пошук паті'), style: body(14, color: muted)),
          ]),
          const SizedBox(height: 10),
          PageTitle(tr('Підбір тиммейтів'), subtitle: tr('Спільні ігри, мова, час і рівень — і ви бачите, з ким найзручніше грати.')),
          const SizedBox(height: 12),
          if (profile != null)
            looking
                ? PrimaryButton(
                    label: tr('Шукаю до {time}', {'time': clock(profile['looking_until'])}),
                    icon: LucideIcons.radar,
                    onPressed: () async {
                      if (await attempt(context, () => api.post(Api.site('/party/match/looking'), {'on': false}))) await reload();
                    },
                  )
                : GhostButton(
                    label: tr('Шукаю зараз'),
                    icon: LucideIcons.radar,
                    onPressed: () async {
                      if (await attempt(context, () => api.post(Api.site('/party/match/looking'), {'on': true}), success: tr('Вас побачать першими протягом двох годин.'))) await reload();
                    },
                  ),
          const SizedBox(height: 12),
          Glass(
            radius: 12,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              CardTitle(tr('Моя анкета'), icon: LucideIcons.idCard, trailing: profile == null ? null : tr('Змінити'), onTrailing: () => _edit(profile, options, reload)),
              if (profile == null) ...[
                Text(tr('Заповніть анкету — і ми покажемо, з ким вам буде найзручніше грати.'), style: body(13.5, color: soft)),
                const SizedBox(height: 10),
                PrimaryButton(label: tr('Заповнити анкету'), icon: LucideIcons.pencil, onPressed: () => _edit(null, options, reload)),
              ] else
                Text(
                  [
                    [for (final g in maps(profile['games'])) text(g['name'])].whereType<String>().join(', '),
                    if (text(profile['skill']) != null) teammateSkills()[profile['skill']],
                    [for (final t in (profile['times'] as List? ?? [])) teammateTimes()['$t']].whereType<String>().join(', ').toLowerCase(),
                    if (profile['visible'] != true) tr('приховано з підбору'),
                  ].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
                  style: body(13.5, color: soft),
                ),
            ]),
          ),
          if (profile != null) ...[
            SectionLabel(tr('Вам підходять')),
            if (maps(profile['games']).isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: GcSelect<String>(
                  value: game,
                  expand: true,
                  items: [('', tr('Усі мої ігри')), for (final g in maps(profile['games'])) ('${g['slug']}', '${g['name']}')],
                  onChanged: (v) => setState(() => game = v ?? ''),
                ),
              ),
            if (matches.isEmpty)
              EmptyState(icon: LucideIcons.usersRound, title: tr('Поки нікого'), text: tr('Додайте більше ігор в анкету або увімкніть «Шукаю зараз» — інші побачать вас першими.'))
            else
              Glass(
                radius: 12,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                child: Column(children: [
                  for (var i = 0; i < matches.length; i++) ...[
                    if (i > 0) Divider(height: 1, color: fg.withValues(alpha: 0.06)),
                    TeammateTile(
                      match: matches[i],
                      onMessage: () => messageTeammate(context, matches[i]),
                      onInvite: parties.isEmpty ? null : () => _invite(parties, matches[i]),
                    ),
                  ],
                ]),
              ),
          ],
        ]);
      },
    );
  }

  Future<void> _invite(List<Map<String, dynamic>> parties, Map<String, dynamic> match) async {
    final id = parties.length == 1
        ? intOf(parties.first['id'])
        : await showGcSheet<int>(
            context,
            title: tr('У яке паті покликати?'),
            builder: (sheet) => Column(mainAxisSize: MainAxisSize.min, children: [
              for (final p in parties)
                ListTile(title: Text(text(p['title']) ?? '', style: body(15, weight: FontWeight.w600)), onTap: () => Navigator.pop(sheet, intOf(p['id']))),
            ]),
          );
    if (id == null || !mounted) return;
    await inviteTeammate(context, id, match);
  }

  Future<void> _edit(Map<String, dynamic>? profile, Map<String, dynamic> options, Future<void> Function() reload) async {
    final saved = await showGcSheet<bool>(
      context,
      title: tr('Анкета тиммейта'),
      builder: (sheet) => _ProfileForm(profile: profile, options: options, api: api),
    );
    if (saved == true) await reload();
  }
}

class _ProfileForm extends StatefulWidget {
  const _ProfileForm({required this.profile, required this.options, required this.api});
  final Map<String, dynamic>? profile;
  final Map<String, dynamic> options;
  final Api api;

  @override
  State<_ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends State<_ProfileForm> {
  late final games = <String>{for (final g in maps(widget.profile?['games'])) '${g['slug']}'};
  late final times = <String>{for (final t in (widget.profile?['times'] as List? ?? [])) '$t'};
  late final languages = <String>{for (final l in (widget.profile?['languages'] as List? ?? ['uk'])) '$l'};
  late String skill = text(widget.profile?['skill']) ?? '';
  late String platform = text(widget.profile?['platform']) ?? '';
  late bool mic = widget.profile?['mic'] == true;
  late bool visible = widget.profile?['visible'] != false;
  late final note = TextEditingController(text: text(widget.profile?['note']) ?? '');
  bool busy = false;

  Widget _chip(String label, bool on, VoidCallback onTap) => SelectPill(label: label, selected: on, onTap: onTap);

  @override
  Widget build(BuildContext context) {
    final allGames = maps(widget.options['games']);
    final names = {for (final g in allGames) '${g['slug']}': '${g['name']}', for (final g in maps(widget.profile?['games'])) '${g['slug']}': '${g['name']}'};
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      Text(tr('У що граєте (до 8)'), style: body(12.5, color: muted)),
      const SizedBox(height: 8),
      Wrap(spacing: 6, runSpacing: 6, children: [
        for (final slug in games) _chip('${names[slug] ?? slug}  ✕', true, () => setState(() => games.remove(slug))),
      ]),
      if (games.length < 8) ...[
        const SizedBox(height: 8),
        GcSelect<String>(
          value: '',
          expand: true,
          items: [('', tr('+ Додати гру')), for (final g in allGames) if (!games.contains('${g['slug']}')) ('${g['slug']}', '${g['name']}')],
          onChanged: (v) {
            if (v != null && v.isNotEmpty) setState(() => games.add(v));
          },
        ),
      ],
      const SizedBox(height: 14),
      Text(tr('Коли граєте'), style: body(12.5, color: muted)),
      const SizedBox(height: 8),
      Wrap(spacing: 6, runSpacing: 6, children: [
        for (final e in teammateTimes().entries) _chip(e.value, times.contains(e.key), () => setState(() => times.contains(e.key) ? times.remove(e.key) : times.add(e.key))),
      ]),
      const SizedBox(height: 14),
      Text(tr('Мови'), style: body(12.5, color: muted)),
      const SizedBox(height: 8),
      Wrap(spacing: 6, runSpacing: 6, children: [
        for (final e in teammateLanguages.entries) _chip(e.value, languages.contains(e.key), () => setState(() => languages.contains(e.key) ? languages.remove(e.key) : languages.add(e.key))),
      ]),
      const SizedBox(height: 14),
      Text(tr('Рівень гри'), style: body(12.5, color: muted)),
      const SizedBox(height: 8),
      Wrap(spacing: 6, runSpacing: 6, children: [
        for (final e in teammateSkills().entries) _chip(e.value, skill == e.key, () => setState(() => skill = skill == e.key ? '' : e.key)),
      ]),
      const SizedBox(height: 14),
      GcSelect<String>(
        value: platform,
        expand: true,
        items: [('', tr('Будь-яка платформа')), for (final e in partyPlatforms().entries) (e.key, e.value)],
        onChanged: (v) => setState(() => platform = v ?? ''),
      ),
      const SizedBox(height: 10),
      GcField(controller: note, label: tr('Пару слів про себе: роль, стиль гри, ранг (необов’язково)')),
      SwitchListTile(contentPadding: EdgeInsets.zero, value: mic, onChanged: (v) => setState(() => mic = v), title: Text(tr('Граю з мікрофоном'), style: body(14))),
      SwitchListTile(contentPadding: EdgeInsets.zero, value: visible, onChanged: (v) => setState(() => visible = v), title: Text(tr('Показувати мене в підборі'), style: body(14))),
      const SizedBox(height: 8),
      PrimaryButton(
        label: tr('Зберегти анкету'),
        icon: LucideIcons.check,
        busy: busy,
        onPressed: () async {
          setState(() => busy = true);
          final ok = await attempt(
            context,
            () => widget.api.put(Api.site('/party/match/profile'), {
              'games': games.toList(),
              'times': times.toList(),
              'languages': languages.toList(),
              'skill': skill.isEmpty ? null : skill,
              'platform': platform.isEmpty ? null : platform,
              'mic': mic,
              'note': note.text.trim().isEmpty ? null : note.text.trim(),
              'visible': visible,
            }),
            success: tr('Анкету збережено.'),
          );
          if (!context.mounted) return;
          setState(() => busy = false);
          if (ok) Navigator.pop(context, true);
        },
      ),
    ]);
  }
}
