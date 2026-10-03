import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'state.dart';
import 'theme.dart';

// ───────────────────────── Тло й логотип ─────────────────────────

/// Тло всіх екранів: глибокий синій з «авророю», як `<Aurora />` на сайті.
class Stage extends StatelessWidget {
  const Stage({required this.child, super.key});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(color: voidColor),
      child: Stack(
        children: [
          const Positioned(left: -120, top: -80, child: _Glow(color: indigo, size: 360, alpha: 0.30)),
          const Positioned(right: -120, top: -40, child: _Glow(color: violet, size: 300, alpha: 0.20)),
          const Positioned(left: -60, bottom: 120, child: _Glow(color: neonBlue, size: 260, alpha: 0.10)),
          child,
        ],
      ),
    );
  }
}

class _Glow extends StatelessWidget {
  const _Glow({required this.color, required this.size, this.alpha = 0.28});
  final Color color;
  final double size;
  final double alpha;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: [color.withValues(alpha: alpha), color.withValues(alpha: 0)]),
        ),
      ),
    );
  }
}

/// Логотип GameCon: тёмний квадрат з градієнтною рамкою й «play».
class LogoMark extends StatelessWidget {
  const LogoMark({this.size = 40, super.key});
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * 0.3),
        gradient: brand,
        boxShadow: [BoxShadow(color: indigo.withValues(alpha: 0.45), blurRadius: size * 0.4, offset: Offset(0, size * 0.1))],
      ),
      padding: EdgeInsets.all(size * 0.05),
      child: DecoratedBox(
        decoration: BoxDecoration(color: const Color(0xFF0B0F22), borderRadius: BorderRadius.circular(size * 0.26)),
        child: CustomPaint(painter: _PlayPainter()),
      ),
    );
  }
}

class _PlayPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(size.width * 0.36, size.height * 0.27)
      ..lineTo(size.width * 0.36, size.height * 0.73)
      ..lineTo(size.width * 0.74, size.height * 0.5)
      ..close();
    final paint = Paint()
      ..shader = const LinearGradient(colors: [Color(0xFF7DA6FF), Color(0xFF8B6BFF), pink]).createShader(Offset.zero & size)
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class Wordmark extends StatelessWidget {
  const Wordmark({this.size = 22, super.key});
  final double size;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        LogoMark(size: size * 1.6),
        SizedBox(width: size * 0.45),
        Text('Game', style: display(size)),
        GradientText('Con', style: display(size)),
      ],
    );
  }
}

class GradientText extends StatelessWidget {
  const GradientText(this.value, {required this.style, this.gradient = brand, super.key});
  final String value;
  final TextStyle style;
  final Gradient gradient;

  @override
  Widget build(BuildContext context) {
    return ShaderMask(
      blendMode: BlendMode.srcIn,
      shaderCallback: (bounds) => gradient.createShader(Offset.zero & bounds.size),
      child: Text(value, style: style.copyWith(color: Colors.white)),
    );
  }
}

// ───────────────────────── Поверхні ─────────────────────────

/// Скляна картка `.glass`.
class Glass extends StatelessWidget {
  const Glass({required this.child, this.padding = const EdgeInsets.all(16), this.radius = 22, this.onTap, this.gradient, this.border, super.key});
  final Widget child;
  final EdgeInsets padding;
  final double radius;
  final VoidCallback? onTap;
  final Gradient? gradient;
  final Color? border;

  @override
  Widget build(BuildContext context) {
    final shape = BorderRadius.circular(radius);
    final box = Ink(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        gradient: gradient ?? glassGradient,
        borderRadius: shape,
        border: Border.all(color: border ?? line),
        boxShadow: const [BoxShadow(color: Color(0x66000000), blurRadius: 30, offset: Offset(0, 14), spreadRadius: -16)],
      ),
      child: child,
    );
    return Material(
      color: Colors.transparent,
      borderRadius: shape,
      child: onTap == null ? box : InkWell(onTap: onTap, borderRadius: shape, child: box),
    );
  }
}

/// Заголовок усередині картки: іконка + ВЕЛИКІ ЛІТЕРИ + дія праворуч («ДРУЗІ … 1 спільний»).
class CardTitle extends StatelessWidget {
  const CardTitle(this.title, {this.icon, this.trailing, this.onTrailing, this.caps = true, super.key});
  final String title;
  final IconData? icon;
  final String? trailing;
  final VoidCallback? onTrailing;
  final bool caps;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          if (icon != null) ...[Icon(icon, size: 16, color: const Color(0xFF9AA6FF)), const SizedBox(width: 8)],
          Expanded(
            child: Text(
              caps ? title.toUpperCase() : title,
              style: caps ? body(12.5, weight: FontWeight.w700).copyWith(letterSpacing: 1.1) : display(16),
            ),
          ),
          if (trailing != null)
            GestureDetector(onTap: onTrailing, child: Text(trailing!, style: body(12, color: muted))),
        ],
      ),
    );
  }
}

