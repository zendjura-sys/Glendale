import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'posts.dart';
import 'shell.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// ——— Довідка ———
// Та сама довідка, що й на сайті (/help): розділи → статті, переклад мовою застосунку робить сервер.

const _helpIcons = <String, IconData>{
  'rocket': LucideIcons.rocket,
  'newspaper': LucideIcons.newspaper,
  'message-circle': LucideIcons.messageCircle,
  'shield': LucideIcons.shield,
  'gamepad-2': LucideIcons.gamepad2,
  'film': LucideIcons.film,
  'music': LucideIcons.music,
  'clapperboard': LucideIcons.clapperboard,
  'target': LucideIcons.target,
  'sparkles': LucideIcons.sparkles,
  'pen-line': LucideIcons.penLine,
  'smartphone': LucideIcons.smartphone,
  'shield-check': LucideIcons.shieldCheck,
  'scale': LucideIcons.scale,
  'life-buoy': LucideIcons.lifeBuoy,
};

Widget _helpIcon(String? name) => Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(color: primary.withValues(alpha: 0.16), borderRadius: BorderRadius.circular(12)),
      child: Icon(_helpIcons[name] ?? LucideIcons.lifeBuoy, size: 19, color: accent),
    );

/// Головна довідки: популярне й усі розділи.
class HelpScreen extends StatelessWidget {
  const HelpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get('/api/v1/help'),
      builder: (d, reload) => ScreenScroll(
        onRefresh: reload,
        children: [
          PageTitle(tr('Довідка'), subtitle: tr('Відповіді на питання про GameCon')),
          if (maps(d['popular']).isNotEmpty) ...[
            SectionLabel(tr('Популярне')),
            Glass(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(children: [
                for (final a in maps(d['popular']))
                  ListTile(
                    title: Text(text(a['title']) ?? '', style: body(14.5, weight: FontWeight.w600)),
                    subtitle: Text(text(a['summary']) ?? '', style: body(12.5, color: muted), maxLines: 2, overflow: TextOverflow.ellipsis),
                    trailing: Icon(LucideIcons.chevronRight, size: 18, color: muted),
                    onTap: () => context.push('/help/${a['category']}/${a['slug']}'),
                  ),
              ]),
            ),
            const SizedBox(height: 14),
          ],
          SectionLabel(tr('Розділи')),
          for (final c in maps(d['categories']))
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Glass(
                onTap: () => context.push('/help/${c['slug']}'),
                child: Row(children: [
                  _helpIcon(text(c['icon'])),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(text(c['title']) ?? '', style: body(15, weight: FontWeight.w600)),
                      const SizedBox(height: 2),
                      Text(text(c['summary']) ?? '', style: body(12.5, color: muted), maxLines: 2, overflow: TextOverflow.ellipsis),
                    ]),
                  ),
                  Icon(LucideIcons.chevronRight, size: 18, color: muted),
                ]),
              ),
            ),
          const SizedBox(height: 6),
          const _AskSupport(),
        ],
      ),
    );
  }
}

/// Розділ довідки: статті.
class HelpCategoryScreen extends StatelessWidget {
  const HelpCategoryScreen({required this.slug, super.key});
  final String slug;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get('/api/v1/help/$slug'),
      builder: (d, reload) {
        final c = mapOf(d['category']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            Row(children: [_helpIcon(text(c['icon'])), const SizedBox(width: 12), Expanded(child: PageTitle(text(c['title']) ?? tr('Довідка'), subtitle: text(c['summary'])))]),
            Glass(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(children: [
                for (final a in maps(c['articles']))
                  ListTile(
                    title: Text(text(a['title']) ?? '', style: body(14.5, weight: FontWeight.w600)),
                    subtitle: Text(text(a['summary']) ?? '', style: body(12.5, color: muted)),
                    trailing: Icon(LucideIcons.chevronRight, size: 18, color: muted),
                    onTap: () => context.push('/help/$slug/${a['slug']}'),
                  ),
              ]),
            ),
            const SizedBox(height: 14),
            const _AskSupport(),
          ],
        );
      },
    );
  }
}

