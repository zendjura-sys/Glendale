import 'dart:async';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:go_router/go_router.dart';

import 'shell.dart';
import 'state.dart';
import 'theme.dart';

/// Фонові push-и з `notification` Android показує сам; тут лише ініціалізуємо Firebase.
@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

/// Push-сповіщення: ті самі події, що й дзвіночок сайту, плюс нові повідомлення чатів.
///
/// - Сервер шле через FCM HTTP v1 (`PushNotifier`), токен пристрою реєструється в `/api/v1/push/devices`
///   після входу; вихід видаляє API-токен, а разом із ним і пристрій.
/// - Закритий/згорнутий застосунок: сповіщення показує система, натискання відкриває потрібний екран.
/// - Відкритий застосунок: показуємо локальне сповіщення (крім чату, який зараз на екрані)
///   й одразу оновлюємо лічильники дзвіночка та «Чатів».
class Push {
  Push(this.session, this.router);

  final Session session;
  final GoRouter router;

  static const _messages = AndroidNotificationChannel(
    'messages',
    'Повідомлення',
    description: 'Нові повідомлення в особистих і групових чатах',
    importance: Importance.high,
  );
  static const _activity = AndroidNotificationChannel(
    'activity',
    'Сповіщення',
    description: 'Лайки, коментарі, заявки в друзі, події сімей і спільнот',
    importance: Importance.high,
  );

  final _local = FlutterLocalNotificationsPlugin();
  bool _ready = false;
  String? _registeredFor;
  StreamSubscription<String>? _refresh;

  Future<void> start() async {
    if (kIsWeb || !(Platform.isAndroid || Platform.isIOS)) return;
    try {
      await Firebase.initializeApp();
    } catch (e) {
      debugPrint('Firebase недоступний: $e');
      return;
    }
    _ready = true;
    FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);

    await _local.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('ic_notification'),
        iOS: DarwinInitializationSettings(requestAlertPermission: false, requestBadgePermission: false, requestSoundPermission: false),
      ),
      onDidReceiveNotificationResponse: (response) => _open(response.payload),
    );
    final android = _local.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await android?.createNotificationChannel(_messages);
    await android?.createNotificationChannel(_activity);

    await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(alert: false, badge: true, sound: false);
    FirebaseMessaging.onMessage.listen(_foreground);
    FirebaseMessaging.onMessageOpenedApp.listen((message) => _open(message.data['url']));

    // Застосунок запущено натисканням на push або локальне сповіщення.
    final initial = await FirebaseMessaging.instance.getInitialMessage();
    final launch = await _local.getNotificationAppLaunchDetails();
    final url = initial?.data['url'] ?? (launch?.didNotificationLaunchApp == true ? launch?.notificationResponse?.payload : null);
    if (url != null) WidgetsBinding.instance.addPostFrameCallback((_) => _open(url));

    session.addListener(_sync);
    await _sync();
  }

  /// Реєструє пристрій для поточного акаунта (і повторно — після входу в інший).
  Future<void> _sync() async {
    if (!_ready) return;
    final user = session.token == null ? null : session.username;
    if (user == null) {
      _registeredFor = null;
      await _refresh?.cancel();
      _refresh = null;
      return;
    }
    if (_registeredFor == user) return;
    _registeredFor = user;
    try {
      final settings = await FirebaseMessaging.instance.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await _register(token);
      await _refresh?.cancel();
      _refresh = FirebaseMessaging.instance.onTokenRefresh.listen(_register);
    } catch (e) {
      _registeredFor = null;
      debugPrint('Push-реєстрація не вдалася: $e');
    }
  }

  Future<void> _register(String token) async {
    if (session.token == null) return;
    await session.api.post('/api/v1/push/devices', {'token': token, 'platform': Platform.isIOS ? 'ios' : 'android'});
  }

  String get _location => router.routerDelegate.currentConfiguration.uri.path;

  Future<void> _foreground(RemoteMessage message) async {
    unawaited(session.refreshCounters());
    final data = message.data;
    final url = data['url'];
    // Бесіда вже відкрита — повідомлення й так з’явиться на екрані.
    if (data['type'] == 'message' && url != null && _location == url) return;

    final note = message.notification;
    if (note == null) return;
    final chat = data['type'] == 'message';
    final channel = chat ? _messages : _activity;
    final tag = chat ? 'chat-${data['conversation_id']}' : null;
    await _local.show(
      id: (tag ?? message.messageId ?? '${DateTime.now().millisecondsSinceEpoch}').hashCode & 0x7fffffff,
      title: note.title,
      body: note.body,
      payload: url,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          channel.id,
          channel.name,
          channelDescription: channel.description,
          importance: Importance.high,
          priority: Priority.high,
          icon: 'ic_notification',
          color: primary,
          tag: tag,
          styleInformation: BigTextStyleInformation(note.body ?? ''),
        ),
        iOS: const DarwinNotificationDetails(presentAlert: true, presentSound: true, threadIdentifier: 'gamecon'),
      ),
    );
  }

  void _open(String? url) {
    if (url == null || url.isEmpty || session.token == null) return;
    unawaited(session.refreshCounters());
    router.push(appPathFor(url));
  }
}
