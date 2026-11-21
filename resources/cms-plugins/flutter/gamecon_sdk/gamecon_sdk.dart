// GameCon SDK для Flutter-ігор і застосунків (№309): вхід кодом пристрою (RFC 8628) — без браузера
// в грі, гравець підтверджує з телефона; API (друзі онлайн, статус у грі, запрошення, досягнення,
// таблиці лідерів) і готовий оверлей GameConOverlay поверх гри.
// Пакети: http, shared_preferences, url_launcher. Публічний клієнт, без секрету.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'gc_overlay_widget.dart';

class GameConDeviceCode {
  GameConDeviceCode(Map<String, dynamic> j)
      : deviceCode = '${j['device_code']}',
        userCode = '${j['user_code']}',
        verificationUri = '${j['verification_uri']}',
        verificationUriComplete = '${j['verification_uri_complete']}',
        interval = (j['interval'] as num?)?.toInt() ?? 5,
        expiresIn = (j['expires_in'] as num?)?.toInt() ?? 600;
  final String deviceCode, userCode, verificationUri, verificationUriComplete;
  final int interval, expiresIn;
}

class GameConException implements Exception {
  GameConException(this.message);
  final String message;
  @override
  String toString() => message;
}

class GameConSdk extends ChangeNotifier {
  GameConSdk({required this.clientId, this.base = 'https://gamecon.online', this.scope = 'profile friends presence invites achievements'});

  final String clientId;
  final String base;
  final String scope;

  String? _access;
  String? _refresh;
  int _expires = 0;

  bool get signedIn => _refresh != null || _access != null;
  String? get accessToken => _access;

  Future<void> restore() async {
    final p = await SharedPreferences.getInstance();
    _access = p.getString('gamecon.access');
    _refresh = p.getString('gamecon.refresh');
    _expires = p.getInt('gamecon.expires') ?? 0;
    notifyListeners();
  }

  /// Крок 1: код для гравця (покажіть userCode і verificationUri або QR з verificationUriComplete).
  Future<GameConDeviceCode> startDeviceLogin() async =>
      GameConDeviceCode(await _form('/oauth/device', {'client_id': clientId, 'scope': scope}));

  /// Крок 2: чекати підтвердження на gamecon.online/link.
  Future<void> waitForLogin(GameConDeviceCode code) async {
    var interval = code.interval < 5 ? 5 : code.interval;
    final deadline = DateTime.now().add(Duration(seconds: code.expiresIn));
    while (DateTime.now().isBefore(deadline)) {
      await Future<void>.delayed(Duration(seconds: interval));
      final j = await _form('/oauth/token', {
        'grant_type': 'urn:ietf:params:oauth:grant-type:device_code',
        'device_code': code.deviceCode,
        'client_id': clientId,
      });
      final error = j['error'];
      if (error == 'authorization_pending') continue;
      if (error == 'slow_down') {
        interval += 5;
        continue;
      }
      if (error != null) throw GameConException('${j['error_description'] ?? error}');
      await _save(j);
      return;
    }
    throw GameConException('Код прострочено — почніть вхід заново.');
  }

  Future<void> signOut() async {
    _access = _refresh = null;
    _expires = 0;
    final p = await SharedPreferences.getInstance();
    await p.remove('gamecon.access');
    await p.remove('gamecon.refresh');
    await p.remove('gamecon.expires');
    notifyListeners();
  }

  // ——— API (/api/developer/v1) ———
  Future<Map<String, dynamic>> me() async => Map<String, dynamic>.from((await api('GET', '/me'))['data'] as Map);
  Future<List<Map<String, dynamic>>> friendsOnline() async =>
      [for (final f in ((await api('GET', '/friends/online'))['data'] as List? ?? [])) Map<String, dynamic>.from(f as Map)];
  Future<void> setPresence(String status, {String? lobby}) => api('PUT', '/presence', {'status': status, 'lobby': lobby});
  Future<void> invite(String username, String lobby) => api('POST', '/invites', {'username': username, 'lobby': lobby});
  Future<void> unlockAchievement(String key) => api('POST', '/achievements/${Uri.encodeComponent(key)}/unlock');
  Future<void> submitScore(String board, int score) => api('POST', '/leaderboards/${Uri.encodeComponent(board)}/scores', {'score': score});

  /// Будь-який метод API (чат, голос, групи, музика).
  Future<Map<String, dynamic>> api(String method, String path, [Map<String, dynamic>? body]) async {
    await _fresh();
    final req = http.Request(method, Uri.parse('$base/api/developer/v1$path'))
      ..headers.addAll({'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': 'Bearer $_access'});
    if (body != null) req.body = jsonEncode(body..removeWhere((_, v) => v == null));
    final res = await http.Response.fromStream(await req.send());
    if (res.statusCode >= 400) throw GameConException('GameCon відповів ${res.statusCode}');
    return res.body.isEmpty ? {} : Map<String, dynamic>.from(jsonDecode(res.body) as Map);
  }

