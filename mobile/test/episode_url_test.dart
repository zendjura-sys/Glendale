import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/cinema.dart';

void main() {
  test('Kodik: серія без власних перемикачів плеєра', () {
    final url = Uri.parse(episodeUrl('kodik', 'https://kodik.info/serial/1/hash/720p?translations=true', (season: 2, episode: 5), bare: true));
    expect(url.queryParameters, {
      'translations': 'false',
      'hide_selectors': 'true',
      'season': '2',
      'episode': '5',
      'only_season': 'true',
      'only_episode': 'true',
    });
  });

  test('Kodik без обраної серії серіалу лишає перемикачі', () {
    expect(episodeUrl('kodik', 'https://kodik.info/serial/1/hash/720p', null, bare: false), 'https://kodik.info/serial/1/hash/720p');
  });

  test('Videoseed: одна серія з обраною озвучкою', () {
    final url = Uri.parse(episodeUrl('videoseed', 'https://tv-1-kinoserial.net/embed_serial/23/?token=t&default_audio_id=10', (season: 1, episode: 3), bare: true));
    expect(url.queryParameters['default_audio_id'], '10');
    expect(url.queryParameters['video'], 's1v3');
    expect(url.queryParameters['only'], 'true');
    expect(url.queryParameters.containsKey('hide_selectors'), isFalse);
  });
}
