import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'games.dart';
import 'shell.dart';
import 'state.dart';
import 'theme.dart';
import 'voice_room.dart';
import 'listen_rooms.dart';
import 'widgets.dart';
import 'i18n.dart';

String _num(dynamic value) {
  final digits = '${intOf(value).abs()}';
  final out = StringBuffer(intOf(value) < 0 ? '−' : '');
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) out.write(' ');
    out.write(digits[i]);
  }
  return '$out';
}

/// Логотип клану або його тег на градієнті.
class ClanLogo extends StatelessWidget {
  const ClanLogo(this.clan, {this.size = 48, super.key});
  final Map<String, dynamic> clan;
  final double size;

  @override
  Widget build(BuildContext context) {
    final logo = text(clan['logo_url']);
    if (logo != null) return NetImage(logo, width: size, height: size, radius: size / 4);
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(gradient: buttonGradient, borderRadius: BorderRadius.circular(size / 4)),
      child: Text(text(clan['tag']) ?? '', style: body(size / 4, color: Colors.white, weight: FontWeight.w700)),
    );
  }
}

/// Рядок клану в списках.
class ClanTile extends StatelessWidget {
  const ClanTile(this.clan, {super.key});
  final Map<String, dynamic> clan;

  @override
  Widget build(BuildContext context) {
    final game = mapOf(clan['game']);
    return Glass(
      padding: const EdgeInsets.all(10),
      radius: 18,
      onTap: () => context.push('/clans/${clan['slug']}'),
      child: Row(children: [
        ClanLogo(clan),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(text(clan['display_name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14.5, weight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text(text(game['name']) ?? '—', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
            const SizedBox(height: 2),
            Row(children: [
              Icon(LucideIcons.usersRound, size: 13, color: faint),
              const SizedBox(width: 4),
              Text(compact(clan['members_count']), style: body(12, color: faint)),
              const SizedBox(width: 10),
              if (clan['pending'] == true)
                Text(tr('заявка на розгляді'), style: body(12, color: gold))
              else if (clan['is_recruiting'] == true)
                Text(tr('набір відкрито'), style: body(12, color: green)),
            ]),
          ]),
        ),
      ]),
    );
  }
}

/// Клани й гільдії: мої та пошук за назвою, типом і грою.
class ClansScreen extends StatefulWidget {
  const ClansScreen({this.game, super.key});
  final String? game;

  @override
  State<ClansScreen> createState() => _ClansScreenState();
}

class _ClansScreenState extends State<ClansScreen> {
  final query = TextEditingController();
  Timer? debounce;
  String type = '';
  late String? game = widget.game;
  Map<String, dynamic>? data;

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
    final params = Uri(queryParameters: {
      if (query.text.trim().isNotEmpty) 'q': query.text.trim(),
      if (type.isNotEmpty) 'type': type,
      'game': ?game,
    }).query;
    try {
      final result = await api.get(Api.site('/clans?$params'));
      if (mounted) setState(() => data = result);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) return const Center(child: CircularProgressIndicator(strokeWidth: 2.4));
    final mine = maps(d['mine']);
    final clans = Listing.parse(d['clans']).items;
    final types = mapOf(d['types']);
    final filterGame = mapOf(mapOf(d['filters'])['game']);
    return ScreenScroll(
      onRefresh: _load,
      children: [
        HeroCard(
          badge: tr('КЛАНИ Й ГІЛЬДІЇ'),
          title: tr('Грайте'),
          accent: tr('командою'),
          text: tr('Знайдіть клан для своєї гри або створіть власний: новини, заходи, скарбниця, голосові кімнати й чат.'),
          children: [
            PrimaryButton(label: tr('Створити клан або гільдію'), icon: LucideIcons.plus, onPressed: () => context.push('/clans/create${game == null ? '' : '?game=$game'}')),
            const SizedBox(height: 10),
            GcField(
              controller: query,
              label: tr('Назва або тег'),
              icon: LucideIcons.search,
              dense: true,
              onChanged: (_) {
                debounce?.cancel();
                debounce = Timer(const Duration(milliseconds: 350), _load);
              },
            ),
            const SizedBox(height: 10),
            ChipRow(
              options: [('', tr('Усі')), for (final e in types.entries) (e.key, '${e.value}')],
              selected: type,
              onSelect: (value) {
                setState(() => type = value);
                _load();
              },
            ),
            if (filterGame.isNotEmpty) ...[
              const SizedBox(height: 10),
              SelectPill(
                label: '${filterGame['name']}  ✕',
                selected: true,
                onTap: () {
                  setState(() => game = null);
                  _load();
                },
              ),
            ],
          ],
        ),
        if (mine.isNotEmpty) ...[
          SectionLabel(tr('Мої')),
          for (final c in mine) Padding(padding: const EdgeInsets.only(bottom: 8), child: ClanTile(c)),
        ],
        SectionLabel(tr('Знайти клан')),
        if (clans.isEmpty)
          EmptyState(icon: LucideIcons.swords, title: tr('Кланів не знайдено'), text: tr('Створіть свій — оберіть гру й потрібні розділи.'))
        else
          for (final c in clans) Padding(padding: const EdgeInsets.only(bottom: 8), child: ClanTile(c)),
      ],
    );
  }
}

