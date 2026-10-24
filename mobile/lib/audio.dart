import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart' show Color;
import 'package:just_audio/just_audio.dart';

import 'state.dart';
import 'track_edit.dart';
import 'i18n.dart';

/// Медіасесія Android/iOS для [TrackPlayer]: музика грає у фоні (foreground-сервіс),
/// а в шторці й на заблокованому екрані з’являється плеєр з обкладинкою й кнопками.
class GcAudioHandler extends BaseAudioHandler with SeekHandler {
  GcAudioHandler(this.player) {
    player.engine.playbackEventStream.listen((_) => _broadcast(), onError: (Object _, StackTrace _) {});
    player.engine.playingStream.listen((_) => _broadcast());
    player.engine.durationStream.listen((_) => _media());
    player.addListener(_media);
  }

  final TrackPlayer player;
  QueueTrack? _shown;

  /// Чому медіасесія не запустилася (тоді немає фонового відтворення й плеєра у шторці) — показується в плеєрі.
  static String? failure;
  int _shownLength = -1;

  static Future<void> attach(TrackPlayer player) async {
    try {
      await AudioService.init(
        builder: () => GcAudioHandler(player),
        config: AudioServiceConfig(
          androidNotificationChannelId: 'online.gamecon.app.audio',
          androidNotificationChannelName: tr('Музика'),
          androidNotificationChannelDescription: tr('Плеєр GameCon у шторці та на заблокованому екрані'),
          androidNotificationIcon: 'drawable/ic_notification',
          androidStopForegroundOnPause: true,
          notificationColor: Color(0xFF6D7DFF),
        ),
      );
    } catch (e) {
      failure = '$e';
      debugPrint('Медіасесія недоступна: $e');
    }
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
    final cover = track.cover == null ? null : Uri.tryParse(track.cover!);
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
      for (final t in player.queue) MediaItem(id: t.key, title: t.title, artist: artistOf(t.artist), album: t.album, artUri: t.cover == null ? null : Uri.tryParse(t.cover!)),
    ]);
    _broadcast();
  }

  void _broadcast() {
    final engine = player.engine;
    final playing = engine.playing;
    final active = player.current != null;
    playbackState.add(playbackState.value.copyWith(
      controls: [
        MediaControl.skipToPrevious,
        if (playing) MediaControl.pause else MediaControl.play,
        MediaControl.skipToNext,
        MediaControl.stop,
      ],
      systemActions: const {MediaAction.seek, MediaAction.seekForward, MediaAction.seekBackward, MediaAction.skipToQueueItem},
      androidCompactActionIndices: const [0, 1, 2],
      processingState: !active
          ? AudioProcessingState.idle
          : switch (engine.processingState) {
              ProcessingState.idle => AudioProcessingState.idle,
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

  @override
  Future<void> stop() async {
    await player.stop();
    playbackState.add(playbackState.value.copyWith(processingState: AudioProcessingState.idle, playing: false));
    await super.stop();
  }

  @override
  Future<void> onTaskRemoved() async {
    if (!player.engine.playing) await stop();
  }
}
