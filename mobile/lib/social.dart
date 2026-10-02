import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'api.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({required this.session, super.key});
  final Session session;

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  final query = TextEditingController();

  @override
  void dispose() {
    query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Remote(
      load: () => widget.session.api.get('/api/v1/messages'),
      builder: (data, reload) {
        final needle = query.text.trim().toLowerCase();
        final rows = maps(data['conversations']).where((row) {
          if (needle.isEmpty) return true;
          return (text(row['title']) ?? '').toLowerCase().contains(needle);
        }).toList();
        return ScreenScroll(
          onRefresh: reload,
          children: [
            Row(
              children: [
                Text('Повідомлення', style: unbounded.copyWith(fontSize: 26)),
                const Spacer(),
                IconButton(onPressed: () => context.go('/people'), icon: const Icon(Icons.edit_outlined, color: ink)),
              ],
            ),
            GcField(controller: query, label: 'Пошук', onSubmit: () => setState(() {})),
            if (rows.isEmpty) const Padding(padding: EdgeInsets.only(top: 24), child: Text('Поки немає бесід.', style: TextStyle(color: muted, fontFamily: 'Onest'))),
            for (final row in rows)
              ListTile(
                contentPadding: const EdgeInsets.symmetric(vertical: 4),
                leading: Avatar(url: text(row['avatar_url']), name: text(row['title']) ?? 'Чат', size: 52),
                title: Text(text(row['title']) ?? 'Чат', maxLines: 1, overflow: TextOverflow.ellipsis, style: onest.copyWith(fontWeight: FontWeight.w600)),
                subtitle: Text(
                  text(row['last_message'] is Map ? (row['last_message'] as Map)['preview'] : null) ?? '',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: onest.copyWith(color: muted, fontSize: 13),
                ),
                trailing: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(clock(row['last_message'] is Map ? (row['last_message'] as Map)['created_at'] : null), style: onest.copyWith(color: muted, fontSize: 11)),
                    if ((row['unread'] ?? 0) != 0)
                      Container(
                        margin: const EdgeInsets.only(top: 4),
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(gradient: brand, borderRadius: BorderRadius.circular(10)),
                        child: Text('${row['unread']}', style: const TextStyle(color: Colors.white, fontSize: 11, fontFamily: 'Onest')),
                      ),
                  ],
                ),
                onTap: () => context.push('/messages/${row['id']}'),
              ),
          ],
        );
      },
    );
  }
}

class ChatScreen extends StatefulWidget {
  const ChatScreen({required this.session, required this.id, super.key});
  final Session session;
  final int id;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final body = TextEditingController();
  bool stickersOpen = false;
  List<Map<String, dynamic>> stickers = [];

