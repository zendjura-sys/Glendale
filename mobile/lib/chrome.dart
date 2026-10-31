import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import 'account.dart';
import 'api.dart';
import 'core/widgets/arctic_glass/arctic_glass.dart';
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
const _snap = Duration(milliseconds: 380);
const _snapCurve = Curves.easeOutExpo;

const _rose = Color(0xFFFF4D6D);

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
      decoration: BoxDecoration(
        color: _rose,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(count > 99 ? '99+' : '$count', style: body(10, color: Colors.white, weight: FontWeight.w700).copyWith(height: 1)),
    );
  }
}

// ───────────────────────── Шапка ─────────────────────────

/// Кнопка-іконка шапки з лічильником (дзвіночок, повідомлення, тема).
Widget _headerButton(IconData icon, String label, VoidCallback onTap, {int badge = 0}) {
  return Tooltip(
    message: label,
    child: ArcticPressable(
      onTap: onTap,
      scale: 0.9,
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


/// Плаваюча скляна капсула шапки (висота 56, радіус 28, розмиття 28): стрічка пропливає
/// під нею й розмивається. Поля адаптивні — як у доку ([ArcticDock.sidesOf]).
class HeaderCapsule extends StatelessWidget {
  const HeaderCapsule({required this.topInset, required this.child, super.key});
  final double topInset;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: ArcticDock.sidesOf(context).copyWith(top: topInset + headerTopGap, bottom: 4),
      child: ArcticDockSurface(radius: headerCapsuleHeight / 2, height: headerCapsuleHeight, child: child),
    );
  }
}

/// Шапка-капсула: пошук на всю ширину, сповіщення й аватар. На телефоні без логотипа —
/// він лише забирав місце; на планшеті ліворуч лишається назва GameCon.
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
          height: headerCapsuleHeight - 2,
          child: Row(
            children: [
              if (wide) ...[
                GestureDetector(
                  onTap: () => context.go('/feed'),
                  child: SizedBox(width: sideNavWidth, child: Align(alignment: Alignment.centerLeft, child: Wordmark(size: 19))),
                ),
                SizedBox(width: 12),
              ],
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
          height: headerCapsuleHeight - 2,
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
                child: ArcticPressable(
                  key: const ValueKey('music-menu'),
                  onTap: () => showSectionsMenu(context, session, player, path),
                  scale: 0.92,
                  child: Padding(
                    padding: EdgeInsets.all(4),
                    child: IceRingAvatar(child: Avatar(url: text(me['avatar_url']), name: text(me['name']) ?? tr('Я'), size: 34, frame: PlusMark.from(session.subscription.style)?.frame)),
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

/// Поле пошуку в шапці: скляна капсула; від дотику грань плавно спалахує сапфіровим сяйвом,
/// лупа стає акцентною — і відкривається пошук. На сторінці пошуку поле лишається «у фокусі».
class _SearchField extends StatefulWidget {
  @override
  State<_SearchField> createState() => _SearchFieldState();
}

class _SearchFieldState extends State<_SearchField> {
  bool focused = false;

  Future<void> _open() async {
    setState(() => focused = true);
    // Дати сяйву спалахнути, перш ніж екран зміниться.
    await Future<void>.delayed(const Duration(milliseconds: 140));
    if (!mounted) return;
    await context.push('/search');
    if (mounted) setState(() => focused = false);
  }

  @override
  Widget build(BuildContext context) {
    final onSearch = GoRouterState.of(context).uri.path == '/search';
    final active = focused || onSearch;
    final light = palette.isLight;
    final still = MediaQuery.disableAnimationsOf(context);
    return ArcticGlassContainer(
      radius: 20,
      height: 40,
      blur: AppBlur.control,
      glowing: active,
      shadows: const [],
      fill: LinearGradient(colors: light ? const [Color(0xB3FFFFFF), Color(0x8CFFFFFF)] : const [Color(0x14FFFFFF), Color(0x0AFFFFFF)]),
      onTap: _open,
      padding: EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        children: [
          TweenAnimationBuilder<Color?>(
            tween: ColorTween(end: active ? (light ? AppColors.accentPrimary : AppColors.accentCyan) : muted),
            duration: still ? Duration.zero : const Duration(milliseconds: 220),
            builder: (_, color, _) => Icon(LucideIcons.search, color: color, size: 17),
          ),
          SizedBox(width: 8),
          // Коротка підказка — уміщується цілою навіть на вузькому телефоні.
          Expanded(child: Text(tr('Пошук'), maxLines: 1, style: body(13.5, color: muted))),
        ],
      ),
    );
  }
}

/// Аватар у шапці з тонким крижаним кільцем 1.5px.
class IceRingAvatar extends StatelessWidget {
  const IceRingAvatar({required this.child, super.key});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(1.5),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.accentCyan.withValues(alpha: 0.9), AppColors.accentPrimary.withValues(alpha: 0.5)],
        ),
      ),
      child: child,
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
          IceRingAvatar(child: Avatar(url: text(me['avatar_url']), name: text(me['name']) ?? tr('Я'), size: 34)),
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
    backgroundColor: Colors.transparent,
    elevation: 0,
    useSafeArea: true,
    builder: (sheet) => ArcticGlassSheetSurface(child: SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 18, 16, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(tr('Мова'), style: display(17)),
          SizedBox(height: 14),
          LanguagePicker(api: session.api),
        ]),
      ),
    )),
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
    if (value == open) return;
    // Тактильний «клац» у момент фіксації меню (відкрили чи згорнули).
    HapticFeedback.mediumImpact();
    setState(() => open = value);
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
    final next = !open && (drag < -24 || v < -300) ? true : (open && (drag > 48 || v > 400) ? false : open);
    if (next != open) HapticFeedback.mediumImpact();
    setState(() {
      open = next;
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
    final tabItems = [for (final path in tabs) ?navItem(path)];
    final activeTab = tabItems.indexWhere((item) => _isActive(item.path, widget.path, session.username));
    final media = MediaQuery.of(context);
    final systemBottom = media.viewPadding.bottom;
    final maxMenu = media.size.height - media.viewPadding.top - systemBottom - 160;

    final island = AnimatedContainer(
      duration: _motion(context, dragging ? Duration.zero : _snap),
      curve: _snapCurve,
      transform: Matrix4.translationValues(0, drag * 0.22, 0),
      // Плаваючий док із матового скла (радіус 32); розгорнутий — меню розділів, і розмиття
      // плавно густішає, щоб меню читалося над стрічкою.
      child: TweenAnimationBuilder<double>(
        tween: Tween(end: open ? AppBlur.menu : AppBlur.dock),
        duration: _motion(context, _snap),
        curve: _snapCurve,
        builder: (context, blur, child) => ArcticDockSurface(blur: blur, child: child!),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Язичок свайп-меню: компактна крижана капсула; від початку свайпу — сапфірове сяйво.
            Semantics(
              button: true,
              label: open ? tr('Згорнути меню') : tr('Меню'),
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => _set(!open),
                child: SizedBox(
                  height: 12,
                  width: double.infinity,
                  child: Stack(
                    alignment: Alignment.topCenter,
                    children: [
                      AnimatedContainer(
                        margin: const EdgeInsets.only(top: 6),
                        duration: _motion(context, const Duration(milliseconds: 200)),
                        width: 32,
                        height: 3.5,
                        decoration: BoxDecoration(
                          color: dragging || open || restActive
                              ? AppColors.accentCyan.withValues(alpha: palette.isLight ? 0.55 : 0.75)
                              : (palette.isLight ? const Color.fromRGBO(10, 132, 255, 0.25) : const Color.fromRGBO(255, 255, 255, 0.28)),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      if (restBadge > 0 && !open)
                        Positioned(
                          top: 4,
                          left: 0,
                          right: 0,
                          child: Center(child: Transform.translate(offset: const Offset(26, 0), child: Container(width: 7, height: 7, decoration: const BoxDecoration(color: _rose, shape: BoxShape.circle)))),
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
            // Вкладки з перетічною світловою капсулою під активною.
            Padding(
              padding: EdgeInsets.fromLTRB(4, 0, 4, 4),
              child: ArcticDockTabs(
                // Язичок 12 + вкладки 48 + відступ 4 = висота доку 64.
                height: 48,
                items: [
                  for (final item in tabItems) ArcticDockItem(icon: item.icon, activeIcon: item.activeIcon, label: item.label, badge: item.path == '/messages' && session.unreadChats > 0 ? _Badge(session.unreadChats) : null),
                ],
                current: open || activeTab < 0 ? null : activeTab,
                onTap: (i) => _go(tabItems[i].path),
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
            left: ArcticDock.sidesOf(context).left,
            right: ArcticDock.sidesOf(context).right,
            bottom: systemBottom + ArcticDock.bottom,
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
                    // Opacity, а не AnimatedOpacity: на повній видимості без шару прозорості,
                    // інакше розмиття доку не бачило б стрічки під ним.
                    child: TweenAnimationBuilder<double>(
                      key: const ValueKey('bottom-bar-nav'),
                      tween: Tween(end: widget.hidden ? 0 : 1),
                      duration: _motion(context, bottomBarSwap),
                      curve: Curves.easeOutCubic,
                      builder: (context, v, child) => Opacity(opacity: v, child: child),
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
      // Рядки меню з'являються каскадом під час розгортання й пружно стискаються від дотику.
      return ArcticCascade(
        child: ArcticPressable(
          onTap: onTap,
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
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ArcticPressable(
          onTap: () => onGo('/profile'),
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
                return ArcticCascade(
                  child: ArcticPressable(
                  onTap: () => onGo(item.path),
                  scale: 0.92,
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
                  ),
                );
              }),
          ],
        ),
        Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Divider(height: 1, color: line)),
        row(LucideIcons.userPlus, tr('Запросити друзів'), () => onGo('/invite')),
        row(LucideIcons.bookmark, tr('Збережене'), () => onGo('/saved')),
        row(LucideIcons.clock, tr('Прочитати пізніше'), () => onGo('/later')),
        row(LucideIcons.mic, tr('Подкасти'), () => onGo('/podcasts')),
        // Розділи-плагіни сайту — лише якщо ввімкнені (як на сайті).
        if (session.pluginOn('tier_lists')) row(LucideIcons.listOrdered, tr('Тір-листи'), () => onGo('/tierlists')),
        if (session.pluginOn('duels')) row(LucideIcons.swords, tr('Дуелі'), () => onGo('/duels')),
        if (session.pluginOn('ideas_board')) row(LucideIcons.lightbulb, tr('Дошка ідей'), () => onGo('/ideas')),
        if (session.modules?.contains('articles') ?? false) row(LucideIcons.bookOpen, tr('Статті'), () => onGo('/articles')),
        if (session.pluginOn('game_deals') || session.pluginOn('game_giveaways')) row(LucideIcons.badgePercent, tr('Знижки й роздачі'), () => onGo('/games/deals')),
        if (session.pluginOn('game_backlog')) row(LucideIcons.listChecks, tr('Мій беклог'), () => onGo('/games/backlog')),
        if (session.pluginOn('nick_generator')) row(LucideIcons.wandSparkles, tr('Генератор ніків'), () => onGo('/tools/nicknames')),
        row(LucideIcons.filePen, tr('Чернетки'), () => onGo('/drafts')),
        row(LucideIcons.star, tr('Обрані повідомлення'), () => onGo('/starred')),
        row(LucideIcons.panelBottom, tr('Налаштувати нижню панель'), () => onGo('/settings?tab=app')),
        row(LucideIcons.settings, tr('Налаштування'), () => onGo('/settings')),
        row(LucideIcons.bellRing, tr('Сповіщення за словами'), () => onGo('/keyword-alerts')),
        row(LucideIcons.lifeBuoy, tr('Довідка'), () => onGo('/help')),
        row(LucideIcons.headset, tr('Підтримка'), () => onGo('/support')),
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
