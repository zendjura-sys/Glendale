import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'api.dart';
import 'i18n.dart';
import 'theme.dart';
import 'widgets.dart';

/// «Увійти через застосунок GameCon»: сайт створює запит на вхід, а застосунок (уже з акаунтом)
/// його підтверджує. Запит відкривається з посилання gamecon://app-login/{id}, QR-коду сайту
/// (https://gamecon.online/app-login/{id}) або push-сповіщення {type: 'app_login', id}.
///
/// Шляхи API — тут, в одному місці.
class AppLoginApi {
  static String show(String id) => '/api/v1/auth/app-login/${Uri.encodeComponent(id)}';
  static String approve(String id) => '${show(id)}/approve';
  static String deny(String id) => '${show(id)}/deny';
}

/// Id запиту на вхід із посилання (null — це не посилання входу).
String? appLoginIdFrom(Uri? uri) {
  if (uri == null) return null;
  final List<String> parts;
  if (uri.scheme == 'gamecon' && uri.host == 'app-login') {
    parts = uri.pathSegments.where((p) => p.isNotEmpty).toList();
  } else if ((uri.scheme == 'https' || uri.scheme == 'http') && (uri.host == 'gamecon.online' || uri.host == 'www.gamecon.online')) {
    final all = uri.pathSegments.where((p) => p.isNotEmpty).toList();
    if (all.isEmpty || all.first != 'app-login') return null;
    parts = all.sublist(1);
  } else if (uri.scheme.isEmpty && uri.host.isEmpty) {
    // Шлях сайту з push-сповіщення: /app-login/{id}.
    final all = uri.pathSegments.where((p) => p.isNotEmpty).toList();
    if (all.isEmpty || all.first != 'app-login') return null;
    parts = all.sublist(1);
  } else {
    return null;
  }
  if (parts.length != 1) return null;
  final id = parts.single;
  return RegExp(r'^[A-Za-z0-9_-]{1,128}$').hasMatch(id) ? id : null;
}

enum _Stage { loading, ready, approved, denied, expired, failed }

/// Екран «Запит на вхід»: хто входить, звідки, і вибір числа, яке показано на сайті.
class AppLoginScreen extends StatefulWidget {
  const AppLoginScreen({required this.api, required this.id, this.onDone, super.key});
  final Api api;
  final String id;

  /// Для тестів: що робити після «Готово» (інакше — назад або на стрічку).
  final VoidCallback? onDone;

  @override
  State<AppLoginScreen> createState() => _AppLoginScreenState();
}

