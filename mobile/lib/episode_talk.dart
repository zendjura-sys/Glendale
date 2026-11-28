import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Оцінки й обговорення серії без спойлерів (№271), як на сайті: коментарі видно, коли серію
/// позначено переглянутою (або людина сама натисне «Показати»).
Future<void> showEpisodeTalk(BuildContext context, {required String slug, required int season, required int episode, required String title}) {
  return showGcSheet<void>(context, title: title, builder: (_) => EpisodeTalk(slug: slug, season: season, episode: episode));
}

class EpisodeTalk extends StatefulWidget {
  const EpisodeTalk({required this.slug, required this.season, required this.episode, super.key});
  final String slug;
  final int season;
  final int episode;

  @override
  State<EpisodeTalk> createState() => _EpisodeTalkState();
}

class _EpisodeTalkState extends State<EpisodeTalk> {
  Map<String, dynamic>? state;
  final input = TextEditingController();
  bool busy = false;

  String get _base => Api.site('/cinema/${widget.slug}/episodes/${widget.season}/${widget.episode}');

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _run(() => AppScope.read(context).session.api.get('$_base/talk')));
  }

  @override
  void dispose() {
    input.dispose();
    super.dispose();
  }

  Future<void> _run(Future<Map<String, dynamic>> Function() call) async {
    setState(() => busy = true);
    try {
      final r = await call();
      if (mounted) setState(() => state = r);
    } catch (e) {
      if (mounted) toast(context, e, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    final s = state;
    if (s == null) return const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()));
    final mine = s['mine'] is int ? s['mine'] as int : null;
    final comments = s['comments'] is List ? maps(s['comments']) : null;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      Row(children: [
        for (var i = 1; i <= 5; i++)
          IconButton(
            tooltip: tr('Оцінка {n}', {'n': i}),
            onPressed: busy ? null : () => _run(() => api.post('$_base/rate', {'score': i})),
            icon: Icon(LucideIcons.star, color: mine != null && i <= mine ? const Color(0xFFFFC857) : faint),
          ),
        const Spacer(),
        if (s['avg'] != null) Text(tr('{avg} · оцінок: {n}', {'avg': s['avg'], 'n': s['votes']}), style: body(13, color: muted)),
      ]),
      const SizedBox(height: 8),
      if (comments == null)
        Glass(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(tr('Обговорення приховано, щоб не було спойлерів. Коментарів: {n}', {'n': s['count']}), style: body(13.5, color: soft)),
            const SizedBox(height: 10),
            GhostButton(label: tr('Показати все одно'), icon: LucideIcons.eye, onPressed: busy ? null : () => _run(() => api.get('$_base/talk?reveal=1'))),
          ]),
        )
      else ...[
        Row(children: [
          Expanded(child: GcField(controller: input, label: tr('Що думаєте про серію?'), dense: true)),
          const SizedBox(width: 8),
          PrimaryButton(
            label: tr('Надіслати'),
            compact: true,
            expand: false,
            busy: busy,
            onPressed: () async {
              final body = input.text.trim();
              if (body.length < 2) return;
              await _run(() => api.post('$_base/comments', {'body': body}));
              input.clear();
            },
          ),
        ]),
        const SizedBox(height: 10),
        if (comments.isEmpty) Text(tr('Поки ніхто не обговорював цю серію.'), style: body(13, color: muted)),
        for (final c in comments)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Avatar(url: text(mapOf(c['user'])['avatar_url']), name: text(mapOf(c['user'])['name']) ?? '', size: 30),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${text(mapOf(c['user'])['name']) ?? ''} · ${ago(c['created_at'])}', style: body(12, color: faint)),
                  const SizedBox(height: 2),
                  Text(text(c['body']) ?? '', style: body(14, color: soft)),
                ]),
              ),
              if (c['mine'] == true)
                IconButton(
                  tooltip: tr('Видалити'),
                  onPressed: busy ? null : () => _run(() => api.delete('$_base/comments/${c['id']}')),
                  icon: Icon(LucideIcons.trash2, size: 16, color: faint),
                ),
            ]),
          ),
      ],
    ]);
  }
}
