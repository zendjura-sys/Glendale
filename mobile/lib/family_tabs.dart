import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'families.dart';
import 'posts.dart';
import 'theme.dart';
import 'widgets.dart';

/// Дані відкритого розділу сім’ї (props сторінки сайту) і спосіб його перезавантажити.
class FamilyContext {
  FamilyContext({required this.slug, required this.data, required this.can, required this.reload, required this.api});
  final String slug;
  final Map<String, dynamic> data;
  final Map<String, dynamic> can;
  final Future<void> Function({Map<String, String>? extra}) reload;
  final Api api;

  bool allowed(String permission) => can[permission] == true;
  Map<String, dynamic> get me => mapOf(data['me']);
  Map<String, dynamic> get family => mapOf(data['family']);
  String path(String section) => familyPath(slug, section);

  /// Дія сайту з тостом; після успіху перезавантажує розділ з тими самими фільтрами.
  Future<bool> act(BuildContext context, Future<dynamic> Function() action, {Map<String, String>? keep}) async {
    final ok = await attempt(context, action);
    if (ok) await reload(extra: keep);
    return ok;
  }
}

class TransactionRow extends StatelessWidget {
  const TransactionRow({required this.tx, this.family = false, super.key});
  final Map<String, dynamic> tx;
  final bool family;

  @override
  Widget build(BuildContext context) {
    final amount = intOf(tx['amount']);
    final treasury = intOf(tx['treasury_delta']);
    final shown = family && amount == 0 ? treasury : amount;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(text(tx['type_label']) ?? '', style: body(13.5, weight: FontWeight.w600)),
            if (family && text(tx['member']) != null) Text(text(tx['member'])!, style: body(12, color: soft).copyWith(fontFamily: 'monospace')),
            if (text(tx['comment']) != null) Text(text(tx['comment'])!, style: body(12, color: muted)),
            Text('${shortStamp(tx['created_at'])} ${clock(tx['created_at'])}${text(tx['actor']) != null ? ' · ${tx['actor']}' : ''}', style: body(11.5, color: faint)),
          ]),
        ),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text('${shown > 0 ? '+' : ''}${hryvnia(shown)}', style: body(13.5, color: shown > 0 ? green : (shown < 0 ? dangerSoft : muted), weight: FontWeight.w700)),
          if (!family && tx['balance_after'] != null) Text('= ${hryvnia(tx['balance_after'])}', style: body(11.5, color: faint)),
          if (family && tx['treasury_after'] != null && treasury != 0) Text('казна ${hryvnia(tx['treasury_after'])}', style: body(11.5, color: faint)),
        ]),
      ]),
    );
  }
}

class AuditRow extends StatelessWidget {
  const AuditRow({required this.entry, this.compact = false, super.key});
  final Map<String, dynamic> entry;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final details = entry['details'];
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(width: 6, height: 6, margin: const EdgeInsets.only(top: 6, right: 10), decoration: const BoxDecoration(color: green, shape: BoxShape.circle)),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text.rich(TextSpan(children: [
              TextSpan(text: text(entry['action_label']) ?? '', style: body(13, weight: FontWeight.w700)),
              if (text(entry['target']) != null) TextSpan(text: ' → ${entry['target']}', style: body(12.5, color: soft).copyWith(fontFamily: 'monospace')),
            ])),
            Text('${text(entry['actor']) ?? '—'} · ${ago(entry['created_at'])}', style: body(11.5, color: muted)),
            if (!compact && details is Map && details.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  details.entries.map((e) => '${e.key}: ${_short(e.value)}').join('\n'),
                  style: body(11.5, color: faint).copyWith(fontFamily: 'monospace'),
                ),
              ),
          ]),
        ),
        if (!compact) Text(text(entry['action']) ?? '', style: body(9.5, color: faint).copyWith(fontFamily: 'monospace')),
      ]),
    );
  }

  static String _short(dynamic value) {
    if (value is Map && value.containsKey('from') && value.containsKey('to')) return '${_short(value['from'])} → ${_short(value['to'])}';
    final raw = '$value';
    return raw.length > 120 ? '${raw.substring(0, 120)}…' : raw;
  }
}

Widget _card({required String title, required IconData icon, required List<Widget> children, Widget? trailing, String? subtitle}) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(child: CardTitle(title, icon: icon, caps: false)),
          ?trailing,
        ]),
        if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(subtitle, style: body(12.5, color: muted).copyWith(height: 1.4))),
        const SizedBox(height: 10),
        ...children,
      ]),
    ),
  );
}

// ───────────────────────── Перевірка ─────────────────────────

class QueueTab extends StatefulWidget {
  const QueueTab({required this.ctx, super.key});
  final FamilyContext ctx;

  @override
  State<QueueTab> createState() => _QueueTabState();
}

class _QueueTabState extends State<QueueTab> {
  final selected = <int>{};

  FamilyContext get ctx => widget.ctx;

  Future<void> _review(Map<String, dynamic> report, bool approve) async {
    String? comment;
    String? reward;
    if (!approve || report['type'] == 'other') {
      final controller = TextEditingController();
      final rewardController = TextEditingController();
      final ok = await showDialog<bool>(
        context: context,
        builder: (dialog) => AlertDialog(
          title: Text(approve ? 'Схвалити звіт #${report['id']}' : 'Відхилити звіт #${report['id']}'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            if (approve && report['type'] == 'other') ...[
              GcField(controller: rewardController, label: 'Винагорода, ₴', keyboard: TextInputType.number),
              const SizedBox(height: 10),
            ],
            GcField(controller: controller, label: approve ? 'Коментар (необов’язково)' : 'Причина відмови', maxLines: 3),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialog, false), child: Text('Скасувати', style: body(14, color: muted))),
            TextButton(onPressed: () => Navigator.pop(dialog, true), child: Text(approve ? 'Схвалити' : 'Відхилити', style: body(14, color: approve ? green : dangerSoft, weight: FontWeight.w700))),
          ],
        ),
      );
      if (ok != true) return;
      comment = controller.text.trim();
      reward = rewardController.text.trim();
    }
    if (!mounted) return;
    await ctx.act(
      context,
      () => ctx.api.post(ctx.path('reports/${report['id']}/review'), {
        'decision': approve ? 'approve' : 'reject',
        if (comment != null && comment.isNotEmpty) 'comment': comment,
        if (reward != null && reward.isNotEmpty) 'reward': reward,
      }),
      keep: const {'tab': 'reports'},
    );
    selected.remove(intOf(report['id']));
  }

  Future<void> _pay(Map<String, dynamic> cashout) async {
    final comment = TextEditingController();
    XFile? proof;
    final ok = await showGcSheet<bool>(
      context,
      title: 'Видати ${hryvnia(cashout['amount'])}',
      subtitle: '${mapOf(cashout['member'])['display']}${text(cashout['note']) != null ? ' · «${cashout['note']}»' : ''}',
      builder: (sheet) => StatefulBuilder(
        builder: (context, set) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            GcField(controller: comment, label: 'Коментар (необов’язково)'),
            const SizedBox(height: 10),
            GhostButton(
              label: proof == null ? 'Скріншот видачі (необов’язково)' : 'Скріншот додано',
              icon: LucideIcons.image,
              onPressed: () async {
                final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 90);
                if (picked != null) set(() => proof = picked);
              },
            ),
            const SizedBox(height: 14),
            PrimaryButton(label: 'Підтвердити видачу', icon: LucideIcons.check, onPressed: () => Navigator.pop(sheet, true)),
          ]),
        ),
      ),
    );
    if (ok != true || !mounted) return;
    final files = [if (proof != null) await http.MultipartFile.fromPath('proof', proof!.path, filename: proof!.name)];
    if (!mounted) return;
    await ctx.act(context, () => ctx.api.upload(ctx.path('bank/cashouts/${cashout['id']}/pay'), {if (comment.text.trim().isNotEmpty) 'comment': comment.text.trim()}, files), keep: const {'tab': 'cashouts'});
  }

  Future<void> _cancel(Map<String, dynamic> cashout) async {
    final reason = await askText(context, 'Скасувати заявку?', hint: 'Причина', action: 'Скасувати заявку');
    if (reason == null || !mounted) return;
    await ctx.act(context, () => ctx.api.post(ctx.path('bank/cashouts/${cashout['id']}/cancel'), {'reason': reason}), keep: const {'tab': 'cashouts'});
  }

  @override
  Widget build(BuildContext context) {
    final tab = text(ctx.data['tab']) ?? 'reports';
    final reports = maps(ctx.data['reports']);
    final cashouts = maps(ctx.data['cashouts']);
    final limit = intOf(ctx.data['contract_limit'], 10);
    final bulkable = reports.where((r) => r['self_review'] != true && mapOf(r['flags'])['similar_reports'] == null).map((r) => intOf(r['id'])).toSet();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Segmented(
        options: [
          SegmentOption('reports', 'Звіти', count: reports.isEmpty ? null : reports.length),
          if (ctx.allowed('treasury.manage')) SegmentOption('cashouts', 'Виплати', count: cashouts.isEmpty ? null : cashouts.length),
        ],
        selected: tab,
        onSelect: (value) => ctx.reload(extra: {'tab': value}),
      ),
      const SizedBox(height: 12),
      Swap(id: tab, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (tab == 'reports') ...[
        if (reports.isEmpty)
          const Glass(child: QuietEmpty(icon: LucideIcons.listChecks, text: 'Черга порожня — усі звіти перевірено 🎉'))
        else ...[
          if (bulkable.length > 1)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(children: [
                TextButton(
                  onPressed: () => setState(() => selected.length == bulkable.length ? selected.clear() : selected.addAll(bulkable)),
                  child: Text(selected.length == bulkable.length ? 'Зняти вибір' : 'Вибрати всі', style: body(13, color: primary)),
                ),
                const Spacer(),
                PrimaryButton(
                  label: 'Схвалити ${selected.length}',
                  compact: true,
                  expand: false,
                  onPressed: selected.isEmpty
                      ? null
                      : () async {
                          final ids = selected.toList();
                          selected.clear();
                          await ctx.act(context, () => ctx.api.post(ctx.path('reports/bulk'), {'ids': ids}), keep: const {'tab': 'reports'});
                        },
                ),
              ]),
            ),
          for (final r in reports)
            ReportCard(
              report: r,
              slug: ctx.slug,
              footer: Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Wrap(spacing: 10, runSpacing: 4, children: [
                    Text('За 30 днів: ✅ ${mapOf(r['history'])['approved'] ?? 0} · ❌ ${mapOf(r['history'])['rejected'] ?? 0}', style: body(12, color: muted)),
                    if (r['contracts_used'] != null) Text('Контрактів цього рівня за день: ${r['contracts_used']}/$limit', style: body(12, color: intOf(r['contracts_used']) > limit ? dangerSoft : muted)),
                    Text('Дедлайн: ${shortStamp(r['deadline'])} ${clock(r['deadline'])}', style: body(12, color: muted)),
                  ]),
                  const SizedBox(height: 8),
                  if (r['self_review'] == true)
                    Text('Власний звіт перевіряє інший офіцер.', style: body(12.5, color: gold))
                  else
                    Row(children: [
                      if (bulkable.contains(intOf(r['id'])))
                        Checkbox(
                          value: selected.contains(intOf(r['id'])),
                          onChanged: (v) => setState(() => v == true ? selected.add(intOf(r['id'])) : selected.remove(intOf(r['id']))),
                        ),
                      Expanded(child: GhostButton(label: 'Відхилити', icon: LucideIcons.x, compact: true, color: dangerSoft, onPressed: () => _review(r, false))),
                      const SizedBox(width: 8),
                      Expanded(child: PrimaryButton(label: 'Схвалити', icon: LucideIcons.check, compact: true, onPressed: () => _review(r, true))),
                    ]),
                ]),
              ),
            ),
        ],
      ] else
        _card(
          title: 'Заявки на виплату',
          icon: LucideIcons.wallet,
          children: [
            if (cashouts.isEmpty) const QuietEmpty(icon: LucideIcons.wallet, text: 'Нових заявок немає'),
            for (final c in cashouts)
              Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.035), borderRadius: BorderRadius.circular(14), border: Border.all(color: line)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Row(children: [
                    Expanded(child: Text(text(mapOf(c['member'])['display']) ?? '', style: body(13.5, weight: FontWeight.w600).copyWith(fontFamily: 'monospace'))),
                    Text(hryvnia(c['amount']), style: body(15, color: gold, weight: FontWeight.w800)),
                  ]),
                  if (text(c['note']) != null) Text('«${c['note']}»', style: body(12.5, color: muted)),
                  Text(ago(c['created_at']), style: body(11.5, color: faint)),
                  const SizedBox(height: 8),
                  Row(children: [
                    Expanded(child: GhostButton(label: 'Скасувати', compact: true, color: dangerSoft, onPressed: () => _cancel(c))),
                    const SizedBox(width: 8),
                    Expanded(child: PrimaryButton(label: 'Видано', icon: LucideIcons.check, compact: true, onPressed: () => _pay(c))),
                  ]),
                ]),
              ),
          ],
        ),
      ])),
    ]);
  }
}

