// «Завантажити за посиланням»: надсилання посилання, статуси імпортів, помилка сервера (422)
// й опитування, поки імпорт у роботі. Відповіді мосту сайту підставлені.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/music.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

Map<String, dynamic> _card(int id, String status, {int? progress, String? error, Map<String, dynamic>? track}) => {
      'id': id,
      'url': 'https://files.example/song-$id.mp3',
      'host': 'files.example',
      'status': status,
      'error': error,
      'progress': progress,
      'track': track,
      'created_at': '2026-10-22T10:00:00Z',
    };

final _track = {'source': 'local', 'id': 7, 'key': 'local:7', 'title': 'Neon Skyline', 'artist': 'Nightdrive Kyiv', 'duration': 200, 'url': '/storage/7.mp3', 'cover_url': null};

http.Response _json(Object body, [int status = 200]) => http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json; charset=utf-8'});

Future<void> _pump(WidgetTester tester) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final session = Session(prefs)..me = {'id': 1, 'name': 'Тоні', 'username': 'tonny', 'role': 'user'};
  final player = TrackPlayer()..session = session;
  await tester.pumpWidget(MaterialApp(
    theme: gameConTheme(),
    home: AppScope(session: session, player: player, child: const Scaffold(body: SingleChildScrollView(child: TrackLinkImport()))),
  ));
  await tester.pump();
  await tester.pump();
}

void main() {
  testWidgets('статуси імпортів: прогрес, помилка, «Слухати»', (tester) async {
    var gets = 0;
    await http.runWithClient(() async {
      await _pump(tester);
      expect(find.text('Завантажується… 42%'), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsOneWidget);
      expect(find.text('Не вдалося'), findsOneWidget);
      expect(find.text('Файл не є аудіо.'), findsOneWidget);
      expect(find.text('Готово'), findsOneWidget);
      expect(find.text('Слухати'), findsOneWidget);
      // Завершені можна прибрати, незавершені — ні.
      expect(find.byTooltip('Прибрати'), findsNWidgets(2));
      expect(gets, 1);
      // Поки імпорт завантажується — опитування кожні 3 с.
      await tester.pump(const Duration(seconds: 3));
      await tester.pump();
      expect(gets, 2);
      await tester.pumpWidget(const SizedBox());
    }, () => MockClient((request) async {
          if (request.method == 'GET' && request.url.path == '/api/v1/site/music/imports') {
            gets++;
            return _json({
              'imports': [
                _card(1, 'downloading', progress: 42),
                _card(2, 'failed', error: 'Файл не є аудіо.'),
                _card(3, 'done', progress: 100, track: _track),
              ],
            });
          }
          return _json({}, 404);
        }));
  });

  testWidgets('надсилання посилання: «Вставити», POST і новий імпорт у списку', (tester) async {
    Map<String, dynamic>? sent;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.getData') return {'text': 'https://www.dropbox.com/s/abc/song.mp3?dl=0'};
      return null;
    });
    addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));
    await http.runWithClient(() async {
      await _pump(tester);
      expect(find.textContaining('Google Диска, Dropbox чи OneDrive'), findsOneWidget);
      await tester.tap(find.text('Вставити'));
      await tester.pump();
      await tester.pump();
      expect(find.text('https://www.dropbox.com/s/abc/song.mp3?dl=0'), findsOneWidget);
      await tester.enterText(find.byType(TextField).at(2), 'Aurora Lab');
      await tester.tap(find.text('Завантажити'));
      await tester.pump();
      await tester.pump();
      expect(sent, {'url': 'https://www.dropbox.com/s/abc/song.mp3?dl=0', 'artist': 'Aurora Lab'});
      expect(find.text('У черзі'), findsOneWidget);
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpWidget(const SizedBox());
    }, () => MockClient((request) async {
          if (request.method == 'POST' && request.url.path == '/api/v1/site/music/tracks/import') {
            sent = Map<String, dynamic>.from(jsonDecode(request.body) as Map);
            return _json({'import': _card(9, 'pending')}, 202);
          }
          if (request.method == 'GET') return _json({'imports': []});
          return _json({}, 404);
        }));
  });

  testWidgets('помилка сервера (422) показується як є', (tester) async {
    await http.runWithClient(() async {
      await _pump(tester);
      await tester.enterText(find.byType(TextField).first, 'https://mega.nz/file/xyz');
      await tester.pump();
      await tester.tap(find.text('Завантажити'));
      await tester.pump();
      await tester.pump();
      expect(find.text('MEGA не підтримується: завантажте файл на Google Диск чи Dropbox.'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    }, () => MockClient((request) async {
          if (request.method == 'POST') {
            return _json({
              'message': 'MEGA не підтримується: завантажте файл на Google Диск чи Dropbox.',
              'errors': {
                'url': ['MEGA не підтримується: завантажте файл на Google Диск чи Dropbox.'],
              },
            }, 422);
          }
          return _json({'imports': []});
        }));
  });
}
