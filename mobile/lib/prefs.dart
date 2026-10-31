import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// «Сповіщення, тихі години й стрічка» — ті самі налаштування, що на сайті (settings/appearance і
// перемикачі settings/*): які сповіщення надсилати, тихі години, звук, близькі друзі, заглушені
// слова, спойлери, святкові прикраси, режим стрімера, економія трафіку, приховування мату.

class NotifyPrefsScreen extends StatefulWidget {
  const NotifyPrefsScreen({super.key});

  @override
  State<NotifyPrefsScreen> createState() => _NotifyPrefsScreenState();
}

class _NotifyPrefsScreenState extends State<NotifyPrefsScreen> {
  Map<String, dynamic>? base;
  Map<String, bool> notify = {};
  bool quiet = false;
  String quietFrom = '23:00', quietTo = '08:00';
  Set<int> close = {};
  List<String> words = [];
  bool hideSpoilers = false, seasonal = true, showVisitors = false;
  bool saving = false;
  final word = TextEditingController();

  Api get api => AppScope.read(context).session.api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    word.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final d = await api.get(Api.site('/settings/appearance'));
      if (!mounted) return;
      final q = mapOf(d['quiet']);
      setState(() {
        base = d;
        notify = {for (final e in mapOf(d['notify']).entries) e.key: e.value == true};
        quiet = q['enabled'] == true;
        quietFrom = text(q['from']) ?? '23:00';
        quietTo = text(q['to']) ?? '08:00';
        close = {for (final id in (d['closeFriends'] as List? ?? const [])) intOf(id)};
        words = [for (final w in (d['muteWords'] as List? ?? const [])) '$w'];
        hideSpoilers = d['hideSpoilers'] == true;
        seasonal = d['seasonal'] != false;
        showVisitors = d['show_visitors'] == true;
      });
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _save() async {
    final d = base!;
    setState(() => saving = true);
    await attempt(
      context,
      () => api.put(Api.site('/settings/appearance'), {
        // Обов’язкові поля форми сайту — як є, міняємо лише своє.
        'palette': text(d['palette']) ?? 'default',
        'languages': d['languages'] ?? const [],
        'looking_for_group': d['looking_for_group'] == true,
        'quiet_enabled': quiet,
        'quiet_from': quietFrom,
        'quiet_to': quietTo,
        'notify': notify,
        'close_friends': close.toList(),
        'mute_words': words,
        'hide_spoilers': hideSpoilers,
        'seasonal': seasonal,
        'show_visitors': showVisitors,
      }),
      success: tr('Збережено.'),
    );
    if (!mounted) return;
    setState(() => saving = false);
    await AppScope.read(context).session.refreshMe();
  }

  Future<void> _instant(String path, Map<String, dynamic> body) async {
    final session = AppScope.read(context).session;
    if (await attempt(context, () => path.endsWith('profanity') ? api.put(Api.site(path), body) : api.patch(Api.site(path), body))) await session.refreshMe();
  }

