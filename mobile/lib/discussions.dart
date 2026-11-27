import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'core/widgets/arctic_glass/arctic_glass.dart';
import 'i18n.dart';
import 'skeletons.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// «Обговорення»: загальний розділ із категоріями або теми про предмет (фільм, гру, сервер, сім’ю,
/// клан, спільноту, статтю) — subject. Розділ теми обирається під час створення.
class DiscussionsScreen extends StatefulWidget {
  const DiscussionsScreen({this.subjectType, this.subjectId, this.subjectTitle, super.key});
  final String? subjectType;
  final int? subjectId;
  final String? subjectTitle;

  @override
  State<DiscussionsScreen> createState() => _DiscussionsScreenState();
}

class _DiscussionsScreenState extends State<DiscussionsScreen> {
  Map<String, dynamic>? data;
  String category = '';
  String sort = 'active';

  Api get api => AppScope.read(context).session.api;
  bool get subject => widget.subjectType != null;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => load());
  }

  Future<void> load() async {
    final q = subject ? 'type=${widget.subjectType}&id=${widget.subjectId}' : 'category=$category';
    try {
      final d = await api.get('/api/v1/discussions/list?$q&sort=$sort');
      if (mounted) setState(() => data = d);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> create() async {
    final categories = Map<String, dynamic>.from(mapOf(data?['categories']));
    final id = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _NewTopicSheet(api: api, subjectType: widget.subjectType, subjectId: widget.subjectId, categories: categories, category: category),
    );
    if (id != null && mounted) {
      await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => DiscussionThreadScreen(id: id)));
      await load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) return const ScreenSkeleton();
    final topics = maps(mapOf(d['discussions'])['data']);
    final categories = mapOf(d['categories']);
    return ScreenScroll(
      onRefresh: load,
      children: [
        PageTitle(
          subject ? tr('Обговорення') : tr('Обговорення'),
          subtitle: subject ? (widget.subjectTitle ?? text(mapOf(d['subject'])['title'])) : tr('Кіно, серіали, аніме, ігри, музика й усе інше'),
          trailing: PrimaryButton(label: tr('Нова тема'), icon: LucideIcons.plus, compact: true, expand: false, onPressed: create),
        ),
        if (!subject)
          SizedBox(
            height: 38,
            child: ListView(scrollDirection: Axis.horizontal, children: [
              for (final e in [MapEntry('', tr('Усе')), ...categories.entries])
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: SelectPill(label: '${e.value}', selected: category == e.key, onTap: () {
                    setState(() => category = e.key);
                    unawaited(load());
                  }),
                ),
            ]),
          ),
        const SizedBox(height: 8),
        Row(children: [
          for (final s in const [('active', 'Активні'), ('new', 'Нові'), ('top', 'Найкращі')])
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: SelectPill(label: tr(s.$2), selected: sort == s.$1, onTap: () {
                setState(() => sort = s.$1);
                unawaited(load());
              }),
            ),
        ]),
        const SizedBox(height: 10),
        if (topics.isEmpty)
          Padding(padding: const EdgeInsets.symmetric(vertical: 30), child: Text(tr('Тем ще немає — почніть першу.'), textAlign: TextAlign.center, style: body(14, color: muted))),
        for (final t in topics) ...[
          Glass(
            onTap: () async {
              await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => DiscussionThreadScreen(id: intOf(t['id']))));
              await load();
            },
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Avatar(name: text(mapOf(t['user'])['name']) ?? '?', url: text(mapOf(t['user'])['avatar_url']), size: 38),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    if (t['is_pinned'] == true) const Padding(padding: EdgeInsets.only(right: 4), child: Icon(LucideIcons.pin, size: 14, color: Color(0xFFFCD34D))),
                    if (t['is_locked'] == true) Padding(padding: const EdgeInsets.only(right: 4), child: Icon(LucideIcons.lock, size: 14, color: muted)),
                    Expanded(child: Text(text(t['title']) ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(15, weight: FontWeight.w600))),
                  ]),
                  if (text(t['excerpt']) != null && t['spoiler'] != true)
                    Text(text(t['excerpt'])!, maxLines: 2, overflow: TextOverflow.ellipsis, style: body(13, color: soft)),
                  const SizedBox(height: 4),
                  Text(
                    '${text(mapOf(t['user'])['name']) ?? ''}${subject ? '' : ' · ${text(t['category_label']) ?? ''}'} · 💬 ${intOf(t['replies_count'])} · ♥ ${intOf(t['likes_count'])}',
                    style: body(12, color: muted),
                  ),
                ]),
              ),
            ]),
          ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _NewTopicSheet extends StatefulWidget {
  const _NewTopicSheet({required this.api, required this.categories, required this.category, this.subjectType, this.subjectId});
  final Api api;
  final String? subjectType;
  final int? subjectId;
  final Map<String, dynamic> categories;
  final String category;

  @override
  State<_NewTopicSheet> createState() => _NewTopicSheetState();
}

