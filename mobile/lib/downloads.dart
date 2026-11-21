import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';

// «Завантажене»: треки GameCon (лише source = local — не Spotify й не радіо) на телефоні,
// щоб слухати без інтернету, як завантаження в Apple Music. Файли — у теці документів застосунку,
// поруч index.json з картками треків (ті самі ключі, що віддає сервер), альбомами й плейлистами.
// Після виходу з акаунта все стирається (приватність).

/// Завантаження одного файлу: [onProgress] — отримано байтів і скільки всього (якщо відомо),
/// [cancelled] перевіряється між шматками. Частковий [target] докачується (Range), якщо сервер уміє.
typedef DownloadFetch = Future<void> Function(Uri url, Map<String, String> headers, File target, {required void Function(int received, int? total) onProgress, required bool Function() cancelled});

/// Сервер відповів помилкою (404 — напр., сайт ще без маршруту оригіналу).
class DownloadHttpError implements Exception {
  DownloadHttpError(this.status);
  final int status;
  @override
  String toString() => 'HTTP $status';
}

class DownloadCancelled implements Exception {}

/// Помилка «немає місця» від файлової системи (ENOSPC: 28 на Linux/Android).
bool isLowStorage(Object error) {
  if (error is! FileSystemException) return false;
  final code = error.osError?.errorCode;
  final message = '${error.osError?.message ?? ''} ${error.message}'.toLowerCase();
  return code == 28 || message.contains('no space');
}

/// Звичайне завантаження через http: докачує частковий файл, якщо сервер віддає 206.
Future<void> httpFetch(Uri url, Map<String, String> headers, File target, {required void Function(int received, int? total) onProgress, required bool Function() cancelled}) async {
  final client = http.Client();
  try {
    final have = target.existsSync() ? target.lengthSync() : 0;
    final request = http.Request('GET', url)..headers.addAll({...headers, if (have > 0) 'Range': 'bytes=$have-'});
    final response = await client.send(request).timeout(const Duration(seconds: 40));
    if (response.statusCode == 416 && have > 0) {
      // Файл уже докачаний повністю.
      onProgress(have, have);
      return;
    }
    if (response.statusCode >= 400) throw DownloadHttpError(response.statusCode);
    final resume = response.statusCode == 206 && have > 0;
    var received = resume ? have : 0;
    final length = response.contentLength;
    final total = length == null ? null : length + received;
    final sink = target.openWrite(mode: resume ? FileMode.append : FileMode.write);
    try {
      await for (final chunk in response.stream.timeout(const Duration(seconds: 40))) {
        if (cancelled()) throw DownloadCancelled();
        sink.add(chunk);
        received += chunk.length;
        onProgress(received, total);
      }
      await sink.flush();
    } finally {
      await sink.close();
    }
    if (total != null && received < total) throw const HttpException('incomplete');
  } finally {
    client.close();
  }
}

/// Завантажений трек: картка з сервера, файл, розмір, обкладинка й навіщо він тут ([groups]:
/// `single`, `favorites`, `album:…`, `playlist:…`). Файл стирається, коли не лишається жодної групи.
class DownloadedTrack {
  DownloadedTrack({required this.id, required this.card, required this.file, required this.bytes, this.cover, Set<String>? groups, DateTime? added})
      : groups = groups ?? {},
        added = added ?? DateTime.now();

  final int id;
  Map<String, dynamic> card;
  final String file;
  final int bytes;
  final String? cover;
  final Set<String> groups;
  final DateTime added;

  Map<String, dynamic> toJson() => {'id': id, 'card': card, 'file': file, 'bytes': bytes, 'cover': cover, 'groups': groups.toList(), 'added': added.toIso8601String()};

  static DownloadedTrack? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final id = raw['id'] is int ? raw['id'] as int : int.tryParse('${raw['id']}');
    final file = text(raw['file']);
    if (id == null || file == null || raw['card'] is! Map) return null;
    return DownloadedTrack(
      id: id,
      card: Map<String, dynamic>.from(raw['card'] as Map),
      file: file,
      bytes: raw['bytes'] is int ? raw['bytes'] as int : 0,
      cover: text(raw['cover']),
      groups: {for (final g in (raw['groups'] is List ? raw['groups'] as List : const [])) '$g'},
      added: DateTime.tryParse('${raw['added']}'),
    );
  }
}

