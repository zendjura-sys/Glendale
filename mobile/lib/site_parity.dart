import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// Паритет із сайтом: те, що зроблено на сайті, — і в застосунку (ті самі мости site/…).
// Оплата в застосунку — лише через Google Play Billing, тож тут без покупок за баланс сайту:
// оформлення можна вдягати, а сімейним планом — керувати.

/// «Моє оформлення» (№255): куплені рамки, кольори ніку, значки й ефекти шапки — вдягнути чи зняти.
class MyLookScreen extends StatelessWidget {
  const MyLookScreen({super.key});

  static const _groups = [
    ('frame', 'Рамки аватара'),
    ('name', 'Колір ніку'),
    ('badge', 'Значки біля імені'),
    ('header', 'Ефекти шапки профілю'),
  ];

  @override
  Widget build(BuildContext context) {
    final api = AppScope.of(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/shop')),
      builder: (data, reload) {
        final owned = maps(data['items']).where((i) => i['owned'] == true).toList();
        return ScreenScroll(onRefresh: reload, children: [
          PageTitle(tr('Моє оформлення'), subtitle: tr('Куплене оформлення — вдягайте й знімайте будь-коли.')),
          if (owned.isEmpty)
            EmptyState(icon: LucideIcons.sparkles, title: tr('Поки нічого немає'), text: tr('Рамки, кольори ніку й значки з’являться тут, щойно вони будуть у вас.')),
          for (final (type, label) in _groups)
            if (owned.any((i) => i['type'] == type)) ...[
              const SizedBox(height: 8),
              Text(tr(label), style: body(15, weight: FontWeight.w700)),
              const SizedBox(height: 8),
              for (final item in owned.where((i) => i['type'] == type))
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Glass(
                    padding: const EdgeInsets.all(12),
                    child: Row(children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(colors: _swatch(item)),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: Text(text(item['name']) ?? '', style: body(14, weight: FontWeight.w600))),
                      GhostButton(
                        label: item['equipped'] == true ? tr('Вдягнуто') : tr('Вдягнути'),
                        icon: item['equipped'] == true ? LucideIcons.check : null,
                        compact: true,
                        expand: false,
                        onPressed: () async {
                          final ok = await attempt(context, () => api.post(Api.site('/shop/equip'), {'type': type, 'value': item['equipped'] == true ? null : item['value']}));
                          if (ok) await reload();
                        },
                      ),
                    ]),
                  ),
                ),
            ],
        ]);
      },
    );
  }

  /// Колір зразка: градієнт рамки/ніку або колір значка.
  static List<Color> _swatch(Map<String, dynamic> item) {
    final colors = [for (final c in (item['colors'] is List ? item['colors'] as List : const [])) _hex('$c')];
    if (colors.length > 1) return colors;
    final one = colors.isNotEmpty ? colors.first : _hex('${item['color'] ?? '#6b8afd'}');
    return [one, one];
  }

  static Color _hex(String value) {
    final v = int.tryParse(value.replaceFirst('#', ''), radix: 16);
    return v == null ? primary : Color(0xFF000000 | v);
  }
}

