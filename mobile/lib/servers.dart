import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'characters.dart';
import 'tournaments.dart';
import 'extras.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';
import 'i18n.dart';
import 'skeletons.dart';

List<(String, String)> _serverSorts(bool votes) => [
      ('online', tr('За онлайном')),
      if (votes) ('votes', tr('За голосами')),
      ('families', tr('За сім’ями')),
      ('name', tr('За назвою')),
      ('new', tr('Нові')),
    ];

class ServersScreen extends StatefulWidget {
  const ServersScreen({super.key});

  @override
  State<ServersScreen> createState() => _ServersScreenState();
}

class _ServersScreenState extends State<ServersScreen> {
  Map<String, dynamic>? page;
  String platform = '';
  String sort = 'online';
  // Мова серверів: null — як вирішить сервер (мова інтерфейсу, якщо такі сервери є).
  String? lang;
  final query = TextEditingController();
  Timer? debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    query.dispose();
    debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final api = AppScope.read(context).session.api;
    final params = Uri(queryParameters: {if (platform.isNotEmpty) 'platform': platform, if (query.text.trim().isNotEmpty) 'q': query.text.trim(), 'sort': sort, 'lang': ?lang}).query;
    try {
      final data = await api.get(Api.site('/servers?$params'));
      if (mounted) setState(() => page = data);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _suggest() async {
    final options = mapOf(page?['options']);
    final sent = await showGcSheet<bool>(
      context,
      title: tr('Додати сервер'),
      subtitle: tr('Сервер з’явиться в каталозі після перевірки модератором.'),
      builder: (sheet) => _SuggestServer(options: options, language: text(mapOf(page?['filters'])['lang']), onDone: () => Navigator.pop(sheet, true)),
    );
    if (sent == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final data = page;
    if (data == null) return const ScreenSkeleton();
    final stats = mapOf(data['stats']);
    final servers = maps(data['servers']);
    final mine = maps(data['my_suggestions']);
    final languages = maps(data['languages']);
    final selectedLang = text(mapOf(data['filters'])['lang']) ?? 'all';
    return ScreenScroll(
      onRefresh: _load,
      children: [
        HeroCard(
          badge: tr('🇺🇦 ЗРОБЛЕНО В УКРАЇНІ'),
          tint: gold,
          title: text(data['heading']) ?? tr('Усі'),
          accent: 'GTA RP',
          after: tr('сервери'),
          text: tr('ПК і мобільні проєкти з живим онлайном. Іконки, онлайн і Discord оновлюються автоматично. Не знайшли свій сервер — додайте його.'),
          children: [
            Row(children: [
              Expanded(child: MetricTile(label: tr('Гравців онлайн'), value: compact(stats['online']), gradient: const LinearGradient(colors: [Color(0xFF34D399), Color(0xFF38E1FF)]))),
              const SizedBox(width: 8),
              Expanded(child: MetricTile(label: tr('Серверів'), value: '${stats['servers'] ?? 0}')),
              const SizedBox(width: 8),
              Expanded(child: MetricTile(label: tr('Сімей'), value: compact(stats['families']))),
            ]),
            const SizedBox(height: 14),
            Segmented(
              scroll: true,
              options: [
                SegmentOption('', tr('Усі'), icon: LucideIcons.server, count: stats['servers']),
                SegmentOption('pc', tr('ПК'), icon: LucideIcons.monitor, count: stats['pc']),
                SegmentOption('mobile', tr('Мобільні'), icon: LucideIcons.smartphone, count: stats['mobile']),
              ],
              selected: platform,
              onSelect: (value) {
                setState(() => platform = value);
                _load();
              },
            ),
            const SizedBox(height: 10),
            GcField(
              controller: query,
              label: tr('Пошук сервера'),
              icon: LucideIcons.search,
              dense: true,
              onChanged: (_) {
                debounce?.cancel();
                debounce = Timer(const Duration(milliseconds: 350), _load);
              },
            ),
            const SizedBox(height: 10),
            GcSelect<String>(
              value: sort,
              expand: true,
              items: _serverSorts(data['votes'] is Map),
              onChanged: (value) {
                setState(() => sort = value ?? 'online');
                _load();
              },
            ),
            if (languages.length > 1) ...[
              const SizedBox(height: 10),
              GcSelect<String>(
                value: selectedLang,
                expand: true,
                items: [('all', tr('Усі мови')), for (final l in languages) ('${l['code']}', '${l['native']} · ${l['count']}')],
                onChanged: (value) {
                  setState(() => lang = value ?? 'all');
                  _load();
                },
              ),
            ],
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: PrimaryButton(label: tr('Додати сервер'), icon: LucideIcons.plus, onPressed: _suggest)),
              const SizedBox(width: 8),
              Expanded(child: GhostButton(label: tr('Порівняти'), icon: LucideIcons.gitCompareArrows, onPressed: () => context.push('/servers/compare'))),
            ]),
          ],
        ),
        if (mine.isNotEmpty) ...[
          const SizedBox(height: 12),
          Glass(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              CardTitle(tr('Ваші пропозиції'), icon: LucideIcons.send),
              const SizedBox(height: 8),
              for (final s in mine)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(text(s['name']) ?? '', style: body(14, weight: FontWeight.w600)),
                        if (text(s['review_note']) != null) Text(text(s['review_note'])!, style: body(12, color: muted)),
                      ]),
                    ),
                    Pill(label: s['status'] == 'rejected' ? tr('Відхилено') : tr('На перевірці'), color: s['status'] == 'rejected' ? dangerSoft : gold),
                  ]),
                ),
            ]),
          ),
        ],
        if (data['votes'] is Map) ...[
          const SizedBox(height: 12),
          VoteTops(votes: mapOf(data['votes'])),
        ],
        const SizedBox(height: 12),
        if (servers.isEmpty)
          EmptyState(icon: LucideIcons.server, title: tr('Серверів не знайдено'), text: tr('Спробуйте інший запит або додайте сервер.'))
        else
          for (final server in servers) Padding(padding: const EdgeInsets.only(bottom: 10), child: ServerCard(server: server)),
        Glass(
          child: Row(children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(gradient: buttonGradient, borderRadius: BorderRadius.circular(16)),
              child: const Icon(LucideIcons.crown, color: Colors.white),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr('Керуєте сім’єю на сервері?'), style: display(15)),
                const SizedBox(height: 4),
                Text(tr('Звіти, банк і виплати, склад, дисципліна й рейтинг — усе в одній панелі.'), style: body(12.5, color: muted)),
                const SizedBox(height: 10),
                GhostButton(label: tr('Створити сім’ю'), icon: LucideIcons.plus, compact: true, expand: false, onPressed: () => context.push('/families/create')),
              ]),
            ),
          ]),
        ),
      ],
    );
  }
}

