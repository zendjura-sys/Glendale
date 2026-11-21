import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'photos.dart';
import 'skeletons.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Галерея скриншотів гравців: публічні фото з позначкою гри.
/// Ті самі дані, що `GET /screenshots` на сайті (фільтр гри, «нові» / «популярні», сторінки).
class ScreenshotsScreen extends StatefulWidget {
  const ScreenshotsScreen({this.game, this.sort, this.page, super.key});

  /// Слаг гри з `?game=` — як посилання зі сторінки гри.
  final String? game;
  final String? sort;
  final int? page;

  @override
  State<ScreenshotsScreen> createState() => _ScreenshotsScreenState();
}

class _ScreenshotsScreenState extends State<ScreenshotsScreen> {
  final scroll = ScrollController();
  final photos = <Map<String, dynamic>>[];
  List<Map<String, dynamic>> games = const [];
  Map<String, dynamic>? game;
  bool more = false;
  bool ready = false;
  late int page = widget.page != null && widget.page! > 0 ? widget.page! : 1;
  Object? error;
  int _gen = 0;

  late String? gameSlug = text(widget.game);
  late String sort = widget.sort == 'top' ? 'top' : 'new';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    scroll.dispose();
    super.dispose();
  }

  String _path(int target) {
    final params = <String, String>{
      'game': ?gameSlug,
      if (sort == 'top') 'sort': 'top',
      if (target > 1) 'page': '$target',
    };
    if (params.isEmpty) return '/screenshots';
    return Uri(path: '/screenshots', queryParameters: params).toString();
  }

  Future<void> _load({int? page, bool refresh = false}) async {
    final target = page ?? this.page;
    final token = ++_gen;
    if (!refresh && mounted) {
      setState(() {
        error = null;
        ready = false;
        photos.clear();
      });
    }
    try {
      final data = await AppScope.read(context).session.api.get(Api.site(_path(target)));
      if (!mounted || token != _gen) return;
      final filters = mapOf(data['filters']);
      setState(() {
        photos
          ..clear()
          ..addAll(maps(data['photos']));
        games = maps(data['games']);
        game = data['game'] is Map ? mapOf(data['game']) : null;
        more = data['more'] == true;
        this.page = intOf(filters['page'], target);
        ready = true;
        error = null;
      });
      if (!refresh) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (scroll.hasClients) scroll.jumpTo(0);
        });
      }
    } catch (e) {
      if (!mounted || token != _gen) return;
      if (photos.isEmpty) {
        setState(() {
          ready = true;
          error = e;
        });
      } else {
        toast(context, e);
      }
    }
  }

  void _setSort(String value) {
    if (value == sort) return;
    setState(() => sort = value);
    _load(page: 1);
  }

  void _setGame(String? slug) {
    if (slug == gameSlug) return;
    setState(() {
      gameSlug = slug;
      game = slug == null ? null : games.where((g) => g['slug'] == slug).firstOrNull;
    });
    _load(page: 1);
  }

  String get _title {
    final name = text(game?['name']);
    if (name != null) return tr('Скриншоти · {game}', {'game': name});
    return tr('Скриншоти');
  }

  @override
  Widget build(BuildContext context) {
    final chips = [...games];
    final current = text(game?['slug']);
    if (current != null && !chips.any((g) => g['slug'] == current)) {
      chips.insert(0, {'slug': current, 'name': game!['name']});
    }

    return ScreenScroll(
      controller: scroll,
      onRefresh: () => _load(refresh: true),
      children: [
        Glass(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Icon(LucideIcons.images, size: 22, color: Color(0xFF38BDF8)),
              const SizedBox(width: 8),
              Expanded(child: Text(_title, style: display(20))),
            ]),
            const SizedBox(height: 6),
            Text(
              tr('Кадри гравців з публічних альбомів. Щоб ваш скриншот з’явився тут — оберіть гру для альбому чи фото.'),
              style: body(13, color: muted).copyWith(height: 1.4),
            ),
            const SizedBox(height: 4),
            GestureDetector(
              onTap: () => context.push('/photos'),
              child: Text(tr('Мої фото'), style: body(13.5, color: const Color(0xFF38BDF8), weight: FontWeight.w700)),
            ),
            const SizedBox(height: 14),
            Segmented(
              options: [
                SegmentOption('new', tr('Нові'), icon: LucideIcons.sparkles),
                SegmentOption('top', tr('Популярні'), icon: LucideIcons.flame),
              ],
              selected: sort,
              onSelect: _setSort,
            ),
            if (chips.isNotEmpty) ...[
              const SizedBox(height: 12),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(children: [
                  SelectPill(label: tr('Усі ігри'), selected: gameSlug == null, onTap: () => _setGame(null)),
                  for (final g in chips)
                    Padding(
                      padding: const EdgeInsets.only(left: 6),
                      child: SelectPill(
                        label: g['total'] == null ? (text(g['name']) ?? '') : '${text(g['name'])}  ${g['total']}',
                        icon: LucideIcons.gamepad2,
                        selected: gameSlug == g['slug'],
                        onTap: () => _setGame(text(g['slug'])),
                      ),
                    ),
                ]),
              ),
            ],
          ]),
        ),
        const SizedBox(height: 12),
        if (!ready && error == null)
          const GridSkeleton(count: 6, aspect: 1)
        else if (error != null && photos.isEmpty)
          EmptyState(icon: LucideIcons.images, title: tr('Скриншоти недоступні'), text: '$error')
        else if (photos.isEmpty)
          EmptyState(
            icon: LucideIcons.images,
            title: tr('Скриншотів ще немає'),
            text: tr('Створіть альбом, оберіть для нього гру й завантажте кадри — вони з’являться тут.'),
          )
        else
          _ShotMasonry(
            photos: photos,
            onOpen: (i) => openPhoto(context, photos, i, onChanged: () => _load(refresh: true)),
          ),
        if (page > 1 || more) ...[
          const SizedBox(height: 14),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            if (page > 1) GhostButton(label: tr('Назад'), expand: false, compact: true, onPressed: () => _load(page: page - 1)),
            if (page > 1 && more) const SizedBox(width: 8),
            if (more) GhostButton(label: tr('Далі'), expand: false, compact: true, onPressed: () => _load(page: page + 1)),
          ]),
        ],
      ],
    );
  }
}

