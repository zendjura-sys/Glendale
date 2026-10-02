import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

export 'family_home.dart';

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

class _TagMark extends StatelessWidget {
  const _TagMark({required this.tag});
  final String tag;

  @override
  Widget build(BuildContext context) {
    const size = 52.0;
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

