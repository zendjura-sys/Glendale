import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

class FamiliesScreen extends StatefulWidget {
  const FamiliesScreen({required this.session, super.key});
  final Session session;

  @override
  State<FamiliesScreen> createState() => _FamiliesScreenState();
}

class _FamiliesScreenState extends State<FamiliesScreen> {
  final query = TextEditingController();
  String q = '';

  @override
  void dispose() {
    query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Remote(
      watch: q,
      load: () => widget.session.api.get('/api/v1/families?q=${Uri.encodeQueryComponent(q)}'),
      builder: (data, reload) {
        final mine = maps(data['mine']);
        final listed = Listing.parse(data['families']).items;
        final seen = <String>{};
        bool fresh(Map<String, dynamic> row) {
          final key = text(row['slug']) ?? '${text(row['name'])}|${text(row['tag'])}';
          if (seen.contains(key)) return false;
          seen.add(key);
          return true;
        }
        final mineRows = mine.where(fresh).toList();
        final rest = listed.where(fresh).toList();
        return ScreenScroll(
          onRefresh: reload,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(22),
                gradient: const LinearGradient(colors: [Color(0xFF2A2418), Color(0xFF1A1630), Color(0xFF241432)], begin: Alignment.topLeft, end: Alignment.bottomRight),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: const Color(0xFF3A3218), borderRadius: BorderRadius.circular(12)),
                    child: Text('FAMILY ERP', style: onest.copyWith(color: gold, fontSize: 11, fontWeight: FontWeight.w700)),
                  ),
                  const SizedBox(height: 10),
                  Text.rich(TextSpan(children: [
                    TextSpan(text: 'Сім’ї ', style: unbounded.copyWith(fontSize: 28)),
                    TextSpan(text: 'GTA RP', style: unbounded.copyWith(fontSize: 28, color: gold)),
                  ])),
                  const SizedBox(height: 8),
                  Text('Звіти, склад, банк, дисципліна й рейтинг сім’ї — у тій самій розмітці, що й на сайті.', style: onest.copyWith(color: const Color(0xFFD5D8EA), height: 1.35)),
                  const SizedBox(height: 14),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () => launchUrl(Uri.parse('https://gamecon.online/families/create'), mode: LaunchMode.externalApplication),
                        borderRadius: BorderRadius.circular(14),
                        child: Ink(
                          decoration: BoxDecoration(gradient: brand, borderRadius: BorderRadius.circular(14)),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          child: const Text('+ Створити сім’ю', style: TextStyle(color: Colors.white, fontFamily: 'Onest', fontWeight: FontWeight.w600)),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (mineRows.isNotEmpty) ...[
              const SectionLabel('Мої сім’ї'),
              for (final row in mineRows) _catalogCard(context, row, mine: true),
            ],
            const SectionLabel('Каталог сімей'),
            GcField(controller: query, label: 'Назва або тег', onSubmit: () => setState(() => q = query.text.trim())),
            const SizedBox(height: 10),
            for (final row in rest) _catalogCard(context, row, mine: false),
            if (mineRows.isEmpty && rest.isEmpty) const Text('Сімей не знайдено.', style: TextStyle(color: muted, fontFamily: 'Onest')),
          ],
        );
      },
    );
  }

  Widget _catalogCard(BuildContext context, Map<String, dynamic> row, {required bool mine}) {
    final tag = text(row['tag']) ?? '';
    final membership = row['membership'] is Map ? Map<String, dynamic>.from(row['membership'] as Map) : null;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: card,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () {
            final slug = text(row['slug']);
            if (slug != null) context.push('/families/$slug');
          },
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    _TagMark(tag: tag),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text.rich(TextSpan(children: [
                            if (tag.isNotEmpty) TextSpan(text: '[$tag] ', style: onest.copyWith(color: gold, fontWeight: FontWeight.w800)),
                            TextSpan(text: text(row['name']) ?? '', style: onest.copyWith(fontWeight: FontWeight.w800, fontSize: 16)),
                          ])),
                          if (membership != null) Text(text(membership['display']) ?? '', style: onest.copyWith(color: muted, fontSize: 12)),
                          if (!mine && text(row['description']) != null)
                            Text(text(row['description'])!, maxLines: 2, overflow: TextOverflow.ellipsis, style: onest.copyWith(color: muted, fontSize: 13)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    if (membership != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: const Color(0xFF3A2418), borderRadius: BorderRadius.circular(10)),
                        child: Text('${membership['rank'] ?? ''} ${text(membership['rank_title']) ?? ''}', style: onest.copyWith(color: const Color(0xFFFFB086), fontSize: 11)),
                      ),
                    if (row['server'] is Map) ...[
                      const SizedBox(width: 8),
                      Expanded(child: Text(text((row['server'] as Map)['name']) ?? '', style: onest.copyWith(color: muted, fontSize: 12))),
                    ],
                    if (row['is_recruiting'] == true)
                      Text('Набір відкрито', style: onest.copyWith(color: const Color(0xFF34D399), fontSize: 12)),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class FamilyScreen extends StatefulWidget {
  const FamilyScreen({required this.session, required this.slug, super.key});
  final Session session;
  final String slug;

  @override
  State<FamilyScreen> createState() => _FamilyScreenState();
}

class _FamilyScreenState extends State<FamilyScreen> {
  final nick = TextEditingController();
  final staticId = TextEditingController();
  String section = 'overview';
  Map<String, dynamic>? extra;
  bool loading = false;

  @override
  void dispose() {
    nick.dispose();
    staticId.dispose();
    super.dispose();
  }

  Future<void> _open(String value) async {
    setState(() {
      section = value;
      extra = null;
      loading = value != 'overview';
    });
    if (value == 'overview') return;
    try {
      final json = await widget.session.api.get('/api/v1/families/${widget.slug}/$value');
      if (mounted && section == value) setState(() { extra = json; loading = false; });
    } catch (e) {
      if (mounted) setState(() { extra = {'error': '$e'}; loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Remote(
      load: () => widget.session.api.get('/api/v1/families/${widget.slug}'),
      builder: (data, reload) {
        final family = data['family'] is Map ? Map<String, dynamic>.from(data['family'] as Map) : <String, dynamic>{};
        final member = data['member'] is Map ? Map<String, dynamic>.from(data['member'] as Map) : null;
        final active = member != null && member['rank'] != null;
        return ScreenScroll(
          onRefresh: reload,
          children: [
            _Header(family: family, member: member, onChat: data['chat_id'] == null ? null : () => context.push('/messages/${data['chat_id']}')),
            if (!active) ...[
              const SizedBox(height: 12),
              if (text(family['description']) != null) Text(text(family['description'])!, style: onest),
              const SizedBox(height: 12),
              GcField(controller: nick, label: 'RP-нік'),
              const SizedBox(height: 8),
              GcField(controller: staticId, label: 'Static ID'),
              const SizedBox(height: 10),
              PrimaryButton(
                label: 'Подати заявку',
                onPressed: () async {
                  try {
                    await widget.session.api.post('/api/v1/families/${widget.slug}/apply', {
                      'rp_nickname': nick.text.trim(),
                      'static_id': staticId.text.trim(),
                    });
                    await reload();
                  } catch (e) {
                    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                  }
                },
              ),
            ],
            if (active) ...[
              const SizedBox(height: 8),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final tab in const [
                      ('overview', 'Огляд'),
                      ('reports', 'Звіти'),
                      ('bank', 'Банк'),
                      ('warehouse', 'Склад'),
                      ('members', 'Учасники'),
                      ('events', 'Події'),
                      ('audit', 'Аудит'),
                    ])
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(tab.$2, style: onest.copyWith(fontSize: 13)),
                          selected: section == tab.$1,
                          selectedColor: indigo,
                          backgroundColor: card,
                          onSelected: (_) => _open(tab.$1),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              if (section == 'overview') _Overview(family: family, member: member),
              if (loading) const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator(color: indigo))),
              if (!loading && extra != null && extra!['error'] != null) Text('${extra!['error']}', style: onest),
              if (!loading && extra != null && extra!['error'] == null) _SectionBody(section: section, data: extra!),
            ],
          ],
        );
      },
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.family, required this.member, required this.onChat});
  final Map<String, dynamic> family;
  final Map<String, dynamic>? member;
  final VoidCallback? onChat;

  @override
  Widget build(BuildContext context) {
    final tag = text(family['tag']) ?? '';
    final server = family['server'] is Map ? Map<String, dynamic>.from(family['server'] as Map) : null;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(colors: [Color(0xFF1B2448), Color(0xFF2A1848)], begin: Alignment.topLeft, end: Alignment.bottomRight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _TagMark(tag: tag, size: 64),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(TextSpan(children: [
                      if (tag.isNotEmpty) TextSpan(text: '[$tag] ', style: unbounded.copyWith(fontSize: 16, color: gold)),
                      TextSpan(text: text(family['name']) ?? '', style: unbounded.copyWith(fontSize: 18)),
                    ])),
                    if (server != null) Text(text(server['name']) ?? '', style: onest.copyWith(color: muted, fontSize: 12)),
                    if (family['treasury'] != null) Text('Скарбниця: ${hryvnia(family['treasury'])}', style: onest.copyWith(color: const Color(0xFF34D399), fontSize: 12)),
                  ],
                ),
              ),
            ],
          ),
          if (member != null) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(text(member?['display']) ?? '', style: onest.copyWith(fontWeight: FontWeight.w700)),
                      Text('${member?['rank'] ?? ''} ${text(member?['rank_title']) ?? ''}', style: onest.copyWith(color: const Color(0xFFFFB086), fontSize: 12)),
                    ],
                  ),
                ),
                if (member?['balance'] != null) Text(hryvnia(member?['balance']), style: onest.copyWith(color: const Color(0xFF34D399), fontWeight: FontWeight.w700)),
                if (onChat != null) ...[
                  const SizedBox(width: 8),
                  OutlinedButton.icon(onPressed: onChat, icon: const Icon(Icons.chat_bubble_outline_rounded, size: 16), label: const Text('Чат')),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Overview extends StatelessWidget {
  const _Overview({required this.family, required this.member});
  final Map<String, dynamic> family;
  final Map<String, dynamic> member;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: _stat('Мій баланс', hryvnia(member['balance']))),
            const SizedBox(width: 8),
            Expanded(child: _stat('Скарбниця', hryvnia(family['treasury']))),
          ],
        ),
        if (text(family['description']) != null) ...[
          const SizedBox(height: 10),
          Glass(child: Text(text(family['description'])!, style: onest.copyWith(height: 1.4))),
        ],
      ],
    );
  }

  Widget _stat(String label, String value) {
    return Glass(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: onest.copyWith(color: muted, fontSize: 11)),
          const SizedBox(height: 6),
          Text(value, style: unbounded.copyWith(fontSize: 18, color: const Color(0xFF34D399))),
        ],
      ),
    );
  }
}

