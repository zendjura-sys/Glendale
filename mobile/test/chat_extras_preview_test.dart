// Чат: закріплені, нотатка, гілка й фото на один перегляд — з підставленими відповідями. Знімки — GC_SHOTS=dir.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/account.dart';
import 'package:gamecon/chat.dart';
import 'package:gamecon/chat_extras.dart';
import 'package:gamecon/shell.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fonts.dart';

Map<String, dynamic> _user(int id, String name) => {'id': id, 'username': 'u$id', 'name': name, 'first_name': name.split(' ').first, 'avatar_url': null};
final _requests = <String>[];

Map<String, dynamic> _msg(int id, int user, String name, String? body, {Map<String, dynamic>? thread, List<Map<String, dynamic>> attachments = const [], List<Map<String, dynamic>> reactions = const []}) => {
  'id': id, 'conversation_id': 5, 'type': 'text', 'body': body, 'user': _user(user, name), 'reply_to': null, 'preview': body ?? 'Фото',
  'attachments': attachments, 'created_at': '2026-10-31T18:${10 + id}:00Z', 'edited_at': null, 'reactions': reactions, 'thread': thread, 'thread_root_id': null,
};

Map<String, dynamic> _respond(http.Request request) {
  final p = request.url.path;
  _requests.add('${request.method} $p');
  if (p.endsWith('/thread')) {
    return {
      'root': _msg(2, 2, 'Олег Коваль', 'Хто сьогодні в рейд?', thread: {'count': 2}),
      'messages': [_msg(10, 3, 'Ірина Мельник', 'Я о 20:00'), _msg(11, 1, 'Тоні Старк', 'Беру хіла')],
    };
  }
  if (p.endsWith('/api/v1/messages/5')) {
    return {
      'conversation': {
        'id': 5, 'type': 'group', 'title': 'Рейд у п’ятницю', 'avatar_url': null, 'peer': null, 'can_write': true, 'is_muted': false, 'my_role': 'owner', 'members_count': 4,
        'read_up_to': 0, 'members': [], 'can_pin': true, 'note': 'Збір о 19:45 у Discord',
        'pins': [{'id': 2, 'preview': 'Хто сьогодні в рейд?', 'author': 'Олег'}, {'id': 1, 'preview': 'Правила рейду', 'author': 'Тоні'}],
      },
      'history': {
        'has_more': false,
        'messages': [
          _msg(1, 1, 'Тоні Старк', 'Правила рейду: без AFK, мікрофон обов’язково.'),
          _msg(2, 2, 'Олег Коваль', 'Хто сьогодні в рейд?', thread: {'count': 2, 'last_at': '2026-10-31T18:30:00Z'}),
          _msg(3, 3, 'Ірина Мельник', null, attachments: [{'id': 7, 'type': 'image', 'url': null, 'view_once': true, 'viewed_by': [], 'width': 100, 'height': 100}]),
        ],
      },
    };
  }
  return {'ok': true};
}

