import 'dart:async';
import 'dart:convert';
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import 'api.dart';
import 'cinema.dart' show PosterCard;
import 'i18n.dart';
import 'posts.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// Сторінка тайтлу в застосунку: велика обкладинка, статус, «Дивитися» → озвучка → серія → власна
// оболонка керування поверх плеєра балансера (Kodik / Videoseed через міст /play/embed).

typedef Pick = ({int season, int episode});
typedef Season = ({int number, List<int> episodes});

/// Адреса плеєра без власних перемикачів (як на сайті, episode-picker.tsx): серія й озвучка
/// обираються в застосунку. Kodik — hide_selectors + translations=false (лише з обраною серією або
/// для фільму); серія — season/episode + only_season/only_episode. Videoseed — video=sXvY&only=true.
String episodeUrl(String provider, String url, Pick? pick, {required bool bare}) {
  final uri = Uri.tryParse(url);
  if (uri == null) return url;
  final query = Map<String, String>.of(uri.queryParameters);
  if (provider == 'kodik' && bare) {
    query['hide_selectors'] = 'true';
    query['translations'] = 'false';
  }
  if (pick != null && provider == 'kodik') {
    query.addAll({'season': '${pick.season}', 'episode': '${pick.episode}', 'only_season': 'true', 'only_episode': 'true'});
  } else if (pick != null && provider == 'videoseed') {
    query.addAll({'video': 's${pick.season}v${pick.episode}', 'only': 'true'});
  }
  return query.isEmpty ? url : uri.replace(queryParameters: query).toString();
}

/// «12:07» / «1:02:07».
String clock(double seconds) {
  final total = seconds.isFinite && seconds > 0 ? seconds.floor() : 0;
  final h = total ~/ 3600;
  final m = (total % 3600) ~/ 60;
  final s = (total % 60).toString().padLeft(2, '0');
  return h > 0 ? '$h:${m.toString().padLeft(2, '0')}:$s' : '${m.toString().padLeft(2, '0')}:$s';
}

/// Локальна пам’ять перегляду: остання озвучка, остання серія й позиція в кожній серії.
class WatchMemory {
  WatchMemory(this.prefs, this.slug);
  final SharedPreferences prefs;
  final String slug;

  String? get voice => prefs.getString('cinema.voice.$slug');
  set voice(String? key) => key == null ? prefs.remove('cinema.voice.$slug') : prefs.setString('cinema.voice.$slug', key);

  Pick? get last {
    final raw = prefs.getString('cinema.last.$slug')?.split(':');
    if (raw == null || raw.length != 2) return null;
    final s = int.tryParse(raw[0]);
    final e = int.tryParse(raw[1]);
    return s == null || e == null ? null : (season: s, episode: e);
  }

  set last(Pick? pick) => pick == null ? prefs.remove('cinema.last.$slug') : prefs.setString('cinema.last.$slug', '${pick.season}:${pick.episode}');

  int position(Pick? pick) => prefs.getInt(_pos(pick)) ?? 0;
  void savePosition(Pick? pick, int seconds) => prefs.setInt(_pos(pick), seconds);
  String _pos(Pick? pick) => pick == null ? 'cinema.pos.$slug' : 'cinema.pos.$slug.${pick.season}.${pick.episode}';
}

const _statusColors = {'watching': green, 'planned': violet, 'watched': cyan, 'dropped': danger};

bool _episodic(Map<String, dynamic>? player) => const {'kodik', 'videoseed'}.contains(text(player?['provider']));

/// Серії озвучки: загальний список сезонів, а для односезонного тайтлу — не більше, ніж є в озвучці.
List<Season> voiceSeasons(List<Season> seasons, Map<String, dynamic> voice) {
  final count = intOf(voice['episodes']);
  // Сервер не віддав список серій — будуємо його з кількості серій в озвучці (Kodik last_episode).
  if (seasons.isEmpty && count > 1) return [(number: 1, episodes: [for (var e = 1; e <= count; e++) e])];
  if (count <= 0 || seasons.length != 1) return seasons;
  final only = seasons.first;
  final cut = only.episodes.where((e) => e <= count).toList();
  return cut.isEmpty ? seasons : [(number: only.number, episodes: cut)];
}

// ───────────────────────── Сторінка тайтлу ─────────────────────────

class MovieScreen extends StatefulWidget {
  const MovieScreen({required this.slug, this.autoplay = false, this.preview, super.key});
  final String slug;
  final bool autoplay;

  /// Дані сторінки без мережі — для тестів і прев’ю вигляду.
  @visibleForTesting
  final Map<String, dynamic>? preview;

  @override
  State<MovieScreen> createState() => _MovieScreenState();
}

class _MovieScreenState extends State<MovieScreen> {
  Map<String, dynamic>? data;
  Object? error;
  List<Season> seasons = const [];
  Set<String> marks = {};
  bool about = false;
  final commentsKey = GlobalKey();
  final scroll = ScrollController();

  @override
  void dispose() {
    scroll.dispose();
    super.dispose();
  }

  Api get api => AppScope.read(context).session.api;
  late final WatchMemory memory = WatchMemory(AppScope.read(context).session.prefs, widget.slug);