// ───────────────────────── Банк ─────────────────────────

class BankTab extends StatefulWidget {
  const BankTab({required this.ctx, super.key});
  final FamilyContext ctx;

  @override
  State<BankTab> createState() => _BankTabState();
}

class _BankTabState extends State<BankTab> {
  final cashout = TextEditingController();
  final note = TextEditingController();
  final deposit = TextEditingController();
  String period = 'weekly';
  double periods = 1;
  bool manualOpen = false;
  String target = 'member';
  int? manualMember;
  String direction = 'credit';
  final manualAmount = TextEditingController();
  final manualComment = TextEditingController();

  FamilyContext get ctx => widget.ctx;

  @override
  void dispose() {
    for (final c in [cashout, note, deposit, manualAmount, manualComment]) {
      c.dispose();
    }
    super.dispose();
  }

  Map<String, String> get keep => {'scope': text(ctx.data['scope']) ?? 'me'};

  @override
  Widget build(BuildContext context) {
    final config = mapOf(ctx.data['config']);
    final deposits = mapOf(config['deposits']);
    final totals = ctx.data['totals'] is Map ? mapOf(ctx.data['totals']) : null;
    final myCashouts = maps(ctx.data['cashouts']);
    final myDeposits = maps(ctx.data['deposits']);
    final ledger = Listing.parse(ctx.data['ledger']);
    final roster = maps(ctx.data['roster']);
    final scope = text(ctx.data['scope']) ?? 'me';
    final maxPeriods = intOf(period == 'daily' ? deposits['max_days'] : deposits['max_weeks'], 8).clamp(1, 60);
    final rate = period == 'daily' ? deposits['daily_rate'] : deposits['weekly_rate'];
    if (periods > maxPeriods) periods = maxPeriods.toDouble();

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Expanded(child: MetricTile(caps: true, label: 'Мій баланс', value: hryvniaShort(ctx.me['balance']), color: green, icon: LucideIcons.wallet)),
        const SizedBox(width: 8),
        Expanded(child: MetricTile(caps: true, label: 'Скарбниця', value: hryvniaShort(ctx.family['treasury']), icon: LucideIcons.landmark)),
      ]),
      if (totals != null) ...[
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: MetricTile(caps: true, label: 'Борг перед учасниками', value: hryvniaShort(totals['balances']), icon: LucideIcons.usersRound)),
          const SizedBox(width: 8),
          Expanded(child: MetricTile(caps: true, label: 'Депозити', value: hryvniaShort(totals['deposits']), icon: LucideIcons.piggyBank)),
        ]),
        const SizedBox(height: 6),
        Text('На видачу: ${hryvnia(totals['pending_cashouts'])} · видано за тиждень: ${hryvnia(totals['paid_week'])}', style: body(12, color: muted)),
      ],
      const SizedBox(height: 12),
      _card(
        title: 'Вивести гроші в грі',
        icon: LucideIcons.banknote,
        subtitle: 'Сума резервується з вашого балансу, офіцер видає її в грі й підтверджує. Мінімум — ${config['cashout_min'] ?? 100} ₴.',
        children: [
          Row(children: [
            Expanded(child: GcField(controller: cashout, label: 'Сума, ₴', keyboard: TextInputType.number, dense: true)),
            const SizedBox(width: 8),
            GhostButton(label: 'Усе', compact: true, expand: false, onPressed: () => cashout.text = '${intOf(ctx.me['balance']) ~/ 100}'),
          ]),
          const SizedBox(height: 8),
          GcField(controller: note, label: 'Примітка: коли зручно отримати', dense: true),
          const SizedBox(height: 10),
          PrimaryButton(
            label: 'Запросити',
            icon: LucideIcons.download,
            onPressed: () async {
              if (await ctx.act(context, () => ctx.api.post(ctx.path('bank/cashouts'), {'amount': cashout.text.trim(), 'note': note.text.trim()}), keep: keep)) {
                cashout.clear();
                note.clear();
              }
            },
          ),
          if (myCashouts.isNotEmpty) ...[
            const SizedBox(height: 12),
            for (final c in myCashouts)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(children: [
                  Expanded(child: Text('${hryvnia(c['amount'])} · ${ago(c['created_at'])}', style: body(13))),
                  Pill(
                    label: switch (c['status']) { 'paid' => 'Видано', 'cancelled' => 'Скасовано', _ => 'Очікує' },
                    color: switch (c['status']) { 'paid' => green, 'cancelled' => muted, _ => gold },
                  ),
                  if (c['status'] == 'pending')
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      tooltip: 'Скасувати',
                      onPressed: () => ctx.act(context, () => ctx.api.post(ctx.path('bank/cashouts/${c['id']}/cancel')), keep: keep),
                      icon: const Icon(LucideIcons.x, size: 18, color: muted),
                    ),
                  if (c['has_proof'] == true)
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      onPressed: () => openAuthImages(context, [ctx.path('bank/cashouts/${c['id']}/proof')], 0),
                      icon: const Icon(LucideIcons.image, size: 18, color: muted),
                    ),
                ]),
              ),
          ],
        ],
      ),
      if (deposits['enabled'] == true)
        _card(
          title: 'Депозит',
          icon: LucideIcons.piggyBank,
          subtitle: '${deposits['daily_rate']}% на день або ${deposits['weekly_rate']}% на тиждень. Дострокове закриття повертає лише тіло депозиту.',
          children: [
            GcField(controller: deposit, label: 'Від ${deposits['min_amount']} ₴', keyboard: TextInputType.number, dense: true),
            const SizedBox(height: 8),
            Segmented(
              options: const [SegmentOption('daily', 'Дні'), SegmentOption('weekly', 'Тижні')],
              selected: period,
              onSelect: (value) => setState(() => period = value),
            ),
            Row(children: [
              Expanded(
                child: Slider(
                  value: periods,
                  min: 1,
                  max: maxPeriods.toDouble(),
                  divisions: maxPeriods > 1 ? maxPeriods - 1 : null,
                  onChanged: maxPeriods > 1 ? (v) => setState(() => periods = v.roundToDouble()) : null,
                ),
              ),
              Text('${periods.round()} ${period == 'daily' ? 'дн.' : 'тиж.'}', style: body(13, weight: FontWeight.w700)),
            ]),
            Text('Ставка $rate% за ${period == 'daily' ? 'день' : 'тиждень'}. Суму до виплати сервер покаже після відкриття.', style: body(12, color: muted)),
            const SizedBox(height: 10),
            PrimaryButton(
              label: 'Відкрити депозит',
              onPressed: () async {
                if (await ctx.act(context, () => ctx.api.post(ctx.path('bank/deposits'), {'amount': deposit.text.trim(), 'period': period, 'periods': periods.round()}), keep: keep)) {
                  deposit.clear();
                }
              },
            ),
            for (final d in myDeposits)
              Container(
                margin: const EdgeInsets.only(top: 10),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.035), borderRadius: BorderRadius.circular(12), border: Border.all(color: line)),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${hryvnia(d['amount'])} → ${hryvnia(d['payout'])}', style: body(13.5, weight: FontWeight.w700)),
                      Text('${d['rate']}% · ${d['periods']} ${d['period'] == 'daily' ? 'дн.' : 'тиж.'} · до ${shortStamp(d['matures_at'])}', style: body(12, color: muted)),
                      if (intOf(d['accrued']) > 0) Text('Нараховано ${hryvnia(d['accrued'])}', style: body(12, color: green)),
                    ]),
                  ),
                  if (d['status'] == 'active')
                    TextButton(
                      onPressed: () async {
                        if (await confirm(context, 'Закрити депозит достроково?', text: 'Тіло повернеться на баланс, відсотки не нараховуються.', action: 'Закрити', danger: true) && context.mounted) {
                          await ctx.act(context, () => ctx.api.post(ctx.path('bank/deposits/${d['id']}/close')), keep: keep);
                        }
                      },
                      child: Text('Закрити', style: body(13, color: dangerSoft)),
                    )
                  else
                    Pill(label: d['status'] == 'matured' ? 'Виплачено' : 'Закрито', color: muted),
                ]),
              ),
          ],
        ),
      if (ctx.allowed('treasury.manage'))
        _card(
          title: 'Ручна операція',
          icon: LucideIcons.slidersHorizontal,
          subtitle: 'Нарахування чи списання з балансу учасника або скарбниці з обов’язковим коментарем.',
          trailing: TextButton(onPressed: () => setState(() => manualOpen = !manualOpen), child: Text(manualOpen ? 'Згорнути' : 'Розгорнути', style: body(12.5, color: primary))),
          children: [
            if (manualOpen) ...[
              Segmented(options: const [SegmentOption('member', 'Учасник'), SegmentOption('treasury', 'Скарбниця')], selected: target, onSelect: (v) => setState(() => target = v)),
              if (target == 'member') ...[
                const SizedBox(height: 8),
                GcSelect<int>(value: manualMember, hint: 'Оберіть учасника', expand: true, items: [for (final m in roster) (intOf(m['id']), '${m['display']}')], onChanged: (v) => setState(() => manualMember = v)),
              ],
              const SizedBox(height: 8),
              Segmented(options: const [SegmentOption('credit', 'Нарахувати'), SegmentOption('debit', 'Списати')], selected: direction, onSelect: (v) => setState(() => direction = v)),
              const SizedBox(height: 8),
              GcField(controller: manualAmount, label: 'Сума, ₴', keyboard: TextInputType.number, dense: true),
              const SizedBox(height: 8),
              GcField(controller: manualComment, label: 'Коментар (потрапить у журнал аудиту)', dense: true),
              const SizedBox(height: 10),
              PrimaryButton(
                label: 'Провести',
                onPressed: () async {
                  final ok = await ctx.act(
                    context,
                    () => ctx.api.post(ctx.path('bank/manual'), {
                      'target': target,
                      if (target == 'member') 'member_id': manualMember,
                      'direction': direction,
                      'amount': manualAmount.text.trim(),
                      'comment': manualComment.text.trim(),
                    }),
                    keep: keep,
                  );
                  if (ok) {
                    manualAmount.clear();
                    manualComment.clear();
                  }
                },
              ),
            ],
          ],
        ),
      _card(
        title: 'Журнал операцій',
        icon: LucideIcons.receipt,
        trailing: ctx.allowed('treasury.manage')
            ? SizedBox(
                width: 170,
                child: Segmented(
                  options: const [SegmentOption('me', 'Мої'), SegmentOption('family', 'Уся сім’я')],
                  selected: scope,
                  onSelect: (v) => ctx.reload(extra: {'scope': v}),
                ),
              )
            : null,
        children: [
          if (ledger.items.isEmpty) const QuietEmpty(icon: LucideIcons.receipt, text: 'Операцій ще немає'),
          for (final t in ledger.items) TransactionRow(tx: t, family: scope == 'family'),
          if (ledger.more) TextButton(onPressed: () => ctx.reload(extra: {'scope': scope, 'page': '${ledger.current + 1}'}), child: Text('Старіші операції', style: body(13, color: primary))),
        ],
      ),
    ]);
  }
}