/// Створення клану: тип (префікс у назві), гра з каталогу, назва, розділи, вступ.
class ClanCreateScreen extends StatefulWidget {
  const ClanCreateScreen({this.game, super.key});
  final String? game;

  @override
  State<ClanCreateScreen> createState() => _ClanCreateScreenState();
}

class _ClanCreateScreenState extends State<ClanCreateScreen> {
  Map<String, dynamic>? options;
  final name = TextEditingController();
  final tag = TextEditingController();
  final description = TextEditingController();
  final gameQuery = TextEditingController();
  Timer? debounce;
  String type = 'clan';
  String joinMode = 'request';
  Set<String> features = {};
  Map<String, dynamic>? game;
  List<Map<String, dynamic>> results = [];
  bool busy = false;

  Api get api => AppScope.read(context).session.api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final data = await api.get(Api.site('/clans/create${widget.game == null ? '' : '?game=${widget.game}'}'));
        if (!mounted) return;
        setState(() {
          options = data;
          features = (data['default_features'] is List ? data['default_features'] as List : const []).map((f) => '$f').toSet();
          final preset = mapOf(data['game']);
          if (preset.isNotEmpty) game = preset;
        });
        _search();
      } catch (e) {
        if (mounted) toast(context, e);
      }
    });
  }

  @override
  void dispose() {
    for (final c in [name, tag, description, gameQuery]) {
      c.dispose();
    }
    debounce?.cancel();
    super.dispose();
  }

  Future<void> _search() async {
    try {
      final data = await api.get('/api/v1/games/search?q=${Uri.encodeQueryComponent(gameQuery.text.trim())}');
      if (mounted) setState(() => results = maps(data['games']));
    } catch (_) {}
  }

  Future<void> _create() async {
    if (game == null) return toast(context, tr('Оберіть гру.'));
    setState(() => busy = true);
    try {
      final result = await api.post(Api.site('/clans'), {
        'type': type,
        'name': name.text.trim(),
        'tag': tag.text.trim().toUpperCase(),
        'game_id': game!['id'],
        'description': description.text.trim(),
        'features': features.toList(),
        'join_mode': joinMode,
      });
      if (!mounted) return;
      final redirect = text(result['redirect']);
      if (redirect != null) context.pushReplacement(appPathFor(redirect));
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Widget _step(String title, List<Widget> children) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [CardTitle(title), const SizedBox(height: 10), ...children])),
      );

  @override
  Widget build(BuildContext context) {
    final o = options;
    if (o == null) return const Center(child: CircularProgressIndicator(strokeWidth: 2.4));
    final types = mapOf(o['types']);
    final allFeatures = mapOf(o['features']);
    final joinModes = mapOf(o['join_modes']);
    final typeLabel = '${types[type] ?? ''}';
    return ScreenScroll(
      children: [
        PageTitle(tr('Новий клан або гільдія'), subtitle: tr('Тип додається префіксом до назви. Розділи можна змінити пізніше.')),
        _step(tr('1. Тип'), [
          Row(children: [
            for (final e in types.entries) ...[
              Expanded(child: SelectPill(label: '${e.value}', selected: type == e.key, onTap: () => setState(() => type = e.key))),
              if (e.key != types.keys.last) const SizedBox(width: 8),
            ],
          ]),
          const SizedBox(height: 8),
          Text('[$typeLabel] ${name.text.trim().isEmpty ? 'Назва' : name.text.trim()}', style: body(13, color: muted)),
        ]),
        _step(tr('2. Гра{v}', {'v': game == null ? '' : ' — ${game!['name']}'}), [
          GcField(
            controller: gameQuery,
            label: tr('Знайти гру: CS2, PUBG Mobile, Dota 2…'),
            icon: LucideIcons.search,
            dense: true,
            onChanged: (_) {
              debounce?.cancel();
              debounce = Timer(const Duration(milliseconds: 300), _search);
            },
          ),
          const SizedBox(height: 8),
          for (final g in results)
            InkWell(
              onTap: () => setState(() => game = g),
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(children: [
                  GameCover(g, size: 38),
                  const SizedBox(width: 10),
                  Expanded(child: Text(text(g['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14))),
                  if (game?['id'] == g['id']) Icon(LucideIcons.check, color: primary, size: 18),
                ]),
              ),
            ),
        ]),
        _step(tr('3. Назва й опис'), [
          GcField(controller: name, label: tr('Назва'), onChanged: (_) => setState(() {})),
          const SizedBox(height: 8),
          GcField(controller: tag, label: tr('Тег (2–6 літер або цифр)')),
          const SizedBox(height: 8),
          GcField(controller: description, label: tr('Про клан: чим займаєтесь, кого шукаєте'), maxLines: 4, minLines: 2),
        ]),
        _step(tr('4. Що буде в клані'), [
          Text(tr('Склад, заявки, ранги й права є завжди.'), style: body(12.5, color: muted)),
          const SizedBox(height: 6),
          for (final e in allFeatures.entries)
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: features.contains(e.key),
              activeColor: primary,
              title: Text('${mapOf(e.value)['label']}', style: body(14, weight: FontWeight.w600)),
              subtitle: Text('${mapOf(e.value)['text']}', style: body(12, color: muted)),
              onChanged: (on) => setState(() => on == true ? features.add(e.key) : features.remove(e.key)),
            ),
        ]),
        _step(tr('5. Як вступати'), [
          ChipRow(options: [for (final e in joinModes.entries) (e.key, '${e.value}')], selected: joinMode, onSelect: (v) => setState(() => joinMode = v)),
        ]),
        PrimaryButton(label: tr('Створити {toLowerCase}', {'toLowerCase': typeLabel.toLowerCase()}), icon: LucideIcons.swords, busy: busy, onPressed: game == null ? null : _create),
      ],
    );
  }
}

/// Сторінка клану з розділами, які увімкнув засновник, і керуванням за правами рангу.
class ClanScreen extends StatefulWidget {
  const ClanScreen({required this.slug, super.key});
  final String slug;

  @override
  State<ClanScreen> createState() => _ClanScreenState();
}

class _ClanScreenState extends State<ClanScreen> {
  Map<String, dynamic>? data;
  String tab = 'overview';

  Api get api => AppScope.read(context).session.api;
  String get base => '/clans/${widget.slug}';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final result = await api.get(Api.site(base));
      if (mounted) setState(() => data = result);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _act(String path, [Map<String, dynamic>? body]) async {
    if (await attempt(context, () => api.post(Api.site('$base$path'), body))) await _load();
  }

  Future<void> _delete(String path) async {
    if (await attempt(context, () => api.delete(Api.site('$base$path')))) await _load();
  }

  Future<void> _chat() async {
    try {
      final result = await api.get(Api.site('$base/chat'));
      final redirect = text(result['redirect']);
      if (redirect != null && mounted) context.push(appPathFor(redirect));
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) return const Center(child: CircularProgressIndicator(strokeWidth: 2.4));
    final clan = mapOf(d['clan']);
    final me = d['me'] is Map ? mapOf(d['me']) : null;
    final can = mapOf(me?['can']);
    final has = (clan['features'] is List ? clan['features'] as List : const []).map((f) => '$f').toSet();
    final applications = maps(d['applications']);
    final tabs = <SegmentOption>[
      SegmentOption('overview', tr('Огляд'), icon: LucideIcons.swords),
      if (me != null && has.contains('news')) SegmentOption('news', tr('Новини'), icon: LucideIcons.newspaper),
      if (me != null && has.contains('events')) SegmentOption('events', tr('Заходи'), icon: LucideIcons.calendarDays),
      if (me != null && has.contains('treasury')) SegmentOption('treasury', tr('Внески'), icon: LucideIcons.coins),
      if (me != null && has.contains('rating')) SegmentOption('rating', tr('Рейтинг'), icon: LucideIcons.trophy),
      if (text(clan['rules']) != null) SegmentOption('rules', tr('Статут'), icon: LucideIcons.scrollText),
      if (me != null) SegmentOption('members', tr('Учасники'), icon: LucideIcons.usersRound, count: applications.isEmpty ? null : applications.length),
      if (can['settings.manage'] == true) SegmentOption('settings', tr('Налаштування'), icon: LucideIcons.settings),
    ];
    final current = tabs.any((t) => t.id == tab) ? tab : 'overview';
    final game = mapOf(clan['game']);

    return ScreenScroll(
      onRefresh: _load,
      children: [
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              ClanLogo(clan, size: 64),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(text(clan['display_name']) ?? '', style: display(18)),
                  const SizedBox(height: 4),
                  Wrap(spacing: 10, children: [
                    Text('[${clan['tag']}]', style: body(12.5, color: primary, weight: FontWeight.w700)),
                    if (game.isNotEmpty) GestureDetector(onTap: () => context.push('/games/${game['slug']}'), child: Text(text(game['name']) ?? '', style: body(12.5, color: muted))),
                    Text(tr('{v} учасн.', {'v': clan['members_count']}), style: body(12.5, color: muted)),
                    if (clan['treasury'] != null) Text('${_num(clan['treasury'])} ${clan['currency']}', style: body(12.5, color: gold)),
                  ]),
                ]),
              ),
            ]),
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: [
              if (clan['conversation_id'] != null) GhostButton(label: tr('Чат'), icon: LucideIcons.messageCircle, expand: false, compact: true, onPressed: _chat),
              if (me == null && d['application'] == null && clan['is_recruiting'] == true)
                PrimaryButton(
                  label: clan['join_mode'] == 'open' ? tr('Вступити') : tr('Подати заявку'),
                  icon: LucideIcons.userPlus,
                  expand: false,
                  compact: true,
                  onPressed: () async {
                    final note = clan['join_mode'] == 'open' ? '' : await askText(context, tr('Заявка до клану'), hint: tr('Кілька слів про себе'), action: tr('Надіслати'), maxLines: 3);
                    if (note != null) _act('/join', {'note': note});
                  },
                ),
              if (d['application'] != null) GhostButton(label: tr('Заявка на розгляді · відкликати'), expand: false, compact: true, onPressed: () => _act('/leave')),
              if (me != null && me['is_owner'] != true)
                GhostButton(
                  label: tr('Вийти'),
                  icon: LucideIcons.logOut,
                  expand: false,
                  compact: true,
                  onPressed: () async {
                    if (await confirm(context, tr('Вийти з клану?'), danger: true, action: tr('Вийти'))) _act('/leave');
                  },
                ),
            ]),
          ]),
        ),
        const SizedBox(height: 12),
        Segmented(scroll: true, options: tabs, selected: current, onSelect: (v) => setState(() => tab = v)),
        const SizedBox(height: 12),
        ...switch (current) {
          'news' => _news(d, can),
          'events' => _events(d, can),
          'treasury' => _treasury(d, clan, can),
          'rating' => _rating(d, clan),
          'rules' => [Glass(child: Text(text(clan['rules']) ?? '', style: body(14, color: soft).copyWith(height: 1.45)))],
          'members' => _members(d, me!, clan),
          'settings' => [_ClanSettings(key: ValueKey(clan['id']), data: d, onSave: (body) => _act('/settings', body))],
          _ => _overview(d, clan, me, has),
        },
      ],
    );
  }

  List<Widget> _overview(Map<String, dynamic> d, Map<String, dynamic> clan, Map<String, dynamic>? me, Set<String> has) {
    final owner = mapOf(clan['owner']);
    final news = maps(d['news']);
    final events = maps(d['events']);
    return [
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CardTitle(tr('Про клан'), icon: LucideIcons.swords),
          const SizedBox(height: 8),
          Text(text(clan['description']) ?? tr('Опису поки немає.'), style: body(14, color: soft).copyWith(height: 1.45)),
          const SizedBox(height: 10),
          Text(tr('{v} · засновник {v2}', {'v': mapOf(d['join_modes'])[clan['join_mode']] ?? '', 'v2': text(owner['name']) ?? '—'}), style: body(12, color: faint)),
        ]),
      ),
      if (me != null && has.contains('voice')) ...[
        const SizedBox(height: 12),
        VoiceRoomsPanel(key: ValueKey('voice-clan-${clan['id']}'), type: 'clan', id: intOf(clan['id']), label: text(clan['display_name']) ?? '', route: base),
      ],
      if (me != null) ListenRoomPanel(key: ValueKey('listen-clan-${clan['id']}'), type: 'clan', id: intOf(clan['id'])),
      if (news.isNotEmpty) ...[
        const SizedBox(height: 12),
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            CardTitle(tr('Останні новини'), icon: LucideIcons.newspaper, trailing: tr('Усі'), onTrailing: () => setState(() => tab = 'news')),
            for (final n in news.take(3)) Padding(padding: const EdgeInsets.only(top: 10), child: Text(text(n['title']) ?? '', style: body(14, weight: FontWeight.w600))),
          ]),
        ),
      ],
      if (events.isNotEmpty) ...[
        const SizedBox(height: 12),
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            CardTitle(tr('Найближчі заходи'), icon: LucideIcons.calendarDays, trailing: tr('Усі'), onTrailing: () => setState(() => tab = 'events')),
            for (final e in events.take(3)) Padding(padding: const EdgeInsets.only(top: 10), child: Text('${shortStamp(e['starts_at'])} — ${e['title']}', style: body(14))),
          ]),
        ),
      ],
      if (me == null) Padding(padding: EdgeInsets.only(top: 14), child: Text(tr('Новини, заходи, внески й голосові кімнати бачать лише учасники.'), textAlign: TextAlign.center, style: TextStyle(color: muted, fontSize: 13))),
    ];
  }

  List<Widget> _news(Map<String, dynamic> d, Map<String, dynamic> can) {
    final news = maps(d['news']);
    final canPost = can['news.post'] == true;
    return [
      if (canPost) PrimaryButton(label: tr('Нова новина'), icon: LucideIcons.plus, onPressed: _postNews),
      if (news.isEmpty) QuietEmpty(icon: LucideIcons.newspaper, text: tr('Новин ще немає.')),
      for (final n in news)
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Glass(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                if (n['is_pinned'] == true) const Padding(padding: EdgeInsets.only(right: 6), child: Icon(LucideIcons.pin, size: 15, color: gold)),
                Expanded(child: Text(text(n['title']) ?? '', style: body(15, weight: FontWeight.w600))),
                if (n['mine'] == true || canPost)
                  IconButton(
                    icon: Icon(LucideIcons.trash2, size: 17, color: faint),
                    onPressed: () async {
                      if (await confirm(context, tr('Видалити новину?'), danger: true, action: tr('Видалити'))) _delete('/news/${n['id']}');
                    },
                  ),
              ]),
              Text(text(n['body']) ?? '', style: body(14, color: soft).copyWith(height: 1.45)),
              const SizedBox(height: 8),
              Text('${mapOf(n['user'])['name'] ?? ''} · ${ago(n['created_at'])}', style: body(12, color: faint)),
            ]),
          ),
        ),
    ];
  }

  Future<void> _postNews() async {
    final title = TextEditingController();
    final text_ = TextEditingController();
    var pinned = false;
    final sent = await showGcSheet<bool>(
      context,
      title: tr('Нова новина'),
      builder: (sheet) => StatefulBuilder(
        builder: (context, setSheet) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          GcField(controller: title, label: tr('Заголовок')),
          const SizedBox(height: 8),
          GcField(controller: text_, label: tr('Текст новини'), maxLines: 8, minLines: 4),
          SwitchListTile(contentPadding: EdgeInsets.zero, value: pinned, activeThumbColor: primary, title: Text(tr('Закріпити'), style: body(14)), onChanged: (v) => setSheet(() => pinned = v)),
          PrimaryButton(label: tr('Опублікувати'), onPressed: () => Navigator.pop(sheet, true)),
        ]),
      ),
    );
    if (sent == true) await _act('/news', {'title': title.text.trim(), 'body': text_.text.trim(), 'is_pinned': pinned});
    title.dispose();
    text_.dispose();
  }

  List<Widget> _events(Map<String, dynamic> d, Map<String, dynamic> can) {
    final events = maps(d['events']);
    final manage = can['events.manage'] == true;
    return [
      if (manage) PrimaryButton(label: tr('Новий захід'), icon: LucideIcons.plus, onPressed: _newEvent),
      if (events.isEmpty) QuietEmpty(icon: LucideIcons.calendarDays, text: tr('Найближчих заходів немає.')),
      for (final e in events)
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Glass(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(fullDate(e['starts_at']), style: body(12, color: primary, weight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text(text(e['title']) ?? '', style: body(15, weight: FontWeight.w600)),
              if (text(e['description']) != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(text(e['description'])!, style: body(13.5, color: muted))),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(child: Text(tr('Іде: {v}', {'v': e['going_count']}), style: body(12.5, color: faint))),
                if (e['going'] == true)
                  PrimaryButton(label: tr('Іду'), icon: LucideIcons.check, expand: false, compact: true, onPressed: () => _act('/events/${e['id']}/rsvp'))
                else
                  GhostButton(label: tr('Піду'), expand: false, compact: true, onPressed: () => _act('/events/${e['id']}/rsvp')),
                if (manage)
                  IconButton(
                    icon: Icon(LucideIcons.trash2, size: 17, color: faint),
                    onPressed: () async {
                      if (await confirm(context, tr('Видалити захід?'), danger: true, action: tr('Видалити'))) _delete('/events/${e['id']}');
                    },
                  ),
              ]),
            ]),
          ),
        ),
    ];
  }

  Future<void> _newEvent() async {
    final title = TextEditingController();
    final details = TextEditingController();
    final now = DateTime.now();
    final date = await showDatePicker(context: context, firstDate: now, lastDate: now.add(const Duration(days: 365)), initialDate: now);
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(now.add(const Duration(hours: 1))));
    if (time == null || !mounted) return;
    final at = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    final sent = await showGcSheet<bool>(
      context,
      title: tr('Новий захід'),
      subtitle: tr('{v}.{v2} о {v3}', {'v': at.day.toString().padLeft(2, '0'), 'v2': at.month.toString().padLeft(2, '0'), 'v3': time.format(context)}),
      builder: (sheet) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        GcField(controller: title, label: tr('Рейд, турнір, збір…')),
        const SizedBox(height: 8),
        GcField(controller: details, label: tr('Деталі (необов’язково)'), maxLines: 4, minLines: 2),
        const SizedBox(height: 12),
        PrimaryButton(label: tr('Створити захід'), onPressed: () => Navigator.pop(sheet, true)),
      ]),
    );
    if (sent == true) await _act('/events', {'title': title.text.trim(), 'description': details.text.trim(), 'starts_at': at.toUtc().toIso8601String()});
    title.dispose();
    details.dispose();
  }

  List<Widget> _treasury(Map<String, dynamic> d, Map<String, dynamic> clan, Map<String, dynamic> can) {
    final manage = can['treasury.manage'] == true;
    final currency = text(clan['currency']) ?? '';
    final rows = maps(d['contributions']);
    Future<void> money(String path, String title, String hint) async {
      final amount = TextEditingController();
      final comment = TextEditingController();
      final ok = await showGcSheet<bool>(
        context,
        title: title,
        subtitle: path == '/contributions' ? tr('Внесок зараховується після підтвердження скарбником.') : null,
        builder: (sheet) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          GcField(controller: amount, label: tr('Сума, {currency}', {'currency': currency}), keyboard: TextInputType.number),
          const SizedBox(height: 8),
          GcField(controller: comment, label: hint),
          const SizedBox(height: 12),
          PrimaryButton(label: tr('Готово'), onPressed: () => Navigator.pop(sheet, true)),
        ]),
      );
      if (ok == true) await _act(path, {'amount': int.tryParse(amount.text.trim()) ?? 0, 'comment': comment.text.trim()});
      amount.dispose();
      comment.dispose();
    }

    return [
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CardTitle(tr('Скарбниця'), icon: LucideIcons.coins),
          const SizedBox(height: 6),
          Text('${_num(clan['treasury'])} $currency', style: display(26, color: gold)),
          const SizedBox(height: 12),
          PrimaryButton(label: tr('Зробити внесок'), icon: LucideIcons.plus, compact: true, onPressed: () => money('/contributions', tr('Внесок'), tr('Коментар'))),
          if (manage) ...[
            const SizedBox(height: 8),
            GhostButton(label: tr('Записати витрату'), icon: LucideIcons.minus, compact: true, onPressed: () => money('/spend', tr('Витрата'), tr('На що'))),
          ],
        ]),
      ),
      SectionLabel(tr('Історія')),
      if (rows.isEmpty) QuietEmpty(icon: LucideIcons.coins, text: tr('Ще немає операцій.')),
      for (final c in rows)
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Glass(
            padding: const EdgeInsets.all(12),
            radius: 16,
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(text(mapOf(c['user'])['name']) ?? '', style: body(13.5, weight: FontWeight.w600)),
                  if (text(c['comment']) != null) Text(text(c['comment'])!, style: body(12, color: muted)),
                  if (c['status'] != 'approved') Text(c['status'] == 'pending' ? tr('очікує підтвердження') : tr('відхилено'), style: body(11.5, color: c['status'] == 'pending' ? gold : dangerSoft)),
                ]),
              ),
              Text('${intOf(c['amount']) > 0 ? '+' : ''}${_num(c['amount'])}', style: body(14, color: intOf(c['amount']) < 0 ? dangerSoft : green, weight: FontWeight.w700)),
              if (manage && c['status'] == 'pending') ...[
                IconButton(icon: const Icon(LucideIcons.check, color: green, size: 19), onPressed: () => _act('/contributions/${c['id']}', {'approve': true})),
                IconButton(icon: const Icon(LucideIcons.x, color: dangerSoft, size: 19), onPressed: () => _act('/contributions/${c['id']}', {'approve': false})),
              ],
            ]),
          ),
        ),
    ];
  }

  List<Widget> _rating(Map<String, dynamic> d, Map<String, dynamic> clan) {
    final rows = maps(d['rating']);
    return [
      Glass(
        child: Column(children: [
          for (var i = 0; i < rows.length; i++)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(children: [
                SizedBox(width: 26, child: Text('${i + 1}', style: body(14, color: muted, weight: FontWeight.w700))),
                Avatar(url: text(mapOf(rows[i]['user'])['avatar_url']), name: text(mapOf(rows[i]['user'])['name']) ?? '?', size: 34),
                const SizedBox(width: 10),
                Expanded(child: Text(text(rows[i]['nickname']) ?? text(mapOf(rows[i]['user'])['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14))),
                Text(tr('{v} зах. · ', {'v': intOf(rows[i]['events'])}), style: body(12, color: faint)),
                Text('${_num(rows[i]['contributed'])} ${clan['currency']}', style: body(13, color: gold)),
              ]),
            ),
        ]),
      ),
    ];
  }

  List<Widget> _members(Map<String, dynamic> d, Map<String, dynamic> me, Map<String, dynamic> clan) {
    final manage = mapOf(me['can'])['members.manage'] == true;
    final iAmOwner = me['is_owner'] == true;
    final myRank = intOf(me['rank']);
    final titles = mapOf(clan['rank_titles']);
    final applications = maps(d['applications']);
    final members = maps(d['members']);
    Future<void> act(Map<String, dynamic> m, String action, [int? rank]) => _act('/members/${m['id']}', {'action': action, 'rank': ?rank});

    Widget person(Map<String, dynamic> m, List<Widget> trailing) {
      final user = mapOf(m['user']);
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(children: [
          GestureDetector(
            onTap: () => context.push('/u/${user['username']}'),
            child: Avatar(url: text(user['avatar_url']), name: text(user['name']) ?? '?', size: 40, online: user['is_online'] == true),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: Text(text(m['nickname']) ?? text(user['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, weight: FontWeight.w600))),
                if (m['is_owner'] == true) const Padding(padding: EdgeInsets.only(left: 4), child: Icon(LucideIcons.crown, size: 14, color: gold)),
              ]),
              Text(text(m['note']) ?? text(m['rank_title']) ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
            ]),
          ),
          ...trailing,
        ]),
      );
    }

    return [
      if (manage && applications.isNotEmpty) ...[
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            CardTitle(tr('Заявки'), icon: LucideIcons.userPlus, trailing: '${applications.length}'),
            for (final m in applications)
              person(m, [
                IconButton(icon: const Icon(LucideIcons.check, color: green), onPressed: () => act(m, 'accept')),
                IconButton(icon: const Icon(LucideIcons.x, color: dangerSoft), onPressed: () => act(m, 'decline')),
              ]),
          ]),
        ),
        const SizedBox(height: 12),
      ],
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CardTitle(tr('Склад'), icon: LucideIcons.usersRound, trailing: '${members.length}'),
          for (final m in members)
            person(m, [
              if ((manage && m['is_owner'] != true && m['id'] != me['id'] && (iAmOwner || myRank > intOf(m['rank']))) || (iAmOwner && m['is_owner'] != true))
                PopupMenuButton<String>(
                  icon: Icon(LucideIcons.ellipsisVertical, size: 18, color: muted),
                  color: popover,
                  onSelected: (value) async {
                    final name = text(mapOf(m['user'])['name']) ?? '';
                    if (value.startsWith('rank:')) return act(m, 'rank', int.parse(value.substring(5)));
                    if (value == 'kick' && await confirm(context, tr('Виключити {name}?', {'name': name}), danger: true, action: tr('Виключити'))) return act(m, 'kick');
                    if (value == 'transfer' && mounted && await confirm(context, tr('Передати лідерство {name}?', {'name': name}), text: tr('Ви станете офіцером, а {name} — лідером.', {'name': name}), action: tr('Передати'))) return act(m, 'transfer');
                  },
                  itemBuilder: (_) => [
                    if (manage && (iAmOwner || myRank > intOf(m['rank'])))
                      for (final r in [1, 2, 3, 4])
                        if ((iAmOwner || r < myRank) && r != intOf(m['rank'])) PopupMenuItem(value: 'rank:$r', child: Text(tr('Ранг: {v}', {'v': titles['$r'] ?? r}), style: body(14))),
                    if (manage && (iAmOwner || myRank > intOf(m['rank']))) PopupMenuItem(value: 'kick', child: Text(tr('Виключити'), style: body(14, color: dangerSoft))),
                    if (iAmOwner) PopupMenuItem(value: 'transfer', child: Text(tr('Зробити лідером'), style: body(14, color: gold))),
                  ],
                ),
            ]),
        ]),
      ),
    ];
  }
}

