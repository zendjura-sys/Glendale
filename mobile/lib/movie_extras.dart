import 'dart:async';

import 'package:flutter/material.dart';

import 'core/widgets/arctic_glass/arctic_fit_text.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'api.dart';
import 'cinema.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Кіно: рецензії (зі спойлерами під розмиттям), добірки фільмів і пісня профілю — як на сайті.

class ReviewTile extends StatefulWidget {
  const ReviewTile({required this.review, this.showMovie = false, this.onDelete, super.key});
  final Map<String, dynamic> review;
  final bool showMovie;
  final VoidCallback? onDelete;

  @override
  State<ReviewTile> createState() => _ReviewTileState();
}

class _ReviewTileState extends State<ReviewTile> {
  late bool open = widget.review['spoiler'] != true || widget.review['mine'] == true;
  late bool liked = widget.review['liked'] == true;
  late int likes = intOf(widget.review['likes_count']);

  Future<void> _like() async {
    try {
      final d = await AppScope.read(context).session.api.post(Api.site('/cinema/reviews/${widget.review['id']}/like'), {});
      if (!mounted) return;
      setState(() {
        liked = d['liked'] == true;
        likes = intOf(d['likes_count']);
      });
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.review;
    final user = mapOf(r['user']);
    final movie = mapOf(r['movie']);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Glass(
        padding: const EdgeInsets.all(14),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (widget.showMovie && movie.isNotEmpty) ...[
            GestureDetector(
              onTap: () => context.push('/cinema/${movie['slug']}'),
              child: SizedBox(width: 56, height: 84, child: NetImage(text(movie['poster']), radius: 10)),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Avatar(name: text(user['name']) ?? '', url: text(user['avatar_url']), size: 30),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    FitText(text(user['name']) ?? '', style: body(13.5, weight: FontWeight.w600)),
                    if (widget.showMovie && movie.isNotEmpty) FitText(text(movie['title']) ?? '', style: body(12, color: muted)),
                  ]),
                ),
                Pill(label: '${r['score']}/10', icon: LucideIcons.star, color: const Color(0xFFFDE68A), background: const Color(0x33FBBF24)),
              ]),
              const SizedBox(height: 10),
              if (open)
                Text(text(r['body']) ?? '', style: body(14, color: soft).copyWith(height: 1.45))
              else
                GestureDetector(
                  onTap: () => setState(() => open = true),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    decoration: BoxDecoration(color: fg.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(12)),
                    child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(LucideIcons.eye, size: 16, color: soft),
                      const SizedBox(width: 6),
                      Text(tr('Спойлер — показати'), style: body(13, color: soft, weight: FontWeight.w600)),
                    ]),
                  ),
                ),
              const SizedBox(height: 8),
              Row(children: [
                InkWell(
                  onTap: r['mine'] == true ? null : _like,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(children: [
                      Icon(LucideIcons.heart, size: 16, color: liked ? const Color(0xFFFDA4AF) : muted),
                      const SizedBox(width: 4),
                      Text('$likes', style: body(12.5, color: liked ? const Color(0xFFFDA4AF) : muted)),
                    ]),
                  ),
                ),
                const Spacer(),
                if (r['mine'] == true && widget.onDelete != null)
                  TextButton.icon(onPressed: widget.onDelete, icon: const Icon(LucideIcons.trash2, size: 15), label: Text(tr('Видалити'))),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }
}

class MovieReviewsSection extends StatefulWidget {
  const MovieReviewsSection({required this.slug, super.key});
  final String slug;

  @override
  State<MovieReviewsSection> createState() => _MovieReviewsSectionState();
}

