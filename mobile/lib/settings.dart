import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'family_widget.dart';
import 'nav_items.dart';
import 'playing.dart';
import 'shell.dart';
import 'state.dart';
import 'account.dart';
import 'theme.dart';
import 'widgets.dart';
import 'i18n.dart';
import 'language_picker.dart';
import 'extras.dart';

// ───────────────────────── Сповіщення ─────────────────────────

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = AppScope.of(context).session;
    return Column(children: [
      Padding(
        padding: EdgeInsets.fromLTRB(14, siteHeaderInset(context) + 6, 8, 0),
        child: Row(children: [
          RoundIcon(icon: LucideIcons.arrowLeft, onTap: () => context.canPop() ? context.pop() : context.go('/feed')),
          const SizedBox(width: 8),
          Text(tr('Сповіщення'), style: display(19)),
        ]),
      ),
      Expanded(child: NotificationsList(session: session, onOpen: (path) => context.push(appPathFor(path)))),
    ]);
  }
}

// ───────────────────────── Налаштування ─────────────────────────

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({this.initialTab, super.key});
  final String? initialTab;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late String tab = ['profile', 'security', 'app'].contains(widget.initialTab) ? widget.initialTab! : 'profile';
  final first = TextEditingController();
  final last = TextEditingController();
  final username = TextEditingController();
  final status = TextEditingController();
  final about = TextEditingController();
  final city = TextEditingController();
  final website = TextEditingController();
  String? gender;
  DateTime? birthday;
  bool private = false;
  String messages = 'everyone';
  bool saving = false;

  final current = TextEditingController();
  final next = TextEditingController();
  final confirmation = TextEditingController();
  bool changing = false;

  List<Map<String, dynamic>> connections = [];

  Session get session => AppScope.read(context).session;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fill(session.me ?? {});
      _connections();
    });
  }

  @override
  void dispose() {
    for (final c in [first, last, username, status, about, city, website, current, next, confirmation]) {
      c.dispose();
    }
    super.dispose();
  }

  void _fill(Map<String, dynamic> me) {
    setState(() {
      first.text = text(me['first_name']) ?? '';
      last.text = text(me['last_name']) ?? '';
      username.text = text(me['username']) ?? '';
      status.text = text(me['status']) ?? '';
      about.text = text(me['about']) ?? '';
      city.text = text(me['city']) ?? '';
      website.text = text(me['website']) ?? '';
      gender = text(me['gender']);
      birthday = DateTime.tryParse(text(me['birthday']) ?? '');
      private = me['is_private'] == true;
      messages = text(me['message_privacy']) ?? 'everyone';
    });
  }

  Future<void> _connections() async {
    try {
      final data = await session.api.get('/api/v1/me/connections');
      if (mounted) setState(() => connections = maps(data['connections']));
    } catch (_) {}
  }

  Future<void> _save() async {
    setState(() => saving = true);
    try {
      await session.api.patch('/api/v1/me', {
        'first_name': first.text.trim(),
        'last_name': last.text.trim(),
        'username': username.text.trim(),
        'status': status.text.trim(),
        'about': about.text.trim(),
        'city': city.text.trim(),
        'website': website.text.trim().isEmpty ? null : website.text.trim(),
        'gender': gender,
        'birthday': birthday == null ? null : '${birthday!.year.toString().padLeft(4, '0')}-${birthday!.month.toString().padLeft(2, '0')}-${birthday!.day.toString().padLeft(2, '0')}',
        'is_private': private,
        'message_privacy': messages,
      });
      await session.refreshMe();
      if (mounted) toast(context, tr('Профіль оновлено.'));
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> _password() async {
    setState(() => changing = true);
    try {
      await session.api.put('/api/v1/me/password', {
        'current_password': current.text,
        'password': next.text,
        'password_confirmation': confirmation.text,
      });
      current.clear();
      next.clear();
      confirmation.clear();
      if (mounted) toast(context, tr('Пароль змінено.'));
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => changing = false);
    }
  }

  Future<void> _unlink(Map<String, dynamic> connection) async {
    if (!await confirm(context, tr('Від’єднати {v}?', {'v': connection['label']}), text: tr('Входити через нього більше не вийде. Переконайтеся, що пам’ятаєте пароль.'), action: tr('Від’єднати'), danger: true)) return;
    if (!mounted) return;
    if (await attempt(context, () => session.api.delete('/api/v1/me/connections/${connection['provider']}'), success: tr('{v} від’єднано.', {'v': connection['label']}))) {
      _connections();
      session.refreshMe();
    }
  }

  Future<void> _deleteAccount() async {
    final password = await askText(context, tr('Видалити акаунт назавжди?'), hint: tr('Пароль для підтвердження'), action: tr('Видалити'));
    if (password == null || password.isEmpty || !mounted) return;
    final player = AppScope.read(context).player;
    try {
      await session.api.delete(Api.site('/settings/profile'), {'password': password});
      await player.stop();
      await session.clear();
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScroll(
      children: [
        PageTitle(tr('Налаштування'), subtitle: tr('Керуйте сторінкою, приватністю та безпекою акаунта')),
        SizedBox(height: 12),
        Segmented(
          options: [
            SegmentOption('profile', tr('Профіль'), icon: LucideIcons.userRound),
            SegmentOption('security', tr('Безпека'), icon: LucideIcons.shield),
            SegmentOption('account', tr('Акаунт'), icon: LucideIcons.monitorSmartphone),
            SegmentOption('app', tr('Застосунок'), icon: LucideIcons.smartphone),
          ],
          selected: tab,
          onSelect: (value) => setState(() => tab = value),
        ),
        const SizedBox(height: 12),
        Swap(
          id: tab,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: switch (tab) {
            'security' => _security(),
            'account' => [AccountSettings()],
            'app' => const [NavEditor(), SizedBox(height: 12), FamilyWidgetSettings()],
            _ => _profile(),
          }),
        ),
      ],
    );
  }

  List<Widget> _profile() {
    return [
      if (I18n.locales.length > 1) ...[
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CardTitle(tr('Мова'), icon: LucideIcons.languages),
            const SizedBox(height: 12),
            LanguagePicker(api: session.api),
          ]),
        ),
        const SizedBox(height: 12),
      ],
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          CardTitle(tr('Основне'), icon: LucideIcons.idCard),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: LabeledField(label: tr('Ім’я'), child: GcField(controller: first, label: tr('Ім’я')))),
            const SizedBox(width: 10),
            Expanded(child: LabeledField(label: tr('Прізвище'), child: GcField(controller: last, label: tr('Прізвище')))),
          ]),
          const SizedBox(height: 10),
          LabeledField(label: tr('Адреса сторінки'), hint: 'gamecon.online/${username.text}', child: GcField(controller: username, label: 'nickname', prefixText: '@', onChanged: (_) => setState(() {}))),
          const SizedBox(height: 10),
          LabeledField(label: tr('Статус'), child: GcField(controller: status, label: tr('Що у вас нового?'))),
          const SizedBox(height: 10),
          LabeledField(label: tr('Про себе'), child: GcField(controller: about, label: tr('Кілька слів про себе'), maxLines: 6, minLines: 3)),
          SizedBox(height: 10),
          Row(children: [
            Expanded(child: LabeledField(label: tr('Місто'), child: GcField(controller: city, label: tr('Місто')))),
            SizedBox(width: 10),
            Expanded(
              child: LabeledField(
                label: tr('Стать'),
                child: GcSelect<String>(
                  value: gender ?? '',
                  expand: true,
                  items: [('', tr('Не вказано')), ('male', tr('Чоловіча')), ('female', tr('Жіноча'))],
                  onChanged: (value) => setState(() => gender = (value ?? '').isEmpty ? null : value),
                ),
              ),
            ),
          ]),
          const SizedBox(height: 10),
          LabeledField(
            label: tr('День народження'),
            child: GhostButton(
              label: birthday == null ? tr('Не вказано') : '${birthday!.day} ${monthsGenitive[birthday!.month - 1]} ${birthday!.year}',
              icon: LucideIcons.cake,
              onPressed: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: birthday ?? DateTime(2000, 1, 1),
                  firstDate: DateTime(1901),
                  lastDate: DateTime.now().subtract(const Duration(days: 1)),
                );
                if (picked != null) setState(() => birthday = picked);
              },
            ),
          ),
          if (birthday != null) Align(alignment: Alignment.centerRight, child: TextButton(onPressed: () => setState(() => birthday = null), child: Text(tr('Прибрати дату'), style: body(12.5, color: muted)))),
          const SizedBox(height: 10),
          LabeledField(label: tr('Вебсайт'), child: GcField(controller: website, label: 'https://', keyboard: TextInputType.url)),
        ]),
      ),
      const SizedBox(height: 12),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          CardTitle(tr('Приватність'), icon: LucideIcons.lock),
          SwitchListTile(
            value: private,
            contentPadding: EdgeInsets.zero,
            title: Text(tr('Закритий профіль'), style: body(14.5, weight: FontWeight.w600)),
            subtitle: Text(tr('Записи, друзів і фото бачитимуть лише ваші друзі.'), style: body(12.5, color: muted)),
            onChanged: (value) => setState(() => private = value),
          ),
          const SizedBox(height: 6),
          Text(tr('Хто може писати мені'), style: body(13, color: muted)),
          SizedBox(height: 6),
          Segmented(
            options: [SegmentOption('everyone', tr('Усі')), SegmentOption('friends', tr('Лише друзі'))],
            selected: messages,
            onSelect: (value) => setState(() => messages = value),
          ),
        ]),
      ),
      const SizedBox(height: 14),
      PrimaryButton(label: tr('Зберегти зміни'), icon: LucideIcons.check, busy: saving, onPressed: _save),
      const SizedBox(height: 12),
      const PlayingSettingsCard(),
      const SizedBox(height: 12),
      const StreamSettingsCard(),
    ];
  }

  List<Widget> _security() {
    final me = session.me ?? {};
    return [
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          CardTitle(tr('Пароль'), icon: LucideIcons.keyRound),
          const SizedBox(height: 12),
          GcField(controller: current, label: tr('Поточний пароль'), obscure: true),
          const SizedBox(height: 10),
          GcField(controller: next, label: tr('Новий пароль'), obscure: true),
          const SizedBox(height: 10),
          GcField(controller: confirmation, label: tr('Повторіть новий пароль'), obscure: true),
          const SizedBox(height: 14),
          PrimaryButton(label: tr('Змінити пароль'), busy: changing, onPressed: _password),
        ]),
      ),
      const SizedBox(height: 12),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          CardTitle(tr('Під’єднані акаунти'), icon: LucideIcons.link),
          const SizedBox(height: 6),
          if (connections.isEmpty) Text(tr('Завантаження…'), style: body(13, color: muted)),
          for (final c in connections.where((c) => c['available'] == true || c['connected'] == true))
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(c['provider'] == 'discord' ? LucideIcons.messagesSquare : Icons.g_mobiledata_rounded, color: c['connected'] == true ? primary : muted, size: 28),
              title: Text('${c['label']}', style: body(14.5, weight: FontWeight.w600)),
              subtitle: Text(c['connected'] == true ? (text(c['account']) ?? tr('Під’єднано')) : tr('Не під’єднано'), style: body(12.5, color: muted)),
              trailing: c['connected'] == true
                  ? TextButton(onPressed: () => _unlink(c), child: Text(tr('Від’єднати'), style: body(13, color: dangerSoft)))
                  : TextButton(
                      onPressed: () => launchUrl(Uri.parse('${Api.root}/settings/security'), mode: LaunchMode.externalApplication),
                      child: Text(tr('На сайті'), style: body(13, color: primary)),
                    ),
            ),
          const SizedBox(height: 4),
          Text(tr('Під’єднати новий акаунт можна на сайті — вхід через Google і Discord потім працюватиме й тут.'), style: body(12, color: faint)),
        ]),
      ),
      const SizedBox(height: 12),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          CardTitle(tr('Двофакторний захист'), icon: LucideIcons.shieldCheck),
          const SizedBox(height: 8),
          Text(me['two_factor'] == true ? tr('Увімкнено. Під час входу застосунок попросить код.') : tr('Вимкнено. Увімкніть на сайті в розділі «Безпека».'), style: body(13.5, color: soft)),
          const SizedBox(height: 10),
          GhostButton(label: tr('Відкрити на сайті'), icon: LucideIcons.externalLink, onPressed: () => launchUrl(Uri.parse('${Api.root}/settings/security'), mode: LaunchMode.externalApplication)),
        ]),
      ),
      const SizedBox(height: 12),
      Glass(
        border: danger.withValues(alpha: 0.3),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          CardTitle(tr('Видалення акаунта'), icon: LucideIcons.triangleAlert),
          const SizedBox(height: 8),
          Text(tr('Профіль, записи, фото й повідомлення зникнуть назавжди. Цю дію не можна скасувати.'), style: body(13, color: muted)),
          const SizedBox(height: 12),
          DangerButton(label: tr('Видалити акаунт'), icon: LucideIcons.trash2, expand: true, onPressed: _deleteAccount),
        ]),
      ),
    ];
  }
}

