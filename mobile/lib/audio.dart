import 'dart:async';
import 'dart:io';

import 'package:audio_service/audio_service.dart';
import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';

import 'state.dart';
import 'track_edit.dart';
import 'i18n.dart';

/// Медіасесія Android/iOS для [TrackPlayer]: музика грає у фоні (foreground-сервіс із WakeLock,
/// а поки грає — ще й WifiLock), а в шторці й на заблокованому екрані з’являється плеєр
/// з обкладинкою, кнопками й повзунком.
class GcAudioHandler extends BaseAudioHandler with SeekHandler {
  GcAudioHandler(this.player) {
    player.engine.playbackEventStream.listen((_) => _broadcast(), onError: (Object _, StackTrace _) {});
    player.engine.playingStream.listen((playing) {
      _wifiLock(playing);
      _broadcast();
    });
    player.engine.durationStream.listen((_) => _media());
    player.addListener(_media);
  }

  final TrackPlayer player;
  QueueTrack? _shown;

  static const _app = MethodChannel('gamecon/app');

  /// Обкладинка за замовчуванням (знак GameCon): тло картки в шторці завжди заповнене.
  static Uri? _defaultArt;

  /// Музику зупинили свідомо (кнопка «Стоп», закрили з шторки) — лише тоді сесія стає idle.
  bool _stopped = false;

  /// Натискання кнопки гарнітури: 1 — пауза/відтворення, 2 — наступний, 3 — попередній.
  int _taps = 0;
  Timer? _tapTimer;
  bool? _wifiHeld;

  /// Чому медіасесія не запустилася (тоді немає фонового відтворення й плеєра у шторці) — показується в плеєрі.
  static String? failure;
  int _shownLength = -1;

  static Future<void> attach(TrackPlayer player) async {
    // Аудіосесія музики: дзвінок — пауза, сповіщення — приглушення, від’єднали навушники — пауза
    // (just_audio сам виконує ці події, якщо сесію налаштовано).
    try {
      final audio = await AudioSession.instance;
      await audio.configure(const AudioSessionConfiguration.music());
    } catch (_) {}
    _defaultArt = await _artFile();
    try {
      await AudioService.init(
        builder: () => GcAudioHandler(player),
        config: AudioServiceConfig(
          androidNotificationChannelId: 'online.gamecon.app.audio',
          androidNotificationChannelName: tr('Музика'),
          androidNotificationChannelDescription: tr('Плеєр GameCon у шторці та на заблокованому екрані'),
          androidNotificationIcon: 'drawable/ic_notification',
          androidStopForegroundOnPause: true,
          androidNotificationClickStartsActivity: true,
          notificationColor: Color(0xFF0A84FF),
          // Обкладинка на всю картку плеєра в шторці (Android 11+): більше зображення.
          artDownscaleWidth: 1024,
          artDownscaleHeight: 1024,
        ),
      );
    } catch (e) {
      failure = '$e';
      debugPrint('Медіасесія недоступна: $e');
    }
  }

  /// Знак GameCon з ресурсів — у файл, щоб система могла показати його як обкладинку.
  static Future<Uri?> _artFile() async {
    try {
      final dir = await getApplicationSupportDirectory();
      final file = File('${dir.path}/gamecon-music-art.png');
      if (!file.existsSync()) {
        final data = await rootBundle.load('assets/brand/logo-mark.png');
        await file.writeAsBytes(data.buffer.asUint8List(), flush: true);
      }
      return Uri.file(file.path);
    } catch (_) {
      return null;
    }
  }

  /// WifiLock на час відтворення: з вимкненим екраном Wi-Fi не засинає й потік не обривається.
  void _wifiLock(bool held) {
    if (_wifiHeld == held) return;
    _wifiHeld = held;
    _app.invokeMethod<bool>('wifiLock', {'held': held}).catchError((_) => false);
  }

