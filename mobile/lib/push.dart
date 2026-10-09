import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'shell.dart';
import 'state.dart';
import 'theme.dart';
import 'voice_room.dart';
import 'i18n.dart';

final _messages = AndroidNotificationChannel(
  'messages',
  tr('Повідомлення'),
  description: tr('Нові повідомлення в особистих і групових чатах'),
  importance: Importance.high,
);
final _activity = AndroidNotificationChannel(
  'activity',
  tr('Сповіщення'),
  description: tr('Лайки, коментарі, заявки в друзі, події сімей і спільнот'),
  importance: Importance.high,
);

/// Вхідні дзвінки: максимальна важливість, мелодія дзвінка телефону, показ поверх екрана блокування.
final _calls = AndroidNotificationChannel(
  'calls',
  tr('Дзвінки'),
  description: tr('Вхідні особисті й групові дзвінки'),
  importance: Importance.max,
  sound: UriAndroidNotificationSound('content://settings/system/ringtone'),
  audioAttributesUsage: AudioAttributesUsage.notificationRingtone,
);

const _initSettings = InitializationSettings(
  android: AndroidInitializationSettings('ic_notification'),
  iOS: DarwinInitializationSettings(requestAlertPermission: false, requestBadgePermission: false, requestSoundPermission: false),
);

/// Чати приходять як data-повідомлення (див. `PushDevice::local_render`), тож показуємо їх самі:
/// і коли застосунок у фоні, і коли процес уже вивантажено.
@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  DartPluginRegistrant.ensureInitialized();
  await Firebase.initializeApp();
  final type = message.data['type'];
  if (message.notification != null || !['message', 'call', 'call_ended'].contains(type)) return;
  final local = FlutterLocalNotificationsPlugin();
  await local.initialize(settings: _initSettings, onDidReceiveBackgroundNotificationResponse: notificationActionInBackground);
  if (type == 'message') {
    await ChatNotifications(local, await SharedPreferences.getInstance()).incoming(message.data);
  } else {
    await CallNotifications(local).incoming(message.data);
  }
}

/// «Відповісти» / «Прочитано» з шторки, коли інтерфейс застосунку не запущено.
@pragma('vm:entry-point')
Future<void> notificationActionInBackground(NotificationResponse response) async {
  DartPluginRegistrant.ensureInitialized();
  final local = FlutterLocalNotificationsPlugin();
  await local.initialize(settings: _initSettings);
  if (await CallNotifications(local).act(response)) return;
  await ChatNotifications(local, await SharedPreferences.getInstance()).act(response);
}

/// Що відкрити при натисканні: локальні сповіщення несуть JSON, старі — просто шлях.
String? _urlOf(String? payload) {
  if (payload == null || payload.isEmpty) return null;
  if (!payload.startsWith('{')) return payload;
  try {
    return text((jsonDecode(payload) as Map)['url']);
  } catch (_) {
    return null;
  }
}

/// Вхідний дзвінок у шторці: «Відповісти» відкриває застосунок і підключає розмову,
/// «Відхилити» спрацьовує без відкриття. Дзвонить, доки не відповіли, або 45 секунд.
class CallNotifications {
  CallNotifications(this.local);
  final FlutterLocalNotificationsPlugin local;

  static int idFor(String call) => 'call-$call'.hashCode & 0x7fffffff;

