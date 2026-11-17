import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:share_plus/share_plus.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'voice_room.dart';
import 'widgets.dart';
import 'skeletons.dart';

/// GameCast — подкасти наживо (міст `/site/shows`).
class GameCastScreen extends StatefulWidget {
  const GameCastScreen({this.topic, super.key});
  final String? topic;

  @override
  State<GameCastScreen> createState() => _GameCastScreenState();
}

class _GameCastScreenState extends State<GameCastScreen> {
  Map<String, dynamic>? page;

  Api get api => AppScope.read(context).session.api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final topic = widget.topic;
    try {
      final data = await api.get(Api.site('/shows${topic == null || topic.isEmpty ? '' : '?topic=${Uri.encodeQueryComponent(topic)}'}'));
      if (mounted) setState(() => page = data);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _create() async {
    final title = TextEditingController();
    final format = ValueNotifier('duo');
    final id = await showGcSheet<int>(
      context,
      title: tr('Створити кімнату'),
      subtitle: tr('Ведучі на сцені, слухачі піднімають руку за хвилину на питання.'),
      builder: (sheet) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(controller: title, autofocus: true, maxLength: 80, decoration: InputDecoration(hintText: tr('Назва кімнати'), counterText: '')),
          const SizedBox(height: 10),
          Text(tr('Формат'), style: body(12.5, color: muted)),
          const SizedBox(height: 6),
          ValueListenableBuilder(
            valueListenable: format,
            builder: (_, value, _) => Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final (key, label) in [('duo', tr('1 на 1')), ('double', tr('2 на 2')), ('custom', tr('Свій склад'))])
                  SelectPill(label: label, selected: value == key, onTap: () => format.value = key),
              ],
            ),
          ),
          const SizedBox(height: 14),
          PrimaryButton(
            label: tr('Створити'),
            icon: LucideIcons.radio,
            onPressed: () async {
              final name = title.text.trim();
              if (name.length < 3) {
                toast(sheet, tr('Назва має бути щонайменше 3 символи.'));
                return;
              }
              try {
                final created = await api.post(Api.site('/shows'), {'title': name, 'format': format.value});
                if (sheet.mounted) Navigator.pop(sheet, intOf(mapOf(created['show'])['id']));
              } catch (e) {
                if (sheet.mounted) toast(sheet, e);
              }
            },
          ),
        ],
      ),
    );
    title.dispose();
    format.dispose();
    await _load();
    if (id != null && mounted) context.push('/shows/$id');
  }

  @override
  Widget build(BuildContext context) {
    final data = page;
    if (data == null) return const ScreenSkeleton();
    final live = maps(data['live']);
    final upcoming = maps(data['upcoming']);
    final trends = maps(data['trends']);
    final topic = text(data['topic']) ?? widget.topic;

    return ScreenScroll(
      onRefresh: _load,
      children: [
        PageTitle(
          'GameCast',
          subtitle: tr('Розмови наживо: ведучі на сцені, слухачі піднімають руку — і отримують хвилину на питання.'),
          trailing: RoundIcon(icon: LucideIcons.plus, onTap: _create),
        ),
        if (trends.isNotEmpty || topic != null) ...[
          SectionLabel(tr('У тренді')),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (topic != null)
                SelectPill(
                  label: '#$topic',
                  selected: true,
                  onTap: () => context.go('/shows'),
                ),
              for (final t in trends)
                SelectPill(
                  label: '#${text(t['tag']) ?? ''}${intOf(t['live']) > 0 ? ' · ${tr('в ефірі')}' : ''}',
                  selected: topic == text(t['tag']),
                  onTap: () => context.go('/shows?topic=${Uri.encodeQueryComponent(text(t['tag']) ?? '')}'),
                ),
            ],
          ),
          const SizedBox(height: 12),
        ],
        SectionLabel(tr('Зараз в ефірі')),
        if (live.isEmpty)
          Glass(child: Text(tr('Ніхто зараз не в ефірі — створіть кімнату.'), style: body(13, color: muted)))
        else
          for (final show in live)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _ShowCard(show: show, live: true),
            ),
        if (upcoming.isNotEmpty) ...[
          SectionLabel(tr('Розклад')),
          for (final show in upcoming)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _ShowCard(show: show, live: false),
            ),
        ],
        const SizedBox(height: 8),
        PrimaryButton(label: tr('Створити кімнату'), icon: LucideIcons.radio, onPressed: _create),
      ],
    );
  }
}

class _ShowCard extends StatelessWidget {
  const _ShowCard({required this.show, required this.live});
  final Map<String, dynamic> show;
  final bool live;

