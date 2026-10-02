import 'package:flutter/material.dart';

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
            const Wordmark(),
            const Padding(
              padding: EdgeInsets.only(top: 6, bottom: 12),
              child: Text('Стрічка', style: TextStyle(color: muted, fontFamily: 'Onest')),
            ),
            ChipRow(
              options: const [('friends', 'Стрічка'), ('discover', 'Цікаве')],
              selected: tab,
              onSelect: (value) => setState(() {
                tab = value;
                page = 1;
              }),
            ),
            const SizedBox(height: 12),
            Glass(
              child: Column(
                children: [
                  GcField(controller: composer, label: 'Що нового?'),
                  const SizedBox(height: 10),
                  PrimaryButton(
                    label: 'Опублікувати',
                    onPressed: () async {
                      final body = composer.text.trim();
                      if (body.isEmpty) return;
                      try {
                        await widget.session.api.post('/api/v1/posts', {'body': body, 'visibility': 'public'});
                        composer.clear();
                        await reload();
                      } catch (e) {
                        if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                      }
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (posts.items.isEmpty) const Text('Стрічка порожня.', style: TextStyle(color: muted, fontFamily: 'Onest')),
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
