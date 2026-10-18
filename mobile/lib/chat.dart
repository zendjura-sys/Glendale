import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:just_audio/just_audio.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'listen_together.dart';
import 'posts.dart';
import 'push.dart';
import 'state.dart';
import 'theme.dart';
import 'voice_note.dart';
import 'voice_room.dart';
import 'widgets.dart';
import 'i18n.dart';

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
                Expanded(child: Text(tr('Повідомлення'), style: display(20))),
                RoundIcon(icon: LucideIcons.squarePen, tooltip: tr('Нове повідомлення'), color: soft, onTap: () => showNewConversation(context)),
              ]),
              const SizedBox(height: 12),
              GcField(controller: query, label: tr('Пошук'), icon: LucideIcons.search, dense: true, onChanged: (_) => setState(() {})),
              const SizedBox(height: 8),
              if (loading)
                const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator(strokeWidth: 2.4)))
              else if (conversations.isEmpty)
                EmptyState(
                  boxed: false,
                  icon: LucideIcons.messageCircle,
                  title: tr('Повідомлень поки немає'),
                  text: tr('Напишіть другу або створіть бесіду для своєї компанії.'),
                  action: tr('Нове повідомлення'),
                  actionIcon: LucideIcons.pencil,
                  onAction: () => showNewConversation(context),
                )
              else if (shown.isEmpty)
                QuietEmpty(icon: LucideIcons.searchX, text: tr('Нічого не знайдено'))
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
    final title = text(conversation['title']) ?? tr('Бесіда');
    final prefix = last == null ? '' : (last['is_own'] == true ? tr('Ви: ') : (group && text(last['author']) != null ? '${last['author']}: ' : ''));
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
                    decoration: BoxDecoration(gradient: buttonGradient, shape: BoxShape.circle),
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
                    if (conversation['is_muted'] == true) Padding(padding: EdgeInsets.only(right: 4), child: Icon(LucideIcons.bellOff, size: 14, color: faint)),
                    if (last != null) Text(shortStamp(last['created_at']), style: body(11.5, color: muted)),
                  ]),
                  const SizedBox(height: 3),
                  Row(children: [
                    Expanded(
                      child: Text.rich(
                        TextSpan(children: [
                          TextSpan(text: prefix, style: body(13, color: soft.withValues(alpha: 0.8))),
                          TextSpan(text: text(last?['preview']) ?? tr('Немає повідомлень')),
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
    title: tr('Нове повідомлення'),
    subtitle: tr('Оберіть друга, якому хочете написати, або створіть груповий чат.'),
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
      padding: EdgeInsets.fromLTRB(16, 4, 16, 16),
      child: Column(
        children: [
          Segmented(
            options: [SegmentOption('direct', tr('Повідомлення'), icon: LucideIcons.messageCircle), SegmentOption('group', tr('Нова бесіда'), icon: LucideIcons.usersRound)],
            selected: mode,
            onSelect: (value) => setState(() => mode = value),
          ),
          const SizedBox(height: 12),
          if (mode == 'group') ...[
            GcField(controller: title, label: tr('Назва бесіди'), dense: true, onChanged: (_) => setState(() {})),
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
                        backgroundColor: fg.withValues(alpha: 0.06),
                        side: BorderSide(color: line),
                      ),
                  ]),
                ),
              ),
            const SizedBox(height: 10),
          ],
          GcField(controller: query, label: tr('Пошук серед друзів'), icon: LucideIcons.search, dense: true, onChanged: (_) => setState(() {})),
          const SizedBox(height: 8),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                : shown.isEmpty
                    ? QuietEmpty(icon: LucideIcons.usersRound, text: tr('Друзів не знайдено. Писати можна друзям і тим, хто приймає повідомлення від усіх.'))
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
            PrimaryButton(label: tr('Створити бесіду'), busy: busy, onPressed: title.text.trim().isNotEmpty && picked.isNotEmpty ? _group : null),
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

  final recorder = VoiceRecorder();
  bool holding = false;
  bool locked = false;
  Offset drag = Offset.zero;
  final bubbleKeys = <int, GlobalKey>{};
  int? flashId;

  Api get api => AppScope.read(context).session.api;
  int? get myId => AppScope.read(context).session.myId;

  @override
  void initState() {
    super.initState();
    recorder.addListener(_onRecorder);
    recorder.onLimit = () => _stopVoice(send: true);
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
    recorder
      ..removeListener(_onRecorder)
      ..dispose();
    super.dispose();
  }

  void _onRecorder() {
    if (mounted) setState(() {});
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

  // ── Голосові ──

  Future<void> _startVoice({required bool hold}) async {
    if (recorder.active || sending) return;
    holding = hold;
    locked = !hold;
    drag = Offset.zero;
    final player = AppScope.read(context).player;
    if (player.engine.playing) unawaited(player.engine.pause());
    final ok = await recorder.start();
    if (!mounted) return;
    if (!ok) {
      toast(context, tr('Дозвольте доступ до мікрофона в налаштуваннях, щоб записувати голосові.'));
      return;
    }
    // Палець відпустили, поки система питала дозвіл.
    if (hold && !holding) {
      await recorder.cancel();
      return;
    }
    unawaited(HapticFeedback.mediumImpact());
  }

  Future<void> _stopVoice({required bool send}) async {
    if (!recorder.active) return;
    final tooShort = recorder.elapsed < const Duration(milliseconds: 700);
    holding = false;
    locked = false;
    drag = Offset.zero;
    if (!send || tooShort) {
      await recorder.cancel();
      if (send && tooShort && mounted) toast(context, tr('Утримуйте мікрофон, щоб записати голосове.'));
      return;
    }
    final note = await recorder.finish();
    if (note != null) await _sendVoice(note);
  }

  Future<void> _sendVoice(VoiceNote note) async {
    setState(() => sending = true);
    try {
      final data = await api.upload(
        '/api/v1/messages/${widget.id}',
        {
          'voice_duration': '${note.seconds}',
          'voice_waveform': jsonEncode(note.waveform),
          if (replyTo != null) 'reply_to_id': '${replyTo!['id']}',
        },
        [await http.MultipartFile.fromPath('voice', note.path, filename: 'voice.m4a')],
      );
      if (!mounted) return;
      setState(() {
        if (data['message'] is Map) messages.add(mapOf(data['message']));
        replyTo = null;
      });
      if (scroll.hasClients) unawaited(scroll.animateTo(0, duration: const Duration(milliseconds: 250), curve: Curves.easeOut));
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  void _onHoldMove(LongPressMoveUpdateDetails details) {
    if (!recorder.active || locked) return;
    setState(() => drag = details.offsetFromOrigin);
    if (drag.dx < -110) {
      unawaited(HapticFeedback.lightImpact());
      unawaited(_stopVoice(send: false));
    } else if (drag.dy < -80) {
      unawaited(HapticFeedback.selectionClick());
      setState(() {
        locked = true;
        holding = false;
        drag = Offset.zero;
      });
    }
  }

  void _onHoldEnd() {
    if (locked) return;
    holding = false;
    if (recorder.active) unawaited(_stopVoice(send: true));
  }

  // ── Відповіді ──

  void _reply(Map<String, dynamic> message) {
    unawaited(HapticFeedback.lightImpact());
    setState(() {
      if (editing != null) input.clear();
      editing = null;
      replyTo = message;
    });
    focus.requestFocus();
  }

  /// Прокручує до повідомлення, на яке відповіли, підвантажуючи старіші за потреби.
  Future<void> _jumpTo(int id) async {
    for (var attempt = 0; attempt < 40 && mounted; attempt++) {
      final target = bubbleKeys[id]?.currentContext;
      if (target != null && target.mounted) {
        await Scrollable.ensureVisible(target, alignment: 0.4, duration: const Duration(milliseconds: 350), curve: Curves.easeOutCubic);
        if (!mounted) return;
        setState(() => flashId = id);
        await Future<void>.delayed(const Duration(milliseconds: 1200));
        if (mounted && flashId == id) setState(() => flashId = null);
        return;
      }
      if (!scroll.hasClients) return;
      final position = scroll.position;
      final known = messages.any((m) => intOf(m['id']) == id);
      if (position.pixels >= position.maxScrollExtent - 1 && !hasMore && !known) break;
      scroll.jumpTo(math.min(position.pixels + position.viewportDimension * 0.8, position.maxScrollExtent));
      if (!known) await _older();
      await WidgetsBinding.instance.endOfFrame;
    }
    if (mounted) toast(context, tr('Повідомлення не знайдено.'));
  }

  Future<void> _attach() async {
    final choice = await showGcSheet<String>(
      context,
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          _AttachOption(icon: LucideIcons.image, color: Color(0xFF38BDF8), title: tr('Фото'), subtitle: 'JPG, PNG, WebP, GIF', onTap: () => Navigator.pop(sheet, 'photo')),
          _AttachOption(icon: LucideIcons.file, color: violet, title: tr('Файл'), subtitle: tr('до 50 МБ'), onTap: () => Navigator.pop(sheet, 'file')),
          _AttachOption(icon: LucideIcons.userRound, color: Color(0xFF2DD4BF), title: tr('Контакт'), subtitle: tr('Пошук на GameCon'), onTap: () => Navigator.pop(sheet, 'contact')),
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
      title: tr('Надіслати контакт'),
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
        padding: EdgeInsets.fromLTRB(12, 0, 12, 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          SheetAction(icon: LucideIcons.reply, label: tr('Відповісти'), onTap: () => Navigator.pop(sheet, 'reply')),
          if (hasText) SheetAction(icon: LucideIcons.copy, label: tr('Копіювати текст'), onTap: () => Navigator.pop(sheet, 'copy')),
          if (own && hasText && message['type'] == 'text') SheetAction(icon: LucideIcons.pencil, label: tr('Редагувати'), onTap: () => Navigator.pop(sheet, 'edit')),
          if (own) SheetAction(icon: LucideIcons.trash2, label: tr('Видалити'), color: dangerSoft, onTap: () => Navigator.pop(sheet, 'delete')),
          if (!own && hasText && I18n.translate) SheetAction(icon: LucideIcons.languages, label: tr('Перекласти'), onTap: () => Navigator.pop(sheet, 'translate')),
          if (!own) SheetAction(icon: LucideIcons.flag, label: tr('Поскаржитися'), color: dangerSoft, onTap: () => Navigator.pop(sheet, 'report')),
        ]),
      ),
    );
    if (!mounted || choice == null) return;
    switch (choice) {
      case 'reply':
        _reply(message);
      case 'copy':
        await Clipboard.setData(ClipboardData(text: text(message['body']) ?? ''));
        if (mounted) toast(context, tr('Скопійовано.'));
      case 'edit':
        setState(() {
          replyTo = null;
          editing = message;
          input.text = text(message['body']) ?? '';
        });
        focus.requestFocus();
      case 'delete':
        if (!await confirm(context, tr('Видалити повідомлення?'), text: tr('Його не побачить ніхто з учасників.'), action: tr('Видалити'), danger: true)) return;
        if (!mounted) return;
        if (await attempt(context, () => api.delete(Api.site('/messages/${widget.id}/messages/${message['id']}')))) {
          setState(() => messages.removeWhere((m) => m['id'] == message['id']));
        }
      case 'report':
        await _report(message);
      case 'translate':
        await _translate(message);
    }
  }

  /// Переклад повідомлення мовою інтерфейсу (DeepL, кешується на сервері).
  Future<void> _translate(Map<String, dynamic> message) async {
    try {
      final result = await api.post('/api/v1/translate', {'type': 'message', 'id': message['id']});
      if (!mounted) return;
      if (result['same'] == true) {
        toast(context, tr('Текст уже вашою мовою.'));
        return;
      }
      await showGcSheet<void>(
        context,
        title: tr('Переклад'),
        builder: (sheet) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          child: SelectableText(text(result['translation']) ?? '', style: body(15, color: ink).copyWith(height: 1.45)),
        ),
      );
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  /// Скарга на повідомлення — потрапляє в Адмінку → Модерація (а в чаті сім’ї — ще й керівництву).
  Future<void> _report(Map<String, dynamic> message) async {
    final reasons = [('spam', tr('Спам або реклама')), ('abuse', tr('Образи чи мат')), ('scam', tr('Шахрайство')), ('other', tr('Інше'))];
    final reason = await showGcSheet<String>(
      context,
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          for (final r in reasons) SheetAction(icon: LucideIcons.flag, label: r.$2, onTap: () => Navigator.pop(sheet, r.$1)),
        ]),
      ),
    );
    if (!mounted || reason == null) return;
    await attempt(
      context,
      () => api.post(Api.site('/messages/${widget.id}/messages/${message['id']}/report'), {'reason': reason}),
      success: tr('Дякуємо! Скаргу надіслано модераторам.'),
    );
  }

  Future<void> _toggleMute() async {
    final next = conversation?['is_muted'] != true;
    if (await attempt(context, () => api.post('/api/v1/messages/${widget.id}/mute', {'muted': next}), success: next ? tr('Сповіщення вимкнено.') : tr('Сповіщення увімкнено.'))) {
      setState(() => conversation?['is_muted'] = next);
    }
  }

  @override
  Widget build(BuildContext context) {
    final chat = conversation;
    if (chat == null) {
      return error != null
          ? Center(child: Padding(padding: const EdgeInsets.all(20), child: EmptyState(icon: LucideIcons.messageCircle, title: tr('Бесіда недоступна'), text: '$error', action: tr('Назад'), onAction: () => context.go('/messages'))))
          : const Center(child: CircularProgressIndicator(strokeWidth: 2.4));
    }
    final group = chat['type'] == 'group';
    final peer = chat['peer'] is Map ? mapOf(chat['peer']) : null;
    final readUpTo = intOf(chat['read_up_to']);
    final reversed = messages.reversed.toList();
    final subtitle = group
        ? '${chat['members_count']} ${plural(intOf(chat['members_count']), 'учасник', 'учасники', 'учасників')}'
        : (peer?['is_online'] == true ? tr('онлайн') : (text(peer?['last_seen_at']) != null ? tr('був(-ла) {v}', {'v': ago(peer?['last_seen_at'])}) : ''));

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
                IconButton(onPressed: () => context.canPop() ? context.pop() : context.go('/messages'), icon: Icon(LucideIcons.arrowLeft, color: soft)),
                Expanded(
                  child: GestureDetector(
                    onTap: () => group ? _showMembers() : (peer != null ? context.push('/u/${peer['username']}') : null),
                    child: Row(children: [
                      group && text(chat['avatar_url']) == null
                          ? Container(width: 38, height: 38, decoration: BoxDecoration(gradient: buttonGradient, shape: BoxShape.circle), child: const Icon(LucideIcons.usersRound, size: 20, color: Colors.white))
                          : Avatar(url: text(chat['avatar_url']), name: text(chat['title']) ?? '?', size: 38, online: peer?['is_online'] == true),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(text(chat['title']) ?? tr('Бесіда'), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(15, weight: FontWeight.w700)),
                          if (subtitle.isNotEmpty) Text(subtitle, style: body(12, color: peer?['is_online'] == true ? green : muted)),
                        ]),
                      ),
                    ]),
                  ),
                ),
                IconButton(
                  tooltip: chat['is_muted'] == true ? tr('Увімкнути сповіщення') : tr('Вимкнути сповіщення'),
                  onPressed: _toggleMute,
                  icon: Icon(chat['is_muted'] == true ? LucideIcons.bellOff : LucideIcons.bell, color: muted),
                ),
                IconButton(
                  tooltip: tr('Слухати музику разом'),
                  onPressed: () => startListening(context, trackId: AppScope.read(context).player.current?.id, conversationId: widget.id),
                  icon: Icon(LucideIcons.headphones, color: muted),
                ),
                _CallButton(chat: chat, conversation: widget.id),
                if (group) IconButton(onPressed: _showMembers, icon: Icon(LucideIcons.info, color: muted)),
              ]),
            ),
            Divider(height: 1, color: line),
            _CallBanner(chat: chat, conversation: widget.id),
            Expanded(
              child: messages.isEmpty
                  ? QuietEmpty(icon: LucideIcons.hand, text: tr('Напишіть перше повідомлення'))
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
                        final id = intOf(message['id']);
                        final bubble = _Bubble(
                          message: message,
                          own: intOf(mapOf(message['user'])['id']) == myId,
                          group: group,
                          read: id <= readUpTo,
                          onMenu: () => _messageMenu(message),
                          onQuote: _jumpTo,
                          conversationId: widget.id,
                        );
                        return Column(key: bubbleKeys.putIfAbsent(id, GlobalKey.new), children: [
                          if (showDay) _DayLabel(iso: message['created_at']),
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 300),
                            decoration: BoxDecoration(color: flashId == id ? primary.withValues(alpha: 0.16) : Colors.transparent, borderRadius: BorderRadius.circular(14)),
                            child: message['type'] == 'system' || chat['can_write'] == false ? bubble : _SwipeToReply(onReply: () => _reply(message), child: bubble),
                          ),
                        ]);
                      },
                    ),
            ),
            if (chat['can_write'] == false)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text(tr('Ви не можете написати цьому користувачу.'), textAlign: TextAlign.center, style: body(13, color: muted)),
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
        ? (tr('Редагування'), text(editing!['body']) ?? '', LucideIcons.pencil)
        : replyTo != null
            ? (tr('Відповідь {v}', {'v': text(mapOf(replyTo!['user'])['first_name']) ?? ''}), text(replyTo!['preview']) ?? '', LucideIcons.reply)
            : null;
    return Container(
      padding: EdgeInsets.fromLTRB(8, 6, 8, 8 + ShellChrome.bottomOf(context)),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: line))),
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
                  icon: Icon(LucideIcons.x, size: 18, color: muted),
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
                        decoration: BoxDecoration(color: fg.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(10)),
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
              Expanded(
                child: recorder.active
                    ? _recordingBar()
                    : Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                        if (editing == null) RoundIcon(icon: LucideIcons.paperclip, onTap: _attach, color: soft, tooltip: tr('Вкладення')),
                        const SizedBox(width: 4),
                        Expanded(child: _field()),
                      ]),
              ),
              const SizedBox(width: 6),
              _trailing(),
            ],
          ),
        ],
      ),
    );
  }

  Widget _trailing() {
    final empty = input.text.trim().isEmpty && images.isEmpty && files.isEmpty;
    if (recorder.active && locked) {
      return RoundIcon(icon: LucideIcons.send, onTap: sending ? null : () => _stopVoice(send: true), filled: true, size: 44, tooltip: tr('Надіслати голосове'));
    }
    if (editing != null || !empty) {
      return RoundIcon(icon: editing != null ? LucideIcons.check : LucideIcons.send, onTap: sending || empty ? null : _send, filled: true, size: 44);
    }
    final recording = recorder.active;
    return Tooltip(
      message: tr('Утримуйте, щоб записати голосове'),
      child: GestureDetector(
        onTap: sending ? null : () => _startVoice(hold: false),
        onLongPressStart: sending ? null : (_) => _startVoice(hold: true),
        onLongPressMoveUpdate: _onHoldMove,
        onLongPressEnd: (_) => _onHoldEnd(),
        onLongPressCancel: _onHoldEnd,
        child: AnimatedScale(
          scale: recording ? 1.3 : 1,
          duration: const Duration(milliseconds: 160),
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              gradient: buttonGradient,
              shape: BoxShape.circle,
              boxShadow: recording ? [BoxShadow(color: primary.withValues(alpha: 0.55), blurRadius: 18)] : null,
            ),
            child: const Icon(LucideIcons.mic, color: Colors.white, size: 21),
          ),
        ),
      ),
    );
  }

  Widget _recordingBar() {
    final seconds = recorder.elapsed.inSeconds;
    final recent = recorder.levels.length > 34 ? recorder.levels.sublist(recorder.levels.length - 34) : recorder.levels;
    final cancelHint = (1 + drag.dx / 110).clamp(0.25, 1.0);
    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 6),
      decoration: BoxDecoration(color: field, borderRadius: BorderRadius.circular(22), border: Border.all(color: lineStrong)),
      child: Row(children: [
        if (locked)
          IconButton(
            visualDensity: VisualDensity.compact,
            tooltip: tr('Скасувати'),
            onPressed: () => _stopVoice(send: false),
            icon: const Icon(LucideIcons.trash2, size: 19, color: dangerSoft),
          )
        else
          const SizedBox(width: 8),
        _RecDot(),
        const SizedBox(width: 6),
        Text(duration(seconds), style: body(13.5, weight: FontWeight.w700).copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
        const SizedBox(width: 8),
        Expanded(
          child: locked
              ? Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                  for (final level in recent)
                    Container(
                      width: 2.4,
                      height: 4 + level / 100 * 22,
                      margin: const EdgeInsets.symmetric(horizontal: 1),
                      decoration: BoxDecoration(color: primary, borderRadius: BorderRadius.circular(2)),
                    ),
                ])
              : Opacity(
                  opacity: cancelHint,
                  child: Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                    Icon(LucideIcons.chevronLeft, size: 16, color: muted),
                    Flexible(child: Text(tr('Вліво — скасувати'), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12.5, color: muted))),
                    const SizedBox(width: 8),
                    Icon(LucideIcons.lock, size: 14, color: faint),
                    Icon(LucideIcons.chevronUp, size: 14, color: faint),
                    const SizedBox(width: 4),
                  ]),
                ),
        ),
      ]),
    );
  }

  Widget _field() {
    return TextField(
      controller: input,
      focusNode: focus,
      minLines: 1,
      maxLines: 6,
      textCapitalization: TextCapitalization.sentences,
      onChanged: (_) => setState(() {}),
      style: body(16),
      decoration: InputDecoration(
        hintText: tr('Напишіть повідомлення…'),
        hintStyle: body(14.5, color: faint),
        filled: true,
        fillColor: field,
        isDense: true,
        contentPadding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: BorderSide(color: lineStrong)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: BorderSide(color: lineStrong)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: BorderSide(color: primary, width: 1.4)),
        suffixIcon: editing == null ? IconButton(onPressed: _stickers, icon: Icon(LucideIcons.smile, color: muted)) : null,
      ),
    );
  }

  // ── Учасники групи ──

  Future<void> _showMembers() async {
    final chat = conversation;
    if (chat == null || chat['type'] != 'group') return;
    await showGcSheet<void>(
      context,
      title: text(chat['title']) ?? tr('Бесіда'),
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
        ? tr('Сьогодні')
        : DateUtils.isSameDay(date, now.subtract(const Duration(days: 1)))
            ? tr('Вчора')
            : '${date.day} ${monthsGenitive[date.month - 1]}${date.year == now.year ? '' : ' ${date.year}'}';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(color: fg.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(12)),
          child: Text(label, style: body(11.5, color: muted, weight: FontWeight.w600)),
        ),
      ),
    );
  }
}

