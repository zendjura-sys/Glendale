import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:just_audio/just_audio.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'posts.dart';
import 'push.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// ───────────────────────── Список бесід ─────────────────────────

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  final query = TextEditingController();
  List<Map<String, dynamic>> conversations = [];
  bool loading = true;
  Timer? poll;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    // На сайті список оновлює Reverb; у застосунку — легке опитування, поки екран відкритий.
    poll = Timer.periodic(const Duration(seconds: 12), (_) => _load(quiet: true));
  }

  @override
  void dispose() {
    poll?.cancel();
    query.dispose();
    super.dispose();
  }

  Future<void> _load({bool quiet = false}) async {
    final session = AppScope.read(context).session;
    try {
      final data = await session.api.get('/api/v1/messages');
      if (!mounted) return;
      setState(() {
        conversations = maps(data['conversations']);
        loading = false;
      });
      final unread = intOf(data['unread']);
      if (unread != session.unreadChats) unawaited(session.refreshCounters());
    } catch (e) {
      if (!mounted) return;
      setState(() => loading = false);
      if (!quiet) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = query.text.trim().toLowerCase();
    final shown = q.isEmpty ? conversations : conversations.where((c) => (text(c['title']) ?? '').toLowerCase().contains(q)).toList();
    return ScreenScroll(
      onRefresh: _load,
      children: [
        Glass(
          padding: const EdgeInsets.fromLTRB(14, 16, 14, 10),
          radius: 24,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(child: Text('Повідомлення', style: display(20))),
                RoundIcon(icon: LucideIcons.squarePen, tooltip: 'Нове повідомлення', color: soft, onTap: () => showNewConversation(context)),
              ]),
              const SizedBox(height: 12),
              GcField(controller: query, label: 'Пошук', icon: LucideIcons.search, dense: true, onChanged: (_) => setState(() {})),
              const SizedBox(height: 8),
              if (loading)
                const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator(strokeWidth: 2.4)))
              else if (conversations.isEmpty)
                EmptyState(
                  boxed: false,
                  icon: LucideIcons.messageCircle,
                  title: 'Повідомлень поки немає',
                  text: 'Напишіть другу або створіть бесіду для своєї компанії.',
                  action: 'Нове повідомлення',
                  actionIcon: LucideIcons.pencil,
                  onAction: () => showNewConversation(context),
                )
              else if (shown.isEmpty)
                const QuietEmpty(icon: LucideIcons.searchX, text: 'Нічого не знайдено')
              else
                for (final conversation in shown) _ConversationRow(conversation: conversation),
            ],
          ),
        ),
      ],
    );
  }
}

class _ConversationRow extends StatelessWidget {
  const _ConversationRow({required this.conversation});
  final Map<String, dynamic> conversation;

