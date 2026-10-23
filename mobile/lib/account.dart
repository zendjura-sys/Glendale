import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'api.dart';
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
        _Freeze(),
      ]),
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
            Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, weight: FontWeight.w600)),
            Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
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
    isScrollControlled: true,
    builder: (sheet) => StatefulBuilder(
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
    ),
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
    isScrollControlled: true,
    builder: (sheet) => StatefulBuilder(
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
    ),
  );
  if (send != true || !context.mounted || bodyCtrl.text.trim().length < 5) return;
  await attempt(
    context,
    () => api.post('/api/v1/feedback', {'kind': kind, 'body': bodyCtrl.text.trim(), 'screen': screen}),
    success: tr('Дякуємо! Відгук отримали адміністратори.'),
  );
}


/// Що нового в цій версії застосунку — один раз після оновлення.
const whatsNewVersion = '1.1.65';

List<String> _whatsNew() => [
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

Future<void> showWhatsNew(BuildContext context, SharedPreferences prefs) async {
  if (prefs.getString('whats_new') == whatsNewVersion) return;
  await prefs.setString('whats_new', whatsNewVersion);
  if (!context.mounted) return;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (sheet) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            const Icon(LucideIcons.sparkles, color: Color(0xFFB4BFFF)),
            const SizedBox(width: 8),
            Text(tr('Що нового'), style: display(20)),
            const Spacer(),
            Text(whatsNewVersion, style: body(12, color: muted)),
          ]),
          const SizedBox(height: 14),
          for (final item in _whatsNew())
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: fg.withValues(alpha: 0.04), borderRadius: BorderRadius.circular(14)),
              child: Text(item, style: body(14, color: soft).copyWith(height: 1.4)),
            ),
          const SizedBox(height: 6),
          PrimaryButton(label: tr('Зрозуміло'), onPressed: () => Navigator.pop(sheet)),
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
  );
}
