import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'core/widgets/arctic_glass/arctic_glass.dart';
import 'i18n.dart';
import 'posts.dart';
import 'skeletons.dart';
import 'state.dart';
import 'theme.dart';
import 'voice_room.dart';
import 'widgets.dart';

// Розділи сайту, яких бракувало застосунку (1:1 з сайтом, той самий міст `/api/v1/site/*`):
// теми (#тег), статті, знижки й роздачі, беклог ігор, вікі, календар і канали спільнот,
// генератор ніків, посилання в профілі, тип акаунта, мем-мейкер і піксельна аватарка.

String _date(dynamic iso, {bool time = true}) {
  final at = DateTime.tryParse(text(iso) ?? '')?.toLocal();
  if (at == null) return '';
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(at.day)}.${two(at.month)}.${at.year}${time ? ' ${two(at.hour)}:${two(at.minute)}' : ''}';
}

// ───────────────────────── Теми (#тег) ─────────────────────────

class TopicScreen extends StatefulWidget {
  const TopicScreen({required this.tag, super.key});
  final String tag;

  @override
  State<TopicScreen> createState() => _TopicScreenState();
}

class _TopicScreenState extends State<TopicScreen> {
  bool? following;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/t/${Uri.encodeComponent(widget.tag)}')),
      builder: (d, reload) {
        final posts = maps(mapOf(d['posts'])['data']);
        final on = following ?? d['following'] == true;
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle('#${widget.tag}', subtitle: tr('Публічні записи з цим тегом.')),
            Align(
              alignment: Alignment.centerLeft,
              child: on
                  ? GhostButton(label: tr('Ви стежите'), icon: LucideIcons.check, expand: false, compact: true, onPressed: () => _toggle(api))
                  : PrimaryButton(label: tr('Стежити за темою'), icon: LucideIcons.plus, expand: false, compact: true, onPressed: () => _toggle(api)),
            ),
            const SizedBox(height: 12),
            if (posts.isEmpty) EmptyState(icon: LucideIcons.hash, title: tr('Поки що тут порожньо'), text: tr('Додайте #{tag} у свій запис — і він з’явиться тут.', {'tag': widget.tag})),
            for (final post in posts) Padding(padding: const EdgeInsets.only(bottom: 12), child: PostCard(key: ValueKey('post-${post['id']}'), post: post)),
          ],
        );
      },
    );
  }

  Future<void> _toggle(Api api) async {
    try {
      final r = await api.post(Api.site('/t/${Uri.encodeComponent(widget.tag)}/follow'));
      if (mounted) setState(() => following = r['following'] == true);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }
}

// ───────────────────────── Статті ─────────────────────────

class ArticlesScreen extends StatelessWidget {
  const ArticlesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/articles')),
      builder: (d, reload) {
        final list = maps(mapOf(d['articles'])['data']);
        final drafts = maps(d['drafts']);
        Future<void> write() async {
          final done = await context.push<bool>('/articles/new');
          if (done == true) await reload();
        }

        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Статті'), subtitle: tr('Огляди, історії й гайди від гравців.')),
            Align(alignment: Alignment.centerLeft, child: PrimaryButton(label: tr('Написати статтю'), icon: LucideIcons.penLine, expand: false, compact: true, onPressed: write)),
            const SizedBox(height: 12),
            if (drafts.isNotEmpty) ...[
              SectionLabel(tr('Мої чернетки')),
              for (final a in drafts) Padding(padding: const EdgeInsets.only(bottom: 10), child: _ArticleTile(article: a, onChanged: reload)),
            ],
            if (list.isEmpty) EmptyState(icon: LucideIcons.bookOpen, title: tr('Статей поки немає'), text: tr('Напишіть першу — огляд гри чи гайд.')),
            for (final a in list) Padding(padding: const EdgeInsets.only(bottom: 10), child: _ArticleTile(article: a, onChanged: reload)),
          ],
        );
      },
    );
  }
}

class _ArticleTile extends StatelessWidget {
  const _ArticleTile({required this.article, required this.onChanged});
  final Map<String, dynamic> article;
  final Future<void> Function() onChanged;

  @override
  Widget build(BuildContext context) {
    final cover = text(article['cover']);
    return Glass(
      padding: EdgeInsets.zero,
      onTap: () async {
        await context.push('/articles/${article['slug']}');
        await onChanged();
      },
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (cover != null) ClipRRect(borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadii.card)), child: AspectRatio(aspectRatio: 16 / 8, child: NetImage(cover))),
        Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(text(article['title']) ?? '', style: body(16, weight: FontWeight.w700)),
            if (text(article['excerpt']) case final e?) Padding(padding: const EdgeInsets.only(top: 4), child: Text(e, maxLines: 3, overflow: TextOverflow.ellipsis, style: body(13.5, color: soft))),
            const SizedBox(height: 8),
            Text(
              [
                if (article['is_published'] != true) tr('Чернетка'),
                text(mapOf(article['game'])['name']),
                tr('{n} хв читання', {'n': '${article['reading_minutes'] ?? 1}'}),
                _date(article['published_at'], time: false),
              ].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
              style: body(12, color: faint),
            ),
          ]),
        ),
      ]),
    );
  }
}

class ArticleScreen extends StatelessWidget {
  const ArticleScreen({required this.slug, super.key});
  final String slug;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/articles/$slug')),
      builder: (d, reload) {
        final a = mapOf(d['article']);
        final cover = text(a['cover']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            if (cover != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: ClipRRect(borderRadius: BorderRadius.circular(AppRadii.card), child: AspectRatio(aspectRatio: 16 / 9, child: NetImage(cover)))),
            Text(text(a['title']) ?? '', style: display(24)),
            const SizedBox(height: 6),
            Text(
              [text(mapOf(a['author'])['name']), _date(a['published_at'], time: false), tr('{n} хв читання', {'n': '${a['reading_minutes'] ?? 1}'})].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
              style: body(12.5, color: faint),
            ),
            if (d['can_edit'] == true)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Row(children: [
                  GhostButton(
                    label: tr('Редагувати'),
                    icon: LucideIcons.pencil,
                    expand: false,
                    compact: true,
                    onPressed: () async {
                      final done = await context.push<bool>('/articles/$slug/edit');
                      if (done == true) await reload();
                    },
                  ),
                  const SizedBox(width: 8),
                  if (d['can_delete'] == true)
                    GhostButton(
                      label: tr('Видалити'),
                      icon: LucideIcons.trash2,
                      color: dangerSoft,
                      expand: false,
                      compact: true,
                      onPressed: () async {
                        if (!await confirm(context, tr('Видалити статтю?'), action: tr('Видалити'), danger: true)) return;
                        if (!context.mounted) return;
                        if (await attempt(context, () => api.delete(Api.site('/articles/$slug'))) && context.mounted) context.pop();
                      },
                    ),
                ]),
              ),
            const SizedBox(height: 16),
            HtmlBlocks(html: text(a['html']) ?? ''),
          ],
        );
      },
    );
  }
}

