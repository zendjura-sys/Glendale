import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/voice_note.dart';

void main() {
  test('рівень мікрофона переводиться в 0–100', () {
    expect(levelOf(0), 100);
    expect(levelOf(-30), 50);
    expect(levelOf(-60), 0);
    expect(levelOf(-160), 0);
    expect(levelOf(double.nan), 0);
  });

  test('хвиля стискається до потрібної кількості стовпчиків через максимум', () {
    expect(peaks([1, 2, 3], 48), [1, 2, 3]);
    final long = List<int>.generate(1000, (i) => i % 100);
    final squeezed = peaks(long, VoiceRecorder.bars);
    expect(squeezed, hasLength(VoiceRecorder.bars));
    expect(squeezed.every((v) => v >= 0 && v <= 100), isTrue);
    expect(peaks([0, 0, 90, 0, 10, 0], 3), [0, 90, 10]);
    // Сервер приймає voice_waveform до 1000 символів.
    expect(jsonEncode(peaks(List.filled(7500, 100), VoiceRecorder.bars)).length, lessThan(1000));
  });
}
