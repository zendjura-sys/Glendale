// «Увійти через GameCon» для Flutter: Android, iOS, macOS, Windows, Linux, Web.
// Пакети: flutter_web_auth_2, http, crypto. Публічний клієнт: PKCE (S256), без секрету.
import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:http/http.dart' as http;

class GameConProfile {
  GameConProfile(this.raw);
  final Map<String, dynamic> raw;
  String get id => '${raw['sub']}';
  String get username => '${raw['preferred_username']}';
  String? get name => raw['name'] as String?;
  String? get email => raw['email'] as String?;
  String? get avatar => raw['picture'] as String?;
}

class GameConAuth {
  GameConAuth({required this.clientId, required this.redirect, this.base = 'https://gamecon.online'});

  final String clientId;

  /// Мобільні й macOS: своя схема (com.example.game://oauth);
  /// Windows і Linux: http://localhost:43823/callback (зареєструйте точно цю адресу).
  final String redirect;
  final String base;

  static String _b64(List<int> data) => base64Url.encode(data).replaceAll('=', '');
  static String _random(int n) => _b64(List<int>.generate(n, (_) => Random.secure().nextInt(256)));

  Future<GameConProfile> signIn({String scope = 'profile email'}) async {
    final verifier = _random(48);
    final state = _random(24);
    final url = Uri.parse('$base/oauth/authorize').replace(queryParameters: {
      'response_type': 'code',
      'client_id': clientId,
      'redirect_uri': redirect,
      'scope': scope,
      'state': state,
      'code_challenge': _b64(sha256.convert(utf8.encode(verifier)).bytes),
      'code_challenge_method': 'S256',
    });
    final scheme = Uri.parse(redirect).scheme == 'http' ? 'http://localhost:${Uri.parse(redirect).port}' : Uri.parse(redirect).scheme;
    final result = Uri.parse(await FlutterWebAuth2.authenticate(url: url.toString(), callbackUrlScheme: scheme));
    if (result.queryParameters['state'] != state || result.queryParameters['code'] == null) {
      throw Exception(result.queryParameters['error_description'] ?? 'Вхід скасовано');
    }
    final token = jsonDecode((await http.post(Uri.parse('$base/oauth/token'), body: {
      'grant_type': 'authorization_code',
      'code': result.queryParameters['code']!,
      'redirect_uri': redirect,
      'client_id': clientId,
      'code_verifier': verifier,
    })).body) as Map<String, dynamic>;
    final access = token['access_token'] as String?;
    if (access == null) throw Exception(token['error_description'] ?? 'GameCon не видав токен');
    final me = await http.get(Uri.parse('$base/api/developer/v1/userinfo'), headers: {'Authorization': 'Bearer $access'});
    return GameConProfile(jsonDecode(me.body) as Map<String, dynamic>);
  }
}
