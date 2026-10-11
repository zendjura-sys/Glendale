import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'cinema.dart';
import 'events.dart';
import 'i18n.dart';
import 'posts.dart';
import 'shell.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// Розділи сайту, яких бракувало в застосунку: моменти, завдання й сезон, збережене, чернетки, обрані
// повідомлення, релізи, «Мої десять» і порівняння серверів. Дані й дії — ті самі контролери через /api/v1/site.

/// Завантаження сторінки сайту з повтором і порожнім станом під час першого запиту.
mixin _SitePage<T extends StatefulWidget> on State<T> {
  Map<String, dynamic>? data;
  Object? error;

  Api get api => AppScope.read(context).session.api;

  String get sitePath;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => load());
  }

  Future<void> load() async {
    try {
      final result = await api.get(Api.site(sitePath));
      if (mounted) {
        setState(() {
          data = result;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  Widget loading() {
    if (error != null) {
      return ScreenScroll(onRefresh: load, children: [
        EmptyState(icon: LucideIcons.wifiOff, title: tr('Не вдалося завантажити'), text: '$error', action: tr('Спробувати ще'), onAction: load),
      ]);
    }
    return const Center(child: CircularProgressIndicator(strokeWidth: 2.4));
  }
}

// ——— Моменти ———

/// Кліпи гравців із YouTube, Twitch і Medal: нові, найкраще за тиждень, від друзів; фільтр за грою.
class MomentsScreen extends StatefulWidget {
  const MomentsScreen({super.key});

  @override
  State<MomentsScreen> createState() => _MomentsScreenState();
}

class _MomentsScreenState extends State<MomentsScreen> with _SitePage {
  String tab = 'new';
  String? game;

  @override
  String get sitePath => '/moments?tab=$tab${game == null ? '' : '&game=${Uri.encodeQueryComponent(game!)}'}';

  Future<void> _like(Map<String, dynamic> m) async {
    try {
      final result = await api.post(Api.site('/moments/${m['id']}/like'));
      if (mounted) {
        setState(() {
          m['liked'] = result['liked'] == true;
          m['likes'] = intOf(result['likes'], intOf(m['likes']));
        });
      }
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _delete(Map<String, dynamic> m) async {
    if (!await confirm(context, tr('Видалити момент?'), action: tr('Видалити'), danger: true)) return;
    if (!mounted) return;
    if (await attempt(context, () => api.delete(Api.site('/moments/${m['id']}')))) await load();
  }

  Future<void> _add() async {
    final options = mapOf(data?['options']);
    final added = await showGcSheet<bool>(
      context,
      title: tr('Додати момент'),
      subtitle: tr('Посилання на кліп YouTube, Twitch або Medal.'),
      builder: (sheet) => _MomentForm(api: api, games: maps(options['games']), servers: maps(options['servers'])),
    );
    if (added == true) await load();
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) return loading();
    final moments = maps(d['moments']);
    final games = maps(d['games']);
    return ScreenScroll(
      onRefresh: load,
      children: [
        PageTitle(
          tr('Моменти'),
          subtitle: tr('Найкращі кліпи гравців із YouTube, Twitch і Medal.'),
          trailing: RoundIcon(icon: LucideIcons.plus, onTap: _add),
        ),
        Segmented(
          options: [SegmentOption('new', tr('Нові')), SegmentOption('week', tr('Тиждень')), SegmentOption('friends', tr('Друзі'))],
          selected: tab,
          onSelect: (v) {
            setState(() {
              tab = v;
              data = null;
            });
            load();
          },
        ),
        if (games.isNotEmpty) ...[
          const SizedBox(height: 10),
          ChipRow(
            options: [('', tr('Усі ігри')), for (final g in games) (text(g['slug']) ?? '', text(g['name']) ?? '')],
            selected: game ?? '',
            onSelect: (v) {
              setState(() {
                game = v.isEmpty ? null : v;
                data = null;
              });
              load();
            },
          ),
        ],
        const SizedBox(height: 12),
        if (moments.isEmpty)
          EmptyState(icon: LucideIcons.clapperboard, title: tr('Моментів поки немає'), text: tr('Поділіться першим кліпом — посиланням на YouTube, Twitch або Medal.'), action: tr('Додати момент'), onAction: _add),
        for (final m in moments)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _MomentCard(moment: m, onLike: () => _like(m), onDelete: m['can_delete'] == true ? () => _delete(m) : null),
          ),
      ],
    );
  }
}

class _MomentCard extends StatelessWidget {
  const _MomentCard({required this.moment, required this.onLike, this.onDelete});
  final Map<String, dynamic> moment;
  final VoidCallback onLike;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final user = mapOf(moment['user']);
    final game = mapOf(moment['game']);
    final server = mapOf(moment['server']);
    final url = text(moment['url']);
    return Glass(
      padding: EdgeInsets.zero,
      radius: 20,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        GestureDetector(
          onTap: url == null ? null : () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
          child: ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: Stack(fit: StackFit.expand, children: [
                text(moment['thumbnail']) != null ? NetImage(text(moment['thumbnail'])) : CoverPlaceholder(seed: moment['id'] ?? 0, icon: LucideIcons.clapperboard, radius: 0, iconSize: 34),
                Container(color: Colors.black26),
                Center(
                  child: Container(
                    width: 54,
                    height: 54,
                    decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                    child: const Icon(LucideIcons.play, color: Colors.white, size: 26),
                  ),
                ),
                Positioned(left: 10, top: 10, child: Pill(label: text(moment['provider_label']) ?? '', background: Colors.black54)),
              ]),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 6, 10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(text(moment['title']) ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(15, weight: FontWeight.w700)),
            const SizedBox(height: 6),
            Row(children: [
              GestureDetector(
                onTap: () => context.push('/u/${user['username']}'),
                child: Avatar(name: text(user['name']) ?? '', url: text(user['avatar_url']), size: 26),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  [text(user['name']), text(game['name']), text(server['name']), ago(moment['created_at'])].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: body(12.5, color: muted),
                ),
              ),
              TextButton.icon(
                onPressed: onLike,
                icon: Icon(LucideIcons.heart, size: 18, color: moment['liked'] == true ? pink : muted),
                label: Text(compact(moment['likes']), style: body(13, color: moment['liked'] == true ? pink : muted, weight: FontWeight.w600)),
              ),
              if (onDelete != null) IconButton(onPressed: onDelete, icon: const Icon(LucideIcons.trash2, size: 18, color: faint)),
            ]),
          ]),
        ),
      ]),
    );
  }
}