  @override
  void initState() {
    super.initState();
    if (widget.preview != null) {
      data = widget.preview;
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final result = await api.get(Api.site('/cinema/${widget.slug}'));
      if (!mounted) return;
      setState(() {
        data = result;
        error = null;
      });
      await _loadEpisodes();
      if (widget.autoplay && mounted) unawaited(_watch());
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  Future<void> _loadEpisodes() async {
    try {
      final result = await api.get(Api.site('/cinema/${widget.slug}/episodes'));
      if (!mounted) return;
      setState(() {
        seasons = [
          for (final s in maps(result['episodes']))
            (number: intOf(s['number']), episodes: [for (final e in (s['episodes'] as List? ?? const [])) intOf(e)]),
        ].where((s) => s.episodes.isNotEmpty).toList();
        marks = {for (final m in (result['marks'] as List? ?? const [])) '$m'};
        // Сервер щойно міг дотягнути нові озвучки — показуємо актуальний список.
        if (result['players'] is List && data != null) data!['players'] = result['players'];
      });
    } catch (_) {
      // Посерійний режим вимкнено або мережа — серії обираються в самому плеєрі.
    }
  }

  List<Map<String, dynamic>> get players => maps(data?['players']);

  Map<String, dynamic>? get voice {
    final list = players;
    if (list.isEmpty) return null;
    final key = memory.voice ?? text(_state['player_key']);
    return list.firstWhere((p) => text(p['key']) == key, orElse: () => list.first);
  }

  Map<String, dynamic> get _state => mapOf(data?['state']);

  /// Де зупинились (з акаунта — щоб продовжити з іншого пристрою).
  Pick? get _serverPick {
    final e = intOf(_state['episode']);
    return e > 0 ? (season: intOf(_state['season']) > 0 ? intOf(_state['season']) : 1, episode: e) : null;
  }

  /// Наступна серія: після останньої переглянутої (позначки) або остання відкрита.
  Pick? _continuePick(List<Season> list) {
    final all = [for (final s in list) for (final e in s.episodes) (season: s.number, episode: e)];
    if (all.isEmpty) return null;
    final last = memory.last ?? _serverPick;
    if (last != null && all.contains(last)) return last;
    var seen = -1;
    for (var i = 0; i < all.length; i++) {
      if (marks.contains('${all[i].season}:${all[i].episode}')) seen = i;
    }
    return all[(seen + 1).clamp(0, all.length - 1)];
  }

  /// «Дивитися»: озвучку вже обирали — одразу плеєр з тієї ж серії, інакше вибір озвучки.
  Future<void> _watch() async {
    final current = voice;
    if (current == null) return;
    if (memory.voice == null && text(_state['player_key']) == null) return _chooseVoice();
    final list = _episodic(current) ? voiceSeasons(seasons, current) : const <Season>[];
    await _open(current, list.isEmpty ? null : _continuePick(list));
  }

  Future<void> _chooseVoice() async {
    final picked = await Navigator.of(context, rootNavigator: true).push<Map<String, dynamic>>(MaterialPageRoute(
      builder: (_) => VoicePickerScreen(players: players, selected: text(voice?['key']), seasons: seasons),
    ));
    if (picked == null || !mounted) return;
    memory.voice = text(picked['key']);
    setState(() {});
    final list = _episodic(picked) ? voiceSeasons(seasons, picked) : const <Season>[];
    if (list.isEmpty) return _open(picked, null);
    final pick = await Navigator.of(context, rootNavigator: true).push<Pick>(MaterialPageRoute(
      builder: (_) => EpisodeListScreen(voice: picked, seasons: list, marks: marks, memory: memory, onToggle: _toggleMark),
    ));
    if (pick != null && mounted) await _open(picked, pick);
  }

  Future<void> _open(Map<String, dynamic> source, Pick? chosen) async {
    final movie = mapOf(data?['movie']);
    final list = _episodic(source) ? voiceSeasons(seasons, source) : const <Season>[];
    final pick = chosen ?? (list.isEmpty ? null : _continuePick(list));
    unawaited(api.post(Api.site('/cinema/${widget.slug}/started')).then(_applyState).catchError((_) {}));
    await Navigator.of(context, rootNavigator: true).push(MaterialPageRoute<void>(
      fullscreenDialog: true,
      builder: (_) => MoviePlayerScreen(
        title: text(movie['title']) ?? '',
        source: source,
        seasons: list,
        pick: pick,
        single: intOf(movie['episodes_count']) <= 1 && list.isEmpty,
        memory: memory,
        resumeAt: pick != null && pick == _serverPick ? intOf(_state['position']) : (pick == null ? intOf(_state['position']) : 0),
        onWatched: (p) {
          if (!marks.contains('${p.season}:${p.episode}')) unawaited(_toggleMark(p));
        },
        // Серія, секунда й озвучка — в акаунт: «Продовжити» працює й на сайті, й на іншому телефоні.
        onProgress: (p, seconds) => api
            .put(Api.site('/cinema/${widget.slug}/progress'), {
              'season': p?.season,
              'episode': p?.episode ?? 1,
              'position': seconds,
              'player_key': text(source['key']),
            })
            .then(_applyState)
            .catchError((_) {}),
      ),
    ));
    if (mounted) setState(() {});
  }

  Future<void> _toggleMark(Pick pick) async {
    try {
      final result = await api.post(Api.site('/cinema/${widget.slug}/episodes'), {'season': pick.season, 'episode': pick.episode});
      if (mounted) setState(() => marks = {for (final m in (result['marks'] as List? ?? const [])) '$m'});
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  void _applyState(Map<String, dynamic> result) {
    if (!mounted || data == null) return;
    setState(() {
      data!['state'] = mapOf(result['state']);
      final movie = mapOf(data!['movie']);
      for (final key in ['user_rating', 'ratings_count', 'watchers_count']) {
        if (result.containsKey(key)) movie[key] = result[key];
      }
      data!['movie'] = movie;
    });
  }

  Future<void> _status(String? status) async {
    try {
      _applyState(await api.patch(Api.site('/cinema/${widget.slug}/status'), {'status': status}));
      await _refreshAudience();
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _rate(int? rating) async {
    try {
      _applyState(await api.put(Api.site('/cinema/${widget.slug}/rating'), {'rating': rating}));
      await _refreshAudience();
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _refreshAudience() async {
    try {
      final fresh = await api.get(Api.site('/cinema/${widget.slug}'));
      if (mounted) setState(() => data!['audience'] = fresh['audience']);
    } catch (_) {}
  }

  Future<void> _statusDialog() async {
    final statuses = maps(data?['statuses']);
    final current = text(mapOf(data?['state'])['status']);
    final picked = await showDialog<String>(
      context: context,
      builder: (dialog) => AlertDialog(
        backgroundColor: popover,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Text(tr('Статус перегляду'), style: display(19)),
        contentPadding: const EdgeInsets.fromLTRB(8, 12, 8, 0),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          for (final option in [{'key': '', 'label': tr('Не в списку')}, ...statuses])
            ListTile(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              leading: Icon(
                (text(option['key']) ?? '') == (current ?? '') ? LucideIcons.circleDot : LucideIcons.circle,
                color: (text(option['key']) ?? '') == (current ?? '') ? (_statusColors[option['key']] ?? primary) : muted,
              ),
              title: Text('${option['label']}', style: body(15.5)),
              onTap: () => Navigator.pop(dialog, '${option['key']}'),
            ),
        ]),
        actions: [TextButton(onPressed: () => Navigator.pop(dialog), child: Text(tr('Скасувати'), style: body(14, color: primary, weight: FontWeight.w600)))],
      ),
    );
    if (picked == null) return;
    await _status(picked.isEmpty ? null : picked);
  }

  Future<void> _watchTogether() async {
    try {
      final result = await api.post('/api/v1/cinema/${widget.slug}/watch', {'player_key': text(voice?['key'])});
      final code = text(result['code']);
      if (code != null && mounted) context.push('/watch/$code');
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _menu() async {
    final action = await showGcSheet<String>(
      context,
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (players.isNotEmpty) SheetAction(icon: LucideIcons.languages, label: tr('Обрати озвучку й серію'), onTap: () => Navigator.pop(sheet, 'voice')),
          if (players.isNotEmpty) SheetAction(icon: LucideIcons.popcorn, label: tr('Дивитися разом'), onTap: () => Navigator.pop(sheet, 'together')),
          SheetAction(icon: LucideIcons.copy, label: tr('Скопіювати посилання'), onTap: () => Navigator.pop(sheet, 'copy')),
        ]),
      ),
    );
    if (!mounted) return;
    switch (action) {
      case 'voice':
        await _chooseVoice();
      case 'together':
        await _watchTogether();
      case 'copy':
        await Clipboard.setData(ClipboardData(text: '${Api.root}/cinema/${widget.slug}'));
        if (mounted) toast(context, tr('Посилання скопійовано'));
    }
  }

  @override
  Widget build(BuildContext context) {
    final page = data;
    if (page == null) {
      return error == null
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2.4))
          : Center(child: Padding(padding: const EdgeInsets.all(20), child: EmptyState(icon: LucideIcons.film, title: tr('Фільм недоступний'), text: '$error')));
    }
    final movie = mapOf(page['movie']);
    final state = mapOf(page['state']);
    final statuses = maps(page['statuses']);
    final friends = mapOf(page['friends']);
    final similar = maps(page['similar']);
    final audience = mapOf(page['audience']);
    final genres = [for (final g in (movie['genres'] as List? ?? const [])) '$g'];
    final countries = [for (final c in (movie['countries'] as List? ?? const [])) '$c'];
    final status = text(state['status']);
    final statusLabel = statuses.firstWhere((s) => s['key'] == status, orElse: () => const {})['label'];
    final current = voice;
    final added = current == null
        ? null
        : [
            if (intOf(current['episodes']) > 0) tr('{n} серія', {'n': current['episodes']}),
            text(current['translation']) ?? tr('Оригінал'),
            text(current['provider_label']),
          ].whereType<String>().join(' | ');
    final last = memory.last ?? _serverPick;
    final watchLabel = (memory.voice != null || text(_state['player_key']) != null) && last != null && seasons.isNotEmpty
        ? tr('Продовжити · {s}×{e}', {'s': last.season, 'e': last.episode})
        : tr('Дивитися');
    final duration = intOf(movie['duration']);
    final episodes = intOf(movie['episodes_count']);

    return ScreenScroll(
      controller: scroll,
      onRefresh: _load,
      children: [
        _Hero(
          poster: text(movie['poster']),
          backdrop: text(movie['backdrop']),
          onBack: () => context.canPop() ? context.pop() : context.go('/cinema'),
          onMenu: _menu,
        ),
        const SizedBox(height: 16),
        Text(text(movie['title']) ?? '', style: display(23).copyWith(height: 1.2)),
        const SizedBox(height: 4),
        Row(children: [
          if (text(movie['title_original']) != null) Expanded(child: Text(text(movie['title_original'])!, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, color: muted))) else const Spacer(),
          if (text(movie['age_rating']) != null) Pill(label: text(movie['age_rating'])!),
        ]),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(
            child: _TonalAction(
              icon: status == null ? LucideIcons.plus : LucideIcons.chevronDown,
              label: status == null ? tr('Додати до списку') : '$statusLabel',
              color: _statusColors[status] ?? primary,
              onTap: _statusDialog,
            ),
          ),
          const SizedBox(width: 8),
          _TonalAction(icon: LucideIcons.bookmark, label: compact(movie['watchers_count']), color: gold, onTap: _statusDialog),
          const SizedBox(width: 8),
          _TonalAction(
            icon: LucideIcons.messageSquare,
            label: intOf(movie['comments_count']) > 0 ? compact(movie['comments_count']) : null,
            color: soft,
            onTap: () {
              // Список будується ліниво: коментарі ще можуть бути не створені — їдемо в самий низ.
              final target = commentsKey.currentContext;
              if (target != null) {
                unawaited(Scrollable.ensureVisible(target, duration: const Duration(milliseconds: 400), curve: Curves.easeOutCubic));
              } else if (scroll.hasClients) {
                unawaited(scroll.animateTo(scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 600), curve: Curves.easeOutCubic));
              }
            },
          ),
        ]),
        if (players.isNotEmpty) ...[
          const SizedBox(height: 12),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            // Кнопка лежить на темній підкладці, під нею в тій самій підкладці — «Додано: …».
            Expanded(
              child: DecoratedBox(
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(28)),
                child: Column(children: [
                  _PlayPill(label: watchLabel, onTap: _watch),
                  if (added != null)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(14, 7, 14, 9),
                      child: Text(tr('Додано: {v}', {'v': added}), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12.5, color: muted)),
                    ),
                ]),
              ),
            ),
            SizedBox(
              width: 44,
              height: 54,
              child: IconButton(onPressed: _menu, tooltip: tr('Ще'), icon: const Icon(LucideIcons.ellipsisVertical, color: soft)),
            ),
          ]),
        ],
        const SizedBox(height: 16),
        if (countries.isNotEmpty || movie['year'] != null)
          _InfoRow(icon: LucideIcons.globe, label: [if (countries.isNotEmpty) countries.take(2).join(', '), if (movie['year'] != null) '${movie['year']}'].join(', ')),
        if (episodes > 1)
          _InfoRow(icon: LucideIcons.tv, label: duration > 0 ? tr('{n} еп. по ~{m} хв', {'n': episodes, 'm': duration}) : tr('{n} еп.', {'n': episodes}))
        else if (duration > 0)
          _InfoRow(icon: LucideIcons.clock, label: tr('{v} хв', {'v': duration})),
        if (text(movie['type_label']) != null) _InfoRow(icon: LucideIcons.clapperboard, label: text(movie['type_label'])!),
        if (mapOf(movie['ratings']).isNotEmpty)
          _InfoRow(icon: LucideIcons.star, label: [for (final r in mapOf(movie['ratings']).entries) '${r.key.toUpperCase()} ${r.value}'].join('  ·  ')),
        if (genres.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text(genres.join(', '), style: body(14.5, color: const Color(0xFF9AA8FF), weight: FontWeight.w600))),
        if (text(movie['tagline']) != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text('«${text(movie['tagline'])}»', style: body(14, color: soft).copyWith(fontStyle: FontStyle.italic))),
        if (text(movie['description']) != null)
          GestureDetector(
            onTap: () => setState(() => about = !about),
            child: Padding(
              padding: const EdgeInsets.only(top: 10),
              child: AnimatedSize(
                duration: const Duration(milliseconds: 250),
                alignment: Alignment.topCenter,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(text(movie['description'])!, maxLines: about ? null : 5, overflow: about ? null : TextOverflow.fade, style: body(15, color: soft).copyWith(height: 1.5)),
                  if (text(movie['description'])!.length > 220)
                    Center(child: Padding(padding: const EdgeInsets.only(top: 10), child: Text(about ? tr('Згорнути') : tr('Детальніше…'), style: body(14.5, weight: FontWeight.w700)))),
                ]),
              ),
            ),
          ),
        if (text(movie['trailer_url']) != null) ...[
          SectionLabel(tr('Відео')),
          _TrailerCard(image: text(movie['backdrop']) ?? text(movie['poster']), onTap: () => launchUrl(Uri.parse(text(movie['trailer_url'])!), mode: LaunchMode.externalApplication)),
        ],
        const _Hairline(),
        _SectionTitle(tr('Рейтинг')),
        _RatingBlock(movie: movie, ratings: mapOf(audience['ratings']), mine: intOf(state['rating']), onRate: _rate),
        if (mapOf(audience['statuses']).values.any((v) => intOf(v) > 0)) ...[
          const _Hairline(),
          _SectionTitle(tr('У списках у людей')),
          _ListsBar(counts: mapOf(audience['statuses']), statuses: statuses),
        ],
        const _Hairline(),
        if (maps(friends['users']).isNotEmpty) ...[
          SectionLabel(tr('Друзі дивляться'), trailing: '${friends['total']}'),
          Glass(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
            child: Column(children: [
              for (final user in maps(friends['users']))
                UserTile(
                  user: user,
                  subtitle: [
                    for (final s in statuses)
                      if (s['key'] == user['movie_status']) '${s['label']}',
                    if (user['movie_rating'] != null) '★ ${user['movie_rating']}',
                  ].join(' · '),
                ),
            ]),
          ),
        ],
        if (similar.isNotEmpty) ...[
          SectionLabel(tr('Рекомендуємо також')),
          SizedBox(
            height: 250,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: similar.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (_, i) => SizedBox(width: 132, child: PosterCard(movie: similar[i])),
            ),
          ),
        ],
        SectionLabel(tr('Коментарі'), key: commentsKey, trailing: intOf(movie['comments_count']) > 0 ? '${movie['comments_count']}' : null),
        Glass(
          child: CommentsThread(
            endpoint: Api.site('/cinema/${widget.slug}/comments'),
            initial: maps(page['comments']),
            total: intOf(movie['comments_count']),
            canComment: movie['comments_enabled'] != false,
            onCount: (value) => setState(() => movie['comments_count'] = value),
          ),
        ),
      ],
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.poster, required this.backdrop, required this.onBack, required this.onMenu});
  final String? poster;
  final String? backdrop;
  final VoidCallback onBack;
  final VoidCallback onMenu;

  @override
  Widget build(BuildContext context) {
    final cover = poster ?? backdrop;
    return SizedBox(
      height: 430,
      child: Stack(children: [
        Positioned.fill(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(28),
            child: Stack(fit: StackFit.expand, children: [
              ImageFiltered(imageFilter: ImageFilter.blur(sigmaX: 26, sigmaY: 26), child: NetImage(backdrop ?? cover)),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x66050712), Color(0xCC050712)]),
                ),
              ),
            ]),
          ),
        ),
        Center(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 64, 24, 24),
            child: AspectRatio(
              aspectRatio: 2 / 3,
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: const [BoxShadow(color: Color(0x99000000), blurRadius: 30, offset: Offset(0, 16), spreadRadius: -8)],
                ),
                child: NetImage(cover, radius: 24),
              ),
            ),
          ),
        ),
        Positioned(left: 12, top: 12, child: _GlassIcon(icon: LucideIcons.arrowLeft, onTap: onBack)),
        Positioned(right: 12, top: 12, child: _GlassIcon(icon: LucideIcons.ellipsis, onTap: onMenu)),
      ]),
    );
  }
}

