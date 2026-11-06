import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'core/widgets/arctic_glass/arctic_glass.dart';
import 'i18n.dart';

// Єдина схема тривог (Мінцифри / Ajax ukrainealarm, alerts.in.ua, NEPTUN) — як `App\Enums\AlertType`
// й `AlertScale` на сервері та `resources/js/lib/alerts-config.ts` на сайті. Палітра — під темне матове скло.

enum AlertTypeCode { nuclear, chemical, ballistic, air, artillery, urbanFights, uav, clear, noData }

enum AlertScaleCode { oblast, raion, hromada, city }

/// Кольори зони/плашки: основний, заливка, обвідка зони й текст.
class AlertPalette {
  const AlertPalette(this.hex, this.fill, this.border, this.text);
  final Color hex;
  final Color fill;
  final Color border;
  final Color text;
}

class AlertTypeMeta {
  const AlertTypeMeta(this.priority, this.icon, this.palette);
  final int priority;
  final IconData icon;
  final AlertPalette palette;
}

abstract final class AlertsConfig {
  static const types = <AlertTypeCode, AlertTypeMeta>{
    AlertTypeCode.nuclear: AlertTypeMeta(100, LucideIcons.radiation, AlertPalette(Color(0xFF9333EA), Color.fromRGBO(147, 51, 234, 0.34), Color.fromRGBO(192, 132, 252, 0.55), Color(0xFFC084FC))),
    AlertTypeCode.chemical: AlertTypeMeta(90, LucideIcons.biohazard, AlertPalette(Color(0xFF84CC16), Color.fromRGBO(132, 204, 22, 0.30), Color.fromRGBO(163, 230, 53, 0.52), Color(0xFFA3E635))),
    AlertTypeCode.ballistic: AlertTypeMeta(80, LucideIcons.flame, AlertPalette(Color(0xFFBE123C), Color.fromRGBO(190, 18, 60, 0.44), Color.fromRGBO(251, 113, 133, 0.65), Color(0xFFFDA4AF))),
    AlertTypeCode.air: AlertTypeMeta(70, LucideIcons.siren, AlertPalette(Color(0xFFDC2626), Color.fromRGBO(220, 38, 38, 0.38), Color.fromRGBO(248, 113, 113, 0.60), Color(0xFFF87171))),
    AlertTypeCode.artillery: AlertTypeMeta(60, LucideIcons.bomb, AlertPalette(Color(0xFFF97316), Color.fromRGBO(249, 115, 22, 0.32), Color.fromRGBO(251, 146, 60, 0.52), Color(0xFFFB923C))),
    AlertTypeCode.urbanFights: AlertTypeMeta(50, LucideIcons.swords, AlertPalette(Color(0xFFEA580C), Color.fromRGBO(234, 88, 12, 0.35), Color.fromRGBO(249, 115, 22, 0.55), Color(0xFFF97316))),
    AlertTypeCode.uav: AlertTypeMeta(40, LucideIcons.plane, AlertPalette(Color(0xFFF59E0B), Color.fromRGBO(245, 158, 11, 0.26), Color.fromRGBO(251, 191, 36, 0.48), Color(0xFFFBBF24))),
    AlertTypeCode.clear: AlertTypeMeta(10, LucideIcons.shieldCheck, AlertPalette(Color(0xFF10B981), Color.fromRGBO(16, 185, 129, 0.14), Color.fromRGBO(52, 211, 153, 0.35), Color(0xFF34D399))),
    AlertTypeCode.noData: AlertTypeMeta(0, LucideIcons.circleHelp, AlertPalette(Color(0xFF475569), Color.fromRGBO(71, 85, 105, 0.28), Color.fromRGBO(100, 116, 139, 0.40), Color(0xFF94A3B8))),
  };

  /// Повітряна тривога за масштабом: уся область — найнасиченіша, населений пункт — найлегша.
  static const airScale = <AlertScaleCode, AlertPalette>{
    AlertScaleCode.oblast: AlertPalette(Color(0xFFDC2626), Color.fromRGBO(220, 38, 38, 0.38), Color.fromRGBO(248, 113, 113, 0.60), Color(0xFFF87171)),
    AlertScaleCode.raion: AlertPalette(Color(0xFFE11D48), Color.fromRGBO(225, 29, 72, 0.30), Color.fromRGBO(251, 113, 133, 0.50), Color(0xFFFB7185)),
    AlertScaleCode.hromada: AlertPalette(Color(0xFFF43F5E), Color.fromRGBO(244, 63, 94, 0.24), Color.fromRGBO(251, 113, 133, 0.42), Color(0xFFFDA4AF)),
    AlertScaleCode.city: AlertPalette(Color(0xFFFB7185), Color.fromRGBO(251, 113, 133, 0.18), Color.fromRGBO(253, 164, 175, 0.38), Color(0xFFFECDD3)),
  };

  /// Суцільні заливки зон на мапі в стилі alerts.in.ua (бежевий, лососевий, жовтий) — як `MAP_FILL.light` на сайті.
  static const mapFill = <AlertTypeCode, Color>{
    AlertTypeCode.nuclear: Color(0xFFA78BFA),
    AlertTypeCode.chemical: Color(0xFF9CCC4A),
    AlertTypeCode.ballistic: Color(0xFFD2463E),
    AlertTypeCode.air: Color(0xFFE8776C),
    AlertTypeCode.artillery: Color(0xFFF39A4A),
    AlertTypeCode.urbanFights: Color(0xFFE0783A),
    AlertTypeCode.uav: Color(0xFFFFC93C),
    AlertTypeCode.clear: Color(0xFFECE2D4),
    AlertTypeCode.noData: Color(0xFFD8D2C9),
  };
  static const mapAirScaleFill = <AlertScaleCode, Color>{
    AlertScaleCode.oblast: Color(0xFFE8776C),
    AlertScaleCode.raion: Color(0xFFEC897F),
    AlertScaleCode.hromada: Color(0xFFF09B92),
    AlertScaleCode.city: Color(0xFFF3ADA6),
  };

