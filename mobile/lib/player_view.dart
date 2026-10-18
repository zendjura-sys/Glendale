import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'full_player.dart';
import 'state.dart';
import 'track_edit.dart';
import 'theme.dart';
import 'widgets.dart';
import 'i18n.dart';

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
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              boxShadow: [palette.isLight ? const BoxShadow(color: Color(0x33102A50), blurRadius: 28, offset: Offset(0, 10), spreadRadius: -14) : const BoxShadow(color: Color(0xB3000000), blurRadius: 30, offset: Offset(0, 10), spreadRadius: -14)],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 30, sigmaY: 30),
                child: DecoratedBox(
                  decoration: BoxDecoration(color: bar.withValues(alpha: 0.93), borderRadius: BorderRadius.circular(18)),
                  child: Stack(
                    children: [
                      Positioned.fill(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 9),
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
          ),
        ),
      ),
    );
  }
}

/// Черга відтворення: торкнутися — увімкнути, перетягнути за ⋮⋮ — змінити порядок.
class PlayerQueue extends StatelessWidget {
  const PlayerQueue({required this.player, super.key});
  final TrackPlayer player;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Expanded(child: Text(tr('Торкніться, щоб увімкнути; перетягніть за ⋮⋮, щоб змінити порядок.'), style: body(12, color: faint))),
        const SizedBox(width: 8),
        Text('${player.index + 1} / ${player.queue.length}', style: body(12, color: faint)),
      ]),
      const SizedBox(height: 6),
      ReorderableListView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        buildDefaultDragHandles: false,
        itemCount: player.queue.length,
        onReorderItem: player.move,
        proxyDecorator: (child, _, _) => Material(color: popover, elevation: 6, borderRadius: BorderRadius.circular(14), child: child),
        itemBuilder: (context, i) => _QueueRow(key: ObjectKey(player.queue[i]), player: player, i: i),
      ),
    ]);
  }
}

class _QueueRow extends StatelessWidget {
  const _QueueRow({required this.player, required this.i, super.key});
  final TrackPlayer player;
  final int i;

  @override
  Widget build(BuildContext context) {
    final track = player.queue[i];
    final on = i == player.index;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => player.playAt(i),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
          decoration: BoxDecoration(color: on ? primary.withValues(alpha: 0.10) : Colors.transparent, borderRadius: BorderRadius.circular(14)),
          child: Row(children: [
            Stack(alignment: Alignment.center, children: [
              TrackCover(url: track.cover, seed: track.id ?? i, size: 42, radius: 10),
              if (on)
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.45), borderRadius: BorderRadius.circular(10)),
                  child: Icon(player.playing ? LucideIcons.audioLines : LucideIcons.pause, size: 18, color: Colors.white),
                ),
            ]),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(track.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, color: on ? accent : ink, weight: FontWeight.w600)),
                Text(artistOf(track.artist), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
              ]),
            ),
            IconButton(tooltip: tr('Прибрати з черги'), visualDensity: VisualDensity.compact, onPressed: () => player.removeAt(i), icon: Icon(LucideIcons.x, size: 18, color: faint)),
            ReorderableDragStartListener(
              index: i,
              child: Padding(padding: EdgeInsets.symmetric(horizontal: 6, vertical: 8), child: Icon(LucideIcons.gripVertical, size: 18, color: muted)),
            ),
          ]),
        ),
      ),
    );
  }
}
