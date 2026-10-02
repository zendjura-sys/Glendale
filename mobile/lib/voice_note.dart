import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

/// Готовий запис: файл m4a, тривалість і піки хвилі 0–100 (як зберігає сервер).
class VoiceNote {
  const VoiceNote({required this.path, required this.seconds, required this.waveform});
  final String path;
  final int seconds;
  final List<int> waveform;
}

/// dBFS від мікрофона → рівень 0–100. Тихіше за −60 дБ вважаємо тишею.
int levelOf(double dbfs) {
  if (dbfs.isNaN) return 0;
  return (((dbfs + 60) / 60).clamp(0.0, 1.0) * 100).round();
}

/// Стискає рівні до [count] стовпчиків (максимум у кожному відрізку), щоб хвиля
/// виглядала однаково і для 2-секундного, і для 10-хвилинного запису.
List<int> peaks(List<int> levels, int count) {
  if (levels.length <= count) return List.of(levels);
  final out = <int>[];
  for (var i = 0; i < count; i++) {
    final from = (i * levels.length / count).floor();
    final to = math.max(from + 1, ((i + 1) * levels.length / count).floor());
    out.add(levels.sublist(from, to).reduce(math.max));
  }
  return out;
}

/// Запис голосового з мікрофона з живими рівнями для хвилі під час запису.
class VoiceRecorder extends ChangeNotifier {
  static const limit = Duration(minutes: 10);
  static const bars = 48;

  final _recorder = AudioRecorder();
  final _clock = Stopwatch();
  final levels = <int>[];
  StreamSubscription<Amplitude>? _amplitude;
  Timer? _tick;
  String? _path;

  /// Викликається, коли запис досяг [limit].
  VoidCallback? onLimit;

  bool get active => _path != null;
  Duration get elapsed => _clock.elapsed;

  /// `false`, якщо мікрофон не дозволено.
  Future<bool> start() async {
    if (active) return true;
    if (!await _recorder.hasPermission()) return false;
    final dir = await getTemporaryDirectory();
    final path = '${dir.path}/voice-${DateTime.now().millisecondsSinceEpoch}.m4a';
    await _recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc, bitRate: 48000, sampleRate: 44100, numChannels: 1), path: path);
    _path = path;
    levels.clear();
    _clock
      ..reset()
      ..start();
    _amplitude = _recorder.onAmplitudeChanged(const Duration(milliseconds: 80)).listen((amp) {
      levels.add(levelOf(amp.current));
      notifyListeners();
    });
    _tick = Timer.periodic(const Duration(milliseconds: 250), (_) {
      if (elapsed >= limit) onLimit?.call();
      notifyListeners();
    });
    notifyListeners();
    return true;
  }

  Future<VoiceNote?> finish() async {
    if (!active) return null;
    final seconds = (elapsed.inMilliseconds / 1000).round().clamp(1, limit.inSeconds);
    final waveform = peaks(levels, bars);
    final started = _path;
    _reset();
    final path = await _recorder.stop() ?? started;
    return path == null ? null : VoiceNote(path: path, seconds: seconds, waveform: waveform);
  }

  /// Зупиняє й видаляє запис.
  Future<void> cancel() async {
    if (!active) return;
    _reset();
    await _recorder.cancel();
  }

  void _reset() {
    _amplitude?.cancel();
    _amplitude = null;
    _tick?.cancel();
    _tick = null;
    _clock.stop();
    _path = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _amplitude?.cancel();
    _tick?.cancel();
    unawaited(_recorder.dispose());
    super.dispose();
  }
}
