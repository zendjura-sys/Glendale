import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'alerts_config.dart';
import 'api.dart';
import 'i18n.dart';
import 'theme.dart';
import 'widgets.dart';

// Мапа тривог як на сайті (`resources/js/components/alerts/alert-map.tsx`): райони й громади, зафарбовані
// за видом тривоги, жовтий рівень, штрих для тривоги понад добу, зона відчуження, значки цілей за різновидом.
// Межі — `assets/geo/ua-units.json` і `ua-hromadas.json` (копії `resources/js/data/*`; © OpenStreetMap, ODbL),
// шляхи вже в проєкції 1000×680.

/// Код типу зони з відповіді: новий `type` (AlertType) або старий `kind` — для сумісності.
AlertTypeCode unitType(Map<String, dynamic> unit) => AlertsConfig.typeOf(unit['type']) ?? AlertsConfig.typeOf(unit['kind']) ?? AlertTypeCode.air;

/// Головна тривога області (з сервера `alert`; у старих відповідях — за `active`).
AlertTypeCode regionType(Map<String, dynamic> region) =>
    AlertsConfig.typeOf(region['alert']) ?? (region['active'] == true ? (AlertsConfig.typeOf(region['kind']) ?? AlertTypeCode.air) : AlertTypeCode.clear);

/// Колір цілі за типом (як на сайті).
const threatColors = {
  'uav': Color(0xFF38BDF8),
  'missile': Color(0xFFF97316),
  'ballistic': Color(0xFFEF4444),
  'kab': Color(0xFFFACC15),
  'mig': Color(0xFF22D3EE),
  'artillery': Color(0xFFEAB308),
};

String threatLabel(String type) => switch (type) {
  'uav' => tr('БпЛА'),
  'missile' => tr('Ракета'),
  'ballistic' => tr('Балістика'),
  'kab' => tr('КАБ'),
  'mig' => tr('МіГ-31К'),
  'artillery' => tr('Артилерія'),
  _ => type,
};

/// Назва різновиду, якщо відомий.
String threatTitle(Map<String, dynamic> t) => switch (t['variant']) {
  'shahed' => tr('Shahed / БпЛА'),
  'jet' => tr('Реактивний Shahed'),
  'gerbera' => tr('Гербера (імітатор)'),
  'fpv' => tr('FPV-дрон'),
  'cruise' => tr('Крилата ракета'),
  _ => threatLabel('${t['type']}'),
};

/// Значки цілей 24×24 носом на північ — ті самі шляхи, що й на сайті (`GLYPHS`).
const glyphs = {
  'shahed': 'M12 1c1 0 1.5 1.2 1.5 3v2.6l8.3 10.5V16h1.1v5h-1.1v-1.4h-8.5l-.4 1.2h2.4v1.5H8.7v-1.5h2.4l-.4-1.2H2.2V21H1.1v-5h1.1v1.1l8.3-10.5V4c0-1.8.5-3 1.5-3Z',
  'jet': 'M12 1c1.1 0 1.6 1.4 1.6 3.4v2.3L23 17.4v2.6h-9.1l.1-1.5c0-.5-.4-.7-.7-.4l-.4.6v3.6h-1.8v-3.6l-.4-.6c-.3-.3-.7-.1-.7.4l.1 1.5H1v-2.6l9.4-10.7V4.4C10.4 2.4 10.9 1 12 1Z',
  'fpv': 'M5 1.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8Zm14 0a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8ZM5 15.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8Zm14 0a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8ZM6.2 4.8 12 9.4l5.8-4.6 1.4 1.4-4.6 5.8 4.6 5.8-1.4 1.4-5.8-4.6-5.8 4.6-1.4-1.4 4.6-5.8-4.6-5.8ZM10 6.5h4v11h-4Z',
  'cruise': 'M12 1c.8 0 1.2.8 1.2 2v6.2l8.3 2.1v1.7l-8.3-.7v6.4l3.4 1.9v1.5l-3.4-.6-.2 2.5h-2l-.2-2.5-3.4.6v-1.5l3.4-1.9v-6.4l-8.3.7v-1.7l8.3-2.1V3c0-1.2.4-2 1.2-2Z',
  'ballistic': 'M12 .5l1.5 4.6v4l2 1.7v1.4l-2-.4v8.4l2.2 1.7V23H8.3v-1.1l2.2-1.7v-8.4l-2 .4v-1.4l2-1.7v-4Z',
  'kab': 'M12 1.5c2.6 0 3.8 2.8 3.8 6.7v7l2.6 3.3v2.2l-3.4-1.6-3 3.4-3-3.4-3.4 1.6v-2.2l2.6-3.3v-7c0-3.9 1.2-6.7 3.8-6.7Z',
  'mig': 'M12 .8 13.6 7l8.6 6.1v2.1l-8.7-2.6-.5 6.2 3.1 2.1v1.6l-4.1-1-4.1 1v-1.6l3.1-2.1-.5-6.2-8.7 2.6v-2.1L10.4 7Z',
  'artillery': 'M12 2l2 6 6-2-4 5 5 4-6 .5L13 22l-1-6-4 4.5.8-6.3L3 13.5l5.3-2.6L5 5.5l5.4 2.6Z',
};