class _MomentForm extends StatefulWidget {
  const _MomentForm({required this.api, required this.games, required this.servers});
  final Api api;
  final List<Map<String, dynamic>> games;
  final List<Map<String, dynamic>> servers;

  @override
  State<_MomentForm> createState() => _MomentFormState();
}

class _MomentFormState extends State<_MomentForm> {
  final url = TextEditingController();
  final title = TextEditingController();
  String? game;
  String? server;
  bool busy = false;

  @override
  void dispose() {
    url.dispose();
    title.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (url.text.trim().isEmpty) return;
    setState(() => busy = true);
    final ok = await attempt(context, () => widget.api.post(Api.site('/moments'), {
          'url': url.text.trim(),
          if (title.text.trim().isNotEmpty) 'title': title.text.trim(),
          'game': ?game,
          'server': ?server,
        }));
    if (!mounted) return;
    setState(() => busy = false);
    if (ok) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        GcField(controller: url, label: tr('Посилання на кліп'), icon: LucideIcons.link, keyboard: TextInputType.url, autofocus: true),
        const SizedBox(height: 10),
        GcField(controller: title, label: tr('Назва (необов’язково)'), icon: LucideIcons.type),
        if (widget.games.isNotEmpty) ...[
          const SizedBox(height: 10),
          GcSelect<String?>(
            expand: true,
            hint: tr('Гра'),
            value: game,
            items: [(null, tr('Без гри')), for (final g in widget.games) (text(g['slug']), text(g['name']) ?? '')],
            onChanged: (v) => setState(() => game = v),
          ),
        ],
        if (widget.servers.isNotEmpty) ...[
          const SizedBox(height: 10),
          GcSelect<String?>(
            expand: true,
            hint: tr('Сервер'),
            value: server,
            items: [(null, tr('Без сервера')), for (final s in widget.servers) (text(s['slug']), text(s['name']) ?? '')],
            onChanged: (v) => setState(() => server = v),
          ),
        ],
        const SizedBox(height: 14),
        PrimaryButton(label: tr('Додати'), icon: LucideIcons.plus, busy: busy, onPressed: busy ? null : _save),
      ]),
    );
  }
}

// ——— Завдання й сезон ———

final _questIcons = <String, IconData>{
  'pen-line': LucideIcons.penLine,
  'message-circle': LucideIcons.messageCircle,
  'heart': LucideIcons.heart,
  'vote': LucideIcons.vote,
  'clapperboard': LucideIcons.clapperboard,
  'user-round-search': LucideIcons.userRoundSearch,
  'user-plus': LucideIcons.userPlus,
  'image': LucideIcons.image,
  'circle-play': LucideIcons.circlePlay,
};

/// Назви завдань — як на сайті (DailyQuests::POOL).
Map<String, String> _questTitles() => {
      'post': tr('Опублікуйте запис'),
      'comment': tr('Залиште 3 коментарі'),
      'like': tr('Вподобайте 5 записів'),
      'vote': tr('Проголосуйте за сервер'),
      'moment': tr('Поділіться моментом'),
      'party': tr('Створіть паті або приєднайтеся до неї'),
      'friend': tr('Додайте друга'),
      'photo': tr('Завантажте фото'),
      'story': tr('Опублікуйте сторіс'),
    };

const _questLinks = {
  'post': '/feed',
  'comment': '/feed',
  'like': '/feed',
  'vote': '/servers',
  'moment': '/moments',
  'party': '/party',
  'friend': '/people',
  'photo': '/photos',
  'story': '/feed',
};

/// Щоденні завдання (досвід і очки сезону) і таблиця місяця.
class QuestsScreen extends StatefulWidget {
  const QuestsScreen({super.key});

  @override
  State<QuestsScreen> createState() => _QuestsScreenState();
}

class _QuestsScreenState extends State<QuestsScreen> with _SitePage {
  @override
  String get sitePath => '/quests';

