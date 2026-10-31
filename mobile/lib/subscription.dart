import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'i18n.dart';
import 'play_billing.dart';
import 'core/widgets/arctic_glass/arctic_glass.dart' show ArcticPressable;
import 'plus.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// GameCon+ у застосунку — модель мультиплатформного акаунта.
//
// Купити GameCon+ у застосунку можна ЛИШЕ через Google Play Billing (play_billing.dart): ціни й плани —
// з Google Play, кожну покупку перевіряє сервер. Правила Google Play (Payments policy, anti-steering)
// забороняють посилання, ціни чи WebView сторінок оплати сайту й заклики «купіть на сайті».
// Тут: статус з GET /api/v1/user/subscription-status, шторка з перевагами, плани Google Play,
// «Відновити покупки» й «Керувати підпискою» (сторінка Google Play).
// Не додавайте сюди посилань на /plus, /pricing, /plus/billing чи сторінки оплати сайту.

/// Статус GameCon+ поточного акаунта: кешується локально й оновлюється при старті, вході
/// й поверненні в застосунок (не частіше ніж раз на 5 хвилин).
class SubscriptionController extends ChangeNotifier with WidgetsBindingObserver {
  SubscriptionController(this._api, this._prefs) {
    _restore();
    WidgetsBinding.instance.addObserver(this);
    billing = PlayBilling(_api, () => refreshSubscriptionStatus())..listen();
  }

  /// Покупка через Google Play Billing (лише Android-збірка з Google Play).
  late final PlayBilling billing;

  final Api _api;
  final SharedPreferences _prefs;
  static const _key = 'plus.status';
  static const _minInterval = Duration(minutes: 5);

  bool _isPro = false;
  DateTime? _expiresAt;
  String? _planName;
  Map<String, dynamic>? _style;
  String? _store;
  String? _manageUrl;
  bool _autoRenew = false;
  DateTime? _checkedAt;
  bool loading = false;

  /// Доступ є, поки не минув строк (навіть якщо сервер ще не перепитали).
  bool get isPro => _isPro && (_expiresAt == null || _expiresAt!.isAfter(DateTime.now()));
  DateTime? get proExpiresAt => isPro ? _expiresAt : null;
  String get planName => _planName ?? 'GameCon+';

  /// Підписка оформлена в Google Play — керувати нею (скасувати, змінити картку) можна лише там.
  bool get fromGooglePlay => isPro && _store == 'google_play';
  bool get autoRenew => fromGooglePlay && _autoRenew;
  String? get manageUrl => fromGooglePlay ? _manageUrl : null;

  /// Оформлення, обране на сайті (колір ніку, рамка, ефект) — як поле `plus` у картці користувача.
  Map<String, dynamic>? get style => isPro ? (_style ?? const {}) : null;

  /// Перепитати сервер. Повертає актуальне isPro; у разі помилки лишає попередній стан.
  Future<bool> refreshSubscriptionStatus({bool force = true}) async {
    if (!force && _checkedAt != null && DateTime.now().difference(_checkedAt!) < _minInterval) return isPro;
    if (loading) return isPro;
    loading = true;
    notifyListeners();
    try {
      final json = await _api.get('/api/v1/user/subscription-status');
      _isPro = json['is_pro'] == true;
      _expiresAt = DateTime.tryParse('${json['expires_at'] ?? ''}')?.toLocal();
      _planName = json['plan_name'] is String ? json['plan_name'] as String : null;
      _style = json['style'] is Map ? Map<String, dynamic>.from(json['style'] as Map) : null;
      _store = json['store'] is String ? json['store'] as String : null;
      _manageUrl = json['manage_url'] is String ? json['manage_url'] as String : null;
      _autoRenew = json['auto_renew'] == true;
      _checkedAt = DateTime.now();
      await _prefs.setString(_key, jsonEncode({'is_pro': _isPro, 'expires_at': _expiresAt?.toUtc().toIso8601String(), 'plan_name': _planName, 'style': _style, 'store': _store, 'manage_url': _manageUrl, 'auto_renew': _autoRenew}));
    } catch (_) {
      // Немає мережі — лишаємо збережений статус.
    } finally {
      loading = false;
      notifyListeners();
    }
    return isPro;
  }

  /// Вихід з акаунта: забути статус.
  Future<void> reset() async {
    _isPro = false;
    _expiresAt = null;
    _planName = null;
    _style = null;
    _store = null;
    _manageUrl = null;
    _autoRenew = false;
    _checkedAt = null;
    await _prefs.remove(_key);
    notifyListeners();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Людина могла оформити GameCon+ в іншому місці — при поверненні в застосунок статус оновиться сам.
    if (state == AppLifecycleState.resumed && Session.hasToken) unawaited(refreshSubscriptionStatus(force: false));
  }

