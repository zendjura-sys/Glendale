import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

import 'api.dart';
import 'family_tabs.dart';
import 'feed.dart';
import 'posts.dart';
import 'shell.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Шлях сторінки сім’ї на мосту сайту: `/api/v1/site/f/{slug}/{section}`.
String familyPath(String slug, [String section = '']) => Api.site('/f/$slug${section.isEmpty || section == 'overview' ? '' : '/$section'}');

const rankColors = {10: gold, 9: Color(0xFFB79CFF), 8: Color(0xFF9AA6FF)};

class RankPill extends StatelessWidget {
  const RankPill({required this.rank, this.title, super.key});
  final dynamic rank;
  final String? title;

  @override
  Widget build(BuildContext context) {
    final r = intOf(rank);
    final color = rankColors[r] ?? soft;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(8), border: Border.all(color: color.withValues(alpha: 0.3))),
      child: Text('$r ${title ?? ''}'.trim(), style: body(11, color: color, weight: FontWeight.w700)),
    );
  }
}

class FamilyLogo extends StatelessWidget {
  const FamilyLogo({required this.family, this.size = 56, super.key});
  final Map<String, dynamic> family;
  final double size;

  @override
  Widget build(BuildContext context) {
    final logo = text(family['logo_url']);
    if (logo != null) return SizedBox(width: size, height: size, child: NetImage(logo, radius: size * 0.24));
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(gradient: buttonGradient, borderRadius: BorderRadius.circular(size * 0.24)),
      child: Padding(
        padding: const EdgeInsets.all(4),
        child: FittedBox(child: Text('${family['tag'] ?? '?'}'.toUpperCase(), style: display(size * 0.3))),
      ),
    );
  }
}

/// Зображення з авторизацією (докази звітів, підтвердження виплат) — йдуть через міст.
class AuthImage extends StatefulWidget {
  const AuthImage({required this.path, this.fit = BoxFit.cover, this.radius = 10, super.key});
  final String path;
  final BoxFit fit;
  final double radius;

  @override
  State<AuthImage> createState() => _AuthImageState();
}

class _AuthImageState extends State<AuthImage> {
  static final _cache = <String, Uint8List>{};
  Future<Uint8List>? future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    future ??= _load();
  }

  Future<Uint8List> _load() async {
    final cached = _cache[widget.path];
    if (cached != null) return cached;
    final bytes = Uint8List.fromList(await AppScope.read(context).session.api.bytes(widget.path));
    _cache[widget.path] = bytes;
    return bytes;
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(widget.radius),
      child: FutureBuilder<Uint8List>(
        future: future,
        builder: (context, snapshot) {
          if (snapshot.hasData) return Image.memory(snapshot.data!, fit: widget.fit);
          return Container(
            color: raised,
            alignment: Alignment.center,
            child: snapshot.hasError ? const Icon(Icons.broken_image_outlined, color: faint) : const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
          );
        },
      ),
    );
  }
}

/// `/f/black/proofs/3` → `/api/v1/site/f/black/proofs/3`.
String sitePathOf(String url) => url.startsWith('/api/') ? url : Api.site(url);

void openAuthImages(BuildContext context, List<String> paths, int index) {
  Navigator.of(context).push(MaterialPageRoute<void>(
    fullscreenDialog: true,
    builder: (_) => Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(backgroundColor: Colors.black, foregroundColor: Colors.white),
      body: PageView(
        controller: PageController(initialPage: index),
        children: [for (final p in paths) InteractiveViewer(maxScale: 5, child: Center(child: AuthImage(path: p, fit: BoxFit.contain, radius: 0)))],
      ),
    ),
  ));
}

// ───────────────────────── Каталог сімей ─────────────────────────

class FamiliesScreen extends StatefulWidget {
  const FamiliesScreen({super.key});

  @override
  State<FamiliesScreen> createState() => _FamiliesScreenState();
}

class _FamiliesScreenState extends State<FamiliesScreen> {
  Map<String, dynamic>? page;
  final families = <Map<String, dynamic>>[];
  final query = TextEditingController();
  String server = '';
  int current = 0;
  bool more = false;
  bool loading = true;
  Timer? debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load(reset: true));
  }

  @override
  void dispose() {
    query.dispose();
    debounce?.cancel();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    final api = AppScope.read(context).session.api;
    if (reset) {
      setState(() => loading = true);
      current = 0;
    }
    final params = Uri(queryParameters: {if (server.isNotEmpty) 'server': server, if (query.text.trim().isNotEmpty) 'q': query.text.trim(), 'page': '${current + 1}'}).query;
    try {
      final data = await api.get(Api.site('/families?$params'));
      final listing = Listing.parse(data['families']);
      if (!mounted) return;
      setState(() {
        page = data;
        if (reset) families.clear();
        families.addAll(listing.items);
        current = listing.current;
        more = listing.more;
      });
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = page;
    if (data == null) return const Center(child: CircularProgressIndicator(strokeWidth: 2.4));
    final mine = maps(data['mine']);
    final servers = maps(data['servers']);
    return ScreenScroll(
      onRefresh: () => _load(reset: true),
      children: [
        HeroCard(
          badge: 'FAMILY ERP',
          badgeIcon: Icons.workspace_premium_outlined,
          tint: gold,
          title: 'Сім’ї',
          accent: 'GTA RP',
          text: 'Звіти про бізвари й контракти, автоматичні виплати, депозити, склад з квотами, дисципліна й рейтинг — без таблиць і ручних підрахунків.',
          children: [PrimaryButton(label: 'Створити сім’ю', icon: Icons.add_rounded, expand: false, onPressed: () => context.push('/families/create'))],
        ),
        if (mine.isNotEmpty) ...[
          const SectionLabel('Мої сім’ї'),
          for (final family in mine) Padding(padding: const EdgeInsets.only(bottom: 10), child: _MyFamilyCard(family: family)),
        ],
        const SectionLabel('Каталог сімей'),
        Glass(
          padding: const EdgeInsets.all(12),
          child: Column(children: [
            GcField(
              controller: query,
              label: 'Назва або тег',
              icon: Icons.search_rounded,
              dense: true,
              onChanged: (_) {
                debounce?.cancel();
                debounce = Timer(const Duration(milliseconds: 350), () => _load(reset: true));
              },
            ),
            const SizedBox(height: 10),
            GcSelect<String>(
              value: server,
              expand: true,
              items: [('', 'Усі сервери'), for (final s in servers) ('${s['slug']}', '${s['name']}')],
              onChanged: (value) {
                setState(() => server = value ?? '');
                _load(reset: true);
              },
            ),
          ]),
        ),
        const SizedBox(height: 12),
        if (loading && families.isEmpty)
          const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator(strokeWidth: 2)))
        else if (families.isEmpty)
          const EmptyState(icon: Icons.workspace_premium_outlined, title: 'Сімей не знайдено', text: 'Спробуйте інший запит або створіть свою.')
        else ...[
          for (final family in families) Padding(padding: const EdgeInsets.only(bottom: 10), child: FamilyCard(family: family)),
          LoadMore(more: more && !loading, onMore: _load),
        ],
      ],
    );
  }
}