class ServerIcon extends StatelessWidget {
  const ServerIcon({required this.server, this.size = 52, super.key});
  final Map<String, dynamic> server;
  final double size;

  @override
  Widget build(BuildContext context) {
    final icon = text(server['icon']);
    if (icon != null) return SizedBox(width: size, height: size, child: NetImage(icon, radius: size * 0.26));
    final name = text(server['name']) ?? '?';
    final letters = name.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).take(2).map((w) => w[0]).join().toUpperCase();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(gradient: buttonGradient, borderRadius: BorderRadius.circular(size * 0.26)),
      child: Text(letters, style: display(size * 0.32)),
    );
  }
}

class ServerCard extends StatelessWidget {
  const ServerCard({required this.server, super.key});
  final Map<String, dynamic> server;

  @override
  Widget build(BuildContext context) {
    final online = server['players_online'];
    final max = intOf(server['players_max']);
    final progress = online is num && max > 0 ? (online / max).clamp(0.0, 1.0).toDouble() : null;
    return Glass(
      padding: const EdgeInsets.all(14),
      border: server['is_featured'] == true ? gold.withValues(alpha: 0.35) : null,
      onTap: () => context.push('/servers/${server['slug']}'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          ServerIcon(server: server),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: Text(text(server['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: display(16))),
                if (server['is_featured'] == true) const Padding(padding: EdgeInsets.only(left: 6), child: Icon(LucideIcons.sparkles, size: 16, color: gold)),
              ]),
              const SizedBox(height: 6),
              Wrap(spacing: 6, runSpacing: 4, children: [
                Pill(label: text(server['platform_label']) ?? '', icon: server['platform'] == 'mobile' ? LucideIcons.smartphone : LucideIcons.monitor),
                Pill(label: text(server['multiplayer_label']) ?? '', color: const Color(0xFFB79CFF)),
                Pill(label: (text(server['language']) ?? 'uk') == 'uk' ? '🇺🇦 UA' : (text(server['language']) ?? '').toUpperCase(), color: gold),
              ]),
            ]),
          ),
        ]),
        if (text(server['tagline']) != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(text(server['tagline'])!, style: body(13, color: soft))),
        const SizedBox(height: 10),
        if (online is num) ...[
          Row(children: [
            Container(width: 8, height: 8, decoration: const BoxDecoration(color: green, shape: BoxShape.circle)),
            const SizedBox(width: 6),
            Text(tr('{v} онлайн', {'v': compact(online)}), style: body(12.5, color: green, weight: FontWeight.w600)),
            const Spacer(),
            if (max > 0) Text(tr('з {v}', {'v': compact(max)}), style: body(12, color: muted)),
          ]),
          if (progress != null) ...[
            const SizedBox(height: 6),
            ClipRRect(borderRadius: BorderRadius.circular(4), child: LinearProgressIndicator(value: progress, minHeight: 4, color: primary, backgroundColor: fg.withValues(alpha: 0.06))),
          ],
        ] else if (server['discord_members'] != null)
          Text(tr('{v} у Discord · {v2} в мережі', {'v': compact(server['discord_members']), 'v2': compact(server['discord_online'])}), style: body(12.5, color: muted)),
        const SizedBox(height: 10),
        Row(children: [
          if (text(server['connect']) != null)
            Flexible(
              child: GestureDetector(
                onTap: () {
                  Clipboard.setData(ClipboardData(text: text(server['connect'])!));
                  toast(context, tr('Адресу скопійовано.'));
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(color: fg.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(10)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(LucideIcons.copy, size: 13, color: muted),
                    const SizedBox(width: 6),
                    Flexible(child: Text(text(server['connect'])!, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: soft).copyWith(fontFamily: 'monospace'))),
                  ]),
                ),
              ),
            )
          else
            Text('${server['families_count'] ?? 0} ${plural(intOf(server['families_count']), 'сім’я', 'сім’ї', 'сімей')}', style: body(12, color: muted)),
          const Spacer(),
          if (text(server['website']) != null) RoundIcon(icon: LucideIcons.globe, size: 34, onTap: () => launchUrl(Uri.parse(text(server['website'])!), mode: LaunchMode.externalApplication)),
          if (text(server['discord']) != null) RoundIcon(icon: LucideIcons.messagesSquare, size: 34, onTap: () => launchUrl(Uri.parse(text(server['discord'])!), mode: LaunchMode.externalApplication)),
        ]),
      ]),
    );
  }
}