/// Значок цілі: різновид, а якщо невідомий — тип.
String glyphKey(Map<String, dynamic> t) {
  final variant = t['variant'];
  if (variant == 'gerbera') return 'shahed';
  if (variant is String && glyphs.containsKey(variant)) return variant;
  return switch (t['type']) {
    'missile' => 'cruise',
    'ballistic' => 'ballistic',
    'kab' => 'kab',
    'mig' => 'mig',
    'artillery' => 'artillery',
    _ => 'shahed',
  };
}

final _glyphCache = <String, Path>{};
Path glyphPath(String key) => _glyphCache.putIfAbsent(key, () => parseSvgPath(glyphs[key] ?? glyphs['shahed']!));

/// Розбір шляху SVG (M L H V C A Z, абсолютні й відносні) у [Path].
Path parseSvgPath(String d) {
  final tokens = RegExp(r'[MmLlHhVvCcAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?').allMatches(d).map((m) => m.group(0)!).toList();
  final path = Path();
  var i = 0;
  var cmd = 'M';
  var x = 0.0, y = 0.0, sx = 0.0, sy = 0.0;
  double n() => double.parse(tokens[i++]);
  bool isCmd(String t) => RegExp(r'^[A-Za-z]$').hasMatch(t);
  while (i < tokens.length) {
    if (isCmd(tokens[i])) cmd = tokens[i++];
    final rel = cmd == cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case 'M':
        final nx = n() + (rel ? x : 0), ny = n() + (rel ? y : 0);
        path.moveTo(nx, ny);
        x = sx = nx;
        y = sy = ny;
        cmd = rel ? 'l' : 'L'; // Далі пари — лінії.
      case 'L':
        x = n() + (rel ? x : 0);
        y = n() + (rel ? y : 0);
        path.lineTo(x, y);
      case 'H':
        x = n() + (rel ? x : 0);
        path.lineTo(x, y);
      case 'V':
        y = n() + (rel ? y : 0);
        path.lineTo(x, y);
      case 'C':
        final x1 = n() + (rel ? x : 0), y1 = n() + (rel ? y : 0);
        final x2 = n() + (rel ? x : 0), y2 = n() + (rel ? y : 0);
        x = n() + (rel ? x : 0);
        y = n() + (rel ? y : 0);
        path.cubicTo(x1, y1, x2, y2, x, y);
      case 'A':
        final rx = n(), ry = n(), rot = n(), large = n() != 0, sweep = n() != 0;
        x = n() + (rel ? x : 0);
        y = n() + (rel ? y : 0);
        path.arcToPoint(Offset(x, y), radius: Radius.elliptical(rx, ry), rotation: rot, largeArc: large, clockwise: sweep);
      case 'Z':
        path.close();
        x = sx;
        y = sy;
        // «Z» без чисел після себе — наступний токен буде командою.
        if (i < tokens.length && !isCmd(tokens[i])) cmd = 'L';
      default:
        i++;
    }
  }
  return path;
}

/// Межі районів, областей і громад (вантажимо раз на весь застосунок).
class UaGeo {
  UaGeo._(this.units, this.oblasts, this.chez);
  final List<({String code, String name, String oblast, Offset label, Path path})> units;
  final List<({String oblast, Path path})> oblasts;
  final ({Path path, Offset label})? chez;
  List<({String code, String name, String oblast, Path path})>? hromadas;

  static Future<UaGeo>? _loading;
  static UaGeo? ready;