  @override
  Widget build(BuildContext context) {
    final last = conversation['last_message'] is Map ? mapOf(conversation['last_message']) : null;
    final peer = conversation['peer'] is Map ? mapOf(conversation['peer']) : null;
    final group = conversation['type'] == 'group';
    final unread = intOf(conversation['unread']);
    final title = text(conversation['title']) ?? 'Бесіда';
    final prefix = last == null ? '' : (last['is_own'] == true ? 'Ви: ' : (group && text(last['author']) != null ? '${last['author']}: ' : ''));
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => context.push('/messages/${conversation['id']}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 4),
        child: Row(
          children: [
            group && text(conversation['avatar_url']) == null
                ? Container(
                    width: 50,
                    height: 50,
                    decoration: const BoxDecoration(gradient: buttonGradient, shape: BoxShape.circle),
                    child: const Icon(LucideIcons.usersRound, color: Colors.white),
                  )
                : Avatar(url: text(conversation['avatar_url']), name: title, size: 50, online: peer?['is_online'] == true),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Expanded(child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(15, weight: FontWeight.w700))),
                    if (conversation['is_muted'] == true) const Padding(padding: EdgeInsets.only(right: 4), child: Icon(LucideIcons.bellOff, size: 14, color: faint)),
                    if (last != null) Text(shortStamp(last['created_at']), style: body(11.5, color: muted)),
                  ]),
                  const SizedBox(height: 3),
                  Row(children: [
                    Expanded(
                      child: Text.rich(
                        TextSpan(children: [
                          TextSpan(text: prefix, style: body(13, color: soft.withValues(alpha: 0.8))),
                          TextSpan(text: text(last?['preview']) ?? 'Немає повідомлень'),
                        ]),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: body(13, color: muted),
                      ),
                    ),
                    if (unread > 0)
                      Container(
                        margin: const EdgeInsets.only(left: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(color: conversation['is_muted'] == true ? faint : primary, borderRadius: BorderRadius.circular(10)),
                        child: Text('$unread', style: body(11, weight: FontWeight.w700)),
                      ),
                  ]),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ───────────────────────── Нова бесіда ─────────────────────────

Future<void> showNewConversation(BuildContext context) async {
  final id = await showGcSheet<int>(
    context,
    title: 'Нове повідомлення',
    subtitle: 'Оберіть друга, якому хочете написати, або створіть груповий чат.',
    height: MediaQuery.sizeOf(context).height * 0.82,
    builder: (sheet) => _NewConversation(onOpen: (id) => Navigator.pop(sheet, id)),
  );
  if (id != null && context.mounted) context.push('/messages/$id');
}

class _NewConversation extends StatefulWidget {
  const _NewConversation({required this.onOpen});
  final ValueChanged<int> onOpen;

  @override
  State<_NewConversation> createState() => _NewConversationState();
}

class _NewConversationState extends State<_NewConversation> {
  String mode = 'direct';
  final query = TextEditingController();
  final title = TextEditingController();
  List<Map<String, dynamic>> friends = [];
  final picked = <Map<String, dynamic>>[];
  bool loading = true;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final data = await AppScope.read(context).session.api.get('/api/v1/messages/contacts');
        if (mounted) setState(() => friends = maps(data['users']));
      } catch (e) {
        if (mounted) toast(context, e);
      } finally {
        if (mounted) setState(() => loading = false);
      }
    });
  }

  @override
  void dispose() {
    query.dispose();
    title.dispose();
    super.dispose();
  }

  Future<void> _direct(Map<String, dynamic> user) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final data = await AppScope.read(context).session.api.post('/api/v1/messages/with/${user['username']}');
      widget.onOpen(intOf(data['id']));
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _group() async {
    if (busy || title.text.trim().isEmpty || picked.isEmpty) return;
    setState(() => busy = true);
    try {
      final data = await AppScope.read(context).session.api.post('/api/v1/messages/groups', {
        'title': title.text.trim(),
        'user_ids': [for (final user in picked) user['id']],
      });
      widget.onOpen(intOf(data['id']));
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = query.text.trim().toLowerCase();
    final shown = friends.where((f) => q.isEmpty || '${f['name']} ${f['username']}'.toLowerCase().contains(q)).toList();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      child: Column(
        children: [
          Segmented(
            options: const [SegmentOption('direct', 'Повідомлення', icon: LucideIcons.messageCircle), SegmentOption('group', 'Нова бесіда', icon: LucideIcons.usersRound)],
            selected: mode,
            onSelect: (value) => setState(() => mode = value),
          ),
          const SizedBox(height: 12),
          if (mode == 'group') ...[
            GcField(controller: title, label: 'Назва бесіди', dense: true, onChanged: (_) => setState(() {})),
            if (picked.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Wrap(spacing: 6, runSpacing: 6, children: [
                    for (final user in picked)
                      InputChip(
                        avatar: Avatar(url: text(user['avatar_url']), name: text(user['name']) ?? '?', size: 22),
                        label: Text(text(user['first_name']) ?? text(user['name']) ?? '', style: body(12.5)),
                        onDeleted: () => setState(() => picked.remove(user)),
                        backgroundColor: Colors.white.withValues(alpha: 0.06),
                        side: const BorderSide(color: line),
                      ),
                  ]),
                ),
              ),
            const SizedBox(height: 10),
          ],
          GcField(controller: query, label: 'Пошук серед друзів', icon: LucideIcons.search, dense: true, onChanged: (_) => setState(() {})),
          const SizedBox(height: 8),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                : shown.isEmpty
                    ? const QuietEmpty(icon: LucideIcons.usersRound, text: 'Друзів не знайдено. Писати можна друзям і тим, хто приймає повідомлення від усіх.')
                    : ListView(
                        children: [
                          for (final user in shown)
                            UserTile(
                              user: user,
                              onTap: () {
                                if (mode == 'direct') {
                                  _direct(user);
                                } else {
                                  setState(() => picked.any((p) => p['id'] == user['id']) ? picked.removeWhere((p) => p['id'] == user['id']) : picked.add(user));
                                }
                              },
                              trailing: mode == 'group'
                                  ? Icon(
                                      picked.any((p) => p['id'] == user['id']) ? LucideIcons.circleCheck : LucideIcons.circle,
                                      color: picked.any((p) => p['id'] == user['id']) ? primary : faint,
                                    )
                                  : null,
                            ),
                        ],
                      ),
          ),
          if (mode == 'group')
            PrimaryButton(label: 'Створити бесіду', busy: busy, onPressed: title.text.trim().isNotEmpty && picked.isNotEmpty ? _group : null),
        ],
      ),
    );
  }
}

// ───────────────────────── Бесіда ─────────────────────────

class ChatScreen extends StatefulWidget {
  const ChatScreen({required this.id, super.key});
  final int id;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  Map<String, dynamic>? conversation;
  final messages = <Map<String, dynamic>>[];
  bool hasMore = false;
  bool loadingOlder = false;
  Object? error;
  Timer? poll;
  final scroll = ScrollController();
  final input = TextEditingController();
  final focus = FocusNode();
  Map<String, dynamic>? replyTo;
  Map<String, dynamic>? editing;
  final images = <XFile>[];
  final files = <PlatformFile>[];
  bool sending = false;
  int lastRead = 0;

