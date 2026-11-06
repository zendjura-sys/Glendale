import 'dart:async';
import 'dart:io';
import 'dart:math' as math;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:just_audio/just_audio.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'alerts_config.dart';
import 'alerts_map.dart';
import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'ukraine_outline.dart';
import 'widgets.dart';

/// Шари мапи (фільтри): тривоги й окремо кожен тип цілей.
const alertLayers = ['alerts', 'uav', 'missile', 'ballistic', 'kab', 'mig'];

/// Проєкція для мапи України (як на сайті): lng 22.0–40.4, lat 44.2–52.5.
Offset _project(double lat, double lng, Size size) =>
    Offset((lng - 22.0) / (40.4 - 22.0) * size.width, (52.5 - lat) / (52.5 - 44.2) * size.height);

Path _outline(Size size) {
  final path = Path();
  for (final ring in ukraineOutline) {
    for (var i = 0; i < ring.length; i++) {
      final p = _project(ring[i][1], ring[i][0], size);
      i == 0 ? path.moveTo(p.dx, p.dy) : path.lineTo(p.dx, p.dy);
    }
    path.close();
  }
  return path;
}

/// «1 год 05 хв» від початку тривоги.
String alertDuration(dynamic startedAt) {
  final start = DateTime.tryParse('${startedAt ?? ''}');
  if (start == null) return '';
  final total = math.max(0, DateTime.now().difference(start).inMinutes);
  final h = total ~/ 60;
  final m = total % 60;
  // Тривала тривога (окуповані території тощо) — у днях.
  if (h >= 48) return tr('{d} дн.', {'d': '${h ~/ 24}'});
  return h > 0 ? tr('{h} год {m} хв', {'h': '$h', 'm': m.toString().padLeft(2, '0')}) : tr('{m} хв', {'m': '$m'});
}

