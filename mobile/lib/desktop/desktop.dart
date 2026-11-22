import 'dart:async';
import 'dart:io' show Platform, exit;

import 'package:flutter/widgets.dart';
import 'package:tray_manager/tray_manager.dart';
import 'package:window_manager/window_manager.dart';

import '../i18n.dart';
import '../platform.dart';

/// ПК-версія GameCon: власне вікно (мінімальний розмір, назва), значок у треї й робота у фоні —
/// хрестик ховає вікно в трей, як у месенджерах, тож дзвінки, чати й тривоги працюють далі.
class Desktop with WindowListener, TrayListener {
  Desktop._();

  static final Desktop instance = Desktop._();

  /// До runApp: вікно з розміром і назвою, перехоплення закриття, трей.
  static Future<void> init({required void Function(String route) open}) async {
    if (!isDesktop) return;
    await windowManager.ensureInitialized();
    await windowManager.waitUntilReadyToShow(
      const WindowOptions(size: Size(1440, 900), minimumSize: Size(960, 640), center: true, title: 'GameCon'),
      () async {
        await windowManager.show();
        await windowManager.focus();
      },
    );
    await windowManager.setPreventClose(true);
    instance._open = open;
    windowManager.addListener(instance);
    trayManager.addListener(instance);
    await instance._tray();
  }

  void Function(String route)? _open;

  Future<void> _tray() async {
    await trayManager.setIcon(Platform.isWindows ? 'assets/desktop/tray.ico' : 'assets/desktop/tray.png');
    // Підказка над значком є не на всіх системах (у Linux — ні).
    if (!Platform.isLinux) await trayManager.setToolTip('GameCon');
    await trayManager.setContextMenu(Menu(items: [
      MenuItem(key: 'open', label: tr('Відкрити GameCon')),
      MenuItem(key: 'messages', label: tr('Повідомлення')),
      MenuItem(key: 'friends', label: tr('Друзі')),
      MenuItem.separator(),
      MenuItem(key: 'quit', label: tr('Вийти')),
    ]));
  }

  Future<void> show([String? route]) async {
    await windowManager.show();
    await windowManager.focus();
    if (route != null) _open?.call(route);
  }

  @override
  void onWindowClose() => unawaited(windowManager.hide());

  @override
  void onTrayIconMouseDown() => unawaited(show());

  @override
  void onTrayIconRightMouseDown() => unawaited(trayManager.popUpContextMenu());

  @override
  void onTrayMenuItemClick(MenuItem menuItem) {
    switch (menuItem.key) {
      case 'open':
        unawaited(show());
      case 'messages':
        unawaited(show('/messages'));
      case 'friends':
        unawaited(show('/friends'));
      case 'quit':
        unawaited(windowManager.destroy().whenComplete(() => exit(0)));
    }
  }
}
