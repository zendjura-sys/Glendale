import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'feed.dart';
import 'posts.dart';
import 'state.dart';
import 'theme.dart';
import 'voice_room.dart';
import 'widgets.dart';
import 'i18n.dart';

final communityRoles = {'owner': tr('Власник'), 'admin': tr('Адміністратор'), 'editor': tr('Редактор'), 'member': tr('Учасник')};

String communityKind(Map<String, dynamic> c) => c['type'] == 'public' ? tr('Публічна сторінка') : (c['privacy'] == 'closed' ? tr('Закрита група') : tr('Відкрита група'));

String membersLabel(Map<String, dynamic> c, int n) =>
    c['type'] == 'public' ? plural(n, 'підписник', 'підписники', 'підписників') : plural(n, 'учасник', 'учасники', 'учасників');

// ───────────────────────── Каталог ─────────────────────────

class CommunitiesScreen extends StatefulWidget {
  const CommunitiesScreen({super.key});

  @override
  State<CommunitiesScreen> createState() => _CommunitiesScreenState();
}

class _CommunitiesScreenState extends State<CommunitiesScreen> {
  String? tab;
  String category = '';
  final query = TextEditingController();
  Map<String, dynamic> page = {};
  final items = <Map<String, dynamic>>[];
  int current = 0;
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
    debounce?.cancel();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    final api = AppScope.read(context).session.api;
    if (reset) {
      setState(() => loading = true);
      current = 0;
    }
    final params = Uri(queryParameters: {
      'tab': ?tab,
      if (query.text.trim().isNotEmpty) 'q': query.text.trim(),
      if (category.isNotEmpty) 'category': category,
      'page': '${current + 1}',
    }).query;
    try {
      final data = await api.get(Api.site('/communities?$params'));
      final listing = Listing.parse(data['communities']);
      if (!mounted) return;
      setState(() {
        page = data;
        tab = text(data['tab']) ?? tab;
        if (reset) items.clear();
        items.addAll(listing.items);
        current = listing.current;
        more = listing.more;
      });
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _create() async {
    final slug = await showGcSheet<String>(context, title: tr('Нова спільнота'), builder: (sheet) => _CreateCommunity(onCreated: (slug) => Navigator.pop(sheet, slug)));
    if (slug != null && mounted) context.push('/communities/$slug');
  }

  @override
  Widget build(BuildContext context) {
    final categories = mapOf(page['categories']);
    final counts = mapOf(page['counts']);
    final empty = switch (tab) {
      'mine' => (tr('Ви ще не вступили до жодної спільноти'), tr('Знайдіть цікаві спільноти в огляді або створіть свою.'), true),
      'managed' => (tr('Ви поки нічим не керуєте'), tr('Знайдіть цікаві спільноти в огляді або створіть свою.'), true),
      _ => (tr('Нічого не знайдено'), tr('Спробуйте інший запит або створіть власну спільноту.'), false),
    };
    return ScreenScroll(
      onRefresh: () => _load(reset: true),
      children: [
        HeroCard(
          title: '',
          accent: tr('Спільноти'),
          after: tr('за інтересами'),
          text: tr('Клани, фандоми, команди та сторінки улюблених ігор — усе в одному місці.'),
          children: [
            PrimaryButton(label: tr('Створити спільноту'), icon: LucideIcons.plus, expand: false, onPressed: _create),
            const SizedBox(height: 14),
            Segmented(
              options: [
                SegmentOption('mine', tr('Мої спільноти'), icon: LucideIcons.userRoundCheck, count: intOf(counts['mine']) > 0 ? counts['mine'] : null),
                SegmentOption('managed', tr('Керую'), icon: LucideIcons.crown, count: intOf(counts['managed']) > 0 ? counts['managed'] : null),
                SegmentOption('discover', tr('Огляд'), icon: LucideIcons.compass),
              ],
              selected: tab ?? 'discover',
              onSelect: (value) {
                setState(() => tab = value);
                _load(reset: true);
              },
            ),
            const SizedBox(height: 10),
            GcField(
              controller: query,
              label: tr('Назва або адреса спільноти'),
              icon: LucideIcons.search,
              dense: true,
              onChanged: (_) {
                debounce?.cancel();
                debounce = Timer(const Duration(milliseconds: 350), () => _load(reset: true));
              },
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: 36,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  for (final entry in [MapEntry('', tr('Усі тематики')), ...categories.entries])
                    Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: SelectPill(
                        label: '${entry.value}',
                        selected: category == entry.key,
                        onTap: () {
                          setState(() => category = entry.key);
                          _load(reset: true);
                        },
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (loading && items.isEmpty)
          const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator(strokeWidth: 2.4)))
        else if (items.isEmpty)
          EmptyState(
            icon: LucideIcons.searchX,
            title: empty.$1,
            text: empty.$2,
            action: empty.$3 ? tr('Перейти до огляду') : tr('Створити спільноту'),
            onAction: empty.$3
                ? () {
                    setState(() => tab = 'discover');
                    _load(reset: true);
                  }
                : _create,
          )
        else ...[
          for (final community in items) Padding(padding: const EdgeInsets.only(bottom: 10), child: CommunityCard(community: community, onChanged: () => _load(reset: true))),
          LoadMore(more: more && !loading, onMore: _load),
        ],
      ],
    );
  }
}

class CommunityCard extends StatelessWidget {
  const CommunityCard({required this.community, this.onChanged, super.key});
  final Map<String, dynamic> community;
  final VoidCallback? onChanged;

  @override
  Widget build(BuildContext context) {
    final members = intOf(community['members_count']);
    return Glass(
      padding: const EdgeInsets.all(14),
      onTap: () => context.push('/communities/${community['slug']}'),
      child: Row(
        children: [
          Avatar(url: text(community['avatar_url']), name: text(community['name']) ?? '?', size: 58, square: true),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Flexible(child: Text(text(community['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(15, weight: FontWeight.w700))),
                  if (community['is_verified'] == true) ...[const SizedBox(width: 4), const Icon(LucideIcons.badgeCheck, size: 15, color: primary)],
                ]),
                const SizedBox(height: 2),
                Text([text(community['category_label']), communityKind(community)].whereType<String>().join(' · '), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
                const SizedBox(height: 2),
                Text('${compact(members)} ${membersLabel(community, members)}', style: body(12, color: faint)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          JoinButton(community: community, compact: true, onChanged: (_) => onChanged?.call()),
        ],
      ),
    );
  }
}

/// Вступити / Підписатися / Подати заявку — як JoinButton сайту.
class JoinButton extends StatefulWidget {
  const JoinButton({required this.community, this.compact = false, this.onChanged, super.key});
  final Map<String, dynamic> community;
  final bool compact;
  final ValueChanged<String?>? onChanged;

  @override
  State<JoinButton> createState() => _JoinButtonState();
}

class _JoinButtonState extends State<JoinButton> {
  late String? status = _status(widget.community);
  bool busy = false;

  static String? _status(Map<String, dynamic> c) {
    final m = c['membership'];
    if (m is Map) return text(m['status']);
    return text(m);
  }

  @override
  void didUpdateWidget(JoinButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    status = _status(widget.community);
  }

  Future<void> _toggle() async {
    final api = AppScope.read(context).session.api;
    final slug = widget.community['slug'];
    final public = widget.community['type'] == 'public';
    if (status == 'active' && !await confirm(context, public ? tr('Відписатися?') : tr('Вийти зі спільноти?'), action: public ? tr('Відписатися') : tr('Вийти'), danger: true)) return;
    setState(() => busy = true);
    try {
      final data = status == null ? await api.post('/api/v1/communities/$slug/join') : await api.delete('/api/v1/communities/$slug/join');
      final next = text(data['membership']);
      if (mounted) setState(() => status = next);
      widget.onChanged?.call(next);
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.community;
    final public = c['type'] == 'public';
    final role = c['membership'] is Map ? text(mapOf(c['membership'])['role']) : null;
    if (role == 'owner' || c['managed'] == true && status == 'active') {
      return Pill(label: role == 'owner' ? tr('Власник') : tr('Керуєте'), icon: LucideIcons.crown, color: gold);
    }
    return switch (status) {
      'active' => GhostButton(label: public ? tr('Ви підписані') : tr('Ви учасник'), icon: LucideIcons.check, compact: true, expand: false, onPressed: busy ? null : _toggle),
      'pending' => GhostButton(label: tr('Заявку надіслано'), icon: LucideIcons.clock, compact: true, expand: false, color: muted, onPressed: busy ? null : _toggle),
      _ => PrimaryButton(label: public ? tr('Підписатися') : (c['privacy'] == 'closed' ? tr('Подати заявку') : tr('Вступити')), compact: true, expand: false, busy: busy, onPressed: _toggle),
    };
  }
}

class _CreateCommunity extends StatefulWidget {
  const _CreateCommunity({required this.onCreated});
  final ValueChanged<String> onCreated;

  @override
  State<_CreateCommunity> createState() => _CreateCommunityState();
}

class _CreateCommunityState extends State<_CreateCommunity> {
  final name = TextEditingController();
  String type = 'group';
  String privacy = 'open';
  String category = 'games';
  Map<String, dynamic> categories = {};
  bool busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final data = await AppScope.read(context).session.api.get('/api/v1/communities?tab=discover');
        if (mounted) setState(() => categories = mapOf(data['categories']));
      } catch (_) {}
    });
  }

  @override
  void dispose() {
    name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => busy = true);
    try {
      final data = await AppScope.read(context).session.api.post('/api/v1/communities', {'name': name.text.trim(), 'type': type, 'category': category, 'privacy': type == 'public' ? 'open' : privacy});
      widget.onCreated('${mapOf(data['community'])['slug']}');
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _TypeOption(selected: type == 'group', icon: LucideIcons.usersRound, title: tr('Група'), text: tr('Спілкування й обговорення: учасники пишуть на стіні.'), onTap: () => setState(() => type = 'group')),
          const SizedBox(height: 8),
          _TypeOption(selected: type == 'public', icon: LucideIcons.megaphone, title: tr('Публічна сторінка'), text: tr('Новини від імені сторінки для підписників.'), onTap: () => setState(() => type = 'public')),
          const SizedBox(height: 14),
          LabeledField(label: tr('Назва'), child: GcField(controller: name, label: tr('Наприклад, «Кіберкотлета UA»'), onChanged: (_) => setState(() {}))),
          const SizedBox(height: 12),
          LabeledField(
            label: tr('Тематика'),
            child: GcSelect<String>(
              value: categories.containsKey(category) ? category : null,
              expand: true,
              items: [for (final e in categories.entries) (e.key, '${e.value}')],
              onChanged: (value) => setState(() => category = value ?? category),
            ),
          ),
          if (type == 'group') ...[
            SizedBox(height: 12),
            Segmented(
              options: [SegmentOption('open', tr('Відкрита'), icon: LucideIcons.lockOpen), SegmentOption('closed', tr('Закрита'), icon: LucideIcons.lock)],
              selected: privacy,
              onSelect: (value) => setState(() => privacy = value),
            ),
          ],
          const SizedBox(height: 18),
          PrimaryButton(label: tr('Створити спільноту'), busy: busy, onPressed: name.text.trim().length >= 3 ? _submit : null),
        ],
      ),
    );
  }
}

class _TypeOption extends StatelessWidget {
  const _TypeOption({required this.selected, required this.icon, required this.title, required this.text, required this.onTap});
  final bool selected;
  final IconData icon;
  final String title;
  final String text;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? primary.withValues(alpha: 0.12) : Colors.white.withValues(alpha: 0.04),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: selected ? primary.withValues(alpha: 0.6) : line)),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Icon(icon, color: selected ? const Color(0xFF9AA6FF) : muted),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: body(14.5, weight: FontWeight.w700)),
                Text(text, style: body(12.5, color: muted)),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

