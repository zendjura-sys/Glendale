// «Завантажене»: індекс треків на телефоні, черга з повторами, плеєр з локального файлу,
// офлайн-розділ музики й стирання всього при виході з акаунта.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/api.dart';
import 'package:gamecon/downloads.dart';
import 'package:gamecon/music_home.dart';
import 'package:gamecon/offline_music.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

Map<String, dynamic> card(int id, {String source = 'local', String? album}) => {
      'id': id,
      'key': '$source:$id',
      'source': source,
      'title': 'Пісня $id',
      'artist': 'Nightdrive Kyiv',
      'album': ?album,
      'url': 'https://gamecon.online/storage/music/$id.mp3',
    };

/// Підробна мережа: пише байти у файл; [fail] — скільки перших спроб падають.
class FakeNet {
  FakeNet({this.fail = 0, this.error});
  int fail;
  Object? error;
  final urls = <String>[];

  Future<void> fetch(Uri url, Map<String, String> headers, File target, {required void Function(int received, int? total) onProgress, required bool Function() cancelled}) async {
    urls.add('$url');
    if (error != null) throw error!;
    if (fail > 0) {
      fail--;
      throw const SocketException('offline');
    }
    if (cancelled()) throw DownloadCancelled();
    await target.writeAsBytes(List.filled(2048, 7));
    onProgress(2048, 2048);
  }
}

void main() {
  late Directory root;
  late Session session;

  setUp(() async {
    SharedPreferences.setMockInitialValues({'token': 'secret'});
    session = Session(await SharedPreferences.getInstance())..me = {'id': 1, 'modules': ['music']};
    root = await Directory.systemTemp.createTemp('gc_downloads_');
    Api.online.value = true;
  });

  tearDown(() async {
    TrackPlayer.localFile = null;
    Downloads.instance = null;
    Api.online.value = true;
    if (root.existsSync()) await root.delete(recursive: true);
  });

  Downloads make(FakeNet net) => Downloads(session: session, root: () async => root, fetch: net.fetch, retryDelay: Duration.zero);

  test('індекс: трек додається, переживає перезапуск і видаляється разом з файлом', () async {
    final net = FakeNet();
    final downloads = make(net);
    await downloads.download(card(7));
    await downloads.idle();
    expect(downloads.has(7), isTrue);
    final path = downloads.fileFor(7)!;
    expect(File(path).lengthSync(), 2048);
    expect(downloads.totalBytes, 2048);
    expect(net.urls.single, 'https://gamecon.online/storage/music/7.mp3');

    // Новий запуск застосунку читає index.json.
    final again = make(net);
    await again.load();
    expect(again.has(7), isTrue);
    expect(again.tracks.single.card['title'], 'Пісня 7');

    await again.removeTrack(7);
    expect(again.has(7), isFalse);
    expect(File(path).existsSync(), isFalse);
    final third = make(net);
    await third.load();
    expect(third.isEmpty, isTrue);
  });

  test('Spotify й радіо не завантажуються; альбом не стирає окремо завантажений трек', () async {
    final downloads = make(FakeNet());
    await downloads.download(card(1, source: 'spotify'));
    await downloads.download({...card(2, source: 'radio'), 'live': true});
    expect(downloads.isEmpty, isTrue);

    await downloads.download(card(3));
    await downloads.downloadCollection(key: albumDownloadKey('Nightdrive Kyiv', 'Run'), kind: 'album', title: 'Run', cards: [card(3, album: 'Run'), card(4, album: 'Run'), card(5, source: 'spotify')]);
    await downloads.idle();
    expect(downloads.progressOf('album:Nightdrive Kyiv|Run'), (2, 2));

    await downloads.removeCollection('album:Nightdrive Kyiv|Run');
    expect(downloads.has(3), isTrue, reason: 'трек завантажили й окремо');
    expect(downloads.has(4), isFalse);
  });

  test('невдала спроба повторюється, а нестача місця — зрозуміла помилка українською', () async {
    final flaky = make(FakeNet(fail: 2));
    await flaky.download(card(8));
    await flaky.idle();
    expect(flaky.has(8), isTrue);

    final full = make(FakeNet(error: const FileSystemException('write failed', '/x', OSError('No space left on device', 28))));
    await full.download(card(9));
    await full.idle();
    expect(full.has(9), isFalse);
    expect(full.task(9)!.error, contains('Недостатньо місця'));
    expect(full.takeError(), contains('Недостатньо місця'));
  });

  test('скасування прибирає трек із черги', () async {
    final downloads = make(FakeNet());
    await downloads.download(card(10));
    await downloads.download(card(11));
    await downloads.download(card(12));
    downloads.cancel(12);
    await downloads.idle();
    expect(downloads.has(12), isFalse);
    expect(downloads.task(12), isNull);
    expect(downloads.has(10) && downloads.has(11), isTrue);
  });

  test('плеєр грає завантажений файл, а без нього — потік із сервера', () async {
    final downloads = make(FakeNet());
    await downloads.download(card(7));
    await downloads.idle();
    TrackPlayer.localFile = downloads.fileFor;

    final saved = QueueTrack.fromJson(card(7))!;
    final online = QueueTrack.fromJson(card(8))!;
    final radio = QueueTrack.fromJson({...card(7, source: 'radio'), 'live': true})!;
    expect(TrackPlayer.sourceFor(saved), Uri.file(downloads.fileFor(7)!).toString());
    expect(TrackPlayer.sourceFor(saved), startsWith('file://'));
    expect(TrackPlayer.sourceFor(online), 'https://gamecon.online/storage/music/8.mp3');
    expect(TrackPlayer.sourceFor(radio), radio.url);
  });

  test('вихід з акаунта стирає всю завантажену музику', () async {
    final downloads = make(FakeNet());
    session.logoutHooks.add(downloads.clearAll);
    await downloads.download(card(7));
    await downloads.idle();
    expect(root.existsSync(), isTrue);

    await session.clear();
    expect(downloads.isEmpty, isTrue);
    expect(root.existsSync(), isFalse);
    final again = make(FakeNet());
    await again.load();
    expect(again.isEmpty, isTrue);
  });

  testWidgets('без інтернету розділ музики показує завантажене, решта рядків тьмяніє', (tester) async {
    // Готовий індекс на «телефоні» (синхронно: у віджет-тесті час підроблений).
    Directory('${root.path}/tracks').createSync(recursive: true);
    File('${root.path}/tracks/7.mp3').writeAsBytesSync(List.filled(2048, 7));
    File('${root.path}/index.json').writeAsStringSync(jsonEncode({
      'tracks': [DownloadedTrack(id: 7, card: card(7), file: 'tracks/7.mp3', bytes: 2048, groups: {'single'}).toJson()],
      'collections': [],
    }));
    final downloads = make(FakeNet());
    await tester.runAsync(downloads.load);
    expect(downloads.has(7), isTrue);
    Downloads.instance = downloads;
    Api.online.value = false;
    expect(dimmedOffline(card(7)), isFalse);
    expect(dimmedOffline(card(8)), isTrue);

    final player = TrackPlayer()..session = session;
    await tester.pumpWidget(MaterialApp(
      theme: gameConTheme(),
      home: AppScope(session: session, player: player, child: const Scaffold(body: MusicHub(tab: 'library'))),
    ));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Завантажене'), findsWidgets);
    expect(find.textContaining('Немає інтернету'), findsOneWidget);
    expect(find.text('Пісня 7'), findsOneWidget);

    // Зв’язок повернувся — звичайна Медіатека.
    Api.online.value = true;
    await tester.pump();
    expect(find.textContaining('Немає інтернету'), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });
}
