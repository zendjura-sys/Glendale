import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'shell.dart' show appPathFor;
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Значки біля ніка: логотипи сім'ї, клану (гільдії), сервера й гри з відповідних розділів.
/// Дотик — картка з назвою, роллю й відомостями та кнопкою переходу в розділ.
class AffiliationBadges extends StatelessWidget {
  const AffiliationBadges({required this.user, this.size = 18, super.key});
  final Map<String, dynamic> user;
  final double size;

  static const _kinds = {
    'family': (LucideIcons.castle, 'Сім’я'),
    'clan': (LucideIcons.swords, 'Клан'),
    'guild': (LucideIcons.swords, 'Гільдія'),
    'server': (LucideIcons.server, 'Сервер'),
    'game': (LucideIcons.gamepad2, 'Гра'),
  };

  @override
  Widget build(BuildContext context) {
    final badges = maps(user['badges']);
    if (badges.isEmpty) return const SizedBox.shrink();
    // Видно першу групу (сім'я з сервером чи клан з грою — порядок з налаштувань), решта — за «+N».
    final first = badges.first['group'];
    final shown = badges.where((b) => b['group'] == first).toList();
    final rest = badges.where((b) => b['group'] != first).toList();
    final pad = (32 - size).clamp(0, 14) / 2;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      for (final b in shown)
        Semantics(
          button: true,
          label: text(b['name']) ?? '',
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => _show(context, b),
            // Зона дотику не менше 32×32 навколо маленького значка.
            child: Padding(padding: EdgeInsets.all(pad), child: _Logo(badge: b, size: size)),
          ),
        ),
      if (rest.isNotEmpty)
        Semantics(
          button: true,
          label: tr('Усі значки'),
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => _showAll(context, rest),
            child: Padding(
              padding: EdgeInsets.all(pad),
              child: Container(
                height: size,
                constraints: BoxConstraints(minWidth: size),
                padding: const EdgeInsets.symmetric(horizontal: 4),
                alignment: Alignment.center,
                decoration: BoxDecoration(color: const Color(0xFF38BDF8).withValues(alpha: 0.15), borderRadius: BorderRadius.circular(size * 0.28)),
                child: Text('+${rest.length}', style: body(size * 0.6, color: const Color(0xFF38BDF8), weight: FontWeight.w800)),
              ),
            ),
          ),
        ),
    ]);
  }

  /// Решта значків списком з описами; дотик — відомості й перехід у розділ.
  static void _showAll(BuildContext context, List<Map<String, dynamic>> badges) {
    showGcSheet<void>(
      context,
      title: tr('Значки'),
      builder: (sheet) => ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
        children: [
          for (final b in badges)
            InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () {
                final href = text(b['href']) ?? '';
                if (href.isEmpty) return;
                Navigator.pop(sheet);
                context.push(appPathFor(href));
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  _Logo(badge: b, size: 40),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text([tr((_kinds[text(b['kind'])] ?? _kinds['game']!).$2), ?text(b['role'])].join(' · '), style: body(12, color: muted)),
                      Text(text(b['name']) ?? '', style: body(15, weight: FontWeight.w700)),
                      for (final line in (b['lines'] as List?) ?? const []) Text('$line', style: body(13, color: soft)),
                    ]),
                  ),
                ]),
              ),
            ),
        ],
      ),
    );
  }

  static void _show(BuildContext context, Map<String, dynamic> b) {
    final kind = _kinds[text(b['kind'])] ?? _kinds['game']!;
    final href = text(b['href']) ?? '';
    final name = text(b['name']) ?? '';
    final tag = text(b['tag']);
    final role = text(b['role']);
    final lines = (b['lines'] as List?)?.map((e) => '$e').toList() ?? const <String>[];
    showGcSheet<void>(
      context,
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            _Logo(badge: b, size: 52),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(kind.$2), style: body(12, color: muted)),
                const SizedBox(height: 2),
                Text(tag != null && b['kind'] != 'game' && !name.contains(tag) ? '$name [$tag]' : name, style: display(18)),
              ]),
            ),
          ]),
          if (role != null) ...[
            const SizedBox(height: 12),
            Pill(label: role, color: accent),
          ],
          if (lines.isNotEmpty) ...[
            const SizedBox(height: 10),
            for (final line in lines) Padding(padding: const EdgeInsets.only(bottom: 3), child: Text(line, style: body(14, color: soft))),
          ],
          if (href.isNotEmpty) ...[
            const SizedBox(height: 16),
            PrimaryButton(
              label: tr('Відкрити'),
              icon: kind.$1,
              onPressed: () {
                Navigator.pop(sheet);
                context.push(appPathFor(href));
              },
            ),
          ],
        ]),
      ),
    );
  }
}

