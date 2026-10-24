import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'theme.dart';

// Оформлення GameCon+ у застосунку — те саме, що на сайті (components/gc/plus.tsx):
// позначка біля імені, колір/градієнт ніку, анімація ніку (перелив або відблиск), рамка аватара
// й ефект шапки профілю. Застосунок лише показує оформлення, обране на сайті; кольори приходять із сервера
// (поле `plus` у картці користувача). Тут немає й не має бути жодних цін чи посилань на оплату.

Color? _hex(dynamic value) {
  final hex = text(value);
  if (hex == null || !RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(hex)) return null;
  return Color(int.parse('FF${hex.substring(1)}', radix: 16));
}

List<Color>? _colors(dynamic value) {
  if (value is! List) return null;
  final colors = [for (final item in value) ?_hex(item)];
  return colors.isEmpty ? null : colors;
}

/// Оформлення GameCon+ з картки користувача (`user['plus']`); null — GameCon+ не активний.
class PlusMark {
  const PlusMark({this.name, this.frame, this.fx});
  final List<Color>? name;
  final List<Color>? frame;

  /// Анімація ніку: flow — перелив кольорів, shine — відблиск.
  final String? fx;

  static PlusMark? of(dynamic user) => user is Map ? from(user['plus']) : null;

  static PlusMark? from(dynamic plus) {
    if (plus is! Map) return null;
    final fx = text(plus['fx']);
    return PlusMark(name: _colors(plus['name']), frame: _colors(plus['frame']), fx: fx == 'flow' || fx == 'shine' ? fx : null);
  }
}

/// Косметика сезонного пропуску з картки (`user['cosmetics']`): рамка, колір ніку, значок.
/// Отримується за очки сезону (season.dart); кольори й іконки — лише з сервера.
class SeasonCosmetics {
  const SeasonCosmetics({this.frame, this.name, this.badgeIcon, this.badgeColor, this.badgeName});
  final List<Color>? frame;
  final List<Color>? name;
  final String? badgeIcon;
  final Color? badgeColor;
  final String? badgeName;

  static SeasonCosmetics? of(dynamic user) {
    if (user is! Map || user['cosmetics'] is! Map) return null;
    final c = user['cosmetics'] as Map;
    final badge = c['badge'] is Map ? c['badge'] as Map : null;
    return SeasonCosmetics(
      frame: _colors(c['frame']),
      name: _colors(c['name']),
      badgeIcon: text(badge?['icon']),
      badgeColor: _hex(badge?['color']),
      badgeName: text(badge?['name']),
    );
  }
}

/// Рамка аватара: GameCon+, інакше вдягнута із сезонного пропуску.
List<Color>? avatarFrameOf(dynamic user) => PlusMark.of(user)?.frame ?? SeasonCosmetics.of(user)?.frame;

/// Колір ніку: GameCon+, інакше з пропуску (без позначки GameCon+).
PlusMark? nameMarkOf(dynamic user) {
  final plus = PlusMark.of(user);
  if (plus != null) return plus;
  final name = SeasonCosmetics.of(user)?.name;
  return name == null ? null : PlusMark(name: name);
}

/// Іконки значків пропуску (ключі — з config/season_pass.php).
const seasonBadgeIcons = {
  'star': LucideIcons.star,
  'flame': LucideIcons.flame,
  'zap': LucideIcons.zap,
  'shield': LucideIcons.shield,
  'crown': LucideIcons.crown,
  'gem': LucideIcons.gem,
};

/// Значок сезону біля імені.
class SeasonBadge extends StatelessWidget {
  const SeasonBadge({required this.user, this.size = 15, super.key});
  final dynamic user;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = SeasonCosmetics.of(user);
    final icon = seasonBadgeIcons[c?.badgeIcon];
    if (c == null || icon == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(left: 5),
      child: Tooltip(message: c.badgeName ?? '', child: Icon(icon, size: size, color: c.badgeColor ?? primary)),
    );
  }
}