// ───────────────────────── Склад ─────────────────────────

class WarehouseTab extends StatelessWidget {
  const WarehouseTab({required this.ctx, super.key});
  final FamilyContext ctx;

  Future<void> _move(BuildContext context, Map<String, dynamic> item, String action) async {
    final quantity = TextEditingController(text: '1');
    final comment = TextEditingController();
    XFile? proof;
    final ok = await showGcSheet<bool>(
      context,
      title: '${action == 'take' ? 'Взяти' : 'Покласти'}: ${item['name']}',
      subtitle: 'На складі ${item['quantity']} ${item['unit'] ?? 'шт'}${item['hourly_quota'] != null ? ' · квота ${item['hourly_quota']}/год' : ''}',
      builder: (sheet) => StatefulBuilder(
        builder: (context, set) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            GcField(controller: quantity, label: 'Кількість', keyboard: TextInputType.number),
            const SizedBox(height: 8),
            GcField(controller: comment, label: 'Коментар (необов’язково)'),
            const SizedBox(height: 8),
            GhostButton(
              label: proof == null ? 'Скріншот (необов’язково)' : 'Скріншот додано',
              icon: LucideIcons.image,
              onPressed: () async {
                final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 90);
                if (picked != null) set(() => proof = picked);
              },
            ),
            const SizedBox(height: 14),
            PrimaryButton(label: action == 'take' ? 'Взяти' : 'Покласти', onPressed: () => Navigator.pop(sheet, true)),
          ]),
        ),
      ),
    );
    if (ok != true || !context.mounted) return;
    final files = [if (proof != null) await http.MultipartFile.fromPath('proof', proof!.path, filename: proof!.name)];
    if (!context.mounted) return;
    await ctx.act(
      context,
      () => ctx.api.upload(ctx.path('warehouse/move'), {'item_id': '${item['id']}', 'action': action, 'quantity': quantity.text.trim(), if (comment.text.trim().isNotEmpty) 'comment': comment.text.trim()}, files),
    );
  }

  Future<void> _editItem(BuildContext context, {Map<String, dynamic>? item}) async {
    final categories = mapOf(ctx.data['categories']);
    final name = TextEditingController(text: text(item?['name']) ?? '');
    final unit = TextEditingController(text: text(item?['unit']) ?? '');
    final quantity = TextEditingController(text: item == null ? '0' : '${item['quantity']}');
    final quota = TextEditingController(text: item?['hourly_quota'] == null ? '' : '${item!['hourly_quota']}');
    final minStock = TextEditingController(text: item?['min_stock'] == null ? '' : '${item!['min_stock']}');
    final comment = TextEditingController();
    var category = text(item?['category']) ?? (categories.keys.isEmpty ? 'other' : categories.keys.first);
    var archived = item?['is_archived'] == true;
    final ok = await showGcSheet<bool>(
      context,
      title: item == null ? 'Нова позиція' : 'Редагувати позицію',
      builder: (sheet) => StatefulBuilder(
        builder: (context, set) => SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            GcSelect<String>(value: categories.containsKey(category) ? category : null, expand: true, items: [for (final e in categories.entries) (e.key, '${e.value}')], onChanged: (v) => set(() => category = v ?? category)),
            const SizedBox(height: 8),
            GcField(controller: name, label: 'Назва'),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: GcField(controller: quantity, label: 'Кількість', keyboard: TextInputType.number, dense: true)),
              const SizedBox(width: 8),
              Expanded(child: GcField(controller: unit, label: 'Одиниця (шт)', dense: true)),
            ]),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: GcField(controller: quota, label: 'Квота за годину', keyboard: TextInputType.number, dense: true)),
              const SizedBox(width: 8),
              Expanded(child: GcField(controller: minStock, label: 'Мінімальний залишок', keyboard: TextInputType.number, dense: true)),
            ]),
            if (item != null) ...[
              const SizedBox(height: 8),
              GcField(controller: comment, label: 'Коментар до інвентаризації', dense: true),
              SwitchListTile(contentPadding: EdgeInsets.zero, value: archived, title: Text('В архіві', style: body(14)), onChanged: (v) => set(() => archived = v)),
            ],
            const SizedBox(height: 12),
            PrimaryButton(label: 'Зберегти', onPressed: () => Navigator.pop(sheet, true)),
          ]),
        ),
      ),
    );
    if (ok != true || !context.mounted) return;
    final payload = {
      'category': category,
      'name': name.text.trim(),
      'unit': unit.text.trim().isEmpty ? null : unit.text.trim(),
      'quantity': int.tryParse(quantity.text.trim()),
      'hourly_quota': int.tryParse(quota.text.trim()),
      'min_stock': int.tryParse(minStock.text.trim()),
      if (item != null) 'is_archived': archived,
      if (item != null && comment.text.trim().isNotEmpty) 'comment': comment.text.trim(),
    };
    await ctx.act(context, () => item == null ? ctx.api.post(ctx.path('warehouse/items'), payload) : ctx.api.patch(ctx.path('warehouse/items/${item['id']}'), payload));
  }

  @override
  Widget build(BuildContext context) {
    final tab = text(ctx.data['tab']) ?? 'stock';
    final items = maps(ctx.data['items']);
    final categories = mapOf(ctx.data['categories']);
    final logs = maps(ctx.data['logs']);
    final takers = maps(ctx.data['top_takers']);
    final manage = ctx.allowed('warehouse.manage');
    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final item in items) {
      grouped.putIfAbsent('${item['category']}', () => []).add(item);
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (ctx.allowed('warehouse.logs'))
        Segmented(
          options: [
            const SegmentOption('stock', 'Залишки'),
            const SegmentOption('log', 'Журнал'),
            SegmentOption('alerts', 'Підозрілі', count: intOf(mapOf(ctx.data['badges'])['alerts']) > 0 ? mapOf(ctx.data['badges'])['alerts'] : null),
          ],
          selected: tab,
          onSelect: (v) => ctx.reload(extra: {'tab': v}),
        ),
      const SizedBox(height: 10),
      Swap(id: tab, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (tab == 'stock') ...[
        if (manage) Align(alignment: Alignment.centerRight, child: GhostButton(label: 'Позиція', icon: LucideIcons.plus, compact: true, expand: false, onPressed: () => _editItem(context))),
        const SizedBox(height: 10),
        if (items.isEmpty) const Glass(child: QuietEmpty(icon: LucideIcons.package, text: 'Склад порожній')),
        for (final entry in grouped.entries)
          _card(
            title: '${categories[entry.key] ?? entry.key}',
            icon: LucideIcons.package,
            children: [
              for (final item in entry.value)
                Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: item['is_archived'] == true ? 0.015 : 0.035),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: item['low'] == true ? danger.withValues(alpha: 0.4) : line),
                  ),
                  child: Column(children: [
                    Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${item['name']}${item['is_archived'] == true ? ' (архів)' : ''}', style: body(14, weight: FontWeight.w600)),
                          if (item['hourly_quota'] != null) Text('квота ${item['hourly_quota']}/год', style: body(11.5, color: muted)),
                        ]),
                      ),
                      Text('${item['quantity']}', style: display(18, color: item['low'] == true ? dangerSoft : ink)),
                      const SizedBox(width: 4),
                      Text(text(item['unit']) ?? 'шт', style: body(12, color: muted)),
                    ]),
                    const SizedBox(height: 8),
                    Row(children: [
                      Expanded(child: GhostButton(label: 'Взяти', icon: LucideIcons.upload, compact: true, onPressed: intOf(item['quantity']) > 0 && item['is_archived'] != true ? () => _move(context, item, 'take') : null)),
                      const SizedBox(width: 8),
                      Expanded(child: GhostButton(label: 'Покласти', icon: LucideIcons.download, compact: true, onPressed: item['is_archived'] != true ? () => _move(context, item, 'put') : null)),
                      if (manage) IconButton(visualDensity: VisualDensity.compact, onPressed: () => _editItem(context, item: item), icon: const Icon(LucideIcons.pencil, size: 18, color: muted)),
                    ]),
                  ]),
                ),
            ],
          ),
      ],
      if (takers.isNotEmpty && tab != 'stock')
        _card(
          title: 'Найбільше брали за добу',
          icon: LucideIcons.trendingUp,
          children: [
            for (final t in takers)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(children: [
                  Expanded(child: Text(text(t['display']) ?? '', style: body(13).copyWith(fontFamily: 'monospace'))),
                  Text('${t['total']} шт · ${t['times']} раз', style: body(12, color: muted)),
                ]),
              ),
          ],
        ),
      _card(
        title: tab == 'stock' ? 'Мої останні дії' : (tab == 'alerts' ? 'Підозріла активність' : 'Журнал складу'),
        icon: tab == 'alerts' ? LucideIcons.triangleAlert : LucideIcons.history,
        children: [
          if (logs.isEmpty) const QuietEmpty(icon: LucideIcons.package, text: 'Записів немає'),
          for (final l in logs)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(
                  l['action'] == 'take' ? LucideIcons.upload : (l['action'] == 'put' ? LucideIcons.download : LucideIcons.boxes),
                  size: 18,
                  color: l['is_suspicious'] == true ? dangerSoft : muted,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${l['action_label']} ${l['quantity']} × ${l['item']}', style: body(13.5, weight: FontWeight.w600)),
                    if (text(l['member']) != null) Text(text(l['member'])!, style: body(12, color: soft).copyWith(fontFamily: 'monospace')),
                    if (text(l['comment']) != null) Text(text(l['comment'])!, style: body(12, color: muted)),
                    Text('Залишок ${l['quantity_after']} · ${ago(l['created_at'])}', style: body(11.5, color: faint)),
                  ]),
                ),
                if (text(l['proof_url']) != null)
                  IconButton(visualDensity: VisualDensity.compact, onPressed: () => openAuthImages(context, [sitePathOf(text(l['proof_url'])!)], 0), icon: const Icon(LucideIcons.image, size: 18, color: muted)),
              ]),
            ),
        ],
      ),
      ])),
    ]);
  }
}