// ───────────────────────── Нижня панель ─────────────────────────

/// Вибір і порядок розділів нижньої панелі. Решта розділів — у «Меню».
class NavEditor extends StatelessWidget {
  const NavEditor({super.key});

  @override
  Widget build(BuildContext context) {
    final session = AppScope.of(context).session;
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) {
        final tabs = session.navTabs;
        final rest = [for (final item in navCatalog) if (!tabs.contains(item.path)) item];
        final full = tabs.length >= maxNav;

        void save(List<String> next) => session.setNavTabs(next).catchError((Object e) {
              if (context.mounted) toast(context, e);
            });

        return Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CardTitle(tr('Нижня панель'), icon: LucideIcons.panelBottom),
            const SizedBox(height: 6),
            Text(tr('До {maxNav} розділів поруч із «Меню». Те, що приберете з панелі, буде в меню.', {'maxNav': maxNav}), style: body(13, color: muted)),
            const SizedBox(height: 14),
            _NavPreview(tabs: tabs),
            const SizedBox(height: 16),
            Text(tr('У панелі'), style: body(12.5, color: muted, weight: FontWeight.w700)),
            const SizedBox(height: 6),
            ReorderableListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              buildDefaultDragHandles: false,
              itemCount: tabs.length,
              onReorderItem: (from, to) {
                final next = [...tabs];
                next.insert(to, next.removeAt(from));
                save(next);
              },
              proxyDecorator: (child, _, _) => Material(color: popover, elevation: 6, borderRadius: BorderRadius.circular(14), child: child),
              itemBuilder: (context, i) {
                final item = navItem(tabs[i])!;
                return Padding(
                  key: ValueKey(item.path),
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(4, 2, 4, 2),
                    decoration: BoxDecoration(color: fg.withValues(alpha: 0.04), borderRadius: BorderRadius.circular(14), border: Border.all(color: line)),
                    child: Row(children: [
                      ReorderableDragStartListener(
                        index: i,
                        child: Padding(padding: EdgeInsets.all(10), child: Icon(LucideIcons.gripVertical, size: 18, color: faint)),
                      ),
                      Icon(item.icon, size: 20, color: const Color(0xFF9AA6FF)),
                      const SizedBox(width: 12),
                      Expanded(child: Text(item.title, style: body(14.5, weight: FontWeight.w600))),
                      IconButton(
                        tooltip: tr('Прибрати в меню'),
                        onPressed: tabs.length <= 1 ? null : () => save([...tabs]..removeAt(i)),
                        icon: Icon(LucideIcons.circleMinus, size: 20, color: tabs.length <= 1 ? faint : dangerSoft),
                      ),
                    ]),
                  ),
                );
              },
            ),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: Text(tr('У меню'), style: body(12.5, color: muted, weight: FontWeight.w700))),
              if (full) Text(tr('Панель заповнена'), style: body(11.5, color: faint)),
            ]),
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final item in rest)
                Opacity(
                  opacity: full ? 0.45 : 1,
                  child: SelectPill(
                    label: item.title,
                    icon: item.icon,
                    selected: false,
                    onTap: () => full ? toast(context, tr('Спочатку приберіть розділ із панелі.')) : save([...tabs, item.path]),
                  ),
                ),
            ]),
            if (!listEquals(tabs, defaultNav)) ...[
              const SizedBox(height: 14),
              GhostButton(label: tr('Повернути як було'), icon: LucideIcons.rotateCcw, compact: true, onPressed: () => save(defaultNav)),
            ],
          ]),
        );
      },
    );
  }
}

/// Зменшений вигляд панелі, щоб одразу бачити результат.
class _NavPreview extends StatelessWidget {
  const _NavPreview({required this.tabs});
  final List<String> tabs;

  @override
  Widget build(BuildContext context) {
    final items = [for (final t in tabs) navItem(t)!, navMenu];
    return Container(
      height: 58,
      decoration: BoxDecoration(color: const Color(0xA60F0A1E), borderRadius: BorderRadius.circular(16), border: Border.all(color: line)),
      child: Row(children: [
        for (final item in items)
          Expanded(
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(item.icon, size: 19, color: muted),
              const SizedBox(height: 3),
              Text(item.label, maxLines: 1, overflow: TextOverflow.fade, softWrap: false, style: body(11, color: muted, weight: FontWeight.w500)),
            ]),
          ),
      ]),
    );
  }
}
