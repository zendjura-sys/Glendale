import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import 'api.dart';
import 'core/widgets/arctic_glass/arctic_glass.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';
import 'i18n.dart';

/// Налаштування → Акаунт: пристрої й сесії, журнал входів, образливі слова, оскарження, заморожування.
class AccountSettings extends StatelessWidget {
  const AccountSettings({super.key});

  @override
  Widget build(BuildContext context) {
    final session = AppScope.read(context).session;
    return Remote(
      load: () => session.api.get('/api/v1/me/security'),
      builder: (data, reload) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _Devices(data: data, reload: reload),
        SizedBox(height: 12),
        _Logins(logins: maps(data['logins'])),
        SizedBox(height: 12),
        _Profanity(initial: data['hide_profanity'] == true),
        SizedBox(height: 12),
        _Appeals(data: data, reload: reload),
        SizedBox(height: 12),
        const _DataExport(),
        SizedBox(height: 12),
        _Freeze(),
      ]),
    );
  }
}

/// Архів своїх даних (GDPR) і листи про новий вхід — як «Налаштування → Акаунт» на сайті.
class _DataExport extends StatelessWidget {
  const _DataExport();

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/settings/account')),
      builder: (data, reload) {
        final exports = maps(data['exports']);
        return Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CardTitle(tr('Мої дані'), icon: LucideIcons.archive),
            Text(tr('Архів усього, що ви створили: профіль, записи, фото, повідомлення. Готуємо кілька хвилин, посилання діє 7 днів.'), style: body(12.5, color: muted)),
            const SizedBox(height: 10),
            for (final e in exports)
              _Row(
                icon: e['status'] == 'ready' ? LucideIcons.fileArchive : LucideIcons.loader,
                title: e['status'] == 'ready' ? tr('Архів готовий') : tr('Готуємо архів…'),
                subtitle: '${shortStamp(e['created_at'])}${e['size'] != null ? ' · ${(intOf(e['size']) / 1048576).toStringAsFixed(1)} МБ' : ''}',
                trailing: e['status'] == 'ready' && text(e['url']) != null
                    ? IconButton(tooltip: tr('Завантажити на сайті'), icon: Icon(LucideIcons.download, size: 18, color: soft), onPressed: () => launchUrl(Uri.parse('${Api.root}${e['url']}'), mode: LaunchMode.externalApplication))
                    : null,
              ),
            GhostButton(
              label: tr('Підготувати архів'),
              icon: LucideIcons.archive,
              onPressed: () async {
                if (await attempt(context, () => api.post(Api.site('/settings/account/exports')), success: tr('Готуємо архів — повідомимо, коли буде готовий.'))) await reload();
              },
            ),
            const SizedBox(height: 6),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: data['loginAlerts'] == true,
              title: Text(tr('Лист про вхід з нового пристрою'), style: body(14)),
              onChanged: (v) async {
                if (await attempt(context, () => api.put(Api.site('/settings/account/login-alerts'), {'on': v}))) await reload();
              },
            ),
          ]),
        );
      },
    );
  }
}

String _until(dynamic iso) {
  final d = DateTime.tryParse(text(iso) ?? '')?.toLocal();
  if (d == null) return '—';
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(d.day)}.${two(d.month)} ${two(d.hour)}:${two(d.minute)}';
}

String _method(String? method) => switch (method) {
      'password' => tr('Пароль'),
      'google' => 'Google',
      'discord' => 'Discord',
      'passkey' => tr('Ключ доступу'),
      '2fa' => tr('Код 2FA'),
      'app' => tr('Застосунок'),
      'register' => tr('Реєстрація'),
      _ => method ?? '—',
    };

class _Row extends StatelessWidget {
  _Row({required this.icon, required this.title, required this.subtitle, this.trailing, Color? iconColor}) : iconColor = iconColor ?? muted;
  final IconData icon;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(color: fg.withValues(alpha: 0.03), borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        Icon(icon, size: 20, color: iconColor),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            FitText(title, style: body(14, weight: FontWeight.w600)),
            FitText(subtitle, style: body(12, color: muted)),
          ]),
        ),
        ?trailing,
      ]),
    );
  }
}

class _Devices extends StatelessWidget {
  const _Devices({required this.data, required this.reload});
  final Map<String, dynamic> data;
  final Future<void> Function() reload;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    final tokens = maps(data['tokens']);
    final sessions = maps(data['sessions']);
    final others = sessions.length + tokens.where((t) => t['current'] != true).length;

    Future<void> run(String path) async {
      if (await attempt(context, () => api.delete(path))) await reload();
    }

    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CardTitle(tr('Пристрої і сесії'), icon: LucideIcons.monitorSmartphone),
        const SizedBox(height: 4),
        Text(tr('Де ви зараз увійшли. Завершіть сесію, якщо не впізнаєте пристрій.'), style: body(12.5, color: muted)),
        const SizedBox(height: 12),
        for (final t in tokens)
          _Row(
            icon: LucideIcons.smartphone,
            title: '${tr('Застосунок GameCon')} · ${t['name']}',
            subtitle: t['current'] == true ? tr('цей пристрій') : ago(t['last_used_at']),
            trailing: t['current'] == true
                ? Pill(label: tr('Зараз'), color: green)
                : IconButton(tooltip: tr('Вийти'), icon: Icon(LucideIcons.logOut, size: 18, color: soft), onPressed: () => run('/api/v1/me/tokens/${t['id']}')),
          ),
        for (final s in sessions)
          _Row(
            icon: LucideIcons.monitor,
            title: text(s['device']) ?? tr('Браузер'),
            subtitle: '${text(s['ip']) ?? '—'} · ${ago(s['last_active_at'])}',
            trailing: IconButton(tooltip: tr('Завершити'), icon: Icon(LucideIcons.logOut, size: 18, color: soft), onPressed: () => run('/api/v1/me/sessions/${s['id']}')),
          ),
        if (others > 0) ...[
          const SizedBox(height: 4),
          GhostButton(label: tr('Завершити всі інші сесії'), icon: LucideIcons.logOut, onPressed: () => run('/api/v1/me/sessions')),
        ],
      ]),
    );
  }
}

