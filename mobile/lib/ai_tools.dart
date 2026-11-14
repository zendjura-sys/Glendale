import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'core/widgets/arctic_glass/arctic_glass.dart';
import 'i18n.dart';
import 'skeletons.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// Кнопки ШІ в чаті (готові маршрути сайту через міст): ШІ-редактор у полі повідомлення
// (`POST /site/ai/rewrite`) і «Підсумок від ШІ» в меню бесіди (`POST /site/messages/{id}/ai/summary`).
// Відповіді показуються в ArcticGlassSheet.

/// Іконка ШІ-редактора з крижаним світінням — у полі вводу повідомлення.
class AiWriterButton extends StatefulWidget {
  const AiWriterButton({required this.input, super.key});
  final TextEditingController input;

  @override
  State<AiWriterButton> createState() => _AiWriterButtonState();
}

class _AiWriterButtonState extends State<AiWriterButton> {
  bool busy = false;

  List<(String, String, IconData)> get _modes => [
    ('improve', tr('Покращити текст'), LucideIcons.wandSparkles),
    ('fix', tr('Виправити помилки'), LucideIcons.spellCheck),
    ('shorter', tr('Скоротити'), LucideIcons.minimize2),
    ('friendly', tr('Дружніше'), LucideIcons.smile),
    ('formal', tr('Офіційніше'), LucideIcons.briefcase),
    ('en', tr('Перекласти англійською'), LucideIcons.languages),
    ('uk', tr('Перекласти українською'), LucideIcons.languages),
  ];

  Future<void> _open() async {
    final source = widget.input.text.trim();
    if (source.isEmpty) {
      toast(context, tr('Спочатку напишіть текст — ШІ його покращить.'), kind: ToastKind.info);
      return;
    }
    final mode = await showArcticGlassSheet<String>(
      context,
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 4, 12, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _AiTitle(tr('ШІ-редактор')),
          for (final (key, label, icon) in _modes)
            ListTile(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.control)),
              leading: Icon(icon, color: AppColors.accentCyan, size: 20),
              title: Text(label, style: body(15, weight: FontWeight.w500)),
              onTap: () => Navigator.pop(sheet, key),
            ),
        ]),
      ),
    );
    if (mode == null || !mounted) return;
    setState(() => busy = true);
    try {
      final result = await AppScope.read(context).session.api.post(Api.site('/ai/rewrite'), {'text': source, 'mode': mode});
      final rewritten = text(result['text']);
      if (rewritten != null && mounted) {
        widget.input.value = TextEditingValue(text: rewritten, selection: TextSelection.collapsed(offset: rewritten.length));
      }
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: tr('ШІ-редактор'),
      onPressed: busy ? null : _open,
      icon: busy
          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accentCyan))
          : const _IceIcon(LucideIcons.sparkles),
    );
  }
}

/// «Підсумок від ШІ»: шторка зі скелетоном, поки сервер переказує останні повідомлення.
Future<void> showAiSummary(BuildContext context, int conversation) {
  final api = AppScope.read(context).session.api;
  final future = api.post(Api.site('/messages/$conversation/ai/summary'));
  return showArcticGlassSheet<void>(
    context,
    builder: (sheet) => Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _AiTitle(tr('Підсумок від ШІ'), padding: EdgeInsets.zero),
        const SizedBox(height: 12),
        Flexible(
          child: FutureBuilder<Map<String, dynamic>>(
            future: future,
            builder: (sheet, snap) {
              if (snap.hasError) {
                return Text('${snap.error}'.replaceFirst(RegExp(r'^Exception: '), ''), style: body(14.5, color: dangerSoft));
              }
              if (!snap.hasData) {
                return const SkeletonShimmer(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Sk(height: 12), SizedBox(height: 10), Sk(height: 12), SizedBox(height: 10), Sk(width: 220, height: 12),
                  ]),
                );
              }
              return SingleChildScrollView(
                child: SelectableText(text(snap.data!['summary']) ?? tr('Поки нема про що розповісти.'), style: body(15, color: ink).copyWith(height: 1.5)),
              );
            },
          ),
        ),
        const SizedBox(height: 14),
        Text(tr('Переказ створено ШІ й може містити неточності.'), style: body(12, color: faint)),
      ]),
    ),
  );
}

class _AiTitle extends StatelessWidget {
  const _AiTitle(this.title, {this.padding = const EdgeInsets.fromLTRB(8, 0, 8, 8)});
  final String title;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => Padding(
    padding: padding,
    child: Row(children: [
      const _IceIcon(LucideIcons.sparkles, size: 20),
      const SizedBox(width: 10),
      Expanded(child: Text(title, style: display(18))),
    ]),
  );
}

/// Іконка з крижаним світінням (ціан + м'яке сяйво).
class _IceIcon extends StatelessWidget {
  const _IceIcon(this.icon, {this.size = 21});
  final IconData icon;
  final double size;

  @override
  Widget build(BuildContext context) => Icon(
    icon,
    size: size,
    color: AppColors.accentCyan,
    shadows: [
      Shadow(color: AppColors.accentCyan.withValues(alpha: 0.85), blurRadius: 8),
      Shadow(color: AppColors.accentPrimary.withValues(alpha: 0.6), blurRadius: 18),
    ],
  );
}
