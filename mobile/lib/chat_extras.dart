import 'dart:async';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import 'core/widgets/arctic_glass/arctic_fit_text.dart';
import 'package:http/http.dart' as http;
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import 'api.dart';
import 'i18n.dart';
import 'posts.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Чат: гілки в групах, кілька закріплених, особиста нотатка до бесіди, фото «на один перегляд»,
/// фон чату, боти бесіди й тайм-аут — як на сайті.

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

bool _truthy(dynamic value) => value == true || value == 1 || value == '1' || value == 'true';

/// Повідомлення бота бесіди: об’єкт `bot`, прапорець `is_bot` або те саме на картці автора.
bool messageIsBot(Map<String, dynamic> message) {
  if (_truthy(message['is_bot']) || _truthy(message['bot'])) return true;
  final bot = message['bot'];
  if (bot is Map && bot.isNotEmpty) return true;
  final user = message['user'];
  if (user is Map && (_truthy(user['is_bot']) || _truthy(user['bot']))) return true;
  return false;
}

/// Ім’я бота з `bot.name`, інакше з автора, інакше «Бот».
String messageBotName(Map<String, dynamic> message) {
  final bot = message['bot'];
  if (bot is Map) {
    final name = text(bot['name']);
    if (name != null) return name;
  }
  final user = message['user'];
  if (user is Map) {
    final name = text(user['name']);
    if (name != null) return name;
  }
  return tr('Бот');
}

/// Повідомлення гостя без акаунта (`guest.name` або `is_guest`).
bool messageIsGuest(Map<String, dynamic> message) {
  if (_truthy(message['is_guest'])) return true;
  final guest = message['guest'];
  if (guest is Map && (text(guest['name']) != null || guest.isNotEmpty)) return true;
  final user = message['user'];
  return user is Map && _truthy(user['is_guest']);
}

String messageGuestName(Map<String, dynamic> message) {
  final guest = message['guest'];
  if (guest is Map) {
    final name = text(guest['name']);
    if (name != null) return name;
  }
  return tr('Гість');
}

/// Гостьовий чат спільноти або бесіда підтримки: явні прапорці, тип або канал спільноти.
bool conversationIsGuestOrSupport(Map<String, dynamic> chat) {
  if (_truthy(chat['guest_chat']) || _truthy(chat['support']) || _truthy(chat['is_support'])) return true;
  final type = text(chat['type']);
  final kind = text(chat['kind']) ?? text(chat['style']);
  if (type == 'guest' || type == 'support' || kind == 'guest' || kind == 'support') return true;
  if (chat['guest_chat'] == false) return false;
  final channel = int.tryParse('${chat['community_channel_id']}');
  return channel != null && channel > 0;
}

/// Бан гостя: плагін увімкнено, повідомлення гостя, бесіда гостьова чи підтримки, і є право.
bool canOfferGuestBan(
  Map<String, dynamic> chat,
  Map<String, dynamic> message, {
  required bool ipBansOn,
  required bool isAdmin,
  String? myRole,
}) {
  if (!ipBansOn || !messageIsGuest(message)) return false;
  final marked = chat.containsKey('guest_chat') || _truthy(chat['support']) || _truthy(chat['is_support']) || text(chat['type']) == 'support' || text(chat['kind']) == 'support' || text(chat['style']) == 'support';
  if (marked && !conversationIsGuestOrSupport(chat)) return false;
  if (chat.containsKey('can_ban_guest')) return chat['can_ban_guest'] == true;
  return isAdmin || myRole == 'owner' || myRole == 'admin';
}

/// «Матеріали чату»: фото, файли, посилання й голосові — ті самі вкладки, що на сайті.
Future<void> showChatShared(BuildContext context, {required int conversationId, required ValueChanged<int> onJump}) {
  return showGcSheet<void>(
    context,
    title: tr('Матеріали чату'),
    subtitle: tr('Усе, чим ділилися в бесіді. Натисніть, щоб відкрити.'),
    height: MediaQuery.sizeOf(context).height * 0.82,
    builder: (sheet) => ChatSharedPanel(
      conversationId: conversationId,
      onJump: (id) {
        Navigator.of(sheet).pop();
        onJump(id);
      },
    ),
  );
}

class ChatSharedPanel extends StatefulWidget {
  const ChatSharedPanel({required this.conversationId, required this.onJump, super.key});
  final int conversationId;
  final ValueChanged<int> onJump;

  @override
  State<ChatSharedPanel> createState() => _ChatSharedPanelState();
}

