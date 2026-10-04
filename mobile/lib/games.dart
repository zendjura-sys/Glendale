import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'clans.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

const _categories = [('', 'Усі'), ('pc', 'ПК'), ('mobile', 'Мобільні'), ('console', 'Консолі')];

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
          badge: 'МУЛЬТИПЛЕЄР',
          title: 'Каталог',
          accent: 'ігор',
          text: 'ПК, мобільні й консольні ігри для гри разом. Каталог поповнюється автоматично; у кожної гри — пряме посилання й клани.',
          children: [
            Row(children: [
              Expanded(child: MetricTile(label: 'Ігор у каталозі', value: compact(total))),
              const SizedBox(width: 8),
              Expanded(
                child: GhostButton(label: 'Клани', icon: LucideIcons.swords, compact: true, onPressed: () => context.push('/clans')),
              ),
            ]),
            const SizedBox(height: 12),
            GcField(
              controller: query,
              label: 'Пошук гри',
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
                  items: [('', 'Усі жанри'), for (final g in genres) (g, g)],
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
          const EmptyState(icon: LucideIcons.gamepad2, title: 'Нічого не знайдено', text: 'Спробуйте іншу назву або букву.')
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
        const Padding(padding: EdgeInsets.only(top: 8), child: Text('Дані про ігри: IGDB і RAWG', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: faint))),
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
          if (intOf(mp['online_max']) > 0) ('Онлайн', 'до ${mp['online_max']} гравців'),
          if (intOf(mp['online_coop_max']) > 0) ('Онлайн-кооператив', 'до ${mp['online_coop_max']}'),
          if (intOf(mp['offline_max']) > 0) ('На одному пристрої', 'до ${mp['offline_max']}'),
          if (intOf(mp['offline_coop_max']) > 0) ('Локальний кооператив', 'до ${mp['offline_coop_max']}'),
        ];
        final mpFlags = [
          if (mp['online_coop'] == true) 'Онлайн-кооператив',
          if (mp['offline_coop'] == true) 'Локальний кооператив',
          if (mp['campaign_coop'] == true) 'Сюжет у кооперативі',
          if (mp['lan'] == true) 'LAN',
          if (mp['split_screen'] == true) 'Розділений екран',
          if (mp['drop_in'] == true) 'Вхід посеред гри',
        ];
        final about = <(String, String)>[
          if (_strings(d['developers']).isNotEmpty) ('Розробник', _strings(d['developers']).join(', ')),
          if (_strings(d['publishers']).isNotEmpty) ('Видавець', _strings(d['publishers']).join(', ')),
          if (text(game['released']) != null) ('Вихід', _date(game['released'])),
          if (_strings(d['engines']).isNotEmpty) ('Рушій', _strings(d['engines']).join(', ')),
          if (_strings(d['franchises']).isNotEmpty) ('Серія', _strings(d['franchises']).join(', ')),
          if (_strings(d['perspectives']).isNotEmpty) ('Камера', _strings(d['perspectives']).join(', ')),
          if (_strings(d['themes']).isNotEmpty) ('Теми', _strings(d['themes']).join(', ')),
          if (beat.isNotEmpty)
            ('Проходження', [
              if (beat['hastily'] != null) 'швидко ${beat['hastily']} год',
              if (beat['normally'] != null) 'зазвичай ${beat['normally']} год',
              if (beat['completely'] != null) 'на 100% ${beat['completely']} год',
            ].join(' · ')),
          if (intOf(d['hypes']) > 0) ('Очікують', '${d['hypes']} гравців'),
        ];

        Widget score(String label, String key) {
          final value = intOf(ratings[key]);
          if (value <= 0) return const SizedBox.shrink();
          final color = value >= 75 ? green : (value >= 50 ? gold : dangerSoft);
          return Expanded(
            child: Column(children: [
              Text('$value', style: display(24, color: color)),
              Text(label, style: body(12, color: muted)),
              if (intOf(ratings['${key}_count']) > 0) Text('${ratings['${key}_count']} оцінок', style: body(11, color: faint)),
            ]),
          );
        }

        return ScreenScroll(
          onRefresh: reload,
          children: [
            if (artwork != null) ...[NetImage(artwork, height: 170, radius: 22), const SizedBox(height: 12)],
            Glass(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  GameCover(game, size: 84),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(text(game['name']) ?? '', style: display(20)),
                      const SizedBox(height: 6),
                      Text(platformsLabel(game, 8), style: body(12.5, color: muted)),
                      Row(children: [
                        if (game['year'] != null) Text('${game['year']} р.  ', style: body(12.5, color: faint)),
                        if (game['rating'] != null) ...[
                          const Icon(LucideIcons.star, size: 13, color: gold),
                          Text(' ${(game['rating'] as num).toStringAsFixed(1)}  ', style: body(12.5, color: soft)),
                        ],
                        for (final a in _strings(d['age_ratings'])) Padding(padding: const EdgeInsets.only(right: 4), child: Pill(label: a)),
                      ]),
                    ]),
                  ),
                ]),
                if (modes.isNotEmpty || genres.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    for (final m in modes) Pill(label: text(m['label']) ?? '', color: primary),
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
                      child: PrimaryButton(label: text(l['label']) ?? 'Відкрити', icon: LucideIcons.externalLink, compact: true, onPressed: () => _open(text(l['url'])!)),
                    ),
                ],
              ]),
            ),
            if (videos.isNotEmpty || shots.isNotEmpty)
              _section('Трейлери й скриншоти', LucideIcons.images, [
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
              _section('Мультиплеєр', LucideIcons.usersRound, [
                for (final r in mpRows) _fact(r.$1, r.$2),
                if (mpFlags.isNotEmpty) Wrap(spacing: 6, runSpacing: 6, children: [for (final f in mpFlags) Pill(label: f, color: green)]),
              ]),
            if (intOf(ratings['total']) > 0 || intOf(ratings['critics']) > 0 || intOf(ratings['players']) > 0)
              _section('Рейтинги', LucideIcons.star, [
                Row(children: [score('Загальний', 'total'), score('Критики', 'critics'), score('Гравці', 'players')]),
              ]),
            if (about.isNotEmpty || text(d['storyline']) != null)
              _section('Про гру', LucideIcons.gamepad2, [
                for (final r in about) _fact(r.$1, r.$2),
                if (text(d['storyline']) != null)
                  Theme(
                    data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                    child: ExpansionTile(
                      tilePadding: EdgeInsets.zero,
                      title: Text('Сюжет', style: body(14, weight: FontWeight.w600)),
                      children: [Text(text(d['storyline'])!, style: body(13.5, color: soft).copyWith(height: 1.45))],
                    ),
                  ),
              ]),
            if (maps(d['release_dates']).length > 1)
              _section('Дати виходу', LucideIcons.calendarDays, [
                for (final r in maps(d['release_dates'])) _fact(text(r['platform']) ?? '', _date(r['date'])),
              ]),
            if (langs.isNotEmpty)
              _section('Мови', LucideIcons.languages, [
                Pill(
                  label: ua == null
                      ? 'Української локалізації немає'
                      : 'Українська: ${[if (ua['interface'] == true) 'інтерфейс', if (ua['subtitles'] == true) 'субтитри', if (ua['audio'] == true) 'озвучення'].join(', ')}',
                  color: ua == null ? muted : green,
                ),
                const SizedBox(height: 10),
                for (final l in langs)
                  _fact(text(l['name']) ?? '', [
                    if (l['interface'] == true) 'інтерфейс',
                    if (l['subtitles'] == true) 'субтитри',
                    if (l['audio'] == true) 'озвучення',
                  ].join(', ')),
              ]),
            if (sites.isNotEmpty || text(d['igdb_url']) != null)
              _section('Спільнота й посилання', LucideIcons.globe, [
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final w in sites) GhostButton(label: text(w['label']) ?? '', icon: LucideIcons.externalLink, expand: false, compact: true, onPressed: () => _open(text(w['url'])!)),
                  if (text(d['igdb_url']) != null) GhostButton(label: 'IGDB', icon: LucideIcons.externalLink, expand: false, compact: true, onPressed: () => _open(text(d['igdb_url'])!)),
                ]),
              ]),
            if (features['clans'] != false) ...[
              SectionLabel('Клани й гільдії', trailing: 'Створити', onTrailing: () => context.push('/clans/create?game=$slug')),
              if (clans.isEmpty)
                EmptyState(icon: LucideIcons.swords, title: 'Кланів ще немає', text: 'Створіть перший клан або гільдію для цієї гри.', action: 'Створити', onAction: () => context.push('/clans/create?game=$slug'))
              else
                for (final c in clans) Padding(padding: const EdgeInsets.only(bottom: 8), child: ClanTile(c)),
            ],
            if (similar.isNotEmpty) ...[
              const SectionLabel('Схожі ігри'),
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
