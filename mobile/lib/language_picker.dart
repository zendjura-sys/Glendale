import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'theme.dart';
import 'widgets.dart';

/// Вибір мови: «як у телефоні» або вручну. Новий словник підвантажується з сервера,
/// застосунок перебудовується. Список мов керується в адмінці сайту.
class LanguagePicker extends StatefulWidget {
  const LanguagePicker({required this.api, this.signedIn = true, super.key});
  final Api api;
  final bool signedIn;

  @override
  State<LanguagePicker> createState() => _LanguagePickerState();
}

class _LanguagePickerState extends State<LanguagePicker> {
  bool busy = false;

  Future<void> _choose(String? code) async {
    setState(() => busy = true);
    await I18n.choose(code == '' ? null : code);
    if (widget.signedIn && code != null && code != '') {
      try {
        await widget.api.post('/api/v1/me/locale', {'locale': code});
      } catch (_) {
        // Мову все одно змінимо на телефоні.
      }
    }
    await refreshLanguage(widget.api);
    I18n.rebuild();
  }

  @override
  Widget build(BuildContext context) {
    final locales = I18n.locales;
    if (locales.length < 2) return const SizedBox.shrink();
    return Row(children: [
      const Icon(LucideIcons.languages, size: 18, color: muted),
      const SizedBox(width: 10),
      Expanded(
        child: GcSelect<String>(
          value: I18n.choice ?? '',
          expand: true,
          items: [('', tr('Як у телефоні')), for (final l in locales) ('${l['code']}', '${l['native']}')],
          onChanged: busy ? (_) {} : (v) => _choose(v),
        ),
      ),
    ]);
  }
}

/// «Перекласти / Показати оригінал» під текстом користувача (запис, коментар, повідомлення).
/// builder отримує текст, який зараз показувати.
class Translatable extends StatefulWidget {
  const Translatable({required this.api, required this.type, required this.id, required this.original, required this.builder, super.key});
  final Api api;
  final String type;
  final int id;
  final String original;
  final Widget Function(BuildContext context, String text) builder;

  @override
  State<Translatable> createState() => _TranslatableState();
}

class _TranslatableState extends State<Translatable> {
  String? translated;
  bool shown = false;
  bool busy = false;

  Future<void> _toggle() async {
    if (shown || translated != null) {
      setState(() => shown = !shown);
      return;
    }
    setState(() => busy = true);
    try {
      final result = await widget.api.post('/api/v1/translate', {'type': widget.type, 'id': widget.id});
      if (!mounted) return;
      if (result['same'] == true) {
        toast(context, tr('Текст уже вашою мовою.'));
      } else {
        setState(() {
          translated = text(result['translation']);
          shown = translated != null;
        });
      }
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final child = widget.builder(context, shown && translated != null ? translated! : widget.original);
    if (!I18n.translate || widget.original.trim().isEmpty) return child;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
      child,
      GestureDetector(
        onTap: busy ? null : _toggle,
        child: Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            busy ? const SizedBox(width: 13, height: 13, child: CircularProgressIndicator(strokeWidth: 1.6)) : const Icon(LucideIcons.languages, size: 13, color: muted),
            const SizedBox(width: 5),
            Text(shown ? tr('Показати оригінал') : tr('Перекласти'), style: body(12, color: muted, weight: FontWeight.w600)),
          ]),
        ),
      ),
    ]);
  }
}