class _ChatSharedPanelState extends State<ChatSharedPanel> {
  static const _kinds = ['media', 'files', 'links', 'voice'];
  String kind = 'media';
  List<Map<String, dynamic>> items = [];
  Map<String, int> counts = {};
  int? next;
  bool loading = true;
  int _seq = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load('media'));
  }

  Future<void> _load(String which, {int? before}) async {
    final seq = before == null ? ++_seq : _seq;
    if (mounted) setState(() => loading = true);
    try {
      final query = StringBuffer('kind=$which');
      if (before != null) query.write('&before=$before');
      final data = await AppScope.read(context).session.api.get(Api.site('/messages/${widget.conversationId}/shared?$query'));
      if (!mounted || seq != _seq || which != kind) return;
      setState(() {
        final page = maps(data['items']);
        items = before == null ? page : [...items, ...page];
        next = data['next'] == null ? null : intOf(data['next']);
        if (data['counts'] is Map) {
          counts = {for (final entry in (data['counts'] as Map).entries) '${entry.key}': intOf(entry.value)};
        }
        loading = false;
      });
    } catch (e) {
      if (!mounted || seq != _seq) return;
      setState(() => loading = false);
      toast(context, e);
    }
  }

  void _switch(String nextKind) {
    if (nextKind == kind) return;
    setState(() {
      kind = nextKind;
      items = [];
      next = null;
      loading = true;
    });
    _load(nextKind);
  }

  String _label(String value) => switch (value) {
    'files' => tr('Файли'),
    'links' => tr('Посилання'),
    'voice' => tr('Голосові'),
    _ => tr('Медіа'),
  };

  IconData _icon(String value) => switch (value) {
    'files' => LucideIcons.file,
    'links' => LucideIcons.link,
    'voice' => LucideIcons.mic,
    _ => LucideIcons.image,
  };

  String _size(dynamic raw) {
    final size = intOf(raw);
    if (size <= 0) return '';
    if (size > 1024 * 1024) return tr('{v} МБ', {'v': (size / 1024 / 1024).toStringAsFixed(1)});
    return tr('{v} КБ', {'v': (size / 1024).ceil()});
  }

  String? _voice(dynamic raw) {
    final total = intOf(raw);
    if (total <= 0) return null;
    return '${total ~/ 60}:${(total % 60).toString().padLeft(2, '0')}';
  }

  Future<void> _open(Map<String, dynamic> item) async {
    if (kind == 'media') {
      final type = text(item['type']);
      final photos = [
        for (final row in items)
          if (text(row['type']) != 'video_note') ?absolute(row['url']),
      ];
      final url = absolute(item['url']);
      if (type == 'video_note' || url == null || photos.isEmpty) {
        widget.onJump(intOf(item['message_id']));
        return;
      }
      final index = photos.indexOf(url);
      await Navigator.of(context).push(
        MaterialPageRoute<void>(fullscreenDialog: true, builder: (_) => PhotoViewer(urls: photos, initial: index < 0 ? 0 : index)),
      );
      return;
    }
    if (kind == 'links') {
      final url = text(item['url']);
      if (url == null) return;
      final opened = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (!opened && mounted) toast(context, tr('Не вдалося відкрити посилання.'));
      return;
    }
    if (kind == 'files') {
      await _save(item);
      return;
    }
    widget.onJump(intOf(item['message_id']));
  }

  Future<void> _save(Map<String, dynamic> item) async {
    final id = int.tryParse('${item['id']}');
    try {
      if (id == null) {
        final url = absolute(item['url']);
        if (url != null) await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
        return;
      }
      final bytes = await AppScope.read(context).session.api.bytes('/api/v1/messages/attachments/$id');
      if (!mounted) return;
      final saved = await FilePicker.platform.saveFile(fileName: text(item['name']) ?? 'file', bytes: Uint8List.fromList(bytes));
      if (saved != null && mounted) toast(context, tr('Файл збережено.'));
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
        child: Segmented(
          scroll: true,
          selected: kind,
          onSelect: _switch,
          options: [
            for (final value in _kinds) SegmentOption(value, _label(value), icon: _icon(value), count: (counts[value] ?? 0) > 0 ? counts[value] : null),
          ],
        ),
      ),
      Expanded(child: _body()),
    ]);
  }

  Widget _body() {
    if (items.isEmpty && loading) {
      return const Center(child: CircularProgressIndicator(strokeWidth: 2));
    }
    if (items.isEmpty) {
      return Center(child: Text(tr('Тут поки нічого немає.'), style: body(14, color: muted)));
    }
    final list = kind == 'media'
        ? GridView.builder(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, mainAxisSpacing: 6, crossAxisSpacing: 6),
            itemCount: items.length,
            itemBuilder: (context, i) {
              final item = items[i];
              final url = absolute(item['url']);
              return GestureDetector(
                onTap: () => _open(item),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: ColoredBox(
                    color: ink.withValues(alpha: 0.06),
                    child: text(item['type']) == 'video_note' || url == null
                        ? Icon(text(item['type']) == 'video_note' ? LucideIcons.video : LucideIcons.image, color: muted)
                        : NetImage(url),
                  ),
                ),
              );
            },
          )
        : ListView.separated(
            padding: const EdgeInsets.fromLTRB(8, 0, 8, 12),
            itemCount: items.length,
            separatorBuilder: (_, _) => Divider(height: 1, color: line),
            itemBuilder: (context, i) {
              final item = items[i];
              final title = kind == 'links'
                  ? (text(item['url']) ?? '')
                  : kind == 'voice'
                      ? tr('Голосове повідомлення')
                      : (text(item['name']) ?? tr('Файл'));
              final meta = [
                if (kind == 'links') text(item['host']),
                if (kind == 'files') _size(item['size']),
                if (kind == 'voice') _voice(item['duration']),
                text(item['author']),
                shortStamp(item['created_at']),
              ].whereType<String>().where((part) => part.isNotEmpty).join(' · ');
              return Material(
                type: MaterialType.transparency,
                child: ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(color: ink.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(12)),
                  child: Icon(_icon(kind), size: 18, color: soft),
                ),
                title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, weight: FontWeight.w600)),
                subtitle: meta.isEmpty ? null : Text(meta, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
                trailing: kind == 'voice'
                    ? IconButton(
                        tooltip: tr('До повідомлення'),
                        onPressed: () => widget.onJump(intOf(item['message_id'])),
                        icon: Icon(LucideIcons.cornerUpLeft, size: 18, color: muted),
                      )
                    : IconButton(
                        tooltip: kind == 'links' ? tr('Відкрити') : tr('Завантажити'),
                        onPressed: () => _open(item),
                        icon: Icon(kind == 'links' ? LucideIcons.externalLink : LucideIcons.download, size: 18, color: muted),
                      ),
                onTap: () => _open(item),
                onLongPress: () => widget.onJump(intOf(item['message_id'])),
              ),
              );
            },
          );
    return Column(children: [
      Expanded(child: list),
      if (loading) const LinearProgressIndicator(minHeight: 2),
      if (next != null && !loading)
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
          child: GhostButton(label: tr('Показати ще'), compact: true, onPressed: () => _load(kind, before: next)),
        ),
    ]);
  }
}