/// Напівпрозора кнопка-квадрат поверх обкладинки (назад, меню).
class _GlassIcon extends StatelessWidget {
  const _GlassIcon({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black.withValues(alpha: 0.45),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: Colors.white.withValues(alpha: 0.10))),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: SizedBox(width: 46, height: 46, child: Icon(icon, size: 21, color: Colors.white.withValues(alpha: 0.9))),
      ),
    );
  }
}

/// Овальна кнопка з тонкою обводкою кольору статусу.
class _TonalAction extends StatelessWidget {
  const _TonalAction({required this.icon, required this.color, required this.onTap, this.label});
  final IconData icon;
  final String? label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color.withValues(alpha: 0.06),
      shape: StadiumBorder(side: BorderSide(color: color.withValues(alpha: 0.65), width: 1.5)),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 50, minWidth: 64),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Row(mainAxisSize: MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(icon, size: 18, color: color),
              if (label != null) ...[
                const SizedBox(width: 8),
                Flexible(child: FittedBox(fit: BoxFit.scaleDown, child: Text(label!, maxLines: 1, style: body(14.5, color: color, weight: FontWeight.w700)))),
              ],
            ]),
          ),
        ),
      ),
    );
  }
}

/// Головна кнопка «Дивитися»: овальна, з фірмовим градієнтом.
class _PlayPill extends StatelessWidget {
  const _PlayPill({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Ink(
          height: 54,
          decoration: ShapeDecoration(
            shape: const StadiumBorder(),
            gradient: buttonGradient,
            shadows: [BoxShadow(color: indigo.withValues(alpha: 0.45), blurRadius: 22, offset: const Offset(0, 8), spreadRadius: -10)],
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Icon(LucideIcons.play600, color: Colors.white, size: 22),
              const SizedBox(width: 10),
              Flexible(child: FittedBox(fit: BoxFit.scaleDown, child: Text(label, maxLines: 1, style: body(16.5, color: Colors.white, weight: FontWeight.w700)))),
            ]),
          ),
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(children: [
        Icon(icon, size: 20, color: muted),
        const SizedBox(width: 12),
        Expanded(child: Text(label, style: body(15, color: soft))),
      ]),
    );
  }
}