  void _restore() {
    try {
      final raw = _prefs.getString(_key);
      if (raw == null) return;
      final json = jsonDecode(raw) as Map<String, dynamic>;
      _isPro = json['is_pro'] == true;
      _expiresAt = DateTime.tryParse('${json['expires_at'] ?? ''}')?.toLocal();
      _planName = json['plan_name'] as String?;
      _style = json['style'] is Map ? Map<String, dynamic>.from(json['style'] as Map) : null;
      _store = json['store'] as String?;
      _manageUrl = json['manage_url'] as String?;
      _autoRenew = json['auto_renew'] == true;
    } catch (_) {}
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    billing.dispose();
    super.dispose();
  }
}

/// Перевага GameCon+ — лише опис, без цін (як на сторінці GameCon+ сайту).
class _Perk {
  const _Perk(this.icon, this.title, this.text);
  final IconData icon;
  final String title;
  final String text;
}

List<_Perk> _perks() => [
  _Perk(LucideIcons.badgeCheck, tr('Значок і колір ніку'), tr('Позначка GameCon+ біля імені всюди, 8 кольорів і 3 градієнти ніку.')),
  _Perk(LucideIcons.wandSparkles, tr('Анімований нік'), tr('Перелив, відблиск, неон чи веселка; сяйво обкладинки або жива рамка шапки.')),
  _Perk(LucideIcons.image, tr('Анімований профіль'), tr('GIF-аватар і GIF-обкладинка, рамка аватара (сезонна змінюється щомісяця), власні кольори сторінки.')),
  _Perk(LucideIcons.layers, tr('Більше місця'), tr('До 25 персонажів RP і 20 фото в кожного, 3 закріплені записи, файли в чатах до 200 МБ, 5 оголошень у «Пошук паті».')),
  _Perk(LucideIcons.users, tr('Увага й зручність'), tr('Раз на добу — підняти своє паті нагору на годину. Набори стікерів GameCon+ і ще 5 реакцій.')),
  _Perk(LucideIcons.shield, tr('Чесно для всіх'), tr('Бонусне 4-те завдання дня дає досвід у рівень, але не очки сезону — рейтинг лишається чесним.')),
];

/// Чи стосується помилка сервера ліміту GameCon+ (тексти на кшталт «З GameCon+ — до 25»).
bool isPlusLimit(Object error) => error is ApiException && error.message.contains('GameCon+');

/// Шторка GameCon+ (ProFeaturesScreen): переваги, статус, плани Google Play (якщо продаж увімкнено),
/// «Відновити покупки», «Керувати підпискою» в Google Play і «Перевірити статус».
Future<void> showProFeatures(BuildContext context) {
  return showGcSheet<void>(context, title: 'GameCon+', builder: (sheet) => const _ProFeatures());
}

/// Відкрити GameCon+-функцію: true — доступ є; інакше показує інформаційну шторку.
Future<bool> requirePro(BuildContext context) async {
  final plus = AppScope.read(context).session.subscription;
  if (plus.isPro) return true;
  await showProFeatures(context);
  return plus.isPro;
}

class _ProFeatures extends StatefulWidget {
  const _ProFeatures();

  @override
  State<_ProFeatures> createState() => _ProFeaturesState();
}

class _ProFeaturesState extends State<_ProFeatures> {
  @override
  void initState() {
    super.initState();
    unawaited(AppScope.read(context).session.subscription.billing.load());
  }

