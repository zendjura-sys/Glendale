import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

/// Розмір вирізу: ширина й висота мітки в правому верхньому куті (без зазору).
class _NotchSize extends ValueNotifier<Size> {
  _NotchSize() : super(Size.zero);
}

/// Картка GameCon з вирізом під мітку в правому верхньому куті — як `NotchedCard` на сайті й у ПК.
///
/// Правила (див. завдання від 21.11):
/// * **Одна фігура без шва.** Фон і грань — один [Path] ([NotchedCardBorder]); жодних двох контейнерів
///   («вушко» + тіло) і жодної плашки кольору тла поверх картки.
/// * **Заголовок на рівні вирізу.** Перший рядок ([title]) починається від верхнього відступу;
///   ліворуч — [Expanded], праворуч — мітка природної ширини, тож будь-яка мітка («Допис», «Онлайн»,
///   «Можливо, знайомі») не наїжджає на заголовок.
/// * **Без жорстких висот і [Positioned] поверх тексту.** Додаткові дії ([actions]) — у потоці рядка.
/// * **Легка для стрічок.** Форма малюється [CustomPainter]-ом, без `ClipPath`/`saveLayer`; виріз
///   оновлюється в тому ж кадрі (розмір мітки береться під час розкладки).
/// * **Кольори з теми:** `colorScheme.surfaceContainer` (фон), `surfaceContainerHigh` (мітка),
///   `outlineVariant` (грань).
class NotchedCard extends StatefulWidget {
  const NotchedCard({
    this.child,
    this.title,
    this.badge,
    this.actions = const [],
    this.padding = const EdgeInsets.all(14),
    this.radius = 16,
    this.gap = 6,
    this.headerGap = 10,
    this.onTap,
    this.color,
    super.key,
  });

  /// Вміст під заголовком (необов’язково: увесь вміст може бути першим рядком — [title]).
  final Widget? child;

  /// Ліва частина першого рядка: аватар + автор чи значок + назва. Без неї мітка стоїть сама.
  final Widget? title;

  /// Мітка у вирізі (див. [NotchBadge]). Без мітки — звичайна картка без вирізу.
  final Widget? badge;

  /// Дії в рядку заголовка між назвою й вирізом (кнопка «Усі», меню «…»).
  final List<Widget> actions;
  final EdgeInsets padding;
  final double radius;

  /// Однаковий зазор між міткою і краями вирізу (і до краю картки).
  final double gap;

  /// Відступ між першим рядком і вмістом (0 — вміст сам задає свої відступи).
  final double headerGap;
  final VoidCallback? onTap;

  /// Свій фон (тон «живого» блоку); за замовчуванням — `surfaceContainer`.
  final Color? color;

  @override
  State<NotchedCard> createState() => _NotchedCardState();
}

class _NotchedCardState extends State<NotchedCard> {
  final _notch = _NotchSize();

  @override
  void dispose() {
    _notch.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final w = widget;
    final scheme = Theme.of(context).colorScheme;
    final hasBadge = w.badge != null;
    // Мітку зсуваємо в кут: від краю картки до неї рівно [gap], як і від мітки до стінок вирізу.
    final shiftX = w.padding.right - w.gap;
    final shiftY = w.padding.top - w.gap;

    final header = (w.title != null || hasBadge || w.actions.isNotEmpty)
        ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: w.title ?? const SizedBox.shrink()),
            ...w.actions,
            if (hasBadge)
              Padding(
                padding: EdgeInsets.only(left: w.gap + 4),
                child: Transform.translate(
                  offset: Offset(shiftX, -shiftY),
                  child: _ReportSize(notifier: _notch, child: w.badge!),
                ),
              ),
          ])
        : null;

    final content = Padding(
      padding: w.padding,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        ?header,
        if (header != null && w.child != null) SizedBox(height: w.headerGap),
        ?w.child,
      ]),
    );

    final painted = CustomPaint(
      painter: _NotchedCardPainter(
        notch: hasBadge ? _notch : null,
        gap: w.gap,
        radius: w.radius,
        fill: w.color ?? scheme.surfaceContainer,
        edge: scheme.outlineVariant.withValues(alpha: 0.6),
      ),
      child: content,
    );
    if (w.onTap == null) return painted;
    return Material(
      type: MaterialType.transparency,
      child: InkWell(
        onTap: w.onTap,
        customBorder: _InkShape(notch: _notch, gap: w.gap, radius: w.radius),
        child: painted,
      ),
    );
  }
}

/// Заголовок картки: значок акцентного кольору + назва, що обрізається трикрапкою, а не наїжджає на виріз.
class NotchTitle extends StatelessWidget {
  const NotchTitle(this.text, {this.icon, super.key});
  final String text;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Row(children: [
        if (icon != null) ...[Icon(icon, size: 16, color: scheme.primary), const SizedBox(width: 8)],
        Flexible(child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, color: scheme.onSurface))),
      ]),
    );
  }
}

/// Дія в рядку заголовка («Усі», «Змінити») — у потоці, а не поверх тексту.
class NotchAction extends StatelessWidget {
  const NotchAction(this.label, {required this.onTap, super.key});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
          child: Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6))),
        ),
      );
}

