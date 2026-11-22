import 'dart:async';

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../api.dart';
import '../i18n.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets.dart';

/// Вхід у програму для ПК через смартфон — як «Увійти через застосунок» на сайті: QR і код із двох
/// цифр; людина сканує QR у застосунку GameCon (Меню → «Сканувати QR для входу»), обирає той самий
/// код і підтверджує. 2FA вже пройдено на телефоні; токен видається один раз.
Future<void> showPhoneLogin(BuildContext context, Session session) {
  return showDialog<void>(context: context, barrierDismissible: true, builder: (_) => _PhoneLoginDialog(session: session));
}

class _PhoneLoginDialog extends StatefulWidget {
  const _PhoneLoginDialog({required this.session});
  final Session session;

  @override
  State<_PhoneLoginDialog> createState() => _PhoneLoginDialogState();
}

class _PhoneLoginDialogState extends State<_PhoneLoginDialog> {
  Map<String, dynamic>? request;
  String status = 'pending';
  Object? error;
  Timer? poll;

  @override
  void initState() {
    super.initState();
    unawaited(_start());
  }

  @override
  void dispose() {
    poll?.cancel();
    super.dispose();
  }

  Future<void> _start() async {
    poll?.cancel();
    setState(() {
      request = null;
      status = 'pending';
      error = null;
    });
    try {
      final r = await widget.session.api.post('/api/v1/auth/phone');
      if (!mounted) return;
      setState(() => request = r);
      poll = Timer.periodic(const Duration(seconds: 2), (_) => unawaited(_check()));
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  Future<void> _check() async {
    final r = request;
    if (r == null) return;
    try {
      final json = await widget.session.api.get('/api/v1/auth/phone/${r['id']}?secret=${Uri.encodeQueryComponent('${r['secret']}')}&device=${Uri.encodeQueryComponent('GameCon для ПК')}');
      final token = text(json['token']);
      if (token != null) {
        poll?.cancel();
        await widget.session.saveToken(token, json['user'] is Map ? Map<String, dynamic>.from(json['user'] as Map) : null);
        if (mounted) Navigator.of(context).pop();
        return;
      }
      final next = text(json['status']) ?? 'pending';
      if (next != 'pending') poll?.cancel();
      if (mounted && next != status) setState(() => status = next);
    } catch (_) {
      // Мережа — спробуємо за 2 с.
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = request;
    return Dialog(
      backgroundColor: card,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(tr('Вхід через смартфон'), style: display(22)),
            const SizedBox(height: 8),
            Text(
              tr('Відкрийте GameCon на телефоні → Меню → «Сканувати QR для входу», наведіть камеру й оберіть той самий код.'),
              textAlign: TextAlign.center,
              style: body(13.5, color: muted),
            ),
            const SizedBox(height: 18),
            if (error != null)
              Text('$error', textAlign: TextAlign.center, style: body(13.5, color: dangerSoft))
            else if (r == null)
              const Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator())
            else if (status == 'pending') ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                child: QrImageView(data: '${r['qr']}', size: 220, backgroundColor: Colors.white),
              ),
              const SizedBox(height: 16),
              Text(tr('Код на телефоні'), style: body(12.5, color: muted)),
              Text('${r['code']}', style: display(40)),
            ] else
              Text(status == 'denied' ? tr('Вхід відхилено на телефоні.') : tr('Час на підтвердження минув.'), style: body(14, color: soft)),
            const SizedBox(height: 18),
            Row(children: [
              Expanded(child: GhostButton(label: tr('Скасувати'), onPressed: () => Navigator.of(context).pop())),
              if (status != 'pending' || error != null) ...[
                const SizedBox(width: 10),
                Expanded(child: PrimaryButton(label: tr('Новий код'), onPressed: _start)),
              ],
            ]),
          ]),
        ),
      ),
    );
  }
}
