import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'audio.dart';
import 'auth_screen.dart';
import 'chat.dart';
import 'cinema.dart';
import 'communities.dart';
import 'families.dart';
import 'feed.dart';
import 'music.dart';
import 'people.dart';
import 'photos.dart';
import 'push.dart';
import 'servers.dart';
import 'settings.dart';
import 'shell.dart';
import 'state.dart';
import 'theme.dart';
import 'track_edit.dart';
import 'widgets.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
    systemNavigationBarColor: Colors.transparent,
    systemNavigationBarIconBrightness: Brightness.light,
    systemNavigationBarContrastEnforced: false,
  ));
  final prefs = await SharedPreferences.getInstance();
  final session = Session(prefs);
  final player = TrackPlayer()..session = session;
  player.onStart = (track) => repairTrackMeta(session, track.toCard()).then((fixed) {
        if (fixed != null) player.updateMeta(fixed);
      }).catchError((_) {});
  await GcAudioHandler.attach(player);
  // Лише для перевірки фонової музики на емуляторі в CI (.github/workflows/app-audio-check.yml):
  // збірка з --dart-define=GC_AUDIO_TEST_URL=… одразу вмикає трек. У звичайних збірках порожньо.
  const audioTestUrl = String.fromEnvironment('GC_AUDIO_TEST_URL');
  if (audioTestUrl.isNotEmpty) {
    debugPrint('GC_AUDIO_TEST failure=${GcAudioHandler.failure}');
    player.engine.playerStateStream.listen((s) => debugPrint('GC_AUDIO_TEST state=${s.processingState.name} playing=${s.playing}'));
    unawaited(player.play(audioTestUrl, 'GameCon CI', 'Background audio'));
  }
  await session.boot();
  final links = AppLinks();
  links.uriLinkStream.listen(session.takeLink);
  final initial = await links.getInitialLink();
  if (initial != null) session.takeLink(initial);

  final router = GoRouter(
    refreshListenable: session,
    initialLocation: session.token == null ? '/login' : '/feed',
    redirect: (context, state) {
      final logging = state.matchedLocation == '/login';
      if (session.token == null && !logging) return '/login';
      if (session.token != null && logging) return '/feed';
      return null;
    },
    errorBuilder: (context, state) => _Lost(onHome: () => context.go(session.token == null ? '/login' : '/feed')),
    routes: [
      GoRoute(path: '/', redirect: (_, _) => '/feed'),
      GoRoute(path: '/login', builder: (_, _) => AuthScreen(session: session)),
      ShellRoute(
        builder: (_, _, child) => AppShell(session: session, player: player, child: child),
        routes: [
          GoRoute(path: '/feed', builder: (_, _) => const FeedScreen()),
          GoRoute(path: '/search', builder: (_, state) => SearchScreen(initial: state.uri.queryParameters['q'] ?? '')),
          GoRoute(path: '/posts/:id', builder: (_, state) => PostScreen(id: int.tryParse(state.pathParameters['id']!) ?? 0)),
          GoRoute(
            path: '/messages',
            builder: (_, _) => const MessagesScreen(),
            routes: [
              GoRoute(path: ':id', builder: (_, state) => ChatScreen(key: ValueKey(state.pathParameters['id']), id: int.tryParse(state.pathParameters['id']!) ?? 0)),
            ],
          ),
          GoRoute(path: '/friends', builder: (_, state) => FriendsScreen(tab: state.uri.queryParameters['tab'] ?? 'all')),
          GoRoute(path: '/people', builder: (_, state) => PeopleScreen(initial: state.uri.queryParameters['q'] ?? '')),
          GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
          GoRoute(path: '/u/:username', builder: (_, state) => ProfileScreen(key: ValueKey(state.pathParameters['username']), username: state.pathParameters['username'])),
          GoRoute(
            path: '/communities',
            builder: (_, _) => const CommunitiesScreen(),
            routes: [
              GoRoute(
                path: ':slug',
                builder: (_, state) => CommunityScreen(key: ValueKey(state.pathParameters['slug']), slug: state.pathParameters['slug']!),
                routes: [
                  GoRoute(path: 'members', builder: (_, state) => CommunityMembersScreen(slug: state.pathParameters['slug']!, tab: state.uri.queryParameters['tab'] ?? 'all')),
                  GoRoute(path: 'settings', builder: (_, state) => CommunitySettingsScreen(slug: state.pathParameters['slug']!)),
                  GoRoute(path: 'photos', builder: (_, state) => PhotosScreen(community: state.pathParameters['slug'])),
                ],
              ),
            ],
          ),
          GoRoute(path: '/photos', builder: (_, state) => PhotosScreen(key: ValueKey(state.uri.queryParameters['user']), username: state.uri.queryParameters['user'])),
          GoRoute(
            path: '/albums/:id',
            builder: (_, state) => AlbumScreen(key: ValueKey(state.uri.toString()), id: int.tryParse(state.pathParameters['id']!) ?? 0, openPhoto: int.tryParse(state.uri.queryParameters['photo'] ?? '')),
          ),
          GoRoute(
            path: '/music',
            builder: (_, state) => MusicScreen(key: ValueKey(state.uri.queryParameters['user']), username: state.uri.queryParameters['user'], tab: state.uri.queryParameters['tab']),
            routes: [
              GoRoute(path: 'playlists/:id', builder: (_, state) => PlaylistScreen(id: int.tryParse(state.pathParameters['id']!) ?? 0)),
            ],
          ),
          GoRoute(
            path: '/cinema',
            builder: (_, _) => const CinemaScreen(),
            routes: [
              GoRoute(path: 'my', builder: (_, state) => MyCinemaScreen(status: state.uri.queryParameters['status'] ?? 'all')),
              GoRoute(path: ':slug', builder: (_, state) => MovieScreen(key: ValueKey(state.pathParameters['slug']), slug: state.pathParameters['slug']!, autoplay: state.uri.queryParameters['play'] == '1')),
            ],
          ),
          GoRoute(
            path: '/families',
            builder: (_, _) => const FamiliesScreen(),
            routes: [
              GoRoute(path: 'create', builder: (_, state) => CreateFamilyScreen(server: state.uri.queryParameters['server'])),
              GoRoute(
                path: ':slug',
                builder: (_, state) => FamilyScreen(key: ValueKey(state.uri.toString()), slug: state.pathParameters['slug']!, tab: state.uri.queryParameters['tab']),
              ),
            ],
          ),
          GoRoute(
            path: '/servers',
            builder: (_, _) => const ServersScreen(),
            routes: [
              GoRoute(path: ':slug', builder: (_, state) => ServerScreen(slug: state.pathParameters['slug']!)),
            ],
          ),
          GoRoute(path: '/notifications', builder: (_, _) => const NotificationsScreen()),
          GoRoute(path: '/settings', builder: (_, state) => SettingsScreen(initialTab: state.uri.queryParameters['tab'])),
        ],
      ),
    ],
  );

  runApp(GameConApp(router: router));
  // Після першого кадру: дозвіл на сповіщення й реєстрація пристрою для push.
  unawaited(Push(session, router).start());
}

class _Lost extends StatelessWidget {
  const _Lost({required this.onHome});
  final VoidCallback onHome;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.viewPaddingOf(context).top;
    return Stage(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Padding(
          padding: EdgeInsets.fromLTRB(24, (top == 0 ? 28 : top) + 12, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Сторінку не знайдено', style: unbounded.copyWith(fontSize: 26)),
              const SizedBox(height: 8),
              const Text('Це посилання не веде на розділ GameCon.', style: TextStyle(color: muted, fontFamily: 'Onest')),
              const SizedBox(height: 20),
              PrimaryButton(label: 'На головну', onPressed: onHome),
            ],
          ),
        ),
      ),
    );
  }
}

class GameConApp extends StatelessWidget {
  const GameConApp({required this.router, super.key});
  final GoRouter router;

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'GameCon',
      debugShowCheckedModeBanner: false,
      theme: gameConTheme(),
      routerConfig: router,
    );
  }
}
