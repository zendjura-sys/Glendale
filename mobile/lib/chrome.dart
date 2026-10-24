import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import 'account.dart';
import 'api.dart';
import 'i18n.dart';
import 'language_picker.dart';
import 'nav_items.dart';
import 'plus.dart';
import 'shell.dart';
import 'state.dart';
import 'subscription.dart';
import 'theme.dart';
import 'theme_controller.dart';
import 'widgets.dart';

// Хром застосунку — той самий, що на сайті (layouts/social-layout.tsx):
//  - шапка на всю ширину з матового скла: логотип, пошук і кнопки;
//  - планшет (широкий екран): ліворуч простий список розділів, як на комп'ютері;
//  - телефон: острів унизу (як у iOS 26) — вкладки й «язичок»; острів тягнеться вгору й
//    розгортається в меню з рештою розділів.

/// Пружина, як SNAP на сайті (lib/motion.ts): stiffness 420, damping 36.
const _snap = Duration(milliseconds: 340);
const _snapCurve = Curves.easeOutCubic;

const _rose = Color(0xFFF43F5E);

Duration _motion(BuildContext context, Duration value) => MediaQuery.disableAnimationsOf(context) ? Duration.zero : value;

bool _isActive(String tab, String path, String? username) => navIndexFor([tab], path, username: username) == 0;

class _Badge extends StatelessWidget {
  const _Badge(this.count);
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(minWidth: 16, minHeight: 16),
      padding: EdgeInsets.symmetric(horizontal: 4),
      alignment: Alignment.center,
      decoration: BoxDecoration(color: _rose, borderRadius: BorderRadius.circular(8)),
      child: Text(count > 99 ? '99+' : '$count', style: body(10, color: Colors.white, weight: FontWeight.w700).copyWith(height: 1)),
    );
  }
}

// ───────────────────────── Шапка ─────────────────────────

/// Кнопка-іконка шапки з лічильником (дзвіночок, повідомлення, тема).
Widget _headerButton(IconData icon, String label, VoidCallback onTap, {int badge = 0}) {
  return Tooltip(
    message: label,
    child: InkResponse(
      onTap: onTap,
      radius: 22,
      child: SizedBox(
        width: 42,
        height: 42,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            Icon(icon, size: 20, color: ink.withValues(alpha: 0.72)),
            if (badge > 0) Positioned(right: 3, top: 3, child: _Badge(badge)),
          ],
        ),
      ),
    ),
  );
}

/// Висота капсули шапки: разом із верхнім відступом займає ту саму смугу, що й колишня шапка.
const headerCapsuleHeight = siteBarHeight - 4;

/// Плаваюча капсула шапки — за формою як острів-меню знизу: відступи по краях, повне скруглення.
class HeaderCapsule extends StatelessWidget {
  const HeaderCapsule({required this.topInset, required this.child, super.key});
  final double topInset;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(12, topInset + 4, 12, 0),
      child: MatteGlass(borderRadius: headerCapsuleHeight / 2, child: child),
    );
  }
}

/// Шапка-капсула: матове скло, логотип, пошук і кнопки — як `Topbar` на сайті.
class TopBar extends StatelessWidget {
  const TopBar({required this.session, required this.player, required this.wide, required this.topInset, super.key});
  final Session session;
  final TrackPlayer player;
  final bool wide;
  final double topInset;