// ───────────────────────── Сторінка спільноти ─────────────────────────

class CommunityScreen extends StatefulWidget {
  const CommunityScreen({required this.slug, super.key});
  final String slug;

  @override
  State<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends State<CommunityScreen> {
  Map<String, dynamic>? page;
  Object? error;
  late final pager = PostPager((p) => AppScope.read(context).session.api.get('/api/v1/communities/${widget.slug}?page=$p'));

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  /// Правила чи довідник спільноти: розділи за рядками «# Заголовок».
  Future<void> _showPage(BuildContext context, String kind) async {
    final api = AppScope.read(context).session.api;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheet) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.85,
        maxChildSize: 0.95,
        builder: (sheet, controller) => FutureBuilder<Map<String, dynamic>>(
          future: api.get(Api.site('/c/${widget.slug}/$kind')),
          builder: (sheet, snap) {
            if (!snap.hasData) return const Center(child: CircularProgressIndicator(strokeWidth: 2.4));
            final lines = (text(snap.data!['text']) ?? '').split(RegExp(r'\r?\n'));
            return ListView(controller: controller, padding: const EdgeInsets.fromLTRB(20, 20, 20, 32), children: [
              Text(kind == 'rules' ? tr('Правила') : tr('Довідник'), style: display(20)),
              const SizedBox(height: 14),
              for (final line in lines)
                if (RegExp(r'^#{1,3}\s+').hasMatch(line.trim()))
                  Padding(padding: const EdgeInsets.only(top: 14, bottom: 6), child: Text(line.trim().replaceFirst(RegExp(r'^#{1,3}\s+'), ''), style: display(16)))
                else
                  Text(line, style: body(14.5, color: soft).copyWith(height: 1.5)),
            ]);
          },
        ),
      ),
    );
  }

  Future<void> _load() async {
    final api = AppScope.read(context).session.api;
    try {
      final data = await api.get(Api.site('/c/${widget.slug}'));
      final canView = mapOf(data['can'])['view'] != false;
      if (canView) {
        await pager.reset();
      } else {
        pager.posts.clear();
      }
      if (mounted) {
        setState(() {
          page = data;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  Future<void> _more() async {
    try {
      if (await pager.next() && mounted) setState(() {});
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final data = page;
    if (data == null) {
      return error == null
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2.4))
          : Center(child: Padding(padding: const EdgeInsets.all(20), child: EmptyState(icon: LucideIcons.usersRound, title: tr('Спільнота недоступна'), text: '$error', action: tr('Спробувати знову'), onAction: _load)));
    }
    final c = mapOf(data['community']);
    final can = mapOf(data['can']);
    final stats = mapOf(data['stats']);
    final membership = data['membership'] is Map ? mapOf(data['membership']) : null;
    final members = maps(data['members']);
    final managers = maps(data['managers']);
    final photos = data['photos'] is Map ? mapOf(data['photos']) : null;
    final count = intOf(stats['members']);
    final friends = intOf(stats['friends']);

    return ScreenScroll(
      onRefresh: _load,
      children: [
        Glass(
          padding: EdgeInsets.zero,
          radius: 26,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                height: 200,
                child: Stack(clipBehavior: Clip.none, children: [
                  Positioned.fill(
                    bottom: 50,
                    child: ClipRRect(
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
                      child: text(c['cover_url']) != null
                          ? NetImage(text(c['cover_url']))
                          : Container(decoration: const BoxDecoration(gradient: LinearGradient(colors: [Color(0xFF26306B), Color(0xFF4B2A7E), Color(0xFF151A30)]))),
                    ),
                  ),
                  Positioned(left: 18, bottom: 0, child: Avatar(url: text(c['avatar_url']), name: text(c['name']) ?? '?', size: 96, square: true, ring: true)),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 12, 18, 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Flexible(child: Text(text(c['name']) ?? '', style: display(22))),
                      if (c['is_verified'] == true) ...[const SizedBox(width: 6), const Icon(LucideIcons.badgeCheck, color: primary, size: 20)],
                    ]),
                    if (text(c['status']) != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(text(c['status'])!, style: body(14, color: soft))),
                    const SizedBox(height: 8),
                    Wrap(spacing: 8, runSpacing: 6, children: [
                      Pill(label: communityKind(c), icon: c['privacy'] == 'closed' ? LucideIcons.lock : LucideIcons.globe),
                      if (text(c['category_label']) != null) Pill(label: text(c['category_label'])!),
                      if (membership?['role'] != null && membership?['status'] == 'active') Pill(label: communityRoles[membership!['role']] ?? '', color: gold),
                    ]),
                    const SizedBox(height: 14),
                    Row(children: [
                      Expanded(child: StatColumn(compact(count), membersLabel(c, count), onTap: can['view'] != false ? () => context.push('/communities/${widget.slug}/members') : null)),
                      Expanded(child: StatColumn(compact(stats['posts']), plural(intOf(stats['posts']), 'запис', 'записи', 'записів'))),
                      if (friends > 0) Expanded(child: StatColumn('$friends', plural(friends, 'ваш друг', 'ваші друзі', 'ваших друзів'))),
                    ]),
                    const SizedBox(height: 14),
                    Wrap(spacing: 10, runSpacing: 10, children: [
                      JoinButton(community: {...c, 'membership': membership}, onChanged: (_) => _load()),
                      if (can['manage'] == true)
                        GhostButton(
                          label: intOf(stats['requests']) > 0 ? tr('Керування · {v}', {'v': stats['requests']}) : tr('Керування'),
                          icon: LucideIcons.settings,
                          compact: true,
                          expand: false,
                          onPressed: () async {
                            await context.push('/communities/${widget.slug}/settings');
                            _load();
                          },
                        ),
                    ]),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (can['view'] == false) ...[
          const SizedBox(height: 12),
          EmptyState(icon: LucideIcons.lock, title: tr('Це закрита група'), text: tr('Записи та учасників бачать лише учасники. Подайте заявку — адміністратори розглянуть її найближчим часом.')),
        ] else ...[
          if (membership?['status'] == 'active') ...[
            const SizedBox(height: 12),
            VoiceRoomsPanel(
              key: ValueKey('voice-community-${c['id']}'),
              type: 'community',
              id: intOf(c['id']),
              label: text(c['name']) ?? '',
              route: '/communities/${widget.slug}',
            ),
          ],
          if (mapOf(page?['rules'])['rules'] == true || mapOf(page?['rules'])['handbook'] == true) ...[
            const SizedBox(height: 12),
            Row(children: [
              if (mapOf(page?['rules'])['rules'] == true)
                Expanded(child: GhostButton(label: tr('Правила'), icon: LucideIcons.scrollText, compact: true, onPressed: () => _showPage(context, 'rules'))),
              if (mapOf(page?['rules'])['rules'] == true && mapOf(page?['rules'])['handbook'] == true) const SizedBox(width: 10),
              if (mapOf(page?['rules'])['handbook'] == true)
                Expanded(child: GhostButton(label: tr('Довідник'), icon: LucideIcons.bookOpen, compact: true, onPressed: () => _showPage(context, 'handbook'))),
            ]),
          ],
          if (intOf(page?['my_pending']) > 0) ...[
            const SizedBox(height: 10),
            Text(tr('Ваших записів на перевірці: {count}', {'count': page?['my_pending']}), style: body(12.5, color: gold)),
          ],
          if (text(c['description']) != null || text(c['website']) != null || text(c['city']) != null) ...[
            const SizedBox(height: 12),
            Glass(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                CardTitle(tr('Інформація'), icon: LucideIcons.info),
                const SizedBox(height: 10),
                if (text(c['description']) != null) Text(text(c['description'])!, style: body(14, color: soft).copyWith(height: 1.5)),
                if (text(c['city']) != null) Padding(padding: const EdgeInsets.only(top: 8), child: Row(children: [const Icon(LucideIcons.mapPin, size: 16, color: muted), const SizedBox(width: 8), Text(text(c['city'])!, style: body(13.5, color: soft))])),
                if (text(c['website']) != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: GestureDetector(
                      onTap: () => launchUrl(Uri.parse(text(c['website'])!), mode: LaunchMode.externalApplication),
                      child: Row(children: [const Icon(LucideIcons.link, size: 16, color: muted), const SizedBox(width: 8), Flexible(child: Text(text(c['website'])!.replaceFirst(RegExp(r'^https?://'), ''), style: body(13.5, color: const Color(0xFF9AA8FF))))]),
                    ),
                  ),
              ]),
            ),
          ],
          if (members.isNotEmpty) ...[
            const SizedBox(height: 12),
            Glass(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                CardTitle(c['type'] == 'public' ? tr('Підписники') : tr('Учасники'), icon: LucideIcons.usersRound, trailing: compact(count), onTrailing: () => context.push('/communities/${widget.slug}/members')),
                const SizedBox(height: 12),
                Wrap(spacing: 14, runSpacing: 12, children: [
                  for (final user in members)
                    GestureDetector(
                      onTap: () => context.push('/u/${user['username']}'),
                      child: SizedBox(
                        width: 58,
                        child: Column(children: [
                          Avatar(url: text(user['avatar_url']), name: text(user['name']) ?? '?', size: 50, online: user['is_online'] == true),
                          const SizedBox(height: 6),
                          Text(text(user['first_name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(11.5, color: soft)),
                        ]),
                      ),
                    ),
                ]),
              ]),
            ),
          ],
          if (managers.isNotEmpty) ...[
            const SizedBox(height: 12),
            Glass(
              padding: const EdgeInsets.fromLTRB(12, 14, 12, 8),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(padding: EdgeInsets.only(left: 4), child: CardTitle(tr('Керівники'), icon: LucideIcons.crown)),
                for (final user in managers) UserTile(user: user, subtitle: communityRoles[user['role']] ?? ''),
              ]),
            ),
          ],
          if (photos != null && (intOf(photos['count']) > 0 || photos['can_create'] == true)) ...[
            const SizedBox(height: 12),
            Glass(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                CardTitle(tr('Фотографії'), icon: LucideIcons.images, trailing: intOf(photos['count']) > 0 ? '${photos['count']}' : null, onTrailing: () => context.push('/communities/${widget.slug}/photos')),
                const SizedBox(height: 12),
                if (maps(photos['items']).isEmpty)
                  GhostButton(label: tr('Створити альбом'), icon: LucideIcons.imagePlus, onPressed: () => context.push('/communities/${widget.slug}/photos'))
                else
                  GridView.count(
                    crossAxisCount: 3,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 4,
                    crossAxisSpacing: 4,
                    children: [
                      for (final photo in maps(photos['items']))
                        GestureDetector(onTap: () => context.push(_albumPath(text(photo['href']))), child: NetImage(text(photo['url']), radius: 10)),
                    ],
                  ),
              ]),
            ),
          ],
          if (can['post'] == true) ...[
            const SizedBox(height: 12),
            Composer(
              community: widget.slug,
              communityName: text(c['name']),
              communityAvatar: text(c['avatar_url']),
              canPostAsCommunity: can['post_as_community'] == true,
              onPosted: _load,
            ),
          ],
          const SizedBox(height: 12),
          if (pager.posts.isEmpty)
            EmptyState(
              icon: LucideIcons.messagesSquare,
              title: tr('Тут поки тихо'),
              text: can['post'] == true ? tr('Опублікуйте перший запис — розкажіть, про що ця спільнота.') : tr('Новини з’являться тут, щойно адміністратори щось опублікують.'),
            )
          else ...[
            for (final post in pager.posts) PostCard(key: ValueKey('c-${post['id']}'), post: post, onDeleted: () => pager.posts.remove(post)),
            LoadMore(more: pager.more, onMore: _more),
          ],
        ],
      ],
    );
  }
}

