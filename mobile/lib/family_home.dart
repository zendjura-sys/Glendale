import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

import 'api.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

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

  Future<void> open(String value) async {
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

  void report(BuildContext context, Map<String, dynamic> overview) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF12162A),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (context) => _ReportSheet(
        session: widget.session,
        slug: widget.slug,
        rates: overview['rates'] is Map ? Map<String, dynamic>.from(overview['rates'] as Map) : const {},
        deadline: overview['deadline_hours'] ?? 48,
        maxProofs: overview['max_proofs'] ?? 10,
        onSent: () => open('reports'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Remote(
      load: () => widget.session.api.get('/api/v1/families/${widget.slug}'),
      builder: (data, reload) {
        final family = data['family'] is Map ? Map<String, dynamic>.from(data['family'] as Map) : <String, dynamic>{};
        final member = data['member'] is Map ? Map<String, dynamic>.from(data['member'] as Map) : null;
        final active = member != null && member['rank'] != null;
        final abilities = data['abilities'] is Map ? Map<String, dynamic>.from(data['abilities'] as Map) : <String, dynamic>{};
        final overview = data['overview'] is Map ? Map<String, dynamic>.from(data['overview'] as Map) : <String, dynamic>{};
        final tabs = [
          ('overview', 'Огляд', Icons.grid_view_rounded),
          ('reports', 'Звіти', Icons.description_outlined),
          if (abilities['reports.review'] == true || abilities['treasury.manage'] == true) ('queue', 'Перевірка', Icons.fact_check_outlined),
          ('bank', 'Банк', Icons.account_balance_wallet_outlined),
          ('warehouse', 'Склад', Icons.inventory_2_outlined),
          ('members', 'Учасники', Icons.group_outlined),
          ('discipline', 'Дисципліна', Icons.gavel_rounded),
          ('events', 'Події', Icons.event_outlined),
          ('rating', 'Рейтинг', Icons.bar_chart_rounded),
          if (abilities['audit.view'] == true) ('audit', 'Аудит', Icons.receipt_long_outlined),
          if (abilities['settings.manage'] == true) ('settings', 'Налаштування', Icons.settings_outlined),
        ];
        return Stack(
          children: [
            ScreenScroll(
              onRefresh: () async {
                await reload();
                if (section != 'overview') await open(section);
              },
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
                  const SizedBox(height: 10),
                  SizedBox(
                    height: 40,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: tabs.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 6),
                      itemBuilder: (_, i) {
                        final tab = tabs[i];
                        final on = section == tab.$1;
                        return InkWell(
                          onTap: () => open(tab.$1),
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                            decoration: BoxDecoration(
                              border: Border(bottom: BorderSide(color: on ? const Color(0xFF8B7CFF) : Colors.transparent, width: 2)),
                            ),
                            child: Row(
                              children: [
                                Icon(tab.$3, size: 16, color: on ? Colors.white : muted),
                                const SizedBox(width: 6),
                                Text(tab.$2, style: onest.copyWith(fontWeight: on ? FontWeight.w700 : FontWeight.w500, color: on ? Colors.white : muted, fontSize: 14)),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (section == 'overview') _Overview(overview: overview, onReport: () => report(context, overview), onRating: () => open('rating'), onBank: () => open('bank'), onEvents: () => open('events')),
                  if (loading) const Padding(padding: EdgeInsets.all(28), child: Center(child: CircularProgressIndicator(color: indigo))),
                  if (!loading && extra?['error'] != null) Text('${extra!['error']}', style: onest),
                  if (!loading && extra != null && extra!['error'] == null)
                    _Section(
                      section: section,
                      data: extra!,
                      session: widget.session,
                      slug: widget.slug,
                      overview: overview,
                      onReport: () => report(context, overview),
                      reload: () => open(section),
                    ),
                ],
                const SizedBox(height: 72),
              ],
            ),
            if (active)
              Positioned(
                right: 8,
                bottom: 8,
                child: _Fab(onTap: () => report(context, overview)),
              ),
          ],
        );
      },
    );
  }
}

class _Fab extends StatelessWidget {
  const _Fab({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      elevation: 8,
      shadowColor: indigo,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [Color(0xFF8B7CFF), Color(0xFF6D5EF5)]),
            borderRadius: BorderRadius.circular(18),
            boxShadow: [BoxShadow(color: indigo.withValues(alpha: 0.45), blurRadius: 18, offset: const Offset(0, 8))],
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.note_add_outlined, color: Colors.white, size: 18),
              const SizedBox(width: 6),
              Text('Звіт', style: onest.copyWith(fontWeight: FontWeight.w700)),
            ],
          ),
        ),
      ),
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
    final logo = absolute(family['logo_url']);
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(26),
        gradient: const LinearGradient(colors: [Color(0xFF2A2158), Color(0xFF1A1840), Color(0xFF241432)], begin: Alignment.topLeft, end: Alignment.bottomRight),
      ),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: logo != null
                    ? CachedNetworkImage(imageUrl: logo, width: 72, height: 72, fit: BoxFit.cover)
                    : Container(
                        width: 72,
                        height: 72,
                        alignment: Alignment.center,
                        decoration: const BoxDecoration(gradient: LinearGradient(colors: [Color(0xFF6D5EF5), Color(0xFF9B6BFF)])),
                        child: Text(tag.isEmpty ? '?' : tag.substring(0, tag.length.clamp(0, 4)), style: unbounded.copyWith(fontSize: 16)),
                      ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(TextSpan(children: [
                      TextSpan(text: tag.isEmpty ? '' : '[$tag] ', style: unbounded.copyWith(fontSize: 18, color: gold)),
                      TextSpan(text: text(family['name']) ?? '', style: unbounded.copyWith(fontSize: 18)),
                      if (family['status'] == 'verified') const WidgetSpan(child: Padding(padding: EdgeInsets.only(left: 4), child: Icon(Icons.verified_rounded, color: Color(0xFF34D399), size: 18))),
                    ])),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 10,
                      children: [
                        if (server != null) Text(text(server['name']) ?? '', style: onest.copyWith(color: muted, fontSize: 12)),
                        Text('${family['members_count'] ?? 0}', style: onest.copyWith(color: muted, fontSize: 12)),
                        if (family['treasury'] != null) Text('Скарбниця: ${hryvnia(family['treasury'])}', style: onest.copyWith(color: muted, fontSize: 12)),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (member != null && member!['rank'] != null) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.25), borderRadius: BorderRadius.circular(16)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(text(member?['display']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: onest.copyWith(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(color: const Color(0xFF3A2A14), borderRadius: BorderRadius.circular(10)),
                          child: Text('${member?['rank']} ${text(member?['rank_title']) ?? ''}', style: onest.copyWith(color: gold, fontSize: 11, fontWeight: FontWeight.w700)),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.25), borderRadius: BorderRadius.circular(16)),
                  child: Column(
                    children: [
                      Text('БАЛАНС', style: onest.copyWith(color: muted, fontSize: 10, letterSpacing: 0.6)),
                      Text(hryvnia(member?['balance']), style: onest.copyWith(color: const Color(0xFF34D399), fontWeight: FontWeight.w800)),
                    ],
                  ),
                ),
                if (onChat != null) ...[
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: onChat,
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      width: 58,
                      height: 58,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.25), borderRadius: BorderRadius.circular(16)),
                      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [const Icon(Icons.chat_bubble_outline_rounded, size: 18), Text('Чат', style: onest.copyWith(fontSize: 11))]),
                    ),
                  ),
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
  const _Overview({required this.overview, required this.onReport, required this.onRating, required this.onBank, required this.onEvents});
  final Map<String, dynamic> overview;
  final VoidCallback onReport;
  final VoidCallback onRating;
  final VoidCallback onBank;
  final VoidCallback onEvents;

  @override
  Widget build(BuildContext context) {
    final stats = overview['stats'] is Map ? Map<String, dynamic>.from(overview['stats'] as Map) : <String, dynamic>{};
    final leaders = maps(overview['leaders']);
    final events = maps(overview['events']);
    final ops = maps(overview['transactions']);
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: _Metric('ЗАРОБИВ ЗА ТИЖДЕНЬ', hryvnia(stats['week_earned']), const Color(0xFF34D399), Icons.trending_up_rounded)),
            const SizedBox(width: 8),
            Expanded(child: _Metric('ВИПЛАТИ СІМ’Ї (ТИЖДЕНЬ)', hryvnia(stats['week_total']), const Color(0xFF34D399), Icons.account_balance_wallet_outlined)),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: _Metric('МОЇ ЗВІТИ НА ПЕРЕВІРЦІ', '${stats['pending_reports'] ?? 0}', gold, Icons.schedule_rounded)),
            const SizedBox(width: 8),
            Expanded(child: _Metric('ПОПЕРЕДЖЕННЯ', '${stats['warns'] ?? 0}/${stats['warn_limit'] ?? 3}', Colors.white, Icons.warning_amber_rounded)),
          ],
        ),
        const SizedBox(height: 12),
        InkWell(
          onTap: onReport,
          borderRadius: BorderRadius.circular(22),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: card, borderRadius: BorderRadius.circular(22), border: Border.all(color: Colors.white.withValues(alpha: 0.05))),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), gradient: const LinearGradient(colors: [Color(0xFFF5C451), Color(0xFFF0734A)])),
                  child: const Icon(Icons.note_add_outlined, color: Colors.white),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Подати звіт', style: unbounded.copyWith(fontSize: 16)),
                      Text('Бізвар, контракти, інвестиція — за себе чи за друга', style: onest.copyWith(color: muted, fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Лідери тижня',
          icon: Icons.bar_chart_rounded,
          action: 'Увесь рейтинг',
          onAction: onRating,
          child: leaders.isEmpty
              ? const _Empty(icon: Icons.bar_chart_rounded, text: 'Схвалених звітів цього тижня ще немає')
              : Column(
                  children: [
                    for (final row in leaders)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            Text('${row['place'] ?? ''}', style: onest.copyWith(color: gold, fontWeight: FontWeight.w800)),
                            const SizedBox(width: 8),
                            Expanded(child: Text(text(row['display']) ?? '', style: onest)),
                            Text(hryvnia(row['earned']), style: onest.copyWith(color: muted, fontSize: 12)),
                            const SizedBox(width: 8),
                            Text('${row['points'] ?? 0}', style: onest.copyWith(color: gold, fontWeight: FontWeight.w800)),
                          ],
                        ),
                      ),
                  ],
                ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Мої операції',
          icon: Icons.account_balance_wallet_outlined,
          action: 'Банк',
          onAction: onBank,
          child: ops.isEmpty
              ? const _Empty(icon: Icons.account_balance_wallet_outlined, text: 'Операцій ще не було')
              : Column(
                  children: [
                    for (final row in ops)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(text(row['type_label']) ?? '', style: onest),
                        subtitle: Text(text(row['comment']) ?? '', style: onest.copyWith(color: muted, fontSize: 12)),
                        trailing: Text(hryvnia(row['amount']), style: onest.copyWith(color: const Color(0xFF34D399))),
                      ),
                  ],
                ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Найближчі події',
          icon: Icons.event_outlined,
          action: 'Усі',
          onAction: onEvents,
          child: events.isEmpty
              ? const _Empty(icon: Icons.event_outlined, text: 'Запланованих подій немає')
              : Column(children: [for (final row in events) ListTile(contentPadding: EdgeInsets.zero, title: Text(text(row['title']) ?? '', style: onest), subtitle: Text(text(row['starts_at']) ?? '', style: onest.copyWith(color: muted, fontSize: 12)))]),
        ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.section, required this.data, required this.session, required this.slug, required this.overview, required this.onReport, required this.reload});
  final String section;
  final Map<String, dynamic> data;
  final Session session;
  final String slug;
  final Map<String, dynamic> overview;
  final VoidCallback onReport;
  final Future<void> Function() reload;

  @override
  Widget build(BuildContext context) {
    return switch (section) {
      'reports' => _Reports(data: data, onReport: onReport),
      'queue' => _Queue(session: session, slug: slug, data: data, onChanged: reload),
      'bank' => _Bank(session: session, slug: slug, data: data, onChanged: reload),
      'warehouse' => _SimpleList(maps(data['items']), empty: 'На складі порожньо.', titleOf: (row) => text(row['name']) ?? 'Предмет', subtitleOf: (row) => '${row['quantity'] ?? 0} ${text(row['unit']) ?? 'шт'}'),
      'members' => _Members(data: data),
      'discipline' => _Discipline(session: session, slug: slug, data: data, onChanged: reload),
      'events' => _SimpleList(maps(data['events']), empty: 'Запланованих подій немає', titleOf: (row) => text(row['title']) ?? 'Подія', subtitleOf: (row) => '${text(row['type_label']) ?? ''} · ${text(row['starts_at']) ?? ''}'),
      'rating' => _Rating(rows: maps(data['rows'])),
      'audit' => _Audit(rows: maps(data['entries'])),
      'settings' => _Settings(session: session, slug: slug, data: data),
      _ => const SizedBox.shrink(),
    };
  }
}