  @override
  Widget build(BuildContext context) {
    final me = session.me;
    const iconButton = _headerButton;

    // Шапка — плаваюча капсула з того самого глибокого матового скла, що й острів-меню знизу.
    return HeaderCapsule(
      topInset: topInset,
      child: Padding(
        padding: EdgeInsets.fromLTRB(wide ? 18 : 8, 0, wide ? 10 : 6, 0),
        child: SizedBox(
          height: headerCapsuleHeight,
          child: Row(
            children: [
              GestureDetector(
                onTap: () => context.go('/feed'),
                child: SizedBox(
                  width: wide ? sideNavWidth : null,
                  child: Align(alignment: Alignment.centerLeft, child: wide ? Wordmark(size: 19) : LogoMark(size: 34)),
                ),
              ),
              SizedBox(width: wide ? 12 : 8),
              Expanded(
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: ConstrainedBox(constraints: BoxConstraints(maxWidth: 520), child: _SearchField()),
                ),
              ),
              SizedBox(width: 4),
              if (wide) ...[
                iconButton(LucideIcons.usersRound, tr('Заявки в друзі'), () => context.go('/friends?tab=requests')),
                iconButton(LucideIcons.messageCircle, tr('Повідомлення'), () => context.go('/messages'), badge: session.unreadChats),
                iconButton(palette.isLight ? LucideIcons.moon : LucideIcons.sun, palette.isLight ? tr('Темна тема «Неоновий синій»') : tr('Світла тема «Крижана Арктика»'), () => session.setTheme(palette.isLight ? 'dark' : 'light')),
              ],
              iconButton(LucideIcons.bell, tr('Сповіщення'), () => showNotifications(context, session), badge: session.unreadNotifications),
              SizedBox(width: 2),
              _UserMenu(session: session, player: player, me: me ?? const {}, wide: wide),
            ],
          ),
        ),
      ),
    );
  }
}

/// Шапка «Музики» на телефоні — як на сайті. Острова там немає (його місце займають вкладки розділу),
/// тож ліворуч «‹ Назад» — вихід із «Музики» туди, звідки прийшли, — а праворуч дзвіночок сповіщень
/// і аватар: він відкриває те саме меню розділів, що й острів.
class MusicTopBar extends StatelessWidget {
  const MusicTopBar({required this.session, required this.player, required this.path, required this.topInset, super.key});
  final Session session;
  final TrackPlayer player;
  final String path;
  final double topInset;

  /// Останній маршрут поза «Музикою» (оболонка оновлює його на кожному переході) — туди веде «Назад».
  static String? exit;