/// `/albums/5?photo=9` → маршрут застосунку.
String _albumPath(String? href) {
  final uri = Uri.tryParse(href ?? '');
  if (uri == null) return '/photos';
  final segments = uri.pathSegments;
  if (segments.length >= 2 && segments.first == 'albums') return '/albums/${segments[1]}${uri.hasQuery ? '?${uri.query}' : ''}';
  if (segments.length >= 2 && segments.first == 'posts') return '/posts/${segments[1]}';
  return '/photos';
}

String albumPathFor(String? href) => _albumPath(href);

// ───────────────────────── Учасники ─────────────────────────

class CommunityMembersScreen extends StatefulWidget {
  const CommunityMembersScreen({required this.slug, this.tab = 'all', super.key});
  final String slug;
  final String tab;

  @override
  State<CommunityMembersScreen> createState() => _CommunityMembersScreenState();
}

class _CommunityMembersScreenState extends State<CommunityMembersScreen> {
  late String tab = widget.tab;
  final query = TextEditingController();
  Map<String, dynamic> page = {};
  final items = <Map<String, dynamic>>[];
  int current = 0;
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
    debounce?.cancel();
    super.dispose();
  }

  Api get api => AppScope.read(context).session.api;

  Future<void> _load({bool reset = false}) async {
    if (reset) {
      setState(() => loading = true);
      current = 0;
    }
    final params = Uri(queryParameters: {'tab': tab, if (query.text.trim().isNotEmpty) 'q': query.text.trim(), 'page': '${current + 1}'}).query;
    try {
      final data = await api.get(Api.site('/c/${widget.slug}/members?$params'));
      final listing = Listing.parse(data['members']);
      if (!mounted) return;
      setState(() {
        page = data;
        if (reset) items.clear();
        items.addAll(listing.items);
        current = listing.current;
        more = listing.more;
      });
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _act(Future<dynamic> Function() action) async {
    if (await attempt(context, action)) _load(reset: true);
  }

  Future<void> _memberMenu(Map<String, dynamic> member) async {
    final myRole = text(mapOf(page['my'])['role']);
    final username = member['username'];
    final choice = await showGcSheet<String>(
      context,
      title: text(member['name']),
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          SheetAction(icon: LucideIcons.userRound, label: tr('Відкрити профіль'), onTap: () => Navigator.pop(sheet, 'profile')),
          for (final role in ['admin', 'editor', 'member'])
            if (role != member['role']) SheetAction(icon: LucideIcons.idCard, label: tr('Зробити: {v}', {'v': communityRoles[role]}), onTap: () => Navigator.pop(sheet, 'role:$role')),
          if (myRole == 'owner') SheetAction(icon: LucideIcons.crown, label: tr('Передати права власника'), color: gold, onTap: () => Navigator.pop(sheet, 'role:owner')),
          SheetAction(icon: LucideIcons.userRoundMinus, label: tr('Видалити зі спільноти'), color: dangerSoft, onTap: () => Navigator.pop(sheet, 'remove')),
        ]),
      ),
    );
    if (choice == null || !mounted) return;
    if (choice == 'profile') {
      context.push('/u/$username');
    } else if (choice == 'remove') {
      if (await confirm(context, tr('Видалити {v}?', {'v': member['name']}), action: tr('Видалити'), danger: true)) await _act(() => api.delete(Api.site('/c/${widget.slug}/members/$username')));
    } else if (choice.startsWith('role:')) {
      final role = choice.substring(5);
      if (role == 'owner' && !await confirm(context, tr('Передати спільноту {v}?', {'v': member['name']}), text: tr('Ви станете адміністратором, а власником — цей учасник.'), action: tr('Передати'), danger: true)) return;
      await _act(() => api.patch(Api.site('/c/${widget.slug}/members/$username'), {'role': role}));
    }
  }

  @override
  Widget build(BuildContext context) {
    final counts = mapOf(page['counts']);
    final admin = page['isAdmin'] == true;
    final community = mapOf(page['community']);
    return ScreenScroll(
      onRefresh: () => _load(reset: true),
      children: [
        Row(children: [
          RoundIcon(icon: LucideIcons.arrowLeft, onTap: () => context.pop()),
          const SizedBox(width: 8),
          Expanded(child: Text(text(community['name']) ?? tr('Учасники'), maxLines: 1, overflow: TextOverflow.ellipsis, style: display(18))),
        ]),
        const SizedBox(height: 12),
        Glass(
          padding: const EdgeInsets.all(12),
          child: Column(children: [
            Segmented(
              scroll: true,
              options: [
                SegmentOption('all', tr('Усі'), count: counts['all']),
                SegmentOption('managers', tr('Керівники'), count: counts['managers']),
                SegmentOption('friends', tr('Друзі'), count: counts['friends']),
                if (admin) SegmentOption('requests', tr('Заявки'), count: intOf(counts['requests']) > 0 ? counts['requests'] : null),
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
              label: tr('Пошук учасників'),
              icon: LucideIcons.search,
              dense: true,
              onChanged: (_) {
                debounce?.cancel();
                debounce = Timer(const Duration(milliseconds: 350), () => _load(reset: true));
              },
            ),
          ]),
        ),
        const SizedBox(height: 12),
        if (loading && items.isEmpty)
          const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator(strokeWidth: 2.4)))
        else if (items.isEmpty)
          QuietEmpty(icon: LucideIcons.usersRound, text: tab == 'requests' ? tr('Нових заявок немає') : tr('Нікого не знайдено'))
        else
          Glass(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
            child: Column(children: [
              for (final member in items)
                UserTile(
                  user: member,
                  subtitle: tab == 'requests' ? tr('Заявка {v}', {'v': ago(member['joined_at'])}) : (communityRoles[member['role']] ?? '') + (member['is_friend'] == true ? tr(' · ваш друг') : ''),
                  trailing: tab == 'requests'
                      ? Row(mainAxisSize: MainAxisSize.min, children: [
                          IconButton(tooltip: tr('Прийняти'), onPressed: () => _act(() => api.post(Api.site('/c/${widget.slug}/members/${member['username']}/approve'))), icon: const Icon(LucideIcons.circleCheck, color: green)),
                          IconButton(tooltip: tr('Відхилити'), onPressed: () => _act(() => api.delete(Api.site('/c/${widget.slug}/members/${member['username']}/request'))), icon: const Icon(LucideIcons.circleX, color: dangerSoft)),
                        ])
                      : admin && member['role'] != 'owner' && intOf(member['id']) != AppScope.of(context).session.myId
                          ? IconButton(onPressed: () => _memberMenu(member), icon: const Icon(LucideIcons.ellipsis, color: muted))
                          : null,
                ),
            ]),
          ),
        LoadMore(more: more && !loading, onMore: _load),
      ],
    );
  }
}

