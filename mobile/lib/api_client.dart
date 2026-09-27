import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

/// Помилка API з людяним повідомленням (ValidationException з Laravel
/// приходить як {message, errors} — саме message і показуємо користувачу).
class ApiException implements Exception {
  final int statusCode;
  final String message;
  final Map<String, dynamic>? body;

  ApiException(this.statusCode, this.message, [this.body]);

  @override
  String toString() => message;
}

/// Базова адреса бекенду. У релізі підмінюється через
/// --dart-define=API_BASE_URL=https://gamecon.online (див. GitHub Actions
/// workflow) — за замовчуванням продакшн-домен, щоб debug-збірка теж
/// одразу працювала проти реального сайту.
const _defaultBaseUrl = 'https://gamecon.online';

class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: _defaultBaseUrl,
  );

  final _storage = const FlutterSecureStorage();
  static const _tokenKey = 'auth_token';

  Future<String?> get token => _storage.read(key: _tokenKey);

  Future<void> _saveToken(String token) =>
      _storage.write(key: _tokenKey, value: token);

  Future<void> clearToken() => _storage.delete(key: _tokenKey);

  Uri _uri(String path) => Uri.parse('$baseUrl/api$path');

  Future<Map<String, String>> _headers({bool auth = false}) async {
    final headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    if (auth) {
      final t = await token;
      if (t != null) headers['Authorization'] = 'Bearer $t';
    }
    return headers;
  }

  dynamic _decode(http.Response response) {
    final body = response.body.isEmpty ? {} : jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }
    final message = (body is Map && body['message'] is String)
        ? body['message'] as String
        : 'Помилка сервера (${response.statusCode})';
    throw ApiException(response.statusCode, message,
        body is Map<String, dynamic> ? body : null);
  }

  /// Реєстрація "за себе" — той самий /api/register, що описаний вище.
  /// Тіньовий акаунт (звіт "за друга" до реєстрації) тут не підхоплюється —
  /// бекенд поверне помилку з проханням завершити реєстрацію на сайті.
  Future<Map<String, dynamic>> register({
    required String firstName,
    String? lastName,
    required String email,
    required String password,
    required String passwordConfirmation,
    required String deviceName,
  }) async {
    final response = await http.post(
      _uri('/register'),
      headers: await _headers(),
      body: jsonEncode({
        'first_name': firstName,
        if (lastName != null && lastName.isNotEmpty) 'last_name': lastName,
        'email': email,
        'password': password,
        'password_confirmation': passwordConfirmation,
        'device_name': deviceName,
      }),
    );
    final data = _decode(response) as Map<String, dynamic>;
    if (data['token'] != null) {
      await _saveToken(data['token'] as String);
    }
    return data;
  }

  /// Крок 1 логіну. Якщо на акаунті увімкнено 2FA — повертає
  /// {requiresTwoFactor: true, challengeToken}, інакше одразу токен.
  Future<Map<String, dynamic>> login(
      String email, String password, String deviceName) async {
    final response = await http.post(
      _uri('/login'),
      headers: await _headers(),
      body: jsonEncode(
          {'email': email, 'password': password, 'device_name': deviceName}),
    );
    final data = _decode(response) as Map<String, dynamic>;
    if (data['token'] != null) {
      await _saveToken(data['token'] as String);
    }
    return data;
  }

  Future<Map<String, dynamic>> loginTwoFactor({
    required String challengeToken,
    String? code,
    String? recoveryCode,
    required String deviceName,
  }) async {
    final response = await http.post(
      _uri('/login/two-factor'),
      headers: await _headers(),
      body: jsonEncode({
        'challenge_token': challengeToken,
        if (code != null) 'code': code,
        if (recoveryCode != null) 'recovery_code': recoveryCode,
        'device_name': deviceName,
      }),
    );
    final data = _decode(response) as Map<String, dynamic>;
    await _saveToken(data['token'] as String);
    return data;
  }

  Future<void> registerDeviceToken(String token, {String platform = 'android'}) async {
    final response = await http.post(
      _uri('/device-tokens'),
      headers: await _headers(auth: true),
      body: jsonEncode({'token': token, 'platform': platform}),
    );
    _decode(response);
  }

  Future<void> unregisterDeviceToken(String token) async {
    final response = await http.delete(
      _uri('/device-tokens'),
      headers: await _headers(auth: true),
      body: jsonEncode({'token': token}),
    );
    _decode(response);
  }

  Future<void> forgotPassword(String email) async {
    final response = await http.post(
      _uri('/forgot-password'),
      headers: await _headers(),
      body: jsonEncode({'email': email}),
    );
    _decode(response);
  }

  Future<void> logout() async {
    try {
      final response =
          await http.post(_uri('/logout'), headers: await _headers(auth: true));
      _decode(response);
    } finally {
      await clearToken();
    }
  }

  Future<Map<String, dynamic>> me() async {
    final response =
        await http.get(_uri('/me'), headers: await _headers(auth: true));
    return _decode(response) as Map<String, dynamic>;
  }

  /// Публічний (без токена) конфіг застосунку — режим обслуговування,
  /// примусове оновлення, які вкладки показувати. Читається ДО логіну.
  Future<Map<String, dynamic>> appConfig() async {
    final response =
        await http.get(_uri('/app-config'), headers: await _headers());
    return _decode(response) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> dashboard() async {
    final response =
        await http.get(_uri('/dashboard'), headers: await _headers(auth: true));
    return _decode(response) as Map<String, dynamic>;
  }

  // ---------------- Банк (модуль Bonuses) ----------------

  Future<Map<String, dynamic>> bank() async {
    final response =
        await http.get(_uri('/bank'), headers: await _headers(auth: true));
    return _decode(response) as Map<String, dynamic>;
  }

  Future<List<dynamic>> searchRecipients(String query) async {
    final response = await http.get(
      _uri('/bank/recipients/search').replace(queryParameters: {'q': query}),
      headers: await _headers(auth: true),
    );
    final data = _decode(response) as Map<String, dynamic>;
    return data['members'] as List<dynamic>;
  }

  Future<void> transfer(
      {required int recipientId, required int amount, String? note}) async {
    final response = await http.post(
      _uri('/bank/transfer'),
      headers: await _headers(auth: true),
      body: jsonEncode({
        'recipient_id': recipientId,
        'amount': amount,
        if (note != null && note.isNotEmpty) 'note': note
      }),
    );
    _decode(response);
  }

  Future<void> openDeposit(int amount) async {
    final response = await http.post(
      _uri('/bank/deposits'),
      headers: await _headers(auth: true),
      body: jsonEncode({'amount': amount}),
    );
    _decode(response);
  }

  Future<void> withdrawDeposit(int depositId) async {
    final response = await http.post(
      _uri('/bank/deposits/$depositId/withdraw'),
      headers: await _headers(auth: true),
    );
    _decode(response);
  }

  Future<void> requestCash(int amount) async {
    final response = await http.post(
      _uri('/bank/cash-requests'),
      headers: await _headers(auth: true),
      body: jsonEncode({'amount': amount}),
    );
    _decode(response);
  }

  // ---------------- Прогрес і рейтинг (модуль Progression) ----------------

  Future<Map<String, dynamic>> progress() async {
    final response =
        await http.get(_uri('/progress'), headers: await _headers(auth: true));
    return _decode(response) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> leaderboard({String? category}) async {
    final uri = category != null
        ? _uri('/leaderboard').replace(queryParameters: {'category': category})
        : _uri('/leaderboard');
    final response = await http.get(uri, headers: await _headers(auth: true));
    return _decode(response) as Map<String, dynamic>;
  }

  // ---------------- Звіти (модуль Reports) ----------------

  Future<List<dynamic>> reports() async {
    final response =
        await http.get(_uri('/reports'), headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return data['reports'] as List<dynamic>;
  }

  /// multipart/form-data — те саме подання "за себе", що й на сайті,
  /// просто без "за друга" (v1 застосунку). [fields] містить лише
  /// непорожні значення (порожній 'report_date' на бізварі/контракті
  /// зламав би валідацію 'required_if').
  Future<void> submitReport({
    required Map<String, String> fields,
    List<String> kaptTimes = const [],
    List<XFile> photos = const [],
  }) async {
    final token = await this.token;
    final request = http.MultipartRequest('POST', _uri('/reports'))
      ..headers['Accept'] = 'application/json'
      ..headers['Authorization'] = 'Bearer $token'
      ..fields.addAll(fields);

    for (var i = 0; i < kaptTimes.length; i++) {
      request.fields['kapt_times[$i]'] = kaptTimes[i];
    }
    for (var i = 0; i < photos.length; i++) {
      request.files
          .add(await http.MultipartFile.fromPath('photos[$i]', photos[i].path));
    }

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    _decode(response);
  }

  // ---------------- Telegram (модуль Telegram Bot) ----------------

  Future<Map<String, dynamic>> telegramStatus() async {
    final response = await http.get(_uri('/telegram/status'), headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return data['data'] as Map<String, dynamic>;
  }

  /// Повертає {code, bot_username} — застосунок сам будує
  /// https://t.me/{bot}?start={code} і відкриває його url_launcher'ом.
  Future<Map<String, dynamic>> telegramGenerateCode() async {
    final response = await http.post(_uri('/telegram/generate-code'), headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return data['data'] as Map<String, dynamic>;
  }

  Future<void> telegramUnlink() async {
    final response = await http.post(_uri('/telegram/unlink'), headers: await _headers(auth: true));
    _decode(response);
  }

  // ---------------- Адмінка (лише ядро, без аддонів) ----------------

  Future<List<dynamic>> adminStats() async {
    final response = await http.get(_uri('/admin/stats'), headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return data['stats'] as List<dynamic>;
  }

  Future<List<dynamic>> adminUsers({String query = ''}) async {
    final uri = query.isEmpty
        ? _uri('/admin/users')
        : _uri('/admin/users').replace(queryParameters: {'q': query});
    final response = await http.get(uri, headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return data['users'] as List<dynamic>;
  }

  /// Довідники (ролі + посади) для форми редагування учасника.
  Future<Map<String, dynamic>> adminUserOptions() async {
    final response = await http.get(_uri('/admin/users/options'), headers: await _headers(auth: true));
    return _decode(response) as Map<String, dynamic>;
  }

  Future<void> adminUpdateUser(int id, {required String firstName, String? lastName, required String email}) async {
    final response = await http.put(
      _uri('/admin/users/$id'),
      headers: await _headers(auth: true),
      body: jsonEncode({'first_name': firstName, 'last_name': lastName, 'email': email}),
    );
    _decode(response);
  }

  Future<void> adminUpdateUserRoles(int id, List<String> roles) async {
    final response = await http.put(
      _uri('/admin/users/$id/roles'),
      headers: await _headers(auth: true),
      body: jsonEncode({'roles': roles}),
    );
    _decode(response);
  }

  Future<void> adminUpdateUserPosition(int id, String? positionKey) async {
    final response = await http.put(
      _uri('/admin/users/$id/position'),
      headers: await _headers(auth: true),
      body: jsonEncode({'position_key': positionKey}),
    );
    _decode(response);
  }

  /// Повертає новий тимчасовий пароль — сервер показує його рівно один раз.
  Future<String> adminResetUserPassword(int id) async {
    final response = await http.post(_uri('/admin/users/$id/reset-password'), headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['password'] as String;
  }

  Future<void> adminDeleteUser(int id) async {
    final response = await http.delete(_uri('/admin/users/$id'), headers: await _headers(auth: true));
    _decode(response);
  }

  // ---------------- Адмін-модерація (модулі Reports, Member Center) ----------------

  Future<List<dynamic>> adminPendingReports() async {
    final response = await http.get(_uri('/admin/reports/pending'), headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return data['reports'] as List<dynamic>;
  }

  Future<void> adminApproveReport(int id, {required String grade, String? gradeReason}) async {
    final response = await http.post(
      _uri('/admin/reports/$id/approve'),
      headers: await _headers(auth: true),
      body: jsonEncode({
        'grade': grade,
        if (gradeReason != null && gradeReason.isNotEmpty) 'grade_reason': gradeReason,
      }),
    );
    _decode(response);
  }

  Future<void> adminRejectReport(int id, {String? note}) async {
    final response = await http.post(
      _uri('/admin/reports/$id/reject'),
      headers: await _headers(auth: true),
      body: jsonEncode({if (note != null && note.isNotEmpty) 'note': note}),
    );
    _decode(response);
  }

  /// Чернетка пояснення для відхилення — той самий AI Assistant, що на
  /// сайті. Кидає ApiException(422) з людяним повідомленням, якщо
  /// модуль не встановлено чи вимкнено тумблером — виклик не міняє
  /// нічого в звіті сам по собі.
  Future<String> adminAiRejectionDraft(int id, {String? hint}) async {
    final response = await http.post(
      _uri('/admin/reports/$id/ai-recommendation'),
      headers: await _headers(auth: true),
      body: jsonEncode({if (hint != null && hint.isNotEmpty) 'hint': hint}),
    );
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['text'] as String;
  }

  /// {grade, explanation} — рекомендована оцінка й пояснення чому; сам
  /// адмін клікає потрібний grade-чіп, нічого не змінює автоматично.
  Future<Map<String, dynamic>> adminAiGradeSuggestion(int id) async {
    final response = await http.post(
      _uri('/admin/reports/$id/ai-grade-recommendation'),
      headers: await _headers(auth: true),
    );
    final data = _decode(response) as Map<String, dynamic>;
    return data['data'] as Map<String, dynamic>;
  }

  // ---------------- Адмін-розсилки (модуль Notifications) ----------------

  Future<Map<String, dynamic>> adminBroadcastAudienceOptions() async {
    final response = await http.get(_uri('/admin/broadcasts/audience-options'), headers: await _headers(auth: true));
    return _decode(response) as Map<String, dynamic>;
  }

  Future<List<dynamic>> adminRecentBroadcasts() async {
    final response = await http.get(_uri('/admin/broadcasts/recent'), headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return data['broadcasts'] as List<dynamic>;
  }

  Future<void> adminSendBroadcast({
    required String title,
    required String body,
    bool pinned = false,
    required String audienceType,
    String? audienceValue,
  }) async {
    final response = await http.post(
      _uri('/admin/broadcasts'),
      headers: await _headers(auth: true),
      body: jsonEncode({
        'title': title,
        'body': body,
        'pinned': pinned,
        'audience_type': audienceType,
        if (audienceValue != null) 'audience_value': audienceValue,
      }),
    );
    _decode(response);
  }

  /// Чернетка — AI Assistant стилістично покращує текст, нічого не
  /// публікує сам по собі.
  Future<String> adminPolishBroadcastText(String body) async {
    final response = await http.post(
      _uri('/admin/broadcasts/polish'),
      headers: await _headers(auth: true),
      body: jsonEncode({'body': body}),
    );
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['text'] as String;
  }

  Future<List<dynamic>> adminPendingLeaveRequests() async {
    final response = await http.get(_uri('/admin/leave-requests/pending'), headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return data['leaveRequests'] as List<dynamic>;
  }

  Future<void> adminApproveLeave(int id) async {
    final response = await http.post(_uri('/admin/leave-requests/$id/approve'), headers: await _headers(auth: true));
    _decode(response);
  }

  Future<void> adminRejectLeave(int id) async {
    final response = await http.post(_uri('/admin/leave-requests/$id/reject'), headers: await _headers(auth: true));
    _decode(response);
  }

  // ---------------- Адмінка премій/бонусів (модуль Bonuses) ----------------

  Future<Map<String, dynamic>> adminBonusesOverview() async {
    final response = await http.get(_uri('/admin/bonuses'), headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return data['data'] as Map<String, dynamic>;
  }

  // ---------- Покарання (Кадровий центр) ----------

  /// Власні покарання: {summary, bankAvailable, penalties}.
  Future<Map<String, dynamic>> discipline() async {
    final response = await http.get(_uri('/discipline'), headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return data['data'] as Map<String, dynamic>;
  }

  /// Сплатити штраф з рахунку в банку родини. Повертає повідомлення сервера.
  Future<String> payPenalty(int id) async {
    final response = await http.post(_uri('/discipline/$id/pay'), headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return data['message'] as String? ?? 'Штраф сплачено.';
  }

  /// Адмінка: {penalties, stats, types, rules}. status: open | fines | closed | all.
  Future<Map<String, dynamic>> adminDiscipline({String status = 'open', int? userId}) async {
    final response = await http.get(
      _uri('/admin/discipline').replace(queryParameters: {'status': status, if (userId != null) 'user': '$userId'}),
      headers: await _headers(auth: true),
    );
    final data = _decode(response) as Map<String, dynamic>;
    return data['data'] as Map<String, dynamic>;
  }

  Future<List<dynamic>> adminDisciplineSearchMembers(String query) async {
    final response = await http.get(
      _uri('/admin/discipline/members/search').replace(queryParameters: {'q': query}),
      headers: await _headers(auth: true),
    );
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['members'] as List<dynamic>;
  }

  Future<String> adminIssuePenalty({
    required int userId,
    required String type,
    required String reason,
    String? ruleCode,
    int? amount,
  }) async {
    final response = await http.post(
      _uri('/admin/discipline'),
      headers: await _headers(auth: true),
      body: jsonEncode({
        'user_id': userId,
        'type': type,
        'reason': reason,
        if (ruleCode != null && ruleCode.isNotEmpty) 'rule_code': ruleCode,
        if (amount != null) 'amount': amount,
      }),
    );
    final data = _decode(response) as Map<String, dynamic>;
    return data['message'] as String? ?? 'Покарання видано.';
  }

  Future<void> adminRevokePenalty(int id, String note) async {
    final response = await http.post(
      _uri('/admin/discipline/$id/revoke'),
      headers: await _headers(auth: true),
      body: jsonEncode({'note': note}),
    );
    _decode(response);
  }

  Future<void> adminMarkPenaltyPaid(int id) async {
    final response = await http.post(_uri('/admin/discipline/$id/mark-paid'), headers: await _headers(auth: true));
    _decode(response);
  }

  Future<List<dynamic>> adminBonusesSearchMembers(String query) async {
    final response = await http.get(
      _uri('/admin/bonuses/members/search').replace(queryParameters: {'q': query}),
      headers: await _headers(auth: true),
    );
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['members'] as List<dynamic>;
  }

  Future<void> adminStoreManualAward(int userId, int amount, String? note) async {
    final response = await http.post(
      _uri('/admin/bonuses/manual'),
      headers: await _headers(auth: true),
      body: jsonEncode({'user_id': userId, 'amount': amount, if (note != null && note.isNotEmpty) 'note': note}),
    );
    _decode(response);
  }

  Future<void> adminDeleteManualAward(int id) async {
    final response = await http.delete(_uri('/admin/bonuses/manual/$id'), headers: await _headers(auth: true));
    _decode(response);
  }

  Future<void> adminUpdateBonusSettings(Map<String, dynamic> fields) async {
    final response = await http.put(_uri('/admin/bonuses/settings'), headers: await _headers(auth: true), body: jsonEncode(fields));
    _decode(response);
  }

  Future<void> adminUpdateBankSettings(Map<String, dynamic> fields) async {
    final response =
        await http.put(_uri('/admin/bonuses/bank-settings'), headers: await _headers(auth: true), body: jsonEncode(fields));
    _decode(response);
  }

  Future<void> adminStoreTier(String label, int threshold, int bonus) async {
    final response = await http.post(
      _uri('/admin/bonuses/tiers'),
      headers: await _headers(auth: true),
      body: jsonEncode({'label': label, 'threshold_amount': threshold, 'bonus_amount': bonus}),
    );
    _decode(response);
  }

  Future<void> adminDeleteTier(int id) async {
    final response = await http.delete(_uri('/admin/bonuses/tiers/$id'), headers: await _headers(auth: true));
    _decode(response);
  }

  Future<void> adminReverseTransfer(int id) async {
    final response = await http.post(_uri('/admin/bonuses/transfers/$id/reverse'), headers: await _headers(auth: true));
    _decode(response);
  }

  Future<void> adminCompleteCashRequest(int id) async {
    final response = await http.post(_uri('/admin/bonuses/cash-requests/$id/complete'), headers: await _headers(auth: true));
    _decode(response);
  }

  Future<void> adminCancelCashRequest(int id) async {
    final response = await http.post(_uri('/admin/bonuses/cash-requests/$id/cancel'), headers: await _headers(auth: true));
    _decode(response);
  }

  Future<void> adminMarkPayoutPaid(int id) async {
    final response = await http.post(_uri('/admin/bonuses/payouts/$id/mark-paid'), headers: await _headers(auth: true));
    _decode(response);
  }

  Future<void> adminRunBonusesNow() async {
    final response = await http.post(_uri('/admin/bonuses/run-now'), headers: await _headers(auth: true));
    _decode(response);
  }

  // ---------------- Сповіщення (модуль Notifications) ----------------

  Future<Map<String, dynamic>> notifications() async {
    final response = await http.get(_uri('/notifications'), headers: await _headers(auth: true));
    return _decode(response) as Map<String, dynamic>;
  }

  /// Heartbeat онлайн-статусу (🟢) — тіло відповіді порожнє (204), тож
  /// без _decode; збій мовчки ігнорується, наступний тік спробує знову.
  Future<void> presencePing() async {
    try {
      await http.post(_uri('/presence/ping'), headers: await _headers(auth: true));
    } catch (_) {}
  }

  /// Учасники розмови зі статусом 🟢/🔴 (спершу ті, хто в мережі).
  Future<List<dynamic>> messengerMembers(int conversationId) async {
    final response = await http.get(_uri('/messenger/$conversationId/members'), headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['members'] as List<dynamic>;
  }

  /// Масове видалення сповіщень: вибрані [ids] або всі ([all]).
  Future<void> bulkDeleteNotifications({List<int> ids = const [], bool all = false}) async {
    final response = await http.post(
      _uri('/notifications/bulk-delete'),
      headers: await _headers(auth: true),
      body: jsonEncode(all ? {'all': true} : {'ids': ids}),
    );
    _decode(response);
  }

  /// Видалення власних звітів (лише на розгляді/відхилені — затверджені
  /// сервер пропускає). Повертає {deleted, skipped} і повідомлення, якщо
  /// частину пропущено.
  Future<({int deleted, int skipped, String? message})> bulkDeleteReports(
      {List<int> ids = const [], bool all = false}) async {
    final response = await http.post(
      _uri('/reports/bulk-delete'),
      headers: await _headers(auth: true),
      body: jsonEncode(all ? {'all': true} : {'ids': ids}),
    );
    final data = _decode(response) as Map<String, dynamic>;
    final d = data['data'] as Map<String, dynamic>? ?? {};
    return (
      deleted: d['deleted'] as int? ?? 0,
      skipped: d['skipped'] as int? ?? 0,
      message: data['message'] as String?,
    );
  }

  Future<void> markNotificationRead(int id) async {
    final response = await http.post(_uri('/notifications/$id/read'), headers: await _headers(auth: true));
    _decode(response);
  }

  Future<void> markAllNotificationsRead() async {
    final response = await http.post(_uri('/notifications/read-all'), headers: await _headers(auth: true));
    _decode(response);
  }

  Future<void> deleteNotification(int id) async {
    final response = await http.delete(_uri('/notifications/$id'), headers: await _headers(auth: true));
    _decode(response);
  }

  // ---------------- Месенджер (модуль Messenger) ----------------

  Future<List<dynamic>> messengerConversations() async {
    final response = await http.get(_uri('/messenger'), headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['conversations'] as List<dynamic>;
  }

  Future<Map<String, dynamic>> messengerConversation(int id) async {
    final response = await http.get(_uri('/messenger/$id'), headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return data['data'] as Map<String, dynamic>;
  }

  /// Повертає і нові повідомлення, і поточний otherLastReadMessageId
  /// (галочки прочитання, лише direct) — той самий запит, окремий для
  /// цього не потрібен.
  Future<Map<String, dynamic>> messengerMessagesSince(int conversationId, int afterId) async {
    final response = await http.get(
      _uri('/messenger/$conversationId/messages').replace(queryParameters: {'after_id': '$afterId'}),
      headers: await _headers(auth: true),
    );
    final data = _decode(response) as Map<String, dynamic>;
    return data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> sendMessengerText(int conversationId, String body, {int? replyToMessageId}) async {
    final response = await http.post(
      _uri('/messenger/$conversationId/messages'),
      headers: await _headers(auth: true),
      body: jsonEncode({
        'type': 'text',
        'body': body,
        if (replyToMessageId != null) 'reply_to_message_id': replyToMessageId,
      }),
    );
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['message'] as Map<String, dynamic>;
  }

  /// body тут — уже зашифрований блок (E2eeService.encryptFor), не текст.
  Future<Map<String, dynamic>> sendMessengerEncryptedText(int conversationId, String encryptedBody,
      {int? replyToMessageId}) async {
    final response = await http.post(
      _uri('/messenger/$conversationId/messages'),
      headers: await _headers(auth: true),
      body: jsonEncode({
        'type': 'text_e2ee',
        'body': encryptedBody,
        if (replyToMessageId != null) 'reply_to_message_id': replyToMessageId,
      }),
    );
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['message'] as Map<String, dynamic>;
  }

  /// Переписує СВОЇ старі text_e2ee-повідомлення відкритим текстом (щоб
  /// їх було видно на сайті). Збій ігнорується — спробуємо при наступному
  /// відкритті чату.
  Future<void> unlockMessengerMessages(int conversationId, List<Map<String, dynamic>> messages) async {
    try {
      await http.post(
        _uri('/messenger/$conversationId/unlock'),
        headers: await _headers(auth: true),
        body: jsonEncode({'messages': messages}),
      );
    } catch (_) {}
  }

  /// Публікує власний публічний X25519-ключ (наскрізне шифрування).
  Future<void> publishIdentityKey(String publicKeyBase64) async {
    final response = await http.post(
      _uri('/messenger/identity-key'),
      headers: await _headers(auth: true),
      body: jsonEncode({'public_key': publicKeyBase64}),
    );
    _decode(response);
  }

  /// null — користувач ще не опублікував ключ (старіша версія застосунку
  /// чи жодного разу не заходив у месенджер).
  Future<String?> fetchIdentityKey(int userId) async {
    final response = await http.get(_uri('/messenger/users/$userId/identity-key'), headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['publicKey'] as String?;
  }

  Future<Map<String, dynamic>> sendMessengerGif(int conversationId, String gifUrl) async {
    final response = await http.post(
      _uri('/messenger/$conversationId/messages'),
      headers: await _headers(auth: true),
      body: jsonEncode({'type': 'gif', 'gif_url': gifUrl}),
    );
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['message'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> sendMessengerSticker(int conversationId, int stickerId) async {
    final response = await http.post(
      _uri('/messenger/$conversationId/messages'),
      headers: await _headers(auth: true),
      body: jsonEncode({'type': 'sticker', 'sticker_id': stickerId}),
    );
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['message'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> sendMessengerPhoto(int conversationId, XFile photo, {String? caption}) async {
    final token = await this.token;
    final request = http.MultipartRequest('POST', _uri('/messenger/$conversationId/messages'))
      ..headers['Accept'] = 'application/json'
      ..headers['Authorization'] = 'Bearer $token'
      ..fields['type'] = 'photo';
    if (caption != null && caption.isNotEmpty) request.fields['body'] = caption;
    request.files.add(await http.MultipartFile.fromPath('photo', photo.path));

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['message'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> sendMessengerContact(int conversationId, int contactUserId) async {
    final response = await http.post(
      _uri('/messenger/$conversationId/messages'),
      headers: await _headers(auth: true),
      body: jsonEncode({'type': 'contact', 'contact_user_id': contactUserId}),
    );
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['message'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> sendMessengerLocation(int conversationId, double latitude, double longitude) async {
    final response = await http.post(
      _uri('/messenger/$conversationId/messages'),
      headers: await _headers(auth: true),
      body: jsonEncode({'type': 'location', 'latitude': latitude, 'longitude': longitude}),
    );
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['message'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> sendMessengerFile(int conversationId, String filePath, String fileName) async {
    final token = await this.token;
    final request = http.MultipartRequest('POST', _uri('/messenger/$conversationId/messages'))
      ..headers['Accept'] = 'application/json'
      ..headers['Authorization'] = 'Bearer $token'
      ..fields['type'] = 'file';
    request.files.add(await http.MultipartFile.fromPath('file', filePath, filename: fileName));

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['message'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> sendMessengerVoice(int conversationId, String filePath, int durationSeconds) async {
    final token = await this.token;
    final request = http.MultipartRequest('POST', _uri('/messenger/$conversationId/messages'))
      ..headers['Accept'] = 'application/json'
      ..headers['Authorization'] = 'Bearer $token'
      ..fields['type'] = 'voice'
      ..fields['voice_duration'] = '$durationSeconds';
    request.files.add(await http.MultipartFile.fromPath('voice', filePath));

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['message'] as Map<String, dynamic>;
  }

  Future<List<dynamic>> searchMessengerMembers(String query) async {
    final response = await http.get(
      _uri('/messenger/members/search').replace(queryParameters: {'q': query}),
      headers: await _headers(auth: true),
    );
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['members'] as List<dynamic>;
  }

  Future<int> startMessengerDirect(int targetUserId) async {
    final response = await http.post(_uri('/messenger/direct/$targetUserId'), headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['conversationId'] as int;
  }

  Future<Map<String, dynamic>> userProfile(int userId) async {
    final response = await http.get(_uri('/users/$userId'), headers: await _headers(auth: true));
    return _decode(response) as Map<String, dynamic>;
  }

  Future<List<dynamic>> messengerStickers() async {
    final response = await http.get(_uri('/messenger/stickers'), headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['stickers'] as List<dynamic>;
  }

  Future<Map<String, dynamic>> uploadMessengerSticker(XFile image) async {
    final token = await this.token;
    final request = http.MultipartRequest('POST', _uri('/messenger/stickers'))
      ..headers['Accept'] = 'application/json'
      ..headers['Authorization'] = 'Bearer $token';
    request.files.add(await http.MultipartFile.fromPath('image', image.path));

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['sticker'] as Map<String, dynamic>;
  }

  Future<void> deleteMessengerSticker(int id) async {
    final response = await http.delete(_uri('/messenger/stickers/$id'), headers: await _headers(auth: true));
    _decode(response);
  }

  /// Видалення власного повідомлення — сервер сам перевіряє, що це
  /// повідомлення саме цього користувача й саме з цієї розмови.
  Future<void> deleteMessengerMessage(int conversationId, int messageId) async {
    final response = await http.delete(
      _uri('/messenger/$conversationId/messages/$messageId'),
      headers: await _headers(auth: true),
    );
    _decode(response);
  }

  Future<List<dynamic>> searchGifs(String query) async {
    final response = await http.get(
      _uri('/messenger/gifs/search').replace(queryParameters: {'q': query}),
      headers: await _headers(auth: true),
    );
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['gifs'] as List<dynamic>;
  }

  // ---------------- Події родини (модуль Family Events) ----------------

  Future<List<dynamic>> events() async {
    final response = await http.get(_uri('/events'), headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return data['events'] as List<dynamic>;
  }

  Future<String?> rsvpEvent(int id, String status) async {
    final response = await http.post(
      _uri('/events/$id/rsvp'),
      headers: await _headers(auth: true),
      body: jsonEncode({'status': status}),
    );
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['myRsvp'] as String?;
  }

  Future<List<dynamic>> adminEvents() async {
    final response = await http.get(_uri('/admin/events'), headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return data['events'] as List<dynamic>;
  }

  Future<void> adminCreateEvent({
    required String title,
    String? description,
    String? location,
    required String startsAt,
  }) async {
    final response = await http.post(
      _uri('/admin/events'),
      headers: await _headers(auth: true),
      body: jsonEncode({
        'title': title,
        if (description != null && description.isNotEmpty) 'description': description,
        if (location != null && location.isNotEmpty) 'location': location,
        'starts_at': startsAt,
      }),
    );
    _decode(response);
  }

  Future<void> adminDeleteEvent(int id) async {
    final response = await http.delete(_uri('/admin/events/$id'), headers: await _headers(auth: true));
    _decode(response);
  }

  Future<void> adminSendEventsDigest() async {
    final response =
        await http.post(_uri('/admin/events/send-digest'), headers: await _headers(auth: true));
    _decode(response);
  }

  Future<Map<String, dynamic>> adminEventAiDraft(String hint) async {
    final response = await http.post(
      _uri('/admin/events/ai-draft'),
      headers: await _headers(auth: true),
      body: jsonEncode({'hint': hint}),
    );
    final data = _decode(response) as Map<String, dynamic>;
    return data['data'] as Map<String, dynamic>;
  }

  // ---------------- Спільні цілі родини (модуль Family Goals) ----------------

  Future<Map<String, dynamic>> familyGoals() async {
    final response = await http.get(_uri('/family-goals'), headers: await _headers(auth: true));
    return _decode(response) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> adminFamilyGoals() async {
    final response = await http.get(_uri('/admin/family-goals'), headers: await _headers(auth: true));
    return _decode(response) as Map<String, dynamic>;
  }

  Future<void> adminCreateFamilyGoal({
    required String title,
    String? description,
    int? targetValue,
    String? unit,
    String? metric,
    String? deadline,
  }) async {
    final response = await http.post(
      _uri('/admin/family-goals'),
      headers: await _headers(auth: true),
      body: jsonEncode({
        'title': title,
        if (description != null && description.isNotEmpty) 'description': description,
        if (targetValue != null) 'target_value': targetValue,
        if (unit != null && unit.isNotEmpty) 'unit': unit,
        if (metric != null) 'metric': metric,
        if (deadline != null && deadline.isNotEmpty) 'deadline': deadline,
      }),
    );
    _decode(response);
  }

  /// Правила родини й проєкту — {levels, books: [{slug, title, sections: [...]}]}.
  Future<Map<String, dynamic>> rules() async {
    final response = await http.get(_uri('/rules'), headers: await _headers(auth: true));
    return _decode(response) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> gallery() async {
    final response = await http.get(_uri('/gallery'), headers: await _headers(auth: true));
    return _decode(response) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> hallOfFame() async {
    final response = await http.get(_uri('/hall-of-fame'), headers: await _headers(auth: true));
    final data = _decode(response) as Map<String, dynamic>;
    return data['records'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> adminUpdateGoalProgress(int id, int currentValue) async {
    final response = await http.put(
      _uri('/admin/family-goals/$id/progress'),
      headers: await _headers(auth: true),
      body: jsonEncode({'current_value': currentValue}),
    );
    final data = _decode(response) as Map<String, dynamic>;
    return (data['data'] as Map<String, dynamic>)['goal'] as Map<String, dynamic>;
  }

  Future<void> adminCloseFamilyGoal(int id) async {
    final response =
        await http.post(_uri('/admin/family-goals/$id/close'), headers: await _headers(auth: true));
    _decode(response);
  }
}
