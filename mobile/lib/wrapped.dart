import 'dart:async';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import 'core/widgets/arctic_glass/arctic_fit_text.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:share_plus/share_plus.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// «Підсумки року» — як на сайті (pages/wrapped.tsx): історія з карток, дотик праворуч — далі,
// ліворуч — назад, утримання — пауза, картки йдуть самі. Порожні розділи пропускаються.
// Дані — через міст /api/v1/site/wrapped. Поділитися — картинка 1080×1350 у системне меню (share_plus).

const _slideTime = Duration(seconds: 7);

/// Тло карток: пласкі кольорові плями на глибокому індиго (ті самі, що на сайті).
const _tones = [
  // Кольори проєкту: неоновий синій і крижана блакить на нічному тлі.
  [Color(0xFF2F7BFF), Color(0xFF22D3EE), Color(0xFF050913)],
  [Color(0xFF3D63FF), Color(0xFF1D6FE0), Color(0xFF071026)],
  [Color(0xFF22C4F0), Color(0xFF2A6CFF), Color(0xFF0B1638)],
  [Color(0xFF4D9BFF), Color(0xFF3D63FF), Color(0xFF050913)],
  [Color(0xFFA9C8FF), Color(0xFF2F7BFF), Color(0xFF0B1638)],
  [Color(0xFF38E1FF), Color(0xFF3D63FF), Color(0xFF071026)],
];

Map<String, (String, String)> _personas() => {
      'melomaniac': (tr('Меломан'), tr('Музика звучала в тебе частіше, ніж будь-що інше.')),
      'cinephile': (tr('Кіноман'), tr('Фільми й серіали стали твоїм другим домом.')),
      'author': (tr('Автор'), tr('Твої пости читала вся стрічка.')),
      'soul': (tr('Душа компанії'), tr('Друзі, чати й дзвінки — ти завжди на зв’язку.')),
      'gamer': (tr('Геймер'), tr('Ігри й сервери знали тебе в обличчя.')),
      'newcomer': (tr('Новачок'), tr('Усе тільки починається — наступний рік буде твоїм.')),
    };

/// Українська множина за трьома формами.
String _n(int count, String one, String few, String many) {
  final m10 = count % 10, m100 = count % 100;
  if (m10 == 1 && m100 != 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

String _num(int value) {
  final s = value.toString();
  final out = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) out.write(' ');
    out.write(s[i]);
  }
  return out.toString();
}

/// Ключові цифри картки, як summaryStats на сайті: не більше чотирьох ненульових.
List<(int, String)> _shareStats(Map<String, dynamic> w) {
  (int, String) stat(int value, String one, String few, String many) => (value, _n(value, one, few, many));
  final posts = mapOf(w['posts']);
  final social = mapOf(w['social']);
  final music = mapOf(w['music']);
  final cinema = mapOf(w['cinema']);
  final games = mapOf(w['games']);
  final all = <(int, String)>[
    stat(intOf(w['active_days']), tr('день з GameCon'), tr('дні з GameCon'), tr('днів з GameCon')),
    stat(intOf(posts['count']), tr('пост'), tr('пости'), tr('постів')),
    stat(intOf(social['new_friends']), tr('новий друг'), tr('нові друзі'), tr('нових друзів')),
    stat(intOf(music['plays']), tr('прослуховування'), tr('прослуховування'), tr('прослуховувань')),
    stat(intOf(cinema['watched']), tr('перегляд'), tr('перегляди'), tr('переглядів')),
    stat(intOf(games['play_days']), tr('ігровий день'), tr('ігрові дні'), tr('ігрових днів')),
  ];
  return [for (final item in all) if (item.$1 > 0) item].take(4).toList();
}

