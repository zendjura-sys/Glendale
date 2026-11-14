// Шрифти для знімків екранів у тестах (GC_SHOTS): Montserrat і всі накреслення Lucide —
// звичайне й варіативні Lucide100…600 (ними намальовані активні іконки доку), інакше замість
// іконок у знімках виходять квадрати.
import 'dart:io';

import 'package:flutter/services.dart';

Future<void> _font(String family, String path) async {
  final file = File(path);
  if (!file.existsSync()) return;
  final loader = FontLoader(family)..addFont(Future.value(ByteData.sublistView(file.readAsBytesSync())));
  await loader.load();
}

Future<void> loadTestFonts() async {
  for (final w in ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold']) {
    await _font('Montserrat', 'fonts/Montserrat-$w.ttf');
  }
  final lucide = '${Platform.environment['HOME']}/.pub-cache/hosted/pub.dev/lucide_icons_flutter-3.1.21/assets';
  await _font('packages/lucide_icons_flutter/Lucide', '$lucide/lucide.ttf');
  for (final w in [100, 200, 300, 400, 500, 600]) {
    await _font('packages/lucide_icons_flutter/Lucide$w', '$lucide/build_font/LucideVariable-w$w.ttf');
  }
}
