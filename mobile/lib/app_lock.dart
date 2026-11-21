import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'developer.dart' show sha1;
import 'i18n.dart';
import 'theme.dart';
import 'widgets.dart';

/// Блокування застосунку PIN-кодом і біометрією. Усе зберігається лише на телефоні:
/// PIN — як солений SHA-1, після 5 помилок — пауза 30 с.
class AppLock {
  static const _channel = MethodChannel('gamecon/app');
  static const enabledKey = 'lock_enabled';
  static const _hashKey = 'lock_pin_hash';
  static const _saltKey = 'lock_pin_salt';
  static const bioKey = 'lock_bio';
  static const timeoutKey = 'lock_timeout';

  /// Через скільки секунд у фоні просити PIN знову.
  static const timeouts = [0, 60, 300, 900];

  static String _hash(String pin, String salt) => sha1(utf8.encode('$salt:$pin')).map((b) => b.toRadixString(16).padLeft(2, '0')).join();

  static Future<void> setPin(SharedPreferences prefs, String pin) async {
    final rnd = Random.secure();
    final salt = List.generate(16, (_) => rnd.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
    await prefs.setString(_saltKey, salt);
    await prefs.setString(_hashKey, _hash(pin, salt));
    await prefs.setBool(enabledKey, true);
  }

  static bool check(SharedPreferences prefs, String pin) {
    final salt = prefs.getString(_saltKey);
    final hash = prefs.getString(_hashKey);
    return salt != null && hash != null && _hash(pin, salt) == hash;
  }

  static Future<void> disable(SharedPreferences prefs) async {
    await prefs.remove(_hashKey);
    await prefs.remove(_saltKey);
    await prefs.setBool(enabledKey, false);
  }

  static bool enabled(SharedPreferences prefs) => prefs.getBool(enabledKey) == true && prefs.getString(_hashKey) != null;

  static Future<bool> biometricAvailable() async {
    try {
      return await _channel.invokeMethod<bool>('biometricAvailable') ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> biometric() async {
    try {
      return await _channel.invokeMethod<bool>('biometricAuth', {'title': tr('Розблокувати GameCon'), 'cancel': tr('Ввести PIN')}) ?? false;
    } catch (_) {
      return false;
    }
  }
}

/// Обгортка над застосунком: показує екран PIN при запуску й після повернення з фону (за налаштуванням).
class AppLockGate extends StatefulWidget {
  const AppLockGate({required this.child, super.key});
  final Widget child;

  @override
  State<AppLockGate> createState() => _AppLockGateState();
}

class _AppLockGateState extends State<AppLockGate> with WidgetsBindingObserver {
  SharedPreferences? prefs;
  bool locked = false;
  DateTime? pausedAt;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    SharedPreferences.getInstance().then((p) {
      if (!mounted) return;
      setState(() {
        prefs = p;
        locked = AppLock.enabled(p);
      });
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final p = prefs;
    if (p == null || !AppLock.enabled(p)) return;
    if (state == AppLifecycleState.paused || state == AppLifecycleState.hidden) {
      pausedAt ??= DateTime.now();
    } else if (state == AppLifecycleState.resumed) {
      final away = pausedAt == null ? 0 : DateTime.now().difference(pausedAt!).inSeconds;
      pausedAt = null;
      if (!locked && away >= (p.getInt(AppLock.timeoutKey) ?? 60)) setState(() => locked = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(children: [
      widget.child,
      if (locked && prefs != null) Positioned.fill(child: LockScreen(prefs: prefs!, onUnlock: () => setState(() => locked = false))),
    ]);
  }
}

class LockScreen extends StatefulWidget {
  const LockScreen({required this.prefs, required this.onUnlock, super.key});
  final SharedPreferences prefs;
  final VoidCallback onUnlock;

  @override
  State<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<LockScreen> {
  String pin = '';
  int fails = 0;
  DateTime? waitUntil;
  bool bio = false;

  @override
  void initState() {
    super.initState();
    if (widget.prefs.getBool(AppLock.bioKey) == true) {
      AppLock.biometricAvailable().then((ok) {
        if (!mounted || !ok) return;
        setState(() => bio = true);
        _bio();
      });
    }
  }

  Future<void> _bio() async {
    if (await AppLock.biometric()) widget.onUnlock();
  }

  void _tap(String d) {
    if (waitUntil != null && DateTime.now().isBefore(waitUntil!)) return;
    HapticFeedback.selectionClick();
    final next = pin + d;
    if (next.length < 4) return setState(() => pin = next);
    if (AppLock.check(widget.prefs, next)) {
      widget.onUnlock();
      return;
    }
    // Довжина PIN 4–6: поки не 6 — даємо дописати.
    if (next.length < 6) return setState(() => pin = next);
    HapticFeedback.heavyImpact();
    fails++;
    setState(() {
      pin = '';
      if (fails % 5 == 0) waitUntil = DateTime.now().add(const Duration(seconds: 30));
    });
  }

  @override
  Widget build(BuildContext context) {
    final wait = waitUntil != null && DateTime.now().isBefore(waitUntil!);
    Widget key(String label, {VoidCallback? onTap, IconData? icon}) => SizedBox(
          width: 76,
          height: 76,
          child: TextButton(
            style: TextButton.styleFrom(shape: const CircleBorder(), backgroundColor: fg.withValues(alpha: 0.06)),
            onPressed: onTap ?? () => _tap(label),
            child: icon != null ? Icon(icon, color: fg, size: 26) : Text(label, style: display(26)),
          ),
        );
    return Material(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: SafeArea(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(LucideIcons.lockKeyhole, size: 36, color: primary),
          const SizedBox(height: 12),
          Text(tr('Введіть PIN'), style: display(22)),
          const SizedBox(height: 6),
          Text(wait ? tr('Забагато спроб. Зачекайте 30 секунд.') : (fails > 0 ? tr('Неправильний PIN') : ' '), style: body(13, color: fails > 0 ? dangerSoft : muted)),
          const SizedBox(height: 18),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (var i = 0; i < 6; i++)
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 6),
                width: 12,
                height: 12,
                decoration: BoxDecoration(shape: BoxShape.circle, color: i < pin.length ? primary : fg.withValues(alpha: i < 4 ? 0.2 : 0.08)),
              ),
          ]),
          const SizedBox(height: 28),
          for (final row in const [
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
          ])
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [for (final d in row) Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: key(d))]),
            ),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: bio ? key('', icon: LucideIcons.fingerprint, onTap: _bio) : const SizedBox(width: 76)),
            Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: key('0')),
            Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: key('', icon: LucideIcons.delete, onTap: () => setState(() => pin = pin.isEmpty ? pin : pin.substring(0, pin.length - 1)))),
          ]),
        ]),
      ),
    );
  }
}

