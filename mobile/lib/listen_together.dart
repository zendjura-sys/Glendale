import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';
import 'i18n.dart';

/// Почати спільне прослуховування (з треку або з чату) і відкрити кімнату.
Future<void> startListening(BuildContext context, {int? trackId, int? conversationId}) async {
  final api = AppScope.read(context).session.api;
  try {
    final result = await api.post('/api/v1/music/together', {'track_id': ?trackId, 'conversation_id': ?conversationId});
    final code = text(result['code']);
    if (code != null && context.mounted) context.push('/listen/$code');
  } catch (e) {
    if (context.mounted) toast(context, e);
  }
}

/// Слухаємо разом: один трек синхронно в усіх, спільна черга.
/// Звук іде через спільний плеєр застосунку (працює у фоні), екран лише тримає його в такт із ведучим.
class ListenScreen extends StatefulWidget {
  const ListenScreen({required this.code, super.key});
  final String code;

  @override
  State<ListenScreen> createState() => _ListenScreenState();
}

class _ListenScreenState extends State<ListenScreen> {
  /// На скільки секунд можна розійтися з ведучим, перш ніж підтягнутися.
  static const _drift = 2.5;

  Map<String, dynamic>? party;
  List<Map<String, dynamic>> friends = [];
  List<Map<String, dynamic>> results = [];
  final search = TextEditingController();
  Timer? _poll;
  Timer? _debounce;
  int _offset = 0;
  bool synced = true;
  DateTime _lastNext = DateTime.fromMillisecondsSinceEpoch(0);

