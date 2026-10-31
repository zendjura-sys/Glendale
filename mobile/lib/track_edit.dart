import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';
import 'i18n.dart';

/// Метадані треку з тегів, назви файлу чи каталогу; [cover] — обкладинка альбому з каталогу.
class TrackTags {
  const TrackTags({this.title, this.artist, this.album, this.genre, this.cover});
  final String? title;
  final String? artist;
  final String? album;
  final String? genre;
  final String? cover;

  bool get isEmpty => title == null && artist == null && album == null && genre == null;

  TrackTags or(TrackTags other) => TrackTags(
        title: title ?? other.title,
        artist: artist ?? other.artist,
        album: album ?? other.album,
        genre: genre ?? other.genre,
        cover: cover ?? other.cover,
      );
}

final _junkName = RegExp(r'^(tmp[a-z0-9_-]*|[0-9a-f]{8,}|[a-z0-9]{6,}[_-]?\d{3,}|audio[_-]?\d+|track\s*\d+)$', caseSensitive: false);

/// Назви на кшталт «tmpnvpze33q», «40b74fc09897c7» чи «.» — це не метадані, а сміття з імені тимчасового файлу.
bool junkMeta(String? value) {
  final v = value?.trim() ?? '';
  return v.isEmpty || !RegExp(r'[\p{L}\p{N}]', unicode: true).hasMatch(v) || _junkName.hasMatch(v);
}

/// Виконавець для показу: «.» і подібне сміття — це «Невідомий виконавець».
String artistOf(dynamic artist, [String fallback = 'Невідомий виконавець']) {
  final value = text(artist);
  return junkMeta(value) ? tr(fallback) : value!;
}

final _repairing = <int>{};