class _TrailerCard extends StatelessWidget {
  const _TrailerCard({required this.image, required this.onTap});
  final String? image;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: Stack(fit: StackFit.expand, children: [
            NetImage(image),
            const DecoratedBox(decoration: BoxDecoration(color: Color(0x66050712))),
            Center(
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: const BoxDecoration(color: primary, shape: BoxShape.circle),
                  child: const Icon(LucideIcons.play, color: Colors.white, size: 26),
                ),
                const SizedBox(width: 12),
                Text(tr('Трейлер'), style: display(22, color: Colors.white)),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

/// Середня оцінка, розподіл 10…1 і моя оцінка.
class _RatingBlock extends StatelessWidget {
  const _RatingBlock({required this.movie, required this.ratings, required this.mine, required this.onRate});
  final Map<String, dynamic> movie;
  final Map<String, dynamic> ratings;
  final int mine;
  final ValueChanged<int?> onRate;

  @override
  Widget build(BuildContext context) {
    // Оцінки 1–10 зводимо в 5 смуг (9–10, 7–8 …), як п’ять зірок.
    final counts = {for (var g = 1; g <= 5; g++) g: intOf(ratings['${g * 2}']) + intOf(ratings['${g * 2 - 1}'])};
    final top = counts.values.fold<int>(0, (a, b) => b > a ? b : a);
    final average = (movie['user_rating'] as num?)?.toDouble();
    final total = intOf(movie['ratings_count']);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Column(children: [
        if (total == 0)
          Row(children: [
            const Icon(LucideIcons.star, size: 20, color: faint),
            const SizedBox(width: 10),
            Expanded(child: Text(tr('Оцінок ще немає — будьте першими.'), style: body(14, color: muted))),
          ])
        else
        Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
          SizedBox(
            width: 110,
            child: Column(children: [
              Text(average == null ? '—' : average.toStringAsFixed(1), style: display(48)),
              Text(tr('{n} оцінок', {'n': total}), style: body(12.5, color: muted)),
            ]),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(children: [
              for (var i = 5; i >= 1; i--)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(children: [
                    SizedBox(width: 14, child: Text('$i', textAlign: TextAlign.right, style: body(12, color: muted))),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(99),
                        child: LinearProgressIndicator(
                          value: top == 0 ? 0 : counts[i]! / top,
                          minHeight: 10,
                          backgroundColor: Colors.white.withValues(alpha: 0.06),
                          valueColor: const AlwaysStoppedAnimation(primary),
                        ),
                      ),
                    ),
                  ]),
                ),
            ]),
          ),
        ]),
        const SizedBox(height: 14),
        Row(children: [
          Text(tr('Моя оцінка'), style: body(13, color: muted)),
          const Spacer(),
          if (mine > 0) TextButton(onPressed: () => onRate(null), child: Text(tr('Скинути'), style: body(12.5, color: muted))),
        ]),
        Row(children: [
          for (var i = 1; i <= 10; i++)
            Expanded(
              child: GestureDetector(
                onTap: () => onRate(i),
                child: Icon(mine >= i ? LucideIcons.star600 : LucideIcons.star, color: mine >= i ? gold : faint, size: 26),
              ),
            ),
        ]),
      ]),
    );
  }
}

/// «У списках у людей»: смуга з частками й легенда.
class _ListsBar extends StatelessWidget {
  const _ListsBar({required this.counts, required this.statuses});
  final Map<String, dynamic> counts;
  final List<Map<String, dynamic>> statuses;

  @override
  Widget build(BuildContext context) {
    final items = [
      for (final s in statuses)
        if (intOf(counts['${s['key']}']) > 0) (key: '${s['key']}', label: '${s['label']}', count: intOf(counts['${s['key']}'])),
    ];
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: Row(children: [
            for (final item in items) Expanded(flex: item.count, child: Container(height: 16, color: _statusColors[item.key] ?? muted)),
          ]),
        ),
        const SizedBox(height: 12),
        LayoutBuilder(
          builder: (context, box) => Wrap(runSpacing: 8, children: [
            for (final item in items)
              SizedBox(
                width: box.maxWidth / 2,
                child: Row(children: [
                  Container(width: 12, height: 12, decoration: BoxDecoration(color: _statusColors[item.key] ?? muted, shape: BoxShape.circle)),
                  const SizedBox(width: 8),
                  Flexible(child: Text(item.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, color: muted))),
                  const SizedBox(width: 6),
                  Text(compact(item.count), style: body(14, weight: FontWeight.w700)),
                ]),
              ),
          ]),
        ),
      ]),
    );
  }
}

/// Тонкий роздільник між розділами сторінки.
class _Hairline extends StatelessWidget {
  const _Hairline();

  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.symmetric(vertical: 14), child: Divider(height: 1, color: line));
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.label);
  final String label;

  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(bottom: 14), child: Text(label, style: display(20)));
}

// ───────────────────────── Вибір озвучки ─────────────────────────

class VoicePickerScreen extends StatefulWidget {
  const VoicePickerScreen({required this.players, required this.selected, required this.seasons, super.key});
  final List<Map<String, dynamic>> players;
  final String? selected;
  final List<Season> seasons;

  @override
  State<VoicePickerScreen> createState() => _VoicePickerScreenState();
}

class _VoicePickerScreenState extends State<VoicePickerScreen> {
  String filter = 'all';
  bool hint = true;

  static bool _subs(Map<String, dynamic> p) => text(p['translation_type']) == 'subtitles';

  @override
  Widget build(BuildContext context) {
    final hasSubs = widget.players.any(_subs);
    final list = widget.players.where((p) => filter == 'all' || (filter == 'subs') == _subs(p)).toList();
    return Scaffold(
      backgroundColor: voidColor,
      body: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _PageBar(title: tr('Оберіть варіант'), onBack: () => Navigator.pop(context)),
          if (hasSubs)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: Wrap(spacing: 8, children: [
                SelectPill(label: tr('Усі'), selected: filter == 'all', onTap: () => setState(() => filter = 'all')),
                SelectPill(label: tr('Озвучки'), selected: filter == 'voice', onTap: () => setState(() => filter = 'voice')),
                SelectPill(label: tr('Субтитри'), selected: filter == 'subs', onTap: () => setState(() => filter = 'subs')),
              ]),
            ),
          if (hint)
            _Hint(
              text: tr('Біля кожної озвучки — скільки серій у ній доступно. Якщо плеєр не завантажився, спробуйте іншу озвучку чи джерело.'),
              onClose: () => setState(() => hint = false),
            ),
          Expanded(
            child: ListView.separated(
              padding: EdgeInsets.only(bottom: 24 + MediaQuery.viewPaddingOf(context).bottom),
              itemCount: list.length,
              separatorBuilder: (_, _) => Divider(height: 1, color: line, indent: 16, endIndent: 16),
              itemBuilder: (_, i) {
                final p = list[i];
                final name = text(p['translation']) ?? tr('Оригінал');
                final count = intOf(p['episodes']);
                final active = text(p['key']) == widget.selected;
                return InkWell(
                  onTap: () => Navigator.pop(context, p),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(children: [
                      _VoiceBadge(name: name, subs: _subs(p)),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(name, maxLines: 2, overflow: TextOverflow.ellipsis, style: body(16, weight: FontWeight.w700)),
                          const SizedBox(height: 2),
                          Text(
                            [if (count > 0) tr('{n} серій', {'n': count}), text(p['provider_label']), text(p['quality'])].whereType<String>().join(' · '),
                            style: body(13, color: muted),
                          ),
                        ]),
                      ),
                      if (active) const Icon(LucideIcons.circleCheck, color: primary),
                    ]),
                  ),
                );
              },
            ),
          ),
        ]),
      ),
    );
  }
}

class _VoiceBadge extends StatelessWidget {
  const _VoiceBadge({required this.name, required this.subs});
  final String name;
  final bool subs;

  static const _tones = [
    [Color(0xFF6D5DFC), Color(0xFFA855F7)],
    [Color(0xFF4F8BFF), Color(0xFF38E1FF)],
    [Color(0xFFF04FD8), Color(0xFFA855F7)],
    [Color(0xFF34D399), Color(0xFF4F8BFF)],
    [Color(0xFFF5C451), Color(0xFFF0734A)],
  ];

  @override
  Widget build(BuildContext context) {
    final letters = name.replaceAll(RegExp(r'[^\p{L}\p{N}]', unicode: true), '');
    return Container(
      width: 54,
      height: 54,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(colors: _tones[name.hashCode.abs() % _tones.length], begin: Alignment.topLeft, end: Alignment.bottomRight),
      ),
      child: subs
          ? const Icon(LucideIcons.captions, color: Colors.white)
          : (letters.isEmpty ? const Icon(LucideIcons.mic, color: Colors.white) : Text(letters.characters.take(2).toString().toUpperCase(), style: display(18, color: Colors.white))),
    );
  }
}