/// Картинка 1080×1350 для поширення: те саме, що canvas shareImage на сайті.
Future<Uint8List?> wrappedSharePng(Map<String, dynamic> w) async {
  const width = 1080.0;
  const height = 1350.0;
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder, const Rect.fromLTWH(0, 0, width, height));
  canvas.drawRect(const Rect.fromLTWH(0, 0, width, height), Paint()..color = const Color(0xFF050913));
  void glow(Offset center, double radius, Color color) {
    final paint = Paint()..shader = ui.Gradient.radial(center, radius, [color, const Color(0x00050913)]);
    canvas.drawRect(const Rect.fromLTWH(0, 0, width, height), paint);
  }

  glow(const Offset(180, 160), 760, const Color.fromRGBO(47, 123, 255, 0.9));
  glow(const Offset(960, 1250), 760, const Color.fromRGBO(34, 211, 238, 0.7));

  TextStyle font(double size, FontWeight weight, Color color) => TextStyle(fontFamily: 'Montserrat', fontSize: size, fontWeight: weight, color: color, height: 1);

  void paintText(String value, TextStyle style, Offset at, {double maxWidth = 900}) {
    final painter = TextPainter(text: TextSpan(text: value, style: style), textDirection: TextDirection.ltr, maxLines: 1, ellipsis: '…')..layout(maxWidth: maxWidth);
    painter.paint(canvas, at);
    painter.dispose();
  }

  final user = mapOf(w['user']);
  final name = text(user['name']) ?? '';
  final persona = (_personas()[text(w['persona'])] ?? _personas()['newcomer']!).$1;
  paintText(tr('Підсумки року · GameCon'), font(40, FontWeight.w600, Colors.white.withValues(alpha: 0.75)), const Offset(90, 100));
  paintText('${intOf(w['year'])}', font(200, FontWeight.w800, Colors.white), const Offset(80, 170), maxWidth: 920);
  paintText(name.length <= 28 ? name : name.substring(0, 28), font(56, FontWeight.w700, Colors.white), const Offset(90, 410));
  paintText(persona, font(40, FontWeight.w500, Colors.white.withValues(alpha: 0.8)), const Offset(90, 486));

  final stats = _shareStats(w);
  for (var i = 0; i < stats.length; i++) {
    final x = 90.0 + (i % 2) * 470;
    final y = 640.0 + (i ~/ 2) * 260.0;
    final rect = RRect.fromRectAndRadius(Rect.fromLTWH(x, y, 430, 220), const Radius.circular(36));
    canvas.drawRRect(rect, Paint()..color = Colors.white.withValues(alpha: 0.08));
    canvas.drawRRect(rect, Paint()
      ..color = Colors.white.withValues(alpha: 0.18)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2);
    paintText(_num(stats[i].$1), font(88, FontWeight.w800, Colors.white), Offset(x + 40, y + 36), maxWidth: 350);
    paintText(stats[i].$2, font(34, FontWeight.w500, Colors.white.withValues(alpha: 0.75)), Offset(x + 40, y + 148), maxWidth: 350);
  }

  paintText('gamecon.online', font(36, FontWeight.w600, Colors.white.withValues(alpha: 0.7)), const Offset(90, 1220));
  final image = await recorder.endRecording().toImage(width.toInt(), height.toInt());
  final data = await image.toByteData(format: ui.ImageByteFormat.png);
  image.dispose();
  final bytes = data?.buffer.asUint8List();
  return bytes == null ? null : Uint8List.fromList(bytes);
}

class WrappedScreen extends StatefulWidget {
  const WrappedScreen({super.key});

  @override
  State<WrappedScreen> createState() => _WrappedScreenState();
}

class _WrappedScreenState extends State<WrappedScreen> {
  Map<String, dynamic>? data;
  Object? error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final result = await AppScope.read(context).session.api.get(Api.site('/wrapped'));
      if (mounted) setState(() => data = result);
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  void _close() => context.canPop() ? context.pop() : context.go('/feed');

  @override
  Widget build(BuildContext context) {
    final d = data;
    final Widget child;
    if (d == null) {
      child = Center(
        child: error == null
            ? const CircularProgressIndicator(color: Colors.white)
            : Text(tr('Не вдалося завантажити підсумки.'), style: body(15, color: Colors.white70)),
      );
    } else if (d['wrapped'] is! Map) {
      child = _Teaser(opensAt: text(d['opens_at']), onClose: _close);
    } else {
      child = _Story(w: mapOf(d['wrapped']), preview: d['preview'] == true, onClose: _close);
    }
    return Scaffold(backgroundColor: _tones[0][2], body: child);
  }
}

class _Backdrop extends StatelessWidget {
  const _Backdrop({required this.tone});
  final int tone;

  @override
  Widget build(BuildContext context) {
    final c = _tones[tone % _tones.length];
    return AnimatedContainer(
      duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : const Duration(milliseconds: 700),
      color: c[2],
      child: Stack(fit: StackFit.expand, children: [
        DecoratedBox(decoration: BoxDecoration(gradient: RadialGradient(center: const Alignment(-0.6, -0.8), radius: 1.1, colors: [c[0], c[0].withValues(alpha: 0)]))),
        DecoratedBox(decoration: BoxDecoration(gradient: RadialGradient(center: const Alignment(0.8, 0.9), radius: 1.1, colors: [c[1], c[1].withValues(alpha: 0)]))),
      ]),
    );
  }
}

