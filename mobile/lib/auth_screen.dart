import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';
import 'i18n.dart';
import 'language_picker.dart';

const googleWebClientId = '142512043248-9aa67rq1ki4lucintlei0fena6hm98iq.apps.googleusercontent.com';

class AuthScreen extends StatefulWidget {
  const AuthScreen({required this.session, this.previewBackground, super.key});
  final Session session;

  /// Лише для знімків екрана в тестах: фон без мережі.
  final ImageProvider? previewBackground;

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
      if (token == null) throw ApiException(tr('Сервер не повернув сесію.'));
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

  /// Фон входу з адмінки (телефон / планшет); останній збережений показуємо одразу.
  String? background;

  Future<void> _loadBackground(bool tablet) async {
    final key = tablet ? 'auth_bg_tablet' : 'auth_bg_phone';
    final cached = widget.session.prefs.getString(key);
    if (cached != null && background == null) setState(() => background = cached.isEmpty ? null : cached);
    try {
      final d = await widget.session.api.get('/api/v1/auth-images');
      final url = text(d[tablet ? 'app_tablet' : 'app_phone']) ?? text(d[tablet ? 'app_phone' : 'app_tablet']);
      await widget.session.prefs.setString(key, url ?? '');
      if (mounted && url != background) setState(() => background = url);
    } catch (_) {}
  }