/// Мітка у вирізі: таблетка з крапкою стану (необов’язково) і коротким текстом.
class NotchBadge extends StatelessWidget {
  const NotchBadge(this.label, {this.dot, this.icon, super.key});
  final String label;
  final Color? dot;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(color: scheme.surfaceContainerHigh, borderRadius: BorderRadius.circular(99)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (dot != null) ...[
            DecoratedBox(decoration: BoxDecoration(color: dot, shape: BoxShape.circle), child: const SizedBox(width: 6, height: 6)),
            const SizedBox(width: 5),
          ],
          if (icon != null) ...[Icon(icon, size: 11, color: scheme.onSurface.withValues(alpha: 0.75)), const SizedBox(width: 4)],
          Text(label, maxLines: 1, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: scheme.onSurface.withValues(alpha: 0.75))),
        ]),
      ),
    );
  }
}

/// Контур картки з вирізом: зовнішні кути [radius], опуклі заокруглення там, де виріз зустрічає край,
/// і увігнуте — у внутрішньому куті вирізу. Один [Path] — і для фону, і для грані, і для хвилі натискання.
Path notchedCardPath(Rect r, {required Size notch, required double radius, double notchRadius = 10}) {
  final R = radius.clamp(0, r.shortestSide / 2).toDouble();
  final p = Path();
  if (notch.isEmpty) return p..addRRect(RRect.fromRectAndRadius(r, Radius.circular(R)));
  final nw = notch.width.clamp(0, r.width - R * 2).toDouble();
  final nh = notch.height.clamp(0, r.height - R * 2).toDouble();
  final k = notchRadius.clamp(0, (nh / 2).clamp(0, nw / 2)).toDouble();
  final nx = r.right - nw; // ліва стінка вирізу
  final ny = r.top + nh; // дно вирізу
  p
    ..moveTo(r.left + R, r.top)
    ..lineTo(nx - k, r.top)
    ..arcToPoint(Offset(nx, r.top + k), radius: Radius.circular(k)) // опуклий: верхній край → вниз у виріз
    ..lineTo(nx, ny - k)
    ..arcToPoint(Offset(nx + k, ny), radius: Radius.circular(k), clockwise: false) // увігнутий: дно вирізу
    ..lineTo(r.right - k, ny)
    ..arcToPoint(Offset(r.right, ny + k), radius: Radius.circular(k)) // опуклий: дно → правий край
    ..lineTo(r.right, r.bottom - R)
    ..arcToPoint(Offset(r.right - R, r.bottom), radius: Radius.circular(R))
    ..lineTo(r.left + R, r.bottom)
    ..arcToPoint(Offset(r.left, r.bottom - R), radius: Radius.circular(R))
    ..lineTo(r.left, r.top + R)
    ..arcToPoint(Offset(r.left + R, r.top), radius: Radius.circular(R))
    ..close();
  return p;
}

Size _notchOf(ValueListenable<Size>? notch, double gap) {
  final s = notch?.value ?? Size.zero;
  return s.isEmpty ? Size.zero : Size(s.width + gap * 2, s.height + gap * 2);
}

class _NotchedCardPainter extends CustomPainter {
  _NotchedCardPainter({required this.notch, required this.gap, required this.radius, required this.fill, required this.edge}) : super(repaint: notch);
  final ValueListenable<Size>? notch;
  final double gap;
  final double radius;
  final Color fill;
  final Color edge;

  @override
  void paint(Canvas canvas, Size size) {
    final path = notchedCardPath(Offset.zero & size, notch: _notchOf(notch, gap), radius: radius);
    canvas.drawPath(path, Paint()..color = fill);
    canvas.drawPath(
      path,
      Paint()
        ..color = edge
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );
  }

  @override
  bool shouldRepaint(_NotchedCardPainter old) => old.fill != fill || old.edge != edge || old.radius != radius || old.gap != gap || old.notch != notch;
}

/// Форма хвилі натискання — та сама, що й у картки.
class _InkShape extends ShapeBorder {
  const _InkShape({required this.notch, required this.gap, required this.radius});
  final ValueListenable<Size> notch;
  final double gap;
  final double radius;

  @override
  EdgeInsetsGeometry get dimensions => EdgeInsets.zero;
  @override
  Path getInnerPath(Rect rect, {TextDirection? textDirection}) => getOuterPath(rect);
  @override
  Path getOuterPath(Rect rect, {TextDirection? textDirection}) => notchedCardPath(rect, notch: _notchOf(notch, gap), radius: radius);
  @override
  void paint(Canvas canvas, Rect rect, {TextDirection? textDirection}) {}
  @override
  ShapeBorder scale(double t) => this;
}

/// Повідомляє розмір мітки під час розкладки — щоб виріз намалювався в тому ж кадрі, без «стрибка».
class _ReportSize extends SingleChildRenderObjectWidget {
  const _ReportSize({required this.notifier, required super.child});
  final ValueNotifier<Size> notifier;

  @override
  RenderObject createRenderObject(BuildContext context) => _RenderReportSize(notifier);

  @override
  void updateRenderObject(BuildContext context, _RenderReportSize renderObject) => renderObject.notifier = notifier;
}

class _RenderReportSize extends RenderProxyBox {
  _RenderReportSize(this.notifier);
  ValueNotifier<Size> notifier;

  @override
  void performLayout() {
    super.performLayout();
    // Малювальник слухає [notifier] через repaint — фарбування йде після розкладки в тому ж кадрі.
    if (notifier.value != size) notifier.value = size;
  }
}
