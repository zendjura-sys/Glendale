import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';
import 'i18n.dart';

/// Налаштування → Застосунки: кому дано доступ через «Увійти через GameCon» (як на сайті /settings/connected-apps).
class ConnectedAppsScreen extends StatefulWidget {
  const ConnectedAppsScreen({super.key});

  @override
  State<ConnectedAppsScreen> createState() => _ConnectedAppsScreenState();
}

class _ConnectedAppsScreenState extends State<ConnectedAppsScreen> {
  List<Map<String, dynamic>>? apps;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final d = await AppScope.read(context).session.api.get(Api.site('/settings/connected-apps'));
      if (mounted) setState(() => apps = maps(d['apps']));
    } catch (e) {
      if (mounted) {
        setState(() => apps = []);
        toast(context, e);
      }
    }
  }

  Future<void> _disconnect(Map<String, dynamic> app) async {
    final ok = await confirm(context, tr('Відключити «{name}»?', {'name': text(app['name']) ?? ''}), text: tr('Застосунок втратить доступ одразу.'), action: tr('Відключити'));
    if (!ok || !mounted) return;
    try {
      final d = await AppScope.read(context).session.api.delete(Api.site('/settings/connected-apps/${app['id']}'));
      if (mounted) setState(() => apps = maps(d['apps']));
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = apps;
    return ScreenScroll(
      onRefresh: _load,
      children: [
        PageTitle(tr('Підключені застосунки'), subtitle: tr('Сайти, боти й програми, яким ви дозволили доступ через «Увійти через GameCon».')),
        if (list == null)
          const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()))
        else if (list.isEmpty)
          Glass(child: Text(tr('Ви ще не підключали жодного застосунку.'), style: body(14, color: muted)))
        else
          for (final app in list)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Glass(
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(LucideIcons.appWindow, color: primary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(text(app['name']) ?? '', style: body(15, weight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text((app['scope_labels'] is List ? (app['scope_labels'] as List) : const []).map((s) => tr('$s')).join(' · '), style: body(12.5, color: muted)),
                    ]),
                  ),
                  TextButton(onPressed: () => _disconnect(app), child: Text(tr('Відключити'), style: body(13, color: dangerSoft))),
                ]),
              ),
            ),
        const SizedBox(height: 8),
        GhostButton(
          label: tr('Створити свій застосунок — для розробників'),
          icon: LucideIcons.code,
          onPressed: () => launchUrl(Uri.parse('${Api.root}/developers'), mode: LaunchMode.externalApplication),
        ),
      ],
    );
  }
}

/// Один акаунт в автентифікаторі: otpauth://totp/Label?secret=…&issuer=…&digits=6&period=30.
class TotpAccount {
  TotpAccount({required this.label, required this.issuer, required this.secret, this.digits = 6, this.period = 30, this.algorithm = 'SHA1'});

  final String label;
  final String issuer;
  final String secret;
  final int digits;
  final int period;
  final String algorithm;

  static TotpAccount? parse(String raw) {
    final uri = Uri.tryParse(raw.trim());
    if (uri == null || uri.scheme != 'otpauth' || uri.host != 'totp') return null;
    final secret = (uri.queryParameters['secret'] ?? '').replaceAll(' ', '').toUpperCase();
    if (base32Decode(secret) == null) return null;
    final path = Uri.decodeComponent(uri.path.replaceFirst('/', ''));
    final issuer = uri.queryParameters['issuer'] ?? (path.contains(':') ? path.split(':').first : '');
    final label = path.contains(':') ? path.split(':').sublist(1).join(':').trim() : path;
    final alg = (uri.queryParameters['algorithm'] ?? 'SHA1').toUpperCase();
    return TotpAccount(
      label: label,
      issuer: issuer,
      secret: secret,
      digits: int.tryParse(uri.queryParameters['digits'] ?? '') ?? 6,
      period: int.tryParse(uri.queryParameters['period'] ?? '') ?? 30,
      algorithm: alg == 'SHA1' ? 'SHA1' : alg,
    );
  }

  Map<String, dynamic> toJson() => {'label': label, 'issuer': issuer, 'secret': secret, 'digits': digits, 'period': period, 'algorithm': algorithm};

  static TotpAccount fromJson(Map<String, dynamic> j) =>
      TotpAccount(label: '${j['label'] ?? ''}', issuer: '${j['issuer'] ?? ''}', secret: '${j['secret'] ?? ''}', digits: intOf(j['digits']) == 0 ? 6 : intOf(j['digits']), period: intOf(j['period']) == 0 ? 30 : intOf(j['period']), algorithm: '${j['algorithm'] ?? 'SHA1'}');

  /// Код RFC 6238 на момент [now] (лише HMAC-SHA1 — як у Google Authenticator за замовчуванням).
  String code(DateTime now) {
    final key = base32Decode(secret) ?? Uint8List(0);
    final counter = now.millisecondsSinceEpoch ~/ 1000 ~/ period;
    final msg = ByteData(8)..setUint64(0, counter);
    final hash = hmacSha1(key, msg.buffer.asUint8List());
    final offset = hash[hash.length - 1] & 0x0f;
    final bin = ((hash[offset] & 0x7f) << 24) | (hash[offset + 1] << 16) | (hash[offset + 2] << 8) | hash[offset + 3];
    var mod = 1;
    for (var i = 0; i < digits; i++) {
      mod *= 10;
    }
    return (bin % mod).toString().padLeft(digits, '0');
  }
}

