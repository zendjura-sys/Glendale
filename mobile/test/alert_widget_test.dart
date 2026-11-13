import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/alert_widget.dart';

void main() {
  final now = DateTime(2026, 11, 13, 14, 5);

  test('без тривоги — зелений «Тривоги немає»', () {
    final lines = AlertWidget.lines({'region': 'zhytomyr', 'unit': {'name': 'м. Житомир'}, 'status': []}, now);
    expect(lines['aw_place'], 'м. Житомир');
    expect(lines['aw_status'], 'Тривоги немає');
    expect(lines['aw_color'], '#10B981');
    expect(lines['aw_updated'], 'Оновлено 14:05');
  });

  test('тривога — назва, рівень, колір і тривалість', () {
    final lines = AlertWidget.lines({
      'region': 'zhytomyr',
      'unit': null,
      'status': [
        {'name': 'Повітряна тривога', 'level': 'yellow', 'accent': '#F59E0B', 'since': now.subtract(const Duration(minutes: 75)).toIso8601String()},
        {'name': 'Загроза артобстрілу', 'accent': '#F97316'},
      ],
    }, now);
    expect(lines['aw_place'], 'Уся область');
    expect(lines['aw_status'], 'Повітряна тривога · жовтий рівень +1');
    expect(lines['aw_color'], '#F59E0B');
    expect(lines['aw_since'], 'Триває 1 год 15 хв');
  });
}