/// Старі треки, завантажені до появи парсера, мають назви тимчасових файлів. Читаємо теги
/// самого файлу (без каталогу — він може вгадати неправильно) і, якщо трек свій, зберігаємо.
/// Повертає виправлену картку або `null`, якщо нічого не знайшлося.
Future<Map<String, dynamic>?> repairTrackMeta(Session session, Map<String, dynamic> card) async {
  final id = intOf(card['id']);
  final url = absolute(card['url']);
  if (id == 0 || url == null || text(card['source']) == 'spotify') return null;
  if (!junkMeta(text(card['title'])) && !junkMeta(text(card['artist']))) return null;
  if (!_repairing.add(id)) return null;
  final tags = await readUrlTags(url);
  final fixed = <String, dynamic>{...card};
  var changed = false;
  void put(String key, String? value) {
    if (value != null && junkMeta(text(card[key]))) {
      fixed[key] = value;
      changed = true;
    }
  }

  put('title', tags.title);
  put('artist', tags.artist);
  put('album', tags.album);
  put('genre', tags.genre);
  if (!changed) return null;
  if (intOf(card['user_id']) == session.myId) {
    try {
      await session.api.patch(Api.site('/music/tracks/$id'), {
        for (final key in ['title', 'artist', 'album', 'genre']) key: text(fixed[key]) ?? '',
      });
    } catch (_) {}
  }
  return fixed;
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

/// Схожість двох рядків 0…1 (відстань Левенштейна) — щоб виправляти друкарські помилки й регістр.
double similarity(String a, String b) {
  final x = _fold(a), y = _fold(b);
  if (x.isEmpty || y.isEmpty) return 0;
  if (x == y) return 1;
  var prev = List<int>.generate(y.length + 1, (j) => j);
  for (var i = 1; i <= x.length; i++) {
    final cur = List<int>.filled(y.length + 1, 0);
    cur[0] = i;
    for (var j = 1; j <= y.length; j++) {
      final cost = x.codeUnitAt(i - 1) == y.codeUnitAt(j - 1) ? 0 : 1;
      cur[j] = math.min(math.min(prev[j] + 1, cur[j - 1] + 1), prev[j - 1] + cost);
    }
    prev = cur;
  }
  return 1 - prev[y.length] / math.max(x.length, y.length);
}

/// Значення з каталогу вважаємо «тим самим», лише трохи інакше записаним.
bool _same(String? known, String? found) => known != null && found != null && similarity(known, found) >= 0.75;

TrackTags _fromCatalog(Map<String, dynamic> r) {
  final art = text(r['artworkUrl100']);
  return TrackTags(
    title: _clean('${r['trackName'] ?? ''}'),
    artist: _clean('${r['artistName'] ?? ''}'),
    album: _clean('${r['collectionName'] ?? ''}'.replaceFirst(RegExp(r'\s+-\s+(Single|EP)$'), '')),
    genre: _clean('${r['primaryGenreName'] ?? ''}', 40),
    // 100×100 → 600×600: та сама картинка в більшому розмірі.
    cover: art?.replaceFirst(RegExp(r'\d+x\d+bb'), '600x600bb'),
  );
}

/// Відкритий каталог iTunes: спершу український магазин, потім загальний.
Future<List<Map<String, dynamic>>> _itunes(String term, {int limit = 10}) async {
  if (term.trim().length < 2) return const [];
  for (final country in ['UA', 'US']) {
    try {
      final uri = Uri.https('itunes.apple.com', '/search', {'term': term, 'entity': 'song', 'limit': '$limit', 'country': country});
      final response = await http.get(uri).timeout(const Duration(seconds: 10));
      if (response.statusCode != 200) continue;
      final results = maps(jsonDecode(utf8.decode(response.bodyBytes))['results']);
      if (results.isNotEmpty) return results;
    } catch (_) {}
  }
  return const [];
}

/// Пошук за довільним текстом («виконавець назва», уривок назви): до [limit] різних треків з обкладинками.
Future<List<TrackTags>> searchCatalog(String query, {int limit = 6}) async {
  final seen = <String>{};
  final found = <TrackTags>[];
  for (final r in await _itunes(_strip(query), limit: 15)) {
    final tags = _fromCatalog(r);
    if (tags.title == null || tags.artist == null || !seen.add(_fold('${tags.artist} ${tags.title}'))) continue;
    found.add(tags);
    if (found.length >= limit) break;
  }
  return found;
}

/// Пошук у відкритому каталозі iTunes: уточнює назву й виконавця (з друкарськими помилками теж), додає альбом, жанр і обкладинку.
Future<TrackTags> lookupCatalog({String? artist, String? title}) async {
  final name = title == null ? null : _strip(title);
  final term = [artist, name].whereType<String>().where((s) => s.trim().isNotEmpty).join(' ');
  final results = await _itunes(term);
  if (results.isEmpty) return const TrackTags();
  double part(String found, String? known) {
    if (known == null || _fold(known).isEmpty) return 0;
    final f = _fold(found), k = _fold(known);
    if (f == k) return 1;
    if (f.contains(k) || k.contains(f)) return 0.7;
    final sim = similarity(f, k);
    return sim >= 0.75 ? sim * 0.9 : 0;
  }

  double score(Map<String, dynamic> r) => part('${r['artistName'] ?? ''}', artist) + part('${r['trackName'] ?? ''}', name);
  final best = results.reduce((a, b) => score(b) > score(a) ? b : a);
  return score(best) < 0.7 ? const TrackTags() : _fromCatalog(best);
}

/// Теги файлу → ім’я файлу → каталог. Повертає те, чим варто заповнити порожні чи «сміттєві» поля
/// й виправити написання (регістр, друкарські помилки) за каталогом.
Future<TrackTags> discoverMeta({String? path, String? url, String? fileName, String? title, String? artist}) async {
  var found = path != null ? await readFileTags(path) : (url != null ? await readUrlTags(url) : const TrackTags());
  if (fileName != null) found = found.or(guessFromName(fileName));
  final knownTitle = found.title ?? (junkMeta(title) ? null : title);
  final knownArtist = found.artist ?? (junkMeta(artist) ? null : artist);
  final catalog = await lookupCatalog(artist: knownArtist, title: knownTitle);
  return TrackTags(
    title: _same(knownTitle, catalog.title) ? catalog.title : (found.title ?? catalog.title),
    artist: _same(knownArtist, catalog.artist) ? catalog.artist : (found.artist ?? catalog.artist),
    album: _same(found.album, catalog.album) ? catalog.album : (found.album ?? catalog.album),
    genre: found.genre ?? catalog.genre,
    cover: catalog.cover,
  );
}

/// Записує знайдене в порожні поля або поля зі «сміттям», а схоже написане (регістр, друкарські помилки)
/// виправляє на варіант із каталогу. З [overwrite] (вибір користувача з пошуку) замінює все.
int applyMeta(TrackTags tags, {required TextEditingController title, required TextEditingController artist, required TextEditingController album, required TextEditingController genre, bool overwrite = false}) {
  var filled = 0;
  void put(TextEditingController c, String? value, {bool correct = false}) {
    if (value == null) return;
    final current = c.text.trim();
    if (overwrite || junkMeta(current) || (correct && current != value && _same(current, value))) {
      if (current != value) filled++;
      c.text = value;
    }
  }

  put(title, tags.title, correct: true);
  put(artist, tags.artist, correct: true);
  put(album, tags.album, correct: true);
  put(genre, tags.genre);
  return filled;
}

/// «Що відомо про пісню»: довільний текст → каталог → список треків з обкладинками.
/// Найкращий збіг підставляється одразу, інший можна обрати торканням.
class CatalogSearch extends StatefulWidget {
  const CatalogSearch({required this.onPick, super.key});
  final ValueChanged<TrackTags> onPick;

  @override
  State<CatalogSearch> createState() => _CatalogSearchState();
}

class _CatalogSearchState extends State<CatalogSearch> {
  final query = TextEditingController();
  List<TrackTags> results = [];
  TrackTags? picked;
  bool searching = false;
  String? note;

  @override
  void dispose() {
    query.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    final q = query.text.trim();
    if (q.length < 2 || searching) return;
    FocusScope.of(context).unfocus();
    setState(() {
      searching = true;
      note = null;
    });
    final found = await searchCatalog(q);
    if (!mounted) return;
    setState(() {
      searching = false;
      results = found;
      note = found.isEmpty ? tr('Нічого не знайдено. Спробуйте «виконавець назва» або іншу частину назви.') : null;
    });
    if (found.isNotEmpty) _pick(found.first);
  }

  void _pick(TrackTags tags) {
    setState(() => picked = tags);
    widget.onPick(tags);
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      LabeledField(
        label: tr('Що відомо про пісню'),
        child: Row(children: [
          Expanded(child: GcField(controller: query, label: tr('Виконавець, назва чи її частина'), icon: LucideIcons.search, onSubmit: _search)),
          const SizedBox(width: 8),
          GhostButton(label: tr('Знайти'), expand: false, compact: true, onPressed: searching ? null : _search),
        ]),
      ),
      if (searching)
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Row(children: [const SizedBox.square(dimension: 14, child: CircularProgressIndicator(strokeWidth: 2)), const SizedBox(width: 8), Text(tr('Шукаю в каталозі…'), style: body(12.5, color: muted))]),
        ),
      if (note != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(note!, style: body(12, color: muted))),
      for (final tags in results)
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => _pick(tags),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox.square(
                  dimension: 40,
                  child: tags.cover == null
                      ? Container(color: fg.withValues(alpha: 0.06), child: Icon(LucideIcons.music, size: 18, color: muted))
                      : Image.network(tags.cover!, fit: BoxFit.cover, errorBuilder: (_, _, _) => Container(color: fg.withValues(alpha: 0.06))),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(tags.title ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(13.5, weight: FontWeight.w600)),
                  Text([tags.artist, tags.album].whereType<String>().join(' · '), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
                ]),
              ),
              if (identical(tags, picked)) Icon(LucideIcons.check, size: 18, color: primary),
            ]),
          ),
        ),
    ]);
  }
}

