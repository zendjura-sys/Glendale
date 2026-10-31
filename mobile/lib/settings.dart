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
import 'theme_controller.dart';
import 'account.dart';
import 'theme.dart';
import 'widgets.dart';
import 'i18n.dart';
import 'language_picker.dart';
import 'music.dart' show ListeningSwitch;
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
  late String tab = ['profile', 'appearance', 'security', 'account', 'app'].contains(widget.initialTab) ? widget.initialTab! : 'profile';
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

  // Тема видно одразу (попередній перегляд), а в акаунт вона йде разом з рештою змін — як на сайті.
  late String theme = ThemeController.instance.pref;
  late String savedTheme = theme;
  Map<String, Object?> saved = {};

  final current = TextEditingController();
  final next = TextEditingController();
  final confirmation = TextEditingController();
  bool changing = false;

  List<Map<String, dynamic>> connections = [];

  Session get session => AppScope.read(context).session;

  /// Поточний стан форми — для лічильника незбережених змін.
  Map<String, Object?> get _form => {
        'first_name': first.text.trim(),
        'last_name': last.text.trim(),
        'username': username.text.trim(),
        'status': status.text.trim(),
        'about': about.text.trim(),
        'city': city.text.trim(),
        'website': website.text.trim(),
        'gender': gender,
        'birthday': birthday == null ? null : '${birthday!.year.toString().padLeft(4, '0')}-${birthday!.month.toString().padLeft(2, '0')}-${birthday!.day.toString().padLeft(2, '0')}',
        'is_private': private,
        'message_privacy': messages,
      };

  int get _changes {
    final form = _form;
    return form.keys.where((key) => form[key] != saved[key]).length + (theme != savedTheme ? 1 : 0);
  }

  void _onField() => setState(() {});

  @override
  void initState() {
    super.initState();
    saved = _form;
    for (final c in [first, last, username, status, about, city, website]) {
      c.addListener(_onField);
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fill(session.me ?? {});
      _connections();
    });
  }

  @override
  void dispose() {
    // Пішли, не зберігши тему, — повертаємо збережену.
    if (theme != savedTheme) {
      final back = savedTheme;
      WidgetsBinding.instance.addPostFrameCallback((_) => ThemeController.instance.setPref(back, save: false));
    }
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
      saved = _form;
    });
  }

  void _discard() {
    _fill(session.me ?? {});
    if (theme != savedTheme) {
      theme = savedTheme;
      ThemeController.instance.setPref(savedTheme, save: false);
    }
  }

  void _pickTheme(String value) {
    setState(() => theme = value);
    ThemeController.instance.setPref(value, save: false);
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
      final form = _form;
      if (form.keys.any((key) => form[key] != saved[key])) {
        await session.api.patch('/api/v1/me', {...form, 'website': form['website'] == '' ? null : form['website']});
      }
      if (theme != savedTheme) {
        await session.setTheme(theme);
        savedTheme = theme;
      }
      await session.refreshMe();
      if (mounted) {
        _fill(session.me ?? {});
        toast(context, tr('Зміни збережено.'));
      }
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
    final changes = _changes;
    return Stack(fit: StackFit.expand, children: [
      ScreenScroll(
      children: [
        PageTitle(tr('Налаштування'), subtitle: tr('Керуйте сторінкою, приватністю та безпекою акаунта')),
        SizedBox(height: 12),
        Segmented(
          options: [
            SegmentOption('profile', tr('Профіль'), icon: LucideIcons.userRound),
            SegmentOption('appearance', tr('Вигляд'), icon: LucideIcons.palette),
            SegmentOption('security', tr('Безпека'), icon: LucideIcons.shield),
            SegmentOption('account', tr('Акаунт'), icon: LucideIcons.monitorSmartphone),
            SegmentOption('app', tr('Застосунок'), icon: LucideIcons.smartphone),
          ],
          selected: tab,
          scroll: true,
          onSelect: (value) => setState(() => tab = value),
        ),
        const SizedBox(height: 12),
        Swap(
          id: tab,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: switch (tab) {
            'security' => _security(),
            'account' => [AccountSettings()],
            'appearance' => [ThemePicker(selected: theme, onSelect: _pickTheme), const SizedBox(height: 12), const ModePicker()],
            'app' => const [NavEditor(), SizedBox(height: 12), FamilyWidgetSettings()],
            _ => _profile(),
          }),
        ),
        // Місце під панеллю змін, щоб вона не закривала останню картку.
        AnimatedSize(duration: const Duration(milliseconds: 250), child: SizedBox(height: changes > 0 ? 72 : 0)),
      ],
      ),
      Positioned(
        left: 12,
        right: 12,
        bottom: ShellChrome.bottomOf(context) + 8,
        child: PendingBar(count: changes, busy: saving, onDiscard: _discard, onSave: _save),
      ),
    ]);
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
      // Розділи профілю, як на сайті (кожен — свій плагін): посилання, тип акаунта, піксельна аватарка.
      if (AppScope.read(context).session case final session when session.pluginOn('bio_links') || session.pluginOn('account_types') || session.pluginOn('pixel_avatar')) ...[
        const SizedBox(height: 12),
        Glass(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
          child: Column(children: [
            if (session.pluginOn('bio_links'))
              ListTile(leading: Icon(LucideIcons.link, color: accent), title: Text(tr('Посилання в профілі'), style: body(14.5, weight: FontWeight.w600)), trailing: Icon(LucideIcons.chevronRight, color: faint), onTap: () => context.push('/settings/links')),
            if (session.pluginOn('account_types'))
              ListTile(leading: Icon(LucideIcons.badgeCheck, color: accent), title: Text(tr('Тип акаунта й верифікація'), style: body(14.5, weight: FontWeight.w600)), trailing: Icon(LucideIcons.chevronRight, color: faint), onTap: () => context.push('/settings/account-type')),
            if (session.pluginOn('pixel_avatar'))
              ListTile(leading: Icon(LucideIcons.grid3x3, color: accent), title: Text(tr('Піксельна аватарка'), style: body(14.5, weight: FontWeight.w600)), trailing: Icon(LucideIcons.chevronRight, color: faint), onTap: () => context.push('/settings/pixel-avatar')),
          ]),
        ),
      ],
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
          // Зберігається одразу, без «Зберегти» — те саме налаштування, що й на сайті.
          const ListeningSwitch(),
          const DigestSwitch(),
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
      const SizedBox(height: 12),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          CardTitle(tr('Безпека дітей'), icon: LucideIcons.shieldCheck),
          Text(
            tr('Сексуальне насильство над дітьми та їх експлуатація в GameCon заборонені. Побачили загрозу дитині — поскаржтеся на сторінці людини чи в меню повідомлення, причина «Загроза дитині».'),
            style: body(13, color: soft),
          ),
          const SizedBox(height: 10),
          GhostButton(
            label: tr('Стандарти безпеки дітей'),
            icon: LucideIcons.externalLink,
            compact: true,
            onPressed: () => launchUrl(Uri.parse('${Api.root}/child-safety'), mode: LaunchMode.externalApplication),
          ),
        ]),
      ),
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
      // Вхід на сайт через застосунок: QR-код зі сторінки входу (запити з push відкриваються самі).
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          CardTitle(tr('Вхід на сайт через застосунок'), icon: LucideIcons.monitorSmartphone),
          const SizedBox(height: 8),
          Text(tr('На сайті виберіть «Увійти через застосунок GameCon», відскануйте QR-код і підтвердіть вхід — без пароля.'), style: body(13.5, color: soft)),
          const SizedBox(height: 10),
          GhostButton(label: tr('Сканувати QR для входу'), icon: LucideIcons.scanLine, onPressed: () => context.push('/scan-login')),
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
        final rest = [for (final item in visibleNav(session.modules)) if (!tabs.contains(item.path)) item];
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
                    decoration: BoxDecoration(color: fg.withValues(alpha: 0.04), borderRadius: BorderRadius.circular(14)),
                    child: Row(children: [
                      ReorderableDragStartListener(
                        index: i,
                        child: Padding(padding: EdgeInsets.all(10), child: Icon(LucideIcons.gripVertical, size: 18, color: faint)),
                      ),
                      Icon(item.icon, size: 20, color: accent),
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
      decoration: BoxDecoration(color: const Color(0xA60F0A1E), borderRadius: BorderRadius.circular(16)),
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

// ───────────────────────── Вигляд ─────────────────────────

/// Вибір теми з мініатюрами, як на сайті (Налаштування → Вигляд): видно одразу, зберігається панеллю змін.
class ThemePicker extends StatelessWidget {
  const ThemePicker({required this.selected, required this.onSelect, super.key});
  final String selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    final themes = [
      ('dark', tr('Неоновий синій'), tr('Темна, з неоновим світлом')),
      ('light', tr('Крижана Арктика'), tr('Світла, холодна й прозора')),
      ('system', tr('Як на пристрої'), tr('Вдень світла, вночі темна — як у системі')),
    ];
    final reduce = MediaQuery.disableAnimationsOf(context);
    Widget thumb((String, String, String) item) => AnimatedContainer(
          duration: reduce ? Duration.zero : const Duration(milliseconds: 220),
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            color: selected == item.$1 ? primary : fg.withValues(alpha: 0.1),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: AspectRatio(
              aspectRatio: 4 / 3,
              child: Stack(fit: StackFit.expand, children: [
                CustomPaint(painter: _ThemeThumb(item.$1)),
                Positioned(
                  top: 6,
                  right: 6,
                  child: AnimatedScale(
                    scale: selected == item.$1 ? 1 : 0,
                    duration: reduce ? Duration.zero : const Duration(milliseconds: 260),
                    curve: Curves.easeOutBack,
                    child: Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(shape: BoxShape.circle, color: primary),
                      child: const Icon(LucideIcons.check, size: 13, color: Colors.white),
                    ),
                  ),
                ),
              ]),
            ),
          ),
        );
    Widget option((String, String, String) item, Widget child) => Semantics(
          inMutuallyExclusiveGroup: true,
          checked: selected == item.$1,
          button: true,
          label: item.$2,
          child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: () => onSelect(item.$1), child: child),
        );

    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(tr('Тема'), style: body(16, weight: FontWeight.w600)),
        const SizedBox(height: 4),
        Text(tr('Темна «Неоновий синій» чи світла «Крижана Арктика». Фон застосунку підлаштовується під тему.'), style: body(13, color: muted)),
        const SizedBox(height: 14),
        LayoutBuilder(builder: (context, box) {
          // Вузький екран (телефон): теми списком — мініатюра ліворуч, назва й опис повністю праворуч.
          if (box.maxWidth < 480) {
            return Column(children: [
              for (final (i, item) in themes.indexed) ...[
                if (i > 0) const SizedBox(height: 10),
                option(
                  item,
                  Row(children: [
                    SizedBox(width: 112, child: thumb(item)),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(item.$2, style: body(15, weight: FontWeight.w600)),
                        const SizedBox(height: 2),
                        Text(item.$3, style: body(12.5, color: muted).copyWith(height: 1.35)),
                      ]),
                    ),
                  ]),
                ),
              ],
            ]);
          }
          // Ширше (планшет): три мініатюри в ряд, як на сайті.
          return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            for (final (i, item) in themes.indexed) ...[
              if (i > 0) const SizedBox(width: 10),
              Expanded(
                child: option(
                  item,
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    thumb(item),
                    const SizedBox(height: 8),
                    Text(item.$2, style: body(13.5, weight: FontWeight.w600).copyWith(height: 1.25)),
                    Text(item.$3, style: body(11.5, color: muted).copyWith(height: 1.3)),
                  ]),
                ),
              ),
            ],
          ]);
        }),
      ]),
    );
  }
}

