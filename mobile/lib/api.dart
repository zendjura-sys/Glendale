import 'dart:convert';

import 'package:http/http.dart' as http;

class ApiException implements Exception {
  ApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

class Listing {
  Listing(this.items, this.current, this.last, [this.total = 0]);
  final List<Map<String, dynamic>> items;
  final int current;
  final int last;
  final int total;
  bool get more => current < last;

  static Listing parse(dynamic block) {
    if (block is! Map) return Listing(const [], 1, 1);
    final raw = block['data'];
    final items = raw is List
        ? raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
        : <Map<String, dynamic>>[];
    return Listing(items, _int(block['current_page'], 1), _int(block['last_page'], 1), _int(block['total'], items.length));
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

String hryvnia(dynamic minor) {
  final value = minor is int ? minor : int.tryParse('$minor') ?? 0;
  final negative = value < 0;
  final abs = value.abs();
  final whole = abs ~/ 100;
  final cents = abs % 100;
  final digits = whole.toString();
  final grouped = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) grouped.write(' ');
    grouped.write(digits[i]);
  }
  final tail = cents == 0 ? '' : ',${cents.toString().padLeft(2, '0')}';
  return '${negative ? '−' : ''}$grouped$tail ₴';
}

/// Коротка сума для вузьких плиток: 99 999 ₴, 100к ₴, 1,5М ₴, 10М ₴, 2,3млрд ₴.
String hryvniaShort(dynamic minor) {
  final value = minor is int ? minor : int.tryParse('$minor') ?? 0;
  final whole = value.abs() ~/ 100;
  if (whole < 100000) return hryvnia(value - value % 100);
  final (unit, suffix) = whole >= 1000000000 ? (1000000000, 'млрд') : (whole >= 1000000 ? (1000000, 'М') : (1000, 'к'));
  final scaled = whole / unit;
  final digits = scaled < 10 ? ((scaled * 10).floor() / 10).toString().replaceFirst(RegExp(r'\.0$'), '').replaceAll('.', ',') : '${scaled.floor()}';
  return '${value < 0 ? '−' : ''}$digits$suffix ₴';
}

String joinedLabel(dynamic iso) {
  final dt = DateTime.tryParse(text(iso) ?? '');
  if (dt == null) return '';
  const months = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  return 'В GameCon з ${dt.day} ${months[dt.month - 1]} ${dt.year} р.';
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
  Future<Map<String, dynamic>> delete(String path, [Map<String, dynamic>? body]) => _send('DELETE', path, body);

  /// Дії сайту через міст `/api/v1/site/...` (ті самі шляхи, що в routes/web.php).
  static String site(String path) => '/api/v1/site${path.startsWith('/') ? path : '/$path'}';

  /// Multipart-запит. Для PATCH/PUT Laravel приймає `_method` у формі.
  Future<Map<String, dynamic>> upload(String path, Map<String, String> fields, List<http.MultipartFile> files, {String method = 'POST'}) async {
    final request = http.MultipartRequest('POST', Uri.parse('$root$path'));
    if (method != 'POST') request.fields['_method'] = method;
    request.headers['Accept'] = 'application/json';
    request.headers['User-Agent'] = 'GameCon/1.0 (Flutter)';
    final bearer = token();
    if (bearer != null) request.headers['Authorization'] = 'Bearer $bearer';
    request.fields.addAll(fields);
    request.files.addAll(files);
    late http.Response response;
    try {
      final streamed = await request.send().timeout(const Duration(seconds: 180));
      response = await http.Response.fromStream(streamed);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Немає зв’язку з GameCon.');
    }
    if (response.statusCode >= 400) throw ApiException(_explain(response.body));
    if (response.body.isEmpty) return {};
    final decoded = jsonDecode(response.body);
    if (decoded is Map<String, dynamic>) return decoded;
    if (decoded is Map) return Map<String, dynamic>.from(decoded);
    return {};
  }

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
        'DELETE' => http.delete(uri, headers: headers, body: encoded),
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
          if (first is String) return first;
        }
        final message = text(json['message']);
        if (message != null) return message;
      }
    } catch (_) {}
    return 'Щось пішло не так.';
  }

  /// Завантаження файлу з авторизацією (докази звітів, вкладення чату).
  Future<List<int>> bytes(String path) async {
    final response = await http.get(Uri.parse(path.startsWith('http') ? path : '$root$path'), headers: {
      'User-Agent': 'GameCon/1.0 (Flutter)',
      if (token() != null) 'Authorization': 'Bearer ${token()}',
    });
    if (response.statusCode >= 400) throw ApiException('Файл недоступний.');
    return response.bodyBytes;
  }
}