double _d(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;

/// Свій звук тривоги з файлового менеджера: копія в теці застосунку.
class AlertSound {
  static const _key = 'alerts.sound_path';
  static const _onKey = 'alerts.sound_on';
  static const _channel = MethodChannel('gamecon/app');
  static final _player = AudioPlayer();

  static String? path(SharedPreferences prefs) => prefs.getString(_key);
  static bool enabled(SharedPreferences prefs) => prefs.getBool(_onKey) ?? true;
  static Future<void> setEnabled(SharedPreferences prefs, bool on) => prefs.setBool(_onKey, on);

  static Future<String?> pick(SharedPreferences prefs) async {
    final result = await FilePicker.platform.pickFiles(type: FileType.audio);
    final source = result?.files.single.path;
    if (source == null) return null;
    final dir = await getApplicationSupportDirectory();
    final ext = source.contains('.') ? source.substring(source.lastIndexOf('.')) : '.mp3';
    final target = File('${dir.path}/alert_sound$ext');
    await File(source).copy(target.path);
    await prefs.setString(_key, target.path);
    return target.path;
  }

  static Future<void> clear(SharedPreferences prefs) async {
    final old = prefs.getString(_key);
    await prefs.remove(_key);
    if (old != null) {
      try {
        await File(old).delete();
      } catch (_) {}
    }
  }

  /// Програти сигнал: свій файл, інакше системний звук і вібрація.
  static Future<void> play(SharedPreferences prefs) async {
    if (!enabled(prefs)) return;
    unawaited(HapticFeedback.heavyImpact());
    final file = path(prefs);
    if (file != null && File(file).existsSync()) {
      try {
        await _player.setFilePath(file);
        await _player.seek(Duration.zero);
        unawaited(_player.play());
        return;
      } catch (_) {}
    }
    await SystemSound.play(SystemSoundType.alert);
  }

  /// Системні налаштування каналу «Повітряна тривога»: там Android дає обрати будь-який звук
  /// і для сповіщень, коли застосунок закрито.
  static Future<void> openChannelSettings() async {
    try {
      await _channel.invokeMethod('channelSettings', {'channel': 'air_alerts'});
    } catch (_) {}
  }
}

/// Мапа тривог: області, цілі з курсом, мій регіон, укриття, звук, фільтри й джерела.
class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  Map<String, dynamic>? data;
  List<Map<String, dynamic>> regionList = [];
  List<Map<String, dynamic>> sources = [];
  Object? error;
  Timer? poll;
  Timer? tick;
  late Set<String> layers;
  bool showSources = false;
  int? selected;
  bool? _wasActive;
  Set<int> _seenThreats = {};

  Session get session => AppScope.read(context).session;

  @override
  void initState() {
    super.initState();
    final saved = AppScope.read(context).session.prefs.getStringList('alerts.layers');
    layers = (saved ?? alertLayers).where(alertLayers.contains).toSet();
    _load(full: true);
    poll = Timer.periodic(const Duration(seconds: 15), (_) => _load());
    tick = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    poll?.cancel();
    tick?.cancel();
    super.dispose();
  }

  Future<void> _load({bool full = false}) async {
    try {
      final d = await session.api.get(Api.site('/alerts/state${full ? '?full=1' : ''}'));
      if (!mounted) return;
      _ring(d);
      setState(() {
        data = d;
        error = null;
        if (full) {
          regionList = maps(d['region_list']);
          sources = maps(d['sources']);
        }
      });
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  /// Звук на екрані: у моїй області щойно почалась тривога чи з’явилась нова ціль.
  void _ring(Map<String, dynamic> d) {
    final region = text(mapOf(d['prefs'])['region']);
    final active = maps(d['regions']).any((r) => r['slug'] == region && r['active'] == true);
    final ids = {for (final t in maps(d['threats'])) if (t['region'] == region) intOf(t['id'])};
    final before = _wasActive;
    final seen = _seenThreats;
    _wasActive = active;
    _seenThreats = ids;
    if (before == null || region == null) return;
    if ((active && !before) || ids.any((id) => !seen.contains(id))) unawaited(AlertSound.play(session.prefs));
  }

  Future<void> _save(Map<String, dynamic> patch) async {
    try {
      final d = await session.api.put(Api.site('/alerts/preferences'), patch);
      if (!mounted) return;
      setState(() => data = {...?data, 'prefs': d['prefs']});
      if (patch.containsKey('shelter')) {
        toast(context, patch['shelter'] == true ? tr('Статус «В укритті» видно друзям і родині.') : tr('Статус «В укритті» знято.'));
      }
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Widget _legend(Widget mark, String label) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [mark, const SizedBox(width: 6), Flexible(child: Text(label, style: body(12, color: muted)))],
  );

  Future<void> _openThreat(Map<String, dynamic> t, List<Map<String, dynamic>> regions) async {
    setState(() => selected = intOf(t['id']));
    final region = regions.where((r) => r['slug'] == t['region']).firstOrNull;
    await showThreatCard(context, t, text(region?['name']));
    if (mounted) setState(() => selected = null);
  }

  void _toggleLayer(String layer) {
    setState(() => layers.contains(layer) ? layers.remove(layer) : layers.add(layer));
    unawaited(session.prefs.setStringList('alerts.layers', layers.toList()));
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) {
      return ScreenScroll(children: [
        if (error != null)
          EmptyState(icon: LucideIcons.wifiOff, title: tr('Не вдалося завантажити мапу тривог'))
        else
          const SizedBox(height: 240, child: Center(child: CircularProgressIndicator())),
      ]);
    }
    final regions = maps(d['regions']);
    final threats = maps(d['threats']);
    final visible = threats.where((t) => layers.contains(text(t['type']))).toList();
    final active = regions.where((r) => r['active'] == true).toList();
    // «Тривога зараз»: офіційні тривоги й рівні загроз з цілей, важливіші — вище.
    final alerting = regions.where((r) => r['active'] == true || !{AlertTypeCode.clear, AlertTypeCode.noData}.contains(regionType(r))).toList()
      ..sort((a, b) => AlertsConfig.types[regionType(b)]!.priority - AlertsConfig.types[regionType(a)]!.priority);
    final prefs = mapOf(d['prefs']);
    final mineSlug = text(prefs['region']);
    final mine = regions.where((r) => r['slug'] == mineSlug).firstOrNull;
    final counts = <String, int>{};
    for (final t in threats) {
      counts[text(t['type']) ?? ''] = (counts[text(t['type']) ?? ''] ?? 0) + 1;
    }
    final appPrefs = session.prefs;
    final customSound = AlertSound.path(appPrefs);

    final regionCard = Glass(
          gradient: mine?['active'] == true
              ? LinearGradient(colors: [const Color(0xFFEF4444).withValues(alpha: 0.18), const Color(0xFFEF4444).withValues(alpha: 0.06)])
              : null,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CardTitle(tr('Мій регіон'), icon: LucideIcons.mapPin),
            GcSelect<String>(
              value: mineSlug,
              expand: true,
              hint: tr('Оберіть область'),
              items: [for (final r in regionList) (text(r['slug'])!, text(r['name']) ?? '')],
              onChanged: (v) => _save({'region': v}),
            ),
            if (mine != null) ...[
              const SizedBox(height: 8),
              Text(
                mine['active'] == true ? tr('Тривога · {d}', {'d': alertDuration(mine['started_at'])}) : tr('Тривоги немає'),
                style: body(14, weight: FontWeight.w700, color: mine['active'] == true ? const Color(0xFFFCA5A5) : const Color(0xFF6EE7B7)),
              ),
            ],
            const SizedBox(height: 6),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: prefs['push'] != false,
              title: Text(tr('Сповіщення про тривогу'), style: body(14.5, weight: FontWeight.w600)),
              subtitle: Text(tr('Push, коли в області почалась тривога чи відбій — навіть у тихі години.'), style: body(12.5, color: muted)),
              onChanged: (v) => _save({'push': v}),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: AlertSound.enabled(appPrefs),
              title: Text(tr('Звук на екрані мапи'), style: body(14.5, weight: FontWeight.w600)),
              subtitle: Text(
                customSound == null ? tr('Системний сигнал. Можна обрати свій файл.') : tr('Свій звук: {f}', {'f': customSound.split('/').last}),
                style: body(12.5, color: muted),
              ),
              onChanged: (v) async {
                await AlertSound.setEnabled(appPrefs, v);
                setState(() {});
              },
            ),
            Wrap(spacing: 8, runSpacing: 8, children: [
              GhostButton(
                label: tr('Обрати звук'),
                icon: LucideIcons.folderOpen,
                expand: false,
                compact: true,
                onPressed: () async {
                  final picked = await AlertSound.pick(appPrefs);
                  if (picked != null && mounted) {
                    setState(() {});
                    unawaited(AlertSound.play(appPrefs));
                  }
                },
              ),
              if (customSound != null)
                GhostButton(
                  label: tr('Стандартний'),
                  icon: LucideIcons.rotateCcw,
                  expand: false,
                  compact: true,
                  onPressed: () async {
                    await AlertSound.clear(appPrefs);
                    if (mounted) setState(() {});
                  },
                ),
              if (Platform.isAndroid)
                GhostButton(
                  label: tr('Звук push у системі'),
                  icon: LucideIcons.bellRing,
                  expand: false,
                  compact: true,
                  onPressed: AlertSound.openChannelSettings,
                ),
            ]),
            const SizedBox(height: 12),
            prefs['shelter'] == true
                ? GhostButton(label: tr('Я вже не в укритті'), icon: LucideIcons.shieldCheck, iconColor: const Color(0xFF6EE7B7), onPressed: () => _save({'shelter': false}))
                : PrimaryButton(label: tr('Я в укритті'), icon: LucideIcons.shield, onPressed: () => _save({'shelter': true})),
          ]),
        );
    final mapCard = Glass(
          padding: const EdgeInsets.fromLTRB(10, 12, 10, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(children: [
                for (final layer in alertLayers)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: SelectPill(
                      label: layer == 'alerts' ? tr('Тривоги') : threatLabel(layer),
                      selected: layers.contains(layer),
                      onTap: () => _toggleLayer(layer),
                    ),
                  ),
              ]),
            ),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: InteractiveViewer(
                maxScale: 5,
                child: AspectRatio(
                  aspectRatio: 1000 / 680,
                  child: AlertMapView(
                    regions: regions,
                    units: maps(d['units']),
                    threats: visible,
                    mine: mineSlug,
                    selected: selected,
                    showAlerts: layers.contains('alerts'),
                    onSelect: (slug) => _save({'region': slug}),
                    onThreat: (t) => _openThreat(t, regions),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            // Легенда: офіційні типи за пріоритетом і масштаб повітряної тривоги.
            Wrap(spacing: 6, runSpacing: 6, children: [for (final t in AlertsConfig.ordered) AlertBadge(t, full: true)]),
            const SizedBox(height: 8),
            Wrap(spacing: 12, runSpacing: 6, children: [
              Text(tr('Повітряна тривога за масштабом:'), style: body(12, color: muted)),
              for (final sc in AlertScaleCode.values)
                _legend(
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(color: AlertsConfig.airScale[sc]!.fill, border: Border.all(color: AlertsConfig.airScale[sc]!.border), borderRadius: BorderRadius.circular(2)),
                  ),
                  AlertsConfig.scaleLabel(sc),
                ),
              _legend(Icon(LucideIcons.radiation, size: 12, color: muted), tr('Чорнобильська зона відчуження')),
            ]),
            const SizedBox(height: 8),
            Wrap(spacing: 12, runSpacing: 6, children: [
              for (final (variant, type, label) in [
                ('shahed', 'uav', tr('Shahed / Гербера')),
                ('jet', 'uav', tr('Реактивний Shahed')),
                ('fpv', 'uav', tr('FPV-дрон')),
                ('cruise', 'missile', tr('Крилата ракета')),
                (null, 'ballistic', tr('Балістика')),
                (null, 'kab', tr('КАБ')),
                (null, 'mig', tr('МіГ-31К')),
              ])
                _legend(ThreatGlyph({'type': type, 'variant': variant}, size: 14), label),
            ]),
            if (mapOf(d['attribution'])['url'] != null) ...[
              const SizedBox(height: 10),
              // Обов’язкове видиме посилання на джерело (умова API NEPTUN).
              InkWell(
                onTap: () => launchUrl(Uri.parse('${mapOf(d['attribution'])['url']}'), mode: LaunchMode.externalApplication),
                child: Text(text(mapOf(d['attribution'])['text']) ?? 'NEPTUN', style: body(12.5, color: accent, weight: FontWeight.w600)),
              ),
            ],
            const SizedBox(height: 10),
            Text(
              tr('Мапа — агрегатор відкритих джерел, а не офіційна система оповіщення. Мітки приблизні; прозоріша мітка — менше джерел її підтвердили. Рішення про укриття приймайте за офіційним сигналом тривоги.'),
              style: body(12, color: faint),
            ),
          ]),
        );
    final activeCard = Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CardTitle(tr('Тривога зараз'), icon: LucideIcons.siren),
            if (alerting.isEmpty) Text(tr('Тривог немає.'), style: body(14, color: muted)),
            for (final r in alerting)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(children: [
                  // Головна тривога (найвищий пріоритет), решта — вторинні бейджі.
                  AlertBadge(regionType(r), scale: AlertsConfig.scaleOf(r['scale'])),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      text(r['name']) ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: body(14, color: AlertsConfig.resolveColors(regionType(r), AlertsConfig.scaleOf(r['scale'])).text),
                    ),
                  ),
                  for (final c in ((r['alerts'] as List?) ?? const []).skip(1))
                    if (AlertsConfig.typeOf(c) != null)
                      Padding(padding: const EdgeInsets.only(left: 4), child: AlertBadge(AlertsConfig.typeOf(c)!, scale: AlertsConfig.scaleOf(r['scale']), iconOnly: true)),
                  const SizedBox(width: 8),
                  Text(alertDuration(r['started_at']), style: body(12.5, color: muted)),
                ]),
              ),
          ]),
        );
    final threatsCard = Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CardTitle(tr('Цілі в повітрі'), icon: LucideIcons.radar),
            if (visible.isEmpty) Text(tr('Цілей не зафіксовано.'), style: body(14, color: muted)),
            for (final t in visible.take(15))
              InkWell(
                onTap: () => _openThreat(t, regions),
                borderRadius: BorderRadius.circular(10),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(children: [
                    Transform.rotate(angle: (t['course'] is num ? (t['course'] as num) : 0) * math.pi / 180, child: ThreatGlyph(t, size: 20)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${threatTitle(t)}${intOf(t['count'], 1) > 1 ? ' ×${t['count']}' : ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, weight: FontWeight.w600)),
                        Text(text(t['place']) ?? tr('Україна'), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12.5, color: muted)),
                      ]),
                    ),
                    Text('${intOf(t['confidence'])}% · ${clock(t['detected_at'])}', style: body(12.5, color: muted)),
                  ]),
                ),
              ),
          ]),
        );
    final feedCard = maps(d['feed']).isEmpty ? null : Glass(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              CardTitle(tr('Зведення'), icon: LucideIcons.messageSquareText),
              for (final item in maps(d['feed']).take(12))
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(
                      [clock(item['at']), if (text(item['channel']) != null) '@${item['channel']}'].join(' · '),
                      style: body(12, color: faint),
                    ),
                    const SizedBox(height: 2),
                    Text(text(item['text']) ?? '', style: body(14, color: soft)),
                  ]),
                ),
            ]),
          );
    final sourcesCard = Glass(
          onTap: () => setState(() => showSources = !showSources),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Icon(LucideIcons.listTree, size: 18, color: accent),
              const SizedBox(width: 8),
              Expanded(child: Text(tr('Джерела'), style: body(15, weight: FontWeight.w700))),
              Text('${sources.fold<int>(0, (n, g) => n + maps(g['channels']).length)}', style: body(13, color: muted)),
              Icon(showSources ? LucideIcons.chevronUp : LucideIcons.chevronDown, size: 18, color: muted),
            ]),
            if (showSources)
              for (final g in sources)
                Opacity(
                  opacity: g['enabled'] == false ? 0.5 : 1,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 14),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${text(g['title'])} · ${maps(g['channels']).length}${g['enabled'] == false ? ' · ${tr('вимкнено')}' : ''}', style: body(14, weight: FontWeight.w700)),
                      Text(text(g['about']) ?? '', style: body(12.5, color: muted)),
                      const SizedBox(height: 6),
                      for (final c in maps(g['channels']))
                        InkWell(
                          onTap: () => launchUrl(Uri.parse('https://t.me/${c['name']}'), mode: LaunchMode.externalApplication),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 3),
                            child: Row(children: [
                              Text('@${c['name']}', style: body(13, color: accent)),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  (c['regions'] is List && (c['regions'] as List).isNotEmpty) ? (c['regions'] as List).join(' / ') : tr('Вся Україна'),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: body(12, color: faint),
                                ),
                              ),
                            ]),
                          ),
                        ),
                    ]),
                  ),
                ),
          ]),
        );
    final guestsCard = Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CardTitle(tr('Інформація для гостей України'), icon: LucideIcons.phone),
            Text(tr('Почули сирену чи сповіщення — пройдіть в найближче укриття або метро.'), style: body(14, color: soft)),
            const SizedBox(height: 4),
            Text(tr('Тримайтесь подалі від вікон, не знімайте й не публікуйте роботу ППО та місця влучань.'), style: body(14, color: soft)),
            const SizedBox(height: 8),
            for (final (n, label) in [
              ('112', tr('— єдиний номер екстрених служб')),
              ('101', tr('— ДСНС (пожежа, порятунок)')),
              ('102', tr('— поліція')),
              ('103', tr('— швидка допомога')),
            ])
              InkWell(
                onTap: () => launchUrl(Uri.parse('tel:$n')),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Text.rich(TextSpan(children: [
                    TextSpan(text: '$n ', style: body(14, weight: FontWeight.w800)),
                    TextSpan(text: label, style: body(14, color: soft)),
                  ])),
                ),
              ),
          ]),
        );
    const gap = SizedBox(height: 12);
    // Ширина вмісту (без бічних панелей): від 860 — мапа ліворуч, панель праворуч (як на сайті);
    // від 600 (планшет) — одна колонка, але мапа першою, щоб її було видно одразу.
    Widget layout(BuildContext context, BoxConstraints box) {
      if (box.maxWidth >= 860) {
        return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [mapCard, gap, sourcesCard, gap, guestsCard])),
          const SizedBox(width: 16),
          SizedBox(
            width: 360,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [regionCard, gap, activeCard, gap, threatsCard, if (feedCard != null) ...[gap, feedCard]]),
          ),
        ]);
      }
      final tablet = box.maxWidth >= 600;
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (tablet) ...[mapCard, gap, regionCard] else ...[regionCard, gap, mapCard],
        gap,
        activeCard,
        gap,
        threatsCard,
        if (feedCard != null) ...[gap, feedCard],
        gap,
        sourcesCard,
        gap,
        guestsCard,
      ]);
    }

    return ScreenScroll(
      onRefresh: () => _load(full: true),
      children: [
        PageTitle(
          tr('Мапа тривог'),
          subtitle: [
            active.isEmpty ? tr('Зараз тривог немає') : tr('Зараз тривога в {n} регіонах', {'n': '${active.length}'}),
            tr('оновлено о {t}', {'t': clock(d['updated_at'])}),
          ].join(' · '),
        ),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final k in ['uav', 'missile', 'kab'])
            if ((counts[k] ?? 0) > 0) Pill(label: '${threatLabel(k)} · ${counts[k]}', color: threatColors[k]!),
          if (d['mig_active'] == true) Pill(label: tr('Зліт МіГ-31К'), icon: LucideIcons.radar, color: threatColors['mig']!),
          if (d['ballistic_threat'] == true) Pill(label: tr('Загроза балістики'), icon: LucideIcons.rocket, color: threatColors['ballistic']!),
          if (d['stale'] == true) Pill(label: tr('Дані можуть бути неактуальні'), icon: LucideIcons.triangleAlert, color: const Color(0xFFFBBF24)),
        ]),
        gap,
        LayoutBuilder(builder: layout),
      ],
    );
  }
}