/// Простий показ HTML статті (абзаци, заголовки, списки, цитати, код, зображення, жирний/курсив, посилання).
class HtmlBlocks extends StatelessWidget {
  const HtmlBlocks({required this.html, super.key});
  final String html;

  static String _decode(String s) => s.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&nbsp;', ' ');

  List<InlineSpan> _inline(String raw, TextStyle base) {
    final spans = <InlineSpan>[];
    final tag = RegExp(r'<(/?)(strong|b|em|i|code|a)(?:\s+href="([^"]*)")?[^>]*>|<br\s*/?>|<[^>]+>');
    var bold = 0, italic = 0, code = 0;
    String? href;
    var at = 0;
    void push(String t) {
      if (t.isEmpty) return;
      var style = base;
      if (bold > 0) style = style.copyWith(fontWeight: FontWeight.w700);
      if (italic > 0) style = style.copyWith(fontStyle: FontStyle.italic);
      if (code > 0) style = style.copyWith(fontFamily: 'monospace', backgroundColor: fg.withValues(alpha: 0.08));
      if (href != null) style = style.copyWith(color: accent, decoration: TextDecoration.underline);
      spans.add(TextSpan(text: _decode(t), style: style));
    }

    for (final m in tag.allMatches(raw)) {
      push(raw.substring(at, m.start));
      at = m.end;
      final whole = m.group(0)!;
      if (whole.startsWith('<br')) {
        spans.add(const TextSpan(text: '\n'));
        continue;
      }
      final close = m.group(1) == '/';
      switch (m.group(2)) {
        case 'strong' || 'b':
          bold += close ? -1 : 1;
        case 'em' || 'i':
          italic += close ? -1 : 1;
        case 'code':
          code += close ? -1 : 1;
        case 'a':
          href = close ? null : m.group(3);
      }
    }
    push(raw.substring(at));
    return spans;
  }

  @override
  Widget build(BuildContext context) {
    final blocks = RegExp(r'<(h[1-4]|p|li|blockquote|pre)[^>]*>(.*?)</\1>|<img[^>]*src="([^"]+)"[^>]*>', dotAll: true).allMatches(html);
    final children = <Widget>[];
    for (final m in blocks) {
      if (m.group(3) != null) {
        children.add(Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: ClipRRect(borderRadius: BorderRadius.circular(14), child: NetImage(m.group(3), fit: BoxFit.fitWidth))));
        continue;
      }
      final kind = m.group(1)!;
      final inner = m.group(2)!;
      if (inner.contains('<img')) {
        final src = RegExp(r'src="([^"]+)"').firstMatch(inner)?.group(1);
        if (src != null) children.add(Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: ClipRRect(borderRadius: BorderRadius.circular(14), child: NetImage(src, fit: BoxFit.fitWidth))));
        continue;
      }
      final style = switch (kind) {
        'h1' || 'h2' => display(20),
        'h3' || 'h4' => display(17),
        'pre' => body(13.5).copyWith(fontFamily: 'monospace'),
        _ => body(15.5, color: ink.withValues(alpha: 0.92)).copyWith(height: 1.55),
      };
      Widget line = Text.rich(TextSpan(children: _inline(inner, style)));
      if (kind == 'li') line = Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('•  ', style: style), Expanded(child: line)]);
      if (kind == 'blockquote' || kind == 'pre') {
        line = Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: fg.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(12)),
          child: line,
        );
      }
      children.add(Padding(padding: EdgeInsets.only(top: kind.startsWith('h') ? 14 : 4, bottom: 6), child: line));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children);
  }
}

/// Нова стаття або редагування своєї: назва, анотація, текст (Markdown), обкладинка, «опублікувати».
class ArticleEditScreen extends StatefulWidget {
  const ArticleEditScreen({this.slug, super.key});
  final String? slug;

  @override
  State<ArticleEditScreen> createState() => _ArticleEditScreenState();
}

class _ArticleEditScreenState extends State<ArticleEditScreen> {
  final title = TextEditingController();
  final excerpt = TextEditingController();
  final bodyText = TextEditingController();
  XFile? cover;
  bool publish = true;
  bool busy = false;
  bool loaded = false;

  @override
  void initState() {
    super.initState();
    if (widget.slug == null) {
      loaded = true;
    } else {
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        try {
          final d = await AppScope.read(context).session.api.get(Api.site('/articles/${widget.slug}/edit'));
          final a = mapOf(d['article']);
          title.text = text(a['title']) ?? '';
          excerpt.text = text(a['excerpt']) ?? '';
          bodyText.text = text(a['body']) ?? '';
          publish = a['is_published'] == true;
        } catch (e) {
          if (mounted) toast(context, e);
        }
        if (mounted) setState(() => loaded = true);
      });
    }
  }

  @override
  void dispose() {
    title.dispose();
    excerpt.dispose();
    bodyText.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final api = AppScope.read(context).session.api;
    setState(() => busy = true);
    final ok = await attempt(
      context,
      () async => api.upload(
        Api.site(widget.slug == null ? '/articles' : '/articles/${widget.slug}'),
        {'title': title.text.trim(), 'excerpt': excerpt.text.trim(), 'body': bodyText.text, 'publish': publish ? '1' : '0'},
        [if (cover != null) await http.MultipartFile.fromPath('cover', cover!.path, filename: cover!.name)],
      ),
      success: publish ? tr('Статтю опубліковано.') : tr('Чернетку збережено.'),
    );
    if (!mounted) return;
    setState(() => busy = false);
    if (ok) context.pop(true);
  }

  @override
  Widget build(BuildContext context) {
    if (!loaded) return const ScreenSkeleton();
    return ScreenScroll(children: [
      PageTitle(widget.slug == null ? tr('Нова стаття') : tr('Редагування статті'), subtitle: tr('Підтримується Markdown: ## заголовок, **жирний**, списки через «- ».')),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          GcField(controller: title, label: tr('Назва')),
          const SizedBox(height: 10),
          GcField(controller: excerpt, label: tr('Коротко про що (необов’язково)'), maxLines: 2),
          const SizedBox(height: 10),
          GcField(controller: bodyText, label: tr('Текст статті'), maxLines: 14),
          const SizedBox(height: 10),
          GhostButton(
            label: cover == null ? tr('Обкладинка') : tr('Обкладинку вибрано'),
            icon: LucideIcons.image,
            compact: true,
            onPressed: () async {
              final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 88);
              if (picked != null) setState(() => cover = picked);
            },
          ),
          const SizedBox(height: 8),
          Row(children: [Expanded(child: Text(tr('Опублікувати одразу'), style: body(14))), GcSwitch(value: publish, onChanged: (v) => setState(() => publish = v))]),
          const SizedBox(height: 12),
          PrimaryButton(label: publish ? tr('Опублікувати') : tr('Зберегти чернетку'), icon: LucideIcons.check, busy: busy, onPressed: _save),
        ]),
      ),
    ]);
  }
}

