import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';

import 'api.dart';
import 'i18n.dart';

// Покупка GameCon+ у застосунку — лише через Google Play Billing.
//
// Ціни, періоди й пробні періоди беремо з Google Play (ProductDetails), а не з сервера. Сервер віддає лише
// ID підписок і ID акаунта (obfuscatedAccountId), а кожну покупку перевіряє в Google Play Developer API
// (POST /api/v1/google-play/verify) — доступ вмикає лише сервер. Жодних посилань на оплату на сайті.

/// План підписки з Google Play: базовий план (місяць, рік) або пропозиція з пробним періодом.
class PlayPlan {
  PlayPlan(this.details, this.period, this.price, this.trial);

  final ProductDetails details;

  /// ISO 8601 з Google Play: P1M, P1Y, P1W…
  final String period;
  final String price;

  /// Пробний період (ISO 8601) або null.
  final String? trial;

  String get periodLabel => playPeriod(period, short: false);
}

/// P1M → «місяць», P1Y → «рік», P3M → «3 місяці».
String playPeriod(String iso, {bool short = true}) {
  final m = RegExp(r'^P(\d+)([DWMY])$').firstMatch(iso);
  if (m == null) return iso;
  final n = int.parse(m.group(1)!);
  final unit = m.group(2)!;
  if (n == 1) {
    return switch (unit) {
      'D' => tr('день'),
      'W' => tr('тиждень'),
      'M' => tr('місяць'),
      _ => tr('рік'),
    };
  }
  return switch (unit) {
    'D' => tr('{n} дн.', {'n': '$n'}),
    'W' => tr('{n} тиж.', {'n': '$n'}),
    'M' => tr('{n} міс.', {'n': '$n'}),
    _ => tr('{n} р.', {'n': '$n'}),
  };
}

class PlayBilling extends ChangeNotifier {
  PlayBilling(this._api, this._onVerified);

  final Api _api;

  /// Сервер підтвердив покупку — оновити статус GameCon+.
  final Future<void> Function() _onVerified;

  StreamSubscription<List<PurchaseDetails>>? _purchases;

  /// Продаж у застосунку ввімкнено на сервері й Google Play доступний на пристрої.
  bool available = false;
  bool loading = false;

  /// Йде покупка або перевірка на сервері.
  bool busy = false;
  String? error;
  String? _accountId;
  List<PlayPlan> plans = const [];

  /// Справжня платформа пристрою (не defaultTargetPlatform, який тести підміняють на Android).
  static bool get supported => !kIsWeb && Platform.isAndroid;

  /// Слухати покупки з першого запуску: Google Play може завершити відкладену покупку пізніше.
  void listen() {
    if (!supported || _purchases != null) return;
    _purchases = InAppPurchase.instance.purchaseStream.listen(
      _handle,
      onError: (Object e) {
        busy = false;
        error = tr('Google Play: {error}', {'error': '$e'});
        notifyListeners();
      },
    );
  }

  /// Підписки й ціни з Google Play (для шторки GameCon+).
  Future<void> load() async {
    if (!supported || loading) return;
    loading = true;
    error = null;
    notifyListeners();
    try {
      final config = await _api.get('/api/v1/google-play');
      final ids = (config['products'] is List ? config['products'] as List : const []).map((e) => '$e').toSet();
      _accountId = config['account_id'] is String ? config['account_id'] as String : null;
      if (config['enabled'] != true || ids.isEmpty || !await InAppPurchase.instance.isAvailable()) {
        available = false;
        plans = const [];
        return;
      }
      final response = await InAppPurchase.instance.queryProductDetails(ids);
      plans = _plans(response.productDetails);
      available = plans.isNotEmpty;
    } catch (_) {
      available = false;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> buy(PlayPlan plan) async {
    if (busy) return;
    busy = true;
    error = null;
    notifyListeners();
    try {
      final started = await InAppPurchase.instance.buyNonConsumable(
        purchaseParam: GooglePlayPurchaseParam(productDetails: plan.details, applicationUserName: _accountId),
      );
      if (!started) busy = false;
    } catch (e) {
      busy = false;
      error = '$e';
    }
    notifyListeners();
  }

  /// Відновити покупки (новий телефон, перевстановлення): Google Play надішле їх у purchaseStream.
  Future<void> restore() async {
    if (!supported) return;
    error = null;
    await InAppPurchase.instance.restorePurchases(applicationUserName: _accountId);
  }

  Future<void> _handle(List<PurchaseDetails> purchases) async {
    for (final purchase in purchases) {
      switch (purchase.status) {
        case PurchaseStatus.pending:
          busy = true;
        case PurchaseStatus.canceled:
          busy = false;
        case PurchaseStatus.error:
          busy = false;
          error = purchase.error?.message ?? tr('Покупку не завершено.');
        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          await _verify(purchase);
      }
      notifyListeners();
    }
  }

  Future<void> _verify(PurchaseDetails purchase) async {
    busy = true;
    notifyListeners();
    try {
      await _api.post('/api/v1/google-play/verify', {
        'purchase_token': purchase.verificationData.serverVerificationData,
        'product_id': purchase.productID,
      });
      // Сервер уже підтвердив покупку в Google; тут лише закриваємо її в Google Play Billing.
      if (purchase.pendingCompletePurchase) {
        try {
          await InAppPurchase.instance.completePurchase(purchase);
        } catch (_) {}
      }
      await _onVerified();
    } on ApiException catch (e) {
      // Покупку не закриваємо: Google Play надішле її знову, і перевірка повториться.
      error = e.message;
    } finally {
      busy = false;
    }
  }

  static List<PlayPlan> _plans(List<ProductDetails> products) {
    final plans = <PlayPlan>[];
    for (final product in products) {
      if (product is! GooglePlayProductDetails) continue;
      final index = product.subscriptionIndex;
      final offers = product.productDetails.subscriptionOfferDetails;
      if (index == null || offers == null || index >= offers.length) continue;
      final phases = offers[index].pricingPhases;
      if (phases.isEmpty) continue;
      final recurring = phases.last;
      final free = phases.length > 1 && phases.first.priceAmountMicros == 0 ? phases.first.billingPeriod : null;
      plans.add(PlayPlan(product, recurring.billingPeriod, recurring.formattedPrice, free));
    }
    // Спершу коротші періоди; для одного періоду — пропозиція з пробним періодом.
    plans.sort((a, b) {
      final byPeriod = _days(a.period).compareTo(_days(b.period));
      return byPeriod != 0 ? byPeriod : (b.trial != null ? 1 : 0) - (a.trial != null ? 1 : 0);
    });
    // Один план на період: пропозиція з пробним періодом (якщо Google дозволяє) або базовий.
    final seen = <String>{};
    return [for (final plan in plans) if (seen.add(plan.period)) plan];
  }

  static int _days(String iso) {
    final m = RegExp(r'^P(\d+)([DWMY])$').firstMatch(iso);
    if (m == null) return 0;
    final n = int.parse(m.group(1)!);
    return n * switch (m.group(2)!) { 'D' => 1, 'W' => 7, 'M' => 30, _ => 365 };
  }

  @override
  void dispose() {
    _purchases?.cancel();
    super.dispose();
  }
}