class _RecDot extends StatefulWidget {
  @override
  State<_RecDot> createState() => _RecDotState();
}

class _RecDotState extends State<_RecDot> with SingleTickerProviderStateMixin {
  late final pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 700))..repeat(reverse: true);

  @override
  void dispose() {
    pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween(begin: 0.35, end: 1.0).animate(pulse),
      child: Container(width: 10, height: 10, decoration: const BoxDecoration(color: Color(0xFFFF4D5E), shape: BoxShape.circle)),
    );
  }
}

/// Свайп повідомлення вліво — відповісти (як у Telegram).
class _SwipeToReply extends StatefulWidget {
  const _SwipeToReply({required this.onReply, required this.child});
  final VoidCallback onReply;
  final Widget child;

  @override
  State<_SwipeToReply> createState() => _SwipeToReplyState();
}

class _SwipeToReplyState extends State<_SwipeToReply> with SingleTickerProviderStateMixin {
  static const threshold = 64.0;
  static const reach = 90.0;
  late final back = AnimationController(vsync: this, duration: const Duration(milliseconds: 220));
  double offset = 0;
  double released = 0;
  bool armed = false;

  @override
  void initState() {
    super.initState();
    back.addListener(() => setState(() => offset = released * (1 - Curves.easeOutCubic.transform(back.value))));
  }

