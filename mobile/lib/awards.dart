import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// «Гра року» спільноти й ігрові ID у профілі — як на сайті.

class AwardsScreen extends StatelessWidget {
  const AwardsScreen({this.year, super.key});
  final int? year;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site(year == null ? '/games/awards' : '/games/awards/$year')),
      builder: (d, reload) => _AwardsBody(data: d, reload: reload),
    );
  }
}

class _AwardsBody extends StatefulWidget {
  const _AwardsBody({required this.data, required this.reload});
  final Map<String, dynamic> data;
  final Future<void> Function() reload;

  @override
  State<_AwardsBody> createState() => _AwardsBodyState();
}

class _AwardsBodyState extends State<_AwardsBody> {
  late List<Map<String, dynamic>> categories = maps(widget.data['categories']);

  @override
  void didUpdateWidget(_AwardsBody old) {
    super.didUpdateWidget(old);
    if (old.data != widget.data) categories = maps(widget.data['categories']);
  }

  int _days(String? iso) {
    final at = DateTime.tryParse(iso ?? '');
    if (at == null) return 0;
    final d = at.difference(DateTime.now()).inHours / 24;
    return d <= 0 ? 0 : d.ceil();
  }

  Future<void> _pick(Map<String, dynamic> category) async {
    final picked = await showGcSheet<Map<String, dynamic>>(
      context,
      title: text(category['label']),
      subtitle: text(category['hint']),
      scroll: false,
      height: MediaQuery.sizeOf(context).height * 0.8,
      builder: (sheet) => _Picker(category: category),
    );
    if (picked == null || !mounted) return;
    setState(() {
      categories = [
        for (final c in categories) c['key'] == category['key'] ? {...c, 'mine': picked['mine']} : c,
      ];
    });
  }

  Widget _cover(Map<String, dynamic> game, double size) => SizedBox(
        width: size,
        height: size,
        child: text(game['cover']) != null
            ? NetImage(text(game['cover']), radius: 12)
            : Container(
                decoration: BoxDecoration(color: ink.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
                alignment: Alignment.center,
                child: Text((text(game['name']) ?? '?').characters.first, style: body(16, weight: FontWeight.w700, color: soft)),
              ),
      );

  @override
  Widget build(BuildContext context) {
    final d = widget.data;
    final phase = text(d['phase']) ?? 'soon';
    final year = intOf(d['year']);
    final voted = categories.where((c) => c['mine'] is Map).length;
    final days = _days(text(d['opens_on']));
    final subtitle = switch (phase) {
      'voting' => tr('Голосування до 31 грудня. Оберіть гру в кожній номінації — голос можна змінити.'),
      'soon' => tr('Голосування стартує 1 грудня — через {days}.', {'days': '$days ${plural(days, 'день', 'дні', 'днів')}'}),
      _ => tr('Підсумки премії спільноти GameCon.'),
    };
    return ScreenScroll(
      onRefresh: widget.reload,
      children: [
        PageTitle(tr('Гра року {year}', {'year': '$year'}), subtitle: subtitle),
        if (phase == 'voting')
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(tr('Ви проголосували в {n} з {total} номінацій', {'n': '$voted', 'total': '${categories.length}'}), style: body(12.5, color: muted)),
          ),
        if (d['archive'] is List && (d['archive'] as List).isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Wrap(spacing: 8, children: [
              for (final y in (d['archive'] as List))
                ChoiceChip(
                  label: Text('$y'),
                  selected: intOf(y) == year,
                  onSelected: (_) => context.push('/games/awards/$y'),
                ),
            ]),
          ),
        for (final c in categories)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Glass(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(text(c['label']) ?? '', style: body(16, weight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(text(c['hint']) ?? '', style: body(12.5, color: muted)),
                const SizedBox(height: 12),
                if (phase == 'results') ...[
                  if (maps(mapOf(c['results'])['top']).isEmpty) Text(tr('Голосів не було.'), style: body(13, color: muted)),
                  for (final (i, g) in maps(mapOf(c['results'])['top']).indexed)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: InkWell(
                        onTap: () => context.push('/games/${g['slug']}'),
                        child: Row(children: [
                          _cover(g, i == 0 ? 46 : 36),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Row(children: [
                                if (i == 0) const Padding(padding: EdgeInsets.only(right: 4), child: Icon(LucideIcons.crown, size: 15, color: Color(0xFFFCD34D))),
                                Expanded(child: Text(text(g['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, weight: FontWeight.w600))),
                              ]),
                              const SizedBox(height: 5),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(4),
                                child: LinearProgressIndicator(value: intOf(g['percent']) / 100, minHeight: 5, backgroundColor: ink.withValues(alpha: 0.08), color: primary),
                              ),
                            ]),
                          ),
                          const SizedBox(width: 10),
                          Text('${g['percent']}%', style: body(12.5, color: soft)),
                        ]),
                      ),
                    ),
                ] else if (c['mine'] is Map)
                  Row(children: [
                    _cover(mapOf(c['mine']), 44),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(tr('Ваш вибір'), style: body(12, color: muted)),
                        Text(text(mapOf(c['mine'])['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14.5, weight: FontWeight.w600)),
                      ]),
                    ),
                    if (phase == 'voting') TextButton(onPressed: () => _pick(c), child: Text(tr('Змінити'))),
                  ])
                else if (phase == 'voting')
                  PrimaryButton(label: tr('Обрати гру'), icon: LucideIcons.trophy, onPressed: () => _pick(c))
                else
                  Text(tr('Вибір відкриється з голосуванням.'), style: body(13, color: muted)),
              ]),
            ),
          ),
      ],
    );
  }
}