// ───────────────────────── Учасники ─────────────────────────

class MembersTab extends StatefulWidget {
  const MembersTab({required this.ctx, super.key});
  final FamilyContext ctx;

  @override
  State<MembersTab> createState() => _MembersTabState();
}

class _MembersTabState extends State<MembersTab> {
  final query = TextEditingController();

  FamilyContext get ctx => widget.ctx;

  @override
  void dispose() {
    query.dispose();
    super.dispose();
  }

  Future<void> _manage(Map<String, dynamic> member) async {
    final titles = mapOf(ctx.family['rank_titles']);
    final self = intOf(member['id']) == intOf(ctx.me['id']);
    final choice = await showGcSheet<String>(
      context,
      title: text(member['display']),
      subtitle: '${member['rank']} ${member['rank_title'] ?? ''}',
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (member['manageable'] == true) SheetAction(icon: LucideIcons.medal, label: 'Змінити ранг', onTap: () => Navigator.pop(sheet, 'rank')),
          if (member['manageable'] == true || (self && ctx.allowed('ranks.manage'))) SheetAction(icon: LucideIcons.idCard, label: 'Обов’язки', onTap: () => Navigator.pop(sheet, 'duties')),
          if (ctx.allowed('members.manage') && (self || member['manageable'] == true)) SheetAction(icon: LucideIcons.idCard, label: 'RP-дані (нік і Static ID)', onTap: () => Navigator.pop(sheet, 'identity')),
          if (ctx.allowed('owner') && !self) SheetAction(icon: LucideIcons.crown, label: 'Передати лідерство', color: gold, onTap: () => Navigator.pop(sheet, 'transfer')),
          if (member['manageable'] == true) SheetAction(icon: LucideIcons.userRoundMinus, label: 'Виключити', color: dangerSoft, onTap: () => Navigator.pop(sheet, 'kick')),
          if (text(member['username']) != null) SheetAction(icon: LucideIcons.userRound, label: 'Профіль GameCon', onTap: () => Navigator.pop(sheet, 'profile')),
        ]),
      ),
    );
    if (!mounted || choice == null) return;
    final path = ctx.path('members/${member['id']}');
    switch (choice) {
      case 'rank':
        final rank = await showGcSheet<int>(
          context,
          title: 'Новий ранг',
          builder: (sheet) => ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(12, 0, 12, 20), children: [
            for (var r = 9; r >= 1; r--)
              ListTile(
                leading: RankPill(rank: r),
                title: Text('${titles['$r'] ?? ''}', style: body(14.5, color: intOf(member['rank']) == r ? primary : ink)),
                onTap: () => Navigator.pop(sheet, r),
              ),
          ]),
        );
        if (rank != null && mounted) await ctx.act(context, () => ctx.api.patch(path, {'rank': rank}), keep: const {'tab': 'members'});
      case 'duties':
        final duties = await askText(context, 'Обов’язки', initial: text(member['duties']) ?? '', hint: 'Напр. «Склад і контракти»');
        if (duties != null && mounted) await ctx.act(context, () => ctx.api.patch(path, {'duties': duties}), keep: const {'tab': 'members'});
      case 'identity':
        final nick = await askText(context, 'RP-нікнейм', initial: text(member['nickname']) ?? '', hint: 'Ім’я_Прізвище');
        if (nick == null || !mounted) return;
        final id = await askText(context, 'Static ID', initial: text(member['static_id']) ?? '', hint: 'Лише цифри');
        if (id == null || !mounted) return;
        await ctx.act(context, () => ctx.api.patch(path, {'rp_nickname': nick, 'static_id': id}), keep: const {'tab': 'members'});
      case 'transfer':
        if (await confirm(context, 'Передати лідерство ${member['display']}?', text: 'Ви залишитеся в сім’ї з рангом заступника.', action: 'Передати', danger: true) && mounted) {
          await ctx.act(context, () => ctx.api.post('$path/transfer'));
        }
      case 'kick':
        final reason = await askText(context, 'Виключити ${member['display']}?', hint: 'Причина (обов’язково)', action: 'Виключити');
        if (reason != null && reason.length >= 3 && mounted) await ctx.act(context, () => ctx.api.post('$path/kick', {'reason': reason}), keep: const {'tab': 'members'});
      case 'profile':
        context.push('/u/${member['username']}');
    }
  }

  Future<void> _ranks() async {
    final titles = mapOf(ctx.family['rank_titles']);
    final permissions = mapOf(ctx.data['permissions']);
    final matrix = {for (final e in mapOf(ctx.data['matrix']).entries) e.key: {for (final r in (e.value as List? ?? const [])) intOf(r)}};
    final controllers = {for (var r = 1; r <= 10; r++) r: TextEditingController(text: '${titles['$r'] ?? ''}')};
    final editable = ctx.allowed('ranks.manage');
    final saved = await showGcSheet<bool>(
      context,
      title: 'Ранги й права',
      subtitle: 'Ранг 10 і власник можуть усе. Відмітьте, які ранги мають кожне право.',
      height: MediaQuery.sizeOf(context).height * 0.9,
      builder: (sheet) => StatefulBuilder(
        builder: (context, set) => ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 24), children: [
          for (var r = 10; r >= 1; r--)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(children: [
                SizedBox(width: 34, child: RankPill(rank: r)),
                const SizedBox(width: 10),
                Expanded(child: GcField(controller: controllers[r]!, label: 'Назва рангу', dense: true, enabled: editable)),
              ]),
            ),
          const SizedBox(height: 10),
          for (final p in permissions.entries)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${p.value}', style: body(13, weight: FontWeight.w600)),
                const SizedBox(height: 6),
                Wrap(spacing: 4, runSpacing: 4, children: [
                  for (var r = 1; r <= 9; r++)
                    SelectPill(
                      label: '$r',
                      selected: matrix[p.key]?.contains(r) == true,
                      onTap: editable ? () => set(() => (matrix[p.key] ??= {}).contains(r) ? matrix[p.key]!.remove(r) : matrix[p.key]!.add(r)) : () {},
                    ),
                ]),
              ]),
            ),
          if (editable) PrimaryButton(label: 'Зберегти', onPressed: () => Navigator.pop(sheet, true)),
        ]),
      ),
    );
    if (saved != true || !mounted) return;
    await ctx.act(
      context,
      () => ctx.api.put(ctx.path('ranks'), {
        'titles': [for (var r = 1; r <= 10; r++) controllers[r]!.text.trim()],
        'matrix': {for (final e in matrix.entries) e.key: (e.value.toList()..sort())},
      }),
      keep: const {'tab': 'members'},
    );
  }

  @override
  Widget build(BuildContext context) {
    final tab = text(ctx.data['tab']) ?? 'members';
    final q = query.text.trim().toLowerCase();
    final members = maps(ctx.data['members']).where((m) => q.isEmpty || '${m['display']} ${m['duties'] ?? ''}'.toLowerCase().contains(q)).toList();
    final applications = maps(ctx.data['applications']);
    final warnLimit = intOf(ctx.data['warn_limit'], 3);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Segmented(
        options: [
          SegmentOption('members', 'Учасники', count: maps(ctx.data['members']).length),
          if (ctx.allowed('members.manage')) SegmentOption('applications', 'Заявки', count: applications.isEmpty ? null : applications.length),
        ],
        selected: tab,
        onSelect: (v) => ctx.reload(extra: {'tab': v}),
      ),
      const SizedBox(height: 10),
      Swap(id: tab, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (tab == 'members') ...[
        GcField(controller: query, label: 'Нік, ID або обов’язки', icon: LucideIcons.search, dense: true, onChanged: (_) => setState(() {})),
        const SizedBox(height: 8),
        Align(alignment: Alignment.centerRight, child: GhostButton(label: 'Ранги й права', icon: LucideIcons.keyRound, compact: true, expand: false, onPressed: _ranks)),
        const SizedBox(height: 8),
        Glass(
          padding: const EdgeInsets.fromLTRB(10, 6, 6, 6),
          child: Column(children: [
            for (final m in members)
              MemberTile(
                member: m,
                subtitle: [
                  if (m['is_online'] == true) 'онлайн' else if (text(m['last_seen_at']) != null) 'був(-ла) ${ago(m['last_seen_at'])}',
                  if (intOf(m['warns']) > 0) '⚠ ${m['warns']}/$warnLimit',
                ].join(' · '),
                trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                  if (m['balance'] != null) Text(hryvnia(m['balance']), style: body(12.5, color: green, weight: FontWeight.w700)),
                  IconButton(visualDensity: VisualDensity.compact, onPressed: () => _manage(m), icon: const Icon(LucideIcons.slidersHorizontal, size: 18, color: muted)),
                ]),
              ),
          ]),
        ),
        const SizedBox(height: 12),
        if (!ctx.allowed('owner'))
          GhostButton(
            label: 'Покинути сім’ю',
            icon: LucideIcons.logOut,
            color: dangerSoft,
            onPressed: () async {
              if (await confirm(context, 'Покинути сім’ю?', text: 'Баланс залишиться в сім’ї. Повернутися можна лише через нову заявку.', action: 'Покинути', danger: true) && context.mounted) {
                if (await attempt(context, () => ctx.api.post(ctx.path('leave'))) && context.mounted) context.go('/families');
              }
            },
          ),
      ] else ...[
        if (applications.isEmpty) const Glass(child: QuietEmpty(icon: LucideIcons.inbox, text: 'Нових заявок немає')),
        for (final a in applications)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Glass(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                MemberTile(member: a, subtitle: 'заявка ${ago(a['applied_at'])}'),
                if (text(a['note']) != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text('«${a['note']}»', style: body(13, color: soft))),
                Row(children: [
                  Expanded(
                    child: GhostButton(
                      label: 'Відхилити',
                      compact: true,
                      color: dangerSoft,
                      onPressed: () async {
                        final reason = await askText(context, 'Відхилити заявку?', hint: 'Причина (необов’язково)', action: 'Відхилити');
                        if (reason != null && context.mounted) await ctx.act(context, () => ctx.api.post(ctx.path('members/${a['id']}/decline'), {'reason': reason}), keep: const {'tab': 'applications'});
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(child: PrimaryButton(label: 'Прийняти', compact: true, onPressed: () => ctx.act(context, () => ctx.api.post(ctx.path('members/${a['id']}/accept')), keep: const {'tab': 'applications'}))),
                ]),
              ]),
            ),
          ),
      ],
      ])),
    ]);
  }
}