/// Завантажений альбом, плейлист чи «Улюблене»: назва, обкладинка й треки по порядку.
class DownloadCollection {
  DownloadCollection({required this.key, required this.kind, required this.title, this.subtitle, this.coverUrl, this.path, List<int>? trackIds})
      : trackIds = trackIds ?? [];

  final String key;

  /// album, playlist або favorites.
  final String kind;
  final String title;
  final String? subtitle;
  final String? coverUrl;

  /// Маршрут застосунку (сторінка альбому чи плейлиста), коли є інтернет.
  final String? path;
  List<int> trackIds;

  Map<String, dynamic> toJson() => {'key': key, 'kind': kind, 'title': title, 'subtitle': subtitle, 'cover_url': coverUrl, 'path': path, 'tracks': trackIds};

  static DownloadCollection? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final key = text(raw['key']);
    if (key == null) return null;
    return DownloadCollection(
      key: key,
      kind: text(raw['kind']) ?? 'album',
      title: text(raw['title']) ?? '',
      subtitle: text(raw['subtitle']),
      coverUrl: text(raw['cover_url']),
      path: text(raw['path']),
      trackIds: [for (final id in (raw['tracks'] is List ? raw['tracks'] as List : const [])) ?(id is int ? id : int.tryParse('$id'))],
    );
  }
}

/// Трек у черзі завантаження: прогрес, помилка, скасування.
class DownloadTask {
  DownloadTask(this.card, this.groups);
  Map<String, dynamic> card;
  final Set<String> groups;
  int received = 0;
  int? total;
  bool running = false;
  bool cancelled = false;
  String? error;

  int get id => card['id'] is int ? card['id'] as int : int.parse('${card['id']}');

  /// 0…1 або null, поки розмір невідомий.
  double? get progress => total == null || total == 0 ? null : (received / total!).clamp(0.0, 1.0);
}

/// Ключ альбому для «Завантаженого».
String albumDownloadKey(String artist, String title) => 'album:$artist|$title';

/// Картка треку, яку можна завантажити: лише треки GameCon (не Spotify, не радіо).
bool downloadable(Map<String, dynamic> card) {
  final source = text(card['source']) ?? 'local';
  final id = card['id'] is int ? card['id'] as int : int.tryParse('${card['id']}');
  return source == 'local' && card['live'] != true && id != null && id > 0 && absolute(card['url']) != null;
}

class Downloads extends ChangeNotifier {
  Downloads({required this.session, Future<Directory> Function()? root, DownloadFetch? fetch, this.retryDelay = const Duration(seconds: 3)})
      : _rootOf = root ?? _defaultRoot,
        _fetch = fetch ?? httpFetch;

  /// Один на застосунок (створюється в main.dart), щоб рядки пісень і плеєр бачили завантажене.
  static Downloads? instance;

  final Session session;
  final Future<Directory> Function() _rootOf;
  final DownloadFetch _fetch;
  final Duration retryDelay;

  /// Скільки треків качається одночасно.
  static const parallel = 2;
  static const attempts = 3;

  static Future<Directory> _defaultRoot() async => Directory('${(await getApplicationDocumentsDirectory()).path}/offline_music');

  Directory? _root;
  final _tracks = <int, DownloadedTrack>{};
  final _collections = <String, DownloadCollection>{};
  final _tasks = <int, DownloadTask>{};
  final _queue = <int>[];
  int _running = 0;
  Future<void>? _loading;
  Future<void> _saving = Future.value();

  /// Остання помилка для тосту (див. [takeError]).
  String? _error;

  // ───── Налаштування (на телефоні) ─────

  /// `stream` — копія, яку грає сайт (менше місця); `original` — файл, який завантажив автор.
  String get quality => session.prefs.getString('music.downloads.quality') ?? 'stream';
  set quality(String value) {
    unawaited(session.prefs.setString('music.downloads.quality', value == 'original' ? 'original' : 'stream'));
    notifyListeners();
  }

