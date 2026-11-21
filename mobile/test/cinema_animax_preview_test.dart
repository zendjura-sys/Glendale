// Знімки кінопорталу в стилі Animax (лише локально: GC_SHOTS=dir): банер, пошук із фільтром,
// топ з номерами, «Популярне», сітка 2 колонки й екран «Сортування й фільтр».
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/cinema_ui.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<void> _font(String family, String path) async {
  final loader = FontLoader(family)..addFont(Future.value(ByteData.sublistView(File(path).readAsBytesSync())));
  await loader.load();
}

Map<String, dynamic> _movie(int i, {String release = 'released'}) => {
      'id': i,
      'slug': 'm$i',
      'title': ['Клинок, що знищує демонів', 'Атака титанів', 'Сім’я шпигуна', 'Магічна битва', 'Ван-Піс', 'Наруто'][i % 6],
      'year': i.isEven ? DateTime.now().year : 2022,
      'type': 'anime',
      'type_label': 'Аніме',
      'genres': ['Бойовик', 'Пригоди'],
      'countries': ['Японія'],
      'rating': 9.8 - i / 10,
      'episodes_count': 12 + i,
      'release': i % 3 == 0 ? 'ongoing' : release,
      'age_rating': '16',
    };

void main() {
  final out = Platform.environment['GC_SHOTS'];

  Future<void> fonts() async {
    if (out == null) return;
    for (final w in ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold']) {
      await _font('Montserrat', 'fonts/Montserrat-$w.ttf');
    }
    final lucide = '${Platform.environment['HOME']}/.pub-cache/hosted/pub.dev/lucide_icons_flutter-3.1.21/assets';
    await _font('packages/lucide_icons_flutter/Lucide', '$lucide/lucide.ttf');
  }

  Future<void> shot(WidgetTester tester, GlobalKey key, String name) async {
    if (out == null) return;
    await tester.runAsync(() async {
      final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 1);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      File('$out/$name.png').writeAsBytesSync(bytes!.buffer.asUint8List());
    });
  }

  testWidgets('кіно в стилі Animax: головна', (tester) async {
    await fonts();
    SharedPreferences.setMockInitialValues({});
    final session = Session(await SharedPreferences.getInstance());
    tester.view.physicalSize = const Size(1290, 5400);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final key = GlobalKey();
    final movies = [for (var i = 0; i < 8; i++) _movie(i)];
    await tester.pumpWidget(MaterialApp(
      theme: ThemeData(brightness: Brightness.dark, fontFamily: 'Montserrat', scaffoldBackgroundColor: voidColor),
      home: AppScope(
        session: session,
        player: TrackPlayer(),
        child: RepaintBoundary(
          key: key,
          child: Scaffold(
            body: ListView(padding: const EdgeInsets.fromLTRB(14, 0, 14, 16), children: [
              CinemaBleed(height: 460, child: CinemaHero(movies: [movies.first])),
              const SizedBox(height: 16),
              CinemaSearchBar(initial: '', onSubmit: (_) {}, onFilter: () {}),
              const SizedBox(height: 18),
              const CinemaSectionTitle('Топ за рейтингом', onAll: _noop),
              AnimaxRow(movies: movies, ranked: true),
              const SizedBox(height: 20),
              const CinemaSectionTitle('Популярне зараз', onAll: _noop),
              AnimaxRow(movies: movies.reversed.toList(), episodes: true),
              const SizedBox(height: 20),
              AnimaxGrid(movies: movies.take(4).toList()),
            ]),
          ),
        ),
      ),
    ));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Топ за рейтингом'), findsOneWidget);
    expect(find.text('Новинка'), findsWidgets);
    expect(find.text('16+'), findsNothing);
    await shot(tester, key, 'cinema-animax-home');
  });

  testWidgets('кіно в стилі Animax: сортування й фільтр', (tester) async {
    await fonts();
    SharedPreferences.setMockInitialValues({});
    final session = Session(await SharedPreferences.getInstance());
    tester.view.physicalSize = const Size(1290, 2796);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final key = GlobalKey();
    await tester.pumpWidget(AppScope(
      session: session,
      player: TrackPlayer(),
      child: MaterialApp(
        theme: ThemeData(brightness: Brightness.dark, fontFamily: 'Montserrat', scaffoldBackgroundColor: voidColor),
        builder: (_, child) => RepaintBoundary(key: key, child: child!),
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: TextButton(
                onPressed: () => showCinemaFilter(
                  context,
                  current: const CinemaFilter(genre: 'Бойовик', year: 2024),
                  sorts: const [('updated', 'Нещодавно оновлені'), ('new', 'Нові на сайті'), ('popular', 'Популярні'), ('rating', 'За рейтингом')],
                  types: const [{'key': 'anime', 'label': 'Аніме'}, {'key': 'series', 'label': 'Серіали'}, {'key': 'movie', 'label': 'Фільми'}],
                  genres: [for (final g in ['Бойовик', 'Комедія', 'Драма', 'Фентезі', 'Романтика', 'Жахи', 'Містика', 'Наукова фантастика', 'Спорт']) {'name': g}],
                  years: const [2025, 2024, 2023, 2022, 2021, 2020],
                ),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text('Застосувати'), findsOneWidget);
    await shot(tester, key, 'cinema-animax-filter');
  });
}

void _noop() {}
