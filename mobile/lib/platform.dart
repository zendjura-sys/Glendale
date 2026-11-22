import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;

/// На чому працює GameCon: телефон (Android/iOS) чи ПК (Windows/Linux/macOS).
///
/// ПК-версія — той самий застосунок із нативним рендерингом Flutter (без веб-інтерфейсу), але
/// без того, чого на ПК немає: віджетів робочого столу Android, пушів Firebase, оверлею Android,
/// датчика струсу. Своє в ПК — вікно, трей, гарячі клавіші й оверлей у грі (lib/desktop/).
bool get isDesktop => !kIsWeb && (Platform.isWindows || Platform.isLinux || Platform.isMacOS);

bool get isMobile => !kIsWeb && (Platform.isAndroid || Platform.isIOS);

bool get isAndroid => !kIsWeb && Platform.isAndroid;

/// Покупки за баланс сайту: на ПК — як на сайті; в Android — лише Google Play Billing (правила Google Play).
bool get siteBilling => isDesktop;
