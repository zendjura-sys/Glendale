import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'plus.dart';
import 'state.dart';
import 'subscription.dart';
import 'theme.dart';
import 'widgets.dart';
import 'skeletons.dart';

// Сезонний пропуск — як на сайті (/season, App\Services\Quests\SeasonPass): очки сезону з щоденних
// завдань заповнюють 30 рівнів, за рівні — нагороди безкоштовної доріжки й доріжки GameCon+.
// Доріжка GameCon+ лише показує статус і відкриває шторку GameCon+ (Google Play Billing):
// тут немає й не має бути цін сайту чи посилань на оплату.

Color? _hex(dynamic value) {
  final hex = text(value);
  if (hex == null || !RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(hex)) return null;
  return Color(int.parse('FF${hex.substring(1)}', radix: 16));
}

List<Color> _colors(dynamic value, List<Color> fallback) {
  final colors = value is List ? [for (final v in value) ?_hex(v)] : <Color>[];
  return colors.isEmpty ? fallback : colors;
}

String _kind(String? type) => switch (type) {
      'frame' => tr('Рамка аватара'),
      'name' => tr('Колір ніку'),
      'badge' => tr('Значок'),
      'header' => tr('Ефект шапки'),
      'stickers' => tr('Стікери'),
      _ => tr('Досвід'),
    };

class SeasonScreen extends StatefulWidget {
  const SeasonScreen({super.key});

  @override
  State<SeasonScreen> createState() => _SeasonScreenState();
}

class _SeasonScreenState extends State<SeasonScreen> {
  Map<String, dynamic>? data;
  Object? error;
  String? busy;

  Api get api => AppScope.read(context).session.api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => load());
  }

  Future<void> load() async {
    try {
      final result = await api.get(Api.site('/season'));
      if (mounted) setState(() => (data = result, error = null));
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  Future<void> _run(String key, Future<dynamic> Function() action) async {
    setState(() => busy = key);
    final ok = await attempt(context, action);
    if (mounted) setState(() => busy = null);
    if (ok) await load();
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) {
      if (error != null) {
        return ScreenScroll(onRefresh: load, children: [
          EmptyState(icon: LucideIcons.wifiOff, title: tr('Не вдалося завантажити'), text: '$error', action: tr('Спробувати ще'), onAction: load),
        ]);
      }
      return const ScreenSkeleton();
    }
    return SeasonPassView(
      data: d,
      busy: busy,
      onRefresh: load,
      onClaim: (level, track) => _run('$level:$track', () => api.post(Api.site('/season/levels/$level/$track/claim'))),
      onEquip: (item) => _run('${item['type']}:${item['value']}', () => api.post(Api.site('/season/equip'), {'type': item['type'], 'value': item['equipped'] == true ? null : item['value']})),
      onPlus: () => showProFeatures(context),
      onQuests: () => context.go('/quests'),
    );
  }
}

/// Екран пропуску без мережі (для тестів і перегляду): шапка сезону, доріжка рівнів, інвентар.
class SeasonPassView extends StatelessWidget {
  const SeasonPassView({required this.data, required this.onClaim, required this.onEquip, required this.onPlus, required this.onQuests, this.onRefresh, this.busy, super.key});
  final Map<String, dynamic> data;
  final void Function(int level, String track) onClaim;
  final void Function(Map<String, dynamic> item) onEquip;
  final VoidCallback onPlus;
  final VoidCallback onQuests;
  final Future<void> Function()? onRefresh;
  final String? busy;