class _MyFamilyCard extends StatelessWidget {
  const _MyFamilyCard({required this.family});
  final Map<String, dynamic> family;

  @override
  Widget build(BuildContext context) {
    final membership = mapOf(family['membership']);
    final pending = membership['status'] == 'pending';
    return Glass(
      padding: const EdgeInsets.all(14),
      onTap: () => context.push('/families/${family['slug']}'),
      child: Row(children: [
        FamilyLogo(family: family, size: 56),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text.rich(
              TextSpan(children: [
                TextSpan(text: '[${family['tag']}] ', style: body(15, color: gold, weight: FontWeight.w800)),
                TextSpan(text: text(family['name']) ?? '', style: body(15, weight: FontWeight.w700)),
              ]),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(text(membership['display']) ?? '', style: body(12, color: muted).copyWith(fontFamily: 'monospace')),
            const SizedBox(height: 6),
            Row(children: [
              if (pending) const Pill(label: 'Заявка на розгляді', color: gold) else RankPill(rank: membership['rank'], title: text(membership['rank_title'])),
              const SizedBox(width: 8),
              if (!pending && membership['balance'] != null) Text(hryvnia(membership['balance']), style: body(13, color: green, weight: FontWeight.w700)),
            ]),
          ]),
        ),
      ]),
    );
  }
}

class FamilyCard extends StatelessWidget {
  const FamilyCard({required this.family, super.key});
  final Map<String, dynamic> family;

  @override
  Widget build(BuildContext context) {
    final server = family['server'] is Map ? mapOf(family['server']) : null;
    return Glass(
      padding: EdgeInsets.zero,
      onTap: () => context.push('/families/${family['slug']}'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(
          height: 70,
          width: double.infinity,
          child: ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
            child: text(family['cover_url']) != null
                ? NetImage(text(family['cover_url']))
                : Container(decoration: const BoxDecoration(gradient: LinearGradient(colors: [Color(0xFF3B2A6E), Color(0xFF1A1F3D)]))),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Transform.translate(
              offset: const Offset(0, -24),
              child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                FamilyLogo(family: family, size: 60),
                const SizedBox(width: 10),
                Expanded(
                  child: Text.rich(
                    TextSpan(children: [
                      TextSpan(text: '[${family['tag']}] ', style: body(15, color: gold, weight: FontWeight.w800)),
                      TextSpan(text: text(family['name']) ?? '', style: body(15, weight: FontWeight.w700)),
                    ]),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (family['status'] == 'verified') const Icon(Icons.verified_user_outlined, size: 18, color: green),
              ]),
            ),
            if (text(family['description']) != null)
              Transform.translate(offset: const Offset(0, -14), child: Text(text(family['description'])!, maxLines: 2, overflow: TextOverflow.ellipsis, style: body(13, color: soft))),
            Row(children: [
              if (server != null) ...[
                if (text(server['icon']) != null) SizedBox(width: 16, height: 16, child: NetImage(text(server['icon']), radius: 4)),
                const SizedBox(width: 6),
                Text(text(server['name']) ?? '', style: body(12, color: muted)),
                const SizedBox(width: 10),
              ],
              const Icon(Icons.people_alt_outlined, size: 14, color: muted),
              const SizedBox(width: 4),
              Text('${family['members_count'] ?? 0}', style: body(12, color: muted)),
              const Spacer(),
              if (family['is_recruiting'] == true) const Pill(label: 'Набір відкрито', color: green),
            ]),
          ]),
        ),
      ]),
    );
  }
}

// ───────────────────────── Створення ─────────────────────────

class CreateFamilyScreen extends StatefulWidget {
  const CreateFamilyScreen({this.server, super.key});
  final String? server;

  @override
  State<CreateFamilyScreen> createState() => _CreateFamilyScreenState();
}