class _Reports extends StatelessWidget {
  const _Reports({required this.data, required this.onReport});
  final Map<String, dynamic> data;
  final VoidCallback onReport;

  @override
  Widget build(BuildContext context) {
    final rows = maps(data['reports']);
    return Column(
      children: [
        GhostButton(label: 'Подати звіт', icon: Icons.note_add_outlined, onPressed: onReport),
        const SizedBox(height: 12),
        if (rows.isEmpty) const _Empty(icon: Icons.description_outlined, text: 'Звітів ще немає'),
        for (final row in rows)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _Panel(
              title: '${text(row['type_label']) ?? 'Звіт'} · ${text(row['event_date']) ?? ''}',
              icon: Icons.description_outlined,
              child: Row(
                children: [
                  Expanded(child: Text(text(row['description']) ?? '', style: onest.copyWith(color: muted, fontSize: 12))),
                  Text(_status(text(row['status'])), style: onest.copyWith(color: _statusColor(text(row['status'])), fontWeight: FontWeight.w700)),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

String _status(String? value) => switch (value) {
  'approved' => 'Схвалено',
  'rejected' => 'Відхилено',
  _ => 'На перевірці',
};

Color _statusColor(String? value) => switch (value) {
  'approved' => const Color(0xFF34D399),
  'rejected' => const Color(0xFFF87171),
  _ => gold,
};

class _Queue extends StatefulWidget {
  const _Queue({required this.session, required this.slug, required this.data, required this.onChanged});
  final Session session;
  final String slug;
  final Map<String, dynamic> data;
  final Future<void> Function() onChanged;

  @override
  State<_Queue> createState() => _QueueState();
}

class _QueueState extends State<_Queue> {
  String tab = 'reports';

  Future<void> decide(int id, String decision, [String? comment]) async {
    try {
      await widget.session.api.post('/api/v1/families/${widget.slug}/reports/$id/review', {
        'decision': decision,
        'comment': ?comment,
      });
      await widget.onChanged();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final reports = maps(widget.data['reports']);
    final cashouts = maps(widget.data['cashouts']);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _Chip('Звіти', tab == 'reports', () => setState(() => tab = 'reports')),
            const SizedBox(width: 8),
            _Chip('Виплати', tab == 'cashouts', () => setState(() => tab = 'cashouts')),
          ],
        ),
        const SizedBox(height: 12),
        if (tab == 'reports' && reports.isEmpty) const _Empty(icon: Icons.fact_check_outlined, text: 'Черга порожня — усі звіти перевірено'),
        if (tab == 'cashouts' && cashouts.isEmpty)
          const _Panel(title: 'Заявки на виплату', icon: Icons.account_balance_wallet_outlined, child: _Empty(icon: Icons.account_balance_wallet_outlined, text: 'Нових заявок немає')),
        if (tab == 'reports')
          for (final row in reports)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _Panel(
                title: '${text(row['type_label']) ?? 'Звіт'} #${row['id']}',
                icon: Icons.fact_check_outlined,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${text(row['beneficiary']) ?? ''} · ${text(row['event_date']) ?? ''}', style: onest.copyWith(color: muted, fontSize: 12)),
                    if (text(row['description']) != null) Text(text(row['description'])!, style: onest.copyWith(fontSize: 13)),
                    if (row['self_review'] == true)
                      Text('Свій звіт перевіряє інший офіцер.', style: onest.copyWith(color: muted, fontSize: 12))
                    else
                      Row(
                        children: [
                          TextButton(onPressed: () => decide(row['id'] as int, 'approve'), child: const Text('Схвалити', style: TextStyle(color: Color(0xFF34D399), fontFamily: 'Onest'))),
                          TextButton(
                            onPressed: () async {
                              final comment = TextEditingController();
                              final ok = await showDialog<bool>(
                                context: context,
                                builder: (context) => AlertDialog(
                                  backgroundColor: deep,
                                  title: Text('Причина відхилення', style: onest),
                                  content: GcField(controller: comment, label: 'Коментар'),
                                  actions: [
                                    TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Скасувати')),
                                    TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Відхилити')),
                                  ],
                                ),
                              );
                              if (ok == true && context.mounted) await decide(row['id'] as int, 'reject', comment.text.trim());
                              comment.dispose();
                            },
                            child: const Text('Відхилити', style: TextStyle(color: Color(0xFFF87171), fontFamily: 'Onest')),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
        if (tab == 'cashouts')
          for (final row in cashouts)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(row['member'] is Map ? text((row['member'] as Map)['display']) ?? '' : '', style: onest),
              trailing: Text(hryvnia(row['amount']), style: onest.copyWith(color: const Color(0xFF34D399), fontWeight: FontWeight.w700)),
            ),
      ],
    );
  }
}

class _Bank extends StatefulWidget {
  const _Bank({required this.session, required this.slug, required this.data, required this.onChanged});
  final Session session;
  final String slug;
  final Map<String, dynamic> data;
  final Future<void> Function() onChanged;

  @override
  State<_Bank> createState() => _BankState();
}

class _BankState extends State<_Bank> {
  final amount = TextEditingController();
  final note = TextEditingController();
  final depositAmount = TextEditingController();
  final manualAmount = TextEditingController();
  final manualComment = TextEditingController();
  bool manualOpen = false;
  String period = 'weekly';
  int periods = 1;
  String account = 'member';
  String direction = 'credit';
  int? targetId;
  String scope = 'me';

  @override
  void dispose() {
    amount.dispose();
    note.dispose();
    depositAmount.dispose();
    manualAmount.dispose();
    manualComment.dispose();
    super.dispose();
  }

  Map<String, dynamic> get totals => widget.data['totals'] is Map ? Map<String, dynamic>.from(widget.data['totals'] as Map) : {};
  Map<String, dynamic> get config => widget.data['config'] is Map ? Map<String, dynamic>.from(widget.data['config'] as Map) : {};

  Future<void> send(Future<void> Function() action) async {
    try {
      await action();
      await widget.onChanged();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final deposits = config['deposits'] is Map ? Map<String, dynamic>.from(config['deposits'] as Map) : <String, dynamic>{};
    final roster = maps(widget.data['roster']);
    final rows = maps(widget.data['transactions']);
    final shown = scope == 'family' && widget.data['scope'] != 'family' ? rows : rows;
    return Column(
      children: [
        Row(children: [
          Expanded(child: _Metric('МІЙ БАЛАНС', hryvnia(widget.data['balance']), const Color(0xFF34D399), Icons.account_balance_wallet_outlined)),
          const SizedBox(width: 8),
          Expanded(child: _Metric('СКАРБНИЦЯ', hryvnia(widget.data['treasury']), const Color(0xFF34D399), Icons.account_balance_outlined)),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: _Metric('БОРГ ПЕРЕД УЧАСНИКАМИ', hryvnia(totals['balances']), const Color(0xFF34D399), Icons.groups_outlined)),
          const SizedBox(width: 8),
          Expanded(child: _Metric('ДЕПОЗИТИ', hryvnia(totals['deposits']), const Color(0xFF34D399), Icons.savings_outlined)),
        ]),
        const SizedBox(height: 12),
        _Panel(
          title: 'Вивести гроші в грі',
          icon: Icons.payments_outlined,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Сума резервується з вашого балансу, офіцер видає її в грі й підтверджує. Мінімум — ${hryvnia(((num.tryParse('${config['cashout_min'] ?? 100}') ?? 100) * 100).round())}.', style: onest.copyWith(color: muted, fontSize: 12)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(child: GcField(controller: amount, label: 'Сума, ₴')),
                  const SizedBox(width: 8),
                  TextButton(onPressed: () => amount.text = '${((widget.data['balance'] as num?) ?? 0) / 100}', child: const Text('Усе')),
                  FilledButton(onPressed: () => send(() => widget.session.api.post('/api/v1/families/${widget.slug}/cashouts', {'amount': amount.text.trim(), 'note': note.text.trim()})), child: const Text('Запросити')),
                ],
              ),
              const SizedBox(height: 8),
              GcField(controller: note, label: 'Примітка: коли зручно отримати'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Депозит',
          icon: Icons.savings_outlined,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${deposits['daily_rate'] ?? 1}% на день або ${deposits['weekly_rate'] ?? 7}% на тиждень. Дострокове закриття повертає лише тіло депозиту.', style: onest.copyWith(color: muted, fontSize: 12)),
              const SizedBox(height: 8),
              GcField(controller: depositAmount, label: 'Від ${deposits['min_amount'] ?? 1000} ₴'),
              const SizedBox(height: 8),
              Row(children: [
                _Chip('Дні', period == 'daily', () => setState(() { period = 'daily'; periods = 1; })),
                const SizedBox(width: 8),
                _Chip('Тижні', period == 'weekly', () => setState(() { period = 'weekly'; periods = 1; })),
              ]),
              Slider(
                value: periods.toDouble(),
                min: 1,
                max: (period == 'daily' ? (deposits['max_days'] ?? 30) : (deposits['max_weeks'] ?? 8)).toDouble(),
                activeColor: indigo,
                onChanged: (value) => setState(() => periods = value.round()),
              ),
              Row(
                children: [
                  Text('$periods ${period == 'daily' ? 'дн.' : 'тиж.'}', style: onest),
                  const Spacer(),
                  FilledButton(
                    onPressed: () => send(() => widget.session.api.post('/api/v1/families/${widget.slug}/deposits', {
                      'amount': depositAmount.text.trim(),
                      'period': period,
                      'periods': periods,
                    })),
                    child: const Text('Відкрити'),
                  ),
                ],
              ),
            ],
          ),
        ),
        if (roster.isNotEmpty) ...[
          const SizedBox(height: 12),
          _Panel(
            title: 'Ручна операція',
            icon: Icons.tune_rounded,
            action: manualOpen ? 'Згорнути' : 'Розгорнути',
            onAction: () => setState(() => manualOpen = !manualOpen),
            child: manualOpen
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        _Chip('Учасник', account == 'member', () => setState(() => account = 'member')),
                        const SizedBox(width: 8),
                        _Chip('Скарбниця', account == 'treasury', () => setState(() => account = 'treasury')),
                      ]),
                      if (account == 'member')
                        DropdownButton<int>(
                          isExpanded: true,
                          dropdownColor: card,
                          value: targetId,
                          hint: Text('Оберіть...', style: onest.copyWith(color: muted)),
                          items: [for (final row in roster) if (row['id'] is int) DropdownMenuItem(value: row['id'] as int, child: Text(text(row['display']) ?? '', style: onest))],
                          onChanged: (value) => setState(() => targetId = value),
                        ),
                      Row(children: [
                        _Chip('Нарахувати', direction == 'credit', () => setState(() => direction = 'credit')),
                        const SizedBox(width: 8),
                        _Chip('Списати', direction == 'debit', () => setState(() => direction = 'debit')),
                      ]),
                      const SizedBox(height: 8),
                      GcField(controller: manualAmount, label: 'Сума, ₴'),
                      const SizedBox(height: 8),
                      GcField(controller: manualComment, label: 'Коментар (потрапить у журнал аудиту)'),
                      const SizedBox(height: 10),
                      PrimaryButton(
                        label: 'Провести',
                        onPressed: () => send(() => widget.session.api.post('/api/v1/families/${widget.slug}/bank/manual', {
                          'target': account,
                          'member_id': ?targetId,
                          'direction': direction,
                          'amount': manualAmount.text.trim(),
                          'comment': manualComment.text.trim(),
                        })),
                      ),
                    ],
                  )
                : Text('Нарахування чи списання з балансу учасника або скарбниці з обов’язковим коментарем.', style: onest.copyWith(color: muted, fontSize: 12)),
          ),
        ],
        const SizedBox(height: 12),
        _Panel(
          title: 'Журнал операцій',
          icon: Icons.receipt_long_outlined,
          child: Column(
            children: [
              Row(children: [
                _Chip('Мої', scope == 'me', () async {
                  setState(() => scope = 'me');
                  final json = await widget.session.api.get('/api/v1/families/${widget.slug}/bank?scope=me');
                  if (mounted) setState(() => widget.data.addAll(json));
                }),
                if (roster.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  _Chip('Уся сім’я', scope == 'family', () async {
                    setState(() => scope = 'family');
                    final json = await widget.session.api.get('/api/v1/families/${widget.slug}/bank?scope=family');
                    if (mounted) setState(() => widget.data.addAll(json));
                  }),
                ],
              ]),
              if (shown.isEmpty) const _Empty(icon: Icons.receipt_long_outlined, text: 'Операцій ще немає'),
              for (final row in shown)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(text(row['type_label']) ?? '', style: onest),
                  subtitle: Text(text(row['comment']) ?? text(row['member']) ?? '', style: onest.copyWith(color: muted, fontSize: 12)),
                  trailing: Text(hryvnia(row['amount'] == 0 ? row['treasury_delta'] : row['amount']), style: onest.copyWith(color: const Color(0xFF34D399))),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Members extends StatefulWidget {
  const _Members({required this.data});
  final Map<String, dynamic> data;

  @override
  State<_Members> createState() => _MembersState();
}

class _MembersState extends State<_Members> {
  String tab = 'members';
  final query = TextEditingController();

  @override
  void dispose() {
    query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final q = query.text.trim().toLowerCase();
    final members = maps(widget.data['members']).where((row) {
      if (q.isEmpty) return true;
      return '${row['display']} ${row['username']} ${row['static_id']}'.toLowerCase().contains(q);
    }).toList();
    final apps = maps(widget.data['applications']);
    final ranks = widget.data['ranks'] is Map ? Map<String, dynamic>.from(widget.data['ranks'] as Map) : <String, dynamic>{};
    return Column(
      children: [
        Row(children: [
          _Chip('Учасники · ${maps(widget.data['members']).length}', tab == 'members', () => setState(() => tab = 'members')),
          const SizedBox(width: 8),
          _Chip('Заявки', tab == 'apps', () => setState(() => tab = 'apps')),
        ]),
        const SizedBox(height: 8),
        if (tab == 'members') ...[
          GcField(controller: query, label: 'Нік, ID або обов’язки', onSubmit: () => setState(() {})),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: () => showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                backgroundColor: const Color(0xFF12162A),
                builder: (context) => _RanksSheet(ranks: ranks),
              ),
              icon: const Icon(Icons.shield_outlined, color: muted, size: 16),
              label: Text('Ранги й права', style: onest.copyWith(color: muted)),
            ),
          ),
          for (final row in members) _MemberRow(row: row),
        ] else if (apps.isEmpty)
          const _Panel(title: 'Заявки на вступ', icon: Icons.person_add_alt_1_rounded, child: _Empty(icon: Icons.person_outline_rounded, text: 'Нових заявок немає'))
        else
          for (final row in apps) _MemberRow(row: row),
      ],
    );
  }
}

class _MemberRow extends StatelessWidget {
  const _MemberRow({required this.row});
  final Map<String, dynamic> row;

  @override
  Widget build(BuildContext context) {
    final joined = DateTime.tryParse(text(row['joined_at']) ?? '');
    final when = joined == null
        ? ''
        : DateUtils.isSameDay(joined.toLocal(), DateTime.now())
            ? 'у сім’ї сьогодні о ${joined.toLocal().hour.toString().padLeft(2, '0')}:${joined.toLocal().minute.toString().padLeft(2, '0')}'
            : 'у сім’ї з ${joined.toLocal().day}.${joined.toLocal().month}';
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: card, borderRadius: BorderRadius.circular(18)),
        child: Row(
          children: [
            Avatar(url: text(row['avatar_url']), name: text(row['display']) ?? '?', online: row['is_online'] == true),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Flexible(child: Text(text(row['display']) ?? '', style: onest.copyWith(fontWeight: FontWeight.w700))),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: const Color(0xFF3A2A14), borderRadius: BorderRadius.circular(8)),
                      child: Text('${row['rank']} ${text(row['rank_title']) ?? ''}', style: onest.copyWith(color: gold, fontSize: 10)),
                    ),
                  ]),
                  Text('@${text(row['username']) ?? ''} · ${row['is_online'] == true ? 'онлайн' : 'не в мережі'} · $when', maxLines: 1, overflow: TextOverflow.ellipsis, style: onest.copyWith(color: muted, fontSize: 11)),
                ],
              ),
            ),
            Text(hryvnia(row['balance']), style: onest.copyWith(color: const Color(0xFF34D399), fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

class _RanksSheet extends StatelessWidget {
  const _RanksSheet({required this.ranks});
  final Map<String, dynamic> ranks;

  @override
  Widget build(BuildContext context) {
    final titles = ranks['titles'] is Map ? Map<String, dynamic>.from(ranks['titles'] as Map) : <String, dynamic>{};
    final matrix = ranks['matrix'] is Map ? Map<String, dynamic>.from(ranks['matrix'] as Map) : <String, dynamic>{};
    final permissions = ranks['permissions'] is Map ? Map<String, dynamic>.from(ranks['permissions'] as Map) : <String, dynamic>{};
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.9,
      builder: (context, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.all(16),
        children: [
          Text('Ранги й права', style: unbounded.copyWith(fontSize: 20)),
          Text('Лідер (ранг 10) має всі права. Видати право рангу, вищому за ваш, неможливо.', style: onest.copyWith(color: muted, fontSize: 12)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (var rank = 1; rank <= 10; rank++)
                SizedBox(width: 150, child: _ReadField('Ранг $rank', text(titles['$rank']) ?? '')),
            ],
          ),
          const SizedBox(height: 12),
          for (final entry in permissions.entries)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text('${entry.value}: ${(matrix[entry.key] as List?)?.join(', ') ?? '—'}', style: onest.copyWith(fontSize: 12)),
            ),
        ],
      ),
    );
  }
}