  Future<void> _claim(String key) async {
    if (await attempt(context, () => api.post(Api.site('/quests/$key/claim')))) await load();
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) return loading();
    final quests = maps(d['quests']);
    final season = mapOf(d['season']);
    final me = mapOf(season['me']);
    final top = maps(season['top']);
    final resets = DateTime.tryParse(text(d['resets_at']) ?? '')?.toLocal();
    final ends = DateTime.tryParse(text(season['ends_at']) ?? '')?.toLocal();
    final daysLeft = ends == null ? 0 : (ends.difference(DateTime.now()).inHours / 24).ceil().clamp(0, 99);
    final titles = _questTitles();
    return ScreenScroll(
      onRefresh: load,
      children: [
        PageTitle(
          tr('Завдання дня'),
          subtitle: resets == null ? null : tr('Нові завдання о {time}', {'time': '${resets.hour.toString().padLeft(2, '0')}:${resets.minute.toString().padLeft(2, '0')}'}),
          trailing: Pill(label: tr('Виконано всього: {n}', {'n': intOf(d['completed'])})),
        ),
        for (final q in quests) ...[
          _QuestTile(
            quest: q,
            title: titles[text(q['key'])] ?? text(q['title']) ?? '',
            icon: _questIcons[text(q['icon'])] ?? LucideIcons.target,
            onClaim: () => _claim(text(q['key'])!),
            onGo: _questLinks[text(q['key'])] == null ? null : () => context.go(_questLinks[text(q['key'])]!),
          ),
          const SizedBox(height: 8),
        ],
        const SizedBox(height: 10),
        Glass(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            CardTitle(tr('Сезон'), icon: LucideIcons.trophy),
            Text(tr('До кінця сезону: {n} дн.', {'n': daysLeft}), style: body(12.5, color: muted)),
            const SizedBox(height: 8),
            Text(
              me['place'] != null ? '${tr('Ваше місце: {place}', {'place': me['place']})} · ${compact(me['points'])} XP' : tr('Виконуйте завдання, щоб потрапити в таблицю сезону.'),
              style: body(13.5, color: soft, weight: FontWeight.w600),
            ),
            const SizedBox(height: 10),
            if (top.isEmpty) Text(tr('Поки що ніхто не набрав очок у цьому сезоні.'), style: body(13, color: muted)),
            for (final row in top)
              UserTile(
                user: mapOf(row['user']),
                size: 38,
                onTap: () => context.push('/u/${mapOf(row['user'])['username']}'),
                subtitle: '${compact(row['points'])} XP',
                trailing: Text('#${row['place']}', style: body(15, weight: FontWeight.w800, color: switch (intOf(row['place'])) { 1 => gold, 2 => soft, 3 => const Color(0xFFFDBA74), _ => muted })),
              ),
          ]),
        ),
      ],
    );
  }
}

class _QuestTile extends StatelessWidget {
  const _QuestTile({required this.quest, required this.title, required this.icon, required this.onClaim, this.onGo});
  final Map<String, dynamic> quest;
  final String title;
  final IconData icon;
  final VoidCallback onClaim;
  final VoidCallback? onGo;

  @override
  Widget build(BuildContext context) {
    final target = intOf(quest['target'], 1);
    final progress = intOf(quest['progress']).clamp(0, target);
    final done = quest['done'] == true;
    final claimed = quest['claimed'] == true;
    return Glass(
      padding: const EdgeInsets.all(12),
      radius: 18,
      child: Row(children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(color: (claimed ? green : primary).withValues(alpha: 0.14), borderRadius: BorderRadius.circular(12)),
          child: Icon(claimed ? LucideIcons.check : icon, color: claimed ? green : primary, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(child: Text(title, style: body(14, weight: FontWeight.w600))),
              if (quest['bonus'] == true) ...[const SizedBox(width: 6), const Icon(LucideIcons.sparkles, size: 14, color: gold)],
            ]),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(value: progress / target, minHeight: 5, color: claimed ? green : primary, backgroundColor: Colors.white.withValues(alpha: 0.07)),
            ),
            const SizedBox(height: 4),
            Text('$progress / $target · +${quest['xp']} XP', style: body(12, color: muted)),
          ]),
        ),
        const SizedBox(width: 10),
        if (claimed)
          Text(tr('Отримано'), style: body(12.5, color: green, weight: FontWeight.w600))
        else if (done)
          PrimaryButton(label: tr('Забрати'), compact: true, expand: false, onPressed: onClaim)
        else if (onGo != null)
          GhostButton(label: tr('Виконати'), compact: true, expand: false, onPressed: onGo),
      ]),
    );
  }
}

// ——— Збережене ———

/// Збережені пости, фільми, ігри й сервери.
class SavedScreen extends StatefulWidget {
  const SavedScreen({super.key});

  @override
  State<SavedScreen> createState() => _SavedScreenState();
}

class _SavedScreenState extends State<SavedScreen> with _SitePage {
  @override
  String get sitePath => '/saved';

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) return loading();
    final items = maps(d['items']);
    return ScreenScroll(
      onRefresh: load,
      children: [
        PageTitle(tr('Збережене')),
        if (items.isEmpty) EmptyState(icon: LucideIcons.bookmark, title: tr('Тут з’являться пости, фільми, ігри й сервери')),
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: item['kind'] == 'post'
                ? PostCard(post: mapOf(item['post']), onChanged: load)
                : Glass(
                    padding: const EdgeInsets.all(10),
                    radius: 18,
                    onTap: () => context.push(appPathFor(text(item['href']))),
                    child: Row(children: [
                      SizedBox(
                        width: 54,
                        height: 54,
                        child: text(item['image']) != null
                            ? NetImage(text(item['image']), radius: 12)
                            : CoverPlaceholder(
                                seed: item['title'] ?? '',
                                radius: 12,
                                icon: switch (item['kind']) { 'movie' => LucideIcons.film, 'game' => LucideIcons.gamepad2, _ => LucideIcons.server },
                              ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(text(item['title']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(15, weight: FontWeight.w600)),
                          Text(switch (item['kind']) { 'movie' => tr('Кіно'), 'game' => tr('Гра'), _ => tr('Сервер') }, style: body(12.5, color: muted)),
                        ]),
                      ),
                      const Icon(LucideIcons.chevronRight, color: muted),
                    ]),
                  ),
          ),
      ],
    );
  }
}

