import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

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
    ('/feed', 'Новини', Icons.home_rounded),
    ('/messages', 'Чати', Icons.chat_bubble_rounded),
    ('/friends', 'Друзі', Icons.people_rounded),
    ('/profile', 'Сторінка', Icons.person_rounded),
  ];

  int _selected(String path) {
    if (path.startsWith('/messages')) return 1;
    if (path.startsWith('/friends')) return 2;
    if (path == '/profile' || path.startsWith('/u/')) return 3;
    if (path == '/feed') return 0;
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
          child: widget.child,
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
    final items = [
      ('/people', 'Люди', Icons.search_rounded),
      ('/communities', 'Спільноти', Icons.groups_rounded),
      ('/photos', 'Фото', Icons.photo_rounded),
      ('/servers', 'Сервери GTA', Icons.sports_esports_rounded),
      ('/music', 'Музика', Icons.music_note_rounded),
      ('/cinema', 'Кіно', Icons.movie_rounded),
      ('/families', 'Сім’ї', Icons.groups_rounded),
      ('/notifications', 'Сповіщення', Icons.notifications_rounded),
      ('/settings', 'Налаштування', Icons.settings_rounded),
    ];
    final session = widget.session;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: abyss,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (sheet) {
        return SafeArea(
          child: ListView(
            shrinkWrap: true,
            children: [
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 10),
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(4)),
                ),
              ),
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 14, 20, 8),
                child: Text('GameCon', style: TextStyle(fontFamily: 'Unbounded', fontWeight: FontWeight.w700, fontSize: 20, color: ink)),
              ),
              for (final item in items)
                ListTile(
                  leading: Icon(item.$3, color: cyan),
                  title: Text(item.$2, style: onest),
                  onTap: () {
                    Navigator.pop(sheet);
                    context.go(item.$1);
                  },
                ),
              ListTile(
                leading: const Icon(Icons.logout_rounded, color: pink),
                title: const Text('Вийти', style: TextStyle(color: pink, fontFamily: 'Onest')),
                onTap: () async {
                  Navigator.pop(sheet);
                  try {
                    await session.api.post('/api/v1/logout');
                  } catch (_) {}
                  await session.clear();
                },
              ),
            ],
          ),
        );
      },
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
          Icon(icon, color: selected ? cyan : const Color(0xFF9A9898), size: 22),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: selected ? cyan : const Color(0xFF9A9898), fontFamily: 'Onest', fontSize: 11, fontWeight: selected ? FontWeight.w600 : FontWeight.w400)),
          const SizedBox(height: 3),
          AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            width: selected ? 12 : 0,
            height: 4,
            decoration: BoxDecoration(gradient: selected ? brand : null, borderRadius: BorderRadius.circular(4)),
          ),
        ],
      ),
    );
  }
}