/// Мініатюра теми — та сама, що `.theme-thumb` на сайті: тло, картка, рядок тексту й кнопка.
class _ThemeThumb extends CustomPainter {
  _ThemeThumb(this.id);
  final String id;

  void _scene(Canvas canvas, Size size, bool light) {
    final rect = Offset.zero & size;
    if (light) {
      canvas.drawRect(rect, Paint()..shader = const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFD6E8F6), Color(0xFFEEF5FB)]).createShader(rect));
      canvas.drawRect(rect, Paint()..shader = RadialGradient(center: const Alignment(0.6, -0.8), radius: 0.8, colors: const [Color(0xFFFFFFFF), Color(0x00FFFFFF)]).createShader(rect));
    } else {
      canvas.drawRect(rect, Paint()..color = const Color(0xFF050913));
      canvas.drawRect(rect, Paint()..shader = RadialGradient(center: const Alignment(-0.6, -0.7), radius: 0.8, colors: const [Color(0x992F7BFF), Color(0x002F7BFF)]).createShader(rect));
    }
    final card = RRect.fromLTRBR(size.width * 0.12, size.height * 0.16, size.width * 0.88, size.height * 0.70, const Radius.circular(10));
    if (light) {
      canvas.drawRRect(card.shift(const Offset(0, 4)), Paint()..color = const Color(0x22102A50)..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6));
    }
    canvas.drawRRect(card, Paint()..color = light ? const Color(0xCCFFFFFF) : const Color(0xCC0D152A));
    canvas.drawRRect(
      RRect.fromLTRBR(size.width * 0.2, size.height * 0.3, size.width * 0.6, size.height * 0.38, const Radius.circular(99)),
      Paint()..color = light ? const Color(0xBF0D1B2E) : const Color(0xB3E9F0FF),
    );
    final button = Rect.fromLTWH(size.width * 0.52, size.height * 0.77, size.width * 0.36, size.height * 0.13);
    canvas.drawRRect(
      RRect.fromRectAndRadius(button, const Radius.circular(7)),
      Paint()..shader = LinearGradient(colors: light ? const [Color(0xFF1D6FE0), Color(0xFF22B5E3)] : const [Color(0xFF2A6CFF), Color(0xFF22C4F0)]).createShader(button),
    );
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (id == 'system') {
      // Половина темна, половина світла — по діагоналі.
      canvas.save();
      canvas.clipPath(Path()..lineTo(size.width, 0)..lineTo(0, size.height)..close());
      _scene(canvas, size, false);
      canvas.restore();
      canvas.save();
      canvas.clipPath(Path()..moveTo(size.width, 0)..lineTo(size.width, size.height)..lineTo(0, size.height)..close());
      _scene(canvas, size, true);
      canvas.restore();
      return;
    }
    _scene(canvas, size, id == 'light');
  }

  @override
  bool shouldRepaint(_ThemeThumb old) => old.id != id;
}

