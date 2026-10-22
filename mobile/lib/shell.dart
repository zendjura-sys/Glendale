import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'account.dart';
import 'chrome.dart';
import 'api.dart';
import 'family_widget.dart';
import 'player_view.dart';
import 'state.dart';
import 'theme.dart';
import 'voice_room.dart';
import 'widgets.dart';
import 'i18n.dart';

/// Переводить посилання сайту (`/f/black`, `/c/clan`, `/tonny.morales`) у маршрути застосунку.
String appPathFor(String? sitePath) {
  final raw = text(sitePath);
  if (raw == null) return '/feed';
  final uri = Uri.tryParse(raw);
  final path = uri?.path ?? raw;
  final query = uri != null && uri.hasQuery ? '?${uri.query}' : '';
  final parts = path.split('/').where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return '/feed';
  final head = parts.first;
  String rest(int from) => parts.length > from ? parts[from] : '';
  switch (head) {
    case 'f':
      final tab = rest(2);
      return '/families/${rest(1)}${tab.isEmpty ? '' : '?tab=$tab'}';
    case 'c':
      final sub = rest(2);
      return '/communities/${rest(1)}${['members', 'settings', 'photos'].contains(sub) ? '/$sub' : ''}${sub == 'members' ? query : ''}';
    case 'messages':
      if (rest(1) == 'saved') return '/starred';
      return parts.length > 1 && int.tryParse(rest(1)) != null ? '/messages/${rest(1)}' : '/messages';
    case 'posts':
      return rest(1) == 'drafts' ? '/drafts' : '/posts/${rest(1)}';
    case 'phone':
      return '/phone$query';
    case 'moments':
    case 'quests':
    case 'wrapped':
    case 'saved':
    case 'invite':
      return '/$head';
    case 'join':
      return '/join/${rest(1)}';
    case 'albums':
      return '/albums/${rest(1)}$query';
    case 'photos':
      return parts.length > 2 && rest(1) == 'u' ? '/photos?user=${rest(2)}' : '/photos';
    case 'music':
      if (rest(1) == 'u' && parts.length > 2) return '/music?user=${rest(2)}';
      if (rest(1) == 'playlists' && parts.length > 2) return '/music/playlists/${rest(2)}';
      // Розділ у стилі Apple Music: ті самі шляхи, що на сайті.
      if (const {'new', 'radio', 'library', 'search', 'artist', 'album', 'mix', 'genre', 'charts', 'replay'}.contains(rest(1)) && parts.length <= 3) return '$path$query';
      // Старі вкладки ?tab=… ведуть у нові розділи (як OLD_TABS у MusicHubController).
      return switch (uri?.queryParameters['tab']) {
        'mine' => '/music/library/songs',
        'playlists' => '/music/library/playlists',
        'spotify' => '/music/library/spotify',
        'discover' => '/music/new',
        _ => '/music',
      };
    case 'cinema':
      return '$path${rest(1) == 'my' ? query : ''}';
    case 'families':
      return rest(1) == 'create' ? '/families/create' : '/families';
    case 'watch':
      return '/watch/${rest(1)}';
    case 'listen':
      return '/listen/${rest(1)}';
    case 'events':
      return rest(1) == 'releases' ? '/events/releases' : '/events';
    case 'games':
    case 'clans':
      return parts.length > 2 && rest(1) != 'create' ? '/$head/${rest(1)}' : '$path$query';
    case 'party':
    case 'characters':
      return path;
    case 'servers':
    case 'communities':
    case 'friends':
    case 'people':
    case 'notifications':
    case 'feed':
      return '$path$query';
    case 'settings':
      return '/settings';
    case 'id':
      return '/feed';
    default:
      return '/u/$head';
  }
}