  @override
  Widget build(BuildContext context) {
    final host = mapOf(show['host']);
    final topics = (show['topics'] is List ? show['topics'] as List : const []).map((e) => '$e').where((e) => e.isNotEmpty).toList();
    return Glass(
      onTap: () => context.push('/shows/${show['id']}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (live)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: danger.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(8)),
                  child: Text(tr('В ефірі'), style: body(11, color: danger, weight: FontWeight.w800)),
                )
              else
                Pill(label: tr('Скоро'), icon: LucideIcons.calendarClock, color: soft),
              const Spacer(),
              Pill(label: '${intOf(show['listeners'])}', icon: LucideIcons.headphones, color: muted),
            ],
          ),
          const SizedBox(height: 8),
          Text(text(show['title']) ?? '', style: body(16, weight: FontWeight.w700)),
          if (topics.isNotEmpty) ...[
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: [for (final t in topics.take(5)) Pill(label: '#$t', color: primary)],
            ),
          ],
          const SizedBox(height: 8),
          Row(
            children: [
              Avatar(url: text(host['avatar_url']), name: text(host['name']) ?? '?', size: 28),
              const SizedBox(width: 8),
              Expanded(child: Text(text(host['name']) ?? '', style: body(13, color: soft), maxLines: 1, overflow: TextOverflow.ellipsis)),
              Icon(LucideIcons.chevronRight, size: 16, color: faint),
            ],
          ),
        ],
      ),
    );
  }
}

/// Сторінка шоу: сцена, руки, слухачі, вхід у звук.
class GameCastShowScreen extends StatefulWidget {
  const GameCastShowScreen({required this.id, super.key});
  final int id;

  @override
  State<GameCastShowScreen> createState() => _GameCastShowScreenState();
}

class _GameCastShowScreenState extends State<GameCastShowScreen> {
  Map<String, dynamic>? state;
  Timer? poll;
  bool busy = false;