class _NewTopicSheetState extends State<_NewTopicSheet> {
  final title = TextEditingController();
  final bodyText = TextEditingController();
  late String cat = widget.category.isNotEmpty ? widget.category : (widget.subjectType != null ? '' : 'general');
  bool spoiler = false;
  bool busy = false;

  @override
  void dispose() {
    title.dispose();
    bodyText.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    setState(() => busy = true);
    try {
      final r = await widget.api.post('/api/v1/discussions', {
        if (widget.subjectType != null) 'type': widget.subjectType,
        if (widget.subjectId != null) 'id': widget.subjectId,
        'category': cat.isEmpty ? null : cat,
        'title': title.text.trim(),
        'body': bodyText.text.trim().isEmpty ? null : bodyText.text.trim(),
        'spoiler': spoiler,
      });
      if (mounted) Navigator.pop(context, intOf(mapOf(r['discussion'])['id']));
    } catch (e) {
      if (mounted) toast(context, e);
    }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: ArcticGlassSheetSurface(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(tr('Нова тема'), style: display(18)),
            const SizedBox(height: 12),
            TextField(controller: title, maxLength: 160, style: body(15), decoration: InputDecoration(hintText: tr('Тема (від 4 символів)'))),
            TextField(controller: bodyText, maxLines: 5, minLines: 3, maxLength: 10000, style: body(14), decoration: InputDecoration(hintText: tr('Що хочете обговорити?'))),
            const SizedBox(height: 6),
            Text(tr('Розділ'), style: body(13, color: muted)),
            const SizedBox(height: 6),
            Wrap(spacing: 6, runSpacing: 6, children: [
              if (widget.subjectType != null) SelectPill(label: tr('Автоматично'), selected: cat.isEmpty, onTap: () => setState(() => cat = '')),
              for (final e in widget.categories.entries) SelectPill(label: '${e.value}', selected: cat == e.key, onTap: () => setState(() => cat = e.key)),
            ]),
            SwitchListTile(contentPadding: EdgeInsets.zero, value: spoiler, onChanged: (v) => setState(() => spoiler = v), title: Text(tr('Спойлер'), style: body(14))),
            PrimaryButton(label: tr('Створити'), busy: busy, onPressed: () => title.text.trim().length >= 4 ? unawaited(submit()) : toast(context, tr('Тема — від 4 символів.'))),
          ]),
        ),
      ),
    );
  }
}

/// Тема: текст, вподобайка, відповіді (з відповіддю на відповідь), спойлери під розмиттям.
class DiscussionThreadScreen extends StatefulWidget {
  const DiscussionThreadScreen({required this.id, super.key});
  final int id;

  @override
  State<DiscussionThreadScreen> createState() => _DiscussionThreadScreenState();
}

class _DiscussionThreadScreenState extends State<DiscussionThreadScreen> {
  Map<String, dynamic>? data;
  final input = TextEditingController();
  Map<String, dynamic>? replyTo;
  final shown = <int>{};