  Future<void> incoming(Map<String, dynamic> data) async {
    final call = text(data['call_id']);
    if (call == null) return;
    if (data['type'] == 'call_ended') {
      await local.cancel(id: idFor(call), tag: 'call-$call');
      return;
    }
    final group = data['group'] == '1';
    await local.show(
      id: idFor(call),
      title: text(data['title']) ?? text(data['caller']) ?? tr('Дзвінок'),
      body: text(data['body']) ?? (group ? tr('Груповий дзвінок') : tr('Вхідний дзвінок')),
      payload: jsonEncode({...data, 'kind': 'call'}),
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          _calls.id,
          _calls.name,
          channelDescription: _calls.description,
          importance: Importance.max,
          priority: Priority.max,
          category: AndroidNotificationCategory.call,
          fullScreenIntent: true,
          ongoing: true,
          autoCancel: false,
          timeoutAfter: 45000,
          // FLAG_INSISTENT: мелодія повторюється, доки дзвінок не прийняли чи не відхилили.
          additionalFlags: Int32List.fromList([4]),
          audioAttributesUsage: AudioAttributesUsage.notificationRingtone,
          icon: 'ic_notification',
          color: primary,
          tag: 'call-$call',
          actions: [
            AndroidNotificationAction('call_decline', tr('Відхилити'), titleColor: danger),
            AndroidNotificationAction('call_accept', tr('Відповісти'), titleColor: green, showsUserInterface: true),
          ],
        ),
      ),
    );
  }

  /// Дані дзвінка з натиснутого сповіщення (null — це не дзвінок).
  static Map<String, dynamic>? payloadOf(NotificationResponse response) {
    try {
      final data = Map<String, dynamic>.from(jsonDecode(response.payload ?? '') as Map);
      return data['kind'] == 'call' ? data : null;
    } catch (_) {
      return null;
    }
  }

  /// «Відхилити» без відкриття застосунку. Повертає true, якщо дію оброблено.
  Future<bool> act(NotificationResponse response) async {
    final data = payloadOf(response);
    if (data == null || response.actionId != 'call_decline') return false;
    final call = text(data['call_id']);
    if (call == null) return true;
    await local.cancel(id: idFor(call), tag: 'call-$call');
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final token = prefs.getString('token');
    if (token != null) await Api(() => token).post('/api/v1/calls/$call/decline').catchError((_) => <String, dynamic>{});
    return true;
  }
}

/// Сповіщення бесід у стилі месенджера: історія останніх реплік, відповідь просто з шторки.
class ChatNotifications {
  ChatNotifications(this.local, this.prefs);
  final FlutterLocalNotificationsPlugin local;
  final SharedPreferences prefs;

  static final _historyLimit = 8;

  static int idFor(String conversation) => 'chat-$conversation'.hashCode & 0x7fffffff;

  String _key(String conversation) => 'push.chat.$conversation';

  List<Map<String, dynamic>> _history(String conversation) {
    try {
      return maps(jsonDecode(prefs.getString(_key(conversation)) ?? '[]'));
    } catch (_) {
      return [];
    }
  }

  Future<void> _remember(String conversation, Map<String, dynamic> line) async {
    final history = [..._history(conversation), line];
    await prefs.setString(_key(conversation), jsonEncode(history.length > _historyLimit ? history.sublist(history.length - _historyLimit) : history));
  }

  Future<void> incoming(Map<String, dynamic> data) async {
    final conversation = text(data['conversation_id']);
    if (conversation == null) return;
    await prefs.reload();
    await _remember(conversation, {
      'author': text(data['author']) ?? text(data['title']) ?? 'GameCon',
      'text': text(data['text']) ?? text(data['body']) ?? '',
      'at': DateTime.now().millisecondsSinceEpoch,
    });
    await _render(conversation, data, alert: true);
  }