class _Logins extends StatelessWidget {
  const _Logins({required this.logins});
  final List<Map<String, dynamic>> logins;

  @override
  Widget build(BuildContext context) {
    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CardTitle(tr('Журнал входів'), icon: LucideIcons.history),
        const SizedBox(height: 12),
        if (logins.isEmpty) Text(tr('Поки що порожньо.'), style: body(13, color: muted)),
        for (final l in logins.take(15))
          _Row(
            icon: l['success'] == true ? LucideIcons.circleCheck : LucideIcons.circleX,
            iconColor: l['success'] == true ? green : dangerSoft,
            title: '${_method(text(l['method']))} · ${text(l['device']) ?? ''}',
            subtitle: [text(l['ip']) ?? '—', ago(l['at']), if (l['success'] != true) tr('невдала спроба')].join(' · '),
          ),
      ]),
    );
  }
}

class _Profanity extends StatefulWidget {
  const _Profanity({required this.initial});
  final bool initial;

  @override
  State<_Profanity> createState() => _ProfanityState();
}

class _ProfanityState extends State<_Profanity> {
  late bool on = widget.initial;

  Future<void> _toggle(bool value) async {
    final session = AppScope.read(context).session;
    setState(() => on = value);
    if (await attempt(context, () => session.api.put('/api/v1/me/profanity', {'hide': value}))) {
      await session.refreshMe();
    } else if (mounted) {
      setState(() => on = !value);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Glass(
      child: SwitchListTile(
        contentPadding: EdgeInsets.zero,
        value: on,
        onChanged: _toggle,
        title: Text(tr('Приховувати образливі слова'), style: body(14.5, weight: FontWeight.w600)),
        subtitle: Text(tr('Мат зірочками в записах, коментарях і чатах — лише для вас'), style: body(12.5, color: muted)),
      ),
    );
  }
}

class _Appeals extends StatefulWidget {
  const _Appeals({required this.data, required this.reload});
  final Map<String, dynamic> data;
  final Future<void> Function() reload;

  @override
  State<_Appeals> createState() => _AppealsState();
}

class _AppealsState extends State<_Appeals> {
  final bodyCtrl = TextEditingController();
  late String kind = widget.data['mute'] is Map ? 'mute' : 'content';
  bool busy = false;

  @override
  void dispose() {
    bodyCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final api = AppScope.read(context).session.api;
    setState(() => busy = true);
    final ok = await attempt(context, () => api.post('/api/v1/me/appeals', {'kind': kind, 'body': bodyCtrl.text.trim()}), success: tr('Оскарження надіслано модераторам.'));
    if (!mounted) return;
    setState(() => busy = false);
    if (ok) {
      bodyCtrl.clear();
      await widget.reload();
    }
  }

  String _status(String? status) => switch (status) {
        'accepted' => tr('Прийнято'),
        'rejected' => tr('Відхилено'),
        _ => tr('На розгляді'),
      };

  @override
  Widget build(BuildContext context) {
    final kinds = mapOf(widget.data['appeal_kinds']);
    final mute = widget.data['mute'] is Map ? mapOf(widget.data['mute']) : null;
    final appeals = maps(widget.data['appeals']);
    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CardTitle(tr('Оскарження рішення модерації'), icon: LucideIcons.gavel),
        const SizedBox(height: 4),
        Text(tr('Якщо вам обмежили можливість писати або видалили вміст помилково'), style: body(12.5, color: muted)),
        if (mute != null) ...[
          const SizedBox(height: 10),
          Text(tr('Вам заборонено писати до {date}.', {'date': _until(mute['until'])}) + (text(mute['reason']) != null ? ' ${mute['reason']}' : ''), style: body(13, color: gold)),
        ],
        const SizedBox(height: 12),
        GcSelect<String>(
          value: kind,
          expand: true,
          items: [for (final e in kinds.entries) (e.key, tr('${e.value}'))],
          onChanged: (v) => setState(() => kind = v ?? kind),
        ),
        const SizedBox(height: 10),
        GcField(controller: bodyCtrl, label: tr('Що сталося і чому рішення варто переглянути'), maxLines: 5, minLines: 3, onChanged: (_) => setState(() {})),
        const SizedBox(height: 10),
        PrimaryButton(label: tr('Надіслати'), busy: busy, onPressed: bodyCtrl.text.trim().length < 10 ? null : _send),
        for (final a in appeals) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: fg.withValues(alpha: 0.03), borderRadius: BorderRadius.circular(16)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${tr('${kinds[a['kind']] ?? a['kind']}')} · ${ago(a['created_at'])} · ${_status(text(a['status']))}', style: body(12, color: muted)),
              const SizedBox(height: 4),
              Text(text(a['body']) ?? '', style: body(13.5, color: soft)),
              if (text(a['reply']) != null) ...[
                const SizedBox(height: 6),
                Text(text(a['reply'])!, style: body(13, color: ink)),
              ],
            ]),
          ),
        ],
      ]),
    );
  }
}

class _Freeze extends StatelessWidget {
  const _Freeze();

