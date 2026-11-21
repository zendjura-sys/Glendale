// GameCon Connect: id пристрою, heartbeat зі станом, команди з інших пристроїв і міні-плеєр
// «Грає на: …» (API — підмінений MockClient).
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/connect.dart';
import 'package:gamecon/state.dart';
import 'package:gamecon/theme.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Програвач без звуку: записує, що з ним робили.
class _FakePlayer extends TrackPlayer {
  final calls = <String>[];

  @override
  Future<void> toggle({bool forcePlay = false}) async {
    calls.add(forcePlay ? 'play' : 'toggle');
    playing = forcePlay || !playing;
  }

  @override
  Future<void> pause() async {
    calls.add('pause');
    playing = false;
  }

  @override
  Future<void> next({bool auto = false}) async => calls.add('next');

  @override
  Future<void> prev() async => calls.add('prev');

  @override
  Future<void> seek(Duration to) async {
    calls.add('seek:${to.inMilliseconds}');
    position = to;
  }

  @override
  Future<void> setVolume(double value) async {
    calls.add('volume:$value');
    volume = value;
  }

  @override
  Future<void> playList(List<Map<String, dynamic>> tracks, int start, {String? station, bool extend = true, PlayFrom? from}) async {
    calls.add('playList:${tracks[start]['title']}');
    queue = [for (final t in tracks) ?QueueTrack.fromJson(t)];
    index = start;
  }
}

const _track = {'id': 7, 'key': 'local:7', 'source': 'local', 'title': 'Neon Skyline', 'artist': 'Nightdrive Kyiv', 'url': 'https://example.com/7.mp3', 'duration': 200};

Future<(Session, _FakePlayer, GameConnect)> _setup([Map<String, Object> prefs = const {}]) async {
  SharedPreferences.setMockInitialValues({'token': 'test', ...prefs});
  final session = Session(await SharedPreferences.getInstance());
  final player = _FakePlayer()..session = session;
  return (session, player, GameConnect(session, player));
}

