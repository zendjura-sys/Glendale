import 'package:flutter/foundation.dart' show TargetPlatform, defaultTargetPlatform, kIsWeb;

/// На чому працює GameCon: телефон (Android/iOS) чи ПК (Windows/Linux/macOS).
///
/// ПК-версія — той самий застосунок із нативним рендерингом Flutter (без веб-інтерфейсу), але
/// без того, чого на ПК немає: віджетів робочого столу Android, пушів Firebase, оверлею Android,
/// датчика струсу. Своє в ПК — вікно, трей, гарячі клавіші й оверлей у грі (lib/desktop/).
// defaultTargetPlatform — справжня ОС на пристрої, а в тестах — телефон (flutter test), тож тести
// перевіряють інтерфейс телефона навіть на Linux-машині CI.
bool get isDesktop => !kIsWeb && const {TargetPlatform.windows, TargetPlatform.linux, TargetPlatform.macOS}.contains(defaultTargetPlatform);

bool get isMobile => !kIsWeb && (defaultTargetPlatform == TargetPlatform.android || defaultTargetPlatform == TargetPlatform.iOS);

bool get isAndroid => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

/// Покупки за баланс сайту: на ПК — як на сайті; в Android — лише Google Play Billing (правила Google Play).
bool get siteBilling => isDesktop;