  Future<void> _pickTime(bool from) async {
    final parts = (from ? quietFrom : quietTo).split(':');
    final picked = await showTimePicker(context: context, initialTime: TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1])));
    if (picked == null) return;
    final value = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
    setState(() => from ? quietFrom = value : quietTo = value);
  }

  @override
  Widget build(BuildContext context) {
    final d = base;
    if (d == null) return const ScreenScroll(children: [SizedBox(height: 200, child: Center(child: CircularProgressIndicator()))]);
    final session = AppScope.of(context).session;
    final prefs = mapOf(session.me?['prefs']);
    final labels = {
      'likes': tr('Вподобання'),
      'comments': tr('Коментарі'),
      'mentions': tr('Згадки'),
      'events': tr('Події й турніри'),
      'playing': tr('Друзі почали грати'),
      'push': tr('Push на телефон'),
      'email': tr('Листи на пошту'),
    };
    final sounds = {'off': tr('Без звуку'), 'soft': tr('М’який'), 'pixel': tr('Піксель'), 'arcade': tr('Аркада'), 'drop': tr('Крапля')};
    final friends = maps(d['friends']);
    Widget toggle(String title, bool value, ValueChanged<bool> onChanged, {String? subtitle}) => SwitchListTile(
      contentPadding: EdgeInsets.zero,
      value: value,
      title: Text(title, style: body(14.5, weight: FontWeight.w600)),
      subtitle: subtitle == null ? null : Text(subtitle, style: body(12.5, color: muted)),
      onChanged: onChanged,
    );
    return ScreenScroll(children: [
      PageTitle(tr('Сповіщення й стрічка'), subtitle: tr('Що надсилати, коли мовчати й що ховати в стрічці.')),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          CardTitle(tr('Сповіщення'), icon: LucideIcons.bell),
          for (final key in labels.keys.where(notify.containsKey)) toggle(labels[key]!, notify[key]!, (v) => setState(() => notify[key] = v)),
          const SizedBox(height: 6),
          Text(tr('Звук сповіщень'), style: body(13, color: muted)),
          const SizedBox(height: 6),
          Segmented(
            scroll: true,
            options: [for (final e in sounds.entries) SegmentOption(e.key, e.value)],
            selected: text(prefs['notify_sound']) ?? 'soft',
            onSelect: (v) => _instant('/settings/notify-sound', {'notify_sound': v}),
          ),
        ]),
      ),
      const SizedBox(height: 12),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          CardTitle(tr('Тихі години'), icon: LucideIcons.moon),
          toggle(tr('Не турбувати вночі'), quiet, (v) => setState(() => quiet = v), subtitle: tr('Сповіщення приходять беззвучно.')),
          if (quiet)
            Row(children: [
              Expanded(child: GhostButton(label: tr('з {t}', {'t': quietFrom}), compact: true, onPressed: () => _pickTime(true))),
              const SizedBox(width: 8),
              Expanded(child: GhostButton(label: tr('до {t}', {'t': quietTo}), compact: true, onPressed: () => _pickTime(false))),
            ]),
        ]),
      ),
      const SizedBox(height: 12),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          CardTitle(tr('Стрічка'), icon: LucideIcons.newspaper),
          toggle(tr('Ховати спойлери'), hideSpoilers, (v) => setState(() => hideSpoilers = v)),
          toggle(tr('Святкові прикраси'), seasonal, (v) => setState(() => seasonal = v), subtitle: tr('Сніг, кажани, вогники — до свят.')),
          toggle(tr('Приховувати мат зірочками'), prefs['hide_profanity'] == true, (v) => _instant('/settings/account/profanity', {'hide': v})),
          const SizedBox(height: 6),
          Text(tr('Заглушені слова — записи з ними не показуються'), style: body(13, color: muted)),
          const SizedBox(height: 6),
          Row(children: [
            Expanded(child: GcField(controller: word, label: tr('Слово чи фраза'), dense: true)),
            IconButton(
              tooltip: tr('Додати'),
              icon: Icon(LucideIcons.plus, color: accent),
              onPressed: () {
                final w = word.text.trim();
                if (w.isEmpty || words.contains(w) || words.length >= 20) return;
                setState(() => words.add(w));
                word.clear();
              },
            ),
          ]),
          Wrap(spacing: 6, runSpacing: 6, children: [for (final w in words) InputChip(label: Text(w, style: body(13)), onDeleted: () => setState(() => words.remove(w)))]),
        ]),
      ),
      if (friends.isNotEmpty) ...[
        const SizedBox(height: 12),
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CardTitle(tr('Близькі друзі'), icon: LucideIcons.heart),
            Text(tr('Історії «для близьких» бачитимуть лише вони.'), style: body(12.5, color: muted)),
            const SizedBox(height: 8),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final f in friends)
                SelectPill(
                  label: text(f['name']) ?? '',
                  selected: close.contains(intOf(f['id'])),
                  onTap: () => setState(() => close.contains(intOf(f['id'])) ? close.remove(intOf(f['id'])) : close.add(intOf(f['id']))),
                ),
            ]),
          ]),
        ),
      ],
      const SizedBox(height: 12),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          CardTitle(tr('Режими'), icon: LucideIcons.sparkles),
          toggle(tr('Режим стрімера'), prefs['streamer_mode'] == true, (v) => _instant('/settings/streamer-mode', {'streamer_mode': v}), subtitle: tr('Ховає пошту, номер і особисте під час трансляції.')),
          toggle(tr('Економія трафіку'), prefs['data_saver'] == true, (v) => _instant('/settings/data-saver', {'data_saver': v}), subtitle: tr('Легші картинки й без автовідтворення.')),
          if (d.containsKey('show_visitors')) toggle(tr('Показувати гостей профілю'), showVisitors, (v) => setState(() => showVisitors = v)),
        ]),
      ),
      const SizedBox(height: 12),
      PrimaryButton(label: tr('Зберегти'), icon: LucideIcons.check, busy: saving, onPressed: _save),
    ]);
  }
}
