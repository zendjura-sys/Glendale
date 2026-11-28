import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'alert_widget.dart';
import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Чи це круглий/квадратний екран годинника (Wear OS / малий wearable).
bool isWearFormFactor(BuildContext context) {
  final size = MediaQuery.sizeOf(context);
  // Wear: діагональ мала, сторона ≈ квадрат; телефони мають shortestSide ≥ ~360.
  return size.shortestSide <= 280 && size.longestSide <= 360;
}

/// Компактний компаньйон для Wear OS: тривога в моєму місці (і «Я в укритті»), непрочитані чати,
/// сповіщення, друзі онлайн, «готовий грати» (№262). Пуші про тривоги й повідомлення годинник
/// показує сам — як дзеркало сповіщень телефона чи окремо встановленого застосунку.
class WearHome extends StatefulWidget {
  const WearHome({required this.session, super.key});
  final Session session;

  @override
  State<WearHome> createState() => _WearHomeState();
}

class _WearHomeState extends State<WearHome> {
  Map<String, dynamic>? pulse;
  Map<String, dynamic>? ready;
  Map<String, dynamic>? alerts;
  List<Map<String, dynamic>> chats = [];
  bool busy = false;
  Timer? poll;

  Api? get api => widget.session.token == null ? null : widget.session.api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _reload());
    poll = Timer.periodic(const Duration(seconds: 45), (_) => _reload(quiet: true));
  }

  @override
  void dispose() {
    poll?.cancel();
    super.dispose();
  }

  Future<void> _reload({bool quiet = false}) async {
    final client = api;
    if (client == null) {
      if (mounted) setState(() => pulse = null);
      return;
    }
    try {
      Map<String, dynamic>? nextReady;
      try {
        nextReady = await client.get(Api.site('/ready'));
      } catch (_) {
        nextReady = null;
      }
      final nextPulse = await client.get('/api/v1/me/pulse-widget');
      // Тривоги — лише там, де розділ доступний (Україна); інакше просто без картки.
      Map<String, dynamic>? nextAlerts;
      try {
        nextAlerts = mapOf((await client.get(Api.site('/alerts/state')))['prefs']);
      } catch (_) {
        nextAlerts = null;
      }
      List<Map<String, dynamic>> nextChats = [];
      try {
        nextChats = maps((await client.get('/api/v1/messages'))['conversations']).where((c) => intOf(c['unread']) > 0).take(3).toList();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        pulse = nextPulse;
        ready = nextReady;
        alerts = nextAlerts;
        chats = nextChats;
      });
    } catch (e) {
      if (!quiet && mounted) toast(context, e);
    }
  }

  Future<void> _toggleShelter(bool on) async {
    final client = api;
    if (client == null || busy) return;
    setState(() => busy = true);
    try {
      final data = await client.put(Api.site('/alerts/preferences'), {'shelter': on});
      if (mounted) setState(() => alerts = mapOf(data['prefs']));
      unawaited(AlertWidget.refresh(client));
    } catch (e) {
      if (mounted) toast(context, e, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _toggleReady() async {
    final client = api;
    if (client == null || busy) return;
    setState(() => busy = true);
    try {
      final active = ready != null && ready!['mine'] is Map;
      final next = active ? await client.delete(Api.site('/ready')) : await client.put(Api.site('/ready'), {'minutes': 60});
      if (mounted) setState(() => ready = mapOf(next));
    } catch (e) {
      if (mounted) toast(context, e, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = widget.session.me;
    final data = pulse;
    final messages = intOf(data?['messages']);
    final notes = intOf(data?['notifications']);
    final online = intOf(data?['friends_online']);
    final readyOn = ready != null && ready!['mine'] is Map;
    final round = MediaQuery.sizeOf(context).shortestSide / MediaQuery.sizeOf(context).longestSide > 0.92;

    return Material(
      color: deep,
      child: SafeArea(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: round ? 18 : 12, vertical: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                text(me?['first_name']) ?? text(me?['name']) ?? 'GameCon',
                textAlign: TextAlign.center,
                style: body(13, weight: FontWeight.w700),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 8),
              Expanded(
                child: ListView(
                  padding: EdgeInsets.zero,
                  children: [
                    if (alerts != null) ...[
                      _WearAlert(lines: AlertWidget.lines(alerts!, DateTime.now()), onTap: () => context.go('/alerts')),
                      if (AlertWidget.lines(alerts!, DateTime.now())['aw_since'] != '')
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: GhostButton(
                            label: alerts!['shelter'] == true ? tr('Я вже не в укритті') : tr('Я в укритті'),
                            icon: LucideIcons.shield,
                            compact: true,
                            onPressed: busy ? null : () => _toggleShelter(alerts!['shelter'] != true),
                          ),
                        ),
                    ],
                    for (final chat in chats)
                      _WearTile(
                        icon: LucideIcons.messageCircle,
                        label: '${text(chat['title']) ?? tr('Бесіда')}: ${text(mapOf(chat['last_message'])['preview']) ?? ''}',
                        value: '${intOf(chat['unread'])}',
                        onTap: () => context.go('/messages/${intOf(chat['id'])}'),
                      ),
                    _WearTile(
                      icon: LucideIcons.messagesSquare,
                      label: tr('Чати'),
                      value: '$messages',
                      onTap: () => context.go('/messages'),
                    ),
                    _WearTile(
                      icon: LucideIcons.bell,
                      label: tr('Сповіщення'),
                      value: '$notes',
                      onTap: () => context.go('/notifications'),
                    ),
                    _WearTile(
                      icon: LucideIcons.usersRound,
                      label: tr('Друзі онлайн'),
                      value: '$online',
                      onTap: () => context.go('/friends?tab=online'),
                    ),
                    const SizedBox(height: 6),
                    PrimaryButton(
                      label: readyOn ? tr('Зняти готовність') : tr('Готовий грати'),
                      icon: readyOn ? LucideIcons.circlePause : LucideIcons.gamepad2,
                      busy: busy,
                      compact: true,
                      onPressed: busy ? null : _toggleReady,
                    ),
                    const SizedBox(height: 6),
                    GhostButton(
                      label: tr('Стрічка'),
                      icon: LucideIcons.house,
                      compact: true,
                      onPressed: () => context.go('/feed'),
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: tr('Оновити'),
                onPressed: () => _reload(),
                icon: Icon(LucideIcons.refreshCw, size: 16, color: muted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _WearTile extends StatelessWidget {
  const _WearTile({required this.icon, required this.label, required this.value, required this.onTap});
  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Material(
        color: card,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Row(
              children: [
                Icon(icon, size: 16, color: soft),
                const SizedBox(width: 8),
                Expanded(child: Text(label, style: body(12, weight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis)),
                Text(value, style: body(13, weight: FontWeight.w800, color: primary)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Тривога в моєму місці: колір типу тривоги, назва й скільки триває (ті самі рядки, що у віджеті).
class _WearAlert extends StatelessWidget {
  const _WearAlert({required this.lines, required this.onTap});
  final Map<String, String> lines;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final hex = (lines['aw_color'] ?? '#10B981').replaceFirst('#', '');
    final color = Color(int.tryParse('FF$hex', radix: 16) ?? 0xFF10B981);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Material(
        color: color.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Icon(LucideIcons.siren, size: 15, color: color),
                const SizedBox(width: 6),
                Expanded(child: Text(lines['aw_status'] ?? '', style: body(12, weight: FontWeight.w700), maxLines: 2, overflow: TextOverflow.ellipsis)),
              ]),
              const SizedBox(height: 2),
              Text(
                [lines['aw_place'], lines['aw_since']].where((v) => v != null && v.isNotEmpty).join(' · '),
                style: body(11, color: muted),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
