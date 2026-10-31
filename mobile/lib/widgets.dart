import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'core/widgets/arctic_glass/arctic_glass.dart';
import 'plus.dart';
import 'seasonal.dart';
import 'state.dart';
import 'subscription.dart';
import 'theme.dart';
import 'i18n.dart';
import 'skeletons.dart';

// ───────────────────────── Тло й логотип ─────────────────────────

/// Тло всіх екранів — ArcticBackground дизайн-системи «Spatial Glass»: bgBase і два тихі сяйва
/// (сапфір угорі ліворуч, крижаний ціан унизу праворуч).
class Stage extends StatelessWidget {
  const Stage({required this.child, super.key});
  final Widget child;

  @override
  Widget build(BuildContext context) => ArcticBackground(child: child);
}

/// Знак GameCon — неонова «G» (той самий, що на значку застосунку й на сайті).
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
      ),
      child: Image.asset('assets/brand/logo-mark.png', width: size, height: size, filterQuality: FilterQuality.medium),
    );
  }
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
  GradientText(this.value, {required this.style, Gradient? gradient, super.key}) : gradient = gradient ?? brand;
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

/// Картка — матове скло iOS: справжнє розмиття фону з насиченням, матова тонировка, грань,
/// блік угорі й м'яка тінь назовні (ArcticGlassContainer).
class Glass extends StatelessWidget {
  const Glass({required this.child, this.padding = const EdgeInsets.all(16), this.radius = AppRadii.card, this.onTap, this.gradient, this.border, this.overlay, super.key});
  final Widget child;
  /// Шар поверх картки на весь її розмір (напр. жива рамка GameCon+).
  final Widget? overlay;
  final EdgeInsets padding;
  final double radius;
  final VoidCallback? onTap;
  final Gradient? gradient;
  final Color? border;

  @override
  Widget build(BuildContext context) {
    final glass = ArcticGlassContainer(width: double.infinity, padding: padding, radius: radius, fill: gradient, borderColor: border, onTap: onTap, child: child);
    return overlay == null ? glass : Stack(children: [glass, Positioned.fill(child: overlay!)]);
  }
}

/// Скло нерухомих панелей (вкладки розділу, міні-плеєр): поверхня доку з розмиттям 24.
class MatteGlass extends StatelessWidget {
  const MatteGlass({required this.child, this.borderRadius = ArcticDock.radius, this.padding, this.width, this.height, super.key});
  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry? padding;
  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: ArcticDockSurface(
        height: height,
        radius: borderRadius,
        child: padding == null ? child : Padding(padding: padding!, child: child),
      ),
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
      padding: EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          if (icon != null) ...[Icon(icon, size: 16, color: accent), SizedBox(width: 8)],
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
      padding: EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: display(24)),
                if (subtitle != null) Padding(padding: EdgeInsets.only(top: 6), child: Text(subtitle!, style: body(13.5, color: muted).copyWith(height: 1.35))),
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
  HeroCard({required this.title, this.accent, this.after, this.badge, this.badgeIcon, this.text, this.children = const [], this.tint = indigo, Gradient? accentGradient, super.key}) : accentGradient = accentGradient ?? brand;
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
      padding: EdgeInsets.fromLTRB(18, 18, 18, 18),
      gradient: LinearGradient(
        colors: [tint.withValues(alpha: 0.22), cardTop, Color(0xFF1A1230)],
        stops: [0, 0.55, 1],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (badge != null) ...[
            Pill(label: badge!, icon: badgeIcon, color: tint == gold ? gold : Color(0xFFC7CCF0)),
            SizedBox(height: 12),
          ],
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text('$title${accent == null ? '' : ' '}', style: display(26)),
              if (accent != null) GradientText(accent!, style: display(26), gradient: accentGradient),
              if (after != null) Text(' $after', style: display(26)),
            ],
          ),
          if (text != null) Padding(padding: EdgeInsets.only(top: 10), child: Text(text!, style: body(14, color: soft.withValues(alpha: 0.8)).copyWith(height: 1.45))),
          if (children.isNotEmpty) SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }
}

// ───────────────────────── Кнопки ─────────────────────────

/// Головна кнопка: сапфіровий градієнт (ArcticGlassButton).
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({required this.label, required this.onPressed, this.icon, this.expand = true, this.compact = false, this.busy = false, super.key});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool expand;
  final bool compact;
  final bool busy;

  @override
  Widget build(BuildContext context) =>
      ArcticGlassButton(label: label, onPressed: onPressed, icon: icon, expand: expand, compact: compact, busy: busy);
}

/// Скляна другорядна кнопка («Редагувати профіль», «Написати»).
class GhostButton extends StatelessWidget {
  GhostButton({required this.label, required this.onPressed, this.icon, this.expand = true, this.compact = false, Color? color, this.iconColor, super.key}) : color = color ?? ink;
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool expand;
  final bool compact;
  final Color color;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) => ArcticGlassButton(
    label: label,
    onPressed: onPressed,
    icon: icon,
    kind: ArcticButtonKind.glass,
    expand: expand,
    compact: compact,
    color: color,
    iconColor: iconColor,
  );
}

