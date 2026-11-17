import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'i18n.dart';
import 'music.dart';
import 'theme.dart';
import 'widgets.dart';

const _gutter = 16.0;

/// Пiгулки роздiлу Музика — як MusicNav на сайтi (music-layout.tsx):
/// Головна / Нове / Радiо / Чарти / Медiатека / Пошук + Завантажити.
/// Глобальна шапка й острiв застосунку лишаються; ця смуга — у контентi.
class MusicNav extends StatelessWidget {
  const MusicNav({super.key});

  static const tabs = <({String path, bool exact, IconData icon, String Function() label})>[
    (path: '/music', exact: true, icon: LucideIcons.house, label: _home),
    (path: '/music/new', exact: false, icon: LucideIcons.layoutGrid, label: _new),
    (path: '/music/radio', exact: false, icon: LucideIcons.radio, label: _radio),
    (path: '/music/charts', exact: false, icon: LucideIcons.trendingUp, label: _charts),
    (path: '/music/library', exact: false, icon: LucideIcons.library, label: _library),
    (path: '/music/search', exact: false, icon: LucideIcons.search, label: _search),
  ];

  static String _home() => tr('Головна');
  static String _new() => tr('Нове');
  static String _radio() => tr('Радіо');
  static String _charts() => tr('Чарти');
  static String _library() => tr('Медіатека');
  static String _search() => tr('Пошук');

  static bool activeFor(String path, String href, {bool exact = false}) {
    if (exact) return path == '/music';
    if (href == '/music/library' && (path.startsWith('/music/library') || path.startsWith('/music/playlists'))) {
      return true;
    }
    return path == href || path.startsWith('$href/');
  }

  @override
  Widget build(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    return Padding(
      padding: const EdgeInsets.fromLTRB(_gutter, 4, _gutter, 12),
      child: Glass(
        padding: const EdgeInsets.all(6),
        radius: 16,
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final tab in tabs) ...[
                _Pill(
                  icon: tab.icon,
                  label: tab.label(),
                  active: activeFor(path, tab.path, exact: tab.exact),
                  onTap: () {
                    if (path == tab.path) return;
                    context.go(tab.path);
                  },
                ),
                const SizedBox(width: 4),
              ],
              _Pill(
                icon: LucideIcons.upload,
                label: tr('Завантажити'),
                active: false,
                accent: true,
                onTap: () => uploadTrack(context),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
    this.accent = false,
  });
  final IconData icon;
  final String label;
  final bool active;
  final bool accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = active
        ? Colors.white
        : accent
            ? const Color(0xFF38BDF8)
            : ink.withValues(alpha: 0.72);
    final bg = active ? const Color(0xFF0EA5E9) : Colors.transparent;
    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: fg),
              const SizedBox(width: 6),
              Text(label, style: body(13, color: fg, weight: FontWeight.w700)),
            ],
          ),
        ),
      ),
    );
  }
}
