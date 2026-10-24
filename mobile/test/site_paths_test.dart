import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/shell.dart';

// Посилання сайту (сповіщення, пости, листи) відкривають ті самі розділи в застосунку.
void main() {
  test('нові розділи сайту відкриваються в застосунку', () {
    expect(appPathFor('/moments'), '/moments');
    expect(appPathFor('/quests'), '/quests');
    expect(appPathFor('/tonny/card'), '/u/tonny/card');
    expect(appPathFor('/tournaments/7'), '/tournaments/7');
    expect(appPathFor('/party/match'), '/party/match');
    expect(appPathFor('/saved'), '/saved');
    expect(appPathFor('/invite'), '/invite');
    expect(appPathFor('/join/abc123'), '/join/abc123');
    expect(appPathFor('/posts/drafts'), '/drafts');
    expect(appPathFor('/posts/42'), '/posts/42');
    expect(appPathFor('/messages/saved'), '/starred');
    expect(appPathFor('/messages/7'), '/messages/7');
    expect(appPathFor('/events/releases'), '/events/releases');
    expect(appPathFor('/cinema/ten/neo'), '/cinema/ten/neo');
    expect(appPathFor('/servers/compare?a=one&b=two'), '/servers/compare?a=one&b=two');
    expect(appPathFor('/phone'), '/phone');
    expect(appPathFor('/phone?dial=%2B7770512345'), '/phone?dial=%2B7770512345');
  });

  test('розділ «Музика» в стилі Apple Music', () {
    expect(appPathFor('/music'), '/music');
    expect(appPathFor('/music/new'), '/music/new');
    expect(appPathFor('/music/radio'), '/music/radio');
    expect(appPathFor('/music/library/songs'), '/music/library/songs');
    expect(appPathFor('/music/search?q=neon'), '/music/search?q=neon');
    expect(appPathFor('/music/artist?name=Nightdrive%20Kyiv'), '/music/artist?name=Nightdrive%20Kyiv');
    expect(appPathFor('/music/album?artist=A&title=B'), '/music/album?artist=A&title=B');
    expect(appPathFor('/music/mix/favorites'), '/music/mix/favorites');
    expect(appPathFor('/music/charts'), '/music/charts');
    expect(appPathFor('/music/replay/2025'), '/music/replay/2025');
    expect(appPathFor('/music/playlists/7'), '/music/playlists/7');
    expect(appPathFor('/music/u/neo'), '/music?user=neo');
    expect(appPathFor('/music?tab=mine'), '/music/library/songs');
  });
}
