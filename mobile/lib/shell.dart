import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'player_view.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Переводить посилання сайту (`/f/black`, `/c/clan`, `/tonny.morales`) у маршрути застосунку.
String appPathFor(String? sitePath) {
  final raw = text(sitePath);
  if (raw == null) return '/feed';
  final uri = Uri.tryParse(raw);
  final path = uri?.path ?? raw;
  final query = uri != null && uri.hasQuery ? '?${uri.query}' : '';
  final parts = path.split('/').where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return '/feed';
  final head = parts.first;
  String rest(int from) => parts.length > from ? parts[from] : '';
  switch (head) {
    case 'f':
      final tab = rest(2);
      return '/families/${rest(1)}${tab.isEmpty ? '' : '?tab=$tab'}';
    case 'c':
      final sub = rest(2);
      return '/communities/${rest(1)}${['members', 'settings', 'photos'].contains(sub) ? '/$sub' : ''}${sub == 'members' ? query : ''}';
    case 'messages':
      return parts.length > 1 && int.tryParse(rest(1)) != null ? '/messages/${rest(1)}' : '/messages';
    case 'posts':
      return '/posts/${rest(1)}';
    case 'albums':
      return '/albums/${rest(1)}$query';
    case 'photos':
      return parts.length > 2 && rest(1) == 'u' ? '/photos?user=${rest(2)}' : '/photos';
    case 'music':
      if (rest(1) == 'u' && parts.length > 2) return '/music?user=${rest(2)}';
      if (rest(1) == 'playlists' && parts.length > 2) return '/music/playlists/${rest(2)}';
      return '/music$query';
    case 'cinema':
      return '$path${rest(1) == 'my' ? query : ''}';
    case 'families':
      return rest(1) == 'create' ? '/families/create' : '/families';
    case 'servers':
    case 'communities':
    case 'friends':
    case 'people':
    case 'notifications':
    case 'feed':
      return '$path$query';
    case 'settings':
      return '/settings';
    case 'id':
      return '/feed';
    default:
      return '/u/$head';
  }
}

class AppShell extends StatefulWidget {
  const AppShell({required this.session, required this.player, required this.child, super.key});
  final Session session;
  final TrackPlayer player;
  final Widget child;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  @override
  void initState() {
    super.initState();
    widget.session.addListener(_onSession);
    WidgetsBinding.instance.addPostFrameCallback((_) => _onSession());
  }

  @override
  void dispose() {
    widget.session.removeListener(_onSession);
    super.dispose();
  }

  void _onSession() {
    final uri = widget.session.handoff;
    if (!mounted || uri == null || uri.host != 'spotify') return;
    widget.session.consumeLink();
    final failed = uri.queryParameters['error'];
    final ok = failed == null || failed.isEmpty;
    toast(context, ok ? 'Spotify підключено.' : 'Spotify не підключився.');
    if (ok) widget.session.noteSpotify();
  }

  static const _tabs = [
    ('/profile', 'Сторінка', Icons.person_outline_rounded),
    ('/feed', 'Новини', Icons.article_outlined),
    ('/messages', 'Чати', Icons.chat_bubble_outline_rounded),
    ('/friends', 'Друзі', Icons.people_outline_rounded),
  ];

  int _selected(String path) {
    if (path.startsWith('/messages')) return 2;
    if (path.startsWith('/friends')) return 3;
    if (path == '/profile' || path == '/u/${widget.session.username}') return 0;
    if (path == '/feed') return 1;
    return 4;
  }