class _CreateFamilyScreenState extends State<CreateFamilyScreen> {
  List<Map<String, dynamic>> servers = [];
  int? serverId;
  final name = TextEditingController();
  final tag = TextEditingController();
  final description = TextEditingController();
  final nickname = TextEditingController();
  final staticId = TextEditingController();
  XFile? logo;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final data = await AppScope.read(context).session.api.get(Api.site('/families/create${widget.server != null ? '?server=${widget.server}' : ''}'));
        if (!mounted) return;
        setState(() {
          servers = maps(data['servers']);
          final preset = servers.where((s) => s['slug'] == data['server']).firstOrNull;
          serverId = preset == null ? null : intOf(preset['id']);
        });
      } catch (e) {
        if (mounted) toast(context, e);
      }
    });
  }

  @override
  void dispose() {
    for (final c in [name, tag, description, nickname, staticId]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    final session = AppScope.read(context).session;
    setState(() => busy = true);
    try {
      final files = [if (logo != null) await http.MultipartFile.fromPath('logo', logo!.path, filename: logo!.name)];
      final result = await session.api.upload(Api.site('/families'), {
        'server_id': '$serverId',
        'name': name.text.trim(),
        'tag': tag.text.trim().toUpperCase(),
        'description': description.text.trim(),
        'rp_nickname': nickname.text.trim(),
        'static_id': staticId.text.trim(),
      }, files);
      if (!mounted) return;
      toast(context, text(result['message']) ?? 'Сім’ю створено!');
      context.go(appPathFor(text(result['redirect'])));
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ready = serverId != null && name.text.trim().length >= 2 && tag.text.trim().length >= 2 && nickname.text.trim().isNotEmpty && staticId.text.trim().isNotEmpty;
    return ScreenScroll(
      children: [
        Row(children: [
          RoundIcon(icon: Icons.arrow_back_rounded, onTap: () => context.canPop() ? context.pop() : context.go('/families')),
          const SizedBox(width: 8),
          Text('Нова сім’я', style: display(19)),
        ]),
        const SizedBox(height: 12),
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const CardTitle('Сервер і назва', icon: Icons.dns_outlined),
            const SizedBox(height: 12),
            LabeledField(
              label: 'Сервер',
              child: GcSelect<int>(value: serverId, hint: 'Оберіть сервер', expand: true, items: [for (final s in servers) (intOf(s['id']), '${s['name']}')], onChanged: (v) => setState(() => serverId = v)),
            ),
            const SizedBox(height: 10),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              GestureDetector(
                onTap: () async {
                  final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1000, imageQuality: 90);
                  if (picked != null) setState(() => logo = picked);
                },
                child: SizedBox(
                  width: 76,
                  height: 76,
                  child: logo == null
                      ? Container(
                          decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(18), border: Border.all(color: line)),
                          child: const Icon(Icons.add_photo_alternate_outlined, color: muted),
                        )
                      : ClipRRect(borderRadius: BorderRadius.circular(18), child: Image(image: XFileImage(logo!), fit: BoxFit.cover)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(children: [
                  GcField(controller: name, label: 'Назва, напр. BlackRock', dense: true, onChanged: (_) => setState(() {})),
                  const SizedBox(height: 8),
                  GcField(controller: tag, label: 'Тег, напр. BLACK', dense: true, onChanged: (_) => setState(() {})),
                ]),
              ),
            ]),
            const SizedBox(height: 10),
            LabeledField(label: 'Опис', child: GcField(controller: description, label: 'Чим живе ваша сім’я', maxLines: 5, minLines: 3)),
          ]),
        ),
        const SizedBox(height: 12),
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const CardTitle('Ваш персонаж', icon: Icons.badge_outlined),
            const SizedBox(height: 6),
            Text('Так вас бачитимуть у сім’ї, звітах і чаті.', style: body(12.5, color: muted)),
            const SizedBox(height: 12),
            GcField(controller: nickname, label: 'Нікнейм: Ім’я_Прізвище', dense: true, onChanged: (_) => setState(() {})),
            const SizedBox(height: 8),
            GcField(controller: staticId, label: 'Static ID', dense: true, keyboard: TextInputType.number, onChanged: (_) => setState(() {})),
          ]),
        ),
        const SizedBox(height: 14),
        Text('Після створення сім’я пройде верифікацію платформою — тоді відкриються набір і чат.', style: body(12.5, color: muted)),
        const SizedBox(height: 10),
        PrimaryButton(label: 'Створити сім’ю', icon: Icons.check_rounded, busy: busy, onPressed: ready ? _submit : null),
      ],
    );
  }
}

// ───────────────────────── Сторінка сім’ї ─────────────────────────

const familySections = [
  ('overview', 'Огляд', Icons.grid_view_rounded),
  ('reports', 'Звіти', Icons.description_outlined),
  ('queue', 'Перевірка', Icons.fact_check_outlined),
  ('bank', 'Банк', Icons.account_balance_wallet_outlined),
  ('warehouse', 'Склад', Icons.inventory_2_outlined),
  ('members', 'Учасники', Icons.people_alt_outlined),
  ('discipline', 'Дисципліна', Icons.gavel_rounded),
  ('events', 'Події', Icons.event_outlined),
  ('rating', 'Рейтинг', Icons.leaderboard_outlined),
  ('audit', 'Аудит', Icons.receipt_long_outlined),
  ('settings', 'Налаштування', Icons.settings_outlined),
];

class FamilyScreen extends StatefulWidget {
  const FamilyScreen({required this.slug, this.tab, super.key});
  final String slug;
  final String? tab;

  @override
  State<FamilyScreen> createState() => _FamilyScreenState();
}

class _FamilyScreenState extends State<FamilyScreen> {
  late String section = widget.tab ?? 'overview';
  Map<String, String> params = {};
  Map<String, dynamic>? data;
  Object? error;
  bool loading = false;
  final scroll = ScrollController();

