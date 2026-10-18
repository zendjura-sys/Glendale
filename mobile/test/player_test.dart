// Плеєр «Зараз грає»: караоке й хвиля такі самі, як на сайті; знімки — лише локально (GC_SHOTS=dir).
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/full_player.dart';
import 'package:gamecon/lyrics.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<void> _font(String family, String path) async {
  final loader = FontLoader(family)..addFont(Future.value(ByteData.sublistView(File(path).readAsBytesSync())));
  await loader.load();
}

void main() {
  final out = Platform.environment['GC_SHOTS'];

  test('караоке: мітки LRC, службові теги й повтори приспіву', () {
    final lyrics = parseLyrics('[ar:Nightdrive]\n[00:01.00]перший\n[00:05.5]другий\n[00:09.00][00:20.00]приспів');
    expect(lyrics.timed, isTrue);
    expect([for (final l in lyrics.lines) l.text], ['перший', 'другий', 'приспів', 'приспів']);
    expect(lyrics.lines[1].time, 5.5);
    expect(activeLine(lyrics.lines, 0.5), -1);
    expect(activeLine(lyrics.lines, 5.4), 1);
    expect(activeLine(lyrics.lines, 25), 3);
  });

  test('текст без міток — звичайний, без підсвічування', () {
    final lyrics = parseLyrics('рядок\nще рядок');
    expect(lyrics.timed, isFalse);
    expect(lyrics.lines.length, 2);
  });

  test('хвиля — та сама форма, що на сайті', () {
    final bars = waveformBars('local:42', 6);
    const site = [0.239917, 0.265868, 0.213432, 0.592116, 0.592019, 0.361535];
    for (var i = 0; i < site.length; i++) {
      expect(bars[i], closeTo(site[i], 1e-6));
    }
  });

  for (final (name, size, ratio) in [('phone', const Size(1170, 2532), 3.0), ('tablet', const Size(2360, 1640), 2.0)]) {
    testWidgets('плеєр малюється: $name', (tester) async {
      if (out != null) {
        for (final w in ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold']) {
          await _font('Montserrat', 'fonts/Montserrat-$w.ttf');
        }
        final lucide = '${Platform.environment['HOME']}/.pub-cache/hosted/pub.dev/lucide_icons_flutter-3.1.21/assets';
        await _font('packages/lucide_icons_flutter/Lucide', '$lucide/lucide.ttf');
        await _font('MaterialIcons', '/opt/flutter-dl/flutter/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
      }
      SharedPreferences.setMockInitialValues({});
      final session = Session(await SharedPreferences.getInstance());
      final player = TrackPlayer()..session = session;
      player.queue = [
        QueueTrack(id: 42, url: 'https://example.com/a.mp3', title: 'Neon Skyline', artist: 'Nightdrive Kyiv', album: 'Нічне місто'),
        QueueTrack(id: 43, url: 'https://example.com/b.mp3', title: 'Північне сяйво', artist: 'Aurora Lab'),
      ];
      player.index = 0;
      player.duration = const Duration(minutes: 3, seconds: 20);
      player.position = const Duration(minutes: 1, seconds: 4);
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = ratio;
      addTearDown(tester.view.reset);
      final key = GlobalKey();
      await tester.pumpWidget(RepaintBoundary(
        key: key,
        child: MaterialApp(debugShowCheckedModeBanner: false, theme: gameConTheme(), home: AppScope(session: session, player: player, child: FullPlayer(player: player))),
      ));
      await tester.pump(const Duration(milliseconds: 200));
      player.duration = const Duration(minutes: 3, seconds: 20);
      player.position = const Duration(minutes: 1, seconds: 4);
      // На планшеті — стан «грає» (кнопка паузи).
      player.playing = name == 'tablet';
      player.notifyListeners();
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(find.text('Neon Skyline'), findsOneWidget);
      expect(find.text('Зараз грає'), findsOneWidget);
      if (out != null) {
        await tester.runAsync(() async {
          final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
          final image = await boundary.toImage(pixelRatio: 1);
          final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
          File('$out/player-$name.png').writeAsBytesSync(bytes!.buffer.asUint8List());
        });
      }
      await tester.pumpWidget(const SizedBox());
    });
  }
}