// ───────────────────────── Знижки й роздачі ─────────────────────────

class DealsScreen extends StatefulWidget {
  const DealsScreen({super.key});

  @override
  State<DealsScreen> createState() => _DealsScreenState();
}

class _DealsScreenState extends State<DealsScreen> {
  bool? subscribed;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/games/deals')),
      builder: (d, reload) {
        final giveaways = maps(d['giveaways']);
        final wishlist = maps(d['wishlist']);
        final on = subscribed ?? d['subscribed'] == true;
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Знижки й роздачі'), subtitle: tr('Безкоштовні ігри та ціни на ігри з вашого бажаного.')),
            Glass(
              child: Row(children: [
                Icon(LucideIcons.bellRing, color: accent),
                const SizedBox(width: 10),
                Expanded(child: Text(tr('Сповіщати про нові роздачі'), style: body(14.5, weight: FontWeight.w600))),
                GcSwitch(
                  value: on,
                  onChanged: (v) async {
                    setState(() => subscribed = v);
                    await attempt(context, () => api.post(Api.site('/games/deals/subscribe'), {'on': v}));
                  },
                ),
              ]),
            ),
            const SizedBox(height: 14),
            SectionLabel(tr('Роздачі')),
            if (giveaways.isEmpty) QuietEmpty(icon: LucideIcons.gift, text: tr('Зараз безкоштовних ігор немає.')),
            for (final g in giveaways)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Glass(
                  padding: EdgeInsets.zero,
                  onTap: text(g['url']) == null ? null : () => launchUrl(Uri.parse(text(g['url'])!), mode: LaunchMode.externalApplication),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    if (text(g['image']) case final img?) ClipRRect(borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadii.card)), child: AspectRatio(aspectRatio: 16 / 7, child: NetImage(img))),
                    Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(text(g['title']) ?? '', style: body(15.5, weight: FontWeight.w700)),
                        const SizedBox(height: 6),
                        Wrap(spacing: 8, runSpacing: 6, children: [
                          Pill(label: tr('Безкоштовно'), color: green),
                          if (text(g['store_label']) case final s?) Pill(label: s, color: muted),
                          if (text(g['worth']) case final w?) Pill(label: tr('Ціна була {w}', {'w': w}), color: muted),
                          if (g['ends_at'] != null) Pill(label: tr('До {d}', {'d': _date(g['ends_at'], time: false)}), icon: LucideIcons.clock, color: gold),
                        ]),
                      ]),
                    ),
                  ]),
                ),
              ),
            const SizedBox(height: 8),
            SectionLabel(tr('Бажане')),
            if (wishlist.isEmpty) QuietEmpty(icon: LucideIcons.heart, text: tr('Додайте гру в бажане на її сторінці — тут з’являться ціни.')),
            for (final w in wishlist)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Glass(
                  onTap: () => context.push('/games/${mapOf(w['game'])['slug']}'),
                  child: Row(children: [
                    ClipRRect(borderRadius: BorderRadius.circular(10), child: SizedBox(width: 48, height: 64, child: NetImage(text(mapOf(w['game'])['cover'])))),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(text(mapOf(w['game'])['name']) ?? '', style: body(15, weight: FontWeight.w700)),
                        const SizedBox(height: 4),
                        if (mapOf(w['best']).isNotEmpty)
                          Text(tr('Найкраща ціна: \${p} (було \${n})', {'p': '${mapOf(w['best'])['salePrice'] ?? ''}', 'n': '${mapOf(w['best'])['normalPrice'] ?? ''}'}), style: body(13, color: green))
                        else
                          Text(tr('Ціну ще шукаємо'), style: body(13, color: faint)),
                        if (w['target_price'] != null) Text(tr('Сповістимо, коли буде до \${t}', {'t': '${w['target_price']}'}), style: body(12, color: muted)),
                      ]),
                    ),
                  ]),
                ),
              ),
          ],
        );
      },
    );
  }
}

// ───────────────────────── Беклог ігор ─────────────────────────

class BacklogScreen extends StatefulWidget {
  const BacklogScreen({this.username, super.key});
  final String? username;

  @override
  State<BacklogScreen> createState() => _BacklogScreenState();
}

class _BacklogScreenState extends State<BacklogScreen> {
  String tab = 'playing';

  static Map<String, (String, IconData)> get _statuses => {
    'want': (tr('Хочу'), LucideIcons.bookmark),
    'playing': (tr('Граю'), LucideIcons.gamepad2),
    'done': (tr('Пройшов'), LucideIcons.trophy),
    'dropped': (tr('Кинув'), LucideIcons.circleX),
  };

  Future<void> _move(Api api, Map<String, dynamic> game, Future<void> Function() reload) async {
    final choice = await showGcSheet<String>(
      context,
      title: text(game['name']),
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          for (final e in _statuses.entries) SheetAction(icon: e.value.$2, label: e.value.$1, onTap: () => Navigator.pop(sheet, e.key)),
          SheetAction(icon: LucideIcons.trash2, label: tr('Прибрати з беклогу'), color: dangerSoft, onTap: () => Navigator.pop(sheet, '')),
        ]),
      ),
    );
    if (choice == null || !mounted) return;
    await attempt(context, () => api.put(Api.site('/games/${game['slug']}/backlog'), {'status': choice.isEmpty ? null : choice}));
    await reload();
  }

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site(widget.username == null ? '/games/backlog' : '/games/backlog/${widget.username}')),
      builder: (d, reload) {
        final board = mapOf(d['board']);
        final mine = d['mine'] == true;
        final items = maps(board[tab]);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(mine ? tr('Мій беклог') : tr('Беклог {name}', {'name': text(mapOf(d['owner'])['first_name']) ?? ''}), subtitle: tr('Хочу — граю — пройшов — кинув.')),
            Segmented(
              scroll: true,
              options: [for (final e in _statuses.entries) SegmentOption(e.key, e.value.$1, icon: e.value.$2, count: maps(board[e.key]).length)],
              selected: tab,
              onSelect: (v) => setState(() => tab = v),
            ),
            const SizedBox(height: 12),
            if (items.isEmpty) QuietEmpty(icon: _statuses[tab]!.$2, text: tr('Тут поки порожньо. Позначте гру на її сторінці.')),
            for (final item in items)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Glass(
                  onTap: () => context.push('/games/${mapOf(item['game'])['slug']}'),
                  child: Row(children: [
                    ClipRRect(borderRadius: BorderRadius.circular(10), child: SizedBox(width: 44, height: 58, child: NetImage(text(mapOf(item['game'])['cover'])))),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(text(mapOf(item['game'])['name']) ?? '', style: body(15, weight: FontWeight.w700)),
                        Text(text(mapOf(item['game'])['category_label']) ?? '', style: body(12.5, color: faint)),
                      ]),
                    ),
                    if (mine) IconButton(tooltip: tr('Змінити статус'), onPressed: () => _move(api, mapOf(item['game']), reload), icon: Icon(LucideIcons.ellipsis, color: muted)),
                  ]),
                ),
              ),
          ],
        );
      },
    );
  }
}

