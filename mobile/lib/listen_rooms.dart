import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';
import 'skeletons.dart';

/// Пояснення, чому Spotify не грає всім разом.
String spotifyRoomNote() =>
    tr('Синхронно грають лише треки GameCon і радіо. Spotify кожен слухає через власний акаунт, тому його не можна увімкнути всім одночасно.');

String _kind(String? type) => switch (type) {
      'family' => tr('Сім’я'),
      'clan' => tr('Клан'),
      'community' => tr('Спільнота'),
      _ => tr('Друзі'),
    };

/// Відкрити кімнату групи (чи приєднатися до живої) або кімнату з друзями й перейти в неї.
Future<void> startListenRoom(BuildContext context, {String? type, int? id}) async {
  final api = AppScope.read(context).session.api;
  try {
    final result = await api.post(Api.site('/music/rooms'), {'group_type': ?type, 'group_id': ?id});
    final code = text(result['code']);
    if (code != null && context.mounted) context.push('/listen/$code');
  } catch (e) {
    if (context.mounted) toast(context, e);
  }
}

/// «Слухати разом» на екрані сім’ї, клану чи спільноти: кнопка й «Зараз у кімнаті: N».
class ListenRoomPanel extends StatefulWidget {
  const ListenRoomPanel({required this.type, required this.id, super.key});
  final String type;
  final int id;

  @override
  State<ListenRoomPanel> createState() => _ListenRoomPanelState();
}

class _ListenRoomPanelState extends State<ListenRoomPanel> {
  Map<String, dynamic>? status;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await AppScope.read(context).session.api.get(Api.site('/music/rooms/${widget.type}/${widget.id}'));
      if (mounted) setState(() => status = data);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final s = status;
    if (s == null || s['member'] != true) return const SizedBox.shrink();
    final room = mapOf(s['room']);
    if (room.isEmpty && s['can_start'] != true) return const SizedBox.shrink();
    final playing = mapOf(room['now_playing']);
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(LucideIcons.headphones, size: 18, color: primary),
            const SizedBox(width: 8),
            Expanded(child: Text(tr('Слухати разом'), style: display(16))),
            if (room.isNotEmpty) Pill(label: tr('Зараз у кімнаті: {n}', {'n': intOf(room['listeners'])}), color: green),
          ]),
          const SizedBox(height: 6),
          Text(
            playing.isNotEmpty
                ? '${text(playing['title']) ?? ''} · ${text(playing['artist']) ?? ''}'
                : room.isNotEmpty
                    ? tr('Діджей ще обирає музику')
                    : tr('Один трек синхронно в усіх: діджей керує, решта пропонує треки й реагує.'),
            style: body(13, color: muted),
          ),
          const SizedBox(height: 10),
          room.isNotEmpty
              ? PrimaryButton(label: tr('Слухати разом'), icon: LucideIcons.headphones, compact: true, onPressed: () => context.push('/listen/${room['code']}'))
              : GhostButton(label: tr('Слухати разом'), icon: LucideIcons.headphones, compact: true, onPressed: () => startListenRoom(context, type: widget.type, id: widget.id)),
        ]),
      ),
    );
  }
}

/// «Кімнати» в музиці: живі кімнати моїх груп і друзів, відкрити нову.
class ListenRoomsScreen extends StatefulWidget {
  const ListenRoomsScreen({super.key});

  @override
  State<ListenRoomsScreen> createState() => _ListenRoomsScreenState();
}

class _ListenRoomsScreenState extends State<ListenRoomsScreen> {
  Map<String, dynamic>? data;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final fresh = await AppScope.read(context).session.api.get(Api.site('/music/rooms'));
      if (mounted) setState(() => data = fresh);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) return const ScreenSkeleton();
    final rooms = maps(d['rooms']);
    final groups = maps(d['groups']).where((g) => g['can_start'] == true).toList();
    return ScreenScroll(
      onRefresh: _load,
      children: [
        Text(tr('Кімнати'), style: display(26)),
        const SizedBox(height: 4),
        Text(tr('Слухайте разом із сім’єю, кланом, спільнотою чи друзями: діджей керує музикою, решта пропонує треки, реагує й пише в чат.'), style: body(13.5, color: muted)),
        SectionLabel(tr('Зараз грають'), trailing: '${rooms.length}'),
        if (rooms.isEmpty) QuietEmpty(icon: LucideIcons.headphones, text: tr('Живих кімнат поки немає — відкрийте свою.')),
        for (final room in rooms)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Glass(
              padding: const EdgeInsets.all(10),
              radius: 16,
              onTap: () => context.push('/listen/${room['code']}'),
              child: Row(children: [
                text(mapOf(room['now_playing'])['cover_url']) != null
                    ? NetImage(text(mapOf(room['now_playing'])['cover_url']), width: 52, height: 52, radius: 12)
                    : Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(color: raised, borderRadius: BorderRadius.circular(12)),
                        child: Icon(LucideIcons.headphones, color: faint, size: 22),
                      ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(text(room['title']) ?? text(mapOf(room['group'])['name']) ?? tr('Кімната з друзями'), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14.5, weight: FontWeight.w600)),
                    Text(
                      mapOf(room['now_playing']).isEmpty ? tr('Діджей ще обирає музику') : '${mapOf(room['now_playing'])['title']} · ${mapOf(room['now_playing'])['artist'] ?? ''}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: body(12.5, color: muted),
                    ),
                    Text('${tr('Зараз у кімнаті: {n}', {'n': intOf(room['listeners'])})} · ${_kind(text(mapOf(room['group'])['type']))}', style: body(11.5, color: faint)),
                  ]),
                ),
              ]),
            ),
          ),
        SectionLabel(tr('Відкрити кімнату')),
        PrimaryButton(label: tr('З друзями'), icon: LucideIcons.plus, compact: true, onPressed: () => startListenRoom(context)),
        for (final g in groups) ...[
          const SizedBox(height: 8),
          GhostButton(
            label: '${text(g['name']) ?? ''} · ${_kind(text(g['type']))}',
            icon: LucideIcons.headphones,
            compact: true,
            onPressed: () => startListenRoom(context, type: text(g['type']), id: intOf(g['id'])),
          ),
        ],
        const SizedBox(height: 16),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(LucideIcons.info, size: 15, color: faint),
          const SizedBox(width: 8),
          Expanded(child: Text(spotifyRoomNote(), style: body(12, color: faint))),
        ]),
      ],
    );
  }
}