class _Teaser extends StatelessWidget {
  const _Teaser({required this.opensAt, required this.onClose});
  final String? opensAt;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final date = DateTime.tryParse(opensAt ?? '');
    return Stack(fit: StackFit.expand, children: [
      const _Backdrop(tone: 0),
      SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(LucideIcons.sparkles, size: 40, color: Colors.white70),
              const SizedBox(height: 16),
              Text(tr('Підсумки року ще готуються'), textAlign: TextAlign.center, style: display(28, color: Colors.white)),
              const SizedBox(height: 12),
              Text(
                tr('Твої картки з’являться {date}: пости, друзі, музика, кіно й ігри за весь рік.', {'date': date == null ? tr('1 грудня') : '${date.day}.${date.month.toString().padLeft(2, '0')}'}),
                textAlign: TextAlign.center,
                style: body(15.5, color: Colors.white70),
              ),
              const SizedBox(height: 24),
              _Button(label: tr('До стрічки'), onTap: onClose, light: true),
            ]),
          ),
        ),
      ),
    ]);
  }
}

class _Button extends StatelessWidget {
  const _Button({required this.label, required this.onTap, this.icon, this.light = false, this.busy = false});
  final String label;
  final VoidCallback onTap;
  final IconData? icon;
  final bool light;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final ink = light ? const Color(0xFF050913) : Colors.white;
    return Material(
      color: light ? Colors.white : Colors.white.withValues(alpha: 0.12),
      shape: StadiumBorder(side: light ? BorderSide.none : BorderSide(color: Colors.white.withValues(alpha: 0.2))),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: busy ? null : onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 50),
          padding: const EdgeInsets.symmetric(horizontal: 22),
          alignment: Alignment.center,
          child: busy
              ? SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: ink))
              : Row(mainAxisSize: MainAxisSize.min, children: [
                  if (icon != null) ...[Icon(icon, size: 20, color: ink), const SizedBox(width: 8)],
                  Text(label, style: body(15.5, weight: FontWeight.w600, color: ink)),
                ]),
        ),
      ),
    );
  }
}

typedef _Slide = ({String key, WidgetBuilder build});

class _Story extends StatefulWidget {
  const _Story({required this.w, required this.preview, required this.onClose});
  final Map<String, dynamic> w;
  final bool preview;
  final VoidCallback onClose;

  @override
  State<_Story> createState() => _StoryState();
}

class _StoryState extends State<_Story> with SingleTickerProviderStateMixin {
  late final List<_Slide> slides = _buildSlides(widget.w);
  late final AnimationController timer = AnimationController(vsync: this, duration: _slideTime)
    ..addStatusListener((status) {
      if (status == AnimationStatus.completed) _go(1);
    });
  int index = 0;
  bool sharing = false;

  bool get last => index == slides.length - 1;

  /// Картинка підсумків у системне «Поділитися», як canvas на сайті.
  Future<void> _shareImage() async {
    if (sharing) return;
    setState(() => sharing = true);
    try {
      final png = await wrappedSharePng(widget.w);
      if (png == null) throw StateError('png');
      final year = intOf(widget.w['year']);
      await SharePlus.instance.share(ShareParams(
        files: [XFile.fromData(png, mimeType: 'image/png', name: 'gamecon-$year.png')],
        text: tr('Мій {year} у GameCon', {'year': year}),
      ));
    } catch (_) {
      if (mounted) toast(context, tr('Не вдалося поділитися підсумками.'), kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => sharing = false);
    }
  }

  @override
  void initState() {
    super.initState();
    timer.forward();
  }

  @override
  void dispose() {
    timer.dispose();
    super.dispose();
  }

  void _go(int delta) {
    final next = (index + delta).clamp(0, slides.length - 1);
    setState(() => index = next);
    timer.value = 0;
    if (!last) timer.forward();
  }