  @override
  Widget build(BuildContext context) {
    final me = session.me ?? const {};
    return HeaderCapsule(
      topInset: topInset,
      child: Padding(
        padding: EdgeInsets.fromLTRB(4, 0, 6, 0),
        child: SizedBox(
          height: headerCapsuleHeight,
          child: Row(
            children: [
              TextButton.icon(
                onPressed: () => context.go(exit ?? '/feed'),
                style: TextButton.styleFrom(foregroundColor: accent, padding: EdgeInsets.fromLTRB(2, 8, 8, 8)),
                icon: Icon(LucideIcons.chevronLeft, size: 24, color: accent),
                label: Text(tr('Назад'), style: body(15, color: accent, weight: FontWeight.w600)),
              ),
              Spacer(),
              _headerButton(LucideIcons.bell, tr('Сповіщення'), () => showNotifications(context, session), badge: session.unreadNotifications),
              SizedBox(width: 2),
              Semantics(
                button: true,
                label: tr('Меню'),
                child: InkResponse(
                  key: const ValueKey('music-menu'),
                  onTap: () => showSectionsMenu(context, session, player, path),
                  radius: 22,
                  child: Padding(
                    padding: EdgeInsets.all(4),
                    child: Avatar(url: text(me['avatar_url']), name: text(me['name']) ?? tr('Я'), size: 34, frame: PlusMark.from(session.subscription.style)?.frame),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Меню розділів шторкою — той самий вміст, що в розгорнутому острові, але з усіма розділами
/// (вкладок острова поруч немає). Для екранів без острова, як-от «Музика».
Future<void> showSectionsMenu(BuildContext context, Session session, TrackPlayer player, String path) {
  return showGcSheet<void>(
    context,
    builder: (sheet) => SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(12, 4, 12, 12),
      child: ListenableBuilder(
        listenable: session,
        builder: (_, _) => MenuContent(
          session: session,
          player: player,
          path: path,
          rest: visibleNav(session.modules),
          onGo: (to) {
            Navigator.pop(sheet);
            context.go(to);
          },
          onClose: () => Navigator.pop(sheet),
        ),
      ),
    ),
  );
}

class _SearchField extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Material(
      color: field,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () => context.push('/search'),
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Icon(LucideIcons.search, color: muted, size: 17),
              SizedBox(width: 8),
              // Коротка підказка — уміщується цілою навіть на вузькому телефоні.
              Expanded(child: Text(tr('Пошук'), maxLines: 1, style: body(13.5, color: muted))),
            ],
          ),
        ),
      ),
    );
  }
}

/// Меню облікового запису під аватаром у шапці — як `UserMenu` на сайті.
class _UserMenu extends StatelessWidget {
  const _UserMenu({required this.session, required this.player, required this.me, required this.wide});
  final Session session;
  final TrackPlayer player;
  final Map<String, dynamic> me;
  final bool wide;

  @override
  Widget build(BuildContext context) {
    final role = session.isAdmin ? tr('Адміністратор') : me['role'] == 'moderator' ? tr('Модератор') : tr('Учасник');
    PopupMenuItem<String> item(String value, IconData icon, String label, {Color? color}) {
      return PopupMenuItem(
        value: value,
        height: 42,
        child: Row(children: [
          Icon(icon, size: 18, color: color ?? muted),
          SizedBox(width: 12),
          Expanded(child: Text(label, style: body(14, color: color ?? ink, weight: FontWeight.w500))),
        ]),
      );
    }

    return PopupMenuButton<String>(
      tooltip: tr('Меню облікового запису'),
      color: popover,
      elevation: 12,
      shadowColor: Colors.black.withValues(alpha: palette.isLight ? 0.18 : 0.6),
      position: PopupMenuPosition.under,
      offset: Offset(0, 6),
      constraints: BoxConstraints(minWidth: 240, maxWidth: 260),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      onSelected: (value) => _onMenu(context, value),
      itemBuilder: (context) => [
        PopupMenuItem(
          value: 'profile',
          height: 60,
          child: Row(children: [
            Avatar(url: text(me['avatar_url']), name: text(me['name']) ?? tr('Я'), size: 38, frame: PlusMark.from(session.subscription.style)?.frame),
            SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Text(text(me['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, weight: FontWeight.w600)),
                Text(text(me['email']) ?? '@${text(me['username']) ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
              ]),
            ),
          ]),
        ),
        PopupMenuDivider(height: 1),
        item('profile', LucideIcons.userRound, tr('Моя сторінка')),
        item('saved', LucideIcons.bookmark, tr('Збережене')),
        item('settings', LucideIcons.settings, tr('Налаштування')),
        if (session.isAdmin) item('admin', LucideIcons.layoutDashboard, tr('Адмін-панель')),
        item('feedback', LucideIcons.messageSquareHeart, tr('Відгук адмінам')),
        item('theme', palette.isLight ? LucideIcons.moon : LucideIcons.sun, palette.isLight ? tr('Темна тема') : tr('Світла тема')),
        item('language', LucideIcons.languages, tr('Мова')),
        PopupMenuDivider(height: 1),
        item('logout', LucideIcons.logOut, tr('Вийти'), color: dangerSoft),
      ],
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Avatar(url: text(me['avatar_url']), name: text(me['name']) ?? tr('Я'), size: 34),
          if (wide) ...[
            SizedBox(width: 8),
            Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text(text(me['first_name']) ?? text(me['name']) ?? '', style: body(13, weight: FontWeight.w600)),
              Text(role, style: body(11.5, color: muted)),
            ]),
            SizedBox(width: 4),
            Icon(LucideIcons.chevronDown, size: 16, color: faint),
          ],
        ]),
      ),
    );
  }

  void _onMenu(BuildContext context, String value) {
    switch (value) {
      case 'profile':
        context.go('/profile');
      case 'saved':
        context.go('/saved');
      case 'settings':
        context.go('/settings');
      case 'admin':
        launchUrl(Uri.parse('${Api.root}/admin'), mode: LaunchMode.externalApplication);
      case 'feedback':
        showFeedbackSheet(context);
      case 'theme':
        session.setTheme(palette.isLight ? 'dark' : 'light');
      case 'language':
        showLanguageSheet(context, session);
      case 'logout':
        signOut(session, player);
    }
  }
}

/// Вибір мови окремою шторкою (з меню облікового запису).
Future<void> showLanguageSheet(BuildContext context, Session session) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: popover,
    useSafeArea: true,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    builder: (sheet) => SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 18, 16, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(tr('Мова'), style: display(17)),
          SizedBox(height: 14),
          LanguagePicker(api: session.api),
        ]),
      ),
    ),
  );
}