  Future<void> _freeze(BuildContext context) async {
    final session = AppScope.read(context).session;
    final password = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(tr('Заморозити акаунт?')),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(tr('Сторінку ніхто не бачить, усі сесії закриваються. Дані лишаються — щоб повернутися, просто увійдіть.')),
          const SizedBox(height: 12),
          GcField(controller: password, label: tr('Пароль для підтвердження'), obscure: true),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false), child: Text(tr('Скасувати'))),
          TextButton(onPressed: () => Navigator.pop(dialog, true), child: Text(tr('Заморозити'), style: const TextStyle(color: dangerSoft))),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    if (await attempt(context, () => session.api.post('/api/v1/me/freeze', {'password': password.text}))) {
      await session.clear();
      if (context.mounted) context.go('/');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CardTitle(tr('Заморозити акаунт'), icon: LucideIcons.snowflake),
        const SizedBox(height: 4),
        Text(tr('Сторінку ніхто не бачить, усі сесії закриваються. Дані лишаються — щоб повернутися, просто увійдіть.'), style: body(12.5, color: muted)),
        const SizedBox(height: 12),
        GhostButton(label: tr('Заморозити'), icon: LucideIcons.snowflake, onPressed: () => _freeze(context)),
      ]),
    );
  }
}

/// Скарга на людину (не на окреме повідомлення).
Future<void> showReportSheet(BuildContext context, String username, String name) async {
  final api = AppScope.read(context).session.api;
  final comment = TextEditingController();
  const reasons = [
    ('spam', 'Спам або реклама'),
    ('abuse', 'Образи, цькування'),
    ('fake', 'Фейкова сторінка'),
    ('scam', 'Шахрайство'),
    ('cheat', 'Читерство'),
    ('child_safety', 'Загроза дитині, сексуальна експлуатація'),
    ('other', 'Інше'),
  ];
  var reason = 'spam';
  final send = await showModalBottomSheet<bool>(
    context: context,
    backgroundColor: Colors.transparent,
    elevation: 0,
    isScrollControlled: true,
    builder: (sheet) => ArcticGlassSheetSurface(child: StatefulBuilder(
      builder: (sheet, setSheet) => Padding(
        padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.viewInsetsOf(sheet).bottom),
        child: SafeArea(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(tr('Скарга на {name}', {'name': name}), style: display(18)),
            const SizedBox(height: 4),
            Text(tr('Модератори перевірять сторінку. Людина не дізнається, хто поскаржився.'), style: body(13, color: muted)),
            const SizedBox(height: 12),
            for (final (id, label) in reasons)
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                onTap: () => setSheet(() => reason = id),
                leading: Icon(reason == id ? LucideIcons.circleDot : LucideIcons.circle, size: 20, color: reason == id ? primary : muted),
                title: Text(tr(label), style: body(14)),
              ),
            const SizedBox(height: 8),
            GcField(controller: comment, label: tr('Що сталося (необов’язково)'), maxLines: 4, minLines: 2),
            const SizedBox(height: 12),
            PrimaryButton(label: tr('Надіслати скаргу'), onPressed: () => Navigator.pop(sheet, true)),
          ]),
        ),
      ),
    )),
  );
  if (send != true || !context.mounted) return;
  await attempt(
    context,
    () => api.post('/api/v1/users/$username/report', {'reason': reason, 'comment': comment.text.trim()}),
    success: tr('Скаргу надіслано модераторам. Дякуємо!'),
  );
}

/// Відгук адмінам: ідея, помилка чи думка.
Future<void> showFeedbackSheet(BuildContext context, {String screen = 'menu'}) async {
  final api = AppScope.read(context).session.api;
  final bodyCtrl = TextEditingController();
  var kind = 'idea';
  final send = await showModalBottomSheet<bool>(
    context: context,
    backgroundColor: Colors.transparent,
    elevation: 0,
    isScrollControlled: true,
    builder: (sheet) => ArcticGlassSheetSurface(child: StatefulBuilder(
      builder: (sheet, setSheet) => Padding(
        padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.viewInsetsOf(sheet).bottom),
        child: SafeArea(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(tr('Відгук адмінам'), style: display(18)),
            const SizedBox(height: 4),
            Text(tr('Ідея, помилка чи просто думка — читаємо все.'), style: body(13, color: muted)),
            const SizedBox(height: 12),
            Segmented(
              options: [
                SegmentOption('idea', tr('Ідея'), icon: LucideIcons.lightbulb),
                SegmentOption('bug', tr('Помилка'), icon: LucideIcons.bug),
                SegmentOption('other', tr('Інше'), icon: LucideIcons.messageCircle),
              ],
              selected: kind,
              onSelect: (v) => setSheet(() => kind = v),
            ),
            const SizedBox(height: 10),
            GcField(controller: bodyCtrl, label: tr('Що варто покращити?'), maxLines: 6, minLines: 3),
            const SizedBox(height: 12),
            PrimaryButton(label: tr('Надіслати'), onPressed: () => Navigator.pop(sheet, true)),
          ]),
        ),
      ),
    )),
  );
  if (send != true || !context.mounted || bodyCtrl.text.trim().length < 5) return;
  await attempt(
    context,
    () => api.post('/api/v1/feedback', {'kind': kind, 'body': bodyCtrl.text.trim(), 'screen': screen}),
    success: tr('Дякуємо! Відгук отримали адміністратори.'),
  );
}


/// Що нового в цій версії застосунку — один раз після оновлення.
const whatsNewVersion = '1.1.123';