  @override
  Widget build(BuildContext context) {
    final year = intOf(widget.w['year']);
    final reduce = MediaQuery.disableAnimationsOf(context);
    return Stack(fit: StackFit.expand, children: [
      _Backdrop(tone: index),
      SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 20),
          child: Column(children: [
            AnimatedBuilder(
              animation: timer,
              builder: (_, _) => Row(children: [
                for (var i = 0; i < slides.length; i++) ...[
                  if (i > 0) const SizedBox(width: 5),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(2),
                      child: LinearProgressIndicator(
                        minHeight: 4,
                        value: i < index ? 1 : (i == index ? (last ? 1 : timer.value) : 0),
                        backgroundColor: Colors.white.withValues(alpha: 0.25),
                        valueColor: const AlwaysStoppedAnimation(Colors.white),
                      ),
                    ),
                  ),
                ],
              ]),
            ),
            const SizedBox(height: 6),
            Row(children: [
              Expanded(
                child: Text(
                  widget.preview ? '${tr('Підсумки {year}', {'year': year})} · ${tr('попередній перегляд')}' : tr('Підсумки {year}', {'year': year}),
                  style: body(13.5, color: Colors.white70, weight: FontWeight.w500),
                ),
              ),
              IconButton(onPressed: widget.onClose, tooltip: tr('Закрити'), icon: const Icon(LucideIcons.x, color: Colors.white70)),
            ]),
            Expanded(
              child: LayoutBuilder(
                builder: (context, box) => GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onLongPressStart: (_) => timer.stop(),
                  onLongPressEnd: (_) {
                    if (!last) timer.forward();
                  },
                  onTapUp: (d) {
                    if (d.localPosition.dx < box.maxWidth / 3) {
                      _go(-1);
                    } else if (!last) {
                      _go(1);
                    }
                  },
                  child: AnimatedSwitcher(
                    duration: reduce ? Duration.zero : const Duration(milliseconds: 320),
                    transitionBuilder: (child, a) => FadeTransition(
                      opacity: a,
                      child: SlideTransition(position: Tween(begin: const Offset(0.06, 0), end: Offset.zero).animate(a), child: child),
                    ),
                    child: Align(
                      key: ValueKey(slides[index].key),
                      alignment: Alignment.centerLeft,
                      child: SingleChildScrollView(child: slides[index].build(context)),
                    ),
                  ),
                ),
              ),
            ),
          ]),
        ),
      ),
    ]);
  }

  List<_Slide> _buildSlides(Map<String, dynamic> w) {
    final year = intOf(w['year']);
    final user = mapOf(w['user']);
    final posts = mapOf(w['posts']);
    final social = mapOf(w['social']);
    final music = mapOf(w['music']);
    final cinema = mapOf(w['cinema']);
    final games = mapOf(w['games']);
    final progress = mapOf(w['progress']);
    final persona = _personas()[text(w['persona'])] ?? _personas()['newcomer']!;
    final activeDays = intOf(w['active_days']);
    final slides = <_Slide>[];

    slides.add((
      key: 'intro',
      build: (_) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _avatar(user, 80),
        const SizedBox(height: 24),
        Text(tr('Твій {year} у GameCon', {'year': year}), style: display(42, color: Colors.white)),
        const SizedBox(height: 16),
        Text(
          w['joined_this_year'] == true ? tr('Ти з нами з цього року — і вже стільки встиг(-ла)!') : tr('Згадаймо, яким він був.'),
          style: body(19, color: Colors.white.withValues(alpha: 0.8)),
        ),
        if (activeDays > 0) ...[
          const SizedBox(height: 28),
          _Big(value: activeDays, label: _n(activeDays, tr('день разом'), tr('дні разом'), tr('днів разом'))),
        ],
      ]),
    ));

    final postCount = intOf(posts['count']);
    if (postCount > 0 || intOf(posts['comments']) > 0) {
      final top = posts['top'] is Map ? mapOf(posts['top']) : null;
      slides.add((
        key: 'posts',
        build: (_) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _Kicker(LucideIcons.sparkles, tr('Стрічка')),
          const SizedBox(height: 24),
          _Big(value: postCount, label: _n(postCount, tr('пост за рік'), tr('пости за рік'), tr('постів за рік'))),
          const SizedBox(height: 22),
          _Stats([(intOf(posts['reactions']), tr('реакцій на них')), (intOf(posts['comments']), tr('коментарів написано'))]),
          if (top != null) ...[
            const SizedBox(height: 22),
            _Panel(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (text(top['image']) != null)
                  ClipRRect(borderRadius: BorderRadius.circular(16), child: AspectRatio(aspectRatio: 16 / 9, child: NetImage(text(top['image'])!, fit: BoxFit.cover))),
                const SizedBox(height: 10),
                Text(tr('Найпопулярніший пост'), style: body(13, color: Colors.white60)),
                if ((text(top['body']) ?? '').isNotEmpty) FitText(text(top['body'])!, style: body(15, color: Colors.white), maxLines: 3),
                const SizedBox(height: 6),
                Row(children: [
                  const Icon(LucideIcons.heart, size: 16, color: Color(0xFFFF4D6D)),
                  const SizedBox(width: 6),
                  Text('${intOf(top['likes'])}', style: body(14, color: Colors.white70)),
                ]),
              ]),
            ),
          ],
        ]),
      ));
    }

    final messages = intOf(social['messages']);
    final best = social['best_friend'] is Map ? mapOf(social['best_friend']) : null;
    if (messages > 0 || intOf(social['new_friends']) > 0 || best != null) {
      slides.add((
        key: 'social',
        build: (_) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _Kicker(LucideIcons.users, tr('Друзі')),
          const SizedBox(height: 24),
          if (best != null) ...[
            _avatar(mapOf(best['user']), 80),
            const SizedBox(height: 16),
            Text(
              tr('{name} — твоя людина року', {'name': text(mapOf(best['user'])['first_name']) ?? text(mapOf(best['user'])['name']) ?? ''}),
              style: display(32, color: Colors.white),
            ),
            const SizedBox(height: 8),
            Text(tr('{count} повідомлень на двох', {'count': _num(intOf(best['messages']))}), style: body(17, color: Colors.white70)),
          ] else
            _Big(value: messages, label: _n(messages, tr('повідомлення'), tr('повідомлення'), tr('повідомлень'))),
          const SizedBox(height: 22),
          _Stats([
            (intOf(social['new_friends']), tr('нових друзів')),
            (messages, tr('повідомлень надіслано')),
            if (intOf(social['call_minutes']) > 0) (intOf(social['call_minutes']), tr('хвилин у дзвінках')),
            if (intOf(social['profile_visitors']) > 0) (intOf(social['profile_visitors']), tr('гостей профілю')),
          ]),
        ]),
      ));
    }

    final plays = intOf(music['plays']);
    if (plays > 0 || intOf(music['added']) > 0) {
      final tracks = maps(music['top_tracks']);
      final artist = music['top_artist'] is Map ? mapOf(music['top_artist']) : null;
      slides.add((
        key: 'music',
        build: (_) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _Kicker(LucideIcons.music2, tr('Музика')),
          const SizedBox(height: 22),
          _Big(value: plays, label: _n(plays, tr('прослуховування'), tr('прослуховування'), tr('прослуховувань'))),
          if (artist != null) ...[
            const SizedBox(height: 18),
            Text(tr('Твій виконавець року'), style: body(16, color: Colors.white70)),
            Text(text(artist['name']) ?? '', style: display(28, color: Colors.white)),
          ],
          const SizedBox(height: 16),
          for (var i = 0; i < tracks.length; i++)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(children: [
                SizedBox(width: 22, child: Text('${i + 1}', textAlign: TextAlign.right, style: display(17, color: Colors.white54))),
                const SizedBox(width: 12),
                _Cover(url: text(tracks[i]['cover_url']), size: 46, radius: 10),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    FitText(text(tracks[i]['title']) ?? '', style: body(15, color: Colors.white, weight: FontWeight.w600)),
                    FitText(text(tracks[i]['artist']) ?? '', style: body(13, color: Colors.white60)),
                  ]),
                ),
                Text('×${intOf(tracks[i]['plays'])}', style: body(13, color: Colors.white60)),
              ]),
            ),
        ]),
      ));
    }

    final watched = intOf(cinema['watched']);
    if (watched > 0) {
      final favorites = maps(cinema['favorites']);
      slides.add((
        key: 'cinema',
        build: (_) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _Kicker(LucideIcons.clapperboard, tr('Кіно')),
          const SizedBox(height: 24),
          _Big(value: watched, label: _n(watched, tr('фільм чи серіал переглянуто'), tr('фільми й серіали переглянуто'), tr('фільмів і серіалів переглянуто'))),
          const SizedBox(height: 22),
          _Posters(items: [for (final m in favorites) (text(m['poster']), text(m['title']) ?? '')], ratio: 2 / 3),
          if (intOf(cinema['watch_parties']) > 0) ...[
            const SizedBox(height: 18),
            _Stats([(intOf(cinema['watch_parties']), tr('спільних переглядів з друзями'))]),
          ],
        ]),
      ));
    }

    final playDays = intOf(games['play_days']);
    if (playDays > 0 || intOf(games['votes']) > 0 || intOf(games['moments']) > 0) {
      final server = games['top_server'] is Map ? mapOf(games['top_server']) : null;
      slides.add((
        key: 'games',
        build: (_) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _Kicker(LucideIcons.gamepad2, tr('Ігри')),
          const SizedBox(height: 24),
          if (playDays > 0) _Big(value: playDays, label: _n(playDays, tr('ігровий день'), tr('ігрові дні'), tr('ігрових днів'))),
          const SizedBox(height: 22),
          _Posters(items: [for (final g in maps(games['top_games'])) (text(g['cover']), text(g['name']) ?? '')], ratio: 3 / 4),
          if (server != null) ...[
            const SizedBox(height: 16),
            _Panel(
              child: Row(children: [
                _Cover(url: text(server['icon']), size: 44, radius: 12),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(tr('Сервер року'), style: body(13, color: Colors.white60)),
                    FitText(text(server['name']) ?? '', style: body(15, color: Colors.white, weight: FontWeight.w600)),
                  ]),
                ),
              ]),
            ),
          ],
          const SizedBox(height: 12),
          _Stats([
            if (intOf(games['votes']) > 0) (intOf(games['votes']), tr('голосів за сервер')),
            if (intOf(games['moments']) > 0) (intOf(games['moments']), tr('моментів')),
          ]),
        ]),
      ));
    }

    final xp = intOf(progress['xp']);
    if (xp > 0) {
      slides.add((
        key: 'progress',
        build: (_) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _Kicker(LucideIcons.trophy, tr('Завдання')),
          const SizedBox(height: 24),
          _Big(value: xp, label: tr('досвіду зароблено')),
          const SizedBox(height: 22),
          _Stats([(intOf(progress['quests']), tr('щоденних завдань виконано'))]),
        ]),
      ));
    }

    slides.add((
      key: 'persona',
      build: (_) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr('Твій {year} — це…', {'year': year}), style: body(18, color: Colors.white70)),
        const SizedBox(height: 10),
        Text(persona.$1, style: display(52, color: Colors.white)),
        const SizedBox(height: 14),
        Text(persona.$2, style: body(19, color: Colors.white.withValues(alpha: 0.8))),
      ]),
    ));

    slides.add((
      key: 'summary',
      build: (context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _Panel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              _avatar(user, 52),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  FitText(text(user['name']) ?? '', style: body(16, color: Colors.white, weight: FontWeight.w600)),
                  Text('${persona.$1} · $year', style: body(13.5, color: Colors.white60)),
                ]),
              ),
            ]),
            const SizedBox(height: 16),
            _Stats([
              if (activeDays > 0) (activeDays, _n(activeDays, tr('день з GameCon'), tr('дні з GameCon'), tr('днів з GameCon'))),
              if (postCount > 0) (postCount, _n(postCount, tr('пост'), tr('пости'), tr('постів'))),
              if (plays > 0) (plays, _n(plays, tr('прослуховування'), tr('прослуховування'), tr('прослуховувань'))),
              if (playDays > 0) (playDays, _n(playDays, tr('ігровий день'), tr('ігрові дні'), tr('ігрових днів'))),
            ], plain: true),
          ]),
        ),
        const SizedBox(height: 18),
        _Button(
          label: tr('Поділитися'),
          icon: LucideIcons.share2,
          light: true,
          busy: sharing,
          onTap: () => unawaited(_shareImage()),
        ),
        const SizedBox(height: 10),
        _Button(label: tr('До стрічки'), icon: LucideIcons.messageCircle, onTap: widget.onClose),
      ]),
    ));

    return slides;
  }
}