  @override
  void dispose() {
    back.dispose();
    super.dispose();
  }

  void _update(DragUpdateDetails details) {
    back.stop();
    // Після порогу тягнеться туго, щоб було відчутно, що відповідь «спрацювала».
    final next = (offset + details.delta.dx * (offset.abs() > threshold ? 0.35 : 1)).clamp(-reach, 0.0);
    final nowArmed = next.abs() >= threshold;
    if (nowArmed && !armed) unawaited(HapticFeedback.lightImpact());
    setState(() {
      offset = next;
      armed = nowArmed;
    });
  }

  void _end() {
    if (armed) widget.onReply();
    armed = false;
    released = offset;
    unawaited(back.forward(from: 0));
  }

  @override
  Widget build(BuildContext context) {
    final progress = (offset.abs() / threshold).clamp(0.0, 1.0);
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onHorizontalDragUpdate: _update,
      onHorizontalDragEnd: (_) => _end(),
      onHorizontalDragCancel: _end,
      child: Stack(
        alignment: Alignment.centerRight,
        children: [
          if (offset != 0)
            Positioned(
              right: 6,
              child: Opacity(
                opacity: progress,
                child: Transform.scale(
                  scale: 0.6 + 0.4 * progress,
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(color: armed ? primary : fg.withValues(alpha: 0.12), shape: BoxShape.circle),
                    child: const Icon(LucideIcons.reply, size: 17, color: Colors.white),
                  ),
                ),
              ),
            ),
          Transform.translate(offset: Offset(offset, 0), child: widget.child),
        ],
      ),
    );
  }
}