/// Великий заголовок сторінки («Повідомлення», «Налаштування»).
class PageTitle extends StatelessWidget {
  const PageTitle(this.title, {this.subtitle, this.trailing, super.key});
  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: display(24)),
                if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(subtitle!, style: body(13.5, color: muted).copyWith(height: 1.35))),
              ],
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

/// Героїчна картка розділу: бейдж, заголовок з градієнтним словом, опис, дія.
class HeroCard extends StatelessWidget {
  const HeroCard({required this.title, this.accent, this.after, this.badge, this.badgeIcon, this.text, this.children = const [], this.tint = indigo, this.accentGradient = brand, super.key});
  final String title;
  final String? accent;
  final String? after;
  final String? badge;
  final IconData? badgeIcon;
  final String? text;
  final List<Widget> children;
  final Color tint;
  final Gradient accentGradient;

  @override
  Widget build(BuildContext context) {
    return Glass(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
      gradient: LinearGradient(
        colors: [tint.withValues(alpha: 0.22), cardTop, const Color(0xFF1A1230)],
        stops: const [0, 0.55, 1],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (badge != null) ...[
            Pill(label: badge!, icon: badgeIcon, color: tint == gold ? gold : const Color(0xFFC7CCF0)),
            const SizedBox(height: 12),
          ],
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text('$title${accent == null ? '' : ' '}', style: display(26)),
              if (accent != null) GradientText(accent!, style: display(26), gradient: accentGradient),
              if (after != null) Text(' $after', style: display(26)),
            ],
          ),
          if (text != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(text!, style: body(14, color: soft.withValues(alpha: 0.8)).copyWith(height: 1.45))),
          if (children.isNotEmpty) const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }
}

// ───────────────────────── Кнопки ─────────────────────────

/// Градієнтна кнопка `.btn-glow`.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({required this.label, required this.onPressed, this.icon, this.expand = true, this.compact = false, this.busy = false, super.key});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool expand;
  final bool compact;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !busy;
    final height = compact ? 40.0 : 50.0;
    final content = Row(
      mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (busy)
          const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
        else if (icon != null)
          Icon(icon, color: Colors.white, size: compact ? 16 : 18),
        if (busy || icon != null) const SizedBox(width: 8),
        Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(compact ? 13.5 : 15, color: Colors.white, weight: FontWeight.w600))),
      ],
    );
    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: enabled ? onPressed : null,
          borderRadius: BorderRadius.circular(14),
          child: Ink(
            height: height,
            padding: EdgeInsets.symmetric(horizontal: compact ? 14 : 20),
            decoration: BoxDecoration(
              gradient: buttonGradient,
              borderRadius: BorderRadius.circular(14),
              boxShadow: [BoxShadow(color: indigo.withValues(alpha: 0.55), blurRadius: 24, offset: const Offset(0, 10), spreadRadius: -10)],
            ),
            child: content,
          ),
        ),
      ),
    );
  }
}

/// Скляна другорядна кнопка («Редагувати профіль», «Написати»).
class GhostButton extends StatelessWidget {
  const GhostButton({required this.label, required this.onPressed, this.icon, this.expand = true, this.compact = false, this.color = ink, this.iconColor, super.key});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool expand;
  final bool compact;
  final Color color;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: onPressed == null ? 0.5 : 1,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(14),
          child: Ink(
            height: compact ? 40 : 48,
            padding: EdgeInsets.symmetric(horizontal: compact ? 12 : 18),
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(14), border: Border.all(color: lineStrong)),
            child: Row(
              mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (icon != null) ...[Icon(icon, size: compact ? 16 : 18, color: iconColor ?? color), const SizedBox(width: 8)],
                Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(compact ? 13 : 14.5, color: color, weight: FontWeight.w600))),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class DangerButton extends StatelessWidget {
  const DangerButton({required this.label, required this.onPressed, this.icon, this.expand = false, super.key});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(color: danger, borderRadius: BorderRadius.circular(14), boxShadow: [BoxShadow(color: danger.withValues(alpha: 0.4), blurRadius: 20, offset: const Offset(0, 8), spreadRadius: -10)]),
          child: Row(
            mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[Icon(icon, size: 16, color: Colors.white), const SizedBox(width: 8)],
              Text(label, style: body(14, color: Colors.white, weight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Кругла іконка-кнопка (скріпка, мікрофон, ⋯).
class RoundIcon extends StatelessWidget {
  const RoundIcon({required this.icon, required this.onTap, this.size = 40, this.color = muted, this.filled = false, this.tooltip, super.key});
  final IconData icon;
  final VoidCallback? onTap;
  final double size;
  final Color color;
  final bool filled;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final button = Material(
      color: Colors.transparent,
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Ink(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: filled ? buttonGradient : null,
            color: filled ? null : Colors.white.withValues(alpha: 0.05),
            border: filled ? null : Border.all(color: line),
          ),
          child: Icon(icon, size: size * 0.48, color: filled ? Colors.white : color),
        ),
      ),
    );
    return tooltip == null ? button : Tooltip(message: tooltip!, child: button);
  }
}

// ───────────────────────── Поля ─────────────────────────

class GcField extends StatelessWidget {
  const GcField({
    required this.controller,
    required this.label,
    this.obscure = false,
    this.onSubmit,
    this.onChanged,
    this.icon,
    this.maxLines = 1,
    this.minLines,
    this.keyboard,
    this.enabled = true,
    this.prefixText,
    this.autofocus = false,
    this.dense = false,
    super.key,
  });
  final TextEditingController controller;
  final String label;
  final bool obscure;
  final VoidCallback? onSubmit;
  final ValueChanged<String>? onChanged;
  final IconData? icon;
  final int maxLines;
  final int? minLines;
  final TextInputType? keyboard;
  final bool enabled;
  final String? prefixText;
  final bool autofocus;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      enabled: enabled,
      autofocus: autofocus,
      keyboardType: keyboard ?? (maxLines > 1 ? TextInputType.multiline : null),
      maxLines: obscure ? 1 : maxLines,
      minLines: minLines,
      onChanged: onChanged,
      onSubmitted: (_) => onSubmit?.call(),
      textInputAction: maxLines > 1 ? TextInputAction.newline : (onSubmit != null ? TextInputAction.search : TextInputAction.next),
      style: body(16).copyWith(height: 1.3),
      decoration: InputDecoration(
        hintText: label,
        hintStyle: body(15, color: faint),
        prefixIcon: icon == null ? null : Icon(icon, color: muted, size: 18),
        prefixText: prefixText,
        prefixStyle: body(15, color: muted),
        filled: true,
        fillColor: field.withValues(alpha: enabled ? 1 : 0.5),
        isDense: true,
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: dense ? 11 : 15),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: lineStrong)),
        disabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: line)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: primary, width: 1.4)),
      ),
    );
  }
}