Widget _avatar(Map<String, dynamic> user, double size) => Avatar(name: text(user['name']) ?? '', url: text(user['avatar_url']), size: size);

class _Kicker extends StatelessWidget {
  const _Kicker(this.icon, this.label);
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Row(children: [
        Icon(icon, size: 16, color: Colors.white70),
        const SizedBox(width: 8),
        Text(label, style: body(14, color: Colors.white70, weight: FontWeight.w500)),
      ]);
}

/// Число, що набігає від нуля (без анімацій — одразу кінцеве).
class _Big extends StatelessWidget {
  const _Big({required this.value, required this.label});
  final int value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.disableAnimationsOf(context);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      TweenAnimationBuilder<double>(
        tween: Tween(begin: reduce ? value.toDouble() : 0, end: value.toDouble()),
        duration: reduce ? Duration.zero : const Duration(milliseconds: 1200),
        curve: const Cubic(0.22, 1, 0.36, 1),
        builder: (_, v, _) => Text(_num(v.round()), style: display(60, color: Colors.white).copyWith(height: 1)),
      ),
      const SizedBox(height: 8),
      Text(label, style: body(18, color: Colors.white.withValues(alpha: 0.75))),
    ]);
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
        ),
        child: child,
      );
}

class _Stats extends StatelessWidget {
  const _Stats(this.items, {this.plain = false});
  final List<(int, String)> items;
  final bool plain;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (_, box) {
        final width = (box.maxWidth - 12) / 2;
        return Wrap(spacing: 12, runSpacing: 12, children: [
          for (final (value, label) in items)
            Container(
              width: width,
              padding: plain ? EdgeInsets.zero : const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: plain
                  ? null
                  : BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
                    ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(_num(value), style: display(24, color: Colors.white)),
                Text(label, style: body(13, color: Colors.white.withValues(alpha: 0.65))),
              ]),
            ),
        ]);
      },
    );
  }
}

