import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:just_audio/just_audio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';

class Session extends ChangeNotifier {
  Session(this.prefs) : api = Api(() => _token) {
    _token = prefs.getString('token');
  }

  final SharedPreferences prefs;
  final Api api;
  static String? _token;

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

  Future<void> boot() async {
    if (_token != null) {
      try {
        me = await api.me();
        _startPolling();
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
    _startPolling();
    notifyListeners();
  }

  Future<void> refreshMe() async {
    me = await api.me();
    notifyListeners();
  }

  Future<void> clear() async {
    _poll?.cancel();
    _token = null;
    me = null;
    unreadChats = 0;
    unreadNotifications = 0;
    await prefs.remove('token');
    notifyListeners();
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
    super.dispose();
  }
}

/// Один трек у черзі програвача (локальний трек GameCon).
class QueueTrack {
  QueueTrack({required this.id, required this.url, required this.title, required this.artist, this.cover});
  final int? id;
  final String url;
  final String title;
  final String artist;
  final String? cover;

  static QueueTrack? fromJson(Map<String, dynamic> track) {
    final url = absolute(track['url']);
    if (url == null) return null;
    return QueueTrack(
      id: track['id'] is int ? track['id'] as int : int.tryParse('${track['id']}'),
      url: url,
      title: text(track['title']) ?? 'Без назви',
      artist: text(track['artist']) ?? '',
      cover: absolute(track['cover_url']),
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
  Session? session;
  List<QueueTrack> queue = [];
  int index = -1;
  bool playing = false;
  bool shuffle = false;
  bool repeat = false;
  Duration position = Duration.zero;
  Duration duration = Duration.zero;

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
    try {
      await _player.setUrl(track.url);
      unawaited(_player.play());
      if (track.id != null) {
        unawaited(session?.api.post('/api/v1/music/now-playing', {'track_id': track.id}).catchError((_) => <String, dynamic>{}));
      }
    } catch (_) {}
  }

  Future<void> toggle() async {
    if (_player.playing) {
      await _player.pause();
    } else if (current != null) {
      await _player.play();
    }
  }

  Future<void> next({bool auto = false}) async {
    if (queue.isEmpty) return;
    if (auto && repeat) return _start(index);
    var n = shuffle && queue.length > 1 ? (DateTime.now().microsecond % queue.length) : index + 1;
    if (shuffle && n == index) n = (n + 1) % queue.length;
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