/// Поле з підписом зверху (форми налаштувань).
class LabeledField extends StatelessWidget {
  const LabeledField({required this.label, required this.child, this.hint, super.key});
  final String label;
  final Widget child;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: body(13, color: soft, weight: FontWeight.w500)),
          const SizedBox(height: 7),
          child,
          if (hint != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(hint!, style: body(11.5, color: faint))),
        ],
      ),
    );
  }
}

/// Пошук у картці (рядок «Пошук» з лупою).
class SearchField extends StatelessWidget {
  const SearchField({required this.controller, required this.hint, required this.onSearch, super.key});
  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onSearch;

  @override
  Widget build(BuildContext context) {
    return GcField(
      controller: controller,
      label: hint,
      icon: LucideIcons.search,
      dense: true,
      onSubmit: () => onSearch(controller.text.trim()),
    );
  }
}

/// Випадний список у стилі сайту («Усі сервери», «За онлайном»).
class GcSelect<T> extends StatelessWidget {
  const GcSelect({required this.value, required this.items, required this.onChanged, this.hint, this.expand = false, super.key});
  final T? value;
  final List<(T, String)> items;
  final ValueChanged<T?> onChanged;
  final String? hint;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 46,
      width: expand ? double.infinity : null,
      padding: const EdgeInsets.only(left: 14, right: 8),
      decoration: BoxDecoration(color: field, borderRadius: BorderRadius.circular(14), border: Border.all(color: lineStrong)),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          isExpanded: expand,
          hint: hint == null ? null : Text(hint!, style: body(14.5, color: faint)),
          dropdownColor: popover,
          borderRadius: BorderRadius.circular(14),
          icon: const Icon(LucideIcons.chevronDown, color: muted),
          style: body(14.5),
          items: [for (final item in items) DropdownMenuItem<T>(value: item.$1, child: Text(item.$2, overflow: TextOverflow.ellipsis))],
          onChanged: onChanged,
        ),
      ),
    );
  }
}

// ───────────────────────── Перемикачі ─────────────────────────

class SegmentOption {
  const SegmentOption(this.id, this.label, {this.icon, this.count});
  final String id;
  final String label;
  final IconData? icon;
  final Object? count;
}

/// Сегментований перемикач у скляній рамці («Друзі | Рекомендації», «Профіль | Безпека»).
class Segmented extends StatelessWidget {
  const Segmented({required this.options, required this.selected, required this.onSelect, this.scroll = false, super.key});
  final List<SegmentOption> options;
  final String selected;
  final ValueChanged<String> onSelect;
  final bool scroll;

  static const _motion = Duration(milliseconds: 260);
  static final _pill = BoxDecoration(color: Colors.white.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(14), border: Border.all(color: lineStrong));

