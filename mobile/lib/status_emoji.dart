import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Готові статуси з емодзі (як `StatusDialog` на сайті). Модуль фільтрує зайве.
List<(String emoji, String Function() text, String? module)> _presets() => [
      ('🎮', () => tr('Граю'), 'games'),
      ('⚔️', () => tr('У рейді'), 'games'),
      ('🎧', () => tr('Слухаю музику'), 'music'),
      ('🍿', () => tr('Дивлюсь кіно'), 'cinema'),
      ('📚', () => tr('Навчаюсь'), null),
      ('💼', () => tr('Працюю'), null),
      ('🚗', () => tr('У дорозі'), null),
      ('💤', () => tr('Сплю'), null),
      ('🔕', () => tr('Не турбувати'), null),
      ('🤒', () => tr('Хворію'), null),
      ('🎉', () => tr('Святкую'), null),
      ('🏖️', () => tr('У відпустці'), null),
    ];

const _extra = ['🔥', '😎', '🥱', '🤝', '🍕', '☕', '🏆', '❤️', '🎂', '🇺🇦'];

List<(String key, String Function() label)> _durations() => [
      ('30m', () => tr('30 хв')),
      ('1h', () => tr('1 год')),
      ('4h', () => tr('4 год')),
      ('today', () => tr('До кінця дня')),
      ('week', () => tr('Тиждень')),
      ('forever', () => tr('Без таймера')),
    ];

/// Шторка статусу з емодзі й таймером (`PUT/DELETE /site/me/status`).
Future<void> showStatusEmojiSheet(BuildContext context) async {
  final session = AppScope.read(context).session;
  if (!session.pluginOn('status_emoji')) {
    toast(context, tr('Статус з емодзі вимкнено в цьому режимі.'));
    return;
  }
  await showGcSheet<void>(
    context,
    title: tr('Статус'),
    subtitle: tr('Емодзі й підпис бачать друзі на аватарці.'),
    builder: (sheet) => _StatusEmojiForm(session: session),
  );
}

class _StatusEmojiForm extends StatefulWidget {
  const _StatusEmojiForm({required this.session});
  final Session session;

  @override
  State<_StatusEmojiForm> createState() => _StatusEmojiFormState();
}

class _StatusEmojiFormState extends State<_StatusEmojiForm> {
  late String? emoji = text(widget.session.me?['status_emoji']);
  late final label = TextEditingController(text: text(widget.session.me?['status']) ?? '');
  String duration = 'today';
  bool busy = false;

  @override
  void dispose() {
    label.dispose();
    super.dispose();
  }

  Future<void> _save({bool clear = false}) async {
    setState(() => busy = true);
    try {
      final api = widget.session.api;
      if (clear) {
        await api.delete(Api.site('/me/status'));
      } else {
        await api.put(Api.site('/me/status'), {
          'emoji': emoji,
          'status': label.text.trim(),
          'duration': duration,
        });
      }
      await widget.session.refreshMe();
      if (mounted) {
        toast(context, clear ? tr('Статус знято.') : tr('Статус оновлено.'));
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) toast(context, e, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final modules = widget.session.modules ?? const <String>[];
    final presets = _presets().where((p) => p.$3 == null || modules.contains(p.$3)).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final p in presets)
              GestureDetector(
                onTap: () => setState(() {
                  emoji = p.$1;
                  if (label.text.trim().isEmpty) label.text = p.$2();
                }),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: emoji == p.$1 ? primary.withValues(alpha: 0.18) : card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: emoji == p.$1 ? primary.withValues(alpha: 0.45) : line),
                  ),
                  child: Text('${p.$1} ${p.$2()}', style: body(13, weight: FontWeight.w600)),
                ),
              ),
            for (final e in _extra)
              GestureDetector(
                onTap: () => setState(() => emoji = e),
                child: Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: emoji == e ? primary.withValues(alpha: 0.18) : card,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(e, style: const TextStyle(fontSize: 20)),
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),
        TextField(
          controller: label,
          maxLength: 48,
          decoration: InputDecoration(hintText: tr('Підпис статусу'), counterText: ''),
        ),
        const SizedBox(height: 8),
        Text(tr('На скільки'), style: body(12.5, color: muted)),
        const SizedBox(height: 6),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            for (final d in _durations())
              SelectPill(label: d.$2(), selected: duration == d.$1, onTap: () => setState(() => duration = d.$1)),
          ],
        ),
        const SizedBox(height: 14),
        PrimaryButton(label: tr('Зберегти'), icon: LucideIcons.check, busy: busy, onPressed: busy ? null : () => _save()),
        const SizedBox(height: 8),
        GhostButton(label: tr('Зняти статус'), icon: LucideIcons.trash2, color: dangerSoft, onPressed: busy ? null : () => _save(clear: true)),
      ],
    );
  }
}
