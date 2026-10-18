// Знімок сторінки тайтлу для перевірки вигляду (лише локально: GC_SHOTS=dir).
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/movie_screen.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<void> _font(String family, String path) async {
  final loader = FontLoader(family)..addFont(Future.value(ByteData.sublistView(File(path).readAsBytesSync())));
  await loader.load();
}

void main() {
  final out = Platform.environment['GC_SHOTS'];

  testWidgets('сторінка тайтлу малюється', (tester) async {
    if (out != null) {
      for (final w in ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold']) {
        await _font('Montserrat', 'fonts/Montserrat-$w.ttf');
      }
      final lucide = '${Platform.environment['HOME']}/.pub-cache/hosted/pub.dev/lucide_icons_flutter-3.1.21/assets';
      await _font('packages/lucide_icons_flutter/Lucide', '$lucide/lucide.ttf');
      await _font('packages/lucide_icons_flutter/Lucide600', '$lucide/build_font/LucideVariable-w600.ttf');
    }
    SharedPreferences.setMockInitialValues({'cinema.voice.bleach': 'kodik:1'});
    final session = Session(await SharedPreferences.getInstance());
    tester.view.physicalSize = const Size(1170, 5200);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final key = GlobalKey();
    await tester.pumpWidget(MaterialApp(
      theme: ThemeData(brightness: Brightness.dark, fontFamily: 'Montserrat', scaffoldBackgroundColor: voidColor),
      home: AppScope(
        session: session,
        player: TrackPlayer(),
        child: RepaintBoundary(
          key: key,
          child: Scaffold(
            body: MovieScreen(slug: 'bleach', preview: {
              'movie': {
                'title': 'Бліч',
                'title_original': 'Bleach',
                'year': 2004,
                'age_rating': '12+',
                'type_label': 'Аніме',
                'duration': 24,
                'episodes_count': 365,
                'countries': ['Японія'],
                'genres': ['екшн і пригоди', 'мультфільм'],
                'ratings': {'imdb': 8.3, 'tmdb': 8.4},
                'watchers_count': 2,
                'comments_count': 1,
                'user_rating': 8.5,
                'ratings_count': 4,
                'description': 'Головний герой — п’ятнадцятирічний японський школяр Ічіго Куросакі.',
              },
              'players': [
                {'key': 'kodik:1', 'provider': 'kodik', 'provider_label': 'Плеєр 1', 'translation': 'AniLibria.TV', 'episodes': 366, 'link': 'https://kodik.info/serial/1/x/720p'},
              ],
              'state': {'status': 'watching', 'rating': 9},
              'statuses': [
                {'key': 'planned', 'label': 'Буду дивитися'},
                {'key': 'watching', 'label': 'Дивлюся'},
                {'key': 'watched', 'label': 'Переглянуто'},
                {'key': 'dropped', 'label': 'Закинуто'},
              ],
              'audience': {
                'ratings': {'7': 1, '8': 1, '9': 2},
                'statuses': {'watching': 2, 'planned': 3, 'watched': 1, 'dropped': 0},
              },
              'friends': {'users': [], 'total': 0},
              'similar': [],
              'comments': [],
            }),
          ),
        ),
      ),
    ));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Дивитися'), findsOneWidget);
    expect(find.text('Додано: 366 серія | AniLibria.TV | Плеєр 1'), findsOneWidget);
    expect(find.text('У списках у людей'), findsOneWidget);
    if (out != null) {
      await tester.runAsync(() async {
        final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
        final image = await boundary.toImage(pixelRatio: 1);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        File('$out/movie.png').writeAsBytesSync(bytes!.buffer.asUint8List());
      });
    }
  });
}