class _MovieReviewsSectionState extends State<MovieReviewsSection> {
  Map<String, dynamic>? data;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final d = await AppScope.read(context).session.api.get(Api.site('/cinema/${widget.slug}/reviews'));
      if (mounted) setState(() => data = d);
    } catch (_) {}
  }

  Future<void> _write() async {
    final mine = mapOf(data?['mine']);
    final note = TextEditingController(text: text(mine['body']) ?? '');
    var score = mine['score'] == null ? 8.0 : intOf(mine['score']).toDouble();
    var spoiler = mine['spoiler'] == true;
    final criteria = <String, int>{for (final e in mapOf(mine['criteria']).entries) e.key: intOf(e.value)};
    final saved = await showGcSheet<bool>(
      context,
      title: mine.isEmpty ? tr('Написати рецензію') : tr('Змінити мою'),
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheet) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Text(tr('Оцінка'), style: body(14)),
              Expanded(child: Slider(value: score, min: 1, max: 10, divisions: 9, label: '${score.round()}', onChanged: (v) => setSheet(() => score = v))),
              Text('${score.round()}/10', style: body(14, weight: FontWeight.w600)),
            ]),
            CriteriaSliders(
              labels: {'story': tr('Сюжет'), 'visuals': tr('Картинка'), 'sound': tr('Звук'), 'acting': tr('Акторська гра')},
              values: criteria,
              onChanged: (k, v) => setSheet(() => criteria[k] = v),
            ),
            const SizedBox(height: 6),
            GcField(controller: note, label: tr('Що сподобалось, що ні, кому радите…'), maxLines: 8, minLines: 4),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: spoiler,
              onChanged: (v) => setSheet(() => spoiler = v),
              title: Text(tr('Є спойлери — сховати текст'), style: body(14)),
            ),
            PrimaryButton(
              label: tr('Опублікувати'),
              onPressed: () async {
                try {
                  await AppScope.read(sheet).session.api.post(Api.site('/cinema/${widget.slug}/reviews'), {'body': note.text, 'score': score.round(), 'spoiler': spoiler, 'criteria': {for (final e in criteria.entries) if (e.value > 0) e.key: e.value}});
                  if (sheet.mounted) Navigator.of(sheet).pop(true);
                } catch (e) {
                  if (sheet.mounted) toast(sheet, e);
                }
              },
            ),
          ]),
        ),
      ),
    );
    if (saved == true) {
      if (mounted) toast(context, tr('Рецензію опубліковано.'));
      await _load();
    }
  }

  Future<void> _delete() async {
    try {
      await AppScope.read(context).session.api.delete(Api.site('/cinema/${widget.slug}/reviews'));
      await _load();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    final summary = mapOf(d?['summary']);
    final reviews = maps(mapOf(d?['reviews'])['data']);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Text(tr('Рецензії'), style: display(20)),
          if (intOf(summary['count']) > 0) ...[
            const SizedBox(width: 8),
            Icon(LucideIcons.star, size: 14, color: const Color(0xFFFDE68A)),
            const SizedBox(width: 3),
            Text('${summary['average']} · ${summary['count']}', style: body(13, color: muted)),
          ],
          const Spacer(),
          TextButton(onPressed: _write, child: Text(d?['mine'] is Map ? tr('Змінити мою') : tr('Написати рецензію'))),
        ]),
        const SizedBox(height: 6),
        if (d != null && reviews.isEmpty) Text(tr('Рецензій ще немає — будьте першими.'), style: body(13.5, color: muted)),
        for (final r in reviews) ReviewTile(review: r, onDelete: _delete),
      ]),
    );
  }
}

