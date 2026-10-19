import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:just_audio/just_audio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'nav_items.dart';
import 'subscription.dart';
import 'theme_controller.dart';
import 'i18n.dart';

class Session extends ChangeNotifier {
  Session(this.prefs) : api = Api(() => _token) {
    _token = prefs.getString('token');
    subscription = SubscriptionController(api, prefs);
  }

  final SharedPreferences prefs;
  final Api api;
  static String? _token;

  /// GameCon+ цього акаунта: статус і покупка через Google Play Billing (див. subscription.dart, play_billing.dart).
  late final SubscriptionController subscription;

  static bool get hasToken => _token != null;

  String? get token => _token;
  Map<String, dynamic>? me;
  bool ready = false;
  Uri? handoff;
  String? notice;
  int spotifyStamp = 0;
  int unreadNotifications = 0;
  int unreadChats = 0;
  Timer? _poll;

  String? get username => text(me?['username']);
  int? get myId => me?['id'] is int ? me!['id'] as int : int.tryParse('${me?['id']}');
  bool get isAdmin => me?['role'] == 'admin';

  String get _navKey => 'nav.tabs.${myId ?? 0}';

  /// Розділи нижньої панелі, які обрав цей акаунт (без «Меню» — воно завжди останнє).
  /// Вибір зберігається в акаунті й однаковий на сайті та в застосунку; локальна копія —
  /// поки профіль ще не завантажився.
  /// Розділи, увімкнені для цього акаунта (режим соцмережі й адмінка); null — ще не відомо.
  Set<String>? get modules => me?['modules'] is List ? {for (final key in me!['modules'] as List) '$key'} : null;

  List<String> get navTabs {
    final server = me?['nav_tabs'];
    final saved = server is List ? [for (final key in server) '/$key'] : prefs.getStringList(_navKey);
    if (saved == null) return defaultNav;
    final clean = cleanNav(saved);
    return clean.isEmpty ? defaultNav : clean;
  }

  Future<void> setNavTabs(List<String> tabs) async {
    final clean = cleanNav(tabs);
    if (clean.isEmpty) return;
    final previous = me?['nav_tabs'];
    final previousLocal = prefs.getStringList(_navKey);
    Future<void> keep(List<String>? local) => local == null || listEquals(local, defaultNav) ? prefs.remove(_navKey) : prefs.setStringList(_navKey, local);

    me?['nav_tabs'] = [for (final path in clean) path.substring(1)];
    await keep(clean);
    notifyListeners();
    if (me == null) return;
    try {
      await api.put(Api.site('/settings/navigation'), {'tabs': me!['nav_tabs']});
    } catch (_) {
      me?['nav_tabs'] = previous;
      await keep(previousLocal);
      notifyListeners();
      rethrow;
    }
  }

  Future<void> boot() async {
    if (_token != null) {
      try {
        me = await api.me();
        _syncTheme();
        _startPolling();
        unawaited(subscription.refreshSubscriptionStatus());
      } catch (_) {
        await clear();
      }
    }
    ready = true;
    notifyListeners();
  }

  Future<void> saveToken(String value, Map<String, dynamic>? user) async {
    _token = value;
    await prefs.setString('token', value);
    me = user ?? await api.me();
    _syncTheme();
    _startPolling();
    unawaited(subscription.refreshSubscriptionStatus());
    notifyListeners();
  }

  Future<void> refreshMe() async {
    me = await api.me();
    _syncTheme();
    notifyListeners();
  }

  Future<void> clear() async {
    _poll?.cancel();
    _token = null;
    me = null;
    unreadChats = 0;
    unreadNotifications = 0;
    await prefs.remove('token');
    await subscription.reset();
    notifyListeners();
  }

  /// Тема з акаунта (та сама, що на сайті).
  void _syncTheme() {
    final theme = me?['theme'];
    if (theme is String && theme != ThemeController.instance.pref) ThemeController.instance.setPref(theme);
  }

  /// Змінити тему: одразу тут і в акаунті (сайт підхопить при наступному відкритті).
  Future<void> setTheme(String value) async {
    ThemeController.instance.setPref(value);
    if (me != null) me!['theme'] = value;
    if (_token == null) return;
    try {
      await api.put(Api.site('/settings/theme'), {'theme': value});
    } catch (_) {
      // Немає мережі — вибір лишається на телефоні й піде на сервер наступного разу.
    }
  }

  void _startPolling() {
    _poll?.cancel();
    refreshCounters();
    _poll = Timer.periodic(const Duration(seconds: 30), (_) => refreshCounters());
  }