  Api get api => AppScope.read(context).session.api;
  TrackPlayer get player => AppScope.read(context).player;
  String get base => '/api/v1/listen/${widget.code}';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final data = await api.get(base);
        if (!mounted) return;
        friends = maps(data['friends']);
        _apply(mapOf(data['party']));
        _search();
      } catch (e) {
        if (mounted) toast(context, e);
      }
      _poll = Timer.periodic(const Duration(seconds: 3), (_) => _refresh());
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    _debounce?.cancel();
    search.dispose();
    super.dispose();
  }

  Map<String, dynamic> get state => mapOf(party?['state']);

  /// Де трек має бути зараз за годинником сервера (секунди).
  double get expected {
    final s = state;
    final position = (s['position'] as num?)?.toDouble() ?? 0;
    if (s['playing'] != true) return position;
    final now = DateTime.now().millisecondsSinceEpoch + _offset;
    return position + (now - intOf(s['state_ms'])) / 1000;
  }

  void _apply(Map<String, dynamic> fresh) {
    if (fresh.isEmpty) return;
    final s = mapOf(fresh['state']);
    if (s.isNotEmpty) _offset = intOf(s['server_ms']) - DateTime.now().millisecondsSinceEpoch;
    setState(() => party = {...?party, ...fresh});
    _sync();
  }

  Future<void> _refresh() async {
    try {
      _apply(await api.get('$base/state'));
    } catch (_) {}
  }

  /// Підлаштовуємо плеєр під стан кімнати; трек дограв — беремо наступний із черги.
  Future<void> _sync() async {
    final p = party;
    if (p == null || p['ended'] == true || !synced) return;
    final track = mapOf(state['track']);
    final playing = state['playing'] == true;
    if (track.isEmpty) {
      if (player.playing) await player.toggle();
      return;
    }
    final duration = intOf(track['duration']);
    if (playing && duration > 0 && expected >= duration - 0.5) {
      final wait = p['is_host'] == true ? 0 : 2;
      if (DateTime.now().difference(_lastNext).inSeconds > 3 && expected >= duration + wait) {
        _lastNext = DateTime.now();
        try {
          _apply(await api.post('$base/next'));
        } catch (_) {}
      }
      return;
    }
    if (!player.isCurrent(track['id'])) {
      if (playing) {
        await player.playList([track], 0);
        await player.seek(Duration(milliseconds: (expected * 1000).round()));
      }
      return;
    }
    if (player.playing != playing) await player.toggle(forcePlay: playing);
    if (playing && (player.position.inMilliseconds / 1000 - expected).abs() > _drift) {
      await player.seek(Duration(milliseconds: (expected * 1000).round()));
    }
  }

  Future<void> _act(Future<Map<String, dynamic>> Function() action) async {
    try {
      _apply(await action());
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _search() async {
    try {
      final data = await api.get(Api.site('/music/search?scope=all&q=${Uri.encodeQueryComponent(search.text.trim())}'));
      if (mounted) setState(() => results = maps(data['tracks']).where((t) => t['source'] == 'local').toList());
    } catch (_) {}
  }

  Future<void> _invite() async {
    await showGcSheet<void>(
      context,
      title: tr('Запросити друзів'),
      subtitle: tr('Кожному прийде повідомлення з посиланням.'),
      builder: (sheet) => Column(children: [
        if (friends.isEmpty) QuietEmpty(icon: LucideIcons.usersRound, text: tr('Друзів поки немає.')),
        for (final f in friends)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Avatar(url: text(f['avatar_url']), name: text(f['name']) ?? '?', size: 38),
            title: Text(text(f['name']) ?? '', style: body(14)),
            trailing: const Icon(LucideIcons.userPlus, color: muted, size: 18),
            onTap: () => attempt(context, () => api.post('$base/invite', {'user_ids': [f['id']]}), success: tr('Запрошення надіслано: {v}', {'v': f['name']})),
          ),
      ]),
    );
  }

  String _clock(num seconds) {
    final t = seconds.floor().clamp(0, 86400);
    return '${t ~/ 60}:${(t % 60).toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final p = party;
    if (p == null) return const Center(child: CircularProgressIndicator(strokeWidth: 2.4));
    final track = mapOf(state['track']);
    final playing = state['playing'] == true;
    final canControl = p['can_control'] == true && p['ended'] != true;
    final ended = p['ended'] == true;
    final queue = maps(p['queue']);
    final members = maps(p['members']);
    final me = AppScope.read(context).session.me;

    return ListenableBuilder(
      listenable: player,
      builder: (context, _) => _content(context, p, track, playing, canControl, ended, queue, members, me),
    );
  }

  Widget _content(BuildContext context, Map<String, dynamic> p, Map<String, dynamic> track, bool playing, bool canControl, bool ended, List<Map<String, dynamic>> queue, List<Map<String, dynamic>> members, Map<String, dynamic>? me) {
    final position = track.isEmpty ? 0.0 : (player.isCurrent(track['id']) ? player.position.inMilliseconds / 1000 : expected);
    return ScreenScroll(
      onRefresh: _refresh,
      children: [
        Glass(
          child: Column(children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: text(track['cover_url']) != null
                  ? NetImage(text(track['cover_url']), width: 190, height: 190)
                  : Container(width: 190, height: 190, color: raised, child: const Icon(LucideIcons.headphones, color: faint, size: 56)),
            ),
            const SizedBox(height: 14),
            Text(ended ? tr('СЛУХАЄМО РАЗОМ · ЗАВЕРШЕНО') : tr('СЛУХАЄМО РАЗОМ'), style: body(11.5, color: primary, weight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(text(track['title']) ?? tr('Нічого не грає'), textAlign: TextAlign.center, style: display(20)),
            const SizedBox(height: 4),
            Text(text(track['artist']) ?? tr('Додайте трек у чергу — він заграє одразу'), textAlign: TextAlign.center, style: body(13.5, color: muted)),
            const SizedBox(height: 6),
            Text(tr('Ведучий: {v}{v2}', {'v': mapOf(p['host'])['name'] ?? '', 'v2': state['shared_control'] == true ? ' · керують усі' : ''}), style: body(12, color: faint)),
            if (track.isNotEmpty) ...[
              Slider(
                value: position.clamp(0, intOf(track['duration']).toDouble()).toDouble(),
                max: intOf(track['duration']).toDouble().clamp(1, 86400).toDouble(),
                onChanged: canControl ? (v) => player.seek(Duration(seconds: v.round())) : null,
                onChangeEnd: canControl ? (v) => _act(() => api.post('$base/state', {'playing': playing, 'position': v})) : null,
              ),
              Row(children: [Text(_clock(position), style: body(12, color: faint)), const Spacer(), Text(_clock(intOf(track['duration'])), style: body(12, color: faint))]),
              const SizedBox(height: 8),
              if (canControl)
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  RoundIcon(
                    icon: playing ? LucideIcons.pause : LucideIcons.play,
                    size: 58,
                    filled: true,
                    color: Colors.white,
                    onTap: () => _act(() => api.post('$base/state', {'playing': !playing, 'position': expected})),
                  ),
                  const SizedBox(width: 14),
                  RoundIcon(icon: LucideIcons.skipForward, onTap: () => _act(() => api.post('$base/next'))),
                ])
              else
                GhostButton(
                  label: synced ? tr('Синхронно з ведучим') : tr('Увімкнути синхронізацію'),
                  icon: LucideIcons.headphones,
                  color: synced ? green : ink,
                  onPressed: () {
                    setState(() => synced = !synced);
                    _sync();
                  },
                ),
            ],
          ]),
        ),
        if (!ended) ...[
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: GhostButton(
                label: tr('Посилання'),
                icon: LucideIcons.copy,
                compact: true,
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: text(p['url']) ?? ''));
                  if (context.mounted) toast(context, tr('Посилання скопійовано'));
                },
              ),
            ),
            const SizedBox(width: 8),
            Expanded(child: PrimaryButton(label: tr('Запросити'), icon: LucideIcons.userPlus, compact: true, onPressed: _invite)),
          ]),
        ],
        SectionLabel(tr('Черга'), trailing: '${queue.length}'),
        if (queue.isEmpty) QuietEmpty(icon: LucideIcons.listMusic, text: tr('Черга порожня. Знайдіть трек нижче — додати може кожен.')),
        for (var i = 0; i < queue.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Glass(
              padding: const EdgeInsets.all(10),
              radius: 16,
              child: Row(children: [
                SizedBox(width: 24, child: Text('${i + 1}', style: body(12, color: faint))),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(text(mapOf(queue[i]['track'])['title']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14)),
                    Text('${mapOf(queue[i]['track'])['artist'] ?? ''}${queue[i]['by'] != null ? ' · ${mapOf(queue[i]['by'])['name']}' : ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
                  ]),
                ),
                if (!ended && (canControl || mapOf(queue[i]['by'])['id'] == me?['id']))
                  IconButton(
                    icon: const Icon(LucideIcons.trash2, size: 17, color: faint),
                    onPressed: () => _act(() => api.delete('$base/queue/${queue[i]['index']}')),
                  ),
              ]),
            ),
          ),
        if (!ended) ...[
          const SizedBox(height: 6),
          GcField(
            controller: search,
            label: tr('Знайти трек на GameCon'),
            icon: LucideIcons.search,
            dense: true,
            onChanged: (_) {
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 300), _search);
            },
          ),
          const SizedBox(height: 8),
          for (final t in results)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: text(t['cover_url']) != null
                  ? NetImage(text(t['cover_url']), width: 42, height: 42, radius: 10)
                  : Container(width: 42, height: 42, decoration: BoxDecoration(color: raised, borderRadius: BorderRadius.circular(10)), child: const Icon(LucideIcons.music2, color: faint, size: 18)),
              title: Text(text(t['title']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14)),
              subtitle: Text('${t['artist'] ?? ''} · ${_clock(intOf(t['duration']))}', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
              trailing: const Icon(LucideIcons.plus, color: primary),
              onTap: () async {
                await _act(() => api.post('$base/queue', {'track_id': t['id']}));
                if (context.mounted) toast(context, tr('«{v}» у черзі', {'v': t['title']}));
              },
            ),
        ],
        SectionLabel(tr('Слухають'), trailing: '${members.length}'),
        Glass(
          child: Column(children: [
            for (final m in members)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(children: [
                  Avatar(url: text(m['avatar_url']), name: text(m['name']) ?? '?', size: 36),
                  const SizedBox(width: 10),
                  Expanded(child: Text(text(m['name']) ?? '', style: body(14))),
                  if (m['is_host'] == true) const Icon(LucideIcons.crown, size: 16, color: gold),
                ]),
              ),
          ]),
        ),
        if (p['is_host'] == true && !ended) ...[
          const SizedBox(height: 12),
          Glass(
            child: Column(children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: state['shared_control'] == true,
                activeThumbColor: primary,
                title: Text(tr('Керувати можуть усі'), style: body(14)),
                onChanged: (v) => _act(() => api.post('$base/shared', {'shared': v})),
              ),
              DangerButton(
                label: tr('Завершити для всіх'),
                icon: LucideIcons.x,
                onPressed: () async {
                  if (await confirm(context, tr('Завершити для всіх?'), danger: true, action: tr('Завершити'))) {
                    await _act(() async {
                      await api.delete(base);
                      return {'ended': true};
                    });
                  }
                },
              ),
            ]),
          ),
        ],
      ],
    );
  }
}