/// Повідомлення: текст, відповідь, фото, файли, голосове, стікер, контакт, системне.
class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.own, required this.group, required this.read, required this.onMenu, required this.onQuote, required this.conversationId});
  final Map<String, dynamic> message;
  final bool own;
  final bool group;
  final bool read;
  final VoidCallback onMenu;
  final ValueChanged<int> onQuote;
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
    final rawBody = text(message['body']);
    final bodyText = rawBody == null ? null : maskProfanity(rawBody, text(AppScope.read(context).session.me?['profanity_mask']));
    final meta = Row(mainAxisSize: MainAxisSize.min, children: [
      if (message['edited_at'] != null) Text(tr('ред. '), style: body(11, color: own ? fg.withValues(alpha: 0.60) : faint)),
      Text(clock(message['created_at']), style: body(11, color: own ? fgSoft : faint)),
      if (own) ...[const SizedBox(width: 3), Icon(read ? LucideIcons.checkCheck : LucideIcons.check, size: 14, color: fgSoft)],
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
          GestureDetector(
            onTap: reply['deleted'] == true ? null : () => onQuote(intOf(reply['id'])),
            child: Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.fromLTRB(8, 4, 8, 4),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border(left: BorderSide(color: own ? fgSoft : primary, width: 2.5)),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(text(reply['author']) ?? '', style: body(11.5, color: own ? Colors.white : const Color(0xFF9AA8FF), weight: FontWeight.w700)),
                Text(reply['deleted'] == true ? tr('Повідомлення видалено') : (text(reply['preview']) ?? ''), maxLines: 2, overflow: TextOverflow.ellipsis, style: body(12, color: own ? fgSoft : muted)),
              ]),
            ),
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
                Text('@${contact['username']}', style: body(12, color: own ? fgSoft : muted)),
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
              color: own ? null : fg.withValues(alpha: 0.07),
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
      if (saved != null && context.mounted) toast(context, tr('Файл збережено.'));
    } catch (e) {
      if (context.mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = intOf(file['size']);
    final label = size > 1024 * 1024 ? tr('{v} МБ', {'v': (size / 1024 / 1024).toStringAsFixed(1)}) : tr('{v} КБ', {'v': (size / 1024).ceil()});
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
            decoration: BoxDecoration(color: own ? fg.withValues(alpha: 0.24) : violet.withValues(alpha: 0.25), borderRadius: BorderRadius.circular(10)),
            child: const Icon(LucideIcons.download, size: 18, color: Colors.white),
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(text(file['name']) ?? tr('Файл'), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(13.5, weight: FontWeight.w600)),
              Text(label, style: body(11.5, color: own ? fgSoft : muted)),
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
      // Без локального проксі just_audio: він працює через http://127.0.0.1, а Android блокує такий трафік.
      final audio = AudioPlayer(useProxyForRequestHeaders: false);
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
        // Наступне натискання пробує ще раз з новим програвачем.
        player = null;
        await audio.dispose();
        if (mounted) toast(context, tr('Не вдалося відтворити запис.'));
        return;
      }
    }
    playing ? await player!.pause() : await player!.play();
  }

  @override
  Widget build(BuildContext context) {
    final waveform = (widget.clip['waveform'] is List ? (widget.clip['waveform'] as List) : const []).map((v) => (v is num ? v / 100 : 0.3).clamp(0.08, 1.0)).toList();
    final bars = waveform.isEmpty ? List<double>.filled(28, 0.35) : waveform;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        GestureDetector(
          onTap: _toggle,
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: widget.own ? fg.withValues(alpha: 0.24) : primary, shape: BoxShape.circle),
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
                      color: (i / bars.length) <= progress ? Colors.white : fg.withValues(alpha: 0.35),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ),
          ]),
        ),
        const SizedBox(width: 8),
        Text(duration(widget.clip['duration']), style: body(11.5, color: widget.own ? fgSoft : muted)),
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
          label: tr('Пошук на GameCon'),
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
              ? QuietEmpty(icon: LucideIcons.userRoundSearch, text: tr('Введіть ім’я або нікнейм'))
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
            SegmentOption('emoji', tr('Емодзі')),
            for (final p in packs) SegmentOption('pack-${p['id']}', text(p['name']) ?? tr('Стікери')),
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
    final next = await askText(context, tr('Назва бесіди'), initial: title);
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
    if (await attempt(context, () => api.upload(Api.site('/messages/$id/settings'), {}, [file]), success: tr('Фото бесіди оновлено.'))) await widget.onChanged();
  }

  Future<void> _add() async {
    final data = await api.get('/api/v1/messages/contacts');
    if (!mounted) return;
    final present = {for (final m in members) '${m['id']}'};
    final candidates = maps(data['users']).where((u) => !present.contains('${u['id']}')).toList();
    final chosen = <Map<String, dynamic>>{};
    final ok = await showGcSheet<bool>(
      context,
      title: tr('Додати учасників'),
      height: MediaQuery.sizeOf(context).height * 0.7,
      builder: (sheet) => StatefulBuilder(
        builder: (context, set) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
          child: Column(children: [
            Expanded(
              child: candidates.isEmpty
                  ? QuietEmpty(icon: LucideIcons.usersRound, text: tr('Усі ваші друзі вже в бесіді'))
                  : ListView(children: [
                      for (final user in candidates)
                        UserTile(
                          user: user,
                          onTap: () => set(() => chosen.contains(user) ? chosen.remove(user) : chosen.add(user)),
                          trailing: Icon(chosen.contains(user) ? LucideIcons.circleCheck : LucideIcons.circle, color: chosen.contains(user) ? primary : faint),
                        ),
                    ]),
            ),
            PrimaryButton(label: tr('Додати'), onPressed: chosen.isEmpty ? null : () => Navigator.pop(sheet, true)),
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
    if (!await confirm(context, self ? tr('Вийти з бесіди?') : tr('Видалити {v} з бесіди?', {'v': member['name']}), action: self ? tr('Вийти') : tr('Видалити'), danger: true)) return;
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
            Expanded(child: GhostButton(label: tr('Назва'), icon: LucideIcons.pencil, compact: true, onPressed: _rename)),
            const SizedBox(width: 8),
            Expanded(child: GhostButton(label: tr('Фото'), icon: LucideIcons.camera, compact: true, onPressed: _photo)),
            const SizedBox(width: 8),
            Expanded(child: PrimaryButton(label: tr('Додати'), icon: LucideIcons.userRoundPlus, compact: true, onPressed: _add)),
          ]),
        const SizedBox(height: 10),
        for (final member in members)
          UserTile(
            user: member,
            subtitle: switch (member['role']) {
              'owner' => tr('Власник'),
              'admin' => tr('Адміністратор'),
              _ => '@${member['username']}',
            },
            trailing: manager && intOf(member['id']) != widget.myId && member['role'] != 'owner'
                ? IconButton(onPressed: () => _remove(member), icon: Icon(LucideIcons.userRoundMinus, color: muted, size: 20))
                : null,
          ),
        const SizedBox(height: 12),
        if (me != null) DangerButton(label: tr('Вийти з бесіди'), icon: LucideIcons.logOut, expand: true, onPressed: () => _remove(me)),
      ],
    );
  }
}