void main() {
  test('бот, гість і право банити гостя', () {
    expect(messageIsBot({'bot': {'name': 'ШІ'}}), isTrue);
    expect(messageIsBot({'is_bot': true}), isTrue);
    expect(messageIsBot({'bot': true}), isTrue);
    expect(messageIsBot({'user': {'is_bot': true, 'name': 'Вітання'}}), isTrue);
    expect(messageIsBot({'body': 'привіт', 'user': {'id': 2, 'name': 'Олег'}}), isFalse);
    expect(messageBotName({'bot': {'name': 'ШІ'}}), 'ШІ');
    expect(messageBotName({'is_bot': true}), 'Бот');
    expect(messageIsGuest({'guest': {'name': 'Мандрівник'}}), isTrue);
    expect(messageIsGuest({'is_guest': true}), isTrue);
    expect(messageIsGuest({'user': {'id': 2}}), isFalse);
    expect(conversationIsGuestOrSupport({'guest_chat': true, 'type': 'group'}), isTrue);
    expect(conversationIsGuestOrSupport({'support': true, 'type': 'direct'}), isTrue);
    expect(conversationIsGuestOrSupport({'type': 'support'}), isTrue);
    expect(conversationIsGuestOrSupport({'kind': 'guest'}), isTrue);
    expect(conversationIsGuestOrSupport({'guest_chat': false, 'type': 'group'}), isFalse);
    expect(conversationIsGuestOrSupport({'community_channel_id': 4}), isTrue);

    const guest = {'guest': {'name': 'Мандрівник'}};
    expect(canOfferGuestBan({'guest_chat': true, 'can_ban_guest': true, 'type': 'group'}, guest, ipBansOn: true, isAdmin: false, myRole: 'member'), isTrue);
    expect(canOfferGuestBan({'guest_chat': false, 'can_ban_guest': true, 'type': 'direct'}, guest, ipBansOn: true, isAdmin: true, myRole: 'member'), isFalse);
    expect(canOfferGuestBan({'guest_chat': true, 'can_ban_guest': false, 'type': 'group'}, guest, ipBansOn: true, isAdmin: false, myRole: 'owner'), isFalse);
    expect(canOfferGuestBan({'type': 'group'}, guest, ipBansOn: true, isAdmin: false, myRole: 'owner'), isTrue);
    expect(canOfferGuestBan({'guest_chat': true, 'can_ban_guest': true}, {'body': 'привіт', 'user': {'id': 2}}, ipBansOn: true, isAdmin: true), isFalse);
    expect(canOfferGuestBan({'support': true, 'can_ban_guest': true, 'type': 'direct'}, guest, ipBansOn: false, isAdmin: true), isFalse);
  });

  final out = Platform.environment['GC_SHOTS'];

  setUpAll(() async {
    // Запис голосу в тесті не потрібен: заглушка нативного каналу.
    TestWidgetsFlutterBinding.ensureInitialized();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(const MethodChannel('com.llfbandit.record/messages'), (_) async => null);
    if (out == null) return;
    await loadTestFonts();
  });

  for (final light in [false, true]) {
    final label = 'chat-extras-${light ? 'light' : 'dark'}';
    testWidgets('чат із закріпленими, нотаткою, гілкою: $label', (tester) async {
      await http.runWithClient(() async {
        SharedPreferences.setMockInitialValues({'whats_new': whatsNewVersion});
        final prefs = await SharedPreferences.getInstance();
        palette = light ? arcticPalette : neonPalette;
        addTearDown(() => palette = neonPalette);
        final session = Session(prefs)..me = {'id': 1, 'name': 'Тоні Старк', 'first_name': 'Тоні', 'username': 'tonny', 'role': 'user', 'plugins': {'chat_pins': true, 'chat_notes': true, 'chat_threads': true, 'view_once': true}};
        tester.view.physicalSize = const Size(1170, 2532);
        tester.view.devicePixelRatio = 3;
        tester.view.padding = const FakeViewPadding(top: 120, bottom: 60);
        addTearDown(tester.view.reset);
        final router = GoRouter(initialLocation: '/messages/5', routes: [
          ShellRoute(
            builder: (_, _, child) => AppShell(session: session, player: TrackPlayer()..session = session, child: child),
            routes: [GoRoute(path: '/messages/5', builder: (_, _) => const ChatScreen(id: 5))],
          ),
        ]);
        final key = GlobalKey();
        await tester.pumpWidget(RepaintBoundary(key: key, child: MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router)));
        for (var i = 0; i < 8; i++) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        expect(find.text('Закріплене 1 з 2'), findsOneWidget);
        expect(find.text('Збір о 19:45 у Discord'), findsOneWidget);
        expect(find.text('2 відп. у гілці'), findsOneWidget);
        expect(find.text('Фото · відкрити один раз'), findsOneWidget);

        Future<void> shot(String name) async {
          if (out == null) return;
          await tester.runAsync(() async {
            final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
            final image = await boundary.toImage(pixelRatio: 1);
            final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
            File('$out/$name.png').writeAsBytesSync(bytes!.buffer.asUint8List());
          });
        }

        await shot(label);
        await tester.tap(find.text('2 відп. у гілці'));
        for (var i = 0; i < 8; i++) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        expect(find.text('Беру хіла'), findsOneWidget);
        expect(_requests, contains('GET /api/v1/site/messages/5/messages/2/thread'));
        await shot('$label-thread');
        await tester.pumpWidget(const SizedBox());
        await tester.pump(const Duration(seconds: 5));
      }, () => MockClient((request) async => http.Response(jsonEncode(_respond(request)), 200, headers: {'content-type': 'application/json; charset=utf-8'})));
    });
  }

  testWidgets('реакції: чіп, додати інший емодзі й зняти тапом', (tester) async {
    final calls = <String>[];
    var current = '🔥';
    Map<String, dynamic> respond(http.Request request) {
      calls.add('${request.method} ${request.url.path} ${request.body}');
      if (request.url.path.endsWith('/react')) {
        final body = jsonDecode(request.body) as Map;
        final emoji = body['emoji'];
        current = emoji == null || emoji == current ? '' : '$emoji';
        return {
          'message': _msg(2, 2, 'Олег Коваль', 'Хто сьогодні в рейд?', reactions: [
            if (current.isNotEmpty) {'emoji': current, 'count': 1, 'user_ids': [1]},
          ]),
        };
      }
      if (request.url.path.endsWith('/api/v1/messages/5')) {
        return {
          'conversation': {
            'id': 5, 'type': 'direct', 'title': 'Олег Коваль', 'avatar_url': null, 'peer': _user(2, 'Олег Коваль'),
            'can_write': true, 'is_muted': false, 'read_up_to': 0,
          },
          'history': {
            'has_more': false,
            'messages': [
              _msg(2, 2, 'Олег Коваль', 'Хто сьогодні в рейд?', reactions: [
                {'emoji': '🔥', 'count': 2, 'user_ids': [1, 2]},
              ]),
            ],
          },
        };
      }
      return {'ok': true};
    }

    await http.runWithClient(() async {
      SharedPreferences.setMockInitialValues({'whats_new': whatsNewVersion});
      final prefs = await SharedPreferences.getInstance();
      final session = Session(prefs)..me = {'id': 1, 'name': 'Тоні Старк', 'first_name': 'Тоні', 'username': 'tonny', 'role': 'user', 'plugins': {'message_reactions': true}};
      tester.view.physicalSize = const Size(1170, 2532);
      tester.view.devicePixelRatio = 3;
      tester.view.padding = const FakeViewPadding(top: 120, bottom: 60);
      addTearDown(tester.view.reset);
      final router = GoRouter(initialLocation: '/messages/5', routes: [
        ShellRoute(
          builder: (_, _, child) => AppShell(session: session, player: TrackPlayer()..session = session, child: child),
          routes: [GoRoute(path: '/messages/5', builder: (_, _) => const ChatScreen(id: 5))],
        ),
      ]);
      await tester.pumpWidget(MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(find.text('🔥'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);
      expect(find.byIcon(LucideIcons.smilePlus), findsOneWidget);

      await tester.tap(find.byIcon(LucideIcons.smilePlus));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(find.text('Реакція'), findsOneWidget);
      await tester.tap(find.text('😂'));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(calls.any((c) => c.contains('POST /api/v1/site/messages/5/messages/2/react') && c.contains('"emoji":"😂"')), isTrue);
      expect(find.text('😂'), findsOneWidget);
      expect(find.text('🔥'), findsNothing);

      await tester.tap(find.text('😂'));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(calls.where((c) => c.contains('/react') && c.contains('😂')).length, 2);
      expect(find.text('😂'), findsNothing);

      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 5));
    }, () => MockClient((request) async => http.Response(jsonEncode(respond(request)), 200, headers: {'content-type': 'application/json; charset=utf-8'})));
  });

  testWidgets('матеріали чату, позначка бота й бан гостя', (tester) async {
    var banned = false;
    Map<String, dynamic> respond(http.Request request) {
      final path = request.url.path;
      if (path.endsWith('/ban-guest')) {
        banned = true;
        return {'message': 'Гостя заблоковано.'};
      }
      if (path.endsWith('/shared')) {
        final kind = request.url.queryParameters['kind'] ?? 'media';
        if (kind == 'links') {
          return {
            'items': [
              {'id': '4-abc', 'message_id': 4, 'url': 'https://example.com/raid', 'host': 'example.com', 'author': 'ШІ', 'created_at': '2026-10-31T18:00:00Z'},
            ],
            'next': null,
            'counts': {'media': 1, 'files': 0, 'links': 1, 'voice': 0},
          };
        }
        return {
          'items': [
            {'id': 9, 'message_id': 4, 'type': 'image', 'url': 'https://gamecon.online/storage/a.jpg', 'author': 'ШІ', 'created_at': '2026-10-31T18:00:00Z'},
          ],
          'next': null,
          'counts': {'media': 1, 'files': 0, 'links': 1, 'voice': 0},
        };
      }
      if (path.endsWith('/api/v1/messages/5')) {
        return {
          'conversation': {
            'id': 5, 'type': 'group', 'title': 'Гостьовий', 'avatar_url': null, 'peer': null, 'can_write': true, 'is_muted': false,
            'my_role': 'owner', 'members_count': 2, 'read_up_to': 0, 'members': [], 'guest_chat': true, 'can_ban_guest': true, 'community_channel_id': 8,
          },
          'history': {
            'has_more': false,
            'messages': [
              {'id': 4, 'conversation_id': 5, 'type': 'text', 'body': 'Привіт, новенький!', 'user': null, 'bot': {'name': 'ШІ'}, 'is_bot': true, 'reply_to': null, 'attachments': [], 'created_at': '2026-10-31T18:12:00Z', 'reactions': []},
              if (!banned) {'id': 6, 'conversation_id': 5, 'type': 'text', 'body': 'Можна в клан?', 'user': null, 'guest': {'name': 'Мандрівник'}, 'reply_to': null, 'attachments': [], 'created_at': '2026-10-31T18:13:00Z', 'reactions': []},
            ],
          },
        };
      }
      return {'ok': true};
    }

    await http.runWithClient(() async {
      SharedPreferences.setMockInitialValues({'whats_new': whatsNewVersion});
      final prefs = await SharedPreferences.getInstance();
      final session = Session(prefs)
        ..me = {'id': 1, 'name': 'Тоні Старк', 'first_name': 'Тоні', 'username': 'tonny', 'role': 'admin', 'plugins': {'chat_media_panel': true, 'ip_bans': true}};
      tester.view.physicalSize = const Size(1170, 2532);
      tester.view.devicePixelRatio = 3;
      tester.view.padding = const FakeViewPadding(top: 120, bottom: 60);
      addTearDown(tester.view.reset);
      final router = GoRouter(initialLocation: '/messages/5', routes: [
        ShellRoute(
          builder: (_, _, child) => AppShell(session: session, player: TrackPlayer()..session = session, child: child),
          routes: [GoRoute(path: '/messages/5', builder: (_, _) => const ChatScreen(id: 5))],
        ),
      ]);
      await tester.pumpWidget(MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(find.text('бот'), findsOneWidget);
      expect(find.text('ШІ'), findsOneWidget);
      expect(find.text('гість'), findsOneWidget);

      await tester.tap(find.text('Гостьовий'));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(find.text('Матеріали чату'), findsWidgets);
      await tester.tap(find.text('Матеріали чату').last);
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(find.text('Медіа'), findsOneWidget);
      expect(find.text('Посилання'), findsOneWidget);
      await tester.tap(find.text('Посилання'));
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(find.text('https://example.com/raid'), findsOneWidget);
      await tester.tap(find.byIcon(LucideIcons.x).last);
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      if (find.byIcon(LucideIcons.x).evaluate().isNotEmpty) {
        await tester.tap(find.byIcon(LucideIcons.x).last);
        for (var i = 0; i < 8; i++) {
          await tester.pump(const Duration(milliseconds: 50));
        }
      }

      await tester.longPress(find.text('Можна в клан?'));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(find.text('Заблокувати гостя'), findsOneWidget);
      await tester.tap(find.text('Заблокувати гостя'));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(find.text('Заблокувати гостя «Мандрівник»'), findsOneWidget);
      await tester.tap(find.text('Заблокувати'));
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(banned, isTrue);
      expect(find.text('Можна в клан?'), findsNothing);

      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 5));
    }, () => MockClient((request) async => http.Response(jsonEncode(respond(request)), 200, headers: {'content-type': 'application/json; charset=utf-8'})));
  });

  test('фон, боти й тайм-аут: прапорці й текст', () {
    expect(chatCanModerate({'type': 'group', 'my_role': 'owner'}), isTrue);
    expect(chatCanModerate({'type': 'group', 'my_role': 'admin'}), isTrue);
    expect(chatCanModerate({'type': 'group', 'my_role': 'member'}), isFalse);
    expect(chatCanModerate({'type': 'direct', 'my_role': 'owner'}), isFalse);
    expect(chatBackgroundLabel('aurora'), 'Сяйво');
    expect(chatBackgroundLabel('waves'), 'Хвилі');
    expect(chatTimeoutText(null), isNull);
    expect(chatTimeoutText('2000-01-01T00:00:00Z'), isNull);
    expect(chatTimeoutText('2099-06-01T15:30:00Z'), contains('Адміністратори заборонили вам писати тут до'));
    expect(canOfferChatRestrict({'type': 'direct', 'my_role': 'owner'}, {'user': {'username': 'a'}}, restrictionsOn: true), isFalse);
    expect(canOfferChatRestrict({'type': 'group', 'my_role': 'member'}, {'user': {'username': 'a'}}, restrictionsOn: true), isFalse);
    expect(canOfferChatRestrict({'type': 'group', 'my_role': 'admin'}, {'type': 'text', 'user': {'username': 'a'}}, restrictionsOn: false), isFalse);
    expect(canOfferChatRestrict({'type': 'group', 'my_role': 'admin'}, {'type': 'text', 'user': {'username': 'a'}}, restrictionsOn: true), isTrue);
    expect(canOfferChatRestrict({'type': 'group', 'my_role': 'owner'}, {'bot': {'name': 'ШІ'}, 'user': {'username': 'a'}}, restrictionsOn: true), isFalse);
    final chat = <String, dynamic>{'my_background': 'dots', 'background': null};
    applyChatBackground(chat, {'background': {'preset': 'ocean', 'image': null}, 'my_background': 'ocean', 'shared_background': null});
    expect(chat['my_background'], 'ocean');
    expect(chat['shared_background'], isNull);
    expect((chat['background'] as Map)['preset'], 'ocean');
  });

  testWidgets('фон чату, боти, тайм-аут і зняття обмеження', (tester) async {
    final calls = <String>[];
    Map<String, dynamic> respond(http.Request request) {
      final path = request.url.path;
      calls.add('${request.method} $path ${request.body}');
      if (path.endsWith('/background')) {
        final body = jsonDecode(request.body) as Map;
        return {'ok': true, 'background': {'preset': body['preset'], 'image': null}, 'my_background': body['preset'], 'shared_background': null};
      }
      if (path.endsWith('/bots')) {
        return {
          'welcome_on': true,
          'posts_on': true,
          'ai_on': false,
          'welcome': {'id': 1, 'enabled': true, 'bot_name': 'Бот', 'body': 'Привіт, {name}!'},
          'ai': null,
          'posts': [],
        };
      }
      if (path.endsWith('/restrict')) return {'ok': true};
      if (path.endsWith('/api/v1/messages/5')) {
        return {
          'conversation': {
            'id': 5,
            'type': 'group',
            'title': 'Рейд',
            'avatar_url': null,
            'peer': null,
            'can_write': true,
            'is_muted': false,
            'my_role': 'owner',
            'members_count': 2,
            'read_up_to': 0,
            'timeout_until': '2099-06-01T15:30:00Z',
            'background': null,
            'my_background': null,
            'shared_background': null,
            'members': [
              {'id': 1, 'username': 'tonny', 'name': 'Тоні Старк', 'role': 'owner'},
              {'id': 2, 'username': 'oleh', 'name': 'Олег Коваль', 'role': 'member', 'timeout_until': '2099-01-01T12:00:00Z'},
            ],
          },
          'history': {
            'has_more': false,
            'messages': [
              {'id': 8, 'conversation_id': 5, 'type': 'text', 'body': 'Беру хіла', 'user': {'id': 2, 'username': 'oleh', 'name': 'Олег Коваль'}, 'reply_to': null, 'attachments': [], 'created_at': '2026-10-31T18:20:00Z', 'reactions': []},
            ],
          },
        };
      }
      return {'ok': true};
    }

    await http.runWithClient(() async {
      SharedPreferences.setMockInitialValues({'whats_new': whatsNewVersion});
      final prefs = await SharedPreferences.getInstance();
      final session = Session(prefs)
        ..me = {
          'id': 1,
          'name': 'Тоні Старк',
          'first_name': 'Тоні',
          'username': 'tonny',
          'role': 'user',
          'plugins': {'chat_backgrounds': true, 'chat_restrictions': true, 'chat_welcome_bot': true, 'chat_autoposter': true},
        };
      tester.view.physicalSize = const Size(1170, 2532);
      tester.view.devicePixelRatio = 3;
      tester.view.padding = const FakeViewPadding(top: 120, bottom: 60);
      addTearDown(tester.view.reset);
      final router = GoRouter(initialLocation: '/messages/5', routes: [
        ShellRoute(
          builder: (_, _, child) => AppShell(session: session, player: TrackPlayer()..session = session, child: child),
          routes: [GoRoute(path: '/messages/5', builder: (_, _) => const ChatScreen(id: 5))],
        ),
      ]);
      await tester.pumpWidget(MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(find.textContaining('Адміністратори заборонили вам писати тут до'), findsOneWidget);
      expect(find.text('Напишіть повідомлення…'), findsNothing);

      await tester.tap(find.byTooltip('Меню бесіди'));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(find.text('Фон чату'), findsOneWidget);
      expect(find.text('Боти бесіди'), findsOneWidget);
      await tester.tap(find.text('Фон чату'));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(find.text('Для мене'), findsOneWidget);
      expect(find.text('Для всіх'), findsOneWidget);
      expect(find.text('Особистий фон бачите лише ви.'), findsOneWidget);
      await tester.tap(find.text('Сяйво'));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(calls.any((call) => call.contains('POST /api/v1/site/messages/5/background') && call.contains('"preset":"aurora"')), isTrue);
      await tester.tap(find.widgetWithIcon(IconButton, LucideIcons.x));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }

      await tester.tap(find.byTooltip('Меню бесіди'));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      await tester.tap(find.text('Боти бесіди'));
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(calls.any((call) => call.contains('GET /api/v1/site/messages/5/bots')), isTrue);
      expect(find.text('Вітати кожного, хто приєднався'), findsOneWidget);
      expect(find.text('Привіт, {name}!'), findsOneWidget);
      expect(find.text('Автопости'), findsOneWidget);
      expect(find.text('ШІ-бот'), findsNothing);
      await tester.tap(find.widgetWithIcon(IconButton, LucideIcons.x));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }

      await tester.longPress(find.text('Беру хіла'));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(find.text('Тайм-аут або виключення'), findsOneWidget);
      await tester.tap(find.text('Тайм-аут або виключення'));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(find.text('Читає, але не пише.'), findsOneWidget);
      expect(find.text('Виключити на час'), findsOneWidget);
      await tester.tap(find.text('5 хвилин').first);
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(calls.any((call) => call.contains('POST /api/v1/site/messages/5/members/oleh/restrict') && call.contains('"kind":"timeout"') && call.contains('"minutes":5')), isTrue);

      await tester.tap(find.text('Рейд'));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(find.text('Зняти'), findsOneWidget);
      expect(find.text('Боти бесіди'), findsWidgets);
      await tester.tap(find.text('Зняти'));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(calls.any((call) => call.contains('DELETE /api/v1/site/messages/5/members/oleh/restrict')), isTrue);

      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 5));
    }, () => MockClient((request) async => http.Response(jsonEncode(respond(request)), 200, headers: {'content-type': 'application/json; charset=utf-8'})));
  });
}