  Api get api => AppScope.read(context).session.api;
  int? get myId => AppScope.read(context).session.myId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    unawaited(Push.instance?.seenChat(widget.id));
    poll = Timer.periodic(const Duration(seconds: 4), (_) => _refresh());
    scroll.addListener(() {
      if (scroll.position.pixels > scroll.position.maxScrollExtent - 300) _older();
    });
  }

  @override
  void dispose() {
    poll?.cancel();
    scroll.dispose();
    input.dispose();
    focus.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await api.get('/api/v1/messages/${widget.id}');
      if (!mounted) return;
      final history = mapOf(data['history']);
      setState(() {
        conversation = mapOf(data['conversation']);
        messages
          ..clear()
          ..addAll(maps(history['messages']));
        hasMore = history['has_more'] == true;
        error = null;
      });
      _markRead();
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  /// Нові повідомлення й межа прочитаного (на сайті — через Reverb).
  Future<void> _refresh() async {
    if (conversation == null || sending) return;
    try {
      final data = await api.get('/api/v1/messages/${widget.id}');
      if (!mounted) return;
      final fresh = maps(mapOf(data['history'])['messages']);
      final freshIds = {for (final m in fresh) '${m['id']}'};
      final oldest = fresh.isEmpty ? 0 : intOf(fresh.first['id']);
      setState(() {
        conversation = mapOf(data['conversation']);
        // Замінюємо «вікно» останніх повідомлень, залишаючи старіші, підвантажені раніше.
        messages.removeWhere((m) => intOf(m['id']) >= oldest || freshIds.contains('${m['id']}'));
        messages.addAll(fresh);
      });
      _markRead();
    } catch (_) {}
  }

  Future<void> _older() async {
    if (!hasMore || loadingOlder || messages.isEmpty) return;
    loadingOlder = true;
    try {
      final data = await api.get('/api/v1/messages/${widget.id}/history?before=${messages.first['id']}');
      if (!mounted) return;
      setState(() {
        messages.insertAll(0, maps(data['messages']));
        hasMore = data['has_more'] == true;
      });
    } catch (_) {
    } finally {
      loadingOlder = false;
    }
  }

  void _markRead() {
    if (messages.isEmpty) return;
    final last = intOf(messages.last['id']);
    if (last <= lastRead) return;
    lastRead = last;
    final session = AppScope.read(context).session;
    unawaited(session.api.post('/api/v1/messages/${widget.id}/read', {'message_id': last}).then((_) => session.refreshCounters()).catchError((_) {}));
  }

  Future<void> _send({Map<String, String>? extra}) async {
    final value = input.text.trim();
    if (sending) return;
    if (editing != null) return _saveEdit(value);
    if (value.isEmpty && images.isEmpty && files.isEmpty && extra == null) return;
    setState(() => sending = true);
    try {
      final fields = <String, String>{
        if (value.isNotEmpty && extra == null) 'body': value,
        if (replyTo != null) 'reply_to_id': '${replyTo!['id']}',
        ...?extra,
      };
      final parts = <http.MultipartFile>[
        if (extra == null) for (final image in images) await http.MultipartFile.fromPath('images[]', image.path, filename: image.name),
        if (extra == null)
          for (final file in files)
            if (file.path != null) await http.MultipartFile.fromPath('files[]', file.path!, filename: file.name),
      ];
      final data = await api.upload('/api/v1/messages/${widget.id}', fields, parts);
      if (!mounted) return;
      setState(() {
        if (data['message'] is Map) messages.add(mapOf(data['message']));
        if (extra == null) {
          input.clear();
          images.clear();
          files.clear();
        }
        replyTo = null;
      });
      if (scroll.hasClients) unawaited(scroll.animateTo(0, duration: const Duration(milliseconds: 250), curve: Curves.easeOut));
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Future<void> _saveEdit(String value) async {
    final message = editing!;
    if (value.isEmpty) return;
    setState(() => sending = true);
    try {
      final data = await api.patch(Api.site('/messages/${widget.id}/messages/${message['id']}'), {'body': value});
      if (!mounted) return;
      setState(() {
        final index = messages.indexWhere((m) => m['id'] == message['id']);
        if (index >= 0 && data['message'] is Map) messages[index] = mapOf(data['message']);
        editing = null;
        input.clear();
      });
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Future<void> _attach() async {
    final choice = await showGcSheet<String>(
      context,
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          _AttachOption(icon: LucideIcons.image, color: const Color(0xFF38BDF8), title: 'Фото', subtitle: 'JPG, PNG, WebP, GIF', onTap: () => Navigator.pop(sheet, 'photo')),
          _AttachOption(icon: LucideIcons.file, color: violet, title: 'Файл', subtitle: 'до 50 МБ', onTap: () => Navigator.pop(sheet, 'file')),
          _AttachOption(icon: LucideIcons.userRound, color: const Color(0xFF2DD4BF), title: 'Контакт', subtitle: 'Пошук на GameCon', onTap: () => Navigator.pop(sheet, 'contact')),
        ]),
      ),
    );
    if (!mounted || choice == null) return;
    switch (choice) {
      case 'photo':
        final picked = await ImagePicker().pickMultiImage(imageQuality: 88);
        if (picked.isNotEmpty) setState(() => images.addAll(picked.take(10 - images.length - files.length)));
      case 'file':
        final result = await FilePicker.platform.pickFiles(allowMultiple: true);
        if (result != null) setState(() => files.addAll(result.files.take(10 - images.length - files.length)));
      case 'contact':
        final user = await _pickContact();
        if (user != null) await _send(extra: {'contact_id': '${user['id']}'});
    }
  }

  Future<Map<String, dynamic>?> _pickContact() {
    return showGcSheet<Map<String, dynamic>>(
      context,
      title: 'Надіслати контакт',
      height: MediaQuery.sizeOf(context).height * 0.7,
      builder: (sheet) => _ContactPicker(onPick: (user) => Navigator.pop(sheet, user)),
    );
  }

  Future<void> _stickers() async {
    final sticker = await showGcSheet<Map<String, dynamic>>(
      context,
      height: MediaQuery.sizeOf(context).height * 0.55,
      builder: (sheet) => _StickerPicker(
        onSticker: (sticker) => Navigator.pop(sheet, sticker),
        onEmoji: (emoji) {
          final selection = input.selection;
          final at = selection.isValid ? selection.start : input.text.length;
          input.text = input.text.replaceRange(at, selection.isValid ? selection.end : at, emoji);
          input.selection = TextSelection.collapsed(offset: at + emoji.length);
          setState(() {});
        },
      ),
    );
    if (sticker != null) await _send(extra: {'sticker_id': '${sticker['id']}'});
  }

  Future<void> _messageMenu(Map<String, dynamic> message) async {
    final own = intOf(mapOf(message['user'])['id']) == myId;
    final hasText = (text(message['body']) ?? '').isNotEmpty;
    final choice = await showGcSheet<String>(
      context,
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          SheetAction(icon: LucideIcons.reply, label: 'Відповісти', onTap: () => Navigator.pop(sheet, 'reply')),
          if (hasText) SheetAction(icon: LucideIcons.copy, label: 'Копіювати текст', onTap: () => Navigator.pop(sheet, 'copy')),
          if (own && hasText && message['type'] == 'text') SheetAction(icon: LucideIcons.pencil, label: 'Редагувати', onTap: () => Navigator.pop(sheet, 'edit')),
          if (own) SheetAction(icon: LucideIcons.trash2, label: 'Видалити', color: dangerSoft, onTap: () => Navigator.pop(sheet, 'delete')),
        ]),
      ),
    );
    if (!mounted || choice == null) return;
    switch (choice) {
      case 'reply':
        setState(() {
          editing = null;
          replyTo = message;
        });
        focus.requestFocus();
      case 'copy':
        await Clipboard.setData(ClipboardData(text: text(message['body']) ?? ''));
        if (mounted) toast(context, 'Скопійовано.');
      case 'edit':
        setState(() {
          replyTo = null;
          editing = message;
          input.text = text(message['body']) ?? '';
        });
        focus.requestFocus();
      case 'delete':
        if (!await confirm(context, 'Видалити повідомлення?', text: 'Його не побачить ніхто з учасників.', action: 'Видалити', danger: true)) return;
        if (!mounted) return;
        if (await attempt(context, () => api.delete(Api.site('/messages/${widget.id}/messages/${message['id']}')))) {
          setState(() => messages.removeWhere((m) => m['id'] == message['id']));
        }
    }
  }

  Future<void> _toggleMute() async {
    final next = conversation?['is_muted'] != true;
    if (await attempt(context, () => api.post('/api/v1/messages/${widget.id}/mute', {'muted': next}), success: next ? 'Сповіщення вимкнено.' : 'Сповіщення увімкнено.')) {
      setState(() => conversation?['is_muted'] = next);
    }
  }

  @override
  Widget build(BuildContext context) {
    final chat = conversation;
    if (chat == null) {
      return error != null
          ? Center(child: Padding(padding: const EdgeInsets.all(20), child: EmptyState(icon: LucideIcons.messageCircle, title: 'Бесіда недоступна', text: '$error', action: 'Назад', onAction: () => context.go('/messages'))))
          : const Center(child: CircularProgressIndicator(strokeWidth: 2.4));
    }
    final group = chat['type'] == 'group';
    final peer = chat['peer'] is Map ? mapOf(chat['peer']) : null;
    final readUpTo = intOf(chat['read_up_to']);
    final reversed = messages.reversed.toList();
    final subtitle = group
        ? '${chat['members_count']} ${plural(intOf(chat['members_count']), 'учасник', 'учасники', 'учасників')}'
        : (peer?['is_online'] == true ? 'онлайн' : (text(peer?['last_seen_at']) != null ? 'був(-ла) ${ago(peer?['last_seen_at'])}' : ''));

    return Padding(
      padding: EdgeInsets.fromLTRB(10, siteHeaderInset(context) + 4, 10, 0),
      child: Glass(
        padding: EdgeInsets.zero,
        radius: 24,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 8, 6, 8),
              child: Row(children: [
                IconButton(onPressed: () => context.canPop() ? context.pop() : context.go('/messages'), icon: const Icon(LucideIcons.arrowLeft, color: soft)),
                Expanded(
                  child: GestureDetector(
                    onTap: () => group ? _showMembers() : (peer != null ? context.push('/u/${peer['username']}') : null),
                    child: Row(children: [
                      group && text(chat['avatar_url']) == null
                          ? Container(width: 38, height: 38, decoration: const BoxDecoration(gradient: buttonGradient, shape: BoxShape.circle), child: const Icon(LucideIcons.usersRound, size: 20, color: Colors.white))
                          : Avatar(url: text(chat['avatar_url']), name: text(chat['title']) ?? '?', size: 38, online: peer?['is_online'] == true),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(text(chat['title']) ?? 'Бесіда', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(15, weight: FontWeight.w700)),
                          if (subtitle.isNotEmpty) Text(subtitle, style: body(12, color: peer?['is_online'] == true ? green : muted)),
                        ]),
                      ),
                    ]),
                  ),
                ),
                IconButton(
                  tooltip: chat['is_muted'] == true ? 'Увімкнути сповіщення' : 'Вимкнути сповіщення',
                  onPressed: _toggleMute,
                  icon: Icon(chat['is_muted'] == true ? LucideIcons.bellOff : LucideIcons.bell, color: muted),
                ),
                if (group) IconButton(onPressed: _showMembers, icon: const Icon(LucideIcons.info, color: muted)),
              ]),
            ),
            Divider(height: 1, color: line),
            Expanded(
              child: messages.isEmpty
                  ? const QuietEmpty(icon: LucideIcons.hand, text: 'Напишіть перше повідомлення')
                  : ListView.builder(
                      controller: scroll,
                      reverse: true,
                      padding: const EdgeInsets.fromLTRB(10, 12, 10, 12),
                      itemCount: reversed.length,
                      itemBuilder: (context, i) {
                        final message = reversed[i];
                        final previous = i + 1 < reversed.length ? reversed[i + 1] : null;
                        final day = _dayOf(message['created_at']);
                        final showDay = previous == null || _dayOf(previous['created_at']) != day;
                        return Column(children: [
                          if (showDay) _DayLabel(iso: message['created_at']),
                          _Bubble(
                            message: message,
                            own: intOf(mapOf(message['user'])['id']) == myId,
                            group: group,
                            read: intOf(message['id']) <= readUpTo,
                            onMenu: () => _messageMenu(message),
                            conversationId: widget.id,
                          ),
                        ]);
                      },
                    ),
            ),
            if (chat['can_write'] == false)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text('Ви не можете написати цьому користувачу.', textAlign: TextAlign.center, style: body(13, color: muted)),
              )
            else
              _composer(),
          ],
        ),
      ),
    );
  }

  String _dayOf(dynamic iso) {
    final date = DateTime.tryParse('$iso')?.toLocal();
    return date == null ? '' : '${date.year}-${date.month}-${date.day}';
  }

  Widget _composer() {
    final banner = editing != null
        ? ('Редагування', text(editing!['body']) ?? '', LucideIcons.pencil)
        : replyTo != null
            ? ('Відповідь ${text(mapOf(replyTo!['user'])['first_name']) ?? ''}', text(replyTo!['preview']) ?? '', LucideIcons.reply)
            : null;
    return Container(
      padding: EdgeInsets.fromLTRB(8, 6, 8, 8 + ShellChrome.bottomOf(context)),
      decoration: const BoxDecoration(border: Border(top: BorderSide(color: line))),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (banner != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 2, 0, 6),
              child: Row(children: [
                Icon(banner.$3, size: 16, color: primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(banner.$1, style: body(12, color: primary, weight: FontWeight.w700)),
                    Text(banner.$2, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12.5, color: muted)),
                  ]),
                ),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  onPressed: () => setState(() {
                    if (editing != null) input.clear();
                    editing = null;
                    replyTo = null;
                  }),
                  icon: const Icon(LucideIcons.x, size: 18, color: muted),
                ),
              ]),
            ),
          if (images.isNotEmpty || files.isNotEmpty)
            SizedBox(
              height: 64,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.only(bottom: 6, left: 4),
                children: [
                  for (var i = 0; i < images.length; i++)
                    _Pending(
                      onRemove: () => setState(() => images.removeAt(i)),
                      child: ClipRRect(borderRadius: BorderRadius.circular(10), child: Image(image: XFileImage(images[i]), width: 56, height: 56, fit: BoxFit.cover)),
                    ),
                  for (var i = 0; i < files.length; i++)
                    _Pending(
                      onRemove: () => setState(() => files.removeAt(i)),
                      child: Container(
                        width: 120,
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(10)),
                        child: Row(children: [
                          const Icon(LucideIcons.file, size: 18, color: violet),
                          const SizedBox(width: 6),
                          Expanded(child: Text(files[i].name, maxLines: 2, overflow: TextOverflow.ellipsis, style: body(11))),
                        ]),
                      ),
                    ),
                ],
              ),
            ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (editing == null) RoundIcon(icon: LucideIcons.paperclip, onTap: _attach, color: soft, tooltip: 'Вкладення'),
              const SizedBox(width: 4),
              Expanded(
                child: TextField(
                  controller: input,
                  focusNode: focus,
                  minLines: 1,
                  maxLines: 6,
                  textCapitalization: TextCapitalization.sentences,
                  onChanged: (_) => setState(() {}),
                  style: body(16),
                  decoration: InputDecoration(
                    hintText: 'Напишіть повідомлення…',
                    hintStyle: body(14.5, color: faint),
                    filled: true,
                    fillColor: field,
                    isDense: true,
                    contentPadding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: const BorderSide(color: lineStrong)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: const BorderSide(color: lineStrong)),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: const BorderSide(color: primary, width: 1.4)),
                    suffixIcon: editing == null ? IconButton(onPressed: _stickers, icon: const Icon(LucideIcons.smile, color: muted)) : null,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              RoundIcon(
                icon: editing != null ? LucideIcons.check : LucideIcons.send,
                onTap: sending || (input.text.trim().isEmpty && images.isEmpty && files.isEmpty) ? null : _send,
                filled: true,
                size: 44,
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Учасники групи ──

  Future<void> _showMembers() async {
    final chat = conversation;
    if (chat == null || chat['type'] != 'group') return;
    await showGcSheet<void>(
      context,
      title: text(chat['title']) ?? 'Бесіда',
      subtitle: '${chat['members_count']} ${plural(intOf(chat['members_count']), 'учасник', 'учасники', 'учасників')}',
      height: MediaQuery.sizeOf(context).height * 0.8,
      builder: (sheet) => _GroupInfo(
        conversation: chat,
        myId: myId,
        onChanged: () async {
          await _load();
        },
        onLeft: () {
          Navigator.pop(sheet);
          context.go('/messages');
        },
      ),
    );
    await _load();
  }
}

class _AttachOption extends StatelessWidget {
  const _AttachOption({required this.icon, required this.color, required this.title, required this.subtitle, required this.onTap});
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(color: color.withValues(alpha: 0.9), borderRadius: BorderRadius.circular(12)),
        child: Icon(icon, color: Colors.white, size: 20),
      ),
      title: Text(title, style: body(15, weight: FontWeight.w600)),
      subtitle: Text(subtitle, style: body(12, color: muted)),
    );
  }
}

