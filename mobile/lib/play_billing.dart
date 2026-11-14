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

  /// Чому тарифів немає: 'disabled' — продаж вимкнено на сервері; 'store' — Google Play не дав
  /// тарифів (застосунок встановлено не з Google Play чи підписку не активовано в Play Console).
  String? unavailable;
  bool loading = false;

  /// Йде покупка або перевірка на сервері.
  bool busy = false;
  String? error;
  String? _accountId;
  List<PlayPlan> plans = const [];

  /// Номери телефону — разові товари phone_<рівень>: ціни з Google Play за рівнем.
  Map<String, ProductDetails> phonePrices = const {};
  bool get phonesAvailable => phonePrices.isNotEmpty;

  /// Останній куплений номер (повідомлення сервера) — екран «Телефон» показує його й оновлюється.
  String? phoneMessage;

  /// Справжня платформа пристрою (не defaultTargetPlatform, який тести підміняють на Android).
  static bool get supported => debugSupported ?? (!kIsWeb && Platform.isAndroid);

  /// Лише для тестів: вдавати Android (щоб показати блок покупки в знімках).
  @visibleForTesting
  static bool? debugSupported;

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
      if (config['enabled'] != true || ids.isEmpty) {
        available = false;
        unavailable = 'disabled';
        plans = const [];
        return;
      }
      // Сервіси Google Play можуть не відповісти — не крутимо індикатор вічно.
      if (!await InAppPurchase.instance.isAvailable().timeout(const Duration(seconds: 8), onTimeout: () => false)) {
        available = false;
        unavailable = 'store';
        plans = const [];
        return;
      }
      final response = await InAppPurchase.instance.queryProductDetails(ids).timeout(const Duration(seconds: 15));
      plans = _plans(response.productDetails);
      available = plans.isNotEmpty;
      unavailable = available ? null : 'store';
    } catch (_) {
      available = false;
      unavailable = 'store';
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  /// Ціни номерів за рівнями (для «Купити гарний номер»).
  Future<void> loadPhones() async {
    if (!supported) return;
    try {
      final config = await _api.get('/api/v1/google-play');
      final ids = (config['phone_products'] is List ? config['phone_products'] as List : const []).map((e) => '$e').toSet();
      _accountId = config['account_id'] is String ? config['account_id'] as String : _accountId;
      if (ids.isEmpty || !await InAppPurchase.instance.isAvailable()) {
        phonePrices = const {};
      } else {
        final response = await InAppPurchase.instance.queryProductDetails(ids);
        phonePrices = {for (final product in response.productDetails) product.id.replaceFirst('phone_', ''): product};
      }
    } catch (_) {
      phonePrices = const {};
    }
    notifyListeners();
  }

  /// Купити номер: сервер бронює його на час оплати, Google Play приймає оплату за рівень,
  /// сервер перевіряє покупку й вмикає саме заброньований номер.
  Future<void> buyPhone({required String operator, required String digits, int? giftTo}) async {
    if (busy) return;
    busy = true;
    error = null;
    phoneMessage = null;
    notifyListeners();
    try {
      final hold = await _api.post('/api/v1/google-play/phone/hold', {'operator': operator, 'digits': digits, 'gift_to': ?giftTo});
      final product = '${hold['product']}';
      final details = phonePrices[product.replaceFirst('phone_', '')];
      if (details == null) throw ApiException(tr('Цей рівень номера зараз не продається в Google Play.'));
      final started = await InAppPurchase.instance.buyConsumable(
        purchaseParam: GooglePlayPurchaseParam(productDetails: details, applicationUserName: '${hold['account_id']}', obfuscatedProfileId: '${hold['profile_id']}'),
        // Списує покупку сервер, коли номер уже ввімкнено.
        autoConsume: false,
      );
      if (!started) busy = false;
    } on ApiException catch (e) {
      busy = false;
      error = e.message;
    } catch (e) {
      busy = false;
      error = '$e';
    }
    notifyListeners();
  }

  Future<void> _verifyPhone(PurchaseDetails purchase) async {
    busy = true;
    notifyListeners();
    final details = phonePrices[purchase.productID.replaceFirst('phone_', '')];
    try {
      final result = await _api.post('/api/v1/google-play/phone/verify', {
        'purchase_token': purchase.verificationData.serverVerificationData,
        'product_id': purchase.productID,
        if (details != null) 'amount_micros': (details.rawPrice * 1000000).round(),
        if (details != null) 'currency': details.currencyCode,
      });
      phoneMessage = result['message'] is String ? result['message'] as String : tr('Номер ваш.');
      if (purchase.pendingCompletePurchase) {
        try {
          await InAppPurchase.instance.completePurchase(purchase);
        } catch (_) {}
      }
    } on ApiException catch (e) {
      // Покупку не закриваємо: якщо номер не ввімкнено, Google поверне кошти сам.
      error = e.message;
    } finally {
      busy = false;
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
          if (purchase.productID.startsWith('phone_')) {
            await _verifyPhone(purchase);
          } else {
            await _verify(purchase);
          }
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
