import 'dart:async';

import 'package:flutter/material.dart';
import 'package:home_widget/home_widget.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';
import 'i18n.dart';

/// Віджет «Моя сім’я» на головному екрані Android.
///
/// - Дані: `/api/v1/me/family-widget` (той самий розрахунок, що й огляд сім’ї на сайті).
/// - Що показувати й яку сім’ю — обирає людина в Налаштуваннях → Застосунок → «Віджет».
/// - Оновлення: при відкритті застосунку, кнопкою на віджеті й раз на 30 хв у фоні (FamilyWidgetProvider.kt).
///
/// Нові розділи, що стосуються сім’ї чи грошей, варто додавати сюди як ще один блок на вибір.
class FamilyWidget {
  static final androidName = 'online.gamecon.gamecon.FamilyWidgetProvider';
  static final _familyKey = 'widget.family';
  static final _blocksKey = 'widget.blocks';

  /// Блоки віджета: ключ → назва в налаштуваннях.
  static final blocks = {
    'balance': tr('Мій рахунок у сім’ї'),
    'week': tr('Заробіток за тиждень'),
    'place': tr('Місце в рейтингу'),
    'bizwar': tr('Бізвари за тиждень'),
    'event': tr('Найближча подія'),
    'treasury': tr('Казна сім’ї (для скарбників)'),
    'warns': tr('Попередження'),
  };
  static const defaultBlocks = ['balance', 'week', 'place', 'bizwar', 'event'];

  static List<String> chosenBlocks(SharedPreferences prefs) => prefs.getStringList(_blocksKey) ?? defaultBlocks;
  static String? chosenFamily(SharedPreferences prefs) => prefs.getString(_familyKey);

  static Future<void> choose(SharedPreferences prefs, {String? family, List<String>? show}) async {
    if (family != null) await prefs.setString(_familyKey, family);
    if (show != null) await prefs.setStringList(_blocksKey, show);
  }

  /// Завантажує статистику й перемальовує віджет. Без входу — порожній віджет із підказкою.
  static Future<List<Map<String, dynamic>>> refresh(Api? api, SharedPreferences prefs) async {
    if (api == null) {
      await _save({'fw_title': 'GameCon', 'fw_rank': tr('Увійдіть у застосунок, щоб бачити свою сім’ю'), 'fw_slug': ''});
      return const [];
    }
    final data = await api.get('/api/v1/me/family-widget');
    final families = maps(data['families']);
    await render(families, prefs);
    return families;
  }

  static Future<void> render(List<Map<String, dynamic>> families, SharedPreferences prefs) async {
    if (families.isEmpty) {
      await _save({
        'fw_title': tr('Моя сім’я'),
        'fw_rank': tr('Ви ще не в сім’ї — оберіть її в розділі «Сім’ї»'),
        'fw_slug': '',
        'fw_balance': '',
        'fw_week': '',
        'fw_place': '',
        'fw_bizwar': '',
        'fw_event': '',
      });
      return;
    }
    final slug = chosenFamily(prefs);
    final w = families.firstWhere((f) => text(mapOf(f['family'])['slug']) == slug, orElse: () => families.first);
    final show = chosenBlocks(prefs).toSet();
    final family = mapOf(w['family']);
    final member = mapOf(w['member']);
    final rating = mapOf(w['rating']);
    final event = mapOf(w['next_event']);
    final treasury = w['treasury'];
    final warns = intOf(w['warns']);

    final balanceText = show.contains('balance')
        ? hryvnia(w['balance'])
        : (show.contains('treasury') && treasury != null ? hryvnia(treasury) : '');
    final balanceLabel = show.contains('balance') ? tr('Ваш рахунок у сім’ї') : tr('Казна сім’ї');

    String eventLine() {
      if (!show.contains('event') || event.isEmpty) return '';
      final at = DateTime.tryParse(text(event['starts_at']) ?? '')?.toLocal();
      final when = at == null ? '' : ' · ${at.day.toString().padLeft(2, '0')}.${at.month.toString().padLeft(2, '0')} ${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}';
      return '📅 ${text(event['title']) ?? ''}$when';
    }

    final extras = [
      if (show.contains('treasury') && show.contains('balance') && treasury != null) tr('Казна {v}', {'v': hryvnia(treasury)}),
      if (show.contains('warns') && warns > 0) '⚠ $warns/${intOf(w['warn_limit'], 3)}',
    ];
    final now = DateTime.now();

    await _save({
      'fw_title': '[${text(family['tag']) ?? ''}] ${text(family['name']) ?? ''}',
      'fw_rank': '${text(member['display']) ?? ''} · ${text(member['rank_title']) ?? 'ранг ${member['rank']}'}',
      'fw_slug': text(family['slug']) ?? '',
      'fw_balance': balanceText,
      'fw_balance_label': balanceLabel,
      'fw_week': show.contains('week') ? tr('Тиждень\n+{v}', {'v': hryvniaShort(w['week_earned'])}) : '',
      'fw_place': show.contains('place') && rating['place'] != null ? tr('Місце\n{v} з {v2}', {'v': rating['place'], 'v2': rating['of']}) : '',
      'fw_bizwar': show.contains('bizwar') ? tr('Бізвари\n{v}–{v2}', {'v': intOf(rating['bizwar_wins']), 'v2': intOf(rating['bizwar_losses'])}) : '',
      'fw_event': [eventLine(), ...extras].where((s) => s.isNotEmpty).join('   '),
      'fw_updated': tr('Оновлено {v}:{v2}', {'v': now.hour.toString().padLeft(2, '0'), 'v2': now.minute.toString().padLeft(2, '0')}),
      'fw_ts': '${now.millisecondsSinceEpoch}',
    });
  }