class _SectionBody extends StatelessWidget {
  const _SectionBody({required this.section, required this.data});
  final String section;
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final rows = maps(data[section] ?? data['transactions'] ?? data['items'] ?? data['entries'] ?? data['members'] ?? data['reports'] ?? data['events']);
    if (section == 'bank') {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Баланс ${hryvnia(data['balance'])}', style: unbounded.copyWith(fontSize: 20, color: const Color(0xFF34D399))),
          const SizedBox(height: 8),
          if (maps(data['transactions']).isEmpty) const Text('Операцій ще немає.', style: TextStyle(color: muted, fontFamily: 'Onest')),
          for (final row in maps(data['transactions']))
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(text(row['type_label']) ?? text(row['comment']) ?? '', style: onest),
              subtitle: Text(text(row['comment']) ?? '', style: onest.copyWith(color: muted, fontSize: 12)),
              trailing: Text(hryvnia(row['amount']), style: onest.copyWith(color: const Color(0xFF34D399))),
            ),
        ],
      );
    }
    if (rows.isEmpty) {
      return const Padding(padding: EdgeInsets.only(top: 12), child: Text('Тут поки порожньо.', style: TextStyle(color: muted, fontFamily: 'Onest')));
    }
    return Column(
      children: [
        for (final row in rows)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Glass(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(text(row['display']) ?? text(row['name']) ?? text(row['title']) ?? text(row['type_label']) ?? text(row['action_label']) ?? '', style: onest.copyWith(fontWeight: FontWeight.w700)),
                        Text(
                          text(row['rank_title']) ?? text(row['description']) ?? text(row['actor']) ?? text(row['type_label']) ?? '',
                          style: onest.copyWith(color: muted, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  if (row['quantity'] != null) Text('${row['quantity']} ${text(row['unit']) ?? 'шт'}', style: onest.copyWith(fontWeight: FontWeight.w700)),
                  if (row['reward'] != null) Text(hryvnia(row['reward']), style: onest.copyWith(color: const Color(0xFF34D399))),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _TagMark extends StatelessWidget {
  const _TagMark({required this.tag, this.size = 52});
  final String tag;
  final double size;

  @override
  Widget build(BuildContext context) {
    final letters = tag.isEmpty ? '?' : tag.substring(0, tag.length.clamp(0, 4));
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(gradient: brand, borderRadius: BorderRadius.circular(16)),
      child: Text(letters, style: unbounded.copyWith(fontSize: size * 0.28)),
    );
  }
}