/// Стаття довідки: абзаци, підзаголовки, кроки, списки, поради й застереження.
class HelpArticleScreen extends StatelessWidget {
  const HelpArticleScreen({required this.category, required this.slug, super.key});
  final String category;
  final String slug;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get('/api/v1/help/$category/$slug'),
      builder: (d, reload) {
        final a = mapOf(d['article']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(text(a['title']) ?? '', subtitle: text(a['summary'])),
            Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [for (final b in maps(a['blocks'])) _HelpBlock(block: b)])),
            if (maps(d['related']).isNotEmpty) ...[
              const SizedBox(height: 14),
              SectionLabel(tr('Схожі статті')),
              for (final r in maps(d['related']))
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Glass(
                    padding: const EdgeInsets.all(14),
                    onTap: () => context.push('/help/${r['category']}/${r['slug']}'),
                    child: Row(children: [
                      Expanded(child: Text(text(r['title']) ?? '', style: body(14, weight: FontWeight.w600))),
                      Icon(LucideIcons.chevronRight, size: 18, color: muted),
                    ]),
                  ),
                ),
            ],
            const SizedBox(height: 6),
            const _AskSupport(),
          ],
        );
      },
    );
  }
}

class _HelpBlock extends StatelessWidget {
  const _HelpBlock({required this.block});
  final Map<String, dynamic> block;

  @override
  Widget build(BuildContext context) {
    final type = text(block['type']);
    final items = (block['items'] is List) ? (block['items'] as List).map((e) => '$e').toList() : <String>[];
    switch (type) {
      case 'h':
        return Padding(padding: const EdgeInsets.only(top: 14, bottom: 6), child: Text(text(block['text']) ?? '', style: body(16, weight: FontWeight.w700)));
      case 'steps':
      case 'list':
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            for (var i = 0; i < items.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  type == 'steps'
                      ? Container(
                          width: 22,
                          height: 22,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: primary.withValues(alpha: 0.2), shape: BoxShape.circle),
                          child: Text('${i + 1}', style: body(11.5, color: accent, weight: FontWeight.w700)),
                        )
                      : Padding(padding: const EdgeInsets.only(top: 8, right: 4), child: Container(width: 5, height: 5, decoration: BoxDecoration(color: muted, shape: BoxShape.circle))),
                  const SizedBox(width: 10),
                  Expanded(child: _LinkedText(items[i])),
                ]),
              ),
          ]),
        );
      case 'tip':
      case 'note':
        final tip = type == 'tip';
        return Container(
          width: double.infinity,
          margin: const EdgeInsets.symmetric(vertical: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: (tip ? primary : const Color(0xFFF5B342)).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14)),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(tip ? LucideIcons.lightbulb : LucideIcons.triangleAlert, size: 17, color: tip ? accent : const Color(0xFFF5B342)),
            const SizedBox(width: 10),
            Expanded(child: _LinkedText(text(block['text']) ?? '')),
          ]),
        );
      default:
        return Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: _LinkedText(text(block['text']) ?? ''));
    }
  }
}

/// Текст із посиланнями виду [підпис](/шлях): шлях сайту відкривається відповідним екраном застосунку.
class _LinkedText extends StatelessWidget {
  const _LinkedText(this.value);
  final String value;

  @override
  Widget build(BuildContext context) {
    final style = body(14.5, color: ink.withValues(alpha: 0.86));
    final spans = <InlineSpan>[];
    var last = 0;
    for (final m in RegExp(r'\[([^\]]+)\]\(([^)]+)\)').allMatches(value)) {
      if (m.start > last) spans.add(TextSpan(text: value.substring(last, m.start)));
      final path = m.group(2)!;
      spans.add(TextSpan(
        text: m.group(1),
        style: style.copyWith(color: accent, decoration: TextDecoration.underline),
        recognizer: TapGestureRecognizer()..onTap = () => context.push(path.startsWith('/') ? appPathFor(path) : '/feed'),
      ));
      last = m.end;
    }
    if (last < value.length) spans.add(TextSpan(text: value.substring(last)));
    return Text.rich(TextSpan(style: style.copyWith(height: 1.5), children: spans));
  }
}

class _AskSupport extends StatelessWidget {
  const _AskSupport();

  @override
  Widget build(BuildContext context) {
    return Glass(
      child: Row(children: [
        Icon(LucideIcons.headset, size: 22, color: accent),
        const SizedBox(width: 12),
        Expanded(child: Text(tr('Не знайшли відповіді? Напишіть у підтримку — відповімо тут і в сповіщеннях.'), style: body(13.5, color: muted))),
        const SizedBox(width: 8),
        PrimaryButton(label: tr('Написати'), compact: true, expand: false, onPressed: () => context.push('/support')),
      ]),
    );
  }
}