class _Pending extends StatelessWidget {
  const _Pending({required this.child, required this.onRemove});
  final Widget child;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Stack(children: [
        child,
        Positioned(
          right: 2,
          top: 2,
          child: GestureDetector(
            onTap: onRemove,
            child: Container(decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle), child: const Icon(LucideIcons.x, size: 14)),
          ),
        ),
      ]),
    );
  }
}

class _DayLabel extends StatelessWidget {
  const _DayLabel({required this.iso});
  final dynamic iso;

  @override
  Widget build(BuildContext context) {
    final date = DateTime.tryParse('$iso')?.toLocal();
    if (date == null) return const SizedBox.shrink();
    final now = DateTime.now();
    final label = DateUtils.isSameDay(date, now)
        ? 'Сьогодні'
        : DateUtils.isSameDay(date, now.subtract(const Duration(days: 1)))
            ? 'Вчора'
            : '${date.day} ${monthsGenitive[date.month - 1]}${date.year == now.year ? '' : ' ${date.year}'}';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(12)),
          child: Text(label, style: body(11.5, color: muted, weight: FontWeight.w600)),
        ),
      ),
    );
  }
}

/// Повідомлення: текст, відповідь, фото, файли, голосове, стікер, контакт, системне.
class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.own, required this.group, required this.read, required this.onMenu, required this.conversationId});
  final Map<String, dynamic> message;
  final bool own;
  final bool group;
  final bool read;
  final VoidCallback onMenu;
  final int conversationId;

  @override
  Widget build(BuildContext context) {
    final type = text(message['type']) ?? 'text';
    if (type == 'system') {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 20),
        child: Text(text(message['body']) ?? '', textAlign: TextAlign.center, style: body(12, color: muted)),
      );
    }
    final user = mapOf(message['user']);
    final rank = user['family_rank'] is Map ? mapOf(user['family_rank']) : null;
    final attachments = maps(message['attachments']);
    final photos = attachments.where((a) => a['type'] == 'image').toList();
    final docs = attachments.where((a) => a['type'] == 'file').toList();
    final voice = attachments.where((a) => a['type'] == 'voice').toList();
    final sticker = message['sticker'] is Map ? mapOf(message['sticker']) : null;
    final contact = message['contact'] is Map ? mapOf(message['contact']) : null;
    final reply = message['reply_to'] is Map ? mapOf(message['reply_to']) : null;
    final bodyText = text(message['body']);
    final meta = Row(mainAxisSize: MainAxisSize.min, children: [
      if (message['edited_at'] != null) Text('ред. ', style: body(10.5, color: own ? Colors.white60 : faint)),
      Text(clock(message['created_at']), style: body(10.5, color: own ? Colors.white70 : faint)),
      if (own) ...[const SizedBox(width: 3), Icon(read ? LucideIcons.checkCheck : LucideIcons.check, size: 14, color: Colors.white70)],
    ]);

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (group && !own)
          Padding(
            padding: const EdgeInsets.only(bottom: 3),
            child: Wrap(spacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
              Text(text(user['name']) ?? '', style: body(12.5, color: const Color(0xFF9AA8FF), weight: FontWeight.w700)),
              if (rank != null) Pill(label: '${rank['rank']} ${rank['title'] ?? ''}'.trim(), color: muted),
            ]),
          ),
        if (reply != null)
          Container(
            margin: const EdgeInsets.only(bottom: 6),
            padding: const EdgeInsets.fromLTRB(8, 4, 8, 4),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
              border: Border(left: BorderSide(color: own ? Colors.white70 : primary, width: 2.5)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(text(reply['author']) ?? '', style: body(11.5, color: own ? Colors.white : const Color(0xFF9AA8FF), weight: FontWeight.w700)),
              Text(reply['deleted'] == true ? 'Повідомлення видалено' : (text(reply['preview']) ?? ''), maxLines: 2, overflow: TextOverflow.ellipsis, style: body(12, color: own ? Colors.white70 : muted)),
            ]),
          ),
        if (photos.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 4), child: SizedBox(width: 240, child: MediaGrid(items: photos))),
        for (final doc in docs) _FileChip(file: doc, own: own),
        for (final clip in voice) _VoiceClip(clip: clip, own: own),
        if (contact != null)
          GestureDetector(
            onTap: () => context.push('/u/${contact['username']}'),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Avatar(url: text(contact['avatar_url']), name: text(contact['name']) ?? '?', size: 38),
              const SizedBox(width: 10),
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(text(contact['name']) ?? '', style: body(14, weight: FontWeight.w700)),
                Text('@${contact['username']}', style: body(12, color: own ? Colors.white70 : muted)),
              ]),
            ]),
          ),
        if (bodyText != null && bodyText.isNotEmpty) Text(bodyText, style: body(15, color: own ? Colors.white : ink).copyWith(height: 1.35)),
        const SizedBox(height: 3),
        Align(alignment: Alignment.bottomRight, widthFactor: 1, child: meta),
      ],
    );

    final bubble = sticker != null
        ? Column(crossAxisAlignment: own ? CrossAxisAlignment.end : CrossAxisAlignment.start, children: [
            if (group && !own) Text(text(user['name']) ?? '', style: body(12, color: const Color(0xFF9AA8FF), weight: FontWeight.w700)),
            SizedBox(width: 130, height: 130, child: NetImage(text(sticker['url']), fit: BoxFit.contain)),
            meta,
          ])
        : Container(
            constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.74),
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
            decoration: BoxDecoration(
              gradient: own ? const LinearGradient(colors: [Color(0xFF6D5DFC), Color(0xFF8B6BFF)]) : null,
              color: own ? null : Colors.white.withValues(alpha: 0.07),
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(18),
                topRight: const Radius.circular(18),
                bottomLeft: Radius.circular(own ? 18 : 6),
                bottomRight: Radius.circular(own ? 6 : 18),
              ),
            ),
            child: content,
          );

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: own ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (group && !own) ...[
            GestureDetector(onTap: () => context.push('/u/${user['username']}'), child: Avatar(url: text(user['avatar_url']), name: text(user['name']) ?? '?', size: 30)),
            const SizedBox(width: 6),
          ],
          Flexible(child: GestureDetector(onLongPress: onMenu, child: bubble)),
        ],
      ),
    );
  }
}