  Api get api => AppScope.read(context).session.api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => load());
  }

  @override
  void dispose() {
    scroll.dispose();
    super.dispose();
  }

  /// Завантажує розділ; [extra] — фільтри розділу (status, scope, tab, period, action…).
  Future<void> load({String? to, Map<String, String>? extra}) async {
    final next = to ?? section;
    final query = extra ?? (to == null ? params : <String, String>{});
    setState(() => loading = true);
    try {
      final path = familyPath(widget.slug, next);
      final result = await api.get(query.isEmpty ? path : '$path?${Uri(queryParameters: query).query}');
      if (!mounted) return;
      setState(() {
        data = result;
        section = next;
        params = query;
        error = null;
      });
    } catch (e) {
      if (!mounted) return;
      if (data == null) {
        setState(() => error = e);
      } else {
        toast(context, e);
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _chat() async {
    try {
      final result = await api.get(familyPath(widget.slug, 'chat'));
      if (mounted) context.push(appPathFor(text(result['redirect'])));
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _report() async {
    final sent = await showReportSheet(context, widget.slug);
    if (sent == true) load();
  }

  @override
  Widget build(BuildContext context) {
    final page = data;
    if (page == null) {
      return error == null
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2.4))
          : Center(child: Padding(padding: const EdgeInsets.all(20), child: EmptyState(icon: Icons.workspace_premium_outlined, title: 'Сім’я недоступна', text: '$error', action: 'Спробувати знову', onAction: load)));
    }
    if (page['me'] == null) return FamilyPublic(slug: widget.slug, data: page, onChanged: load);

    final family = mapOf(page['family']);
    final me = mapOf(page['me']);
    final can = mapOf(page['can']);
    final badges = mapOf(page['badges']);
    final visible = familySections.where((s) => switch (s.$1) {
          'queue' => can['reports.review'] == true || can['treasury.manage'] == true,
          'audit' => can['audit.view'] == true,
          'settings' => can['settings.manage'] == true,
          _ => true,
        });
    final ctx = FamilyContext(slug: widget.slug, data: page, can: can, reload: ({Map<String, String>? extra}) => load(extra: extra), api: api);

    return Stack(children: [
      ScreenScroll(
        controller: scroll,
        onRefresh: load,
        padding: const EdgeInsets.fromLTRB(14, 6, 14, 96),
        children: [
          _FamilyHeader(family: family, me: me, onChat: family['conversation_id'] != null ? _chat : null),
          const SizedBox(height: 10),
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (final s in visible)
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: _SectionTab(
                      label: s.$2,
                      icon: s.$3,
                      selected: section == s.$1,
                      badge: switch (s.$1) {
                        'queue' => intOf(badges['queue']),
                        'members' => intOf(badges['applications']),
                        'warehouse' => intOf(badges['alerts']),
                        'reports' => intOf(badges['my_pending']),
                        _ => 0,
                      },
                      onTap: () => load(to: s.$1, extra: const {}),
                    ),
                  ),
              ],
            ),
          ),
          if (loading) const LinearProgressIndicator(minHeight: 2, color: primary, backgroundColor: Colors.transparent) else const SizedBox(height: 2),
          const SizedBox(height: 10),
          if (family['status'] == 'pending') ...[
            const Glass(
              border: gold,
              child: Row(children: [
                Icon(Icons.hourglass_top_rounded, color: gold),
                SizedBox(width: 10),
                Expanded(child: Text('Сім’я очікує верифікації платформою. Чат і набір відкриються після перевірки.')),
              ]),
            ),
            const SizedBox(height: 10),
          ],
          if (family['status'] == 'suspended') ...[
            Glass(
              border: danger,
              child: Text('Сім’ю призупинено платформою${text(family['status_reason']) != null ? ': ${family['status_reason']}' : ''}. Зміни недоступні.', style: body(13.5, color: dangerSoft)),
            ),
            const SizedBox(height: 10),
          ],
          ...switch (section) {
            'overview' => overviewTab(ctx, onReport: _report, go: (s) => load(to: s, extra: const {})),
            'reports' => reportsTab(ctx, onReport: _report),
            'queue' => [QueueTab(ctx: ctx)],
            'bank' => [BankTab(ctx: ctx)],
            'warehouse' => [WarehouseTab(ctx: ctx)],
            'members' => [MembersTab(ctx: ctx)],
            'discipline' => [DisciplineTab(ctx: ctx)],
            'events' => [EventsTab(ctx: ctx)],
            'rating' => ratingTab(ctx),
            'audit' => auditTab(ctx),
            'settings' => [SettingsTab(ctx: ctx)],
            _ => const <Widget>[],
          },
        ],
      ),
      Positioned(
        right: 16,
        bottom: 16 + ShellChrome.bottomOf(context),
        child: DecoratedBox(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), boxShadow: [BoxShadow(color: indigo.withValues(alpha: 0.5), blurRadius: 24, offset: const Offset(0, 10), spreadRadius: -8)]),
          child: PrimaryButton(label: 'Звіт', icon: Icons.note_add_outlined, expand: false, onPressed: _report),
        ),
      ),
    ]);
  }
}

class _SectionTab extends StatelessWidget {
  const _SectionTab({required this.label, required this.icon, required this.selected, required this.onTap, this.badge = 0});
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? Colors.white.withValues(alpha: 0.09) : Colors.transparent,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border(bottom: BorderSide(color: selected ? primary : Colors.transparent, width: 2))),
          child: Row(children: [
            Icon(icon, size: 16, color: selected ? const Color(0xFF9AA6FF) : muted),
            const SizedBox(width: 6),
            Text(label, style: body(13, color: selected ? ink : muted, weight: FontWeight.w600)),
            if (badge > 0) ...[const SizedBox(width: 6), CountBadge(count: badge)],
          ]),
        ),
      ),
    );
  }
}

class _FamilyHeader extends StatelessWidget {
  const _FamilyHeader({required this.family, required this.me, this.onChat});
  final Map<String, dynamic> family;
  final Map<String, dynamic> me;
  final VoidCallback? onChat;

  @override
  Widget build(BuildContext context) {
    final server = family['server'] is Map ? mapOf(family['server']) : null;
    return Glass(
      padding: EdgeInsets.zero,
      radius: 26,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(
          height: 64,
          width: double.infinity,
          child: ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
            child: text(family['cover_url']) != null
                ? NetImage(text(family['cover_url']))
                : Container(decoration: const BoxDecoration(gradient: LinearGradient(colors: [Color(0xFF4A3A1A), Color(0xFF2A2350), Color(0xFF151A30)]))),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Transform.translate(
              offset: const Offset(0, -26),
              child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                FamilyLogo(family: family, size: 84),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('[${family['tag']}]', style: display(18, color: gold)),
                    Row(children: [
                      Flexible(child: Text(text(family['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: display(19))),
                      if (family['status'] == 'verified') const Padding(padding: EdgeInsets.only(left: 6), child: Icon(Icons.verified_user_outlined, size: 18, color: green)),
                    ]),
                    const SizedBox(height: 2),
                    Wrap(spacing: 10, crossAxisAlignment: WrapCrossAlignment.center, children: [
                      if (server != null)
                        GestureDetector(
                          onTap: () => context.push('/servers/${server['slug']}'),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            if (text(server['icon']) != null) SizedBox(width: 14, height: 14, child: NetImage(text(server['icon']), radius: 3)),
                            const SizedBox(width: 4),
                            Text(text(server['name']) ?? '', style: body(12, color: muted)),
                          ]),
                        ),
                      Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.people_alt_outlined, size: 13, color: muted),
                        const SizedBox(width: 3),
                        Text('${family['members_count'] ?? 0}', style: body(12, color: muted)),
                      ]),
                      Text('Скарбниця: ${hryvnia(family['treasury'])}', style: body(12, color: muted)),
                    ]),
                  ]),
                ),
              ]),
            ),
            Transform.translate(
              offset: const Offset(0, -12),
              child: Row(children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.04), borderRadius: BorderRadius.circular(14), border: Border.all(color: line)),
                    child: Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(text(me['display']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(13, weight: FontWeight.w600).copyWith(fontFamily: 'monospace')),
                          const SizedBox(height: 4),
                          RankPill(rank: me['rank'], title: text(me['rank_title'])),
                        ]),
                      ),
                      Container(width: 1, height: 32, color: line, margin: const EdgeInsets.symmetric(horizontal: 10)),
                      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('БАЛАНС', style: body(10, color: muted, weight: FontWeight.w700)),
                        Text(hryvnia(me['balance']), style: body(15, color: green, weight: FontWeight.w800)),
                      ]),
                    ]),
                  ),
                ),
                if (onChat != null) ...[
                  const SizedBox(width: 8),
                  GhostButton(label: 'Чат', icon: Icons.forum_outlined, compact: true, expand: false, onPressed: onChat),
                ],
              ]),
            ),
          ]),
        ),
      ]),
    );
  }
}