// ——— Підтримка ———

String _statusLabel(String? status) => switch (status) {
      'answered' => tr('Є відповідь'),
      'closed' => tr('Закрито'),
      _ => tr('Чекає відповіді'),
    };

Color _statusColor(String? status) => switch (status) {
      'answered' => const Color(0xFF34D399),
      'closed' => muted,
      _ => const Color(0xFFF5B342),
    };

/// Мої звернення в підтримку й нове звернення.
class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key});

  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  int _version = 0;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      watch: _version,
      load: () => api.get(Api.site('/support')),
      builder: (d, reload) {
        final tickets = maps(d['tickets']);
        final categories = mapOf(d['categories']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Підтримка'), subtitle: tr('Опишіть проблему — відповімо тут і надішлемо сповіщення.')),
            PrimaryButton(
              label: tr('Нове звернення'),
              icon: LucideIcons.messageSquarePlus,
              onPressed: () async {
                final created = await showGcSheet<bool>(context, title: tr('Нове звернення'), builder: (sheet) => _NewTicket(categories: categories));
                if (created == true) setState(() => _version++);
              },
            ),
            const SizedBox(height: 14),
            if (tickets.isEmpty)
              EmptyState(icon: LucideIcons.lifeBuoy, title: tr('Звернень поки немає'), text: tr('Часті питання є в довідці.'), action: tr('Довідка'), onAction: () => context.push('/help'))
            else
              Glass(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Column(children: [
                  for (final t in tickets)
                    ListTile(
                      leading: Container(width: 8, height: 8, decoration: BoxDecoration(color: t['unread'] == true ? primary : Colors.transparent, shape: BoxShape.circle)),
                      minLeadingWidth: 8,
                      title: Text('#${t['id']} · ${t['subject']}', style: body(14, weight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                      subtitle: Text('${t['category_label']} · ${ago(t['updated_at'])}', style: body(12, color: muted)),
                      trailing: Text(_statusLabel(text(t['status'])), style: body(12, color: _statusColor(text(t['status'])), weight: FontWeight.w600)),
                      onTap: () async {
                        await context.push('/support/${t['id']}');
                        if (mounted) setState(() => _version++);
                      },
                    ),
                ]),
              ),
          ],
        );
      },
    );
  }
}

class _NewTicket extends StatefulWidget {
  const _NewTicket({required this.categories});
  final Map<String, dynamic> categories;

  @override
  State<_NewTicket> createState() => _NewTicketState();
}

class _NewTicketState extends State<_NewTicket> {
  String? category;
  final subject = TextEditingController();
  final message = TextEditingController();
  final files = <XFile>[];
  bool busy = false;

  @override
  void dispose() {
    subject.dispose();
    message.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (category == null || subject.text.trim().length < 4 || message.text.trim().length < 10) {
      toast(context, tr('Оберіть тему й опишіть проблему трохи детальніше.'));
      return;
    }
    setState(() => busy = true);
    final ok = await attempt(context, () async {
      final api = AppScope.read(context).session.api;
      await api.upload(Api.site('/support'), {'category': category!, 'subject': subject.text.trim(), 'body': message.text.trim()}, [
        for (final f in files) await http.MultipartFile.fromPath('files[]', f.path, filename: f.name),
      ]);
    }, success: tr('Звернення надіслано. Відповімо найближчим часом.'));
    if (!mounted) return;
    setState(() => busy = false);
    if (ok) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
      Text(tr('З чим допомогти?'), style: body(13.5, color: muted)),
      const SizedBox(height: 8),
      Wrap(spacing: 8, runSpacing: 8, children: [
        for (final e in widget.categories.entries)
          SelectPill(label: '${e.value}', selected: category == e.key, onTap: () => setState(() => category = e.key)),
      ]),
      const SizedBox(height: 14),
      GcField(controller: subject, label: tr('Коротко: що сталося')),
      const SizedBox(height: 10),
      GcField(controller: message, label: tr('Детально: що робили, що очікували, що вийшло'), maxLines: 6, minLines: 4),
      const SizedBox(height: 10),
      Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
        for (final f in files) Pill(label: f.name, icon: LucideIcons.image),
        if (files.length < 3)
          GhostButton(
            label: tr('Знімок екрана'),
            icon: LucideIcons.imagePlus,
            expand: false,
            compact: true,
            onPressed: () async {
              final picked = await ImagePicker().pickMultiImage(imageQuality: 88, maxWidth: 2000);
              if (picked.isNotEmpty) setState(() => files.addAll(picked.take(3 - files.length)));
            },
          ),
      ]),
      const SizedBox(height: 16),
      PrimaryButton(label: tr('Надіслати'), busy: busy, onPressed: _send),
    ]);
  }
}

