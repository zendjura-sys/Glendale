import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/shell.dart';

// Посилання сайту (сповіщення, пости, листи) відкривають ті самі розділи в застосунку.
void main() {
  test('нові розділи сайту відкриваються в застосунку', () {
    expect(appPathFor('/moments'), '/moments');
    expect(appPathFor('/quests'), '/quests');
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
  });
}