class _FileChip extends StatelessWidget {
  const _FileChip({required this.file, required this.own});
  final Map<String, dynamic> file;
  final bool own;

  Future<void> _save(BuildContext context) async {
    final api = AppScope.read(context).session.api;
    try {
      final bytes = await api.bytes('/api/v1/messages/attachments/${file['id']}');
      final saved = await FilePicker.platform.saveFile(fileName: text(file['name']) ?? 'file', bytes: Uint8List.fromList(bytes));
      if (saved != null && context.mounted) toast(context, 'Файл збережено.');
    } catch (e) {
      if (context.mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = intOf(file['size']);
    final label = size > 1024 * 1024 ? '${(size / 1024 / 1024).toStringAsFixed(1)} МБ' : '${(size / 1024).ceil()} КБ';
    return GestureDetector(
      onTap: () => _save(context),
      child: Container(
        margin: const EdgeInsets.only(bottom: 4),
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: own ? Colors.white24 : violet.withValues(alpha: 0.25), borderRadius: BorderRadius.circular(10)),
            child: const Icon(LucideIcons.download, size: 18, color: Colors.white),
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(text(file['name']) ?? 'Файл', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(13.5, weight: FontWeight.w600)),
              Text(label, style: body(11.5, color: own ? Colors.white70 : muted)),
            ]),
          ),
        ]),
      ),
    );
  }
}

