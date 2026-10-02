import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'api.dart';
import 'people.dart';
import 'posts.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Сторінки записів з підвантаженням: стрічка, стіна профілю, спільнота.
class PostPager {
  PostPager(this.load);

  /// Повертає відповідь API з `posts` (пагінація Laravel) для сторінки [page].
  final Future<Map<String, dynamic>> Function(int page) load;
  final posts = <Map<String, dynamic>>[];
  Map<String, dynamic> first = {};
  int page = 0;
  bool more = true;
  bool loading = false;

  Future<void> reset() async {
    page = 0;
    more = true;
    final data = await load(1);
    first = data;
    final listing = Listing.parse(data['posts']);
    posts
      ..clear()
      ..addAll(listing.items);
    page = 1;
    more = listing.more;
  }

  Future<bool> next() async {
    if (loading || !more) return false;
    loading = true;
    try {
      final listing = Listing.parse((await load(page + 1))['posts']);
      final known = {for (final p in posts) '${p['id']}'};
      posts.addAll(listing.items.where((p) => !known.contains('${p['id']}')));
      page += 1;
      more = listing.more;
      return true;
    } finally {
      loading = false;
    }
  }
}

/// Хвіст списку: підвантажує наступну сторінку, коли доходить до низу.
class LoadMore extends StatelessWidget {
  const LoadMore({required this.more, required this.onMore, super.key});
  final bool more;
  final VoidCallback onMore;

  @override
  Widget build(BuildContext context) {
    if (!more) return const SizedBox(height: 8);
    WidgetsBinding.instance.addPostFrameCallback((_) => onMore());
    return const Padding(padding: EdgeInsets.all(18), child: Center(child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))));
  }
}

// ───────────────────────── Новини ─────────────────────────