  @override
  Widget build(BuildContext context) {
    final season = mapOf(data['season']);
    final levels = maps(data['levels']);
    final inventory = maps(data['inventory']);
    final level = intOf(data['level']);
    final maxLevel = intOf(data['max_level'], 30);
    final into = intOf(data['into']);
    final need = intOf(data['need']);
    final plus = data['plus'] == true;
    final done = level >= maxLevel;
    final ends = DateTime.tryParse(text(season['ends_at']) ?? '')?.toLocal();

    return ScreenScroll(
      onRefresh: onRefresh,
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            gradient: LinearGradient(colors: _colors(season['colors'], const [Color(0xFF1E1B4B), Color(0xFF4338CA)]), begin: Alignment.topLeft, end: Alignment.bottomRight),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr('Сезонний пропуск'), style: body(13, color: Colors.white70)),
            const SizedBox(height: 4),
            Text(text(season['title']) ?? '', style: display(26, color: Colors.white)),
            if (ends != null) ...[const SizedBox(height: 6), _Countdown(until: ends)],
            const SizedBox(height: 16),
            Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(tr('Рівень {n}', {'n': level}), style: display(30, color: Colors.white)),
              Text(' / $maxLevel', style: body(15, color: Colors.white60)),
              const Spacer(),
              Text(tr('{n} очок сезону', {'n': compact(data['points'])}), style: body(13, color: Colors.white70)),
            ]),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(value: done ? 1 : (need > 0 ? into / need : 0), minHeight: 6, color: Colors.white, backgroundColor: Colors.black26),
            ),
            const SizedBox(height: 6),
            Text(done ? tr('Усі рівні сезону пройдено.') : tr('До рівня {n}: {have} / {need}', {'n': level + 1, 'have': into, 'need': need}), style: body(12, color: Colors.white70)),
          ]),
        ),
        const SizedBox(height: 12),
        Glass(
          padding: const EdgeInsets.symmetric(vertical: 12),
          radius: 12,
          child: SizedBox(
            height: 254,
            child: ListView.separated(
              key: const ValueKey('season-track'),
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: levels.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final row = levels[i];
                final n = intOf(row['level']);
                final reached = n <= level;
                return SizedBox(
                  width: 92,
                  child: Column(children: [
                    _RewardCell(reward: row['free'], claimed: row['free_claimed'] == true, reached: reached, allowed: true, busy: busy == '$n:free', onClaim: () => onClaim(n, 'free')),
                    const SizedBox(height: 8),
                    Container(
                      height: 26,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: reached ? primary : (n == level + 1 ? primary.withValues(alpha: 0.15) : fg.withValues(alpha: 0.05)),
                        borderRadius: BorderRadius.circular(8),
                        border: n == level + 1 ? Border.all(color: primary) : null,
                      ),
                      child: Text('$n', style: body(12, weight: FontWeight.w700, color: reached ? Colors.white : soft)),
                    ),
                    const SizedBox(height: 8),
                    _RewardCell(reward: row['plus'], claimed: row['plus_claimed'] == true, reached: reached, allowed: plus, premium: true, busy: busy == '$n:plus', onClaim: () => onClaim(n, 'plus'), onLocked: onPlus),
                  ]),
                );
              },
            ),
          ),
        ),
        if (!plus) ...[
          const SizedBox(height: 10),
          Glass(
            radius: 12,
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              Expanded(child: Text(tr('Нижня доріжка відкривається з GameCon+ — разом з усіма вже пройденими рівнями.'), style: body(13, color: soft))),
              const SizedBox(width: 10),
              PrimaryButton(label: 'GameCon+', icon: LucideIcons.plus, compact: true, expand: false, onPressed: onPlus),
            ]),
          ),
        ],
        const SizedBox(height: 12),
        Glass(
          radius: 12,
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            CardTitle(tr('Як заробляти очки'), icon: LucideIcons.target),
            Text(tr('Очки сезону дають щоденні завдання: щодня три нові, кожне — від 10 до 25 очок. Очки рахуються лише в цьому місяці.'), style: body(13, color: soft)),
            const SizedBox(height: 10),
            GhostButton(label: tr('Завдання дня'), icon: LucideIcons.target, compact: true, expand: false, onPressed: onQuests),
          ]),
        ),
        const SizedBox(height: 12),
        Glass(
          radius: 12,
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            CardTitle(tr('Інвентар'), icon: LucideIcons.shirt),
            if (inventory.isEmpty) Text(tr('Тут з’являться нагороди, які ви заберете з доріжки.'), style: body(13, color: muted)),
            for (final item in inventory)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(children: [
                  RewardIcon(reward: item),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(text(item['name']) ?? '', style: body(14, weight: FontWeight.w600)),
                      Text(_kind(text(item['type'])), style: body(12, color: muted)),
                    ]),
                  ),
                  if (item['equippable'] == true)
                    GhostButton(
                      label: item['equipped'] == true ? tr('Зняти') : tr('Вдягнути'),
                      compact: true,
                      expand: false,
                      color: item['equipped'] == true ? muted : null,
                      onPressed: busy == '${item['type']}:${item['value']}' ? null : () => onEquip(item),
                    )
                  else
                    Text(tr('Діє одразу'), style: body(12, color: muted)),
                ]),
              ),
          ]),
        ),
      ],
    );
  }
}