  @override
  Widget build(BuildContext context) {
    final plus = AppScope.read(context).session.subscription;
    return ListenableBuilder(
      listenable: Listenable.merge([plus, plus.billing]),
      builder: (context, _) {
        final until = plus.proExpiresAt;
        final perks = _perks();
        // Шторка прокручується: без цього нижні кнопки обрізались і ховались під смугою жестів.
        return SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _Hero(active: plus.isPro, until: until),
              const SizedBox(height: 18),
              Padding(padding: const EdgeInsets.only(left: 4, bottom: 10), child: Text(tr('Що дає GameCon+'), style: body(13, color: faint, weight: FontWeight.w600))),
              // Переваги — картки у дві колонки однакової висоти в ряду.
              for (var i = 0; i < perks.length; i += 2)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: IntrinsicHeight(
                    child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Expanded(child: _PerkCard(perk: perks[i])),
                      const SizedBox(width: 10),
                      Expanded(child: i + 1 < perks.length ? _PerkCard(perk: perks[i + 1]) : const SizedBox()),
                    ]),
                  ),
                ),
              if (plus.isPro) const _StyleEditor(),
              _StoreSection(plus: plus),
              const SizedBox(height: 14),
              Text(
                tr('GameCon+ прив’язаний до вашого акаунта GameCon. Якщо GameCon+ уже активний у вашому акаунті, просто увійдіть у нього в застосунку — усі функції відкриються автоматично.'),
                style: body(12, color: faint).copyWith(height: 1.45),
              ),
              const SizedBox(height: 16),
              PrimaryButton(
                label: tr('Перевірити статус'),
                icon: LucideIcons.refreshCw,
                busy: plus.loading,
                onPressed: () async {
                  final active = await plus.refreshSubscriptionStatus();
                  if (context.mounted) toast(context, active ? tr('GameCon+ активний') : tr('Для цього акаунта GameCon+ не активний'));
                },
              ),
              const SizedBox(height: 10),
              GhostButton(label: tr('Зрозуміло'), onPressed: () => Navigator.pop(context)),
            ],
          ),
        );
      },
    );
  }
}

/// Плашка-картка в шторці: світліша поверхня без обводки (шторка вже скляна).
BoxDecoration _plate({double radius = 18}) => BoxDecoration(color: fg.withValues(alpha: palette.isLight ? 0.05 : 0.055), borderRadius: BorderRadius.circular(radius));

/// Верхня картка: знак GameCon+, назва й статус.
class _Hero extends StatelessWidget {
  const _Hero({required this.active, required this.until});
  final bool active;
  final DateTime? until;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [primary.withValues(alpha: 0.22), const Color(0xFF00D2FF).withValues(alpha: 0.08)],
        ),
      ),
      child: Row(children: [
        const PlusBadge(size: 44),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(active ? tr('Ваш GameCon+') : tr('Підтримайте GameCon'), style: display(17)),
            const SizedBox(height: 6),
            _StatusChip(active: active, until: until),
          ]),
        ),
      ]),
    );
  }
}

class _PerkCard extends StatelessWidget {
  const _PerkCard({required this.perk});
  final _Perk perk;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: _plate(),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(11),
            gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF0A84FF), Color(0xFF00D2FF)]),
          ),
          child: Icon(perk.icon, size: 17, color: Colors.white),
        ),
        const SizedBox(height: 10),
        Text(perk.title, style: body(14, weight: FontWeight.w600)),
        const SizedBox(height: 4),
        Text(perk.text, style: body(12, color: muted).copyWith(height: 1.35)),
      ]),
    );
  }
}

/// Оформлення GameCon+ — як на сайті: колір і анімація ніку, рамка аватара, кольори сторінки,
/// ефект шапки. Варіанти й поточний вибір — із сервера (/plus), прев’ю — одразу.
class _StyleEditor extends StatefulWidget {
  const _StyleEditor();

  @override
  State<_StyleEditor> createState() => _StyleEditorState();
}

class _StyleEditorState extends State<_StyleEditor> {
  Map<String, dynamic>? options;
  Map<String, String> saved = {};
  Map<String, String> style = {};
  String? error;
  bool busy = false;