  @override
  Widget build(BuildContext context) {
    Widget content(SegmentOption option, bool on) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (option.icon != null) ...[
            TweenAnimationBuilder<Color?>(
              tween: ColorTween(end: on ? const Color(0xFF9AA6FF) : muted),
              duration: _motion,
              builder: (_, color, _) => Icon(option.icon, size: 16, color: color),
            ),
            const SizedBox(width: 7),
          ],
          AnimatedDefaultTextStyle(
            duration: _motion,
            style: body(13.5, color: on ? ink : muted, weight: FontWeight.w600).copyWith(height: 1.2),
            child: Text(option.label, maxLines: 1, softWrap: false),
          ),
          if (option.count != null) ...[
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(10)),
              child: Text('${option.count}', maxLines: 1, softWrap: false, style: body(11, color: muted, weight: FontWeight.w600)),
            ),
          ],
        ],
      );
    }

    final frame = BoxDecoration(color: Colors.white.withValues(alpha: 0.035), borderRadius: BorderRadius.circular(18), border: Border.all(color: line));

    if (scroll) {
      return Container(
        padding: const EdgeInsets.all(4),
        decoration: frame,
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [
            for (final option in options)
              Builder(
                builder: (tabContext) => GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    final box = tabContext.findRenderObject();
                    if (box != null) Scrollable.of(tabContext).position.ensureVisible(box, alignment: 0.5, duration: _motion, curve: Curves.easeOutCubic);
                    onSelect(option.id);
                  },
                  child: AnimatedContainer(
                    duration: _motion,
                    curve: Curves.easeOutCubic,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                    decoration: option.id == selected ? _pill : _pill.copyWith(color: Colors.transparent, border: Border.all(color: Colors.transparent)),
                    child: content(option, option.id == selected),
                  ),
                ),
              ),
          ]),
        ),
      );
    }

    final index = options.indexWhere((o) => o.id == selected);
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: frame,
      child: LayoutBuilder(builder: (context, constraints) {
        final width = constraints.maxWidth / options.length;
        return Stack(children: [
          if (index >= 0)
            AnimatedPositioned(
              duration: _motion,
              curve: Curves.easeOutCubic,
              left: width * index,
              top: 0,
              bottom: 0,
              width: width,
              child: DecoratedBox(decoration: _pill),
            ),
          Row(children: [
            for (final option in options)
              Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => onSelect(option.id),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 11),
                    child: Center(child: FittedBox(fit: BoxFit.scaleDown, child: content(option, option.id == selected))),
                  ),
                ),
              ),
          ]),
        ]);
      }),
    );
  }
}

/// Плавна зміна вмісту вкладки: старий вміст згасає, новий з’являється з легким зсувом.
class Swap extends StatelessWidget {
  const Swap({required this.id, required this.child, super.key});
  final Object? id;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 280),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      layoutBuilder: (current, previous) => Stack(alignment: Alignment.topCenter, children: [...previous, ?current]),
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: SlideTransition(position: Tween(begin: const Offset(0, 0.02), end: Offset.zero).animate(animation), child: child),
      ),
      child: KeyedSubtree(key: ValueKey(id), child: child),
    );
  }
}

/// Рядок пілюль-фільтрів («Усі тематики», «Ігри», «Кіберспорт»).
class ChipRow extends StatelessWidget {
  const ChipRow({required this.options, required this.selected, required this.onSelect, super.key});
  final List<(String, String)> options;
  final String selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final option in options)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: SelectPill(label: option.$2, selected: selected == option.$1, onTap: () => onSelect(option.$1)),
            ),
        ],
      ),
    );
  }
}

