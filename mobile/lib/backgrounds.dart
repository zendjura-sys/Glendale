import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:video_player/video_player.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'subscription.dart';
import 'widgets.dart';

// Фон застосунку — той самий, що на сайті (App\Support\Backgrounds): фірмовий фон з Адмінка → Дизайн
// (картинка для телефона, інакше для комп'ютера) або сцена, обрана в Налаштування → Вигляд.
// Відеофон GameCon+ з бібліотеки адмінки грає беззвучно по колу за інтерфейсом, якщо ввімкнено «Рух фону»:
// на смартфоні — вертикальний файл, на планшеті — горизонтальний.

String backgroundLabel(String preset) => switch (preset) {
      'custom' => tr('Фірмовий'),
      'dune' => tr('Дюни'),
      'aurora' => tr('Сяйво'),
      'night' => tr('Зоряна ніч'),
      'ocean' => tr('Океан'),
      'mesh' => tr('Туман'),
      _ => tr('Без фону'),
    };

/// Сцена як набір градієнтів (без анімацій — заощаджує батарею).
List<Decoration> _scene(String preset) => switch (preset) {
      'dune' => const [
          BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF3C4778), Color(0xFF8F6A8E), Color(0xFFE8916A), Color(0xFFF6B177)], stops: [0, 0.44, 0.7, 1])),
          BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x00000000), Color(0x8C1A1020)], stops: [0.55, 1])),
        ],
      'aurora' => const [
          BoxDecoration(color: Color(0xFF04070D)),
          BoxDecoration(gradient: RadialGradient(center: Alignment(-0.8, -0.9), radius: 1.1, colors: [Color(0x6600D2FF), Color(0x0000D2FF)])),
          BoxDecoration(gradient: RadialGradient(center: Alignment(0.9, -0.2), radius: 0.9, colors: [Color(0x4D22C55E), Color(0x0022C55E)])),
          BoxDecoration(gradient: RadialGradient(center: Alignment(0, 1.1), radius: 1.0, colors: [Color(0x4D0A84FF), Color(0x000A84FF)])),
        ],
      'night' => const [
          BoxDecoration(gradient: RadialGradient(center: Alignment(0, 1.4), radius: 1.5, colors: [Color(0xFF1B2350), Color(0xFF0A0F2A), Color(0xFF03050F)], stops: [0, 0.45, 1])),
          BoxDecoration(gradient: LinearGradient(begin: Alignment(-1, 0.2), end: Alignment(1, -0.4), colors: [Color(0x00000000), Color(0x1F8C78FF), Color(0x14FFB4DC), Color(0x00000000)], stops: [0.38, 0.46, 0.52, 0.6])),
        ],
      'ocean' => const [
          BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF0C5B7A), Color(0xFF08405E), Color(0xFF052A45), Color(0xFF031A2E)], stops: [0, 0.38, 0.7, 1])),
          BoxDecoration(gradient: RadialGradient(center: Alignment(-0.3, -1.1), radius: 1.0, colors: [Color(0x3380E0FF), Color(0x0080E0FF)])),
        ],
      'mesh' => const [
          BoxDecoration(color: Color(0xFF1A1418)),
          BoxDecoration(gradient: RadialGradient(center: Alignment(-0.9, -0.8), radius: 1.0, colors: [Color(0x8CE8875A), Color(0x00E8875A)])),
          BoxDecoration(gradient: RadialGradient(center: Alignment(1, -0.3), radius: 1.0, colors: [Color(0x8C8A6BD1), Color(0x008A6BD1)])),
          BoxDecoration(gradient: RadialGradient(center: Alignment(-0.2, 1.1), radius: 1.0, colors: [Color(0x66D16B8F), Color(0x00D16B8F)])),
        ],
      _ => const [],
    };

/// Фон під усім застосунком — за налаштуванням із /me (`background`).
class UserBackdrop extends StatelessWidget {
  const UserBackdrop({required this.session, super.key});
  final Session session;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) {
        final bg = mapOf(session.me?['background']);
        final preset = text(bg['preset']) ?? 'none';
        final image = mapOf(bg['image']);
        final url = text(image['mobile']) ?? text(image['desktop']);
        final video = mapOf(bg['video']);
        final src = videoSourceFor(context, video);
        final poster = text(video['poster']);
        final Widget scene;
        if (src != null && bg['motion'] != false && !MediaQuery.disableAnimationsOf(context)) {
          scene = _VideoBackdrop(key: ValueKey(src), url: src, poster: poster);
        } else if (poster != null) {
          scene = Image.network(poster, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox.shrink());
        } else if (preset == 'custom' && url != null) {
          scene = Image.network(url, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox.shrink());
        } else {
          final layers = _scene(preset);
          if (layers.isEmpty) return const SizedBox.shrink();
          scene = Stack(fit: StackFit.expand, children: [for (final d in layers) DecoratedBox(decoration: d)]);
        }
        // Легке затемнення (у світлій темі — висвітлення): текст і скло читаються на будь-якому фоні.
        return Stack(fit: StackFit.expand, children: [
          scene,
          ColoredBox(color: palette.isLight ? Colors.white.withValues(alpha: 0.35) : Colors.black.withValues(alpha: 0.30)),
        ]);
      },
    );
  }
}