class _Discipline extends StatefulWidget {
  const _Discipline({required this.session, required this.slug, required this.data, required this.onChanged});
  final Session session;
  final String slug;
  final Map<String, dynamic> data;
  final Future<void> Function() onChanged;

  @override
  State<_Discipline> createState() => _DisciplineState();
}

class _DisciplineState extends State<_Discipline> {
  final reason = TextEditingController();
  final amount = TextEditingController();
  int? memberId;
  String type = 'warn';
  String scope = 'family';

  @override
  void dispose() {
    reason.dispose();
    amount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final config = widget.data['config'] is Map ? Map<String, dynamic>.from(widget.data['config'] as Map) : {};
    final roster = maps(widget.data['roster']);
    final rows = maps(widget.data['punishments']);
    final escalation = config['escalation'] == 'kick' ? 'Виключення' : 'Пониження';
    return Column(
      children: [
        Row(children: [
          Expanded(child: _Metric('МОЇ ПОПЕРЕДЖЕННЯ', '${widget.data['my_warns'] ?? 0}/${config['warn_limit'] ?? 3}', const Color(0xFF34D399), Icons.shield_outlined)),
          const SizedBox(width: 8),
          Expanded(child: _Metric('ТЕРМІН ДІЇ ПОПЕРЕДЖЕНЬ', '${config['warn_days'] ?? 30} дн.', Colors.white, Icons.edit_outlined)),
        ]),
        const SizedBox(height: 8),
        _Panel(
          title: 'При досягненні ліміту',
          icon: Icons.gavel_rounded,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(escalation, style: unbounded.copyWith(fontSize: 22)),
            Text('Застосовується автоматично', style: onest.copyWith(color: muted, fontSize: 12)),
          ]),
        ),
        if (widget.data['can_issue'] == true) ...[
          const SizedBox(height: 12),
          _Panel(
            title: 'Видати покарання',
            icon: Icons.edit_outlined,
            child: Column(
              children: [
                DropdownButton<int>(
                  isExpanded: true,
                  dropdownColor: card,
                  value: memberId,
                  hint: Text('Учасник', style: onest.copyWith(color: muted)),
                  items: [for (final row in roster) if (row['id'] is int) DropdownMenuItem(value: row['id'] as int, child: Text(text(row['display']) ?? '', style: onest))],
                  onChanged: (value) => setState(() => memberId = value),
                ),
                DropdownButton<String>(
                  isExpanded: true,
                  dropdownColor: card,
                  value: type,
                  items: const [
                    DropdownMenuItem(value: 'warn', child: Text('Попередження', style: TextStyle(fontFamily: 'Onest'))),
                    DropdownMenuItem(value: 'reprimand', child: Text('Догана', style: TextStyle(fontFamily: 'Onest'))),
                    DropdownMenuItem(value: 'fine', child: Text('Штраф', style: TextStyle(fontFamily: 'Onest'))),
                    DropdownMenuItem(value: 'kick', child: Text('Виключення', style: TextStyle(fontFamily: 'Onest'))),
                  ],
                  onChanged: (value) => setState(() => type = value ?? 'warn'),
                ),
                GcField(controller: reason, label: 'Причина'),
                if (type == 'fine') ...[const SizedBox(height: 8), GcField(controller: amount, label: 'Сума, ₴')],
                const SizedBox(height: 10),
                PrimaryButton(
                  label: 'Видати',
                  onPressed: memberId == null
                      ? null
                      : () async {
                          try {
                            await widget.session.api.post('/api/v1/families/${widget.slug}/discipline', {
                              'member_id': memberId,
                              'type': type,
                              'reason': reason.text.trim(),
                              if (type == 'fine') 'amount': amount.text.trim(),
                            });
                            await widget.onChanged();
                          } catch (e) {
                            if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                          }
                        },
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 12),
        _Panel(
          title: 'Історія',
          icon: Icons.shield_outlined,
          child: Column(
            children: [
              Row(children: [
                _Chip('Уся сім’я', scope == 'family', () async {
                  final json = await widget.session.api.get('/api/v1/families/${widget.slug}/discipline?scope=family');
                  if (mounted) setState(() { scope = 'family'; widget.data.addAll(json); });
                }),
                const SizedBox(width: 8),
                _Chip('Мої', scope == 'me', () async {
                  final json = await widget.session.api.get('/api/v1/families/${widget.slug}/discipline?scope=me');
                  if (mounted) setState(() { scope = 'me'; widget.data.addAll(json); });
                }),
              ]),
              if (rows.isEmpty) const _Empty(icon: Icons.shield_outlined, text: 'Порушень немає — так тримати'),
              for (final row in rows)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('${text(row['type_label']) ?? ''} · ${text(row['member']) ?? ''}', style: onest),
                  subtitle: Text(text(row['reason']) ?? '', style: onest.copyWith(color: muted, fontSize: 12)),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Rating extends StatelessWidget {
  const _Rating({required this.rows});
  final List<Map<String, dynamic>> rows;

  @override
  Widget build(BuildContext context) {
    final visible = rows.where((row) => (row['points'] ?? 0) != 0).toList();
    if (visible.isEmpty) return const _Empty(icon: Icons.bar_chart_rounded, text: 'Схвалених звітів цього тижня ще немає');
    return Column(
      children: [
        for (final row in visible)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Text('${row['place']}', style: onest.copyWith(color: gold, fontWeight: FontWeight.w800)),
            title: Text(text(row['display']) ?? '', style: onest),
            trailing: Text('${row['points']}', style: onest.copyWith(color: gold, fontWeight: FontWeight.w800)),
          ),
      ],
    );
  }
}

class _Audit extends StatelessWidget {
  const _Audit({required this.rows});
  final List<Map<String, dynamic>> rows;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      title: 'Журнал аудиту',
      icon: Icons.receipt_long_outlined,
      child: rows.isEmpty
          ? const _Empty(icon: Icons.receipt_long_outlined, text: 'Записів ще немає')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Записи незмінні: їх не може відредагувати чи видалити навіть лідер.', style: onest.copyWith(color: muted, fontSize: 12)),
                for (final row in rows)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(text(row['action_label']) ?? '', style: onest.copyWith(fontWeight: FontWeight.w700)),
                              Text(text(row['actor']) ?? '', style: onest.copyWith(color: muted, fontSize: 12)),
                            ],
                          ),
                        ),
                        Text(text(row['action']) ?? '', style: onest.copyWith(color: muted, fontSize: 10)),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }
}

class _Settings extends StatefulWidget {
  const _Settings({required this.session, required this.slug, required this.data});
  final Session session;
  final String slug;
  final Map<String, dynamic> data;

  @override
  State<_Settings> createState() => _SettingsState();
}

class _SettingsState extends State<_Settings> {
  late final TextEditingController name;
  late final TextEditingController tag;
  late final TextEditingController description;
  late bool recruiting;
  late Map<String, TextEditingController> fields;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    final profile = widget.data['profile'] is Map ? Map<String, dynamic>.from(widget.data['profile'] as Map) : {};
    name = TextEditingController(text: text(profile['name']) ?? '');
    tag = TextEditingController(text: text(profile['tag']) ?? '');
    description = TextEditingController(text: text(profile['description']) ?? '');
    recruiting = profile['is_recruiting'] == true;
    fields = {};
    final settings = widget.data['settings'] is Map ? Map<String, dynamic>.from(widget.data['settings'] as Map) : {};
    for (final group in settings.entries) {
      if (group.value is! Map) continue;
      for (final item in (group.value as Map).entries) {
        fields['${group.key}.${item.key}'] = TextEditingController(text: '${item.value}');
      }
    }
  }

  @override
  void dispose() {
    name.dispose();
    tag.dispose();
    description.dispose();
    for (final field in fields.values) {
      field.dispose();
    }
    super.dispose();
  }

  String value(String key) => fields[key]?.text.trim() ?? '';
  bool flag(String key) => value(key) == 'true' || value(key) == '1';

  Future<void> saveProfile() async {
    setState(() => busy = true);
    try {
      await widget.session.api.patch('/api/v1/families/${widget.slug}/settings/profile', {
        'name': name.text.trim(),
        'tag': tag.text.trim(),
        'description': description.text.trim(),
        'is_recruiting': recruiting,
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Профіль збережено')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> saveRules() async {
    setState(() => busy = true);
    try {
      await widget.session.api.put('/api/v1/families/${widget.slug}/settings', {
        'rates': {
          'bizwar_win': value('rates.bizwar_win'),
          'bizwar_loss': value('rates.bizwar_loss'),
          'contract_light': value('rates.contract_light'),
          'contract_medium': value('rates.contract_medium'),
          'contract_heavy': value('rates.contract_heavy'),
          'investment_cashback': value('rates.investment_cashback'),
        },
        'deposits': {
          'enabled': flag('deposits.enabled'),
          'daily_rate': value('deposits.daily_rate'),
          'weekly_rate': value('deposits.weekly_rate'),
          'min_amount': value('deposits.min_amount'),
          'max_days': value('deposits.max_days'),
          'max_weeks': value('deposits.max_weeks'),
        },
        'reports': {
          'deadline_hours': value('reports.deadline_hours'),
          'contract_daily_limit': value('reports.contract_daily_limit'),
          'require_proof': flag('reports.require_proof'),
          'max_proofs': value('reports.max_proofs'),
        },
        'rating': {
          'bizwar': flag('rating.bizwar'),
          'contracts': flag('rating.contracts'),
          'investments': flag('rating.investments'),
          'events': flag('rating.events'),
          'points_bizwar_win': value('rating.points_bizwar_win'),
          'points_bizwar_loss': value('rating.points_bizwar_loss'),
          'points_contract_light': value('rating.points_contract_light'),
          'points_contract_medium': value('rating.points_contract_medium'),
          'points_contract_heavy': value('rating.points_contract_heavy'),
          'points_per_1000': value('rating.points_per_1000'),
          'points_event': value('rating.points_event'),
        },
        'discipline': {
          'warn_days': value('discipline.warn_days'),
          'warn_limit': value('discipline.warn_limit'),
          'escalation': value('discipline.escalation'),
        },
        'cashout': {'min_amount': value('cashout.min_amount')},
        'digest': {'enabled': flag('digest.enabled'), 'chat': flag('digest.chat')},
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Налаштування збережено')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final digest = widget.data['digest'] is Map ? Map<String, dynamic>.from(widget.data['digest'] as Map) : {};
    final logo = absolute(widget.data['profile'] is Map ? (widget.data['profile'] as Map)['logo_url'] : null);
    return Column(
      children: [
        _Panel(
          title: 'Профіль сім’ї',
          icon: Icons.shield_outlined,
          child: Column(
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: logo != null
                        ? CachedNetworkImage(imageUrl: logo, width: 72, height: 72, fit: BoxFit.cover)
                        : Container(width: 72, height: 72, alignment: Alignment.center, decoration: const BoxDecoration(gradient: LinearGradient(colors: [Color(0xFF6D5EF5), Color(0xFF9B6BFF)])), child: Text(tag.text.isEmpty ? '?' : tag.text.substring(0, tag.text.length.clamp(0, 4)), style: unbounded.copyWith(fontSize: 14))),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      children: [
                        GcField(controller: name, label: 'Назва'),
                        const SizedBox(height: 8),
                        GcField(controller: tag, label: 'Тег'),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              GcField(controller: description, label: 'Опис'),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('Набір відкрито', style: onest),
                value: recruiting,
                activeThumbColor: indigo,
                onChanged: (value) => setState(() => recruiting = value),
              ),
              Align(alignment: Alignment.centerRight, child: FilledButton(onPressed: busy ? null : saveProfile, child: const Text('Зберегти профіль'))),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Правила й ставки',
          icon: Icons.tune_rounded,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Кожна зміна записується в журнал аудиту. Нові ставки діють для звітів, схвалених після збереження.', style: onest.copyWith(color: muted, fontSize: 12)),
              const SizedBox(height: 8),
              Text('Ставки винагород', style: onest.copyWith(fontWeight: FontWeight.w700)),
              _num('Бізвар — перемога, ₴', 'rates.bizwar_win'),
              _num('Бізвар — поразка, ₴', 'rates.bizwar_loss'),
              _num('Контракт легкий, ₴', 'rates.contract_light'),
              _num('Контракт середній, ₴', 'rates.contract_medium'),
              _num('Контракт важкий, ₴', 'rates.contract_heavy'),
              _num('Кешбек з інвестицій, %', 'rates.investment_cashback'),
              const SizedBox(height: 8),
              Text('Звіти', style: onest.copyWith(fontWeight: FontWeight.w700)),
              _num('Дедлайн подання, год', 'reports.deadline_hours'),
              _num('Ліміт контрактів на день', 'reports.contract_daily_limit'),
              SwitchListTile(contentPadding: EdgeInsets.zero, title: Text('Скріншот обов’язковий', style: onest), value: flag('reports.require_proof'), activeThumbColor: indigo, onChanged: (value) => setState(() => fields['reports.require_proof']?.text = '$value')),
              _num('Максимум скріншотів', 'reports.max_proofs'),
              const SizedBox(height: 8),
              Text('Депозити', style: onest.copyWith(fontWeight: FontWeight.w700)),
              SwitchListTile(contentPadding: EdgeInsets.zero, title: Text('Депозити увімкнено', style: onest), value: flag('deposits.enabled'), activeThumbColor: indigo, onChanged: (value) => setState(() => fields['deposits.enabled']?.text = '$value')),
              _num('Ставка на день, %', 'deposits.daily_rate'),
              _num('Ставка на тиждень, %', 'deposits.weekly_rate'),
              _num('Мінімальна сума, ₴', 'deposits.min_amount'),
              _num('Максимум днів', 'deposits.max_days'),
              _num('Максимум тижнів', 'deposits.max_weeks'),
              const SizedBox(height: 8),
              Text('Рейтинг', style: onest.copyWith(fontWeight: FontWeight.w700)),
              SwitchListTile(contentPadding: EdgeInsets.zero, title: Text('Враховувати бізварі', style: onest), value: flag('rating.bizwar'), activeThumbColor: indigo, onChanged: (value) => setState(() => fields['rating.bizwar']?.text = '$value')),
              SwitchListTile(contentPadding: EdgeInsets.zero, title: Text('Враховувати контракти', style: onest), value: flag('rating.contracts'), activeThumbColor: indigo, onChanged: (value) => setState(() => fields['rating.contracts']?.text = '$value')),
              SwitchListTile(contentPadding: EdgeInsets.zero, title: Text('Враховувати інвестиції', style: onest), value: flag('rating.investments'), activeThumbColor: indigo, onChanged: (value) => setState(() => fields['rating.investments']?.text = '$value')),
              SwitchListTile(contentPadding: EdgeInsets.zero, title: Text('Враховувати події', style: onest), value: flag('rating.events'), activeThumbColor: indigo, onChanged: (value) => setState(() => fields['rating.events']?.text = '$value')),
              _num('Бали: перемога', 'rating.points_bizwar_win'),
              _num('Бали: поразка', 'rating.points_bizwar_loss'),
              _num('Бали: легкий контракт', 'rating.points_contract_light'),
              _num('Бали: середній контракт', 'rating.points_contract_medium'),
              _num('Бали: важкий контракт', 'rating.points_contract_heavy'),
              _num('Бали за кожні 1000 ₴ інвестицій', 'rating.points_per_1000'),
              _num('Бали за подію', 'rating.points_event'),
              const SizedBox(height: 8),
              Text('Дисципліна', style: onest.copyWith(fontWeight: FontWeight.w700)),
              _num('Попередження діє, днів', 'discipline.warn_days'),
              _num('Ліміт попереджень', 'discipline.warn_limit'),
              const SizedBox(height: 8),
              Text('Виплати', style: onest.copyWith(fontWeight: FontWeight.w700)),
              _num('Мінімальний вивід, ₴', 'cashout.min_amount'),
              const SizedBox(height: 8),
              Text('Тижневий звіт', style: onest.copyWith(fontWeight: FontWeight.w700)),
              SwitchListTile(contentPadding: EdgeInsets.zero, title: Text('Щотижневий звіт (нд 23:59)', style: onest), value: flag('digest.enabled'), activeThumbColor: indigo, onChanged: (value) => setState(() => fields['digest.enabled']?.text = '$value')),
              SwitchListTile(contentPadding: EdgeInsets.zero, title: Text('Публікувати в чат сім’ї', style: onest), value: flag('digest.chat'), activeThumbColor: indigo, onChanged: (value) => setState(() => fields['digest.chat']?.text = '$value')),
              const SizedBox(height: 8),
              Align(alignment: Alignment.centerRight, child: FilledButton(onPressed: busy ? null : saveRules, child: const Text('Зберегти'))),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Тижневий звіт',
          icon: Icons.summarize_outlined,
          child: Text(text(digest['text']) ?? 'Цього тижня нарахувань понад поріг не було.', style: onest.copyWith(color: muted, fontSize: 13)),
        ),
      ],
    );
  }

  Widget _num(String label, String key) {
    final controller = fields[key];
    if (controller == null) return const SizedBox.shrink();
    return Padding(padding: const EdgeInsets.only(top: 8), child: GcField(controller: controller, label: label));
  }
}

class _SimpleList extends StatelessWidget {
  const _SimpleList(this.rows, {required this.empty, required this.titleOf, required this.subtitleOf});
  final List<Map<String, dynamic>> rows;
  final String empty;
  final String Function(Map<String, dynamic>) titleOf;
  final String Function(Map<String, dynamic>) subtitleOf;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return _Empty(icon: Icons.inbox_outlined, text: empty);
    return Column(
      children: [
        for (final row in rows)
          ListTile(contentPadding: EdgeInsets.zero, title: Text(titleOf(row), style: onest.copyWith(fontWeight: FontWeight.w700)), subtitle: Text(subtitleOf(row), style: onest.copyWith(color: muted, fontSize: 12))),
      ],
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric(this.label, this.value, this.color, this.icon);
  final String label;
  final String value;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: card, borderRadius: BorderRadius.circular(18), border: Border.all(color: Colors.white.withValues(alpha: 0.04))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [Expanded(child: Text(label, style: onest.copyWith(color: muted, fontSize: 10, letterSpacing: 0.4))), Icon(icon, size: 14, color: muted)]),
          const SizedBox(height: 8),
          Text(value, style: unbounded.copyWith(fontSize: 18, color: color)),
        ],
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.title, required this.icon, required this.child, this.action, this.onAction});
  final String title;
  final IconData icon;
  final Widget child;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: card, borderRadius: BorderRadius.circular(22), border: Border.all(color: Colors.white.withValues(alpha: 0.04))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: const Color(0xFF9AA3FF)),
              const SizedBox(width: 8),
              Expanded(child: Text(title, style: onest.copyWith(fontWeight: FontWeight.w800, fontSize: 16))),
              if (action != null) GestureDetector(onTap: onAction, child: Text(action!, style: onest.copyWith(color: muted, fontSize: 12))),
            ],
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 18),
      child: Column(
        children: [
          Icon(icon, color: muted.withValues(alpha: 0.7), size: 28),
          const SizedBox(height: 8),
          Text(text, textAlign: TextAlign.center, style: onest.copyWith(color: muted, fontSize: 13)),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip(this.label, this.selected, this.onTap);
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF2A2458) : const Color(0xFF1A2033),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? indigo : Colors.transparent),
        ),
        child: Text(label, style: onest.copyWith(fontWeight: FontWeight.w600, fontSize: 13)),
      ),
    );
  }
}