class _PageBar extends StatelessWidget {
  const _PageBar({required this.title, required this.onBack, this.subtitle, this.trailing});
  final String title;
  final String? subtitle;
  final VoidCallback onBack;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(6, 6, 6, 8),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: line))),
      child: Row(children: [
        IconButton(onPressed: onBack, icon: const Icon(LucideIcons.arrowLeft, color: ink)),
        const SizedBox(width: 4),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: display(20)),
            if (subtitle != null) Text(subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(13.5, color: muted)),
          ]),
        ),
        ?trailing,
      ]),
    );
  }
}

class _Hint extends StatelessWidget {
  const _Hint({required this.text, required this.onClose});
  final String text;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: lineStrong), color: Colors.white.withValues(alpha: 0.03)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: Text(text, style: body(13.5, color: muted).copyWith(height: 1.45))),
        IconButton(onPressed: onClose, icon: const Icon(LucideIcons.circleX, color: muted, size: 22)),
      ]),
    );
  }
}

// ───────────────────────── Вибір серії ─────────────────────────

class EpisodeListScreen extends StatefulWidget {
  const EpisodeListScreen({required this.voice, required this.seasons, required this.marks, required this.memory, required this.onToggle, super.key});
  final Map<String, dynamic> voice;
  final List<Season> seasons;
  final Set<String> marks;
  final WatchMemory memory;
  final Future<void> Function(Pick pick) onToggle;

  @override
  State<EpisodeListScreen> createState() => _EpisodeListScreenState();
}

class _EpisodeListScreenState extends State<EpisodeListScreen> {
  late int season = widget.memory.last?.season ?? widget.seasons.first.number;
  bool newestFirst = false;
  bool hint = true;

  @override
  Widget build(BuildContext context) {
    final current = widget.seasons.firstWhere((s) => s.number == season, orElse: () => widget.seasons.first);
    final episodes = newestFirst ? current.episodes.reversed.toList() : current.episodes;
    return Scaffold(
      backgroundColor: voidColor,
      body: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _PageBar(
            title: tr('Оберіть серію'),
            subtitle: tr('Джерело {v}', {'v': text(widget.voice['provider_label']) ?? ''}),
            onBack: () => Navigator.pop(context),
            trailing: IconButton(
              tooltip: tr('Порядок'),
              onPressed: () => setState(() => newestFirst = !newestFirst),
              icon: Icon(newestFirst ? LucideIcons.arrowUpWideNarrow : LucideIcons.arrowDownNarrowWide, color: soft),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
            child: Text(text(widget.voice['translation']) ?? tr('Оригінал'), style: display(28)),
          ),
          if (widget.seasons.length > 1)
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                children: [
                  for (final s in widget.seasons)
                    Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: SelectPill(label: tr('{n} сезон', {'n': s.number}), selected: s.number == current.number, onTap: () => setState(() => season = s.number)),
                    ),
                ],
              ),
            ),
          if (hint)
            _Hint(
              text: tr('Якщо серія не запускається, спробуйте іншу озвучку чи джерело. Реклама у відео належить плеєру й до GameCon стосунку не має.'),
              onClose: () => setState(() => hint = false),
            ),
          Expanded(
            child: ListView.separated(
              padding: EdgeInsets.only(bottom: 24 + MediaQuery.viewPaddingOf(context).bottom),
              itemCount: episodes.length,
              separatorBuilder: (_, _) => Divider(height: 1, color: line, indent: 16, endIndent: 16),
              itemBuilder: (_, i) {
                final pick = (season: current.number, episode: episodes[i]);
                final seen = widget.marks.contains('${pick.season}:${pick.episode}');
                final at = widget.memory.position(pick);
                final last = widget.memory.last == pick;
                return InkWell(
                  onTap: () => Navigator.pop(context, pick),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
                    child: Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(
                            widget.seasons.length > 1 ? tr('{s} сезон · {e} серія', {'s': pick.season, 'e': pick.episode}) : tr('{n} серія', {'n': pick.episode}),
                            style: body(16.5, weight: FontWeight.w700, color: last ? primary : ink),
                          ),
                          if (at > 0) Text(tr('Переглянуто до {t}', {'t': clock(at.toDouble())}), style: body(13, color: muted)),
                        ]),
                      ),
                      IconButton(
                        tooltip: seen ? tr('Переглянуто') : tr('Позначити переглянутою'),
                        onPressed: () async {
                          await widget.onToggle(pick);
                          if (mounted) setState(() => seen ? widget.marks.remove('${pick.season}:${pick.episode}') : widget.marks.add('${pick.season}:${pick.episode}'));
                        },
                        icon: Icon(seen ? LucideIcons.circleCheck : LucideIcons.circle, color: seen ? green : faint),
                      ),
                    ]),
                  ),
                );
              },
            ),
          ),
        ]),
      ),
    );
  }
}

// ───────────────────────── Власний плеєр ─────────────────────────

/// Скрипт, що вбудовується в сторінку плеєра балансера (Kodik / Videoseed): ховає весь рідний інтерфейс
/// (кнопки, перемикачі, значки віку, спінер) і лишає тільки `<video>` на весь екран. Далі наш Flutter-шар
/// керує відео напряму (play / pause / seek / швидкість), а стан шле через канал GcBridge двічі на секунду.
/// Сторінку відкриваємо як головну (а не в iframe), інакше чужий документ недоступний для скрипта.
const _bridgeScript = r'''
(function () {
  if (window.__gcPlayer) return; window.__gcPlayer = true;
  var style = document.createElement('style');
  style.textContent =
    'html,body{background:#000!important;overflow:hidden!important;margin:0!important}' +
    'body *{visibility:hidden!important;pointer-events:none!important}' +
    'video.gc-main{visibility:visible!important;position:fixed!important;left:0!important;top:0!important;' +
    'width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;' +
    'z-index:2147483647!important;object-fit:contain!important;background:#000!important;opacity:1!important;transform:none!important}';
  (document.head || document.documentElement).appendChild(style);
  function send(msg) { try { GcBridge.postMessage(JSON.stringify(msg)); } catch (e) {} }
  function main() {
    var list = [].slice.call(document.querySelectorAll('video'));
    if (!list.length) return null;
    // Реклама — короткі ролики; основне відео — найдовше.
    list.sort(function (a, b) { return (isFinite(b.duration) ? b.duration : 0) - (isFinite(a.duration) ? a.duration : 0); });
    var v = list[0];
    list.forEach(function (x) { if (x !== v) x.classList.remove('gc-main'); });
    v.classList.add('gc-main');
    v.controls = false;
    return v;
  }
  // Деякі плеєри створюють <video> лише після натискання власної кнопки — натискаємо її за користувача.
  function poke() {
    style.disabled = true;
    var el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    style.disabled = false;
    if (el) { el.click(); }
  }
  var idle = 0;
  setInterval(function () {
    var v = main();
    if (!v) { idle++; send({ gc: 'wait', idle: idle }); return; }
    idle = 0;
    send({
      gc: 'state',
      time: v.currentTime || 0,
      duration: isFinite(v.duration) ? v.duration : 0,
      paused: v.paused,
      ended: v.ended,
      buffering: !v.paused && v.readyState < 3,
      ad: isFinite(v.duration) && v.duration > 0 && v.duration < 120
    });
  }, 500);
  window.gcCmd = function (cmd, arg) {
    var v = main();
    if (!v) { if (cmd === 'play') poke(); return; }
    if (cmd === 'play') { var p = v.play(); if (p && p.catch) p.catch(function () { poke(); }); }
    else if (cmd === 'pause') v.pause();
    else if (cmd === 'seek') v.currentTime = Math.max(0, arg);
    else if (cmd === 'speed') v.playbackRate = arg;
  };
  // Аварійний режим: показати рідний плеєр (якщо відео так і не знайшлося).
  window.gcNative = function (on) { style.disabled = !!on; };
})();
''';

/// Плеєр на весь екран: відео балансера (сторінка плеєра в WebView з прихованим рідним інтерфейсом),
/// поверх — наш шар керування. Прогрес (серія, секунда, озвучка) — локально й в акаунті.
class MoviePlayerScreen extends StatefulWidget {
  const MoviePlayerScreen({
    required this.title,
    required this.source,
    required this.seasons,
    required this.pick,
    required this.single,
    required this.memory,
    required this.onWatched,
    required this.onProgress,
    this.resumeAt = 0,
    super.key,
  });

  final String title;
  final Map<String, dynamic> source;
  final List<Season> seasons;
  final Pick? pick;
  final bool single;
  final WatchMemory memory;
  final ValueChanged<Pick> onWatched;
  final Future<void> Function(Pick? pick, int seconds) onProgress;