class _AppLoginScreenState extends State<AppLoginScreen> {
  _Stage stage = _Stage.loading;
  Map<String, dynamic> request = {};
  List<String> choices = [];
  String? picked;
  String? error;
  bool approving = false;
  bool denying = false;
  Timer? _expiry;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _expiry?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final json = await widget.api.get(AppLoginApi.show(widget.id));
      if (!mounted) return;
      final raw = json['code_choices'];
      setState(() {
        request = json;
        choices = raw is List ? [for (final c in raw) '$c'] : [];
        stage = _Stage.ready;
      });
      _watchExpiry();
    } on ApiException catch (e) {
      _fail(e);
    }
  }

  /// Запит живе недовго — коли час вийшов, показуємо «Запит застарів», не чекаючи сервера.
  void _watchExpiry() {
    final at = DateTime.tryParse(text(request['expires_at']) ?? '');
    if (at == null) return;
    final left = at.difference(DateTime.now());
    _expiry?.cancel();
    _expiry = Timer(left.isNegative ? Duration.zero : left, () {
      if (mounted && stage == _Stage.ready) setState(() => stage = _Stage.expired);
    });
  }

  void _fail(ApiException e) {
    if (!mounted) return;
    _expiry?.cancel();
    setState(() {
      approving = false;
      denying = false;
      if (e.status == 410 || e.status == 404) {
        stage = _Stage.expired;
      } else {
        stage = _Stage.failed;
        error = e.message;
      }
    });
  }

  Future<void> _approve() async {
    final code = picked;
    if (code == null || approving || denying) return;
    setState(() {
      approving = true;
      error = null;
    });
    try {
      await widget.api.post(AppLoginApi.approve(widget.id), {'code': code});
      if (!mounted) return;
      _expiry?.cancel();
      setState(() {
        approving = false;
        stage = _Stage.approved;
      });
    } on ApiException catch (e) {
      // Не те число — лишаємо запит відкритим, щоб можна було вибрати інше.
      if (e.status == 422) {
        if (!mounted) return;
        setState(() {
          approving = false;
          picked = null;
          error = e.message;
        });
        return;
      }
      _fail(e);
    }
  }

  Future<void> _deny() async {
    if (approving || denying) return;
    setState(() {
      denying = true;
      error = null;
    });
    try {
      await widget.api.post(AppLoginApi.deny(widget.id));
      if (!mounted) return;
      _expiry?.cancel();
      setState(() {
        denying = false;
        stage = _Stage.denied;
      });
    } on ApiException catch (e) {
      _fail(e);
    }
  }

  void _close() {
    if (widget.onDone != null) return widget.onDone!();
    final router = GoRouter.maybeOf(context);
    if (router == null) {
      Navigator.maybePop(context);
    } else if (router.canPop()) {
      router.pop();
    } else {
      router.go('/feed');
    }
  }

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.disableAnimationsOf(context);
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stage(
        child: SafeArea(
          child: Column(children: [
            Align(
              alignment: Alignment.centerLeft,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(8, 4, 8, 0),
                child: IconButton(tooltip: tr('Закрити'), onPressed: _close, icon: Icon(LucideIcons.x, color: soft)),
              ),
            ),
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 440),
                    child: MatteGlass(
                      borderRadius: 28,
                      padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
                      child: AnimatedSwitcher(
                        duration: reduce ? Duration.zero : const Duration(milliseconds: 260),
                        switchInCurve: Curves.easeOutCubic,
                        child: KeyedSubtree(key: ValueKey(stage), child: _body(reduce)),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _body(bool reduce) => switch (stage) {
        _Stage.loading => const SizedBox(height: 220, child: Center(child: CircularProgressIndicator())),
        _Stage.ready => _request(),
        _Stage.approved => _Outcome(
            icon: LucideIcons.check,
            color: green,
            title: tr('Вхід підтверджено'),
            text: tr('Можете повернутися до браузера.'),
            animate: !reduce,
            onDone: _close,
          ),
        _Stage.denied => _Outcome(icon: LucideIcons.x, color: dangerSoft, title: tr('Вхід скасовано'), text: tr('Сайт не отримав доступу до акаунта.'), animate: !reduce, onDone: _close),
        _Stage.expired => _Outcome(icon: LucideIcons.clock, color: muted, title: tr('Запит застарів'), text: tr('Почніть вхід на сайті ще раз.'), animate: !reduce, onDone: _close),
        _Stage.failed => _Outcome(icon: LucideIcons.triangleAlert, color: dangerSoft, title: tr('Не вдалося відкрити запит'), text: error ?? tr('Щось пішло не так.'), animate: !reduce, onDone: _close),
      };

  Widget _request() {
    final device = [text(request['browser']), text(request['os'])].whereType<String>().join(' · ');
    final place = [text(request['ip_city']), text(request['ip_country'])].whereType<String>().join(', ');
    final at = text(request['created_at']);
    final busy = approving || denying;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Center(
        child: Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(color: indigo.withValues(alpha: 0.16), shape: BoxShape.circle),
          child: const Icon(LucideIcons.monitorSmartphone, color: Color(0xFF9DD8FF), size: 30),
        ),
      ),
      const SizedBox(height: 16),
      Text(tr('Запит на вхід'), textAlign: TextAlign.center, style: body(13, color: muted, weight: FontWeight.w600)),
      const SizedBox(height: 6),
      Text(tr('Хтось намагається увійти у ваш акаунт'), textAlign: TextAlign.center, style: display(20)),
      const SizedBox(height: 18),
      _Detail(icon: LucideIcons.monitor, label: device.isEmpty ? tr('Невідомий браузер') : device),
      _Detail(icon: LucideIcons.mapPin, label: place.isEmpty ? tr('Місце невідоме') : tr('Приблизно: {place}', {'place': place})),
      if (at != null) _Detail(icon: LucideIcons.clock, label: _when(at)),
      const SizedBox(height: 18),
      Text(tr('Виберіть число, яке показано на сайті'), textAlign: TextAlign.center, style: body(14.5, color: soft, weight: FontWeight.w600)),
      const SizedBox(height: 12),
      Row(children: [
        for (final (i, c) in choices.indexed) ...[
          if (i > 0) const SizedBox(width: 10),
          Expanded(child: _Choice(value: c, selected: picked == c, onTap: busy
                  ? null
                  : () => setState(() {
                        picked = c;
                        error = null;
                      }))),
        ],
      ]),
      if (error != null) ...[
        const SizedBox(height: 10),
        Text(error!, textAlign: TextAlign.center, style: body(13, color: dangerSoft)),
      ],
      const SizedBox(height: 18),
      PrimaryButton(label: tr('Увійти'), icon: LucideIcons.logIn, busy: approving, onPressed: picked == null || denying ? null : _approve),
      const SizedBox(height: 10),
      GhostButton(label: tr('Скасувати'), icon: LucideIcons.shieldX, onPressed: busy ? null : _deny),
      const SizedBox(height: 12),
      Text(tr('Не ви? Натисніть «Скасувати» — без вашого підтвердження вхід не відбудеться.'), textAlign: TextAlign.center, style: body(12, color: faint)),
    ]);
  }

  String _when(String iso) {
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    final now = DateTime.now();
    if (DateUtils.isSameDay(dt, now)) return tr('Сьогодні о {time}', {'time': clock(iso)});
    return '${fullDate(iso)}, ${clock(iso)}';
  }
}