/// Бан гостя гостьового чату: строк і, для персоналу сайту, «на всьому сайті». Повертає true, якщо заблоковано.
Future<bool> confirmGuestBan(
  BuildContext context, {
  required int conversationId,
  required int messageId,
  required String guestName,
  required bool canEverywhere,
  bool preferEverywhere = false,
}) async {
  final banned = await showGcSheet<bool>(
    context,
    title: tr('Заблокувати гостя «{name}»', {'name': guestName}),
    subtitle: tr('Гість більше не зможе писати в гостьовий чат з цієї адреси. Його повідомлення буде видалено.'),
    builder: (sheet) => _GuestBanBody(
      conversationId: conversationId,
      messageId: messageId,
      canEverywhere: canEverywhere,
      preferEverywhere: preferEverywhere,
      onDone: (ok) => Navigator.of(sheet).pop(ok),
    ),
  );
  return banned == true;
}

class _GuestBanBody extends StatefulWidget {
  const _GuestBanBody({
    required this.conversationId,
    required this.messageId,
    required this.canEverywhere,
    required this.preferEverywhere,
    required this.onDone,
  });
  final int conversationId;
  final int messageId;
  final bool canEverywhere;
  final bool preferEverywhere;
  final ValueChanged<bool> onDone;

  @override
  State<_GuestBanBody> createState() => _GuestBanBodyState();
}

class _GuestBanBodyState extends State<_GuestBanBody> {
  int days = 7;
  late bool everywhere = widget.preferEverywhere;
  bool busy = false;

  Future<void> _ban() async {
    if (busy) return;
    setState(() => busy = true);
    try {
      await AppScope.read(context).session.api.post(
        Api.site('/messages/${widget.conversationId}/messages/${widget.messageId}/ban-guest'),
        {'days': days == 0 ? null : days, 'everywhere': everywhere},
      );
      if (!mounted) return;
      toast(context, tr('Гостя заблоковано.'));
      widget.onDone(true);
    } catch (e) {
      if (mounted) {
        setState(() => busy = false);
        toast(context, e);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Segmented(
          scroll: true,
          selected: '$days',
          onSelect: (value) => setState(() => days = int.parse(value)),
          options: [
            SegmentOption('1', tr('Доба')),
            SegmentOption('7', tr('Тиждень')),
            SegmentOption('30', tr('Місяць')),
            SegmentOption('0', tr('Назавжди')),
          ],
        ),
        if (widget.canEverywhere) ...[
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: Text(tr('На всьому сайті, не лише в цій спільноті'), style: body(14, color: soft))),
            GcSwitch(value: everywhere, onChanged: busy ? null : (value) => setState(() => everywhere = value)),
          ]),
        ],
        const SizedBox(height: 14),
        Row(children: [
          Expanded(child: GhostButton(label: tr('Скасувати'), compact: true, onPressed: busy ? null : () => widget.onDone(false))),
          const SizedBox(width: 8),
          Expanded(child: DangerButton(label: tr('Заблокувати'), icon: LucideIcons.ban, expand: true, onPressed: busy ? null : _ban)),
        ]),
      ]),
    );
  }
}

/// Готові фони — ті самі ключі, що `CHAT_BACKGROUNDS` на сайті.
const chatBackgroundPresets = ['aurora', 'midnight', 'dusk', 'ocean', 'forest', 'dots', 'grid', 'waves'];

String chatBackgroundLabel(String preset) => switch (preset) {
      'aurora' => tr('Сяйво'),
      'midnight' => tr('Північ'),
      'dusk' => tr('Сутінки'),
      'ocean' => tr('Океан'),
      'forest' => tr('Ліс'),
      'dots' => tr('Крапки'),
      'grid' => tr('Сітка'),
      'waves' => tr('Хвилі'),
      _ => preset,
    };

/// Адміністратор групи чи каналу (власник або адмін).
bool chatCanModerate(Map<String, dynamic> chat) {
  final role = text(chat['my_role']);
  return chat['type'] == 'group' && (role == 'owner' || role == 'admin');
}

/// Хоч один бот бесіди увімкнений у профілі (`/me` → plugins).
bool chatBotsOn(Session session) => session.pluginOn('chat_welcome_bot') || session.pluginOn('chat_autoposter') || session.pluginOn('ai_chat_bot');

