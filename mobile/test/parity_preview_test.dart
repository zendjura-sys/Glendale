// Розділи, яких бракувало застосунку (статті, знижки, беклог, канали/календар/вікі спільноти,
// генератор ніків, посилання, тип акаунта, мем, піксельна аватарка) — з підставленими даними мосту.
// Знімки — лише локально: GC_SHOTS=dir.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/account.dart';
import 'package:gamecon/parity.dart';
import 'package:gamecon/shell.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fonts.dart';

Map<String, dynamic> _user(int id, String name) => {'id': id, 'username': 'u$id', 'name': name, 'first_name': name.split(' ').first};
Map<String, dynamic> _game(String slug, String name) => {'slug': slug, 'name': name, 'category_label': 'ПК', 'cover': null};
const _c = {'slug': 'khab', 'name': 'Кіберхаб'};

Map<String, dynamic> _respond(Uri url) {
  final p = url.path;
  if (p.endsWith('/articles')) {
    return {
      'articles': {
        'data': [
          {'slug': 'gaid', 'title': 'Гайд по смоках на Mirage', 'excerpt': 'Десять гранат, які виграють раунд.', 'reading_minutes': 6, 'is_published': true, 'published_at': '2026-10-28T10:00:00Z', 'game': _game('cs2', 'CS2')},
          {'slug': 'oglyad', 'title': 'Огляд Hollow Knight: Silksong', 'excerpt': 'Чи вартувало чекання.', 'reading_minutes': 9, 'is_published': true, 'published_at': '2026-10-25T10:00:00Z', 'game': null},
        ],
      },
      'drafts': [],
    };
  }
  if (p.contains('/articles/')) {
    return {
      'article': {'title': 'Гайд по смоках на Mirage', 'author': _user(2, 'Олег Коваль'), 'reading_minutes': 6, 'published_at': '2026-10-28T10:00:00Z', 'html': '<p>Смоки вирішують раунди. Ось <strong>десять гранат</strong>, які варто знати.</p><h2>Вихід на A</h2><p>Кидайте з <em>фургона</em> — смок закриває <code>CT</code>.</p><ul><li>Стейрс</li><li>Джангл</li></ul><blockquote>Тренуйтеся на пустому сервері.</blockquote>'},
      'can_edit': true,
      'can_delete': true,
    };
  }
  if (p.endsWith('/games/deals')) {
    return {
      'subscribed': true,
      'giveaways': [
        {'title': 'Control Ultimate Edition', 'store_label': 'Epic Games', 'worth': '\$39.99', 'ends_at': '2026-11-06T15:00:00Z', 'url': 'https://example.com'},
      ],
      'wishlist': [
        {'game': _game('baldurs-gate-3', "Baldur's Gate 3"), 'target_price': 30, 'best': {'salePrice': '35.99', 'normalPrice': '59.99'}},
      ],
    };
  }
  if (p.endsWith('/games/backlog')) {
    return {
      'mine': true,
      'owner': _user(1, 'Тоні Старк'),
      'board': {
        'want': [{'game': _game('silksong', 'Hollow Knight: Silksong')}],
        'playing': [{'game': _game('cs2', 'CS2')}, {'game': _game('dota-2', 'Dota 2')}],
        'done': [{'game': _game('hades-2', 'Hades II')}],
        'dropped': [],
      },
    };
  }
  if (p.endsWith('/channels')) {
    return {
      'community': _c,
      'joined': true,
      'can_manage': true,
      'tree': {
        'uncategorized': [{'id': 1, 'name': 'оголошення', 'type': 'announcement'}],
        'categories': [
          {'name': 'Спілкування', 'channels': [{'id': 2, 'name': 'загальний', 'type': 'text', 'unread': 4}, {'id': 3, 'name': 'мемчики', 'type': 'text', 'topic': 'Тільки ігрові'}]},
          {'name': 'Голос', 'channels': [{'id': 4, 'name': 'Лобі', 'type': 'voice', 'voice': [_user(2, 'Олег'), _user(3, 'Ірина')]}]},
        ],
      },
    };
  }
  if (p.endsWith('/calendar')) {
    return {
      'community': _c,
      'can': {'manage': true, 'member': true},
      'upcoming': [
        {'id': 1, 'title': 'Турнір 2×2 по CS2', 'place': 'Discord', 'starts_at': '2026-11-02T18:00:00Z', 'going': 14, 'my': 'going', 'description': 'Реєстрація до суботи.'},
        {'id': 2, 'title': 'Ігровий вечір Among Us', 'place': 'Голосовий канал «Лобі»', 'starts_at': '2026-11-05T19:00:00Z', 'going': 6, 'my': null},
      ],
    };
  }
  if (p.endsWith('/wiki')) {
    return {'community': _c, 'can_edit': true, 'page': null, 'pages': [{'slug': 'pravila', 'title': 'Правила'}, {'slug': 'novachkam', 'title': 'Новачкам'}, {'slug': 'turniry', 'title': 'Як проходять турніри'}]};
  }
  if (p.endsWith('/settings/links')) {
    return {'url': 'https://gamecon.online/l/tonny', 'links': [{'title': 'Twitch', 'url': 'https://twitch.tv/tonny', 'clicks': 128}, {'title': 'YouTube', 'url': 'https://youtube.com/@tonny', 'clicks': 41}]};
  }
  if (p.endsWith('/settings/account-type')) {
    return {
      'types': [
        {'key': 'personal', 'label': 'Особистий', 'fields': []},
        {'key': 'streamer', 'label': 'Стрімер', 'fields': {'twitch': 'Twitch', 'youtube': 'YouTube'}},
        {'key': 'team', 'label': 'Кіберспортивна команда', 'fields': {'site': 'Сайт команди'}},
      ],
      'current': {'type': 'streamer', 'details': {'twitch': 'twitch.tv/tonny'}},
      'verification': {'verified': false, 'kinds': {'identity': 'Особа'}, 'requirements': [{'label': 'Пошта підтверджена', 'ok': true}, {'label': 'Увімкнено двоетапний вхід', 'ok': false}], 'request': null},
    };
  }
  return {'free': ['NeoRunner', 'GlitchCore']};
}