/// Файл відеофону під екран: смартфон — вертикальний, планшет (ширша сторона ≥ 600) — горизонтальний.
String? videoSourceFor(BuildContext context, Map<String, dynamic> video) {
  final tablet = MediaQuery.sizeOf(context).shortestSide >= 600;
  final mobile = text(video['mobile']);
  final desktop = text(video['desktop']);
  return tablet ? (desktop ?? mobile) : (mobile ?? desktop);
}

/// Відеофон GameCon+: файл з бібліотеки, без звуку, по колу, на весь екран (обрізаний як cover).
class _VideoBackdrop extends StatefulWidget {
  const _VideoBackdrop({required this.url, this.poster, super.key});
  final String url;
  final String? poster;

  @override
  State<_VideoBackdrop> createState() => _VideoBackdropState();
}

class _VideoBackdropState extends State<_VideoBackdrop> with WidgetsBindingObserver {
  late final VideoPlayerController controller;
  bool ready = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // mixWithOthers: фон не забирає аудіофокус у музики й дзвінків.
    controller = VideoPlayerController.networkUrl(Uri.parse(widget.url), videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true));
    controller.initialize().then((_) async {
      await controller.setVolume(0);
      await controller.setLooping(true);
      await controller.play();
      if (mounted) setState(() => ready = true);
    }).catchError((Object _) {});
  }

  // Застосунок згорнуто — відео на паузі, щоб не їсти батарею.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!ready) return;
    state == AppLifecycleState.resumed ? controller.play() : controller.pause();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final poster = widget.poster;
    return IgnorePointer(
      child: Stack(fit: StackFit.expand, children: [
        if (poster != null) Image.network(poster, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox.shrink()),
        if (ready)
          FittedBox(
            fit: BoxFit.cover,
            clipBehavior: Clip.hardEdge,
            child: SizedBox(width: controller.value.size.width, height: controller.value.size.height, child: VideoPlayer(controller)),
          ),
      ]),
    );
  }
}

/// Налаштування → Вигляд → «Фон»: сцени як на сайті; фірмовий — якщо адмін його завантажив.
class BackgroundPicker extends StatefulWidget {
  const BackgroundPicker({super.key});

  @override
  State<BackgroundPicker> createState() => _BackgroundPickerState();
}

class _BackgroundPickerState extends State<BackgroundPicker> {
  String? busy;

  Future<void> _save(Session session, Map<String, dynamic> body, {String key = 'motion'}) async {
    setState(() => busy = key);
    final ok = await attempt(context, () => session.api.put(Api.site('/settings/appearance/background'), body), success: tr('Фон збережено.'));
    if (ok) await session.refreshMe();
    if (mounted) setState(() => busy = null);
  }

  Future<void> _pick(Session session, String preset) async {
    setState(() => busy = preset);
    final ok = await attempt(context, () => session.api.put(Api.site('/settings/appearance/background'), {'background': preset, 'background_video': null}));
    if (ok) await session.refreshMe();
    if (mounted) setState(() => busy = null);
  }