class _ReadField extends StatelessWidget {
  const _ReadField(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(color: const Color(0xFF1A2033), borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.white.withValues(alpha: 0.06))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: onest.copyWith(color: muted, fontSize: 10)),
        Text(value, style: onest),
      ]),
    );
  }
}

class _ReportSheet extends StatefulWidget {
  const _ReportSheet({required this.session, required this.slug, required this.rates, required this.deadline, required this.maxProofs, required this.onSent});
  final Session session;
  final String slug;
  final Map<String, dynamic> rates;
  final dynamic deadline;
  final dynamic maxProofs;
  final Future<void> Function() onSent;

  @override
  State<_ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends State<_ReportSheet> {
  final description = TextEditingController();
  final amount = TextEditingController(text: '50000');
  String type = 'bizwar';
  String audience = 'self';
  String tier = 'light';
  int wins = 0;
  int losses = 0;
  int count = 1;
  int? beneficiary;
  late String date;
  final hours = <int>{};
  final proofs = <XFile>[];
  List<Map<String, dynamic>> members = const [];
  bool busy = false;

  @override
  void initState() {
    super.initState();
    date = _ymd(DateTime.now());
    widget.session.api.get('/api/v1/families/${widget.slug}/members').then((json) {
      if (mounted) setState(() => members = maps(json['members']));
    }).catchError((_) {});
  }

  @override
  void dispose() {
    description.dispose();
    amount.dispose();
    super.dispose();
  }

  double rate(String key) => double.tryParse('${widget.rates[key] ?? 0}') ?? 0;

  int? rewardMinor() {
    if (type == 'bizwar') return ((wins * rate('bizwar_win') + losses * rate('bizwar_loss')) * 100).round();
    if (type == 'contract') return (count * rate('contract_$tier') * 100).round();
    if (type == 'investment') {
      final sum = double.tryParse(amount.text.replaceAll(' ', '').replaceAll(',', '.')) ?? 0;
      return (sum * rate('investment_cashback')).round();
    }
    return null;
  }

  Future<void> send() async {
    setState(() => busy = true);
    try {
      final fields = <String, String>{
        'type': type,
        'for': audience,
        'event_date': date,
        'description': description.text.trim(),
        if (audience == 'friend' && beneficiary != null) 'beneficiary_id': '$beneficiary',
        if (type == 'bizwar') 'wins': '$wins',
        if (type == 'bizwar') 'losses': '$losses',
        if (type == 'contract') 'tier': tier,
        if (type == 'contract') 'count': '$count',
        if (type == 'investment') 'amount': amount.text.trim(),
      };
      if (type == 'bizwar') {
        var i = 0;
        for (final hour in hours) {
          fields['hours[$i]'] = '$hour';
          i++;
        }
      }
      final files = <http.MultipartFile>[];
      for (final proof in proofs) {
        files.add(await http.MultipartFile.fromPath('proofs[]', proof.path, filename: proof.name));
      }
      await widget.session.api.upload('/api/v1/families/${widget.slug}/reports', fields, files);
      if (!mounted) return;
      Navigator.pop(context);
      await widget.onSent();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final yesterday = today.subtract(const Duration(days: 1));
    final reward = rewardMinor();
    final maxProofs = int.tryParse('${widget.maxProofs}') ?? 10;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 12, 16, 16 + MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text('Новий звіт', style: unbounded.copyWith(fontSize: 22))),
                IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close_rounded)),
              ],
            ),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _TypeCard('Бізвар', Icons.bolt_rounded, type == 'bizwar', () => setState(() => type = 'bizwar')),
                _TypeCard('Контракти', Icons.inventory_2_outlined, type == 'contract', () => setState(() => type = 'contract')),
                _TypeCard('Інвестиції', Icons.savings_outlined, type == 'investment', () => setState(() => type = 'investment')),
                _TypeCard('Інше', Icons.auto_awesome_rounded, type == 'other', () => setState(() => type = 'other')),
              ],
            ),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: _Chip('За себе', audience == 'self', () => setState(() => audience = 'self'))),
              const SizedBox(width: 8),
              Expanded(child: _Chip('За друга', audience == 'friend', () => setState(() => audience = 'friend'))),
            ]),
            if (audience == 'friend')
              DropdownButton<int>(
                isExpanded: true,
                dropdownColor: card,
                value: beneficiary,
                hint: Text('Учасник', style: onest.copyWith(color: muted)),
                items: [for (final member in members) if (text(member['username']) != widget.session.username && member['id'] is int) DropdownMenuItem(value: member['id'] as int, child: Text(text(member['display']) ?? '', style: onest))],
                onChanged: (value) => setState(() => beneficiary = value),
              ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: Text('Дата події', style: onest.copyWith(color: muted, fontSize: 12))),
                Text('Звіт приймається ${widget.deadline} год', style: onest.copyWith(color: muted, fontSize: 12)),
              ],
            ),
            const SizedBox(height: 6),
            Row(children: [
              _DatePill('Сьогодні', date == _ymd(today), () => setState(() => date = _ymd(today))),
              const SizedBox(width: 8),
              _DatePill('Вчора', date == _ymd(yesterday), () => setState(() => date = _ymd(yesterday))),
            ]),
            if (type == 'bizwar') ...[
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: _Stepper('Перемоги', wins, hryvnia((rate('bizwar_win') * 100).round()), const Color(0xFF34D399), (value) => setState(() => wins = value))),
                const SizedBox(width: 8),
                Expanded(child: _Stepper('Поразки', losses, hryvnia((rate('bizwar_loss') * 100).round()), const Color(0xFFF87171), (value) => setState(() => losses = value))),
              ]),
              const SizedBox(height: 10),
              Text('Години бізварів', style: onest.copyWith(color: muted, fontSize: 12)),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final hour in const [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22])
                    FilterChip(
                      label: Text('$hour:00', style: onest.copyWith(fontSize: 12)),
                      selected: hours.contains(hour),
                      selectedColor: indigo,
                      onSelected: (on) => setState(() => on ? hours.add(hour) : hours.remove(hour)),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              GcField(controller: description, label: 'Коментар (необов’язково)'),
            ],
            if (type == 'contract') ...[
              const SizedBox(height: 12),
              Row(children: [
                for (final item in const [('light', 'Легкий', 'contract_light'), ('medium', 'Середній', 'contract_medium'), ('heavy', 'Важкий', 'contract_heavy')])
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: _TypeCard('${item.$2}\n${hryvnia((rate(item.$3) * 100).round())}', Icons.circle, tier == item.$1, () => setState(() => tier = item.$1)),
                    ),
                  ),
              ]),
              const SizedBox(height: 8),
              _Stepper('Кількість', count, '', Colors.white, (value) => setState(() => count = value < 1 ? 1 : value)),
              GcField(controller: description, label: 'Коментар (необов’язково)'),
            ],
            if (type == 'investment') ...[
              const SizedBox(height: 12),
              Text('Сума інвестиції в скарбницю, ₴', style: onest.copyWith(color: muted, fontSize: 12)),
              GcField(controller: amount, label: '50000'),
              const SizedBox(height: 8),
              GcField(controller: description, label: 'Коментар (необов’язково)'),
            ],
            if (type == 'other') ...[
              const SizedBox(height: 12),
              GcField(controller: description, label: 'Що саме зроблено? Офіцер визначить винагороду.'),
            ],
            const SizedBox(height: 10),
            Row(children: [
              Text('Скріншоти-докази *', style: onest.copyWith(fontWeight: FontWeight.w700)),
              const Spacer(),
              Text('${proofs.length}/$maxProofs', style: onest.copyWith(color: muted, fontSize: 12)),
            ]),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () async {
                final picked = await ImagePicker().pickMultiImage(imageQuality: 85);
                if (picked.isNotEmpty) setState(() => proofs.addAll(picked.take(maxProofs - proofs.length)));
              },
              icon: const Icon(Icons.add_photo_alternate_outlined),
              label: const Text('Додати'),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('ОЧІКУВАНА ВИНАГОРОДА', style: onest.copyWith(color: muted, fontSize: 10, letterSpacing: 0.4)),
                      Text(reward == null ? 'визначить\nофіцер' : hryvnia(reward), style: unbounded.copyWith(fontSize: 18, color: const Color(0xFF34D399))),
                    ],
                  ),
                ),
                FilledButton(onPressed: busy ? null : send, child: Text(busy ? 'Надсилання…' : 'Надіслати звіт')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _TypeCard extends StatelessWidget {
  const _TypeCard(this.label, this.icon, this.selected, this.onTap);
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 156,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
          decoration: BoxDecoration(
            color: const Color(0xFF1A2036),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: selected ? gold : Colors.white.withValues(alpha: 0.05), width: selected ? 1.4 : 1),
          ),
          child: Column(children: [
            Icon(icon, color: selected ? gold : muted, size: 18),
            const SizedBox(height: 4),
            Text(label, textAlign: TextAlign.center, style: onest.copyWith(fontWeight: FontWeight.w700, fontSize: 13, color: selected ? gold : Colors.white)),
          ]),
        ),
      ),
    );
  }
}