  static const _keys = ['name', 'fx', 'frame', 'accent', 'header'];

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    try {
      final data = await AppScope.read(context).session.api.get(Api.site('/plus'));
      final current = data['style'] is Map ? data['style'] as Map : const {};
      if (!mounted) return;
      setState(() {
        options = data['options'] is Map ? Map<String, dynamic>.from(data['options'] as Map) : const {};
        saved = {for (final key in _keys) key: '${current[key] ?? ''}'};
        style = {...saved};
      });
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    }
  }

  Future<void> _save() async {
    final scope = AppScope.read(context);
    setState(() => busy = true);
    try {
      final r = await scope.session.api.put(Api.site('/plus/style'), {for (final e in style.entries) e.key: e.value.isEmpty ? null : e.value});
      await scope.session.subscription.refreshSubscriptionStatus();
      unawaited(scope.session.refreshMe().catchError((_) {}));
      if (!mounted) return;
      setState(() => saved = {...style});
      toast(context, text(r['message']) ?? tr('Оформлення збережено.'));
    } catch (e) {
      if (mounted) toast(context, '$e', kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Map<String, List<Color>> _palette(String key) {
    final raw = options?[key];
    if (raw is! Map) return const {};
    return {
      for (final e in raw.entries)
        if (e.value is List) '${e.key}': [for (final c in e.value as List) ?_hex('$c')],
    };
  }

  List<String> _list(String key) => [for (final v in (options?[key] as List? ?? const [])) '$v'];

  @override
  Widget build(BuildContext context) {
    if (error != null) return Padding(padding: const EdgeInsets.only(top: 6), child: Text(error!, style: body(12, color: dangerSoft)));
    if (options == null) return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator(strokeWidth: 2)));
    final names = _palette('names');
    final frames = _palette('frames');
    final accents = _palette('accents');
    final me = AppScope.read(context).session.me ?? const {};
    final mark = PlusMark(name: names[style['name']], frame: frames[style['frame']], fx: style['fx']!.isEmpty ? null : style['fx']);
    final changed = _keys.any((k) => style[k] != saved[k]);
    void pick(String key, String value) => setState(() => style[key] = value);

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(14),
      decoration: _plate(radius: 20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(tr('Оформлення'), style: display(16)),
        const SizedBox(height: 12),
        // Прев’ю: аватар у рамці й нік з анімацією — так його бачитимуть інші.
        Row(children: [
          Avatar(url: text(me['avatar_url']), name: text(me['name']) ?? tr('Я'), size: 46, frame: mark.frame),
          const SizedBox(width: 12),
          Expanded(child: PlusName(text(me['name']) ?? 'GameCon', plus: mark, style: body(17, weight: FontWeight.w700), animate: true)),
        ]),
        _label(tr('Колір ніку')),
        _Swatches(colors: names, value: style['name']!, none: tr('Стандартний'), onPick: (v) => pick('name', v)),
        _label(tr('Анімація ніку')),
        _Chips(options: {for (final key in ['', ..._list('effects')]) key: _fxName(key)}, value: style['fx']!, onPick: (v) => pick('fx', v)),
        _label(tr('Рамка аватара')),
        _Swatches(colors: frames, value: style['frame']!, none: tr('Без рамки'), ring: true, labels: {'season': tr('Сезонна')}, onPick: (v) => pick('frame', v)),
        _label(tr('Кольори сторінки профілю')),
        _Swatches(colors: accents, value: style['accent']!, none: tr('Стандартні'), onPick: (v) => pick('accent', v)),
        _label(tr('Ефект шапки профілю')),
        _Chips(options: {for (final key in ['', ..._list('headers')]) key: _headerName(key)}, value: style['header']!, onPick: (v) => pick('header', v)),
        const SizedBox(height: 14),
        PrimaryButton(label: tr('Зберегти оформлення'), icon: LucideIcons.check, busy: busy, onPressed: changed && !busy ? _save : null),
      ]),
    );
  }

  Widget _label(String text) => Padding(padding: const EdgeInsets.only(top: 16, bottom: 8), child: Text(text, style: body(13, color: muted, weight: FontWeight.w500)));
}

String _fxName(String key) => switch (key) {
  '' => tr('Без анімації'),
  'flow' => tr('Перелив'),
  'shine' => tr('Відблиск'),
  'neon' => tr('Неон'),
  'rainbow' => tr('Веселка'),
  _ => key,
};

String _headerName(String key) => switch (key) {
  '' => tr('Без ефекту'),
  'aurora' => tr('Сяйво обкладинки'),
  'rim' => tr('Жива рамка'),
  _ => key,
};

Color? _hex(String value) {
  final hex = value.replaceFirst('#', '');
  final parsed = int.tryParse(hex.length == 6 ? 'FF$hex' : hex, radix: 16);
  return parsed == null ? null : Color(parsed);
}

/// Варіанти-«пігулки» з перенесенням рядка — усі видно одразу; вибрана залита акцентом.
class _Chips extends StatelessWidget {
  const _Chips({required this.options, required this.value, required this.onPick});
  final Map<String, String> options;
  final String value;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    return Wrap(spacing: 8, runSpacing: 8, children: [
      for (final e in options.entries)
        Semantics(
          button: true,
          selected: value == e.key,
          child: ArcticPressable(
            onTap: () => onPick(e.key),
            scale: 0.94,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              decoration: BoxDecoration(color: value == e.key ? primary : fg.withValues(alpha: 0.07), borderRadius: BorderRadius.circular(999)),
              child: Text(e.value, style: body(13, color: value == e.key ? Colors.white : soft, weight: FontWeight.w600)),
            ),
          ),
        ),
    ]);
  }
}

/// Кольорові кружечки варіантів: «без» + варіанти з сервера; вибраний — з галочкою (без обводки).
class _Swatches extends StatelessWidget {
  const _Swatches({required this.colors, required this.value, required this.none, required this.onPick, this.ring = false, this.labels = const {}});
  final Map<String, List<Color>> colors;
  final String value;
  final String none;
  final ValueChanged<String> onPick;
  final bool ring;
  final Map<String, String> labels;

