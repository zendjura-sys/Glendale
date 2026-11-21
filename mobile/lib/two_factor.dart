import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:qr_flutter/qr_flutter.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Увімкнення й вимкнення TOTP у налаштуваннях: QR, секрет і код підтвердження,
/// ті самі кроки, що сторінка «Безпека» на сайті.
class TwoFactorCard extends StatefulWidget {
  const TwoFactorCard({super.key});

  @override
  State<TwoFactorCard> createState() => _TwoFactorCardState();
}

class _TwoFactorCardState extends State<TwoFactorCard> {
  bool busy = false;

  Session get session => AppScope.of(context).session;

  Future<String?> _askPassword(String title, {String? text, String action = 'Підтвердити', bool danger = false}) async {
    final password = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(title),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (text != null) ...[
            Text(text, style: body(13.5, color: soft)),
            const SizedBox(height: 12),
          ],
          GcField(controller: password, label: tr('Пароль'), obscure: true, autofocus: true),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false), child: Text(tr('Скасувати'), style: body(14, color: muted))),
          TextButton(onPressed: () => Navigator.pop(dialog, true), child: Text(tr(action), style: body(14, color: danger ? dangerSoft : primary, weight: FontWeight.w700))),
        ],
      ),
    );
    final value = password.text;
    password.dispose();
    if (ok != true || value.isEmpty) return null;
    return value;
  }

  Future<void> _start() async {
    final password = await _askPassword(tr('Увімкнути 2FA'), text: tr('Після ввімкнення під час входу потрібен буде код із Google Authenticator, 1Password або іншого TOTP-застосунку.'));
    if (password == null || !mounted) return;
    setState(() => busy = true);
    try {
      final setup = await session.api.post('/api/v1/user/two-factor-authentication', {'password': password});
      if (!mounted) return;
      final url = text(setup['url']) ?? '';
      final secret = text(setup['secretKey']) ?? '';
      if (url.isEmpty || secret.isEmpty) {
        toast(context, tr('Не вдалося підготувати код.'));
        return;
      }
      final codes = await showDialog<List<String>>(
        context: context,
        barrierDismissible: false,
        builder: (dialog) => _TotpSetupDialog(api: session.api, url: url, secret: secret),
      );
      await session.refreshMe();
      if (codes != null && mounted) await _showCodes(codes);
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _disable() async {
    final password = await _askPassword(tr('Вимкнути 2FA'), text: tr('Під час входу код більше не питатимемо.'), action: tr('Вимкнути'), danger: true);
    if (password == null || !mounted) return;
    setState(() => busy = true);
    try {
      await session.api.delete('/api/v1/user/two-factor-authentication', {'password': password});
      await session.refreshMe();
      if (mounted) toast(context, tr('Двофакторний захист вимкнено.'));
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _codes({required bool regenerate}) async {
    final password = await _askPassword(
      regenerate ? tr('Оновити коди') : tr('Коди відновлення 2FA'),
      text: regenerate ? tr('Старі коди перестануть діяти.') : tr('Допоможуть увійти, якщо ви втратите телефон. Зберігайте їх у менеджері паролів.'),
      action: regenerate ? tr('Оновити коди') : tr('Показати коди'),
      danger: regenerate,
    );
    if (password == null || !mounted) return;
    setState(() => busy = true);
    try {
      final data = await session.api.post('/api/v1/user/two-factor-recovery-codes', {'password': password, 'regenerate': regenerate});
      final codes = _codeList(data['recovery_codes']);
      if (codes.isEmpty) throw ApiException(tr('Кодів немає.'));
      if (mounted) await _showCodes(codes);
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _showCodes(List<String> codes) {
    return showDialog<void>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(tr('Коди відновлення 2FA')),
        content: SingleChildScrollView(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(tr('Допоможуть увійти, якщо ви втратите телефон. Зберігайте їх у менеджері паролів.'), style: body(13.5, color: soft)),
            const SizedBox(height: 12),
            SelectableText(codes.join('\n'), style: body(15, weight: FontWeight.w700)),
          ]),
        ),
        actions: [
          TextButton(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: codes.join('\n')));
              if (mounted) toast(context, tr('Коди скопійовано'));
            },
            child: Text(tr('Скопіювати'), style: body(14, color: primary, weight: FontWeight.w700)),
          ),
          TextButton(onPressed: () => Navigator.pop(dialog), child: Text(tr('Готово'), style: body(14, color: muted))),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) {
        final me = session.me ?? {};
        final enabled = me['two_factor'] == true;
        final pending = me['two_factor_pending'] == true;
        return Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CardTitle(tr('Двофакторний захист'), icon: LucideIcons.shieldCheck),
            const SizedBox(height: 8),
            Text(
              enabled
                  ? tr('Увімкнено. Під час входу застосунок попросить код.')
                  : pending
                      ? tr('Налаштування не завершено: підтвердьте код із застосунку-автентифікатора.')
                      : tr('Вимкнено. Після ввімкнення під час входу потрібен буде код із застосунку-автентифікатора.'),
              style: body(13.5, color: soft),
            ),
            const SizedBox(height: 12),
            if (enabled) ...[
              GhostButton(label: tr('Показати коди'), icon: LucideIcons.keyRound, onPressed: busy ? null : () => _codes(regenerate: false)),
              const SizedBox(height: 8),
              GhostButton(label: tr('Оновити коди'), icon: LucideIcons.refreshCw, onPressed: busy ? null : () => _codes(regenerate: true)),
              const SizedBox(height: 8),
              DangerButton(label: tr('Вимкнути 2FA'), icon: LucideIcons.shieldOff, expand: true, onPressed: busy ? null : _disable),
            ] else
              PrimaryButton(label: pending ? tr('Продовжити налаштування') : tr('Увімкнути 2FA'), icon: LucideIcons.shieldCheck, busy: busy, onPressed: busy ? null : _start),
          ]),
        );
      },
    );
  }
}