/// Тайм-аут ще триває — той самий текст, що замість поля вводу на сайті. Минулий строк — можна писати.
String? chatTimeoutText(dynamic iso) {
  final raw = text(iso);
  final date = raw == null ? null : DateTime.tryParse(raw)?.toLocal();
  if (date == null || !date.isAfter(DateTime.now())) return null;
  String two(int n) => n.toString().padLeft(2, '0');
  return tr('Адміністратори заборонили вам писати тут до {time}.', {'time': '${two(date.day)}.${two(date.month)} ${two(date.hour)}:${two(date.minute)}'});
}

/// Відповідь мосту фону — у картку бесіди (`background`, `my_background`, `shared_background`).
void applyChatBackground(Map<String, dynamic> conversation, Map<String, dynamic> saved) {
  if (saved.containsKey('background')) conversation['background'] = saved['background'];
  if (saved.containsKey('my_background')) conversation['my_background'] = saved['my_background'];
  if (saved.containsKey('shared_background')) conversation['shared_background'] = saved['shared_background'];
}

/// Тайм-аут чи виключення автора: плагін увімкнений, це група, і є право. Себе, бота й гостя — ні.
bool canOfferChatRestrict(Map<String, dynamic> chat, Map<String, dynamic> message, {required bool restrictionsOn}) {
  if (!restrictionsOn || !chatCanModerate(chat)) return false;
  if (message['type'] == 'system' || messageIsBot(message) || messageIsGuest(message)) return false;
  final user = message['user'];
  if (user is! Map) return false;
  return text(user['username']) != null;
}

/// Шар фону під повідомленнями: готовий візерунок або своє фото з затемненням.
class ChatBackdrop extends StatelessWidget {
  const ChatBackdrop({this.background, super.key});
  final Map<String, dynamic>? background;

  @override
  Widget build(BuildContext context) {
    final bg = background;
    if (bg == null || bg.isEmpty) return const SizedBox.shrink();
    final image = text(bg['image']);
    final preset = text(bg['preset']);
    if (image == null && preset == null) return const SizedBox.shrink();
    return ChatBackgroundPaint(preset: preset, imageUrl: image);
  }
}

/// Малює один фон чату (плитка вибору або шар під стрічкою).
class ChatBackgroundPaint extends StatelessWidget {
  const ChatBackgroundPaint({this.preset, this.imageUrl, super.key});
  final String? preset;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: palette.isLight ? 0.55 : 0.9,
      child: Stack(fit: StackFit.expand, children: _layers()),
    );
  }

  List<Widget> _layers() {
    final image = imageUrl;
    if (image != null) {
      return [
        Positioned.fill(child: NetImage(image, fit: BoxFit.cover)),
        Positioned.fill(child: ColoredBox(color: palette.voidColor.withValues(alpha: 0.55))),
      ];
    }
    return switch (preset) {
      'aurora' => [
        _glow(const Alignment(-0.7, -0.8), const Color.fromRGBO(99, 102, 241, 0.51)),
        _glow(const Alignment(0.7, -0.4), const Color.fromRGBO(34, 211, 238, 0.32)),
        _glow(const Alignment(0, 1), const Color.fromRGBO(168, 85, 247, 0.36)),
      ],
      'midnight' => [
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color.fromRGBO(8, 12, 28, 0.6), Color.fromRGBO(4, 6, 16, 0.51)]),
          ),
        ),
        _glow(const Alignment(0, -1), const Color.fromRGBO(30, 41, 99, 0.6), radius: 1.1),
      ],
      'dusk' => [
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color.fromRGBO(124, 58, 237, 0.41), Color.fromRGBO(236, 72, 153, 0.26), Color.fromRGBO(251, 146, 60, 0.23)],
              stops: [0, 0.55, 1],
            ),
          ),
        ),
      ],
      'ocean' => [
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [Color.fromRGBO(15, 118, 110, 0.32), Color.fromRGBO(30, 64, 175, 0.32)]),
          ),
        ),
        _glow(const Alignment(-1, 1), const Color.fromRGBO(14, 165, 233, 0.43), radius: 1.05),
      ],
      'forest' => [
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color.fromRGBO(20, 83, 45, 0.41), Color.fromRGBO(13, 148, 136, 0.2)]),
          ),
        ),
        _glow(const Alignment(0.7, 0.8), const Color.fromRGBO(16, 185, 129, 0.38)),
      ],
      'dots' || 'grid' || 'waves' => [CustomPaint(painter: _ChatPatternPainter(preset!, fg, primary), child: const SizedBox.expand())],
      _ => const [SizedBox.expand()],
    };
  }

  Widget _glow(Alignment center, Color color, {double radius = 0.9}) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: RadialGradient(center: center, radius: radius, colors: [color, color.withValues(alpha: 0)], stops: const [0, 0.7]),
      ),
    );
  }
}

class _ChatPatternPainter extends CustomPainter {
  _ChatPatternPainter(this.kind, this.ink, this.accent);
  final String kind;
  final Color ink;
  final Color accent;

  @override
  void paint(Canvas canvas, Size size) {
    if (kind == 'dots') {
      final paint = Paint()..color = ink.withValues(alpha: 0.22);
      for (var y = 9.0; y < size.height; y += 18) {
        for (var x = 9.0; x < size.width; x += 18) {
          canvas.drawCircle(Offset(x, y), 1, paint);
        }
      }
      return;
    }
    if (kind == 'grid') {
      final paint = Paint()
        ..color = ink.withValues(alpha: 0.09)
        ..strokeWidth = 1;
      for (var x = 0.0; x <= size.width; x += 28) {
        canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
      }
      for (var y = 0.0; y <= size.height; y += 28) {
        canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
      }
      return;
    }
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = accent.withValues(alpha: 0.16);
    final center = Offset(0, size.height);
    final reach = size.width + size.height;
    for (var radius = 22.0; radius < reach; radius += 23) {
      canvas.drawCircle(center, radius, paint);
    }
  }