/// Логотип значка: картинка з розділу, а без неї — тег або іконка виду.
class _Logo extends StatelessWidget {
  const _Logo({required this.badge, required this.size});
  final Map<String, dynamic> badge;
  final double size;

  @override
  Widget build(BuildContext context) {
    final logo = text(badge['logo']);
    final radius = size * 0.28;
    if (logo != null && logo.isNotEmpty) {
      return SizedBox(width: size, height: size, child: NetImage(logo, radius: radius));
    }
    final kind = AffiliationBadges._kinds[text(badge['kind'])] ?? AffiliationBadges._kinds['game']!;
    final tag = text(badge['tag']);
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: const Color(0xFF38BDF8).withValues(alpha: 0.15), borderRadius: BorderRadius.circular(radius)),
      child: tag != null && size >= 30
          ? Text(tag.length > 4 ? tag.substring(0, 4) : tag, style: body(size * 0.26, color: const Color(0xFF38BDF8), weight: FontWeight.w800))
          : Icon(kind.$1, size: size * 0.66, color: const Color(0xFF38BDF8)),
    );
  }
}

/// Порядок значків біля ніка: перша група видна завжди, решта — за «+N». Стрілки піднімають вище.
Future<void> showBadgeOrder(BuildContext context) {
  return showGcSheet<void>(context, title: tr('Значки біля ніка'), subtitle: tr('Перший показується завжди, решта — за кнопкою «+N».'), builder: (_) => const _BadgeOrder());
}

class _BadgeOrder extends StatefulWidget {
  const _BadgeOrder();

  @override
  State<_BadgeOrder> createState() => _BadgeOrderState();
}

class _BadgeOrderState extends State<_BadgeOrder> {
  List<Map<String, dynamic>>? groups;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await AppScope.read(context).session.api.get(Api.site('/settings/badges'));
      if (mounted) setState(() => groups = maps(mapOf(d)['groups']));
    } catch (e) {
      if (mounted) {
        setState(() => groups = []);
        toast(context, e);
      }
    }
  }

  Future<void> _move(int i, int delta) async {
    final list = [...?groups];
    final item = list.removeAt(i);
    list.insert(i + delta, item);
    setState(() {
      groups = list;
      busy = true;
    });
    try {
      final d = await AppScope.read(context).session.api.put(Api.site('/settings/badges'), {'order': [for (final g in list) g['key']]});
      if (mounted) setState(() => groups = maps(mapOf(d)['groups']));
    } catch (e) {
      if (mounted) toast(context, e);
    }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final list = groups;
    if (list == null) return const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()));
    if (list.isEmpty) {
      return Padding(padding: const EdgeInsets.fromLTRB(20, 4, 20, 16), child: Text(tr('Вступіть у сім’ю, клан чи гільдію — їхні логотипи з’являться біля вашого ніка.'), style: body(14, color: soft)));
    }
    return ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(12, 0, 12, 8), children: [
      for (var i = 0; i < list.length; i++)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          child: Row(children: [
            _Logo(badge: {'kind': list[i]['kind'], 'logo': list[i]['logo'], 'tag': null}, size: 36),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(text(list[i]['name']) ?? '', style: body(15, weight: FontWeight.w700)),
                Text([tr((AffiliationBadges._kinds[text(list[i]['kind'])] ?? AffiliationBadges._kinds['game']!).$2), if (i == 0) tr('показується першим')].join(' · '), style: body(12.5, color: muted)),
              ]),
            ),
            IconButton(onPressed: busy || i == 0 ? null : () => _move(i, -1), icon: const Icon(LucideIcons.chevronUp), tooltip: tr('Вище')),
            IconButton(onPressed: busy || i == list.length - 1 ? null : () => _move(i, 1), icon: const Icon(LucideIcons.chevronDown), tooltip: tr('Нижче')),
          ]),
        ),
    ]);
  }
}