  static Future<UaGeo> load() => _loading ??= () async {
    final raw = jsonDecode(await rootBundle.loadString('assets/geo/ua-units.json')) as Map<String, dynamic>;
    final chez = raw['chez'] is Map ? raw['chez'] as Map : null;
    return ready = UaGeo._(
      [
        for (final u in raw['units'] as List)
          (code: '${u['c']}', name: '${u['n']}', oblast: '${u['o']}', label: Offset((u['x'] as num).toDouble(), (u['y'] as num).toDouble()), path: parseSvgPath('${u['d']}')),
      ],
      [for (final o in raw['oblasts'] as List) (oblast: '${o['o']}', path: parseSvgPath('${o['d']}'))],
      chez == null ? null : (path: parseSvgPath('${chez['d']}'), label: Offset((chez['x'] as num).toDouble(), (chez['y'] as num).toDouble())),
    );
  }();

  /// Громади — окремий великий файл, лише коли тривога є саме на рівні громад.
  Future<void> loadHromadas() async {
    if (hromadas != null) return;
    final raw = jsonDecode(await rootBundle.loadString('assets/geo/ua-hromadas.json')) as List;
    hromadas = [for (final h in raw) (code: '${h['c']}', name: '${h['n']}', oblast: '${h['o']}', path: parseSvgPath('${h['d']}'))];
  }
}

/// Проєкція (як на сайті): lng 22.0–40.4, lat 44.2–52.5 → 1000×680.
Offset project(double lat, double lng) => Offset((lng - 22.0) / 18.4 * 1000, (52.5 - lat) / 8.3 * 680);