  /// Лічильники для дзвіночка й вкладки «Чати» (на сайті їх оновлює Reverb).
  Future<void> refreshCounters() async {
    if (_token == null) return;
    try {
      final notes = await api.get('/api/v1/notifications');
      final chats = await api.get('/api/v1/messages');
      final n = int.tryParse('${notes['unread'] ?? 0}') ?? 0;
      final c = int.tryParse('${chats['unread'] ?? 0}') ?? 0;
      if (n != unreadNotifications || c != unreadChats) {
        unreadNotifications = n;
        unreadChats = c;
        notifyListeners();
      }
    } catch (_) {}
  }

  void takeLink(Uri uri) {
    if (uri.scheme != 'gamecon') return;
    handoff = uri;
    notifyListeners();
  }

  void consumeLink() {
    handoff = null;
  }

  void noteSpotify() {
    spotifyStamp++;
    notifyListeners();
  }

  void toast(String message) {
    notice = message;
    notifyListeners();
  }

  @override
  void dispose() {
    _poll?.cancel();
    subscription.dispose();
    super.dispose();
  }
}

/// Один трек у черзі програвача (локальний трек GameCon).
class QueueTrack {
  QueueTrack({required this.id, required this.url, required this.title, required this.artist, this.cover, this.album, this.genre, this.userId, this.hasLyrics = false});
  final int? id;
  final String url;
  final String title;
  final String artist;
  final String? cover;
  final String? album;
  final String? genre;
  final int? userId;

  /// У треку є текст (караоке, якщо з мітками LRC).
  final bool hasLyrics;

  /// Картка для листа редагування (ті ж ключі, що віддає сервер).
  Map<String, dynamic> toCard() => {'id': id, 'url': url, 'title': title, 'artist': artist, 'album': album, 'genre': genre, 'cover_url': cover, 'user_id': userId};

  static QueueTrack? fromJson(Map<String, dynamic> track) {
    final url = absolute(track['url']);
    if (url == null) return null;
    return QueueTrack(
      id: track['id'] is int ? track['id'] as int : int.tryParse('${track['id']}'),
      url: url,
      title: text(track['title']) ?? tr('Без назви'),
      artist: text(track['artist']) ?? '',
      cover: absolute(track['cover_url']),
      album: text(track['album']),
      genre: text(track['genre']),
      userId: track['user_id'] is int ? track['user_id'] as int : int.tryParse('${track['user_id']}'),
      hasLyrics: track['has_lyrics'] == true,
    );
  }
}

class TrackPlayer extends ChangeNotifier {
  TrackPlayer() {
    _player.playerStateStream.listen((state) {
      playing = state.playing;
      if (state.processingState == ProcessingState.completed) {
        next(auto: true);
      }
      notifyListeners();
    });
    _player.positionStream.listen((value) {
      position = value;
      notifyListeners();
    });
    _player.durationStream.listen((value) {
      duration = value ?? Duration.zero;
      notifyListeners();
    });
  }

  final _player = AudioPlayer();
  final _random = Random();

  /// Викликається на початку кожного треку (тут лагодять «сміттєві» назви).
  void Function(QueueTrack track)? onStart;

  /// Рушій відтворення — для медіасесії в шторці (`GcAudioHandler`).
  AudioPlayer get engine => _player;
  Session? session;
  List<QueueTrack> queue = [];
  int index = -1;
  bool playing = false;
  bool shuffle = false;
  bool repeat = false;
  Duration position = Duration.zero;
  Duration duration = Duration.zero;

  int _covers = 0;

  /// Міні-плеер прибрано з екрана (музика грає далі), поки відкрита форма, якій він заважає.
  bool get covered => _covers > 0;

  Future<T> coverWhile<T>(Future<T> Function() body) async {
    _covers++;
    notifyListeners();
    try {
      return await body();
    } finally {
      _covers--;
      notifyListeners();
    }
  }

  QueueTrack? get current => index >= 0 && index < queue.length ? queue[index] : null;
  String get title => current?.title ?? '';
  String get artist => current?.artist ?? '';

  bool isCurrent(dynamic id) => current != null && '${current!.id}' == '$id';

  /// Грає [tracks] з позиції [start]; повторне натискання на поточний трек — пауза.
  Future<void> playList(List<Map<String, dynamic>> tracks, int start) async {
    final items = <QueueTrack>[];
    var target = 0;
    for (var i = 0; i < tracks.length; i++) {
      final item = QueueTrack.fromJson(tracks[i]);
      if (item == null) continue;
      if (i == start) target = items.length;
      items.add(item);
    }
    if (items.isEmpty) return;
    if (current != null && start < tracks.length && isCurrent(tracks[start]['id'])) {
      await toggle();
      return;
    }
    queue = items;
    await _start(target);
  }