  /// «Автозавантаження улюбленого»: зірочка — і трек на телефоні.
  bool get autoFavorites => session.prefs.getBool('music.downloads.favorites') ?? false;
  set autoFavorites(bool on) {
    unawaited(session.prefs.setBool('music.downloads.favorites', on));
    notifyListeners();
    if (on) {
      unawaited(syncFavorites());
    } else {
      unawaited(removeCollection('favorites'));
    }
  }

  // ───── Стан ─────

  /// Немає зв’язку з GameCon (останній запит не дійшов) — розділ музики показує завантажене.
  bool get offline => !Api.online.value;

  bool get musicEnabled => session.modules?.contains('music') ?? true;

  List<DownloadedTrack> get tracks => _tracks.values.toList()..sort((a, b) => b.added.compareTo(a.added));
  List<DownloadCollection> get collections => _collections.values.toList();
  DownloadCollection? collection(String key) => _collections[key];
  List<DownloadTask> get tasks => _tasks.values.toList();
  bool get isEmpty => _tracks.isEmpty && _tasks.isEmpty;

  int get totalBytes => _tracks.values.fold(0, (sum, t) => sum + t.bytes);

  bool has(dynamic id) => _tracks.containsKey(_id(id));
  DownloadTask? task(dynamic id) => _tasks[_id(id)];

  /// Треки колекції, які вже на телефоні (по порядку).
  List<DownloadedTrack> tracksOf(String key) => [for (final id in _collections[key]?.trackIds ?? const <int>[]) ?_tracks[id]];

  /// Скільки треків колекції вже завантажено і скільки всього.
  (int, int) progressOf(String key) {
    final ids = _collections[key]?.trackIds ?? const <int>[];
    return (ids.where(_tracks.containsKey).length, ids.length);
  }

  /// Шлях до файлу треку на телефоні (null — не завантажено чи файл зник).
  String? fileFor(int? id) {
    final track = id == null ? null : _tracks[id];
    final root = _root;
    if (track == null || root == null) return null;
    final path = '${root.path}/${track.file}';
    return File(path).existsSync() ? path : null;
  }

  /// Збережена обкладинка для адреси з картки (щоб показувати її без інтернету).
  String? coverFor(String? url) {
    final root = _root;
    if (url == null || root == null) return null;
    for (final t in _tracks.values) {
      if (t.cover != null && absolute(t.card['cover_url']) == url) return '${root.path}/${t.cover}';
    }
    return null;
  }

  /// Нова помилка для тосту (одна й та сама показується один раз).
  String? takeError() {
    final value = _error;
    _error = null;
    return value;
  }

  static int? _id(dynamic id) => id is int ? id : int.tryParse('$id');

  // ───── Індекс ─────

  Future<void> load() => _loading ??= _load();

  Future<void> _load() async {
    final root = await _rootOf();
    _root = root;
    final index = File('${root.path}/index.json');
    if (!index.existsSync()) return;
    try {
      final raw = jsonDecode(await index.readAsString());
      if (raw is! Map) return;
      for (final item in (raw['tracks'] is List ? raw['tracks'] as List : const [])) {
        final t = DownloadedTrack.fromJson(item);
        if (t != null && File('${root.path}/${t.file}').existsSync()) _tracks[t.id] = t;
      }
      for (final item in (raw['collections'] is List ? raw['collections'] as List : const [])) {
        final c = DownloadCollection.fromJson(item);
        if (c != null) _collections[c.key] = c;
      }
    } catch (_) {
      // Пошкоджений індекс — починаємо з порожнього (файли перезапишуться при наступному завантаженні).
    }
    notifyListeners();
  }

  Future<void> _save() {
    return _saving = _saving.then((_) async {
      final root = _root;
      if (root == null) return;
      try {
        await root.create(recursive: true);
        final temp = File('${root.path}/index.json.tmp');
        await temp.writeAsString(jsonEncode({
          'tracks': [for (final t in _tracks.values) t.toJson()],
          'collections': [for (final c in _collections.values) c.toJson()],
        }));
        await temp.rename('${root.path}/index.json');
      } catch (e) {
        if (isLowStorage(e)) _fail(_lowStorage);
      }
    });
  }