class _Cover extends StatelessWidget {
  const _Cover({required this.url, required this.size, required this.radius});
  final String? url;
  final double size;
  final double radius;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: SizedBox.square(
          dimension: size,
          child: url == null
              ? ColoredBox(color: Colors.white.withValues(alpha: 0.1), child: const Icon(LucideIcons.music2, size: 18, color: Colors.white54))
              : NetImage(url!, fit: BoxFit.cover),
        ),
      );
}

class _Posters extends StatelessWidget {
  const _Posters({required this.items, required this.ratio});
  final List<(String?, String)> items;
  final double ratio;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      for (var i = 0; i < 3; i++) ...[
        if (i > 0) const SizedBox(width: 12),
        Expanded(
          child: i >= items.length
              ? const SizedBox.shrink()
              : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  AspectRatio(
                    aspectRatio: ratio,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: items[i].$1 == null
                          ? ColoredBox(color: Colors.white.withValues(alpha: 0.1), child: const Icon(LucideIcons.image, color: Colors.white54))
                          : NetImage(items[i].$1!, fit: BoxFit.cover),
                    ),
                  ),
                  const SizedBox(height: 6),
                  FitText(items[i].$2, style: body(13, color: Colors.white.withValues(alpha: 0.8)), maxLines: 2),
                ]),
        ),
      ],
    ]);
  }
}