// ───────────────────────── Дисципліна ─────────────────────────

class DisciplineTab extends StatefulWidget {
  const DisciplineTab({required this.ctx, super.key});
  final FamilyContext ctx;

  @override
  State<DisciplineTab> createState() => _DisciplineTabState();
}

class _DisciplineTabState extends State<DisciplineTab> {
  int? member;
  String type = 'warn';
  final reason = TextEditingController();
  final amount = TextEditingController();

  FamilyContext get ctx => widget.ctx;

  @override
  void dispose() {
    reason.dispose();
    amount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final config = mapOf(ctx.data['config']);
    final types = mapOf(ctx.data['types']);
    final roster = maps(ctx.data['roster']);
    final list = maps(ctx.data['punishments']);
    final scope = text(ctx.data['scope']) ?? 'me';
    final limit = intOf(config['warn_limit'], 3);
    final myWarns = intOf(ctx.data['my_warns']);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Expanded(child: MetricTile(caps: true, label: 'Мої попередження', value: '$myWarns/$limit', color: myWarns > 0 ? dangerSoft : green, icon: LucideIcons.shield)),
        const SizedBox(width: 8),
        Expanded(child: MetricTile(caps: true, label: 'Термін дії попередження', value: '${config['warn_days'] ?? 30} дн.', icon: LucideIcons.gavel)),
      ]),
      const SizedBox(height: 8),
      MetricTile(caps: true, label: 'При досягненні ліміту', value: config['escalation'] == 'kick' ? 'Виключення' : 'Пониження рангу'),
      const SizedBox(height: 12),
      if (ctx.allowed('sanctions.issue'))
        _card(
          title: 'Видати покарання',
          icon: LucideIcons.gavel,
          children: [
            LabeledField(
              label: 'Учасник',
              child: GcSelect<int>(value: member, hint: 'Оберіть…', expand: true, items: [for (final m in roster) (intOf(m['id']), '${m['display']}${intOf(m['warns']) > 0 ? ' · ⚠${m['warns']}' : ''}')], onChanged: (v) => setState(() => member = v)),
            ),
            const SizedBox(height: 8),
            LabeledField(
              label: 'Тип',
              child: GcSelect<String>(value: type, expand: true, items: [for (final e in types.entries) (e.key, '${e.value}')], onChanged: (v) => setState(() => type = v ?? type)),
            ),
            const SizedBox(height: 8),
            LabeledField(label: 'Причина', child: GcField(controller: reason, label: 'Пункт статуту або опис порушення', dense: true)),
            if (type == 'fine') ...[
              const SizedBox(height: 8),
              LabeledField(label: 'Сума, ₴', child: GcField(controller: amount, label: 'Сума штрафу', keyboard: TextInputType.number, dense: true)),
            ],
            const SizedBox(height: 12),
            PrimaryButton(
              label: 'Видати',
              onPressed: member == null
                  ? null
                  : () async {
                      final ok = await ctx.act(context, () => ctx.api.post(ctx.path('discipline'), {
                            'member_id': member,
                            'type': type,
                            'reason': reason.text.trim(),
                            if (type == 'fine') 'amount': amount.text.trim(),
                          }), keep: {'scope': scope});
                      if (ok) {
                        reason.clear();
                        amount.clear();
                        setState(() => member = null);
                      }
                    },
            ),
          ],
        ),
      _card(
        title: 'Історія',
        icon: LucideIcons.shield,
        trailing: ctx.allowed('sanctions.issue')
            ? SizedBox(
                width: 160,
                child: Segmented(options: const [SegmentOption('family', 'Уся сім’я'), SegmentOption('me', 'Мої')], selected: scope, onSelect: (v) => ctx.reload(extra: {'scope': v})),
              )
            : null,
        children: [
          if (list.isEmpty) const QuietEmpty(icon: LucideIcons.shieldCheck, text: 'Порушень немає — так тримати'),
          for (final p in list)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.035), borderRadius: BorderRadius.circular(12), border: Border.all(color: p['active'] == true ? danger.withValues(alpha: 0.35) : line)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Text(text(p['type_label']) ?? '', style: body(13.5, weight: FontWeight.w700, color: p['active'] == true ? dangerSoft : soft)),
                  if (intOf(p['amount']) > 0) Text(' · ${hryvnia(p['amount'])}', style: body(13, color: gold)),
                  const Spacer(),
                  if (p['revoked_at'] != null) const Pill(label: 'Знято', color: muted) else if (p['active'] != true) const Pill(label: 'Минуло', color: muted),
                ]),
                if (scope == 'family') Text(text(p['member']) ?? '', style: body(12.5, color: soft).copyWith(fontFamily: 'monospace')),
                Text(text(p['reason']) ?? '', style: body(13, color: soft)),
                Text('${p['issuer'] ?? '—'} · ${ago(p['created_at'])}${p['expires_at'] != null && p['active'] == true ? ' · діє до ${shortStamp(p['expires_at'])}' : ''}', style: body(11.5, color: faint)),
                if (text(p['revoke_reason']) != null) Text('Знято: ${p['revoke_reason']}', style: body(11.5, color: muted)),
                if (p['active'] == true && ctx.allowed('sanctions.issue') && p['type'] != 'kick')
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () async {
                        final why = await askText(context, 'Зняти покарання?', hint: 'Причина (обов’язково)', action: 'Зняти');
                        if (why != null && why.length >= 3 && context.mounted) await ctx.act(context, () => ctx.api.post(ctx.path('discipline/${p['id']}/revoke'), {'reason': why}), keep: {'scope': scope});
                      },
                      child: Text('Зняти', style: body(13, color: primary)),
                    ),
                  ),
              ]),
            ),
        ],
      ),
    ]);
  }
}

