import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:share_plus/share_plus.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// Game Card — як на сайті (/{username}/card, App\Services\GameCard): рівень і звання, ігри, сервери,
// сім’я й клан, сезон, нагороди. Закритий профіль стороннім показує лише публічне.
// Кнопки — кольорів Discord (blurple і сірий), сама картка — у стилі GameCon.

const discordBlurple = Color(0xFF5865F2);
const discordGrey = Color(0xFF4E5058);

class GameCardScreen extends StatelessWidget {
  const GameCardScreen({required this.username, super.key});
  final String username;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.of(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/u/$username/card')),
      builder: (data, reload) => GameCardView(data: data),
    );
  }
}

class GameCardView extends StatefulWidget {
  const GameCardView({required this.data, super.key});
  final Map<String, dynamic> data;

  @override
  State<GameCardView> createState() => _GameCardViewState();
}

class _GameCardViewState extends State<GameCardView> {
  final _card = GlobalKey();
  bool busy = false;

  Future<void> _share() async {
    setState(() => busy = true);
    try {
      final boundary = _card.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      final image = await boundary?.toImage(pixelRatio: 3);
      final bytes = await image?.toByteData(format: ui.ImageByteFormat.png);
      if (bytes == null) throw StateError('png');
      final profile = mapOf(widget.data['profile']);
      await SharePlus.instance.share(ShareParams(
        files: [XFile.fromData(bytes.buffer.asUint8List(), mimeType: 'image/png', name: 'gamecard-${profile['username']}.png')],
        text: text(widget.data['url']),
      ));
    } catch (_) {
      if (mounted) toast(context, tr('Не вдалося зберегти картку.'), kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = mapOf(widget.data['profile']);
    final game = mapOf(widget.data['game']);
    final url = text(widget.data['url']) ?? '';
    return ScreenScroll(children: [
      Row(children: [
        RoundIcon(icon: LucideIcons.arrowLeft, onTap: () => context.canPop() ? context.pop() : context.go('/u/${profile['username']}')),
        const SizedBox(width: 8),
        Text('Game Card', style: body(14, color: muted)),
      ]),
      const SizedBox(height: 12),
      RepaintBoundary(key: _card, child: GameCardBody(profile: profile, game: game, url: url)),
      const SizedBox(height: 14),
      _DiscordButton(label: tr('Поділитися'), icon: LucideIcons.share2, color: discordBlurple, busy: busy, onPressed: _share),
      const SizedBox(height: 8),
      _DiscordButton(
        label: tr('Скопіювати посилання'),
        icon: LucideIcons.link2,
        color: discordGrey,
        onPressed: () async {
          await Clipboard.setData(ClipboardData(text: url));
          if (context.mounted) toast(context, tr('Посилання скопійовано.'));
        },
      ),
    ]);
  }
}

class _DiscordButton extends StatelessWidget {
  const _DiscordButton({required this.label, required this.icon, required this.color, required this.onPressed, this.busy = false});
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 46,
      child: FilledButton.icon(
        onPressed: busy ? null : onPressed,
        style: FilledButton.styleFrom(backgroundColor: color, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
        icon: busy ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Icon(icon, size: 18),
        label: Text(label, style: body(14.5, color: Colors.white, weight: FontWeight.w600)),
      ),
    );
  }
}

/// Сама картка: банер, аватар, рівень, факти без обрізання, статистика.
class GameCardBody extends StatelessWidget {
  const GameCardBody({required this.profile, required this.game, required this.url, super.key});
  final Map<String, dynamic> profile;
  final Map<String, dynamic> game;
  final String url;

  @override
  Widget build(BuildContext context) {
    final family = game['family'] is Map ? mapOf(game['family']) : null;
    final clan = game['clan'] is Map ? mapOf(game['clan']) : null;
    final season = game['season'] is Map ? mapOf(game['season']) : null;
    final badges = mapOf(game['badges']);
    final facts = <(IconData, String, String)>[
      if ((game['games'] as List? ?? []).isNotEmpty) (LucideIcons.gamepad2, tr('Ігри'), (game['games'] as List).join(', ')),
      if ((game['servers'] as List? ?? []).isNotEmpty) (LucideIcons.server, tr('Сервери'), (game['servers'] as List).join(', ')),
      if (family != null) (LucideIcons.crown, tr('Сім’я'), '${text(family['tag']) != null ? '[${family['tag']}] ' : ''}${family['name']}'),
      if (clan != null) (LucideIcons.swords, tr('Клан'), '${clan['name']}'),
      if (text(game['artist']) != null) (LucideIcons.music2, tr('Слухає найчастіше'), text(game['artist'])!),
    ];
    const bg = Color(0xFF0B1020);
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(colors: [bg, Color(0xFF050608)], begin: Alignment.topLeft, end: Alignment.bottomRight)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Stack(clipBehavior: Clip.none, children: [
            Container(height: 96, decoration: const BoxDecoration(gradient: LinearGradient(colors: [Color(0xFF1D4ED8), neonBlue]))),
            Positioned(
              left: 16,
              bottom: -44,
              child: Container(
                padding: const EdgeInsets.all(5),
                decoration: const BoxDecoration(color: Color(0xFF0A0E1A), shape: BoxShape.circle),
                child: Avatar(url: text(profile['avatar_url']), name: text(profile['name']) ?? '?', size: 84),
              ),
            ),
          ]),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Align(
                alignment: Alignment.centerRight,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(color: neonBlue.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(20)),
                  child: Text(tr('Рівень {n}', {'n': game['level']}), style: body(13, color: neonBlue, weight: FontWeight.w700)),
                ),
              ),
              const SizedBox(height: 16),
              Text(text(profile['name']) ?? '', style: display(24, color: Colors.white)),
              const SizedBox(height: 2),
              Text('@${profile['username']} · ${game['title'] ?? ''}', style: body(13.5, color: Colors.white60)),
              if (facts.isNotEmpty) ...[
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(10)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    for (var i = 0; i < facts.length; i++) ...[
                      if (i > 0) const SizedBox(height: 10),
                      Row(children: [
                        Icon(facts[i].$1, size: 13, color: Colors.white54),
                        const SizedBox(width: 6),
                        Text(facts[i].$2, style: body(12, color: Colors.white54, weight: FontWeight.w600)),
                      ]),
                      const SizedBox(height: 2),
                      Text(facts[i].$3, style: body(14, color: Colors.white.withValues(alpha: 0.88))),
                    ],
                  ]),
                ),
              ],
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(10)),
                child: Wrap(spacing: 24, runSpacing: 10, children: [
                  _Stat(label: tr('Нагороди'), value: '${badges['earned'] ?? 0}/${badges['total'] ?? 0}'),
                  if (season != null) _Stat(label: tr('Сезон'), value: '${season['level']}/${season['max']}'),
                  _Stat(label: tr('У GameCon з'), value: '${game['since'] ?? ''}'),
                ]),
              ),
              const SizedBox(height: 10),
              Text(url.replaceFirst(RegExp(r'^https?://'), ''), style: body(12, color: Colors.white38)),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
      Text(value, style: display(20, color: Colors.white)),
      Text(label, style: body(12, color: Colors.white54)),
    ]);
  }
}
