import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/nav_items.dart';
import 'package:gamecon/settings.dart';
import 'package:gamecon/state.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('чистить список розділів панелі', () {
    expect(cleanNav(['/music', '/music', '/nope', '/feed', '/cinema', '/photos', '/families']), ['/music', '/feed', '/cinema', '/photos']);
  });

  test('підсвічує потрібний розділ або «Меню»', () {
    const tabs = ['/music', '/profile', '/messages'];
    expect(navIndexFor(tabs, '/music/playlists/3'), 0);
    expect(navIndexFor(tabs, '/u/tonny', username: 'tonny'), 1);
    expect(navIndexFor(tabs, '/messages/12'), 2);
    expect(navIndexFor(tabs, '/musician'), isNull);
    expect(navIndexFor(tabs, '/feed'), isNull);
  });

  test('вибір зберігається окремо для кожного акаунта', () async {
    SharedPreferences.setMockInitialValues({});
    final session = Session(await SharedPreferences.getInstance())..me = {'id': 7};
    expect(session.navTabs, defaultNav);
    await session.setNavTabs(['/music', '/cinema']);
    expect(session.navTabs, ['/music', '/cinema']);
    session.me = {'id': 8};
    expect(session.navTabs, defaultNav);
    session.me = {'id': 7};
    await session.setNavTabs(defaultNav);
    expect(session.prefs.getStringList('nav.tabs.7'), isNull);
  });

  testWidgets('прибраний розділ переходить у меню, доданий — у панель', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final session = Session(await SharedPreferences.getInstance())..me = {'id': 1};
    await tester.pumpWidget(MaterialApp(
      home: AppScope(
        session: session,
        player: TrackPlayer(),
        child: const Scaffold(body: SingleChildScrollView(child: NavEditor())),
      ),
    ));

    await tester.tap(find.byTooltip('Прибрати в меню').at(1));
    await tester.pumpAndSettle();
    expect(session.navTabs, ['/profile', '/messages', '/friends']);
    expect(find.widgetWithText(GestureDetector, 'Новини'), findsWidgets);

    await tester.tap(find.text('Музика'));
    await tester.pumpAndSettle();
    expect(session.navTabs, ['/profile', '/messages', '/friends', '/music']);
  });
}