void main() {
  testWidgets('id пристрою створюється один раз і зберігається', (tester) async {
    final (session, _, connect) = await _setup();
    expect(connect.deviceId, matches(RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')));
    expect(session.prefs.getString('connect.device_id'), connect.deviceId);
    expect(GameConnect(session, TrackPlayer()).deviceId, connect.deviceId);
    expect(GameConnect.deviceIdFor(session.prefs), connect.deviceId);
  });

  testWidgets('heartbeat надсилає стан, а без треку — без state', (tester) async {
    final bodies = <Map<String, dynamic>>[];
    await http.runWithClient(() async {
      final (_, player, connect) = await _setup({'connect.device_id': 'phone-1'});
      await connect.heartbeat();
      expect(bodies.single.containsKey('state'), isFalse);

      player.queue = [QueueTrack.fromJson(Map<String, dynamic>.from(_track))!];
      player.index = 0;
      player.playing = true;
      player.position = const Duration(seconds: 12);
      await connect.heartbeat();
      final body = bodies.last;
      expect(body['device_id'], 'phone-1');
      expect(body['kind'], 'app');
      expect(body['name'], contains('GameCon'));
      final state = body['state'] as Map;
      expect(state['track']['title'], 'Neon Skyline');
      expect(state['playing'], isTrue);
      expect(state['position'], 12);
      expect(state['repeat'], 'off');
      expect(state['index'], 0);
      expect((state['queue'] as List).single['key'], 'local:7');
      expect(DateTime.tryParse('${state['updated_at']}'), isNotNull);
      expect(connect.devices.map((d) => d.name), ['Firefox · GameCon', 'Телефон · GameCon']);
      expect(connect.devices.first.icon, LucideIcons.monitor);
      connect.dispose();
    }, () => MockClient((request) async {
          expect(request.url.path, '/api/v1/site/music/connect/heartbeat');
          bodies.add(jsonDecode(request.body) as Map<String, dynamic>);
          return http.Response(
            jsonEncode({
              'devices': [
                {'id': 'web-1', 'name': 'Firefox · GameCon', 'kind': 'web', 'is_active': false, 'state': null},
                {'id': 'phone-1', 'name': 'Телефон · GameCon', 'kind': 'app', 'is_active': true, 'state': null},
              ],
              'active_device_id': 'phone-1',
              'commands': [],
            }),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }));
  });

  testWidgets('команди з іншого пристрою: пауза, перемотування, передача сюди', (tester) async {
    await http.runWithClient(() async {
      final (_, player, connect) = await _setup({'connect.device_id': 'phone-1'});
      await connect.heartbeat();
      expect(player.calls, ['toggle', 'seek:42500', 'volume:0.3', 'playList:Neon Skyline', 'seek:61000', 'play']);
      expect(player.current?.title, 'Neon Skyline');
      expect(player.playing, isTrue);
      expect(connect.activeDeviceId, 'phone-1');
      // Той самий id команди вдруге не виконується.
      player.calls.clear();
      await connect.apply({'id': 'c1', 'action': 'toggle'});
      expect(player.calls, isEmpty);
      connect.dispose();
    }, () => MockClient((request) async {
          return http.Response(
            jsonEncode({
              'devices': [],
              'active_device_id': 'web-1',
              'commands': [
                {'id': 'c1', 'action': 'toggle', 'from_device_id': 'web-1'},
                {'id': 'c2', 'action': 'seek', 'value': 42.5, 'from_device_id': 'web-1'},
                {'id': 'c3', 'action': 'volume', 'value': 0.3, 'from_device_id': 'web-1'},
                {
                  'id': 'c4',
                  'action': 'transfer',
                  'value': {'track': _track, 'position': 61, 'playing': true},
                  'from_device_id': 'web-1',
                },
              ],
            }),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }));
  });

  testWidgets('міні-плеєр «Грає на: …» керує іншим пристроєм', (tester) async {
    final commands = <Map<String, dynamic>>[];
    await http.runWithClient(() async {
      final (_, player, connect) = await _setup({'connect.device_id': 'phone-1'});
      await connect.heartbeat();
      final remote = connect.remote;
      expect(remote?.id, 'web-1');
      // Тут теж заграло — дистанційний плеєр ховається.
      player.queue = [QueueTrack.fromJson(Map<String, dynamic>.from(_track))!];
      player.index = 0;
      player.playing = true;
      expect(connect.remote, isNull);
      player.playing = false;

      await tester.pumpWidget(MaterialApp(
        theme: gameConTheme(),
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: ListenableBuilder(listenable: connect, builder: (_, _) => connect.remote == null ? const SizedBox() : RemoteMiniPlayer(connect: connect, device: connect.remote!)),
          ),
        ),
      ));
      expect(find.text('Грає на: Firefox · GameCon'), findsOneWidget);
      expect(find.text('Neon Skyline'), findsOneWidget);

      await tester.tap(find.byIcon(LucideIcons.pause));
      await tester.pump();
      expect(commands.single, {'target_device_id': 'web-1', 'device_id': 'phone-1', 'action': 'toggle'});
      // Стан оновився одразу: тепер кнопка «Відтворити».
      expect(find.byIcon(LucideIcons.play), findsOneWidget);

      await tester.tap(find.byIcon(LucideIcons.skipForward));
      await tester.pump();
      expect(commands.last['action'], 'next');

      // «Грати тут»: transfer на цей телефон, сервер віддає трек із позицією в наступному heartbeat.
      await tester.tap(find.byTooltip('Грати тут'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 10));
      expect(commands.last, {'target_device_id': 'phone-1', 'device_id': 'phone-1', 'action': 'transfer'});
      // Той самий трек уже в черзі — лише перемотати й грати (там стояла пауза, але «Грати тут» — грає).
      expect(player.calls, ['seek:95000', 'play']);
      expect(connect.activeDeviceId, 'phone-1');
      expect(find.byType(RemoteMiniPlayer), findsNothing);
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 1));
      connect.dispose();
    }, () => MockClient((request) async {
          if (request.url.path.endsWith('/command')) {
            commands.add(jsonDecode(request.body) as Map<String, dynamic>);
            return http.Response('', 202);
          }
          return http.Response(
            jsonEncode({
              'devices': [
                {
                  'id': 'web-1',
                  'name': 'Firefox · GameCon',
                  'kind': 'web',
                  'is_active': true,
                  'state': {'track': _track, 'playing': true, 'position': 30, 'duration': 200, 'volume': 0.8, 'shuffle': false, 'repeat': 'off', 'updated_at': DateTime.now().toUtc().toIso8601String()},
                },
              ],
              'active_device_id': 'web-1',
              'commands': [
                if (commands.any((c) => c['action'] == 'transfer'))
                  {
                    'id': 't1',
                    'action': 'transfer',
                    'value': {'track': _track, 'queue': [_track], 'index': 0, 'position': 95, 'playing': false},
                    'from_device_id': 'phone-1',
                  },
              ],
            }),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }));
  });

  testWidgets('передача з телефона на сайт: свіжий стан, transfer без value, тут — пауза', (tester) async {
    final requests = <(String, Map<String, dynamic>)>[];
    await http.runWithClient(() async {
      final (_, player, connect) = await _setup({'connect.device_id': 'phone-1'});
      player.queue = [QueueTrack.fromJson(Map<String, dynamic>.from(_track))!];
      player.index = 0;
      player.playing = true;
      await connect.heartbeat();
      requests.clear();
      await connect.transferTo('web-1');
      await tester.pump(const Duration(milliseconds: 10));
      expect(requests.map((r) => r.$1.split('/').last), ['heartbeat', 'command', 'heartbeat']);
      expect(requests[1].$2, {'target_device_id': 'web-1', 'device_id': 'phone-1', 'action': 'transfer'});
      expect(player.calls, ['pause']);
      expect(connect.activeDeviceId, 'web-1');
      connect.dispose();
    }, () => MockClient((request) async {
          requests.add((request.url.path, jsonDecode(request.body) as Map<String, dynamic>));
          if (request.url.path.endsWith('/command')) return http.Response('{"ok":true}', 202);
          return http.Response(
            jsonEncode({
              'devices': [
                {'id': 'web-1', 'name': 'Chrome · GameCon', 'kind': 'web', 'is_active': false, 'state': null},
                {'id': 'phone-1', 'name': 'Телефон · GameCon', 'kind': 'app', 'is_active': true, 'state': null},
              ],
              'active_device_id': requests.any((r) => r.$1.endsWith('/command')) ? 'web-1' : 'phone-1',
              'commands': [],
            }),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }));
  });
}
