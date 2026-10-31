// Розділ «Музика» в стилі Apple Music: вкладки й сторінки малюються з даних мосту сайту
// (відповіді сервера підставлені). Знімки — лише локально: GC_SHOTS=dir.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/account.dart';
import 'package:gamecon/music_home.dart';
import 'package:gamecon/music_pages.dart';
import 'package:gamecon/shell.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fonts.dart';

Map<String, dynamic> _track(int id, String title, String artist, {String? album, String? quality}) => {
      'source': 'local',
      'id': id,
      'key': 'local:$id',
      'title': title,
      'artist': artist,
      'album': album,
      'genre': 'Synthwave',
      'quality': quality,
      'has_lyrics': false,
      'duration': 200,
      'url': '/storage/$id.mp3',
      'cover_url': null,
      'user_id': 1,
      'in_library': true,
      'favorite': id.isEven,
    };

final _tracks = [
  _track(1, 'Neon Skyline', 'Nightdrive Kyiv', album: 'Нічне місто', quality: 'lossless'),
  _track(2, 'Північне сяйво', 'Aurora Lab'),
  _track(3, 'Хвиля', 'Nightdrive Kyiv', album: 'Нічне місто'),
  _track(4, 'Дорога додому', 'Океан'),
  _track(5, 'Тиша', 'Aurora Lab', album: 'Лід'),
];

Map<String, dynamic> _respond(Uri uri) {
  final path = uri.path.replaceFirst('/api/v1/site', '');
  return switch (path) {
    '/music/home' => {
        'home': {
          'top_picks': [
            {'kind': 'station', 'key': 'me', 'name': 'Тоні', 'colors': ['#2f7bff', '#22d3ee'], 'covers': []},
            {'kind': 'mix', 'key': 'favorites', 'colors': ['#2f7bff', '#1a2f7a'], 'covers': [], 'href': '/music/mix/favorites'},
          ],
          'recently_played': _tracks,
          'made_for_you': [
            {'kind': 'mix', 'key': 'discovery', 'colors': ['#3d63ff', '#0b1638'], 'covers': [], 'href': '/music/mix/discovery'},
            {'kind': 'mix', 'key': 'chill', 'colors': ['#a9c8ff', '#2f7bff'], 'covers': [], 'href': '/music/mix/chill'},
          ],
          'replay': {'year': 2026, 'tracks': _tracks},
          'friends': [],
          'stations': [
            {'kind': 'station', 'key': 'genre:Synthwave', 'name': 'Synthwave', 'colors': ['#22c4f0', '#2a6cff'], 'covers': []},
          ],
        },
      },
    '/music/radio' => {
        'data': {
          'my_station': {'kind': 'station', 'key': 'me', 'name': 'Тоні', 'colors': ['#2f7bff', '#22d3ee'], 'covers': []},
          'live': [
            {'source': 'radio', 'id': 1, 'key': 'radio:1', 'title': 'Хіт FM', 'artist': 'Хіти', 'url': 'https://radio.example/hit', 'cover_url': null, 'live': true, 'duration': 0},
          ],
          'by_genre': [],
          'genre_stations': [
            {'kind': 'station', 'key': 'genre:Rock', 'name': 'Rock', 'colors': ['#4d9bff', '#123a8c'], 'covers': []},
          ],
        },
      },
    '/music/library' => {
        'data': {
          'counts': {'playlists': 2, 'artists': 3, 'albums': 2, 'songs': 5, 'favorites': 2, 'genres': 1},
          'recently_added': [
            {'kind': 'album', 'title': 'Нічне місто', 'subtitle': 'Nightdrive Kyiv', 'cover_url': null, 'href': '/music/album?artist=Nightdrive%20Kyiv&title=Нічне%20місто'},
            {'kind': 'track', 'title': 'Північне сяйво', 'subtitle': 'Aurora Lab', 'track': _tracks[1]},
          ],
        },
        'sections': ['playlists', 'artists', 'albums', 'songs', 'favorites', 'genres', 'spotify'],
      },
    '/music/artist' => {
        'artist': {
          'name': 'Nightdrive Kyiv',
          'cover_url': null,
          'genre': 'Synthwave',
          'tracks_count': 2,
          'listeners': 12,
          'top_songs': [_tracks[0], _tracks[2]],
          'albums': [
            {'kind': 'album', 'title': 'Нічне місто', 'artist': 'Nightdrive Kyiv', 'year': 2025, 'tracks_count': 2, 'cover_url': null, 'href': '/music/album'},
          ],
          'singles': [],
          'latest': _tracks[0],
          'similar': [
            {'kind': 'artist', 'name': 'Aurora Lab', 'tracks_count': 2, 'cover_url': null, 'href': '/music/artist?name=Aurora%20Lab'},
          ],
          'station': {'kind': 'station', 'key': 'artist:Nightdrive Kyiv', 'name': 'Nightdrive Kyiv', 'colors': ['#1d6fe0', '#22d3ee'], 'covers': []},
        },
      },
    '/music/artist/info' => {
        'info': {'bio': 'Київський синтвейв-проєкт: нічні дороги, неон і аналогові синтезатори.', 'bio_url': null, 'image_url': null, 'origin': 'Київ', 'born': null, 'formed': '2019', 'genres': ['synthwave'], 'followers': 15400, 'spotify_url': null},
      },
    _ => {},
  };
}