/// Сімейний план GameCon+ (№215): хто в плані, запрошення й «Прийняти». Купівля — не тут.
class HouseholdScreen extends StatelessWidget {
  const HouseholdScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = AppScope.of(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/plus/household')),
      builder: (data, reload) {
        final members = maps(data['members']);
        final invites = maps(data['invites']);
        final memberOf = data['member_of'] is Map ? mapOf(data['member_of']) : null;
        final until = DateTime.tryParse(text(data['until']) ?? '')?.toLocal();
        final nick = TextEditingController();
        Future<void> act(Future<dynamic> Function() call) async {
          if (await attempt(context, call)) await reload();
        }

        return ScreenScroll(onRefresh: reload, children: [
          PageTitle(tr('Сімейний план GameCon+'), subtitle: tr('До {n} людей з усіма перевагами GameCon+.', {'n': intOf(data['max'], 5)})),
          if (memberOf != null)
            Glass(
              padding: const EdgeInsets.all(14),
              child: UserTile(user: mapOf(memberOf['owner']), subtitle: tr('Ви в сімейному плані цієї людини')),
            ),
          for (final invite in invites)
            Glass(
              padding: const EdgeInsets.all(12),
              child: Row(children: [
                Expanded(child: UserTile(user: mapOf(invite['user']), subtitle: tr('Запрошує вас у сімейний план'))),
                PrimaryButton(label: tr('Прийняти'), compact: true, expand: false, onPressed: () => act(() => api.post(Api.site('/plus/household/${invite['id']}/accept')))),
              ]),
            ),
          if (until != null) ...[
            const SizedBox(height: 8),
            Text(tr('План діє до {date}', {'date': '${until.day.toString().padLeft(2, '0')}.${until.month.toString().padLeft(2, '0')}.${until.year}'}), style: body(13, color: muted)),
            const SizedBox(height: 8),
            for (final m in members)
              Glass(
                padding: const EdgeInsets.all(12),
                child: Row(children: [
                  Expanded(child: UserTile(user: mapOf(m['user']), subtitle: m['status'] == 'active' ? tr('У плані') : tr('Запрошено'))),
                  GhostButton(label: tr('Прибрати'), compact: true, expand: false, onPressed: () => act(() => api.delete(Api.site('/plus/household/${m['id']}')))),
                ]),
              ),
            if (members.length < intOf(data['max'], 5)) ...[
              const SizedBox(height: 8),
              GcField(controller: nick, label: tr('Нік людини')),
              const SizedBox(height: 8),
              PrimaryButton(label: tr('Запросити'), icon: LucideIcons.userPlus, onPressed: () => act(() => api.post(Api.site('/plus/household'), {'username': nick.text.trim()}))),
            ],
          ] else if (memberOf == null && invites.isEmpty)
            EmptyState(icon: LucideIcons.usersRound, title: tr('Сімейного плану поки немає'), text: tr('Тут з’являться запрошення в сімейний план і люди у вашому плані.')),
        ]);
      },
    );
  }
}

/// Батьківський контроль (№227): дорослий запрошує підлітка, правила (нічна пауза, заявки лише
/// від друзів друзів) і загальна картина без листування; підліток бачить запрошення.
class ParentalScreen extends StatelessWidget {
  const ParentalScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = AppScope.of(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/settings/parental')),
      builder: (data, reload) {
        final children = maps(data['children']);
        final parents = maps(data['parents']);
        final teen = data['teen_mode'] is Map ? mapOf(data['teen_mode']) : const <String, dynamic>{};
        final nick = TextEditingController();
        Future<void> act(Future<dynamic> Function() call) async {
          if (await attempt(context, call)) await reload();
        }

        return ScreenScroll(onRefresh: reload, children: [
          PageTitle(tr('Батьківський контроль'), subtitle: tr('Нічна пауза й заявки лише від друзів друзів. Листування батьки не бачать.')),
          for (final p in parents)
            Glass(
              padding: const EdgeInsets.all(12),
              child: Row(children: [
                Expanded(child: UserTile(user: mapOf(p['user']), subtitle: p['status'] == 'active' ? tr('Батьківський контроль діє') : tr('Пропонує батьківський контроль'))),
                if (p['status'] != 'active') ...[
                  PrimaryButton(label: tr('Погодитися'), compact: true, expand: false, onPressed: () => act(() => api.post(Api.site('/settings/parental/${p['id']}/accept')))),
                  const SizedBox(width: 6),
                  GhostButton(label: tr('Відхилити'), compact: true, expand: false, onPressed: () => act(() => api.delete(Api.site('/settings/parental/${p['id']}')))),
                ],
              ]),
            ),
          for (final c in children) ...[
            const SizedBox(height: 8),
            _ChildCard(link: c, onChanged: reload),
          ],
          if (teen['locked'] != true) ...[
            const SizedBox(height: 12),
            Text(tr('Додати підлітка'), style: body(15, weight: FontWeight.w700)),
            const SizedBox(height: 8),
            GcField(controller: nick, label: tr('Нік підлітка')),
            const SizedBox(height: 8),
            PrimaryButton(label: tr('Запропонувати контроль'), icon: LucideIcons.shieldCheck, onPressed: () => act(() => api.post(Api.site('/settings/parental'), {'username': nick.text.trim()}))),
          ],
        ]);
      },
    );
  }
}