  Future<void> _render(String conversation, Map<String, dynamic> data, {required bool alert}) async {
    final history = _history(conversation);
    if (history.isEmpty) return;
    final group = data['group'] == '1' || data['group'] == true;
    final title = text(data['title']) ?? 'GameCon';
    final me = Person(name: tr('Ви'), key: 'me');
    final payload = jsonEncode({
      'url': text(data['url']) ?? '/messages/$conversation',
      'conversation_id': conversation,
      'message_id': text(data['message_id']),
      'title': title,
      'group': group ? '1' : '0',
    });
    await local.show(
      id: idFor(conversation),
      title: title,
      body: text(history.last['text']),
      payload: payload,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          _messages.id,
          _messages.name,
          channelDescription: _messages.description,
          importance: Importance.high,
          priority: Priority.high,
          icon: 'ic_notification',
          color: primary,
          tag: 'chat-$conversation',
          category: AndroidNotificationCategory.message,
          onlyAlertOnce: !alert,
          silent: !alert,
          styleInformation: MessagingStyleInformation(
            me,
            conversationTitle: group ? title : null,
            groupConversation: group,
            messages: [
              for (final line in history)
                Message(
                  '${line['text']}',
                  DateTime.fromMillisecondsSinceEpoch((line['at'] as num?)?.toInt() ?? 0),
                  line['me'] == true ? me : Person(name: '${line['author']}', key: '${line['author']}'),
                ),
            ],
          ),
          actions: [
            AndroidNotificationAction(
              'reply',
              tr('Відповісти'),
              inputs: [AndroidNotificationActionInput(label: tr('Повідомлення'))],
              allowGeneratedReplies: true,
              cancelNotification: false,
              semanticAction: SemanticAction.reply,
            ),
            AndroidNotificationAction('read', tr('Прочитано'), semanticAction: SemanticAction.markAsRead),
          ],
        ),
      ),
    );
  }

  Future<void> clear(String conversation) async {
    await prefs.remove(_key(conversation));
    await local.cancel(id: idFor(conversation), tag: 'chat-$conversation');
  }

  /// Обробляє кнопки сповіщення. Повертає true, якщо це була дія без відкриття застосунку.
  Future<bool> act(NotificationResponse response) async {
    final action = response.actionId;
    if (action != 'reply' && action != 'read') return false;
    final Map<String, dynamic> data;
    try {
      data = Map<String, dynamic>.from(jsonDecode(response.payload ?? '{}') as Map);
    } catch (_) {
      return true;
    }
    final conversation = text(data['conversation_id']);
    await prefs.reload();
    final token = prefs.getString('token');
    if (conversation == null || token == null) return true;
    final api = Api(() => token);
    final messageId = int.tryParse('${data['message_id']}');

    if (action == 'read') {
      if (messageId != null) await api.post('/api/v1/messages/$conversation/read', {'message_id': messageId}).catchError((_) => <String, dynamic>{});
      await clear(conversation);
      return true;
    }

    final reply = response.input?.trim() ?? '';
    if (reply.isEmpty) return true;
    try {
      await api.post('/api/v1/messages/$conversation', {'body': reply});
      if (messageId != null) unawaited(api.post('/api/v1/messages/$conversation/read', {'message_id': messageId}).catchError((_) => <String, dynamic>{}));
      await _remember(conversation, {'author': tr('Ви'), 'text': reply, 'me': true, 'at': DateTime.now().millisecondsSinceEpoch});
    } catch (e) {
      await _remember(conversation, {'author': 'GameCon', 'text': tr('Не надіслано: {reply}', {'reply': reply}), 'at': DateTime.now().millisecondsSinceEpoch});
    }
    await _render(conversation, data, alert: false);
    return true;
  }
}

/// Push-сповіщення: ті самі події, що й дзвіночок сайту, плюс нові повідомлення чатів.
///
/// - Сервер шле через FCM HTTP v1 (`PushNotifier`), токен пристрою реєструється в `/api/v1/push/devices`
///   після входу; вихід видаляє API-токен, а разом із ним і пристрій.
/// - Сповіщення сайту показує система; чати — сам застосунок (з відповіддю з шторки).
/// - Натискання відкриває той екран, звідки сповіщення (бесіда, допис, сім’я…).
class Push {
  Push(this.session, this.router);

  final Session session;
  final GoRouter router;

  final _local = FlutterLocalNotificationsPlugin();
  late final _chats = ChatNotifications(_local, session.prefs);
  late final _callNotes = CallNotifications(_local);
  bool _ready = false;
  String? _registeredFor;
  StreamSubscription<String>? _refresh;

  static Push? instance;

  Future<void> start() async {
    if (kIsWeb || !(Platform.isAndroid || Platform.isIOS)) return;
    try {
      await Firebase.initializeApp();
    } catch (e) {
      debugPrint('Firebase недоступний: $e');
      return;
    }
    instance = this;
    _ready = true;
    FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);

