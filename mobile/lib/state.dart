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
  /// Рік «Підсумків року», якщо зараз їхній сезон (грудень — січень).
  int? get wrappedYear => me?['wrapped'] is int ? me!['wrapped'] as int : null;

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

/// Один трек у черзі програвача: локальний трек GameCon або інтернет-радіостанція (живий потік).
class QueueTrack {
  QueueTrack({
    required this.id,
    required this.url,
    required this.title,
    required this.artist,
    this.cover,
    this.album,
    this.genre,
    this.userId,
    this.hasLyrics = false,
    String? key,
    this.source = 'local',
    this.live = false,
    this.quality,
    this.seconds = 0,
    this.favorite = false,
    this.inLibrary = false,
    this.homepage,
    this.year,
    this.audio,
    this.plays = 0,
  }) : key = key ?? (id == null ? url : 'local:$id');

  /// id треку GameCon; у радіостанції — null (її id з іншої таблиці, див. [key]).
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

  /// Унікальний ключ картки, як на сайті: `local:42`, `radio:7`.
  final String key;

  /// `local` — трек GameCon, `radio` — інтернет-радіо.
  final String source;

  /// Пряма трансляція: без тривалості й перемотування.
  final bool live;

  /// Якість файлу: lossy, lossless (без втрат) чи hires.
  final String? quality;
  final int seconds;

  /// Зірочка «Улюблене» й «у медіатеці» — міняються з плеєра.
  bool favorite;
  bool inLibrary;

  /// Сайт радіостанції.
  final String? homepage;

  /// Для «Відомостей про пісню»: рік, формат файлу {codec, sample_rate, bit_depth, bitrate, channels}
  /// і скільки разів слухали.
  final int? year;
  final Map<String, dynamic>? audio;
  final int plays;

  bool get local => source == 'local' && id != null;

  /// Картка (ті ж ключі, що віддає сервер): для листа редагування й меню треку.
  Map<String, dynamic> toCard() => {
        'id': id,
        'key': key,
        'source': source,
        'url': url,
        'title': title,
        'artist': artist,
        'album': album,
        'genre': genre,
        'cover_url': cover,
        'user_id': userId,
        'has_lyrics': hasLyrics,
        'quality': quality,
        'duration': seconds,
        'favorite': favorite,
        'in_library': inLibrary,
        'live': live,
        'homepage': homepage,
        'year': year,
        'audio': audio,
        'plays_count': plays,
      };

  static QueueTrack? fromJson(Map<String, dynamic> track) {
    final url = absolute(track['url']);
    if (url == null) return null;
    final source = text(track['source']) ?? 'local';
    if (source == 'spotify') return null;
    final radio = source == 'radio';
    int? number(dynamic v) => v is int ? v : int.tryParse('$v');
    return QueueTrack(
      id: radio ? null : number(track['id']),
      url: url,
      title: text(track['title']) ?? tr('Без назви'),
      artist: text(track['artist']) ?? '',
      cover: absolute(track['cover_url']),
      album: text(track['album']),
      genre: text(track['genre']),
      userId: number(track['user_id']),
      hasLyrics: track['has_lyrics'] == true,
      key: text(track['key']) ?? (radio ? 'radio:${track['id']}' : null),
      source: source,
      live: radio || track['live'] == true,
      quality: text(track['quality']),
      seconds: number(track['duration']) ?? 0,
      favorite: track['favorite'] == true,
      inLibrary: track['in_library'] == true,
      homepage: text(track['homepage']),
      year: number(track['year']),
      audio: track['audio'] is Map ? Map<String, dynamic>.from(track['audio'] as Map) : null,
      plays: number(track['plays_count']) ?? 0,
    );
  }

  QueueTrack copyWith({String? title, String? artist, String? cover, String? album, String? genre, bool? hasLyrics}) => QueueTrack(
        id: id,
        url: url,
        title: title ?? this.title,
        artist: artist ?? this.artist,
        cover: cover ?? this.cover,
        album: album,
        genre: genre,
        userId: userId,
        hasLyrics: hasLyrics ?? this.hasLyrics,
        key: key,
        source: source,
        live: live,
        quality: quality,
        seconds: seconds,
        favorite: favorite,
        inLibrary: inLibrary,
        homepage: homepage,
        year: year,
        audio: audio,
        plays: plays,
      );
}

