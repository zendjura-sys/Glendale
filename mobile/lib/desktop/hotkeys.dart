import 'dart:async';

import 'package:flutter/services.dart';
import 'package:hotkey_manager/hotkey_manager.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../platform.dart';
import '../voice_room.dart';

/// Глобальні гарячі клавіші ПК-версії (діють і в грі, коли GameCon у фоні):
/// - Ctrl+Shift+M — вимкнути/увімкнути мікрофон у голосовій кімнаті чи GameCast;
/// - F9 (утримувати) — «натисни й говори» (push-to-talk), якщо ввімкнено в налаштуваннях;
/// - Ctrl+Shift+G — показати GameCon.
class DesktopHotkeys {
  static const pttKey = 'desktop_ptt';

  static Future<void> init({required Future<void> Function() show}) async {
    if (!isDesktop) return;
    try {
      await hotKeyManager.unregisterAll();
      await hotKeyManager.register(
        HotKey(key: PhysicalKeyboardKey.keyM, modifiers: [HotKeyModifier.control, HotKeyModifier.shift]),
        keyDownHandler: (_) => VoiceCall.instance.toggleMic(),
      );
      await hotKeyManager.register(
        HotKey(key: PhysicalKeyboardKey.keyG, modifiers: [HotKeyModifier.control, HotKeyModifier.shift]),
        keyDownHandler: (_) => unawaited(show()),
      );
      await setPushToTalk((await SharedPreferences.getInstance()).getBool(pttKey) ?? false);
    } catch (_) {
      // Система не дала зареєструвати клавіші (зайняті іншою програмою) — GameCon працює без них.
    }
  }

  static final _ptt = HotKey(identifier: 'gamecon-ptt', key: PhysicalKeyboardKey.f9);

  /// «Натисни й говори»: мікрофон увімкнений лише поки затиснуто F9.
  static Future<void> setPushToTalk(bool on) async {
    if (!isDesktop) return;
    (await SharedPreferences.getInstance()).setBool(pttKey, on).ignore();
    try {
      await hotKeyManager.unregister(_ptt);
    } catch (_) {}
    if (!on) return;
    await hotKeyManager.register(
      _ptt,
      keyDownHandler: (_) => unawaited(VoiceCall.instance.pushToTalk(true)),
      keyUpHandler: (_) => unawaited(VoiceCall.instance.pushToTalk(false)),
    );
  }
}