/// Нове саме в цій версії — зверху, окремим блоком.
List<String> _whatsNewCurrent() => [
      tr('Тривоги: оберіть точне місце, як у застосунку «Тривога» — район, територіальну громаду, місто чи село й навіть район міста; або знайдіть його пошуком.'),
      tr('Картка «Моє місце» показує, чи є тривога саме у вас зараз — з рівнем і кольором типу.'),
      tr('Офіційний рівень повітряної тривоги з API; коли жовта стає червоною — окреме сповіщення «рівень підвищено».'),
    ];

/// Версія 1.1.122.
List<String> _whatsNew122() => [
      tr('Тривоги — лише з офіційного API «Тривога»: одне сповіщення на початок і одне на відбій, без дублів і запізнень.'),
      tr('Налаштування сповіщень тривог: область, район чи громада; початок, відбій, червоні й жовті тривоги, беззвучний режим.'),
      tr('Повітряна тривога жовтого (лише БпЛА) і червоного (ракети) рівня; кольори типів, як в офіційних застосунках.'),
      tr('Картка тривоги в сповіщеннях з кнопкою «Я в укритті (AFK)»; відбій оновлює ту саму картку й показує тривалість.'),
      tr('Нові значки цілей: «Бандероль» і «Ціль не визначена».'),
      tr('Фон застосунку як на сайті: сцени, фірмовий фон і відеофони GameCon+ з бібліотеки.'),
      tr('Квадратніші кнопки й фільтри; сповіщення про тривогу відкривають мапу тривог.'),
    ];

/// Версія 1.1.121.
List<String> _whatsNew121() => [
      tr('Плоский Liquid Glass: блоки, шапка й нижня панель — матове скло з молочною димкою, без тіней і кантів.'),
    ];

/// Версія 1.1.119.
List<String> _whatsNew119() => [
      tr('Налаштування → «Меню розділів у нижній панелі»: язичок над вкладками (свайп угору) або окрема кнопка «Меню» — як вам зручніше.'),
    ];

/// Версія 1.1.118.
List<String> _whatsNew118() => [
      tr('Новий вигляд у стилі iOS 27: нейтральне темне тло, суцільні картки без просвічування, безбарвне матове скло шапки й доку.'),
      tr('Активна вкладка нижнього меню — біла з рискою; решта розділів — за язичком над вкладками (свайп угору).'),
      tr('Плавні пружні переходи між екранами, новий стартовий екран і тихі звуки інтерфейсу (вимикаються в налаштуваннях).'),
      tr('Сім’ї: календар змін і чергувань; засновник може змінити сервер сім’ї.'),
      tr('Стрічка: вкладка «Активність» — відгуки, добірки й ігри друзів.'),
      tr('Пошук: історія запитів і популярне.'),
      tr('Повільний режим коментарів для своїх записів, оцінки за критеріями у відгуках, архів своїх даних.'),
      tr('Кіно: без дублів — статус лише кнопкою «Дивлюся ▾», біля «Продовжити» — вибір озвучки й серії.'),
    ];

/// Версія 1.1.117.
List<String> _whatsNew117() => [
      tr('Колекційні картки: набір щодня, картки за перегляд і гру, колекції за темами, вітрина профілю й кристали з дублікатів.'),
      tr('Рівень профілю: досвід за активність і нагороди за рівні.'),
      tr('Нагороди за щоденний вхід — календар місяця.'),
      tr('Сезонні події сайту: завдання, спільна мета й нагорода.'),
      tr('«В ефірі» — стріми людей GameCon просто зараз.'),
      tr('Імпорт бібліотеки Steam у беклог і списків аніме з Shikimori, MyAnimeList та Anixart.'),
      tr('Звіт прозорості: як ми модеруємо скарги й апеляції.'),
    ];

/// Версія 1.1.116.
List<String> _whatsNew116() => [
      tr('Повернули вигляд версії 1.1.79: колір тла, скло карток і панелей, кнопки — без зайвої синяви.'),
    ];

/// Версія 1.1.115.
List<String> _whatsNew115() => [
      tr('Кнопка «Вийти» в спільному прослуховуванні й перегляді — кімната триває для інших.'),
      tr('Активна вкладка — неонове світіння тексту й іконки замість кружка.'),
      tr('Шапка й нижнє меню — молочне матове скло, як картки.'),
    ];

/// Версія 1.1.113.
List<String> _whatsNew113() => [
      tr('Запрошення слухати чи дивитися разом приходять у чат карткою з кнопкою «Приєднатися», а не посиланням.'),
    ];

/// Версія 1.1.112.
List<String> _whatsNew112() => [
      tr('Кіно: на головній — лише назва, оцінка й кнопка ▶, без зайвого тексту.'),
      tr('Фільми й серіали грають у веб-плеєрі, як на сайті.'),
    ];

/// Версія 1.1.111.
List<String> _whatsNew111() => [
      tr('Гладке скло: картки — молочна вуаль поверх сильного розмиття, без зернистості, ряби, обводок і тіней.'),
      tr('Тло — м’які розфокусовані плями світла без смуг і мерехтіння під час прокрутки.'),
      tr('Кнопки — скляні сапфірові капсули; поля пошуку й «Що нового» — гладкі капсули.'),
    ];

/// Попередня версія (1.1.110).
List<String> _whatsNewPrev() => [
      tr('Значки біля ніка — зменшені логотипи: сім’я поруч із сервером ГТА, клан чи гільдія — з логотипом своєї гри.'),
      tr('Кілька сімей, кланів і гільдій — показуються всі; на телефоні видно першу групу, решта — за кнопкою «+N» зі списком і описами.'),
      tr('Налаштування → «Значки біля ніка»: оберіть, що показувати першим.'),
      tr('Логотипи ігор беруться з App Store, Google Play чи Steam і оновлюються разом із логотипом.'),
    ];

