import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sensors_plus/sensors_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'account.dart' show whatsNewVersion;
import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Баг-репорт струсом (№286): струснули телефон — знімок екрана й форма «Що пішло не так?».
/// Звернення йде в підтримку (категорія «Помилка») зі знімком, розділом і даними пристрою.
/// Вимикається в Налаштуваннях («Струснути, щоб повідомити про помилку»).
class ShakeToReport extends StatefulWidget {
  const ShakeToReport({required this.router, required this.child, super.key});
  final GoRouter router;
  final Widget child;

  /// Ключ налаштування (типово ввімкнено).
  static const prefKey = 'shake_report';

  @override
  State<ShakeToReport> createState() => _ShakeToReportState();
}

class _ShakeToReportState extends State<ShakeToReport> {
  final _boundary = GlobalKey();
  StreamSubscription<UserAccelerometerEvent>? _sub;
  final _peaks = <DateTime>[];
  DateTime _cooldown = DateTime.fromMillisecondsSinceEpoch(0);
  bool _open = false;

  /// Сила струсу (м/с² без гравітації) і скільки поштовхів за 0,8 с — щоб не спрацьовувало в кишені.
  static const _threshold = 18.0;
  static const _peaksNeeded = 3;

  @override
  void initState() {
    super.initState();
    unawaited(_listen());
  }

  Future<void> _listen() async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(ShakeToReport.prefKey) == false || !mounted) return;
    try {
      _sub = userAccelerometerEventStream(samplingPeriod: SensorInterval.gameInterval).listen(_onEvent, onError: (_) {});
    } catch (_) {
      // Немає акселерометра (емулятор, планшет) — просто без струсу.
    }
  }

  void _onEvent(UserAccelerometerEvent e) {
    final force = math.sqrt(e.x * e.x + e.y * e.y + e.z * e.z);
    if (force < _threshold) return;
    final now = DateTime.now();
    if (now.isBefore(_cooldown) || _open) return;
    _peaks
      ..add(now)
      ..removeWhere((t) => now.difference(t) > const Duration(milliseconds: 800));
    if (_peaks.length >= _peaksNeeded) {
      _peaks.clear();
      _cooldown = now.add(const Duration(seconds: 4));
      unawaited(_report());
    }
  }

  Future<void> _report() async {
    final context = widget.router.routerDelegate.navigatorKey.currentContext;
    if (context == null || !context.mounted) return;
    // Лише для тих, хто увійшов: звернення прив’язане до акаунта.
    if (AppScope.read(context).session.me == null) return;
    _open = true;
    final shot = await _capture();
    final route = widget.router.routeInformationProvider.value.uri.toString();
    if (!context.mounted) {
      _open = false;
      return;
    }
    await showGcSheet<bool>(context, title: tr('Щось пішло не так?'), builder: (_) => _BugReportForm(screenshot: shot, route: route));
    _open = false;
  }

  /// Знімок поточного екрана (до відкриття форми) у тимчасовий PNG.
  Future<File?> _capture() async {
    try {
      final boundary = _boundary.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) return null;
      final image = await boundary.toImage(pixelRatio: 1.5);
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      if (data == null) return null;
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/gamecon-bug-${DateTime.now().millisecondsSinceEpoch}.png');
      await file.writeAsBytes(data.buffer.asUint8List());
      return file;
    } catch (_) {
      return null;
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RepaintBoundary(key: _boundary, child: widget.child);
}

class _BugReportForm extends StatefulWidget {
  const _BugReportForm({required this.screenshot, required this.route});
  final File? screenshot;
  final String route;

  @override
  State<_BugReportForm> createState() => _BugReportFormState();
}

class _BugReportFormState extends State<_BugReportForm> {
  final message = TextEditingController();
  bool attach = true;
  bool busy = false;

  @override
  void dispose() {
    message.dispose();
    super.dispose();
  }

  String get _device {
    final view = WidgetsBinding.instance.platformDispatcher.views.first;
    final size = view.physicalSize / view.devicePixelRatio;
    return 'GameCon $whatsNewVersion · ${Platform.operatingSystem} ${Platform.operatingSystemVersion} · '
        '${size.width.round()}×${size.height.round()} · ${widget.route}';
  }

  Future<void> _send() async {
    if (message.text.trim().length < 10) {
      toast(context, tr('Опишіть, що сталося, хоча б кількома словами.'));
      return;
    }
    setState(() => busy = true);
    final shot = widget.screenshot;
    final ok = await attempt(context, () async {
      final api = AppScope.read(context).session.api;
      await api.upload(Api.site('/support'), {
        'category': 'bug',
        'subject': tr('Помилка в застосунку: {route}', {'route': widget.route.length > 60 ? widget.route.substring(0, 60) : widget.route}),
        'body': message.text.trim(),
        'url': widget.route.startsWith('/') ? widget.route : '/${widget.route}',
        'device': _device,
      }, [
        if (attach && shot != null) await http.MultipartFile.fromPath('files[]', shot.path, filename: 'screenshot.png'),
      ]);
    }, success: tr('Дякуємо! Звернення надіслано в підтримку.'));
    if (!mounted) return;
    setState(() => busy = false);
    if (ok) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final shot = widget.screenshot;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
      Text(tr('Опишіть, що робили й що вийшло не так — ми передамо розробникам.'), style: body(13.5, color: muted)),
      const SizedBox(height: 12),
      GcField(controller: message, label: tr('Що сталося'), maxLines: 5, minLines: 3),
      if (shot != null) ...[
        const SizedBox(height: 12),
        Row(children: [
          ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.file(shot, width: 56, height: 96, fit: BoxFit.cover)),
          const SizedBox(width: 12),
          Expanded(
            child: CheckboxListTile(
              value: attach,
              onChanged: (v) => setState(() => attach = v ?? true),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              title: Text(tr('Прикласти знімок екрана'), style: body(14)),
              subtitle: Text(tr('Перевірте, чи на ньому немає особистого.'), style: body(12, color: muted)),
            ),
          ),
        ]),
      ],
      const SizedBox(height: 16),
      PrimaryButton(label: tr('Надіслати'), icon: LucideIcons.bug, busy: busy, onPressed: _send),
    ]);
  }
}