class DangerButton extends StatelessWidget {
  const DangerButton({required this.label, required this.onPressed, this.icon, this.expand = false, super.key});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool expand;

  @override
  Widget build(BuildContext context) =>
      ArcticGlassButton(label: label, onPressed: onPressed, icon: icon, kind: ArcticButtonKind.danger, expand: expand, compact: true);
}

/// Кругла іконка-кнопка (скріпка, мікрофон, ⋯).
class RoundIcon extends StatelessWidget {
  RoundIcon({required this.icon, required this.onTap, this.size = 40, Color? color, this.filled = false, this.tooltip, super.key}) : color = color ?? muted;
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
      shape: CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: CircleBorder(),
        child: Ink(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: filled ? buttonGradient : null,
            color: filled ? null : fg.withValues(alpha: 0.05),
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
    // Поле — матове скло: справжнє розмиття фону (16) під напівпрозорою заливкою.
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: BackdropFilter(filter: arcticGlassFilter(AppBlur.control), child: _field()),
    );
  }

  Widget _field() {
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
        fillColor: enabled ? field : field.withValues(alpha: field.a * 0.5),
        isDense: true,
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: dense ? 11 : 15),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
        disabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: primary, width: 1.4)),
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
      padding: EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: body(13, color: soft, weight: FontWeight.w500)),
          SizedBox(height: 7),
          child,
          if (hint != null) Padding(padding: EdgeInsets.only(top: 6), child: Text(hint!, style: body(11.5, color: faint))),
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
      padding: EdgeInsets.only(left: 14, right: 8),
      decoration: BoxDecoration(color: field, borderRadius: BorderRadius.circular(14)),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          isExpanded: expand,
          hint: hint == null ? null : Text(hint!, style: body(14.5, color: faint)),
          dropdownColor: popover,
          borderRadius: BorderRadius.circular(14),
          icon: Icon(LucideIcons.chevronDown, color: muted),
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
  SegmentOption(this.id, this.label, {this.icon, this.count});
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
  static BoxDecoration get _pill => BoxDecoration(color: palette.isLight ? card : fg.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(14));

  @override
  Widget build(BuildContext context) {
    Widget content(SegmentOption option, bool on) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (option.icon != null) ...[
            TweenAnimationBuilder<Color?>(
              tween: ColorTween(end: on ? accent : muted),
              duration: _motion,
              builder: (_, color, _) => Icon(option.icon, size: 16, color: color),
            ),
            SizedBox(width: 7),
          ],
          AnimatedDefaultTextStyle(
            duration: _motion,
            style: body(13.5, color: on ? ink : muted, weight: FontWeight.w600).copyWith(height: 1.2),
            child: Text(option.label, maxLines: 1, softWrap: false),
          ),
          if (option.count != null) ...[
            SizedBox(width: 6),
            Container(
              padding: EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(color: fg.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(10)),
              child: Text('${option.count}', maxLines: 1, softWrap: false, style: body(11, color: muted, weight: FontWeight.w600)),
            ),
          ],
        ],
      );
    }

    final frame = BoxDecoration(color: fg.withValues(alpha: palette.isLight ? 0.05 : 0.04), borderRadius: BorderRadius.circular(18));

    if (scroll) {
      return Container(
        padding: EdgeInsets.all(4),
        decoration: frame,
        child: EdgeFade(
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
                    padding: EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                    decoration: option.id == selected ? _pill : _pill.copyWith(color: Colors.transparent),
                    child: content(option, option.id == selected),
                  ),
                ),
              ),
          ]),
          ),
        ),
      );
    }

    final index = options.indexWhere((o) => o.id == selected);
    return Container(
      padding: EdgeInsets.all(4),
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
                    padding: EdgeInsets.symmetric(horizontal: 8, vertical: 11),
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
      duration: Duration(milliseconds: 280),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      layoutBuilder: (current, previous) => Stack(alignment: Alignment.topCenter, children: [...previous, ?current]),
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: SlideTransition(position: Tween(begin: Offset(0, 0.02), end: Offset.zero).animate(animation), child: child),
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
              padding: EdgeInsets.only(right: 8),
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
        duration: Duration(milliseconds: 180),
        padding: EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          gradient: selected ? buttonGradient : null,
          color: selected ? null : fg.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? Colors.transparent : lineStrong),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[Icon(icon, size: 14, color: selected ? Colors.white : muted), SizedBox(width: 6)],
            Text(label, style: body(13, color: selected ? Colors.white : soft, weight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}

/// Маленький бейдж («Адміністратор», «ПК», «RAGE:MP», «Набір відкрито»).
class Pill extends StatelessWidget {
  Pill({required this.label, this.icon, Color? color, this.background, this.border, super.key}) : color = color ?? soft;
  final String label;
  final IconData? icon;
  final Color color;
  final Color? background;
  final Color? border;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: background ?? color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(10),
        // Без обводки — лише м'яка заливка кольору (обводка тільки якщо задана явно).
        border: border == null ? null : Border.all(color: border!),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 12, color: color), SizedBox(width: 4)],
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
  const Avatar({required this.name, this.url, this.size = 44, this.online = false, this.ring = false, this.square = false, this.frame, super.key});
  final String? url;
  /// Рамка GameCon+ (кольори з `plus.frame`): тонке двоколірне кільце.
  final List<Color>? frame;
  final String name;
  final double size;
  final bool online;
  final bool ring;
  final bool square;

  static final _palette = [
    [Color(0xFF0A84FF), Color(0xFF00D2FF)],
    [Color(0xFF4F8BFF), Color(0xFF38E1FF)],
    [Color(0xFF38BDF8), Color(0xFF00D2FF)],
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
    final framed = frame != null && !ring && !square;
    final gap = framed ? (size * 0.035).clamp(1.5, 3.0) : 0.0;
    final inner = size - gap * 4;
    Widget face = ClipRRect(
      borderRadius: radius,
      child: photo == null
          ? Container(
              width: inner,
              height: inner,
              alignment: Alignment.center,
              decoration: BoxDecoration(gradient: LinearGradient(colors: colors, begin: Alignment.topLeft, end: Alignment.bottomRight)),
              child: Text(initials(name), style: display(inner * 0.34, color: Colors.white)),
            )
          : CachedNetworkImage(
              imageUrl: photo,
              fit: BoxFit.cover,
              width: inner,
              height: inner,
              placeholder: (_, _) => Container(color: raised),
              errorWidget: (_, _, _) => Container(color: raised),
            ),
    );
    if (framed) {
      face = Container(
        padding: EdgeInsets.all(gap),
        decoration: BoxDecoration(borderRadius: radius, gradient: LinearGradient(colors: frame!.length > 1 ? frame! : [frame!.first, frame!.first], begin: Alignment.topLeft, end: Alignment.bottomRight)),
        child: Container(padding: EdgeInsets.all(gap), decoration: BoxDecoration(borderRadius: radius, color: voidColor), child: face),
      );
    }
    if (ring) {
      final rim = frame == null ? brand : LinearGradient(colors: frame!.length > 1 ? frame! : [frame!.first, frame!.first], begin: Alignment.topLeft, end: Alignment.bottomRight);
      face = Container(
        padding: EdgeInsets.all(size * 0.03),
        decoration: BoxDecoration(borderRadius: radius, gradient: rim),
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
          // Новий рік: шапка Санти на аватарах (крім дрібних і квадратних), як на сайті.
          if (!square && size >= 28)
            ValueListenableBuilder<String?>(
              valueListenable: currentSeason,
              builder: (_, season, _) => season == 'newyear' ? SantaHat(size: size) : const Positioned(left: 0, top: 0, child: SizedBox.shrink()),
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
        padding: EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        child: Row(
          children: [
            Avatar(url: text(user['avatar_url']), name: name, size: size, online: user['is_online'] == true, frame: avatarFrameOf(user)),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  PlusNameRow(user: user, style: body(15, weight: FontWeight.w600)),
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
          decoration: BoxDecoration(color: fg.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(18)),
          child: Icon(icon, color: accent, size: 26),
        ),
        SizedBox(height: 16),
        Text(title, textAlign: TextAlign.center, style: display(17)),
        if (text != null) Padding(padding: EdgeInsets.only(top: 8), child: Text(text!, textAlign: TextAlign.center, style: body(13.5, color: muted).copyWith(height: 1.45))),
        if (action != null) ...[
          SizedBox(height: 18),
          PrimaryButton(label: action!, icon: actionIcon, onPressed: onAction, expand: false, compact: true),
        ],
      ],
    );
    if (!boxed) return Padding(padding: EdgeInsets.symmetric(vertical: 22, horizontal: 12), child: content);
    return Glass(padding: EdgeInsets.fromLTRB(20, 32, 20, 28), child: content);
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
      padding: EdgeInsets.symmetric(vertical: 22),
      child: Center(
        child: Column(
          children: [
            Icon(icon, color: faint, size: 30),
            SizedBox(height: 10),
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
          padding: EdgeInsets.symmetric(vertical: 6),
          child: Column(
            children: [
              Text(value, style: display(20)),
              SizedBox(height: 4),
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
  MetricTile({required this.label, required this.value, Color? color, this.icon, this.caps = false, this.gradient, super.key}) : color = color ?? ink;
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
      decoration: BoxDecoration(color: fg.withValues(alpha: 0.04), borderRadius: BorderRadius.circular(18)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (caps)
            Row(children: [
              Expanded(
                child: SizedBox(
                  height: 28,
                  child: Text(label.toUpperCase(), maxLines: 2, overflow: TextOverflow.ellipsis, style: body(11, color: muted, weight: FontWeight.w600).copyWith(letterSpacing: 0.8, height: 1.3)),
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
    [Color(0xFF0A84FF), Color(0xFF4F8BFF)],
    [Color(0xFF38BDF8), Color(0xFFF0734A)],
    [Color(0xFF00D2FF), Color(0xFF0A84FF)],
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
            errorWidget: (_, _, _) => Container(color: raised, child: Icon(LucideIcons.imageOff, color: faint)),
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
          return const ScreenSkeleton();
        }
        if (snapshot.hasError) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: EmptyState(
                icon: LucideIcons.wifiOff,
                title: tr('Не вдалося завантажити'),
                text: '${snapshot.error}',
                action: tr('Спробувати знову'),
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

/// Висота плаваючої капсули шапки і відступ над нею.
const headerCapsuleHeight = 56.0;
const headerTopGap = 4.0;

/// Висота прозорої шапки поверх контенту (відступ + капсула), без системного відступу.
const siteBarHeight = headerTopGap + headerCapsuleHeight;

/// Нижній острів-меню (плаваючий док) на телефоні разом із відступом знизу, без системного відступу.
const islandExtent = ArcticDock.height + ArcticDock.bottom;

/// Скругленість нижніх панелей — капсула доку (32): острів, вкладки «Музики» й міні-плеєр однакові.
const barRadius = ArcticDock.radius;

/// Іконка й підпис вкладки нижньої панелі: вибрана світиться неоновим синім (без підкладок і рамок),
/// у темній темі яскравіше, у світлій — стриманіше. Перехід між вкладками ~200 мс.
class NeonTabLabel extends StatelessWidget {
  const NeonTabLabel({required this.icon, required this.label, required this.active, this.badge, this.weight = FontWeight.w500, super.key});
  final IconData icon;
  final String label;
  final bool active;
  final Widget? badge;
  final FontWeight weight;

  @override
  Widget build(BuildContext context) {
    final idle = palette.isLight ? ink.withValues(alpha: 0.55) : muted;
    return TweenAnimationBuilder<double>(
      tween: Tween(end: active ? 1 : 0),
      duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      builder: (context, t, _) {
        final color = Color.lerp(idle, neonBlue, t)!;
        final strength = palette.isLight ? 0.5 : 1.0;
        List<Shadow> glow(double near, double far) => t == 0
            ? const []
            : [
                Shadow(color: neonBlue.withValues(alpha: 0.8 * strength * t), blurRadius: near),
                Shadow(color: neonBlue.withValues(alpha: 0.35 * strength * t), blurRadius: far),
              ];
        return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Stack(clipBehavior: Clip.none, children: [
            Icon(icon, size: 22, color: color, shadows: glow(10, 22)),
            if (badge case final b?) Positioned(right: -10, top: -4, child: b),
          ]),
          const SizedBox(height: 2),
          Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(11, color: color, weight: weight).copyWith(shadows: glow(6, 14))),
        ]);
      },
    );
  }
}

/// Плаваючий плеєр разом із відступом над меню.
const miniPlayerExtent = ArcticDock.height + 8;

/// З якої ширини екрана (планшет, горизонтальний телефон-«лопата») показуємо бічне меню замість нижнього.
const tabletWidth = 840.0;

/// Ширина бічного меню на планшеті.
const sideNavWidth = 240.0;

/// Найбільша ширина стрічки на планшеті — як центральна колонка сайту.
const tabletContentWidth = 820.0;

/// Ширина стрічки на вертикальному планшеті (3:4), де лишається нижня панель.
const tabletPortraitWidth = 680.0;

/// Скільки триває заміна нижньої панелі (острів ↔ вкладки «Музики»).
const bottomBarSwap = Duration(milliseconds: 250);

/// Сторінки розділу «Музика» з власною панеллю вкладок: там вона стоїть на місці острова.
bool hasMusicTabs(Uri uri) => uri.queryParameters['user'] == null && RegExp(r'^/music(/(new|radio|library))?/?$').hasMatch(uri.path);

/// Розділ «Музика» (свій, не чужі аудіозаписи `?user=`): там своя шапка з виходом «Назад».
bool isMusicSection(Uri uri) => uri.queryParameters['user'] == null && RegExp(r'^/music(/|$)').hasMatch(uri.path);

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
  return top + siteBarHeight + 12;
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
      physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
      padding: base.copyWith(
        top: base.top + siteHeaderInset(context),
        bottom: base.bottom + ShellChrome.bottomOf(context),
      ),
      // Картки з'являються каскадом; показані раніше (за ключем) — без повтору.
      children: [for (final child in children) ArcticCascade(key: child.key is GlobalKey ? null : child.key, id: child.key, child: child)],
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
      padding: EdgeInsets.only(top: 22, bottom: 12, left: 2, right: 2),
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

enum ToastKind { success, error, warning, info }

/// Тост, як на сайті (.gc-toast): угорі під шапкою, іконка в кольорі типу, текст, хрестик
/// і смужка часу. Нові — зверху; змахнути вгору чи вбік — закрити. Помилки (винятки, «Не вдалося…»)
/// стають червоними, решта — зеленими, якщо тип не вказано.
void toast(BuildContext context, Object message, {ToastKind? kind}) {
  final text = '$message'.replaceFirst(RegExp(r'^Exception: '), '');
  // Ліміт GameCon+ від сервера («З GameCon+ — до 25») — лише пояснення, що це, без жодної оплати.
  final plus = isPlusLimit(message);
  final lower = text.toLowerCase();
  final type = kind ??
      (plus
          ? ToastKind.info
          : message is! String || lower.startsWith('не ') || lower.contains('не вдалося') || lower.contains('помилк')
              ? ToastKind.error
              : ToastKind.success);
  final overlay = Overlay.maybeOf(context, rootOverlay: true);
  if (overlay == null) return;
  _Toasts.instance.show(
    overlay,
    _ToastData(text, type, action: plus ? (tr('Що таке GameCon+?'), () => showProFeatures(context)) : null),
  );
}

class _ToastData {
  _ToastData(this.text, this.kind, {this.action});
  final String text;
  final ToastKind kind;
  final (String, VoidCallback)? action;
  final key = UniqueKey();
}

/// Стопка тостів поверх усього застосунку (один шар у кореневому Overlay).
class _Toasts {
  _Toasts._();
  static final instance = _Toasts._();
  static const duration = Duration(milliseconds: 4500);
  static const visible = 3;

  final items = ValueNotifier<List<_ToastData>>([]);
  OverlayEntry? _entry;

  void show(OverlayState overlay, _ToastData data) {
    final list = [data, ...items.value];
    items.value = list.length > visible ? list.sublist(0, visible) : list;
    // Один шар на всі тости (mounted ще false до першого кадру, тож перевіряємо саму наявність).
    if (_entry == null) {
      _entry = OverlayEntry(builder: (_) => _ToastStack(items: items, onDismiss: dismiss));
      overlay.insert(_entry!);
    }
  }

  void dismiss(_ToastData data) {
    items.value = [for (final item in items.value) if (item != data) item];
    if (items.value.isEmpty) {
      _entry?.remove();
      _entry = null;
    }
  }
}

class _ToastStack extends StatelessWidget {
  const _ToastStack({required this.items, required this.onDismiss});
  final ValueNotifier<List<_ToastData>> items;
  final ValueChanged<_ToastData> onDismiss;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final wide = media.size.width >= tabletWidth;
    return Positioned(
      top: media.viewPadding.top + siteBarHeight + 8,
      left: wide ? null : 12,
      right: wide ? 16 : 12,
      child: SafeArea(
        top: false,
        bottom: false,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: wide ? 380 : 560),
          child: ValueListenableBuilder(
            valueListenable: items,
            builder: (context, list, _) => Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final item in list)
                  Padding(
                    key: item.key,
                    padding: EdgeInsets.only(bottom: 10),
                    child: _ToastCard(data: item, onDismiss: () => onDismiss(item)),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ToastCard extends StatefulWidget {
  const _ToastCard({required this.data, required this.onDismiss});
  final _ToastData data;
  final VoidCallback onDismiss;

  @override
  State<_ToastCard> createState() => _ToastCardState();
}

class _ToastCardState extends State<_ToastCard> with TickerProviderStateMixin {
  late final appear = AnimationController(vsync: this, duration: Duration(milliseconds: 320));
  late final timer = AnimationController(vsync: this, duration: _Toasts.duration);
  bool leaving = false;

  @override
  void initState() {
    super.initState();
    appear.forward();
    timer.addStatusListener((status) {
      if (status == AnimationStatus.completed) _close();
    });
    timer.forward();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) appear.value = 1;
  }

  @override
  void dispose() {
    appear.dispose();
    timer.dispose();
    super.dispose();
  }

  Future<void> _close() async {
    if (leaving || !mounted) return;
    leaving = true;
    timer.stop();
    await appear.reverse();
    widget.onDismiss();
  }

  @override
  Widget build(BuildContext context) {
    // «!» та «i» — самим знаком у кружку (іконки Lucide для них уже мають власне коло).
    final (color, Widget mark) = switch (widget.data.kind) {
      ToastKind.success => (Color(0xFF22C55E), Icon(LucideIcons.check, size: 18, color: Colors.white)),
      ToastKind.error => (Color(0xFFF43F5E), Icon(LucideIcons.x, size: 18, color: Colors.white)),
      ToastKind.warning => (Color(0xFFF59E0B), Text('!', style: body(17, color: Colors.white, weight: FontWeight.w800).copyWith(height: 1))),
      ToastKind.info => (primary, Text('i', style: body(17, color: Colors.white, weight: FontWeight.w800).copyWith(height: 1))),
    };
    final action = widget.data.action;
    final curve = CurvedAnimation(parent: appear, curve: Curves.easeOutCubic, reverseCurve: Curves.easeInCubic);
    return FadeTransition(
      opacity: curve,
      child: SlideTransition(
        position: Tween(begin: Offset(0, -0.4), end: Offset.zero).animate(curve),
        child: Dismissible(
          key: widget.data.key,
          direction: DismissDirection.up,
          onDismissed: (_) => widget.onDismiss(),
          child: Semantics(
            liveRegion: true,
            child: Material(
              color: Colors.transparent,
              child: GestureDetector(
                // Утримання — пауза таймера, як наведення курсора на сайті.
                onTapDown: (_) => timer.stop(),
                onTapUp: (_) => timer.forward(),
                onTapCancel: () => timer.forward(),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                      child: Container(
                        color: popover.withValues(alpha: 0.96),
                        child: Stack(children: [
                          Padding(
                            padding: EdgeInsets.fromLTRB(14, 14, 8, 16),
                            child: Row(children: [
                              Container(
                                width: 32,
                                height: 32,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                                child: mark,
                              ),
                              SizedBox(width: 12),
                              Expanded(child: Text(widget.data.text, style: body(14, weight: FontWeight.w600).copyWith(height: 1.35))),
                              if (action != null)
                                TextButton(
                                  onPressed: () {
                                    _close();
                                    action.$2();
                                  },
                                  child: Text(action.$1, style: body(13, color: primary, weight: FontWeight.w600)),
                                ),
                              IconButton(
                                tooltip: tr('Закрити'),
                                visualDensity: VisualDensity.compact,
                                onPressed: _close,
                                icon: Icon(LucideIcons.x, size: 16, color: ink.withValues(alpha: 0.5)),
                              ),
                            ]),
                          ),
                          // Смужка часу: зменшується, поки тост на екрані.
                          if (!MediaQuery.disableAnimationsOf(context))
                            Positioned(
                              left: 0,
                              right: 0,
                              bottom: 0,
                              height: 3,
                              child: AnimatedBuilder(
                                animation: timer,
                                builder: (_, _) => FractionallySizedBox(
                                  alignment: Alignment.centerLeft,
                                  widthFactor: 1 - timer.value,
                                  child: ColoredBox(color: color),
                                ),
                              ),
                            ),
                        ]),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
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
    // Прозора шторка: поверхню малює ArcticGlassSheetSurface (glassTier3, розмиття 28).
    backgroundColor: Colors.transparent,
    elevation: 0,
    // Аркуш живе в кореневому навігаторі, вище за AppScope оболонки. Тому вміст будуємо під
    // перенесеним AppScope, і `sheet` у builder — контекст усередині нього: AppScope.read(sheet) працює.
    builder: (route) {
      Widget build(BuildContext sheet) {
      final content = Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null)
            Padding(
              padding: EdgeInsets.fromLTRB(20, 8, 8, 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: display(19)),
                        if (subtitle != null) Padding(padding: EdgeInsets.only(top: 6), child: Text(subtitle, style: body(13, color: muted).copyWith(height: 1.4))),
                      ],
                    ),
                  ),
                  IconButton(onPressed: () => Navigator.pop(sheet), icon: Icon(LucideIcons.x, color: muted)),
                ],
              ),
            ),
          Flexible(child: builder(sheet)),
        ],
      );
      final keyboard = MediaQuery.viewInsetsOf(sheet).bottom;
      return Padding(
        padding: EdgeInsets.only(bottom: keyboard),
        child: ArcticGlassSheetSurface(
          child: Padding(
            // Під клавіатурою відступ уже є; інакше — системна смуга жестів (+12, щоб нижня кнопка
            // не прилипала до неї). Смугу беремо з самого екрана: усередині шторки MediaQuery її обнуляє.
            padding: EdgeInsets.only(bottom: keyboard > 0 ? 0 : math.max(MediaQuery.viewPaddingOf(sheet).bottom, MediaQueryData.fromView(View.of(sheet)).viewPadding.bottom) + 12),
            child: height == null ? content : SizedBox(height: height, child: content),
          ),
        ),
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
        TextButton(onPressed: () => Navigator.pop(dialog, false), child: Text(tr('Скасувати'), style: body(14, color: muted))),
        TextButton(onPressed: () => Navigator.pop(dialog, true), child: Text(tr(action), style: body(14, color: danger ? dangerSoft : primary, weight: FontWeight.w700))),
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
        TextButton(onPressed: () => Navigator.pop(dialog, false), child: Text(tr('Скасувати'), style: body(14, color: muted))),
        TextButton(onPressed: () => Navigator.pop(dialog, true), child: Text(tr(action), style: body(14, color: primary, weight: FontWeight.w700))),
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

final _monthsShort = [tr('січ.'), tr('лют.'), tr('бер.'), tr('квіт.'), tr('трав.'), tr('черв.'), tr('лип.'), tr('серп.'), tr('вер.'), tr('жовт.'), tr('лист.'), tr('груд.')];
final monthsGenitive = [tr('січня'), tr('лютого'), tr('березня'), tr('квітня'), tr('травня'), tr('червня'), tr('липня'), tr('серпня'), tr('вересня'), tr('жовтня'), tr('листопада'), tr('грудня')];

/// Множина: форми українські («друг / друзі / друзів»), переклад — ті самі три форми через «|».
String plural(int n, String one, String few, String many) {
  final translated = I18n.lookup('$one|$few|$many')?.split('|');
  if (translated != null && translated.length == 3 && I18n.locale != 'uk') {
    // Більшість мов: 1 — однина, решта — множина; слов’янські — як українська.
    const slavic = {'pl', 'cs', 'sk', 'ru', 'be', 'hr', 'sr', 'bs', 'sl'};
    final primary = I18n.locale.split('-').first;
    if (!slavic.contains(primary)) return n == 1 ? translated[0] : translated[2];
    one = translated[0];
    few = translated[1];
    many = translated[2];
  }
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
  if (diff.inSeconds < 60) return tr('щойно');
  if (diff.inMinutes < 60) return tr('{inMinutes} {v} тому', {'inMinutes': diff.inMinutes, 'v': plural(diff.inMinutes, 'хвилину', 'хвилини', 'хвилин')});
  if (diff.inHours < 12) return tr('{inHours} {v} тому', {'inHours': diff.inHours, 'v': plural(diff.inHours, 'годину', 'години', 'годин')});
  final time = clock(raw);
  if (DateUtils.isSameDay(dt, now)) return tr('сьогодні о {time}', {'time': time});
  if (DateUtils.isSameDay(dt, now.subtract(const Duration(days: 1)))) return tr('вчора о {time}', {'time': time});
  final date = '${dt.day} ${_monthsShort[dt.month - 1]}${dt.year == now.year ? '' : ' ${dt.year}'}';
  return tr('{date} о {time}', {'date': date, 'time': time});
}

/// Коротка мітка для списку чатів: «13:32», «вчора», «3 жовт.».
String shortStamp(dynamic iso) {
  final raw = text(iso);
  final dt = raw == null ? null : DateTime.tryParse(raw)?.toLocal();
  if (dt == null) return '';
  final now = DateTime.now();
  if (DateUtils.isSameDay(dt, now)) return clock(raw);
  if (DateUtils.isSameDay(dt, now.subtract(const Duration(days: 1)))) return tr('вчора');
  return '${dt.day} ${_monthsShort[dt.month - 1]}';
}

String fullDate(dynamic iso) {
  final raw = text(iso);
  final dt = raw == null ? null : DateTime.tryParse(raw)?.toLocal();
  if (dt == null) return '';
  return tr('{day} {v} {year} р.', {'day': dt.day, 'v': monthsGenitive[dt.month - 1], 'year': dt.year});
}

String duration(dynamic seconds) {
  final total = seconds is num ? seconds.round() : int.tryParse('$seconds') ?? 0;
  final h = total ~/ 3600;
  final m = (total % 3600) ~/ 60;
  final s = (total % 60).toString().padLeft(2, '0');
  return h > 0 ? '$h:${m.toString().padLeft(2, '0')}:$s' : '$m:$s';
}

/// Коротке число, як на сайті: 999 → 999, 1 000 → 1K, 15 300 → 15,3K, 1 000 000 → 1M.
String compact(dynamic value) {
  final n = value is num ? value.toInt() : int.tryParse('$value') ?? 0;
  final abs = n.abs();
  final sign = n < 0 ? '−' : '';
  for (final (at, suffix) in const [(1000000000, 'B'), (1000000, 'M'), (1000, 'K')]) {
    if (abs >= at) {
      final scaled = abs / at;
      final factor = scaled < 100 ? 10 : 1;
      final cut = (scaled * factor).floor() / factor;
      final text = cut == cut.truncateToDouble() ? cut.toInt().toString() : cut.toStringAsFixed(1).replaceAll('.', ',');
      return '$sign$text$suffix';
    }
  }
  return '$sign$abs';
}

int intOf(dynamic value, [int fallback = 0]) => value is int ? value : (value is num ? value.toInt() : int.tryParse('$value') ?? fallback);

Map<String, dynamic> mapOf(dynamic value) => value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};


final _maskCache = <String, RegExp?>{};

/// Мат зірочками, якщо людина ввімкнула «Приховувати образливі слова» (шаблон приходить із сервера).
String maskProfanity(String value, String? pattern) {
  if (pattern == null || pattern.isEmpty || value.isEmpty) return value;
  final re = _maskCache.putIfAbsent(pattern, () {
    try {
      return RegExp(pattern, unicode: true, caseSensitive: false);
    } catch (_) {
      return null;
    }
  });
  if (re == null) return value;
  return value.replaceAllMapped(re, (m) {
    final word = m[0]!;
    return word.substring(0, 1) + '*' * (word.length - 1 < 1 ? 1 : word.length - 1);
  });
}

/// Назва мови для підпису «Оригінал: …».
String languageName(String code) => switch (code) {
      'uk' => tr('Українська'),
      'en' => 'English',
      'de' => 'Deutsch',
      'fr' => 'Français',
      'es' => 'Español',
      'ru' => tr('Російська'),
      'kk' => 'Қазақ тілі',
      'zh' => '中文',
      'ja' => '日本語',
      _ => code,
    };

/// Панель незбережених змін, як на сайті (settings/pending-bar.tsx): «3 зміни · Скасувати · Зберегти».
/// Зміни видно одразу як попередній перегляд, але записуються лише після «Зберегти».
/// Стоїть над нижнім островом і міні-плеєром; з'являється знизу (RISE).
class PendingBar extends StatelessWidget {
  const PendingBar({required this.count, required this.busy, required this.onDiscard, required this.onSave, super.key});
  final int count;
  final bool busy;
  final VoidCallback onDiscard;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.disableAnimationsOf(context);
    final shown = count > 0;
    return IgnorePointer(
      ignoring: !shown,
      child: AnimatedSlide(
        offset: shown || reduce ? Offset.zero : const Offset(0, 0.4),
        duration: reduce ? Duration.zero : const Duration(milliseconds: 380),
        curve: shown ? Curves.easeOutBack : Curves.easeInCubic,
        child: AnimatedScale(
          scale: shown || reduce ? 1 : 0.98,
          duration: reduce ? Duration.zero : const Duration(milliseconds: 380),
          child: AnimatedOpacity(
            opacity: shown ? 1 : 0,
            duration: reduce ? Duration.zero : const Duration(milliseconds: 220),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 30, sigmaY: 30),
                      child: Container(
                        color: bar.withValues(alpha: 0.95),
                        padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
                        child: Row(children: [
                          _PulseDot(animate: !reduce),
                          const SizedBox(width: 12),
                          Expanded(
                            child: AnimatedSwitcher(
                              duration: reduce ? Duration.zero : const Duration(milliseconds: 200),
                              transitionBuilder: (child, animation) => FadeTransition(
                                opacity: animation,
                                child: SlideTransition(position: Tween(begin: const Offset(0, -0.3), end: Offset.zero).animate(animation), child: child),
                              ),
                              layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerLeft, children: [...previous, ?current]),
                              child: Text(
                                '$count ${plural(count, tr('зміна'), tr('зміни'), tr('змін'))}',
                                key: ValueKey(count),
                                maxLines: 1,
                                style: body(14, color: ink.withValues(alpha: 0.8)).copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed: busy ? null : onDiscard,
                            style: TextButton.styleFrom(foregroundColor: ink.withValues(alpha: 0.6), minimumSize: const Size(0, 38), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                            child: Text(tr('Скасувати'), style: body(14, weight: FontWeight.w500)),
                          ),
                          const SizedBox(width: 4),
                          FilledButton(
                            onPressed: busy ? null : onSave,
                            style: FilledButton.styleFrom(backgroundColor: primary, foregroundColor: Colors.white, minimumSize: const Size(0, 38), padding: const EdgeInsets.symmetric(horizontal: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                            child: Text(busy ? tr('Зберігаємо…') : tr('Зберегти'), style: body(14, color: Colors.white, weight: FontWeight.w600)),
                          ),
                        ]),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PulseDot extends StatefulWidget {
  const _PulseDot({required this.animate});
  final bool animate;

  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot> with SingleTickerProviderStateMixin {
  late final pulse = AnimationController(vsync: this, duration: const Duration(seconds: 1));

  @override
  void initState() {
    super.initState();
    if (widget.animate) pulse.repeat();
  }

  @override
  void dispose() {
    pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: 8,
      child: AnimatedBuilder(
        animation: pulse,
        builder: (_, _) => Stack(clipBehavior: Clip.none, alignment: Alignment.center, children: [
          Transform.scale(
            scale: 1 + pulse.value * 1.5,
            child: Container(decoration: BoxDecoration(shape: BoxShape.circle, color: primary.withValues(alpha: 0.6 * (1 - pulse.value)))),
          ),
          Container(decoration: BoxDecoration(shape: BoxShape.circle, color: primary)),
        ]),
      ),
    );
  }
}

/// М'яке затухання країв горизонтальної прокрутки: видно, що далі є ще вкладки.
/// Край, до якого вже докрутили, не затухає.
class EdgeFade extends StatefulWidget {
  const EdgeFade({required this.child, this.size = 28, super.key});
  final Widget child;
  final double size;

  @override
  State<EdgeFade> createState() => _EdgeFadeState();
}

class _EdgeFadeState extends State<EdgeFade> {
  bool start = false;
  bool end = false;

  bool _update(ScrollMetrics m) {
    if (m.axis != Axis.horizontal) return false;
    final s = m.pixels > m.minScrollExtent + 1;
    final e = m.pixels < m.maxScrollExtent - 1;
    if (s != start || e != end) {
      setState(() {
        start = s;
        end = e;
      });
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    return NotificationListener<ScrollMetricsNotification>(
      onNotification: (n) => _update(n.metrics),
      child: NotificationListener<ScrollNotification>(
        onNotification: (n) => _update(n.metrics),
        child: ShaderMask(
          blendMode: BlendMode.dstIn,
          shaderCallback: (rect) {
            final f = (widget.size / rect.width).clamp(0.0, 0.5);
            return LinearGradient(
              colors: [start ? const Color(0x00000000) : const Color(0xFF000000), const Color(0xFF000000), const Color(0xFF000000), end ? const Color(0x00000000) : const Color(0xFF000000)],
              stops: [0, f, 1 - f, 1],
            ).createShader(rect);
          },
          child: widget.child,
        ),
      ),
    );
  }
}