  @override
  Widget build(BuildContext context) {
    final session = AppScope.of(context).session;
    final bg = mapOf(session.me?['background']);
    final presets = [for (final p in (bg['presets'] is List ? bg['presets'] as List : const ['dune', 'aurora', 'night', 'ocean', 'mesh', 'none'])) '$p'];
    final current = text(bg['preset']) ?? 'aurora';
    final image = mapOf(bg['image']);
    final url = text(image['mobile']) ?? text(image['desktop']);
    final plus = session.me?['plus'] != null;
    final videos = [for (final v in (bg['videos'] is List ? bg['videos'] as List : const [])) mapOf(v)];
    final currentVideo = mapOf(bg['video'])['id'];
    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(tr('Фон'), style: body(16, weight: FontWeight.w600)),
        const SizedBox(height: 4),
        Text(tr('Сцена за інтерфейсом — та сама на сайті й у застосунку.'), style: body(13, color: muted)),
        const SizedBox(height: 12),
        LayoutBuilder(builder: (context, box) {
          final cols = math.max(3, (box.maxWidth / 110).floor());
          final w = (box.maxWidth - (cols - 1) * 8) / cols;
          return Wrap(spacing: 8, runSpacing: 8, children: [
            for (final p in presets)
              GestureDetector(
                // Сцена замінює відеофон.
                onTap: busy == null && (p != current || currentVideo != null) ? () => _pick(session, p) : null,
                child: SizedBox(
                  width: w,
                  child: Column(children: [
                    Container(
                      height: w * 0.62,
                      clipBehavior: Clip.antiAlias,
                      decoration: BoxDecoration(
                        color: palette.voidColor,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: p == current && currentVideo == null ? primary : lineStrong, width: p == current && currentVideo == null ? 2 : 1),
                      ),
                      child: Stack(fit: StackFit.expand, children: [
                        if (p == 'custom' && url != null)
                          Image.network(url, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox.shrink())
                        else
                          for (final d in _scene(p)) DecoratedBox(decoration: d),
                        if (p == 'none') Center(child: Icon(LucideIcons.ban, size: 18, color: muted)),
                        if (busy == p) const Center(child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))),
                      ]),
                    ),
                    const SizedBox(height: 4),
                    Text(backgroundLabel(p), style: body(12, color: p == current ? ink : muted, weight: p == current ? FontWeight.w700 : FontWeight.w500)),
                  ]),
                ),
              ),
          ]);
        }),
        const SizedBox(height: 10),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: bg['motion'] != false,
          title: Text(tr('Рух фону'), style: body(14.5, weight: FontWeight.w600)),
          subtitle: Text(tr('Відеофон грає, лише коли рух увімкнено.'), style: body(12.5, color: muted)),
          onChanged: busy != null ? null : (v) => _save(session, {'background_motion': v}),
        ),
        if (videos.isNotEmpty) ...[
          const SizedBox(height: 6),
          Row(children: [
            Icon(LucideIcons.clapperboard, size: 16, color: primary),
            const SizedBox(width: 8),
            Expanded(child: Text(tr('Відеофон · GameCon+'), style: body(14, weight: FontWeight.w600))),
          ]),
          const SizedBox(height: 4),
          Text(
            plus ? tr('Відео без звуку грає по колу замість сцени.') : tr('Відеофони — привілей GameCon+.'),
            style: body(12.5, color: muted),
          ),
          const SizedBox(height: 10),
          LayoutBuilder(builder: (context, box) {
            final cols = math.max(2, (box.maxWidth / 160).floor());
            final w = (box.maxWidth - (cols - 1) * 8) / cols;
            return Wrap(spacing: 8, runSpacing: 8, children: [
              for (final v in videos)
                _VideoTile(
                  width: w,
                  video: v,
                  active: v['id'] == currentVideo,
                  busy: busy == 'video${v['id']}',
                  locked: !plus,
                  onTap: busy != null
                      ? null
                      : !plus
                          ? () => showProFeatures(context)
                          : () => _save(session, {'background_video': v['id'] == currentVideo ? null : v['id']}, key: 'video${v['id']}'),
                ),
            ]);
          }),
          if (!plus) ...[
            const SizedBox(height: 10),
            GhostButton(label: tr('Відкрити GameCon+'), icon: LucideIcons.sparkles, onPressed: () => showProFeatures(context)),
          ],
        ],
      ]),
    );
  }
}

/// Плитка відеофону: обкладинка (кадр), назва, позначка вибору чи замка.
class _VideoTile extends StatelessWidget {
  const _VideoTile({required this.width, required this.video, required this.active, required this.busy, required this.locked, this.onTap});
  final double width;
  final Map<String, dynamic> video;
  final bool active;
  final bool busy;
  final bool locked;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final poster = text(video['poster']);
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: width,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            height: width * 0.62,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: Colors.black,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: active ? primary : lineStrong, width: active ? 2 : 1),
            ),
            child: Stack(fit: StackFit.expand, children: [
              if (poster != null)
                Image.network(poster, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox.shrink())
              else
                Center(child: Icon(LucideIcons.clapperboard, size: 20, color: Colors.white.withValues(alpha: 0.5))),
              if (locked) Positioned(top: 6, right: 6, child: Icon(LucideIcons.lock, size: 14, color: Colors.white.withValues(alpha: 0.85))),
              if (active) Positioned(top: 6, right: 6, child: Icon(LucideIcons.circleCheck, size: 18, color: primary)),
              if (busy) const Center(child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))),
            ]),
          ),
          const SizedBox(height: 4),
          Text(text(video['title']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: active ? ink : muted, weight: active ? FontWeight.w700 : FontWeight.w500)),
        ]),
      ),
    );
  }
}