/// Звернення: листування з підтримкою, відповідь, «Питання вирішено» й оцінка.
class SupportTicketScreen extends StatefulWidget {
  const SupportTicketScreen({required this.id, super.key});
  final int id;

  @override
  State<SupportTicketScreen> createState() => _SupportTicketScreenState();
}

class _SupportTicketScreenState extends State<SupportTicketScreen> {
  final reply = TextEditingController();
  final files = <XFile>[];
  int _version = 0;
  bool busy = false;

  @override
  void dispose() {
    reply.dispose();
    super.dispose();
  }

  Api get api => AppScope.read(context).session.api;

  Future<void> _send() async {
    if (reply.text.trim().length < 2) return;
    setState(() => busy = true);
    final ok = await attempt(context, () async {
      await api.upload(Api.site('/support/${widget.id}/reply'), {'body': reply.text.trim()}, [
        for (final f in files) await http.MultipartFile.fromPath('files[]', f.path, filename: f.name),
      ]);
    });
    if (!mounted) return;
    setState(() {
      busy = false;
      if (ok) {
        reply.clear();
        files.clear();
        _version++;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Remote(
      watch: _version,
      load: () => api.get(Api.site('/support/${widget.id}')),
      builder: (d, reload) {
        final t = mapOf(d['ticket']);
        final status = text(t['status']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle('#${t['id']} · ${t['subject']}', subtitle: '${t['category_label']} · ${_statusLabel(status)}'),
            for (final m in maps(d['messages'])) _Bubble(message: m),
            if (status == 'closed') ...[
              const SizedBox(height: 6),
              Glass(
                child: Row(children: [
                  Expanded(child: Text(tr('Як вам допомогли?'), style: body(14))),
                  for (var n = 1; n <= 5; n++)
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      icon: Icon(LucideIcons.star, size: 22, color: n <= (t['rating'] as int? ?? 0) ? const Color(0xFFF5C542) : muted),
                      onPressed: () async {
                        await attempt(context, () => api.post(Api.site('/support/${widget.id}/rate'), {'rating': n}), success: tr('Дякуємо за оцінку!'));
                        if (mounted) setState(() => _version++);
                      },
                    ),
                ]),
              ),
            ],
            const SizedBox(height: 12),
            Glass(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                GcField(controller: reply, label: status == 'closed' ? tr('Написати — і звернення відкриється знову') : tr('Ваша відповідь'), maxLines: 5, minLines: 2),
                const SizedBox(height: 10),
                Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
                  for (final f in files) Pill(label: f.name, icon: LucideIcons.image),
                  if (files.length < 3)
                    GhostButton(
                      label: tr('Знімок екрана'),
                      icon: LucideIcons.imagePlus,
                      expand: false,
                      compact: true,
                      onPressed: () async {
                        final picked = await ImagePicker().pickMultiImage(imageQuality: 88, maxWidth: 2000);
                        if (picked.isNotEmpty) setState(() => files.addAll(picked.take(3 - files.length)));
                      },
                    ),
                ]),
                const SizedBox(height: 12),
                Row(children: [
                  if (status != 'closed')
                    Expanded(
                      child: GhostButton(
                        label: tr('Питання вирішено'),
                        compact: true,
                        onPressed: () async {
                          await attempt(context, () => api.post(Api.site('/support/${widget.id}/close')));
                          if (mounted) setState(() => _version++);
                        },
                      ),
                    ),
                  if (status != 'closed') const SizedBox(width: 10),
                  Expanded(child: PrimaryButton(label: tr('Надіслати'), compact: true, busy: busy, onPressed: _send)),
                ]),
              ]),
            ),
          ],
        );
      },
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});
  final Map<String, dynamic> message;

  @override
  Widget build(BuildContext context) {
    final staff = message['from_staff'] == true;
    final author = mapOf(message['author']);
    final files = message['files'] is List ? (message['files'] as List).map((e) => '$e').toList() : <String>[];
    return Align(
      alignment: staff ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.82),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
        decoration: BoxDecoration(color: staff ? card : primary.withValues(alpha: 0.22), borderRadius: BorderRadius.circular(18)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(
            '${author.isEmpty ? tr('Підтримка GameCon') : text(author['name'])}${staff && author.isNotEmpty ? ' · ${tr('підтримка')}' : ''} · ${shortStamp(message['created_at'])}',
            style: body(11.5, color: muted),
          ),
          const SizedBox(height: 4),
          Text(text(message['body']) ?? '', style: body(14.5)),
          for (final url in files)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: ClipRRect(borderRadius: BorderRadius.circular(12), child: NetImage('${Api.root}$url', height: 160, radius: 12)),
            ),
        ]),
      ),
    );
  }
}

