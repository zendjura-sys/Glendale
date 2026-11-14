import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/pulse_widget.dart';

void main() {
  test('пульс: лічильники, хто грає, завдання й сезон', () {
    final lines = PulseWidget.lines({
      'name': 'Катерина',
      'messages': 3,
      'notifications': 12,
      'friend_requests': 2,
      'friends_online': 4,
      'playing': [
        {'name': 'Тарас', 'label': 'GTA V'},
        {'name': 'Ірина', 'label': 'CS2'},
      ],
      'quests': {'done': 2, 'total': 3},
      'season': {'level': 5, 'max': 30},
    }, DateTime(2026, 10, 23, 9, 5));
    expect(lines['pw_title'], 'Привіт, Катерина');
    expect(lines['pw_messages'], '3');
    expect(lines['pw_friends_label'], 'Онлайн · +2');
    expect(lines['pw_playing'], '🎮 Тарас — GTA V, Ірина — CS2');
    expect(lines['pw_progress'], 'Завдання дня 2/3 · Сезон: рівень 5/30');
    expect(lines['pw_updated'], 'Оновлено 09:05');
  });

  test('віджет відкриває розділи застосунку', () {
    expect(PulseWidget.routeFor(Uri.parse('gamecon://widget/messages')), '/messages');
    expect(PulseWidget.routeFor(Uri.parse('gamecon://widget/friends')), '/friends?tab=online');
    expect(PulseWidget.routeFor(Uri.parse('gamecon://widget/family/abc')), null);
  });
}
