import 'dart:convert';

import 'package:http/http.dart' as http;

class ApiException implements Exception {
  ApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

class Listing {
  Listing(this.items, this.current, this.last);
  final List<Map<String, dynamic>> items;
  final int current;
  final int last;
  bool get more => current < last;

  static Listing parse(dynamic block) {
    if (block is! Map) return Listing(const [], 1, 1);
    final raw = block['data'];
    final items = raw is List
        ? raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
        : <Map<String, dynamic>>[];
    return Listing(items, _int(block['current_page'], 1), _int(block['last_page'], 1));
  }
}

int _int(dynamic value, int fallback) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse('$value') ?? fallback;
}

List<Map<String, dynamic>> maps(dynamic value) {
  if (value is! List) return const [];
  return value.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
}

String? text(dynamic value) {
  if (value == null) return null;
  final s = '$value'.trim();
  if (s.isEmpty || s == 'null') return null;
  return s;
}

String? absolute(dynamic value) {
  final s = text(value);
  if (s == null) return null;
  if (s.startsWith('//')) return 'https:$s';
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('/')) return 'https://gamecon.online$s';
  return s;
}

class Api {
  Api(this.token);
  final String? Function() token;

  static const root = 'https://gamecon.online';

  Future<Map<String, dynamic>> get(String path) => _send('GET', path);
  Future<Map<String, dynamic>> post(String path, [Map<String, dynamic>? body]) => _send('POST', path, body);
  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) => _send('PUT', path, body);
  Future<Map<String, dynamic>> patch(String path, Map<String, dynamic> body) => _send('PATCH', path, body);
  Future<Map<String, dynamic>> delete(String path) => _send('DELETE', path);

  Future<Map<String, dynamic>> me() async {
    final json = await get('/api/v1/me');
    final user = json['user'];
    if (user is! Map) throw ApiException('Профіль не повернувся.');
    return Map<String, dynamic>.from(user);
  }

  Future<Map<String, dynamic>> _send(String method, String path, [Map<String, dynamic>? body]) async {
    final uri = Uri.parse('$root$path');
    final headers = {
      'Accept': 'application/json',
      'User-Agent': 'GameCon/1.0 (Flutter)',
      if (body != null) 'Content-Type': 'application/json',
      if (token() != null) 'Authorization': 'Bearer ${token()}',
    };
    final encoded = body == null ? null : jsonEncode(body);
    late http.Response response;
    try {
      response = await switch (method) {
        'GET' => http.get(uri, headers: headers),
        'POST' => http.post(uri, headers: headers, body: encoded ?? '{}'),
        'PUT' => http.put(uri, headers: headers, body: encoded),
        'PATCH' => http.patch(uri, headers: headers, body: encoded),
        'DELETE' => http.delete(uri, headers: headers),
        _ => throw ApiException('Невідомий метод.'),
      }.timeout(const Duration(seconds: 40));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Немає зв’язку з GameCon.');
    }
    if (response.statusCode >= 400) {
      throw ApiException(_explain(response.body));
    }
    if (response.body.isEmpty) return {};
    final decoded = jsonDecode(response.body);
    if (decoded is Map<String, dynamic>) return decoded;
    if (decoded is Map) return Map<String, dynamic>.from(decoded);
    return {};
  }

  String _explain(String raw) {
    try {
      final json = jsonDecode(raw);
      if (json is Map) {
        final errors = json['errors'];
        if (errors is Map && errors.isNotEmpty) {
          final first = errors.values.first;
          if (first is List && first.isNotEmpty) return '${first.first}';
        }
        final message = text(json['message']);
        if (message != null) return message;
      }
    } catch (_) {}
    return 'Щось пішло не так.';
  }
}
