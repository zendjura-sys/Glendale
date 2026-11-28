import 'dart:async';
import 'dart:ffi';
import 'dart:io' show Platform;

import 'package:ffi/ffi.dart';

import '../api.dart';
import '../platform.dart';

typedef _ForegroundNative = Int32 Function(Pointer<Uint16> buf, Int32 cap);
typedef _ForegroundDart = int Function(Pointer<Uint16> buf, int cap);

/// Нативне ядро на Rust (desktop/native, gamecon_native.dll поруч із gamecon.exe): що за гра зараз
/// на весь екран. Раз на 15 с повідомляємо сайт (статус «Граю» друзям, як Discord Rich Presence);
/// гра змінилась чи закрилась — одразу.
class NativeCore {
  NativeCore._(this._foreground);

  final _ForegroundDart _foreground;
  static NativeCore? instance;

  static NativeCore? load() {
    if (!isDesktop || !Platform.isWindows) return null;
    try {
      final lib = DynamicLibrary.open('gamecon_native.dll');
      return instance = NativeCore._(lib.lookupFunction<_ForegroundNative, _ForegroundDart>('gamecon_foreground_game'));
    } catch (_) {
      return null; // Бібліотеки немає (dev-збірка) — програма працює без визначення гри.
    }
  }

  /// Назва вікна гри на весь екран або null.
  String? foregroundGame() {
    final buf = calloc<Uint16>(256);
    try {
      final n = _foreground(buf, 256);
      return n > 0 ? String.fromCharCodes(buf.asTypedList(n)).trim() : null;
    } finally {
      calloc.free(buf);
    }
  }

  Timer? _timer;
  String? _sent;
  int _ticks = 0;

  /// Стежити за грою й повідомляти сайт (лише коли людина увійшла).
  void watch(Api Function() api, bool Function() signedIn) {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (!signedIn()) return;
      final game = foregroundGame();
      _ticks++;
      // Зміна — одразу; та сама гра — продовжуємо статус раз на ~15 с (на сервері він живе 10 хв).
      if (game == _sent && (game == null || _ticks % 5 != 0)) return;
      _sent = game;
      unawaited(api().post('/api/v1/me/playing/pc', {'title': game}).then((_) {}, onError: (_) {}));
    });
  }
}
