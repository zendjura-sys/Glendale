import 'dart:async';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

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
                    child: url == null
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
