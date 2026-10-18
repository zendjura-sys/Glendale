import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import 'achievements.dart';
import 'playing.dart';
import 'plus.dart';
import 'subscription.dart';
import 'account.dart';
import 'api.dart';
import 'characters.dart';
import 'feed.dart';
import 'posts.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';
import 'i18n.dart';
import 'extras.dart';

// ───────────────────────── Дружба ─────────────────────────

/// Кнопка дружби з тими самими станами, що на сайті: Додати / Заявку надіслано / Прийняти / У друзях.
class FriendAction extends StatefulWidget {
  const FriendAction({required this.username, required this.relation, this.compact = false, this.expand = false, this.onChanged, super.key});
  final String username;
  final String relation;
  final bool compact;
  final bool expand;
  final ValueChanged<String>? onChanged;

  @override
  State<FriendAction> createState() => _FriendActionState();
}

class _FriendActionState extends State<FriendAction> {
  late String relation = widget.relation;
  bool busy = false;

  @override
  void didUpdateWidget(FriendAction oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.relation != widget.relation) relation = widget.relation;
  }

  Future<void> _run(Future<Map<String, dynamic>> Function(Api api) action) async {
    if (busy) return;
    final session = AppScope.read(context).session;
    setState(() => busy = true);
    try {
      final result = await action(session.api);
      final next = text(result['relation']) ?? relation;
      if (mounted) setState(() => relation = next);
      widget.onChanged?.call(next);
      unawaited(session.refreshCounters());
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _friendMenu() async {
    final remove = await confirm(context, tr('Видалити з друзів?'), action: tr('Видалити'), danger: true);
    if (remove && mounted) await _run((api) => api.delete('/api/v1/friends/${widget.username}'));
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.username;
    final compactSize = widget.compact;
    if (relation == 'self') return const SizedBox.shrink();
    return switch (relation) {
      'friends' => GhostButton(label: tr('У друзях'), icon: LucideIcons.userRoundCheck, compact: compactSize, expand: widget.expand, onPressed: busy ? null : _friendMenu),
      'outgoing' => GhostButton(label: tr('Заявку надіслано'), icon: LucideIcons.clock, compact: compactSize, expand: widget.expand, color: muted, onPressed: busy ? null : () => _run((api) => api.delete('/api/v1/friends/$user'))),
      'incoming' => PrimaryButton(label: tr('Прийняти'), icon: LucideIcons.userRoundPlus, compact: compactSize, expand: widget.expand, busy: busy, onPressed: () => _run((api) => api.post('/api/v1/friends/$user/accept'))),
      _ => PrimaryButton(label: tr('Додати'), icon: LucideIcons.userRoundPlus, compact: compactSize, expand: widget.expand, busy: busy, onPressed: () => _run((api) => api.post('/api/v1/friends/$user'))),
    };
  }
}

/// Картка людини в сітці (друзі, пошук людей).
class PersonCard extends StatelessWidget {
  const PersonCard({required this.user, this.onChanged, super.key});
  final Map<String, dynamic> user;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    final name = text(user['name']) ?? tr('Гравець');
    final mutual = intOf(user['mutual']);
    final subtitle = mutual > 0 ? '$mutual ${plural(mutual, 'спільний друг', 'спільні друзі', 'спільних друзів')}' : (text(user['city']) ?? '@${user['username']}');
    return Glass(
      padding: const EdgeInsets.fromLTRB(10, 18, 10, 14),
      onTap: () => context.push('/u/${user['username']}'),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Avatar(url: text(user['avatar_url']), name: name, size: 76, online: user['is_online'] == true),
          const SizedBox(height: 12),
          Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: body(14.5, weight: FontWeight.w700)),
          const SizedBox(height: 3),
          Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
          const SizedBox(height: 12),
          FriendAction(username: '${user['username']}', relation: text(user['relation']) ?? 'none', compact: true, onChanged: onChanged),
        ],
      ),
    );
  }
}

