import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

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
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ok ? 'Spotify підключено.' : 'Spotify не підключився.')));
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
    if (path.startsWith('/friends') || path.startsWith('/people')) return 3;
    if (path == '/profile' || path.startsWith('/u/')) return 0;
    if (path == '/feed') return 1;
    return -1;
  }

  @override
  Widget build(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    final selected = _selected(path);
    final topInset = MediaQuery.viewPaddingOf(context).top;
    return ListenableBuilder(
      listenable: widget.player,
      builder: (context, _) => Stage(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Padding(
          padding: EdgeInsets.only(top: (topInset == 0 ? 28 : topInset) + 6),
          child: Column(
            children: [
              _SiteBar(session: widget.session),
              Expanded(child: widget.child),
            ],
          ),
        ),
        bottomNavigationBar: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (widget.player.title.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Material(
                  color: card,
                  borderRadius: BorderRadius.circular(18),
                  child: ListTile(
                    dense: true,
                    leading: const CircleAvatar(backgroundColor: indigo, child: Icon(Icons.music_note_rounded, color: Colors.white, size: 18)),
                    title: Text(widget.player.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: onest.copyWith(fontWeight: FontWeight.w600)),
                    subtitle: Text(widget.player.artist, maxLines: 1, style: onest.copyWith(color: muted, fontSize: 12)),
                    trailing: IconButton(
                      onPressed: widget.player.toggle,
                      icon: Icon(widget.player.playing ? Icons.pause_rounded : Icons.play_arrow_rounded, color: Colors.white),
                    ),
                  ),
                ),
              ),
            Material(
              color: bar,
              child: SafeArea(
                top: false,
                child: SizedBox(
                  height: 62,
                  child: Row(
                    children: [
                      for (var i = 0; i < _tabs.length; i++)
                        Expanded(child: _TabButton(icon: _tabs[i].$3, label: _tabs[i].$2, selected: selected == i, onTap: () => context.go(_tabs[i].$1))),
                      Expanded(child: _TabButton(icon: Icons.grid_view_rounded, label: 'Меню', selected: false, onTap: () => _menu(context))),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
      ),
    );
  }

  void _menu(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    final me = widget.session.me ?? {};
    final tiles = [
      ('/profile', 'Моя сторінка', Icons.person_outline_rounded),
      ('/feed', 'Новини', Icons.article_outlined),
      ('/messages', 'Повідомлення', Icons.chat_bubble_outline_rounded),
      ('/friends', 'Друзі', Icons.people_outline_rounded),
      ('/people', 'Пошук людей', Icons.search_rounded),
      ('/communities', 'Спільноти', Icons.shield_outlined),
      ('/photos', 'Фотографії', Icons.photo_outlined),
      ('/servers', 'Сервери GTA', Icons.dns_outlined),
      ('/music', 'Музика', Icons.music_note_outlined),
      ('/cinema', 'Кіно', Icons.movie_outlined),
      ('/families', 'Сім’ї', Icons.workspace_premium_outlined),
    ];
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF12141C),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (sheet) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(width: 42, height: 4, decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(4))),
                const SizedBox(height: 14),
                Glass(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    children: [
                      Avatar(url: text(me['avatar_url']), name: text(me['name']) ?? 'Я', size: 42),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(text(me['name']) ?? 'GameCon', style: onest.copyWith(fontWeight: FontWeight.w700)),
                            Text('@${text(me['username']) ?? ''}', style: onest.copyWith(color: muted, fontSize: 12)),
                          ],
                        ),
                      ),
                      IconButton(onPressed: () => Navigator.pop(sheet), icon: const Icon(Icons.close_rounded, color: muted)),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                GridView.count(
                  crossAxisCount: 4,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 0.92,
                  children: [
                    for (final tile in tiles)
                      _MenuTile(
                        icon: tile.$3,
                        label: tile.$2,
                        selected: path == tile.$1 || (tile.$1 != '/feed' && path.startsWith(tile.$1)),
                        onTap: () {
                          Navigator.pop(sheet);
                          context.go(tile.$1);
                        },
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                _MenuLink(icon: Icons.settings_outlined, label: 'Налаштування', onTap: () { Navigator.pop(sheet); context.go('/settings'); }),
                if (me['role'] == 'admin')
                  _MenuLink(
                    icon: Icons.admin_panel_settings_outlined,
                    label: 'Адмін-панель',
                    onTap: () {
                      Navigator.pop(sheet);
                      launchUrl(Uri.parse('https://gamecon.online/admin'), mode: LaunchMode.externalApplication);
                    },
                  ),
                _MenuLink(
                  icon: Icons.logout_rounded,
                  label: 'Вийти',
                  color: const Color(0xFFFF6B8A),
                  onTap: () async {
                    Navigator.pop(sheet);
                    try {
                      await widget.session.api.post('/api/v1/logout');
                    } catch (_) {}
                    await widget.session.clear();
                  },
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
    final me = session.me;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      child: Row(
        children: [
          const LogoMark(size: 34),
          const SizedBox(width: 8),
          Expanded(
            child: Material(
              color: card,
              borderRadius: BorderRadius.circular(22),
              child: InkWell(
                borderRadius: BorderRadius.circular(22),
                onTap: () => context.go('/people'),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  child: Row(
                    children: [
                      const Icon(Icons.search_rounded, color: muted, size: 18),
                      const SizedBox(width: 8),
                      Text('Пошук людей і спільнот...', style: onest.copyWith(color: muted, fontSize: 13)),
                    ],
                  ),
                ),
              ),
            ),
          ),
          IconButton(
            onPressed: () => _notices(context),
            icon: const Icon(Icons.notifications_none_rounded, color: ink),
          ),
          GestureDetector(
            onTap: () => context.go('/profile'),
            child: Avatar(url: text(me?['avatar_url']), name: text(me?['name']) ?? 'Я', size: 36),
          ),
        ],
      ),
    );
  }

  void _notices(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF161822),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (sheet) {
        return SafeArea(
          child: Remote(
            load: () => session.api.get('/api/v1/notifications'),
            builder: (data, _) {
              final rows = maps(data['notifications']);
              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                children: [
                  Text('Сповіщення', style: unbounded.copyWith(fontSize: 18)),
                  const SizedBox(height: 8),
                  if (rows.isEmpty) const Text('Немає сповіщень.', style: TextStyle(color: muted, fontFamily: 'Onest')),
                  for (final row in rows.take(12))
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(text(row['text']) ?? '', style: onest.copyWith(color: row['read'] == true ? muted : ink, fontSize: 14)),
                    ),
                ],
              );
            },
          ),
        );
      },
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
      color: card,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: selected ? neonBlue.withValues(alpha: 0.8) : Colors.white.withValues(alpha: 0.04)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: selected ? neonBlue : const Color(0xFFB7BEE0), size: 22),
              const SizedBox(height: 6),
              Text(label, textAlign: TextAlign.center, maxLines: 2, style: onest.copyWith(fontSize: 11, height: 1.15, color: selected ? Colors.white : const Color(0xFFC5CBE6))),
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
      leading: Icon(icon, color: color, size: 20),
      title: Text(label, style: onest.copyWith(color: color)),
      onTap: onTap,
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({required this.icon, required this.label, required this.selected, required this.onTap});
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: selected ? neonBlue : const Color(0xFF8E93A8), size: 22),
          const SizedBox(height: 3),
          Text(label, style: TextStyle(color: selected ? neonBlue : const Color(0xFF8E93A8), fontFamily: 'Onest', fontSize: 11, fontWeight: selected ? FontWeight.w600 : FontWeight.w400)),
        ],
      ),
    );
  }
}
