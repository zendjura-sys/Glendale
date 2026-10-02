import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'api.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

class MessagesScreen extends StatelessWidget {
  const MessagesScreen({required this.session, super.key});
  final Session session;

  @override
  Widget build(BuildContext context) {
    return Remote(
      load: () => session.api.get('/api/v1/messages'),
      builder: (data, reload) {
        final rows = maps(data['conversations']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            Text('Чати', style: unbounded.copyWith(fontSize: 28)),
            if (rows.isEmpty) const Padding(padding: EdgeInsets.only(top: 24), child: Text('Поки немає бесід.', style: TextStyle(color: muted, fontFamily: 'Onest'))),
            for (final row in rows)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Glass(
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(text(row['title']) ?? 'Чат', style: onest.copyWith(fontWeight: FontWeight.w600)),
                    subtitle: Text(text(row['last_message'] is Map ? (row['last_message'] as Map)['preview'] : null) ?? '', style: onest.copyWith(color: muted)),
                    trailing: (row['unread'] ?? 0) == 0 ? null : Text('${row['unread']}', style: const TextStyle(color: cyan)),
                    onTap: () => context.push('/messages/${row['id']}'),
                  ),
                ),
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
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
              child: Row(
                children: [
                  IconButton(onPressed: () => context.go('/messages'), icon: const Icon(Icons.arrow_back_rounded, color: Colors.white)),
                  Expanded(child: Text(text(conversation['title']) ?? 'Чат', style: unbounded.copyWith(fontSize: 18))),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  for (final message in messages)
                    Align(
                      alignment: message['user'] is Map && message['user']['id'] == widget.session.me?['id'] ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(12),
                        constraints: const BoxConstraints(maxWidth: 280),
                        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(16)),
                        child: Text(text(message['body']) ?? text(message['preview']) ?? '', style: onest),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Row(
                children: [
                  Expanded(child: GcField(controller: body, label: 'Повідомлення', onSubmit: () => _send(reload))),
                  IconButton(onPressed: () => _send(reload), icon: const Icon(Icons.send_rounded, color: cyan)),
                ],
              ),
            ),
          ],
        );
      },
    );
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

  @override
  Widget build(BuildContext context) {
    return Remote(
      watch: tab,
      load: () => widget.session.api.get('/api/v1/friends?tab=$tab'),
      builder: (data, reload) {
        final users = Listing.parse(data['users']).items;
        return ScreenScroll(
          onRefresh: reload,
          children: [
            Text('Друзі', style: unbounded.copyWith(fontSize: 28)),
            const SizedBox(height: 8),
            ChipRow(
              options: const [('all', 'Усі'), ('online', 'Онлайн'), ('requests', 'Заявки'), ('outgoing', 'Надіслані')],
              selected: tab,
              onSelect: (value) => setState(() => tab = value),
            ),
            if (users.isEmpty) const Padding(padding: EdgeInsets.only(top: 24), child: Text('Нікого немає.', style: TextStyle(color: muted, fontFamily: 'Onest'))),
            for (final user in users)
              UserTile(
                user: user,
                trailing: tab == 'requests'
                    ? TextButton(
                        onPressed: () async {
                          await widget.session.api.post('/api/v1/friends/${user['username']}/accept');
                          await reload();
                        },
                        child: const Text('Прийняти', style: TextStyle(color: cyan)),
                      )
                    : null,
              ),
          ],
        );
      },
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
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(16, 28, 16, 18),
                decoration: const BoxDecoration(gradient: brand),
                child: Column(
                  children: [
                    Avatar(url: text(user['avatar_url']), name: text(user['name']) ?? name, size: 84, online: user['is_online'] == true),
                    const SizedBox(height: 10),
                    Text(text(user['name']) ?? name, textAlign: TextAlign.center, style: unbounded.copyWith(fontSize: 20)),
                    Text('@$name', style: onest.copyWith(color: Colors.white70)),
                    if (text(user['about']) != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(text(user['about'])!, textAlign: TextAlign.center, style: onest.copyWith(fontSize: 13)),
                      ),
                  ],
                ),
              ),
            ),
            Row(
              children: [
                TextButton(onPressed: () => context.push('/photos?user=$name'), child: const Text('Фото', style: TextStyle(color: cyan))),
                if (!own)
                  TextButton(
                    onPressed: () async {
                      final chat = await session.api.post('/api/v1/messages/with/$name');
                      if (context.mounted) context.push('/messages/${chat['id']}');
                    },
                    child: const Text('Написати', style: TextStyle(color: cyan)),
                  ),
              ],
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