// ——— Прочитати пізніше ———

/// Черга записів «на потім»: прочитали — «Прочитано», і запис зникає.
class ReadLaterScreen extends StatefulWidget {
  const ReadLaterScreen({super.key});

  @override
  State<ReadLaterScreen> createState() => _ReadLaterScreenState();
}

class _ReadLaterScreenState extends State<ReadLaterScreen> {
  int _version = 0;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      watch: _version,
      load: () => api.get(Api.site('/later')),
      builder: (d, reload) {
        final posts = maps(d['posts']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Прочитати пізніше'), subtitle: tr('Прочитали — позначте, і запис зникне зі списку.')),
            if (posts.isEmpty) EmptyState(icon: LucideIcons.clock, title: tr('Список порожній'), text: tr('У меню «…» будь-якого запису оберіть «Прочитати пізніше».')),
            for (final post in posts) ...[
              PostCard(post: post, onChanged: () => reload()),
              Align(
                alignment: Alignment.centerRight,
                child: GhostButton(
                  label: tr('Прочитано'),
                  icon: LucideIcons.check,
                  expand: false,
                  compact: true,
                  onPressed: () async {
                    await attempt(context, () => api.post(Api.site('/posts/${post['id']}/later')));
                    if (mounted) setState(() => _version++);
                  },
                ),
              ),
              const SizedBox(height: 12),
            ],
          ],
        );
      },
    );
  }
}

// ——— Сповіщення за словами ———

/// До 10 слів: сповіщення про нові публічні записи з ними (не частіше разу на годину за словом).
class KeywordAlertsScreen extends StatefulWidget {
  const KeywordAlertsScreen({super.key});

  @override
  State<KeywordAlertsScreen> createState() => _KeywordAlertsScreenState();
}

class _KeywordAlertsScreenState extends State<KeywordAlertsScreen> {
  final field = TextEditingController();
  int _version = 0;

  @override
  void dispose() {
    field.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      watch: _version,
      load: () => api.get(Api.site('/settings/keyword-alerts')),
      builder: (d, reload) {
        final words = d['keywords'] is List ? (d['keywords'] as List).map((e) => '$e').toList() : <String>[];
        final max = d['max'] as int? ?? 10;
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Сповіщення за словами'), subtitle: tr('Назва гри, нік стримера, тема — і ви дізнаєтеся про нові публічні записи з цим словом.')),
            Glass(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                GcField(controller: field, label: tr('Наприклад: cs2, патч, турнір'), enabled: words.length < max),
                const SizedBox(height: 10),
                PrimaryButton(
                  label: tr('Додати'),
                  icon: LucideIcons.plus,
                  compact: true,
                  onPressed: words.length >= max
                      ? null
                      : () async {
                          final ok = await attempt(context, () => api.post(Api.site('/settings/keyword-alerts'), {'keyword': field.text.trim()}));
                          if (ok && mounted) {
                            field.clear();
                            setState(() => _version++);
                          }
                        },
                ),
                const SizedBox(height: 14),
                if (words.isEmpty) Text(tr('Поки що ви не стежите за жодним словом.'), style: body(13.5, color: muted)),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final w in words)
                    InputChip(
                      label: Text(w, style: body(13.5)),
                      onDeleted: () async {
                        await attempt(context, () => api.delete(Api.site('/settings/keyword-alerts'), {'keyword': w}));
                        if (mounted) setState(() => _version++);
                      },
                    ),
                ]),
                const SizedBox(height: 8),
                Text(tr('{n} з {max}', {'n': '${words.length}', 'max': '$max'}), style: body(12, color: muted)),
              ]),
            ),
          ],
        );
      },
    );
  }
}

// ——— Подкасти ———

