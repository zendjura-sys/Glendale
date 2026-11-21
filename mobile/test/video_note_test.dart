import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/chat.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:gamecon/video_note.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('ім’я файлу лише для форматів, які приймає сервер', () {
    expect(videoNoteUploadName('clip.mp4', null), 'note.mp4');
    expect(videoNoteUploadName('clip.m4v', 'application/octet-stream'), 'note.mp4');
    expect(videoNoteUploadName('clip.mov', null), 'note.mov');
    expect(videoNoteUploadName('note', 'video/quicktime'), 'note.mov');
    expect(videoNoteUploadName('note.webm', 'video/webm;codecs=vp9'), 'note.webm');
    expect(videoNoteUploadName('clip.mkv', 'video/x-matroska'), isNull);
    expect(videoNoteUploadName('photo.jpg', 'image/jpeg'), isNull);
    expect(videoNoteMaxSeconds, 60);
    expect(videoNoteMaxBytes, 30720 * 1024);
  });

  setUpAll(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(const MethodChannel('com.llfbandit.record/messages'), (_) async => null);
  });

  testWidgets('кружок у бульбашці й кнопка, коли плагін увімкнено', (tester) async {
    Map<String, dynamic> respond(http.Request request) {
      if (request.url.path.endsWith('/api/v1/messages/5')) {
        return {
          'conversation': {
            'id': 5, 'type': 'direct', 'title': 'Олег', 'avatar_url': null,
            'peer': {'id': 2, 'username': 'oleh', 'name': 'Олег', 'first_name': 'Олег'},
            'can_write': true, 'is_muted': false, 'read_up_to': 0,
          },
          'history': {
            'has_more': false,
            'messages': [
              {
                'id': 3, 'conversation_id': 5, 'type': 'video_note', 'body': null,
                'user': {'id': 2, 'username': 'oleh', 'name': 'Олег', 'first_name': 'Олег'},
                'reply_to': null, 'preview': 'Відеоповідомлення',
                'attachments': [
                  {'id': 9, 'type': 'video_note', 'url': 'https://gamecon.online/storage/note.mp4', 'duration': 12},
                ],
                'created_at': '2026-10-31T18:12:00Z', 'edited_at': null, 'reactions': [],
              },
              {
                'id': 4, 'conversation_id': 5, 'type': 'text', 'body': 'дивись',
                'user': {'id': 1, 'username': 'tonny', 'name': 'Тоні', 'first_name': 'Тоні'},
                'reply_to': null, 'preview': 'дивись',
                'attachments': [
                  {'id': 10, 'type': 'video_note', 'url': 'https://gamecon.online/storage/note2.mp4', 'duration': 8},
                ],
                'created_at': '2026-10-31T18:13:00Z', 'edited_at': null, 'reactions': [],
              },
            ],
          },
        };
      }
      return {'ok': true};
    }

    await http.runWithClient(() async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      palette = neonPalette;
      addTearDown(() => palette = neonPalette);
      final session = Session(prefs)
        ..me = {
          'id': 1,
          'name': 'Тоні',
          'first_name': 'Тоні',
          'username': 'tonny',
          'role': 'user',
          'plugins': {'video_notes': true},
          'prefs': {'data_saver': true},
        };
      tester.view.physicalSize = const Size(1170, 2532);
      tester.view.devicePixelRatio = 3;
      tester.view.padding = const FakeViewPadding(top: 120, bottom: 60);
      addTearDown(tester.view.reset);
      final router = GoRouter(initialLocation: '/messages/5', routes: [
        GoRoute(
          path: '/messages/5',
          builder: (_, _) => AppScope(
            session: session,
            player: TrackPlayer()..session = session,
            child: const Scaffold(body: ChatScreen(id: 5)),
          ),
        ),
      ]);
      await tester.pumpWidget(MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(find.text('0:12'), findsOneWidget);
      expect(find.text('0:08'), findsOneWidget);
      expect(find.text('дивись'), findsOneWidget);
      expect(find.byIcon(LucideIcons.play), findsNWidgets(2));
      expect(find.byTooltip('Відеокружок'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 5));
    }, () => MockClient((request) async => http.Response(jsonEncode(respond(request)), 200, headers: {'content-type': 'application/json; charset=utf-8'})));
  });
}
