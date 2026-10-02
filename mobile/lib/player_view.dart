import 'package:flutter/material.dart';

import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

class TrackCover extends StatelessWidget {
  const TrackCover({required this.url, required this.seed, this.size = 48, this.radius = 14, super.key});
  final String? url;
  final Object seed;
  final double size;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: url == null ? CoverPlaceholder(seed: seed, radius: radius, iconSize: size * 0.42) : NetImage(url, radius: radius, width: size, height: size),
    );
  }
}

/// Плеєр над нижнім меню (як плаваюча панель на сайті).
class MiniPlayer extends StatelessWidget {
  const MiniPlayer({required this.player, super.key});
  final TrackPlayer player;

  @override
  Widget build(BuildContext context) {
    final track = player.current!;
    final total = player.duration.inMilliseconds;
    final progress = total == 0 ? 0.0 : (player.position.inMilliseconds / total).clamp(0.0, 1.0);
    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 0, 10, 8),
      child: GestureDetector(
        onTap: () => showFullPlayer(context, player),
        child: Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: const Color(0xF0121733),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: lineStrong),
            boxShadow: const [BoxShadow(color: Color(0x99000000), blurRadius: 30, offset: Offset(0, 12), spreadRadius: -10)],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              LinearProgressIndicator(value: progress, minHeight: 2.5, backgroundColor: Colors.white.withValues(alpha: 0.06), color: primary),
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 8, 6, 8),
                child: Row(
                  children: [
                    TrackCover(url: track.cover, seed: track.id ?? track.title, size: 46),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(track.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14.5, weight: FontWeight.w700)),
                          Text(track.artist.isEmpty ? 'Невідомий виконавець' : track.artist, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12.5, color: muted)),
                        ],
                      ),
                    ),
                    IconButton(onPressed: player.prev, icon: const Icon(Icons.skip_previous_rounded, color: soft, size: 28)),
                    RoundIcon(icon: player.playing ? Icons.pause_rounded : Icons.play_arrow_rounded, onTap: player.toggle, filled: true, size: 44),
                    IconButton(onPressed: player.next, icon: const Icon(Icons.skip_next_rounded, color: soft, size: 28)),
                    IconButton(onPressed: player.stop, icon: const Icon(Icons.close_rounded, color: muted, size: 22)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Future<void> showFullPlayer(BuildContext context, TrackPlayer player) {
  return showGcSheet<void>(
    context,
    builder: (sheet) => ListenableBuilder(
      listenable: player,
      builder: (context, _) {
        final track = player.current;
        if (track == null) return const SizedBox(height: 120);
        final total = player.duration.inMilliseconds.toDouble();
        final at = player.position.inMilliseconds.toDouble().clamp(0.0, total <= 0 ? 0.0 : total);
        return SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 6, 24, 28),
          child: Column(
            children: [
              AspectRatio(aspectRatio: 1, child: TrackCover(url: track.cover, seed: track.id ?? track.title, size: double.infinity, radius: 26)),
              const SizedBox(height: 22),
              Text(track.title, textAlign: TextAlign.center, style: display(20)),
              const SizedBox(height: 6),
              Text(track.artist.isEmpty ? 'Невідомий виконавець' : track.artist, style: body(14, color: muted)),
              const SizedBox(height: 14),
              Slider(
                value: at,
                max: total <= 0 ? 1 : total,
                onChanged: total <= 0 ? null : (value) => player.seek(Duration(milliseconds: value.round())),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    Text(duration(player.position.inSeconds), style: body(12, color: muted)),
                    const Spacer(),
                    Text(duration(player.duration.inSeconds), style: body(12, color: muted)),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  IconButton(onPressed: player.toggleShuffle, icon: Icon(Icons.shuffle_rounded, color: player.shuffle ? primary : muted)),
                  IconButton(onPressed: player.prev, icon: const Icon(Icons.skip_previous_rounded, size: 36, color: ink)),
                  RoundIcon(icon: player.playing ? Icons.pause_rounded : Icons.play_arrow_rounded, onTap: player.toggle, filled: true, size: 68),
                  IconButton(onPressed: player.next, icon: const Icon(Icons.skip_next_rounded, size: 36, color: ink)),
                  IconButton(onPressed: player.toggleRepeat, icon: Icon(Icons.repeat_one_rounded, color: player.repeat ? primary : muted)),
                ],
              ),
              if (player.queue.length > 1) ...[
                const SizedBox(height: 18),
                const CardTitle('Далі в черзі', icon: Icons.queue_music_rounded),
                for (var i = 0; i < player.queue.length; i++)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: TrackCover(url: player.queue[i].cover, seed: player.queue[i].id ?? i, size: 40, radius: 10),
                    title: Text(player.queue[i].title, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, color: i == player.index ? primary : ink, weight: FontWeight.w600)),
                    subtitle: Text(player.queue[i].artist, maxLines: 1, style: body(12, color: muted)),
                  ),
              ],
            ],
          ),
        );
      },
    ),
  );
}