double _d(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;

/// Найдальше, куди «доповзає» мітка від точки зі зведення (км).
const _maxDriftKm = 200.0;

/// Поточне розрахункове місце цілі: точка + курс × швидкість × час від `position_at` (до «згасання»).
({double lat, double lng}) threatPosition(Map<String, dynamic> t, DateTime now) {
  final lat = _d(t['lat']);
  final lng = _d(t['lng']);
  final course = t['course'];
  final speed = _d(t['speed']);
  final from = DateTime.tryParse('${t['position_at'] ?? t['detected_at'] ?? ''}');
  if (t['area_only'] == true || course is! num || speed <= 0 || from == null) return (lat: lat, lng: lng);
  final expires = DateTime.tryParse('${t['expires_at'] ?? ''}');
  final end = expires != null && expires.isBefore(now) ? expires : now;
  final hours = math.max(0, end.difference(from).inMilliseconds) / 3600000;
  final km = math.min(_maxDriftKm, speed * hours);
  final rad = course * math.pi / 180;
  return (lat: lat + km * math.cos(rad) / 111, lng: lng + km * math.sin(rad) / (111 * math.cos(lat * math.pi / 180)));
}

/// Мапа тривог: заливка районів і громад, межі областей, зона відчуження, рухомі цілі.
/// Дотик по цілі — [onThreat], по району — [onSelect] (область району).
class AlertMapView extends StatefulWidget {
  const AlertMapView({
    required this.regions,
    required this.units,
    required this.threats,
    this.mine,
    this.showAlerts = true,
    this.onSelect,
    this.onThreat,
    this.selected,
    super.key,
  });
  final List<Map<String, dynamic>> regions;
  final List<Map<String, dynamic>> units;
  final List<Map<String, dynamic>> threats;
  final String? mine;
  final bool showAlerts;
  final ValueChanged<String>? onSelect;
  final ValueChanged<Map<String, dynamic>>? onThreat;
  final int? selected;

  @override
  State<AlertMapView> createState() => _AlertMapViewState();
}

class _AlertMapViewState extends State<AlertMapView> with SingleTickerProviderStateMixin {
  UaGeo? geo = UaGeo.ready;
  Timer? tick;
  // М’яка пульсація активних зон; при «менше руху» в системі — без неї.
  late final AnimationController pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 2600));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      pulse.stop();
      pulse.value = 0;
    } else if (!pulse.isAnimating) {
      pulse.repeat();
    }
  }

  @override
  void initState() {
    super.initState();
    if (geo == null) {
      UaGeo.load().then((g) {
        if (mounted) setState(() => geo = g);
        _maybeHromadas();
      });
    } else {
      _maybeHromadas();
    }
    // Цілі рухаються — перемальовуємо раз на секунду.
    tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && widget.threats.isNotEmpty) setState(() {});
    });
  }

  @override
  void didUpdateWidget(AlertMapView old) {
    super.didUpdateWidget(old);
    _maybeHromadas();
  }

  @override
  void dispose() {
    tick?.cancel();
    pulse.dispose();
    super.dispose();
  }

  void _maybeHromadas() {
    final g = geo;
    if (g == null || g.hromadas != null) return;
    final known = {for (final u in g.units) u.code};
    if (widget.units.any((u) => !known.contains(u['code']))) {
      g.loadHromadas().then((_) {
        if (mounted) setState(() {});
      });
    }
  }

  void _tap(Offset local, Size size) {
    final g = geo;
    if (g == null) return;
    final p = local / (size.width / 1000);
    final now = DateTime.now();
    Map<String, dynamic>? best;
    var bestDist = 30.0;
    for (final t in widget.threats) {
      final pos = threatPosition(t, now);
      final dist = (project(pos.lat, pos.lng) - p).distance;
      if (dist < bestDist) {
        bestDist = dist;
        best = t;
      }
    }
    if (best != null) {
      widget.onThreat?.call(best);
      return;
    }
    for (final u in g.units) {
      if (u.path.contains(p)) {
        widget.onSelect?.call(u.oblast);
        return;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final g = geo;
    return LayoutBuilder(builder: (context, box) {
      final size = Size(box.maxWidth, box.maxHeight);
      if (g == null) return const Center(child: CircularProgressIndicator());
      return GestureDetector(
        onTapUp: (d) => _tap(d.localPosition, size),
        child: AnimatedBuilder(
          animation: pulse,
          builder: (_, _) => CustomPaint(
          size: size,
          painter: _AlertMapPainter(
            geo: g,
            regions: widget.regions,
            units: widget.units,
            threats: widget.threats,
            mine: widget.mine,
            showAlerts: widget.showAlerts,
            selected: widget.selected,
            ink: fg,
            now: DateTime.now(),
            pulse: pulse.isAnimating ? (1 - math.cos(pulse.value * 2 * math.pi)) / 2 : 0,
          ),
        ),
        ),
      );
    });
  }
}

class _AlertMapPainter extends CustomPainter {
  _AlertMapPainter({
    required this.geo,
    required this.regions,
    required this.units,
    required this.threats,
    required this.mine,
    required this.showAlerts,
    required this.selected,
    required this.ink,
    required this.now,
    required this.pulse,
  });
  final double pulse;
  final UaGeo geo;
  final List<Map<String, dynamic>> regions;
  final List<Map<String, dynamic>> units;
  final List<Map<String, dynamic>> threats;
  final String? mine;
  final bool showAlerts;
  final int? selected;
  final Color ink;
  final DateTime now;

  /// Штрих поверх області [path]: смуги під 45°.
  void _hatch(Canvas canvas, Path path, Color color, {double gap = 6, double width = 2.2, double angle = 1}) {
    final b = path.getBounds();
    canvas.save();
    canvas.clipPath(path);
    final paint = Paint()
      ..color = color
      ..strokeWidth = width;
    final span = b.width + b.height;
    for (var o = -b.height; o < span; o += gap) {
      canvas.drawLine(Offset(b.left + o, b.top), Offset(b.left + o + b.height * angle, b.bottom), paint);
    }
    canvas.restore();
  }

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 1000);
    final byCode = {for (final u in showAlerts ? units : const <Map<String, dynamic>>[]) '${u['code']}': u};
    // Рівні загроз з цілей (балістика — червоний, БпЛА — жовтий) діють на всю область.
    final levels = {
      for (final r in regions)
        '${r['slug']}': [if (showAlerts) for (final c in (r['threat_levels'] as List?) ?? const []) AlertsConfig.typeOf(c)],
    };
    final noData = {for (final r in regions) if (r['alert'] == 'NO_DATA') '${r['slug']}'};
    final border = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.6
      ..color = ink.withValues(alpha: 0.12);

    /// Головна тривога зони (найвищий пріоритет), кольори за типом і масштабом.
    void fillUnit(String code, String oblast, Path path) {
      final unit = byCode[code];
      var type = AlertsConfig.primary([if (unit != null) unitType(unit), ...?levels[oblast]]);
      if (type == AlertTypeCode.clear && noData.contains(oblast)) type = AlertTypeCode.noData;
      final palette = AlertsConfig.resolveColors(type, type == AlertTypeCode.air ? (AlertsConfig.scaleOf(unit?['scale']) ?? AlertScaleCode.oblast) : null);
      canvas.drawPath(path, Paint()..color = palette.fill);
      final active = type != AlertTypeCode.clear && type != AlertTypeCode.noData;
      if (!active) return;
      final started = DateTime.tryParse('${unit?['started_at'] ?? ''}');
      if (started != null && now.difference(started).inHours >= 24) {
        // Тривога понад добу (окуповані території тощо) — штрих.
        _hatch(canvas, path, Colors.black.withValues(alpha: 0.45));
      } else if (pulse > 0) {
        canvas.drawPath(path, Paint()..color = palette.hex.withValues(alpha: 0.22 * pulse));
      }
      canvas.drawPath(path, Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 0.9
        ..color = palette.border);
    }

    for (final u in geo.units) {
      fillUnit(u.code, u.oblast, u.path);
      canvas.drawPath(u.path, border);
    }
    for (final h in geo.hromadas ?? const <({String code, String name, String oblast, Path path})>[]) {
      if (byCode.containsKey(h.code)) {
        fillUnit(h.code, h.oblast, h.path);
        canvas.drawPath(h.path, border);
      }
    }
    final chez = geo.chez;
    if (chez != null) {
      // Зона відчуження — завжди штрих поверх заливки.
      _hatch(canvas, chez.path, Colors.black.withValues(alpha: 0.55), gap: 5, width: 1.8);
      canvas.drawPath(chez.path, Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 0.8
        ..color = Colors.white.withValues(alpha: 0.45));
      _icon(canvas, LucideIcons.radiation, chez.label, 15, Colors.white.withValues(alpha: 0.85));
    }
    for (final o in geo.oblasts) {
      final isMine = o.oblast == mine;
      canvas.drawPath(o.path, Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = isMine ? 2.2 : 1.1
        ..color = isMine ? Colors.white.withValues(alpha: 0.9) : ink.withValues(alpha: 0.35));
    }
    for (final r in regions) {
      if (r['slug'] == 'kyiv') continue;
      final name = '${r['name']}'.replaceAll(' область', '').replaceAll('Автономна Республіка ', '');
      _text(canvas, name, project(_d(r['lat']), _d(r['lng'])), 14, ink.withValues(alpha: 0.62), weight: FontWeight.w600);
    }
    for (final u in byCode.values) {
      final type = unitType(u);
      if (type != AlertTypeCode.nuclear && type != AlertTypeCode.chemical) continue;
      final shape = geo.units.where((s) => s.code == u['code']).firstOrNull;
      if (shape != null) _icon(canvas, AlertsConfig.types[type]!.icon, shape.label, 20, AlertsConfig.types[type]!.palette.text);
    }

    for (final t in threats) {
      if (t['region'] == null) continue;
      final origin = project(_d(t['lat']), _d(t['lng']));
      final pos = threatPosition(t, now);
      final p = project(pos.lat, pos.lng);
      final advisory = t['advisory'] == true;
      final base = advisory ? const Color(0xFF94A3B8) : (threatColors['${t['type']}'] ?? const Color(0xFF38BDF8));
      final color = base.withValues(alpha: 0.45 + _d(t['confidence']) / 100 * 0.55);
      if ((p - origin).distance > 1) {
        // Слід від точки виявлення пунктиром.
        final trail = Paint()
          ..color = base.withValues(alpha: 0.45)
          ..strokeWidth = 2;
        const parts = 10;
        for (var i = 0; i < parts; i += 2) {
          canvas.drawLine(Offset.lerp(origin, p, i / parts)!, Offset.lerp(origin, p, (i + 1) / parts)!, trail);
        }
      }
      if (t['area_only'] == true) {
        // Відома лише область — пунктирне коло замість місця.
        canvas.drawCircle(p, 28, Paint()..color = base.withValues(alpha: 0.08));
        canvas.drawCircle(p, 28, Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2
          ..color = base.withValues(alpha: 0.6));
      }
      if (t['id'] == selected) {
        canvas.drawCircle(p, 17, Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..color = Colors.white.withValues(alpha: 0.8));
      }
      canvas.save();
      canvas.translate(p.dx, p.dy);
      final course = t['course'];
      if (course is num) canvas.rotate(course * math.pi / 180);
      canvas.scale(1.15);
      canvas.translate(-12, -12);
      final glyph = glyphPath(glyphKey(t));
      canvas.drawPath(glyph, Paint()..color = color);
      canvas.drawPath(glyph, Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.3
        ..strokeJoin = StrokeJoin.round
        ..color = const Color(0xFF0B1220));
      canvas.restore();
      final count = (t['count'] as num?)?.toInt() ?? 1;
      if (count > 1) _text(canvas, '×$count', p + const Offset(18, -12), 11, Colors.white, weight: FontWeight.w700);
    }
    _text(canvas, '© OpenStreetMap · ODbL', const Offset(940, 672), 10, ink.withValues(alpha: 0.35));
    canvas.restore();
  }

  /// Іконка Lucide на мапі (шрифт іконок) по центру точки.
  void _icon(Canvas canvas, IconData icon, Offset center, double size, Color color) {
    final tp = TextPainter(
      text: TextSpan(text: String.fromCharCode(icon.codePoint), style: TextStyle(fontFamily: icon.fontFamily, package: icon.fontPackage, fontSize: size, color: color)),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, center - Offset(tp.width / 2, tp.height / 2));
  }

  void _text(Canvas canvas, String value, Offset center, double size, Color color, {FontWeight weight = FontWeight.w400}) {
    final tp = TextPainter(
      text: TextSpan(text: value, style: body(size, color: color, weight: weight)),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, center - Offset(tp.width / 2, tp.height / 2));
  }

  @override
  bool shouldRepaint(_AlertMapPainter old) => true;
}

