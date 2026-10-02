import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'auth_screen.dart';
import 'browse.dart';
import 'feed.dart';
import 'shell.dart';
import 'social.dart';
import 'state.dart';
import 'theme.dart';
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
  final player = TrackPlayer();
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
          GoRoute(path: '/feed', builder: (_, _) => FeedScreen(session: session)),
          GoRoute(
            path: '/messages',
            builder: (_, _) => MessagesScreen(session: session),
            routes: [
              GoRoute(
                path: ':id',
                builder: (_, state) => ChatScreen(session: session, id: int.parse(state.pathParameters['id']!)),
              ),
            ],
          ),
          GoRoute(path: '/friends', builder: (_, _) => FriendsScreen(session: session)),
          GoRoute(path: '/people', builder: (_, _) => PeopleScreen(session: session)),
          GoRoute(path: '/profile', builder: (_, _) => ProfileScreen(session: session)),
          GoRoute(path: '/u/:username', builder: (_, state) => ProfileScreen(session: session, username: state.pathParameters['username'])),
          GoRoute(
            path: '/communities',
            builder: (_, _) => CommunitiesScreen(session: session),
            routes: [
              GoRoute(path: ':slug', builder: (_, state) => CommunityScreen(session: session, slug: state.pathParameters['slug']!)),
            ],
          ),
          GoRoute(
            path: '/photos',
            builder: (_, state) => PhotosScreen(session: session, username: state.uri.queryParameters['user']),
          ),
          GoRoute(
            path: '/albums/:id',
            builder: (_, state) => AlbumScreen(session: session, id: int.parse(state.pathParameters['id']!)),
          ),
          GoRoute(path: '/music', builder: (_, _) => MusicScreen(session: session, player: player)),
          GoRoute(
            path: '/cinema',
            builder: (_, _) => CinemaScreen(session: session),
            routes: [
              GoRoute(path: ':slug', builder: (_, state) => MovieScreen(session: session, slug: state.pathParameters['slug']!)),
            ],
          ),
          GoRoute(
            path: '/families',
            builder: (_, _) => FamiliesScreen(session: session),
            routes: [
              GoRoute(path: ':slug', builder: (_, state) => FamilyScreen(session: session, slug: state.pathParameters['slug']!)),
            ],
          ),
          GoRoute(
            path: '/servers',
            builder: (_, _) => ServersScreen(session: session),
            routes: [
              GoRoute(path: ':slug', builder: (_, state) => ServerScreen(session: session, slug: state.pathParameters['slug']!)),
            ],
          ),
          GoRoute(path: '/notifications', builder: (_, _) => NotificationsScreen(session: session)),
          GoRoute(path: '/settings', builder: (_, _) => SettingsScreen(session: session)),
        ],
      ),
    ],
  );

  runApp(GameConApp(router: router));
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