    await _local.initialize(
      settings: _initSettings,
      onDidReceiveNotificationResponse: (response) async {
        if (await _callNotes.act(response)) return;
        if (_answer(response)) return;
        if (await _chats.act(response)) return;
        _open(response.payload);
      },
      onDidReceiveBackgroundNotificationResponse: notificationActionInBackground,
    );
    final android = _local.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await android?.createNotificationChannel(_messages);
    await android?.createNotificationChannel(_activity);
    await android?.createNotificationChannel(_calls);

    await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(alert: false, badge: true, sound: false);
    FirebaseMessaging.onMessage.listen(_foreground);
    FirebaseMessaging.onMessageOpenedApp.listen((message) => _open(message.data['url']));

    // Застосунок запущено натисканням на push або локальне сповіщення.
    final initial = await FirebaseMessaging.instance.getInitialMessage();
    final launch = await _local.getNotificationAppLaunchDetails();
    final response = launch?.didNotificationLaunchApp == true ? launch?.notificationResponse : null;
    if (response != null && response.actionId == 'call_accept') {
      WidgetsBinding.instance.addPostFrameCallback((_) => _answer(response));
    }
    final url = initial?.data['url'] ?? (response != null && response.actionId == null ? response.payload : null);
    if (url != null) WidgetsBinding.instance.addPostFrameCallback((_) => _open(url));

    session.addListener(_sync);
    await _sync();
  }

  /// Бесіду відкрито — прибираємо її сповіщення й історію.
  Future<void> seenChat(int conversation) async {
    if (_ready) await _chats.clear('$conversation');
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
    await session.api.post('/api/v1/push/devices', {'token': token, 'platform': Platform.isIOS ? 'ios' : 'android', 'local_render': Platform.isAndroid});
  }

  String get _location => router.routerDelegate.currentConfiguration.uri.path;

  Future<void> _foreground(RemoteMessage message) async {
    unawaited(session.refreshCounters());
    final data = message.data;
    final url = data['url'];
    if (data['type'] == 'call' || data['type'] == 'call_ended') {
      // Уже в цій розмові — не дзвонимо.
      if (data['type'] == 'call' && VoiceCall.instance.callId == int.tryParse('${data['call_id']}')) return;
      await _callNotes.incoming(data);
      return;
    }
    final chat = data['type'] == 'message';
    // Бесіда вже відкрита — повідомлення й так з’явиться на екрані.
    if (chat && url != null && _location == url) return;

    final note = message.notification;
    if (chat && note == null) {
      await _chats.incoming(data);
      return;
    }
    if (note == null) return;
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

  /// «Відповісти» на вхідний дзвінок: відкриваємо бесіду й підключаємо розмову.
  bool _answer(NotificationResponse response) {
    final data = CallNotifications.payloadOf(response);
    if (data == null) return false;
    final call = int.tryParse('${data['call_id']}');
    final conversation = int.tryParse('${data['conversation_id']}');
    if (call == null || conversation == null || session.token == null) return true;
    unawaited(_local.cancel(id: CallNotifications.idFor('$call'), tag: 'call-$call'));
    final target = '/messages/$conversation';
    if (_location != target) router.push(target);
    if (response.actionId == 'call_accept') {
      final title = text(data['title']) ?? text(data['caller']) ?? tr('Дзвінок');
      unawaited(VoiceCall.instance.answer(session.api, call, conversation, title));
    }
    return true;
  }

  void _open(String? payload) {
    final url = _urlOf(payload);
    if (url == null || url.isEmpty || session.token == null) return;
    unawaited(session.refreshCounters());
    final target = appPathFor(url);
    final chat = RegExp(r'^/messages/(\d+)').firstMatch(target);
    if (chat != null) unawaited(seenChat(int.parse(chat.group(1)!)));
    if (_location == target) return;
    router.push(target);
  }
}