  void _media() {
    final track = player.current;
    if (track == null) {
      if (mediaItem.value != null) mediaItem.add(null);
      _shown = null;
      return;
    }
    final duration = player.engine.duration;
    if (identical(track, _shown) && mediaItem.value?.duration == duration && _shownLength == player.queue.length) return;
    _shown = track;
    _shownLength = player.queue.length;
    if (_stopped) _stopped = false;
    final cover = (track.cover == null ? null : Uri.tryParse(track.cover!)) ?? _defaultArt;
    mediaItem.add(MediaItem(
      id: track.key,
      title: track.title,
      artist: artistOf(track.artist),
      album: track.album,
      genre: track.genre,
      duration: duration,
      artUri: cover,
    ));
    queue.add([
      for (final t in player.queue) MediaItem(id: t.key, title: t.title, artist: artistOf(t.artist), album: t.album, artUri: (t.cover == null ? null : Uri.tryParse(t.cover!)) ?? _defaultArt),
    ]);
    _broadcast();
  }

  void _broadcast() {
    final engine = player.engine;
    final playing = engine.playing;
    final active = player.current != null && !_stopped;
    playbackState.add(playbackState.value.copyWith(
      controls: [
        MediaControl.skipToPrevious,
        if (playing) MediaControl.pause else MediaControl.play,
        MediaControl.skipToNext,
      ],
      systemActions: const {MediaAction.seek, MediaAction.seekForward, MediaAction.seekBackward, MediaAction.skipToQueueItem},
      androidCompactActionIndices: const [0, 1, 2],
      processingState: !active
          ? AudioProcessingState.idle
          : switch (engine.processingState) {
              // Збій потоку чи заміна треку — не кінець сесії: idle зупинив би сервіс, і Android
              // вивантажив би застосунок. Плеєр сам перепідключається (TrackPlayer._recover).
              ProcessingState.idle => AudioProcessingState.buffering,
              ProcessingState.loading => AudioProcessingState.loading,
              ProcessingState.buffering => AudioProcessingState.buffering,
              ProcessingState.ready => AudioProcessingState.ready,
              ProcessingState.completed => AudioProcessingState.completed,
            },
      playing: playing,
      updatePosition: engine.position,
      bufferedPosition: engine.bufferedPosition,
      speed: engine.speed,
      queueIndex: active ? player.index : null,
      shuffleMode: player.shuffle ? AudioServiceShuffleMode.all : AudioServiceShuffleMode.none,
      repeatMode: switch (player.repeatMode) { 'one' => AudioServiceRepeatMode.one, 'all' => AudioServiceRepeatMode.all, _ => AudioServiceRepeatMode.none },
    ));
  }

  @override
  Future<void> play() => player.toggle(forcePlay: true);

  @override
  Future<void> pause() => player.engine.pause();

  @override
  Future<void> seek(Duration position) => player.seek(position);

  @override
  Future<void> skipToNext() => player.next();

  @override
  Future<void> skipToPrevious() => player.prev();

  @override
  Future<void> skipToQueueItem(int index) => player.playAt(index);

  @override
  Future<void> setShuffleMode(AudioServiceShuffleMode shuffleMode) async {
    if ((shuffleMode != AudioServiceShuffleMode.none) != player.shuffle) player.toggleShuffle();
  }

  @override
  Future<void> setRepeatMode(AudioServiceRepeatMode repeatMode) async {
    player.setRepeat(switch (repeatMode) { AudioServiceRepeatMode.none => 'off', AudioServiceRepeatMode.one => 'one', _ => 'all' });
  }

  /// Кнопка гарнітури чи Bluetooth-навушників: подвійне натискання — наступний трек, потрійне — попередній.
  @override
  Future<void> click([MediaButton button = MediaButton.media]) async {
    if (button != MediaButton.media) return super.click(button);
    _taps++;
    _tapTimer?.cancel();
    _tapTimer = Timer(const Duration(milliseconds: 450), () {
      final taps = _taps;
      _taps = 0;
      if (taps >= 3) {
        unawaited(skipToPrevious());
      } else if (taps == 2) {
        unawaited(skipToNext());
      } else {
        unawaited(player.engine.playing ? pause() : play());
      }
    });
  }

  @override
  Future<void> stop() async {
    _stopped = true;
    _wifiLock(false);
    await player.stop();
    playbackState.add(playbackState.value.copyWith(processingState: AudioProcessingState.idle, playing: false));
    await super.stop();
  }

  @override
  Future<void> onTaskRemoved() async {
    if (!player.engine.playing) await stop();
  }
}
