import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

const _sky = Color(0xFF38BDF8);
const _tones = [Color(0xFF38BDF8), Color(0xFFFBBF24), Color(0xFF34D399)];

/// Чат сім'ї на огляді штабу (як на сайті): скільки написали сьогодні, «Зробити ШІ-підсумок» і останні повідомлення.
class FamilyChatCard extends StatefulWidget {
  const FamilyChatCard({required this.chat, required this.tag, super.key});
  final Map<String, dynamic> chat;
  final String tag;

  @override
  State<FamilyChatCard> createState() => _FamilyChatCardState();
}

class _FamilyChatCardState extends State<FamilyChatCard> {
  bool open = false;
  bool busy = false;
  String? summary;
  String? error;

  Future<void> _toggle() async {
    setState(() => open = !open);
    if (!open || summary != null || busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final d = await AppScope.read(context).session.api.post(Api.site('/messages/${widget.chat['id']}/ai/summary'));
      summary = text(mapOf(d)['summary']) ?? '';
    } catch (e) {
      error = e is ApiException ? e.message : tr('ШІ зараз недоступний.');
    }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final chat = widget.chat;
    final today = intOf(chat['today']);
    final latest = maps(chat['latest']);
    final points = (summary ?? '').split('\n').map((l) => l.replaceFirst(RegExp(r'^[\s•\-*]+'), '').trim()).where((l) => l.isNotEmpty).toList();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(color: _sky.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(12)),
              child: const Icon(LucideIcons.messageSquareText, size: 19, color: _sky),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr('Чат сім’ї {tag}', {'tag': widget.tag}), style: body(15.5, weight: FontWeight.w800)),
                const SizedBox(height: 2),
                Text(
                  today > 0 ? tr('{n} {word} сьогодні', {'n': today, 'word': plural(today, tr('повідомлення'), tr('повідомлення'), tr('повідомлень'))}) : tr('Сьогодні ще тихо'),
                  style: body(12.5, color: today > 0 ? _sky : muted, weight: FontWeight.w600),
                ),
              ]),
            ),
          ]),
          const SizedBox(height: 12),
          if (chat['ai'] == true) ...[
            GestureDetector(
              onTap: _toggle,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(color: _sky.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(18)),
                child: Row(children: [
                  const Icon(LucideIcons.wandSparkles, size: 19, color: _sky),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(tr('Зробити ШІ-підсумок чату'), style: body(14, color: _sky, weight: FontWeight.w800)),
                      Text(tr('Останні ~80 повідомлень коротко: про що домовились'), style: body(12, color: muted)),
                    ]),
                  ),
                  AnimatedRotation(turns: open ? 0.5 : 0, duration: const Duration(milliseconds: 200), child: const Icon(LucideIcons.chevronDown, size: 18, color: _sky)),
                ]),
              ),
            ),
            AnimatedSize(
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOutCubic,
              alignment: Alignment.topCenter,
              child: !open
                  ? const SizedBox(width: double.infinity)
                  : Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(top: 10),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(color: raised, borderRadius: BorderRadius.circular(18)),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          const Icon(LucideIcons.sparkles, size: 14, color: _sky),
                          const SizedBox(width: 6),
                          Text(tr('Коротке зведення від ШІ'), style: body(12.5, color: _sky, weight: FontWeight.w800)),
                        ]),
                        const SizedBox(height: 8),
                        if (busy)
                          const LinearProgressIndicator(minHeight: 3, color: _sky)
                        else if (error != null)
                          Text(error!, style: body(13.5, color: const Color(0xFFF87171)))
                        else
                          for (final p in points)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 6),
                              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text('•  ', style: body(14, color: muted)),
                                Expanded(child: Text(p, style: body(14, color: soft))),
                              ]),
                            ),
                        Text(tr('ШІ може помилятися.'), style: body(11, color: muted)),
                      ]),
                    ),
            ),
          ],
          if (latest.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(color: raised, borderRadius: BorderRadius.circular(18)),
              child: Column(children: [
                for (var i = 0; i < latest.length; i++) ...[
                  if (i > 0) Divider(height: 1, thickness: 1, indent: 14, endIndent: 14, color: muted.withValues(alpha: 0.12)),
                  _Message(latest[i]),
                ],
              ]),
            ),
          ],
        ]),
      ),
    );
  }

}

/// Один рядок останніх повідомлень: ім'я сталим кольором, час і текст повністю.
class _Message extends StatelessWidget {
  const _Message(this.m);
  final Map<String, dynamic> m;

  @override
  Widget build(BuildContext context) {
    final name = text(m['name']) ?? '';
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 11, 14, 11),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Text(name, style: body(13.5, color: _tones[name.runes.fold<int>(0, (a, b) => a + b) % _tones.length], weight: FontWeight.w800))),
          const SizedBox(width: 8),
          Text(_time(text(m['at'])), style: body(11.5, color: muted)),
        ]),
        const SizedBox(height: 3),
        Text(text(m['body']) ?? '', style: body(14, color: soft).copyWith(height: 1.35)),
      ]),
    );
  }

  static String _time(String? iso) {
    final at = DateTime.tryParse(iso ?? '')?.toLocal();
    return at == null ? '' : '${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}';
  }
}