/// Кнопка «Мапа тривог» (як на сайті): контур України в кольорах прапора, області з тривогою
/// світяться червоним, поверх — гучномовець. Живі дані раз на хвилину.
class AlertMapButton extends StatefulWidget {
  const AlertMapButton({this.onTap, super.key});
  final VoidCallback? onTap;

  @override
  State<AlertMapButton> createState() => _AlertMapButtonState();
}

class _AlertMapButtonState extends State<AlertMapButton> {
  List<Map<String, dynamic>> active = [];
  Timer? timer;

  @override
  void initState() {
    super.initState();
    _load();
    timer = Timer.periodic(const Duration(minutes: 1), (_) => _load());
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final d = await AppScope.read(context).session.api.get(Api.site('/alerts/state'));
      if (mounted) setState(() => active = maps(d['regions']).where((r) => r['active'] == true).toList());
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: active.isEmpty ? tr('Мапа тривог') : tr('Мапа тривог: тривога в {n} регіонах', {'n': '${active.length}'}),
      child: Material(
        color: const Color(0xCC0B1A33),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(color: const Color(0xFF7DD3FC).withValues(alpha: 0.3)),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: widget.onTap ?? () => context.push('/alerts'),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(10, 10, 14, 10),
            child: Row(children: [
              SizedBox(
                width: 130,
                height: 78,
                child: Stack(children: [
                  Positioned.fill(child: CustomPaint(painter: _FlagMapPainter(active))),
                  Positioned(
                    left: 40,
                    top: 20,
                    child: Transform.rotate(angle: -0.2, child: const Icon(LucideIcons.megaphone, size: 36, color: Color(0xFFE11D2A))),
                  ),
                ]),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  Text(tr('Мапа тривог'), style: display(19).copyWith(color: Colors.white, fontWeight: FontWeight.w900, height: 1.05)),
                  const SizedBox(height: 4),
                  Text(
                    active.isEmpty ? tr('Тривог немає') : tr('Тривога: {n}', {'n': '${active.length}'}),
                    style: body(12.5, color: active.isEmpty ? Colors.white54 : const Color(0xFFFCA5A5), weight: FontWeight.w600),
                  ),
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _FlagMapPainter extends CustomPainter {
  _FlagMapPainter(this.active);
  final List<Map<String, dynamic>> active;

  @override
  void paint(Canvas canvas, Size size) {
    final outline = _outline(size);
    final split = _project(48.6, 22, size).dy;
    canvas.save();
    canvas.clipPath(outline);
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, split), Paint()..color = const Color(0xFF1F5FD1));
    canvas.drawRect(Rect.fromLTWH(0, split, size.width, size.height), Paint()..color = const Color(0xFFF5C518));
    for (final r in active) {
      final p = _project(_d(r['lat']), _d(r['lng']), size);
      canvas.drawCircle(
        p,
        (r['slug'] == 'kyiv' ? 7 : 16) * size.width / 200,
        Paint()
          ..color = const Color(0xFFFF2D2D)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
      );
    }
    canvas.restore();
    canvas.drawPath(outline, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.8
      ..color = Colors.white.withValues(alpha: 0.35));
  }

  @override
  bool shouldRepaint(_FlagMapPainter old) => old.active != active;
}