/// Кнопки сторінки фільму, гри чи сервера, як на сайті: «Зберегти», «Стежити» (сповіщення) і «Закріпити в профілі».
class SubjectActions extends StatefulWidget {
  const SubjectActions({required this.kind, required this.id, this.saved = false, this.following, this.pinned, this.size = 40, super.key});
  final String kind;
  final Object id;
  final bool saved;

  /// `null` — кнопки «Стежити» немає (для фільмів на сайті її теж немає).
  final bool? following;
  final bool? pinned;
  final double size;

  @override
  State<SubjectActions> createState() => _SubjectActionsState();
}

class _SubjectActionsState extends State<SubjectActions> {
  late bool saved = widget.saved;
  late bool? following = widget.following;
  late bool? pinned = widget.pinned;

  Future<void> _toggle(String what) async {
    final api = AppScope.read(context).session.api;
    final body = {'kind': widget.kind, 'id': widget.id};
    try {
      switch (what) {
        case 'saved':
          final r = await api.post(Api.site('/saved'), body);
          if (!mounted) return;
          setState(() => saved = r['saved'] == true);
          toast(context, saved ? tr('Збережено.') : tr('Прибрано зі збереженого.'));
        case 'follow':
          final r = await api.post(Api.site('/follows'), body);
          if (!mounted) return;
          setState(() => following = r['following'] == true);
          toast(context, following == true ? tr('Ви стежите — новини прийдуть у сповіщення.') : tr('Ви більше не стежите.'));
        case 'pin':
          final r = await api.post(Api.site('/me/pin'), body);
          if (!mounted) return;
          setState(() => pinned = r['pinned'] == true);
          toast(context, pinned == true ? tr('Закріплено у вашому профілі.') : tr('Відкріплено з профілю.'));
      }
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      RoundIcon(
        icon: saved ? LucideIcons.bookmarkCheck : LucideIcons.bookmark,
        color: saved ? gold : ink,
        size: widget.size,
        tooltip: saved ? tr('Прибрати зі збереженого') : tr('Зберегти'),
        onTap: () => _toggle('saved'),
      ),
      if (following != null) ...[
        const SizedBox(width: 6),
        RoundIcon(
          icon: following! ? LucideIcons.bellRing : LucideIcons.bell,
          color: following! ? primary : ink,
          size: widget.size,
          tooltip: following! ? tr('Не стежити') : tr('Стежити'),
          onTap: () => _toggle('follow'),
        ),
      ],
      if (pinned != null) ...[
        const SizedBox(width: 6),
        RoundIcon(
          icon: pinned! ? LucideIcons.pinOff : LucideIcons.pin,
          color: pinned! ? primary : ink,
          size: widget.size,
          tooltip: pinned! ? tr('Відкріпити з профілю') : tr('Закріпити в профілі'),
          onTap: () => _toggle('pin'),
        ),
      ],
    ]);
  }
}

// ——— Чернетки ———

/// Чернетки й відкладені записи: опублікувати зараз або видалити.
class DraftsScreen extends StatefulWidget {
  const DraftsScreen({super.key});

  @override
  State<DraftsScreen> createState() => _DraftsScreenState();
}

class _DraftsScreenState extends State<DraftsScreen> with _SitePage {
  @override
  String get sitePath => '/posts/drafts';

  Future<void> _publish(Map<String, dynamic> draft) async {
    if (await attempt(context, () => api.post(Api.site('/posts/${draft['id']}/publish')))) await load();
  }

  Future<void> _delete(Map<String, dynamic> draft) async {
    if (!await confirm(context, tr('Видалити чернетку?'), action: tr('Видалити'), danger: true)) return;
    if (!mounted) return;
    if (await attempt(context, () => api.delete('/api/v1/posts/${draft['id']}'))) await load();
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) return loading();
    final drafts = maps(d['drafts']);
    return ScreenScroll(
      onRefresh: load,
      children: [
        PageTitle(tr('Чернетки'), subtitle: tr('Чернетки й записи, заплановані на потім.')),
        if (drafts.isEmpty) EmptyState(icon: LucideIcons.filePen, title: tr('Чернеток немає'), text: tr('Збережіть запис як чернетку або заплануйте публікацію — він з’явиться тут.')),
        for (final draft in drafts)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Glass(
              padding: const EdgeInsets.all(14),
              radius: 18,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(text(draft['body']) ?? tr('Без тексту'), maxLines: 6, overflow: TextOverflow.ellipsis, style: body(14.5).copyWith(height: 1.4)),
                const SizedBox(height: 8),
                Text(
                  text(draft['publish_at']) != null ? tr('Вийде {time}', {'time': _when(draft['publish_at'])}) : tr('Чернетка · {time}', {'time': ago(draft['created_at'])}),
                  style: body(12.5, color: muted),
                ),
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(child: PrimaryButton(label: tr('Опублікувати зараз'), icon: LucideIcons.send, compact: true, onPressed: () => _publish(draft))),
                  const SizedBox(width: 8),
                  GhostButton(label: tr('Видалити'), icon: LucideIcons.trash2, compact: true, expand: false, color: dangerSoft, onPressed: () => _delete(draft)),
                ]),
              ]),
            ),
          ),
      ],
    );
  }
}