class _ChildCard extends StatelessWidget {
  const _ChildCard({required this.link, required this.onChanged});
  final Map<String, dynamic> link;
  final Future<void> Function() onChanged;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.of(context).session.api;
    final rules = mapOf(link['rules']);
    final summary = link['summary'] is Map ? mapOf(link['summary']) : null;
    final night = rules['night_from'] != null;
    Future<void> save(Map<String, dynamic> patch) async {
      if (await attempt(context, () => api.put(Api.site('/settings/parental/${link['id']}'), patch))) await onChanged();
    }

    return Glass(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        UserTile(user: mapOf(link['user']), subtitle: link['status'] == 'active' ? tr('Контроль діє') : tr('Чекає згоди підлітка')),
        if (summary != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(tr('Друзів: {f} (за тиждень +{n}) · спільнот: {c}', {'f': summary['friends'], 'n': summary['new_friends'], 'c': summary['communities']}), style: body(12.5, color: muted)),
          ),
        SwitchListTile(
          value: night,
          contentPadding: EdgeInsets.zero,
          title: Text(tr('Нічна пауза 23:00–07:00'), style: body(14, weight: FontWeight.w600)),
          onChanged: (v) => save(v ? {'night_from': '23:00', 'night_to': '07:00'} : {'night_from': null, 'night_to': null}),
        ),
        SwitchListTile(
          value: rules['friends_of_friends'] == true,
          contentPadding: EdgeInsets.zero,
          title: Text(tr('Заявки в друзі лише від друзів друзів'), style: body(14, weight: FontWeight.w600)),
          onChanged: (v) => save({'friends_of_friends': v}),
        ),
        Align(
          alignment: Alignment.centerLeft,
          child: GhostButton(label: tr('Прибрати контроль'), compact: true, expand: false, onPressed: () async {
            if (await attempt(context, () => api.delete(Api.site('/settings/parental/${link['id']}')))) await onChanged();
          }),
        ),
      ]),
    );
  }
}

/// Друзі зі Steam (№279): хто з друзів у Steam уже на GameCon — заявки одним натиском.
class SteamImportCard extends StatefulWidget {
  const SteamImportCard({super.key});

  @override
  State<SteamImportCard> createState() => _SteamImportCardState();
}

class _SteamImportCardState extends State<SteamImportCard> {
  Map<String, dynamic>? result;
  bool busy = false;

  Future<void> _run(Future<Map<String, dynamic>> Function() call) async {
    setState(() => busy = true);
    try {
      final r = await call();
      if (mounted) setState(() => result = r);
      if (r['sent'] != null && mounted) toast(context, tr('Заявок надіслано: {n}', {'n': r['sent']}));
    } catch (e) {
      if (mounted) toast(context, e, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = AppScope.of(context).session.api;
    final r = result;
    if (r?['status'] == 'off') return const SizedBox.shrink();
    final people = maps(r?['people']);
    final addable = people.where((p) => p['state'] == 'none' || p['state'] == 'incoming').toList();
    return Glass(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CardTitle(tr('Друзі зі Steam'), icon: LucideIcons.gamepad2),
        if (r == null) ...[
          Text(tr('Знайдемо, хто з ваших друзів у Steam уже на GameCon.'), style: body(13, color: muted)),
          const SizedBox(height: 10),
          PrimaryButton(label: tr('Знайти друзів'), busy: busy, onPressed: () => _run(() => api.get(Api.site('/friends/import/steam')))),
        ] else if (r['status'] == 'no_steam')
          Text(tr('Спершу прив’яжіть Steam у «Граю в…» — тоді знайдемо друзів.'), style: body(13, color: muted))
        else if (r['status'] == 'private')
          Text(tr('Список друзів у Steam закритий. Steam → Профіль → Приватність → «Список друзів: публічний».'), style: body(13, color: muted))
        else if (people.isEmpty)
          Text(tr('Поки ніхто з ваших друзів Steam не прив’язав Steam до GameCon.'), style: body(13, color: muted))
        else ...[
          if (addable.length > 1)
            PrimaryButton(
              label: tr('Додати всіх ({n})', {'n': addable.length}),
              busy: busy,
              onPressed: () => _run(() => api.post(Api.site('/friends/import/steam'), {'ids': [for (final p in addable) mapOf(p['user'])['id']]})),
            ),
          for (final p in people)
            UserTile(
              user: mapOf(p['user']),
              onTap: () => context.push('/u/${mapOf(p['user'])['username']}'),
              subtitle: switch (p['state']) { 'friends' => tr('Друзі'), 'outgoing' => tr('Заявку надіслано'), 'incoming' => tr('Хоче дружити'), _ => '@${mapOf(p['user'])['username']}' },
              trailing: (p['state'] == 'none' || p['state'] == 'incoming')
                  ? GhostButton(
                      label: p['state'] == 'incoming' ? tr('Прийняти') : tr('Додати'),
                      compact: true,
                      expand: false,
                      onPressed: () => _run(() => api.post(Api.site('/friends/import/steam'), {'ids': [mapOf(p['user'])['id']]})),
                    )
                  : null,
            ),
        ],
      ]),
    );
  }
}