  Future<void> play(String url, String nextTitle, String nextArtist) async {
    queue = [QueueTrack(id: null, url: url, title: nextTitle, artist: nextArtist)];
    await _start(0);
  }

  Future<void> _start(int i) async {
    index = i;
    position = Duration.zero;
    notifyListeners();
    final track = queue[i];
    onStart?.call(track);
    try {
      await _player.setUrl(track.url);
      unawaited(_player.play());
      if (track.id != null) {
        unawaited(session?.api.post('/api/v1/music/now-playing', {'track_id': track.id}).catchError((_) => <String, dynamic>{}));
      }
    } catch (_) {}
  }

  Future<void> toggle({bool forcePlay = false}) async {
    if (_player.playing && !forcePlay) {
      await _player.pause();
    } else if (current != null) {
      await _player.play();
    }
  }

  Future<void> next({bool auto = false}) async {
    if (queue.isEmpty) return;
    if (auto && repeat) return _start(index);
    var n = shuffle && queue.length > 1 ? _random.nextInt(queue.length - 1) : index + 1;
    if (shuffle && queue.length > 1 && n >= index) n++;
    if (n >= queue.length) {
      if (auto) {
        await _player.pause();
        await _player.seek(Duration.zero);
        return;
      }
      n = 0;
    }
    await _start(n);
  }

  Future<void> prev() async {
    if (queue.isEmpty) return;
    if (position.inSeconds > 3) return seek(Duration.zero);
    await _start(index <= 0 ? queue.length - 1 : index - 1);
  }

  Future<void> seek(Duration to) => _player.seek(to);

  Future<void> playAt(int i) async {
    if (i < 0 || i >= queue.length) return;
    if (i == index) return toggle();
    await _start(i);
  }

  /// Перетягування в черзі: [to] — нова позиція після вилучення з [from].
  void move(int from, int to) {
    if (from < 0 || from >= queue.length) return;
    to = to.clamp(0, queue.length - 1);
    if (to == from) return;
    final playingNow = current;
    final item = queue.removeAt(from);
    queue.insert(to, item);
    index = playingNow == null ? index : queue.indexOf(playingNow);
    notifyListeners();
  }

  Future<void> removeAt(int i) async {
    if (i < 0 || i >= queue.length) return;
    if (queue.length == 1) return stop();
    final wasCurrent = i == index;
    queue.removeAt(i);
    if (i < index) index--;
    if (wasCurrent) {
      await _start(index.clamp(0, queue.length - 1));
    } else {
      notifyListeners();
    }
  }

  /// «Грати наступним» або «Додати в кінець черги».
  Future<void> enqueue(Map<String, dynamic> track, {bool next = false}) async {
    final item = QueueTrack.fromJson(track);
    if (item == null) return;
    if (current == null) {
      queue = [item];
      return _start(0);
    }
    final existing = queue.indexWhere((t) => t.id != null && t.id == item.id);
    if (existing == index) return;
    if (existing >= 0) {
      queue.removeAt(existing);
      if (existing < index) index--;
    }
    queue.insert(next ? index + 1 : queue.length, item);
    notifyListeners();
  }

  /// Підхоплює нові назву/виконавця/альбом після редагування треку.
  void updateMeta(Map<String, dynamic> card) {
    final id = card['id'] is int ? card['id'] as int : int.tryParse('${card['id']}');
    var changed = false;
    for (var i = 0; i < queue.length; i++) {
      final old = queue[i];
      if (id == null || old.id != id) continue;
      queue[i] = QueueTrack(
        id: old.id,
        url: old.url,
        title: text(card['title']) ?? old.title,
        artist: text(card['artist']) ?? '',
        cover: absolute(card['cover_url']) ?? old.cover,
        album: text(card['album']),
        genre: text(card['genre']),
        userId: old.userId,
        hasLyrics: card['has_lyrics'] is bool ? card['has_lyrics'] as bool : old.hasLyrics,
      );
      changed = true;
    }
    if (changed) notifyListeners();
  }

  void toggleShuffle() {
    shuffle = !shuffle;
    notifyListeners();
  }

  void toggleRepeat() {
    repeat = !repeat;
    notifyListeners();
  }

  Future<void> stop() async {
    await _player.stop();
    queue = [];
    index = -1;
    notifyListeners();
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }
}

/// Доступ до сесії й програвача з будь-якого екрана: `AppScope.of(context)`.
class AppScope extends InheritedWidget {
  const AppScope({required this.session, required this.player, required super.child, super.key});
  final Session session;
  final TrackPlayer player;

  static AppScope of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()!;
  static AppScope read(BuildContext context) => context.getInheritedWidgetOfExactType<AppScope>()!;

  @override
  bool updateShouldNotify(AppScope oldWidget) => session != oldWidget.session || player != oldWidget.player;
}