// ───────────────────────── Спільнота: вікі, календар, канали ─────────────────────────

class CommunityWikiScreen extends StatelessWidget {
  const CommunityWikiScreen({required this.slug, this.page, super.key});
  final String slug;
  final String? page;

  Future<void> _edit(BuildContext context, Api api, Map<String, dynamic>? current, Future<void> Function() reload) async {
    final title = TextEditingController(text: text(current?['title']) ?? '');
    final bodyText = TextEditingController(text: text(current?['body']) ?? '');
    final saved = await showGcSheet<bool>(
      context,
      title: current == null ? tr('Нова сторінка') : tr('Редагувати сторінку'),
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          GcField(controller: title, label: tr('Назва')),
          const SizedBox(height: 10),
          GcField(controller: bodyText, label: tr('Текст'), maxLines: 10),
          const SizedBox(height: 12),
          PrimaryButton(
            label: tr('Зберегти'),
            icon: LucideIcons.check,
            onPressed: () async {
              final ok = await attempt(sheet, () => api.post(Api.site('/c/$slug/wiki'), {'slug': ?text(current?['slug']), 'title': title.text.trim(), 'body': bodyText.text}), success: tr('Збережено.'));
              if (ok && sheet.mounted) Navigator.pop(sheet, true);
            },
          ),
        ]),
      ),
    );
    title.dispose();
    bodyText.dispose();
    if (saved == true) await reload();
  }

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site(page == null ? '/c/$slug/wiki' : '/c/$slug/wiki/$page')),
      builder: (d, reload) {
        final pages = maps(d['pages']);
        final current = d['page'] is Map ? mapOf(d['page']) : null;
        final canEdit = d['can_edit'] == true;
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(current == null ? tr('Вікі «{name}»', {'name': text(mapOf(d['community'])['name']) ?? ''}) : text(current['title']) ?? '', subtitle: current == null ? tr('Правила, гайди й корисне від спільноти.') : tr('Оновлено {d}', {'d': _date(current['updated_at'])})),
            if (canEdit)
              Align(
                alignment: Alignment.centerLeft,
                child: GhostButton(label: current == null ? tr('Нова сторінка') : tr('Редагувати'), icon: current == null ? LucideIcons.plus : LucideIcons.pencil, expand: false, compact: true, onPressed: () => _edit(context, api, current, reload)),
              ),
            const SizedBox(height: 12),
            if (current != null) Glass(child: SelectableText(text(current['body']) ?? '', style: body(15, color: ink.withValues(alpha: 0.92)).copyWith(height: 1.55))),
            if (current == null && pages.isEmpty) EmptyState(icon: LucideIcons.bookOpen, title: tr('Вікі поки порожня'), text: tr('Адміністратори можуть додати першу сторінку.')),
            if (current == null)
              for (final p in pages)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Glass(
                    onTap: () => context.push('/communities/$slug/wiki/${p['slug']}'),
                    child: Row(children: [
                      Icon(LucideIcons.fileText, color: accent, size: 20),
                      const SizedBox(width: 12),
                      Expanded(child: Text(text(p['title']) ?? '', style: body(15, weight: FontWeight.w600))),
                      Icon(LucideIcons.chevronRight, color: faint, size: 18),
                    ]),
                  ),
                ),
          ],
        );
      },
    );
  }
}

class CommunityCalendarScreen extends StatelessWidget {
  const CommunityCalendarScreen({required this.slug, super.key});
  final String slug;

  Future<void> _create(BuildContext context, Api api, Future<void> Function() reload) async {
    final title = TextEditingController();
    final place = TextEditingController();
    final details = TextEditingController();
    DateTime? at;
    final saved = await showGcSheet<bool>(
      context,
      title: tr('Нова подія'),
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheet) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            GcField(controller: title, label: tr('Назва події')),
            const SizedBox(height: 10),
            GcField(controller: place, label: tr('Де: Discord, сервер, місто')),
            const SizedBox(height: 10),
            GcField(controller: details, label: tr('Опис (необов’язково)'), maxLines: 3),
            const SizedBox(height: 10),
            GhostButton(
              label: at == null ? tr('Коли') : _date(at!.toIso8601String()),
              icon: LucideIcons.calendarClock,
              compact: true,
              onPressed: () async {
                final now = DateTime.now();
                final day = await showDatePicker(context: sheet, firstDate: now, lastDate: now.add(const Duration(days: 365)), initialDate: now);
                if (day == null || !sheet.mounted) return;
                final time = await showTimePicker(context: sheet, initialTime: const TimeOfDay(hour: 20, minute: 0));
                if (time == null) return;
                setSheet(() => at = DateTime(day.year, day.month, day.day, time.hour, time.minute));
              },
            ),
            const SizedBox(height: 12),
            PrimaryButton(
              label: tr('Створити'),
              icon: LucideIcons.check,
              onPressed: () async {
                final ok = await attempt(sheet, () => api.post(Api.site('/c/$slug/events'), {'title': title.text.trim(), 'place': place.text.trim(), 'description': details.text.trim(), 'starts_at': at?.toUtc().toIso8601String()}), success: tr('Подію додано.'));
                if (ok && sheet.mounted) Navigator.pop(sheet, true);
              },
            ),
          ]),
        ),
      ),
    );
    title.dispose();
    place.dispose();
    details.dispose();
    if (saved == true) await reload();
  }

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/c/$slug/calendar')),
      builder: (d, reload) {
        final upcoming = maps(d['upcoming']);
        final can = mapOf(d['can']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Календар'), subtitle: text(mapOf(d['community'])['name'])),
            if (can['manage'] == true) Align(alignment: Alignment.centerLeft, child: PrimaryButton(label: tr('Нова подія'), icon: LucideIcons.plus, compact: true, expand: false, onPressed: () => _create(context, api, reload))),
            const SizedBox(height: 12),
            if (upcoming.isEmpty) EmptyState(icon: LucideIcons.calendarDays, title: tr('Подій не заплановано'), text: tr('Тут з’являться турніри, зустрічі й стріми спільноти.')),
            for (final e in upcoming)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Glass(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(text(e['title']) ?? '', style: body(15.5, weight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text([_date(e['starts_at']), text(e['place'])].whereType<String>().where((s) => s.isNotEmpty).join(' · '), style: body(13, color: accent)),
                    if (text(e['description']) case final ds?) Padding(padding: const EdgeInsets.only(top: 6), child: Text(ds, style: body(13.5, color: soft))),
                    const SizedBox(height: 10),
                    Row(children: [
                      Text(tr('Підуть: {n}', {'n': '${e['going'] ?? 0}'}), style: body(12.5, color: muted)),
                      const Spacer(),
                      if (can['member'] == true)
                        e['my'] == 'going'
                            ? GhostButton(label: tr('Я піду'), icon: LucideIcons.check, expand: false, compact: true, onPressed: () async {
                                await attempt(context, () => api.post(Api.site('/c/$slug/events/${e['id']}/rsvp'), {'status': 'none'}));
                                await reload();
                              })
                            : PrimaryButton(label: tr('Піду'), expand: false, compact: true, onPressed: () async {
                                await attempt(context, () => api.post(Api.site('/c/$slug/events/${e['id']}/rsvp'), {'status': 'going'}));
                                await reload();
                              }),
                    ]),
                  ]),
                ),
              ),
          ],
        );
      },
    );
  }
}