// ───────────────────────── Публічна сторінка й заявка ─────────────────────────

class FamilyPublic extends StatelessWidget {
  const FamilyPublic({required this.slug, required this.data, required this.onChanged, super.key});
  final String slug;
  final Map<String, dynamic> data;
  final Future<void> Function() onChanged;

  Future<void> _apply(BuildContext context) async {
    final nickname = TextEditingController();
    final staticId = TextEditingController();
    final note = TextEditingController();
    final sent = await showGcSheet<bool>(
      context,
      title: 'Заявка на вступ',
      subtitle: 'Офіцери сім’ї побачать ваш RP-нікнейм і Static ID.',
      builder: (sheet) => SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          GcField(controller: nickname, label: 'Нікнейм: Ім’я_Прізвище'),
          const SizedBox(height: 10),
          GcField(controller: staticId, label: 'Static ID', keyboard: TextInputType.number),
          const SizedBox(height: 10),
          GcField(controller: note, label: 'Кілька слів про себе (необов’язково)', maxLines: 4, minLines: 2),
          const SizedBox(height: 16),
          PrimaryButton(
            label: 'Надіслати заявку',
            onPressed: () async {
              final ok = await attempt(sheet, () => AppScope.read(sheet).session.api.post(familyPath(slug, 'apply'), {
                    'rp_nickname': nickname.text.trim(),
                    'static_id': staticId.text.trim(),
                    'note': note.text.trim(),
                  }));
              if (ok && sheet.mounted) Navigator.pop(sheet, true);
            },
          ),
        ]),
      ),
    );
    if (sent == true) await onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final family = mapOf(data['family']);
    final leaders = maps(data['leaders']);
    final application = data['application'] is Map ? mapOf(data['application']) : null;
    final status = text(application?['status']);
    return ScreenScroll(
      onRefresh: onChanged,
      children: [
        FamilyCard(family: family),
        const SizedBox(height: 12),
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (text(family['description']) != null) ...[
              Text(text(family['description'])!, style: body(14, color: soft).copyWith(height: 1.5)),
              const SizedBox(height: 12),
            ],
            Text('Створена ${fullDate(family['created_at'])}', style: body(12.5, color: muted)),
            const SizedBox(height: 14),
            if (status == 'pending') ...[
              Text('Заявку надіслано як ${application!['display']}. Офіцери розглянуть її найближчим часом.', style: body(13.5, color: gold)),
              const SizedBox(height: 10),
              GhostButton(
                label: 'Відкликати заявку',
                icon: Icons.undo_rounded,
                onPressed: () async {
                  if (await attempt(context, () => AppScope.read(context).session.api.delete(familyPath(slug, 'apply')))) await onChanged();
                },
              ),
            ] else if (family['status'] != 'verified')
              Text('Сім’я ще не пройшла верифікацію.', style: body(13.5, color: muted))
            else if (family['is_recruiting'] == true) ...[
              if (status == 'declined' || status == 'kicked' || status == 'left') Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(status == 'declined' ? 'Попередню заявку відхилено.' : 'Ви вже були в цій сім’ї.', style: body(12.5, color: muted))),
              PrimaryButton(label: 'Подати заявку', icon: Icons.how_to_reg_outlined, onPressed: () => _apply(context)),
            ] else
              Text('Набір зараз закрито.', style: body(13.5, color: muted)),
          ]),
        ),
        if (leaders.isNotEmpty) ...[
          const SectionLabel('Керівництво'),
          Glass(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
            child: Column(children: [for (final m in leaders) MemberTile(member: m)]),
          ),
        ],
      ],
    );
  }
}

class MemberTile extends StatelessWidget {
  const MemberTile({required this.member, this.trailing, this.subtitle, super.key});
  final Map<String, dynamic> member;
  final Widget? trailing;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: text(member['username']) == null ? null : () => context.push('/u/${member['username']}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        child: Row(children: [
          Avatar(url: text(member['avatar_url']), name: text(member['nickname']) ?? '?', size: 42, online: member['is_online'] == true),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(text(member['display']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, weight: FontWeight.w600).copyWith(fontFamily: 'monospace')),
              const SizedBox(height: 3),
              Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                if (member['is_owner'] == true) const Icon(Icons.workspace_premium_rounded, size: 14, color: gold),
                RankPill(rank: member['rank'], title: text(member['rank_title'])),
                if (text(member['duties']) != null) Text(text(member['duties'])!, style: body(11.5, color: muted)),
                if (subtitle != null) Text(subtitle!, style: body(11.5, color: muted)),
              ]),
            ]),
          ),
          ?trailing,
        ]),
      ),
    );
  }
}

// ───────────────────────── Огляд ─────────────────────────

