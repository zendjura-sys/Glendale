import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Метадані треку з тегів, назви файлу чи каталогу.
class TrackTags {
  const TrackTags({this.title, this.artist, this.album, this.genre});
  final String? title;
  final String? artist;
  final String? album;
  final String? genre;

  bool get isEmpty => title == null && artist == null && album == null && genre == null;

  TrackTags or(TrackTags other) => TrackTags(
        title: title ?? other.title,
        artist: artist ?? other.artist,
        album: album ?? other.album,
        genre: genre ?? other.genre,
      );
}

final _junkName = RegExp(r'^(tmp[a-z0-9_-]*|[0-9a-f]{8,}|[a-z0-9]{6,}[_-]?\d{3,}|audio[_-]?\d+|track\s*\d+)$', caseSensitive: false);

/// Назви на кшталт «tmpnvpze33q», «40b74fc09897c7» чи «.» — це не метадані, а сміття з імені тимчасового файлу.
bool junkMeta(String? value) {
  final v = value?.trim() ?? '';
  return v.isEmpty || !RegExp(r'[\p{L}\p{N}]', unicode: true).hasMatch(v) || _junkName.hasMatch(v);
}

String? _clean(String? value, [int max = 150]) {
  final v = value?.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (v == null || v.isEmpty) return null;
  return v.length > max ? v.substring(0, max).trim() : v;
}

/// «Виконавець - Назва.mp3» → поля форми (як `guessFromFilename` на сайті).
TrackTags guessFromName(String name) {
  final base = name.replaceFirst(RegExp(r'\.[A-Za-z0-9]{2,4}$'), '').replaceAll('_', ' ').trim();
  if (junkMeta(base)) return const TrackTags();
  final parts = base.split(RegExp(r'\s+[-–—]\s+'));
  if (parts.length < 2) return TrackTags(title: _clean(base));
  return TrackTags(artist: _clean(parts.first), title: _clean(parts.sublist(1).join(' - ')));
}

// ───────────────────────── ID3 ─────────────────────────

int _syncsafe(Uint8List b, int o) => (b[o] << 21) | (b[o + 1] << 14) | (b[o + 2] << 7) | b[o + 3];
int _uint32(Uint8List b, int o) => (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];

String _utf16(Uint8List bytes, {required bool bigEndian}) {
  var start = 0;
  var be = bigEndian;
  if (bytes.length >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE) {
    be = false;
    start = 2;
  } else if (bytes.length >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF) {
    be = true;
    start = 2;
  }
  final units = <int>[];
  for (var i = start; i + 1 < bytes.length; i += 2) {
    final unit = be ? (bytes[i] << 8) | bytes[i + 1] : bytes[i] | (bytes[i + 1] << 8);
    if (unit == 0) break;
    units.add(unit);
  }
  return String.fromCharCodes(units);
}

String? _decode(Uint8List bytes, int encoding) {
  final String raw = switch (encoding) {
    1 => _utf16(bytes, bigEndian: false),
    2 => _utf16(bytes, bigEndian: true),
    3 => utf8.decode(bytes, allowMalformed: true),
    _ => latin1.decode(bytes),
  };
  return _clean(raw.split('\u0000').first);
}

String? _genre(String? raw) {
  final g = raw?.replaceFirst(RegExp(r'^\(\d+\)'), '').trim();
  return g == null || g.isEmpty || RegExp(r'^\d+$').hasMatch(g) ? null : _clean(g, 40);
}

/// Розмір тегу ID3v2 разом із заголовком; 0 — тегу немає.
int id3Size(Uint8List head) {
  if (head.length < 10 || head[0] != 0x49 || head[1] != 0x44 || head[2] != 0x33) return 0;
  return 10 + _syncsafe(head, 6);
}

