import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'theme.dart';
import 'widgets.dart';
import 'i18n.dart';

const _icons = <String, IconData>{
  'pen-line': LucideIcons.penLine,
  'newspaper': LucideIcons.newspaper,
  'users-round': LucideIcons.usersRound,
  'party-popper': LucideIcons.partyPopper,
  'heart': LucideIcons.heart,
  'star': LucideIcons.star,
  'calendar-check': LucideIcons.calendarCheck,
  'cake': LucideIcons.cake,
  'house': LucideIcons.house,
  'crown': LucideIcons.crown,
  'calendar-days': LucideIcons.calendarDays,
  'swords': LucideIcons.swords,
  'music': LucideIcons.music,
  'camera': LucideIcons.camera,
  'circle-play': LucideIcons.circlePlay,
  'clapperboard': LucideIcons.clapperboard,
  'badge-check': LucideIcons.badgeCheck,
  'rocket': LucideIcons.rocket,
};

/// Рівень (досвід до наступного) і бейджі за активність — у профілі.
class AchievementsPanel extends StatefulWidget {
  const AchievementsPanel({required this.data, required this.isSelf, super.key});
  final Map<String, dynamic> data;
  final bool isSelf;

  @override
  State<AchievementsPanel> createState() => _AchievementsPanelState();
}

class _AchievementsPanelState extends State<AchievementsPanel> {
  bool all = false;

  @override
  Widget build(BuildContext context) {
    final d = widget.data;
    final level = intOf(d['level'], 1);
    final xp = intOf(d['xp']);
    final from = intOf(d['level_xp']);
    final to = intOf(d['next_xp'], 1);
    final percent = ((xp - from) / (to - from).clamp(1, 1 << 30)).clamp(0.0, 1.0);
    final badges = maps(d['badges']);
    final shown = all ? badges : badges.where((b) => b['earned'] == true).toList();

    return Glass(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(gradient: buttonGradient, borderRadius: BorderRadius.circular(16)),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text(tr('РІВ.'), style: body(8.5, color: Colors.white70, weight: FontWeight.w700)),
              Text('$level', style: body(18, color: Colors.white, weight: FontWeight.w800)),
            ]),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const Icon(LucideIcons.award, size: 15, color: gold),
                const SizedBox(width: 6),
                Text(text(d['title']) ?? '', style: body(14, weight: FontWeight.w700)),
              ]),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(value: percent, minHeight: 6, backgroundColor: Colors.white.withValues(alpha: 0.08), color: primary),
              ),
              const SizedBox(height: 4),
              Text(tr('{xp} / {to} досвіду до рівня {v}', {'xp': xp, 'to': to, 'v': level + 1}), style: body(11, color: faint)),
            ]),
          ),
        ]),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(child: Text(tr('Досягнення {v}/{v2}', {'v': d['earned'] ?? 0, 'v2': d['total'] ?? 0}), style: body(13.5, color: soft, weight: FontWeight.w700))),
          GestureDetector(onTap: () => setState(() => all = !all), child: Text(all ? tr('Лише отримані') : tr('Усі'), style: body(12.5, color: primary, weight: FontWeight.w600))),
        ]),
        const SizedBox(height: 10),
        if (shown.isEmpty)
          Text(widget.isSelf ? tr('Перші бейджі — за пост, друзів і вступ до сім’ї.') : tr('Бейджів поки немає.'), style: body(13, color: muted))
        else
          GridView.count(
            crossAxisCount: 4,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 8,
            childAspectRatio: 0.82,
            children: [
              for (final b in shown)
                Tooltip(
                  message: '${b['title']} — ${b['text']}${b['earned'] == true ? '' : ' (${b['progress']}/${b['target']})'}',
                  triggerMode: TooltipTriggerMode.tap,
                  child: Column(children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: b['earned'] == true ? gold.withValues(alpha: 0.15) : Colors.white.withValues(alpha: 0.04),
                        borderRadius: BorderRadius.circular(15),
                        border: Border.all(color: b['earned'] == true ? gold.withValues(alpha: 0.4) : line),
                      ),
                      child: Icon(_icons[b['icon']] ?? LucideIcons.award, size: 21, color: b['earned'] == true ? gold : faint),
                    ),
                    const SizedBox(height: 5),
                    Text(text(b['title']) ?? '', textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: body(11, color: b['earned'] == true ? soft : faint)),
                  ]),
                ),
            ],
          ),
      ]),
    );
  }
}