  @override
  bool shouldRepaint(_ChatPatternPainter old) => old.kind != kind || old.ink != ink || old.accent != accent;
}

/// Вибір фону: для себе або (адміністраторам групи) для всіх. Повертає останнє збережене.
Future<Map<String, dynamic>?> showChatBackground(
  BuildContext context, {
  required int conversationId,
  required String? current,
  required String? shared,
  required bool canShare,
}) async {
  Map<String, dynamic>? saved;
  await showGcSheet<void>(
    context,
    title: tr('Фон чату'),
    height: MediaQuery.sizeOf(context).height * 0.78,
    builder: (sheet) => _ChatBackgroundBody(
      conversationId: conversationId,
      current: current,
      shared: shared,
      canShare: canShare,
      onSaved: (result) => saved = result,
    ),
  );
  return saved;
}

class _ChatBackgroundBody extends StatefulWidget {
  const _ChatBackgroundBody({required this.conversationId, required this.current, required this.shared, required this.canShare, required this.onSaved});
  final int conversationId;
  final String? current;
  final String? shared;
  final bool canShare;
  final ValueChanged<Map<String, dynamic>> onSaved;

  @override
  State<_ChatBackgroundBody> createState() => _ChatBackgroundBodyState();
}

class _ChatBackgroundBodyState extends State<_ChatBackgroundBody> {
  bool forAll = false;
  late String? mine = widget.current;
  late String? shared = widget.shared;
  bool busy = false;
  bool uploading = false;

  String? get selected => forAll ? shared : mine;

  Future<void> _commit(Map<String, dynamic> result) async {
    if (!mounted) return;
    setState(() {
      if (result.containsKey('my_background')) mine = text(result['my_background']);
      if (result.containsKey('shared_background')) shared = text(result['shared_background']);
      busy = false;
    });
    widget.onSaved(result);
  }