class _SuggestServer extends StatefulWidget {
  const _SuggestServer({required this.options, required this.onDone, this.language});
  final Map<String, dynamic> options;
  final String? language;
  final VoidCallback onDone;

  @override
  State<_SuggestServer> createState() => _SuggestServerState();
}

class _SuggestServerState extends State<_SuggestServer> {
  final name = TextEditingController();
  final tagline = TextEditingController();
  final website = TextEditingController();
  final discord = TextEditingController();
  final telegram = TextEditingController();
  final connect = TextEditingController();
  String platform = 'pc';
  String multiplayer = 'ragemp';
  late String language = widget.language != null && widget.language != 'all' ? widget.language! : 'uk';
  bool busy = false;

  @override
  void dispose() {
    for (final c in [name, tagline, website, discord, telegram, connect]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => busy = true);
    try {
      final result = await AppScope.read(context).session.api.post(Api.site('/servers/suggest'), {
        'name': name.text.trim(),
        'platform': platform,
        'multiplayer': multiplayer,
        'language': language,
        if (tagline.text.trim().isNotEmpty) 'tagline': tagline.text.trim(),
        if (website.text.trim().isNotEmpty) 'website': website.text.trim(),
        if (discord.text.trim().isNotEmpty) 'discord': discord.text.trim(),
        if (telegram.text.trim().isNotEmpty) 'telegram': telegram.text.trim(),
        if (connect.text.trim().isNotEmpty) 'connect': connect.text.trim(),
      });
      if (mounted) toast(context, text(result['message']) ?? tr('Дякуємо!'));
      widget.onDone();
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final platforms = mapOf(widget.options['platforms']);
    final multiplayers = mapOf(widget.options['multiplayers']);
    final languages = mapOf(widget.options['languages']);
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        LabeledField(label: tr('Назва'), child: GcField(controller: name, label: tr('Наприклад, «Quant RP»'), onChanged: (_) => setState(() {}))),
        const SizedBox(height: 10),
        Segmented(
          options: [for (final e in platforms.entries) SegmentOption(e.key, '${e.value}')],
          selected: platform,
          onSelect: (value) => setState(() => platform = value),
        ),
        const SizedBox(height: 10),
        LabeledField(
          label: tr('Мультиплеєр'),
          child: GcSelect<String>(value: multiplayers.containsKey(multiplayer) ? multiplayer : null, expand: true, items: [for (final e in multiplayers.entries) (e.key, '${e.value}')], onChanged: (v) => setState(() => multiplayer = v ?? multiplayer)),
        ),
        const SizedBox(height: 10),
        if (languages.isNotEmpty) ...[
          LabeledField(
            label: tr('Мова сервера'),
            child: GcSelect<String>(value: languages.containsKey(language) ? language : null, expand: true, items: [for (final e in languages.entries) (e.key, '${e.value}')], onChanged: (v) => setState(() => language = v ?? language)),
          ),
          const SizedBox(height: 10),
        ],
        LabeledField(label: tr('Коротко'), child: GcField(controller: tagline, label: tr('Чим сервер особливий'))),
        const SizedBox(height: 10),
        LabeledField(label: tr('Сайт'), child: GcField(controller: website, label: 'https://', keyboard: TextInputType.url)),
        const SizedBox(height: 10),
        LabeledField(label: 'Discord', child: GcField(controller: discord, label: tr('discord.gg/код'))),
        const SizedBox(height: 10),
        LabeledField(label: 'Telegram', child: GcField(controller: telegram, label: tr('https://t.me/… або @канал'))),
        const SizedBox(height: 10),
        LabeledField(label: tr('Адреса підключення'), child: GcField(controller: connect, label: tr('ip:port або домен:port'))),
        const SizedBox(height: 16),
        PrimaryButton(label: tr('Надіслати на перевірку'), busy: busy, onPressed: name.text.trim().length >= 2 ? _submit : null),
      ]),
    );
  }
}