  @override
  Widget build(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    final selected = _selected(path);
    final topInset = MediaQuery.viewPaddingOf(context).top;
    final headerTop = topInset == 0 ? 24.0 : topInset;
    final chatOpen = RegExp(r'^/messages/\d+').hasMatch(path);
    return AppScope(
      session: widget.session,
      player: widget.player,
      child: Stage(
        child: ListenableBuilder(
          listenable: Listenable.merge([widget.player, widget.session]),
          builder: (context, _) {
            final keyboard = MediaQuery.viewInsetsOf(context).bottom > 0;
            final hideChrome = chatOpen && keyboard;
            final playing = widget.player.current != null && !hideChrome;
            final bottom = hideChrome ? 0.0 : MediaQuery.viewPaddingOf(context).bottom + navBarHeight + (playing ? miniPlayerExtent : 0);
            return ShellChrome(
              bottom: bottom,
              child: Scaffold(
                backgroundColor: Colors.transparent,
                resizeToAvoidBottomInset: true,
                body: Stack(
                  children: [
                    widget.child,
                    Positioned(top: headerTop, left: 0, right: 0, child: _SiteBar(session: widget.session)),
                    if (!hideChrome)
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (playing) MiniPlayer(player: widget.player),
                            _BottomBar(
                              selected: selected,
                              unreadChats: widget.session.unreadChats,
                              onTab: (i) => i == 4 ? _menu(context) : context.go(_tabs[i].$1),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  void _menu(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    final me = widget.session.me ?? {};
    const tiles = [
      ('/profile', 'Моя сторінка', Icons.person_outline_rounded),
      ('/feed', 'Новини', Icons.article_outlined),
      ('/messages', 'Повідомлення', Icons.chat_bubble_outline_rounded),
      ('/friends', 'Друзі', Icons.people_outline_rounded),
      ('/people', 'Пошук людей', Icons.search_rounded),
      ('/communities', 'Спільноти', Icons.shield_outlined),
      ('/photos', 'Фотографії', Icons.image_outlined),
      ('/servers', 'Сервери GTA', Icons.dns_outlined),
      ('/music', 'Музика', Icons.music_note_outlined),
      ('/cinema', 'Кіно', Icons.movie_outlined),
      ('/families', 'Сім’ї', Icons.workspace_premium_outlined),
    ];
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: popover,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28)), side: BorderSide(color: lineStrong)),
      builder: (sheet) {
        return SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.16), borderRadius: BorderRadius.circular(4))),
                const SizedBox(height: 14),
                Glass(
                  padding: const EdgeInsets.all(12),
                  onTap: () {
                    Navigator.pop(sheet);
                    context.go('/profile');
                  },
                  child: Row(
                    children: [
                      Avatar(url: text(me['avatar_url']), name: text(me['name']) ?? 'Я', size: 44, online: true),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(text(me['name']) ?? 'GameCon', style: body(15, weight: FontWeight.w700)),
                            Text('@${text(me['username']) ?? ''}', style: body(12.5, color: muted)),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded, color: muted),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                GridView.count(
                  crossAxisCount: 3,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  childAspectRatio: 1.08,
                  children: [
                    for (final tile in tiles)
                      _MenuTile(
                        icon: tile.$3,
                        label: tile.$2,
                        selected: path == tile.$1 || (tile.$1 != '/feed' && tile.$1 != '/profile' && path.startsWith(tile.$1)),
                        onTap: () {
                          Navigator.pop(sheet);
                          context.go(tile.$1);
                        },
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Glass(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Column(
                    children: [
                      _MenuLink(icon: Icons.settings_outlined, label: 'Налаштування', onTap: () {
                        Navigator.pop(sheet);
                        context.go('/settings');
                      }),
                      if (widget.session.isAdmin)
                        _MenuLink(
                          icon: Icons.shield_outlined,
                          label: 'Адмін-панель',
                          onTap: () {
                            Navigator.pop(sheet);
                            launchUrl(Uri.parse('${Api.root}/admin'), mode: LaunchMode.externalApplication);
                          },
                        ),
                      _MenuLink(
                        icon: Icons.logout_rounded,
                        label: 'Вийти',
                        color: dangerSoft,
                        onTap: () async {
                          Navigator.pop(sheet);
                          try {
                            await widget.session.api.post('/api/v1/logout');
                          } catch (_) {}
                          await widget.player.stop();
                          await widget.session.clear();
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _SiteBar extends StatelessWidget {
  const _SiteBar({required this.session});
  final Session session;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) {
        final me = session.me;
        return Padding(
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
          child: Row(
            children: [
              GestureDetector(onTap: () => context.go('/feed'), child: const LogoMark(size: 38)),
              const SizedBox(width: 10),
              Expanded(
                child: Material(
                  color: field,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: lineStrong)),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => context.push('/search'),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                      child: Row(
                        children: [
                          const Icon(Icons.search_rounded, color: muted, size: 18),
                          const SizedBox(width: 8),
                          Expanded(child: Text('Пошук людей і спільнот...', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(13.5, color: muted))),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 4),
              Stack(
                clipBehavior: Clip.none,
                children: [
                  IconButton(onPressed: () => showNotifications(context, session), icon: const Icon(Icons.notifications_none_rounded, color: ink)),
                  if (session.unreadNotifications > 0)
                    Positioned(right: 6, top: 6, child: CountBadge(count: session.unreadNotifications)),
                ],
              ),
              GestureDetector(
                onTap: () => context.go('/profile'),
                child: Avatar(url: text(me?['avatar_url']), name: text(me?['name']) ?? 'Я', size: 38),
              ),
            ],
          ),
        );
      },
    );
  }
}

class CountBadge extends StatelessWidget {
  const CountBadge({required this.count, super.key});
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 17, minHeight: 17),
      padding: const EdgeInsets.symmetric(horizontal: 5),
      alignment: Alignment.center,
      decoration: BoxDecoration(color: pink, borderRadius: BorderRadius.circular(10), border: Border.all(color: voidColor, width: 2)),
      child: Text(count > 99 ? '99+' : '$count', style: body(9.5, color: Colors.white, weight: FontWeight.w700)),
    );
  }
}

const _noticeKinds = <String, (IconData, Color)>{
  'post_like': (Icons.favorite_rounded, Color(0xFFF43F5E)),
  'post_comment': (Icons.chat_bubble_rounded, neonBlue),
  'wall_post': (Icons.edit_square, violet),
  'friend_request': (Icons.person_add_alt_1_rounded, Color(0xFF10B981)),
  'friend_accepted': (Icons.how_to_reg_rounded, Color(0xFF10B981)),
  'community_request': (Icons.shield_outlined, indigo),
  'community_approved': (Icons.verified_user_outlined, indigo),
  'photo_like': (Icons.favorite_rounded, Color(0xFFF43F5E)),
  'photo_comment': (Icons.image_outlined, Color(0xFF38BDF8)),
  'family_application': (Icons.person_add_alt_1_rounded, Color(0xFFF59E0B)),
  'family_accepted': (Icons.workspace_premium_rounded, Color(0xFFF59E0B)),
  'family_report': (Icons.assignment_turned_in_outlined, Color(0xFFF59E0B)),
  'family_review': (Icons.assignment_turned_in_outlined, Color(0xFF10B981)),
  'family_cashout': (Icons.account_balance_wallet_outlined, Color(0xFF10B981)),
  'family_bank': (Icons.account_balance_wallet_outlined, Color(0xFF10B981)),
  'family_sanction': (Icons.gavel_rounded, Color(0xFFF43F5E)),
  'family_kicked': (Icons.gavel_rounded, Color(0xFFF43F5E)),
  'family_warehouse': (Icons.inventory_2_outlined, Color(0xFFF43F5E)),
  'family_event': (Icons.event_outlined, indigo),
};

(IconData, Color) noticeKind(String kind) =>
    _noticeKinds[kind] ?? (kind.startsWith('family_') ? (Icons.workspace_premium_rounded, const Color(0xFFF59E0B)) : (Icons.notifications_rounded, primary));

/// Панель сповіщень (на телефоні сайт показує її на всю ширину під шапкою).
Future<void> showNotifications(BuildContext context, Session session) {
  return showGcSheet<void>(
    context,
    title: 'Сповіщення',
    height: MediaQuery.sizeOf(context).height * 0.78,
    builder: (sheet) => NotificationsList(session: session, onOpen: (path) {
      Navigator.pop(sheet);
      context.push(appPathFor(path));
    }),
  );
}

class NotificationsList extends StatefulWidget {
  const NotificationsList({required this.session, required this.onOpen, super.key});
  final Session session;
  final ValueChanged<String?> onOpen;

  @override
  State<NotificationsList> createState() => _NotificationsListState();
}

class _NotificationsListState extends State<NotificationsList> {
  @override
  Widget build(BuildContext context) {
    return Remote(
      load: () => widget.session.api.get('/api/v1/notifications'),
      builder: (data, reload) {
        final rows = maps(data['notifications']);
        final unread = intOf(data['unread']);
        return Column(
          children: [
            if (unread > 0)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: () async {
                    await attempt(context, () => widget.session.api.post('/api/v1/notifications/read'));
                    await reload();
                    await widget.session.refreshCounters();
                  },
                  icon: const Icon(Icons.done_all_rounded, size: 16, color: primary),
                  label: Text('Прочитати всі', style: body(13, color: primary, weight: FontWeight.w600)),
                ),
              ),
            Expanded(
              child: rows.isEmpty
                  ? const QuietEmpty(icon: Icons.notifications_none_rounded, text: 'Сповіщень поки немає')
                  : ListView.separated(
                      padding: EdgeInsets.fromLTRB(12, 0, 12, 20 + ShellChrome.bottomOf(context)),
                      itemCount: rows.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 2),
                      itemBuilder: (context, i) => NotificationRow(row: rows[i], onTap: () => widget.onOpen(text(rows[i]['url']))),
                    ),
            ),
          ],
        );
      },
    );
  }
}

class NotificationRow extends StatelessWidget {
  const NotificationRow({required this.row, required this.onTap, super.key});
  final Map<String, dynamic> row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final actor = mapOf(row['actor']);
    final kind = noticeKind(text(row['kind']) ?? '');
    final name = text(actor['name']) ?? '';
    final read = row['read'] == true;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        decoration: BoxDecoration(color: read ? Colors.transparent : primary.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(16)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Avatar(url: text(actor['avatar_url']), name: name.isEmpty ? 'GameCon' : name, size: 42),
                Positioned(
                  right: -3,
                  bottom: -3,
                  child: Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(color: kind.$2, shape: BoxShape.circle, border: Border.all(color: popover, width: 2)),
                    child: Icon(kind.$1, size: 10, color: Colors.white),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text.rich(
                    TextSpan(children: [
                      if (name.isNotEmpty) TextSpan(text: '$name ', style: body(14, weight: FontWeight.w700)),
                      TextSpan(text: text(row['text']) ?? '', style: body(14, color: soft)),
                    ]),
                  ),
                  if (text(row['excerpt']) != null)
                    Padding(padding: const EdgeInsets.only(top: 3), child: Text('«${text(row['excerpt'])}»', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(12.5, color: muted))),
                  const SizedBox(height: 4),
                  Text(ago(row['created_at']), style: body(11.5, color: faint)),
                ],
              ),
            ),
            if (!read) Container(margin: const EdgeInsets.only(top: 6, left: 6), width: 8, height: 8, decoration: const BoxDecoration(color: primary, shape: BoxShape.circle)),
          ],
        ),
      ),
    );
  }
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.selected, required this.unreadChats, required this.onTab});
  final int selected;
  final int unreadChats;
  final ValueChanged<int> onTab;

  static const _items = [
    ('Сторінка', Icons.person_outline_rounded, Icons.person_rounded),
    ('Новини', Icons.article_outlined, Icons.article_rounded),
    ('Чати', Icons.chat_bubble_outline_rounded, Icons.chat_bubble_rounded),
    ('Друзі', Icons.people_outline_rounded, Icons.people_rounded),
    ('Меню', Icons.grid_view_rounded, Icons.grid_view_rounded),
  ];

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: DecoratedBox(
          decoration: BoxDecoration(color: const Color(0xA60F0A1E), border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.08)))),
          child: SafeArea(
        top: false,
        child: SizedBox(
          height: 64,
          child: Row(
            children: [
              for (var i = 0; i < _items.length; i++)
                Expanded(
                  child: InkWell(
                    onTap: () => onTab(i),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                              decoration: BoxDecoration(color: selected == i ? primary.withValues(alpha: 0.16) : Colors.transparent, borderRadius: BorderRadius.circular(14)),
                              child: Icon(selected == i ? _items[i].$3 : _items[i].$2, size: 22, color: selected == i ? const Color(0xFF8FA0FF) : muted),
                            ),
                            if (i == 2 && unreadChats > 0) Positioned(right: 4, top: -4, child: CountBadge(count: unreadChats)),
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(_items[i].$1, style: body(11, color: selected == i ? const Color(0xFF8FA0FF) : muted, weight: selected == i ? FontWeight.w700 : FontWeight.w500)),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
        ),
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({required this.icon, required this.label, required this.selected, required this.onTap});
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          decoration: BoxDecoration(
            color: selected ? primary.withValues(alpha: 0.14) : Colors.white.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: selected ? primary.withValues(alpha: 0.7) : line),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: selected ? const Color(0xFF9AA6FF) : soft, size: 24),
              const SizedBox(height: 8),
              Text(label, textAlign: TextAlign.center, maxLines: 2, style: body(12, color: selected ? Colors.white : soft, weight: FontWeight.w600).copyWith(height: 1.15)),
            ],
          ),
        ),
      ),
    );
  }
}

class _MenuLink extends StatelessWidget {
  const _MenuLink({required this.icon, required this.label, required this.onTap, this.color = ink});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      leading: Icon(icon, color: color == ink ? muted : color, size: 20),
      title: Text(label, style: body(14.5, color: color, weight: FontWeight.w500)),
      onTap: onTap,
    );
  }
}