  Api get api => AppScope.read(context).session.api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => load());
  }

  @override
  void dispose() {
    input.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final d = await api.get('/api/v1/discussions/${widget.id}');
      if (mounted) setState(() => data = d);
    } catch (e) {
      if (mounted) {
        toast(context, e);
        Navigator.pop(context);
      }
    }
  }

  Future<void> act(Future<dynamic> Function() action) async {
    if (await attempt(context, action)) await load();
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    final t = mapOf(d?['discussion']);
    final replies = maps(mapOf(d?['replies'])['data']);
    final subject = mapOf(d?['subject']);
    return Scaffold(
      backgroundColor: abyss,
      appBar: AppBar(backgroundColor: Colors.transparent, title: Text(tr('Обговорення'), style: body(16, weight: FontWeight.w600))),
      body: d == null
          ? const ScreenSkeleton()
          : Column(children: [
              Expanded(
                child: RefreshIndicator(
                  onRefresh: load,
                  child: ListView(padding: const EdgeInsets.all(14), children: [
                    Text(text(t['title']) ?? '', style: display(20)),
                    const SizedBox(height: 4),
                    Text(
                      '${text(mapOf(t['user'])['name']) ?? ''} · ${subject.isNotEmpty ? '${text(subject['label'])}: ${text(subject['title'])}' : text(t['category_label']) ?? ''} · 👁 ${intOf(t['views_count'])}',
                      style: body(12.5, color: muted),
                    ),
                    if (text(t['body']) != null) ...[
                      const SizedBox(height: 10),
                      _Spoiler(hidden: t['spoiler'] == true && !shown.contains(0), onReveal: () => setState(() => shown.add(0)), child: Text(text(t['body'])!, style: body(15, color: soft).copyWith(height: 1.45))),
                    ],
                    const SizedBox(height: 10),
                    Row(children: [
                      GhostButton(
                        label: '${intOf(t['likes_count'])}',
                        icon: t['liked'] == true ? LucideIcons.heartHandshake : LucideIcons.heart,
                        compact: true,
                        expand: false,
                        iconColor: t['liked'] == true ? const Color(0xFFFB7185) : null,
                        onPressed: () => act(() => api.post('/api/v1/discussions/${widget.id}/like')),
                      ),
                      const Spacer(),
                      if (t['can_edit'] == true)
                        GhostButton(
                          label: tr('Видалити'),
                          icon: LucideIcons.trash2,
                          compact: true,
                          expand: false,
                          onPressed: () async {
                            if (await confirm(context, tr('Видалити тему?'), danger: true) && context.mounted && await attempt(context, () => api.delete('/api/v1/discussions/${widget.id}')) && context.mounted) Navigator.pop(context);
                          },
                        ),
                    ]),
                    const Divider(height: 28),
                    if (replies.isEmpty) Text(tr('Відповідей ще немає — будьте першим.'), style: body(14, color: muted)),
                    for (final r in replies) ...[
                      Glass(
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Avatar(name: text(mapOf(r['user'])['name']) ?? '?', url: text(mapOf(r['user'])['avatar_url']), size: 32),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(text(mapOf(r['user'])['name']) ?? '', style: body(13.5, weight: FontWeight.w600)),
                              if (r['parent'] is Map)
                                Padding(
                                  padding: const EdgeInsets.only(top: 3, bottom: 3),
                                  child: Text('↪ ${text(mapOf(r['parent'])['author']) ?? ''}: ${text(mapOf(r['parent'])['body']) ?? tr('видалена відповідь')}', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
                                ),
                              _Spoiler(hidden: r['spoiler'] == true && !shown.contains(intOf(r['id'])), onReveal: () => setState(() => shown.add(intOf(r['id']))), child: Text(text(r['body']) ?? '', style: body(14, color: soft))),
                              const SizedBox(height: 4),
                              Row(children: [
                                InkWell(
                                  onTap: () => act(() => api.post('/api/v1/discussions/${widget.id}/replies/${intOf(r['id'])}/like')),
                                  child: Text('♥ ${intOf(r['likes_count'])}', style: body(12.5, color: r['liked'] == true ? const Color(0xFFFB7185) : muted)),
                                ),
                                const SizedBox(width: 14),
                                if (t['is_locked'] != true) InkWell(onTap: () => setState(() => replyTo = r), child: Text(tr('Відповісти'), style: body(12.5, color: muted))),
                                const SizedBox(width: 14),
                                if (r['can_delete'] == true)
                                  InkWell(onTap: () => act(() => api.delete('/api/v1/discussions/${widget.id}/replies/${intOf(r['id'])}')), child: Text(tr('Видалити'), style: body(12.5, color: muted))),
                              ]),
                            ]),
                          ),
                        ]),
                      ),
                      const SizedBox(height: 8),
                    ],
                  ]),
                ),
              ),
              if (t['is_locked'] == true)
                Padding(padding: const EdgeInsets.all(16), child: Text(tr('Тему закрито.'), style: body(14, color: muted)))
              else
                SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      if (replyTo != null)
                        Row(children: [
                          Expanded(child: Text(tr('Відповідь для {name}', {'name': text(mapOf(replyTo!['user'])['name']) ?? ''}), style: body(12.5, color: muted))),
                          IconButton(onPressed: () => setState(() => replyTo = null), icon: const Icon(LucideIcons.x, size: 16)),
                        ]),
                      Row(children: [
                        Expanded(child: TextField(controller: input, minLines: 1, maxLines: 4, style: body(14), decoration: InputDecoration(hintText: tr('Ваша відповідь…')))),
                        IconButton(
                          icon: const Icon(LucideIcons.sendHorizontal),
                          onPressed: () async {
                            final textBody = input.text.trim();
                            if (textBody.isEmpty) return;
                            if (await attempt(context, () => api.post('/api/v1/discussions/${widget.id}/replies', {'body': textBody, 'parent_id': replyTo == null ? null : intOf(replyTo!['id'])}))) {
                              input.clear();
                              setState(() => replyTo = null);
                              await load();
                            }
                          },
                        ),
                      ]),
                    ]),
                  ),
                ),
            ]),
    );
  }
}

