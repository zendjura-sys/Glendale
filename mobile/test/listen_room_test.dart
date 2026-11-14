// Кімната «Слухати разом» групи: діджей, пропозиції, реакції, чат, прибрати слухача.
// Відповіді сервера підставлені (MockClient), плеєр не запускається — трек на паузі.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/listen_together.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

final _track = {'source': 'local', 'id': 7, 'key': 'local:7', 'title': 'Neon Skyline', 'artist': 'Nightdrive Kyiv', 'duration': 200, 'url': '/storage/7.mp3', 'cover_url': null};
final _me = {'id': 1, 'name': 'Тоні', 'username': 'tonny', 'avatar_url': null};
final _guest = {'id': 2, 'name': 'Марко', 'username': 'marko', 'avatar_url': null};

Map<String, dynamic> _party() => {
      'id': 5,
      'code': 'room5',
      'url': 'https://gamecon.online/listen/room5',
      'host': _me,
      'is_host': true,
      'can_control': true,
      'ended': false,
      'state': {'track': _track, 'playing': false, 'position': 12, 'state_ms': 0, 'server_ms': 0, 'shared_control': false, 'repeat': false},
      'queue': [],
      'members': [
        {..._me, 'is_host': true},
        {..._guest, 'is_host': false},
      ],
      'room': {
        'title': 'Вечір синтвейву',
        'group': {'type': 'community', 'id': 3, 'name': 'Нічні гонщики', 'url': '/c/night', 'avatar_url': null},
        'moderated': true,
        'can_manage': true,
        'can_review': true,
        'suggestions': [
          {'index': 0, 'track': {..._track, 'id': 8, 'key': 'local:8', 'title': 'Midnight Run'}, 'by': _guest},
        ],
        'messages': [
          {'id': 1, 'emoji': null, 'body': 'Класний трек!', 'user': _guest, 'created_at': '2026-10-23T10:00:00Z'},
        ],
        'reactions': [],
        'emoji': ['🔥', '❤️'],
      },
    };

http.Response _json(Object body, [int status = 200]) => http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json; charset=utf-8'});

void main() {
  testWidgets('кімната групи: діджей погоджує пропозицію, реакція, чат, прибрати слухача', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 4000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final posts = <String, Map<String, dynamic>>{};
    await http.runWithClient(() async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final session = Session(prefs)..me = _me;
      final player = TrackPlayer()..session = session;
      await tester.pumpWidget(MaterialApp(
        theme: gameConTheme(),
        home: AppScope(session: session, player: player, child: const Scaffold(body: ListenScreen(code: 'room5'))),
      ));
      await tester.pump();
      await tester.pump();
      await tester.pump();

      expect(find.textContaining('Вечір синтвейву'), findsOneWidget);
      expect(find.textContaining('Нічні гонщики'), findsOneWidget);
      expect(find.text('Діджей: Тоні'), findsOneWidget);
      expect(find.text('Пропозиції'), findsOneWidget);
      expect(find.text('Midnight Run'), findsOneWidget);
      expect(find.text('Чат кімнати'), findsOneWidget);
      expect(find.textContaining('Класний трек!'), findsOneWidget);
      expect(find.textContaining('Spotify кожен слухає'), findsOneWidget);
      expect(find.text('Kyiv FM'), findsOneWidget);

      // Діджей погоджує пропозицію.
      await tester.tap(find.byTooltip('Додати в чергу'));
      await tester.pump();
      expect(posts['/api/v1/listen/room5/suggestions/0'], {'approve': true});

      // Реакція емодзі.
      await tester.tap(find.byTooltip('Реакція 🔥'));
      await tester.pump();
      expect(posts['/api/v1/listen/room5/react'], {'emoji': '🔥'});

      // Повідомлення в чат.
      await tester.enterText(find.byType(TextField).last, 'Ще!');
      await tester.tap(find.byTooltip('Надіслати'));
      await tester.pump();
      expect(posts['/api/v1/listen/room5/chat'], {'body': 'Ще!'});

      // Прибрати слухача — з підтвердженням.
      await tester.tap(find.byTooltip('Прибрати з кімнати'));
      await tester.pumpAndSettle(const Duration(milliseconds: 100));
      await tester.tap(find.text('Прибрати').last);
      await tester.pump();
      await tester.pump();
      expect(posts['/api/v1/listen/room5/kick'], {'user_id': 2});

      await tester.pumpWidget(const SizedBox());
    }, () => MockClient((request) async {
          final path = request.url.path;
          if (request.method == 'POST') posts[path] = jsonDecode(request.body.isEmpty ? '{}' : request.body) as Map<String, dynamic>;
          if (path == '/api/v1/listen/room5') return _json({'party': _party(), 'friends': []});
          if (path == '/api/v1/listen/room5/state') return _json(_party());
          if (path == '/api/v1/site/music/search') return _json({'tracks': []});
          if (path == '/api/v1/site/music/rooms') {
            return _json({
              'rooms': [],
              'groups': [],
              'stations': [
                {'source': 'radio', 'id': 3, 'key': 'radio:3', 'title': 'Kyiv FM', 'artist': '', 'duration': 0, 'url': 'https://example.com/live', 'cover_url': null, 'live': true},
              ],
            });
          }
          if (path == '/api/v1/listen/room5/react') return _json({'reaction': {'id': 9, 'emoji': '🔥', 'body': null, 'user': _me, 'created_at': '2026-10-23T10:00:00Z'}});
          if (path == '/api/v1/listen/room5/chat') return _json({'message': {'id': 10, 'emoji': null, 'body': 'Ще!', 'user': _me, 'created_at': '2026-10-23T10:00:00Z'}}, 201);
          if (request.method == 'POST') return _json(_party());
          return _json({}, 404);
        }));
  });
}
