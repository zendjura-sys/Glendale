import 'dart:async';
import 'dart:io' show Platform;

import 'package:fluent_ui/fluent_ui.dart';
import 'package:flutter/material.dart' as m;
import 'package:flutter_acrylic/flutter_acrylic.dart' as acrylic;
import 'package:go_router/go_router.dart';
import 'package:window_manager/window_manager.dart';

import '../i18n.dart';
import '../nav_items.dart';
import '../state.dart';
import '../widgets.dart' show ShellChrome;

/// GameCon для Windows — власний стиль у дусі Windows 11 (Fluent Design), не копія сайту чи Android:
/// напівпрозоре вікно Mica (тло робочого столу просвічує), бічна навігація Fluent, своя смуга
/// заголовка з кнопками вікна й модульна головна (lib/desktop/modules.dart), яку людина складає сама.
class DesktopShell extends StatelessWidget {
  const DesktopShell({required this.session, required this.player, required this.child, super.key});
  final Session session;
  final TrackPlayer player;
  final Widget child;

  /// До runApp: прозоре тло вікна під Mica (Windows 11) чи Acrylic (Windows 10).
  static Future<void> initEffects() async {
    try {
      await acrylic.Window.initialize();
      await acrylic.Window.setEffect(effect: Platform.isWindows ? acrylic.WindowEffect.mica : acrylic.WindowEffect.transparent, dark: true);
    } catch (_) {
      // Ефект недоступний (Linux, стара Windows) — суцільне темне тло.
    }
  }

  static const accent = Color(0xFF6B8AFD);

  static FluentThemeData theme() => FluentThemeData(
        brightness: Brightness.dark,
        accentColor: AccentColor.swatch(const {'normal': accent, 'dark': Color(0xFF4F6BE0), 'darker': Color(0xFF3D55C2), 'light': Color(0xFF8FA6FF), 'lighter': Color(0xFFB3C3FF)}),
        // Прозоре тло — Mica з Windows просвічує крізь вікно.
        scaffoldBackgroundColor: Colors.transparent,
        micaBackgroundColor: Colors.transparent,
        navigationPaneTheme: const NavigationPaneThemeData(backgroundColor: Colors.transparent),
        visualDensity: VisualDensity.standard,
        fontFamily: 'Onest',
      );

  @override
  Widget build(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    final sections = [
      (path: '/home', label: tr('Головна'), icon: FluentIcons.home),
      for (final item in visibleNav(session.modules)) (path: item.path, label: item.title, icon: _icon(item.path)),
    ];
    final index = sections.indexWhere((s) => path == s.path || path.startsWith('${s.path}/'));
    return AppScope(
      session: session,
      player: player,
      child: FluentTheme(
        data: theme(),
        // Mica — лише у Windows 11; деінде темний градієнт GameCon під напівпрозорими поверхнями.
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: Platform.isWindows ? null : const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF1B1E2B), Color(0xFF101118), Color(0xFF1A1530)]),
          ),
          child: NavigationView(
          titleBar: TitleBar(
            isBackButtonVisible: false,
            height: 40,
            title: const DragToMoveArea(child: Align(alignment: AlignmentDirectional.centerStart, child: Text('GameCon'))),
            captionControls: const _WindowButtons(),
          ),
          pane: NavigationPane(
            selected: index < 0 ? null : index,
            displayMode: PaneDisplayMode.auto,
            size: const NavigationPaneSize(openMaxWidth: 248),
            onChanged: (i) => context.go(sections[i].path),
            items: [
              for (final s in sections) PaneItem(icon: Icon(s.icon), title: Text(s.label), body: const SizedBox.shrink()),
            ],
            footerItems: [
              PaneItemSeparator(),
              PaneItemAction(icon: const Icon(FluentIcons.settings), title: Text(tr('Налаштування')), onTap: () => context.go('/settings')),
            ],
          ),
          // Розділи — справжні екрани GameCon у панелі Fluent (без верхньої шапки й нижнього острова телефона).
          paneBodyBuilder: (_, _) => m.Material(
            type: m.MaterialType.transparency,
            // Текст у модулях і екранах — світлий на напівпрозорому темному тлі.
            child: DefaultTextStyle.merge(style: const TextStyle(color: Color(0xFFF4F5F8)), child: ShellChrome(bottom: 16, child: child)),
          ),
        ),
        ),
      ),
    );
  }

  static IconData _icon(String path) => switch (path) {
        '/feed' => FluentIcons.news,
        '/messages' => FluentIcons.chat,
        '/friends' => FluentIcons.people,
        '/profile' => FluentIcons.contact,
        '/communities' => FluentIcons.group,
        '/music' => FluentIcons.music_note,
        '/cinema' => FluentIcons.my_movies_t_v,
        '/games' => FluentIcons.game,
        '/servers' => FluentIcons.server,
        '/clans' => FluentIcons.shield,
        '/family' || '/families' => FluentIcons.family,
        '/photos' => FluentIcons.photo2,
        '/shows' || '/gamecast' => FluentIcons.microphone,
        '/livecast' => FluentIcons.streaming,
        '/alerts' => FluentIcons.warning,
        '/quests' => FluentIcons.trophy2,
        '/phone' => FluentIcons.phone,
        '/people' => FluentIcons.search,
        '/events' => FluentIcons.calendar,
        '/party' => FluentIcons.add_group,
        '/moments' => FluentIcons.camera,
        '/cards' => FluentIcons.photo_collection,
        '/saved' => FluentIcons.bookmarks,
        '/menu' => FluentIcons.more,
        _ => FluentIcons.app_icon_default,
      };
}

/// Кнопки вікна в стилі Windows 11: згорнути, розгорнути, закрити (закрити — у трей).
class _WindowButtons extends StatelessWidget {
  const _WindowButtons();

  @override
  Widget build(BuildContext context) {
    Widget button(IconData icon, VoidCallback onTap, {bool close = false}) => _CaptionButton(icon: icon, onTap: onTap, close: close);
    return Row(mainAxisAlignment: MainAxisAlignment.end, children: [
      button(FluentIcons.chrome_minimize, () => unawaited(windowManager.minimize())),
      button(FluentIcons.checkbox, () async => await windowManager.isMaximized() ? windowManager.unmaximize() : windowManager.maximize()),
      button(FluentIcons.chrome_close, () => unawaited(windowManager.close()), close: true),
    ]);
  }
}

class _CaptionButton extends StatefulWidget {
  const _CaptionButton({required this.icon, required this.onTap, required this.close});
  final IconData icon;
  final VoidCallback onTap;
  final bool close;

  @override
  State<_CaptionButton> createState() => _CaptionButtonState();
}

class _CaptionButtonState extends State<_CaptionButton> {
  bool hover = false;

  @override
  Widget build(BuildContext context) => MouseRegion(
        onEnter: (_) => setState(() => hover = true),
        onExit: (_) => setState(() => hover = false),
        child: GestureDetector(
          onTap: widget.onTap,
          child: Container(
            width: 46,
            height: 40,
            color: hover ? (widget.close ? const Color(0xFFC42B1C) : const Color(0x14FFFFFF)) : Colors.transparent,
            child: Icon(widget.icon, size: 11, color: Colors.white),
          ),
        ),
      );
}