class ServerScreen extends StatelessWidget {
  const ServerScreen({required this.slug, super.key});
  final String slug;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.of(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/servers/$slug')),
      builder: (data, reload) {
        final server = mapOf(data['server']);
        final families = maps(data['families']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            Row(children: [
              RoundIcon(icon: LucideIcons.arrowLeft, onTap: () => context.canPop() ? context.pop() : context.go('/servers')),
              const SizedBox(width: 8),
              Text(tr('Сервери'), style: body(14, color: muted)),
              const Spacer(),
              if (server['id'] != null)
                SubjectActions(kind: 'server', id: server['id'], saved: data['saved'] == true, following: data['following'] == true, pinned: data['pinned'] == true, size: 36),
            ]),
            const SizedBox(height: 10),
            ServerCard(server: server),
            if (data['votes'] is Map) ...[
              const SizedBox(height: 12),
              VotePanel(slug: slug, votes: mapOf(data['votes'])),
            ],
            if (data['tournaments'] is Map && maps(mapOf(data['tournaments'])['list']).isNotEmpty) ...[
              const SizedBox(height: 12),
              Glass(
                padding: const EdgeInsets.fromLTRB(12, 14, 12, 6),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  CardTitle(tr('Турніри'), icon: LucideIcons.trophy, trailing: tr('Усі'), onTrailing: () => context.push('/tournaments')),
                  for (final t in maps(mapOf(data['tournaments'])['list'])) TournamentTile(tournament: t, showServer: false),
                ]),
              ),
            ],
            if (data['characters'] is List) ...[
              const SizedBox(height: 12),
              CharactersPanel(
                characters: maps(data['characters']),
                title: tr('Персонажі гравців'),
                createPath: '/characters/create?server=$slug',
                showPlayer: true,
                empty: tr('Тут з’являться персонажі гравців цього сервера: біографії, сім’ї й історії.'),
              ),
            ],
            if (text(server['description']) != null) ...[
              const SizedBox(height: 12),
              Glass(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  CardTitle(tr('Про сервер'), icon: LucideIcons.info),
                  const SizedBox(height: 10),
                  Text(text(server['description'])!, style: body(14, color: soft).copyWith(height: 1.5)),
                ]),
              ),
            ],
            if (text(server['telegram']) != null) ...[
              const SizedBox(height: 12),
              GhostButton(label: 'Telegram', icon: LucideIcons.send, onPressed: () => launchUrl(Uri.parse(text(server['telegram'])!), mode: LaunchMode.externalApplication)),
            ],
            SectionLabel(tr('Сім’ї сервера')),
            if (families.isEmpty)
              EmptyState(icon: LucideIcons.crown, title: tr('Сімей поки немає'), text: tr('Станьте першими — створіть сім’ю на цьому сервері.'), action: tr('Створити сім’ю'), onAction: () => context.push('/families/create'))
            else
              Glass(
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
                child: Column(children: [
                  for (var i = 0; i < families.length; i++)
                    ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                      leading: SizedBox(
                        width: 64,
                        child: Row(children: [
                          SizedBox(width: 20, child: Text('${i + 1}', style: body(13, color: i < 3 ? gold : muted, weight: FontWeight.w700))),
                          Avatar(url: text(families[i]['logo_url']), name: text(families[i]['tag']) ?? '?', size: 40, square: true),
                        ]),
                      ),
                      title: Text('[${families[i]['tag']}] ${families[i]['name']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14.5, weight: FontWeight.w600)),
                      subtitle: Text(tr('{v} учасників · {v2} балів', {'v': families[i]['members_count'] ?? 0, 'v2': compact(families[i]['score'])}), style: body(12, color: muted)),
                      onTap: () => context.push('/families/${families[i]['slug']}'),
                    ),
                ]),
              ),
          ],
        );
      },
    );
  }
}