class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key});

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  String tab = 'friends';
  late final pager = PostPager((page) => AppScope.read(context).session.api.get('/api/v1/feed?page=$page&tab=$tab'));
  bool ready = false;
  Object? error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _reload());
  }

  Future<void> _reload() async {
    try {
      await pager.reset();
      error = null;
      tab = text(pager.first['tab']) ?? tab;
    } catch (e) {
      error = e;
    }
    if (mounted) setState(() => ready = true);
  }

  Future<void> _more() async {
    try {
      if (await pager.next() && mounted) setState(() {});
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final online = maps(pager.first['online_friends']);
    final suggestions = maps(pager.first['suggestions']);
    return ScreenScroll(
      onRefresh: _reload,
      children: [
        Composer(onPosted: _reload),
        const SizedBox(height: 12),
        Segmented(
          options: const [SegmentOption('friends', 'Друзі', icon: Icons.people_alt_outlined), SegmentOption('discover', 'Рекомендації', icon: Icons.local_fire_department_outlined)],
          selected: tab,
          onSelect: (value) {
            setState(() {
              tab = value;
              ready = false;
            });
            _reload();
          },
        ),
        const SizedBox(height: 12),
        if (online.isNotEmpty) ...[
          Glass(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CardTitle('Зараз онлайн', icon: Icons.wifi_tethering_rounded, trailing: '${online.length}'),
                const SizedBox(height: 10),
                SizedBox(
                  height: 78,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: online.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 14),
                    itemBuilder: (_, i) => _AvatarChip(user: online[i]),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
        if (!ready)
          const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator(strokeWidth: 2.4)))
        else if (error != null)
          EmptyState(icon: Icons.wifi_off_rounded, title: 'Не вдалося завантажити', text: '$error', action: 'Спробувати знову', onAction: _reload)
        else if (pager.posts.isEmpty)
          EmptyState(
            icon: tab == 'discover' ? Icons.explore_outlined : Icons.article_outlined,
            title: tab == 'discover' ? 'Тут ще нічого немає' : 'Стрічка поки порожня',
            text: 'Напишіть перший запис або знайдіть друзів — і стрічка оживе.',
            action: 'Знайти друзів',
            actionIcon: Icons.person_add_alt_1_outlined,
            onAction: () => context.push('/people'),
          )
        else ...[
          for (final post in pager.posts) PostCard(key: ValueKey('post-${post['id']}'), post: post, onDeleted: () => pager.posts.remove(post)),
          LoadMore(more: pager.more, onMore: _more),
        ],
        if (suggestions.isNotEmpty && ready) ...[
          const SizedBox(height: 4),
          Glass(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CardTitle('Можливо, ви знайомі', icon: Icons.person_add_alt_outlined, trailing: 'Усі', onTrailing: () => context.push('/people')),
                const SizedBox(height: 6),
                for (final user in suggestions)
                  UserTile(
                    user: user,
                    subtitle: intOf(user['mutual']) > 0 ? '${user['mutual']} ${plural(intOf(user['mutual']), 'спільний друг', 'спільні друзі', 'спільних друзів')}' : '@${user['username']}',
                    trailing: FriendAction(username: '${user['username']}', relation: 'none', compact: true),
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _AvatarChip extends StatelessWidget {
  const _AvatarChip({required this.user});
  final Map<String, dynamic> user;

  @override
  Widget build(BuildContext context) {
    final name = text(user['first_name']) ?? text(user['name']) ?? '';
    return GestureDetector(
      onTap: () => context.push('/u/${user['username']}'),
      child: SizedBox(
        width: 58,
        child: Column(
          children: [
            Avatar(url: text(user['avatar_url']), name: text(user['name']) ?? name, size: 50, online: true),
            const SizedBox(height: 6),
            Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(11.5, color: soft)),
          ],
        ),
      ),
    );
  }
}

// ───────────────────────── Один запис ─────────────────────────

class PostScreen extends StatelessWidget {
  const PostScreen({required this.id, super.key});
  final int id;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.of(context).session.api;
    return Remote(
      load: () => api.get('/api/v1/posts/$id'),
      builder: (data, reload) => ScreenScroll(
        onRefresh: reload,
        children: [
          Row(
            children: [
              RoundIcon(icon: Icons.arrow_back_rounded, onTap: () => context.canPop() ? context.pop() : context.go('/feed')),
              const SizedBox(width: 8),
              Text('Запис', style: display(18)),
            ],
          ),
          const SizedBox(height: 10),
          PostCard(post: mapOf(data['post']), expanded: true, onDeleted: () => context.canPop() ? context.pop() : context.go('/feed')),
        ],
      ),
    );
  }
}

// ───────────────────────── Пошук ─────────────────────────

/// Пошук людей і спільнот із шапки (як випадаючий пошук сайту).
class SearchScreen extends StatefulWidget {
  const SearchScreen({this.initial = '', super.key});
  final String initial;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  late final query = TextEditingController(text: widget.initial);
  List<Map<String, dynamic>> users = [];
  List<Map<String, dynamic>> communities = [];
  bool loading = false;
  Timer? debounce;

  @override
  void initState() {
    super.initState();
    if (widget.initial.isNotEmpty) WidgetsBinding.instance.addPostFrameCallback((_) => _search());
  }

  @override
  void dispose() {
    query.dispose();
    debounce?.cancel();
    super.dispose();
  }

  Future<void> _search() async {
    final q = query.text.trim();
    if (q.length < 2) {
      setState(() {
        users = [];
        communities = [];
      });
      return;
    }
    final api = AppScope.read(context).session.api;
    setState(() => loading = true);
    try {
      final encoded = Uri.encodeQueryComponent(q);
      final results = await Future.wait([
        api.get('/api/v1/search?q=$encoded'),
        api.get('/api/v1/communities?tab=all&q=$encoded').catchError((_) => <String, dynamic>{}),
      ]);
      if (!mounted || query.text.trim() != q) return;
      setState(() {
        users = maps(results[0]['users']);
        communities = Listing.parse(results[1]['communities']).items.take(6).toList();
      });
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = query.text.trim();
    return ScreenScroll(
      children: [
        Row(
          children: [
            RoundIcon(icon: Icons.arrow_back_rounded, onTap: () => context.canPop() ? context.pop() : context.go('/feed')),
            const SizedBox(width: 8),
            Expanded(
              child: GcField(
                controller: query,
                label: 'Пошук людей і спільнот',
                icon: Icons.search_rounded,
                autofocus: widget.initial.isEmpty,
                dense: true,
                onChanged: (_) {
                  debounce?.cancel();
                  debounce = Timer(const Duration(milliseconds: 300), _search);
                  setState(() {});
                },
                onSubmit: _search,
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        if (loading && users.isEmpty && communities.isEmpty)
          const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator(strokeWidth: 2)))
        else if (q.length < 2)
          const QuietEmpty(icon: Icons.search_rounded, text: 'Введіть щонайменше 2 символи')
        else if (users.isEmpty && communities.isEmpty)
          QuietEmpty(icon: Icons.person_search_outlined, text: 'За запитом «$q» нічого не знайдено')
        else ...[
          if (users.isNotEmpty)
            Glass(
              padding: const EdgeInsets.fromLTRB(12, 14, 12, 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(padding: EdgeInsets.only(left: 4), child: CardTitle('Люди', icon: Icons.people_alt_outlined)),
                  const SizedBox(height: 4),
                  for (final user in users) UserTile(user: user, trailing: FriendAction(username: '${user['username']}', relation: text(user['relation']) ?? 'none', compact: true)),
                ],
              ),
            ),
          if (communities.isNotEmpty) ...[
            const SizedBox(height: 12),
            Glass(
              padding: const EdgeInsets.fromLTRB(12, 14, 12, 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(padding: EdgeInsets.only(left: 4), child: CardTitle('Спільноти', icon: Icons.groups_2_outlined)),
                  const SizedBox(height: 4),
                  for (final community in communities)
                    ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                      leading: Avatar(url: text(community['avatar_url']), name: text(community['name']) ?? '?', size: 44, square: true),
                      title: Text(text(community['name']) ?? '', style: body(15, weight: FontWeight.w600)),
                      subtitle: Text('${compact(community['members_count'])} ${plural(intOf(community['members_count']), 'учасник', 'учасники', 'учасників')}', style: body(12.5, color: muted)),
                      onTap: () => context.push('/communities/${community['slug']}'),
                    ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          GhostButton(label: 'Розширений пошук людей', icon: Icons.tune_rounded, onPressed: () => context.push('/people?q=${Uri.encodeQueryComponent(q)}')),
        ],
      ],
    );
  }
}