/// Дві колонки карток без вкладеного скролу.
class TwoColumns extends StatelessWidget {
  const TwoColumns({required this.children, super.key});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += 2) {
      rows.add(Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: children[i]),
              const SizedBox(width: 10),
              Expanded(child: i + 1 < children.length ? children[i + 1] : const SizedBox.shrink()),
            ],
          ),
        ),
      ));
    }
    return Column(children: rows);
  }
}

// ───────────────────────── Друзі ─────────────────────────

class FriendsScreen extends StatefulWidget {
  const FriendsScreen({this.tab = 'all', super.key});
  final String tab;

  @override
  State<FriendsScreen> createState() => _FriendsScreenState();
}

class _FriendsScreenState extends State<FriendsScreen> {
  late String tab = widget.tab;
  final query = TextEditingController();
  final users = <Map<String, dynamic>>[];
  Map<String, dynamic> counts = {};
  List<Map<String, dynamic>> suggestions = [];
  int page = 0;
  bool more = false;
  bool loading = true;
  Timer? debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _load(reset: true);
      _suggest();
    });
  }

  @override
  void dispose() {
    query.dispose();
    debounce?.cancel();
    super.dispose();
  }

  Api get api => AppScope.read(context).session.api;

  Future<void> _load({bool reset = false}) async {
    if (reset) {
      setState(() => loading = true);
      page = 0;
    }
    try {
      final data = await api.get('/api/v1/friends?tab=$tab&page=${page + 1}&q=${Uri.encodeQueryComponent(query.text.trim())}');
      final listing = Listing.parse(data['users']);
      if (!mounted) return;
      setState(() {
        if (reset) users.clear();
        users.addAll(listing.items);
        counts = mapOf(data['counts']);
        page = listing.current;
        more = listing.more;
      });
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _suggest() async {
    try {
      final data = await api.get('/api/v1/feed?tab=friends&page=1');
      if (mounted) setState(() => suggestions = maps(data['suggestions']));
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final empty = switch (tab) {
      'online' => (tr('Зараз ніхто не в мережі'), LucideIcons.radioOff),
      'requests' => (tr('Нових заявок немає'), LucideIcons.inbox),
      'outgoing' => (tr('Ви нікому не надсилали заявок'), LucideIcons.send),
      _ => (query.text.isEmpty ? tr('У вас поки немає друзів') : tr('Нікого не знайдено'), LucideIcons.usersRound),
    };
    return ScreenScroll(
      onRefresh: () => _load(reset: true),
      children: [
        Glass(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              Segmented(
                scroll: true,
                options: [
                  SegmentOption('all', tr('Усі друзі'), icon: LucideIcons.usersRound, count: counts['all']),
                  SegmentOption('online', tr('Онлайн'), icon: LucideIcons.radio, count: counts['online']),
                  SegmentOption('requests', tr('Заявки'), icon: LucideIcons.inbox, count: intOf(counts['requests']) > 0 ? counts['requests'] : null),
                  SegmentOption('outgoing', tr('Надіслані'), icon: LucideIcons.send, count: intOf(counts['outgoing']) > 0 ? counts['outgoing'] : null),
                ],
                selected: tab,
                onSelect: (value) {
                  setState(() => tab = value);
                  _load(reset: true);
                },
              ),
              const SizedBox(height: 10),
              GcField(
                controller: query,
                label: tr('Пошук серед друзів'),
                icon: LucideIcons.search,
                dense: true,
                onChanged: (_) {
                  debounce?.cancel();
                  debounce = Timer(const Duration(milliseconds: 350), () => _load(reset: true));
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (loading && users.isEmpty)
          const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator(strokeWidth: 2.4)))
        else if (users.isEmpty)
          EmptyState(
            icon: empty.$2,
            title: empty.$1,
            text: tab == 'all' ? tr('Знайдіть знайомих гравців через пошук людей.') : null,
            action: tab == 'all' ? tr('Знайти людей') : null,
            actionIcon: LucideIcons.userRoundSearch,
            onAction: () => context.push('/people'),
          )
        else ...[
          TwoColumns(children: [
            for (final user in users)
              PersonCard(
                key: ValueKey('friend-${user['id']}'),
                user: user,
                onChanged: (_) => _load(reset: true),
              ),
          ]),
          LoadMore(more: more && !loading, onMore: _load),
        ],
        const SizedBox(height: 4),
        Glass(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CardTitle(tr('Можливо, ви знайомі'), icon: LucideIcons.sparkles, trailing: tr('Усі'), onTrailing: () => context.push('/people')),
              const SizedBox(height: 6),
              if (suggestions.isEmpty)
                Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(tr('Рекомендацій поки немає.'), style: body(13, color: muted)))
              else
                for (final user in suggestions)
                  UserTile(
                    user: user,
                    subtitle: intOf(user['mutual']) > 0 ? '${user['mutual']} ${plural(intOf(user['mutual']), 'спільний друг', 'спільні друзі', 'спільних друзів')}' : null,
                    trailing: FriendAction(username: '${user['username']}', relation: 'none', compact: true),
                  ),
            ],
          ),
        ),
      ],
    );
  }
}

