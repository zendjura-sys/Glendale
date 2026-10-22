import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'full_player.dart';
import 'state.dart';
import 'track_edit.dart';
import 'theme.dart';
import 'widgets.dart';

export 'full_player.dart' show showFullPlayer;

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
    Widget control(IconData icon, VoidCallback onPressed, {Color? color, double size = 24}) => SizedBox.square(
          dimension: 40,
          child: IconButton(padding: EdgeInsets.zero, onPressed: onPressed, icon: Icon(icon, color: color ?? soft, size: size)),
        );
    return SizedBox(
      height: miniPlayerExtent,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
        child: GestureDetector(
          onTap: () => showFullPlayer(context, player),
          // Свайп міні-плеєра вбік — інший трек.
          onHorizontalDragEnd: (d) {
            final v = d.primaryVelocity ?? 0;
            if (v < -400) player.next();
            if (v > 400) player.prev();
          },
          // Глибоке матове скло iOS 27, як у нижньої панелі; плеєр завжди стоїть над нею.
          child: MatteGlass(
            borderRadius: barRadius,
            child: Stack(
              children: [
                Positioned.fill(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 11),
                    child: Row(
                      children: [
                        TrackCover(url: track.cover, seed: track.id ?? track.title, size: 46, radius: 12),
                        const SizedBox(width: 11),
                        Expanded(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(track.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14.5, weight: FontWeight.w700).copyWith(height: 1.2)),
                              const SizedBox(height: 2),
                              Text(artistOf(track.artist), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12.5, color: muted).copyWith(height: 1.2)),
                            ],
                          ),
                        ),
                        control(LucideIcons.skipBack, player.prev),
                        RoundIcon(icon: player.playing ? LucideIcons.pause : LucideIcons.play, onTap: player.toggle, filled: true, size: 44),
                        control(LucideIcons.skipForward, player.next),
                        control(LucideIcons.x, player.stop, color: muted, size: 20),
                      ],
                    ),
                  ),
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  top: 0,
                  child: LinearProgressIndicator(value: progress, minHeight: 2.5, backgroundColor: fg.withValues(alpha: 0.06), color: primary),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