List<Widget> overviewTab(FamilyContext ctx, {required VoidCallback onReport, required ValueChanged<String> go}) {
  final data = ctx.data;
  final stats = mapOf(data['stats']);
  final leaders = maps(data['leaders']);
  final events = maps(data['events']);
  final transactions = maps(data['transactions']);
  final lowStock = maps(data['low_stock']);
  final activity = maps(data['activity']);
  return [
    Row(children: [
      Expanded(child: MetricTile(caps: true, label: 'Заробив за тиждень', value: hryvnia(stats['week_earned']), icon: Icons.trending_up_rounded, color: green)),
      const SizedBox(width: 8),
      Expanded(child: MetricTile(caps: true, label: 'Виплати сім’ї (тиждень)', value: hryvnia(stats['week_total']), icon: Icons.payments_outlined)),
    ]),
    const SizedBox(height: 8),
    Row(children: [
      Expanded(child: MetricTile(caps: true, label: 'Мої звіти на перевірці', value: '${stats['pending_reports'] ?? 0}', icon: Icons.schedule_rounded, color: gold)),
      const SizedBox(width: 8),
      Expanded(child: MetricTile(caps: true, label: 'Попередження', value: '${stats['warns'] ?? 0}/${stats['warn_limit'] ?? 3}', icon: Icons.warning_amber_rounded, color: intOf(stats['warns']) > 0 ? dangerSoft : ink)),
    ]),
    const SizedBox(height: 12),
    Glass(
      onTap: onReport,
      child: Row(children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFFF59E0B), Color(0xFFEF4444)]), borderRadius: BorderRadius.circular(16)),
          child: const Icon(Icons.note_add_outlined, color: Colors.white),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Подати звіт', style: display(16)),
            const SizedBox(height: 2),
            Text('Бізвар, контракти, інвестиція — за себе чи за друга', style: body(12.5, color: muted)),
          ]),
        ),
      ]),
    ),
    const SizedBox(height: 12),
    _OverviewCard(
      title: 'Лідери тижня',
      icon: Icons.leaderboard_outlined,
      action: 'Увесь рейтинг',
      onAction: () => go('rating'),
      empty: (Icons.bar_chart_rounded, 'Схвалених звітів цього тижня ще немає'),
      children: [
        for (final l in leaders)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(children: [
              SizedBox(width: 22, child: Text('${l['place']}', style: body(13, color: intOf(l['place']) <= 3 ? gold : muted, weight: FontWeight.w800))),
              Expanded(child: Text(text(l['display']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(13.5).copyWith(fontFamily: 'monospace'))),
              Text('${l['points']} балів', style: body(12.5, color: const Color(0xFF9AA6FF), weight: FontWeight.w700)),
            ]),
          ),
      ],
    ),
    const SizedBox(height: 12),
    _OverviewCard(
      title: 'Мої операції',
      icon: Icons.account_balance_wallet_outlined,
      action: 'Банк',
      onAction: () => go('bank'),
      empty: (Icons.wallet_outlined, 'Операцій ще не було'),
      children: [for (final t in transactions) TransactionRow(tx: t)],
    ),
    const SizedBox(height: 12),
    _OverviewCard(
      title: 'Найближчі події',
      icon: Icons.event_outlined,
      action: 'Усі',
      onAction: () => go('events'),
      empty: (Icons.calendar_month_outlined, 'Запланованих подій немає'),
      children: [
        for (final e in events)
          ListTile(
            contentPadding: EdgeInsets.zero,
            dense: true,
            leading: const Icon(Icons.event_rounded, color: Color(0xFF9AA6FF)),
            title: Text(text(e['title']) ?? '', style: body(14, weight: FontWeight.w600)),
            subtitle: Text('${e['type_label']} · ${shortStamp(e['starts_at'])} ${clock(e['starts_at'])}', style: body(12, color: muted)),
          ),
      ],
    ),
    if (lowStock.isNotEmpty) ...[
      const SizedBox(height: 12),
      _OverviewCard(
        title: 'Закінчується на складі',
        icon: Icons.inventory_2_outlined,
        action: 'Склад',
        onAction: () => go('warehouse'),
        empty: (Icons.inventory_2_outlined, ''),
        children: [
          for (final i in lowStock)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(children: [
                Expanded(child: Text(text(i['name']) ?? '', style: body(13.5))),
                Text('${i['quantity']} ${i['unit'] ?? 'шт'}', style: body(13, color: dangerSoft, weight: FontWeight.w700)),
              ]),
            ),
        ],
      ),
    ],
    if (activity.isNotEmpty) ...[
      const SizedBox(height: 12),
      _OverviewCard(
        title: 'Остання активність',
        icon: Icons.receipt_long_outlined,
        action: 'Журнал',
        onAction: () => go('audit'),
        empty: (Icons.receipt_long_outlined, ''),
        children: [for (final a in activity) AuditRow(entry: a, compact: true)],
      ),
    ],
  ];
}

class _OverviewCard extends StatelessWidget {
  const _OverviewCard({required this.title, required this.icon, required this.children, required this.empty, this.action, this.onAction});
  final String title;
  final IconData icon;
  final List<Widget> children;
  final (IconData, String) empty;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        CardTitle(title, icon: icon, caps: false, trailing: action, onTrailing: onAction),
        const SizedBox(height: 8),
        if (children.isEmpty) QuietEmpty(icon: empty.$1, text: empty.$2) else ...children,
      ]),
    );
  }
}

// ───────────────────────── Звіти ─────────────────────────

const reportStatus = {
  'pending': ('Очікує', gold),
  'approved': ('Схвалено', green),
  'rejected': ('Відхилено', dangerSoft),
};

List<Widget> reportsTab(FamilyContext ctx, {required VoidCallback onReport}) {
  final listing = Listing.parse(ctx.data['reports']);
  final status = text(ctx.data['status']) ?? '';
  return [
    PrimaryButton(label: 'Подати звіт', icon: Icons.note_add_outlined, onPressed: onReport),
    const SizedBox(height: 12),
    Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const CardTitle('Мої звіти', icon: Icons.description_outlined, caps: false),
        const SizedBox(height: 10),
        Segmented(
          options: const [SegmentOption('', 'Усі'), SegmentOption('pending', 'Очікують'), SegmentOption('approved', 'Схвалені'), SegmentOption('rejected', 'Відхилені')],
          selected: status,
          scroll: true,
          onSelect: (value) => ctx.reload(extra: {if (value.isNotEmpty) 'status': value}),
        ),
        const SizedBox(height: 10),
        if (listing.items.isEmpty)
          const QuietEmpty(icon: Icons.description_outlined, text: 'Звітів ще немає — подайте перший')
        else
          for (final r in listing.items) ReportCard(report: r, slug: ctx.slug),
        if (listing.more)
          TextButton(
            onPressed: () => ctx.reload(extra: {if (status.isNotEmpty) 'status': status, 'page': '${listing.current + 1}'}),
            child: Text('Наступна сторінка', style: body(13, color: primary)),
          ),
      ]),
    ),
  ];
}

String reportSummary(Map<String, dynamic> r) {
  final data = mapOf(r['data']);
  return switch (r['type']) {
    'bizwar' => 'Перемог: ${data['wins'] ?? 0} · поразок: ${data['losses'] ?? 0}${(data['hours'] as List?)?.isNotEmpty == true ? ' · ${(data['hours'] as List).map((h) => '$h:00').join(', ')}' : ''}',
    'contract' => '${{'light': 'Легкий', 'medium': 'Середній', 'heavy': 'Важкий'}[data['tier']] ?? data['tier']} × ${data['count'] ?? 1}',
    'investment' => 'Інвестиція ${hryvnia(data['amount'])}',
    _ => text(r['description']) ?? 'Інше',
  };
}

