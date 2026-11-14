import 'dart:async';

import 'package:flutter/material.dart';

import 'core/widgets/arctic_glass/arctic_fit_text.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'people.dart';
import 'posts.dart';
import 'shell.dart';
import 'state.dart';
import 'feed_pulse.dart';
import 'status.dart';
import 'stories.dart';
import 'theme.dart';
import 'widgets.dart';
import 'wrapped.dart';
import 'i18n.dart';
import 'skeletons.dart';

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
  final pulse = GlobalKey<FeedPulseState>();

  Future<void> _reload() async {
    unawaited(stories.currentState?.reload());
    unawaited(pulse.currentState?.reload());
    // «Активність друзів» — окремий список (міст /site/feed/activity), без пагінатора постів.
    if (tab == 'activity') {
      if (mounted) setState(() => ready = true);
      return;
    }
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
    // Віджети головної — ті самі, що людина обрала на сайті (за замовчуванням усі).
    final widgets = (AppScope.of(context).session.me?['home_widgets'] is List) ? {for (final w in AppScope.of(context).session.me!['home_widgets'] as List) '$w'} : null;
    bool shows(String key) => widgets == null || widgets.contains(key);
    final tomorrow = maps(pager.first['tomorrow']);
    final languages = (pager.first['languages'] is List ? pager.first['languages'] as List : const []).map((l) => '$l').toList();
    return ScreenScroll(
      onRefresh: _reload,
      children: [
        const IncidentBanner(),
        StoriesStrip(key: stories),
        FeedPulse(key: pulse),
        if (AppScope.of(context).session.wrappedYear case final year?) ...[WrappedBanner(year: year), const SizedBox(height: 12)],
        if (tomorrow.isNotEmpty) ...[_TomorrowCard(events: tomorrow), const SizedBox(height: 12)],
        Composer(onPosted: _reload),
        SizedBox(height: 12),
        // Вкладки-пігулки, як на сайті: активна — суцільна небесна.
        Row(children: [
          for (final (key, label, icon) in [('friends', tr('Друзі'), LucideIcons.usersRound), ('discover', tr('Рекомендації'), LucideIcons.flame), ('activity', tr('Активність'), LucideIcons.activity)]) ...[
            Expanded(
              child: GestureDetector(
                onTap: () {
                  if (tab == key) return;
                  setState(() {
                    tab = key;
                    ready = false;
                  });
                  _reload();
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  height: 42,
                  decoration: BoxDecoration(color: tab == key ? const Color(0xFF0EA5E9) : card, borderRadius: BorderRadius.circular(8)),
                  child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(icon, size: 16, color: tab == key ? Colors.white : soft),
                    const SizedBox(width: 7),
                    Flexible(child: FitText(label, style: body(14, color: tab == key ? Colors.white : soft, weight: FontWeight.w700))),
                  ]),
                ),
              ),
            ),
            if (key != 'activity') const SizedBox(width: 8),
          ],
        ]),
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
        if (online.isNotEmpty && shows('online')) ...[
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
        if (tab == 'activity')
          const FriendActivityList()
        else if (!ready)
          const FeedSkeleton()
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
        if (suggestions.isNotEmpty && ready && shows('suggestions')) ...[
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
            FitText(name, style: body(11.5, color: soft)),
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
  List<Map<String, dynamic>> hits = [];
  bool loading = false;
  Timer? debounce;
  // Історія й популярні запити — як на сайті (/search/quick без запиту).
  List<String> recent = [];
  List<String> popular = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (widget.initial.isNotEmpty) _search();
      _history();
    });
  }

  List<String> _words(dynamic v) => [
        for (final x in (v is List ? v : const []))
          if (x is String) x else if (x is Map && (x['q'] ?? x['query'] ?? x['title']) != null) '${x['q'] ?? x['query'] ?? x['title']}',
      ];

  Future<void> _history() async {
    try {
      final r = await AppScope.read(context).session.api.get(Api.site('/search/quick?q='));
      if (mounted) setState(() => (recent = _words(r['recent']), popular = _words(r['trending']).isNotEmpty ? _words(r['trending']) : _words(r['popular'])));
    } catch (_) {}
  }

  Future<void> _remember(String q) async {
    try {
      final r = await AppScope.read(context).session.api.post(Api.site('/search/recent'), {'q': q});
      if (mounted) setState(() => recent = _words(r['recent']));
    } catch (_) {}
  }

  Future<void> _forget([String? q]) async {
    try {
      final r = await AppScope.read(context).session.api.delete(Api.site('/search/recent'), q == null ? null : {'q': q});
      if (mounted) setState(() => recent = _words(r['recent']));
    } catch (_) {}
  }

  void _pick(String q) {
    query.text = q;
    setState(() {});
    _search();
    _remember(q);
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
        hits = [];
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
        api.get(Api.site('/search/quick?q=$encoded')).catchError((_) => <String, dynamic>{}),
      ]);
      if (!mounted || query.text.trim() != q) return;
      setState(() {
        users = maps(results[0]['users']);
        communities = Listing.parse(results[1]['communities']).items.take(6).toList();
        // Кіно, музика, ігри, сервери, клани, сім'ї — з того самого пошуку, що й на сайті.
        hits = maps(results[2]['hits']).where((h) => h['kind'] != 'user' && h['kind'] != 'community').toList();
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
                label: tr('Пошук: люди, кіно, музика, ігри…'),
                icon: LucideIcons.search,
                autofocus: widget.initial.isEmpty,
                dense: true,
                onChanged: (_) {
                  debounce?.cancel();
                  debounce = Timer(const Duration(milliseconds: 300), _search);
                  setState(() {});
                },
                onSubmit: () {
                  _search();
                  if (query.text.trim().length >= 2) _remember(query.text.trim());
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        if (loading && users.isEmpty && communities.isEmpty)
          const ListSkeleton(rows: 5)
        else if (q.length < 2 && (recent.isNotEmpty || popular.isNotEmpty))
          Glass(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (recent.isNotEmpty) ...[
                CardTitle(tr('Нещодавні'), icon: LucideIcons.history, trailing: tr('Очистити'), onTrailing: () => _forget()),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  for (final r in recent) InputChip(label: Text(r, style: body(13)), onPressed: () => _pick(r), onDeleted: () => _forget(r), deleteIcon: Icon(LucideIcons.x, size: 14, color: muted)),
                ]),
              ],
              if (popular.isNotEmpty) ...[
                if (recent.isNotEmpty) const SizedBox(height: 12),
                CardTitle(tr('Популярне'), icon: LucideIcons.trendingUp),
                Wrap(spacing: 6, runSpacing: 6, children: [for (final p in popular.take(10)) ActionChip(label: Text(p, style: body(13)), onPressed: () => _pick(p))]),
              ],
            ]),
          )
        else if (q.length < 2)
          QuietEmpty(icon: LucideIcons.search, text: tr('Введіть щонайменше 2 символи'))
        else if (users.isEmpty && communities.isEmpty && hits.isEmpty)
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
          if (hits.isNotEmpty) ...[
            const SizedBox(height: 12),
            Glass(
              padding: const EdgeInsets.fromLTRB(12, 14, 12, 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(padding: EdgeInsets.only(left: 4), child: CardTitle(tr('На сайті'), icon: LucideIcons.layoutGrid)),
                  const SizedBox(height: 4),
                  for (final hit in hits)
                    ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                      leading: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(color: primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
                        child: Icon(
                          switch ('${hit['kind']}') {
                            'movie' => LucideIcons.clapperboard,
                            'track' => LucideIcons.music,
                            'game' => LucideIcons.gamepad2,
                            'server' => LucideIcons.server,
                            'clan' => LucideIcons.swords,
                            'family' => LucideIcons.crown,
                            _ => LucideIcons.search,
                          },
                          size: 18,
                          color: primary,
                        ),
                      ),
                      title: FitText(text(hit['title']) ?? '', style: body(15, weight: FontWeight.w600)),
                      subtitle: Text(tr(text(hit['hint']) ?? ''), style: body(12.5, color: muted)),
                      onTap: () => context.push(appPathFor(text(hit['href']))),
                    ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          // Той самий запит — одразу в розділах.
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final (icon, label, path) in [
              (LucideIcons.clapperboard, tr('«{q}» у кіно', {'q': q}), '/cinema?q='),
              (LucideIcons.music, tr('«{q}» у музиці', {'q': q}), '/music/search?q='),
            ])
              GestureDetector(onTap: () => context.push('$path${Uri.encodeQueryComponent(q)}'), child: Pill(label: label, icon: icon, color: primary)),
          ]),
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
                  child: Text(clock(e['starts_at']), style: body(13.5, color: const Color(0xFF9DD8FF), weight: FontWeight.w700)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    FitText(text(e['title']) ?? '', style: body(14, weight: FontWeight.w600)),
                    FitText(text(mapOf(e['where'])['name']) ?? text(e['type_label']) ?? '', style: body(12, color: muted)),
                  ]),
                ),
              ]),
            ),
          ),
      ]),
    );
  }
}