/// Мінімальний парсер ID3v2.2–2.4: назва, виконавець, альбом, жанр.
TrackTags parseId3v2(Uint8List data) {
  if (id3Size(data) == 0) return const TrackTags();
  final version = data[3];
  final end = id3Size(data).clamp(0, data.length);
  final wide = version >= 3;
  var offset = 10;
  if (wide && data[5] & 0x40 != 0 && data.length > 14) offset += version == 4 ? _syncsafe(data, 10) : 4 + _uint32(data, 10);
  String? title, artist, album, genre;
  final header = wide ? 10 : 6;
  while (offset + header < end) {
    final id = String.fromCharCodes(data.sublist(offset, offset + (wide ? 4 : 3)));
    if (!RegExp(r'^[A-Z0-9]{3,4}$').hasMatch(id)) break;
    final size = !wide
        ? (data[offset + 3] << 16) | (data[offset + 4] << 8) | data[offset + 5]
        : (version == 4 ? _syncsafe(data, offset + 4) : _uint32(data, offset + 4));
    final start = offset + header;
    offset = start + size;
    if (start + size > data.length) break;
    if (size <= 1) continue;
    final body = data.sublist(start, start + size);
    String? read() => _decode(body.sublist(1), body[0]);
    switch (id) {
      case 'TIT2' || 'TT2':
        title = read();
      case 'TPE1' || 'TP1':
        artist = read();
      case 'TALB' || 'TAL':
        album = read();
      case 'TCON' || 'TCO':
        genre = _genre(read());
    }
  }
  return TrackTags(title: title, artist: artist, album: album, genre: genre);
}

/// ID3v1 — останні 128 байт файлу.
TrackTags parseId3v1(Uint8List tail) {
  if (tail.length < 128) return const TrackTags();
  final t = tail.sublist(tail.length - 128);
  if (t[0] != 0x54 || t[1] != 0x41 || t[2] != 0x47) return const TrackTags();
  String? field(int from, int length) => _clean(latin1.decode(t.sublist(from, from + length)).split('\u0000').first);
  return TrackTags(title: field(3, 30), artist: field(33, 30), album: field(63, 30));
}

TrackTags _sane(TrackTags tags) => TrackTags(
      title: junkMeta(tags.title) ? null : tags.title,
      artist: junkMeta(tags.artist) ? null : tags.artist,
      album: junkMeta(tags.album) ? null : tags.album,
      genre: tags.genre,
    );

Future<TrackTags> readFileTags(String path) async {
  try {
    final file = await File(path).open();
    try {
      final length = await file.length();
      final head = await file.read(10);
      var tags = const TrackTags();
      final size = id3Size(head);
      if (size > 0) {
        await file.setPosition(0);
        tags = parseId3v2(await file.read(size.clamp(0, 8 * 1024 * 1024)));
      }
      if (length > 128) {
        await file.setPosition(length - 128);
        tags = tags.or(parseId3v1(await file.read(128)));
      }
      return _sane(tags);
    } finally {
      await file.close();
    }
  } catch (_) {
    return const TrackTags();
  }
}

Future<Uint8List?> _range(String url, String range) async {
  try {
    final response = await http.get(Uri.parse(url), headers: {'Range': 'bytes=$range'}).timeout(const Duration(seconds: 12));
    return response.statusCode == 206 || response.statusCode == 200 ? response.bodyBytes : null;
  } catch (_) {
    return null;
  }
}

/// Теги файлу на сервері: читаємо лише початок (ID3v2) і кінець (ID3v1) запитами Range.
Future<TrackTags> readUrlTags(String url) async {
  var head = await _range(url, '0-262143');
  if (head == null) return const TrackTags();
  var tags = const TrackTags();
  final size = id3Size(head);
  if (size > head.length && size <= 8 * 1024 * 1024) head = await _range(url, '0-${size - 1}') ?? head;
  if (size > 0) tags = parseId3v2(head);
  final tail = await _range(url, '-128');
  if (tail != null && tail.length == 128) tags = tags.or(parseId3v1(tail));
  return _sane(tags);
}

// ───────────────────────── Каталог ─────────────────────────

String _fold(String s) => s.toLowerCase().replaceAll(RegExp(r'[^\p{L}\p{N}]+', unicode: true), ' ').trim();

