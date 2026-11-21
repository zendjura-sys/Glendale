import 'dart:async';
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import 'i18n.dart';
import 'sound_fx.dart';

/// Стартовий екран iOS 27: безбарвне матове скло, капсула з білим контуром «G»,
/// срібляста смужка прогресу й статус. Після першого кадру м'яко розчиняється (320 мс)
/// і лунає акорд запуску (раз за запуск, якщо звуки ввімкнені).
class BootSplash extends StatefulWidget {
  const BootSplash({required this.child, super.key});
  final Widget child;

  @override
  State<BootSplash> createState() => _BootSplashState();
}

class _BootSplashState extends State<BootSplash> with TickerProviderStateMixin {
  static bool _shown = false;
  late final bool active = !_shown;
  late final fade = AnimationController(vsync: this, duration: const Duration(milliseconds: 320));
  late final beam = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..repeat();
  int line = 0;
  Timer? lines;
  bool gone = false;

  @override
  void initState() {
    super.initState();
    _shown = true;
    if (!active) {
      gone = true;
      return;
    }
    lines = Timer.periodic(const Duration(milliseconds: 700), (_) => setState(() => line = (line + 1) % 2));
    // Коротка пауза, поки застосунок будує перший екран; страховка — не довше 2.2 с.
    Future.delayed(const Duration(milliseconds: 900), _hide);
    Future.delayed(const Duration(milliseconds: 2200), _hide);
  }

  Future<void> _hide() async {
    if (!mounted || fade.isAnimating || gone) return;
    GcSoundEngine.instance.bootChime();
    await fade.forward();
    if (mounted) setState(() => gone = true);
    lines?.cancel();
    beam.stop();
  }

  @override
  void dispose() {
    lines?.cancel();
    fade.dispose();
    beam.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (gone) return widget.child;
    final reduce = MediaQuery.disableAnimationsOf(context);
    final status = [tr('Ініціалізація GameCon OS...'), tr('Синхронізація профілю...')][line];
    return Stack(
      textDirection: TextDirection.ltr,
      children: [
        widget.child,
        Positioned.fill(
          child: AnimatedBuilder(
            animation: fade,
            builder: (context, child) {
              final t = Curves.easeOutCubic.transform(fade.value);
              return IgnorePointer(
                ignoring: fade.value > 0.5,
                child: Opacity(opacity: 1 - t, child: Transform.scale(scale: 1 + 0.02 * t, child: child)),
              );
            },
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 36, sigmaY: 36),
              child: ColoredBox(
                color: const Color.fromRGBO(10, 12, 16, 0.96),
                child: Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(26),
                      child: BackdropFilter(
                        filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
                        child: Container(
                          width: 92,
                          height: 92,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.06),
                            borderRadius: BorderRadius.circular(26),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
                            boxShadow: const [BoxShadow(color: Color.fromRGBO(0, 0, 0, 0.65), blurRadius: 40, offset: Offset(0, 16))],
                          ),
                          child: Text('G', style: TextStyle(fontFamily: 'Montserrat', fontSize: 42, fontWeight: FontWeight.w700, color: Colors.white.withValues(alpha: 0.92), decoration: TextDecoration.none)),
                        ),
                      ),
                    ),
                    const SizedBox(height: 26),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: SizedBox(
                        width: 136,
                        height: 3,
                        child: ColoredBox(
                          color: Colors.white.withValues(alpha: 0.08),
                          child: reduce
                              ? null
                              : AnimatedBuilder(
                                  animation: beam,
                                  builder: (context, _) => FractionalTranslation(
                                    translation: Offset(beam.value * 2 - 1, 0),
                                    child: const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(colors: [Colors.transparent, Color.fromRGBO(255, 255, 255, 0.75), Colors.transparent]))),
                                  ),
                                ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(status, style: TextStyle(fontFamily: 'Montserrat', fontSize: 12, fontWeight: FontWeight.w500, color: Colors.white.withValues(alpha: 0.55), decoration: TextDecoration.none)),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