class _Countdown extends StatefulWidget {
  const _Countdown({required this.until});
  final DateTime until;

  @override
  State<_Countdown> createState() => _CountdownState();
}

class _CountdownState extends State<_Countdown> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    var left = widget.until.difference(DateTime.now());
    if (left.isNegative) left = Duration.zero;
    return Row(children: [
      const Icon(LucideIcons.clock, size: 14, color: Colors.white70),
      const SizedBox(width: 5),
      Text(tr('До кінця сезону: {d} дн. {h} год {m} хв', {'d': left.inDays, 'h': left.inHours % 24, 'm': left.inMinutes % 60}), style: body(12.5, color: Colors.white70)),
    ]);
  }
}

/// Як виглядає нагорода: рамка, колір ніку, значок, ефект шапки, стікери, досвід.
class RewardIcon extends StatelessWidget {
  const RewardIcon({required this.reward, this.size = 40, super.key});
  final Map<String, dynamic> reward;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = _colors(reward['colors'], [primary]);
    final Widget inner = switch (text(reward['type'])) {
      'frame' => Container(
          width: size * 0.6,
          height: size * 0.6,
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: colors.length > 1 ? colors : [colors.first, colors.first])),
          child: Container(decoration: BoxDecoration(shape: BoxShape.circle, color: voidColor)),
        ),
      'name' => colors.length > 1
          ? ShaderMask(blendMode: BlendMode.srcIn, shaderCallback: (r) => LinearGradient(colors: colors).createShader(r), child: Text('Aa', style: body(16, weight: FontWeight.w800, color: Colors.white)))
          : Text('Aa', style: body(16, weight: FontWeight.w800, color: colors.first)),
      'badge' => Icon(seasonBadgeIcons[text(reward['icon'])] ?? LucideIcons.sparkles, size: size * 0.5, color: _hex(reward['color']) ?? primary),
      'header' => Icon(LucideIcons.sparkles, size: size * 0.5, color: primary),
      'stickers' => Icon(LucideIcons.smile, size: size * 0.5, color: primary),
      _ => Text('+${intOf(reward['xp'])}', style: body(12, weight: FontWeight.w800)),
    };
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: fg.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(10)),
      child: inner,
    );
  }
}

class _RewardCell extends StatelessWidget {
  const _RewardCell({required this.reward, required this.claimed, required this.reached, required this.allowed, required this.busy, required this.onClaim, this.premium = false, this.onLocked});
  final dynamic reward;
  final bool claimed;
  final bool reached;
  final bool allowed;
  final bool premium;
  final bool busy;
  final VoidCallback onClaim;
  final VoidCallback? onLocked;

  @override
  Widget build(BuildContext context) {
    if (reward is! Map) {
      return Container(height: 102, decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: fg.withValues(alpha: 0.06))));
    }
    final item = mapOf(reward);
    final claimable = reached && allowed && !claimed;
    return Opacity(
      opacity: reached ? 1 : 0.6,
      child: Container(
        height: 102,
        padding: const EdgeInsets.all(7),
        decoration: BoxDecoration(
          color: premium ? primary.withValues(alpha: 0.07) : fg.withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: claimable ? primary : (premium ? primary.withValues(alpha: 0.2) : fg.withValues(alpha: 0.07))),
        ),
        child: Column(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          RewardIcon(reward: item, size: 34),
          Text(text(item['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(11, color: soft)),
          if (claimed)
            Row(mainAxisSize: MainAxisSize.min, children: [
              const Icon(LucideIcons.check, size: 12, color: green),
              const SizedBox(width: 3),
              Flexible(child: Text(tr('Отримано'), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(11, color: green, weight: FontWeight.w600))),
            ])
          else if (claimable)
            SizedBox(
              height: 24,
              width: double.infinity,
              child: FilledButton(
                onPressed: busy ? null : onClaim,
                style: FilledButton.styleFrom(backgroundColor: primary, padding: EdgeInsets.zero, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6))),
                child: Text(tr('Забрати'), style: body(11, color: Colors.white, weight: FontWeight.w600)),
              ),
            )
          else
            GestureDetector(
              onTap: reached && !allowed ? onLocked : null,
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(LucideIcons.lock, size: 11, color: muted),
                const SizedBox(width: 3),
                Flexible(child: Text(reached && !allowed ? 'GameCon+' : tr('Рівень'), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(11, color: muted))),
              ]),
            ),
        ]),
      ),
    );
  }
}