/// Каталог подкастів: популярні шоу з випусками, підписка зі сповіщенням про новий випуск.
class PodcastsScreen extends StatelessWidget {
  const PodcastsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/podcasts')),
      builder: (d, reload) {
        final shows = maps(d['podcasts']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Подкасти'), subtitle: tr('Слухайте шоу геймерів і підписуйтеся на нові випуски.')),
            if (shows.isEmpty) EmptyState(icon: LucideIcons.mic, title: tr('Подкастів поки немає'), text: tr('Створити свій подкаст можна на сайті в розділі Музика.')),
            for (final p in shows)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Glass(
                  padding: const EdgeInsets.all(10),
                  onTap: () => context.push('/podcasts/${p['id']}'),
                  child: Row(children: [
                    SizedBox(width: 64, height: 64, child: text(p['cover_url']) != null ? NetImage(text(p['cover_url']), radius: 14) : CoverPlaceholder(seed: p['title'] ?? '', radius: 14, icon: LucideIcons.mic)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(text(p['title']) ?? '', style: body(15, weight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                        Text('${text(mapOf(p['author'])['name']) ?? ''} · ${text(p['category']) ?? ''}', style: body(12.5, color: muted), maxLines: 1, overflow: TextOverflow.ellipsis),
                        Text(tr('Випусків: {n} · підписників: {s}', {'n': '${p['episodes']}', 's': '${p['subscribers']}'}), style: body(12, color: muted)),
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

/// Подкаст: підписка й випуски, які грають у плеєрі застосунку.
class PodcastScreen extends StatefulWidget {
  const PodcastScreen({required this.id, super.key});
  final int id;

  @override
  State<PodcastScreen> createState() => _PodcastScreenState();
}

class _PodcastScreenState extends State<PodcastScreen> {
  int _version = 0;

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.read(context);
    final api = scope.session.api;
    return Remote(
      watch: _version,
      load: () => api.get(Api.site('/podcasts/${widget.id}')),
      builder: (d, reload) {
        final p = mapOf(d['podcast']);
        final episodes = maps(d['episodes']);
        // Випуск у черзі плеєра — як трек (окреме джерело, без медіатеки й лайків).
        final tracks = [
          for (final e in episodes)
            {
              'id': e['id'],
              'key': 'podcast:${e['id']}',
              'source': 'podcast',
              'title': e['title'],
              'artist': p['title'],
              'cover_url': p['cover_url'],
              'url': e['url'],
              'duration': e['duration'],
            },
        ];
        return ScreenScroll(
          onRefresh: reload,
          children: [
            Row(children: [
              SizedBox(width: 88, height: 88, child: text(p['cover_url']) != null ? NetImage(text(p['cover_url']), radius: 18) : CoverPlaceholder(seed: p['title'] ?? '', radius: 18, icon: LucideIcons.mic)),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(text(p['title']) ?? '', style: display(19)),
                  const SizedBox(height: 4),
                  Text(text(mapOf(p['author'])['name']) ?? '', style: body(13, color: muted)),
                ]),
              ),
            ]),
            if (text(p['description']) != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(text(p['description'])!, style: body(14, color: muted))),
            const SizedBox(height: 12),
            PrimaryButton(
              label: p['subscribed'] == true ? tr('Ви підписані') : tr('Підписатися'),
              icon: p['subscribed'] == true ? LucideIcons.bellOff : LucideIcons.bell,
              compact: true,
              onPressed: () async {
                await attempt(context, () => api.post(Api.site('/podcasts/${widget.id}/subscribe')));
                if (mounted) setState(() => _version++);
              },
            ),
            const SizedBox(height: 14),
            if (episodes.isEmpty) EmptyState(icon: LucideIcons.headphones, title: tr('Випусків поки немає')),
            for (var i = 0; i < episodes.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Glass(
                  padding: const EdgeInsets.all(12),
                  onTap: () {
                    scope.player.playList(tracks, i, extend: false);
                    api.post(Api.site('/podcasts/${widget.id}/episodes/${episodes[i]['id']}/play')).catchError((_) => <String, dynamic>{});
                  },
                  child: Row(children: [
                    Icon(LucideIcons.circlePlay, size: 30, color: accent),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(text(episodes[i]['title']) ?? '', style: body(14.5, weight: FontWeight.w600)),
                        Text('${shortStamp(episodes[i]['created_at'])} · ${duration(episodes[i]['duration'])}', style: body(12, color: muted)),
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