  /// Повний оверлей GameCon для WebView (webview_flutter) з прозорим фоном.
  String overlayUrl({String modules = 'hud,party,chat,drop'}) =>
      '$base/embed/overlay?client_id=${Uri.encodeComponent(clientId)}&modules=$modules&token=${Uri.encodeComponent(_access ?? '')}';

  Future<void> _fresh() async {
    if (!signedIn) throw GameConException('Спершу увійдіть через GameCon.');
    if (DateTime.now().millisecondsSinceEpoch ~/ 1000 < _expires - 60) return;
    final j = await _form('/oauth/token', {'grant_type': 'refresh_token', 'refresh_token': _refresh ?? '', 'client_id': clientId});
    if (j['error'] != null) {
      await signOut();
      throw GameConException('Сесія завершилась — увійдіть знову.');
    }
    await _save(j);
  }

  Future<void> _save(Map<String, dynamic> j) async {
    _access = '${j['access_token']}';
    _refresh = (j['refresh_token'] as String?) ?? _refresh;
    _expires = DateTime.now().millisecondsSinceEpoch ~/ 1000 + ((j['expires_in'] as num?)?.toInt() ?? 3600);
    final p = await SharedPreferences.getInstance();
    await p.setString('gamecon.access', _access!);
    if (_refresh != null) await p.setString('gamecon.refresh', _refresh!);
    await p.setInt('gamecon.expires', _expires);
    notifyListeners();
  }

  Future<Map<String, dynamic>> _form(String path, Map<String, String> fields) async {
    final res = await http.post(Uri.parse('$base$path'), headers: {'Accept': 'application/json'}, body: fields);
    return Map<String, dynamic>.from(jsonDecode(res.body) as Map);
  }
}

/// Готовий оверлей поверх гри: капсула «друзі онлайн» у куті, натиск — панель зі списком друзів;
/// без входу — кнопка «Увійти через GameCon» з кодом. Кліки поза віджетами проходять у гру.
///
///   Stack(children: [GameView(), GameConOverlay(sdk: sdk, presence: 'В матчі')])
class GameConOverlay extends StatefulWidget {
  const GameConOverlay({required this.sdk, this.presence = 'У грі', this.alignment = Alignment.topRight, super.key});
  final GameConSdk sdk;
  final String presence;
  final Alignment alignment;

  @override
  State<GameConOverlay> createState() => _GameConOverlayState();
}

class _GameConOverlayState extends State<GameConOverlay> {
  List<Map<String, dynamic>> friends = [];
  GameConDeviceCode? code;
  bool open = false;
  Timer? timer;

  @override
  void initState() {
    super.initState();
    widget.sdk.addListener(_refresh);
    timer = Timer.periodic(const Duration(minutes: 1), (_) => _refresh());
    _refresh();
  }

  @override
  void dispose() {
    timer?.cancel();
    widget.sdk.removeListener(_refresh);
    super.dispose();
  }

  Future<void> _refresh() async {
    if (!widget.sdk.signedIn) return;
    try {
      await widget.sdk.setPresence(widget.presence);
      final list = await widget.sdk.friendsOnline();
      if (mounted) setState(() => friends = list);
    } catch (_) {
      // Немає мережі — спробуємо за хвилину.
    }
  }

  Future<void> _signIn() async {
    final next = await widget.sdk.startDeviceLogin();
    setState(() => code = next);
    unawaited(launchUrl(Uri.parse(next.verificationUriComplete), mode: LaunchMode.externalApplication));
    try {
      await widget.sdk.waitForLogin(next);
    } finally {
      if (mounted) setState(() => code = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final online = friends.where((f) => f['online'] == true).length;
    return SafeArea(
      child: Align(
        alignment: widget.alignment,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
            GestureDetector(
              onTap: widget.sdk.signedIn ? () => setState(() => open = !open) : (code == null ? _signIn : null),
              child: GcOverlayHud(items: [
                if (!widget.sdk.signedIn) (Icons.login_rounded, code == null ? 'Увійти через GameCon' : 'Код: ${code!.userCode}')
                else (Icons.people_alt_rounded, 'Друзі онлайн: $online'),
              ]),
            ),
            if (code != null) ...[
              const SizedBox(height: 8),
              GcGlassOverlaySurface(child: Text('Відкрийте ${code!.verificationUri}\nі введіть код ${code!.userCode}', style: const TextStyle(color: Colors.white, fontSize: 13))),
            ],
            if (open && widget.sdk.signedIn) ...[
              const SizedBox(height: 8),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 300, maxHeight: 360),
                child: GcGlassOverlaySurface(
                  child: friends.isEmpty
                      ? const Text('Поки ніхто з друзів не онлайн.', style: TextStyle(color: Colors.white70, fontSize: 13))
                      : ListView(shrinkWrap: true, children: [
                          for (final f in friends)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 4),
                              child: Text(
                                '${f['online'] == true ? '●' : '○'} ${f['name']}${(f['presence'] as Map?)?['status'] != null ? ' — ${(f['presence'] as Map)['status']}' : ''}',
                                style: const TextStyle(color: Colors.white, fontSize: 13),
                              ),
                            ),
                        ]),
                ),
              ),
            ],
          ]),
        ),
      ),
    );
  }
}