List<String> _codeList(dynamic raw) {
  if (raw is! List) return [];
  return [for (final item in raw) if (text(item) != null) text(item)!];
}

class _TotpSetupDialog extends StatefulWidget {
  const _TotpSetupDialog({required this.api, required this.url, required this.secret});
  final Api api;
  final String url;
  final String secret;

  @override
  State<_TotpSetupDialog> createState() => _TotpSetupDialogState();
}

class _TotpSetupDialogState extends State<_TotpSetupDialog> {
  final code = TextEditingController();
  bool busy = false;

  @override
  void dispose() {
    code.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    final value = code.text.replaceAll(RegExp(r'\s+'), '');
    if (value.length < 6) {
      toast(context, tr('Введіть код із шести цифр.'));
      return;
    }
    setState(() => busy = true);
    try {
      final data = await widget.api.post('/api/v1/user/confirmed-two-factor-authentication', {'code': value});
      if (!mounted) return;
      Navigator.pop(context, _codeList(data['recovery_codes']));
    } catch (e) {
      if (mounted) {
        setState(() => busy = false);
        toast(context, e);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: AnimatedPadding(
        duration: const Duration(milliseconds: 150),
        padding: EdgeInsets.only(bottom: bottom),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(tr('Увімкнення 2FA'), style: display(18)),
            const SizedBox(height: 6),
            Text(tr('Відскануйте код або введіть ключ у застосунок-автентифікатор, потім підтвердьте шестизначний код.'), style: body(13.5, color: soft)),
            const SizedBox(height: 14),
            Center(
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                child: QrImageView(
                  data: widget.url,
                  version: QrVersions.auto,
                  size: 180,
                  backgroundColor: Colors.white,
                  eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: Color(0xFF2D3748)),
                  dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: Color(0xFF2D3748)),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(tr('або введіть код вручну'), textAlign: TextAlign.center, style: body(12.5, color: muted)),
            const SizedBox(height: 8),
            DecoratedBox(
              decoration: BoxDecoration(color: fg.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(14)),
              child: Row(children: [
                Expanded(child: Padding(padding: const EdgeInsets.fromLTRB(12, 10, 4, 10), child: SelectableText(widget.secret, style: body(14, weight: FontWeight.w700)))),
                IconButton(
                  tooltip: tr('Скопіювати'),
                  onPressed: () {
                    final messenger = context;
                    unawaited(Clipboard.setData(ClipboardData(text: widget.secret)).then((_) {
                      if (messenger.mounted) toast(messenger, tr('Ключ скопійовано'));
                    }));
                  },
                  icon: Icon(LucideIcons.copy, size: 18, color: muted),
                ),
              ]),
            ),
            const SizedBox(height: 14),
            GcField(controller: code, label: tr('Код із застосунку'), keyboard: TextInputType.number, autofocus: true, onSubmit: busy ? null : _confirm),
            const SizedBox(height: 14),
            PrimaryButton(label: tr('Підтвердити'), icon: LucideIcons.shieldCheck, busy: busy, onPressed: busy ? null : _confirm),
            const SizedBox(height: 4),
            TextButton(onPressed: busy ? null : () => Navigator.pop(context), child: Text(tr('Пізніше'), style: body(14, color: muted))),
          ]),
        ),
      ),
    );
  }
}