String _when(dynamic iso) {
  final at = DateTime.tryParse(text(iso) ?? '')?.toLocal();
  if (at == null) return '';
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(at.day)}.${two(at.month)}.${at.year} ${two(at.hour)}:${two(at.minute)}';
}

// ——— Обрані повідомлення ———

/// Повідомлення, позначені зірочкою в чатах.
class SavedMessagesScreen extends StatefulWidget {
  const SavedMessagesScreen({super.key});

  @override
  State<SavedMessagesScreen> createState() => _SavedMessagesScreenState();
}

class _SavedMessagesScreenState extends State<SavedMessagesScreen> with _SitePage {
  @override
  String get sitePath => '/messages/saved';

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) return loading();
    final items = maps(d['items']);
    return ScreenScroll(
      onRefresh: load,
      children: [
        PageTitle(tr('Обрані повідомлення')),
        if (items.isEmpty) EmptyState(icon: LucideIcons.star, title: tr('Обраних повідомлень немає'), text: tr('Позначайте важливі повідомлення зірочкою в чаті — вони з’являться тут.')),
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Glass(
              padding: const EdgeInsets.all(12),
              radius: 18,
              onTap: () => context.push(appPathFor(text(item['href']))),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Icon(LucideIcons.star, color: gold, size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(text(item['body']) ?? text(item['preview']) ?? '', maxLines: 4, overflow: TextOverflow.ellipsis, style: body(14).copyWith(height: 1.35)),
                    const SizedBox(height: 4),
                    Text([text(item['author']), _when(item['created_at'])].whereType<String>().where((s) => s.isNotEmpty).join(' · '), style: body(12, color: muted)),
                  ]),
                ),
              ]),
            ),
          ),
      ],
    );
  }
}

// ——— Релізи ———

/// Виходи ігор і сезони на найближчі місяці; «Цікаво» нагадає в день старту.
class ReleasesScreen extends StatefulWidget {
  const ReleasesScreen({super.key});

  @override
  State<ReleasesScreen> createState() => _ReleasesScreenState();
}

class _ReleasesScreenState extends State<ReleasesScreen> with _SitePage {
  @override
  String get sitePath => '/events/releases';

  Future<void> _rsvp(Map<String, dynamic> e, bool going) async {
    final url = text(e['rsvp_url']);
    if (url == null) return;
    final body = e['kind'] == 'clan' ? <String, dynamic>{} : {'going': going};
    if (await attempt(context, () => api.post(Api.site(url), body))) await load();
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) return loading();
    final events = maps(d['events']);
    return ScreenScroll(
      onRefresh: load,
      children: [
        PageTitle(tr('Релізи і сезони'), subtitle: tr('Виходи ігор і нові сезони на найближчі місяці. «Цікаво» — нагадаємо в день старту.')),
        if (events.isEmpty) EmptyState(icon: LucideIcons.calendarDays, title: tr('Найближчих релізів немає')),
        for (final e in events) Padding(padding: const EdgeInsets.only(bottom: 8), child: EventTile(event: e, onRsvp: (going) => _rsvp(e, going))),
      ],
    );
  }
}

// ——— Мої десять ———

/// Десять улюблених фільмів людини; свої — додаються з картки фільму.
class TopTenScreen extends StatefulWidget {
  const TopTenScreen({required this.username, super.key});
  final String username;

  @override
  State<TopTenScreen> createState() => _TopTenScreenState();
}

class _TopTenScreenState extends State<TopTenScreen> with _SitePage {
  @override
  String get sitePath => '/cinema/ten/${widget.username}';

  Future<void> _remove(Map<String, dynamic> movie) async {
    if (await attempt(context, () => api.post(Api.site('/cinema/ten'), {'movie_id': movie['id']}))) await load();
  }

  Future<void> _follow() async {
    if (await attempt(context, () => api.post(Api.site('/cinema/ratings/${widget.username}')))) await load();
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) return loading();
    final owner = mapOf(d['owner']);
    final movies = maps(d['movies']);
    final mine = d['mine'] == true;
    return ScreenScroll(
      onRefresh: load,
      children: [
        PageTitle(
          mine ? tr('Мої десять') : tr('Десять {name}', {'name': text(owner['first_name']) ?? text(owner['name']) ?? ''}),
          subtitle: mine ? tr('Додавайте фільми кнопкою «До моїх десяти» на сторінці фільму.') : null,
          trailing: mine
              ? null
              : GhostButton(
                  label: d['following'] == true ? tr('Ви стежите') : tr('Стежити за оцінками'),
                  icon: d['following'] == true ? LucideIcons.check : LucideIcons.star,
                  compact: true,
                  expand: false,
                  onPressed: _follow,
                ),
        ),
        if (movies.isEmpty) EmptyState(icon: LucideIcons.film, title: mine ? tr('Ваш список ще порожній') : tr('Список ще порожній')),
        if (movies.isNotEmpty)
          GridView.count(
            crossAxisCount: 3,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 10,
            mainAxisSpacing: 12,
            childAspectRatio: 0.52,
            children: [
              for (var i = 0; i < movies.length; i++)
                Stack(children: [
                  PosterCard(movie: movies[i], footer: '#${i + 1}'),
                  if (mine)
                    Positioned(
                      right: 4,
                      top: 4,
                      child: GestureDetector(
                        onTap: () => _remove(movies[i]),
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                          child: const Icon(LucideIcons.x, size: 14, color: Colors.white),
                        ),
                      ),
                    ),
                ]),
            ],
          ),
      ],
    );
  }
}

