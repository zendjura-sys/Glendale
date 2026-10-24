import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/movie_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  final voices = [
    {'key': 'kodik:1', 'provider': 'kodik', 'provider_label': 'Плеєр 1', 'translation': 'AniLibria.TV', 'translation_type': 'voice', 'episodes': 12},
    {'key': 'kodik:2', 'provider': 'kodik', 'provider_label': 'Плеєр 1', 'translation': 'Crunchyroll', 'translation_type': 'subtitles', 'episodes': 3},
  ];

  test('серії озвучки обрізаються до її кількості', () {
    final seasons = <Season>[(number: 1, episodes: [for (var i = 1; i <= 24; i++) i])];
    expect(voiceSeasons(seasons, voices[1]).single.episodes, [1, 2, 3]);
    expect(voiceSeasons(seasons, {'episodes': null}).single.episodes.length, 24);
  });

  testWidgets('вибір озвучки: фільтр субтитрів і повернення озвучки', (tester) async {
    Map<String, dynamic>? picked;
    await tester.pumpWidget(MaterialApp(
      home: Builder(
        builder: (context) => TextButton(
          onPressed: () async => picked = await Navigator.of(context).push(MaterialPageRoute(builder: (_) => VoicePickerScreen(players: voices, selected: 'kodik:1', seasons: const []))),
          child: const Text('open'),
        ),
      ),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text('AniLibria.TV'), findsOneWidget);
    expect(find.text('Crunchyroll'), findsOneWidget);
    await tester.tap(find.text('Субтитри'));
    await tester.pumpAndSettle();
    expect(find.text('AniLibria.TV'), findsNothing);
    await tester.tap(find.text('Crunchyroll'));
    await tester.pumpAndSettle();
    expect(picked?['key'], 'kodik:2');
  });

  testWidgets('список серій: позиція перегляду й вибір серії', (tester) async {
    SharedPreferences.setMockInitialValues({'cinema.pos.anime.1.2': 427});
    final memory = WatchMemory(await SharedPreferences.getInstance(), 'anime');
    Pick? picked;
    await tester.pumpWidget(MaterialApp(
      home: Builder(
        builder: (context) => TextButton(
          onPressed: () async => picked = await Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => EpisodeListScreen(voice: voices.first, seasons: const [(number: 1, episodes: [1, 2, 3])], marks: {}, memory: memory, onToggle: (_) async {}),
          )),
          child: const Text('open'),
        ),
      ),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text('AniLibria.TV'), findsOneWidget);
    expect(find.text('Переглянуто до 07:07'), findsOneWidget);
    await tester.tap(find.text('3 серія'));
    await tester.pumpAndSettle();
    expect(picked, (season: 1, episode: 3));
  });
}