class ReportCard extends StatelessWidget {
  const ReportCard({required this.report, required this.slug, this.footer, super.key});
  final Map<String, dynamic> report;
  final String slug;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final status = reportStatus[report['status']] ?? ('—', muted);
    final proofs = maps(report['proofs']);
    final paths = [for (final p in proofs) sitePathOf('${p['url']}')];
    final flags = mapOf(report['flags']);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.035), borderRadius: BorderRadius.circular(16), border: Border.all(color: line)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text('#${report['id']} ', style: body(12, color: faint)),
          Text(text(report['type_label']) ?? '', style: body(14, weight: FontWeight.w700)),
          const Spacer(),
          Pill(label: status.$1, color: status.$2),
        ]),
        const SizedBox(height: 6),
        Text(reportSummary(report), style: body(13, color: soft)),
        if (report['type'] != 'other' && text(report['description']) != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(text(report['description'])!, style: body(12.5, color: muted))),
        const SizedBox(height: 6),
        Wrap(spacing: 10, runSpacing: 4, children: [
          Text('Дата: ${fullDate(report['event_date'])}', style: body(12, color: muted)),
          if (report['for_friend'] == true) Text('За: ${mapOf(report['beneficiary'])['display']}', style: body(12, color: muted)),
          if (report['for_friend'] == true) Text('Подав: ${mapOf(report['submitter'])['display']}', style: body(12, color: muted)),
          if (intOf(report['reward']) > 0) Text(hryvnia(report['reward']), style: body(12.5, color: green, weight: FontWeight.w700)),
          if (intOf(report['points']) > 0) Text('${report['points']} балів', style: body(12, color: const Color(0xFF9AA6FF))),
        ]),
        if (flags['similar_reports'] != null) Padding(padding: const EdgeInsets.only(top: 6), child: Pill(label: 'Скріншот схожий на попередні', icon: Icons.warning_amber_rounded, color: gold)),
        if (paths.isNotEmpty) ...[
          const SizedBox(height: 8),
          SizedBox(
            height: 64,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: paths.length,
              separatorBuilder: (_, _) => const SizedBox(width: 6),
              itemBuilder: (_, i) => GestureDetector(onTap: () => openAuthImages(context, paths, i), child: SizedBox(width: 64, height: 64, child: AuthImage(path: paths[i]))),
            ),
          ),
        ],
        if (report['reviewer'] != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text('Перевірив: ${mapOf(report['reviewer'])['display']}${text(report['review_comment']) != null ? ' — «${report['review_comment']}»' : ''}', style: body(12, color: muted)),
          ),
        ?footer,
      ]),
    );
  }
}

// ───────────────────────── Форма звіту ─────────────────────────

Future<bool?> showReportSheet(BuildContext context, String slug) {
  return showGcSheet<bool>(
    context,
    title: 'Подати звіт',
    height: MediaQuery.sizeOf(context).height * 0.9,
    builder: (sheet) => _ReportForm(slug: slug, onDone: () => Navigator.pop(sheet, true)),
  );
}

class _ReportForm extends StatefulWidget {
  const _ReportForm({required this.slug, required this.onDone});
  final String slug;
  final VoidCallback onDone;

  @override
  State<_ReportForm> createState() => _ReportFormState();
}

class _ReportFormState extends State<_ReportForm> {
  Map<String, dynamic>? page;
  String type = 'bizwar';
  String forWhom = 'self';
  int? beneficiary;
  late DateTime date;
  int wins = 0;
  int losses = 0;
  final hours = <int>{};
  String tier = 'light';
  int count = 1;
  final amount = TextEditingController();
  final description = TextEditingController();
  final proofs = <XFile>[];
  bool busy = false;