class SelectPill extends StatelessWidget {
  const SelectPill({required this.label, required this.selected, required this.onTap, this.icon, super.key});
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          gradient: selected ? buttonGradient : null,
          color: selected ? null : Colors.white.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? Colors.transparent : lineStrong),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[Icon(icon, size: 14, color: selected ? Colors.white : muted), const SizedBox(width: 6)],
            Text(label, style: body(13, color: selected ? Colors.white : soft, weight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}

/// Маленький бейдж («Адміністратор», «ПК», «RAGE:MP», «Набір відкрито»).
class Pill extends StatelessWidget {
  const Pill({required this.label, this.icon, this.color = soft, this.background, this.border, super.key});
  final String label;
  final IconData? icon;
  final Color color;
  final Color? background;
  final Color? border;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: background ?? color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: border ?? color.withValues(alpha: 0.28)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 12, color: color), const SizedBox(width: 4)],
          Text(label, style: body(11, color: color, weight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class GcSwitch extends StatelessWidget {
  const GcSwitch({required this.value, required this.onChanged, super.key});
  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) => Switch(value: value, onChanged: onChanged);
}

// ───────────────────────── Люди ─────────────────────────

class Avatar extends StatelessWidget {
  const Avatar({required this.name, this.url, this.size = 44, this.online = false, this.ring = false, this.square = false, super.key});
  final String? url;
  final String name;
  final double size;
  final bool online;
  final bool ring;
  final bool square;

  static const _palette = [
    [Color(0xFF6D5DFC), Color(0xFFA855F7)],
    [Color(0xFF4F8BFF), Color(0xFF38E1FF)],
    [Color(0xFFF04FD8), Color(0xFFA855F7)],
    [Color(0xFF34D399), Color(0xFF4F8BFF)],
    [Color(0xFFF5C451), Color(0xFFF0734A)],
  ];

  static String initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.characters.take(2).toString().toUpperCase();
    return (parts[0].characters.first + parts[1].characters.first).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final photo = absolute(url);
    final colors = _palette[name.hashCode.abs() % _palette.length];
    final radius = square ? BorderRadius.circular(size * 0.28) : BorderRadius.circular(size);
    Widget face = ClipRRect(
      borderRadius: radius,
      child: photo == null
          ? Container(
              width: size,
              height: size,
              alignment: Alignment.center,
              decoration: BoxDecoration(gradient: LinearGradient(colors: colors, begin: Alignment.topLeft, end: Alignment.bottomRight)),
              child: Text(initials(name), style: display(size * 0.34, color: Colors.white)),
            )
          : CachedNetworkImage(
              imageUrl: photo,
              fit: BoxFit.cover,
              width: size,
              height: size,
              placeholder: (_, _) => Container(color: raised),
              errorWidget: (_, _, _) => Container(color: raised),
            ),
    );
    if (ring) {
      face = Container(
        padding: EdgeInsets.all(size * 0.03),
        decoration: BoxDecoration(borderRadius: radius, gradient: brand),
        child: Container(
          padding: EdgeInsets.all(size * 0.03),
          decoration: BoxDecoration(borderRadius: radius, color: voidColor),
          child: face,
        ),
      );
    }
    final dot = (size * 0.24).clamp(10.0, 26.0);
    return SizedBox(
      width: ring ? null : size,
      height: ring ? null : size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          face,
          if (online)
            Positioned(
              right: ring ? size * 0.06 : 0,
              bottom: ring ? size * 0.06 : 0,
              child: Container(
                width: dot,
                height: dot,
                decoration: BoxDecoration(color: green, shape: BoxShape.circle, border: Border.all(color: voidColor, width: dot * 0.2)),
              ),
            ),
        ],
      ),
    );
  }
}

class UserTile extends StatelessWidget {
  const UserTile({required this.user, this.trailing, this.subtitle, this.size = 46, this.onTap, super.key});
  final Map<String, dynamic> user;
  final Widget? trailing;
  final String? subtitle;
  final double size;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final name = text(user['name']) ?? 'GameCon';
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap ??
          () {
            final username = text(user['username']);
            if (username != null) context.push('/u/$username');
          },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        child: Row(
          children: [
            Avatar(url: text(user['avatar_url']), name: name, size: size, online: user['is_online'] == true),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Flexible(child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(15, weight: FontWeight.w600))),
                    if (user['is_verified'] == true) ...[const SizedBox(width: 4), const Icon(LucideIcons.badgeCheck, size: 15, color: primary)],
                  ]),
                  Text(
                    subtitle ?? '@${text(user['username']) ?? ''}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: body(12.5, color: muted),
                  ),
                ],
              ),
            ),
            ?trailing,
          ],
        ),
      ),
    );
  }
}

// ───────────────────────── Порожні стани, статистика ─────────────────────────

/// Порожній стан у картці: іконка в квадраті, заголовок Unbounded, опис, дія.
class EmptyState extends StatelessWidget {
  const EmptyState({required this.icon, required this.title, this.text, this.action, this.onAction, this.actionIcon, this.boxed = true, super.key});
  final IconData icon;
  final String title;
  final String? text;
  final String? action;
  final VoidCallback? onAction;
  final IconData? actionIcon;
  final bool boxed;

  @override
  Widget build(BuildContext context) {
    final content = Column(
      children: [
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(18), border: Border.all(color: line)),
          child: Icon(icon, color: const Color(0xFF9AA6FF), size: 26),
        ),
        const SizedBox(height: 16),
        Text(title, textAlign: TextAlign.center, style: display(17)),
        if (text != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(text!, textAlign: TextAlign.center, style: body(13.5, color: muted).copyWith(height: 1.45))),
        if (action != null) ...[
          const SizedBox(height: 18),
          PrimaryButton(label: action!, icon: actionIcon, onPressed: onAction, expand: false, compact: true),
        ],
      ],
    );
    if (!boxed) return Padding(padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 12), child: content);
    return Glass(padding: const EdgeInsets.fromLTRB(20, 32, 20, 28), child: content);
  }
}

/// Тихий порожній стан у панелях («Операцій ще не було»).
class QuietEmpty extends StatelessWidget {
  const QuietEmpty({required this.icon, required this.text, super.key});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 22),
      child: Center(
        child: Column(
          children: [
            Icon(icon, color: faint, size: 30),
            const SizedBox(height: 10),
            Text(text, textAlign: TextAlign.center, style: body(13.5, color: muted)),
          ],
        ),
      ),
    );
  }
}