// ——— Порівняння серверів ———

/// Два сервери поруч: онлайн, Discord, сім’ї, оцінка.
class ServerCompareScreen extends StatefulWidget {
  const ServerCompareScreen({this.a, this.b, super.key});
  final String? a;
  final String? b;

  @override
  State<ServerCompareScreen> createState() => _ServerCompareScreenState();
}

class _ServerCompareScreenState extends State<ServerCompareScreen> with _SitePage {
  late String? a = widget.a;
  late String? b = widget.b;

  @override
  String get sitePath => '/servers/compare?${[if (a != null) 'a=${Uri.encodeQueryComponent(a!)}', if (b != null) 'b=${Uri.encodeQueryComponent(b!)}'].join('&')}';

  static List<(String, String)> _rows() => [
        ('platform_label', tr('Платформа')),
        ('multiplayer_label', tr('Клієнт')),
        ('language_label', tr('Мова')),
        ('players_online', tr('Зараз онлайн')),
        ('players_max', tr('Максимум')),
        ('players_peak', tr('Пік')),
        ('discord_online', tr('Discord онлайн')),
        ('discord_members', tr('Discord учасники')),
        ('families_count', tr('Сім’ї')),
        ('rating', tr('Оцінка')),
        ('reviews', tr('Відгуки')),
      ];

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) return loading();
    final servers = maps(d['servers']);
    final left = d['left'] is Map ? mapOf(d['left']) : null;
    final right = d['right'] is Map ? mapOf(d['right']) : null;
    Widget picker(String label, String? value, ValueChanged<String?> onChanged) => GcSelect<String?>(
          expand: true,
          hint: label,
          value: value,
          items: [(null, tr('Оберіть сервер')), for (final s in servers) (text(s['slug']), text(s['name']) ?? '')],
          onChanged: (v) {
            onChanged(v);
            setState(() => data = null);
            load();
          },
        );
    String cell(Map<String, dynamic>? side, String key) {
      final v = side?[key];
      if (v == null || '$v'.isEmpty) return '—';
      return v is num ? (key == 'rating' ? '$v' : compact(v)) : '$v';
    }

    return ScreenScroll(
      onRefresh: load,
      children: [
        PageTitle(tr('Порівняння серверів')),
        picker(tr('Перший'), a, (v) => a = v),
        const SizedBox(height: 10),
        picker(tr('Другий'), b, (v) => b = v),
        const SizedBox(height: 14),
        if (left != null || right != null)
          Glass(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Column(children: [
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(children: [
                  const Expanded(flex: 4, child: SizedBox()),
                  for (final side in [left, right])
                    Expanded(
                      flex: 3,
                      child: GestureDetector(
                        onTap: side == null ? null : () => context.push('/servers/${side['slug']}'),
                        child: Text(text(side?['name']) ?? '—', textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: body(13, weight: FontWeight.w700, color: side == null ? faint : primary)),
                      ),
                    ),
                ]),
              ),
              for (final row in _rows())
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  decoration: const BoxDecoration(border: Border(top: BorderSide(color: line))),
                  child: Row(children: [
                    Expanded(flex: 4, child: Text(row.$2, style: body(13, color: muted))),
                    Expanded(flex: 3, child: Text(cell(left, row.$1), textAlign: TextAlign.center, style: body(13.5, weight: FontWeight.w600))),
                    Expanded(flex: 3, child: Text(cell(right, row.$1), textAlign: TextAlign.center, style: body(13.5, weight: FontWeight.w600))),
                  ]),
                ),
            ]),
          )
        else
          EmptyState(icon: LucideIcons.gitCompareArrows, title: tr('Оберіть два сервери'), text: tr('Порівняйте онлайн, Discord, сім’ї та оцінки гравців.')),
      ],
    );
  }
}

/// Відкриває сторінку сайту в браузері (для розділів, які в застосунку не потрібні: оплата, розробникам).
Future<void> openOnSite(String path) => launchUrl(Uri.parse('${Api.root}$path'), mode: LaunchMode.externalApplication);

// ——— Стрім ———

/// Ефір у профілі: «LIVE на Twitch · гра · глядачі» або посилання на канал.
class StreamBadge extends StatelessWidget {
  const StreamBadge(this.stream, {super.key});
  final Map<String, dynamic> stream;

