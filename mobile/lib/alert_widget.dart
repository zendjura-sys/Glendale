import 'package:home_widget/home_widget.dart';

import 'api.dart';
import 'i18n.dart';
import 'widgets.dart';

/// Віджет «Тривога» на головному екрані Android (AlertWidgetProvider.kt): статус мого місця з UkraineAlarm,
/// колір типу тривоги й скільки вона триває. Оновлюється при відкритті застосунку, кнопкою, раз на 30 хв
/// і одразу, коли приходить пуш про тривогу чи відбій.
class AlertWidget {
  static final androidName = 'online.gamecon.gamecon.AlertWidgetProvider';

  static Future<void> refresh(Api? api) async {
    if (api == null) {
      await _save({'aw_place': 'GameCon', 'aw_status': tr('Увійдіть у застосунок'), 'aw_color': '#8B93B3', 'aw_since': '', 'aw_updated': ''});
      return;
    }
    final data = await api.get(Api.site('/alerts/state'));
    await _save(lines(mapOf(data['prefs']), DateTime.now()));
  }

  /// Рядки віджета з налаштувань тривог (окремо — щоб перевіряти без мережі).
  static Map<String, String> lines(Map<String, dynamic> prefs, DateTime now) {
    final unit = mapOf(prefs['unit']);
    final status = maps(prefs['status']);
    final place = text(unit['name']) ?? (prefs['region'] == null ? tr('Оберіть місце в застосунку') : tr('Уся область'));
    String two(int n) => n.toString().padLeft(2, '0');
    if (status.isEmpty) {
      return {
        'aw_place': place,
        'aw_status': tr('Тривоги немає'),
        'aw_color': '#10B981',
        'aw_since': '',
        'aw_updated': tr('Оновлено {v}:{v2}', {'v': two(now.hour), 'v2': two(now.minute)}),
        'aw_ts': '${now.millisecondsSinceEpoch}',
      };
    }
    final main = status.first;
    final since = DateTime.tryParse('${main['since'] ?? ''}');
    final minutes = since == null ? null : now.difference(since.toLocal()).inMinutes;
    final level = main['level'] == 'yellow' ? ' · ${tr('жовтий рівень')}' : (main['level'] == 'red' ? ' · ${tr('червоний рівень')}' : '');
    return {
      'aw_place': place,
      'aw_status': '${main['name']}$level${status.length > 1 ? ' +${status.length - 1}' : ''}',
      'aw_color': text(main['accent']) ?? '#EF4444',
      'aw_since': minutes == null ? '' : (minutes >= 60 ? tr('Триває {h} год {m} хв', {'h': minutes ~/ 60, 'm': two(minutes % 60)}) : tr('Триває {m} хв', {'m': minutes})),
      'aw_updated': tr('Оновлено {v}:{v2}', {'v': two(now.hour), 'v2': two(now.minute)}),
      'aw_ts': '${now.millisecondsSinceEpoch}',
    };
  }

  static Future<void> _save(Map<String, String> values) async {
    for (final entry in values.entries) {
      await HomeWidget.saveWidgetData<String>(entry.key, entry.value);
    }
    await HomeWidget.updateWidget(qualifiedAndroidName: androidName);
  }
}