/// Налаштування клану: основне, розділи, назви рангів і права.
class _ClanSettings extends StatefulWidget {
  const _ClanSettings({required this.data, required this.onSave, super.key});
  final Map<String, dynamic> data;
  final Future<void> Function(Map<String, dynamic> body) onSave;

  @override
  State<_ClanSettings> createState() => _ClanSettingsState();
}

class _ClanSettingsState extends State<_ClanSettings> {
  late final settings = mapOf(widget.data['settings']);
  late final clan = mapOf(widget.data['clan']);
  late final me = mapOf(widget.data['me']);
  late final name = TextEditingController(text: text(settings['name']));
  late final tag = TextEditingController(text: text(settings['tag']));
  late final currency = TextEditingController(text: text(settings['currency']));
  late final description = TextEditingController(text: text(settings['description']));
  late final rules = TextEditingController(text: text(settings['rules']));
  late final titles = [for (var r = 1; r <= 5; r++) TextEditingController(text: text(mapOf(clan['rank_titles'])['$r']))];
  late String joinMode = text(settings['join_mode']) ?? 'request';
  late bool recruiting = settings['is_recruiting'] != false;
  late Set<String> features = (clan['features'] is List ? clan['features'] as List : const []).map((f) => '$f').toSet();
  late Map<String, Set<int>> permissions = {
    for (final e in mapOf(mapOf(widget.data['permissions'])['matrix']).entries) e.key: (e.value is List ? e.value as List : const []).map(intOf).toSet(),
  };
  bool busy = false;