  @override
  Widget build(BuildContext context) {
    final live = stream['live'] == true;
    final url = text(stream['url']);
    final details = [
      text(stream['game']),
      if (stream['viewers'] != null) tr('{n} глядачів', {'n': compact(stream['viewers'])}),
    ].whereType<String>().join(' · ');
    return GestureDetector(
      onTap: url == null ? null : () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: (live ? danger : Colors.white).withValues(alpha: live ? 0.16 : 0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: live ? danger.withValues(alpha: 0.4) : line),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (live) ...[const LiveBadge(), const SizedBox(width: 8)] else ...[const Icon(LucideIcons.radio, size: 15, color: muted), const SizedBox(width: 6)],
          Flexible(
            child: Text(
              live ? (text(stream['title']) ?? tr('В ефірі на {platform}', {'platform': text(stream['platform_label']) ?? ''})) : tr('Стрімить на {platform}', {'platform': text(stream['platform_label']) ?? ''}),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: body(12.5, weight: FontWeight.w600, color: live ? ink : soft),
            ),
          ),
          if (live && details.isNotEmpty) ...[const SizedBox(width: 6), Text(details, style: body(11.5, color: muted))],
        ]),
      ),
    );
  }
}

/// Червона позначка LIVE.
class LiveBadge extends StatelessWidget {
  const LiveBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(color: danger, borderRadius: BorderRadius.circular(6)),
      child: Text('LIVE', style: body(10.5, weight: FontWeight.w800, color: Colors.white)),
    );
  }
}

/// Налаштування: свій канал Twitch або YouTube і ручна позначка «Я в ефірі».
class StreamSettingsCard extends StatefulWidget {
  const StreamSettingsCard({super.key});

  @override
  State<StreamSettingsCard> createState() => _StreamSettingsCardState();
}

class _StreamSettingsCardState extends State<StreamSettingsCard> {
  final channel = TextEditingController();
  String platform = 'twitch';
  Map<String, dynamic>? stream;
  bool loaded = false;
  bool busy = false;

  Api get api => AppScope.read(context).session.api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    channel.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final me = text(AppScope.read(context).session.me?['username']);
    if (me == null) return;
    try {
      final data = await api.get(Api.site('/u/$me'));
      if (!mounted) return;
      setState(() {
        stream = data['stream'] is Map ? mapOf(data['stream']) : null;
        platform = text(stream?['platform']) ?? platform;
        if (stream != null) channel.text = text(stream!['channel']) ?? '';
        loaded = true;
      });
    } catch (_) {
      if (mounted) setState(() => loaded = true);
    }
  }

  Future<void> _run(Future<dynamic> Function() action) async {
    setState(() => busy = true);
    await attempt(context, action);
    if (!mounted) return;
    setState(() => busy = false);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final s = stream;
    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CardTitle(tr('Стрім'), icon: LucideIcons.radio),
        const SizedBox(height: 4),
        Text(tr('Позначка LIVE з’являється сама, коли почнеться ефір. Друзі отримають сповіщення.'), style: body(12.5, color: muted)),
        const SizedBox(height: 12),
        Segmented(
          options: const [SegmentOption('twitch', 'Twitch'), SegmentOption('youtube', 'YouTube')],
          selected: platform,
          onSelect: (v) => setState(() => platform = v),
        ),
        const SizedBox(height: 10),
        GcField(controller: channel, label: platform == 'twitch' ? 'twitch.tv/nickname' : 'youtube.com/@channel', icon: LucideIcons.link, keyboard: TextInputType.url),
        const SizedBox(height: 10),
        PrimaryButton(
          label: tr('Зберегти'),
          busy: busy,
          onPressed: busy || !loaded ? null : () => channel.text.trim().isEmpty ? null : _run(() => api.put(Api.site('/settings/stream'), {'platform': platform, 'channel': channel.text.trim()})),
        ),
        if (s != null) ...[
          const SizedBox(height: 12),
          Row(children: [
            if (s['live'] == true) ...[const LiveBadge(), const SizedBox(width: 8)],
            Expanded(child: Text(s['live'] == true ? tr('Ви в ефірі') : tr('Зараз не в ефірі'), style: body(13.5, color: soft))),
            if (s['live'] != true || s['manual'] == true)
              GhostButton(
                label: s['manual'] == true ? tr('Завершити ефір') : tr('Я в ефірі'),
                compact: true,
                expand: false,
                onPressed: busy ? null : () => _run(() => api.post(Api.site('/settings/stream/live'), {'on': s['manual'] != true})),
              ),
            const SizedBox(width: 6),
            GhostButton(label: tr('Прибрати'), compact: true, expand: false, color: dangerSoft, onPressed: busy ? null : () => _run(() => api.delete(Api.site('/settings/stream')))),
          ]),
        ],
      ]),
    );
  }
}

// ——— Запросити друзів ———

Map<int, String> _referralRewards() => {
      1: tr('Бейдж «Запросив друга»'),
      5: tr('Бейдж «Збирач команди»'),
      10: tr('+300 XP до рівня'),
      25: tr('Бейдж «Амбасадор GameCon»'),
    };

/// Особисте посилання-запрошення, хто прийшов і нагороди за друзів.
class InviteScreen extends StatefulWidget {
  const InviteScreen({super.key});

  @override
  State<InviteScreen> createState() => _InviteScreenState();
}