/// Канали спільноти (категорії → текстові, оголошення, голосові). Текстовий канал відкривається
/// у звичайному чаті застосунку, голосовий — у голосовій кімнаті.
class CommunityChannelsScreen extends StatelessWidget {
  const CommunityChannelsScreen({required this.slug, super.key});
  final String slug;

  Future<void> _open(BuildContext context, Api api, Map<String, dynamic> channel) async {
    if (channel['type'] == 'voice' && channel['voice_room_id'] != null) {
      await VoiceCall.instance.join(api, {'id': channel['voice_room_id'], 'name': channel['name']}, label: text(channel['name']) ?? tr('Голосовий канал'), route: '/communities/$slug/channels');
      return;
    }
    try {
      final d = await api.get(Api.site('/c/$slug/channels/${channel['id']}'));
      final id = intOf(mapOf(d['active'])['id']);
      if (id > 0 && context.mounted) context.push('/messages/$id');
    } catch (e) {
      if (context.mounted) toast(context, e);
    }
  }

  Future<void> _create(BuildContext context, Api api, Future<void> Function() reload) async {
    final name = TextEditingController();
    String type = 'text';
    final saved = await showGcSheet<bool>(
      context,
      title: tr('Новий канал'),
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheet) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            GcField(controller: name, label: tr('Назва каналу')),
            const SizedBox(height: 10),
            Segmented(
              options: [SegmentOption('text', tr('Текстовий')), SegmentOption('announcement', tr('Оголошення')), SegmentOption('voice', tr('Голосовий'))],
              selected: type,
              onSelect: (v) => setSheet(() => type = v),
            ),
            const SizedBox(height: 12),
            PrimaryButton(
              label: tr('Створити'),
              icon: LucideIcons.check,
              onPressed: () async {
                final ok = await attempt(sheet, () => api.post(Api.site('/c/$slug/channels'), {'name': name.text.trim(), 'type': type, 'is_private': false}));
                if (ok && sheet.mounted) Navigator.pop(sheet, true);
              },
            ),
          ]),
        ),
      ),
    );
    name.dispose();
    if (saved == true) await reload();
  }

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      // Без активного каналу — лише дерево (запит першого каналу сервер відповідає переходом).
      load: () async {
        final first = await api.get(Api.site('/c/$slug/channels'));
        final redirect = text(first['redirect']);
        return redirect == null ? first : api.get(Api.site(redirect.replaceFirst(RegExp(r'^/'), '/').replaceFirst('/c/$slug/channels/', '/c/$slug/channels/')));
      },
      builder: (d, reload) {
        final tree = mapOf(d['tree']);
        final groups = <(String?, List<Map<String, dynamic>>)>[
          if (maps(tree['uncategorized']).isNotEmpty) (null, maps(tree['uncategorized'])),
          for (final c in maps(tree['categories'])) (text(c['name']), maps(c['channels'])),
        ];
        IconData icon(Map<String, dynamic> ch) => switch (text(ch['type'])) {
          'voice' => LucideIcons.volume2,
          'announcement' => LucideIcons.megaphone,
          _ => LucideIcons.hash,
        };
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Канали'), subtitle: text(mapOf(d['community'])['name'])),
            if (d['can_manage'] == true) Align(alignment: Alignment.centerLeft, child: GhostButton(label: tr('Новий канал'), icon: LucideIcons.plus, expand: false, compact: true, onPressed: () => _create(context, api, reload))),
            if (d['joined'] != true) EmptyState(icon: LucideIcons.lock, title: tr('Канали — для учасників'), text: tr('Вступіть у спільноту, щоб бачити канали.')),
            for (final (title, channels) in groups) ...[
              if (title != null) SectionLabel(title),
              Glass(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Column(children: [
                  for (final ch in channels)
                    ListTile(
                      leading: Icon(icon(ch), color: accent, size: 20),
                      title: Text(text(ch['name']) ?? '', style: body(15, weight: FontWeight.w600)),
                      subtitle: (ch['voice'] is List && (ch['voice'] as List).isNotEmpty)
                          ? Text(tr('У каналі: {n}', {'n': '${(ch['voice'] as List).length}'}), style: body(12, color: green))
                          : (text(ch['topic']) == null ? null : Text(text(ch['topic'])!, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: faint))),
                      trailing: intOf(ch['unread']) > 0
                          ? Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2), decoration: BoxDecoration(color: primary, borderRadius: BorderRadius.circular(10)), child: Text('${ch['unread']}', style: body(11, color: Colors.white, weight: FontWeight.w700)))
                          : (ch['is_private'] == true ? Icon(LucideIcons.lock, size: 16, color: faint) : null),
                      onTap: () => _open(context, api, ch),
                    ),
                ]),
              ),
              const SizedBox(height: 10),
            ],
          ],
        );
      },
    );
  }
}

// ───────────────────────── Генератор ніків ─────────────────────────

