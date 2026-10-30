import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'clans.dart';
import 'events.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';
import 'i18n.dart';
import 'extras.dart';

final _categories = [('', tr('Усі')), ('pc', tr('ПК')), ('mobile', tr('Мобільні')), ('console', tr('Консолі'))];

/// Обкладинка гри або заглушка з іконкою.
class GameCover extends StatelessWidget {
  const GameCover(this.game, {this.size = 52, super.key});
  final Map<String, dynamic> game;
  final double size;

  @override
  Widget build(BuildContext context) {
    final cover = text(game['cover']);
    if (cover != null) return NetImage(cover, width: size, height: size, radius: 12);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: raised, borderRadius: BorderRadius.circular(12)),
      child: Icon(LucideIcons.gamepad2, color: muted, size: size * 0.42),
    );
  }
}

String platformsLabel(Map<String, dynamic> game, [int limit = 3]) => maps(game['platforms']).map((p) => text(p['label']) ?? '').where((s) => s.isNotEmpty).take(limit).join(' · ');

/// Каталог мультиплеєрних ігор: розділи, пошук і покажчик A–Z.
class GamesScreen extends StatefulWidget {
  const GamesScreen({super.key});

  @override
  State<GamesScreen> createState() => _GamesScreenState();
}

class _GamesScreenState extends State<GamesScreen> {
  final query = TextEditingController();
  final scroll = ScrollController();
  Timer? debounce;
  String category = '';
  String? letter;
  String? mode;
  String? genre;
  String sort = 'popular';
  Map<String, dynamic> modes = const {};
  Map<String, dynamic> sorts = const {};
  List<String> genres = const [];
  List<String> letters = const [];
  List<Map<String, dynamic>> games = [];
  int page = 1;
  int last = 1;
  int total = 0;
  bool loading = false;