/// Раніше — історія попередніх версій.
List<String> _whatsNew() => [
      tr('Біля ніка — логотипи сім’ї, клану чи гільдії, сервера й гри замість тексту; дотик показує, що це за сім’я, сервер чи гра, і веде в розділ.'),
      tr('Значок команди GameCon біля імені адміністраторів і модераторів.'),
      tr('Жодних «…»: назви, ніки й підписи показуються повністю — трохи дрібніше або з переносом, без накладань.'),
      tr('Іконки вкладок, сповіщень і плеєра «прорисовуються», коли вмикаються.'),
      tr('Захист від фішингу: підробки Steam, Discord та інших сервісів у повідомленнях не пропускаються.'),
      tr('Новий вигляд «Крижана Арктика»: пласкі безбарвні картки з матового скла — крізь них м’яко видно розмите тло; без обводок, тіней і переливів. Меню — у тому ж стилі.'),
      tr('Шапка, нижнє меню, плеєр і шторки — щільне матове скло: під ними під час прокрутки немає «каші» з літер.'),
      tr('Цифри стали моноширинними: лічильники, час і рейтинги більше не «стрибають».'),
      tr('Акцент — електричний сапфір; кнопки й картки м’яко стискаються від дотику, іконки вкладок коротко «клацають». З «Зменшити рух» — без анімацій.'),
      tr('Без обрізань «…»: меню, RP-досьє, смуга стрічки, блок GameCon+ і історії показують текст повністю.'),
      tr('Чат сім’ї: назва повністю, лічильник під нею, останні повідомлення одним списком; зайву кнопку «Відкрити чат» прибрано.'),
      tr('Кінопортал по-новому: великий банер на всю ширину, пошук із кнопкою фільтра, «Топ за рейтингом» з номерами на постерах і «Популярне зараз».'),
      tr('Сортування й фільтр — окремий екран із чипами: сортування, категорії, статус, жанр і рік; «Скинути» або «Застосувати».'),
      tr('На постерах — рейтинг і ярлики «Новинка», «Анонс», «Виходить», «Завершено»; вікового обмеження на постерах більше немає.'),
      tr('Розклад: дні тижня капсулами, час виходу, лінія «Зараз» і «+ Мій список» біля кожної серії.'),
      tr('Сторінка тайтлу: рейтинг, рік і чипи відомостей; внизу вкладки «Схожі» та «Коментарі».'),
      tr('Кіно відкривається одразу у веб-плеєрі, як на сайті, — без вибору плеєра.'),
      tr('Штаб сім’ї в новому стилі: плитки показників з великими цифрами в тоні, суцільні ряди складу й дисципліни без рамок.'),
      tr('Меню: RP-досьє персонажа — нік і сервер, ранг, баланс у сім’ї й догани; дотик відкриває штаб сім’ї.'),
      tr('Записи: біля імені автора — його роль у сім’ї («Лідер STARK»), під ім’ям — сервер.'),
      tr('Штаб сім’ї: картка чату сім’ї — скільки написали сьогодні, останні повідомлення з RP-ніками і кнопка «Зробити ШІ-підсумок»: домовленості коротко в кількох пунктах.'),
      tr('Штаб сім’ї в новому стилі: суцільні картки з кольоровими іконками, великі цифри показників, тоновані кнопки дій.'),
      tr('Стрічка як на сайті: історії — плитками «Момент» з кільцем, нові підсвічені небесним.'),
      tr('Одна смуга замість трьох карток: вогник серії, «Я готовий грати» (вибір гри й часу, вільні друзі) і завдання дня з розгортанням.'),
      tr('Вкладки «Друзі» і «Рекомендації» — пігулками.'),
      tr('Мапа тривог: єдина офіційна схема кольорів — радіаційна, хімічна, балістика, повітряна, артобстріл, вуличні бої, БпЛА.'),
      tr('Повітряна тривога відтінком показує масштаб: уся область, район, громада чи населений пункт.'),
      tr('Кілька тривог в області — головна плашка за важливістю, решта — малими значками поруч.'),
      tr('Кнопка «Мапа тривог» у меню — одразу під GameCon+.'),
      tr('Нове меню: профіль і GameCon+, тривоги, «Штаб сім’ї & Казна», плитки ігрового хабу, медіа й «Система» — без дублів профілю.'),
      tr('Редактор запису: смайлик ліворуч відкриває емодзі, «+» праворуч — стрічку вкладень: фото, GIF, стікер, музика, кіно, гра, сервер, опитування.'),
      tr('Кіно як на сайті: слайдер з мініатюрами, «Продовжити перегляд» із прогресом, вкладки за типом і каталог сіткою або списком.'),
      tr('Бейджі на постерах: скільки переглянуто, анонс / виходить / завершено, кількість серій і вік.'),
      tr('Нові розділи кіно: Огляд і Розклад нових серій; у Закладках — колекції, історія й обране; кнопка «Рандом».'),
      tr('Сторінка тайтлу: статус перегляду одним дотиком і таблиця відомостей; на горизонтальному екрані постер закріплений ліворуч.'),
      tr('Один пошук на все: люди, кіно, музика, ігри, сервери, клани й сім’ї в одному місці.'),
      tr('Новий вигляд у стилі One UI: суцільні картки з великими заокругленнями, синій акцент, чорна темна тема й світла сіра; вибрана вкладка — пігулкою.'),
      tr('Мапа тривог: райони фарбуються за типом тривоги — загроза БпЛА жовтим, балістика червоним; легенда показує тільки те, що зараз на мапі.'),
      tr('Мапа тривог (лише для України): тривоги по районах і громадах, види тривог — повітряна, артобстріл, вуличні бої, хімічна, радіаційна.'),
      tr('Жовтий рівень — тривога в частині області; штрих — тривога понад добу; окремо Чорнобильська зона відчуження.'),
      tr('Рухомі цілі зі значками: Shahed і Гербера, реактивний Shahed, FPV, крилата ракета, балістика, КАБ, МіГ — дотик відкриває картку з курсом, швидкістю й часом.'),
      tr('Свій регіон, push про тривогу й відбій, звук тривоги з файлів телефону й кнопка «Я в укритті». Дані — офіційні джерела та NEPTUN.'),
      tr('«Гра року» спільноти: голосування в грудні, підсумки з 1 січня — меню «Для гравців».'),
      tr('Гра з бажаного вийшла — прийде сповіщення; на сторінці гри, що ще не вийшла, видно відлік днів.'),
      tr('Ігрові ID у профілі: PSN, Xbox, Nintendo, Epic, Riot, Battle.net, EA й Ubisoft — копіювання одним дотиком.'),
      tr('Добірки фільмів: кнопка зі списком на сторінці тайтлу, популярні добірки — у меню.'),
      tr('Рецензії на фільми зі спойлерами під розмиттям і стрічка рецензій друзів.'),
      tr('Пісня профілю: трек з медіатеки на вашій сторінці — гості слухають дотиком.'),
      tr('Новий екран входу й реєстрації: фото на весь екран, перемикач «Вхід / Реєстрація», скляні поля.'),
      tr('Планшети: інструменти запису видно одразу, а на великому екрані праворуч — друзі онлайн і бесіди.'),
      tr('«Що нового» — картками, прокручується; відкрити знову можна в меню «Налаштування й допомога».'),
      tr('Віджети над стрічкою налаштовуються в «Сповіщення й стрічка» — так само, як на сайті.'),
      tr('Огляди гравців на сторінці гри, стрічка трейлерів у меню й «Гравець місяця» у кланах.'),
      tr('Серія днів поспіль і «Цього дня» — над стрічкою; карта гравців у меню; рамка свята на аватарі — у Налаштуваннях.'),
      tr('Чати: гілки в групах, кілька закріплених, нотатка до бесіди (значок у шапці) і фото на один перегляд (скріпка). Стікери спільнот — у панелі стікерів.'),
      tr('«Що подивитися?»: рулетка кіно за типом і жанром. «Вгадай пісню», вікторина дня й ігровий щоденник — у меню «Для гравців».'),
      tr('Номери телефону: усі рівні, зокрема «Золотий», видно в «Підібрати»; якщо рівень зараз не продається, застосунок так і скаже.'),
      tr('Статус GameCon: чи все працює, збої й хід робіт (меню → «Налаштування й допомога»). Під час збою над стрічкою видно банер.'),
      tr('Серії записів: «…» → «Додати в серію» — читачі гортають частини по порядку.'),
      tr('Підлітковий режим: особисті лише від друзів, без незнайомців у пошуку й без мату (у «Сповіщення й стрічка»).'),
      tr('Конфіги й приціли: коди прицілів, конфіги, бінди й налаштування від гравців — копіювання одним дотиком.'),
      tr('Ігровий вечір: покличте друзів, проголосуйте за час і гру — організатор призначає вечір.'),
      tr('GameCon+: якщо тарифи Google Play зараз недоступні, шторка пояснює чому, а не крутить індикатор.'),
      tr('GameCon+ — картками: переваги, статус і оформлення профілю прямо в застосунку: колір і анімація ніку, рамка аватара, кольори сторінки, ефект шапки.'),
      tr('Нові анімації ніку з GameCon+: «Неон» і «Веселка», як на сайті.'),
      tr('Шторки більше не ховають нижні кнопки під смугою жестів.'),
      tr('Меню розділів упорядковано за категоріями: «Моє», «Для гравців», «Спільнота», «Налаштування й допомога» — компактно, без повторів.'),
      tr('Музика більше не обривається у фоні й на заблокованому екрані: плеєр тримає Wi-Fi і сам перепідключається, якщо пропала мережа.'),
      tr('Плеєр у шторці й на заблокованому екрані: обкладинка на всю картку, повзунок перемотки; натискання відкриває «Зараз грає».'),
      tr('Навушники: одне натискання — пауза, два — наступний трек, три — попередній; дзвінок ставить музику на паузу, від’єднані навушники — теж.'),
      tr('Картки без обводки й тіней — лише матове скло.'),
      tr('Справжнє матове скло, як на iPhone, без тіней: картки, кнопки, поля, шапка й док розмивають тло й прикраси під собою.'),
      tr('Шапка й нижнє меню ближче до країв і підлаштовуються під розмір екрана.'),
      tr('Сніг і листя тепер під картками — м’яко розмиваються склом.'),
      tr('Генератор ніків правильно показує вільні адреси — раніше всі ніки помилково були «зайняті».'),
      tr('Святкові прикраси, як на сайті: Хелловін, Новий рік із шапками Санти, День закоханих, Великдень, День Незалежності.'),
      tr('Новий запис — як на сайті: «+» з інструментами — стікер, GIF, опитування, картка, мем, спойлер, розклад і чернетки.'),
      tr('Нові розділи: статті, знижки й роздачі, беклог ігор, тір-листи, дуелі, дошка ідей, генератор ніків.'),
      tr('У спільнотах — канали, календар подій і вікі; у налаштуваннях — посилання в профілі, тип акаунта й піксельна аватарка.'),
      tr('#теги в записах відкривають сторінку теми; новий значок у сповіщеннях.'),
      tr('Сторінка гри — як на сайті: беклог, оцінка гравців, лідерборд, ціни, «чи потягне ПК», новини, цілі, FPS, питання, наставники й досягнення.'),
      tr('Перші кроки для новачків: номер, режим соцмережі, ігри й сервери.'),
      tr('Налаштування сповіщень: категорії, звук, тихі години, близькі друзі, заглушені слова, спойлери, режим стрімера й економія трафіку.'),
      tr('«Зв’язки й дані»: Telegram і Discord, сервери з входом через GameCon, вивантаження своїх даних. «Вигляд профілю»: тема за грою й порядок блоків.'),
      tr('Новий вигляд «Spatial Glass»: глибоке тло, напівпрозоре скло з бліком, сапфірові й крижані акценти.'),
      tr('Нижнє меню — плаваючий скляний док із крижаною крапкою під активною вкладкою.'),
      tr('ШІ в чатах: кнопка ✨ у полі повідомлення покращує текст, а «Підсумок від ШІ» в меню групи переказує розмову.'),
      tr('Довідка й підтримка прямо в застосунку: статті, звернення зі знімками екрана, відповіді й оцінка.'),
      tr('Подкасти: підписка на шоу й випуски в плеєрі застосунку.'),
      tr('«Прочитати пізніше» й сповіщення за словами — у меню.'),
      tr('У стрічці: опитування (анонімні й відкриті), GIF і записи для підписників.'),
      tr('Новий логотип GameCon — неонова «G» на значку застосунку, у сповіщеннях і всередині.'),
      tr('Замість кружечка завантаження — скляні заготовки екрана з крижаним відблиском, як на сайті.'),
      tr('Шапка тепер плаваюча капсула — як нижнє меню.'),
      tr('Game Card у профілі: рівень, ігри, сервери, сім’я й клан, сезон — поділіться картинкою в один дотик.'),
      tr('Ранковий дайджест о 9:00: події, турніри, дні народження друзів і непрочитане — вимикається в налаштуваннях.'),
      tr('«Запросити друзів»: смужка до наступної нагороди й перші кроки кожного запрошеного.'),
      tr('Станції твоїх груп у «Радіо»: нескінченний потік того, що слухають у твоїх сім’ях, кланах і спільнотах.'),
      tr('Новий віджет «Пульс GameCon» на головному екрані: непрочитані чати й сповіщення, друзі онлайн і в що грають, завдання дня й рівень сезону.'),
      tr('Підбір тиммейтів: анкета гравця, «Шукаю зараз», сумісність у відсотках із поясненням і запрошення у своє паті.'),
      tr('Безпека дітей: нова причина скарги «Загроза дитині» й посилання на стандарти в налаштуваннях приватності.'),
      tr('Турніри й челенджі серверів: реєстрація, сітка на вибування, таблиця результатів і надсилання результату зі скриншотом.'),
      tr('Офлайн-музика: завантажуйте пісні, альбоми й плейлисти на телефон через «⋯» → «Завантажити на пристрій» і слухайте без інтернету.'),
      tr('«Слухати разом» для сім’ї, клану й спільноти: кімнати з діджеєм, пропозиціями треків, реакціями й чатом.'),
      tr('Сезонний пропуск: 30 рівнів за завдання, нагороди — рамки, кольори імені, значки й стікери.'),
      tr('Налаштування «Показувати, що я слухаю» — одне для сайту й застосунку, для всієї музики.'),
      tr('Вхід на сайт через застосунок: підтвердіть вхід одним дотиком — без пароля.'),
      tr('GameCon Connect: бачте, що грає на сайті чи іншому пристрої, керуйте ним і перемикайте музику між телефоном і комп’ютером.'),
      tr('«Музика»: «Назад» ліворуч, привітання замість «Головна», обкладинки станцій без синього відтінку.'),
      tr('Активна вкладка внизу тепер світиться неоновим синім замість рамки.'),
      tr('У «Музиці» зверху — аватар із меню розділів, сповіщення й кнопка «Назад».'),
      tr('Нове матове скло: панелі, меню розділів і міні-плеєр — щільніші й чистіші, як в iOS.'),
      tr('Музику можна завантажити за посиланням: «Завантажити трек» → «За посиланням». Підходять прямі посилання на файл і посилання Google Диска, Dropbox чи OneDrive — статус і прогрес видно одразу, а коли трек готовий — «Слухати».'),
      tr('Плеєри в Кіно тепер називаються «Плеєр 1», «Плеєр 2», «Плеєр 3».'),
      tr('«Заповнити автоматично» в редагуванні треку тепер шукає всюди: розпізнавання за звуком (AcoustID), MusicBrainz, Discogs, Spotify і Last.fm — назву, виконавця, альбом, жанр і обкладинку.'),
      tr('«Зараз грає»: «Грає з…» над чергою, плавні переходи між треками, вирівнювання гучності й таймер сну — у розділі «Звук» під чергою.'),
      tr('Текст пісні з перекладом під кожним рядком і «Поділитися рядками» — гарною карткою з обкладинкою.'),
      tr('«Відомості про пісню»: альбом, рік, жанр і формат файлу — з меню «⋯» або дотиком до значка якості.'),
      tr('Утримуйте ⏪/⏩, щоб перемотувати, а міні-плеєр гортайте вбік, щоб змінити трек.'),
      tr('Нова «Музика», як на сайті: вкладки Головна, Нове, Радіо й Медіатека, мікси для тебе, чарти, Replay і пошук навіть за рядком із тексту пісні.'),
      tr('Сторінки виконавців і альбомів: фото, топ-пісні, альбоми, схожі виконавці й «Про виконавця».'),
      tr('Радіо: твоя нескінченна станція, станції жанрів і живі інтернет-радіостанції. Коли черга закінчується, ∞ підбирає схожі треки.'),
      tr('Новий екран «Зараз грає»: обкладинка на весь екран, зірочка «Улюблене», якість «Без втрат», гучність, текст пісні, вивід звуку й черга з історією.'),
      tr('«Підсумки року» з 1 грудня: твої пости, друзі, музика, кіно й ігри за рік — картками, як в історіях.'),
      tr('Новий вигляд, як на сайті: темна тема «Неоновий синій» і світла «Крижана Арктика» — у Налаштуваннях → Вигляд.'),
      tr('Нижнє меню-острів: потягніть його вгору або торкніться язичка — відкриються всі розділи.'),
      tr('На планшеті — шапка й список розділів ліворуч, як на сайті на комп’ютері.'),
      tr('Плеєр «Зараз грає»: колір обкладинки, вініл, хвиля прогресу й текст пісні в такт.'),
      tr('GameCon+ можна оформити прямо в застосунку через Google Play.'),
      tr('Нові сповіщення вгорі екрана: колір за типом, хрестик і смужка часу.'),
      tr('«Телефон», як на сайті: свій номер, набирач, дзвінки й повідомлення за номером, подарунки номерів друзям.'),
      tr('Режими «Геймер», «Класика», «Мінімал» та інші — у Налаштуваннях → Вигляд.'),
      tr('Гарний номер можна купити прямо в застосунку через Google Play — собі або в подарунок другові.'),
    ];