/// Колонка статистики профілю: «2 / друзі».
class StatColumn extends StatelessWidget {
  const StatColumn(this.value, this.label, {this.onTap, super.key});
  final String value;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Column(
            children: [
              Text(value, style: display(20)),
              const SizedBox(height: 4),
              Text(label, style: body(12, color: muted)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Плитка-метрика («1457 / Гравців онлайн», «ЗАРОБИВ ЗА ТИЖДЕНЬ / 0 ₴»).
class MetricTile extends StatelessWidget {
  const MetricTile({required this.label, required this.value, this.color = ink, this.icon, this.caps = false, this.gradient, super.key});
  final String label;
  final String value;
  final Color color;
  final IconData? icon;
  final bool caps;
  final Gradient? gradient;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.04), borderRadius: BorderRadius.circular(18), border: Border.all(color: line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (caps)
            Row(children: [
              Expanded(
                child: SizedBox(
                  height: 28,
                  child: Text(label.toUpperCase(), maxLines: 2, overflow: TextOverflow.ellipsis, style: body(10.5, color: muted, weight: FontWeight.w600).copyWith(letterSpacing: 0.8, height: 1.3)),
                ),
              ),
              if (icon != null) Icon(icon, size: 15, color: faint),
            ]),
          if (caps) const SizedBox(height: 10),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: gradient == null ? Text(value, maxLines: 1, softWrap: false, style: display(22, color: color)) : GradientText(value, style: display(24), gradient: gradient!),
          ),
          if (!caps) ...[const SizedBox(height: 4), Text(label, style: body(12, color: muted).copyWith(height: 1.25))],
        ],
      ),
    );
  }
}

/// Плитка-обкладинка з градієнтом (немає фото/постера).
class CoverPlaceholder extends StatelessWidget {
  const CoverPlaceholder({required this.seed, this.icon = LucideIcons.music, this.radius = 14, this.iconSize = 22, super.key});
  final Object seed;
  final IconData icon;
  final double radius;
  final double iconSize;

  static const _gradients = [
    [Color(0xFF38E1FF), Color(0xFF4F8BFF)],
    [Color(0xFF6D5DFC), Color(0xFF4F8BFF)],
    [Color(0xFFF04FD8), Color(0xFFF0734A)],
    [Color(0xFFA855F7), Color(0xFF6D5DFC)],
    [Color(0xFF34D399), Color(0xFF38E1FF)],
  ];

  @override
  Widget build(BuildContext context) {
    final colors = _gradients['$seed'.hashCode.abs() % _gradients.length];
    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(radius), gradient: LinearGradient(colors: colors, begin: Alignment.topLeft, end: Alignment.bottomRight)),
      child: Center(child: Icon(icon, color: Colors.white, size: iconSize)),
    );
  }
}

class NetImage extends StatelessWidget {
  const NetImage(this.url, {this.fit = BoxFit.cover, this.width, this.height, this.radius = 0, super.key});
  final String? url;
  final BoxFit fit;
  final double? width;
  final double? height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final src = absolute(url);
    final image = src == null
        ? Container(width: width, height: height, color: raised)
        : CachedNetworkImage(
            imageUrl: src,
            fit: fit,
            width: width,
            height: height,
            placeholder: (_, _) => Container(color: raised),
            errorWidget: (_, _, _) => Container(color: raised, child: const Icon(LucideIcons.imageOff, color: faint)),
          );
    return radius == 0 ? image : ClipRRect(borderRadius: BorderRadius.circular(radius), child: image);
  }
}

// ───────────────────────── Завантаження даних ─────────────────────────

class Remote extends StatefulWidget {
  const Remote({required this.load, required this.builder, this.watch, super.key});
  final Future<Map<String, dynamic>> Function() load;
  final Widget Function(Map<String, dynamic> data, Future<void> Function() reload) builder;
  final Object? watch;

  @override
  State<Remote> createState() => _RemoteState();
}

class _RemoteState extends State<Remote> {
  late Future<Map<String, dynamic>> _future;
  Map<String, dynamic>? _last;

  @override
  void initState() {
    super.initState();
    _future = _fetch();
  }

  Future<Map<String, dynamic>> _fetch() async {
    final data = await widget.load();
    _last = data;
    return data;
  }

  @override
  void didUpdateWidget(Remote oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.watch != widget.watch) _future = _fetch();
  }

  Future<void> _reload() async {
    final next = _fetch();
    setState(() => _future = next);
    try {
      await next;
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          // Під час перезавантаження показуємо попередні дані, щоб екран не блимав.
          if (_last != null) return widget.builder(_last!, _reload);
          return const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator(strokeWidth: 2.4)));
        }
        if (snapshot.hasError) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: EmptyState(
                icon: LucideIcons.wifiOff,
                title: 'Не вдалося завантажити',
                text: '${snapshot.error}',
                action: 'Спробувати знову',
                onAction: _reload,
              ),
            ),
          );
        }
        return widget.builder(snapshot.data ?? {}, _reload);
      },
    );
  }
}

/// Висота прозорої шапки поверх контенту, без системного відступу.
const siteBarHeight = 58.0;

/// Нижнє меню без системного відступу.
const navBarHeight = 64.0;

/// Плаваючий плеєр разом із відступом над меню.
const miniPlayerExtent = 76.0;