/// «Активність друзів» — як вкладка на сайті: відгуки, добірки кіно, беклог ігор (хто що пройшов чи почав).
class FriendActivityList extends StatefulWidget {
  const FriendActivityList({super.key});

  @override
  State<FriendActivityList> createState() => _FriendActivityListState();
}

class _FriendActivityListState extends State<FriendActivityList> {
  List<Map<String, dynamic>>? items;
  Object? error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final r = await AppScope.read(context).session.api.get(Api.site('/feed/activity'));
        if (mounted) setState(() => items = maps(r['items']));
      } catch (e) {
        if (mounted) setState(() => error = e);
      }
    });
  }

  String _verb(String kind) => switch (kind) {
        'game_review' => tr('оцінює гру'),
        'movie_review' => tr('пише відгук'),
        'movie_list' => tr('створює добірку'),
        'backlog.done' => tr('проходить'),
        'backlog.playing' => tr('починає грати'),
        _ => tr('оновлює профіль'),
      };

  @override
  Widget build(BuildContext context) {
    final list = items;
    if (error != null) return EmptyState(icon: LucideIcons.wifiOff, title: tr('Не вдалося завантажити'), text: '$error');
    if (list == null) return const FeedSkeleton();
    if (list.isEmpty) return EmptyState(icon: LucideIcons.activity, title: tr('Поки тихо'), text: tr('Тут з’являться відгуки, добірки й ігри друзів.'));
    return Column(children: [
      for (final it in list) ...[
        Builder(builder: (context) {
          final target = mapOf(it['game']).isNotEmpty ? mapOf(it['game']) : (mapOf(it['movie']).isNotEmpty ? mapOf(it['movie']) : mapOf(it['list']));
          final user = mapOf(it['user']);
          return Glass(
            padding: const EdgeInsets.all(12),
            onTap: text(target['href']) != null ? () => context.push(appPathFor(text(target['href']))) : null,
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Avatar(name: text(user['name']) ?? '', url: text(user['avatar_url']), size: 40),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text.rich(TextSpan(children: [
                    TextSpan(text: '${text(user['name']) ?? ''} ', style: body(13.5, weight: FontWeight.w700)),
                    TextSpan(text: '${_verb(text(it['kind']) ?? '')} ', style: body(13.5, color: muted)),
                    TextSpan(text: text(target['title']) ?? '', style: body(13.5, weight: FontWeight.w600)),
                    if (it['score'] != null) TextSpan(text: ' · ${it['score']}/10', style: body(13.5, color: primary, weight: FontWeight.w700)),
                  ])),
                  if (text(it['excerpt']) != null) ...[
                    const SizedBox(height: 4),
                    Text(text(it['excerpt'])!, maxLines: 3, overflow: TextOverflow.fade, style: body(12.5, color: soft)),
                  ],
                  const SizedBox(height: 4),
                  Text(ago(it['at']), style: body(11.5, color: faint)),
                ]),
              ),
              if (text(target['cover']) != null) ...[const SizedBox(width: 10), NetImage(text(target['cover']), width: 54, height: 54, radius: 12)],
            ]),
          );
        }),
        const SizedBox(height: 8),
      ],
    ]);
  }
}