/// Топ серверів за голосами: сьогодні або цього місяця.
class VoteTops extends StatefulWidget {
  const VoteTops({required this.votes, super.key});
  final Map<String, dynamic> votes;

  @override
  State<VoteTops> createState() => _VoteTopsState();
}

class _VoteTopsState extends State<VoteTops> {
  late String period = maps(widget.votes['day']).isNotEmpty ? 'day' : 'month';

  @override
  Widget build(BuildContext context) {
    final day = maps(widget.votes['day']);
    final month = maps(widget.votes['month']);
    if (day.isEmpty && month.isEmpty) return const SizedBox.shrink();
    final rows = period == 'day' ? day : month;
    final voted = widget.votes['voted_today'];
    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        CardTitle(tr('Топ за голосами'), icon: LucideIcons.trophy),
        const SizedBox(height: 4),
        Text(
          voted != null ? tr('Ваш голос на сьогодні вже віддано. Новий — завтра.') : tr('Один голос на день: відкрийте сервер і натисніть «Голосувати».'),
          style: body(12.5, color: muted),
        ),
        const SizedBox(height: 10),
        Segmented(
          options: [SegmentOption('day', tr('Сьогодні')), SegmentOption('month', tr('Місяць'))],
          selected: period,
          onSelect: (value) => setState(() => period = value),
        ),
        const SizedBox(height: 6),
        if (rows.isEmpty)
          Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text(tr('Сьогодні ще ніхто не голосував.'), style: body(13, color: muted)))
        else
          for (var i = 0; i < rows.length; i++)
            InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () => context.push('/servers/${rows[i]['slug']}'),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 2),
                child: Row(children: [
                  SizedBox(width: 22, child: Text('${i + 1}', style: body(13, color: i < 3 ? gold : muted, weight: FontWeight.w700))),
                  ServerIcon(server: rows[i], size: 36),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(text(rows[i]['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, weight: FontWeight.w600)),
                      Text(text(rows[i]['platform_label']) ?? '', style: body(11.5, color: muted)),
                    ]),
                  ),
                  Pill(label: '${voted == rows[i]['id'] ? '✓ ' : ''}${compact(rows[i]['votes'])}', icon: LucideIcons.vote),
                ]),
              ),
            ),
      ]),
    );
  }
}