  /// Секунда з акаунта (якщо локально позиції немає).
  final int resumeAt;

  @override
  State<MoviePlayerScreen> createState() => _MoviePlayerScreenState();
}

/// Стан відтворення, що оновлюється двічі на секунду, — окремо від екрана, щоб не перебудовувати все.
class _Playback {
  final position = ValueNotifier<double>(0);
  final duration = ValueNotifier<double>(0);
  final playing = ValueNotifier<bool>(false);
  final buffering = ValueNotifier<bool>(true);

  void dispose() {
    position.dispose();
    duration.dispose();
    playing.dispose();
    buffering.dispose();
  }
}

class _MoviePlayerScreenState extends State<MoviePlayerScreen> {
  static const _speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  static const _hideAfter = Duration(milliseconds: 3500);

  final playback = _Playback();
  final controls = ValueNotifier<bool>(true);
  final skip = ValueNotifier<({int dir, int seconds, int id})?>(null);

  WebViewController? web;
  Pick? pick;
  bool started = false;
  /// Запасний шлях: рідний плеєр в обгортці сайту.
  bool embedded = false;

  /// Допомога зі стартом: сторінка балансера видима й приймає дотики (його ▶, реклама), поки не піде відео.
  bool assist = false;

  /// Скрипт у сторінці відповів (канал працює).
  bool bridgeSeen = false;
  Timer? inject;
  Timer? watchdog;
  bool locked = false;
  bool landscape = true;
  double speed = 1;
  bool reported = false;
  bool resumed = false;
  bool ended = false;
  int savedAt = 0;
  int sentAt = 0;
  int skipId = 0;
  /// Коли натиснули «Відтворити» до першого кадру (для запасного шляху).
  int tapAt = 0;
  Timer? hide;
  Timer? skipTimer;

  List<Pick> get all => [for (final s in widget.seasons) for (final e in s.episodes) (season: s.number, episode: e)];

  @override
  void initState() {
    super.initState();
    pick = widget.pick;
    _orientation(true);
    _load();
  }

