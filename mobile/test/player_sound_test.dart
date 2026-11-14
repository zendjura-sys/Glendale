// Плеєр як на сайті: «Грає з…», плавні переходи, таймер сну, налаштування звуку,
// «Відомості про пісню» й переклад тексту пісні рядок у рядок.
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/lyrics.dart';
import 'package:gamecon/music_ui.dart';
import 'package:gamecon/state.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<TrackPlayer> _player([Map<String, Object> prefs = const {}]) async {
  SharedPreferences.setMockInitialValues(prefs);
  final session = Session(await SharedPreferences.getInstance());
  // Без ∞ і станції — тест не ходить у мережу по наступні треки.
  return TrackPlayer()
    ..session = session
    ..autoplay = false;
}

Map<String, dynamic> _card(int id) => {'source': 'local', 'id': id, 'key': 'local:$id', 'title': 'Пісня $id', 'artist': 'Гурт', 'url': 'https://example.com/$id.mp3', 'duration': 200};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  // Рушія just_audio в тестах немає: головний канал відповідає «порожньо», завантаження треку падає тихо.
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(const MethodChannel('com.ryanheise.just_audio.methods'), (call) async => call.method == 'init' ? null : <String, dynamic>{});

  test('плавний перехід: затухання за останні секунди, короткі треки — без нього', () {
    const total = Duration(minutes: 3);
    expect(TrackPlayer.fadeOutLevel(const Duration(minutes: 1), total, 6), 1);
    expect(TrackPlayer.fadeOutLevel(const Duration(seconds: 177), total, 6), closeTo(0.5, 1e-9));
    expect(TrackPlayer.fadeOutLevel(total, total, 6), 0);
    expect(TrackPlayer.fadeOutLevel(const Duration(seconds: 177), total, 0), 1);
    expect(TrackPlayer.fadeOutLevel(const Duration(seconds: 14), const Duration(seconds: 15), 6), 1);
  });

  test('налаштування звуку зберігаються на телефоні', () async {
    final player = await _player();
    player
      ..setCrossfade(9)
      ..setNormalize(true)
      ..setLyricsTranslate(true)
      ..setCrossfade(40);
    expect(player.crossfade, 12);
    final again = TrackPlayer()..session = player.session;
    expect([again.crossfade, again.normalize, again.lyricsTranslate], [12, true, true]);
  });

  test('таймер сну: хвилини, «наприкінці треку» й вимкнення', () async {
    final player = await _player();
    player.setSleep(minutes: 30);
    expect(player.sleepMinutesLeft, 30);
    expect(player.sleepAfterTrack, isFalse);
    player.setSleep();
    expect(player.sleepMinutesLeft, isNull);

    player.queue = [QueueTrack.fromJson(_card(1))!, QueueTrack.fromJson(_card(2))!];
    player.index = 0;
    player.setSleep(afterTrack: true);
    await player.trackEnded();
    // Трек дограв — музика зупинилась на ньому ж, таймер скинуто.
    expect(player.index, 0);
    expect(player.sleepAfterTrack, isFalse);
  });

  test('після треку з плавним переходом наступний з’являється з тиші', () async {
    final player = await _player();
    player.queue = [QueueTrack.fromJson(_card(1))!, QueueTrack.fromJson(_card(2))!];
    player.index = 0;
    player.setCrossfade(6);
    await player.trackEnded();
    expect(player.index, 1);
    expect(player.fadeLevel, lessThan(1));
    await player.next();
    expect(player.fadeLevel, 1);
  });

  test('«Грає з…»: запам’ятовується з черги, станція — без посилання', () async {
    final player = await _player();
    await player.playList([_card(1), _card(2)], 0, from: const PlayFrom('Нічне місто', '/music/album?artist=A&title=B'));
    expect(player.from?.label, 'Нічне місто');
    expect(player.from?.path, '/music/album?artist=A&title=B');
    await player.play('https://example.com/x.mp3', 'X', 'Y');
    expect(player.from, isNull);

    expect(playFromRoute(Uri.parse('/music/album?artist=Nightdrive&title=Neon'))?.label, 'Neon');
    expect(playFromRoute(Uri.parse('/music/artist?name=Nightdrive'))?.path, '/music/artist?name=Nightdrive');
    expect(playFromRoute(Uri.parse('/music/genre?name=Synthwave'))?.label, 'Synthwave');
    expect(playFromRoute(Uri.parse('/music/mix/favorites'))?.label, mixTitle('favorites').$1);
    expect(playFromRoute(Uri.parse('/music/search?q=neon'))?.label, contains('neon'));
    expect(playFromRoute(Uri.parse('/feed')), isNull);
    expect(stationLabel('artist:Nightdrive'), contains('Nightdrive'));
  });

  test('картка треку несе рік, формат і прослуховування для «Відомостей про пісню»', () {
    final track = QueueTrack.fromJson({
      ..._card(5),
      'year': 2024,
      'plays_count': 12,
      'audio': {'codec': 'flac', 'sample_rate': 96000, 'bit_depth': 24, 'bitrate': null, 'channels': 2},
    })!;
    expect(track.year, 2024);
    expect(track.plays, 12);
    expect(formatLine(track.toCard()['audio']), 'FLAC · 96 кГц · 24 біт · стерео');
    expect(formatLine({'codec': 'aac', 'sample_rate': 44100, 'bitrate': 256, 'channels': 1}), 'AAC · 44,1 кГц · 256 кбіт/с · моно');
    expect(codecName('alac'), 'Apple Lossless (ALAC)');
    expect(codecName('pcm_s16le'), startsWith('PCM'));
    expect(codecName('dts'), 'DTS');
    expect(formatLine(null), isNull);
  });

  test('переклад тексту лягає рядок у рядок: без міток LRC і службових тегів', () {
    const source = '\n[ar:Гурт]\n[00:01.00]Hello world\n[00:05.50][00:20.00]Chorus line\n\n[00:09.00]Same';
    expect(sourceLines(source), ['', 'Hello world', 'Chorus line', '', 'Same']);
    final map = alignTranslation(source, '\nПривіт, світе\nРядок приспіву\n\nSame');
    expect(map, {'Hello world': 'Привіт, світе', 'Chorus line': 'Рядок приспіву'});
    // Текст із сервера з порожнім рядком на початку: рядки не зсуваються.
    final lyrics = parseLyrics(source.trim(), raw: source);
    expect(lyrics.timed, isTrue);
    expect(alignTranslation(lyrics.source, '\nA\nB\n\nC')['Hello world'], 'A');
  });
}