class AppShell extends StatefulWidget {
  const AppShell({required this.session, required this.player, required this.child, super.key});
  final Session session;
  final TrackPlayer player;
  final Widget child;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  @override
  void initState() {
    super.initState();
    widget.session.addListener(_onSession);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _onSession();
      if (mounted && widget.session.me != null) showWhatsNew(context, widget.session.prefs);
    });
  }

  @override
  void dispose() {
    widget.session.removeListener(_onSession);
    super.dispose();
  }

  void _onSession() {
    final uri = widget.session.handoff;
    if (!mounted || uri == null) return;
    // Натискання на віджет «Моя сім'я» — відкриваємо сім'ю.
    final fromWidget = FamilyWidget.routeFor(uri);
    if (fromWidget != null) {
      widget.session.consumeLink();
      context.push(fromWidget);
      return;
    }
    if (uri.host != 'spotify') return;
    widget.session.consumeLink();
    final failed = uri.queryParameters['error'];
    final ok = failed == null || failed.isEmpty;
    toast(context, ok ? tr('Spotify підключено.') : tr('Spotify не підключився.'));
    if (ok) widget.session.noteSpotify();
  }

  @override
  Widget build(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    final topInset = MediaQuery.viewPaddingOf(context).top;
    final chatOpen = RegExp(r'^/messages/\d+').hasMatch(path);
    return AppScope(
      session: widget.session,
      player: widget.player,
      child: Stage(
        child: ListenableBuilder(
          listenable: Listenable.merge([widget.player, widget.session, VoiceCall.instance]),
          builder: (context, _) {
            final keyboard = MediaQuery.viewInsetsOf(context).bottom > 0;
            final hideChrome = chatOpen && keyboard;
            final playing = widget.player.current != null && !hideChrome && !widget.player.covered;
            // Широкий екран (планшет): як сайт на комп'ютері — шапка на всю ширину, ліворуч список розділів.
            // Телефон і вертикальний планшет: як сайт на телефоні — шапка й острів-меню внизу.
            final screen = MediaQuery.sizeOf(context);
            final wide = screen.width >= tabletWidth;
            final tabletPortrait = !wide && screen.shortestSide >= 600;
            final contentWidth = wide ? tabletContentWidth : tabletPortraitWidth;
            final systemBottom = MediaQuery.viewPaddingOf(context).bottom;
            final inCall = VoiceCall.instance.active && !hideChrome;
            final island = wide || hideChrome ? 0.0 : islandExtent;
            final bottom = hideChrome ? 0.0 : systemBottom + (wide ? 8 : islandExtent) + (playing ? miniPlayerExtent : 0) + (inCall ? voiceBarExtent : 0);
            final contentLeft = wide ? sideNavWidth + 28 : 0.0;
            return ShellChrome(
              bottom: bottom,
              child: Scaffold(
                backgroundColor: Colors.transparent,
                resizeToAvoidBottomInset: true,
                body: Stack(
                  children: [
                    if (wide || tabletPortrait)
                      Positioned.fill(
                        left: contentLeft,
                        right: wide ? 16 : 0,
                        child: LayoutBuilder(
                          builder: (context, box) => Center(
                            child: SizedBox(width: math.min(box.maxWidth, contentWidth), height: box.maxHeight, child: widget.child),
                          ),
                        ),
                      )
                    else
                      widget.child,
                    Positioned(top: 0, left: 0, right: 0, child: TopBar(session: widget.session, player: widget.player, wide: wide, topInset: topInset)),
                    if (wide)
                      Positioned(
                        top: topInset + siteBarHeight + 10,
                        left: 12,
                        bottom: systemBottom + 8,
                        width: sideNavWidth,
                        child: SideList(session: widget.session, path: path),
                      ),
                    if (!hideChrome)
                      Positioned(
                        left: contentLeft,
                        right: wide ? 16 : 0,
                        bottom: (wide ? 0 : systemBottom) + island,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Розмова в голосовій кімнаті — над плеєром, на всіх екранах.
                            if (inCall)
                              Padding(
                                padding: EdgeInsets.only(bottom: wide && !playing ? systemBottom + 8 : 0),
                                child: Center(child: ConstrainedBox(constraints: BoxConstraints(maxWidth: wide || tabletPortrait ? contentWidth : double.infinity), child: VoiceBar())),
                              ),
                            if (playing && wide)
                              Padding(
                                padding: EdgeInsets.only(bottom: systemBottom + 8),
                                child: Center(child: ConstrainedBox(constraints: BoxConstraints(maxWidth: contentWidth), child: MiniPlayer(player: widget.player))),
                              )
                            else if (playing && tabletPortrait)
                              Center(child: ConstrainedBox(constraints: BoxConstraints(maxWidth: contentWidth), child: MiniPlayer(player: widget.player)))
                            else if (playing)
                              MiniPlayer(player: widget.player),
                          ],
                        ),
                      ),
                    // Острів — поверх усього, щоб розгорнуте меню й затемнення накривали екран.
                    if (!wide && !hideChrome) Positioned.fill(child: IslandNav(session: widget.session, player: widget.player, path: path)),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class CountBadge extends StatelessWidget {
  const CountBadge({required this.count, super.key});
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(minWidth: 18, minHeight: 18),
      padding: EdgeInsets.symmetric(horizontal: 5),
      alignment: Alignment.center,
      decoration: BoxDecoration(color: pink, borderRadius: BorderRadius.circular(10), border: Border.all(color: voidColor, width: 2)),
      child: Text(count > 99 ? '99+' : '$count', style: body(11, color: Colors.white, weight: FontWeight.w700).copyWith(height: 1)),
    );
  }
}

final _noticeKinds = <String, (IconData, Color)>{
  'post_like': (LucideIcons.heart, Color(0xFFF43F5E)),
  'post_comment': (LucideIcons.messageCircle, neonBlue),
  'wall_post': (LucideIcons.squarePen, violet),
  'friend_request': (LucideIcons.userRoundPlus, Color(0xFF10B981)),
  'friend_accepted': (LucideIcons.userRoundCheck, Color(0xFF10B981)),
  'community_request': (LucideIcons.shield, indigo),
  'community_approved': (LucideIcons.shieldCheck, indigo),
  'photo_like': (LucideIcons.heart, Color(0xFFF43F5E)),
  'photo_comment': (LucideIcons.image, Color(0xFF38BDF8)),
  'family_application': (LucideIcons.userRoundPlus, Color(0xFFF59E0B)),
  'family_accepted': (LucideIcons.crown, Color(0xFFF59E0B)),
  'family_report': (LucideIcons.clipboardCheck, Color(0xFFF59E0B)),
  'family_review': (LucideIcons.clipboardCheck, Color(0xFF10B981)),
  'family_cashout': (LucideIcons.wallet, Color(0xFF10B981)),
  'family_bank': (LucideIcons.wallet, Color(0xFF10B981)),
  'family_sanction': (LucideIcons.gavel, Color(0xFFF43F5E)),
  'family_kicked': (LucideIcons.gavel, Color(0xFFF43F5E)),
  'family_warehouse': (LucideIcons.package, Color(0xFFF43F5E)),
  'family_event': (LucideIcons.calendarDays, indigo),
};

(IconData, Color) noticeKind(String kind) =>
    _noticeKinds[kind] ?? (kind.startsWith('family_') ? (LucideIcons.crown, Color(0xFFF59E0B)) : (LucideIcons.bell, primary));

/// Панель сповіщень (на телефоні сайт показує її на всю ширину під шапкою).
Future<void> showNotifications(BuildContext context, Session session) {
  return showGcSheet<void>(
    context,
    title: tr('Сповіщення'),
    height: MediaQuery.sizeOf(context).height * 0.78,
    builder: (sheet) => NotificationsList(session: session, onOpen: (path) {
      Navigator.pop(sheet);
      context.push(appPathFor(path));
    }),
  );
}

class NotificationsList extends StatefulWidget {
  const NotificationsList({required this.session, required this.onOpen, super.key});
  final Session session;
  final ValueChanged<String?> onOpen;

  @override
  State<NotificationsList> createState() => _NotificationsListState();
}

class _NotificationsListState extends State<NotificationsList> {
  @override
  Widget build(BuildContext context) {
    return Remote(
      load: () => widget.session.api.get('/api/v1/notifications'),
      builder: (data, reload) {
        final rows = maps(data['notifications']);
        final unread = intOf(data['unread']);
        return Column(
          children: [
            if (unread > 0)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: () async {
                    await attempt(context, () => widget.session.api.post('/api/v1/notifications/read'));
                    await reload();
                    await widget.session.refreshCounters();
                  },
                  icon: Icon(LucideIcons.checkCheck, size: 16, color: primary),
                  label: Text(tr('Прочитати всі'), style: body(13, color: primary, weight: FontWeight.w600)),
                ),
              ),
            Expanded(
              child: rows.isEmpty
                  ? QuietEmpty(icon: LucideIcons.bell, text: tr('Сповіщень поки немає'))
                  : ListView.separated(
                      padding: EdgeInsets.fromLTRB(12, 0, 12, 20 + ShellChrome.bottomOf(context)),
                      itemCount: rows.length,
                      separatorBuilder: (_, _) => SizedBox(height: 2),
                      itemBuilder: (context, i) => NotificationRow(row: rows[i], onTap: () => widget.onOpen(text(rows[i]['url']))),
                    ),
            ),
          ],
        );
      },
    );
  }
}

class NotificationRow extends StatelessWidget {
  const NotificationRow({required this.row, required this.onTap, super.key});
  final Map<String, dynamic> row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final actor = mapOf(row['actor']);
    final kind = noticeKind(text(row['kind']) ?? '');
    final name = text(actor['name']) ?? '';
    final read = row['read'] == true;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        decoration: BoxDecoration(color: read ? Colors.transparent : primary.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(16)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Avatar(url: text(actor['avatar_url']), name: name.isEmpty ? 'GameCon' : name, size: 42),
                Positioned(
                  right: -3,
                  bottom: -3,
                  child: Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(color: kind.$2, shape: BoxShape.circle, border: Border.all(color: popover, width: 2)),
                    child: Icon(kind.$1, size: 10, color: Colors.white),
                  ),
                ),
              ],
            ),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text.rich(
                    TextSpan(children: [
                      if (name.isNotEmpty) TextSpan(text: '$name ', style: body(14, weight: FontWeight.w700)),
                      TextSpan(text: text(row['text']) ?? '', style: body(14, color: soft)),
                    ]),
                  ),
                  if (text(row['excerpt']) != null)
                    Padding(padding: EdgeInsets.only(top: 3), child: Text('«${text(row['excerpt'])}»', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(12.5, color: muted))),
                  SizedBox(height: 4),
                  Text(ago(row['created_at']), style: body(11.5, color: faint)),
                ],
              ),
            ),
            if (!read) Container(margin: EdgeInsets.only(top: 6, left: 6), width: 8, height: 8, decoration: BoxDecoration(color: primary, shape: BoxShape.circle)),
          ],
        ),
      ),
    );
  }
}