void main() {
  final out = Platform.environment['GC_SHOTS'];

  setUpAll(() async {
    if (out == null) return;
    await loadTestFonts();
  });

  final screens = <(String, String, String)>[
    ('home', '/music', 'Найкраще для тебе'),
    ('radio', '/music/radio', 'Прямий ефір'),
    ('library', '/music/library', 'Нещодавно додане'),
    ('artist', '/music/artist?name=Nightdrive%20Kyiv', 'Топ-пісні'),
  ];
  for (final (name, location, expected) in screens) {
    for (final light in [false, true]) {
      final label = '$name-${light ? 'light' : 'dark'}';
      testWidgets('музика малюється: $label', (tester) async {
        await http.runWithClient(() async {
          SharedPreferences.setMockInitialValues({'whats_new': whatsNewVersion});
          final prefs = await SharedPreferences.getInstance();
          palette = light ? arcticPalette : neonPalette;
          addTearDown(() => palette = neonPalette);
          final session = Session(prefs)..me = {'id': 1, 'name': 'Тоні Старк', 'first_name': 'Тоні', 'username': 'tonny', 'role': 'user'};
          final player = TrackPlayer()..session = session;
          tester.view.physicalSize = const Size(1170, 2532);
          tester.view.devicePixelRatio = 3;
          tester.view.padding = const FakeViewPadding(top: 120, bottom: 60);
          addTearDown(tester.view.reset);
          final router = GoRouter(initialLocation: location, routes: [
            ShellRoute(
              builder: (_, _, child) => AppShell(session: session, player: player, child: child),
              routes: [
                GoRoute(path: '/music', builder: (_, _) => const MusicHub(), routes: [
                  GoRoute(path: 'radio', builder: (_, _) => const MusicHub(tab: 'radio')),
                  GoRoute(path: 'library', builder: (_, _) => const MusicHub(tab: 'library')),
                  GoRoute(path: 'artist', builder: (_, state) => ArtistScreen(name: state.uri.queryParameters['name'] ?? '')),
                ]),
              ],
            ),
          ]);
          final key = GlobalKey();
          await tester.pumpWidget(RepaintBoundary(key: key, child: MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router)));
          for (var i = 0; i < 6; i++) {
            await tester.pump(const Duration(milliseconds: 100));
          }
          expect(find.text(expected), findsWidgets);
          if (out != null) {
            await tester.runAsync(() async {
              final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
              final image = await boundary.toImage(pixelRatio: 1);
              final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
              File('$out/music-$label.png').writeAsBytesSync(bytes!.buffer.asUint8List());
            });
          }
          await tester.pumpWidget(const SizedBox());
        }, () => MockClient((request) async => http.Response(jsonEncode(_respond(request.url)), 200, headers: {'content-type': 'application/json; charset=utf-8'})));
      });
    }
  }
}