/// Налаштування → Блокування застосунку.
class AppLockSettingsScreen extends StatefulWidget {
  const AppLockSettingsScreen({super.key});

  @override
  State<AppLockSettingsScreen> createState() => _AppLockSettingsScreenState();
}

class _AppLockSettingsScreenState extends State<AppLockSettingsScreen> {
  SharedPreferences? prefs;
  bool bioAvailable = false;

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((p) => mounted ? setState(() => prefs = p) : null);
    AppLock.biometricAvailable().then((ok) => mounted ? setState(() => bioAvailable = ok) : null);
  }

  Future<String?> _askPin(String title) async {
    final controller = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          autofocus: true,
          obscureText: true,
          keyboardType: TextInputType.number,
          maxLength: 6,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: InputDecoration(hintText: tr('4–6 цифр')),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false), child: Text(tr('Скасувати'))),
          TextButton(onPressed: () => Navigator.pop(dialog, true), child: Text(tr('Далі'))),
        ],
      ),
    );
    final pin = controller.text;
    return ok == true && pin.length >= 4 ? pin : null;
  }

  Future<void> _enable() async {
    final p = prefs!;
    final first = await _askPin(tr('Новий PIN'));
    if (first == null || !mounted) return;
    final second = await _askPin(tr('Повторіть PIN'));
    if (!mounted) return;
    if (second != first) {
      toast(context, tr('PIN не збігся. Спробуйте ще раз.'));
      return;
    }
    await AppLock.setPin(p, first);
    if (mounted) {
      setState(() {});
      toast(context, tr('Блокування ввімкнено.'));
    }
  }

  Future<void> _disable() async {
    final p = prefs!;
    final pin = await _askPin(tr('Поточний PIN'));
    if (pin == null || !mounted) return;
    if (!AppLock.check(p, pin)) {
      toast(context, tr('Неправильний PIN'));
      return;
    }
    await AppLock.disable(p);
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final p = prefs;
    if (p == null) return const SizedBox.shrink();
    final on = AppLock.enabled(p);
    final timeout = p.getInt(AppLock.timeoutKey) ?? 60;
    String label(int s) => s == 0 ? tr('Одразу') : (s < 60 ? tr('{n} с', {'n': s}) : tr('Через {n} хв', {'n': s ~/ 60}));
    return ScreenScroll(children: [
      PageTitle(tr('Блокування застосунку'), subtitle: tr('PIN-код і відбиток пальця чи обличчя при відкритті GameCon. Діє лише на цьому телефоні.')),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SwitchListTile(contentPadding: EdgeInsets.zero, value: on, onChanged: (v) => v ? _enable() : _disable(), title: Text(tr('Вимагати PIN'), style: body(15, weight: FontWeight.w700))),
          if (on) ...[
            if (bioAvailable)
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: p.getBool(AppLock.bioKey) == true,
                onChanged: (v) async {
                  await p.setBool(AppLock.bioKey, v);
                  setState(() {});
                },
                title: Text(tr('Відбиток чи обличчя'), style: body(14.5, weight: FontWeight.w600)),
                subtitle: Text(tr('PIN лишається запасним способом'), style: body(12, color: muted)),
              ),
            const SizedBox(height: 6),
            Text(tr('Блокувати після виходу'), style: body(13, color: muted)),
            const SizedBox(height: 6),
            Wrap(spacing: 8, children: [
              for (final s in AppLock.timeouts)
                ChoiceChip(
                  label: Text(label(s)),
                  selected: timeout == s,
                  onSelected: (_) async {
                    await p.setInt(AppLock.timeoutKey, s);
                    setState(() {});
                  },
                ),
            ]),
            const SizedBox(height: 10),
            GhostButton(label: tr('Змінити PIN'), icon: LucideIcons.keyRound, onPressed: _enable),
          ],
        ]),
      ),
    ]);
  }
}
