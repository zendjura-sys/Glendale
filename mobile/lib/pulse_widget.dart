import 'package:home_widget/home_widget.dart';

import 'api.dart';
import 'i18n.dart';
import 'widgets.dart';

/// Віджет «Пульс GameCon» на головному екрані Android (PulseWidgetProvider.kt).
///
/// - Дані: `/api/v1/me/pulse-widget` — непрочитане, друзі онлайн і в що грають, завдання дня, сезон.
/// - Оновлення: при відкритті застосунку, кнопкою на віджеті й раз на 30 хв у фоні.
/// - Натискання відкриває розділ: gamecon://widget/messages|notifications|friends|quests|feed.
class PulseWidget {
  static final androidName = 'online.gamecon.gamecon.PulseWidgetProvider';

  static Future<void> refresh(Api? api) async {
    if (api == null) {
      await _save({'pw_title': 'GameCon', 'pw_playing': tr('Увійдіть у застосунок, щоб бачити друзів і чати'), 'pw_progress': ''});
      return;
    }
    await render(await api.get('/api/v1/me/pulse-widget'));
  }

  /// Рядки віджета з відповіді сервера (окремо — щоб перевіряти без мережі).
  static Map<String, String> lines(Map<String, dynamic> data, DateTime now) {
    final playing = maps(data['playing']);
    final quests = data['quests'] is Map ? mapOf(data['quests']) : null;
    final season = data['season'] is Map ? mapOf(data['season']) : null;
    final online = intOf(data['friends_online']);
    final requests = intOf(data['friend_requests']);
    return {
      'pw_title': tr('Привіт, {name}', {'name': text(data['name']) ?? 'GameCon'}),
      'pw_messages': '${intOf(data['messages'])}',
      'pw_messages_label': tr('Чати'),
      'pw_notifications': '${intOf(data['notifications'])}',
      'pw_notifications_label': tr('Сповіщення'),
      'pw_friends': '$online',
      'pw_friends_label': requests > 0 ? tr('Онлайн · +{n}', {'n': requests}) : tr('Друзі онлайн'),
      'pw_playing': playing.isEmpty
          ? (online > 0 ? '' : tr('Друзів онлайн поки немає'))
          : '🎮 ${playing.map((p) => '${text(p['name']) ?? ''} — ${text(p['label']) ?? ''}').join(', ')}',
      'pw_progress': [
        if (quests != null) tr('Завдання дня {done}/{total}', {'done': intOf(quests['done']), 'total': intOf(quests['total'])}),
        if (season != null) tr('Сезон: рівень {n}/{max}', {'n': intOf(season['level']), 'max': intOf(season['max'])}),
      ].join(' · '),
      'pw_updated': tr('Оновлено {v}:{v2}', {'v': now.hour.toString().padLeft(2, '0'), 'v2': now.minute.toString().padLeft(2, '0')}),
      'pw_ts': '${now.millisecondsSinceEpoch}',
    };
  }

  static Future<void> render(Map<String, dynamic> data) => _save(lines(data, DateTime.now()));

  static Future<void> _save(Map<String, String> values) async {
    for (final entry in values.entries) {
      await HomeWidget.saveWidgetData<String>(entry.key, entry.value);
    }
    await HomeWidget.updateWidget(qualifiedAndroidName: androidName);
  }

  /// Натискання на віджет → екран застосунку.
  static String? routeFor(Uri? uri) {
    if (uri == null || uri.host != 'widget' || uri.pathSegments.isEmpty) return null;
    return switch (uri.pathSegments.first) {
      'messages' => '/messages',
      'notifications' => '/notifications',
      'friends' => '/friends?tab=online',
      'quests' => '/quests',
      'feed' => '/feed',
      _ => null,
    };
  }
}