  String get _lowStorage => tr('Недостатньо місця на телефоні. Звільніть пам’ять і спробуйте знову.');

  void _fail(String message) {
    _error = message;
    notifyListeners();
  }

  // ───── Завантаження ─────

  /// Додає трек у чергу завантаження. [group] — навіщо (`single`, `favorites`, `album:…`, `playlist:…`).
  Future<void> download(Map<String, dynamic> card, {String group = 'single'}) async {
    await load();
    if (!downloadable(card) || !musicEnabled) return;
    final id = _id(card['id'])!;
    final done = _tracks[id];
    if (done != null) {
      done.groups.add(group);
      done.card = {...done.card, ...card};
      notifyListeners();
      await _save();
      return;
    }
    final existing = _tasks[id];
    if (existing != null) {
      existing.groups.add(group);
      if (existing.error != null) {
        existing.error = null;
        _queue.add(id);
        _pump();
      }
      notifyListeners();
      return;
    }
    _tasks[id] = DownloadTask(Map<String, dynamic>.from(card), {group});
    _queue.add(id);
    notifyListeners();
    _pump();
  }

  /// Альбом чи плейлист цілком: запам’ятовуємо назву й порядок, кожен трек — у чергу.
  Future<void> downloadCollection({required String key, required String kind, required String title, String? subtitle, String? coverUrl, String? path, required List<Map<String, dynamic>> cards}) async {
    await load();
    final list = cards.where(downloadable).toList();
    final ids = [for (final c in list) _id(c['id'])!];
    final old = _collections[key];
    _collections[key] = DownloadCollection(key: key, kind: kind, title: title, subtitle: subtitle, coverUrl: absolute(coverUrl), path: path, trackIds: ids);
    // Треки, які зникли з плейлиста/«Улюбленого», більше не тримаються цією колекцією.
    for (final gone in (old?.trackIds ?? const <int>[]).where((id) => !ids.contains(id))) {
      await _release(gone, key);
    }
    for (final card in list) {
      await download(card, group: key);
    }
    notifyListeners();
    await _save();
  }

  /// Повторити трек, що не завантажився.
  void retry(int id) {
    final t = _tasks[id];
    if (t == null || t.running) return;
    t.error = null;
    if (!_queue.contains(id)) _queue.add(id);
    notifyListeners();
    _pump();
  }

  void cancel(int id) {
    final t = _tasks[id];
    if (t == null) return;
    t.cancelled = true;
    _queue.remove(id);
    if (!t.running) {
      _tasks.remove(id);
      unawaited(_deletePart(id));
    }
    notifyListeners();
  }

  void _pump() {
    while (_running < parallel && _queue.isNotEmpty) {
      final id = _queue.removeAt(0);
      final t = _tasks[id];
      if (t == null || t.running || t.cancelled) continue;
      _running++;
      t.running = true;
      unawaited(_run(t).whenComplete(() {
        _running--;
        t.running = false;
        _pump();
        notifyListeners();
      }));
    }
  }

  /// Скільки треків ще качається (для тестів і «Завантажене»).
  bool get busy => _running > 0 || _queue.isNotEmpty;

  /// Чекає, поки черга спорожніє (тести).
  Future<void> idle() async {
    while (busy) {
      await Future<void>.delayed(const Duration(milliseconds: 5));
    }
    await _saving;
  }

  Future<void> _run(DownloadTask t) async {
    for (var attempt = 1; attempt <= attempts; attempt++) {
      if (t.cancelled) break;
      try {
        await _fetchTrack(t);
        _tasks.remove(t.id);
        return;
      } on DownloadCancelled {
        break;
      } catch (e) {
        if (isLowStorage(e)) {
          t.error = _lowStorage;
          _fail(_lowStorage);
          return;
        }
        if (attempt == attempts) {
          t.error = e is DownloadHttpError && e.status == 403
              ? tr('Немає доступу до цього треку.')
              : tr('Не вдалося завантажити «{title}». Перевірте зв’язок і спробуйте знову.', {'title': text(t.card['title']) ?? ''});
          _fail(t.error!);
          return;
        }
        await Future<void>.delayed(retryDelay * attempt);
      }
    }
    // Скасовано.
    _tasks.remove(t.id);
    await _deletePart(t.id);
  }