/// Голосування на сторінці сервера; власник бачить голоси за 30 днів.
class VotePanel extends StatefulWidget {
  const VotePanel({required this.slug, required this.votes, super.key});
  final String slug;
  final Map<String, dynamic> votes;

  @override
  State<VotePanel> createState() => _VotePanelState();
}

class _VotePanelState extends State<VotePanel> {
  late Map<String, dynamic> votes = widget.votes;
  bool sending = false;

  Future<void> _vote() async {
    setState(() => sending = true);
    try {
      final result = await AppScope.read(context).session.api.post('/api/v1/servers/${widget.slug}/vote');
      if (!mounted) return;
      setState(() => votes = mapOf(result['votes']));
      toast(context, tr('Голос зараховано. Наступний — завтра.'));
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final votedHere = votes['voted_here'] == true;
    final voted = votes['voted_today'] != null;
    final daily = maps(votes['daily']);
    final peak = daily.fold<int>(1, (max, day) => (day['votes'] as num? ?? 0) > max ? (day['votes'] as num).toInt() : max);
    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        CardTitle(tr('Голосування'), icon: LucideIcons.vote),
        const SizedBox(height: 4),
        Text(
          votes['rank'] != null ? tr('{rank} місце в топі місяця', {'rank': votes['rank']}) : tr('Голосуйте щодня — сервер підніметься в топі.'),
          style: body(13, color: muted),
        ),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: MetricTile(label: tr('Сьогодні'), value: compact(votes['today']))),
          const SizedBox(width: 8),
          Expanded(child: MetricTile(label: tr('За місяць'), value: compact(votes['month']))),
          const SizedBox(width: 8),
          Expanded(child: MetricTile(label: tr('Усього'), value: compact(votes['total']))),
        ]),
        const SizedBox(height: 12),
        if (voted)
          GhostButton(
            label: votedHere ? tr('Ви вже голосували сьогодні') : tr('Голос віддано іншому серверу'),
            icon: votedHere ? LucideIcons.check : LucideIcons.vote,
            onPressed: null,
          )
        else
          PrimaryButton(label: tr('Голосувати'), icon: LucideIcons.vote, busy: sending, onPressed: sending ? null : _vote),
        if (daily.isNotEmpty) ...[
          const SizedBox(height: 14),
          Text(tr('Голоси за 30 днів — бачать власник і модератори'), style: body(12, color: muted)),
          const SizedBox(height: 8),
          SizedBox(
            height: 72,
            child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              for (final day in daily)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 1),
                    child: FractionallySizedBox(
                      heightFactor: ((day['votes'] as num? ?? 0) / peak).clamp(0.05, 1.0).toDouble(),
                      alignment: Alignment.bottomCenter,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: indigo.withValues(alpha: (day['votes'] as num? ?? 0) == 0 ? 0.25 : 0.8),
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
                        ),
                      ),
                    ),
                  ),
                ),
            ]),
          ),
        ],
      ]),
    );
  }
}