class _Spoiler extends StatelessWidget {
  const _Spoiler({required this.hidden, required this.onReveal, required this.child});
  final bool hidden;
  final VoidCallback onReveal;
  final Widget child;

  @override
  Widget build(BuildContext context) => hidden
      ? InkWell(onTap: onReveal, child: Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: Colors.white.withValues(alpha: .06), borderRadius: BorderRadius.circular(10)), child: Text(tr('Спойлер — натисніть, щоб показати'), style: body(13, color: muted))))
      : child;
}

/// Відкрити обговорення предмета окремим екраном.
void openDiscussions(BuildContext context, String type, int id, {String? title}) {
  unawaited(Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => Scaffold(
        backgroundColor: abyss,
        appBar: AppBar(backgroundColor: Colors.transparent, title: Text(title ?? tr('Обговорення'), style: body(16, weight: FontWeight.w600))),
        body: DiscussionsScreen(subjectType: type, subjectId: id, subjectTitle: title),
      ))));
}

/// Кнопка «Обговорення» для сторінок фільму, гри, сервера, сім’ї, клану, спільноти й статті.
class DiscussionsButton extends StatelessWidget {
  const DiscussionsButton({required this.type, required this.id, this.title, super.key});
  final String type;
  final int id;
  final String? title;

  @override
  Widget build(BuildContext context) {
    final modules = AppScope.read(context).session.modules;
    if (modules != null && !modules.contains('discussions')) return const SizedBox.shrink();
    return GhostButton(
      label: tr('Обговорення'),
      icon: LucideIcons.messagesSquare,
      compact: true,
      onPressed: () => openDiscussions(context, type, id, title: title),
    );
  }
}
