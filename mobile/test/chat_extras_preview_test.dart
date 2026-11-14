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
import 'package:gamecon/shell.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fonts.dart';

Map<String, dynamic> _user(int id, String name) => {'id': id, 'username': 'u$id', 'name': name, 'first_name': name.split(' ').first, 'avatar_url': null};
final _requests = <String>[];

Map<String, dynamic> _msg(int id, int user, String name, String? body, {Map<String, dynamic>? thread, List<Map<String, dynamic>> attachments = const []}) => {
  'id': id, 'conversation_id': 5, 'type': 'text', 'body': body, 'user': _user(user, name), 'reply_to': null, 'preview': body ?? 'Фото',
  'attachments': attachments, 'created_at': '2026-10-31T18:${10 + id}:00Z', 'edited_at': null, 'reactions': [], 'thread': thread, 'thread_root_id': null,
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
}
