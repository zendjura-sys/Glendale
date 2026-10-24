import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'people.dart';
import 'posts.dart';
import 'shell.dart';
import 'state.dart';
import 'stories.dart';
import 'theme.dart';
import 'widgets.dart';
import 'wrapped.dart';
import 'i18n.dart';

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
  String? lang;
  late final pager = PostPager((page) => AppScope.read(context).session.api.get('/api/v1/feed?page=$page&tab=$tab${lang == null ? '' : '&lang=$lang'}'));
  bool ready = false;
  Object? error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _reload());
  }

  final stories = GlobalKey<StoriesStripState>();

  Future<void> _reload() async {
    unawaited(stories.currentState?.reload());
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
    final tomorrow = maps(pager.first['tomorrow']);
    final languages = (pager.first['languages'] is List ? pager.first['languages'] as List : const []).map((l) => '$l').toList();
    return ScreenScroll(
      onRefresh: _reload,
      children: [
        StoriesStrip(key: stories),
        if (AppScope.of(context).session.wrappedYear case final year?) ...[WrappedBanner(year: year), const SizedBox(height: 12)],
        if (tomorrow.isNotEmpty) ...[_TomorrowCard(events: tomorrow), const SizedBox(height: 12)],
        Composer(onPosted: _reload),
        SizedBox(height: 12),
        Segmented(
          options: [SegmentOption('friends', tr('Друзі'), icon: LucideIcons.usersRound), SegmentOption('discover', tr('Рекомендації'), icon: LucideIcons.flame)],
          selected: tab,
          onSelect: (value) {
            setState(() {
              tab = value;
              ready = false;
            });
            _reload();
          },
        ),
        if (languages.isNotEmpty) ...[
          const SizedBox(height: 10),
          Row(children: [
            Icon(LucideIcons.languages, size: 16, color: muted),
            const SizedBox(width: 8),
            Text(tr('Мова записів'), style: body(12.5, color: muted)),
            const SizedBox(width: 10),
            Expanded(
              child: GcSelect<String>(
                value: lang ?? '',
                expand: true,
                items: [('', tr('Усі мови')), for (final l in languages) (l, languageName(l))],
                onChanged: (value) {
                  setState(() {
                    lang = (value == null || value.isEmpty) ? null : value;
                    ready = false;
                  });
                  _reload();
                },
              ),
            ),
          ]),
        ],
        const SizedBox(height: 12),
        if (online.isNotEmpty) ...[
          Glass(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CardTitle(tr('Зараз онлайн'), icon: LucideIcons.radio, trailing: '${online.length}'),
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
          EmptyState(icon: LucideIcons.wifiOff, title: tr('Не вдалося завантажити'), text: '$error', action: tr('Спробувати знову'), onAction: _reload)
        else if (pager.posts.isEmpty)
          EmptyState(
            icon: tab == 'discover' ? LucideIcons.compass : LucideIcons.newspaper,
            title: tab == 'discover' ? tr('Тут ще нічого немає') : tr('Стрічка поки порожня'),
            text: tr('Напишіть перший запис або знайдіть друзів — і стрічка оживе.'),
            action: tr('Знайти друзів'),
            actionIcon: LucideIcons.userRoundPlus,
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
                CardTitle(tr('Можливо, ви знайомі'), icon: LucideIcons.userRoundPlus, trailing: tr('Усі'), onTrailing: () => context.push('/people')),
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
              RoundIcon(icon: LucideIcons.arrowLeft, onTap: () => context.canPop() ? context.pop() : context.go('/feed')),
              const SizedBox(width: 8),
              Text(tr('Запис'), style: display(18)),
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
            RoundIcon(icon: LucideIcons.arrowLeft, onTap: () => context.canPop() ? context.pop() : context.go('/feed')),
            const SizedBox(width: 8),
            Expanded(
              child: GcField(
                controller: query,
                label: tr('Пошук людей і спільнот'),
                icon: LucideIcons.search,
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
          QuietEmpty(icon: LucideIcons.search, text: tr('Введіть щонайменше 2 символи'))
        else if (users.isEmpty && communities.isEmpty)
          QuietEmpty(icon: LucideIcons.userRoundSearch, text: tr('За запитом «{q}» нічого не знайдено', {'q': q}))
        else ...[
          if (users.isNotEmpty)
            Glass(
              padding: const EdgeInsets.fromLTRB(12, 14, 12, 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(padding: EdgeInsets.only(left: 4), child: CardTitle(tr('Люди'), icon: LucideIcons.usersRound)),
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
                  Padding(padding: EdgeInsets.only(left: 4), child: CardTitle(tr('Спільноти'), icon: LucideIcons.usersRound)),
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
          GhostButton(label: tr('Розширений пошук людей'), icon: LucideIcons.slidersHorizontal, onPressed: () => context.push('/people?q=${Uri.encodeQueryComponent(q)}')),
        ],
      ],
    );
  }
}


/// Картка в стрічці: завтра подія клану чи сім’ї.
class _TomorrowCard extends StatelessWidget {
  const _TomorrowCard({required this.events});
  final List<Map<String, dynamic>> events;

  @override
  Widget build(BuildContext context) {
    return Glass(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        CardTitle(tr('Завтра'), icon: LucideIcons.calendarClock),
        const SizedBox(height: 8),
        for (final e in events)
          InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => context.push(appPathFor(text(mapOf(e['where'])['url']) ?? '/events')),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(children: [
                Container(
                  width: 52,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: primary.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
                  child: Text(clock(e['starts_at']), style: body(13.5, color: const Color(0xFFB4BFFF), weight: FontWeight.w700)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(text(e['title']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, weight: FontWeight.w600)),
                    Text(text(mapOf(e['where'])['name']) ?? text(e['type_label']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
                  ]),
                ),
              ]),
            ),
          ),
      ]),
    );
  }
}