  static Future<void> _save(Map<String, String> values) async {
    for (final entry in values.entries) {
      await HomeWidget.saveWidgetData<String>(entry.key, entry.value);
    }
    await HomeWidget.updateWidget(qualifiedAndroidName: androidName);
  }

  /// Натискання на віджет: gamecon://widget/family/{slug} → екран сім’ї в застосунку.
  static String? routeFor(Uri? uri) {
    if (uri == null || uri.host != 'widget') return null;
    final parts = uri.pathSegments;
    if (parts.length >= 2 && parts.first == 'family') return '/families/${parts[1]}';
    if (parts.isNotEmpty && parts.first == 'families') return '/families';
    return null;
  }
}

/// Кнопка «Оновити» й планове оновлення: працює у фоні без відкриття застосунку.
@pragma('vm:entry-point')
Future<void> familyWidgetBackground(Uri? uri) async {
  if (uri?.host != 'widget') return;
  final prefs = await SharedPreferences.getInstance();
  await prefs.reload();
  final token = prefs.getString('token');
  try {
    await FamilyWidget.refresh(token == null ? null : Api(() => token), prefs);
  } catch (_) {}
}

/// Налаштування віджета: яку сім’ю показувати й які блоки.
class FamilyWidgetSettings extends StatefulWidget {
  const FamilyWidgetSettings({super.key});

  @override
  State<FamilyWidgetSettings> createState() => _FamilyWidgetSettingsState();
}

class _FamilyWidgetSettingsState extends State<FamilyWidgetSettings> {
  List<Map<String, dynamic>> families = const [];
  bool loading = true;

  Session get session => AppScope.read(context).session;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final list = await FamilyWidget.refresh(session.api, session.prefs);
      if (mounted) setState(() => families = list);
    } catch (_) {
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _apply({String? family, List<String>? show}) async {
    await FamilyWidget.choose(session.prefs, family: family, show: show);
    setState(() {});
    await FamilyWidget.render(families, session.prefs);
  }

  @override
  Widget build(BuildContext context) {
    final prefs = session.prefs;
    final chosen = FamilyWidget.chosenBlocks(prefs);
    final selectedFamily = FamilyWidget.chosenFamily(prefs) ?? text(mapOf(families.firstOrNull?['family'])['slug']);

    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CardTitle(tr('Віджет «Моя сім’я»'), icon: LucideIcons.layoutGrid),
        const SizedBox(height: 6),
        Text(
          tr('Додайте віджет GameCon на головний екран телефона (довге натискання на екран → Віджети). Тут оберіть, що на ньому показувати.'),
          style: body(13, color: muted),
        ),
        if (loading) const Padding(padding: EdgeInsets.all(12), child: Center(child: CircularProgressIndicator(strokeWidth: 2.4))),
        if (!loading && families.length > 1) ...[
          const SizedBox(height: 12),
          Text(tr('Сім’я'), style: body(12.5, color: muted, weight: FontWeight.w700)),
          RadioGroup<String>(
            groupValue: selectedFamily,
            onChanged: (slug) => _apply(family: slug),
            child: Column(children: [
              for (final f in families)
                RadioListTile<String>(
                  contentPadding: EdgeInsets.zero,
                  value: text(mapOf(f['family'])['slug']) ?? '',
                  title: Text('[${mapOf(f['family'])['tag']}] ${mapOf(f['family'])['name']}', style: body(14.5)),
                ),
            ]),
          ),
        ],
        const SizedBox(height: 12),
        Text(tr('Що показувати'), style: body(12.5, color: muted, weight: FontWeight.w700)),
        for (final entry in FamilyWidget.blocks.entries)
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            value: chosen.contains(entry.key),
            onChanged: (on) => _apply(show: on == true ? [...chosen, entry.key] : chosen.where((k) => k != entry.key).toList()),
            title: Text(entry.value, style: body(14.5)),
          ),
        const SizedBox(height: 4),
        GhostButton(label: tr('Оновити віджет'), icon: LucideIcons.refreshCw, onPressed: () {
          setState(() => loading = true);
          unawaited(_load());
        }),
      ]),
    );
  }
}
