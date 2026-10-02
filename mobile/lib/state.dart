import 'package:flutter/foundation.dart';
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

  String? get username => text(me?['username']);

  Future<void> boot() async {
    if (_token != null) {
      try {
        me = await api.me();
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
    notifyListeners();
  }

  Future<void> refreshMe() async {
    me = await api.me();
    notifyListeners();
  }

  Future<void> clear() async {
    _token = null;
    me = null;
    await prefs.remove('token');
    notifyListeners();
  }

  void takeLink(Uri uri) {
    if (uri.scheme != 'gamecon') return;
    handoff = uri;
    notifyListeners();
  }

  void consumeLink() {
    handoff = null;
  }

  void toast(String message) {
    notice = message;
    notifyListeners();
  }
}

class TrackPlayer extends ChangeNotifier {
  final _player = AudioPlayer();
  String title = '';
  String artist = '';
  bool playing = false;

  TrackPlayer() {
    _player.playerStateStream.listen((state) {
      playing = state.playing;
      notifyListeners();
    });
  }

  Future<void> play(String url, String nextTitle, String nextArtist) async {
    title = nextTitle;
    artist = nextArtist;
    notifyListeners();
    await _player.setUrl(url);
    await _player.play();
  }

  Future<void> toggle() async {
    if (_player.playing) {
      await _player.pause();
    } else if (title.isNotEmpty) {
      await _player.play();
    }
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }
}