// ───────────────────────── Налаштування ─────────────────────────

class CommunitySettingsScreen extends StatefulWidget {
  const CommunitySettingsScreen({required this.slug, super.key});
  final String slug;

  @override
  State<CommunitySettingsScreen> createState() => _CommunitySettingsScreenState();
}

class _CommunitySettingsScreenState extends State<CommunitySettingsScreen> {
  Map<String, dynamic>? page;
  final name = TextEditingController();
  final slug = TextEditingController();
  final status = TextEditingController();
  final description = TextEditingController();
  final website = TextEditingController();
  final city = TextEditingController();
  String type = 'group';
  String privacy = 'open';
  String wall = 'open';
  String category = 'games';
  bool busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    for (final c in [name, slug, status, description, website, city]) {
      c.dispose();
    }
    super.dispose();
  }

  Api get api => AppScope.read(context).session.api;

  Future<void> _load() async {
    try {
      final data = await api.get(Api.site('/c/${widget.slug}/settings'));
      final c = mapOf(data['community']);
      if (!mounted) return;
      setState(() {
        page = data;
        name.text = text(c['name']) ?? '';
        slug.text = text(c['slug']) ?? '';
        status.text = text(c['status']) ?? '';
        description.text = text(c['description']) ?? '';
        website.text = text(c['website']) ?? '';
        city.text = text(c['city']) ?? '';
        type = text(c['type']) ?? 'group';
        privacy = text(c['privacy']) ?? 'open';
        wall = text(c['wall']) ?? 'open';
        category = text(c['category']) ?? 'games';
      });
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _save() async {
    setState(() => busy = true);
    try {
      final result = await api.patch(Api.site('/c/${widget.slug}/settings'), {
        'name': name.text.trim(),
        'slug': slug.text.trim(),
        'type': type,
        'privacy': type == 'public' ? 'open' : privacy,
        'wall': wall,
        'category': category,
        'status': status.text.trim(),
        'description': description.text.trim(),
        'website': website.text.trim(),
        'city': city.text.trim(),
      });
      if (!mounted) return;
      toast(context, text(result['message']) ?? tr('Збережено.'));
      final redirect = text(result['redirect']);
      final nextSlug = redirect != null && redirect.startsWith('/c/') ? redirect.split('/')[2] : slug.text.trim();
      if (nextSlug != widget.slug) context.go('/communities/$nextSlug');
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _image(String field) async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 90, maxWidth: field == 'cover' ? 2400 : 1000);
    if (picked == null || !mounted) return;
    final file = await http.MultipartFile.fromPath(field, picked.path, filename: picked.name);
    if (!mounted) return;
    if (await attempt(context, () => api.upload(Api.site('/c/${widget.slug}/images/$field'), {}, [file]))) _load();
  }

  Future<void> _delete() async {
    if (!await confirm(context, tr('Видалити спільноту?'), text: tr('Записи, учасники й фото зникнуть назавжди.'), action: tr('Видалити'), danger: true)) return;
    if (!mounted) return;
    if (await attempt(context, () => api.delete(Api.site('/c/${widget.slug}')))) {
      if (mounted) context.go('/communities');
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = page;
    if (data == null) return const Center(child: CircularProgressIndicator(strokeWidth: 2.4));
    final c = mapOf(data['community']);
    final categories = mapOf(data['categories']);
    return ScreenScroll(
      children: [
        Row(children: [
          RoundIcon(icon: LucideIcons.arrowLeft, onTap: () => context.pop()),
          const SizedBox(width: 8),
          Expanded(child: Text(tr('Керування спільнотою'), style: display(18))),
        ]),
        const SizedBox(height: 12),
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            CardTitle(tr('Оформлення'), icon: LucideIcons.palette),
            const SizedBox(height: 12),
            Row(children: [
              Avatar(url: text(c['avatar_url']), name: text(c['name']) ?? '?', size: 64, square: true),
              const SizedBox(width: 12),
              Expanded(
                child: Column(children: [
                  GhostButton(label: tr('Змінити аватар'), icon: LucideIcons.camera, compact: true, onPressed: () => _image('avatar')),
                  const SizedBox(height: 8),
                  GhostButton(label: tr('Змінити обкладинку'), icon: LucideIcons.wallpaper, compact: true, onPressed: () => _image('cover')),
                ]),
              ),
            ]),
          ]),
        ),
        const SizedBox(height: 12),
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CardTitle(tr('Основне'), icon: LucideIcons.slidersHorizontal),
            const SizedBox(height: 12),
            LabeledField(label: tr('Назва'), child: GcField(controller: name, label: tr('Назва'))),
            const SizedBox(height: 10),
            LabeledField(label: tr('Адреса'), hint: 'gamecon.online/c/…', child: GcField(controller: slug, label: 'adresa', prefixText: '/c/')),
            const SizedBox(height: 10),
            LabeledField(label: tr('Статус'), child: GcField(controller: status, label: tr('Коротко про головне'))),
            const SizedBox(height: 10),
            LabeledField(label: tr('Опис'), child: GcField(controller: description, label: tr('Про що ця спільнота'), maxLines: 6, minLines: 3)),
            const SizedBox(height: 10),
            LabeledField(
              label: tr('Тематика'),
              child: GcSelect<String>(value: categories.containsKey(category) ? category : null, expand: true, items: [for (final e in categories.entries) (e.key, '${e.value}')], onChanged: (v) => setState(() => category = v ?? category)),
            ),
            const SizedBox(height: 10),
            LabeledField(label: tr('Сайт'), child: GcField(controller: website, label: 'https://', keyboard: TextInputType.url)),
            const SizedBox(height: 10),
            LabeledField(label: tr('Місто'), child: GcField(controller: city, label: tr('Місто'))),
          ]),
        ),
        const SizedBox(height: 12),
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CardTitle(tr('Доступ'), icon: LucideIcons.lock),
            SizedBox(height: 12),
            Segmented(
              options: [SegmentOption('group', tr('Група')), SegmentOption('public', tr('Публічна сторінка'))],
              selected: type,
              onSelect: (v) => setState(() => type = v),
            ),
            if (type == 'group') ...[
              SizedBox(height: 10),
              Segmented(
                options: [SegmentOption('open', tr('Відкрита'), icon: LucideIcons.lockOpen), SegmentOption('closed', tr('Закрита'), icon: LucideIcons.lock)],
                selected: privacy,
                onSelect: (v) => setState(() => privacy = v),
              ),
            ],
            const SizedBox(height: 10),
            Text(tr('Хто публікує на стіні'), style: body(13, color: muted)),
            SizedBox(height: 6),
            Segmented(
              options: [SegmentOption('open', tr('Усі учасники')), SegmentOption('closed', tr('Лише керівники'))],
              selected: wall,
              onSelect: (v) => setState(() => wall = v),
            ),
          ]),
        ),
        const SizedBox(height: 14),
        PrimaryButton(label: tr('Зберегти'), icon: LucideIcons.check, busy: busy, onPressed: _save),
        const SizedBox(height: 10),
        GhostButton(label: tr('Учасники й заявки'), icon: LucideIcons.usersRound, onPressed: () => context.push('/communities/${widget.slug}/members')),
        if (data['isOwner'] == true) ...[
          const SizedBox(height: 22),
          DangerButton(label: tr('Видалити спільноту'), icon: LucideIcons.trash2, expand: true, onPressed: _delete),
        ],
      ],
    );
  }
}