String _strip(String title) => title.replaceAll(RegExp(r'\s*[\(\[][^\)\]]*(official|video|audio|lyrics|remaster|hd|hq|кліп|клип)[^\)\]]*[\)\]]', caseSensitive: false), '').trim();

/// Пошук у відкритому каталозі iTunes: уточнює назву й виконавця, додає альбом і жанр.
Future<TrackTags> lookupCatalog({String? artist, String? title}) async {
  final name = title == null ? null : _strip(title);
  final term = [artist, name].whereType<String>().where((s) => s.trim().isNotEmpty).join(' ');
  if (term.trim().length < 2) return const TrackTags();
  try {
    final uri = Uri.https('itunes.apple.com', '/search', {'term': term, 'entity': 'song', 'limit': '10'});
    final response = await http.get(uri).timeout(const Duration(seconds: 10));
    if (response.statusCode != 200) return const TrackTags();
    final results = maps(jsonDecode(utf8.decode(response.bodyBytes))['results']);
    if (results.isEmpty) return const TrackTags();
    int score(Map<String, dynamic> r) {
      final a = _fold('${r['artistName'] ?? ''}');
      final t = _fold('${r['trackName'] ?? ''}');
      var s = 0;
      if (artist != null && _fold(artist).isNotEmpty) s += a == _fold(artist) ? 4 : (a.contains(_fold(artist)) || _fold(artist).contains(a) ? 2 : 0);
      if (name != null && _fold(name).isNotEmpty) s += t == _fold(name) ? 4 : (t.contains(_fold(name)) || _fold(name).contains(t) ? 2 : 0);
      return s;
    }

    final best = results.reduce((a, b) => score(b) > score(a) ? b : a);
    if (score(best) < 2) return const TrackTags();
    return TrackTags(
      title: _clean('${best['trackName'] ?? ''}'),
      artist: _clean('${best['artistName'] ?? ''}'),
      album: _clean('${best['collectionName'] ?? ''}'.replaceFirst(RegExp(r'\s+-\s+(Single|EP)$'), '')),
      genre: _clean('${best['primaryGenreName'] ?? ''}', 40),
    );
  } catch (_) {
    return const TrackTags();
  }
}

/// Теги файлу → ім’я файлу → каталог. Повертає те, чим варто заповнити порожні чи «сміттєві» поля.
Future<TrackTags> discoverMeta({String? path, String? url, String? fileName, String? title, String? artist}) async {
  var found = path != null ? await readFileTags(path) : (url != null ? await readUrlTags(url) : const TrackTags());
  if (fileName != null) found = found.or(guessFromName(fileName));
  final knownTitle = found.title ?? (junkMeta(title) ? null : title);
  final knownArtist = found.artist ?? (junkMeta(artist) ? null : artist);
  final catalog = await lookupCatalog(artist: knownArtist, title: knownTitle);
  return TrackTags(
    title: knownTitle != null && catalog.title != null && _fold(knownTitle) == _fold(catalog.title!) ? catalog.title : (found.title ?? catalog.title),
    artist: knownArtist != null && catalog.artist != null && _fold(knownArtist) == _fold(catalog.artist!) ? catalog.artist : (found.artist ?? catalog.artist),
    album: found.album ?? catalog.album,
    genre: found.genre ?? catalog.genre,
  );
}

/// Записує знайдене лише в порожні поля або поля зі «сміттям».
int applyMeta(TrackTags tags, {required TextEditingController title, required TextEditingController artist, required TextEditingController album, required TextEditingController genre}) {
  var filled = 0;
  void put(TextEditingController c, String? value, {bool replaceSame = false}) {
    if (value == null) return;
    final current = c.text.trim();
    if (junkMeta(current) || (replaceSame && _fold(current) == _fold(value) && current != value)) {
      if (current != value) filled++;
      c.text = value;
    }
  }

  put(title, tags.title, replaceSame: true);
  put(artist, tags.artist, replaceSame: true);
  put(album, tags.album);
  put(genre, tags.genre);
  return filled;
}

