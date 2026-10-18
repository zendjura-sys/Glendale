import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/api.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/track_edit.dart';
import 'package:gamecon/widgets.dart';

Uint8List _frame(String id, List<int> body) {
  final size = body.length;
  return Uint8List.fromList([...ascii.encode(id), size >> 24 & 0xFF, size >> 16 & 0xFF, size >> 8 & 0xFF, size & 0xFF, 0, 0, ...body]);
}

Uint8List _tag(int version, List<Uint8List> frames) {
  final body = frames.expand((f) => f).toList();
  final n = body.length;
  return Uint8List.fromList([...ascii.encode('ID3'), version, 0, 0, n >> 21 & 0x7F, n >> 14 & 0x7F, n >> 7 & 0x7F, n & 0x7F, ...body]);
}

List<int> _utf16le(String s) => [0xFF, 0xFE, for (final u in s.codeUnits) ...[u & 0xFF, u >> 8]];

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('reads ID3v2.3 text frames in latin1, utf-16 and utf-8', () {
    final tags = parseId3v2(_tag(3, [
      _frame('TIT2', [0, ...latin1.encode('Warrior of the United')]),
      _frame('TPE1', [1, ..._utf16le('Океан Ельзи')]),
      _frame('TALB', [3, ...utf8.encode('Земля')]),
      _frame('TCON', [0, ...latin1.encode('(9)Metal')]),
    ]));
    expect(tags.title, 'Warrior of the United');
    expect(tags.artist, 'Океан Ельзи');
    expect(tags.album, 'Земля');
    expect(tags.genre, 'Metal');
  });

  test('reads ID3v1 trailer', () {
    final t = Uint8List(128)..setAll(0, ascii.encode('TAG'));
    t.setAll(3, ascii.encode('Kings of Metal'));
    t.setAll(33, ascii.encode('Manowar'));
    t.setAll(63, ascii.encode('Kings of Metal'));
    final tags = parseId3v1(t);
    expect([tags.title, tags.artist, tags.album], ['Kings of Metal', 'Manowar', 'Kings of Metal']);
  });

  test('temp and hash file names are not metadata', () {
    for (final junk in ['tmpnvpze33q', 'tmpnvchrta', '40b74fc09897c7', '.', '', ' - ']) {
      expect(junkMeta(junk), isTrue, reason: junk);
    }
    for (final good in ['Manowar', 'Warrior of the United', 'ДДТ', '2Pac', 'AC/DC']) {
      expect(junkMeta(good), isFalse, reason: good);
    }
    expect(guessFromName('tmpnvpze33q.mp3').isEmpty, isTrue);
    final guess = guessFromName('Manowar - Warrior of the United.mp3');
    expect([guess.artist, guess.title], ['Manowar', 'Warrior of the United']);
  });

  test('compact hryvnia for narrow tiles (як на сайті: 1K, 1M)', () {
    expect(hryvniaShort(0), '0 ₴');
    expect(hryvniaShort(99900), '999 ₴');
    expect(hryvniaShort(100000), '1K ₴');
    expect(hryvniaShort(9999900), '99,9K ₴');
    expect(hryvniaShort(10000000), '100K ₴');
    expect(hryvniaShort(25050000), '250K ₴');
    expect(hryvniaShort(100000000), '1M ₴');
    expect(hryvniaShort(155000000), '1,5M ₴');
    expect(hryvniaShort(1000000000), '10M ₴');
    expect(hryvniaShort(-100000000), '−1M ₴');
    expect(hryvniaShort(250000000000), '2,5B ₴');
  });

  test('short counters like the site', () {
    expect(compact(999), '999');
    expect(compact(1000), '1K');
    expect(compact(1625), '1,6K');
    expect(compact(15300), '15,3K');
    expect(compact(100000), '100K');
    expect(compact(1000000), '1M');
    expect(compact(10000000), '10M');
  });

  test('queue reorder keeps the playing track', () {
    final player = TrackPlayer();
    player.queue = [for (var i = 1; i <= 4; i++) QueueTrack(id: i, url: 'https://x/$i.mp3', title: 't$i', artist: 'a')];
    player.index = 1;
    player.move(1, 3);
    expect(player.queue.map((t) => t.id), [1, 3, 4, 2]);
    expect(player.current?.id, 2);
    player.move(3, 0);
    expect(player.queue.map((t) => t.id), [2, 1, 3, 4]);
    expect(player.index, 0);
    player.updateMeta({'id': 3, 'title': 'Нова', 'artist': 'Гурт', 'album': 'Альбом'});
    expect(player.queue[2].album, 'Альбом');
  });

  test('сміттєвий виконавець показується як невідомий', () {
    expect(artistOf('.'), 'Невідомий виконавець');
    expect(artistOf(null, '—'), '—');
    expect(artistOf('Manowar'), 'Manowar');
  });
}