/// Base32 (RFC 4648) без доповнення; null — неправильний ключ.
Uint8List? base32Decode(String input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  final clean = input.replaceAll('=', '').toUpperCase();
  if (clean.isEmpty) return null;
  final out = <int>[];
  var buffer = 0;
  var bits = 0;
  for (final ch in clean.split('')) {
    final v = alphabet.indexOf(ch);
    if (v < 0) return null;
    buffer = (buffer << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.add((buffer >> bits) & 0xff);
    }
  }
  return Uint8List.fromList(out);
}

/// SHA-1 (FIPS 180-4) — без зовнішніх пакетів.
Uint8List sha1(List<int> data) {
  var h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
  final ml = data.length * 8;
  final msg = <int>[...data, 0x80];
  while (msg.length % 64 != 56) {
    msg.add(0);
  }
  for (var i = 7; i >= 0; i--) {
    msg.add((ml >> (i * 8)) & 0xff);
  }
  int rotl(int x, int n) => ((x << n) | (x >> (32 - n))) & 0xffffffff;
  final w = List<int>.filled(80, 0);
  for (var chunk = 0; chunk < msg.length; chunk += 64) {
    for (var i = 0; i < 16; i++) {
      w[i] = (msg[chunk + i * 4] << 24) | (msg[chunk + i * 4 + 1] << 16) | (msg[chunk + i * 4 + 2] << 8) | msg[chunk + i * 4 + 3];
    }
    for (var i = 16; i < 80; i++) {
      w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }
    var a = h0, b = h1, c = h2, d = h3, e = h4;
    for (var i = 0; i < 80; i++) {
      int f, k;
      if (i < 20) {
        f = (b & c) | ((~b & 0xffffffff) & d);
        k = 0x5A827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ED9EBA1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8F1BBCDC;
      } else {
        f = b ^ c ^ d;
        k = 0xCA62C1D6;
      }
      final temp = (rotl(a, 5) + f + e + k + w[i]) & 0xffffffff;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) & 0xffffffff;
    h1 = (h1 + b) & 0xffffffff;
    h2 = (h2 + c) & 0xffffffff;
    h3 = (h3 + d) & 0xffffffff;
    h4 = (h4 + e) & 0xffffffff;
  }
  final out = ByteData(20)
    ..setUint32(0, h0)
    ..setUint32(4, h1)
    ..setUint32(8, h2)
    ..setUint32(12, h3)
    ..setUint32(16, h4);
  return out.buffer.asUint8List();
}

Uint8List hmacSha1(List<int> key, List<int> message) {
  var k = key.length > 64 ? sha1(key).toList() : List<int>.from(key);
  k = [...k, ...List<int>.filled(64 - k.length, 0)];
  final inner = sha1([...k.map((b) => b ^ 0x36), ...message]);
  return sha1([...k.map((b) => b ^ 0x5c), ...inner]);
}

/// Автентифікатор GameCon (як Google Authenticator): одноразові коди для 2FA на GameCon та будь-яких сайтах.
/// Ключі зберігаються лише на цьому телефоні.
class AuthenticatorScreen extends StatefulWidget {
  const AuthenticatorScreen({super.key});

  @override
  State<AuthenticatorScreen> createState() => _AuthenticatorScreenState();
}

class _AuthenticatorScreenState extends State<AuthenticatorScreen> {
  static const _key = 'authenticator_accounts';
  List<TotpAccount> accounts = [];
  Timer? ticker;
  DateTime now = DateTime.now();