  Api get api => AppScope.read(context).session.api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    poll?.cancel();
    super.dispose();
  }

  void _schedule() {
    poll?.cancel();
    final live = text(mapOf(state?['show'])['status']) == 'live';
    poll = Timer.periodic(Duration(seconds: live ? 3 : 20), (_) => _refresh());
  }

  Future<void> _load() async {
    try {
      final data = await api.get(Api.site('/shows/${widget.id}'));
      if (!mounted) return;
      setState(() => state = data);
      _schedule();
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _refresh() async {
    try {
      final data = await api.get(Api.site('/shows/${widget.id}/state'));
      if (mounted) setState(() => state = data);
    } catch (_) {}
  }

  Future<void> _act(Future<Map<String, dynamic>> Function() run, {String? success}) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final next = await run();
      if (mounted) {
        setState(() => state = next);
        if (success != null) toast(context, success);
      }
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _joinVoice(Map<String, dynamic> show) async {
    await VoiceCall.instance.show(
      api,
      widget.id,
      text(show['title']) ?? 'GameCast',
      onError: (e) {
        if (mounted) toast(context, e, kind: ToastKind.error);
      },
    );
    await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final data = state;
    if (data == null) return const ScreenSkeleton();
    final show = mapOf(data['show']);
    final me = data['me'] is Map ? mapOf(data['me']) : null;
    final canManage = data['can_manage'] == true;
    final status = text(show['status']) ?? '';
    final live = status == 'live';
    final ended = status == 'ended';
    final inVoice = VoiceCall.instance.kind == 'show' && VoiceCall.instance.roomId == widget.id && VoiceCall.instance.active;
    final isHost = me?['role'] == 'host';
    final hand = me?['hand'] == true;

    return ListenableBuilder(
      listenable: VoiceCall.instance,
      builder: (context, _) => ScreenScroll(
        onRefresh: _load,
        children: [
          Row(
            children: [
              RoundIcon(icon: LucideIcons.arrowLeft, onTap: () => context.canPop() ? context.pop() : context.go('/shows')),
              const SizedBox(width: 8),
              Expanded(child: Text('GameCast', style: body(14, color: muted))),
              RoundIcon(
                icon: LucideIcons.share2,
                onTap: () => SharePlus.instance.share(ShareParams(text: '${Api.root}/shows/${widget.id}', subject: text(show['title']))),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Glass(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (live)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: danger.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(8)),
                        child: Text(tr('В ефірі'), style: body(11, color: danger, weight: FontWeight.w800)),
                      )
                    else if (ended)
                      Pill(label: tr('Завершено'), color: muted)
                    else
                      Pill(label: tr('Очікує старту'), icon: LucideIcons.clock3, color: soft),
                    const Spacer(),
                    Pill(label: '${intOf(data['listeners_count'], intOf(show['listeners']))}', icon: LucideIcons.headphones),
                  ],
                ),
                const SizedBox(height: 8),
                Text(text(show['title']) ?? '', style: display(20)),
                if (text(show['topic']) != null) ...[
                  const SizedBox(height: 4),
                  Text(text(show['topic'])!, style: body(13, color: soft)),
                ],
              ],
            ),
          ),
          if (!ended) ...[
            const SizedBox(height: 10),
            if (live && !inVoice)
              PrimaryButton(label: tr('Увійти в ефір'), icon: LucideIcons.headphones, busy: busy, onPressed: busy ? null : () => _joinVoice(show))
            else if (inVoice)
              GhostButton(label: tr('Вийти з ефіру'), icon: LucideIcons.logOut, color: dangerSoft, onPressed: () async {
                await VoiceCall.instance.leave();
                await _refresh();
              }),
            if (isHost && !live && !ended) ...[
              const SizedBox(height: 8),
              PrimaryButton(
                label: tr('Почати ефір'),
                icon: LucideIcons.play,
                busy: busy,
                onPressed: busy ? null : () => _act(() => api.post(Api.site('/shows/${widget.id}/start')), success: tr('Ефір почався.')),
              ),
            ],
            if (isHost && live) ...[
              const SizedBox(height: 8),
              GhostButton(
                label: tr('Завершити ефір'),
                icon: LucideIcons.circleStop,
                color: danger,
                onPressed: busy
                    ? null
                    : () async {
                        if (!await confirm(context, tr('Завершити ефір?'), action: tr('Завершити'), danger: true)) return;
                        await _act(() => api.post(Api.site('/shows/${widget.id}/end')));
                        await VoiceCall.instance.leave();
                      },
              ),
            ],
            if (live && me != null && me['role'] == 'listener') ...[
              const SizedBox(height: 8),
              GhostButton(
                label: hand ? tr('Опустити руку') : tr('Підняти руку'),
                icon: LucideIcons.hand,
                onPressed: busy ? null : () => _act(() => api.post(Api.site('/shows/${widget.id}/hand'), {'raised': !hand})),
              ),
            ],
          ],
          SectionLabel(tr('Сцена')),
          _PeopleStrip(people: maps(data['stage']), empty: tr('Нікого на сцені')),
          if (maps(data['guests']).isNotEmpty) ...[
            SectionLabel(tr('Гості з питанням')),
            for (final g in maps(data['guests']))
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Avatar(url: text(g['avatar_url']), name: text(g['name']) ?? '?', size: 36),
                title: Text(text(g['name']) ?? '', style: body(14, weight: FontWeight.w600)),
                trailing: Pill(label: tr('{n} с', {'n': intOf(g['seconds_left'])}), color: gold),
                onTap: () => context.push('/u/${g['username']}'),
              ),
          ],
          if (maps(data['hands']).isNotEmpty) ...[
            SectionLabel(tr('Черга рук')),
            for (final h in maps(data['hands']))
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Avatar(url: text(h['avatar_url']), name: text(h['name']) ?? '?', size: 36),
                title: Text(text(h['name']) ?? '', style: body(14)),
                trailing: canManage
                    ? GhostButton(
                        label: tr('Дати слово'),
                        compact: true,
                        expand: false,
                        onPressed: busy ? null : () => _act(() => api.post(Api.site('/shows/${widget.id}/floor/${h['id']}'))),
                      )
                    : Icon(LucideIcons.hand, size: 16, color: soft),
                onTap: () => context.push('/u/${h['username']}'),
              ),
          ],
          SectionLabel('${tr('Слухачі')} · ${intOf(data['listeners_count'])}'),
          _PeopleStrip(people: maps(data['listeners']), empty: tr('Поки тихо')),
        ],
      ),
    );
  }
}

class _PeopleStrip extends StatelessWidget {
  const _PeopleStrip({required this.people, required this.empty});
  final List<Map<String, dynamic>> people;
  final String empty;

  @override
  Widget build(BuildContext context) {
    if (people.isEmpty) {
      return Glass(child: Text(empty, style: body(13, color: muted)));
    }
    return Glass(
      padding: const EdgeInsets.fromLTRB(10, 6, 10, 6),
      child: Column(
        children: [
          for (final p in people)
            ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 4),
              leading: Avatar(url: text(p['avatar_url']), name: text(p['name']) ?? '?', size: 36),
              title: Text(text(p['name']) ?? '', style: body(14, weight: FontWeight.w600)),
              trailing: text(p['role']) == 'host' ? Icon(LucideIcons.crown, size: 16, color: gold) : null,
              onTap: () => context.push('/u/${p['username']}'),
            ),
        ],
      ),
    );
  }
}