/// З якої ширини екрана (планшет, горизонтальний телефон-«лопата») показуємо бічне меню замість нижнього.
const tabletWidth = 840.0;

/// Ширина бічного меню на планшеті.
const sideNavWidth = 240.0;

/// Найбільша ширина стрічки на планшеті — як центральна колонка сайту.
const tabletContentWidth = 820.0;

/// Нижній хром оболонки: скільки контент має лишити під скляним меню й плеєром.
class ShellChrome extends InheritedWidget {
  const ShellChrome({required this.bottom, required super.child, super.key});
  final double bottom;

  static double bottomOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<ShellChrome>()?.bottom ?? MediaQuery.paddingOf(context).bottom;

  @override
  bool updateShouldNotify(ShellChrome oldWidget) => bottom != oldWidget.bottom;
}

/// Скільки місця шапка займає зверху, щоб перший елемент стартував під нею,
/// а прокрутка йшла вже під прозорими кнопками.
double siteHeaderInset(BuildContext context) {
  final top = MediaQuery.viewPaddingOf(context).top;
  return (top == 0 ? 24.0 : top) + siteBarHeight;
}

/// Прокрутка екрана: контент їде під прозору шапку і під скляне меню.
class ScreenScroll extends StatelessWidget {
  const ScreenScroll({required this.children, this.onRefresh, this.padding, this.controller, super.key});
  final List<Widget> children;
  final Future<void> Function()? onRefresh;
  final EdgeInsets? padding;
  final ScrollController? controller;

  @override
  Widget build(BuildContext context) {
    final base = padding ?? const EdgeInsets.fromLTRB(14, 6, 14, 16);
    final list = ListView(
      controller: controller,
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      padding: base.copyWith(
        top: base.top + siteHeaderInset(context),
        bottom: base.bottom + ShellChrome.bottomOf(context),
      ),
      children: children,
    );
    if (onRefresh == null) return list;
    return RefreshIndicator(color: primary, backgroundColor: popover, onRefresh: onRefresh!, child: list);
  }
}

class Gap extends StatelessWidget {
  const Gap(this.size, {super.key});
  final double size;
  @override
  Widget build(BuildContext context) => SizedBox(height: size, width: size);
}

class SectionLabel extends StatelessWidget {
  const SectionLabel(this.label, {this.trailing, this.onTrailing, super.key});
  final String label;
  final String? trailing;
  final VoidCallback? onTrailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 22, bottom: 12, left: 2, right: 2),
      child: Row(
        children: [
          Expanded(child: Text(label, style: display(19))),
          if (trailing != null) GestureDetector(onTap: onTrailing, child: Text(trailing!, style: body(13, color: primary, weight: FontWeight.w600))),
        ],
      ),
    );
  }
}

// ───────────────────────── Шторки, тости, діалоги ─────────────────────────

void toast(BuildContext context, Object message) {
  final text = '$message';
  ScaffoldMessenger.maybeOf(context)
    ?..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text)));
}

/// Шторка знизу зі скляним фоном, ручкою й заголовком.
Future<T?> showGcSheet<T>(BuildContext context, {String? title, String? subtitle, required Widget Function(BuildContext sheet) builder, bool scroll = true, double? height}) {
  final scope = context.getInheritedWidgetOfExactType<AppScope>();
  return showModalBottomSheet<T>(
    context: context,
    // Над таб-баром і міні-плеєром оболонки, а не під ними.
    useRootNavigator: true,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: popover,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      side: BorderSide(color: lineStrong),
    ),
    // Аркуш живе в кореневому навігаторі, вище за AppScope оболонки. Тому вміст будуємо під
    // перенесеним AppScope, і `sheet` у builder — контекст усередині нього: AppScope.read(sheet) працює.
    builder: (route) {
      Widget build(BuildContext sheet) {
      final content = Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 6),
              width: 40,
              height: 4,
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.16), borderRadius: BorderRadius.circular(4)),
            ),
          ),
          if (title != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 8, 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: display(19)),
                        if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(subtitle, style: body(13, color: muted).copyWith(height: 1.4))),
                      ],
                    ),
                  ),
                  IconButton(onPressed: () => Navigator.pop(sheet), icon: const Icon(LucideIcons.x, color: muted)),
                ],
              ),
            ),
          Flexible(child: builder(sheet)),
        ],
      );
      return Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(sheet).bottom),
        child: height == null ? content : SizedBox(height: height, child: content),
      );
      }

      final inner = Builder(builder: build);
      return scope == null ? inner : AppScope(session: scope.session, player: scope.player, child: inner);
    },
  );
}

Future<bool> confirm(BuildContext context, String title, {String? text, String action = 'Так', bool danger = false}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (dialog) => AlertDialog(
      title: Text(title),
      content: text == null ? null : Text(text),
      actions: [
        TextButton(onPressed: () => Navigator.pop(dialog, false), child: Text('Скасувати', style: body(14, color: muted))),
        TextButton(onPressed: () => Navigator.pop(dialog, true), child: Text(action, style: body(14, color: danger ? dangerSoft : primary, weight: FontWeight.w700))),
      ],
    ),
  );
  return ok == true;
}

