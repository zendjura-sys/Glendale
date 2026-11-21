import 'package:flutter/material.dart';

// ───────────────────────── Текст без обрізань ─────────────────────────

/// Текст без «…»: якщо вміщується — звичайний; якщо трохи довший — шрифт м'яко зменшується
/// (до 72%); якщо значно довший — переноситься на наступні рядки повністю, без накладань.
/// [maxLines] — скільки рядків хочемо бачити зазвичай (1 — підпис, 2–3 — опис).
class FitText extends StatelessWidget {
  const FitText(this.text, {this.style, this.textAlign, this.maxLines = 1, this.wrap = true, super.key});
  final String text;
  final TextStyle? style;
  final TextAlign? textAlign;
  final int maxLines;

  /// false — тісне місце фіксованої висоти (підпис доку, плитка): не переносити, а зменшити ще.
  final bool wrap;

  static const _minScale = 0.72;

  @override
  Widget build(BuildContext context) {
    final base = DefaultTextStyle.of(context).style.merge(style);
    final scaler = MediaQuery.textScalerOf(context);
    final direction = Directionality.of(context);
    return LayoutBuilder(builder: (context, constraints) {
      Text plain(TextStyle s, {int? lines}) => Text(text, style: s, textAlign: textAlign, maxLines: lines, softWrap: lines != 1);
      if (!constraints.hasBoundedWidth) return plain(base, lines: maxLines);
      bool fits(TextStyle s) {
        final painter = TextPainter(text: TextSpan(text: text, style: s), textDirection: direction, textScaler: scaler, maxLines: maxLines)
          ..layout(maxWidth: constraints.maxWidth);
        final ok = !painter.didExceedMaxLines && (maxLines > 1 || painter.width <= constraints.maxWidth + 0.5);
        painter.dispose();
        return ok;
      }

      if (fits(base)) return plain(base, lines: maxLines);
      final size = base.fontSize ?? 14;
      for (final k in const [0.92, 0.86, 0.8, 0.76, _minScale]) {
        final smaller = base.copyWith(fontSize: size * k);
        if (fits(smaller)) return plain(smaller, lines: maxLines);
      }
      // Зовсім не вміщується — показуємо повністю в кілька рядків (або ще дрібніше в тісному місці).
      if (!wrap) {
        return FittedBox(
          fit: BoxFit.scaleDown,
          alignment: textAlign == TextAlign.center ? Alignment.center : (textAlign == TextAlign.right || textAlign == TextAlign.end ? Alignment.centerRight : Alignment.centerLeft),
          child: Text(text, style: base, maxLines: maxLines, softWrap: maxLines > 1),
        );
      }
      return Text(text, style: base, textAlign: textAlign);
    });
  }
}