Future<void> signOut(Session session, TrackPlayer player) async {
  try {
    await session.api.post('/api/v1/logout');
  } catch (_) {}
  await player.stop();
  await session.clear();
}

// ───────────────────────── Бічне меню (планшет) ─────────────────────────

/// Бічне меню, як на сайті на комп'ютері: простий список без карток, вибраний пункт підсвічено.
class SideList extends StatelessWidget {
  const SideList({required this.session, required this.path, super.key});
  final Session session;
  final String path;

  @override
  Widget build(BuildContext context) {
    final me = session.me ?? const {};
    Widget link(IconData icon, String title, bool active, VoidCallback onTap, {int badge = 0, Color? iconColor}) {
      return Padding(
        padding: EdgeInsets.only(bottom: 1),
        child: Material(
          color: active ? primary.withValues(alpha: palette.isLight ? 0.12 : 0.18) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(12),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: 40),
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 10),
                child: Row(children: [
                  Icon(icon, size: 19, color: iconColor ?? (active ? ink : ink.withValues(alpha: 0.82))),
                  SizedBox(width: 12),
                  Expanded(child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, color: active ? ink : ink.withValues(alpha: 0.82), weight: active ? FontWeight.w600 : FontWeight.w500))),
                  if (badge > 0)
                    Container(
                      constraints: BoxConstraints(minWidth: 20),
                      padding: EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: primary, borderRadius: BorderRadius.circular(10)),
                      child: Text(badge > 99 ? '99+' : '$badge', textAlign: TextAlign.center, style: body(11, color: Colors.white, weight: FontWeight.w700)),
                    ),
                ]),
              ),
            ),
          ),
        ),
      );
    }

    return ListView(
      padding: EdgeInsets.only(bottom: 8),
      children: [
        Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => context.go('/profile'),
            child: Padding(
              padding: EdgeInsets.all(8),
              child: Row(children: [
                Avatar(url: text(me['avatar_url']), name: text(me['name']) ?? tr('Я'), size: 34, online: true, frame: PlusMark.from(session.subscription.style)?.frame),
                SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    PlusNameRow(user: {...me, 'name': text(me['first_name']) ?? text(me['name']) ?? '', 'plus': session.subscription.style}, style: body(14, weight: FontWeight.w600)),
                    Text('@${session.username ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: faint)),
                  ]),
                ),
              ]),
            ),
          ),
        ),
        SizedBox(height: 4),
        for (final nav in visibleNav(session.modules))
          link(
            _isActive(nav.path, path, session.username) ? nav.activeIcon : nav.icon,
            nav.title,
            _isActive(nav.path, path, session.username),
            () => context.go(nav.path),
            badge: nav.path == '/messages' ? session.unreadChats : 0,
          ),
        Padding(padding: EdgeInsets.symmetric(horizontal: 10, vertical: 8), child: Divider(height: 1, color: line)),
        link(LucideIcons.settings, tr('Налаштування'), path.startsWith('/settings'), () => context.go('/settings')),
        if (session.isAdmin)
          link(LucideIcons.shieldCheck, tr('Адмін-панель'), false, () => launchUrl(Uri.parse('${Api.root}/admin'), mode: LaunchMode.externalApplication), iconColor: gold),
        Padding(
          padding: EdgeInsets.fromLTRB(10, 16, 10, 0),
          child: Text('© ${DateTime.now().year} ${tr('GameCon · Соціальна мережа нового покоління')}', style: body(11.5, color: faint).copyWith(height: 1.5)),
        ),
      ],
    );
  }
}

// ───────────────────────── Острів (телефон) ─────────────────────────

/// Нижня панель-острів (як у iOS 26): капсула з вкладками й «язичком» угорі. Замість кнопки «Меню»
/// острів тягнеться вгору — за язичок, свайпом по панелі або тапом — і розгортається в меню з рештою
/// розділів; вкладки лишаються внизу того самого острова. Згорнути: свайп униз, тап по затемненню, «Назад».
class IslandNav extends StatefulWidget {
  const IslandNav({required this.session, required this.player, required this.path, this.hidden = false, super.key});
  final Session session;
  final TrackPlayer player;
  final String path;

