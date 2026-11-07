import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Ширина правої колонки на великих планшетах (як четверта колонка сайту на 2K+).
const railWidth = 300.0;

/// З якої ширини екрана видно праву колонку «Онлайн і чати».
const railScreenWidth = 1280.0;

/// Права колонка: друзі онлайн і останні бесіди; оновлюється раз на хвилину.
class RailPanel extends StatefulWidget {
  const RailPanel({required this.session, super.key});
  final Session session;

  @override
  State<RailPanel> createState() => _RailPanelState();
}

class _RailPanelState extends State<RailPanel> {
  Map<String, dynamic>? data;
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
      final d = await widget.session.api.get(Api.site('/me/rail'));
      if (mounted) setState(() => data = d);
    } catch (_) {}
  }

  Widget _row(BuildContext context, {required String name, String? avatar, required VoidCallback onTap, int unread = 0, bool online = false}) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
          child: Row(children: [
            Avatar(name: name, url: avatar, size: 32, online: online),
            const SizedBox(width: 10),
            Expanded(child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14))),
            if (unread > 0)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(color: primary, borderRadius: BorderRadius.circular(9)),
                child: Text('$unread', style: body(11, color: Colors.white, weight: FontWeight.w700)),
              ),
          ]),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final online = maps(data?['online']);
    final chats = maps(data?['chats']);
    return ListView(
      padding: const EdgeInsets.only(bottom: 16),
      children: [
        Glass(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            CardTitle(tr('Зараз онлайн'), icon: LucideIcons.radio, onTrailing: () => context.push('/friends'), trailing: tr('Усі')),
            const SizedBox(height: 6),
            if (data != null && online.isEmpty) Text(tr('Ніхто з друзів зараз не в мережі.'), style: body(13, color: muted)),
            for (final u in online)
              _row(context, name: text(u['name']) ?? '', avatar: text(u['avatar_url']), online: true, onTap: () => context.push('/u/${u['username']}')),
          ]),
        ),
        if (chats.isNotEmpty) ...[
          const SizedBox(height: 12),
          Glass(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              CardTitle(tr('Повідомлення'), icon: LucideIcons.messageCircle, onTrailing: () => context.push('/messages'), trailing: tr('Усі')),
              const SizedBox(height: 6),
              for (final c in chats)
                _row(
                  context,
                  name: text(c['title']) ?? '',
                  avatar: text(c['avatar_url']),
                  unread: intOf(c['unread']),
                  onTap: () => context.push('/messages/${c['id']}'),
                ),
            ]),
          ),
        ],
      ],
    );
  }
}