/// Значок картки за темою пункту — щоб довгий список легше було гортати.
IconData _whatsNewIcon(String item) {
  final t = item.toLowerCase();
  if (t.contains('gamecon+')) return LucideIcons.crown;
  if (t.contains('музик') || t.contains('плеєр') || t.contains('трек') || t.contains('пісн') || t.contains('радіо') || t.contains('подкаст')) return LucideIcons.music;
  if (t.contains('чат') || t.contains('повідомлен')) return LucideIcons.messageCircle;
  if (t.contains('телефон') || t.contains('номер')) return LucideIcons.phone;
  if (t.contains('кіно') || t.contains('подивитися') || t.contains('фільм') || t.contains('серіал') || t.contains('тайтл')) return LucideIcons.clapperboard;
  if (t.contains('ігр') || t.contains('гра ') || t.contains('гри') || t.contains('гравц')) return LucideIcons.gamepad2;
  if (t.contains('сповіщ')) return LucideIcons.bell;
  if (t.contains('спільнот') || t.contains('клан') || t.contains('друз')) return LucideIcons.usersRound;
  if (t.contains('стрічк') || t.contains('запис')) return LucideIcons.newspaper;
  if (t.contains('вигляд') || t.contains('скло') || t.contains('шапк') || t.contains('меню')) return LucideIcons.palette;
  return LucideIcons.sparkles;
}

