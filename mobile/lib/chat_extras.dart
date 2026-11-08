import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import 'core/widgets/arctic_glass/arctic_fit_text.dart';
import 'package:http/http.dart' as http;
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Чат: гілки в групах, кілька закріплених, особиста нотатка до бесіди й фото «на один перегляд» — як на сайті.

/// Смуга закріплених під шапкою: по одному, дотик — перейти й показати наступне.
class PinnedBar extends StatefulWidget {
  const PinnedBar({required this.pins, required this.onJump, super.key});
  final List<Map<String, dynamic>> pins;
  final ValueChanged<int> onJump;

  @override
  State<PinnedBar> createState() => _PinnedBarState();
}

class _PinnedBarState extends State<PinnedBar> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    final pins = widget.pins;
    if (pins.isEmpty) return const SizedBox.shrink();
    final pin = pins[index % pins.length];
    return Material(
      color: ink.withValues(alpha: 0.035),
      child: InkWell(
        onTap: () {
          widget.onJump(intOf(pin['id']));
          setState(() => index = (index + 1) % pins.length);
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Row(children: [
            Icon(LucideIcons.pin, size: 16, color: primary),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(
                  pins.length > 1 ? tr('Закріплене {n} з {total}', {'n': '${index % pins.length + 1}', 'total': '${pins.length}'}) : tr('Закріплене'),
                  style: body(11.5, color: primary, weight: FontWeight.w600),
                ),
                FitText([if (text(pin['author']) != null) '${text(pin['author'])}:', text(pin['preview']) ?? ''].join(' '), style: body(13, color: soft)),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

/// Нотатка до бесіди: шторка редагування; повертає збережений текст (порожньо — прибрано).
Future<String?> editChatNote(BuildContext context, int conversationId, String? current) async {
  final field = TextEditingController(text: current ?? '');
  String? saved;
  await showGcSheet<void>(
    context,
    title: tr('Нотатка до чату'),
    builder: (sheet) => Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(tr('Бачите лише ви. Наприклад: «днюха 5 березня», «грає на сервері EU».'), style: body(13, color: muted)),
        const SizedBox(height: 10),
        GcField(controller: field, label: tr('Нотатка'), maxLines: 6, minLines: 3),
        const SizedBox(height: 12),
        PrimaryButton(
          label: tr('Зберегти'),
          onPressed: () async {
            try {
              final r = await AppScope.read(sheet).session.api.put(Api.site('/messages/$conversationId/note'), {'note': field.text});
              saved = text(r['note']) ?? '';
              if (sheet.mounted) Navigator.of(sheet).pop();
            } catch (e) {
              if (sheet.mounted) toast(sheet, e);
            }
          },
        ),
      ]),
    ),
  );
  return saved;
}

/// Гілка під повідомленням групи: корінь, відповіді, поле відповіді. Оновлюється раз на 4 с, поки відкрита.
class ThreadSheet extends StatefulWidget {
  const ThreadSheet({required this.conversationId, required this.rootId, super.key});
  final int conversationId;
  final int rootId;

  @override
  State<ThreadSheet> createState() => _ThreadSheetState();
}

class _ThreadSheetState extends State<ThreadSheet> {
  Map<String, dynamic>? root;
  List<Map<String, dynamic>> replies = [];
  final input = TextEditingController();
  bool busy = false;
  Timer? poll;

  String get _path => Api.site('/messages/${widget.conversationId}/messages/${widget.rootId}/thread');

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    poll = Timer.periodic(const Duration(seconds: 4), (_) => _load());
  }

  @override
  void dispose() {
    poll?.cancel();
    input.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final d = await AppScope.read(context).session.api.get(_path);
      if (!mounted) return;
      setState(() {
        root = mapOf(d['root']);
        replies = maps(d['messages']);
      });
    } catch (_) {}
  }

  Future<void> _send() async {
    final value = input.text.trim();
    if (value.isEmpty || busy) return;
    setState(() => busy = true);
    try {
      final r = await AppScope.read(context).session.api.post(_path, {'body': value});
      if (!mounted) return;
      input.clear();
      setState(() => replies.add(mapOf(r['message'])));
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Widget _line(Map<String, dynamic> m) {
    final user = mapOf(m['user']);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Avatar(name: text(user['name']) ?? '', url: text(user['avatar_url']), size: 32),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(text(user['name']) ?? '', style: body(12.5, color: muted, weight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text(text(m['body']) ?? text(m['preview']) ?? '', style: body(14.5)),
          ]),
        ),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final r = root;
    return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (r == null)
        const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator(strokeWidth: 2)))
      else ...[
        _line(r),
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Text(tr('{count} відповідей', {'count': '${replies.length}'}), style: body(12, color: muted)),
        ),
        for (final m in replies) _line(m),
      ],
      Row(children: [
        Expanded(child: GcField(controller: input, label: tr('Відповісти в гілці'), onSubmit: _send)),
        const SizedBox(width: 8),
        IconButton.filled(tooltip: tr('Надіслати'), onPressed: busy ? null : _send, icon: const Icon(LucideIcons.send, size: 18)),
      ]),
    ]);
  }
}

/// Фото «на один перегляд»: отримувач відкриває один раз, автор бачить лише позначку.
class ViewOnceChip extends StatefulWidget {
  const ViewOnceChip({required this.attachment, required this.own, super.key});
  final Map<String, dynamic> attachment;
  final bool own;

  @override
  State<ViewOnceChip> createState() => _ViewOnceChipState();
}

class _ViewOnceChipState extends State<ViewOnceChip> {
  bool opened = false;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    final me = AppScope.read(context).session.myId;
    final viewed = widget.attachment['viewed_by'] is List ? widget.attachment['viewed_by'] as List : const [];
    opened = viewed.map(intOf).contains(me);
  }

  Future<void> _open() async {
    if (widget.own || opened || busy) return;
    setState(() => busy = true);
    final session = AppScope.read(context).session;
    try {
      final response = await http.get(
        Uri.parse('${Api.root}${Api.site('/messages/attachments/${widget.attachment['id']}/once')}'),
        headers: {if (session.token != null) 'Authorization': 'Bearer ${session.token}', 'Accept': 'image/*'},
      );
      if (!mounted) return;
      setState(() => opened = true);
      if (response.statusCode != 200) {
        toast(context, tr('Фото вже переглянуто.'));
        return;
      }
      await _show(response.bodyBytes);
    } catch (_) {
      if (mounted) toast(context, tr('Не вдалося відкрити фото.'));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _show(Uint8List bytes) => showDialog<void>(
    context: context,
    barrierColor: Colors.black.withValues(alpha: 0.92),
    builder: (dialog) => GestureDetector(
      onTap: () => Navigator.of(dialog).pop(),
      child: Center(child: InteractiveViewer(child: Image.memory(bytes, fit: BoxFit.contain))),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final seen = (widget.attachment['viewed_by'] is List ? widget.attachment['viewed_by'] as List : const []).isNotEmpty;
    final label = widget.own
        ? (seen ? tr('Фото переглянуто') : tr('Фото на один перегляд'))
        : (opened ? tr('Переглянуто') : tr('Фото · відкрити один раз'));
    final active = !widget.own && !opened;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Material(
        color: active ? primary.withValues(alpha: 0.22) : ink.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: active ? _open : null,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(active ? LucideIcons.eye : LucideIcons.eyeOff, size: 16, color: active ? ink : muted),
              const SizedBox(width: 8),
              Flexible(child: Text(label, style: body(13.5, color: active ? ink : muted))),
            ]),
          ),
        ),
      ),
    );
  }
}