/// «У добірку»: шторка з моїми добірками, позначкою «тут уже є» і створенням нової.
Future<void> showAddToList(BuildContext context, int movieId, String slug) async {
  final api = AppScope.read(context).session.api;
  List<Map<String, dynamic>> lists;
  try {
    lists = maps((await api.get(Api.site('/cinema/$slug/lists')))['lists']);
  } catch (e) {
    if (context.mounted) toast(context, e);
    return;
  }
  if (!context.mounted) return;
  final title = TextEditingController();
  var isPublic = true;
  await showGcSheet<void>(
    context,
    title: tr('Додати в добірку'),
    builder: (sheet) => StatefulBuilder(
      builder: (sheet, setSheet) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          for (final l in lists)
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: l['contains'] == true,
              title: Text(text(l['title']) ?? '', style: body(14.5)),
              subtitle: Text('${l['items_count']}${l['is_public'] == true ? '' : ' · ${tr('лише для мене')}'}', style: body(12, color: muted)),
              onChanged: (v) async {
                try {
                  await api.post(Api.site('/cinema/lists/${l['id']}/items'), {'movie': movieId, 'on': v == true});
                  setSheet(() {
                    l['contains'] = v == true;
                    l['items_count'] = intOf(l['items_count']) + (v == true ? 1 : -1);
                  });
                } catch (e) {
                  if (sheet.mounted) toast(sheet, e);
                }
              },
            ),
          const SizedBox(height: 8),
          GcField(controller: title, label: tr('Нова добірка, напр. «Хорори на вечір»'), icon: LucideIcons.listPlus),
          SwitchListTile(contentPadding: EdgeInsets.zero, value: isPublic, onChanged: (v) => setSheet(() => isPublic = v), title: Text(tr('Видно всім'), style: body(14))),
          PrimaryButton(
            label: tr('Створити'),
            icon: LucideIcons.plus,
            onPressed: () async {
              if (title.text.trim().length < 2) return;
              try {
                await api.post(Api.site('/cinema/lists'), {'title': title.text.trim(), 'is_public': isPublic, 'movie': movieId});
                final fresh = maps((await api.get(Api.site('/cinema/$slug/lists')))['lists']);
                title.clear();
                setSheet(() => lists = fresh);
              } catch (e) {
                if (sheet.mounted) toast(sheet, e);
              }
            },
          ),
        ]),
      ),
    ),
  );
}

class _ListTile extends StatelessWidget {
  const _ListTile({required this.list});
  final Map<String, dynamic> list;

  @override
  Widget build(BuildContext context) {
    final posters = (list['posters'] as List?)?.map((e) => '$e').toList() ?? const <String>[];
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Glass(
        padding: EdgeInsets.zero,
        onTap: () => context.push('/cinema/lists/${list['id']}'),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
            child: AspectRatio(
              aspectRatio: 3,
              child: Row(children: [
                for (var i = 0; i < 4; i++)
                  Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(right: i < 3 ? 2 : 0),
                      child: i < posters.length ? NetImage(posters[i]) : Container(color: fg.withValues(alpha: 0.05)),
                    ),
                  ),
              ]),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                if (list['is_public'] != true) Padding(padding: const EdgeInsets.only(right: 6), child: Icon(LucideIcons.lock, size: 14, color: muted)),
                Expanded(child: FitText(text(list['title']) ?? '', style: body(15.5, weight: FontWeight.w700))),
              ]),
              const SizedBox(height: 2),
              Text('${text(mapOf(list['user'])['name']) ?? ''} · ${tr('{n} тайтлів', {'n': '${list['items_count']}'})}', style: body(12.5, color: muted)),
              const SizedBox(height: 6),
              Row(children: [
                Icon(LucideIcons.heart, size: 14, color: muted),
                const SizedBox(width: 4),
                Text('${list['likes_count']}', style: body(12, color: muted)),
                const SizedBox(width: 12),
                Icon(LucideIcons.users, size: 14, color: muted),
                const SizedBox(width: 4),
                Text('${list['followers_count']}', style: body(12, color: muted)),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }
}

class MovieListsScreen extends StatefulWidget {
  const MovieListsScreen({super.key});

  @override
  State<MovieListsScreen> createState() => _MovieListsScreenState();
}