  @override
  void dispose() {
    hide?.cancel();
    skipTimer?.cancel();
    inject?.cancel();
    watchdog?.cancel();
    _remember(push: true);
    playback.dispose();
    controls.dispose();
    skip.dispose();
    SystemChrome.setPreferredOrientations(const []);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  void _orientation(bool wide) {
    landscape = wide;
    SystemChrome.setPreferredOrientations(wide ? [DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight] : [DeviceOrientation.portraitUp]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }

  String _url(Pick? target) {
    final raw = text(widget.source['link']) ?? '';
    final iframe = RegExp('src=["\']([^"\']+)').firstMatch(raw);
    final base = absolute(iframe?.group(1) ?? raw) ?? raw;
    // Перемикачі балансера не потрібні — серію й озвучку обирає застосунок.
    return episodeUrl(text(widget.source['provider']) ?? '', base, target, bare: true);
  }

  void _load({bool embed = false}) {
    widget.memory.last = pick;
    final url = _url(pick);
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..setUserAgent('Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36')
      ..addJavaScriptChannel('GcBridge', onMessageReceived: (m) => _onBridge(m.message))
      ..setNavigationDelegate(NavigationDelegate(
        onPageStarted: (_) => embed ? null : web?.runJavaScript(_bridgeScript).catchError((_) {}),
        onPageFinished: (_) => embed ? null : web?.runJavaScript(_bridgeScript).catchError((_) {}),
      ));
    if (embed) {
      // Запасний шлях: рідний плеєр в обгортці сайту (як раніше).
      unawaited(controller.loadRequest(Uri.parse('${Api.root}/play/embed').replace(queryParameters: {'src': url})));
    } else {
      // Сторінку плеєра відкриваємо напряму (з нашим Referer — балансер прив’язаний до домену сайту).
      unawaited(controller.loadRequest(Uri.parse(url), headers: {'Referer': '${Api.root}/'}));
    }
    final platform = controller.platform;
    if (platform is AndroidWebViewController) unawaited(platform.setMediaPlaybackRequiresUserGesture(false));
    // Сторінка балансера може довго довантажуватись — повторюємо вбудовування, поки скрипт не відповість.
    inject?.cancel();
    watchdog?.cancel();
    bridgeSeen = false;
    if (!embed) {
      inject = Timer.periodic(const Duration(milliseconds: 1500), (t) {
        if (bridgeSeen || !mounted) return t.cancel();
        unawaited(web?.runJavaScript(_bridgeScript).catchError((_) {}));
      });
    }
    playback.position.value = 0;
    playback.duration.value = 0;
    playback.playing.value = false;
    playback.buffering.value = true;
    controls.value = true;
    setState(() {
      started = false;
      tapAt = 0;
      embedded = embed;
      assist = false;
      reported = false;
      resumed = false;
      ended = false;
      web = controller;
    });
  }

  void _cmd(String cmd, [num? arg]) {
    unawaited(web?.runJavaScript('window.gcCmd && window.gcCmd(${jsonEncode(cmd)}, ${arg ?? 'null'});').catchError((_) {}));
  }

  void _onBridge(String raw) {
    Map<String, dynamic> data;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return;
      data = Map<String, dynamic>.from(decoded);
    } catch (_) {
      return;
    }
    if (!mounted || embedded) return;
    bridgeSeen = true;
    if (data['gc'] != 'state') return;
    final time = (data['time'] as num?)?.toDouble() ?? 0;
    final duration = (data['duration'] as num?)?.toDouble() ?? 0;
    final paused = data['paused'] == true;
    final ad = data['ad'] == true;
    if (ad) {
      // Реклама: показуємо її (кнопка «Пропустити» — у плеєрі балансера), позицію серії не чіпаємо.
      if (!assist) _assist(true);
      return;
    }
    playback.buffering.value = data['buffering'] == true || duration == 0;
    if (started || time > 0) playback.playing.value = !paused;
    // Серія справді пішла — ховаємо сторінку балансера, керування переходить до нас.
    if (!paused && time > 0.3) {
      if (assist) _assist(false);
      if (!started) {
        watchdog?.cancel();
        tapAt = 0;
        setState(() => started = true);
      }
    }
    if (!started && time == 0) return;
    playback.duration.value = duration;
    playback.position.value = time;
    if (!paused && controls.value && hide == null) _autoHide();
    _onTime(time, duration);
    if (data['ended'] == true && !ended) {
      ended = true;
      _remember(push: true);
      if (_next != null) {
        _goto(_next);
      } else {
        _show();
      }
    }
  }

  void _onTime(double time, double duration) {
    // Продовжити з місця, де зупинились (якщо далі за 20 с і не в самому кінці).
    if (!resumed && duration > 0) {
      resumed = true;
      final local = widget.memory.position(pick);
      final at = local > 0 ? local : (pick == widget.pick ? widget.resumeAt : 0);
      if (at > 20 && at < duration - 30) _cmd('seek', at);
      if (speed != 1) _cmd('speed', speed);
    }
    final now = DateTime.now().millisecondsSinceEpoch;
    if (now - savedAt > 5000) {
      savedAt = now;
      _remember();
    }
    if (!reported && duration > 0 && time / duration > 0.9 && pick != null) {
      reported = true;
      widget.onWatched(pick!);
    }
  }

  /// Зберегти позицію: локально — завжди, в акаунт — не частіше ніж раз на 15 с (і при виході, паузі, зміні серії).
  void _remember({bool push = false}) {
    final time = playback.position.value;
    if (time < 5) return;
    widget.memory.savePosition(pick, time.floor());
    final now = DateTime.now().millisecondsSinceEpoch;
    if (push || now - sentAt > 15000) {
      sentAt = now;
      unawaited(widget.onProgress(pick, time.floor()));
    }
  }

  // ── Керування ──

  void _togglePlay() {
    if (playback.playing.value) {
      _cmd('pause');
      playback.playing.value = false;
      _remember(push: true);
      _show(keep: true);
    } else {
      if (!started && tapAt == 0) {
        tapAt = DateTime.now().millisecondsSinceEpoch;
        // Відео не пішло за 6 с (плеєр балансера чекає дотику на свою кнопку чи показує рекламу) —
        // відкриваємо його сторінку для дотику; скрипт не відповідає взагалі — запасна обгортка.
        watchdog?.cancel();
        watchdog = Timer(const Duration(seconds: 6), () {
          if (!mounted || started) return;
          bridgeSeen ? _assist(true) : _load(embed: true);
        });
      }
      _cmd('play');
      playback.playing.value = true;
      _autoHide();
    }
  }

  void _assist(bool on) {
    unawaited(web?.runJavaScript('window.gcNative && window.gcNative(${on ? 'true' : 'false'});').catchError((_) {}));
    setState(() => assist = on);
    if (!on) _autoHide();
  }

  void _seekTo(double seconds) {
    final max = playback.duration.value;
    final target = seconds.clamp(0, max > 0 ? max : seconds).toDouble();
    playback.position.value = target;
    _cmd('seek', target);
  }

  /// Подвійний дотик: ±10 с з індикатором, як у YouTube (кілька дотиків підряд складаються).
  void _doubleTap(TapDownDetails details, double width) {
    final dir = details.localPosition.dx < width / 2 ? -1 : 1;
    final prev = skip.value;
    final seconds = prev != null && prev.dir == dir ? prev.seconds + 10 : 10;
    skip.value = (dir: dir, seconds: seconds, id: ++skipId);
    _seekTo(playback.position.value + dir * 10);
    skipTimer?.cancel();
    skipTimer = Timer(const Duration(milliseconds: 700), () => skip.value = null);
  }

  void _show({bool keep = false}) {
    controls.value = true;
    if (keep) {
      hide?.cancel();
      hide = null;
    } else {
      _autoHide();
    }
  }

  void _autoHide() {
    hide?.cancel();
    hide = Timer(_hideAfter, () {
      hide = null;
      if (mounted && playback.playing.value) controls.value = false;
    });
  }

  void _speed(double value) {
    _cmd('speed', value);
    setState(() => speed = value);
  }

  Pick? get _prev {
    final i = pick == null ? -1 : all.indexOf(pick!);
    return i > 0 ? all[i - 1] : null;
  }

  Pick? get _next {
    final i = pick == null ? -1 : all.indexOf(pick!);
    return i >= 0 && i < all.length - 1 ? all[i + 1] : null;
  }

  void _goto(Pick? target) {
    if (target == null) return;
    _remember(push: true);
    pick = target;
    _load();
  }

  Future<void> _speedMenu() async {
    _show(keep: true);
    final picked = await showModalBottomSheet<double>(
      context: context,
      backgroundColor: popover,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (sheet) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr('Швидкість'), style: display(17)),
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final s in _speeds) SelectPill(label: s == 1 ? tr('Звичайна') : '${s}x', selected: s == speed, onTap: () => Navigator.pop(sheet, s)),
            ]),
          ]),
        ),
      ),
    );
    if (picked != null) _speed(picked);
    _autoHide();
  }

  Future<void> _episodeMenu() async {
    _show(keep: true);
    final target = await showModalBottomSheet<Pick>(
      context: context,
      backgroundColor: popover,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (sheet) => _EpisodeSheet(seasons: widget.seasons, current: pick, memory: widget.memory),
    );
    if (target != null && target != pick) {
      _goto(target);
    } else {
      _autoHide();
    }
  }

  String get _subtitle {
    final voice = text(widget.source['translation']);
    final p = pick;
    final episode = p == null ? null : (widget.seasons.length > 1 ? tr('{s} сезон · {e} серія', {'s': p.season, 'e': p.episode}) : tr('{n} серія', {'n': p.episode}));
    return [episode, voice].whereType<String>().join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final controller = web;
    return PopScope(
      onPopInvokedWithResult: (_, _) => _remember(push: true),
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Stack(fit: StackFit.expand, children: [
          if (controller != null) IgnorePointer(ignoring: !(embedded || assist), child: WebViewWidget(controller: controller)),
          if (embedded)
            _NativeFallback(onBack: () => Navigator.pop(context))
          else if (assist)
            _AssistBar(onBack: () => Navigator.pop(context))
          else if (locked)
            _LockLayer(controls: controls, onUnlock: () => setState(() => locked = false))
          else
            LayoutBuilder(
              builder: (context, box) => GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => controls.value ? controls.value = false : _show(keep: !playback.playing.value),
                onDoubleTapDown: (d) => _doubleTap(d, box.maxWidth),
                onDoubleTap: () {},
                child: Stack(fit: StackFit.expand, children: [
                  // До старту — чорна заставка замість першого кадру балансера.
                  if (!started) const ColoredBox(color: Colors.black),
                  ValueListenableBuilder(
                    valueListenable: skip,
                    builder: (context, value, _) => value == null ? const SizedBox.shrink() : _SkipRipple(dir: value.dir, seconds: value.seconds),
                  ),
                  ValueListenableBuilder(
                    valueListenable: controls,
                    builder: (context, visible, child) => AnimatedOpacity(
                      opacity: visible || !started ? 1 : 0,
                      duration: const Duration(milliseconds: 250),
                      curve: Curves.easeOut,
                      child: IgnorePointer(ignoring: !(visible || !started), child: child),
                    ),
                    child: _controlsLayer(context),
                  ),
                ]),
              ),
            ),
        ]),
      ),
    );
  }

  Widget _controlsLayer(BuildContext context) {
    final episodic = widget.seasons.isNotEmpty;
    return Stack(fit: StackFit.expand, children: [
      // Градієнти під панелями — білий текст читається на будь-якому кадрі.
      const Align(
        alignment: Alignment.topCenter,
        child: SizedBox(
          height: 120,
          width: double.infinity,
          child: DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xB3000000), Color(0x00000000)]))),
        ),
      ),
      const Align(
        alignment: Alignment.bottomCenter,
        child: SizedBox(
          height: 150,
          width: double.infinity,
          child: DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [Color(0xCC000000), Color(0x00000000)]))),
        ),
      ),
      SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 4, 8, 4),
          child: Column(children: [
            // ── Верхня панель ──
            Row(children: [
              _PlayerIcon(icon: LucideIcons.arrowLeft, onTap: () => Navigator.pop(context)),
              const SizedBox(width: 6),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  Text(widget.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: display(17, color: Colors.white)),
                  if (_subtitle.isNotEmpty) Text(_subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(13, color: Colors.white70)),
                ]),
              ),
              _PillButton(icon: LucideIcons.gauge, label: speed == 1 ? '1x' : '${speed}x', onTap: _speedMenu),
              const SizedBox(width: 4),
              _PlayerIcon(
                icon: LucideIcons.lockOpen,
                tooltip: tr('Заблокувати екран'),
                onTap: () => setState(() {
                  locked = true;
                  controls.value = false;
                }),
              ),
            ]),
            const Spacer(),
            // ── Центр ──
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              if (episodic) _PlayerIcon(icon: LucideIcons.skipBack, size: 30, onTap: _prev == null ? null : () => _goto(_prev)),
              SizedBox(width: episodic ? 40 : 0),
              ValueListenableBuilder(
                valueListenable: playback.buffering,
                builder: (context, buffering, _) => ValueListenableBuilder(
                  valueListenable: playback.playing,
                  builder: (context, playing, _) => _BigPlay(playing: playing, loading: buffering && playing, onTap: _togglePlay),
                ),
              ),
              SizedBox(width: episodic ? 40 : 0),
              if (episodic) _PlayerIcon(icon: LucideIcons.skipForward, size: 30, onTap: _next == null ? null : () => _goto(_next)),
            ]),
            const Spacer(),
            // ── Нижня панель ──
            _SeekBar(playback: playback, onSeekStart: () => _show(keep: true), onSeek: (v) {
              _seekTo(v);
              _autoHide();
            }),
            Row(children: [
              ValueListenableBuilder(
                valueListenable: playback.playing,
                builder: (context, playing, _) => _PlayerIcon(icon: playing ? LucideIcons.pause : LucideIcons.play, onTap: _togglePlay),
              ),
              const SizedBox(width: 4),
              _TimeLabel(playback: playback),
              const Spacer(),
              _PillButton(icon: LucideIcons.chevronsRight, label: tr('+85 с'), onTap: () {
                _seekTo(playback.position.value + 85);
                _autoHide();
              }),
              if (episodic) ...[
                const SizedBox(width: 4),
                _PillButton(icon: LucideIcons.listVideo, label: tr('Серії'), onTap: _episodeMenu),
              ],
              if (_next != null) ...[
                const SizedBox(width: 4),
                _PillButton(icon: LucideIcons.stepForward, label: tr('Далі'), onTap: () => _goto(_next)),
              ],
              _PlayerIcon(
                icon: landscape ? LucideIcons.minimize : LucideIcons.maximize,
                tooltip: landscape ? tr('Вертикально') : tr('На весь екран'),
                onTap: () {
                  setState(() => _orientation(!landscape));
                  _autoHide();
                },
              ),
            ]),
          ]),
        ),
      ),
    ]);
  }
}

/// Повзунок часу: поки користувач тягне, оновлення з плеєра його не смикають.
class _SeekBar extends StatefulWidget {
  const _SeekBar({required this.playback, required this.onSeekStart, required this.onSeek});
  final _Playback playback;
  final VoidCallback onSeekStart;
  final ValueChanged<double> onSeek;