/// Значок цілі для списків і легенди.
class ThreatGlyph extends StatelessWidget {
  const ThreatGlyph(this.threat, {this.size = 18, super.key});
  final Map<String, dynamic> threat;
  final double size;

  @override
  Widget build(BuildContext context) => CustomPaint(
    size: Size.square(size),
    painter: _GlyphPainter(glyphKey(threat), threat['advisory'] == true ? const Color(0xFF94A3B8) : (threatColors['${threat['type']}'] ?? accent)),
  );
}

class _GlyphPainter extends CustomPainter {
  _GlyphPainter(this.key, this.color);
  final String key;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 24);
    canvas.drawPath(glyphPath(key), Paint()..color = color);
  }

  @override
  bool shouldRepaint(_GlyphPainter old) => old.key != key || old.color != color;
}

/// «4 хв тому», «щойно».
String agoMinutes(dynamic iso) {
  final at = DateTime.tryParse('${iso ?? ''}');
  if (at == null) return '';
  final min = math.max(0, DateTime.now().difference(at).inMinutes);
  if (min < 1) return tr('щойно');
  if (min < 60) return tr('{m} хв тому', {'m': '$min'});
  return tr('{h} год {m} хв тому', {'h': '${min ~/ 60}', 'm': '${min % 60}'});
}