  Future<void> _preset(String? preset) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final result = await AppScope.read(context).session.api.post(Api.site('/messages/${widget.conversationId}/background'), {'preset': preset, 'for_all': forAll});
      await _commit(result);
    } catch (e) {
      if (mounted) {
        setState(() => busy = false);
        toast(context, e);
      }
    }
  }

  Future<void> _photo() async {
    if (busy) return;
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85, maxWidth: 2400);
    if (picked == null || !mounted) return;
    setState(() {
      busy = true;
      uploading = true;
    });
    try {
      final file = await http.MultipartFile.fromPath('image', picked.path, filename: picked.name);
      if (!mounted) return;
      final result = await AppScope.read(context).session.api.upload(Api.site('/messages/${widget.conversationId}/background'), {'for_all': forAll ? '1' : '0'}, [file]);
      await _commit(result);
    } catch (e) {
      if (mounted) {
        setState(() => busy = false);
        toast(context, e);
      }
    } finally {
      if (mounted) setState(() => uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final chosen = selected;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      children: [
        Text(forAll ? tr('Спільний фон бачать усі учасники, у кого немає свого.') : tr('Особистий фон бачите лише ви.'), style: body(13, color: muted)),
        if (widget.canShare) ...[
          const SizedBox(height: 12),
          Segmented(
            options: [SegmentOption('me', tr('Для мене')), SegmentOption('all', tr('Для всіх'))],
            selected: forAll ? 'all' : 'me',
            onSelect: busy ? (_) {} : (value) => setState(() => forAll = value == 'all'),
          ),
        ],
        const SizedBox(height: 12),
        GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          childAspectRatio: 3 / 4,
          children: [
            _tile(on: chosen == null, onTap: () => _preset(null), child: _labelTile(LucideIcons.x, tr('Без фону'))),
            for (final key in chatBackgroundPresets)
              _tile(
                on: chosen == key,
                onTap: () => _preset(key),
                child: Stack(fit: StackFit.expand, children: [
                  ChatBackgroundPaint(preset: key),
                  Align(
                    alignment: Alignment.bottomCenter,
                    child: ColoredBox(
                      color: Colors.black54,
                      child: SizedBox(width: double.infinity, child: Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Text(chatBackgroundLabel(key), textAlign: TextAlign.center, style: body(11, color: Colors.white, weight: FontWeight.w600)))),
                    ),
                  ),
                ]),
              ),
            _tile(on: chosen != null && chosen.startsWith('img:'), onTap: _photo, child: _labelTile(uploading ? LucideIcons.loader : LucideIcons.imagePlus, tr('Своє фото'))),
          ],
        ),
      ],
    );
  }

  Widget _labelTile(IconData icon, String label) {
    return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Icon(icon, size: 18, color: muted),
      const SizedBox(height: 6),
      Padding(padding: const EdgeInsets.symmetric(horizontal: 6), child: Text(label, textAlign: TextAlign.center, style: body(11, color: muted))),
    ]);
  }

  Widget _tile({required bool on, required VoidCallback onTap, required Widget child}) {
    return Material(
      color: fg.withValues(alpha: 0.05),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: busy ? null : onTap,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: on ? Border.all(color: primary, width: 2) : null),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Stack(fit: StackFit.expand, children: [
              child,
              if (on)
                Positioned(
                  top: 6,
                  right: 6,
                  child: Container(
                    width: 20,
                    height: 20,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: primary, shape: BoxShape.circle),
                    child: const Icon(LucideIcons.check, size: 12, color: Colors.white),
                  ),
                ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Боти бесіди: привітання, автопости й ШІ-бот. Вкладки — за прапорцями відповіді мосту.
Future<void> showChatBots(BuildContext context, int conversationId) {
  return showGcSheet<void>(
    context,
    title: tr('Боти бесіди'),
    subtitle: tr('Пишуть від імені бота з позначкою «бот». Час — за Києвом.'),
    height: MediaQuery.sizeOf(context).height * 0.86,
    builder: (sheet) => _ChatBotsBody(conversationId: conversationId),
  );
}

class _ChatBotsBody extends StatefulWidget {
  const _ChatBotsBody({required this.conversationId});
  final int conversationId;

  @override
  State<_ChatBotsBody> createState() => _ChatBotsBodyState();
}

class _ChatBotsBodyState extends State<_ChatBotsBody> {
  Map<String, dynamic>? data;
  String tab = 'welcome';
  bool busy = false;
  bool welcomeOn = true;
  bool aiOn = true;
  String repeat = 'daily';
  String postTime = '20:00';
  DateTime? postAt;
  List<int> weekdays = [5];
  final welcomeName = TextEditingController(text: 'Бот');
  final welcomeBody = TextEditingController(text: 'Вітаємо, {name}! Розкажіть, у що граєте 🎮');
  final aiName = TextEditingController(text: 'ШІ');
  final aiBody = TextEditingController();
  final postBody = TextEditingController();
  bool _seeded = false;

  static const _dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

  @override
  void dispose() {
    welcomeName.dispose();
    welcomeBody.dispose();
    aiName.dispose();
    aiBody.dispose();
    postBody.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  bool get welcomeFlag => data?['welcome_on'] != false;
  bool get postsFlag => data?['posts_on'] != false;
  bool get aiFlag => data?['ai_on'] == true;

  void _fill(TextEditingController controller, String value) {
    if (controller.text == value) return;
    controller.value = TextEditingValue(text: value, selection: TextSelection.collapsed(offset: value.length));
  }

  void _apply(Map<String, dynamic> overview, {bool first = false}) {
    data = {...?data, ...overview};
    if (overview['welcome'] is Map) {
      final welcome = mapOf(overview['welcome']);
      welcomeOn = welcome['enabled'] == true;
      _fill(welcomeName, text(welcome['bot_name']) ?? 'Бот');
      _fill(welcomeBody, text(welcome['body']) ?? '');
    }
    if (overview['ai'] is Map) {
      final ai = mapOf(overview['ai']);
      aiOn = ai['enabled'] == true;
      _fill(aiName, text(ai['bot_name']) ?? 'ШІ');
      _fill(aiBody, text(ai['body']) ?? '');
    }
    if (first && overview['welcome_on'] == false) tab = overview['posts_on'] == false ? 'ai' : 'posts';
  }

  Future<void> _load() async {
    try {
      final overview = await AppScope.read(context).session.api.get(Api.site('/messages/${widget.conversationId}/bots'));
      if (!mounted) return;
      setState(() => _apply(overview, first: !_seeded));
      _seeded = true;
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<bool> _run(String method, String path, [Map<String, dynamic>? body, String? ok]) async {
    if (busy) return false;
    setState(() => busy = true);
    try {
      final api = AppScope.read(context).session.api;
      final url = Api.site(path);
      final result = await switch (method) {
        'PUT' => api.put(url, body ?? {}),
        'POST' => api.post(url, body),
        'PATCH' => api.patch(url, body ?? {}),
        _ => api.delete(url),
      };
      if (!mounted) return false;
      setState(() {
        _apply(result);
        busy = false;
      });
      if (ok != null && mounted) toast(context, ok);
      return true;
    } catch (e) {
      if (mounted) {
        setState(() => busy = false);
        toast(context, e);
      }
      return false;
    }
  }

  String _when(dynamic iso) {
    final date = DateTime.tryParse('${text(iso)}')?.toLocal();
    if (date == null) return '—';
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(date.day)}.${two(date.month)} ${two(date.hour)}:${two(date.minute)}';
  }

  String _schedule(Map<String, dynamic> item) {
    final kind = text(item['repeat']);
    final time = text(item['time']) ?? '';
    if (kind == 'once') return tr('Один раз');
    if (kind == 'daily') return tr('Щодня о {time}', {'time': time});
    final days = item['weekdays'];
    final names = [for (final day in days is List ? days : const []) if (day is num && day >= 1 && day <= 7) tr(_dayLabels[day.toInt() - 1])];
    return '${names.join(', ')} · $time';
  }

  String _stamp(DateTime date) {
    String two(int n) => n.toString().padLeft(2, '0');
    return '${date.year}-${two(date.month)}-${two(date.day)}T${two(date.hour)}:${two(date.minute)}';
  }

  Future<void> _pickAt() async {
    final now = DateTime.now();
    final date = await showDatePicker(context: context, initialDate: postAt ?? now, firstDate: DateTime(now.year, now.month, now.day), lastDate: now.add(const Duration(days: 365)));
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(postAt ?? now));
    if (time == null || !mounted) return;
    setState(() => postAt = DateTime(date.year, date.month, date.day, time.hour, time.minute));
  }

  Future<void> _pickTime() async {
    final parts = postTime.split(':');
    final initial = TimeOfDay(hour: int.tryParse(parts.first) ?? 20, minute: parts.length > 1 ? (int.tryParse(parts[1]) ?? 0) : 0);
    final picked = await showTimePicker(context: context, initialTime: initial);
    if (picked != null && mounted) setState(() => postTime = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}');
  }

  @override
  Widget build(BuildContext context) {
    final overview = data;
    if (overview == null) return const Center(child: CircularProgressIndicator());
    final tabs = [
      if (welcomeFlag) SegmentOption('welcome', tr('Привітання')),
      if (postsFlag) SegmentOption('posts', tr('Автопости'), count: maps(overview['posts']).isEmpty ? null : maps(overview['posts']).length),
      if (aiFlag) SegmentOption('ai', tr('ШІ-бот')),
    ];
    final current = tabs.any((option) => option.id == tab) ? tab : (tabs.isEmpty ? tab : tabs.first.id);
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      children: [
        if (tabs.isEmpty)
          Text(tr('Боти вимкнені.'), style: body(14, color: muted))
        else ...[
          Segmented(scroll: true, options: tabs, selected: current, onSelect: (value) => setState(() => tab = value)),
          const SizedBox(height: 14),
          if (current == 'welcome') _welcome(),
          if (current == 'ai') _ai(),
          if (current == 'posts') _posts(maps(overview['posts'])),
        ],
      ],
    );
  }

  Widget _welcome() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Expanded(child: Text(tr('Вітати кожного, хто приєднався'), style: body(14, color: soft))),
        GcSwitch(value: welcomeOn, onChanged: busy ? null : (value) => setState(() => welcomeOn = value)),
      ]),
      const SizedBox(height: 10),
      GcField(controller: welcomeName, label: tr('Ім’я бота')),
      const SizedBox(height: 8),
      GcField(controller: welcomeBody, label: tr('Текст привітання'), maxLines: 4, minLines: 3, onChanged: (_) => setState(() {})),
      const SizedBox(height: 6),
      Text(tr('{name} — ім’я новенького, {chat} — назва бесіди.'), style: body(12, color: muted)),
      const SizedBox(height: 12),
      PrimaryButton(
        label: tr('Зберегти'),
        expand: false,
        onPressed: busy || welcomeBody.text.trim().isEmpty
            ? null
            : () => _run('PUT', '/messages/${widget.conversationId}/bots/welcome', {'enabled': welcomeOn, 'bot_name': welcomeName.text, 'body': welcomeBody.text}, tr('Привітання збережено.')),
      ),
    ]);
  }

  Widget _ai() {
    final name = aiName.text.trim().isEmpty ? 'ШІ' : aiName.text.trim();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Expanded(child: Text(tr('Відповідає, коли його кличуть'), style: body(14, color: soft))),
        GcSwitch(value: aiOn, onChanged: busy ? null : (value) => setState(() => aiOn = value)),
      ]),
      const SizedBox(height: 10),
      GcField(controller: aiName, label: tr('Ім’я бота'), onChanged: (_) => setState(() {})),
      const SizedBox(height: 8),
      GcField(controller: aiBody, label: tr('Характер і правила'), maxLines: 4, minLines: 3),
      const SizedBox(height: 6),
      Text(tr('Згадайте @{name} або почніть повідомлення з /ші. Бот бачить останні повідомлення бесіди.', {'name': name}), style: body(12, color: muted)),
      const SizedBox(height: 12),
      PrimaryButton(
        label: tr('Зберегти'),
        expand: false,
        onPressed: busy || aiName.text.trim().isEmpty
            ? null
            : () => _run('PUT', '/messages/${widget.conversationId}/bots/ai', {'enabled': aiOn, 'bot_name': aiName.text, 'body': aiBody.text}, tr('ШІ-бота збережено.')),
      ),
    ]);
  }

  Widget _posts(List<Map<String, dynamic>> posts) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (final item in posts)
        Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
          decoration: BoxDecoration(color: fg.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(14)),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(padding: const EdgeInsets.only(top: 2), child: Icon(LucideIcons.calendarClock, size: 16, color: muted)),
            const SizedBox(width: 8),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(text(item['body']) ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(14, color: soft)),
                const SizedBox(height: 4),
                Text(
                  '${_schedule(item)} · ${item['enabled'] == true ? tr('далі {when}', {'when': _when(item['next_run_at'])}) : (text(item['last_run_at']) != null ? tr('надіслано {when}', {'when': _when(item['last_run_at'])}) : tr('вимкнено'))}',
                  style: body(12, color: muted),
                ),
              ]),
            ),
            GcSwitch(
              value: item['enabled'] == true,
              onChanged: busy || (item['repeat'] == 'once' && item['enabled'] != true) ? null : (value) => _run('PATCH', '/messages/${widget.conversationId}/bots/posts/${item['id']}', {'enabled': value}),
            ),
            IconButton(
              tooltip: tr('Видалити'),
              onPressed: busy ? null : () => _run('DELETE', '/messages/${widget.conversationId}/bots/posts/${item['id']}'),
              icon: Icon(LucideIcons.trash2, size: 18, color: muted),
            ),
          ]),
        ),
      Text(tr('Новий автопост'), style: body(14, weight: FontWeight.w700)),
      const SizedBox(height: 8),
      GcField(controller: postBody, label: tr('Текст'), maxLines: 3, minLines: 2, onChanged: (_) => setState(() {})),
      const SizedBox(height: 8),
      Segmented(
        scroll: true,
        options: [SegmentOption('once', tr('Один раз')), SegmentOption('daily', tr('Щодня')), SegmentOption('weekly', tr('По днях'))],
        selected: repeat,
        onSelect: (value) => setState(() => repeat = value),
      ),
      const SizedBox(height: 8),
      if (repeat == 'once')
        GhostButton(
          label: postAt == null ? tr('Дата й час') : _stamp(postAt!).replaceFirst('T', ' '),
          icon: LucideIcons.calendarClock,
          expand: false,
          compact: true,
          onPressed: _pickAt,
        )
      else
        GhostButton(label: postTime, icon: LucideIcons.clock, expand: false, compact: true, onPressed: _pickTime),
      if (repeat == 'weekly') ...[
        const SizedBox(height: 8),
        Row(children: [
          for (var index = 0; index < _dayLabels.length; index++)
            Expanded(
              child: Padding(
                padding: EdgeInsets.only(left: index == 0 ? 0 : 4),
                child: _day(index + 1, tr(_dayLabels[index])),
              ),
            ),
        ]),
      ],
      const SizedBox(height: 12),
      PrimaryButton(
        label: tr('Додати'),
        icon: LucideIcons.plus,
        expand: false,
        onPressed: busy || postBody.text.trim().isEmpty || (repeat == 'once' && postAt == null)
            ? null
            : () async {
                final added = await _run('POST', '/messages/${widget.conversationId}/bots/posts', {
                  'body': postBody.text,
                  'bot_name': 'Бот',
                  'repeat': repeat,
                  'at': postAt == null ? null : _stamp(postAt!),
                  'time': postTime,
                  'weekdays': weekdays,
                }, tr('Автопост додано.'));
                if (added && mounted) postBody.clear();
              },
      ),
    ]);
  }

  Widget _day(int day, String label) {
    final on = weekdays.contains(day);
    return Material(
      color: on ? primary : fg.withValues(alpha: 0.06),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: () => setState(() => weekdays = on ? [for (final item in weekdays) if (item != day) item] : [...weekdays, day]),
        borderRadius: BorderRadius.circular(10),
        child: SizedBox(height: 36, child: Center(child: Text(label, style: body(11, color: on ? Colors.white : soft, weight: FontWeight.w700)))),
      ),
    );
  }
}