// ───────────────────────── Події ─────────────────────────

class EventsTab extends StatelessWidget {
  const EventsTab({required this.ctx, super.key});
  final FamilyContext ctx;

  Future<void> _create(BuildContext context) async {
    final types = mapOf(ctx.data['types']);
    final title = TextEditingController();
    final description = TextEditingController();
    final points = TextEditingController(text: '${ctx.data['default_points'] ?? 5}');
    final reward = TextEditingController();
    var type = types.keys.isEmpty ? 'meeting' : types.keys.first;
    var when = DateTime.now().add(const Duration(hours: 2));
    final ok = await showGcSheet<bool>(
      context,
      title: 'Нова подія',
      subtitle: 'Подію буде анонсовано в чаті сім’ї.',
      builder: (sheet) => StatefulBuilder(
        builder: (context, set) => SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            GcField(controller: title, label: 'Назва'),
            const SizedBox(height: 8),
            GcSelect<String>(value: type, expand: true, items: [for (final e in types.entries) (e.key, '${e.value}')], onChanged: (v) => set(() => type = v ?? type)),
            const SizedBox(height: 8),
            GhostButton(
              label: '${when.day} ${monthsGenitive[when.month - 1]}, ${when.hour.toString().padLeft(2, '0')}:${when.minute.toString().padLeft(2, '0')} (Київ)',
              icon: LucideIcons.clock,
              onPressed: () async {
                final day = await showDatePicker(context: context, initialDate: when, firstDate: DateTime.now().subtract(const Duration(days: 1)), lastDate: DateTime.now().add(const Duration(days: 365)));
                if (day == null || !context.mounted) return;
                final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(when));
                if (time == null) return;
                set(() => when = DateTime(day.year, day.month, day.day, time.hour, time.minute));
              },
            ),
            const SizedBox(height: 8),
            GcField(controller: description, label: 'Опис (необов’язково)', maxLines: 3),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: GcField(controller: points, label: 'Бали', keyboard: TextInputType.number, dense: true)),
              const SizedBox(width: 8),
              Expanded(child: GcField(controller: reward, label: 'Нагорода, ₴', keyboard: TextInputType.number, dense: true)),
            ]),
            const SizedBox(height: 14),
            PrimaryButton(label: 'Створити', onPressed: () => Navigator.pop(sheet, true)),
          ]),
        ),
      ),
    );
    if (ok != true || !context.mounted) return;
    String two(int v) => v.toString().padLeft(2, '0');
    await ctx.act(context, () => ctx.api.post(ctx.path('events'), {
          'title': title.text.trim(),
          'type': type,
          'description': description.text.trim(),
          'starts_at': '${when.year}-${two(when.month)}-${two(when.day)} ${two(when.hour)}:${two(when.minute)}',
          'points': int.tryParse(points.text.trim()),
          if (reward.text.trim().isNotEmpty) 'reward': reward.text.trim(),
        }));
  }

  Future<void> _close(BuildContext context, Map<String, dynamic> event) async {
    final roster = maps(ctx.data['roster']);
    final attended = {for (final a in maps(event['attendance'])) intOf(a['member_id'])};
    final ok = await showGcSheet<String>(
      context,
      title: 'Підсумок: ${event['title']}',
      subtitle: 'Відмітьте присутніх — їм нарахуються бали й нагорода.',
      height: MediaQuery.sizeOf(context).height * 0.8,
      builder: (sheet) => StatefulBuilder(
        builder: (context, set) => Column(children: [
          Expanded(
            child: ListView(padding: const EdgeInsets.symmetric(horizontal: 12), children: [
              for (final m in roster)
                CheckboxListTile(
                  value: attended.contains(intOf(m['id'])),
                  title: Text('${m['display']}', style: body(14).copyWith(fontFamily: 'monospace')),
                  onChanged: (v) => set(() => v == true ? attended.add(intOf(m['id'])) : attended.remove(intOf(m['id']))),
                ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
            child: Row(children: [
              Expanded(child: GhostButton(label: 'Скасувати подію', color: dangerSoft, compact: true, onPressed: () => Navigator.pop(sheet, 'cancel'))),
              const SizedBox(width: 8),
              Expanded(child: PrimaryButton(label: 'Зберегти (${attended.length})', compact: true, onPressed: () => Navigator.pop(sheet, 'close'))),
            ]),
          ),
        ]),
      ),
    );
    if (ok == null || !context.mounted) return;
    await ctx.act(context, () => ctx.api.post(ctx.path('events/${event['id']}/close'), {'attended': attended.toList(), 'cancelled': ok == 'cancel'}));
  }

  @override
  Widget build(BuildContext context) {
    final events = maps(ctx.data['events']);
    final planned = events.where((e) => e['status'] == 'planned').toList();
    final past = events.where((e) => e['status'] != 'planned').toList();
    Widget eventCard(Map<String, dynamic> e) {
      final attendance = maps(e['attendance']);
      final isPlanned = e['status'] == 'planned';
      return Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(text(e['title']) ?? '', style: body(15, weight: FontWeight.w700))),
              Pill(label: text(e['type_label']) ?? ''),
            ]),
            const SizedBox(height: 4),
            Text('${fullDate(e['starts_at'])}, ${clock(e['starts_at'])}', style: body(12.5, color: muted)),
            if (text(e['description']) != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(text(e['description'])!, style: body(13, color: soft))),
            const SizedBox(height: 6),
            Text(
              [
                '${e['points']} балів',
                if (intOf(e['reward']) > 0) hryvnia(e['reward']),
                '${attendance.length} ${isPlanned ? 'йдуть' : 'були'}',
                if (text(e['creator']) != null) 'створив ${e['creator']}',
              ].join(' · '),
              style: body(12, color: faint),
            ),
            if (!isPlanned) Padding(padding: const EdgeInsets.only(top: 6), child: Pill(label: e['status'] == 'done' ? 'Завершено' : 'Скасовано', color: e['status'] == 'done' ? green : muted)),
            if (isPlanned) ...[
              const SizedBox(height: 10),
              Row(children: [
                Expanded(
                  child: e['going'] == true
                      ? GhostButton(label: 'Не піду', compact: true, onPressed: () => ctx.act(context, () => ctx.api.post(ctx.path('events/${e['id']}/rsvp'), {'going': false})))
                      : PrimaryButton(label: 'Піду', icon: LucideIcons.check, compact: true, onPressed: () => ctx.act(context, () => ctx.api.post(ctx.path('events/${e['id']}/rsvp'), {'going': true}))),
                ),
                if (ctx.allowed('events.manage')) ...[
                  const SizedBox(width: 8),
                  Expanded(child: GhostButton(label: 'Підсумок', icon: LucideIcons.listChecks, compact: true, onPressed: () => _close(context, e))),
                ],
              ]),
            ],
          ]),
        ),
      );
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Expanded(child: Text('Заплановані', style: display(18))),
        if (ctx.allowed('events.manage')) PrimaryButton(label: 'Нова подія', icon: LucideIcons.calendarDays, compact: true, expand: false, onPressed: () => _create(context)),
      ]),
      const SizedBox(height: 10),
      if (planned.isEmpty) const Glass(child: QuietEmpty(icon: LucideIcons.calendarDays, text: 'Запланованих подій немає')),
      for (final e in planned) eventCard(e),
      if (past.isNotEmpty) ...[
        const SectionLabel('Минулі'),
        for (final e in past) eventCard(e),
      ],
    ]);
  }
}