void main() {
  final out = Platform.environment['GC_SHOTS'];

  setUpAll(() async {
    if (out == null) return;
    await loadTestFonts();
  });

  final screens = <(String, String, String)>[
    ('articles', '/articles', 'Статті'),
    ('article', '/articles/gaid', 'Вихід на A'),
    ('deals', '/games/deals', 'Знижки й роздачі'),
    ('backlog', '/games/backlog', 'Мій беклог'),
    ('channels', '/communities/khab/channels', 'загальний'),
    ('calendar', '/communities/khab/calendar', 'Турнір 2×2 по CS2'),
    ('wiki', '/communities/khab/wiki', 'Правила'),
    ('nicknames', '/tools/nicknames', 'Генератор ніків'),
    ('links', '/settings/links', 'Посилання в профілі'),
    ('account-type', '/settings/account-type', 'Тип акаунта'),
    ('meme', '/memes/new', 'Мем'),
    ('pixel', '/settings/pixel-avatar', 'Піксельна аватарка'),
  ];
  for (final (name, location, expected) in screens) {
    for (final light in [false, true]) {
      if (light && !['articles', 'channels', 'backlog'].contains(name)) continue;
      final label = 'parity-$name-${light ? 'light' : 'dark'}';
      testWidgets('розділ малюється: $label', (tester) async {
        await http.runWithClient(() async {
          SharedPreferences.setMockInitialValues({'whats_new': whatsNewVersion});
          final prefs = await SharedPreferences.getInstance();
          palette = light ? arcticPalette : neonPalette;
          addTearDown(() => palette = neonPalette);
          final session = Session(prefs)..me = {'id': 1, 'name': 'Тоні Старк', 'first_name': 'Тоні', 'username': 'tonny', 'role': 'user'};
          tester.view.physicalSize = const Size(1170, 2532);
          tester.view.devicePixelRatio = 3;
          tester.view.padding = const FakeViewPadding(top: 120, bottom: 60);
          addTearDown(tester.view.reset);
          final router = GoRouter(initialLocation: location, routes: [
            ShellRoute(
              builder: (_, _, child) => AppShell(session: session, player: TrackPlayer()..session = session, child: child),
              routes: [
                GoRoute(path: '/articles', builder: (_, _) => const ArticlesScreen()),
                GoRoute(path: '/articles/:slug', builder: (_, s) => ArticleScreen(slug: s.pathParameters['slug']!)),
                GoRoute(path: '/games/deals', builder: (_, _) => const DealsScreen()),
                GoRoute(path: '/games/backlog', builder: (_, _) => const BacklogScreen()),
                GoRoute(path: '/communities/:slug/channels', builder: (_, s) => CommunityChannelsScreen(slug: s.pathParameters['slug']!)),
                GoRoute(path: '/communities/:slug/calendar', builder: (_, s) => CommunityCalendarScreen(slug: s.pathParameters['slug']!)),
                GoRoute(path: '/communities/:slug/wiki', builder: (_, s) => CommunityWikiScreen(slug: s.pathParameters['slug']!)),
                GoRoute(path: '/tools/nicknames', builder: (_, _) => const NicknamesScreen()),
                GoRoute(path: '/settings/links', builder: (_, _) => const BioLinksScreen()),
                GoRoute(path: '/settings/account-type', builder: (_, _) => const AccountTypeScreen()),
                GoRoute(path: '/memes/new', builder: (_, _) => const MemeScreen()),
                GoRoute(path: '/settings/pixel-avatar', builder: (_, _) => const PixelAvatarScreen()),
              ],
            ),
          ]);
          final key = GlobalKey();
          await tester.pumpWidget(RepaintBoundary(key: key, child: MaterialApp.router(debugShowCheckedModeBanner: false, theme: gameConTheme(), routerConfig: router)));
          for (var i = 0; i < 8; i++) {
            await tester.pump(const Duration(milliseconds: 100));
          }
          if (name == 'nicknames') {
            await tester.tap(find.text('Згенерувати'));
            for (var i = 0; i < 4; i++) {
              await tester.pump(const Duration(milliseconds: 100));
            }
          }
          expect(find.text(expected), findsWidgets);
          if (out != null) {
            await tester.runAsync(() async {
              final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
              final image = await boundary.toImage(pixelRatio: 1);
              final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
              File('$out/$label.png').writeAsBytesSync(bytes!.buffer.asUint8List());
            });
          }
          await tester.pumpWidget(const SizedBox());
        }, () => MockClient((request) async => http.Response(jsonEncode(_respond(request.url)), 200, headers: {'content-type': 'application/json; charset=utf-8'})));
      });
    }
  }
}
