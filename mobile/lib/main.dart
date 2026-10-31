import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:home_widget/home_widget.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'app_login.dart';
import 'audio.dart';
import 'auth_screen.dart';
import 'chat.dart';
import 'cinema.dart';
import 'movie_screen.dart';
import 'clans.dart';
import 'communities.dart';
import 'connect.dart';
import 'downloads.dart';
import 'families.dart';
import 'i18n.dart';
import 'events.dart';
import 'extras.dart';
import 'family_widget.dart';
import 'game_card.dart';
import 'pulse_widget.dart';
import 'feed.dart';
import 'characters.dart';
import 'games.dart';
import 'listen_together.dart';
import 'listen_rooms.dart';
import 'music.dart';
import 'music_home.dart';
import 'music_pages.dart';
import 'offline_music.dart';
import 'party.dart';
import 'people.dart';
import 'photos.dart';
import 'parity.dart';
import 'play_extras.dart';
import 'links_data.dart';
import 'prefs.dart';
import 'start.dart';
import 'playing.dart';
import 'push.dart';
import 'season.dart';
import 'teammates.dart';
import 'tournaments.dart';
import 'servers.dart';
import 'settings.dart';
import 'shell.dart';
import 'state.dart';
import 'phone.dart';
import 'theme.dart';
import 'track_edit.dart';
import 'watch_party.dart';
import 'support.dart';
import 'theme_controller.dart';
import 'widgets.dart';
import 'wrapped.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  final prefs = await SharedPreferences.getInstance();
  // Тема до першого кадру (збережена на телефоні); з акаунта — після входу (Session).
  ThemeController.instance.init(prefs);
  // Словник мови — до першого кадру (збережений на телефоні), свіжий — із сервера у фоні.
  await I18n.restore(prefs);
  final session = Session(prefs);
  final player = TrackPlayer()..session = session;
  // Музика на телефоні: плеєр бере файл, якщо трек завантажено; вихід з акаунта все стирає.
  final downloads = Downloads(session: session)..watchNetwork();
  Downloads.instance = downloads;
  TrackPlayer.localFile = downloads.fileFor;
  session.logoutHooks.add(downloads.clearAll);
  try {
    await downloads.load();
  } catch (_) {}
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
  unawaited(downloads.syncFavorites());
  // GameCon Connect: що грає на сайті й інших пристроях, керування й передача музики.
  GameConnect.instance = GameConnect(session, player)..start();
  // Віджет «Моя сім'я»: фонове оновлення й свіжі дані при кожному запуску.
  await HomeWidget.registerInteractivityCallback(familyWidgetBackground);
  unawaited(FamilyWidget.refresh(session.token == null ? null : session.api, prefs).then((_) => null, onError: (_) => null));
  // Віджет «Пульс GameCon»: непрочитане, друзі онлайн, завдання дня.
  unawaited(PulseWidget.refresh(session.token == null ? null : session.api).then((_) => null, onError: (_) => null));
  final links = AppLinks();
  links.uriLinkStream.listen(session.takeLink);
  final initial = await links.getInitialLink();
  if (initial != null) session.takeLink(initial);

  final router = GoRouter(
    refreshListenable: session,
    // Без інтернету, але з завантаженою музикою — одразу в розділ музики.
    initialLocation: session.token == null ? '/login' : (!Api.online.value && !downloads.isEmpty ? '/music' : '/feed'),
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
      // «Підсумки року» — на весь екран, без шапки й нижнього меню.
      GoRoute(path: '/wrapped', builder: (_, _) => const WrappedScreen()),
      // Вхід на сайт через застосунок — на весь екран: запит і сканер QR.
      GoRoute(path: '/app-login/:id', builder: (_, state) => AppLoginScreen(key: ValueKey(state.pathParameters['id']), api: session.api, id: state.pathParameters['id']!)),
      GoRoute(path: '/scan-login', builder: (_, _) => const AppLoginScanScreen()),
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
          GoRoute(path: '/u/:username/card', builder: (_, state) => GameCardScreen(username: state.pathParameters['username']!)),
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
                  GoRoute(path: 'channels', builder: (_, state) => CommunityChannelsScreen(slug: state.pathParameters['slug']!)),
                  GoRoute(path: 'calendar', builder: (_, state) => CommunityCalendarScreen(slug: state.pathParameters['slug']!)),
                  GoRoute(path: 'wiki', builder: (_, state) => CommunityWikiScreen(slug: state.pathParameters['slug']!), routes: [
                    GoRoute(path: ':page', builder: (_, state) => CommunityWikiScreen(key: ValueKey(state.pathParameters['page']), slug: state.pathParameters['slug']!, page: state.pathParameters['page'])),
                  ]),
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
            builder: (_, state) {
              // Аудіозаписи іншого користувача — старий екран; свій розділ — у стилі Apple Music.
              final user = state.uri.queryParameters['user'];
              if (user != null) return MusicScreen(key: ValueKey(user), username: user);
              final tab = MusicHub.tabFor(state.uri.queryParameters['tab']);
              return MusicHub(key: ValueKey('music-$tab'), tab: tab);
            },
            routes: [
              GoRoute(path: 'playlists/:id', builder: (_, state) => PlaylistScreen(id: int.tryParse(state.pathParameters['id']!) ?? 0)),
              GoRoute(
                path: 'downloads',
                builder: (_, _) => const DownloadsScreen(),
                routes: [GoRoute(path: 'collection', builder: (_, state) => DownloadedCollectionScreen(key: ValueKey(state.uri.toString()), collectionKey: state.uri.queryParameters['key'] ?? ''))],
              ),
              GoRoute(path: 'new', builder: (_, _) => const MusicHub(key: ValueKey('music-new'), tab: 'new')),
              GoRoute(path: 'radio', builder: (_, _) => const MusicHub(key: ValueKey('music-radio'), tab: 'radio')),
              GoRoute(
                path: 'library',
                builder: (_, _) => const MusicHub(key: ValueKey('music-library'), tab: 'library'),
                routes: [GoRoute(path: ':section', builder: (_, state) => LibrarySectionScreen(key: ValueKey(state.uri.toString()), section: state.pathParameters['section']!))],
              ),
              GoRoute(path: 'search', builder: (_, state) => MusicSearchScreen(initial: state.uri.queryParameters['q'] ?? '')),
              GoRoute(path: 'artist', builder: (_, state) => ArtistScreen(key: ValueKey(state.uri.toString()), name: state.uri.queryParameters['name'] ?? '')),
              GoRoute(
                path: 'album',
                builder: (_, state) => MusicAlbumScreen(key: ValueKey(state.uri.toString()), artist: state.uri.queryParameters['artist'] ?? '', title: state.uri.queryParameters['title'] ?? ''),
              ),
              GoRoute(path: 'mix/:key', builder: (_, state) => MixScreen(key: ValueKey(state.uri.toString()), mixKey: state.pathParameters['key']!)),
              GoRoute(path: 'genre', builder: (_, state) => GenreScreen(key: ValueKey(state.uri.toString()), name: state.uri.queryParameters['name'] ?? '')),
              GoRoute(path: 'charts', builder: (_, _) => const ChartsScreen()),
              GoRoute(path: 'rooms', builder: (_, _) => const ListenRoomsScreen()),
              GoRoute(
                path: 'replay',
                builder: (_, _) => const ReplayScreen(),
                routes: [GoRoute(path: ':year', builder: (_, state) => ReplayScreen(key: ValueKey(state.uri.toString()), year: int.tryParse(state.pathParameters['year']!)))],
              ),
            ],
          ),
          GoRoute(
            path: '/cinema',
            builder: (_, _) => const CinemaScreen(),
            routes: [
              GoRoute(path: 'my', builder: (_, state) => MyCinemaScreen(status: state.uri.queryParameters['status'] ?? 'all')),
              GoRoute(path: 'ten/:username', builder: (_, state) => TopTenScreen(key: ValueKey(state.pathParameters['username']), username: state.pathParameters['username']!)),
              GoRoute(path: ':slug', builder: (_, state) => MovieScreen(key: ValueKey(state.pathParameters['slug']), slug: state.pathParameters['slug']!)),
            ],
          ),
          GoRoute(path: '/events', builder: (_, _) => const EventsScreen(), routes: [GoRoute(path: 'releases', builder: (_, _) => const ReleasesScreen())]),
          GoRoute(path: '/moments', builder: (_, _) => const MomentsScreen()),
          GoRoute(path: '/phone', builder: (_, state) => PhoneScreen(key: ValueKey(state.uri.queryParameters['dial']), dial: state.uri.queryParameters['dial'])),
          GoRoute(path: '/quests', builder: (_, _) => const QuestsScreen()),
          GoRoute(path: '/season', builder: (_, _) => const SeasonScreen()),
          GoRoute(path: '/tournaments', builder: (_, _) => const TournamentsScreen()),
          GoRoute(path: '/tournaments/:id', builder: (_, state) => TournamentScreen(id: int.tryParse(state.pathParameters['id']!) ?? 0)),
          GoRoute(path: '/saved', builder: (_, _) => const SavedScreen()),
          GoRoute(path: '/later', builder: (_, _) => const ReadLaterScreen()),
          GoRoute(path: '/podcasts', builder: (_, _) => const PodcastsScreen()),
          GoRoute(path: '/ideas', builder: (_, _) => const IdeasScreen()),
          GoRoute(path: '/duels', builder: (_, state) => DuelsScreen(to: state.uri.queryParameters['to'])),
          GoRoute(path: '/tierlists', builder: (_, _) => const TierListsScreen()),
          GoRoute(path: '/tierlists/new', builder: (_, _) => const TierListCreateScreen()),
          GoRoute(path: '/tierlists/:id/edit', builder: (_, state) => TierListCreateScreen(key: ValueKey('edit-${state.pathParameters['id']}'), id: int.tryParse(state.pathParameters['id']!))),
          GoRoute(path: '/settings/connections', builder: (_, _) => const ConnectionsScreen()),
          GoRoute(path: '/settings/profile-look', builder: (_, _) => const ProfileLookScreen()),
          GoRoute(path: '/settings/notifications', builder: (_, _) => const NotifyPrefsScreen()),
          GoRoute(path: '/start', builder: (_, _) => const StartScreen()),
          GoRoute(path: '/t/:tag', builder: (_, state) => TopicScreen(key: ValueKey(state.pathParameters['tag']), tag: state.pathParameters['tag']!)),
          GoRoute(path: '/articles', builder: (_, _) => const ArticlesScreen()),
          GoRoute(path: '/articles/new', builder: (_, _) => const ArticleEditScreen()),
          GoRoute(path: '/articles/:slug', builder: (_, state) => ArticleScreen(key: ValueKey(state.pathParameters['slug']), slug: state.pathParameters['slug']!)),
          GoRoute(path: '/articles/:slug/edit', builder: (_, state) => ArticleEditScreen(key: ValueKey('edit-${state.pathParameters['slug']}'), slug: state.pathParameters['slug'])),
          GoRoute(path: '/tools/nicknames', builder: (_, _) => const NicknamesScreen()),
          GoRoute(path: '/memes/new', builder: (_, _) => const MemeScreen()),
          GoRoute(path: '/settings/links', builder: (_, _) => const BioLinksScreen()),
          GoRoute(path: '/settings/account-type', builder: (_, _) => const AccountTypeScreen()),
          GoRoute(path: '/settings/pixel-avatar', builder: (_, _) => const PixelAvatarScreen()),
          GoRoute(path: '/tierlists/:id', builder: (_, state) => TierListScreen(key: ValueKey(state.pathParameters['id']), id: int.tryParse(state.pathParameters['id']!) ?? 0)),
          GoRoute(path: '/podcasts/:id', builder: (_, state) => PodcastScreen(key: ValueKey(state.pathParameters['id']), id: int.tryParse(state.pathParameters['id']!) ?? 0)),
          GoRoute(path: '/keyword-alerts', builder: (_, _) => const KeywordAlertsScreen()),
          GoRoute(path: '/help', builder: (_, _) => const HelpScreen()),
          GoRoute(path: '/help/:category', builder: (_, state) => HelpCategoryScreen(key: ValueKey(state.pathParameters['category']), slug: state.pathParameters['category']!)),
          GoRoute(path: '/help/:category/:article', builder: (_, state) => HelpArticleScreen(key: ValueKey(state.uri.path), category: state.pathParameters['category']!, slug: state.pathParameters['article']!)),
          GoRoute(path: '/support', builder: (_, _) => const SupportScreen()),
          GoRoute(path: '/support/:id', builder: (_, state) => SupportTicketScreen(key: ValueKey(state.pathParameters['id']), id: int.tryParse(state.pathParameters['id']!) ?? 0)),
          GoRoute(path: '/drafts', builder: (_, _) => const DraftsScreen()),
          GoRoute(path: '/starred', builder: (_, _) => const SavedMessagesScreen()),
          GoRoute(path: '/invite', builder: (_, _) => const InviteScreen()),
          GoRoute(path: '/join/:token', builder: (_, state) => JoinInviteScreen(key: ValueKey(state.pathParameters['token']), token: state.pathParameters['token']!)),
          GoRoute(path: '/playing', builder: (_, _) => const PlayingSettingsScreen()),
          GoRoute(path: '/listen/:code', builder: (_, state) => ListenScreen(key: ValueKey(state.pathParameters['code']), code: state.pathParameters['code']!)),
          GoRoute(path: '/watch/:code', builder: (_, state) => WatchPartyScreen(key: ValueKey(state.pathParameters['code']), code: state.pathParameters['code']!)),
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
              GoRoute(path: 'compare', builder: (_, state) => ServerCompareScreen(a: state.uri.queryParameters['a'], b: state.uri.queryParameters['b'])),
              GoRoute(path: ':slug', builder: (_, state) => ServerScreen(slug: state.pathParameters['slug']!)),
            ],
          ),
          GoRoute(path: '/party', builder: (_, _) => const PartyBoardScreen()),
          GoRoute(path: '/party/match', builder: (_, _) => const TeammatesScreen()),
          GoRoute(path: '/party/:id', builder: (_, state) => PartyScreen(key: ValueKey(state.pathParameters['id']), id: state.pathParameters['id']!)),
          GoRoute(path: '/characters/create', builder: (_, state) => CharacterEditScreen(server: state.uri.queryParameters['server'])),
          GoRoute(path: '/characters/:id', builder: (_, state) => CharacterScreen(key: ValueKey(state.pathParameters['id']), id: state.pathParameters['id']!)),
          GoRoute(path: '/characters/:id/edit', builder: (_, state) => CharacterEditScreen(id: state.pathParameters['id'])),
          GoRoute(
            path: '/games',
            builder: (_, _) => const GamesScreen(),
            routes: [
              // Перед :slug — щоб «deals» і «backlog» не сприймались як гра.
              GoRoute(path: 'deals', builder: (_, _) => const DealsScreen()),
              GoRoute(path: 'backlog', builder: (_, _) => const BacklogScreen(), routes: [
                GoRoute(path: ':username', builder: (_, state) => BacklogScreen(key: ValueKey(state.pathParameters['username']), username: state.pathParameters['username'])),
              ]),
              GoRoute(path: ':slug', builder: (_, state) => GameScreen(key: ValueKey(state.pathParameters['slug']), slug: state.pathParameters['slug']!)),
            ],
          ),
          GoRoute(
            path: '/clans',
            builder: (_, state) => ClansScreen(game: state.uri.queryParameters['game']),
            routes: [
              GoRoute(path: 'create', builder: (_, state) => ClanCreateScreen(game: state.uri.queryParameters['game'])),
              GoRoute(path: ':slug', builder: (_, state) => ClanScreen(key: ValueKey(state.pathParameters['slug']), slug: state.pathParameters['slug']!)),
            ],
          ),
          GoRoute(path: '/notifications', builder: (_, _) => const NotificationsScreen()),
          GoRoute(path: '/settings', builder: (_, state) => SettingsScreen(initialTab: state.uri.queryParameters['tab'])),
        ],
      ),
    ],
  );

  unawaited(refreshLanguage(session.api));
  // Зміна мови перебудовує весь застосунок.
  runApp(ValueListenableBuilder<int>(
    valueListenable: I18n.revision,
    builder: (_, revision, _) => KeyedSubtree(key: ValueKey(revision), child: GameConApp(router: router)),
  ));
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
              Text(tr('Сторінку не знайдено'), style: unbounded.copyWith(fontSize: 26)),
              const SizedBox(height: 8),
              Text(tr('Це посилання не веде на розділ GameCon.'), style: TextStyle(color: muted, fontFamily: 'Onest')),
              const SizedBox(height: 20),
              PrimaryButton(label: tr('На головну'), onPressed: onHome),
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
      scrollBehavior: const ArcticScrollBehavior(),
      routerConfig: router,
    );
  }
}