/// Банер у стрічці в сезон «Підсумків року»; хрестик ховає до наступного року.
class WrappedBanner extends StatefulWidget {
  const WrappedBanner({required this.year, super.key});
  final int year;

  @override
  State<WrappedBanner> createState() => _WrappedBannerState();
}

class _WrappedBannerState extends State<WrappedBanner> {
  String get _key => 'wrapped_hidden_${widget.year}';

  @override
  Widget build(BuildContext context) {
    final prefs = AppScope.of(context).session.prefs;
    if (prefs.getBool(_key) == true) return const SizedBox.shrink();
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: Stack(children: [
        const Positioned.fill(child: _Backdrop(tone: 0)),
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => context.push('/wrapped'),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 48, 16),
              child: Row(children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(16)),
                  child: const Icon(LucideIcons.sparkles, color: Colors.white),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(tr('Твій {year} у GameCon', {'year': widget.year}), style: display(18, color: Colors.white)),
                    const SizedBox(height: 2),
                    Text(tr('Підсумки року готові — подивися й поділися з друзями.'), style: body(13.5, color: Colors.white70)),
                  ]),
                ),
              ]),
            ),
          ),
        ),
        Positioned(
          top: 4,
          right: 4,
          child: IconButton(
            tooltip: tr('Сховати'),
            icon: const Icon(LucideIcons.x, size: 18, color: Colors.white70),
            onPressed: () async {
              await prefs.setBool(_key, true);
              if (mounted) setState(() {});
            },
          ),
        ),
      ]),
    );
  }
}