/// Зателефонувати / покласти слухавку в шапці бесіди.
class _CallButton extends StatelessWidget {
  const _CallButton({required this.chat, required this.conversation});
  final Map<String, dynamic> chat;
  final int conversation;

  @override
  Widget build(BuildContext context) {
    final voice = VoiceCall.instance;
    return ListenableBuilder(
      listenable: voice,
      builder: (context, _) {
        final here = voice.kind == 'call' && voice.conversationId == conversation && voice.active;
        final canCall = chat['can_call'] == true && chat['calls_enabled'] == true;
        if (!here && !canCall) return const SizedBox.shrink();
        return IconButton(
          tooltip: here ? tr('Покласти слухавку') : (chat['call'] is Map ? tr('Приєднатися до дзвінка') : tr('Зателефонувати')),
          onPressed: () => here
              ? voice.leave()
              : voice.call(AppScope.read(context).session.api, conversation, text(chat['title']) ?? tr('Дзвінок'), onError: (e) {
                  if (context.mounted) toast(context, e);
                }),
          icon: Icon(here ? LucideIcons.phoneOff : LucideIcons.phone, color: here ? danger : muted),
        );
      },
    );
  }
}

/// «Іде дзвінок» під шапкою, поки в бесіді триває розмова, до якої ви ще не приєдналися.
class _CallBanner extends StatelessWidget {
  const _CallBanner({required this.chat, required this.conversation});
  final Map<String, dynamic> chat;
  final int conversation;