/// «Новини GameCon на пошту» (№284): лише за згодою.
class NewsEmailSwitch extends StatefulWidget {
  const NewsEmailSwitch({super.key});

  @override
  State<NewsEmailSwitch> createState() => _NewsEmailSwitchState();
}

class _NewsEmailSwitchState extends State<NewsEmailSwitch> {
  bool? pending;

  @override
  Widget build(BuildContext context) {
    final session = AppScope.read(context).session;
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) => SwitchListTile(
        value: pending ?? (session.me?['news_email'] == true),
        contentPadding: EdgeInsets.zero,
        title: Text(tr('Новини GameCon на пошту'), style: body(14.5, weight: FontWeight.w600)),
        subtitle: Text(tr('Великі оновлення й події — кілька листів на місяць. Відписатися можна в кожному листі.'), style: body(12.5, color: muted)),
        onChanged: (value) async {
          setState(() => pending = value);
          await attempt(context, () => session.api.patch(Api.site('/settings/digest'), {'news_email': value}));
          try {
            await session.refreshMe();
          } catch (_) {}
          if (mounted) setState(() => pending = null);
        },
      ),
    );
  }
}

/// Статистика перегляду в профілі (№272): години, тайтли, серії, улюблені жанри.
class CinemaStatsCard extends StatelessWidget {
  const CinemaStatsCard({required this.stats, super.key});
  final Map<String, dynamic> stats;

  @override
  Widget build(BuildContext context) {
    final genres = maps(stats['genres']);
    Widget cell(Object? value, String label) => Expanded(
          child: Column(children: [
            Text('${value ?? 0}', style: body(20, weight: FontWeight.w800)),
            Text(label, style: body(11.5, color: muted), textAlign: TextAlign.center),
          ]),
        );
    return Glass(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CardTitle(tr('Кіно в цифрах'), icon: LucideIcons.clapperboard),
        Row(children: [
          cell(stats['hours'], tr('годин')),
          cell(stats['watched'], tr('переглянуто')),
          cell(stats['episodes'], tr('серій')),
          cell(stats['this_year'], tr('цього року')),
        ]),
        if (genres.isNotEmpty || stats['avg_rating'] != null) ...[
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 6, children: [
            for (final g in genres) Pill(label: '${g['name']} · ${g['count']}', color: soft),
            if (stats['avg_rating'] != null) Pill(label: tr('Середня оцінка {r}', {'r': stats['avg_rating']}), color: primary),
          ]),
        ],
      ]),
    );
  }
}

/// Досягнення Steam у профілі: найрідкісніші з ігор, у які людина грає найбільше.
class SteamShowcaseCard extends StatefulWidget {
  const SteamShowcaseCard({required this.username, super.key});
  final String username;

  @override
  State<SteamShowcaseCard> createState() => _SteamShowcaseCardState();
}