/// Картка цілі (як на сайті): тип, ≈ місце, швидкість і курс, коли помічена й оновлена, джерела.
Future<void> showThreatCard(BuildContext context, Map<String, dynamic> t, String? regionName) {
  final count = (t['count'] as num?)?.toInt() ?? 1;
  final region = regionName?.replaceAll(' область', '').replaceAll('Автономна Республіка ', '');
  final place = text(t['place']) ?? tr('Україна');
  final speed = (t['speed'] as num?)?.toInt() ?? 0;
  final course = t['course'];
  Widget row(IconData icon, Color color, String value, {Color? textColor}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, size: 18, color: color),
      const SizedBox(width: 10),
      Expanded(child: Text(value, style: body(14.5, color: textColor ?? soft))),
    ]),
  );
  return showGcSheet<void>(
    context,
    title: '${threatTitle(t)}${count > 1 ? ' ×$count' : ''}',
    builder: (_) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      row(
        LucideIcons.mapPin,
        const Color(0xFFF87171),
        '≈ $place${region != null && t['place'] != regionName ? ', $region' : ''} ${t['area_only'] == true ? tr('(відома лише область)') : (t['uncertainty_km'] is num ? tr('(± {km} км)', {'km': '${t['uncertainty_km']}'}) : tr('(орієнтовно)'))}',
      ),
      if (speed > 0 || course is num)
        row(LucideIcons.gauge, const Color(0xFFFCD34D), [if (speed > 0) tr('{v} км/год', {'v': '$speed'}), if (course is num) tr('курс {c}°', {'c': '$course'})].join(' · ')),
      if (t['advisory'] == true) row(LucideIcons.info, muted, tr('Спостереження, а не сигнал ховатися: широкої офіційної тривоги немає.'), textColor: muted),
      const Divider(height: 20),
      row(LucideIcons.clock, muted, tr('вперше помічена {t}', {'t': agoMinutes(t['detected_at'])}), textColor: muted),
      row(LucideIcons.refreshCw, muted, tr('оновлено {t}', {'t': agoMinutes(t['updated_at'] ?? t['detected_at'])}), textColor: muted),
      row(LucideIcons.radio, muted, tr('джерел: {n} · упевненість {c}%', {'n': '${(t['sources'] as List?)?.length ?? 1}', 'c': '${t['confidence'] ?? 0}'}), textColor: muted),
    ]),
  );
}