/// Дві (на широкому екрані — три) колонки різної висоти, як `columns-2` на сайті.
class _ShotMasonry extends StatelessWidget {
  const _ShotMasonry({required this.photos, required this.onOpen});
  final List<Map<String, dynamic>> photos;
  final ValueChanged<int> onOpen;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final cols = constraints.maxWidth >= 720 ? 3 : 2;
      final buckets = List.generate(cols, (_) => <Widget>[]);
      final heights = List<double>.filled(cols, 0);
      for (var i = 0; i < photos.length; i++) {
        final shot = photos[i];
        final w = intOf(shot['width']);
        final h = intOf(shot['height']);
        final ratio = (w > 0 && h > 0 ? w / h : 4 / 3).clamp(0.55, 1.9);
        var col = 0;
        for (var c = 1; c < cols; c++) {
          if (heights[c] < heights[col]) col = c;
        }
        heights[col] += 1 / ratio;
        buckets[col].add(_ShotTile(photo: shot, ratio: ratio, onTap: () => onOpen(i)));
      }
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var c = 0; c < cols; c++) ...[
            if (c > 0) const SizedBox(width: 10),
            Expanded(child: Column(children: buckets[c])),
          ],
        ],
      );
    });
  }
}

class _ShotTile extends StatelessWidget {
  const _ShotTile({required this.photo, required this.ratio, required this.onTap});
  final Map<String, dynamic> photo;
  final double ratio;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final game = mapOf(photo['game']);
    final user = mapOf(photo['user']);
    final caption = [
      if (text(game['name']) != null) text(game['name'])!,
      if (text(user['name']) != null) text(user['name'])!,
    ].join(' · ');
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Semantics(
        button: true,
        label: text(photo['alt']) ?? (caption.isEmpty ? tr('Скриншоти') : caption),
        child: GestureDetector(
          onTap: onTap,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Stack(children: [
              AspectRatio(aspectRatio: ratio, child: NetImage(text(photo['url']), width: double.infinity, height: double.infinity)),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.transparent, Color(0xBF000000)],
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(10, 18, 10, 8),
                    child: Row(children: [
                      Expanded(
                        child: Text(caption, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(11, color: Colors.white)),
                      ),
                      const Icon(LucideIcons.heart, size: 12, color: Colors.white),
                      const SizedBox(width: 3),
                      Text(compact(photo['likes_count']), style: body(11, color: Colors.white)),
                    ]),
                  ),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