  @override
  void initState() {
    super.initState();
    _load();
    ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => now = DateTime.now());
    });
  }

  @override
  void dispose() {
    ticker?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || !mounted) return;
    try {
      setState(() => accounts = (jsonDecode(raw) as List).map((e) => TotpAccount.fromJson(Map<String, dynamic>.from(e as Map))).toList());
    } catch (_) {}
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(accounts.map((a) => a.toJson()).toList()));
  }

  Future<void> _add(String raw) async {
    final account = TotpAccount.parse(raw);
    if (account == null) {
      toast(context, tr('Це не код otpauth://totp. Скануйте QR зі сторінки ввімкнення 2FA.'));
      return;
    }
    setState(() => accounts = [...accounts, account]);
    await _save();
    if (mounted) toast(context, tr('Додано: {name}', {'name': account.issuer.isEmpty ? account.label : account.issuer}));
  }

  Future<void> _manual() async {
    final issuer = TextEditingController();
    final label = TextEditingController();
    final secret = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(tr('Ввести ключ вручну')),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          GcField(controller: issuer, label: tr('Сервіс (напр. GameCon)')),
          const SizedBox(height: 8),
          GcField(controller: label, label: tr('Акаунт (нік чи email)')),
          const SizedBox(height: 8),
          GcField(controller: secret, label: tr('Секретний ключ')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false), child: Text(tr('Скасувати'))),
          TextButton(onPressed: () => Navigator.pop(dialog, true), child: Text(tr('Додати'))),
        ],
      ),
    );
    if (ok != true) return;
    final s = secret.text.replaceAll(' ', '').toUpperCase();
    await _add('otpauth://totp/${Uri.encodeComponent('${issuer.text.trim()}:${label.text.trim()}')}?secret=$s&issuer=${Uri.encodeComponent(issuer.text.trim())}');
  }

  Future<void> _scan() async {
    final raw = await Navigator.of(context).push<String>(MaterialPageRoute(builder: (_) => const _OtpScanScreen()));
    if (raw != null && mounted) await _add(raw);
  }

  Future<void> _remove(int i) async {
    final a = accounts[i];
    final ok = await confirm(context, tr('Видалити {name}?', {'name': a.issuer.isEmpty ? a.label : a.issuer}), text: tr('Без цього ключа ви не зможете отримати коди для входу. Спершу вимкніть 2FA на сервісі чи перенесіть ключ.'), action: tr('Видалити'));
    if (!ok) return;
    setState(() => accounts = [...accounts]..removeAt(i));
    await _save();
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScroll(
      children: [
        PageTitle(tr('Автентифікатор'), subtitle: tr('Одноразові коди для двофакторного входу — на GameCon і будь-яких сайтах, що підтримують Google Authenticator. Ключі лишаються лише на цьому телефоні.')),
        Row(children: [
          Expanded(child: PrimaryButton(label: tr('Сканувати QR'), icon: LucideIcons.scanLine, onPressed: _scan)),
          const SizedBox(width: 8),
          Expanded(child: GhostButton(label: tr('Ввести ключ'), icon: LucideIcons.keyRound, onPressed: _manual)),
        ]),
        const SizedBox(height: 12),
        if (accounts.isEmpty)
          Glass(child: Text(tr('Ще немає жодного акаунта. Увімкніть 2FA в Налаштування → Безпека й відскануйте QR.'), style: body(13.5, color: muted))),
        for (var i = 0; i < accounts.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _CodeTile(account: accounts[i], now: now, onRemove: () => _remove(i)),
          ),
        const SizedBox(height: 4),
        TextButton.icon(onPressed: () => context.push('/settings'), icon: Icon(LucideIcons.shieldCheck, size: 16, color: primary), label: Text(tr('Увімкнути 2FA на GameCon'), style: body(13, color: primary))),
      ],
    );
  }
}

class _CodeTile extends StatelessWidget {
  const _CodeTile({required this.account, required this.now, required this.onRemove});
  final TotpAccount account;
  final DateTime now;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final code = account.code(now);
    final left = account.period - (now.millisecondsSinceEpoch ~/ 1000) % account.period;
    final pretty = code.length == 6 ? '${code.substring(0, 3)} ${code.substring(3)}' : code;
    return Glass(
      child: InkWell(
        onTap: () {
          Clipboard.setData(ClipboardData(text: code));
          toast(context, tr('Код скопійовано.'));
        },
        onLongPress: onRemove,
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(account.issuer.isEmpty ? account.label : account.issuer, style: body(13, color: muted, weight: FontWeight.w600)),
              if (account.issuer.isNotEmpty && account.label.isNotEmpty) Text(account.label, style: body(12, color: faint)),
              const SizedBox(height: 4),
              Text(pretty, style: display(28).copyWith(letterSpacing: 2, color: left <= 5 ? dangerSoft : null)),
            ]),
          ),
          SizedBox(
            width: 32,
            height: 32,
            child: Stack(alignment: Alignment.center, children: [
              CircularProgressIndicator(value: left / account.period, strokeWidth: 3, color: left <= 5 ? dangerSoft : primary, backgroundColor: fg.withValues(alpha: 0.1)),
              Text('$left', style: body(11, weight: FontWeight.w700)),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _OtpScanScreen extends StatefulWidget {
  const _OtpScanScreen();

  @override
  State<_OtpScanScreen> createState() => _OtpScanScreenState();
}

class _OtpScanScreenState extends State<_OtpScanScreen> {
  final controller = MobileScannerController(formats: const [BarcodeFormat.qrCode], detectionSpeed: DetectionSpeed.noDuplicates);
  bool done = false;

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(backgroundColor: Colors.black, foregroundColor: Colors.white, title: Text(tr('QR ключа 2FA'))),
      body: MobileScanner(
        controller: controller,
        onDetect: (capture) {
          if (done) return;
          for (final c in capture.barcodes) {
            final raw = c.rawValue ?? '';
            if (raw.startsWith('otpauth://')) {
              done = true;
              Navigator.of(context).pop(raw);
              return;
            }
          }
        },
        errorBuilder: (_, e) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(e.errorCode == MobileScannerErrorCode.permissionDenied ? tr('Дозвольте доступ до камери в налаштуваннях телефону.') : tr('Камера недоступна.'), textAlign: TextAlign.center, style: body(14.5, color: Colors.white)),
          ),
        ),
      ),
    );
  }
}