/// Голосове повідомлення: власний маленький програвач (не чіпає музичну чергу).
class _VoiceClip extends StatefulWidget {
  const _VoiceClip({required this.clip, required this.own});
  final Map<String, dynamic> clip;
  final bool own;

  @override
  State<_VoiceClip> createState() => _VoiceClipState();
}

class _VoiceClipState extends State<_VoiceClip> {
  AudioPlayer? player;
  bool playing = false;
  double progress = 0;

  @override
  void dispose() {
    player?.dispose();
    super.dispose();
  }

  Future<void> _toggle() async {
    if (player == null) {
      final session = AppScope.read(context).session;
      final audio = AudioPlayer();
      player = audio;
      audio.playerStateStream.listen((state) {
        if (!mounted) return;
        setState(() => playing = state.playing && state.processingState != ProcessingState.completed);
        if (state.processingState == ProcessingState.completed) {
          audio.pause();
          audio.seek(Duration.zero);
        }
      });
      audio.positionStream.listen((position) {
        final total = audio.duration?.inMilliseconds ?? 0;
        if (mounted && total > 0) setState(() => progress = (position.inMilliseconds / total).clamp(0, 1));
      });
      final url = absolute(widget.clip['url']) ?? '${Api.root}/api/v1/messages/attachments/${widget.clip['id']}';
      try {
        await audio.setUrl(url, headers: {if (session.token != null) 'Authorization': 'Bearer ${session.token}'});
      } catch (e) {
        if (mounted) toast(context, 'Не вдалося відтворити запис.');
        return;
      }
    }
    playing ? await player!.pause() : await player!.play();
  }