// ───────────────────────── Пошук людей ─────────────────────────

class PeopleScreen extends StatefulWidget {
  const PeopleScreen({this.initial = '', super.key});
  final String initial;

  @override
  State<PeopleScreen> createState() => _PeopleScreenState();
}

class _PeopleScreenState extends State<PeopleScreen> {
  late final query = TextEditingController(text: widget.initial);
  final city = TextEditingController();
  String gender = '';
  bool online = false;
  final users = <Map<String, dynamic>>[];
  int total = 0;
  int page = 0;
  bool more = false;
  bool loading = true;
  Timer? debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load(reset: true));
  }

  @override
  void dispose() {
    query.dispose();
    city.dispose();
    debounce?.cancel();
    super.dispose();
  }

  void _later() {
    debounce?.cancel();
    debounce = Timer(const Duration(milliseconds: 350), () => _load(reset: true));
  }

  Future<void> _load({bool reset = false}) async {
    final api = AppScope.read(context).session.api;
    if (reset) {
      setState(() => loading = true);
      page = 0;
    }
    final params = Uri(queryParameters: {
      'q': query.text.trim(),
      'city': city.text.trim(),
      if (gender.isNotEmpty) 'gender': gender,
      if (online) 'online': '1',
      'page': '${page + 1}',
    }).query;
    try {
      final listing = Listing.parse((await api.get('/api/v1/people?$params'))['users']);
      if (!mounted) return;
      setState(() {
        if (reset) users.clear();
        users.addAll(listing.items);
        total = listing.total;
        page = listing.current;
        more = listing.more;
      });
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScroll(
      onRefresh: () => _load(reset: true),
      children: [
        HeroCard(
          title: tr('Знайдіть'),
          accent: tr('своїх'),
          after: tr('людей'),
          text: loading && users.isEmpty ? tr('Шукаємо…') : tr('{total} {v} за вашим запитом', {'total': total, 'v': plural(total, 'людина', 'людини', 'людей')}),
          children: [
            GcField(controller: query, label: tr('Ім’я, прізвище або нікнейм'), icon: LucideIcons.search, dense: true, onChanged: (_) => _later()),
            SizedBox(height: 10),
            GcField(controller: city, label: tr('Місто'), icon: LucideIcons.mapPin, dense: true, onChanged: (_) => _later()),
            SizedBox(height: 10),
            Segmented(
              options: [SegmentOption('', tr('Усі')), SegmentOption('male', tr('Чоловіки')), SegmentOption('female', tr('Жінки'))],
              selected: gender,
              onSelect: (value) {
                setState(() => gender = value);
                _load(reset: true);
              },
            ),
            const SizedBox(height: 10),
            Material(
              color: fg.withValues(alpha: 0.04),
              borderRadius: BorderRadius.circular(14),
              child: SwitchListTile(
                value: online,
                dense: true,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                secondary: Icon(LucideIcons.radio, color: muted, size: 20),
                title: Text(tr('Зараз онлайн'), style: body(14, color: soft)),
                onChanged: (value) {
                  setState(() => online = value);
                  _load(reset: true);
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (loading && users.isEmpty)
          const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator(strokeWidth: 2.4)))
        else if (users.isEmpty)
          EmptyState(icon: LucideIcons.userRoundSearch, title: tr('Нікого не знайдено'), text: tr('Спробуйте змінити запит або фільтри.'))
        else ...[
          TwoColumns(children: [for (final user in users) PersonCard(key: ValueKey('person-${user['id']}'), user: user)]),
          LoadMore(more: more && !loading, onMore: _load),
        ],
      ],
    );
  }
}

// ───────────────────────── Профіль ─────────────────────────

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({this.username, super.key});

  /// `null` — власна сторінка.
  final String? username;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? page;
  Object? error;
  late PostPager pager;
  bool uploading = false;

  String get name => widget.username ?? AppScope.read(context).session.username ?? '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      pager = PostPager((p) => AppScope.read(context).session.api.get('/api/v1/users/$name?page=$p'));
      _load();
    });
  }

  @override
  void didUpdateWidget(ProfileScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.username != widget.username) {
      pager = PostPager((p) => AppScope.read(context).session.api.get('/api/v1/users/$name?page=$p'));
      setState(() => page = null);
      _load();
    }
  }

  Future<void> _load() async {
    final api = AppScope.read(context).session.api;
    try {
      final results = await Future.wait([api.get(Api.site('/u/$name')), pager.reset()]);
      if (!mounted) return;
      setState(() {
        page = results[0] as Map<String, dynamic>;
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  Future<void> _more() async {
    try {
      if (await pager.next() && mounted) setState(() {});
    } catch (_) {}
  }

  Future<void> _upload(String field) async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 90, maxWidth: field == 'cover' ? 2400 : 1200);
    if (picked == null || !mounted) return;
    final session = AppScope.read(context).session;
    setState(() => uploading = true);
    try {
      final file = await http.MultipartFile.fromPath(field, picked.path, filename: picked.name);
      await session.api.upload(Api.site(field == 'cover' ? '/me/cover' : '/me/avatar'), {}, [file]);
      await session.refreshMe();
      await _load();
      if (mounted) toast(context, field == 'cover' ? tr('Обкладинку оновлено.') : tr('Фото профілю оновлено.'));
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => uploading = false);
    }
  }

  Future<void> _avatarMenu(bool hasAvatar) async {
    final choice = await showGcSheet<String>(
      context,
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          SheetAction(icon: LucideIcons.camera, label: tr('Завантажити нове фото'), onTap: () => Navigator.pop(sheet, 'upload')),
          if (hasAvatar) SheetAction(icon: LucideIcons.trash2, label: tr('Видалити фото'), color: dangerSoft, onTap: () => Navigator.pop(sheet, 'delete')),
        ]),
      ),
    );
    if (!mounted) return;
    if (choice == 'upload') return _upload('avatar');
    if (choice == 'delete') {
      final session = AppScope.read(context).session;
      if (await attempt(context, () => session.api.delete(Api.site('/me/avatar')))) {
        await session.refreshMe();
        await _load();
      }
    }
  }

  Future<void> _message() async {
    final api = AppScope.read(context).session.api;
    try {
      final chat = await api.post('/api/v1/messages/with/$name');
      if (mounted) context.push('/messages/${chat['id']}');
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (error != null && page == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: EmptyState(icon: LucideIcons.userRoundX, title: tr('Профіль недоступний'), text: '$error', action: tr('Спробувати знову'), onAction: _load),
        ),
      );
    }
    final data = page;
    if (data == null) return const Center(child: CircularProgressIndicator(strokeWidth: 2.4));

    final profile = mapOf(data['profile']);
    final relation = text(data['relation']) ?? 'none';
    final self = relation == 'self';
    final stats = mapOf(data['stats']);
    final friends = maps(data['friends']);
    final photos = maps(data['photos']);
    final audio = data['audio'] is Map ? mapOf(data['audio']) : null;
    final open = data['canSeeContent'] != false;
    final fullName = text(profile['name']) ?? name;
    final plus = PlusMark.of(profile);
    final headerFx = plus == null ? null : text(profile['header_fx']);
    final headerColors = plusHeaderColors(profile);

    return ScreenScroll(
      onRefresh: _load,
      children: [
        Glass(
          padding: EdgeInsets.zero,
          radius: 26,
          overlay: headerFx == 'rim' ? PlusHeaderGlow(effect: 'rim', colors: headerColors) : null,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                height: 230,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned.fill(
                      bottom: 70,
                      child: ClipRRect(
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
                        child: text(profile['cover_url']) != null
                            ? NetImage(text(profile['cover_url']))
                            : Container(
                                decoration: const BoxDecoration(
                                  gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF26306B), Color(0xFF4B2A7E), Color(0xFF151A30)]),
                                ),
                              ),
                      ),
                    ),
                    if (headerFx == 'aurora')
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 70,
                        height: 107,
                        child: PlusHeaderGlow(effect: 'aurora', colors: headerColors),
                      ),
                    if (self)
                      Positioned(
                        top: 12,
                        right: 12,
                        child: Material(
                          color: Colors.black.withValues(alpha: 0.45),
                          borderRadius: BorderRadius.circular(12),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: uploading ? null : () => _upload('cover'),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              child: Row(mainAxisSize: MainAxisSize.min, children: [
                                const Icon(LucideIcons.camera, size: 16),
                                const SizedBox(width: 6),
                                Text(tr('Змінити обкладинку'), style: body(12.5, weight: FontWeight.w600)),
                              ]),
                            ),
                          ),
                        ),
                      ),
                    Positioned(
                      left: 18,
                      bottom: 0,
                      child: GestureDetector(
                        onTap: self ? () => _avatarMenu(text(profile['avatar_url']) != null) : null,
                        child: Stack(
                          children: [
                            Avatar(url: text(profile['avatar_url']), name: fullName, size: 128, ring: true, online: profile['is_online'] == true, frame: plus?.frame),
                            if (uploading) const Positioned.fill(child: Center(child: CircularProgressIndicator(strokeWidth: 2.4))),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Flexible(child: PlusName(fullName, plus: plus, style: display(24), animate: true, maxLines: 2)),
                      if (profile['is_verified'] == true) ...[const SizedBox(width: 6), Icon(LucideIcons.badgeCheck, color: primary, size: 20)],
                      if (plus != null) ...[const SizedBox(width: 6), const PlusBadge(size: 20)],
                    ]),
                    if (text(profile['status']) != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(text(profile['status'])!, style: body(14, color: soft))),
                    if (profile['playing'] is Map) Padding(padding: const EdgeInsets.only(top: 8), child: PlayingBadge(mapOf(profile['playing']))),
                    if (data['stream'] is Map) Padding(padding: const EdgeInsets.only(top: 8), child: StreamBadge(mapOf(data['stream']))),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        if (profile['role'] == 'admin') Pill(label: tr('Адміністратор'), icon: LucideIcons.shield, color: gold),
                        if (profile['role'] == 'moderator') Pill(label: tr('Модератор'), icon: LucideIcons.shield, color: cyan),
                        // Лише інформація про перевагу — без цін і посилань на оплату (правила Google Play).
                        if (plus != null) GestureDetector(onTap: () => showProFeatures(context), child: Pill(label: 'GameCon+', icon: LucideIcons.sparkles, color: primary)),
                        _Presence(profile: profile),
                      ],
                    ),
                    const SizedBox(height: 16),
                    if (self)
                      GhostButton(label: tr('Редагувати профіль'), icon: LucideIcons.pencil, expand: false, compact: true, onPressed: () => context.push('/settings'))
                    else
                      Wrap(spacing: 10, runSpacing: 10, children: [
                        FriendAction(username: name, relation: relation, compact: true, onChanged: (_) => _load()),
                        if (data['canMessage'] == true) GhostButton(label: tr('Написати'), icon: LucideIcons.messageCircle, compact: true, expand: false, onPressed: _message),
                        GhostButton(label: tr('Поскаржитися'), icon: LucideIcons.flag, compact: true, expand: false, color: muted, onPressed: () => showReportSheet(context, name, text(profile['name']) ?? name)),
                      ]),
                    const SizedBox(height: 16),
                    Divider(color: line, height: 1),
                    const SizedBox(height: 14),
                    if (open) ..._facts(profile),
                    _Fact(icon: LucideIcons.calendar, label: tr('В GameCon з {v}', {'v': fullDate(profile['joined_at'])})),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(child: StatColumn(compact(stats['friends']), plural(intOf(stats['friends']), 'друг', 'друзі', 'друзів'), onTap: self ? () => context.push('/friends') : null)),
                        Expanded(child: StatColumn(compact(stats['posts']), plural(intOf(stats['posts']), 'запис', 'записи', 'записів'))),
                        Expanded(child: StatColumn(compact(stats['photos']), tr('фото'), onTap: () => context.push('/photos?user=$name'))),
                        Expanded(child: StatColumn(compact(audio?['tracks'] ?? 0), tr('аудіо'), onTap: audio == null ? null : () => context.push('/music?user=$name'))),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (!open) ...[
          const SizedBox(height: 12),
          EmptyState(icon: LucideIcons.lock, title: tr('Закритий профіль'), text: tr('Додайте гравця в друзі, щоб бачити його записи, фото й музику.')),
        ],
        if (open && audio != null) ...[
          const SizedBox(height: 12),
          Glass(
            padding: const EdgeInsets.all(14),
            onTap: () => context.push(self ? '/music' : '/music?user=$name'),
            child: Row(children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(gradient: buttonGradient, borderRadius: BorderRadius.circular(14)),
                child: const Icon(LucideIcons.music, color: Colors.white),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(tr('Аудіозаписи'), style: body(15, weight: FontWeight.w700)),
                  Text('${audio['tracks']} ${plural(intOf(audio['tracks']), 'трек', 'треки', 'треків')}', style: body(12.5, color: muted)),
                ]),
              ),
              Text(tr('Слухати →'), style: body(13, color: muted)),
            ]),
          ),
        ],
        if (data['achievements'] is Map) ...[
          const SizedBox(height: 12),
          AchievementsPanel(data: mapOf(data['achievements']), isSelf: data['relation'] == 'self'),
        ],
        if (maps(data['characters']).isNotEmpty || data['relation'] == 'self') ...[
          const SizedBox(height: 12),
          CharactersPanel(characters: maps(data['characters']), createPath: data['relation'] == 'self' ? '/characters/create' : null),
        ],
        if (open && photos.isNotEmpty) ...[
          const SizedBox(height: 12),
          Glass(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              CardTitle(tr('Фотографії'), icon: LucideIcons.images, trailing: '${stats['photos']}', onTrailing: () => context.push('/photos?user=$name')),
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 4,
                crossAxisSpacing: 4,
                children: [
                  for (var i = 0; i < photos.length; i++)
                    GestureDetector(
                      onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                        fullscreenDialog: true,
                        builder: (_) => PhotoViewer(urls: [for (final p in photos) absolute(p['url'])!], initial: i),
                      )),
                      child: NetImage(text(photos[i]['url']), radius: 10),
                    ),
                ],
              ),
            ]),
          ),
        ],
        if (open && friends.isNotEmpty) ...[
          const SizedBox(height: 12),
          Glass(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              CardTitle(
                tr('Друзі'),
                icon: LucideIcons.usersRound,
                trailing: !self && intOf(stats['mutual']) > 0 ? '${stats['mutual']} ${plural(intOf(stats['mutual']), 'спільний', 'спільні', 'спільних')}' : '${stats['friends']}',
                onTrailing: self ? () => context.push('/friends') : null,
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 14,
                runSpacing: 12,
                children: [
                  for (final friend in friends)
                    GestureDetector(
                      onTap: () => context.push('/u/${friend['username']}'),
                      child: SizedBox(
                        width: 62,
                        child: Column(children: [
                          Avatar(url: text(friend['avatar_url']), name: text(friend['name']) ?? '?', size: 54, online: friend['is_online'] == true),
                          const SizedBox(height: 6),
                          Text(text(friend['first_name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: soft)),
                        ]),
                      ),
                    ),
                ],
              ),
            ]),
          ),
        ],
        if (data['canPost'] == true) ...[
          const SizedBox(height: 12),
          Composer(wall: self ? null : name, wallName: text(profile['first_name']), onPosted: _load),
        ],
        const SizedBox(height: 12),
        if (open && pager.posts.isEmpty)
          EmptyState(
            icon: LucideIcons.pencil,
            title: tr('На стіні поки порожньо'),
            text: self ? tr('Розкажіть світу щось цікаве — перший запис завжди найкращий.') : tr('{v} ще нічого не публікував(-ла).', {'v': text(profile['first_name']) ?? 'Гравець'}),
          )
        else if (open) ...[
          for (final post in pager.posts) PostCard(key: ValueKey('wall-${post['id']}'), post: post, onDeleted: () => pager.posts.remove(post)),
          LoadMore(more: pager.more, onMore: _more),
        ],
      ],
    );
  }

  List<Widget> _facts(Map<String, dynamic> profile) {
    final website = text(profile['website']);
    final birthday = text(profile['birthday']);
    return [
      if (text(profile['about']) != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(text(profile['about'])!, style: body(14, color: soft).copyWith(height: 1.5))),
      if (text(profile['city']) != null) _Fact(icon: LucideIcons.mapPin, label: text(profile['city'])!),
      if (birthday != null) _Fact(icon: LucideIcons.cake, label: _birthday(birthday)),
      if (website != null) _Fact(icon: LucideIcons.link, label: website.replaceFirst(RegExp(r'^https?://'), ''), onTap: () => launchUrl(Uri.parse(website), mode: LaunchMode.externalApplication)),
    ];
  }

  String _birthday(String iso) {
    final date = DateTime.tryParse(iso);
    if (date == null) return iso;
    return tr('{day} {v} {year} р.', {'day': date.day, 'v': monthsGenitive[date.month - 1], 'year': date.year});
  }
}

class _Presence extends StatelessWidget {
  const _Presence({required this.profile});
  final Map<String, dynamic> profile;

  @override
  Widget build(BuildContext context) {
    final online = profile['is_online'] == true;
    final seen = text(profile['last_seen_at']);
    final female = profile['gender'] == 'female';
    final male = profile['gender'] == 'male';
    final was = female ? tr('була') : (male ? tr('був') : tr('був(-ла)'));
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Container(width: 8, height: 8, decoration: BoxDecoration(color: online ? green : faint, shape: BoxShape.circle)),
      const SizedBox(width: 6),
      Text(online ? tr('онлайн') : (seen == null ? tr('не в мережі') : tr('{was} в мережі {v}', {'was': was, 'v': ago(seen)})), style: body(12.5, color: muted)),
    ]);
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.label, this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GestureDetector(
        onTap: onTap,
        child: Row(children: [
          Icon(icon, size: 16, color: muted),
          const SizedBox(width: 10),
          Expanded(child: Text(label, style: body(13.5, color: onTap != null ? const Color(0xFF9AA8FF) : soft))),
        ]),
      ),
    );
  }
}