  /// Колір заливки зони на мапі: для AIR — за масштабом.
  static Color mapColor(AlertTypeCode type, [AlertScaleCode? scale]) =>
      type == AlertTypeCode.air && scale != null ? mapAirScaleFill[scale]! : mapFill[type]!;

  /// Від найважливішої до найменш важливої (для легенди).
  static List<AlertTypeCode> get ordered => AlertTypeCode.values.toList()..sort((a, b) => types[b]!.priority - types[a]!.priority);

  static String label(AlertTypeCode type) => switch (type) {
    AlertTypeCode.nuclear => tr('Радіаційна небезпека'),
    AlertTypeCode.chemical => tr('Хімічна загроза'),
    AlertTypeCode.ballistic => tr('Ракетна небезпека (Балістика)'),
    AlertTypeCode.air => tr('Повітряна тривога'),
    AlertTypeCode.artillery => tr('Загроза артобстрілу'),
    AlertTypeCode.urbanFights => tr('Вуличні бої'),
    AlertTypeCode.uav => tr('Загроза БпЛА'),
    AlertTypeCode.clear => tr('Немає тривоги'),
    AlertTypeCode.noData => tr('Немає даних'),
  };

  static String short(AlertTypeCode type) => switch (type) {
    AlertTypeCode.nuclear => tr('Радіація'),
    AlertTypeCode.chemical => tr('Хімзагроза'),
    AlertTypeCode.ballistic => tr('Балістика'),
    AlertTypeCode.air => tr('Тривога'),
    AlertTypeCode.artillery => tr('Артобстріл'),
    AlertTypeCode.urbanFights => tr('Бої'),
    AlertTypeCode.uav => tr('БпЛА'),
    AlertTypeCode.clear => tr('Спокійно'),
    AlertTypeCode.noData => tr('Невідомо'),
  };

  static String scaleLabel(AlertScaleCode scale) => switch (scale) {
    AlertScaleCode.oblast => tr('Вся область'),
    AlertScaleCode.raion => tr('Район'),
    AlertScaleCode.hromada => tr('Громада (ОТГ)'),
    AlertScaleCode.city => tr('Населений пункт'),
  };

  /// Код з API (`AIR`, `URBAN_FIGHTS`, старі `air_raid` тощо) → тип; невідоме — null.
  static AlertTypeCode? typeOf(dynamic raw) => switch ('${raw ?? ''}'.toUpperCase()) {
    'NUCLEAR' => AlertTypeCode.nuclear,
    'CHEMICAL' => AlertTypeCode.chemical,
    'BALLISTIC' => AlertTypeCode.ballistic,
    'AIR' || 'AIR_RAID' => AlertTypeCode.air,
    'ARTILLERY' || 'ARTILLERY_SHELLING' => AlertTypeCode.artillery,
    'URBAN_FIGHTS' => AlertTypeCode.urbanFights,
    'UAV' => AlertTypeCode.uav,
    'CLEAR' => AlertTypeCode.clear,
    'NO_DATA' => AlertTypeCode.noData,
    _ => null,
  };

  static AlertScaleCode? scaleOf(dynamic raw) => switch ('${raw ?? ''}') {
    'oblast' => AlertScaleCode.oblast,
    'raion' => AlertScaleCode.raion,
    'hromada' => AlertScaleCode.hromada,
    'city' => AlertScaleCode.city,
    _ => null,
  };

  /// Кольори: для AIR — за масштабом, інакше — за типом.
  static AlertPalette resolveColors(AlertTypeCode? type, [AlertScaleCode? scale]) {
    final code = type ?? AlertTypeCode.clear;
    if (code == AlertTypeCode.air && scale != null) return airScale[scale]!;
    return types[code]!.palette;
  }

  /// Головна тривога серед кількох — з найвищим пріоритетом.
  static AlertTypeCode primary(Iterable<AlertTypeCode?> codes) {
    var best = AlertTypeCode.clear;
    for (final code in codes) {
      if (code != null && types[code]!.priority > types[best]!.priority) best = code;
    }
    return best;
  }
}

/// Плашка тривоги: скло (розмиття 16, як у кнопок) з відтінком типу, іконка Lucide й коротка назва.
class AlertBadge extends StatelessWidget {
  const AlertBadge(this.type, {this.scale, this.iconOnly = false, this.full = false, super.key});
  final AlertTypeCode type;
  final AlertScaleCode? scale;
  final bool iconOnly;
  final bool full;

  @override
  Widget build(BuildContext context) {
    final palette = AlertsConfig.resolveColors(type, type == AlertTypeCode.air ? scale : null);
    final meta = AlertsConfig.types[type]!;
    return Tooltip(
      message: AlertsConfig.label(type),
      child: ArcticGlassContainer(
        radius: 12,
        blur: AppBlur.control,
        enableBlur: true,
        specular: false,
        fill: LinearGradient(colors: [palette.fill, palette.fill]),
        borderColor: palette.border,
        padding: EdgeInsets.symmetric(horizontal: iconOnly ? 5 : 8, vertical: 4),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(meta.icon, size: 14, color: palette.text),
          if (!iconOnly) ...[
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                full ? AlertsConfig.label(type) : AlertsConfig.short(type),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: palette.text),
              ),
            ),
          ],
        ]),
      ),
    );
  }
}