  @override
  Widget build(BuildContext context) {
    final voice = VoiceCall.instance;
    return ListenableBuilder(
      listenable: voice,
      builder: (context, _) {
        final call = chat['call'] is Map ? mapOf(chat['call']) : null;
        final joined = maps(call?['joined']);
        final here = voice.kind == 'call' && voice.conversationId == conversation && voice.active;
        if (call == null || joined.isEmpty || here) return const SizedBox.shrink();
        final canCall = chat['can_call'] == true && chat['calls_enabled'] == true;
        return Container(
          color: green.withValues(alpha: 0.08),
          padding: const EdgeInsets.fromLTRB(14, 8, 10, 8),
          child: Row(children: [
            const Icon(LucideIcons.phone, size: 16, color: green),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                '${chat['type'] == 'group' ? 'Іде груповий дзвінок' : 'Іде дзвінок'} · ${joined.map((p) => text(p['name']) ?? '').join(', ')}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: body(13, color: soft),
              ),
            ),
            if (canCall)
              TextButton(
                onPressed: () => voice.call(AppScope.read(context).session.api, conversation, text(chat['title']) ?? tr('Дзвінок'), onError: (e) {
                  if (context.mounted) toast(context, e);
                }),
                style: TextButton.styleFrom(backgroundColor: green, foregroundColor: Colors.white, minimumSize: const Size(0, 34), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                child: Text(tr('Приєднатися'), style: body(13, color: Colors.white, weight: FontWeight.w700)),
              ),
          ]),
        );
      },
    );
  }
}