  @override
  void initState() {
    super.initState();
    scroll.addListener(() {
      if (scroll.position.pixels > scroll.position.maxScrollExtent - 600) _more();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    query.dispose();
    scroll.dispose();
    debounce?.cancel();
    super.dispose();
  }

  Future<void> _load({bool append = false}) async {
    if (loading) return;
    loading = true;
    final api = AppScope.read(context).session.api;
    final next = append ? page + 1 : 1;
    final params = Uri(queryParameters: {
      if (query.text.trim().isNotEmpty) 'q': query.text.trim(),
      if (category.isNotEmpty) 'category': category,
      'letter': ?letter,
      'mode': ?mode,
      'genre': ?genre,
      if (sort != 'popular') 'sort': sort,
      'page': '$next',
    }).query;
    try {
      final data = await api.get('/api/v1/games?$params');
      final listing = Listing.parse(data['games']);
      if (!mounted) return;
      setState(() {
        games = append ? [...games, ...listing.items] : listing.items;
        page = listing.current;
        last = listing.last;
        total = intOf(data['total']);
        letters = (data['letters'] is List ? (data['letters'] as List) : const []).map((l) => '$l').toList();
        modes = mapOf(data['modes'])..remove('single');
        sorts = mapOf(data['sorts']);
        genres = (data['genres'] is List ? (data['genres'] as List) : const []).map((g) => '$g').toList();
      });
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      loading = false;
    }
  }

  void _more() {
    if (page < last && !loading) _load(append: true);
  }

  void _pickLetter(String? value) {
    setState(() => letter = letter == value ? null : value);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScroll(
      controller: scroll,
      onRefresh: _load,
      children: [
        HeroCard(
          badge: tr('МУЛЬТИПЛЕЄР'),
          title: tr('Каталог'),
          accent: tr('ігор'),
          text: tr('ПК, мобільні й консольні ігри для гри разом. Каталог поповнюється автоматично; у кожної гри — пряме посилання й клани.'),
          children: [
            Row(children: [
              Expanded(child: MetricTile(label: tr('Ігор у каталозі'), value: compact(total))),
              const SizedBox(width: 8),
              Expanded(
                child: GhostButton(label: tr('Клани'), icon: LucideIcons.swords, compact: true, onPressed: () => context.push('/clans')),
              ),
            ]),
            const SizedBox(height: 12),
            GcField(
              controller: query,
              label: tr('Пошук гри'),
              icon: LucideIcons.search,
              dense: true,
              onChanged: (_) {
                debounce?.cancel();
                debounce = Timer(const Duration(milliseconds: 350), _load);
              },
            ),
            const SizedBox(height: 10),
            ChipRow(
              options: _categories,
              selected: category,
              onSelect: (value) {
                setState(() {
                  category = value;
                  letter = null;
                });
                _load();
              },
            ),
          ],
        ),
        if (modes.isNotEmpty) ...[
          const SizedBox(height: 12),
          SizedBox(
            height: 38,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (final e in modes.entries)
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: SelectPill(
                      label: '${e.value}',
                      selected: mode == e.key,
                      onTap: () {
                        setState(() => mode = mode == e.key ? null : e.key);
                        _load();
                      },
                    ),
                  ),
              ],
            ),
          ),
        ],
        if (genres.isNotEmpty || sorts.isNotEmpty) ...[
          const SizedBox(height: 10),
          Row(children: [
            if (genres.isNotEmpty)
              Expanded(
                child: GcSelect<String>(
                  value: genre ?? '',
                  expand: true,
                  items: [('', tr('Усі жанри')), for (final g in genres) (g, g)],
                  onChanged: (value) {
                    setState(() => genre = (value ?? '').isEmpty ? null : value);
                    _load();
                  },
                ),
              ),
            if (genres.isNotEmpty && sorts.isNotEmpty) const SizedBox(width: 8),
            if (sorts.isNotEmpty)
              Expanded(
                child: GcSelect<String>(
                  value: sort,
                  expand: true,
                  items: [for (final e in sorts.entries) (e.key, '${e.value}')],
                  onChanged: (value) {
                    setState(() => sort = value ?? 'popular');
                    _load();
                  },
                ),
              ),
          ]),
        ],
        const SizedBox(height: 12),
        if (letters.isNotEmpty)
          SizedBox(
            height: 38,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                Padding(padding: const EdgeInsets.only(right: 6), child: SelectPill(label: 'A–Z', selected: letter == null, onTap: () => _pickLetter(null))),
                for (final l in letters) Padding(padding: const EdgeInsets.only(right: 6), child: SelectPill(label: l, selected: letter == l, onTap: () => _pickLetter(l))),
              ],
            ),
          ),
        const SizedBox(height: 12),
        if (games.isEmpty && !loading)
          EmptyState(icon: LucideIcons.gamepad2, title: tr('Нічого не знайдено'), text: tr('Спробуйте іншу назву або букву.'))
        else
          for (final g in games)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Glass(
                padding: const EdgeInsets.all(10),
                radius: 18,
                onTap: () => context.push('/games/${g['slug']}'),
                child: Row(children: [
                  GameCover(g),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(text(g['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(15, weight: FontWeight.w600)),
                      const SizedBox(height: 3),
                      Text(platformsLabel(g), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
                    ]),
                  ),
                  Pill(label: text(g['category_label']) ?? '', color: soft),
                ]),
              ),
            ),
        if (page < last) const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator(strokeWidth: 2.4))),
        Padding(padding: EdgeInsets.only(top: 8), child: Text(tr('Дані про ігри: IGDB і RAWG'), textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: faint))),
      ],
    );
  }
}

/// Сторінка гри: опис, медіа, мультиплеєр, рейтинги, компанії, мови, магазини, спільнота, клани й схожі ігри.
/// Розділи, вимкнені в адмінці, сервер не віддає — тут вони просто не показуються.
class GameScreen extends StatelessWidget {
  const GameScreen({required this.slug, super.key});
  final String slug;

  static List<String> _strings(dynamic value) => (value is List ? value : const []).map((v) => '$v').where((v) => v.isNotEmpty).toList();

  static String _date(dynamic iso) {
    final d = DateTime.tryParse(text(iso) ?? '');
    return d == null ? '—' : '${d.day.toString().padLeft(2, '0')}.${d.month.toString().padLeft(2, '0')}.${d.year}';
  }