/// Мініатюра обкладинки в формах: локальний файл, посилання з каталогу або заглушка.
class CoverPreview extends StatelessWidget {
  const CoverPreview({this.url, this.image, this.size = 72, super.key});
  final String? url;
  final ImageProvider? image;
  final double size;

  @override
  Widget build(BuildContext context) {
    final provider = image ?? (url == null ? null : NetworkImage(url!));
    return SizedBox(
      width: size,
      height: size,
      child: provider == null
          ? Container(
              decoration: BoxDecoration(color: fg.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(14)),
              child: Icon(LucideIcons.imagePlus, color: muted),
            )
          : ClipRRect(borderRadius: BorderRadius.circular(14), child: Image(image: provider, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox())),
    );
  }
}

// ───────────────────────── Редагування ─────────────────────────

/// Лист «Редагувати трек» з автозаповненням; повертає оновлену картку треку.
Future<Map<String, dynamic>?> editTrackSheet(BuildContext context, Map<String, dynamic> track) {
  return showGcSheet<Map<String, dynamic>>(
    context,
    title: tr('Редагувати трек'),
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

  /// Обкладинка з каталогу, яку збережемо разом із треком.
  String? coverUrl;

  /// Обкладинка, вбудована в сам аудіофайл (знайшов сервер) — збережеться з треком.
  bool coverEmbedded = false;
  late final String? currentCover = absolute(widget.track['cover_url']);

  @override
  void initState() {
    super.initState();
    // Одразу доповнюємо й виправляємо те, що є: теги файлу, назву, каталог і обкладинку.
    WidgetsBinding.instance.addPostFrameCallback((_) => _autofill(quiet: true));
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
    // Спершу сервер: теги файлу, AcoustID, MusicBrainz, Discogs, Spotify, Last.fm, Cover Art Archive —
    // найнадійніше значення кожного поля. Потім — пошук у застосунку (теги, назва файлу, iTunes).
    var filled = 0;
    try {
      final found = mapOf(await AppScope.read(context).session.api.get(Api.site('/music/tracks/${widget.track['id']}/metadata')));
      final fields = mapOf(found['fields']);
      for (final (key, c) in [('title', title), ('artist', artist), ('album', album), ('genre', genre)]) {
        final value = text(mapOf(fields[key])['value']);
        if (value != null && value != c.text.trim()) {
          c.text = value;
          filled++;
        }
      }
      final cover = mapOf(found['cover']);
      if (cover.isNotEmpty && coverUrl == null) {
        if (cover['embedded'] == true) {
          coverEmbedded = true;
          filled++;
        } else if (text(cover['url']) != null) {
          coverUrl = text(cover['url']);
          filled++;
        }
      }
    } catch (_) {
      // Сервер недоступний чи старий — лишається пошук у застосунку.
    }
    if (!mounted) return;
    final tags = await discoverMeta(url: absolute(widget.track['url']), title: title.text, artist: artist.text);
    if (!mounted) return;
    filled += applyMeta(tags, title: title, artist: artist, album: album, genre: genre);
    if (currentCover == null && coverUrl == null && tags.cover != null) {
      coverUrl = tags.cover;
      filled++;
    }
    setState(() {
      searching = false;
      note = filled > 0 ? tr('Заповнено й виправлено полів: {filled}. Перевірте й збережіть.', {'filled': filled}) : (quiet ? null : tr('Нічого нового не знайдено — опишіть пісню в пошуку нижче.'));
    });
  }

  void _picked(TrackTags tags) {
    applyMeta(tags, title: title, artist: artist, album: album, genre: genre, overwrite: true);
    setState(() {
      if (tags.cover != null) coverUrl = tags.cover;
      note = tr('Підставлено з каталогу. Перевірте й збережіть.');
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
        if (coverUrl != null) 'cover_url': coverUrl,
        if (coverUrl == null && coverEmbedded) 'cover_embedded': true,
      });
      if (!mounted) return;
      toast(context, tr('Збережено.'));
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
        GhostButton(label: searching ? tr('Шукаю метадані…') : tr('Заповнити автоматично'), icon: LucideIcons.wandSparkles, onPressed: searching || busy ? null : _autofill),
        Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 10),
          child: Text(note ?? tr('Теги файлу, AcoustID, MusicBrainz, Discogs, Spotify, Last.fm і каталог iTunes: назва, виконавець, альбом, жанр і обкладинка.'), style: body(12, color: note == null ? faint : muted)),
        ),
        CatalogSearch(onPick: _picked),
        const SizedBox(height: 12),
        Row(children: [
          CoverPreview(url: coverUrl ?? currentCover),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              coverUrl != null
                  ? tr('Обкладинка з каталогу — збережеться разом із треком.')
                  : coverEmbedded
                  ? tr('Обкладинка з самого файлу — збережеться разом із треком.')
                  : (currentCover != null ? tr('Поточна обкладинка.') : tr('Обкладинки поки немає — знайдіть пісню в пошуку вище.')),
              style: body(12.5, color: muted),
            ),
          ),
          if (coverUrl != null) IconButton(tooltip: tr('Не змінювати обкладинку'), onPressed: () => setState(() => coverUrl = null), icon: Icon(LucideIcons.x, size: 18, color: muted)),
        ]),
        const SizedBox(height: 12),
        LabeledField(label: tr('Назва'), child: GcField(controller: title, label: tr('Назва'), onChanged: (_) => setState(() {}))),
        const SizedBox(height: 10),
        LabeledField(label: tr('Виконавець'), child: GcField(controller: artist, label: tr('Виконавець'), onChanged: (_) => setState(() {}))),
        const SizedBox(height: 10),
        LabeledField(label: tr('Альбом'), child: GcField(controller: album, label: tr('Необов’язково'))),
        const SizedBox(height: 10),
        LabeledField(label: tr('Жанр'), child: GcField(controller: genre, label: tr('Необов’язково'))),
        const SizedBox(height: 16),
        PrimaryButton(label: tr('Зберегти'), icon: LucideIcons.check, busy: busy, onPressed: ready && !searching ? _save : null),
      ]),
    );
  }
}