class _InviteScreenState extends State<InviteScreen> with _SitePage {
  @override
  String get sitePath => '/invite';

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) return loading();
    final link = text(d['link']) ?? '';
    final ladder = maps(d['ladder']);
    final people = maps(d['people']);
    final rewards = _referralRewards();
    return ScreenScroll(
      onRefresh: load,
      children: [
        PageTitle(tr('Запросити друзів'), subtitle: tr('Діліться посиланням — за кожного друга, який підтвердить пошту, ви отримаєте досвід і бейджі.')),
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              decoration: BoxDecoration(color: field, borderRadius: BorderRadius.circular(14), border: Border.all(color: line)),
              child: SelectableText(link, style: body(13.5, color: soft)),
            ),
            const SizedBox(height: 10),
            PrimaryButton(
              label: tr('Копіювати'),
              icon: LucideIcons.copy,
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: '${tr('Приєднуйся до мене на GameCon!')} $link'));
                if (context.mounted) toast(context, tr('Посилання скопійовано.'));
              },
            ),
            const SizedBox(height: 14),
            Row(children: [
              Expanded(child: MetricTile(label: tr('Прийшли'), value: '${d['total'] ?? 0}')),
              const SizedBox(width: 8),
              Expanded(child: MetricTile(label: tr('Активні'), value: '${d['active'] ?? 0}')),
              const SizedBox(width: 8),
              Expanded(child: MetricTile(label: tr('Досвіду'), value: compact(d['xp']))),
            ]),
          ]),
        ),
        const SizedBox(height: 12),
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            CardTitle(tr('Нагороди'), icon: LucideIcons.gift),
            const SizedBox(height: 8),
            for (final step in ladder)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(children: [
                  Icon(step['reached'] == true ? LucideIcons.circleCheck : LucideIcons.circle, size: 18, color: step['reached'] == true ? green : faint),
                  const SizedBox(width: 10),
                  SizedBox(width: 30, child: Text('${step['target']}', style: body(14, weight: FontWeight.w700))),
                  Expanded(child: Text(rewards[intOf(step['target'])] ?? '', style: body(13.5, color: step['reached'] == true ? ink : muted))),
                ]),
              ),
          ]),
        ),
        if (people.isNotEmpty) ...[
          const SizedBox(height: 12),
          Glass(
            child: Column(children: [
              for (final p in people)
                UserTile(
                  user: p,
                  size: 40,
                  onTap: () => context.push('/u/${p['username']}'),
                  trailing: Icon(p['active'] == true ? LucideIcons.circleCheck : LucideIcons.clock, size: 18, color: p['active'] == true ? green : faint),
                ),
            ]),
          ),
        ],
      ],
    );
  }
}

// ——— Запрошення за посиланням ———

/// Вступ у клан, сім’ю чи спільноту за посиланням-запрошенням (сім’ї просять РП-нік і Static ID).
class JoinInviteScreen extends StatefulWidget {
  const JoinInviteScreen({required this.token, super.key});
  final String token;

  @override
  State<JoinInviteScreen> createState() => _JoinInviteScreenState();
}

class _JoinInviteScreenState extends State<JoinInviteScreen> with _SitePage {
  final nickname = TextEditingController();
  final staticId = TextEditingController();
  bool busy = false;

  @override
  String get sitePath => '/join/${widget.token}';

  @override
  void dispose() {
    nickname.dispose();
    staticId.dispose();
    super.dispose();
  }

  Future<void> _accept(Map<String, dynamic> invite) async {
    final identity = invite['needs_identity'] == true;
    if (identity && (nickname.text.trim().isEmpty || staticId.text.trim().isEmpty)) {
      toast(context, tr('Вкажіть РП-нік і Static ID.'));
      return;
    }
    setState(() => busy = true);
    try {
      final result = await api.post(Api.site('/join/${widget.token}'), {
        if (identity) 'rp_nickname': nickname.text.trim(),
        if (identity) 'static_id': staticId.text.trim(),
      });
      if (!mounted) return;
      toast(context, text(result['message']) ?? tr('Запрошення прийнято.'));
      context.go(appPathFor(text(result['redirect']) ?? text(invite['href'])));
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) return loading();
    final invite = mapOf(d['invite']);
    final kind = switch (invite['kind']) { 'family' => tr('Сім’я'), 'clan' => tr('Клан'), _ => tr('Спільнота') };
    return ScreenScroll(
      onRefresh: load,
      children: [
        const SizedBox(height: 20),
        Glass(
          padding: const EdgeInsets.all(20),
          child: Column(children: [
            const Icon(LucideIcons.mailOpen, size: 40, color: primary),
            const SizedBox(height: 10),
            Text(tr('Запрошення'), style: display(22)),
            const SizedBox(height: 4),
            Text(tr('Вас запросили приєднатися.'), style: body(13.5, color: muted)),
            const SizedBox(height: 14),
            Pill(label: kind),
            const SizedBox(height: 6),
            Text(text(invite['name']) ?? '', textAlign: TextAlign.center, style: display(20)),
            if (invite['needs_identity'] == true) ...[
              const SizedBox(height: 14),
              GcField(controller: nickname, label: tr('Ім’я_Прізвище'), icon: LucideIcons.idCard),
              const SizedBox(height: 10),
              GcField(controller: staticId, label: tr('Static ID'), icon: LucideIcons.hash, keyboard: TextInputType.number),
            ],
            const SizedBox(height: 16),
            PrimaryButton(label: tr('Прийняти запрошення'), icon: LucideIcons.check, busy: busy, onPressed: busy ? null : () => _accept(invite)),
          ]),
        ),
      ],
    );
  }
}
