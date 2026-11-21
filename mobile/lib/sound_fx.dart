// ignore_for_file: experimental_member_use
import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/services.dart';
import 'package:just_audio/just_audio.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Звуки інтерфейсу без файлів: PCM синтезується в пам'яті (як Web Audio на сайті).
// Окремий плеєр не бере аудіофокус — фонова музика не переривається (змішування).
// Вимикається в налаштуваннях («Звуки інтерфейсу»), ключ ui_sounds.

class GcSoundEngine {
  GcSoundEngine._();
  static final instance = GcSoundEngine._();

  static const _rate = 44100;
  AudioPlayer? _player;
  bool enabled = true;
  bool _chimed = false;
  Uint8List? _tick;
  Uint8List? _chime;

  Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      enabled = prefs.getBool('ui_sounds') ?? true;
    } catch (_) {}
  }

  Future<void> setEnabled(bool value) async {
    enabled = value;
    try {
      (await SharedPreferences.getInstance()).setBool('ui_sounds', value);
    } catch (_) {}
  }

  /// Тактильний «клац» при зміні вкладки доку: 16 мс, 300 → 170 Гц, гучність 0.02.
  void navTick() {
    unawaited(HapticFeedback.selectionClick());
    if (!enabled) return;
    _tick ??= _wav(_render(0.016, (t, d) => _sweep(t, d, 300, 170) * 0.02 * (1 - t / d)));
    unawaited(_play(_tick!));
  }

  /// Оксамитовий акорд запуску (раз за запуск): C5 + G5 → C6 через 110 мс, пік 0.055, згасання 600 мс.
  void bootChime() {
    if (!enabled || _chimed) return;
    _chimed = true;
    _chime ??= _wav(_render(0.6, (t, d) {
      final env = t < 0.012 ? t / 0.012 : math.exp(-(t - 0.012) * 7.5);
      final c5 = math.sin(2 * math.pi * 523.25 * t);
      final g5 = math.sin(2 * math.pi * (t < 0.11 ? 783.99 : 1046.50) * t);
      return (c5 * 0.6 + g5 * 0.4) * 0.055 * env;
    }));
    unawaited(_play(_chime!));
  }

  static double _phase = 0;
  static double _sweep(double t, double d, double from, double to) {
    final f = from + (to - from) * (t / d);
    _phase += 2 * math.pi * f / _rate;
    return math.sin(_phase);
  }

  static Float64List _render(double seconds, double Function(double t, double d) sample) {
    _phase = 0;
    final n = (seconds * _rate).round();
    final out = Float64List(n);
    for (var i = 0; i < n; i++) {
      out[i] = sample(i / _rate, seconds);
    }
    return out;
  }

  /// 16-бітний моно WAV.
  static Uint8List _wav(Float64List samples) {
    final data = ByteData(44 + samples.length * 2);
    void str(int at, String s) {
      for (var i = 0; i < s.length; i++) {
        data.setUint8(at + i, s.codeUnitAt(i));
      }
    }

    str(0, 'RIFF');
    data.setUint32(4, 36 + samples.length * 2, Endian.little);
    str(8, 'WAVE');
    str(12, 'fmt ');
    data.setUint32(16, 16, Endian.little);
    data.setUint16(20, 1, Endian.little);
    data.setUint16(22, 1, Endian.little);
    data.setUint32(24, _rate, Endian.little);
    data.setUint32(28, _rate * 2, Endian.little);
    data.setUint16(32, 2, Endian.little);
    data.setUint16(34, 16, Endian.little);
    str(36, 'data');
    data.setUint32(40, samples.length * 2, Endian.little);
    for (var i = 0; i < samples.length; i++) {
      data.setInt16(44 + i * 2, (samples[i].clamp(-1, 1) * 32767).round(), Endian.little);
    }
    return data.buffer.asUint8List();
  }

  Future<void> _play(Uint8List wav) async {
    try {
      // Без керування аудіосесією: звук змішується з музикою й не забирає фокус.
      final player = _player ??= AudioPlayer(handleInterruptions: false, handleAudioSessionActivation: false);
      await player.setAudioSource(_MemorySource(wav));
      await player.seek(Duration.zero);
      await player.play();
    } catch (_) {}
  }
}

class _MemorySource extends StreamAudioSource {
  _MemorySource(this.bytes);
  final Uint8List bytes;

  @override
  Future<StreamAudioResponse> request([int? start, int? end]) async {
    start ??= 0;
    end ??= bytes.length;
    return StreamAudioResponse(
      sourceLength: bytes.length,
      contentLength: end - start,
      offset: start,
      stream: Stream.value(bytes.sublist(start, end)),
      contentType: 'audio/wav',
    );
  }
}