  @override
  State<_SeekBar> createState() => _SeekBarState();
}

class _SeekBarState extends State<_SeekBar> {
  double? dragging;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder(
      valueListenable: widget.playback.duration,
      builder: (context, duration, _) => ValueListenableBuilder(
        valueListenable: widget.playback.position,
        builder: (context, position, _) {
          final max = duration > 0 ? duration : 1.0;
          final value = (dragging ?? position).clamp(0, max).toDouble();
          return Row(children: [
            Expanded(
              child: SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  trackHeight: 3.5,
                  activeTrackColor: primary,
                  inactiveTrackColor: Colors.white24,
                  thumbColor: Colors.white,
                  overlayColor: primary.withValues(alpha: 0.2),
                  thumbShape: RoundSliderThumbShape(enabledThumbRadius: dragging == null ? 6 : 9),
                  overlayShape: const RoundSliderOverlayShape(overlayRadius: 16),
                ),
                child: Slider(
                  value: value,
                  max: max,
                  onChangeStart: duration > 0
                      ? (v) {
                          widget.onSeekStart();
                          setState(() => dragging = v);
                        }
                      : null,
                  onChanged: duration > 0 ? (v) => setState(() => dragging = v) : null,
                  onChangeEnd: duration > 0
                      ? (v) {
                          widget.onSeek(v);
                          setState(() => dragging = null);
                        }
                      : null,
                ),
              ),
            ),
            if (dragging != null) Padding(padding: const EdgeInsets.only(right: 8), child: Text(clock(dragging!), style: body(13, color: Colors.white, weight: FontWeight.w700))),
          ]);
        },
      ),
    );
  }
}

class _TimeLabel extends StatelessWidget {
  const _TimeLabel({required this.playback});
  final _Playback playback;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder(
      valueListenable: playback.duration,
      builder: (context, duration, _) => ValueListenableBuilder(
        valueListenable: playback.position,
        builder: (context, position, _) => Text.rich(
          TextSpan(children: [
            TextSpan(text: clock(position), style: body(13.5, color: Colors.white, weight: FontWeight.w600)),
            TextSpan(text: ' / ${duration > 0 ? clock(duration) : '--:--'}', style: body(13.5, color: Colors.white60)),
          ]),
        ),
      ),
    );
  }
}

class _BigPlay extends StatelessWidget {
  const _BigPlay({required this.playing, required this.loading, required this.onTap});
  final bool playing;
  final bool loading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black.withValues(alpha: 0.35),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 76,
          height: 76,
          child: Stack(alignment: Alignment.center, children: [
            if (loading) const SizedBox(width: 76, height: 76, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white70)),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 180),
              transitionBuilder: (child, anim) => ScaleTransition(scale: anim, child: child),
              child: Icon(playing ? LucideIcons.pause : LucideIcons.play600, key: ValueKey(playing), size: 36, color: Colors.white),
            ),
          ]),
        ),
      ),
    );
  }
}

class _PlayerIcon extends StatelessWidget {
  const _PlayerIcon({required this.icon, required this.onTap, this.size = 24, this.tooltip});
  final IconData icon;
  final VoidCallback? onTap;
  final double size;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      tooltip: tooltip,
      iconSize: size,
      icon: Icon(icon, color: onTap == null ? Colors.white30 : Colors.white),
    );
  }
}

class _PillButton extends StatelessWidget {
  const _PillButton({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.12),
      shape: const StadiumBorder(),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 17, color: Colors.white),
            const SizedBox(width: 6),
            Text(label, style: body(13, color: Colors.white, weight: FontWeight.w600)),
          ]),
        ),
      ),
    );
  }
}

/// Індикатор перемотки подвійним дотиком (півколо з «−10 с» / «+10 с»).
class _SkipRipple extends StatelessWidget {
  const _SkipRipple({required this.dir, required this.seconds});
  final int dir;
  final int seconds;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: dir < 0 ? Alignment.centerLeft : Alignment.centerRight,
      child: FractionallySizedBox(
        widthFactor: 0.36,
        heightFactor: 1,
        child: TweenAnimationBuilder<double>(
          key: ValueKey('$dir:$seconds'),
          tween: Tween(begin: 0.6, end: 1),
          duration: const Duration(milliseconds: 260),
          curve: Curves.easeOut,
          builder: (context, t, child) => Opacity(opacity: t, child: child),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.12),
              borderRadius: dir < 0 ? const BorderRadius.horizontal(right: Radius.circular(400)) : const BorderRadius.horizontal(left: Radius.circular(400)),
            ),
            child: Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(dir < 0 ? LucideIcons.rewind : LucideIcons.fastForward, color: Colors.white, size: 30),
                const SizedBox(height: 6),
                Text(dir < 0 ? '−$seconds с' : '+$seconds с', style: body(14, color: Colors.white, weight: FontWeight.w700)),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

class _LockLayer extends StatelessWidget {
  const _LockLayer({required this.controls, required this.onUnlock});
  final ValueNotifier<bool> controls;
  final VoidCallback onUnlock;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => controls.value = !controls.value,
      child: ValueListenableBuilder(
        valueListenable: controls,
        builder: (context, visible, _) => AnimatedOpacity(
          opacity: visible ? 1 : 0,
          duration: const Duration(milliseconds: 200),
          child: Align(
            alignment: Alignment.topRight,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: _PillButton(icon: LucideIcons.lock, label: tr('Розблокувати'), onTap: onUnlock),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Поки серія не пішла: сторінка балансера видима (його ▶ чи реклама), зверху — «Назад» і підказка.
class _AssistBar extends StatelessWidget {
  const _AssistBar({required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topLeft,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Material(
              color: Colors.black.withValues(alpha: 0.55),
              shape: const CircleBorder(),
              child: IconButton(onPressed: onBack, icon: const Icon(LucideIcons.arrowLeft, color: Colors.white)),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(12)),
              child: Text(tr('Торкніться ▶ у плеєрі — далі керування перейде до GameCon'), style: body(13, color: Colors.white)),
            ),
          ]),
        ),
      ),
    );
  }
}

/// Аварійний режим: плеєр балансера не дав доступу до відео — показуємо його рідний інтерфейс.
class _NativeFallback extends StatelessWidget {
  const _NativeFallback({required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topLeft,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Material(
            color: Colors.black.withValues(alpha: 0.55),
            shape: const CircleBorder(),
            child: IconButton(onPressed: onBack, icon: const Icon(LucideIcons.arrowLeft, color: Colors.white)),
          ),
        ),
      ),
    );
  }
}

/// Список серій у плеєрі: сезони вкладками, сітка номерів, поточна й переглянуті позначені.
class _EpisodeSheet extends StatefulWidget {
  const _EpisodeSheet({required this.seasons, required this.current, required this.memory});
  final List<Season> seasons;
  final Pick? current;
  final WatchMemory memory;

  @override
  State<_EpisodeSheet> createState() => _EpisodeSheetState();
}

class _EpisodeSheetState extends State<_EpisodeSheet> {
  late int season = widget.current?.season ?? widget.seasons.first.number;

  @override
  Widget build(BuildContext context) {
    final current = widget.seasons.firstWhere((s) => s.number == season, orElse: () => widget.seasons.first);
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.8),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr('Серії'), style: display(17)),
            if (widget.seasons.length > 1)
              SizedBox(
                height: 44,
                child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(vertical: 6), children: [
                  for (final s in widget.seasons)
                    Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: SelectPill(label: tr('{n} сезон', {'n': s.number}), selected: s.number == season, onTap: () => setState(() => season = s.number)),
                    ),
                ]),
              ),
            const SizedBox(height: 10),
            Flexible(
              child: SingleChildScrollView(
                child: Wrap(spacing: 6, runSpacing: 6, children: [
                  for (final e in current.episodes)
                    _EpisodeCell(
                      number: e,
                      active: widget.current == (season: current.number, episode: e),
                      started: widget.memory.position((season: current.number, episode: e)) > 0,
                      onTap: () => Navigator.pop(context, (season: current.number, episode: e)),
                    ),
                ]),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

class _EpisodeCell extends StatelessWidget {
  const _EpisodeCell({required this.number, required this.active, required this.started, required this.onTap});
  final int number;
  final bool active;
  final bool started;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? primary : Colors.white.withValues(alpha: started ? 0.04 : 0.08),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: SizedBox(
          width: 52,
          height: 40,
          child: Center(child: Text('$number', style: body(14, color: active ? Colors.white : (started ? faint : soft), weight: active ? FontWeight.w700 : FontWeight.w500))),
        ),
      ),
    );
  }
}