  bool? _tablet;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    // Телефон (< 600) — вертикальний фон, планшет і ширше — широкий.
    final tablet = size.width >= 600;
    if (_tablet != tablet) {
      _tablet = tablet;
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadBackground(tablet));
    }
    final bg = background;
    final formWidth = tablet ? 420.0 : math.min(size.width * 0.88, 400.0);
    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      resizeToAvoidBottomInset: false,
      body: Stack(fit: StackFit.expand, children: [
        // Фон з адмінки на весь екран; без нього — темний фірмовий градієнт.
        if (widget.previewBackground != null)
          Image(image: widget.previewBackground!, fit: BoxFit.cover, width: double.infinity, height: double.infinity)
        else if (bg != null)
          Image.network(bg, fit: BoxFit.cover, width: double.infinity, height: double.infinity, errorBuilder: (_, _, _) => const _AuthFallback())
        else
          const _AuthFallback(),
        // Легке затемнення — білі елементи читаються на будь-якому фото.
        const ColoredBox(color: Color(0x40000000)),
        SafeArea(
          child: Padding(
            // Клавіатура піднімає форму, а не накриває її.
            padding: EdgeInsets.only(bottom: keyboard),
            child: CustomScrollView(
              slivers: [
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: SizedBox(
                      width: formWidth,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Логотип — у верхній третині, форма — в нижній половині.
                          const Spacer(),
                          Center(child: LogoMark(size: tablet ? 96 : 84)),
                          const SizedBox(height: 14),
                          Center(child: Wordmark(size: 28)),
                          const Spacer(flex: 2),
                          const SizedBox(height: 24),
                          ..._form(),
                          const SizedBox(height: 24),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ]),
    );
  }

  List<Widget> _form() {
    const gap = SizedBox(height: 16);
    return [
      if (ticket == null)
        Center(
          child: _AuthTabs(
            register: register,
            onChanged: (value) => setState(() {
              register = value;
              error = null;
            }),
          ),
        )
      else ...[
        Text(tr('Код підтвердження'), textAlign: TextAlign.center, style: display(22, color: Colors.white)),
        const SizedBox(height: 6),
        Text(tr('Введіть 6 цифр із застосунку-автентифікатора або резервний код.'), textAlign: TextAlign.center, style: body(13.5, color: Colors.white70)),
      ],
      const SizedBox(height: 24),
      if (error != null) ...[
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: danger.withValues(alpha: 0.22), borderRadius: BorderRadius.circular(18), border: Border.all(color: danger.withValues(alpha: 0.45))),
          child: Text(error!, style: body(13, color: Colors.white)),
        ),
        gap,
      ],
      // Набір полів міняється плавно на тому самому екрані.
      AnimatedSize(
        duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : const Duration(milliseconds: 260),
        curve: Curves.easeOutCubic,
        alignment: Alignment.topCenter,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (ticket != null) ...[
            _PillField(controller: code, hint: tr('Код'), icon: LucideIcons.rectangleEllipsis, keyboard: TextInputType.number, autofocus: true, onSubmit: _submit),
          ] else ...[
            if (register) ...[
              _PillField(controller: first, hint: tr('Ім’я'), icon: LucideIcons.userRound),
              gap,
              _PillField(controller: last, hint: tr('Прізвище'), icon: LucideIcons.userRound),
              gap,
            ],
            _PillField(controller: email, hint: tr('Пошта'), icon: LucideIcons.atSign, keyboard: TextInputType.emailAddress),
            gap,
            _PillField(controller: password, hint: tr('Пароль'), icon: LucideIcons.lockKeyhole, obscure: true, onSubmit: _submit),
          ],
        ]),
      ),
      const SizedBox(height: 24),
      _PillButton(
        label: ticket != null ? tr('Підтвердити') : (register ? tr('Створити акаунт') : tr('Увійти')),
        busy: busy,
        onPressed: _submit,
      ),
      // Внизу праворуч: відновлення пароля (вхід) чи допомога (реєстрація, код).
      Align(
        alignment: Alignment.centerRight,
        child: Padding(
          padding: const EdgeInsets.only(top: 24),
          child: GestureDetector(
            onTap: () {
              if (ticket != null) {
                setState(() => ticket = null);
                return;
              }
              launchUrl(Uri.parse('${Api.root}${register ? '/help/start' : '/forgot-password'}'), mode: LaunchMode.externalApplication);
            },
            child: Text(
              ticket != null ? tr('Назад') : (register ? tr('Потрібна допомога?') : tr('Забули пароль?')),
              style: body(14, color: const Color(0xBFFFFFFF), weight: FontWeight.w500),
            ),
          ),
        ),
      ),
      if (ticket == null) ...[
        const SizedBox(height: 24),
        Row(children: [
          Expanded(child: _SocialPill(label: 'Google', icon: Icons.g_mobiledata_rounded, onTap: busy ? null : _google)),
          const SizedBox(width: 12),
          Expanded(child: _SocialPill(label: 'Discord', icon: LucideIcons.messagesSquare, onTap: busy ? null : _discord)),
        ]),
        const SizedBox(height: 12),
        LanguagePicker(api: widget.session.api, signedIn: false),
      ],
    ];
  }

  Future<void> _google() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final google = GoogleSignIn(serverClientId: googleWebClientId);
      final account = await google.signIn();
      if (account == null) return;
      final idToken = (await account.authentication).idToken;
      if (idToken == null) throw ApiException(tr('Google не повернув токен.'));
      await _run(() => widget.session.api.post('/api/v1/auth/google', {'google_token': idToken, 'device': 'GameCon Flutter'}));
    } on PlatformException catch (e) {
      final message = await _googleFailure(e);
      if (mounted) setState(() => error = message);
    } catch (e) {
      if (mounted) setState(() => error = e is ApiException ? e.message : tr('Не вдалося увійти через Google.\n{e}', {'e': e}));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<String?> _googleFailure(PlatformException error) async {
    final raw = '${error.code} ${error.message}';
    if (raw.contains('canceled') || raw.contains('12501') || raw.contains('sign_in_cancelled')) {
      return null;
    }
    // Код Google Play Services з «ApiException: 10: …»; у релізі R8 скорочує назву класу («w3: 10: »).
    final code = RegExp(r'(?:^|\s)(\d+):').firstMatch(error.message ?? '')?.group(1);
    if (code == '10') {
      // DEVELOPER_ERROR: підпис застосунку не зареєстровано у Firebase — показуємо, який саме.
      final sha1 = await _signingSha1();
      return tr('Google не приймає вхід у цій збірці (код 10). Увійдіть поштою або через Discord.{v}', {'v': sha1 == null ? '' : '\nПідпис: $sha1'});
    }
    // Без коду Google показуємо сирий текст помилки — інакше причину не видно.
    return tr('Не вдалося увійти через Google{v}. Спробуйте пошту або Discord.{v2}', {'v': code == null ? '' : ' (код $code)', 'v2': code == null ? '\n${error.code}: ${error.message ?? ''}' : ''});
  }

  Future<String?> _signingSha1() async {
    try {
      final list = await const MethodChannel('gamecon/app').invokeListMethod<String>('signingSha1');
      return list == null || list.isEmpty ? null : list.last;
    } catch (_) {
      return null;
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
      if (url == null) throw ApiException(tr('Discord не відповів.'));
      final opened = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (!opened) throw ApiException(tr('Не вдалося відкрити Discord.'));
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }
}

/// Тло входу без фото з адмінки: глибокий синій із сапфіровим сяйвом.
class _AuthFallback extends StatelessWidget {
  const _AuthFallback();

  @override
  Widget build(BuildContext context) => const DecoratedBox(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(-0.6, 0.8),
            radius: 1.3,
            colors: [Color(0xFF0A3A8C), Color(0xFF071226), Color(0xFF05070D)],
            stops: [0, 0.55, 1],
          ),
        ),
      );
}