  @override
  void dispose() {
    body.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Remote(
      load: () => widget.session.api.get('/api/v1/messages/${widget.id}'),
      builder: (data, reload) {
        final conversation = data['conversation'] is Map ? Map<String, dynamic>.from(data['conversation'] as Map) : <String, dynamic>{};
        final history = data['history'] is Map ? data['history'] as Map : {};
        final messages = maps(history['messages']);
        final peer = conversation['peer'] is Map ? Map<String, dynamic>.from(conversation['peer'] as Map) : null;
        final online = peer?['is_online'] == true;
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 4, 12, 8),
              child: Row(
                children: [
                  IconButton(onPressed: () => context.go('/messages'), icon: const Icon(Icons.arrow_back_rounded, color: Colors.white)),
                  Avatar(url: text(conversation['avatar_url']), name: text(conversation['title']) ?? 'Чат', size: 42, online: online),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(text(conversation['title']) ?? 'Чат', maxLines: 1, overflow: TextOverflow.ellipsis, style: onest.copyWith(fontWeight: FontWeight.w700, fontSize: 17)),
                        Text(
                          online
                              ? 'у мережі'
                              : peer == null
                                  ? '${conversation['members_count'] ?? ''} учасн.'
                                  : (clock(peer['last_seen_at']).isEmpty ? 'не в мережі' : 'був о ${clock(peer['last_seen_at'])}'),
                          style: onest.copyWith(color: online ? cyan : muted, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert_rounded, color: cyan),
                    color: card,
                    onSelected: (value) async {
                      if (value != 'mute') return;
                      final next = conversation['is_muted'] != true;
                      await widget.session.api.post('/api/v1/messages/${widget.id}/mute', {'muted': next});
                      await reload();
                    },
                    itemBuilder: (context) => [
                      PopupMenuItem(
                        value: 'mute',
                        child: Text(conversation['is_muted'] == true ? 'Увімкнути звук' : 'Вимкнути звук', style: onest),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                children: [
                  for (final message in messages) _bubble(message),
                ],
              ),
            ),
            if (stickersOpen) _stickerStrip(reload),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 6, 10, 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: _toggleStickers,
                        customBorder: const CircleBorder(),
                        child: Ink(
                          width: 40,
                          height: 40,
                          decoration: const BoxDecoration(shape: BoxShape.circle, gradient: brand),
                          child: Icon(stickersOpen ? Icons.keyboard_rounded : Icons.sticky_note_2_outlined, color: Colors.white, size: 20),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.only(left: 14),
                      decoration: BoxDecoration(color: card, borderRadius: BorderRadius.circular(24)),
                      child: Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: body,
                              style: onest,
                              cursorColor: cyan,
                              minLines: 1,
                              maxLines: 4,
                              textInputAction: TextInputAction.send,
                              onSubmitted: (_) => _send(reload),
                              decoration: InputDecoration(
                                hintText: 'Напишіть повідомлення',
                                hintStyle: onest.copyWith(color: muted, fontSize: 14),
                                border: InputBorder.none,
                                isDense: true,
                              ),
                            ),
                          ),
                          IconButton(onPressed: () => _send(reload), icon: const Icon(Icons.send_rounded, color: cyan, size: 22)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _bubble(Map<String, dynamic> message) {
    final kind = text(message['type']) ?? 'text';
    final caption = text(message['body']) ?? text(message['preview']) ?? '';
    if (kind == 'system') {
      return Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Center(
          child: Container(
            constraints: const BoxConstraints(maxWidth: 300),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(color: card, borderRadius: BorderRadius.circular(16)),
            child: Text(caption, textAlign: TextAlign.center, style: onest.copyWith(color: muted, fontSize: 13)),
          ),
        ),
      );
    }
    final user = message['user'] is Map ? Map<String, dynamic>.from(message['user'] as Map) : <String, dynamic>{};
    final mine = '${user['id']}' == '${widget.session.me?['id']}';
    final sticker = message['sticker'] is Map ? absolute((message['sticker'] as Map)['url']) : null;
    final images = [
      for (final attachment in maps(message['attachments']))
        if (absolute(attachment['url']) != null && (text(attachment['type']) == 'image' || text(attachment['type']) == 'gif'))
          absolute(attachment['url'])!,
    ];
    final radius = BorderRadius.only(
      topLeft: const Radius.circular(18),
      topRight: const Radius.circular(18),
      bottomLeft: Radius.circular(mine ? 18 : 4),
      bottomRight: Radius.circular(mine ? 4 : 18),
    );
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Column(
        crossAxisAlignment: mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            constraints: const BoxConstraints(maxWidth: 240),
            decoration: BoxDecoration(gradient: mine ? brand : null, color: mine ? null : card, borderRadius: radius),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (!mine && text(user['name']) != null)
                  Text(text(user['name'])!, style: onest.copyWith(color: cyan, fontSize: 12, fontWeight: FontWeight.w600)),
                if (sticker != null) CachedNetworkImage(imageUrl: sticker, width: 120, height: 120),
                for (final image in images)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: CachedNetworkImage(imageUrl: image, width: 210, height: 150, fit: BoxFit.cover),
                    ),
                  ),
                if (caption.isNotEmpty) Text(caption, style: onest.copyWith(color: mine ? Colors.white : ink, fontSize: 14)),
                if (kind == 'voice') Text('Голосове повідомлення', style: onest.copyWith(color: mine ? Colors.white70 : muted, fontSize: 13)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 2, bottom: 8),
            child: Text(clock(message['created_at']), style: onest.copyWith(color: muted, fontSize: 11)),
          ),
        ],
      ),
    );
  }

  Widget _stickerStrip(Future<void> Function() reload) {
    if (stickers.isEmpty) {
      return const Padding(padding: EdgeInsets.all(16), child: Text('Стікерів немає.', style: TextStyle(color: muted, fontFamily: 'Onest')));
    }
    return SizedBox(
      height: 210,
      child: GridView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 4),
        itemCount: stickers.length,
        itemBuilder: (context, index) {
          final sticker = stickers[index];
          final url = absolute(sticker['url']);
          return InkWell(
            onTap: () => _sendSticker(sticker['id'], reload),
            child: url == null ? const SizedBox() : Padding(padding: const EdgeInsets.all(6), child: CachedNetworkImage(imageUrl: url)),
          );
        },
      ),
    );
  }

  Future<void> _toggleStickers() async {
    if (!stickersOpen && stickers.isEmpty) {
      try {
        final data = await widget.session.api.get('/api/v1/messages/stickers');
        final loaded = <Map<String, dynamic>>[];
        for (final pack in maps(data['packs'])) {
          loaded.addAll(maps(pack['stickers']));
        }
        stickers = loaded;
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
    if (mounted) setState(() => stickersOpen = !stickersOpen);
  }

  Future<void> _sendSticker(dynamic id, Future<void> Function() reload) async {
    try {
      await widget.session.api.post('/api/v1/messages/${widget.id}', {'sticker_id': id});
      setState(() => stickersOpen = false);
      await reload();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _send(Future<void> Function() reload) async {
    final value = body.text.trim();
    if (value.isEmpty) return;
    try {
      await widget.session.api.post('/api/v1/messages/${widget.id}', {'body': value});
      body.clear();
      await reload();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }
}

class FriendsScreen extends StatefulWidget {
  const FriendsScreen({required this.session, super.key});
  final Session session;

  @override
  State<FriendsScreen> createState() => _FriendsScreenState();
}

class _FriendsScreenState extends State<FriendsScreen> {
  String tab = 'all';
  final query = TextEditingController();
  String q = '';

  @override
  void dispose() {
    query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Remote(
      watch: '$tab:$q',
      load: () => widget.session.api.get('/api/v1/friends?tab=$tab&q=${Uri.encodeQueryComponent(q)}'),
      builder: (data, reload) {
        final users = Listing.parse(data['users']).items;
        final counts = data['counts'] is Map ? Map<String, dynamic>.from(data['counts'] as Map) : <String, dynamic>{};
        return ScreenScroll(
          onRefresh: reload,
          children: [
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _CountChip(label: 'Усі друзі', count: counts['all'], icon: Icons.people_alt_outlined, selected: tab == 'all', onTap: () => setState(() => tab = 'all')),
                  _CountChip(label: 'Онлайн', count: counts['online'], icon: Icons.wifi_tethering_rounded, selected: tab == 'online', onTap: () => setState(() => tab = 'online')),
                  _CountChip(label: 'Заявки', count: counts['requests'], icon: Icons.mail_outline_rounded, selected: tab == 'requests', onTap: () => setState(() => tab = 'requests')),
                ],
              ),
            ),
            const SizedBox(height: 10),
            GcField(controller: query, label: 'Пошук серед друзів', onSubmit: () => setState(() => q = query.text.trim())),
            const SizedBox(height: 12),
            if (users.isEmpty) const Text('Нікого немає.', style: TextStyle(color: muted, fontFamily: 'Onest')),
            for (var i = 0; i < users.length; i += 2)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: _FriendCard(user: users[i], tab: tab, session: widget.session, reload: reload)),
                    const SizedBox(width: 10),
                    Expanded(child: i + 1 < users.length ? _FriendCard(user: users[i + 1], tab: tab, session: widget.session, reload: reload) : const SizedBox()),
                  ],
                ),
              ),
            if (tab == 'all') ...[
              const SizedBox(height: 8),
              const Glass(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('МОЖЛИВО, ВИ ЗНАЙОМІ', style: TextStyle(fontFamily: 'Unbounded', fontSize: 13, color: ink)),
                    SizedBox(height: 6),
                    Text('Рекомендацій поки немає.', style: TextStyle(color: muted, fontFamily: 'Onest')),
                  ],
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}

class _CountChip extends StatelessWidget {
  const _CountChip({required this.label, required this.count, required this.icon, required this.selected, required this.onTap});
  final String label;
  final dynamic count;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: card,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: selected ? neonBlue.withValues(alpha: 0.7) : Colors.white.withValues(alpha: 0.05)),
            ),
            child: Row(
              children: [
                Icon(icon, size: 16, color: selected ? neonBlue : muted),
                const SizedBox(width: 6),
                Text(label, style: onest.copyWith(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(width: 6),
                Text('${count ?? 0}', style: onest.copyWith(color: muted, fontSize: 12)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _FriendCard extends StatelessWidget {
  const _FriendCard({required this.user, required this.tab, required this.session, required this.reload});
  final Map<String, dynamic> user;
  final String tab;
  final Session session;
  final Future<void> Function() reload;

  @override
  Widget build(BuildContext context) {
    final username = text(user['username']);
    return Glass(
      padding: const EdgeInsets.fromLTRB(10, 14, 10, 12),
      child: Column(
        children: [
          GestureDetector(
            onTap: username == null ? null : () => context.push('/u/$username'),
            child: Avatar(url: text(user['avatar_url']), name: text(user['name']) ?? '?', size: 72, online: user['is_online'] == true),
          ),
          const SizedBox(height: 8),
          Text(text(user['name']) ?? '', textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis, style: onest.copyWith(fontWeight: FontWeight.w700)),
          Text('@${username ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: onest.copyWith(color: muted, fontSize: 12)),
          const SizedBox(height: 10),
          if (tab == 'requests')
            TextButton(
              onPressed: username == null
                  ? null
                  : () async {
                      await session.api.post('/api/v1/friends/$username/accept');
                      await reload();
                    },
              child: const Text('Прийняти', style: TextStyle(color: Color(0xFF34D399), fontFamily: 'Onest')),
            )
          else
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(color: const Color(0xFF1A2033), borderRadius: BorderRadius.circular(12)),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.person_add_alt_1_rounded, color: Color(0xFF34D399), size: 14),
                  SizedBox(width: 4),
                  Text('У друзях', style: TextStyle(color: Color(0xFF34D399), fontFamily: 'Onest', fontSize: 13)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class PeopleScreen extends StatefulWidget {
  const PeopleScreen({required this.session, super.key});
  final Session session;

  @override
  State<PeopleScreen> createState() => _PeopleScreenState();
}

class _PeopleScreenState extends State<PeopleScreen> {
  final query = TextEditingController();
  String q = '';

  @override
  void dispose() {
    query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Remote(
      watch: q,
      load: () => widget.session.api.get('/api/v1/people?q=${Uri.encodeQueryComponent(q)}'),
      builder: (data, reload) {
        final users = Listing.parse(data['users']).items;
        return ScreenScroll(
          onRefresh: reload,
          children: [
            Text('Люди', style: unbounded.copyWith(fontSize: 28)),
            const SizedBox(height: 8),
            GcField(controller: query, label: 'Пошук', onSubmit: () => setState(() => q = query.text.trim())),
            if (users.isEmpty) const Padding(padding: EdgeInsets.only(top: 24), child: Text('Нікого не знайдено.', style: TextStyle(color: muted, fontFamily: 'Onest'))),
            for (final user in users)
              UserTile(
                user: user,
                trailing: TextButton(
                  onPressed: () async {
                    try {
                      await widget.session.api.post('/api/v1/friends/${user['username']}');
                      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Заявку надіслано')));
                    } catch (e) {
                      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                    }
                  },
                  child: const Text('Додати', style: TextStyle(color: cyan)),
                ),
              ),
          ],
        );
      },
    );
  }
}

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({required this.session, this.username, super.key});
  final Session session;
  final String? username;

  @override
  Widget build(BuildContext context) {
    final name = username ?? session.username;
    if (name == null || name.isEmpty) {
      return Center(
        child: TextButton(
          onPressed: session.refreshMe,
          child: const Text('Завантажити сторінку', style: TextStyle(color: cyan)),
        ),
      );
    }
    return Remote(
      load: () => session.api.get('/api/v1/users/$name'),
      builder: (data, reload) {
        final user = data['user'] is Map ? Map<String, dynamic>.from(data['user'] as Map) : <String, dynamic>{};
        final posts = Listing.parse(data['posts']).items;
        final own = name == session.username;
        final friends = maps(user['friends_preview']);
        final postsPage = Listing.parse(data['posts']);
        final role = text(user['role']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            if (username != null)
              Align(
                alignment: Alignment.centerLeft,
                child: IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_rounded, color: Colors.white)),
              ),
            ClipRRect(
              borderRadius: BorderRadius.circular(22),
              child: SizedBox(
                height: 120,
                width: double.infinity,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (absolute(user['cover_url']) != null)
                      CachedNetworkImage(imageUrl: absolute(user['cover_url'])!, fit: BoxFit.cover)
                    else
                      const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(colors: [Color(0xFF2436FF), Color(0xFF8B2BE2), Color(0xFFE14DCA)]))),
                  ],
                ),
              ),
            ),
            Transform.translate(
              offset: const Offset(0, -36),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Avatar(url: text(user['avatar_url']), name: text(user['name']) ?? name, size: 92, online: user['is_online'] == true),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Flexible(child: Text(text(user['name']) ?? name, style: unbounded.copyWith(fontSize: 24))),
                        if (role == 'admin' || role == 'moderator') ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(color: const Color(0xFF3A2E12), borderRadius: BorderRadius.circular(12), border: Border.all(color: gold.withValues(alpha: 0.5))),
                            child: Text(role == 'admin' ? 'Адміністратор' : 'Модератор', style: onest.copyWith(color: gold, fontSize: 11)),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(Icons.circle, size: 8, color: user['is_online'] == true ? const Color(0xFF34D399) : muted),
                        const SizedBox(width: 6),
                        Text(user['is_online'] == true ? 'онлайн' : 'не в мережі', style: onest.copyWith(color: muted, fontSize: 13)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            if (own)
              GhostButton(label: 'Редагувати профіль', icon: Icons.edit_outlined, onPressed: () => context.go('/settings'))
            else
              GhostButton(
                label: 'Написати',
                icon: Icons.chat_bubble_outline_rounded,
                onPressed: () async {
                  final chat = await session.api.post('/api/v1/messages/with/$name');
                  if (context.mounted) context.push('/messages/${chat['id']}');
                },
              ),
            if (joinedLabel(user['created_at']).isNotEmpty) ...[
              const SizedBox(height: 12),
              Row(children: [const Icon(Icons.calendar_today_outlined, size: 14, color: muted), const SizedBox(width: 8), Text(joinedLabel(user['created_at']), style: onest.copyWith(color: muted, fontSize: 13))]),
            ],
            const SizedBox(height: 14),
            Row(
              children: [
                _Stat('${user['friends'] ?? 0}', 'друзі'),
                _Stat('${postsPage.total}', 'записів'),
                _Stat('0', 'фото', onTap: () => context.push('/photos?user=$name')),
                const _Stat('0', 'аудіо'),
              ],
            ),
            if (friends.isNotEmpty) ...[
              const SizedBox(height: 14),
              Glass(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('ДРУЗІ', style: onest.copyWith(fontWeight: FontWeight.w700, letterSpacing: 0.6)),
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 78,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          for (final friend in friends)
                            Padding(
                              padding: const EdgeInsets.only(right: 12),
                              child: GestureDetector(
                                onTap: () {
                                  final handle = text(friend['username']);
                                  if (handle != null) context.push('/u/$handle');
                                },
                                child: SizedBox(
                                  width: 64,
                                  child: Column(
                                    children: [
                                      Avatar(url: text(friend['avatar_url']), name: text(friend['name']) ?? '?', size: 48),
                                      const SizedBox(height: 4),
                                      Text(text(friend['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: onest.copyWith(fontSize: 11)),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (own) ...[
              const SizedBox(height: 12),
              Material(
                color: card,
                borderRadius: BorderRadius.circular(22),
                child: InkWell(
                  onTap: () => context.go('/feed'),
                  borderRadius: BorderRadius.circular(22),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: [
                        Avatar(url: text(session.me?['avatar_url']), name: text(user['name']) ?? name, size: 40),
                        const SizedBox(width: 10),
                        Expanded(child: Text('Що нового, ${text(user['first_name']) ?? text(user['name']) ?? ''}?', style: onest.copyWith(color: muted))),
                      ],
                    ),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 12),
            if (posts.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 16),
                decoration: BoxDecoration(color: card, borderRadius: BorderRadius.circular(22)),
                child: Column(
                  children: [
                    const Icon(Icons.edit_outlined, color: neonBlue),
                    const SizedBox(height: 10),
                    Text('На стіні поки порожньо', style: unbounded.copyWith(fontSize: 18)),
                    const SizedBox(height: 6),
                    Text('Розкажіть світу щось цікаве — перший запис завжди найкращий.', textAlign: TextAlign.center, style: onest.copyWith(color: muted)),
                  ],
                ),
              ),
            for (final post in posts)
              PostCard(
                post: post,
                onLike: () async {
                  final result = await session.api.post('/api/v1/posts/${post['id']}/like');
                  post['liked'] = result['liked'];
                  post['likes_count'] = result['likes_count'];
                  await reload();
                },
                onComment: () => openComments(context, session.api, int.parse('${post['id']}')),
              ),
          ],
        );
      },
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.value, this.label, {this.onTap});
  final String value;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        child: Column(
          children: [
            Text(value, style: unbounded.copyWith(fontSize: 20)),
            Text(label, style: onest.copyWith(color: muted, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

String clock(dynamic iso) {
  final raw = text(iso);
  final dt = raw == null ? null : DateTime.tryParse(raw)?.toLocal();
  if (dt == null) return '';
  return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
}