  @override
  void dispose() {
    for (final c in [name, tag, currency, description, rules, ...titles]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => busy = true);
    await widget.onSave({
      'name': name.text.trim(),
      'tag': tag.text.trim().toUpperCase(),
      'currency': currency.text.trim(),
      'description': description.text.trim(),
      'rules': rules.text.trim(),
      'join_mode': joinMode,
      'is_recruiting': recruiting,
      'features': features.toList(),
      'rank_titles': [for (final t in titles) t.text.trim()],
      'permissions': {for (final e in permissions.entries) e.key: e.value.toList()..sort()},
    });
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final allFeatures = mapOf(widget.data['features']);
    final joinModes = mapOf(widget.data['join_modes']);
    final labels = mapOf(mapOf(widget.data['permissions'])['labels']);
    final iAmOwner = me['is_owner'] == true;
    final myRank = intOf(me['rank']);
    final logs = maps(widget.data['logs']);
    Widget section(String title, IconData icon, List<Widget> children) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [CardTitle(title, icon: icon), const SizedBox(height: 10), ...children])),
        );

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      section(tr('Основне'), LucideIcons.settings, [
        GcField(controller: name, label: tr('Назва')),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: GcField(controller: tag, label: tr('Тег'))),
          const SizedBox(width: 8),
          Expanded(child: GcField(controller: currency, label: tr('Валюта внесків'))),
        ]),
        const SizedBox(height: 8),
        GcField(controller: description, label: tr('Опис'), maxLines: 4, minLines: 2),
        const SizedBox(height: 8),
        GcField(controller: rules, label: tr('Статут'), maxLines: 8, minLines: 3),
        const SizedBox(height: 10),
        ChipRow(options: [for (final e in joinModes.entries) (e.key, '${e.value}')], selected: joinMode, onSelect: (v) => setState(() => joinMode = v)),
        SwitchListTile(contentPadding: EdgeInsets.zero, value: recruiting, activeThumbColor: primary, title: Text(tr('Набір відкрито'), style: body(14)), onChanged: (v) => setState(() => recruiting = v)),
      ]),
      section(tr('Розділи клану'), LucideIcons.swords, [
        for (final e in allFeatures.entries)
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            value: features.contains(e.key),
            activeColor: primary,
            title: Text('${mapOf(e.value)['label']}', style: body(14, weight: FontWeight.w600)),
            subtitle: Text('${mapOf(e.value)['text']}', style: body(12, color: muted)),
            onChanged: (on) => setState(() => on == true ? features.add(e.key) : features.remove(e.key)),
          ),
      ]),
      section(tr('Ранги й права'), LucideIcons.crown, [
        for (var i = 0; i < 5; i++) Padding(padding: const EdgeInsets.only(bottom: 8), child: GcField(controller: titles[i], label: tr('Ранг {v}', {'v': i + 1}), dense: true)),
        const SizedBox(height: 4),
        for (final e in labels.entries) ...[
          Text('${e.value}', style: body(13, color: soft, weight: FontWeight.w600)),
          const SizedBox(height: 6),
          Wrap(spacing: 6, children: [
            for (final r in [1, 2, 3, 4])
              FilterChip(
                label: Text(titles[r - 1].text.isEmpty ? '$r' : titles[r - 1].text, style: body(12)),
                selected: permissions[e.key]?.contains(r) ?? false,
                selectedColor: indigo.withValues(alpha: 0.35),
                onSelected: !iAmOwner && r >= myRank
                    ? null
                    : (on) => setState(() {
                          final set = permissions.putIfAbsent(e.key, () => <int>{});
                          on ? set.add(r) : set.remove(r);
                        }),
              ),
          ]),
          const SizedBox(height: 10),
        ],
        Text(tr('Ранг 5 (лідер) і засновник мають усі права.'), style: body(12, color: faint)),
      ]),
      PrimaryButton(label: tr('Зберегти налаштування'), busy: busy, onPressed: _save),
      if (logs.isNotEmpty) ...[
        SectionLabel(tr('Журнал дій')),
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            for (final l in logs) Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Text('${ago(l['created_at'])} · ${text(l['actor']) ?? 'Система'}: ${l['text']}', style: body(12.5, color: muted))),
          ]),
        ),
      ],
    ]);
  }
}