  @override
  Widget build(BuildContext context) {
    Widget dot(String key, List<Color> tones) {
      final on = value == key;
      final fill = tones.isEmpty ? null : (tones.length == 1 ? null : LinearGradient(colors: tones));
      return Semantics(
        button: true,
        selected: on,
        label: key.isEmpty ? none : (labels[key] ?? key),
        child: ArcticPressable(
          onTap: () => onPick(key),
          scale: 0.9,
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(shape: BoxShape.circle, color: tones.isEmpty ? fg.withValues(alpha: 0.08) : (tones.length == 1 ? tones.first : null), gradient: fill),
            child: Center(
              child: ring && tones.isNotEmpty
                  ? Container(width: 26, height: 26, decoration: BoxDecoration(shape: BoxShape.circle, color: palette.isLight ? Colors.white : const Color(0xFF0C1424)), child: on ? Icon(LucideIcons.check, size: 15, color: tones.first) : null)
                  : (on ? Icon(LucideIcons.check, size: 16, color: tones.isEmpty ? ink : Colors.white) : (tones.isEmpty ? Icon(LucideIcons.ban, size: 15, color: muted) : null)),
            ),
          ),
        ),
      );
    }

    return Wrap(spacing: 10, runSpacing: 10, children: [
      dot('', const []),
      for (final e in colors.entries) dot(e.key, e.value),
    ]);
  }
}

/// Плани Google Play або керування підпискою. Ціни — лише ті, що показує Google Play.
class _StoreSection extends StatelessWidget {
  const _StoreSection({required this.plus});
  final SubscriptionController plus;

  @override
  Widget build(BuildContext context) {
    final billing = plus.billing;
    if (!PlayBilling.supported) return const SizedBox.shrink();
    final manage = plus.manageUrl;
    if (plus.isPro) {
      if (manage == null) return const SizedBox.shrink();
      return Padding(
        padding: const EdgeInsets.only(top: 14),
        child: GhostButton(
          label: tr('Керувати підпискою в Google Play'),
          icon: LucideIcons.settings2,
          onPressed: () => launchUrl(Uri.parse(manage), mode: LaunchMode.externalApplication),
        ),
      );
    }
    if (billing.loading) {
      return const Padding(padding: EdgeInsets.only(top: 18), child: Center(child: CircularProgressIndicator(strokeWidth: 2)));
    }
    if (!billing.available) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 18),
        for (final plan in billing.plans)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _PlanTile(plan: plan, busy: billing.busy, onTap: () => billing.buy(plan)),
          ),
        if (billing.error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(billing.error!, style: body(13, color: dangerSoft)),
          ),
        Text(
          tr('Оплата через Google Play. Підписка продовжується автоматично, поки ви її не скасуєте в Google Play; доступ зберігається до кінця оплаченого періоду. GameCon+ діє в усьому акаунті, зокрема на сайті.'),
          style: body(12, color: muted).copyWith(height: 1.45),
        ),
        const SizedBox(height: 6),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: billing.busy ? null : () => billing.restore(),
            child: Text(tr('Відновити покупки'), style: body(13, color: primary, weight: FontWeight.w600)),
          ),
        ),
      ],
    );
  }
}

class _PlanTile extends StatelessWidget {
  const _PlanTile({required this.plan, required this.busy, required this.onTap});
  final PlayPlan plan;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final trial = plan.trial;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: busy ? null : onTap,
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(16)),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(tr('GameCon+ на {period}', {'period': plan.periodLabel}), style: body(15, weight: FontWeight.w600)),
                    if (trial != null) ...[
                      const SizedBox(height: 2),
                      Text(tr('Перші {period} безкоштовно', {'period': playPeriod(trial)}), style: body(12, color: green)),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 10),
              busy
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : Text('${plan.price} / ${playPeriod(plan.period)}', style: body(14, color: ink, weight: FontWeight.w700)),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.active, required this.until});
  final bool active;
  final DateTime? until;

  @override
  Widget build(BuildContext context) {
    final color = active ? green : muted;
    final label = active
        ? (until != null ? tr('Активний до {date}', {'date': '${until!.day.toString().padLeft(2, '0')}.${until!.month.toString().padLeft(2, '0')}.${until!.year}'}) : tr('Активний'))
        : tr('Безкоштовний план');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(active ? LucideIcons.circleCheck : LucideIcons.circle, size: 14, color: color),
          const SizedBox(width: 6),
          Flexible(child: Text(label, style: body(13, color: color, weight: FontWeight.w600))),
        ],
      ),
    );
  }
}