/// «Грає з…» — звідки черга: альбом, плейлист, мікс, станція (підпис і маршрут застосунку).
class PlayFrom {
  const PlayFrom(this.label, [this.path]);
  final String label;

  /// Маршрут застосунку, куди веде дотик (у станції — немає).
  final String? path;
}

/// «Грає з…» для всього, що запускається всередині (напр. сторінка плейлиста з його назвою).
class PlaySource extends InheritedWidget {
  const PlaySource({required this.from, required super.child, super.key});
  final PlayFrom from;

  static PlayFrom? of(BuildContext context) => context.getInheritedWidgetOfExactType<PlaySource>()?.from;

  @override
  bool updateShouldNotify(PlaySource oldWidget) => from.label != oldWidget.from.label || from.path != oldWidget.from.path;
}

/// Ключ картки треку з сервера (`local:42`, `radio:7`, `spotify:…`).
String trackKey(Map<String, dynamic> track) => text(track['key']) ?? '${text(track['source']) ?? 'local'}:${track['id']}';

class TrackPlayer extends ChangeNotifier {
  TrackPlayer() {
    _player.playerStateStream.listen((state) {
      playing = state.playing;
      if (state.processingState == ProcessingState.completed) unawaited(trackEnded());
      notifyListeners();
    });
    _player.positionStream.listen((value) {
      position = value;
      _fadeTick();
      notifyListeners();
    });
    _player.durationStream.listen((value) {
      duration = value ?? Duration.zero;
      notifyListeners();
    });
  }

  /// «Вирівнювання гучності»: LoudnessEnhancer Android (підсилення з обмежувачем піків) у ланцюжку just_audio.
  final _loudness = AndroidLoudnessEnhancer();
  late final _player = AudioPlayer(audioPipeline: AudioPipeline(androidAudioEffects: [_loudness]));
  final _random = Random();

  /// Викликається на початку кожного треку (тут лагодять «сміттєві» назви).
  void Function(QueueTrack track)? onStart;

  /// Рушій відтворення — для медіасесії в шторці (`GcAudioHandler`).
  AudioPlayer get engine => _player;
  Session? _session;
  Session? get session => _session;
  set session(Session? value) {
    _session = value;
    final prefs = value?.prefs;
    if (prefs == null) return;
    // Налаштування плеєра живуть на телефоні, як localStorage на сайті.
    autoplay = prefs.getBool('music.autoplay') ?? true;
    shuffle = prefs.getBool('music.shuffle') ?? false;
    repeatMode = prefs.getString('music.repeat') ?? 'off';
    volume = prefs.getDouble('music.volume') ?? 1;
    crossfade = prefs.getInt('music.crossfade') ?? 0;
    normalize = prefs.getBool('music.normalize') ?? false;
    lyricsTranslate = prefs.getBool('music.translate') ?? false;
    _applyVolume();
    unawaited(_applyNormalize());
  }

  List<QueueTrack> queue = [];
  int index = -1;
  bool playing = false;
  bool shuffle = false;

  /// Повтор: off, all (уся черга), one (один трек).
  String repeatMode = 'off';
  bool get repeat => repeatMode == 'one';

  /// ∞ — коли черга скінчилась, грати схожі треки (як автовідтворення в Apple Music).
  bool autoplay = true;

  /// Безкінечна станція, з якої підвантажуються наступні треки (me, genre:…, artist:…, track:…).
  String? station;

  /// «Грає з…» над чергою.
  PlayFrom? from;

  /// Плавні переходи між треками, секунди (0 — вимкнено).
  int crossfade = 0;

  /// «Вирівнювання гучності» (як Sound Check).
  bool normalize = false;

  /// Показувати переклад під рядками тексту пісні.
  bool lyricsTranslate = false;

  /// Таймер сну: коли зупинитися, або «наприкінці треку».
  DateTime? sleepUntil;
  bool sleepAfterTrack = false;
  Timer? _sleepTimer;

  /// Множник гучності під час переходу (1 — без затухання) і таймер появи нового треку з тиші.
  double _fade = 1;
  double _applied = -1;
  Timer? _fadeIn;

  /// Щойно зіграні треки («Історія» в черзі).
  final history = <QueueTrack>[];

  /// Гучність плеєра застосунку (0…1), окремо від системної.
  double volume = 1;
  Duration position = Duration.zero;
  Duration duration = Duration.zero;
  Future<bool>? _extending;
  bool _extendable = true;

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