const _nickStyles = {
  'cyber': (label: 'Кібер', a: ['Neo', 'Hex', 'Byte', 'Glitch', 'Volt', 'Zero', 'Cyber', 'Pixel', 'Nano', 'Synth', 'Flux', 'Static'], b: ['Runner', 'Ghost', 'Core', 'Pulse', 'Wire', 'Shade', 'Drift', 'Node', 'Spark', 'Byte', 'Viper', 'Echo']),
  'fantasy': (label: 'Фентезі', a: ['Shadow', 'Storm', 'Frost', 'Iron', 'Raven', 'Ember', 'Moon', 'Thorn', 'Ash', 'Silver', 'Wild', 'Dusk'], b: ['blade', 'heart', 'wolf', 'fang', 'born', 'whisper', 'warden', 'song', 'spire', 'claw', 'mane', 'veil']),
  'ua': (label: 'Українське', a: ['Kozak', 'Vovk', 'Sokil', 'Grim', 'Bureviy', 'Zhar', 'Lys', 'Charivnyk', 'Kharakternyk', 'Dub', 'Mavka', 'Vedmid'], b: ['UA', 'Kyiv', 'Lviv', 'Steppe', 'Dnipro', 'Volya', 'Karpaty', 'Sich', 'Polissia', 'Zoria', 'Grom', 'Viter']),
  'funny': (label: 'Смішне', a: ['Lazy', 'Sneaky', 'Angry', 'Sleepy', 'Crispy', 'Salty', 'Laggy', 'Noob', 'Tilted', 'Spicy', 'Chill', 'Wobbly'], b: ['Potato', 'Varenyk', 'Toaster', 'Pelmen', 'Cactus', 'Banana', 'Duck', 'Borscht', 'Kitten', 'Pancake', 'Goose', 'Dumpling']),
};
const _clanA = ['Iron', 'Night', 'Crimson', 'Silent', 'Frost', 'Golden', 'Black', 'Steel', 'Wild', 'Storm', 'Neon', 'Ghost'];
const _clanB = ['Wolves', 'Legion', 'Ravens', 'Order', 'Guard', 'Syndicate', 'Hunters', 'Phoenix', 'Vipers', 'Titans', 'Rebels', 'Kozaky'];

/// Генератор ніків і назв кланів — як на сайті: усе на телефоні, сервер лише каже, чи вільна адреса.
class NicknamesScreen extends StatefulWidget {
  const NicknamesScreen({super.key});

  @override
  State<NicknamesScreen> createState() => _NicknamesScreenState();
}

class _NicknamesScreenState extends State<NicknamesScreen> {
  final seed = TextEditingController();
  final random = math.Random();
  String style = 'cyber';
  List<String> nicks = [];
  Set<String>? free;
  (String, String)? clan;

  T _pick<T>(List<T> list) => list[random.nextInt(list.length)];

  String _nick() {
    final s = _nickStyles[style]!;
    final base = seed.text.trim().isEmpty ? _pick(s.a) : seed.text.trim().replaceAll(RegExp(r'\s+'), '');
    final variants = [
      '$base${_pick(s.b)}',
      '${_pick(s.a)}${base == _pick(s.a) ? _pick(s.b) : base}',
      '${base}_${_pick(s.b)}',
      '$base${random.nextInt(90) + 10}',
      'x$base${_pick(s.b)}x',
    ];
    final out = _pick(variants);
    return out.length > 20 ? out.substring(0, 20) : out;
  }

  Future<void> _generate() async {
    final next = {for (var i = 0; i < 24 && true; i++) _nick()}.take(8).toList();
    setState(() {
      nicks = next;
      free = null;
    });
    try {
      final r = await AppScope.read(context).session.api.post(Api.site('/tools/nicknames/check'), {'names': next});
      // Адреси на GameCon без урахування регістру: сервер відповідає малими літерами.
      if (mounted) setState(() => free = {for (final n in (r['free'] as List? ?? const [])) '$n'.toLowerCase()});
    } catch (_) {}
  }

  void _clan() {
    final name = '${_pick(_clanA)} ${_pick(_clanB)}';
    final tag = (name.split(' ').map((w) => w[0]).join() + _pick(['', 'X', 'Z', 'UA', ''])).toUpperCase();
    setState(() => clan = (name, tag.length > 5 ? tag.substring(0, 5) : tag));
  }

  @override
  void dispose() {
    seed.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScroll(children: [
      PageTitle(tr('Генератор ніків'), subtitle: tr('Придумайте нік і назву клану; покажемо, чи вільна адреса на GameCon.')),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Segmented(scroll: true, options: [for (final e in _nickStyles.entries) SegmentOption(e.key, tr(e.value.label))], selected: style, onSelect: (v) => setState(() => style = v)),
          const SizedBox(height: 10),
          GcField(controller: seed, label: tr('Основа (необов’язково): ваше ім’я чи слово')),
          const SizedBox(height: 10),
          PrimaryButton(label: tr('Згенерувати'), icon: LucideIcons.sparkles, onPressed: _generate),
          if (nicks.isNotEmpty) const SizedBox(height: 12),
          for (final n in nicks)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(n, style: body(15.5, weight: FontWeight.w600)),
              subtitle: free == null ? null : Text(free!.contains(n.toLowerCase()) ? tr('Адреса вільна') : tr('Уже зайнято'), style: body(12, color: free!.contains(n.toLowerCase()) ? green : dangerSoft)),
              trailing: IconButton(
                tooltip: tr('Копіювати'),
                icon: Icon(LucideIcons.copy, color: muted, size: 18),
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: n));
                  if (context.mounted) toast(context, tr('Скопійовано.'));
                },
              ),
            ),
        ]),
      ),
      const SizedBox(height: 12),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          CardTitle(tr('Назва клану'), icon: LucideIcons.swords),
          if (clan != null) ...[
            Text(clan!.$1, style: display(20)),
            Text('[${clan!.$2}]', style: body(14, color: accent, weight: FontWeight.w700)),
            const SizedBox(height: 10),
          ],
          GhostButton(label: tr('Придумати назву'), icon: LucideIcons.dices, onPressed: _clan),
        ]),
      ),
    ]);
  }
}

// ───────────────────────── Посилання в профілі ─────────────────────────

class BioLinksScreen extends StatefulWidget {
  const BioLinksScreen({super.key});

  @override
  State<BioLinksScreen> createState() => _BioLinksScreenState();
}