  @override
  Widget build(BuildContext context) {
    final waveform = (widget.clip['waveform'] is List ? (widget.clip['waveform'] as List) : const []).map((v) => (v is num ? v.toDouble() : 0.3).clamp(0.08, 1.0)).toList();
    final bars = waveform.isEmpty ? List<double>.filled(28, 0.35) : waveform;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        GestureDetector(
          onTap: _toggle,
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: widget.own ? Colors.white24 : primary, shape: BoxShape.circle),
            child: Icon(playing ? LucideIcons.pause : LucideIcons.play, color: Colors.white, size: 22),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 130,
          height: 26,
          child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
            for (var i = 0; i < bars.length && i < 40; i++)
              Expanded(
                child: Center(
                  child: Container(
                    width: 2.2,
                    height: 4 + bars[i] * 20,
                    decoration: BoxDecoration(
                      color: (i / bars.length) <= progress ? Colors.white : Colors.white.withValues(alpha: 0.35),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ),
          ]),
        ),
        const SizedBox(width: 8),
        Text(duration(widget.clip['duration']), style: body(11.5, color: widget.own ? Colors.white70 : muted)),
      ]),
    );
  }
}

class _ContactPicker extends StatefulWidget {
  const _ContactPicker({required this.onPick});
  final ValueChanged<Map<String, dynamic>> onPick;

  @override
  State<_ContactPicker> createState() => _ContactPickerState();
}

class _ContactPickerState extends State<_ContactPicker> {
  final query = TextEditingController();
  List<Map<String, dynamic>> users = [];
  Timer? debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final data = await AppScope.read(context).session.api.get('/api/v1/messages/contacts');
        if (mounted && query.text.isEmpty) setState(() => users = maps(data['users']));
      } catch (_) {}
    });
  }

  @override
  void dispose() {
    query.dispose();
    debounce?.cancel();
    super.dispose();
  }

  Future<void> _search() async {
    final q = query.text.trim();
    if (q.length < 2) return;
    try {
      final data = await AppScope.read(context).session.api.get('/api/v1/search?q=${Uri.encodeQueryComponent(q)}');
      if (mounted) setState(() => users = maps(data['users']));
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      child: Column(children: [
        GcField(
          controller: query,
          label: 'Пошук на GameCon',
          icon: LucideIcons.search,
          dense: true,
          onChanged: (_) {
            debounce?.cancel();
            debounce = Timer(const Duration(milliseconds: 300), _search);
          },
        ),
        const SizedBox(height: 8),
        Expanded(
          child: users.isEmpty
              ? const QuietEmpty(icon: LucideIcons.userRoundSearch, text: 'Введіть ім’я або нікнейм')
              : ListView(children: [for (final user in users) UserTile(user: user, onTap: () => widget.onPick(user))]),
        ),
      ]),
    );
  }
}

const _emoji = ['😀', '😂', '🥹', '😍', '😎', '🤔', '😴', '😭', '😡', '🥳', '👍', '👎', '👏', '🙏', '💪', '🔥', '❤️', '💜', '💯', '🎉', '🎮', '🏆', '💰', '🚗', '🔫', '👀', '✅', '❌', '⚡', '🌙'];

class _StickerPicker extends StatefulWidget {
  const _StickerPicker({required this.onSticker, required this.onEmoji});
  final ValueChanged<Map<String, dynamic>> onSticker;
  final ValueChanged<String> onEmoji;

  @override
  State<_StickerPicker> createState() => _StickerPickerState();
}

class _StickerPickerState extends State<_StickerPicker> {
  List<Map<String, dynamic>> packs = [];
  String tab = 'emoji';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final data = await AppScope.read(context).session.api.get('/api/v1/messages/stickers');
        if (mounted) setState(() => packs = maps(data['packs']));
      } catch (_) {}
    });
  }

  @override
  Widget build(BuildContext context) {
    final pack = packs.where((p) => 'pack-${p['id']}' == tab).firstOrNull;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
      child: Column(children: [
        Segmented(
          scroll: true,
          options: [
            const SegmentOption('emoji', 'Емодзі'),
            for (final p in packs) SegmentOption('pack-${p['id']}', text(p['name']) ?? 'Стікери'),
          ],
          selected: tab,
          onSelect: (value) => setState(() => tab = value),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: pack == null
              ? GridView.count(
                  crossAxisCount: 7,
                  children: [
                    for (final e in _emoji)
                      InkWell(borderRadius: BorderRadius.circular(10), onTap: () => widget.onEmoji(e), child: Center(child: Text(e, style: const TextStyle(fontSize: 26)))),
                  ],
                )
              : GridView.count(
                  crossAxisCount: 4,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  children: [
                    for (final sticker in maps(pack['stickers']))
                      InkWell(borderRadius: BorderRadius.circular(12), onTap: () => widget.onSticker(sticker), child: NetImage(text(sticker['url']), fit: BoxFit.contain)),
                  ],
                ),
        ),
      ]),
    );
  }
}