  Widget _section(String title, IconData icon, List<Widget> children) => Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [CardTitle(title, icon: icon), const SizedBox(height: 10), ...children])),
      );

  Widget _fact(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 120, child: Text(label, style: body(12.5, color: faint))),
          Expanded(child: Text(value, style: body(13.5, color: soft))),
        ]),
      );

  void _open(String url) => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);

  void _showImage(BuildContext context, String url) {
    showDialog<void>(
      context: context,
      builder: (dialog) => GestureDetector(
        onTap: () => Navigator.pop(dialog),
        child: InteractiveViewer(child: Center(child: NetImage(url.replaceFirst('t_screenshot_big', 't_1080p'), fit: BoxFit.contain))),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get('/api/v1/games/$slug'),
      builder: (data, reload) {
        final game = mapOf(data['game']);
        final d = mapOf(game['details']);
        final features = mapOf(data['features']);
        final links = maps(game['links']);
        final clans = maps(data['clans']);
        final events = maps(data['events']);
        final similar = maps(data['similar']);
        final modes = maps(game['modes']);
        final genres = _strings(game['genres']);
        final videos = maps(d['videos']);
        final shots = _strings(d['screenshots']);
        final mp = mapOf(d['multiplayer']);
        final ratings = mapOf(d['ratings']);
        final langs = maps(d['languages']);
        final sites = maps(d['websites']);
        final beat = mapOf(d['time_to_beat']);
        final ua = langs.where((l) => l['name'] == 'Українська').firstOrNull;
        final artwork = _strings(d['artworks']).firstOrNull;

        final mpRows = <(String, String)>[
          if (intOf(mp['online_max']) > 0) (tr('Онлайн'), tr('до {v} гравців', {'v': mp['online_max']})),
          if (intOf(mp['online_coop_max']) > 0) (tr('Онлайн-кооператив'), tr('до {v}', {'v': mp['online_coop_max']})),
          if (intOf(mp['offline_max']) > 0) (tr('На одному пристрої'), tr('до {v}', {'v': mp['offline_max']})),
          if (intOf(mp['offline_coop_max']) > 0) (tr('Локальний кооператив'), tr('до {v}', {'v': mp['offline_coop_max']})),
        ];
        final mpFlags = [
          if (mp['online_coop'] == true) tr('Онлайн-кооператив'),
          if (mp['offline_coop'] == true) tr('Локальний кооператив'),
          if (mp['campaign_coop'] == true) tr('Сюжет у кооперативі'),
          if (mp['lan'] == true) 'LAN',
          if (mp['split_screen'] == true) tr('Розділений екран'),
          if (mp['drop_in'] == true) tr('Вхід посеред гри'),
        ];
        final about = <(String, String)>[
          if (_strings(d['developers']).isNotEmpty) (tr('Розробник'), _strings(d['developers']).join(', ')),
          if (_strings(d['publishers']).isNotEmpty) (tr('Видавець'), _strings(d['publishers']).join(', ')),
          if (text(game['released']) != null) (tr('Вихід'), _date(game['released'])),
          if (_strings(d['engines']).isNotEmpty) (tr('Рушій'), _strings(d['engines']).join(', ')),
          if (_strings(d['franchises']).isNotEmpty) (tr('Серія'), _strings(d['franchises']).join(', ')),
          if (_strings(d['perspectives']).isNotEmpty) (tr('Камера'), _strings(d['perspectives']).join(', ')),
          if (_strings(d['themes']).isNotEmpty) (tr('Теми'), _strings(d['themes']).join(', ')),
          if (beat.isNotEmpty)
            (tr('Проходження'), [
              if (beat['hastily'] != null) tr('швидко {v} год', {'v': beat['hastily']}),
              if (beat['normally'] != null) tr('зазвичай {v} год', {'v': beat['normally']}),
              if (beat['completely'] != null) tr('на 100% {v} год', {'v': beat['completely']}),
            ].join(' · ')),
          if (intOf(d['hypes']) > 0) (tr('Очікують'), tr('{v} гравців', {'v': d['hypes']})),
        ];

        Widget score(String label, String key) {
          final value = intOf(ratings[key]);
          if (value <= 0) return const SizedBox.shrink();
          final color = value >= 75 ? green : (value >= 50 ? gold : dangerSoft);
          return Expanded(
            child: Column(children: [
              Text('$value', style: display(24, color: color)),
              Text(label, style: body(12, color: muted)),
              if (intOf(ratings['${key}_count']) > 0) Text(tr('{v} оцінок', {'v': ratings['${key}_count']}), style: body(11, color: faint)),
            ]),
          );
        }

        final palette = mapOf(data['palette']);
        final accent = hexColor(palette['accent']) ?? primary;
        final soft2 = hexColor(palette['soft']) ?? const Color(0xFF9DD8FF);
        final base = hexColor(palette['base']);

        return ScreenScroll(
          onRefresh: reload,
          children: [
            _GameHero(game: game, poster: artwork ?? text(game['cover']), ages: _strings(d['age_ratings']), accent: accent, base: base),
            if (game['id'] != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Align(
                  alignment: Alignment.centerRight,
                  child: SubjectActions(kind: 'game', id: game['id'], saved: data['saved'] == true, following: data['following'] == true, pinned: data['pinned'] == true, size: 38),
                ),
              ),
            Glass(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (modes.isNotEmpty || genres.isNotEmpty) ...[
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    for (final m in modes) Pill(label: text(m['label']) ?? '', color: soft2, background: accent.withValues(alpha: 0.18)),
                    for (final g in genres) Pill(label: g),
                  ]),
                ],
                if (text(d['summary']) != null) ...[
                  const SizedBox(height: 12),
                  Text(text(d['summary'])!, style: body(14, color: soft).copyWith(height: 1.45)),
                ],
                if (links.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  for (final l in links)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: PrimaryButton(label: text(l['label']) ?? tr('Відкрити'), icon: LucideIcons.externalLink, compact: true, onPressed: () => _open(text(l['url'])!)),
                    ),
                ],
              ]),
            ),
            if (videos.isNotEmpty || shots.isNotEmpty)
              _section(tr('Трейлери й скриншоти'), LucideIcons.images, [
                SizedBox(
                  height: 120,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      for (final v in videos)
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: GestureDetector(
                            onTap: () => _open('https://www.youtube.com/watch?v=${v['id']}'),
                            child: Stack(alignment: Alignment.center, children: [
                              NetImage('https://i.ytimg.com/vi/${v['id']}/hqdefault.jpg', width: 200, height: 120, radius: 14),
                              Container(
                                width: 44,
                                height: 44,
                                decoration: const BoxDecoration(color: Color(0x99000000), shape: BoxShape.circle),
                                child: const Icon(LucideIcons.play, color: Colors.white),
                              ),
                            ]),
                          ),
                        ),
                      for (final shot in shots)
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: GestureDetector(onTap: () => _showImage(context, shot), child: NetImage(shot, width: 200, height: 120, radius: 14)),
                        ),
                    ],
                  ),
                ),
              ]),
            if (mpRows.isNotEmpty || mpFlags.isNotEmpty)
              _section(tr('Мультиплеєр'), LucideIcons.usersRound, [
                for (final r in mpRows) _fact(r.$1, r.$2),
                if (mpFlags.isNotEmpty) Wrap(spacing: 6, runSpacing: 6, children: [for (final f in mpFlags) Pill(label: f, color: green)]),
              ]),
            if (intOf(ratings['total']) > 0 || intOf(ratings['critics']) > 0 || intOf(ratings['players']) > 0)
              _section(tr('Рейтинги'), LucideIcons.star, [
                Row(children: [score(tr('Загальний'), 'total'), score(tr('Критики'), 'critics'), score(tr('Гравці'), 'players')]),
              ]),
            if (about.isNotEmpty || text(d['storyline']) != null)
              _section(tr('Про гру'), LucideIcons.gamepad2, [
                for (final r in about) _fact(r.$1, r.$2),
                if (text(d['storyline']) != null)
                  Theme(
                    data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                    child: ExpansionTile(
                      tilePadding: EdgeInsets.zero,
                      title: Text(tr('Сюжет'), style: body(14, weight: FontWeight.w600)),
                      children: [Text(text(d['storyline'])!, style: body(13.5, color: soft).copyWith(height: 1.45))],
                    ),
                  ),
              ]),
            if (maps(d['release_dates']).length > 1)
              _section(tr('Дати виходу'), LucideIcons.calendarDays, [
                for (final r in maps(d['release_dates'])) _fact(text(r['platform']) ?? '', _date(r['date'])),
              ]),
            if (langs.isNotEmpty)
              _section(tr('Мови'), LucideIcons.languages, [
                Pill(
                  label: ua == null
                      ? tr('Української локалізації немає')
                      : tr('Українська: {v}', {'v': [if (ua['interface'] == true) 'інтерфейс', if (ua['subtitles'] == true) 'субтитри', if (ua['audio'] == true) 'озвучення'].join(', ')}),
                  color: ua == null ? muted : green,
                ),
                const SizedBox(height: 10),
                for (final l in langs)
                  _fact(text(l['name']) ?? '', [
                    if (l['interface'] == true) tr('інтерфейс'),
                    if (l['subtitles'] == true) tr('субтитри'),
                    if (l['audio'] == true) tr('озвучення'),
                  ].join(', ')),
              ]),
            if (sites.isNotEmpty || text(d['igdb_url']) != null)
              _section(tr('Спільнота й посилання'), LucideIcons.globe, [
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final w in sites) GhostButton(label: text(w['label']) ?? '', icon: LucideIcons.externalLink, expand: false, compact: true, onPressed: () => _open(text(w['url'])!)),
                  if (text(d['igdb_url']) != null) GhostButton(label: 'IGDB', icon: LucideIcons.externalLink, expand: false, compact: true, onPressed: () => _open(text(d['igdb_url'])!)),
                ]),
              ]),
            if (events.isNotEmpty) ...[
              SectionLabel(tr('Події гри'), trailing: tr('Календар'), onTrailing: () => context.push('/events')),
              for (final e in events)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: EventTile(
                    event: e,
                    onRsvp: (going) async {
                      final url = text(e['rsvp_url']);
                      if (url != null && await attempt(context, () => api.post(Api.site(url), {'going': going}))) reload();
                    },
                  ),
                ),
              const SizedBox(height: 4),
            ],
            if (features['clans'] != false) ...[
              SectionLabel(tr('Клани й гільдії'), trailing: tr('Створити'), onTrailing: () => context.push('/clans/create?game=$slug')),
              if (clans.isEmpty)
                EmptyState(icon: LucideIcons.swords, title: tr('Кланів ще немає'), text: tr('Створіть перший клан або гільдію для цієї гри.'), action: tr('Створити'), onAction: () => context.push('/clans/create?game=$slug'))
              else
                for (final c in clans) Padding(padding: const EdgeInsets.only(bottom: 8), child: ClanTile(c)),
            ],
            if (similar.isNotEmpty) ...[
              SectionLabel(tr('Схожі ігри')),
              SizedBox(
                height: 150,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    for (final g in similar)
                      GestureDetector(
                        onTap: () => context.push('/games/${g['slug']}'),
                        child: Container(
                          width: 120,
                          margin: const EdgeInsets.only(right: 10),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            GameCover(g, size: 110),
                            const SizedBox(height: 6),
                            Text(text(g['name']) ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(12.5)),
                          ]),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}


/// Колір із «#rrggbb» (палітра постера з сервера).
Color? hexColor(dynamic value) {
  final hex = text(value);
  if (hex == null || !RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(hex)) return null;
  return Color(int.parse('FF${hex.substring(1)}', radix: 16));
}

/// Постер гри на всю ширину: назва, рік, платформи й оцінка зверху, знизу постер розчиняється у фон.
/// Кольори — свотчі Palette API, які рахує сервер (ті самі, що й на сайті).
class _GameHero extends StatelessWidget {
  const _GameHero({required this.game, required this.poster, required this.ages, required this.accent, this.base});
  final Map<String, dynamic> game;
  final String? poster;
  final List<String> ages;
  final Color accent;
  final Color? base;

  @override
  Widget build(BuildContext context) {
    final rating = game['rating'];
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Stack(clipBehavior: Clip.none, children: [
        Positioned(
          left: -40,
          right: -40,
          top: -30,
          height: 380,
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(-0.4, -0.3),
                  radius: 0.9,
                  colors: [accent.withValues(alpha: 0.32), (base ?? accent).withValues(alpha: 0.12), Colors.transparent],
                ),
              ),
            ),
          ),
        ),
        ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          child: SizedBox(
            height: 300,
            width: double.infinity,
            child: Stack(fit: StackFit.expand, children: [
              ShaderMask(
                blendMode: BlendMode.dstIn,
                shaderCallback: (rect) => const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.black, Colors.black, Colors.transparent],
                  stops: [0, 0.45, 1],
                ).createShader(rect),
                child: poster != null ? NetImage(poster) : Container(color: raised),
              ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Color(0xCC000000), Color(0x59000000), Colors.transparent],
                    stops: [0, 0.35, 0.7],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(
                    text(game['name']) ?? '',
                    style: display(26).copyWith(fontWeight: FontWeight.w800, shadows: const [Shadow(color: Color(0x99000000), blurRadius: 12)]),
                  ),
                  const SizedBox(height: 8),
                  Wrap(spacing: 10, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                    if (game['year'] != null) Text('${game['year']}', style: body(13, color: fg.withValues(alpha: 0.88), weight: FontWeight.w600)),
                    if (platformsLabel(game, 8).isNotEmpty) Text(platformsLabel(game, 8), style: body(13, color: fg.withValues(alpha: 0.85), weight: FontWeight.w500)),
                    if (rating is num)
                      Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(LucideIcons.star, size: 14, color: gold),
                        const SizedBox(width: 3),
                        Text(rating.toStringAsFixed(1), style: body(13, color: Colors.white, weight: FontWeight.w600)),
                      ]),
                  ]),
                  if (ages.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Wrap(spacing: 6, children: [
                      for (final a in ages)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(6), border: Border.all(color: fg.withValues(alpha: 0.3))),
                          child: Text(a, style: body(11.5, color: fg.withValues(alpha: 0.9), weight: FontWeight.w500)),
                        ),
                    ]),
                  ],
                ]),
              ),
            ]),
          ),
        ),
      ]),
    );
  }
}
