import 'package:flutter/widgets.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'i18n.dart';

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

final navCatalog = [
  NavItem('/profile', tr('Сторінка'), tr('Моя сторінка'), LucideIcons.userRound, LucideIcons.userRound500),
  NavItem('/feed', tr('Новини'), tr('Новини'), LucideIcons.newspaper, LucideIcons.newspaper500),
  NavItem('/messages', tr('Чати'), tr('Повідомлення'), LucideIcons.messageCircle, LucideIcons.messageCircle500),
  NavItem('/friends', tr('Друзі'), tr('Друзі'), LucideIcons.usersRound, LucideIcons.usersRound500),
  NavItem('/people', tr('Пошук'), tr('Пошук людей'), LucideIcons.search, LucideIcons.search500),
  NavItem('/communities', tr('Спільноти'), tr('Спільноти'), LucideIcons.shield, LucideIcons.shield500),
  NavItem('/photos', tr('Фото'), tr('Фотографії'), LucideIcons.image, LucideIcons.image500),
  NavItem('/servers', tr('Сервери'), tr('Сервери GTA'), LucideIcons.server, LucideIcons.server500),
  NavItem('/music', tr('Музика'), tr('Музика'), LucideIcons.music, LucideIcons.music500),
  NavItem('/cinema', tr('Кіно'), tr('Кіно'), LucideIcons.film, LucideIcons.film500),
  NavItem('/families', tr('Сім’ї'), tr('Сім’ї'), LucideIcons.crown, LucideIcons.crown500),
  NavItem('/games', tr('Ігри'), tr('Каталог ігор'), LucideIcons.gamepad2, LucideIcons.gamepad2500),
  NavItem('/clans', tr('Клани'), tr('Клани й гільдії'), LucideIcons.swords, LucideIcons.swords500),
  NavItem('/events', tr('Події'), tr('Календар подій'), LucideIcons.calendarDays, LucideIcons.calendarDays500),
  NavItem('/party', tr('Пати'), tr('Пошук пати'), LucideIcons.userRoundSearch, LucideIcons.userRoundSearch500),
];

final navMenu = NavItem('/menu', tr('Меню'), tr('Меню'), LucideIcons.layoutGrid, LucideIcons.layoutGrid500);

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