/// «Що нового»: після оновлення — один раз; [force] — відкрити з меню будь-коли.
Future<void> showWhatsNew(BuildContext context, SharedPreferences prefs, {bool force = false}) async {
  if (!force && prefs.getString('whats_new') == whatsNewVersion) return;
  await prefs.setString('whats_new', whatsNewVersion);
  if (!context.mounted) return;
  final current = _whatsNewCurrent();
  final earlier = [..._whatsNew122(), ..._whatsNew121(), ..._whatsNew119(), ..._whatsNew118(), ..._whatsNew117(), ..._whatsNew116(), ..._whatsNew115(), ..._whatsNew113(), ..._whatsNew112(), ..._whatsNew111(), ..._whatsNewPrev(), ..._whatsNew()];
  Widget card(String item, {bool fresh = false}) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.fromLTRB(12, 12, 14, 12),
        decoration: BoxDecoration(
          color: fresh ? primary.withValues(alpha: 0.14) : fg.withValues(alpha: 0.045),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(color: (fresh ? primary : fg).withValues(alpha: fresh ? 0.22 : 0.07), borderRadius: BorderRadius.circular(11)),
            child: Icon(_whatsNewIcon(item), size: 17, color: fresh ? const Color(0xFF9DD8FF) : soft),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(item, style: body(14, color: fresh ? fg : soft).copyWith(height: 1.4))),
        ]),
      );
  Widget heading(String label) => Padding(
        padding: const EdgeInsets.fromLTRB(2, 6, 2, 10),
        child: Text(label, style: body(12.5, color: muted, weight: FontWeight.w600)),
      );
  await showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    elevation: 0,
    isScrollControlled: true,
    builder: (sheet) => ArcticGlassSheetSurface(
      child: SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(sheet).height * 0.86,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
              child: Row(children: [
                const Icon(LucideIcons.sparkles, color: Color(0xFF9DD8FF)),
                const SizedBox(width: 8),
                Text(tr('Що нового'), style: display(20)),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: fg.withValues(alpha: 0.07), borderRadius: BorderRadius.circular(99)),
                  child: Text(whatsNewVersion, style: body(12, color: soft, weight: FontWeight.w600)),
                ),
              ]),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                children: [
                  heading(tr('Нове в цій версії')),
                  for (final item in current) card(item, fresh: true),
                  const SizedBox(height: 8),
                  heading(tr('Раніше')),
                  for (final item in earlier) card(item),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 4),
              child: PrimaryButton(label: tr('Зрозуміло'), onPressed: () => Navigator.pop(sheet)),
            ),
            TextButton(
              onPressed: () {
                Navigator.pop(sheet);
                showFeedbackSheet(context, screen: 'whats_new');
              },
              child: Text(tr('Розкажіть, що думаєте'), style: body(13.5, color: const Color(0xFF9AA8FF), weight: FontWeight.w600)),
            ),
          ]),
        ),
      ),
    ),
  );
}