  bool isCurrent(dynamic id) => current != null && current!.id != null && '${current!.id}' == '$id';

  /// Чи це та сама картка, що грає зараз (за ключем: трек і радіостанція з однаковим id — різні).
  bool isCurrentCard(Map<String, dynamic> track) => current != null && current!.key == trackKey(track);

  /// Грає [tracks] з позиції [start]; повторне натискання на поточний трек — пауза.
  /// [station] — ключ безкінечної станції, з якої дописувати чергу; [extend] = false — без ∞
  /// (напр. «Слухати разом», де чергою керує кімната).
  /// [from] — «Грає з…»: альбом, плейлист, мікс тощо.
  Future<void> playList(List<Map<String, dynamic>> tracks, int start, {String? station, bool extend = true, PlayFrom? from}) async {
    final items = <QueueTrack>[];
    var target = 0;
    for (var i = 0; i < tracks.length; i++) {
      final item = QueueTrack.fromJson(tracks[i]);
      if (item == null) continue;
      if (i == start) target = items.length;
      items.add(item);
    }
    if (items.isEmpty) return;
    _extendable = extend;
    if (current != null && start < tracks.length && isCurrentCard(tracks[start])) {
      queue = items;
      index = target;
      this.station = station;
      this.from = from ?? this.from;
      await toggle();
      return;
    }
    queue = items;
    this.station = station;
    this.from = from;
    await _start(target);
  }

  /// Безкінечна станція: перша порція одразу, далі підвантажується, коли черга добігає кінця.
  /// Повертає false, якщо на станції поки немає треків.
  Future<bool> playStation(String key, {PlayFrom? from}) async {
    final api = session?.api;
    if (api == null) return false;
    final data = await api.get(Api.site('/music/station?${Uri(queryParameters: {'key': key}).query}'));
    final tracks = maps(data['tracks']);
    if (tracks.isEmpty) return false;
    history.clear();
    await playList(tracks, 0, station: key, from: from);
    return true;
  }

  Future<void> play(String url, String nextTitle, String nextArtist) async {
    queue = [QueueTrack(id: null, url: url, title: nextTitle, artist: nextArtist)];
    station = null;
    from = null;
    _extendable = true;
    await _start(0);
  }

  /// [fadeIn] — новий трек з’являється з тиші (плавний перехід після попереднього).
  Future<void> _start(int i, {bool fadeIn = false}) async {
    final previous = current;
    if (previous != null && i != index) {
      history.remove(previous);
      history.insert(0, previous);
      if (history.length > 50) history.removeLast();
    }
    index = i;
    position = Duration.zero;
    duration = Duration.zero;
    notifyListeners();
    final track = queue[i];
    _startFade(fadeIn && crossfade > 0 && !track.live);
    onStart?.call(track);
    // Черга добігає кінця — заздалегідь дописуємо наступну порцію станції чи ∞.
    if (queue.length - i <= 3) unawaited(_extend());
    try {
      await _player.setUrl(track.url);
      unawaited(_player.play());
      if (track.local) {
        unawaited(session?.api.post('/api/v1/music/now-playing', {'track_id': track.id}).catchError((_) => <String, dynamic>{}));
      }
    } catch (_) {}
  }

  /// Дописати в чергу наступну порцію: зі станції або «схожі на останній трек» (∞).
  Future<bool> _extend() {
    return _extending ??= _fetchMore().whenComplete(() => _extending = null);
  }

