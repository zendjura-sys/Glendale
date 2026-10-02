import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

class AppShell extends StatelessWidget {
  const AppShell({required this.session, required this.player, required this.child, super.key});
  final Session session;
  final TrackPlayer player;
  final Widget child;

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
    return ListenableBuilder(
      listenable: player,
      builder: (context, _) => Stage(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: child,
        bottomNavigationBar: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (player.title.isNotEmpty)
              Material(
                color: deep,
                child: ListTile(
                  dense: true,
                  title: Text(player.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: onest.copyWith(fontWeight: FontWeight.w600)),
                  subtitle: Text(player.artist, maxLines: 1, style: onest.copyWith(color: muted, fontSize: 12)),
                  trailing: IconButton(
                    onPressed: player.toggle,
                    icon: Icon(player.playing ? Icons.pause_rounded : Icons.play_arrow_rounded, color: Colors.white),
                  ),
                ),
              ),
            Material(
              color: const Color(0xFF070A16),
              child: SafeArea(
                top: false,
                child: SizedBox(
                  height: 64,
                  child: Row(
                    children: [
                      for (var i = 0; i < _tabs.length; i++)
                        Expanded(child: _TabButton(icon: _tabs[i].$3, label: _tabs[i].$2, selected: selected == i, onTap: () => context.go(_tabs[i].$1))),
                      Expanded(child: _TabButton(icon: Icons.menu_rounded, label: 'Меню', selected: false, onTap: () => _menu(context))),
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
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: deep,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (sheet) {
        return SafeArea(
          child: ListView(
            shrinkWrap: true,
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 16, 20, 8),
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
    final color = selected ? Colors.white : muted;
    return InkWell(
      onTap: onTap,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: color, fontFamily: 'Onest', fontSize: 11)),
        ],
      ),
    );
  }
}