class _BioLinksScreenState extends State<BioLinksScreen> {
  List<(TextEditingController, TextEditingController, int)>? rows;
  String? url;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final d = await AppScope.read(context).session.api.get(Api.site('/settings/links'));
        if (!mounted) return;
        setState(() {
          url = text(d['url']);
          rows = [for (final l in maps(d['links'])) (TextEditingController(text: text(l['title']) ?? ''), TextEditingController(text: text(l['url']) ?? ''), intOf(l['clicks']))];
        });
      } catch (e) {
        if (mounted) toast(context, e);
      }
    });
  }

  @override
  void dispose() {
    for (final r in rows ?? const <(TextEditingController, TextEditingController, int)>[]) {
      r.$1.dispose();
      r.$2.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => busy = true);
    await attempt(
      context,
      () => AppScope.read(context).session.api.put(Api.site('/settings/links'), {
        'links': [for (final r in rows!) if (r.$2.text.trim().isNotEmpty) {'title': r.$1.text.trim(), 'url': r.$2.text.trim()}],
      }),
      success: tr('Посилання збережено.'),
    );
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final list = rows;
    if (list == null) return const ScreenSkeleton();
    return ScreenScroll(children: [
      PageTitle(tr('Посилання в профілі'), subtitle: tr('Одна адреса з усіма вашими посиланнями — Twitch, YouTube, Discord.')),
      if (url != null)
        Glass(
          onTap: () async {
            await Clipboard.setData(ClipboardData(text: url!));
            if (context.mounted) toast(context, tr('Скопійовано.'));
          },
          child: Row(children: [Icon(LucideIcons.link, color: accent), const SizedBox(width: 10), Expanded(child: Text(url!, style: body(14, color: accent))), Icon(LucideIcons.copy, size: 16, color: muted)]),
        ),
      const SizedBox(height: 12),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          for (final (i, r) in list.indexed)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(children: [
                Expanded(child: Column(children: [GcField(controller: r.$1, label: tr('Назва'), dense: true), const SizedBox(height: 6), GcField(controller: r.$2, label: 'https://…', dense: true)])),
                Column(children: [
                  IconButton(tooltip: tr('Прибрати'), onPressed: () => setState(() => list.removeAt(i)), icon: Icon(LucideIcons.x, color: muted)),
                  Text(tr('{n} клік.', {'n': '${r.$3}'}), style: body(11, color: faint)),
                ]),
              ]),
            ),
          if (list.length < 12) GhostButton(label: tr('Додати посилання'), icon: LucideIcons.plus, compact: true, onPressed: () => setState(() => list.add((TextEditingController(), TextEditingController(), 0)))),
          const SizedBox(height: 10),
          PrimaryButton(label: tr('Зберегти'), icon: LucideIcons.check, busy: busy, onPressed: _save),
        ]),
      ),
    ]);
  }
}

// ───────────────────────── Тип акаунта й верифікація ─────────────────────────

class AccountTypeScreen extends StatefulWidget {
  const AccountTypeScreen({super.key});

  @override
  State<AccountTypeScreen> createState() => _AccountTypeScreenState();
}

class _AccountTypeScreenState extends State<AccountTypeScreen> {
  String? type;
  final fields = <String, TextEditingController>{};

  @override
  void dispose() {
    for (final c in fields.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/settings/account-type')),
      builder: (d, reload) {
        final types = maps(d['types']);
        final current = mapOf(d['current']);
        type ??= text(current['type']) ?? 'personal';
        final details = mapOf(current['details']);
        final chosen = types.firstWhere((t) => t['key'] == type, orElse: () => types.isEmpty ? <String, dynamic>{} : types.first);
        final defs = chosen['fields'] is Map ? Map<String, dynamic>.from(chosen['fields'] as Map) : <String, dynamic>{};
        for (final k in defs.keys) {
          fields.putIfAbsent(k, () => TextEditingController(text: text(details[k]) ?? ''));
        }
        final verification = mapOf(d['verification']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Тип акаунта'), subtitle: tr('Стрімер, команда, бізнес — і відповідна позначка в профілі.')),
            Glass(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final t in types)
                    SelectPill(label: text(t['label']) ?? '', selected: t['key'] == type, onTap: () => setState(() => type = text(t['key']))),
                ]),
                for (final e in defs.entries) Padding(padding: const EdgeInsets.only(top: 10), child: GcField(controller: fields[e.key]!, label: '${e.value}')),
                const SizedBox(height: 12),
                PrimaryButton(
                  label: tr('Зберегти'),
                  icon: LucideIcons.check,
                  onPressed: () async {
                    await attempt(context, () => api.put(Api.site('/settings/account-type'), {'type': type, 'details': {for (final k in defs.keys) k: fields[k]!.text.trim()}}), success: tr('Збережено.'));
                    await reload();
                  },
                ),
              ]),
            ),
            const SizedBox(height: 12),
            Glass(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                CardTitle(tr('Верифікація'), icon: LucideIcons.badgeCheck),
                if (verification['verified'] == true)
                  Text(tr('Акаунт підтверджено.'), style: body(14, color: green, weight: FontWeight.w600))
                else ...[
                  for (final r in maps(verification['requirements']))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(children: [
                        Icon(r['ok'] == true ? LucideIcons.circleCheck : LucideIcons.circle, size: 18, color: r['ok'] == true ? green : faint),
                        const SizedBox(width: 8),
                        Expanded(child: Text(text(r['label']) ?? '', style: body(13.5))),
                      ]),
                    ),
                  if (mapOf(verification['request']).isNotEmpty) Text(tr('Заявку надіслано — чекайте відповіді.'), style: body(13, color: accent)),
                  if (mapOf(verification['request']).isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: GhostButton(
                        label: tr('Подати заявку'),
                        icon: LucideIcons.send,
                        onPressed: () async {
                          final kinds = mapOf(verification['kinds']);
                          await attempt(context, () => api.post(Api.site('/settings/verification'), {'kind': kinds.keys.isEmpty ? 'identity' : kinds.keys.first}), success: tr('Заявку надіслано.'));
                          await reload();
                        },
                      ),
                    ),
                ],
              ]),
            ),
          ],
        );
      },
    );
  }
}

// ───────────────────────── Мем-мейкер ─────────────────────────

/// Мем: картинка з телефона, підпис зверху й знизу (білі літери з чорним контуром) — одразу у стрічку.
class MemeScreen extends StatefulWidget {
  const MemeScreen({super.key});

  @override
  State<MemeScreen> createState() => _MemeScreenState();
}

class _MemeScreenState extends State<MemeScreen> {
  final top = TextEditingController();
  final bottom = TextEditingController();
  final canvas = GlobalKey();
  XFile? image;
  bool busy = false;

  @override
  void dispose() {
    top.dispose();
    bottom.dispose();
    super.dispose();
  }

  Widget _caption(String value, Alignment at) => Align(
    alignment: at,
    child: Padding(
      padding: const EdgeInsets.all(10),
      child: Stack(children: [
        Text(value.toUpperCase(), textAlign: TextAlign.center, style: display(26).copyWith(foreground: Paint()..style = PaintingStyle.stroke..strokeWidth = 5..color = Colors.black)),
        Text(value.toUpperCase(), textAlign: TextAlign.center, style: display(26, color: Colors.white)),
      ]),
    ),
  );

