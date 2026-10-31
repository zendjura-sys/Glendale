import 'package:flutter/material.dart';

/// Каскадна поява: проявлення + підйом на 16 px + масштаб 0.98 → 1 (easeOutQuart).
/// Елементи, що з'явилися в одному кадрі, йдуть один за одним з кроком 35 мс; уже показані
/// (за ключем) при поверненні прокрутки не анімуються вдруге.
class ArcticCascade extends StatefulWidget {
  const ArcticCascade({required this.child, this.id, super.key});
  final Widget child;

  /// Стабільний ідентифікатор (напр. ключ картки), щоб не повторювати появу.
  final Object? id;

  static final _seen = <Object>{};
  static int _burst = 0;
  static Duration? _burstAt;

  @override
  State<ArcticCascade> createState() => _ArcticCascadeState();
}

class _ArcticCascadeState extends State<ArcticCascade> with SingleTickerProviderStateMixin {
  AnimationController? _c;
  late Animation<double> _t;

  @override
  void initState() {
    super.initState();
    final id = widget.id;
    if (id != null && !ArcticCascade._seen.add(id)) return;
    if (ArcticCascade._seen.length > 2000) ArcticCascade._seen.clear();
    // Скільки елементів уже стартувало в цьому кадрі — така й затримка (до 10 кроків).
    final now = WidgetsBinding.instance.currentSystemFrameTimeStamp;
    final same = ArcticCascade._burstAt != null && (now - ArcticCascade._burstAt!).inMilliseconds.abs() < 20;
    ArcticCascade._burst = same ? ArcticCascade._burst + 1 : 0;
    ArcticCascade._burstAt = now;
    final delay = 35.0 * ArcticCascade._burst.clamp(0, 10);
    const run = 420.0;
    final total = delay + run;
    _c = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: total.round()),
    );
    _t = CurvedAnimation(
      parent: _c!,
      curve: Interval(delay / total, 1, curve: Curves.easeOutQuart),
    );
    _c!.forward();
  }

  @override
  void dispose() {
    _c?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = _c;
    if (c == null || MediaQuery.disableAnimationsOf(context)) return widget.child;
    return AnimatedBuilder(
      animation: _t,
      child: widget.child,
      builder: (context, child) {
        // Та сама структура до й після анимації — стан картки (відео, поле вводу) не скидається.
        final t = _t.value;
        return FadeTransition(
          opacity: _t,
          child: Transform.translate(
            offset: Offset(0, 16 * (1 - t)),
            child: Transform.scale(scale: 0.98 + 0.02 * t, child: child),
          ),
        );
      },
    );
  }
}