  Future<bool> _fetchMore() async {
    final api = session?.api;
    final now = current;
    if (api == null || now == null || !now.local || !_extendable) return false;
    final last = queue.lastWhere((t) => t.local, orElse: () => now);
    final key = station ?? (autoplay ? 'track:${last.id}' : null);
    if (key == null) return false;
    final exclude = [for (final t in queue) if (t.local) t.id!];
    final query = [
      'key=${Uri.encodeQueryComponent(key)}',
      for (final id in exclude.skip(exclude.length > 300 ? exclude.length - 300 : 0)) 'exclude[]=$id',
    ].join('&');
    try {
      final data = await api.get(Api.site('/music/station?$query'));
      final known = {for (final t in queue) t.key};
      final more = [for (final t in maps(data['tracks'])) ?QueueTrack.fromJson(t)].where((t) => !known.contains(t.key)).toList();
      if (more.isEmpty) return false;
      queue = [...queue, ...more];
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> toggle({bool forcePlay = false}) async {
    if (_player.playing && !forcePlay) {
      await _player.pause();
    } else if (current != null) {
      await _player.play();
    }
  }

  /// Трек дограв: таймер сну «наприкінці треку» зупиняє музику, інакше — наступний.
  Future<void> trackEnded() async {
    if (sleepAfterTrack) {
      sleepAfterTrack = false;
      notifyListeners();
      try {
        await _player.pause();
        await _player.seek(Duration.zero);
      } catch (_) {}
      return;
    }
    await next(auto: true);
  }

  Future<void> next({bool auto = false}) async {
    if (queue.isEmpty) return;
    if (auto && repeat) return _start(index);
    final fade = auto && crossfade > 0;
    var n = shuffle && queue.length > 1 ? _random.nextInt(queue.length - 1) : index + 1;
    if (shuffle && queue.length > 1 && n >= index) n++;
    if (n >= queue.length) {
      // Кінець черги: станція чи ∞ дописують нові треки, «повторювати все» — з початку.
      if (repeatMode != 'all' && await _extend() && index + 1 < queue.length) return _start(index + 1, fadeIn: fade);
      if (auto && repeatMode != 'all') {
        await _player.pause();
        await _player.seek(Duration.zero);
        return;
      }
      n = 0;
    }
    await _start(n, fadeIn: fade);
  }

  Future<void> prev() async {
    if (queue.isEmpty) return;
    if (position.inSeconds > 3 && current?.live != true) return seek(Duration.zero);
    await _start(index <= 0 ? queue.length - 1 : index - 1);
  }

  Future<void> seek(Duration to) async {
    // Пряму трансляцію не перемотати.
    if (current?.live == true) return;
    await _player.seek(to);
  }

  Future<void> playAt(int i) async {
    if (i < 0 || i >= queue.length) return;
    if (i == index) return toggle();
    await _start(i);
  }

  /// Увімкнути трек з «Історії»: стає наступним і грає одразу.
  Future<void> replay(QueueTrack track) async {
    final at = queue.indexOf(track);
    if (at >= 0) return playAt(at);
    queue.insert(index + 1, track);
    await _start(index + 1);
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

  /// Очистити «Далі в черзі» (усе після поточного треку).
  void clearUpNext() {
    if (index < 0) return;
    queue = queue.sublist(0, index + 1);
    station = null;
    notifyListeners();
  }

  /// «Грати наступним» або «Грати останнім» (у кінці черги).
  Future<void> enqueue(Map<String, dynamic> track, {bool next = false}) async {
    final item = QueueTrack.fromJson(track);
    if (item == null) return;
    if (current == null) {
      queue = [item];
      station = null;
      from = null;
      _extendable = true;
      return _start(0);
    }
    final existing = queue.indexWhere((t) => t.key == item.key);
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
      final next = old.copyWith(
        title: text(card['title']) ?? old.title,
        artist: text(card['artist']) ?? '',
        cover: absolute(card['cover_url']) ?? old.cover,
        album: text(card['album']),
        genre: text(card['genre']),
        hasLyrics: card['has_lyrics'] is bool ? card['has_lyrics'] as bool : old.hasLyrics,
      );
      if (card['favorite'] is bool) next.favorite = card['favorite'] as bool;
      if (card['in_library'] is bool) next.inLibrary = card['in_library'] as bool;
      queue[i] = next;
      changed = true;
    }
    if (changed) notifyListeners();
  }

  /// Зірочка й «у медіатеці» змінилися деінде (меню треку) — оновлюємо копію в черзі.
  void markTrack(int? id, {bool? favorite, bool? inLibrary}) {
    for (final t in queue) {
      if (id == null || t.id != id) continue;
      if (favorite != null) t.favorite = favorite;
      if (inLibrary != null) t.inLibrary = inLibrary;
    }
    notifyListeners();
  }

  void toggleShuffle() {
    shuffle = !shuffle;
    unawaited(session?.prefs.setBool('music.shuffle', shuffle));
    notifyListeners();
  }

  /// Повтор по колу: вимкнено → уся черга → один трек.
  void toggleRepeat() => setRepeat(switch (repeatMode) { 'off' => 'all', 'all' => 'one', _ => 'off' });

  void setRepeat(String mode) {
    repeatMode = mode;
    unawaited(session?.prefs.setString('music.repeat', mode));
    notifyListeners();
  }

  void toggleAutoplay() {
    autoplay = !autoplay;
    unawaited(session?.prefs.setBool('music.autoplay', autoplay));
    notifyListeners();
  }

  Future<void> setVolume(double value) async {
    volume = value.clamp(0.0, 1.0);
    notifyListeners();
    _applyVolume();
    unawaited(session?.prefs.setDouble('music.volume', volume));
  }

  /// Гучність наприкінці треку при плавному переході: 1 → 0 за останні [crossfade] секунд
  /// (короткі треки — без затухання, як на сайті).
  static double fadeOutLevel(Duration position, Duration duration, int crossfade) {
    if (crossfade <= 0 || duration.inMilliseconds <= crossfade * 3000) return 1;
    final left = (duration - position).inMilliseconds / 1000;
    return left >= crossfade ? 1 : (left / crossfade).clamp(0.0, 1.0);
  }

  void _fadeTick() {
    final track = current;
    final out = track == null || track.live || repeat || sleepAfterTrack ? 1.0 : fadeOutLevel(position, duration, crossfade);
    if (out < 1) {
      _fadeIn?.cancel();
      _fade = out;
    } else if (_fadeIn?.isActive != true) {
      // Перемотали назад під час затухання — гучність повертається.
      _fade = 1;
    }
    _applyVolume();
  }

  /// Новий трек з’являється з тиші за половину тривалості переходу (або одразу на повній гучності).
  void _startFade(bool smooth) {
    _fadeIn?.cancel();
    _fade = smooth ? 0 : 1;
    _applyVolume();
    if (!smooth) return;
    final step = 50 / (crossfade * 1000 / 2);
    _fadeIn = Timer.periodic(const Duration(milliseconds: 50), (timer) {
      _fade = min(_fade + step, 1);
      if (_fade >= 1) timer.cancel();
      _applyVolume();
    });
  }

  void _applyVolume() {
    final value = volume * _fade;
    if ((value - _applied).abs() < 0.004) return;
    _applied = value;
    unawaited(_player.setVolume(value).catchError((_) {}));
  }

  /// Множник гучності переходу зараз (для тестів і медіасесії).
  double get fadeLevel => _fade;

  void setCrossfade(int seconds) {
    crossfade = seconds.clamp(0, 12);
    unawaited(session?.prefs.setInt('music.crossfade', crossfade));
    _fadeTick();
    notifyListeners();
  }

  void setNormalize(bool on) {
    normalize = on;
    unawaited(session?.prefs.setBool('music.normalize', on));
    unawaited(_applyNormalize());
    notifyListeners();
  }

  /// +4 дБ з обмежувачем — тихі треки підтягуються, гучні не «ріжуть» (як компресор сайту).
  Future<void> _applyNormalize() async {
    try {
      await _loudness.setTargetGain(normalize ? 4 : 0);
      await _loudness.setEnabled(normalize);
    } catch (_) {}
  }

  void setLyricsTranslate(bool on) {
    lyricsTranslate = on;
    unawaited(session?.prefs.setBool('music.translate', on));
    notifyListeners();
  }

  /// Таймер сну: [minutes] хвилин, [afterTrack] — наприкінці треку; без обох — вимкнути.
  void setSleep({int? minutes, bool afterTrack = false}) {
    _sleepTimer?.cancel();
    sleepAfterTrack = afterTrack;
    sleepUntil = minutes == null ? null : DateTime.now().add(Duration(minutes: minutes));
    if (minutes != null) {
      _sleepTimer = Timer(Duration(minutes: minutes), () {
        sleepUntil = null;
        notifyListeners();
        unawaited(_player.pause().catchError((_) {}));
      });
    }
    notifyListeners();
  }

  /// Скільки хвилин лишилося до зупинки (null — таймер на хвилини не заведено).
  int? get sleepMinutesLeft {
    final until = sleepUntil;
    if (until == null) return null;
    return max(0, (until.difference(DateTime.now()).inSeconds / 60).ceil());
  }

  Future<void> stop() async {
    await _player.stop();
    queue = [];
    index = -1;
    station = null;
    from = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _sleepTimer?.cancel();
    _fadeIn?.cancel();
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