/// Кольори шапки профілю: палітра сторінки, інакше колір ніку, інакше фірмові.
List<Color> plusHeaderColors(Map<String, dynamic> profile) {
  final accent = _colors(profile['accent']);
  if (accent != null) return accent;
  final name = PlusMark.of(profile)?.name;
  if (name != null) return [...name, const Color(0xFFA855F7)];
  return const [Color(0xFF6366F1), Color(0xFFA855F7), Color(0xFF22D3EE)];
}

/// Позначка GameCon+ біля імені: плоский квадрат з плюсом в акцентному кольорі.
class PlusBadge extends StatelessWidget {
  const PlusBadge({this.size = 16, super.key});
  final double size;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'GameCon+',
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: const Color(0xFF6366F1), borderRadius: BorderRadius.circular(size * 0.31)),
        child: Icon(LucideIcons.plus, size: size * 0.75, color: Colors.white),
      ),
    );
  }
}

/// Нік з кольором GameCon+. [animate] — показувати анімацію (профіль, меню); у списках нік статичний,
/// як і на сайті. Анімація вимикається, якщо в системі ввімкнено «Зменшити рух».
class PlusName extends StatefulWidget {
  const PlusName(this.name, {required this.plus, required this.style, this.animate = false, this.maxLines = 1, super.key});
  final String name;
  final PlusMark? plus;
  final TextStyle style;
  final bool animate;
  final int? maxLines;

  @override
  State<PlusName> createState() => _PlusNameState();
}

class _PlusNameState extends State<PlusName> with SingleTickerProviderStateMixin {
  AnimationController? _motion;

  String? get _fx => widget.animate ? widget.plus?.fx : null;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(PlusName old) {
    super.didUpdateWidget(old);
    _sync();
  }

  void _sync() {
    final still = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (_fx == null || still) {
      _motion?.dispose();
      _motion = null;
      return;
    }
    final period = Duration(milliseconds: _fx == 'flow' ? 6000 : 4500);
    if (_motion?.duration == period) return;
    _motion?.dispose();
    _motion = AnimationController(vsync: this, duration: period)..repeat();
  }

  @override
  void dispose() {
    _motion?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final plus = widget.plus;
    final colors = plus?.name;
    final label = Text(widget.name, maxLines: widget.maxLines, overflow: TextOverflow.ellipsis, style: widget.style.copyWith(color: Colors.white));
    final fx = _fx;
    if (fx == null) {
      if (colors == null) return Text(widget.name, maxLines: widget.maxLines, overflow: TextOverflow.ellipsis, style: widget.style);
      if (colors.length == 1) return Text(widget.name, maxLines: widget.maxLines, overflow: TextOverflow.ellipsis, style: widget.style.copyWith(color: colors.first));
      return ShaderMask(blendMode: BlendMode.srcIn, shaderCallback: (rect) => LinearGradient(colors: colors).createShader(rect), child: label);
    }
    final tones = colors ?? const [Colors.white];
    final first = tones.first;
    final last = tones.last;
    final motion = _motion;
    Shader shader(Rect rect, double t) {
      if (fx == 'flow') {
        // Як background-size: 200% і зсув 0 → 200%: градієнт повторюється без шва.
        final stops = tones.length > 1 ? [...tones, first] : [first, Colors.white, first];
        final width = rect.width * 2;
        return LinearGradient(colors: stops, tileMode: TileMode.repeated)
            .createShader(Rect.fromLTWH(rect.left - width * t, rect.top, width, rect.height));
      }
      // Відблиск: смуга світла проходить за 60% періоду, далі пауза.
      final p = (t / 0.6).clamp(0.0, 1.0);
      final width = rect.width * 2.5;
      final offset = (rect.width - width) * (1 - 1.5 * p);
      return LinearGradient(colors: [first, last, Colors.white, last, first], stops: const [0, 0.42, 0.5, 0.58, 1])
          .createShader(Rect.fromLTWH(rect.left + offset, rect.top, width, rect.height));
    }

    if (motion == null) return ShaderMask(blendMode: BlendMode.srcIn, shaderCallback: (rect) => shader(rect, 0), child: label);
    return AnimatedBuilder(
      animation: motion,
      builder: (context, child) => ShaderMask(blendMode: BlendMode.srcIn, shaderCallback: (rect) => shader(rect, motion.value), child: child),
      child: label,
    );
  }
}

