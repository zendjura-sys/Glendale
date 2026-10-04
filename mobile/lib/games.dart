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
        const Padding(padding: EdgeInsets.only(top: 8), child: Text('Дані про ігри: RAWG.io', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: faint))),
      ],
    );
  }
}

/// Сторінка гри: платформи, пряме посилання в магазин і клани.
class GameScreen extends StatelessWidget {
  const GameScreen({required this.slug, super.key});
  final String slug;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get('/api/v1/games/$slug'),
      builder: (data, reload) {
        final game = mapOf(data['game']);
        final links = maps(game['links']);
        final clans = maps(data['clans']);
        final genres = (game['genres'] is List ? game['genres'] as List : const []).map((g) => '$g').toList();
        return ScreenScroll(
          onRefresh: reload,
          children: [
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
                      if (game['year'] != null) Text('${game['year']} р.', style: body(12.5, color: faint)),
                    ]),
                  ),
                ]),
                if (genres.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Wrap(spacing: 6, runSpacing: 6, children: [for (final g in genres) Pill(label: g)]),
                ],
                if (links.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  for (final l in links)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: PrimaryButton(
                        label: text(l['label']) ?? 'Відкрити',
                        icon: LucideIcons.externalLink,
                        compact: true,
                        onPressed: () => launchUrl(Uri.parse(text(l['url'])!), mode: LaunchMode.externalApplication),
                      ),
                    ),
                ],
              ]),
            ),
            SectionLabel('Клани й гільдії', trailing: 'Створити', onTrailing: () => context.push('/clans/create?game=$slug')),
            if (clans.isEmpty)
              EmptyState(icon: LucideIcons.swords, title: 'Кланів ще немає', text: 'Створіть перший клан або гільдію для цієї гри.', action: 'Створити', onAction: () => context.push('/clans/create?game=$slug'))
            else
              for (final c in clans) Padding(padding: const EdgeInsets.only(bottom: 8), child: ClanTile(c)),
          ],
        );
      },
    );
  }
}
