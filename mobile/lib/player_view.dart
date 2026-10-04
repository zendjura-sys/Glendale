import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'audio.dart';
import 'listen_together.dart';
import 'state.dart';
import 'theme.dart';
import 'track_edit.dart';
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
    Widget control(IconData icon, VoidCallback onPressed, {Color color = soft, double size = 24}) => SizedBox.square(
          dimension: 40,
          child: IconButton(padding: EdgeInsets.zero, onPressed: onPressed, icon: Icon(icon, color: color, size: size)),
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
              boxShadow: const [BoxShadow(color: Color(0x996D5DFC), blurRadius: 28, offset: Offset(0, 12), spreadRadius: -18)],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: const Color(0xB30F1426),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
                  ),
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
                        child: LinearProgressIndicator(value: progress, minHeight: 2.5, backgroundColor: Colors.white.withValues(alpha: 0.06), color: primary),
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
        final session = player.session;
        final own = track.id != null && session != null && (track.userId == session.myId || session.isAdmin);
        final details = [track.album, track.genre].whereType<String>().join(' · ');
        return _PullToClose(
          child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(parent: ClampingScrollPhysics()),
          padding: const EdgeInsets.fromLTRB(24, 6, 24, 28),
          child: Column(
            children: [
              AspectRatio(aspectRatio: 1, child: TrackCover(url: track.cover, seed: track.id ?? track.title, size: double.infinity, radius: 26)),
              const SizedBox(height: 18),
              Row(
                children: [
                  SizedBox(
                    width: 44,
                    child: track.id != null
                        ? IconButton(
                            tooltip: 'Слухати разом',
                            onPressed: () {
                              Navigator.pop(sheet);
                              startListening(context, trackId: track.id);
                            },
                            icon: const Icon(LucideIcons.headphones, size: 20, color: soft),
                          )
                        : null,
                  ),
                  Expanded(
                    child: Column(children: [
                      Text(track.title, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: display(20)),
                      const SizedBox(height: 6),
                      Text(artistOf(track.artist), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, color: muted)),
                      if (details.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(details, textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12.5, color: faint)),
                      ],
                    ]),
                  ),
                  SizedBox(
                    width: 44,
                    child: own
                        ? IconButton(
                            tooltip: 'Редагувати метадані',
                            onPressed: () async {
                              final card = await editTrackSheet(context, track.toCard());
                              if (card != null) player.updateMeta(card);
                            },
                            icon: const Icon(LucideIcons.pencil, size: 20, color: soft),
                          )
                        : null,
                  ),
                ],
              ),
              const SizedBox(height: 10),
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
                  IconButton(tooltip: 'Перемішати', onPressed: player.toggleShuffle, icon: Icon(LucideIcons.shuffle, color: player.shuffle ? primary : muted)),
                  IconButton(onPressed: player.prev, icon: const Icon(LucideIcons.skipBack, size: 32, color: ink)),
                  RoundIcon(icon: player.playing ? LucideIcons.pause : LucideIcons.play, onTap: player.toggle, filled: true, size: 68),
                  IconButton(onPressed: player.next, icon: const Icon(LucideIcons.skipForward, size: 32, color: ink)),
                  IconButton(tooltip: 'Повтор треку', onPressed: player.toggleRepeat, icon: Icon(player.repeat ? LucideIcons.repeat1 : LucideIcons.repeat, color: player.repeat ? primary : muted)),
                ],
              ),
              if (GcAudioHandler.failure != null) ...[
                const SizedBox(height: 10),
                Text('Фонове відтворення недоступне: ${GcAudioHandler.failure}', textAlign: TextAlign.center, style: body(11, color: faint)),
              ],
              if (player.queue.length > 1) ...[
                const SizedBox(height: 18),
                Row(children: [
                  const Expanded(child: CardTitle('Черга відтворення', icon: LucideIcons.listMusic)),
                  Text('${player.index + 1} / ${player.queue.length}', style: body(12, color: faint)),
                ]),
                Align(alignment: Alignment.centerLeft, child: Text('Торкніться, щоб увімкнути; перетягніть за ⋮⋮, щоб змінити порядок.', style: body(12, color: faint))),
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
              ],
            ],
          ),
          ),
        );
      },
    ),
  );
}

/// Свайп униз будь-де по плеєру закриває його, коли вміст прокручено до самого верху.
class _PullToClose extends StatefulWidget {
  const _PullToClose({required this.child});
  final Widget child;

  @override
  State<_PullToClose> createState() => _PullToCloseState();
}

class _PullToCloseState extends State<_PullToClose> {
  double pulled = 0;

  void _close() {
    pulled = 0;
    Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
    return NotificationListener<ScrollNotification>(
      onNotification: (n) {
        if (n.depth != 0) return false;
        if (n is OverscrollNotification && n.overscroll < 0 && n.dragDetails != null) {
          pulled -= n.overscroll;
          if (pulled > 72) _close();
        } else if (n is ScrollEndNotification) {
          // Швидкий змах униз від верху теж закриває.
          if (n.metrics.pixels <= 0 && (n.dragDetails?.primaryVelocity ?? 0) > 700) _close();
          pulled = 0;
        } else if (n is ScrollStartNotification) {
          pulled = 0;
        }
        return false;
      },
      child: widget.child,
    );
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
                Text(track.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, color: on ? const Color(0xFF9AA6FF) : ink, weight: FontWeight.w600)),
                Text(artistOf(track.artist), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
              ]),
            ),
            IconButton(tooltip: 'Прибрати з черги', visualDensity: VisualDensity.compact, onPressed: () => player.removeAt(i), icon: const Icon(LucideIcons.x, size: 18, color: faint)),
            ReorderableDragStartListener(
              index: i,
              child: const Padding(padding: EdgeInsets.symmetric(horizontal: 6, vertical: 8), child: Icon(LucideIcons.gripVertical, size: 18, color: muted)),
            ),
          ]),
        ),
      ),
    );
  }
}