// ───────────────────────── Рейтинг ─────────────────────────

List<Widget> ratingTab(FamilyContext ctx) {
  final periods = mapOf(ctx.data['periods']);
  final period = text(ctx.data['period']) ?? 'week';
  final rows = maps(ctx.data['leaderboard']);
  final config = mapOf(ctx.data['config']);
  final counted = [
    if (config['bizwar'] == true) 'бізвари',
    if (config['contracts'] == true) 'контракти',
    if (config['investments'] == true) 'інвестиції',
    if (config['events'] == true) 'події',
  ];
  final podium = rows.take(3).toList();
  const medals = [gold, Color(0xFFC0C7D9), Color(0xFFCD7F32)];
  return [
    Segmented(options: [for (final e in periods.entries) SegmentOption(e.key, '${e.value}')], selected: period, onSelect: (v) => ctx.reload(extra: {'period': v})),
    const SizedBox(height: 6),
    Text('Враховуються: ${counted.join(', ')}', textAlign: TextAlign.right, style: body(11.5, color: muted)),
    const SizedBox(height: 10),
    if (rows.isEmpty) const Glass(child: QuietEmpty(icon: LucideIcons.chartNoAxesColumnIncreasing, text: 'Даних за цей період ще немає')),
    for (var i = 0; i < podium.length; i++)
      Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Glass(
          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [medals[i].withValues(alpha: 0.22), cardTop]),
          border: medals[i].withValues(alpha: 0.35),
          child: Column(children: [
            Icon(LucideIcons.trophy, color: medals[i], size: 30),
            const SizedBox(height: 6),
            Text(text(podium[i]['display']) ?? '', style: body(14, weight: FontWeight.w600).copyWith(fontFamily: 'monospace')),
            const SizedBox(height: 4),
            RankPill(rank: podium[i]['rank'], title: text(podium[i]['rank_title'])),
            const SizedBox(height: 8),
            Text('${podium[i]['points']}', style: display(26)),
            Text('балів · ${hryvnia(podium[i]['earned'])}', style: body(12, color: muted)),
          ]),
        ),
      ),
    if (rows.isNotEmpty)
      Glass(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        child: Column(children: [
          Row(children: [
            SizedBox(width: 26, child: Text('#', style: body(11, color: faint))),
            Expanded(child: Text('УЧАСНИК', style: body(11, color: faint, weight: FontWeight.w700))),
            SizedBox(width: 56, child: Text('БІЗВАРИ', textAlign: TextAlign.center, style: body(10, color: faint, weight: FontWeight.w700))),
            SizedBox(width: 44, child: Text('КОНТР.', textAlign: TextAlign.center, style: body(10, color: faint, weight: FontWeight.w700))),
            SizedBox(width: 44, child: Text('БАЛИ', textAlign: TextAlign.right, style: body(10, color: faint, weight: FontWeight.w700))),
          ]),
          const Divider(color: line),
          for (final r in rows)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 4),
              decoration: BoxDecoration(color: intOf(r['id']) == intOf(ctx.me['id']) ? primary.withValues(alpha: 0.1) : null, borderRadius: BorderRadius.circular(8)),
              child: Row(children: [
                SizedBox(width: 22, child: Text('${r['place']}', style: body(12.5, color: intOf(r['place']) <= 3 ? gold : muted, weight: FontWeight.w700))),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(text(r['display']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12.5).copyWith(fontFamily: 'monospace')),
                    Text(text(r['rank_title']) ?? '', style: body(10.5, color: muted)),
                  ]),
                ),
                SizedBox(width: 56, child: Text('${r['bizwar_wins']}/${r['bizwar_losses']}', textAlign: TextAlign.center, style: body(12, color: soft))),
                SizedBox(width: 44, child: Text('${r['contracts']}', textAlign: TextAlign.center, style: body(12, color: soft))),
                SizedBox(width: 44, child: Text('${r['points']}', textAlign: TextAlign.right, style: body(13, weight: FontWeight.w800))),
              ]),
            ),
        ]),
      ),
  ];
}

// ───────────────────────── Аудит ─────────────────────────

List<Widget> auditTab(FamilyContext ctx) {
  final actions = mapOf(ctx.data['actions']);
  final action = text(ctx.data['action']) ?? '';
  final logs = Listing.parse(ctx.data['logs']);
  return [
    Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('Журнал аудиту', style: display(18)),
        const SizedBox(height: 10),
        GcSelect<String>(
          value: action,
          expand: true,
          items: [('', 'Усі дії'), for (final e in actions.entries) (e.key, '${e.value}')],
          onChanged: (v) => ctx.reload(extra: {if ((v ?? '').isNotEmpty) 'action': v!}),
        ),
        const SizedBox(height: 8),
        Row(children: [
          const Icon(LucideIcons.lock, size: 14, color: muted),
          const SizedBox(width: 6),
          Expanded(child: Text('Записи незмінні: їх не може відредагувати чи видалити навіть лідер.', style: body(12, color: muted))),
        ]),
        const SizedBox(height: 10),
        if (logs.items.isEmpty) const QuietEmpty(icon: LucideIcons.receipt, text: 'Записів немає'),
        for (final entry in logs.items) AuditRow(entry: entry),
        if (logs.more)
          TextButton(
            onPressed: () => ctx.reload(extra: {if (action.isNotEmpty) 'action': action, 'page': '${logs.current + 1}'}),
            child: Text('Старіші записи', style: body(13, color: primary)),
          ),
      ]),
    ),
  ];
}

// ───────────────────────── Налаштування ─────────────────────────

class SettingsTab extends StatefulWidget {
  const SettingsTab({required this.ctx, super.key});
  final FamilyContext ctx;

  @override
  State<SettingsTab> createState() => _SettingsTabState();
}

class _SettingsTabState extends State<SettingsTab> {
  late final profile = mapOf(widget.ctx.data['profile']);
  late final name = TextEditingController(text: text(profile['name']) ?? '');
  late final tag = TextEditingController(text: text(profile['tag']) ?? '');
  late final description = TextEditingController(text: text(profile['description']) ?? '');
  late bool recruiting = profile['is_recruiting'] == true;
  XFile? logo;
  XFile? cover;

  /// Плоска копія налаштувань `group.key` → значення (числа редагуються текстом).
  late final Map<String, dynamic> values = {
    for (final group in mapOf(widget.ctx.data['settings']).entries)
      for (final item in mapOf(group.value).entries) '${group.key}.${item.key}': item.value,
  };
  late final Map<String, TextEditingController> numbers = {
    for (final e in values.entries)
      if (e.value is num) e.key: TextEditingController(text: _num(e.value)),
  };

  late final hooks = mapOf(widget.ctx.data['webhooks']);
  final discord = TextEditingController();
  final telegramToken = TextEditingController();
  late final telegramChat = TextEditingController(text: text(hooks['telegram_chat']) ?? '');

  FamilyContext get ctx => widget.ctx;

  static String _num(dynamic v) => v is double && v == v.roundToDouble() ? '${v.toInt()}' : '$v';