  /// Розділ має свою нижню панель (вкладки «Музики») — острів плавно ховається на її місці.
  final bool hidden;

  @override
  State<IslandNav> createState() => _IslandNavState();
}

class _IslandNavState extends State<IslandNav> {
  bool open = false;
  double drag = 0;
  bool dragging = false;

  void _set(bool value) {
    if (value != open) setState(() => open = value);
  }

  @override
  void didUpdateWidget(IslandNav old) {
    super.didUpdateWidget(old);
    // Перехід на інший розділ (або схований острів) згортає меню.
    if ((old.path != widget.path || widget.hidden) && open) open = false;
  }

  void _onDragUpdate(DragUpdateDetails d) => setState(() {
        dragging = true;
        drag += d.delta.dy;
      });

  void _onDragEnd(DragEndDetails d) {
    final v = d.primaryVelocity ?? 0;
    setState(() {
      if (!open && (drag < -24 || v < -300)) open = true;
      if (open && (drag > 48 || v > 400)) open = false;
      drag = 0;
      dragging = false;
    });
  }

  void _go(String path) {
    _set(false);
    context.go(path);
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.session;
    final tabs = session.navTabs;
    final rest = [for (final item in visibleNav(session.modules)) if (!tabs.contains(item.path)) item];
    final restActive = rest.any((i) => _isActive(i.path, widget.path, session.username));
    final restBadge = rest.any((i) => i.path == '/messages') ? session.unreadChats : 0;
    final media = MediaQuery.of(context);
    final systemBottom = media.viewPadding.bottom;
    final maxMenu = media.size.height - media.viewPadding.top - systemBottom - 144;

    final island = AnimatedContainer(
      duration: _motion(context, dragging ? Duration.zero : _snap),
      curve: _snapCurve,
      transform: Matrix4.translationValues(0, drag * 0.22, 0),
      // Глибоке матове скло iOS 27 — щільне й нейтральне, тож меню читається і розгорнутим.
      child: MatteGlass(
        borderRadius: barRadius,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Semantics(
              button: true,
              label: open ? tr('Згорнути меню') : tr('Меню'),
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => _set(!open),
                child: SizedBox(
                  height: 16,
                  width: double.infinity,
                  // Язичок майже впритул до верхнього краю острова (як на сайті).
                  child: Stack(
                    alignment: Alignment.topCenter,
                    children: [
                      AnimatedContainer(
                        margin: const EdgeInsets.only(top: 4),
                        duration: _motion(context, Duration(milliseconds: 200)),
                        width: 36,
                        height: 4,
                        decoration: BoxDecoration(color: restActive || open ? primary : fg.withValues(alpha: 0.25), borderRadius: BorderRadius.circular(4)),
                      ),
                      if (restBadge > 0 && !open)
                        Positioned(
                          top: 4,
                          left: 0,
                          right: 0,
                          child: Center(child: Transform.translate(offset: Offset(28, 0), child: Container(width: 8, height: 8, decoration: BoxDecoration(color: _rose, shape: BoxShape.circle)))),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            AnimatedSize(
              duration: _motion(context, _snap),
              curve: _snapCurve,
              alignment: Alignment.bottomCenter,
              child: AnimatedOpacity(
                duration: _motion(context, Duration(milliseconds: 220)),
                opacity: open ? 1 : 0,
                child: open
                    ? ConstrainedBox(
                        constraints: BoxConstraints(maxHeight: math.max(160, maxMenu)),
                        child: SingleChildScrollView(
                          padding: EdgeInsets.fromLTRB(12, 8, 12, 4),
                          child: MenuContent(session: session, player: widget.player, path: widget.path, rest: rest, onGo: _go, onClose: () => _set(false)),
                        ),
                      )
                    : SizedBox(width: double.infinity),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(4, 0, 4, 4),
              child: Row(
                children: [
                  for (final path in tabs)
                    if (navItem(path) case final item?)
                      Expanded(
                        child: _Tab(
                          item: item,
                          active: !open && _isActive(path, widget.path, session.username),
                          badge: path == '/messages' ? session.unreadChats : 0,
                          onTap: () => _go(path),
                        ),
                      ),
                ],
              ),
            ),
          ],
        ),
      ),
    );

    return PopScope(
      canPop: !open,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _set(false);
      },
      child: Stack(
        children: [
          Positioned.fill(
            child: IgnorePointer(
              ignoring: !open,
              child: AnimatedOpacity(
                duration: _motion(context, Duration(milliseconds: 200)),
                opacity: open ? 1 : 0,
                child: GestureDetector(
                  onTap: () => _set(false),
                  child: ColoredBox(color: Colors.black.withValues(alpha: 0.45)),
                ),
              ),
            ),
          ),
          Positioned(
            left: 12,
            right: 12,
            bottom: systemBottom + 8,
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: 560),
                // Заміна панелей: острів з'їжджає вниз і гасне, а на його місці з'являються вкладки розділу.
                child: IgnorePointer(
                  ignoring: widget.hidden,
                  child: AnimatedSlide(
                    duration: _motion(context, bottomBarSwap),
                    curve: Curves.easeOutCubic,
                    offset: widget.hidden ? Offset(0, 0.35) : Offset.zero,
                    child: AnimatedOpacity(
                      key: const ValueKey('bottom-bar-nav'),
                      duration: _motion(context, bottomBarSwap),
                      curve: Curves.easeOutCubic,
                      opacity: widget.hidden ? 0 : 1,
                      child: GestureDetector(
                        onVerticalDragUpdate: _onDragUpdate,
                        onVerticalDragEnd: _onDragEnd,
                        child: island,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Вкладка острова: іконка й підпис; вибрана світиться неоновим синім, без підкладок.
class _Tab extends StatelessWidget {
  const _Tab({required this.item, required this.active, required this.badge, required this.onTap});
  final NavItem item;
  final bool active;
  final int badge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: active,
      button: true,
      child: InkResponse(
        onTap: onTap,
        highlightShape: BoxShape.rectangle,
        borderRadius: BorderRadius.circular(16),
        child: SizedBox(
          height: 48,
          child: NeonTabLabel(icon: active ? item.activeIcon : item.icon, label: item.label, active: active, badge: badge > 0 ? _Badge(badge) : null),
        ),
      ),
    );
  }
}

/// Вміст розгорнутого острова: профіль, GameCon+, решта розділів і службові посилання — пласко, без плиток.
class MenuContent extends StatelessWidget {
  const MenuContent({required this.session, required this.player, required this.path, required this.rest, required this.onGo, required this.onClose, super.key});
  final Session session;
  final TrackPlayer player;
  final String path;
  final List<NavItem> rest;
  final ValueChanged<String> onGo;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final me = session.me ?? const {};
    Widget row(IconData icon, String label, VoidCallback onTap, {Color? color}) {
      return InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: 44),
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 8),
            child: Row(children: [
              Icon(icon, size: 19, color: color ?? ink.withValues(alpha: 0.5)),
              SizedBox(width: 12),
              Expanded(child: Text(label, style: body(15, color: color ?? ink.withValues(alpha: 0.85), weight: FontWeight.w500))),
            ]),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InkWell(
          onTap: () => onGo('/profile'),
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: EdgeInsets.all(8),
            child: Row(children: [
              Avatar(url: text(me['avatar_url']), name: text(me['name']) ?? tr('Я'), size: 44, online: true, frame: PlusMark.from(session.subscription.style)?.frame),
              SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  PlusNameRow(user: {...me, 'plus': session.subscription.style}, style: body(15, weight: FontWeight.w600), animate: true),
                  Text('@${session.username ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: faint)),
                ]),
              ),
            ]),
          ),
        ),
        Padding(padding: EdgeInsets.symmetric(vertical: 8), child: PlusMenuCard(subscription: session.subscription, onTap: () {
          onClose();
          showProFeatures(context);
        })),
        GridView.count(
          crossAxisCount: 4,
          shrinkWrap: true,
          padding: EdgeInsets.zero,
          physics: NeverScrollableScrollPhysics(),
          mainAxisSpacing: 4,
          childAspectRatio: 1.05,
          children: [
            for (final item in rest)
              Builder(builder: (context) {
                final active = _isActive(item.path, path, session.username);
                final badge = item.path == '/messages' ? session.unreadChats : 0;
                return InkWell(
                  onTap: () => onGo(item.path),
                  borderRadius: BorderRadius.circular(12),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Stack(clipBehavior: Clip.none, children: [
                        Icon(active ? item.activeIcon : item.icon, size: 24, color: active ? primary : accent),
                        if (badge > 0) Positioned(right: -10, top: -4, child: _Badge(badge)),
                      ]),
                      SizedBox(height: 6),
                      Text(item.label, textAlign: TextAlign.center, maxLines: 2, style: body(12, color: active ? primary : ink.withValues(alpha: 0.8), weight: FontWeight.w500).copyWith(height: 1.15)),
                    ],
                  ),
                );
              }),
          ],
        ),
        Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Divider(height: 1, color: line)),
        row(LucideIcons.userPlus, tr('Запросити друзів'), () => onGo('/invite')),
        row(LucideIcons.bookmark, tr('Збережене'), () => onGo('/saved')),
        row(LucideIcons.filePen, tr('Чернетки'), () => onGo('/drafts')),
        row(LucideIcons.star, tr('Обрані повідомлення'), () => onGo('/starred')),
        row(LucideIcons.panelBottom, tr('Налаштувати нижню панель'), () => onGo('/settings?tab=app')),
        row(LucideIcons.settings, tr('Налаштування'), () => onGo('/settings')),
        if (session.isAdmin)
          row(LucideIcons.shieldCheck, tr('Адмін-панель'), () {
            onClose();
            launchUrl(Uri.parse('${Api.root}/admin'), mode: LaunchMode.externalApplication);
          }, color: gold),
        row(
          palette.isLight ? LucideIcons.moon : LucideIcons.sun,
          palette.isLight ? tr('Темна тема «Неоновий синій»') : tr('Світла тема «Крижана Арктика»'),
          () => session.setTheme(ThemeController.instance.isLight ? 'dark' : 'light'),
        ),
        Padding(padding: EdgeInsets.symmetric(horizontal: 8, vertical: 6), child: LanguagePicker(api: session.api)),
        row(LucideIcons.messageSquareHeart, tr('Відгук адмінам'), () {
          onClose();
          showFeedbackSheet(context);
        }),
        row(LucideIcons.logOut, tr('Вийти'), () {
          onClose();
          signOut(session, player);
        }, color: dangerSoft),
      ],
    );
  }
}