/// Тайм-аут (читає, не пише) або виключення на час. true — обмеження поставлено.
Future<bool> showChatRestrict(BuildContext context, {required int conversationId, required Map<String, dynamic> user}) async {
  final username = text(user['username']);
  if (username == null) return false;
  final applied = await showGcSheet<bool>(
    context,
    title: text(user['name']) ?? username,
    subtitle: tr('Обмеження зніметься саме, коли мине строк.'),
    builder: (sheet) => _RestrictBody(conversationId: conversationId, username: username, onDone: (ok) => Navigator.of(sheet).pop(ok)),
  );
  return applied == true;
}

class _RestrictBody extends StatefulWidget {
  const _RestrictBody({required this.conversationId, required this.username, required this.onDone});
  final int conversationId;
  final String username;
  final ValueChanged<bool> onDone;

  @override
  State<_RestrictBody> createState() => _RestrictBodyState();
}

class _RestrictBodyState extends State<_RestrictBody> {
  bool busy = false;

  static const _durations = [5, 60, 1440, 10080];

  String _label(int minutes) => switch (minutes) {
        5 => tr('5 хвилин'),
        60 => tr('Година'),
        1440 => tr('Доба'),
        _ => tr('Тиждень'),
      };

  Future<void> _apply(String kind, int minutes) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      await AppScope.read(context).session.api.post(Api.site('/messages/${widget.conversationId}/members/${widget.username}/restrict'), {'kind': kind, 'minutes': minutes});
      if (!mounted) return;
      widget.onDone(true);
    } catch (e) {
      if (mounted) {
        setState(() => busy = false);
        toast(context, e);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _kind(LucideIcons.clock, tr('Тайм-аут'), tr('Читає, але не пише.'), 'timeout', kick: false),
        const SizedBox(height: 14),
        _kind(LucideIcons.userX, tr('Виключити на час'), tr('Виходить і не може повернутися до строку.'), 'kick', kick: true),
      ]),
    );
  }

  Widget _kind(IconData icon, String title, String hint, String kind, {required bool kick}) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Icon(icon, size: 16, color: muted),
        const SizedBox(width: 8),
        Text(title, style: body(14, weight: FontWeight.w700)),
      ]),
      Padding(padding: const EdgeInsets.only(left: 24, top: 2, bottom: 8), child: Text(hint, style: body(12, color: muted))),
      Row(children: [
        for (final minutes in _durations) ...[
          if (minutes != _durations.first) const SizedBox(width: 6),
          Expanded(
            child: Material(
              color: kick ? danger.withValues(alpha: 0.12) : fg.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(12),
              child: InkWell(
                onTap: busy ? null : () => _apply(kind, minutes),
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(height: 40, child: Center(child: FitText(_label(minutes), style: body(11.5, color: kick ? dangerSoft : soft, weight: FontWeight.w600)))),
              ),
            ),
          ),
        ],
      ]),
    ]);
  }
}