class _SteamShowcaseCardState extends State<SteamShowcaseCard> {
  // Один запит на екран профілю, а не на кожну перебудову.
  late final Future<Map<String, dynamic>> future = AppScope.read(context).session.api.get(Api.site('/u/${widget.username}/achievements'));

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: future,
      builder: (context, snap) {
        final games = maps(snap.data?['games']);
        if (games.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Glass(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              CardTitle(tr('Досягнення Steam'), icon: LucideIcons.award),
              for (final g in games) ...[
                Text('${text(g['game']) ?? ''} · ${g['unlocked']}/${g['total']}', style: body(14, weight: FontWeight.w700)),
                const SizedBox(height: 6),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final a in maps(g['rarest']))
                    Tooltip(
                      message: '${text(a['name']) ?? ''} · ${a['percent']}%',
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: text(a['icon']) == null
                            ? Container(width: 40, height: 40, color: raised, child: Icon(LucideIcons.award, size: 18, color: soft))
                            : Image.network(text(a['icon'])!, width: 40, height: 40, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox(width: 40, height: 40)),
                      ),
                    ),
                ]),
                const SizedBox(height: 10),
              ],
            ]),
          ),
        );
      },
    );
  }
}

/// «Мій сетап» у профілі (як на сайті): ПК, оцінка збірки (№224) і периферія; власник редагує.
class MySetupCard extends StatelessWidget {
  const MySetupCard({required this.data, required this.isSelf, required this.onSaved, super.key});
  final Map<String, dynamic> data;
  final bool isSelf;
  final Future<void> Function() onSaved;

  static List<(String, IconData, String)> get gearFields => [
        ('monitor', LucideIcons.monitor, tr('Монітор')),
        ('mouse', LucideIcons.mouse, tr('Мишка')),
        ('keyboard', LucideIcons.keyboard, tr('Клавіатура')),
        ('headset', LucideIcons.headphones, tr('Навушники')),
        ('mic', LucideIcons.mic, tr('Мікрофон')),
        ('controller', LucideIcons.gamepad2, tr('Геймпад')),
        ('chair', LucideIcons.armchair, tr('Крісло')),
        ('other', LucideIcons.package, tr('Ще')),
      ];

  @override
  Widget build(BuildContext context) {
    final pcData = mapOf(data['pc']);
    final gear = mapOf(data['gear']);
    final pc = [text(pcData['cpu']), text(pcData['gpu']), if (pcData['ram'] != null) '${pcData['ram']} ГБ RAM'].whereType<String>().toList();
    final filled = [for (final g in gearFields) if (text(gear[g.$1]) != null) g];
    final empty = pc.isEmpty && filled.isEmpty;
    if (empty && !isSelf) return const SizedBox.shrink();
    final rating = data['rating'] is Map ? mapOf(data['rating']) : null;
    return Glass(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CardTitle(tr('Мій сетап'), icon: LucideIcons.cpu, trailing: isSelf ? (empty ? tr('Заповнити') : tr('Змінити')) : null, onTrailing: isSelf ? () => _edit(context) : null),
        if (pc.isNotEmpty) _line(LucideIcons.cpu, pc.join(' · ')),
        if (rating != null) _PcScore(rating: rating, isSelf: isSelf),
        for (final g in filled) _line(g.$2, text(gear[g.$1])!),
        if (empty) Text(tr('Розкажіть, на чому граєте: ПК, мишка, навушники…'), style: body(13.5, color: muted)),
      ]),
    );
  }

  Widget _line(IconData icon, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, size: 16, color: faint),
          const SizedBox(width: 10),
          Expanded(child: Text(value, style: body(14, color: soft))),
        ]),
      );

  Future<void> _edit(BuildContext context) async {
    final pcData = mapOf(data['pc']);
    final gear = mapOf(data['gear']);
    final cpu = TextEditingController(text: text(pcData['cpu']) ?? '');
    final gpu = TextEditingController(text: text(pcData['gpu']) ?? '');
    final ram = TextEditingController(text: pcData['ram'] == null ? '' : '${pcData['ram']}');
    final fields = {for (final g in gearFields) g.$1: TextEditingController(text: text(gear[g.$1]) ?? '')};
    var public = data['public'] != false;
    final api = AppScope.read(context).session.api;
    final saved = await showGcSheet<bool>(
      context,
      title: tr('Мій сетап'),
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheet) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          GcField(controller: cpu, label: tr('Процесор'), dense: true),
          const SizedBox(height: 8),
          GcField(controller: gpu, label: tr('Відеокарта'), dense: true),
          const SizedBox(height: 8),
          GcField(controller: ram, label: tr('Оперативна пам’ять, ГБ'), keyboard: TextInputType.number, dense: true),
          for (final g in gearFields) ...[
            const SizedBox(height: 8),
            GcField(controller: fields[g.$1]!, label: g.$3, icon: g.$2, dense: true),
          ],
          SwitchListTile(
            value: public,
            contentPadding: EdgeInsets.zero,
            title: Text(tr('Показувати в профілі'), style: body(14, weight: FontWeight.w600)),
            onChanged: (v) => setSheet(() => public = v),
          ),
          PrimaryButton(
            label: tr('Зберегти'),
            onPressed: () async {
              final ok = await attempt(
                sheet,
                () => api.put(Api.site('/settings/setup'), {
                  'public': public,
                  'cpu': cpu.text.trim(),
                  'gpu': gpu.text.trim(),
                  'ram': int.tryParse(ram.text.trim()),
                  for (final e in fields.entries) e.key: e.value.text.trim(),
                }),
                success: tr('Сетап збережено.'),
              );
              if (ok && sheet.mounted) Navigator.of(sheet).pop(true);
            },
          ),
        ]),
      ),
    );
    for (final c in [cpu, gpu, ram, ...fields.values]) {
      c.dispose();
    }
    if (saved == true) await onSaved();
  }
}