  Future<void> _post() async {
    final boundary = canvas.currentContext?.findRenderObject() as RenderRepaintBoundary?;
    if (boundary == null) return;
    setState(() => busy = true);
    try {
      final picture = await boundary.toImage(pixelRatio: 2.5);
      final bytes = await picture.toByteData(format: ui.ImageByteFormat.png);
      if (!mounted || bytes == null) return;
      await AppScope.read(context).session.api.upload('/api/v1/posts', {'body': '', 'visibility': 'public'}, [
        http.MultipartFile.fromBytes('images[]', bytes.buffer.asUint8List(), filename: 'meme.png'),
      ]);
      if (!mounted) return;
      toast(context, tr('Мем опубліковано.'));
      context.pop(true);
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScroll(children: [
      PageTitle(tr('Мем'), subtitle: tr('Картинка й підпис — і мем одразу у вашій стрічці.')),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          RepaintBoundary(
            key: canvas,
            child: AspectRatio(
              aspectRatio: 1,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: ListenableBuilder(
                  listenable: Listenable.merge([top, bottom]),
                  builder: (_, _) => Stack(fit: StackFit.expand, children: [
                    image == null
                        ? Container(color: fg.withValues(alpha: 0.06), alignment: Alignment.center, child: Icon(LucideIcons.imagePlus, size: 42, color: faint))
                        : Image(image: XFileImage(image!), fit: BoxFit.cover),
                    _caption(top.text, Alignment.topCenter),
                    _caption(bottom.text, Alignment.bottomCenter),
                  ]),
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          GhostButton(
            label: image == null ? tr('Вибрати картинку') : tr('Інша картинка'),
            icon: LucideIcons.image,
            compact: true,
            onPressed: () async {
              final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 90);
              if (picked != null) setState(() => image = picked);
            },
          ),
          const SizedBox(height: 10),
          GcField(controller: top, label: tr('Текст зверху')),
          const SizedBox(height: 8),
          GcField(controller: bottom, label: tr('Текст знизу')),
          const SizedBox(height: 12),
          PrimaryButton(label: tr('Опублікувати'), icon: LucideIcons.send, busy: busy, onPressed: image == null ? null : _post),
        ]),
      ),
    ]);
  }
}

// ───────────────────────── Піксельна аватарка ─────────────────────────

/// Піксельна аватарка 16×16: малюйте пальцем, зберігайте як аватар (той самий /me/avatar).
class PixelAvatarScreen extends StatefulWidget {
  const PixelAvatarScreen({super.key});

  @override
  State<PixelAvatarScreen> createState() => _PixelAvatarScreenState();
}

class _PixelAvatarScreenState extends State<PixelAvatarScreen> {
  static const size = 16;
  static const colors = [Color(0xFF0B1528), Color(0xFFF8FAFC), Color(0xFF0A84FF), Color(0xFF00D2FF), Color(0xFF34D399), Color(0xFFF5C451), Color(0xFFFB923C), Color(0xFFFF4D6D), Color(0xFF94A3B8), Color(0xFF7C4A2D)];
  final pixels = List<Color?>.filled(size * size, null);
  Color brush = colors[2];
  bool erase = false;
  bool busy = false;

  void _paint(Offset local, double side) {
    final cell = side / size;
    final x = (local.dx / cell).floor(), y = (local.dy / cell).floor();
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    final i = y * size + x;
    final next = erase ? null : brush;
    if (pixels[i] != next) setState(() => pixels[i] = next);
  }

  Future<void> _save() async {
    setState(() => busy = true);
    try {
      final recorder = ui.PictureRecorder();
      final c = Canvas(recorder);
      const px = 32.0;
      c.drawRect(const Rect.fromLTWH(0, 0, size * px, size * px), Paint()..color = const Color(0xFF080E1A));
      for (var i = 0; i < pixels.length; i++) {
        final color = pixels[i];
        if (color != null) c.drawRect(Rect.fromLTWH((i % size) * px, (i ~/ size) * px, px, px), Paint()..color = color);
      }
      final image = await recorder.endRecording().toImage((size * px).toInt(), (size * px).toInt());
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      if (!mounted || bytes == null) return;
      await AppScope.read(context).session.api.upload(Api.site('/me/avatar'), {}, [http.MultipartFile.fromBytes('avatar', bytes.buffer.asUint8List(), filename: 'pixel-avatar.png')]);
      if (!mounted) return;
      await AppScope.read(context).session.refreshMe();
      if (mounted) toast(context, tr('Аватарку оновлено.'));
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScroll(children: [
      PageTitle(tr('Піксельна аватарка'), subtitle: tr('Намалюйте себе 16×16 пальцем і поставте на аватар.')),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          LayoutBuilder(builder: (context, box) {
            final side = box.maxWidth;
            return GestureDetector(
              onPanDown: (e) => _paint(e.localPosition, side),
              onPanUpdate: (e) => _paint(e.localPosition, side),
              child: SizedBox(
                width: side,
                height: side,
                child: CustomPaint(painter: _PixelGrid(pixels, size, fg.withValues(alpha: 0.06))),
              ),
            );
          }),
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final c in colors)
              GestureDetector(
                onTap: () => setState(() {
                  brush = c;
                  erase = false;
                }),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(color: c, shape: BoxShape.circle, border: Border.all(color: !erase && brush == c ? accent : Colors.transparent, width: 2.5)),
                ),
              ),
            RoundIcon(icon: LucideIcons.eraser, tooltip: tr('Гумка'), color: erase ? accent : muted, onTap: () => setState(() => erase = !erase), size: 32),
            RoundIcon(icon: LucideIcons.trash2, tooltip: tr('Очистити'), onTap: () => setState(() => pixels.fillRange(0, pixels.length, null)), size: 32),
          ]),
          const SizedBox(height: 12),
          PrimaryButton(label: tr('Поставити на аватар'), icon: LucideIcons.check, busy: busy, onPressed: pixels.any((p) => p != null) ? _save : null),
        ]),
      ),
    ]);
  }
}

class _PixelGrid extends CustomPainter {
  _PixelGrid(this.pixels, this.size, this.empty);
  final List<Color?> pixels;
  final int size;
  final Color empty;

  @override
  void paint(Canvas canvas, Size box) {
    final cell = box.width / size;
    for (var i = 0; i < pixels.length; i++) {
      final r = Rect.fromLTWH((i % size) * cell, (i ~/ size) * cell, cell, cell).deflate(0.5);
      canvas.drawRect(r, Paint()..color = pixels[i] ?? ((i + i ~/ size) % 2 == 0 ? empty : empty.withValues(alpha: empty.a * 0.5)));
    }
  }

  @override
  bool shouldRepaint(_PixelGrid old) => true;
}
