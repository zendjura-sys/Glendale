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

  @override
  Widget build(BuildContext context) {
    return Stage(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Column(
          children: [
            Container(
              width: double.infinity,
              padding: EdgeInsets.only(top: MediaQuery.viewPaddingOf(context).top + 36, bottom: 48),
              decoration: const BoxDecoration(gradient: brand),
              child: const Column(
                children: [
                  LogoMark(size: 72),
                  SizedBox(height: 12),
                  Text('GameCon', style: TextStyle(fontFamily: 'Unbounded', fontWeight: FontWeight.w700, fontSize: 26, color: Colors.white)),
                ],
              ),
            ),
            Expanded(
              child: Transform.translate(
                offset: const Offset(0, -24),
                child: DecoratedBox(
                  decoration: const BoxDecoration(color: voidColor, borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
                    children: [
                    Text(ticket != null ? 'Код із застосунку' : (register ? 'Створити акаунт' : 'З поверненням'), textAlign: TextAlign.center, style: unbounded.copyWith(fontSize: 24)),
                    const SizedBox(height: 14),
                    if (error != null) ...[
                      Text(error!, style: onest.copyWith(color: pink)),
                      const SizedBox(height: 10),
                    ],
                    if (ticket != null) ...[
                      GcField(controller: code, label: 'Код'),
                      const SizedBox(height: 12),
                      PrimaryButton(
                        label: 'Підтвердити',
                        onPressed: busy
                            ? null
                            : () => _run(() => widget.session.api.post('/api/v1/auth/two-factor', {
                                  'ticket': ticket,
                                  'code': code.text.trim(),
                                })),
                      ),
                    ] else ...[
                      if (register) ...[
                        GcField(controller: first, label: 'Ім’я'),
                        const SizedBox(height: 10),
                        GcField(controller: last, label: 'Прізвище'),
                        const SizedBox(height: 10),
                      ],
                      GcField(controller: email, label: 'Пошта'),
                      const SizedBox(height: 10),
                      GcField(controller: password, label: 'Пароль', obscure: true),
                      const SizedBox(height: 14),
                      PrimaryButton(
                        label: register ? 'Створити акаунт' : 'Увійти',
                        onPressed: busy
                            ? null
                            : () => _run(() {
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
                                }),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(child: Divider(color: Colors.white.withValues(alpha: 0.12))),
                          Padding(padding: const EdgeInsets.symmetric(horizontal: 10), child: Text('або', style: onest.copyWith(color: muted, fontSize: 12))),
                          Expanded(child: Divider(color: Colors.white.withValues(alpha: 0.12))),
                        ],
                      ),
                      const SizedBox(height: 12),
                      GhostButton(label: 'Google', icon: Icons.g_mobiledata_rounded, onPressed: busy ? null : _google),
                      const SizedBox(height: 8),
                      GhostButton(label: 'Discord', icon: Icons.forum_rounded, onPressed: busy ? null : _discord),
                    ],
              TextButton(
                onPressed: () => setState(() {
                  register = !register;
                  ticket = null;
                  error = null;
                }),
                child: Text(register ? 'Вже є акаунт? Увійти' : 'Немає акаунта? Реєстрація', style: const TextStyle(color: cyan, fontFamily: 'Onest')),
              ),
                    ],
                  ),
                ),
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
