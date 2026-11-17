import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'voice_room.dart';
import 'widgets.dart';
import 'skeletons.dart';

/// LiveCast — нативні відеостріми (окремо від GameCast).
class LiveCastScreen extends StatefulWidget {
  const LiveCastScreen({super.key});

  @override
  State<LiveCastScreen> createState() => _LiveCastScreenState();
}

class _LiveCastScreenState extends State<LiveCastScreen> {
  Map<String, dynamic>? page;

  Api get api => AppScope.read(context).session.api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final data = await api.get(Api.site('/livecast'));
      if (mounted) setState(() => page = data);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _start() async {
    final title = TextEditingController();
    final category = TextEditingController();
    final id = await showGcSheet<int>(
      context,
      title: 'LiveCast',
      subtitle: tr('Стрім камерою або екраном через VoiceKit.'),
      builder: (sheet) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(controller: title, autofocus: true, maxLength: 80, decoration: InputDecoration(hintText: tr('Назва стріму'), counterText: '')),
          const SizedBox(height: 10),
          TextField(controller: category, maxLength: 60, decoration: InputDecoration(hintText: tr('Категорія (необов’язково)'), counterText: '')),
          const SizedBox(height: 14),
          PrimaryButton(
            label: tr('Почати стрім'),
            icon: LucideIcons.radio,
            onPressed: () async {
              final name = title.text.trim();
              if (name.length < 3) {
                toast(sheet, tr('Назва має бути щонайменше 3 символи.'));
                return;
              }
              try {
                final created = await api.post(Api.site('/livecast'), {
                  'title': name,
                  if (category.text.trim().isNotEmpty) 'category': category.text.trim(),
                });
                if (sheet.mounted) Navigator.pop(sheet, intOf(mapOf(created['broadcast'])['id']));
              } catch (e) {
                if (sheet.mounted) toast(sheet, e);
              }
            },
          ),
        ],
      ),
    );
    title.dispose();
    category.dispose();
    await _load();
    if (id != null && mounted) context.push('/livecast/$id');
  }

  @override
  Widget build(BuildContext context) {
    final data = page;
    if (data == null) return const ScreenSkeleton();
    final live = maps(data['live']);
    final pulse = mapOf(data['pulse']);

    return ScreenScroll(
      onRefresh: _load,
      children: [
        PageTitle(
          'LiveCast',
          subtitle: tr('{n} в ефірі · {v} дивляться', {'n': '${intOf(pulse['live'])}', 'v': '${intOf(pulse['viewers'])}'}),
          trailing: RoundIcon(icon: LucideIcons.plus, onTap: _start),
        ),
        if (live.isEmpty)
          EmptyState(icon: LucideIcons.video, title: tr('Поки ніхто не стрімить'), text: tr('Почніть свій ефір — камера або екран.'))
        else
          for (final b in live)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Glass(
                radius: 18,
                padding: const EdgeInsets.all(12),
                onTap: () => context.push('/livecast/${intOf(b['id'])}'),
                child: Row(
                  children: [
                    Avatar(url: text(mapOf(b['host'])['avatar_url']), name: text(mapOf(b['host'])['name']) ?? '?', size: 48),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(color: danger, borderRadius: BorderRadius.circular(6)),
                              child: Text('LIVE', style: body(10, weight: FontWeight.w800, color: Colors.white)),
                            ),
                            const SizedBox(width: 8),
                            Icon(LucideIcons.users, size: 14, color: muted),
                            const SizedBox(width: 4),
                            Text('${intOf(b['viewers'])}', style: body(12, color: muted)),
                          ]),
                          const SizedBox(height: 4),
                          Text(text(b['title']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(15, weight: FontWeight.w700)),
                          Text(
                            [text(mapOf(b['host'])['name']), text(b['category'])].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: body(12, color: muted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
      ],
    );
  }
}

class LiveCastShowScreen extends StatefulWidget {
  const LiveCastShowScreen({required this.id, super.key});
  final int id;

  @override
  State<LiveCastShowScreen> createState() => _LiveCastShowScreenState();
}

class _LiveCastShowScreenState extends State<LiveCastShowScreen> {
  Map<String, dynamic>? state;
  Timer? _poll;
  final chat = TextEditingController();

  Api get api => AppScope.read(context).session.api;
  VoiceCall get voice => VoiceCall.instance;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    _poll = Timer.periodic(const Duration(seconds: 3), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _poll?.cancel();
    chat.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    try {
      final data = await api.get(Api.site('/livecast/${widget.id}/state'));
      if (mounted) setState(() => state = data);
    } catch (e) {
      if (!silent && mounted) toast(context, e);
    }
  }

  Future<void> _join({required bool host}) async {
    final stream = mapOf(state?['broadcast']);
    final title = text(stream['title']) ?? 'LiveCast';
    await voice.broadcast(api, widget.id, title, onError: (e) {
      if (mounted) toast(context, e);
    });
    if (host && mounted) {
      final hint = await voice.toggleCamera();
      if (hint != null && mounted) toast(context, hint);
    }
  }

  Future<void> _send() async {
    final body = chat.text.trim();
    if (body.isEmpty) return;
    chat.clear();
    try {
      final data = await api.post(Api.site('/livecast/${widget.id}/messages'), {'body': body});
      if (mounted) setState(() => state = data);
    } catch (e) {
      if (mounted) {
        chat.text = body;
        toast(context, e);
      }
    }
  }

  Future<void> _end() async {
    try {
      final data = await api.post(Api.site('/livecast/${widget.id}/end'));
      await voice.leave();
      if (mounted) setState(() => state = data);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = state;
    if (data == null) return const ScreenSkeleton();
    final stream = mapOf(data['broadcast']);
    final me = mapOf(data['me']);
    final messages = maps(data['messages']);
    final live = text(stream['status']) == 'live';
    final host = me['is_host'] == true;
    final inStream = voice.kind == 'broadcast' && voice.roomId == widget.id && voice.active;

    return ScreenScroll(
      onRefresh: _load,
      children: [
        PageTitle(
          text(stream['title']) ?? 'LiveCast',
          subtitle: live ? tr('{n} дивляться', {'n': '${intOf(stream['viewers'])}'}) : tr('Стрім завершено'),
        ),
        if (!inStream && live)
          PrimaryButton(
            label: host ? tr('Вийти в ефір') : tr('Дивитись'),
            icon: LucideIcons.radio,
            onPressed: () => _join(host: host),
          ),
        if (inStream && host) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              GhostButton(label: voice.micOn ? tr('Мікрофон') : tr('Мікрофон вимк.'), icon: voice.micOn ? LucideIcons.mic : LucideIcons.micOff, compact: true, onPressed: () => voice.toggleMic()),
              GhostButton(
                label: voice.cameraOn ? tr('Камера') : tr('Камера вимк.'),
                icon: voice.cameraOn ? LucideIcons.video : LucideIcons.videoOff,
                compact: true,
                onPressed: () async {
                  final hint = await voice.toggleCamera();
                  if (hint != null && context.mounted) toast(context, hint);
                },
              ),
              GhostButton(
                label: tr('Екран'),
                icon: LucideIcons.monitorUp,
                compact: true,
                onPressed: () async {
                  final hint = await voice.toggleScreenShare();
                  if (hint != null && context.mounted) toast(context, hint);
                },
              ),
              GhostButton(label: tr('Завершити'), icon: LucideIcons.logOut, compact: true, onPressed: _end),
            ],
          ),
        ],
        if (inStream && !host)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: GhostButton(label: tr('Вийти'), icon: LucideIcons.logOut, onPressed: () => voice.leave()),
          ),
        const SizedBox(height: 16),
        SectionLabel(tr('Чат стріму')),
        for (final m in messages)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Avatar(url: text(mapOf(m['user'])['avatar_url']), name: text(mapOf(m['user'])['name']) ?? '?', size: 28),
                const SizedBox(width: 8),
                Expanded(
                  child: Text.rich(
                    TextSpan(children: [
                      TextSpan(text: '${text(mapOf(m['user'])['name']) ?? '…'} ', style: body(13, weight: FontWeight.w700)),
                      TextSpan(text: text(m['body']) ?? '', style: body(13, color: ink.withValues(alpha: 0.85))),
                    ]),
                  ),
                ),
              ],
            ),
          ),
        if (live) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: chat,
                  decoration: InputDecoration(hintText: tr('Повідомлення…')),
                  onSubmitted: (_) => _send(),
                ),
              ),
              const SizedBox(width: 8),
              RoundIcon(icon: LucideIcons.send, onTap: _send),
            ],
          ),
        ],
      ],
    );
  }
}