/// Інформація про групу: назва, фото, учасники (додати / видалити), вихід.
class _GroupInfo extends StatefulWidget {
  const _GroupInfo({required this.conversation, required this.myId, required this.onChanged, required this.onLeft});
  final Map<String, dynamic> conversation;
  final int? myId;
  final Future<void> Function() onChanged;
  final VoidCallback onLeft;

  @override
  State<_GroupInfo> createState() => _GroupInfoState();
}

class _GroupInfoState extends State<_GroupInfo> {
  late List<Map<String, dynamic>> members = maps(widget.conversation['members']);
  late String title = text(widget.conversation['title']) ?? '';

  int get id => intOf(widget.conversation['id']);
  bool get manager => ['owner', 'admin'].contains(widget.conversation['my_role']);
  Api get api => AppScope.read(context).session.api;

  Future<void> _rename() async {
    final next = await askText(context, 'Назва бесіди', initial: title);
    if (next == null || next.isEmpty || !mounted) return;
    if (await attempt(context, () => api.post(Api.site('/messages/$id/settings'), {'title': next}))) {
      setState(() => title = next);
      await widget.onChanged();
    }
  }

  Future<void> _photo() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 90, maxWidth: 800);
    if (picked == null || !mounted) return;
    final file = await http.MultipartFile.fromPath('avatar', picked.path, filename: picked.name);
    if (!mounted) return;
    if (await attempt(context, () => api.upload(Api.site('/messages/$id/settings'), {}, [file]), success: 'Фото бесіди оновлено.')) await widget.onChanged();
  }

  Future<void> _add() async {
    final data = await api.get('/api/v1/messages/contacts');
    if (!mounted) return;
    final present = {for (final m in members) '${m['id']}'};
    final candidates = maps(data['users']).where((u) => !present.contains('${u['id']}')).toList();
    final chosen = <Map<String, dynamic>>{};
    final ok = await showGcSheet<bool>(
      context,
      title: 'Додати учасників',
      height: MediaQuery.sizeOf(context).height * 0.7,
      builder: (sheet) => StatefulBuilder(
        builder: (context, set) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
          child: Column(children: [
            Expanded(
              child: candidates.isEmpty
                  ? const QuietEmpty(icon: LucideIcons.usersRound, text: 'Усі ваші друзі вже в бесіді')
                  : ListView(children: [
                      for (final user in candidates)
                        UserTile(
                          user: user,
                          onTap: () => set(() => chosen.contains(user) ? chosen.remove(user) : chosen.add(user)),
                          trailing: Icon(chosen.contains(user) ? LucideIcons.circleCheck : LucideIcons.circle, color: chosen.contains(user) ? primary : faint),
                        ),
                    ]),
            ),
            PrimaryButton(label: 'Додати', onPressed: chosen.isEmpty ? null : () => Navigator.pop(sheet, true)),
          ]),
        ),
      ),
    );
    if (ok != true || !mounted) return;
    if (await attempt(context, () => api.post(Api.site('/messages/$id/members'), {'user_ids': [for (final u in chosen) u['id']]}))) {
      await widget.onChanged();
      final fresh = await api.get('/api/v1/messages/$id');
      if (mounted) setState(() => members = maps(mapOf(fresh['conversation'])['members']));
    }
  }

  Future<void> _remove(Map<String, dynamic> member) async {
    final self = intOf(member['id']) == widget.myId;
    if (!await confirm(context, self ? 'Вийти з бесіди?' : 'Видалити ${member['name']} з бесіди?', action: self ? 'Вийти' : 'Видалити', danger: true)) return;
    if (!mounted) return;
    if (await attempt(context, () => api.delete(Api.site('/messages/$id/members/${member['username']}')))) {
      if (self) return widget.onLeft();
      setState(() => members.removeWhere((m) => m['id'] == member['id']));
      await widget.onChanged();
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = members.where((m) => intOf(m['id']) == widget.myId).firstOrNull;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
      children: [
        if (manager)
          Row(children: [
            Expanded(child: GhostButton(label: 'Назва', icon: LucideIcons.pencil, compact: true, onPressed: _rename)),
            const SizedBox(width: 8),
            Expanded(child: GhostButton(label: 'Фото', icon: LucideIcons.camera, compact: true, onPressed: _photo)),
            const SizedBox(width: 8),
            Expanded(child: PrimaryButton(label: 'Додати', icon: LucideIcons.userRoundPlus, compact: true, onPressed: _add)),
          ]),
        const SizedBox(height: 10),
        for (final member in members)
          UserTile(
            user: member,
            subtitle: switch (member['role']) {
              'owner' => 'Власник',
              'admin' => 'Адміністратор',
              _ => '@${member['username']}',
            },
            trailing: manager && intOf(member['id']) != widget.myId && member['role'] != 'owner'
                ? IconButton(onPressed: () => _remove(member), icon: const Icon(LucideIcons.userRoundMinus, color: muted, size: 20))
                : null,
          ),
        const SizedBox(height: 12),
        if (me != null) DangerButton(label: 'Вийти з бесіди', icon: LucideIcons.logOut, expand: true, onPressed: () => _remove(me)),
      ],
    );
  }
}
