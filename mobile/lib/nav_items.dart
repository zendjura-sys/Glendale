import 'package:flutter/widgets.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Розділ, який можна закріпити в нижній панелі.
class NavItem {
  const NavItem(this.path, this.label, this.title, this.icon, this.activeIcon);
  final String path;

  /// Коротка назва під іконкою в панелі.
  final String label;

  /// Повна назва — у меню й налаштуваннях.
  final String title;
  final IconData icon;
  final IconData activeIcon;
}

const navCatalog = [
  NavItem('/profile', 'Сторінка', 'Моя сторінка', LucideIcons.userRound, LucideIcons.userRound500),
  NavItem('/feed', 'Новини', 'Новини', LucideIcons.newspaper, LucideIcons.newspaper500),
  NavItem('/messages', 'Чати', 'Повідомлення', LucideIcons.messageCircle, LucideIcons.messageCircle500),
  NavItem('/friends', 'Друзі', 'Друзі', LucideIcons.usersRound, LucideIcons.usersRound500),
  NavItem('/people', 'Пошук', 'Пошук людей', LucideIcons.search, LucideIcons.search500),
  NavItem('/communities', 'Спільноти', 'Спільноти', LucideIcons.shield, LucideIcons.shield500),
  NavItem('/photos', 'Фото', 'Фотографії', LucideIcons.image, LucideIcons.image500),
  NavItem('/servers', 'Сервери', 'Сервери GTA', LucideIcons.server, LucideIcons.server500),
  NavItem('/music', 'Музика', 'Музика', LucideIcons.music, LucideIcons.music500),
  NavItem('/cinema', 'Кіно', 'Кіно', LucideIcons.film, LucideIcons.film500),
  NavItem('/families', 'Сім’ї', 'Сім’ї', LucideIcons.crown, LucideIcons.crown500),
  NavItem('/games', 'Ігри', 'Каталог ігор', LucideIcons.gamepad2, LucideIcons.gamepad2500),
  NavItem('/clans', 'Клани', 'Клани й гільдії', LucideIcons.swords, LucideIcons.swords500),
  NavItem('/events', 'Події', 'Календар подій', LucideIcons.calendarDays, LucideIcons.calendarDays500),
];

const navMenu = NavItem('/menu', 'Меню', 'Меню', LucideIcons.layoutGrid, LucideIcons.layoutGrid500);

const defaultNav = ['/profile', '/feed', '/messages', '/friends'];

/// Скільки розділів поміщається поруч із «Меню».
const maxNav = 4;

NavItem? navItem(String path) {
  for (final item in navCatalog) {
    if (item.path == path) return item;
  }
  return null;
}

/// Відкидає невідомі й повторні шляхи та обрізає до [maxNav].
List<String> cleanNav(Iterable<String> paths) {
  final out = <String>[];
  for (final path in paths) {
    if (navItem(path) != null && !out.contains(path)) out.add(path);
    if (out.length == maxNav) break;
  }
  return out;
}

/// Індекс закріпленого розділу для поточного шляху; `null` — підсвічується «Меню».
int? navIndexFor(List<String> tabs, String path, {String? username}) {
  for (var i = 0; i < tabs.length; i++) {
    final tab = tabs[i];
    final hit = switch (tab) {
      '/profile' => path == '/profile' || (username != null && path == '/u/$username'),
      '/feed' => path == '/feed',
      _ => path == tab || path.startsWith('$tab/'),
    };
    if (hit) return i;
  }
  return null;
}