/// Перемикач «Вхід / Реєстрація»: напівпрозора пігулка з повзунком.
class _AuthTabs extends StatelessWidget {
  const _AuthTabs({required this.register, required this.onChanged});
  final bool register;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final still = MediaQuery.disableAnimationsOf(context);
    Widget tab(String label, bool value) => Expanded(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => onChanged(value),
            child: Center(
              child: AnimatedDefaultTextStyle(
                duration: still ? Duration.zero : const Duration(milliseconds: 200),
                style: body(15, color: register == value ? Colors.white : const Color(0xA6FFFFFF), weight: register == value ? FontWeight.w700 : FontWeight.w500),
                child: Text(label),
              ),
            ),
          ),
        );
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          width: 260,
          height: 48,
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(999)),
          child: Stack(children: [
            AnimatedAlign(
              duration: still ? Duration.zero : const Duration(milliseconds: 260),
              curve: Curves.easeOutCubic,
              alignment: register ? Alignment.centerRight : Alignment.centerLeft,
              child: FractionallySizedBox(
                widthFactor: 0.5,
                heightFactor: 1,
                child: DecoratedBox(decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.28), borderRadius: BorderRadius.circular(999))),
              ),
            ),
            Row(children: [tab(tr('Вхід'), false), tab(tr('Реєстрація'), true)]),
          ]),
        ),
      ),
    );
  }
}

/// Поле-пігулка: розмите скло, іконка в колі ліворуч, білий текст.
class _PillField extends StatefulWidget {
  const _PillField({required this.controller, required this.hint, required this.icon, this.obscure = false, this.keyboard, this.autofocus = false, this.onSubmit});
  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final bool obscure;
  final TextInputType? keyboard;
  final bool autofocus;
  final VoidCallback? onSubmit;

  @override
  State<_PillField> createState() => _PillFieldState();
}

class _PillFieldState extends State<_PillField> {
  late bool hidden = widget.obscure;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
        child: Container(
          height: 58,
          padding: const EdgeInsets.only(left: 10, right: 6),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.18),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
          ),
          child: Row(children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.white60, width: 1.4)),
              child: Icon(widget.icon, size: 18, color: Colors.white),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: TextField(
                controller: widget.controller,
                obscureText: hidden,
                keyboardType: widget.keyboard,
                autofocus: widget.autofocus,
                cursorColor: Colors.white,
                style: body(16, color: Colors.white, weight: FontWeight.w500),
                textInputAction: widget.onSubmit != null ? TextInputAction.done : TextInputAction.next,
                onSubmitted: widget.onSubmit == null ? null : (_) => widget.onSubmit!(),
                decoration: InputDecoration(
                  isCollapsed: true,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  filled: false,
                  hintText: widget.hint,
                  hintStyle: body(16, color: const Color(0xB3FFFFFF), weight: FontWeight.w500),
                ),
              ),
            ),
            if (widget.obscure)
              IconButton(
                tooltip: hidden ? tr('Показати пароль') : tr('Сховати пароль'),
                onPressed: () => setState(() => hidden = !hidden),
                icon: Icon(hidden ? LucideIcons.eye : LucideIcons.eyeOff, size: 18, color: Colors.white70),
              ),
          ]),
        ),
      ),
    );
  }
}

/// Головна кнопка: суцільна пігулка фірмового кольору.
class _PillButton extends StatelessWidget {
  const _PillButton({required this.label, required this.onPressed, this.busy = false});
  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 58,
      child: FilledButton(
        onPressed: busy ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: primary,
          disabledBackgroundColor: primary.withValues(alpha: 0.6),
          foregroundColor: Colors.white,
          shape: const StadiumBorder(),
          elevation: 0,
        ),
        child: busy
            ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
            : Text(label, style: body(16.5, color: Colors.white, weight: FontWeight.w700)),
      ),
    );
  }
}

/// Вхід через Google чи Discord: прозора пігулка.
class _SocialPill extends StatelessWidget {
  const _SocialPill({required this.label, required this.icon, required this.onTap});
  final String label;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 20, color: Colors.white),
      label: Text(label, style: body(14.5, color: Colors.white, weight: FontWeight.w600)),
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(48),
        shape: const StadiumBorder(),
        side: const BorderSide(color: Colors.white38),
        backgroundColor: Colors.white.withValues(alpha: 0.06),
      ),
    );
  }
}