/// Діалог з одним полем (причина відмови, назва тощо).
Future<String?> askText(BuildContext context, String title, {String hint = '', String initial = '', String action = 'Зберегти', int maxLines = 1}) async {
  final controller = TextEditingController(text: initial);
  final ok = await showDialog<bool>(
    context: context,
    builder: (dialog) => AlertDialog(
      title: Text(title),
      content: GcField(controller: controller, label: hint, maxLines: maxLines, autofocus: true),
      actions: [
        TextButton(onPressed: () => Navigator.pop(dialog, false), child: Text('Скасувати', style: body(14, color: muted))),
        TextButton(onPressed: () => Navigator.pop(dialog, true), child: Text(action, style: body(14, color: primary, weight: FontWeight.w700))),
      ],
    ),
  );
  final value = controller.text.trim();
  controller.dispose();
  return ok == true ? value : null;
}

/// Виконує дію з тостом про помилку; повертає true, якщо вдалося.
Future<bool> attempt(BuildContext context, Future<dynamic> Function() action, {String? success}) async {
  try {
    final result = await action();
    if (!context.mounted) return true;
    final message = success ?? (result is Map ? text(result['message']) : null);
    if (message != null) toast(context, message);
    return true;
  } catch (e) {
    if (context.mounted) toast(context, e);
    return false;
  }
}

// ───────────────────────── Час ─────────────────────────

String clock(dynamic iso) {
  final raw = text(iso);
  final dt = raw == null ? null : DateTime.tryParse(raw)?.toLocal();
  if (dt == null) return '';
  return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
}

const _monthsShort = ['січ.', 'лют.', 'бер.', 'квіт.', 'трав.', 'черв.', 'лип.', 'серп.', 'вер.', 'жовт.', 'лист.', 'груд.'];
const monthsGenitive = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

String plural(int n, String one, String few, String many) {
  final mod10 = n % 10;
  final mod100 = n % 100;
  if (mod10 == 1 && mod100 != 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/// «щойно», «5 хвилин тому», «сьогодні о 00:38», «вчора о 12:00», «3 жовт. о 14:02».
String ago(dynamic iso) {
  final raw = text(iso);
  final dt = raw == null ? null : DateTime.tryParse(raw)?.toLocal();
  if (dt == null) return '';
  final now = DateTime.now();
  final diff = now.difference(dt);
  if (diff.inSeconds < 60) return 'щойно';
  if (diff.inMinutes < 60) return '${diff.inMinutes} ${plural(diff.inMinutes, 'хвилину', 'хвилини', 'хвилин')} тому';
  if (diff.inHours < 12) return '${diff.inHours} ${plural(diff.inHours, 'годину', 'години', 'годин')} тому';
  final time = clock(raw);
  if (DateUtils.isSameDay(dt, now)) return 'сьогодні о $time';
  if (DateUtils.isSameDay(dt, now.subtract(const Duration(days: 1)))) return 'вчора о $time';
  final date = '${dt.day} ${_monthsShort[dt.month - 1]}${dt.year == now.year ? '' : ' ${dt.year}'}';
  return '$date о $time';
}

/// Коротка мітка для списку чатів: «13:32», «вчора», «3 жовт.».
String shortStamp(dynamic iso) {
  final raw = text(iso);
  final dt = raw == null ? null : DateTime.tryParse(raw)?.toLocal();
  if (dt == null) return '';
  final now = DateTime.now();
  if (DateUtils.isSameDay(dt, now)) return clock(raw);
  if (DateUtils.isSameDay(dt, now.subtract(const Duration(days: 1)))) return 'вчора';
  return '${dt.day} ${_monthsShort[dt.month - 1]}';
}

String fullDate(dynamic iso) {
  final raw = text(iso);
  final dt = raw == null ? null : DateTime.tryParse(raw)?.toLocal();
  if (dt == null) return '';
  return '${dt.day} ${monthsGenitive[dt.month - 1]} ${dt.year} р.';
}

String duration(dynamic seconds) {
  final total = seconds is num ? seconds.round() : int.tryParse('$seconds') ?? 0;
  final h = total ~/ 3600;
  final m = (total % 3600) ~/ 60;
  final s = (total % 60).toString().padLeft(2, '0');
  return h > 0 ? '$h:${m.toString().padLeft(2, '0')}:$s' : '$m:$s';
}

String compact(dynamic value) {
  final n = value is num ? value.toInt() : int.tryParse('$value') ?? 0;
  final digits = n.abs().toString();
  final out = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) out.write(' ');
    out.write(digits[i]);
  }
  return '${n < 0 ? '−' : ''}$out';
}

int intOf(dynamic value, [int fallback = 0]) => value is int ? value : (value is num ? value.toInt() : int.tryParse('$value') ?? fallback);

Map<String, dynamic> mapOf(dynamic value) => value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};
