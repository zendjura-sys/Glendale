import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'i18n.dart';
import 'theme.dart';
import 'voice_room.dart';
import 'widgets.dart';

/// Повноекранна сцена відеодзвінка поверх оболонки: камери й демонстрація екрана.
class CallStage extends StatelessWidget {
  const CallStage({super.key});

  @override
  Widget build(BuildContext context) {
    final call = VoiceCall.instance;
    return ListenableBuilder(
      listenable: call,
      builder: (context, _) {
        if (!call.hasVideo) return const SizedBox.shrink();
        final tiles = List<CallVideoTile>.from(call.videos);
        tiles.sort((a, b) {
          if (a.screen != b.screen) return a.screen ? -1 : 1;
          if (a.local != b.local) return a.local ? 1 : -1;
          return a.name.compareTo(b.name);
        });
        final top = MediaQuery.viewPaddingOf(context).top;
        return Positioned(
          top: top + siteBarHeight + 8,
          left: 10,
          right: 10,
          bottom: MediaQuery.viewPaddingOf(context).bottom + islandExtent + voiceBarExtent + miniPlayerExtent + 12,
          child: IgnorePointer(
            ignoring: false,
            child: Material(
              color: Colors.black.withValues(alpha: 0.72),
              borderRadius: BorderRadius.circular(22),
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(14, 10, 8, 8),
                    child: Row(
                      children: [
                        const Icon(LucideIcons.video, size: 16, color: Colors.white70),
                        const SizedBox(width: 8),
                        Expanded(child: Text(call.roomName, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, weight: FontWeight.w700, color: Colors.white))),
                        if (call.cameraOn)
                          IconButton(
                            tooltip: tr('Перемкнути камеру'),
                            onPressed: () => call.flipCamera(),
                            icon: const Icon(LucideIcons.switchCamera, size: 18, color: Colors.white70),
                          ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: LayoutBuilder(
                      builder: (context, box) {
                        final primary = tiles.first;
                        final rest = tiles.skip(1).toList();
                        return Stack(
                          children: [
                            Positioned.fill(child: _Tile(tile: primary, large: true)),
                            if (rest.isNotEmpty)
                              Positioned(
                                right: 10,
                                bottom: 10,
                                child: SizedBox(
                                  width: box.maxWidth < 420 ? 112 : 140,
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      for (final tile in rest.take(3))
                                        Padding(
                                          padding: const EdgeInsets.only(top: 8),
                                          child: SizedBox(height: 96, child: _Tile(tile: tile, large: false)),
                                        ),
                                    ],
                                  ),
                                ),
                              ),
                          ],
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.tile, required this.large});
  final CallVideoTile tile;
  final bool large;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(large ? 0 : 14),
      child: Stack(
        fit: StackFit.expand,
        children: [
          ColoredBox(
            color: const Color(0xFF12141A),
            child: VideoTrackRenderer(
              tile.track,
              fit: VideoViewFit.cover,
              mirrorMode: tile.local && !tile.screen ? VideoViewMirrorMode.mirror : VideoViewMirrorMode.off,
            ),
          ),
          Positioned(
            left: 8,
            bottom: 8,
            right: 8,
            child: Glass(
              radius: 10,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Text(
                tile.screen ? '${tile.name} · ${tr('Екран')}' : (tile.local ? tr('Ви') : tile.name),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: body(11.5, weight: FontWeight.w600, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