String _date(DateTime d) => '${d.day.toString().padLeft(2, '0')}.${d.month.toString().padLeft(2, '0')}.${d.year}';

/// Картка GameCon+ у меню — як `PlusMenuCard` на сайті: статус і скільки лишилося.
class PlusMenuCard extends StatelessWidget {
  const PlusMenuCard({required this.subscription, required this.onTap, super.key});
  final SubscriptionController subscription;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final until = subscription.proExpiresAt;
    final active = subscription.isPro;
    final daysLeft = until == null ? 0 : math.max(0, until.difference(DateTime.now()).inHours ~/ 24 + 1);
    return Material(
      color: primary.withValues(alpha: palette.isLight ? 0.08 : 0.12),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              PlusBadge(size: 26),
              SizedBox(width: 10),
              Text('GameCon+', style: display(15.5)),
              Spacer(),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(color: active ? green.withValues(alpha: 0.15) : fg.withValues(alpha: 0.07), borderRadius: BorderRadius.circular(20)),
                child: Text(active ? tr('Активний') : tr('Не активний'), style: body(11, color: active ? green : muted, weight: FontWeight.w600)),
              ),
            ]),
            SizedBox(height: 8),
            Text(
              active && until != null ? '${tr('До {date}', {'date': _date(until)})} · ${tr('ще {n} дн.', {'n': '$daysLeft'})}' : tr('Більше можливостей для профілю, музики й кіно.'),
              style: body(13, color: soft),
            ),
          ]),
        ),
      ),
    );
  }
}