class _MovieListsScreenState extends State<MovieListsScreen> {
  String tab = 'popular';

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      watch: tab,
      load: () => api.get(Api.site('/cinema/lists?tab=$tab')),
      builder: (d, reload) {
        final lists = maps(mapOf(d['lists'])['data']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Добірки фільмів'), subtitle: tr('Списки від людей: збирайте свої на сторінці фільму кнопкою «У добірку».')),
            Segmented(
              options: [SegmentOption('popular', tr('Популярні')), SegmentOption('mine', tr('Мої')), SegmentOption('following', tr('Стежу'))],
              selected: tab,
              onSelect: (v) => setState(() => tab = v),
            ),
            const SizedBox(height: 12),
            if (lists.isEmpty) EmptyState(icon: LucideIcons.listVideo, title: tab == 'mine' ? tr('У вас ще немає добірок') : tr('Добірок поки немає')),
            for (final l in lists) _ListTile(list: l),
          ],
        );
      },
    );
  }
}

class MovieListScreen extends StatelessWidget {
  const MovieListScreen({required this.id, super.key});
  final int id;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/cinema/lists/$id')),
      builder: (d, reload) {
        final list = mapOf(d['list']);
        final movies = maps(d['movies']);
        final mine = list['mine'] == true;
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(text(list['title']) ?? '', subtitle: text(list['description'])),
            Text(text(mapOf(list['user'])['name']) ?? '', style: body(13, color: muted)),
            const SizedBox(height: 12),
            if (!mine)
              Row(children: [
                Expanded(
                  child: GhostButton(
                    label: '${list['likes_count']}',
                    icon: LucideIcons.heart,
                    iconColor: list['liked'] == true ? const Color(0xFFFDA4AF) : null,
                    onPressed: () async {
                      try {
                        await api.post(Api.site('/cinema/lists/$id/like'), {});
                        await reload();
                      } catch (e) {
                        if (context.mounted) toast(context, e);
                      }
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: PrimaryButton(
                    label: list['following'] == true ? tr('Стежу · {n}', {'n': '${list['followers_count']}'}) : tr('Стежити'),
                    icon: LucideIcons.userPlus,
                    onPressed: () async {
                      try {
                        await api.post(Api.site('/cinema/lists/$id/follow'), {});
                        await reload();
                      } catch (e) {
                        if (context.mounted) toast(context, e);
                      }
                    },
                  ),
                ),
              ]),
            const SizedBox(height: 14),
            if (movies.isEmpty) EmptyState(icon: LucideIcons.listVideo, title: tr('Добірка порожня'), text: tr('Додайте тайтли кнопкою «У добірку» на сторінці фільму.')),
            GridView.count(
              crossAxisCount: 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 10,
              childAspectRatio: 0.52,
              children: [for (final m in movies) PosterCard(movie: m)],
            ),
          ],
        );
      },
    );
  }
}

class MovieReviewsFeedScreen extends StatefulWidget {
  const MovieReviewsFeedScreen({super.key});

  @override
  State<MovieReviewsFeedScreen> createState() => _MovieReviewsFeedScreenState();
}

class _MovieReviewsFeedScreenState extends State<MovieReviewsFeedScreen> {
  String tab = 'friends';

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      watch: tab,
      load: () => api.get(Api.site('/cinema/reviews?tab=$tab')),
      builder: (d, reload) {
        final reviews = maps(mapOf(d['reviews'])['data']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Рецензії'), subtitle: tr('Що думають про фільми й серіали ваші друзі та спільнота.')),
            Segmented(
              options: [SegmentOption('friends', tr('Друзі')), SegmentOption('all', tr('Усі'))],
              selected: tab,
              onSelect: (v) => setState(() => tab = v),
            ),
            const SizedBox(height: 12),
            if (reviews.isEmpty) EmptyState(icon: LucideIcons.messageSquareQuote, title: tab == 'friends' ? tr('Друзі ще не писали рецензій') : tr('Рецензій поки немає')),
            for (final r in reviews) ReviewTile(review: r, showMovie: true),
          ],
        );
      },
    );
  }
}

/// Пісня профілю: дотик — слухати (без автозапуску); власник обирає зі своєї медіатеки.
class ProfileTrackPanel extends StatelessWidget {
  const ProfileTrackPanel({required this.track, required this.isSelf, required this.onSaved, super.key});
  final Map<String, dynamic>? track;
  final bool isSelf;
  final VoidCallback onSaved;