class _Detail extends StatelessWidget {
  const _Detail({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(children: [
          Icon(icon, size: 17, color: muted),
          const SizedBox(width: 10),
          Expanded(child: Text(label, style: body(14, color: soft))),
        ]),
      );
}

/// Велика кнопка-число: вибране — з акцентною рамкою.
class _Choice extends StatelessWidget {
  const _Choice({required this.value, required this.selected, required this.onTap});
  final String value;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.disableAnimationsOf(context);
    return Semantics(
      button: true,
      selected: selected,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: AnimatedContainer(
            duration: reduce ? Duration.zero : const Duration(milliseconds: 160),
            height: 72,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: selected ? indigo.withValues(alpha: 0.22) : fg.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: selected ? indigo : lineStrong, width: selected ? 2 : 1),
            ),
            child: Text(value, style: display(28, color: selected ? ink : soft)),
          ),
        ),
      ),
    );
  }
}

/// Підсумок: підтверджено / скасовано / застаріло. Позначка з’являється з легким «пружинням».
class _Outcome extends StatelessWidget {
  const _Outcome({required this.icon, required this.color, required this.title, required this.text, required this.animate, required this.onDone});
  final IconData icon;
  final Color color;
  final String title;
  final String text;
  final bool animate;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final mark = Container(
      width: 76,
      height: 76,
      decoration: BoxDecoration(color: color.withValues(alpha: 0.16), shape: BoxShape.circle, border: Border.all(color: color.withValues(alpha: 0.5), width: 2)),
      child: Icon(icon, color: color, size: 36),
    );
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SizedBox(height: 8),
      Center(
        child: animate
            ? TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 1),
                duration: const Duration(milliseconds: 520),
                curve: Curves.easeOutBack,
                builder: (_, t, child) => Opacity(opacity: t.clamp(0, 1), child: Transform.scale(scale: 0.6 + 0.4 * t, child: child)),
                child: mark,
              )
            : mark,
      ),
      const SizedBox(height: 18),
      Text(title, textAlign: TextAlign.center, style: display(21)),
      const SizedBox(height: 8),
      Text(text, textAlign: TextAlign.center, style: body(14, color: soft)),
      const SizedBox(height: 22),
      PrimaryButton(label: tr('Готово'), onPressed: onDone),
    ]);
  }
}

/// «Сканувати QR для входу»: камера читає QR-код зі сторінки входу сайту й відкриває запит.
class AppLoginScanScreen extends StatefulWidget {
  const AppLoginScanScreen({super.key});

  @override
  State<AppLoginScanScreen> createState() => _AppLoginScanScreenState();
}

class _AppLoginScanScreenState extends State<AppLoginScanScreen> {
  final controller = MobileScannerController(formats: const [BarcodeFormat.qrCode], detectionSpeed: DetectionSpeed.noDuplicates);
  bool done = false;
  String? hint;

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  void _detect(BarcodeCapture capture) {
    if (done) return;
    for (final code in capture.barcodes) {
      final id = appLoginIdFrom(Uri.tryParse(code.rawValue ?? ''));
      if (id == null) continue;
      done = true;
      unawaited(controller.stop());
      context.pushReplacement('/app-login/$id');
      return;
    }
    setState(() => hint = tr('Це не QR-код входу GameCon.'));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(fit: StackFit.expand, children: [
        MobileScanner(
          controller: controller,
          onDetect: _detect,
          errorBuilder: (_, e) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                e.errorCode == MobileScannerErrorCode.permissionDenied ? tr('Дозвольте доступ до камери в налаштуваннях телефону.') : tr('Камера недоступна.'),
                textAlign: TextAlign.center,
                style: body(14.5, color: Colors.white),
              ),
            ),
          ),
        ),
        // Рамка-приціл.
        Center(
          child: IgnorePointer(
            child: Container(
              width: 240,
              height: 240,
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(28), border: Border.all(color: Colors.white.withValues(alpha: 0.85), width: 2)),
            ),
          ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              Align(
                alignment: Alignment.centerLeft,
                child: IconButton(tooltip: tr('Закрити'), onPressed: () => context.pop(), icon: const Icon(LucideIcons.x, color: Colors.white)),
              ),
              const Spacer(),
              MatteGlass(
                padding: const EdgeInsets.all(16),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text(tr('Сканувати QR для входу'), textAlign: TextAlign.center, style: display(17)),
                  const SizedBox(height: 6),
                  Text(
                    hint ?? tr('На сайті виберіть «Увійти через застосунок GameCon» і наведіть камеру на QR-код.'),
                    textAlign: TextAlign.center,
                    style: body(13.5, color: hint == null ? soft : dangerSoft),
                  ),
                ]),
              ),
            ]),
          ),
        ),
      ]),
    );
  }
}