// ───────────────────────── Редагування ─────────────────────────

/// Лист «Редагувати трек» з автозаповненням; повертає оновлену картку треку.
Future<Map<String, dynamic>?> editTrackSheet(BuildContext context, Map<String, dynamic> track) {
  return showGcSheet<Map<String, dynamic>>(
    context,
    title: 'Редагувати трек',
    builder: (sheet) => _TrackEditor(track: track, onSaved: (card) => Navigator.pop(sheet, card)),
  );
}

class _TrackEditor extends StatefulWidget {
  const _TrackEditor({required this.track, required this.onSaved});
  final Map<String, dynamic> track;
  final ValueChanged<Map<String, dynamic>> onSaved;

  @override
  State<_TrackEditor> createState() => _TrackEditorState();
}

class _TrackEditorState extends State<_TrackEditor> {
  late final title = TextEditingController(text: text(widget.track['title']) ?? '');
  late final artist = TextEditingController(text: text(widget.track['artist']) ?? '');
  late final album = TextEditingController(text: text(widget.track['album']) ?? '');
  late final genre = TextEditingController(text: text(widget.track['genre']) ?? '');
  bool searching = false;
  bool busy = false;
  String? note;

  @override
  void initState() {
    super.initState();
    if ([title, artist, album].any((c) => junkMeta(c.text))) WidgetsBinding.instance.addPostFrameCallback((_) => _autofill(quiet: true));
  }

  @override
  void dispose() {
    for (final c in [title, artist, album, genre]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _autofill({bool quiet = false}) async {
    setState(() {
      searching = true;
      note = null;
    });
    final tags = await discoverMeta(url: absolute(widget.track['url']), title: title.text, artist: artist.text);
    if (!mounted) return;
    final filled = applyMeta(tags, title: title, artist: artist, album: album, genre: genre);
    setState(() {
      searching = false;
      note = filled > 0 ? 'Заповнено полів: $filled. Перевірте й збережіть.' : (quiet ? null : 'Нічого нового не знайдено — заповніть вручну.');
    });
  }

  Future<void> _save() async {
    setState(() => busy = true);
    try {
      final result = await AppScope.read(context).session.api.patch(Api.site('/music/tracks/${widget.track['id']}'), {
        'title': title.text.trim(),
        'artist': artist.text.trim(),
        'album': album.text.trim(),
        'genre': genre.text.trim(),
      });
      if (!mounted) return;
      toast(context, 'Збережено.');
      widget.onSaved(mapOf(result['track']).isEmpty ? {...widget.track, 'title': title.text.trim(), 'artist': artist.text.trim(), 'album': album.text.trim(), 'genre': genre.text.trim()} : mapOf(result['track']));
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ready = title.text.trim().isNotEmpty && artist.text.trim().isNotEmpty;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        GhostButton(label: searching ? 'Шукаю метадані…' : 'Заповнити автоматично', icon: LucideIcons.wandSparkles, onPressed: searching || busy ? null : _autofill),
        Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 10),
          child: Text(note ?? 'Теги файлу, назва файлу й каталог iTunes: назва, виконавець, альбом і жанр.', style: body(12, color: note == null ? faint : muted)),
        ),
        LabeledField(label: 'Назва', child: GcField(controller: title, label: 'Назва', onChanged: (_) => setState(() {}))),
        const SizedBox(height: 10),
        LabeledField(label: 'Виконавець', child: GcField(controller: artist, label: 'Виконавець', onChanged: (_) => setState(() {}))),
        const SizedBox(height: 10),
        LabeledField(label: 'Альбом', child: GcField(controller: album, label: 'Необов’язково')),
        const SizedBox(height: 10),
        LabeledField(label: 'Жанр', child: GcField(controller: genre, label: 'Необов’язково')),
        const SizedBox(height: 16),
        PrimaryButton(label: 'Зберегти', icon: LucideIcons.check, busy: busy, onPressed: ready && !searching ? _save : null),
      ]),
    );
  }
}