  Future<void> _deletePart(int id) async {
    final root = _root;
    if (root == null) return;
    final dir = Directory('${root.path}/tracks');
    if (!dir.existsSync()) return;
    for (final f in dir.listSync().whereType<File>()) {
      if (f.path.split('/').last.startsWith('$id.') && f.path.endsWith('.part')) {
        try {
          await f.delete();
        } catch (_) {}
      }
    }
  }

  Map<String, String> get _auth => {'User-Agent': 'GameCon/1.0 (Flutter)', if (session.token != null) 'Authorization': 'Bearer ${session.token}'};

  Future<void> _fetchTrack(DownloadTask t) async {
    final root = _root!;
    final dir = Directory('${root.path}/tracks');
    await dir.create(recursive: true);
    final id = t.id;
    final stream = Uri.parse(absolute(t.card['url'])!);
    final ext = _extension(stream.path);
    final part = File('${dir.path}/$id.$ext.part');
    void progress(int received, int? total) {
      t.received = received;
      t.total = total;
      notifyListeners();
    }

    bool cancelled() => t.cancelled;
    if (quality == 'original') {
      try {
        await _fetch(Uri.parse('${Api.root}${Api.site('/music/tracks/$id/download')}'), _auth, part, onProgress: progress, cancelled: cancelled);
      } on DownloadHttpError catch (e) {
        // Сайт ще без оригіналу для застосунку — беремо копію для відтворення.
        if (e.status != 404) rethrow;
        if (part.existsSync()) await part.delete();
        await _fetch(stream, _auth, part, onProgress: progress, cancelled: cancelled);
      }
    } else {
      await _fetch(stream, _auth, part, onProgress: progress, cancelled: cancelled);
    }
    if (t.cancelled) throw DownloadCancelled();
    final name = 'tracks/$id.$ext';
    await part.rename('${root.path}/$name');
    final cover = await _fetchCover(id, absolute(t.card['cover_url']));
    _tracks[id] = DownloadedTrack(id: id, card: t.card, file: name, bytes: File('${root.path}/$name').lengthSync(), cover: cover, groups: t.groups);
    notifyListeners();
    await _save();
  }

  /// Обкладинка поруч із треком; без неї трек усе одно грає.
  Future<String?> _fetchCover(int id, String? url) async {
    if (url == null) return null;
    final root = _root!;
    final dir = Directory('${root.path}/covers');
    final name = 'covers/$id.img';
    try {
      await dir.create(recursive: true);
      final file = File('${root.path}/$name');
      if (file.existsSync()) await file.delete();
      await _fetch(Uri.parse(url), {'User-Agent': 'GameCon/1.0 (Flutter)'}, file, onProgress: (_, _) {}, cancelled: () => false);
      return name;
    } catch (e) {
      if (isLowStorage(e)) rethrow;
      return null;
    }
  }

  static String _extension(String path) {
    final last = path.split('/').last;
    final dot = last.lastIndexOf('.');
    final ext = dot < 0 ? '' : last.substring(dot + 1).toLowerCase();
    return RegExp(r'^[a-z0-9]{1,5}$').hasMatch(ext) ? ext : 'audio';
  }

  // ───── Видалення ─────

  /// Прибирає [group] з треку; без груп файл стирається.
  Future<void> _release(int id, String group) async {
    final t = _tracks[id];
    if (t == null) {
      final task = _tasks[id];
      if (task != null) {
        task.groups.remove(group);
        if (task.groups.isEmpty) cancel(id);
      }
      return;
    }
    t.groups.remove(group);
    if (t.groups.isEmpty) await _deleteFiles(t);
  }

