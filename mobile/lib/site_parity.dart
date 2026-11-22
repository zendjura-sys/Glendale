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
