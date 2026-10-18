import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// GameCon+ у застосунку — модель мультиплатформного акаунта.
//
// Застосунок НЕ продає GameCon+ і не веде до оплати: правила Google Play (Payments policy,
// anti-steering) забороняють кнопки «Купити», ціни, посилання чи WebView на сторінку оплати
// й заклики «купіть на сайті». Тут лише:
//  • статус з GET /api/v1/user/subscription-status (сервер не віддає ні цін, ні посилань);
//  • інформаційна шторка з перевагами й кнопкою «Перевірити статус».
// Не додавайте сюди посилань на /plus, /pricing, /plus/billing чи сторінки донат-сервісів.

/// Статус GameCon+ поточного акаунта: кешується локально й оновлюється при старті, вході
/// й поверненні в застосунок (не частіше ніж раз на 5 хвилин).
class SubscriptionController extends ChangeNotifier with WidgetsBindingObserver {
  SubscriptionController(this._api, this._prefs) {
    _restore();
    WidgetsBinding.instance.addObserver(this);
  }

  final Api _api;
  final SharedPreferences _prefs;
  static const _key = 'plus.status';
  static const _minInterval = Duration(minutes: 5);

  bool _isPro = false;
  DateTime? _expiresAt;
  String? _planName;
  Map<String, dynamic>? _style;
  DateTime? _checkedAt;
  bool loading = false;

  /// Доступ є, поки не минув строк (навіть якщо сервер ще не перепитали).
  bool get isPro => _isPro && (_expiresAt == null || _expiresAt!.isAfter(DateTime.now()));
  DateTime? get proExpiresAt => isPro ? _expiresAt : null;
  String get planName => _planName ?? 'GameCon+';

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
      _checkedAt = DateTime.now();
      await _prefs.setString(_key, jsonEncode({'is_pro': _isPro, 'expires_at': _expiresAt?.toUtc().toIso8601String(), 'plan_name': _planName, 'style': _style}));
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
    } catch (_) {}
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}

/// Перевага GameCon+ — лише опис, без цін.
class _Perk {
  const _Perk(this.icon, this.title);
  final IconData icon;
  final String title;
}

List<_Perk> _perks() => [
  _Perk(LucideIcons.badgeCheck, tr('Значок GameCon+ і колір ніку')),
  _Perk(LucideIcons.sparkles, tr('Анімований нік і ефект шапки профілю')),
  _Perk(LucideIcons.image, tr('GIF-аватар і обкладинка, рамка аватара')),
  _Perk(LucideIcons.drama, tr('До 25 персонажів RP і 20 фото в кожного')),
  _Perk(LucideIcons.pin, tr('3 закріплені записи')),
  _Perk(LucideIcons.users, tr('5 оголошень у «Пошук паті» й підняття раз на добу')),
  _Perk(LucideIcons.paperclip, tr('Файли в чатах до 200 МБ')),
  _Perk(LucideIcons.smile, tr('Стікери GameCon+ і додаткові реакції')),
];

/// Чи стосується помилка сервера ліміту GameCon+ (тексти на кшталт «З GameCon+ — до 25»).
bool isPlusLimit(Object error) => error is ApiException && error.message.contains('GameCon+');

/// Інформаційна шторка GameCon+ (ProFeaturesScreen): переваги, статус, нейтральний текст,
/// «Зрозуміло» і «Перевірити статус». Жодних кнопок оплати, цін чи посилань.
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

class _ProFeatures extends StatelessWidget {
  const _ProFeatures();

  @override
  Widget build(BuildContext context) {
    final plus = AppScope.read(context).session.subscription;
    return ListenableBuilder(
      listenable: plus,
      builder: (context, _) {
        final until = plus.proExpiresAt;
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _StatusChip(active: plus.isPro, until: until),
              const SizedBox(height: 16),
              for (final perk in _perks())
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(color: primary.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(10)),
                        child: Icon(perk.icon, size: 16, color: primary),
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: Text(perk.title, style: body(14, color: soft))),
                    ],
                  ),
                ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.04), borderRadius: BorderRadius.circular(16), border: Border.all(color: line)),
                child: Text(
                  tr('GameCon+ прив’язаний до вашого акаунта GameCon. Якщо GameCon+ уже активний у вашому акаунті, просто увійдіть у нього в застосунку — усі функції відкриються автоматично.'),
                  style: body(13, color: muted).copyWith(height: 1.45),
                ),
              ),
              const SizedBox(height: 18),
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

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.active, required this.until});
  final bool active;
  final DateTime? until;

  @override
  Widget build(BuildContext context) {
    final color = active ? green : muted;
    final label = active
        ? (until != null ? tr('GameCon+ активний до {date}', {'date': '${until!.day.toString().padLeft(2, '0')}.${until!.month.toString().padLeft(2, '0')}.${until!.year}'}) : tr('GameCon+ активний'))
        : tr('Безкоштовний план');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(active ? LucideIcons.circleCheck : LucideIcons.circle, size: 14, color: color),
          const SizedBox(width: 6),
          Text(label, style: body(13, color: color, weight: FontWeight.w600)),
        ],
      ),
    );
  }
}