  Future<void> _deleteFiles(DownloadedTrack t) async {
    _tracks.remove(t.id);
    final root = _root;
    if (root == null) return;
    for (final name in [t.file, ?t.cover]) {
      try {
        final f = File('${root.path}/$name');
        if (f.existsSync()) await f.delete();
      } catch (_) {}
    }
  }

  /// «Видалити з пристрою» для одного треку (з усіх альбомів і плейлистів).
  Future<void> removeTrack(int id) async {
    await load();
    cancel(id);
    final t = _tracks[id];
    if (t != null) await _deleteFiles(t);
    for (final c in _collections.values) {
      c.trackIds.remove(id);
    }
    _collections.removeWhere((_, c) => c.trackIds.isEmpty);
    notifyListeners();
    await _save();
  }

  /// Прибрати альбом/плейлист: треки, які не тримає ніщо інше, стираються.
  Future<void> removeCollection(String key) async {
    await load();
    final c = _collections.remove(key);
    if (c == null) return;
    for (final id in c.trackIds) {
      await _release(id, key);
    }
    notifyListeners();
    await _save();
  }

  /// «Видалити все» й вихід з акаунта: черга, файли й індекс.
  Future<void> clearAll() async {
    await load();
    for (final t in _tasks.values) {
      t.cancelled = true;
    }
    _queue.clear();
    _tasks.clear();
    _tracks.clear();
    _collections.clear();
    _error = null;
    notifyListeners();
    await _saving;
    final root = _root;
    if (root != null && root.existsSync()) {
      try {
        await root.delete(recursive: true);
      } catch (_) {}
    }
  }

  /// Зв’язок повернувся — повторюємо невдалі завантаження й звіряємо «Улюблене».
  void watchNetwork() {
    var was = Api.online.value;
    Api.online.addListener(() {
      final now = Api.online.value;
      if (now && !was) {
        for (final t in _tasks.values.where((t) => t.error != null).toList()) {
          retry(t.id);
        }
        unawaited(syncFavorites());
      }
      was = now;
    });
  }

  // ───── Улюблене ─────

  /// Зірочку поставили чи зняли (меню треку, плеєр) — з автозавантаженням трек качається чи стирається.
  Future<void> favoriteChanged(Map<String, dynamic> card, bool on) async {
    if (!autoFavorites || !downloadable(card)) return;
    await load();
    final id = _id(card['id'])!;
    final c = _collections.putIfAbsent('favorites', () => DownloadCollection(key: 'favorites', kind: 'favorites', title: 'Улюблене', path: '/music/library/favorites'));
    if (on) {
      if (!c.trackIds.contains(id)) c.trackIds.insert(0, id);
      await download(card, group: 'favorites');
    } else {
      c.trackIds.remove(id);
      await _release(id, 'favorites');
    }
    notifyListeners();
    await _save();
  }

  /// Звіряє «Улюблене» з сервером: нові зірочки качаються, зняті — стираються.
  Future<void> syncFavorites() async {
    if (!autoFavorites || !musicEnabled || session.token == null) return;
    final cards = <Map<String, dynamic>>[];
    try {
      for (var page = 1; page <= 20; page++) {
        final data = await session.api.get(Api.site('/music/library/favorites?page=$page'));
        final listing = Listing.parse(data['songs']);
        cards.addAll(listing.items);
        if (!listing.more) break;
      }
    } catch (_) {
      return; // Немає зв’язку — звіримо наступного разу, нічого не стираємо.
    }
    await downloadCollection(key: 'favorites', kind: 'favorites', title: 'Улюблене', path: '/music/library/favorites', cards: cards);
  }
}

/// «12,4 МБ» — розмір завантаженого.
String bytesLabel(int bytes) {
  if (bytes < 1024 * 1024) return tr('{n} КБ', {'n': (bytes / 1024).ceil()});
  final mb = bytes / (1024 * 1024);
  if (mb < 1024) return tr('{n} МБ', {'n': mb.toStringAsFixed(mb < 100 ? 1 : 0).replaceAll('.', ',')});
  return tr('{n} ГБ', {'n': (mb / 1024).toStringAsFixed(1).replaceAll('.', ',')});
}