  @override
  void dispose() {
    for (final c in [name, tag, description, discord, telegramToken, telegramChat, ...numbers.values]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _saveProfile() async {
    final files = [
      if (logo != null) await http.MultipartFile.fromPath('logo', logo!.path, filename: logo!.name),
      if (cover != null) await http.MultipartFile.fromPath('cover', cover!.path, filename: cover!.name),
    ];
    if (!mounted) return;
    await ctx.act(context, () => ctx.api.upload(ctx.path('settings/profile'), {
          'name': name.text.trim(),
          'tag': tag.text.trim().toUpperCase(),
          'description': description.text.trim(),
          'is_recruiting': recruiting ? '1' : '0',
        }, files));
  }

  Future<void> _saveRules() async {
    final payload = <String, dynamic>{};
    for (final e in values.entries) {
      final parts = e.key.split('.');
      final group = (payload[parts[0]] ??= <String, dynamic>{}) as Map<String, dynamic>;
      group[parts[1]] = numbers.containsKey(e.key) ? (num.tryParse(numbers[e.key]!.text.trim().replaceAll(',', '.')) ?? e.value) : e.value;
    }
    await ctx.act(context, () => ctx.api.put(ctx.path('settings'), payload));
  }

  Widget _number(String key, String label) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: LabeledField(label: label, child: GcField(controller: numbers[key] ?? TextEditingController(), label: label, keyboard: const TextInputType.numberWithOptions(decimal: true), dense: true)),
      );

  Widget _toggle(String key, String label) => SwitchListTile(
        contentPadding: EdgeInsets.zero,
        dense: true,
        value: values[key] == true,
        title: Text(label, style: body(14)),
        onChanged: (v) => setState(() => values[key] = v),
      );

  Widget _group(String title, List<Widget> children) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.03), borderRadius: BorderRadius.circular(16), border: Border.all(color: line)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Text(title, style: body(14, weight: FontWeight.w700)), const SizedBox(height: 10), ...children]),
      );

  @override
  Widget build(BuildContext context) {
    final digest = mapOf(ctx.data['digest']);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _card(
        title: 'Профіль сім’ї',
        icon: LucideIcons.settings,
        children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Column(children: [
              logo != null ? ClipRRect(borderRadius: BorderRadius.circular(20), child: Image(image: XFileImage(logo!), width: 84, height: 84, fit: BoxFit.cover)) : FamilyLogo(family: ctx.family, size: 84),
              const SizedBox(height: 8),
              GhostButton(label: 'Логотип', icon: LucideIcons.image, compact: true, expand: false, onPressed: () async {
                final p = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1000, imageQuality: 90);
                if (p != null) setState(() => logo = p);
              }),
              const SizedBox(height: 6),
              GhostButton(label: cover == null ? 'Обкладинка' : 'Обрано', icon: LucideIcons.wallpaper, compact: true, expand: false, onPressed: () async {
                final p = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 2400, imageQuality: 90);
                if (p != null) setState(() => cover = p);
              }),
            ]),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                LabeledField(label: 'Назва', child: GcField(controller: name, label: 'Назва', dense: true)),
                const SizedBox(height: 8),
                LabeledField(label: 'Тег', child: GcField(controller: tag, label: 'TAG', dense: true)),
              ]),
            ),
          ]),
          const SizedBox(height: 8),
          LabeledField(label: 'Опис', child: GcField(controller: description, label: 'Опис', maxLines: 5, minLines: 3)),
          SwitchListTile(contentPadding: EdgeInsets.zero, value: recruiting, title: Text('Набір відкрито', style: body(14)), onChanged: (v) => setState(() => recruiting = v)),
          PrimaryButton(label: 'Зберегти профіль', onPressed: _saveProfile),
        ],
      ),
      _card(
        title: 'Правила й ставки',
        icon: LucideIcons.listChecks,
        subtitle: 'Кожна зміна записується в журнал аудиту (було → стало). Нові ставки діють для звітів, схвалених після збереження.',
        children: [
          _group('Ставки винагород', [
            _number('rates.bizwar_win', 'Бізвар — перемога, ₴'),
            _number('rates.bizwar_loss', 'Бізвар — поразка, ₴'),
            _number('rates.contract_light', 'Контракт легкий, ₴'),
            _number('rates.contract_medium', 'Контракт середній, ₴'),
            _number('rates.contract_heavy', 'Контракт важкий, ₴'),
            _number('rates.investment_cashback', 'Кешбек з інвестицій, %'),
          ]),
          _group('Звіти', [
            _number('reports.deadline_hours', 'Дедлайн подання, год'),
            _number('reports.contract_daily_limit', 'Ліміт контрактів на день (кожного рівня)'),
            _toggle('reports.require_proof', 'Скріншот обов’язковий'),
            _number('reports.max_proofs', 'Максимум скріншотів'),
          ]),
          _group('Депозити', [
            _toggle('deposits.enabled', 'Депозити увімкнено'),
            _number('deposits.daily_rate', 'Ставка на день, %'),
            _number('deposits.weekly_rate', 'Ставка на тиждень, %'),
            _number('deposits.min_amount', 'Мінімальна сума, ₴'),
            _number('deposits.max_days', 'Максимум днів'),
            _number('deposits.max_weeks', 'Максимум тижнів'),
          ]),
          _group('Рейтинг', [
            _toggle('rating.bizwar', 'Враховувати бізвари'),
            _toggle('rating.contracts', 'Враховувати контракти'),
            _toggle('rating.investments', 'Враховувати інвестиції'),
            _toggle('rating.events', 'Враховувати події'),
            _number('rating.points_bizwar_win', 'Бали: перемога'),
            _number('rating.points_bizwar_loss', 'Бали: поразка'),
            _number('rating.points_contract_light', 'Бали: легкий контракт'),
            _number('rating.points_contract_medium', 'Бали: середній контракт'),
            _number('rating.points_contract_heavy', 'Бали: важкий контракт'),
            _number('rating.points_per_1000', 'Бали за кожні 1000 ₴ інвестицій'),
            _number('rating.points_event', 'Бали за подію (типово)'),
          ]),
          _group('Дисципліна', [
            _number('discipline.warn_days', 'Попередження діє, днів'),
            _number('discipline.warn_limit', 'Ліміт попереджень'),
            LabeledField(
              label: 'Після ліміту',
              child: GcSelect<String>(
                value: '${values['discipline.escalation'] ?? 'demote'}',
                expand: true,
                items: const [('demote', 'Знизити ранг'), ('kick', 'Виключити')],
                onChanged: (v) => setState(() => values['discipline.escalation'] = v ?? 'demote'),
              ),
            ),
          ]),
          _group('Виплати', [_number('cashout.min_amount', 'Мінімальний вивід, ₴')]),
          _group('Тижневий звіт', [
            _toggle('digest.enabled', 'Щотижневий звіт (нд 23:59)'),
            _toggle('digest.chat', 'Публікувати в чат сім’ї'),
          ]),
          PrimaryButton(label: 'Зберегти правила', onPressed: _saveRules),
        ],
      ),
      _card(
        title: 'Боти Discord і Telegram',
        icon: LucideIcons.bot,
        subtitle: 'Сюди надходитимуть тижневі звіти, схвалення великих виплат і анонси подій.',
        trailing: GhostButton(label: 'Тест', compact: true, expand: false, onPressed: () => attempt(context, () => ctx.api.post(ctx.path('settings/webhooks/test')))),
        children: [
          LabeledField(label: 'Вебхук Discord', hint: text(hooks['discord']) ?? 'Налаштування каналу → Інтеграції → Вебхуки', child: GcField(controller: discord, label: 'https://discord.com/api/webhooks/…', dense: true)),
          const SizedBox(height: 8),
          LabeledField(label: 'Токен Telegram-бота', hint: text(hooks['telegram_token']) ?? 'Створіть бота в @BotFather', child: GcField(controller: telegramToken, label: '123456789:AA…', dense: true)),
          const SizedBox(height: 8),
          LabeledField(label: 'Chat ID', child: GcField(controller: telegramChat, label: '-1001234567890', dense: true)),
          const SizedBox(height: 10),
          Row(children: [
            if (hooks['discord'] != null) TextButton(onPressed: () => ctx.act(context, () => ctx.api.put(ctx.path('settings/webhooks'), {'clear': 'discord'})), child: Text('Прибрати Discord', style: body(12.5, color: dangerSoft))),
            if (hooks['telegram_token'] != null) TextButton(onPressed: () => ctx.act(context, () => ctx.api.put(ctx.path('settings/webhooks'), {'clear': 'telegram'})), child: Text('Прибрати Telegram', style: body(12.5, color: dangerSoft))),
            const Spacer(),
            PrimaryButton(
              label: 'Зберегти',
              compact: true,
              expand: false,
              onPressed: () => ctx.act(context, () => ctx.api.put(ctx.path('settings/webhooks'), {
                    if (discord.text.trim().isNotEmpty) 'discord': discord.text.trim(),
                    if (telegramToken.text.trim().isNotEmpty) 'telegram_token': telegramToken.text.trim(),
                    'telegram_chat': telegramChat.text.trim().isEmpty ? null : telegramChat.text.trim(),
                  })),
            ),
          ]),
        ],
      ),
      _card(
        title: 'Тижневий звіт',
        icon: LucideIcons.clipboardList,
        subtitle: 'Попередній перегляд: ${digest['members'] ?? 0} учасників · разом ${hryvnia(digest['total'])}',
        trailing: GhostButton(
          label: 'Надіслати зараз',
          icon: LucideIcons.send,
          compact: true,
          expand: false,
          onPressed: () async {
            if (await confirm(context, 'Надіслати тижневий звіт зараз?', action: 'Надіслати') && context.mounted) {
              await ctx.act(context, () => ctx.api.post(ctx.path('settings/digest')));
            }
          },
        ),
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.25), borderRadius: BorderRadius.circular(12)),
            child: Text(text(digest['text']) ?? '', style: body(12.5, color: soft).copyWith(fontFamily: 'monospace', height: 1.4)),
          ),
        ],
      ),
    ]);
  }
}
