import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'shell.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// ───────────────────────── Сповіщення ─────────────────────────

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = AppScope.of(context).session;
    return Padding(
      padding: EdgeInsets.fromLTRB(14, siteHeaderInset(context) + 6, 14, 0),
      child: Glass(
        padding: const EdgeInsets.only(top: 14),
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(children: [
              RoundIcon(icon: Icons.arrow_back_rounded, onTap: () => context.canPop() ? context.pop() : context.go('/feed')),
              const SizedBox(width: 8),
              Text('Сповіщення', style: display(19)),
            ]),
          ),
          const SizedBox(height: 6),
          Expanded(child: NotificationsList(session: session, onOpen: (path) => context.push(appPathFor(path)))),
        ]),
      ),
    );
  }
}

// ───────────────────────── Налаштування ─────────────────────────

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String tab = 'profile';
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
      if (mounted) toast(context, 'Профіль оновлено.');
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
      if (mounted) toast(context, 'Пароль змінено.');
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => changing = false);
    }
  }

  Future<void> _unlink(Map<String, dynamic> connection) async {
    if (!await confirm(context, 'Від’єднати ${connection['label']}?', text: 'Входити через нього більше не вийде. Переконайтеся, що пам’ятаєте пароль.', action: 'Від’єднати', danger: true)) return;
    if (!mounted) return;
    if (await attempt(context, () => session.api.delete('/api/v1/me/connections/${connection['provider']}'), success: '${connection['label']} від’єднано.')) {
      _connections();
      session.refreshMe();
    }
  }

  Future<void> _deleteAccount() async {
    final password = await askText(context, 'Видалити акаунт назавжди?', hint: 'Пароль для підтвердження', action: 'Видалити');
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
        PageTitle('Налаштування', subtitle: 'Керуйте сторінкою, приватністю та безпекою акаунта'),
        const SizedBox(height: 12),
        Segmented(
          options: const [SegmentOption('profile', 'Профіль', icon: Icons.person_outline_rounded), SegmentOption('security', 'Безпека', icon: Icons.shield_outlined)],
          selected: tab,
          onSelect: (value) => setState(() => tab = value),
        ),
        const SizedBox(height: 12),
        if (tab == 'profile') ..._profile() else ..._security(),
      ],
    );
  }

  List<Widget> _profile() {
    return [
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const CardTitle('Основне', icon: Icons.badge_outlined),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: LabeledField(label: 'Ім’я', child: GcField(controller: first, label: 'Ім’я'))),
            const SizedBox(width: 10),
            Expanded(child: LabeledField(label: 'Прізвище', child: GcField(controller: last, label: 'Прізвище'))),
          ]),
          const SizedBox(height: 10),
          LabeledField(label: 'Адреса сторінки', hint: 'gamecon.online/${username.text}', child: GcField(controller: username, label: 'nickname', prefixText: '@', onChanged: (_) => setState(() {}))),
          const SizedBox(height: 10),
          LabeledField(label: 'Статус', child: GcField(controller: status, label: 'Що у вас нового?')),
          const SizedBox(height: 10),
          LabeledField(label: 'Про себе', child: GcField(controller: about, label: 'Кілька слів про себе', maxLines: 6, minLines: 3)),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: LabeledField(label: 'Місто', child: GcField(controller: city, label: 'Місто'))),
            const SizedBox(width: 10),
            Expanded(
              child: LabeledField(
                label: 'Стать',
                child: GcSelect<String>(
                  value: gender ?? '',
                  expand: true,
                  items: const [('', 'Не вказано'), ('male', 'Чоловіча'), ('female', 'Жіноча')],
                  onChanged: (value) => setState(() => gender = (value ?? '').isEmpty ? null : value),
                ),
              ),
            ),
          ]),
          const SizedBox(height: 10),
          LabeledField(
            label: 'День народження',
            child: GhostButton(
              label: birthday == null ? 'Не вказано' : '${birthday!.day} ${monthsGenitive[birthday!.month - 1]} ${birthday!.year}',
              icon: Icons.cake_outlined,
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
          if (birthday != null) Align(alignment: Alignment.centerRight, child: TextButton(onPressed: () => setState(() => birthday = null), child: Text('Прибрати дату', style: body(12.5, color: muted)))),
          const SizedBox(height: 10),
          LabeledField(label: 'Вебсайт', child: GcField(controller: website, label: 'https://', keyboard: TextInputType.url)),
        ]),
      ),
      const SizedBox(height: 12),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const CardTitle('Приватність', icon: Icons.lock_outline_rounded),
          SwitchListTile(
            value: private,
            contentPadding: EdgeInsets.zero,
            title: Text('Закритий профіль', style: body(14.5, weight: FontWeight.w600)),
            subtitle: Text('Записи, друзів і фото бачитимуть лише ваші друзі.', style: body(12.5, color: muted)),
            onChanged: (value) => setState(() => private = value),
          ),
          const SizedBox(height: 6),
          Text('Хто може писати мені', style: body(13, color: muted)),
          const SizedBox(height: 6),
          Segmented(
            options: const [SegmentOption('everyone', 'Усі'), SegmentOption('friends', 'Лише друзі')],
            selected: messages,
            onSelect: (value) => setState(() => messages = value),
          ),
        ]),
      ),
      const SizedBox(height: 14),
      PrimaryButton(label: 'Зберегти зміни', icon: Icons.check_rounded, busy: saving, onPressed: _save),
    ];
  }

  List<Widget> _security() {
    final me = session.me ?? {};
    return [
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const CardTitle('Пароль', icon: Icons.key_rounded),
          const SizedBox(height: 12),
          GcField(controller: current, label: 'Поточний пароль', obscure: true),
          const SizedBox(height: 10),
          GcField(controller: next, label: 'Новий пароль', obscure: true),
          const SizedBox(height: 10),
          GcField(controller: confirmation, label: 'Повторіть новий пароль', obscure: true),
          const SizedBox(height: 14),
          PrimaryButton(label: 'Змінити пароль', busy: changing, onPressed: _password),
        ]),
      ),
      const SizedBox(height: 12),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const CardTitle('Під’єднані акаунти', icon: Icons.link_rounded),
          const SizedBox(height: 6),
          if (connections.isEmpty) Text('Завантаження…', style: body(13, color: muted)),
          for (final c in connections.where((c) => c['available'] == true || c['connected'] == true))
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(c['provider'] == 'discord' ? Icons.forum_outlined : Icons.g_mobiledata_rounded, color: c['connected'] == true ? primary : muted, size: 28),
              title: Text('${c['label']}', style: body(14.5, weight: FontWeight.w600)),
              subtitle: Text(c['connected'] == true ? (text(c['account']) ?? 'Під’єднано') : 'Не під’єднано', style: body(12.5, color: muted)),
              trailing: c['connected'] == true
                  ? TextButton(onPressed: () => _unlink(c), child: Text('Від’єднати', style: body(13, color: dangerSoft)))
                  : TextButton(
                      onPressed: () => launchUrl(Uri.parse('${Api.root}/settings/security'), mode: LaunchMode.externalApplication),
                      child: Text('На сайті', style: body(13, color: primary)),
                    ),
            ),
          const SizedBox(height: 4),
          Text('Під’єднати новий акаунт можна на сайті — вхід через Google і Discord потім працюватиме й тут.', style: body(12, color: faint)),
        ]),
      ),
      const SizedBox(height: 12),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const CardTitle('Двофакторний захист', icon: Icons.verified_user_outlined),
          const SizedBox(height: 8),
          Text(me['two_factor'] == true ? 'Увімкнено. Під час входу застосунок попросить код.' : 'Вимкнено. Увімкніть на сайті в розділі «Безпека».', style: body(13.5, color: soft)),
          const SizedBox(height: 10),
          GhostButton(label: 'Відкрити на сайті', icon: Icons.open_in_new_rounded, onPressed: () => launchUrl(Uri.parse('${Api.root}/settings/security'), mode: LaunchMode.externalApplication)),
        ]),
      ),
      const SizedBox(height: 12),
      Glass(
        border: danger.withValues(alpha: 0.3),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const CardTitle('Видалення акаунта', icon: Icons.warning_amber_rounded),
          const SizedBox(height: 8),
          Text('Профіль, записи, фото й повідомлення зникнуть назавжди. Цю дію не можна скасувати.', style: body(13, color: muted)),
          const SizedBox(height: 12),
          DangerButton(label: 'Видалити акаунт', icon: Icons.delete_forever_outlined, expand: true, onPressed: _deleteAccount),
        ]),
      ),
    ];
  }
}