  @override
  void initState() {
    super.initState();
    date = DateTime.now();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final data = await AppScope.read(context).session.api.get(familyPath(widget.slug, 'reports'));
        if (!mounted) return;
        setState(() {
          page = data;
          date = DateTime.tryParse(text(mapOf(data['config'])['today']) ?? '') ?? date;
        });
      } catch (e) {
        if (mounted) toast(context, e);
      }
    });
  }

  @override
  void dispose() {
    amount.dispose();
    description.dispose();
    super.dispose();
  }

  String _iso(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _submit() async {
    final config = mapOf(page?['config']);
    if (config['require_proof'] == true && proofs.isEmpty) {
      toast(context, 'Додайте хоча б один скріншот.');
      return;
    }
    final api = AppScope.read(context).session.api;
    setState(() => busy = true);
    try {
      final fields = <String, String>{
        'type': type,
        'for': forWhom,
        if (forWhom == 'friend' && beneficiary != null) 'beneficiary_id': '$beneficiary',
        'event_date': _iso(date),
        if (description.text.trim().isNotEmpty) 'description': description.text.trim(),
        if (type == 'bizwar') ...{'wins': '$wins', 'losses': '$losses'},
        if (type == 'contract') ...{'tier': tier, 'count': '$count'},
        if (type == 'investment') 'amount': amount.text.trim().replaceAll(' ', ''),
      };
      if (type == 'bizwar') {
        var i = 0;
        for (final h in hours.toList()..sort()) {
          fields['hours[${i++}]'] = '$h';
        }
      }
      final files = [for (final p in proofs) await http.MultipartFile.fromPath('proofs[]', p.path, filename: p.name)];
      final result = await api.upload(familyPath(widget.slug, 'reports'), fields, files);
      if (mounted) toast(context, text(result['message']) ?? 'Звіт надіслано.');
      widget.onDone();
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = page;
    if (data == null) return const Center(child: CircularProgressIndicator(strokeWidth: 2));
    final config = mapOf(data['config']);
    final types = mapOf(config['types']);
    final tiers = mapOf(config['tiers']);
    final rates = mapOf(config['rates']);
    final allHours = [for (final h in (config['hours'] as List? ?? const [])) intOf(h)];
    final roster = maps(data['roster']).where((m) => intOf(m['id']) != intOf(mapOf(data['me'])['id'])).toList();
    final usage = mapOf(mapOf(data['usage'])[_iso(date)]);
    final today = DateTime.tryParse(text(config['today']) ?? '') ?? DateTime.now();
    final minDate = DateTime.tryParse(text(config['min_date']) ?? '') ?? today.subtract(const Duration(days: 2));
    final limit = intOf(config['contract_limit'], 10);
    final maxProofs = intOf(config['max_proofs'], 6);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      children: [
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          childAspectRatio: 2.6,
          children: [
            for (final e in types.entries)
              _Choice(
                selected: type == e.key,
                label: '${e.value}',
                icon: switch (e.key) {
                  'bizwar' => Icons.sports_mma_rounded,
                  'contract' => Icons.assignment_turned_in_outlined,
                  'investment' => Icons.savings_outlined,
                  _ => Icons.more_horiz_rounded,
                },
                onTap: () => setState(() => type = e.key),
              ),
          ],
        ),
        const SizedBox(height: 12),
        Segmented(
          options: const [SegmentOption('self', 'За себе', icon: Icons.person_outline_rounded), SegmentOption('friend', 'За друга', icon: Icons.people_alt_outlined)],
          selected: forWhom,
          onSelect: (value) => setState(() => forWhom = value),
        ),
        if (forWhom == 'friend') ...[
          const SizedBox(height: 10),
          GcSelect<int>(value: beneficiary, hint: 'Оберіть учасника', expand: true, items: [for (final m in roster) (intOf(m['id']), '${m['display']}')], onChanged: (v) => setState(() => beneficiary = v)),
        ],
        const SizedBox(height: 12),
        LabeledField(
          label: 'Дата події',
          hint: 'Звіт можна подати протягом ${config['deadline_hours']} год',
          child: GhostButton(
            label: '${date.day} ${monthsGenitive[date.month - 1]} ${date.year}',
            icon: Icons.calendar_today_outlined,
            onPressed: () async {
              final picked = await showDatePicker(context: context, initialDate: date, firstDate: minDate, lastDate: today);
              if (picked != null) setState(() => date = picked);
            },
          ),
        ),
        const SizedBox(height: 12),
        if (type == 'bizwar') ...[
          Row(children: [
            Expanded(child: _Stepper(label: 'Перемоги', hint: '${rates['bizwar_win']} ₴', value: wins, onChanged: (v) => setState(() => wins = v))),
            const SizedBox(width: 10),
            Expanded(child: _Stepper(label: 'Поразки', hint: '${rates['bizwar_loss']} ₴', value: losses, onChanged: (v) => setState(() => losses = v))),
          ]),
          const SizedBox(height: 10),
          Text('Години стріл', style: body(13, color: muted)),
          const SizedBox(height: 6),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final h in allHours) SelectPill(label: '$h:00', selected: hours.contains(h), onTap: () => setState(() => hours.contains(h) ? hours.remove(h) : hours.add(h))),
          ]),
        ],
        if (type == 'contract') ...[
          Segmented(
            options: [for (final e in tiers.entries) SegmentOption(e.key, '${e.value}', count: '${usage[e.key] ?? 0}/$limit')],
            selected: tier,
            onSelect: (value) => setState(() => tier = value),
          ),
          const SizedBox(height: 6),
          Text('Ставка: ${rates['contract_$tier']} ₴ за контракт · ліміт $limit на день кожного рівня', style: body(12, color: muted)),
          const SizedBox(height: 10),
          _Stepper(label: 'Кількість', value: count, min: 1, max: 10, onChanged: (v) => setState(() => count = v)),
        ],
        if (type == 'investment') ...[
          GcField(controller: amount, label: 'Сума інвестиції, ₴', keyboard: TextInputType.number),
          if ((rates['investment_cashback'] ?? 0) != 0) Padding(padding: const EdgeInsets.only(top: 6), child: Text('Кешбек: ${rates['investment_cashback']}%', style: body(12, color: muted))),
        ],
        const SizedBox(height: 12),
        GcField(controller: description, label: type == 'other' ? 'Що сталося (обов’язково)' : 'Коментар (необов’язково)', maxLines: 4, minLines: 2),
        const SizedBox(height: 12),
        Row(children: [
          Text('Скріншоти ${config['require_proof'] == true ? '(обов’язково)' : ''}', style: body(13, color: muted)),
          const Spacer(),
          Text('${proofs.length}/$maxProofs', style: body(12, color: faint)),
        ]),
        const SizedBox(height: 6),
        SizedBox(
          height: 76,
          child: ListView(scrollDirection: Axis.horizontal, children: [
            for (var i = 0; i < proofs.length; i++)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Stack(children: [
                  ClipRRect(borderRadius: BorderRadius.circular(12), child: Image(image: XFileImage(proofs[i]), width: 72, height: 72, fit: BoxFit.cover)),
                  Positioned(
                    right: 2,
                    top: 2,
                    child: GestureDetector(
                      onTap: () => setState(() => proofs.removeAt(i)),
                      child: Container(decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle), child: const Icon(Icons.close_rounded, size: 16)),
                    ),
                  ),
                ]),
              ),
            if (proofs.length < maxProofs)
              GestureDetector(
                onTap: () async {
                  final picked = await ImagePicker().pickMultiImage(imageQuality: 90);
                  if (picked.isNotEmpty) setState(() => proofs.addAll(picked.take(maxProofs - proofs.length)));
                },
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(12), border: Border.all(color: line)),
                  child: const Icon(Icons.add_photo_alternate_outlined, color: muted),
                ),
              ),
          ]),
        ),
        const SizedBox(height: 16),
        PrimaryButton(
          label: 'Надіслати на перевірку',
          icon: Icons.send_rounded,
          busy: busy,
          onPressed: (forWhom == 'friend' && beneficiary == null) || (type == 'bizwar' && wins + losses == 0) ? null : _submit,
        ),
      ],
    );
  }
}

class _Choice extends StatelessWidget {
  const _Choice({required this.selected, required this.label, required this.icon, required this.onTap});
  final bool selected;
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? primary.withValues(alpha: 0.14) : Colors.white.withValues(alpha: 0.04),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: selected ? primary.withValues(alpha: 0.6) : line)),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, size: 18, color: selected ? const Color(0xFF9AA6FF) : muted),
          const SizedBox(width: 8),
          Text(label, style: body(13.5, color: selected ? ink : soft, weight: FontWeight.w600)),
        ]),
      ),
    );
  }
}

class _Stepper extends StatelessWidget {
  const _Stepper({required this.label, required this.value, required this.onChanged, this.hint, this.min = 0, this.max = 40});
  final String label;
  final String? hint;
  final int value;
  final int min;
  final int max;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 6, 8),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.04), borderRadius: BorderRadius.circular(14), border: Border.all(color: line)),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: body(12.5, color: muted)),
            Text('$value', style: display(18)),
            if (hint != null) Text(hint!, style: body(11, color: faint)),
          ]),
        ),
        IconButton(visualDensity: VisualDensity.compact, onPressed: value > min ? () => onChanged(value - 1) : null, icon: const Icon(Icons.remove_rounded)),
        IconButton(visualDensity: VisualDensity.compact, onPressed: value < max ? () => onChanged(value + 1) : null, icon: const Icon(Icons.add_rounded)),
      ]),
    );
  }
}