/// Ім’я з кольором GameCon+, позначкою та (за наявності) позначкою верифікації.
class PlusNameRow extends StatelessWidget {
  const PlusNameRow({required this.user, required this.style, this.animate = false, this.verifiedSize = 15, this.badgeSize = 15, super.key});
  final Map<String, dynamic> user;
  final TextStyle style;
  final bool animate;
  final double verifiedSize;
  final double badgeSize;

  @override
  Widget build(BuildContext context) {
    final plus = PlusMark.of(user);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Flexible(child: PlusName(text(user['name']) ?? 'GameCon', plus: nameMarkOf(user), style: style, animate: animate)),
        if (user['is_verified'] == true) ...[const SizedBox(width: 4), Icon(LucideIcons.badgeCheck, size: verifiedSize, color: primary)],
        if (plus != null) ...[const SizedBox(width: 5), PlusBadge(size: badgeSize)],
        SeasonBadge(user: user, size: badgeSize),
      ],
    );
  }
}

/// Ефекти шапки профілю GameCon+: «aurora» — повільне сяйво внизу обкладинки, «rim» — жива рамка картки.
class PlusHeaderGlow extends StatefulWidget {
  const PlusHeaderGlow({required this.effect, required this.colors, this.radius = 26, super.key});
  final String effect;
  final List<Color> colors;
  final double radius;

  @override
  State<PlusHeaderGlow> createState() => _PlusHeaderGlowState();
}

class _PlusHeaderGlowState extends State<PlusHeaderGlow> with SingleTickerProviderStateMixin {
  late final AnimationController _motion = AnimationController(vsync: this, duration: Duration(seconds: widget.effect == 'rim' ? 8 : 14));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final still = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (still) {
      _motion.stop();
    } else if (!_motion.isAnimating) {
      _motion.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _motion.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = [...widget.colors, widget.colors.first];
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _motion,
        builder: (context, _) {
          final t = Curves.easeInOut.transform(_motion.value);
          if (widget.effect == 'rim') return CustomPaint(painter: _RimPainter(colors, t, widget.radius), size: Size.infinite);
          // Сяйво: градієнт утричі ширший за обкладинку повільно ковзає; зверху розчиняється.
          return ShaderMask(
            blendMode: BlendMode.dstIn,
            shaderCallback: (rect) => const LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [Colors.black, Colors.transparent]).createShader(rect),
            child: Opacity(
              opacity: 0.45,
              child: LayoutBuilder(
                builder: (context, box) => DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(colors: colors, transform: _Slide(-2 * t * box.maxWidth), begin: Alignment.centerLeft, end: Alignment(5, 0)),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _Slide extends GradientTransform {
  const _Slide(this.dx);
  final double dx;

  @override
  Matrix4? transform(Rect bounds, {TextDirection? textDirection}) => Matrix4.translationValues(dx, 0, 0);
}

class _RimPainter extends CustomPainter {
  _RimPainter(this.colors, this.t, this.radius);
  final List<Color> colors;
  final double t;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final shaderRect = Rect.fromLTWH(-size.width * 2 * t, -size.height * 2 * t, size.width * 3, size.height * 3);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..shader = LinearGradient(colors: colors, begin: Alignment.topLeft, end: Alignment.bottomRight).createShader(shaderRect);
    canvas.drawRRect(RRect.fromRectAndRadius(rect.deflate(0.75), Radius.circular(radius)), paint);
  }

  @override
  bool shouldRepaint(_RimPainter old) => old.t != t || old.colors != colors;
}
