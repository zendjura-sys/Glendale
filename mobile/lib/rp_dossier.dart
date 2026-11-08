import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'theme.dart';
import 'widgets.dart';

/// RP-досьє персонажа (як на сайті): нік [static], сервер і плитки — ранг, баланс у сім'ї, догани з ліміту.
class RpDossier extends StatelessWidget {
  const RpDossier({required this.data, this.onTap, super.key});
  final Map<String, dynamic> data;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final warns = intOf(data['warns']);
    final tiles = [
      (tr('Ранг'), text(data['rank_title']) ?? '${intOf(data['rank'])}', fg),
      (tr('Баланс'), hryvniaShort(data['balance']), const Color(0xFF34D399)),
      (tr('Догани'), '$warns / ${intOf(data['warn_limit'], 3)}', warns > 0 ? const Color(0xFFF87171) : const Color(0xFF38BDF8)),
    ];
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: raised, borderRadius: BorderRadius.circular(18)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          // Без скорочень: назва повністю, нижче — нік і сервер (переносяться, якщо довгі).
          Row(children: [
            const Icon(LucideIcons.idCard, size: 16, color: Color(0xFF38BDF8)),
            const SizedBox(width: 8),
            Expanded(child: Text(tr('RP-досьє персонажа'), style: body(13.5, weight: FontWeight.w700))),
          ]),
          const SizedBox(height: 4),
          Text.rich(
            TextSpan(children: [
              if (text(data['nickname']) case final nick?) TextSpan(text: nick),
              if (text(data['server']) case final server?) TextSpan(text: '  ·  $server', style: body(12, color: accent, weight: FontWeight.w700)),
            ]),
            style: body(12, color: muted),
          ),
          const SizedBox(height: 10),
          Row(children: [
            for (final (i, t) in tiles.indexed) ...[
              if (i > 0) const SizedBox(width: 6),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                  decoration: BoxDecoration(color: card, borderRadius: BorderRadius.circular(12)),
                  child: Column(children: [
                    FittedBox(fit: BoxFit.scaleDown, child: Text(t.$1, maxLines: 1, style: body(11, color: muted))),
                    const SizedBox(height: 2),
                    FittedBox(fit: BoxFit.scaleDown, child: Text(t.$2, maxLines: 1, style: body(13, color: t.$3, weight: FontWeight.w800))),
                  ]),
                ),
              ),
            ],
          ]),
        ]),
      ),
    );
  }
}
