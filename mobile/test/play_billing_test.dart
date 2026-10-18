import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/play_billing.dart';

void main() {
  test('період Google Play у зрозумілому вигляді', () {
    expect(playPeriod('P1M'), 'місяць');
    expect(playPeriod('P1Y'), 'рік');
    expect(playPeriod('P1W'), 'тиждень');
    expect(playPeriod('P3M'), '3 міс.');
    expect(playPeriod('P7D'), '7 дн.');
    expect(playPeriod('weird'), 'weird');
  });

  test('покупка доступна лише в Android-збірці', () {
    // Тести запускаються не на Android.
    expect(PlayBilling.supported, isFalse);
  });
}
