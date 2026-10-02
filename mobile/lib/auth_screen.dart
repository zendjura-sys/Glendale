import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

const googleWebClientId = '142512043248-9aa67rq1ki4lucintlei0fena6hm98iq.apps.googleusercontent.com';

class AuthScreen extends StatefulWidget {
  const AuthScreen({required this.session, super.key});
  final Session session;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  final first = TextEditingController();
  final last = TextEditingController();
  final code = TextEditingController();
  bool register = false;
  bool busy = false;
  String? error;
  String? ticket;

  @override
  void initState() {
    super.initState();
    widget.session.addListener(_onLink);
  }

  @override
  void dispose() {
    widget.session.removeListener(_onLink);
    email.dispose();
    password.dispose();
    first.dispose();
    last.dispose();
    code.dispose();
    super.dispose();
  }

  void _onLink() {
    final uri = widget.session.handoff;
    if (uri == null || uri.host != 'auth') return;
    widget.session.consumeLink();
    final failure = uri.queryParameters['error'];
    final exchange = uri.queryParameters['code'];
    final pending = uri.queryParameters['ticket'];
    if (failure != null && failure.isNotEmpty) {
      setState(() => error = Uri.decodeComponent(failure));
    } else if (exchange != null) {
      _run(() => widget.session.api.post('/api/v1/auth/exchange', {'code': exchange, 'device': 'GameCon Flutter'}));
    } else if (pending != null) {
      setState(() => ticket = pending);
    }
  }

  Future<void> _run(Future<Map<String, dynamic>> Function() call) async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final json = await call();
      if (json['two_factor'] == true && text(json['ticket']) != null) {
        setState(() => ticket = text(json['ticket']));
        return;
      }
      final token = text(json['token']);
      if (token == null) throw ApiException('Сервер не повернув сесію.');
      final user = json['user'] is Map ? Map<String, dynamic>.from(json['user'] as Map) : null;
      await widget.session.saveToken(token, user);
    } catch (e) {
      setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void _submit() {
    if (busy) return;
    if (ticket != null) {
      _run(() => widget.session.api.post('/api/v1/auth/two-factor', {'ticket': ticket, 'code': code.text.trim()}));
      return;
    }
    _run(() {
      if (register) {
        return widget.session.api.post('/api/v1/auth/register', {
          'first_name': first.text.trim(),
          'last_name': last.text.trim(),
          'email': email.text.trim(),
          'password': password.text,
          'password_confirmation': password.text,
          'device': 'GameCon Flutter',
        });
      }
      return widget.session.api.post('/api/v1/auth/login', {
        'email': email.text.trim(),
        'password': password.text,
        'device': 'GameCon Flutter',
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.viewPaddingOf(context).top;
    return Stage(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: ListView(
          padding: EdgeInsets.fromLTRB(18, top + 40, 18, 32),
          children: [
            const Center(child: LogoMark(size: 64)),
            const SizedBox(height: 14),
            const Center(child: Wordmark(size: 26)),
            const SizedBox(height: 8),
            Text('Соцмережа українського гейм-ком’юніті', textAlign: TextAlign.center, style: body(13.5, color: muted)),
            const SizedBox(height: 26),
            Glass(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
              radius: 26,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (ticket == null) ...[
                    Segmented(
                      options: const [SegmentOption('login', 'Вхід', icon: Icons.login_rounded), SegmentOption('register', 'Реєстрація', icon: Icons.person_add_alt_1_outlined)],
                      selected: register ? 'register' : 'login',
                      onSelect: (value) => setState(() {
                        register = value == 'register';
                        error = null;
                      }),
                    ),
                    const SizedBox(height: 18),
                  ],
                  Text(ticket != null ? 'Код підтвердження' : (register ? 'Створіть акаунт' : 'З поверненням'), style: display(22)),
                  const SizedBox(height: 4),
                  Text(
                    ticket != null ? 'Введіть 6 цифр із застосунку-автентифікатора або резервний код.' : (register ? 'Кілька секунд — і ви в GameCon.' : 'Увійдіть, щоб продовжити.'),
                    style: body(13, color: muted),
                  ),
                  const SizedBox(height: 16),
                  if (error != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: danger.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14), border: Border.all(color: danger.withValues(alpha: 0.35))),
                      child: Text(error!, style: body(13, color: dangerSoft)),
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (ticket != null) ...[
                    GcField(controller: code, label: 'Код', icon: Icons.pin_outlined, keyboard: TextInputType.number, autofocus: true, onSubmit: _submit),
                    const SizedBox(height: 14),
                    PrimaryButton(label: 'Підтвердити', busy: busy, onPressed: _submit),
                    TextButton(onPressed: () => setState(() => ticket = null), child: Text('Назад', style: body(13, color: muted))),
                  ] else ...[
                    if (register) ...[
                      Row(children: [
                        Expanded(child: GcField(controller: first, label: 'Ім’я', icon: Icons.person_outline_rounded)),
                        const SizedBox(width: 10),
                        Expanded(child: GcField(controller: last, label: 'Прізвище')),
                      ]),
                      const SizedBox(height: 10),
                    ],
                    GcField(controller: email, label: 'Пошта', icon: Icons.alternate_email_rounded, keyboard: TextInputType.emailAddress),
                    const SizedBox(height: 10),
                    GcField(controller: password, label: 'Пароль', icon: Icons.lock_outline_rounded, obscure: true, onSubmit: _submit),
                    const SizedBox(height: 16),
                    PrimaryButton(label: register ? 'Створити акаунт' : 'Увійти', busy: busy, onPressed: _submit),
                    const SizedBox(height: 18),
                    Row(children: [
                      const Expanded(child: Divider(color: lineStrong)),
                      Padding(padding: const EdgeInsets.symmetric(horizontal: 10), child: Text('або', style: body(12, color: muted))),
                      const Expanded(child: Divider(color: lineStrong)),
                    ]),
                    const SizedBox(height: 14),
                    GhostButton(label: 'Продовжити з Google', icon: Icons.g_mobiledata_rounded, onPressed: busy ? null : _google),
                    const SizedBox(height: 8),
                    GhostButton(label: 'Продовжити з Discord', icon: Icons.forum_outlined, iconColor: const Color(0xFF8B9AFF), onPressed: busy ? null : _discord),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _google() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final account = await GoogleSignIn(serverClientId: googleWebClientId).signIn();
      final idToken = (await account?.authentication)?.idToken;
      if (idToken == null) throw ApiException('Google не повернув токен.');
      await _run(() => widget.session.api.post('/api/v1/auth/google', {'google_token': idToken, 'device': 'GameCon Flutter'}));
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _discord() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final json = await widget.session.api.post('/api/v1/auth/discord');
      final url = text(json['url']);
      if (url == null) throw ApiException('Discord не відповів.');
      final opened = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (!opened) throw ApiException('Не вдалося відкрити Discord.');
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }
}