/// Режим соцмережі, як на сайті («Геймер», «Класика», «Мінімал»…): яку частину GameCon видно в меню.
/// Діє одразу на сайті й у застосунку; вимкнене адміністратором лишається вимкненим у будь-якому режимі.
class ModePicker extends StatefulWidget {
  const ModePicker({super.key});

  @override
  State<ModePicker> createState() => _ModePickerState();
}

class _ModePickerState extends State<ModePicker> {
  String? busy;

  static const _icons = {
    'gamepad-2': LucideIcons.gamepad2,
    'sparkles': LucideIcons.sparkles,
    'compass': LucideIcons.compass,
    'clapperboard': LucideIcons.clapperboard,
    'feather': LucideIcons.feather,
    'layers': LucideIcons.layers,
    'music-2': LucideIcons.music2,
    'users-round': LucideIcons.usersRound,
    'swords': LucideIcons.swords,
    'heart': LucideIcons.heart,
  };

  Future<void> _choose(String id) async {
    final session = AppScope.read(context).session;
    setState(() => busy = id);
    if (await attempt(context, () => session.api.put(Api.site('/settings/mode'), {'mode': id}))) await session.refreshMe();
    if (mounted) setState(() => busy = null);
  }

  @override
  Widget build(BuildContext context) {
    final session = AppScope.of(context).session;
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) {
        final modes = maps(session.me?['modes']);
        if (modes.length < 2) return const SizedBox.shrink();
        final current = text(session.me?['network_mode']);
        final reduce = MediaQuery.disableAnimationsOf(context);
        return Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(tr('Режим'), style: body(16, weight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(tr('Яку частину GameCon видно в меню. Решта не зникає — її просто не видно.'), style: body(13, color: muted)),
            const SizedBox(height: 12),
            for (final mode in modes)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AnimatedContainer(
                  duration: reduce ? Duration.zero : const Duration(milliseconds: 220),
                  decoration: BoxDecoration(
                    color: mode['id'] == current ? primary.withValues(alpha: palette.isLight ? 0.10 : 0.16) : fg.withValues(alpha: 0.035),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: busy != null || mode['id'] == current ? null : () => _choose('${mode['id']}'),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(children: [
                          Icon(_icons[mode['icon']] ?? LucideIcons.layers, color: mode['id'] == current ? primary : accent, size: 22),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(text(mode['name']) ?? '', style: body(14.5, weight: FontWeight.w600)),
                              if (text(mode['description']) != null) Text(text(mode['description'])!, style: body(12, color: muted).copyWith(height: 1.35)),
                            ]),
                          ),
                          const SizedBox(width: 8),
                          if (busy == mode['id'])
                            const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          else
                            AnimatedScale(
                              scale: mode['id'] == current ? 1 : 0,
                              duration: reduce ? Duration.zero : const Duration(milliseconds: 260),
                              curve: Curves.easeOutBack,
                              child: Icon(LucideIcons.circleCheck, color: primary, size: 20),
                            ),
                        ]),
                      ),
                    ),
                  ),
                ),
              ),
          ]),
        );
      },
    );
  }
}

/// «Ранковий дайджест» — одне налаштування сайту й застосунку: о 9:00 одне сповіщення про те, що чекає сьогодні.
class DigestSwitch extends StatefulWidget {
  const DigestSwitch({super.key});

  @override
  State<DigestSwitch> createState() => _DigestSwitchState();
}

class _DigestSwitchState extends State<DigestSwitch> {
  bool? pending;

  Future<void> _toggle(bool value) async {
    final session = AppScope.read(context).session;
    setState(() => pending = value);
    if (!await attempt(context, () => session.api.patch(Api.site('/settings/digest'), {'morning_digest': value}))) {
      if (mounted) setState(() => pending = null);
      return;
    }
    try {
      await session.refreshMe();
      if (mounted) setState(() => pending = null);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final session = AppScope.read(context).session;
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) => SwitchListTile(
        value: pending ?? (session.me?['morning_digest'] != false),
        contentPadding: EdgeInsets.zero,
        title: Text(tr('Ранковий дайджест'), style: body(14.5, weight: FontWeight.w600)),
        subtitle: Text(tr('О 9:00 — що чекає сьогодні: події, турніри, дні народження друзів і непрочитане'), style: body(12.5, color: muted)),
        onChanged: _toggle,
      ),
    );
  }
}