class _Picker extends StatefulWidget {
  const _Picker({required this.category});
  final Map<String, dynamic> category;

  @override
  State<_Picker> createState() => _PickerState();
}

class _PickerState extends State<_Picker> {
  final search = TextEditingController();
  List<Map<String, dynamic>>? games;
  Timer? debounce;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    debounce?.cancel();
    search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final d = await AppScope.read(context).session.api.get(Api.site('/games/awards/candidates?category=${widget.category['key']}&q=${Uri.encodeQueryComponent(search.text)}'));
      if (mounted) setState(() => games = maps(d['games']));
    } catch (_) {
      if (mounted) setState(() => games = []);
    }
  }

  Future<void> _vote(String? slug) async {
    setState(() => busy = true);
    try {
      final r = await AppScope.read(context).session.api.post(Api.site('/games/awards/vote'), {'category': widget.category['key'], 'game': slug});
      if (!mounted) return;
      toast(context, tr(text(r['message']) ?? 'Голос зараховано.'));
      Navigator.of(context).pop({'mine': r['mine']});
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mine = mapOf(widget.category['mine']);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(children: [
        GcField(
          controller: search,
          label: tr('Пошук гри'),
          icon: LucideIcons.search,
          onChanged: (_) {
            debounce?.cancel();
            debounce = Timer(const Duration(milliseconds: 300), _load);
          },
        ),
        const SizedBox(height: 8),
        Expanded(
          child: games == null
              ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
              : games!.isEmpty
                  ? QuietEmpty(icon: LucideIcons.search, text: tr('Нічого не знайдено.'))
                  : ListView(children: [
                      for (final g in games!)
                        ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                          enabled: !busy,
                          leading: SizedBox(width: 40, height: 40, child: NetImage(text(g['cover']), radius: 10)),
                          title: Text(text(g['name']) ?? '', style: body(14.5, weight: FontWeight.w600)),
                          subtitle: Text([if (g['year'] != null) '${g['year']}', ...((g['genres'] as List?) ?? const []).map((e) => '$e')].join(' · '), style: body(12, color: muted)),
                          trailing: mine['slug'] == g['slug'] ? Icon(LucideIcons.check, color: primary) : null,
                          onTap: () => _vote(text(g['slug'])),
                        ),
                    ]),
        ),
        if (mine.isNotEmpty) TextButton.icon(onPressed: busy ? null : () => _vote(null), icon: const Icon(LucideIcons.x, size: 16), label: Text(tr('Прибрати мій голос'))),
      ]),
    );
  }
}

/// Платформи й ігрові ID у профілі: копіювання дотиком; власник редагує.
class GamerIdsPanel extends StatelessWidget {
  const GamerIdsPanel({required this.platforms, required this.isSelf, required this.onSaved, super.key});
  final Map<String, dynamic> platforms;
  final bool isSelf;
  final VoidCallback onSaved;

  Future<void> _edit(BuildContext context) async {
    final session = AppScope.read(context).session;
    Map<String, dynamic> d;
    try {
      d = await session.api.get(Api.site('/me/playing'));
    } catch (e) {
      if (context.mounted) toast(context, e);
      return;
    }
    final fields = maps(d['ids']);
    final controllers = {for (final f in fields) text(f['key'])!: TextEditingController(text: text(f['value']) ?? '')};
    if (!context.mounted) return;
    final saved = await showGcSheet<bool>(
      context,
      title: tr('Ігрові ID'),
      subtitle: tr('Видно всім, хто бачить ваш профіль. Порожнє поле — не показувати.'),
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          for (final f in fields)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: GcField(controller: controllers[text(f['key'])]!, label: '${f['label']} · ${f['placeholder']}'),
            ),
          const SizedBox(height: 4),
          PrimaryButton(
            label: tr('Зберегти'),
            onPressed: () async {
              try {
                await session.api.put(Api.site('/me/playing/consoles'), {for (final e in controllers.entries) e.key: e.value.text.trim()});
                if (sheet.mounted) Navigator.of(sheet).pop(true);
              } catch (e) {
                if (sheet.mounted) toast(sheet, e);
              }
            },
          ),
        ]),
      ),
    );
    if (saved == true) onSaved();
  }

  @override
  Widget build(BuildContext context) {
    final ids = maps(platforms['ids']);
    final steam = text(platforms['steam']);
    if (ids.isEmpty && steam == null && !isSelf) return const SizedBox.shrink();
    return Glass(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        CardTitle(tr('Платформи й ігрові ID'), icon: LucideIcons.gamepad2, trailing: isSelf ? tr('Змінити') : null, onTrailing: isSelf ? () => _edit(context) : null),
        const SizedBox(height: 6),
        if (steam != null)
          _row(context, 'Steam', tr('Профіль'), LucideIcons.externalLink, () => launchUrl(Uri.parse(steam), mode: LaunchMode.externalApplication)),
        for (final id in ids)
          _row(context, text(id['label']) ?? '', text(id['value']) ?? '', LucideIcons.copy, () {
            Clipboard.setData(ClipboardData(text: text(id['value']) ?? ''));
            toast(context, tr('Скопійовано: {v}', {'v': text(id['value']) ?? ''}));
          }),
        if (ids.isEmpty && steam == null)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(tr('Додайте PSN, Xbox, Riot ID чи Battle.net — друзям буде легше вас знайти.'), style: body(13, color: muted)),
          ),
      ]),
    );
  }

  Widget _row(BuildContext context, String label, String value, IconData icon, VoidCallback onTap) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(children: [
            SizedBox(width: 110, child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12.5, color: muted))),
            Expanded(child: Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14))),
            Icon(icon, size: 16, color: muted),
          ]),
        ),
      );
}