class _Stepper extends StatelessWidget {
  const _Stepper(this.label, this.value, this.price, this.color, this.onChanged);
  final String label;
  final int value;
  final String price;
  final Color color;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [Text(label, style: onest.copyWith(color: muted, fontSize: 12)), const Spacer(), if (price.isNotEmpty) Text(price, style: onest.copyWith(color: muted, fontSize: 11))]),
        const SizedBox(height: 6),
        Row(
          children: [
            _step(Icons.remove, () => onChanged(value > 0 ? value - 1 : 0)),
            Expanded(child: Text('$value', textAlign: TextAlign.center, style: unbounded.copyWith(fontSize: 22, color: color))),
            _step(Icons.add, () => onChanged(value + 1)),
          ],
        ),
      ],
    );
  }

  Widget _step(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(width: 36, height: 36, alignment: Alignment.center, decoration: BoxDecoration(color: const Color(0xFF1A2036), borderRadius: BorderRadius.circular(12)), child: Icon(icon, size: 16)),
    );
  }
}

class _DatePill extends StatelessWidget {
  const _DatePill(this.label, this.selected, this.onTap);
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          gradient: selected ? const LinearGradient(colors: [Color(0xFF6D5EF5), Color(0xFF8B6BFF)]) : null,
          color: selected ? null : const Color(0xFF1A2036),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(label, style: onest.copyWith(fontWeight: FontWeight.w700)),
      ),
    );
  }
}

String _ymd(DateTime value) => '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