/// Оцінка збірки: бал і клас, смужки частин (слабке місце підсвічено); власнику — поради.
class _PcScore extends StatelessWidget {
  const _PcScore({required this.rating, required this.isSelf});
  final Map<String, dynamic> rating;
  final bool isSelf;

  @override
  Widget build(BuildContext context) {
    final parts = mapOf(rating['parts']);
    final shown = [for (final p in [('gpu', tr('Відео')), ('cpu', tr('Процесор')), ('ram', tr('Пам’ять'))]) if (parts[p.$1] != null) p];
    final advice = (rating['advice'] as List? ?? const []).map((a) => '$a').toList();
    if (rating['score'] == null && shown.isEmpty && !isSelf) return const SizedBox.shrink();
    const alert = Color(0xFFFF7A55);
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: fg.withValues(alpha: 0.04), borderRadius: BorderRadius.circular(12)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (rating['score'] != null)
          Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
            Text('${rating['score']}', style: body(24, weight: FontWeight.w800)),
            const SizedBox(width: 8),
            Text(tr('{tier} збірка', {'tier': text(rating['tier']) ?? ''}), style: body(13, color: muted)),
          ]),
        for (final p in shown)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Row(children: [
              SizedBox(width: 82, child: Text(p.$2, style: body(12, color: rating['weak'] == p.$1 ? alert : muted, weight: rating['weak'] == p.$1 ? FontWeight.w700 : FontWeight.w400))),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(
                    value: intOf(parts[p.$1]) / 100,
                    minHeight: 6,
                    backgroundColor: fg.withValues(alpha: 0.08),
                    color: rating['weak'] == p.$1 ? alert : primary,
                  ),
                ),
              ),
              SizedBox(width: 32, child: Text('${parts[p.$1]}', textAlign: TextAlign.right, style: body(12, color: muted))),
            ]),
          ),
        if (isSelf && advice.isNotEmpty) ...[
          const SizedBox(height: 8),
          for (final line in advice)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(padding: const EdgeInsets.only(top: 6), child: Container(width: 5, height: 5, decoration: BoxDecoration(color: primary, shape: BoxShape.circle))),
                const SizedBox(width: 8),
                Expanded(child: Text(line, style: body(13, color: soft))),
              ]),
            ),
        ],
      ]),
    );
  }
}