  Future<void> _pick(BuildContext context) async {
    final api = AppScope.read(context).session.api;
    final search = TextEditingController();
    List<Map<String, dynamic>>? tracks;
    Timer? debounce;
    Future<void> load(void Function(void Function()) setSheet) async {
      try {
        final d = await api.get(Api.site('/settings/profile-track?q=${Uri.encodeQueryComponent(search.text)}'));
        setSheet(() => tracks = maps(d['tracks']));
      } catch (_) {
        setSheet(() => tracks = []);
      }
    }

    final saved = await showGcSheet<bool>(
      context,
      title: tr('Пісня профілю'),
      subtitle: tr('Зі своїх треків і медіатеки. Сама не вмикається — лише після натискання.'),
      builder: (sheet) => StatefulBuilder(builder: (sheet, setSheet) {
        if (tracks == null) unawaited(load(setSheet));
        Future<void> save(int? id) async {
          try {
            await api.put(Api.site('/settings/profile-track'), {'track_id': id});
            if (sheet.mounted) Navigator.of(sheet).pop(true);
          } catch (e) {
            if (sheet.mounted) toast(sheet, e);
          }
        }

        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            GcField(
              controller: search,
              label: tr('Назва чи виконавець'),
              icon: LucideIcons.search,
              onChanged: (_) {
                debounce?.cancel();
                debounce = Timer(const Duration(milliseconds: 300), () => load(setSheet));
              },
            ),
            const SizedBox(height: 6),
            if (tracks?.isEmpty == true) Padding(padding: const EdgeInsets.all(20), child: Text(tr('У медіатеці нічого не знайдено.'), textAlign: TextAlign.center, style: body(13, color: muted))),
            for (final t in tracks ?? const <Map<String, dynamic>>[])
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: SizedBox(width: 42, height: 42, child: NetImage(text(t['cover_url']), radius: 10)),
                title: FitText(text(t['title']) ?? '', style: body(14.5, weight: FontWeight.w600)),
                subtitle: FitText(text(t['artist']) ?? '', style: body(12.5, color: muted)),
                trailing: track?['id'] == t['id'] ? Icon(LucideIcons.check, color: primary) : null,
                onTap: () => save(intOf(t['id'])),
              ),
            if (track != null) TextButton.icon(onPressed: () => save(null), icon: const Icon(LucideIcons.x, size: 16), label: Text(tr('Прибрати пісню з профілю'))),
          ]),
        );
      }),
    );
    debounce?.cancel();
    if (saved == true) onSaved();
  }

  @override
  Widget build(BuildContext context) {
    final t = track;
    if (t == null && !isSelf) return const SizedBox.shrink();
    final player = AppScope.of(context).player;
    return Glass(
      padding: const EdgeInsets.all(14),
      onTap: t == null ? () => _pick(context) : () => player.playList([t], 0, extend: false),
      child: Row(children: [
        SizedBox(
          width: 52,
          height: 52,
          child: Stack(fit: StackFit.expand, children: [
            t == null
                ? Container(decoration: BoxDecoration(color: fg.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(12)), child: Icon(LucideIcons.music, color: muted))
                : NetImage(text(t['cover_url']), radius: 12),
            if (t != null)
              Container(
                decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.4), borderRadius: BorderRadius.circular(12)),
                child: const Icon(LucideIcons.play, color: Colors.white, size: 22),
              ),
          ]),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr('Пісня профілю'), style: body(12, color: muted)),
            FitText(t == null ? tr('Додайте пісню — гості послухають її одним натиском.') : text(t['title']) ?? '', style: body(14.5, weight: FontWeight.w600), maxLines: 2),
            if (t != null) FitText(text(t['artist']) ?? '', style: body(12.5, color: soft)),
          ]),
        ),
        if (isSelf && t != null) IconButton(onPressed: () => _pick(context), tooltip: tr('Змінити пісню'), icon: Icon(LucideIcons.pencil, size: 18, color: muted)),
      ]),
    );
  }
}
