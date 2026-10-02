import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'api.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

class FeedScreen extends StatefulWidget {
  const FeedScreen({required this.session, super.key});
  final Session session;

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  final composer = TextEditingController();
  String tab = 'friends';
  String visibility = 'public';
  int page = 1;

  @override
  void dispose() {
    composer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Remote(
      watch: '$tab:$page',
      load: () => widget.session.api.get('/api/v1/feed?page=$page&tab=$tab'),
      builder: (data, reload) {
        final posts = Listing.parse(data['posts']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            _Composer(
              session: widget.session,
              controller: composer,
              visibility: visibility,
              onVisibility: (value) => setState(() => visibility = value),
              onPublish: () => _publish(context, reload),
            ),
            const SizedBox(height: 12),
            _FeedTabs(
              selected: tab,
              onSelect: (value) => setState(() {
                tab = value;
                page = 1;
              }),
            ),
            const SizedBox(height: 12),
            if (posts.items.isEmpty)
              _EmptyFeed(onFind: () => context.go('/people')),
            for (final post in posts.items)
              PostCard(
                post: post,
                onLike: () async {
                  try {
                    final result = await widget.session.api.post('/api/v1/posts/${post['id']}/like');
                    setState(() {
                      post['liked'] = result['liked'];
                      post['likes_count'] = result['likes_count'];
                    });
                  } catch (e) {
                    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                  }
                },
                onComment: () => openComments(context, widget.session.api, _intId(post['id'])),
              ),
            if (posts.more)
              TextButton(onPressed: () => setState(() => page += 1), child: const Text('Ще', style: TextStyle(color: cyan))),
          ],
        );
      },
    );
  }
}

int _intId(dynamic value) => value is int ? value : int.tryParse('$value') ?? 0;

class _Composer extends StatelessWidget {
  const _Composer({required this.session, required this.controller, required this.visibility, required this.onVisibility, required this.onPublish});
  final Session session;
  final TextEditingController controller;
  final String visibility;
  final ValueChanged<String> onVisibility;
  final VoidCallback onPublish;

  @override
  Widget build(BuildContext context) {
    final name = text(session.me?['first_name']) ?? text(session.me?['name']) ?? '';
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
      decoration: BoxDecoration(color: card, borderRadius: BorderRadius.circular(22), border: Border.all(color: Colors.white.withValues(alpha: 0.05))),
      child: Column(
        children: [
          Row(
            children: [
              Avatar(url: text(session.me?['avatar_url']), name: text(session.me?['name']) ?? 'Я', size: 40),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: controller,
                  style: onest,
                  cursorColor: neonBlue,
                  minLines: 1,
                  maxLines: 4,
                  decoration: InputDecoration(
                    hintText: name.isEmpty ? 'Що нового?' : 'Що нового, $name?',
                    hintStyle: onest.copyWith(color: muted),
                    border: InputBorder.none,
                    isCollapsed: true,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _VisIcon(icon: Icons.public_rounded, selected: visibility == 'public', onTap: () => onVisibility('public')),
              _VisIcon(icon: Icons.people_alt_outlined, selected: visibility == 'friends', onTap: () => onVisibility('friends')),
              _VisIcon(icon: Icons.lock_outline_rounded, selected: visibility == 'private', onTap: () => onVisibility('private')),
              const Spacer(),
              Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: onPublish,
                  borderRadius: BorderRadius.circular(14),
                  child: Ink(
                    decoration: BoxDecoration(gradient: brand, borderRadius: BorderRadius.circular(14)),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    child: const Row(
                      children: [
                        Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 16),
                        SizedBox(width: 6),
                        Text('Опублікувати', style: TextStyle(color: Colors.white, fontFamily: 'Onest', fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _VisIcon extends StatelessWidget {
  const _VisIcon({required this.icon, required this.selected, required this.onTap});
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: Material(
        color: selected ? indigo.withValues(alpha: 0.35) : const Color(0xFF1C2236),
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: SizedBox(width: 36, height: 32, child: Icon(icon, size: 16, color: selected ? Colors.white : muted)),
        ),
      ),
    );
  }
}

class _FeedTabs extends StatelessWidget {
  const _FeedTabs({required this.selected, required this.onSelect});
  final String selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: card, borderRadius: BorderRadius.circular(16)),
      child: Row(
        children: [
          Expanded(child: _tab('friends', Icons.people_alt_outlined, 'Друзі')),
          Expanded(child: _tab('discover', Icons.local_fire_department_outlined, 'Рекомендації')),
        ],
      ),
    );
  }

  Widget _tab(String id, IconData icon, String label) {
    final on = selected == id;
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: () => onSelect(id),
        borderRadius: BorderRadius.circular(12),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            gradient: on ? const LinearGradient(colors: [Color(0xFF243056), Color(0xFF1A2038)]) : null,
            border: Border.all(color: on ? neonBlue.withValues(alpha: 0.45) : Colors.transparent),
          ),
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: on ? neonBlue : muted),
              const SizedBox(width: 6),
              Text(label, style: onest.copyWith(color: on ? Colors.white : muted, fontWeight: FontWeight.w600, fontSize: 13)),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyFeed extends StatelessWidget {
  const _EmptyFeed({required this.onFind});
  final VoidCallback onFind;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 24),
      decoration: BoxDecoration(color: card, borderRadius: BorderRadius.circular(22), border: Border.all(color: Colors.white.withValues(alpha: 0.05))),
      child: Column(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(color: const Color(0xFF1C2236), borderRadius: BorderRadius.circular(16)),
            child: const Icon(Icons.article_outlined, color: neonBlue),
          ),
          const SizedBox(height: 14),
          Text('Стрічка поки порожня', style: unbounded.copyWith(fontSize: 18)),
          const SizedBox(height: 8),
          Text('Напишіть перший запис або знайдіть друзів — і стрічка оживе.', textAlign: TextAlign.center, style: onest.copyWith(color: muted, height: 1.4)),
          const SizedBox(height: 16),
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onFind,
              borderRadius: BorderRadius.circular(14),
              child: Ink(
                decoration: BoxDecoration(gradient: brand, borderRadius: BorderRadius.circular(14)),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.person_add_alt_1_rounded, color: Colors.white, size: 16),
                    SizedBox(width: 6),
                    Text('Знайти друзів', style: TextStyle(color: Colors.white, fontFamily: 'Onest', fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

extension on _FeedScreenState {
  Future<void> _publish(BuildContext context, Future<void> Function() reload) async {
    final body = composer.text.trim();
    if (body.isEmpty) return;
    try {
      await widget.session.api.post('/api/v1/posts', {'body': body, 'visibility': visibility});
      composer.clear();
      await reload();
    } catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }
}
