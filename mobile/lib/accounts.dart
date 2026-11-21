import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'account_store.dart';
import 'alert_widget.dart';
import 'family_widget.dart';
import 'i18n.dart';
import 'pulse_widget.dart';
import 'state.dart';
import 'theme.dart';
import 'voice_room.dart';
import 'widgets.dart';

/// Пункти меню аватара — як `AccountSwitcher variant="menu"` на сайті, плюс «прибрати».
List<PopupMenuEntry<String>> accountMenuEntries(Session session) {
  if (!session.accountSwitcherOn) return const [];
  final others = session.otherAccounts;
  if (others.isEmpty && !session.canAddAccount) return const [];
  return [
    for (final account in others)
      PopupMenuItem<String>(
        value: 'account:${account.id}',
        enabled: false,
        height: 48,
        padding: const EdgeInsets.fromLTRB(8, 0, 4, 0),
        child: _MenuAccountRow(account: account),
      ),
    if (session.canAddAccount)
      PopupMenuItem<String>(
        value: 'add-account',
        height: 42,
        child: Row(
          children: [
            Icon(LucideIcons.userPlus, size: 18, color: muted),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                tr('Додати акаунт'),
                style: body(14, color: ink, weight: FontWeight.w500),
              ),
            ),
          ],
        ),
      ),
  ];
}

class _MenuAccountRow extends StatelessWidget {
  const _MenuAccountRow({required this.account});
  final StoredAccount account;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: InkWell(
            onTap: () => Navigator.pop(context, 'account:${account.id}'),
            borderRadius: BorderRadius.circular(10),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Avatar(url: account.avatarUrl, name: account.name, size: 28),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      account.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: body(14, color: ink, weight: FontWeight.w500),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        IconButton(
          tooltip: tr('Прибрати акаунт'),
          visualDensity: VisualDensity.compact,
          onPressed: () => Navigator.pop(context, 'forget:${account.id}'),
          icon: Icon(LucideIcons.x, size: 16, color: muted),
        ),
      ],
    );
  }
}

/// Кругла кнопка біля аватара в меню телефона — як `variant="quick"`: інший акаунт або «додати».
class AccountQuickButton extends StatelessWidget {
  const AccountQuickButton({
    required this.session,
    required this.player,
    required this.onClose,
    super.key,
  });
  final Session session;
  final TrackPlayer player;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    if (!session.accountSwitcherOn) return const SizedBox.shrink();
    final next = session.otherAccounts.firstOrNull;
    if (next == null && !session.canAddAccount) return const SizedBox.shrink();
    final label = next == null
        ? tr('Додати акаунт')
        : tr('Перемкнутися на {name}', {'name': next.name});
    return Padding(
      padding: const EdgeInsets.only(left: 8),
      child: Tooltip(
        message: label,
        child: Material(
          color: palette.isLight
              ? const Color.fromRGBO(15, 23, 42, 0.05)
              : const Color.fromRGBO(255, 255, 255, 0.06),
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            onTap: () {
              if (next != null) {
                switchStoredAccount(
                  context,
                  session,
                  player,
                  next.id,
                  onClose: onClose,
                );
              } else {
                beginAddingAccount(context, session, player, onClose: onClose);
              }
            },
            borderRadius: BorderRadius.circular(14),
            child: Semantics(
              button: true,
              label: label,
              child: SizedBox(
                width: 40,
                height: 40,
                child: Center(
                  child: next == null
                      ? const Icon(
                          LucideIcons.userPlus,
                          size: 18,
                          color: Color(0xFF38BDF8),
                        )
                      : Avatar(url: next.avatarUrl, name: next.name, size: 28),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Інші акаунти під карткою профілю в меню телефона: перемкнути, прибрати, додати.
class AccountSwitcherList extends StatelessWidget {
  const AccountSwitcherList({
    required this.session,
    required this.player,
    required this.onClose,
    super.key,
  });
  final Session session;
  final TrackPlayer player;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    if (!session.accountSwitcherOn) return const SizedBox.shrink();
    final others = session.otherAccounts;
    if (others.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Column(
        children: [
          for (final account in others)
            _SwitchRow(
              avatar: Avatar(
                url: account.avatarUrl,
                name: account.name,
                size: 28,
              ),
              label: account.name,
              onTap: () => switchStoredAccount(
                context,
                session,
                player,
                account.id,
                onClose: onClose,
              ),
              trailing: IconButton(
                tooltip: tr('Прибрати акаунт'),
                visualDensity: VisualDensity.compact,
                onPressed: () => removeStoredAccount(
                  context,
                  session,
                  player,
                  account,
                  onClose: onClose,
                ),
                icon: Icon(LucideIcons.x, size: 16, color: muted),
              ),
            ),
          if (session.canAddAccount)
            _SwitchRow(
              avatar: const Icon(
                LucideIcons.userPlus,
                size: 18,
                color: Color(0xFF38BDF8),
              ),
              label: tr('Додати акаунт'),
              onTap: () => beginAddingAccount(
                context,
                session,
                player,
                onClose: onClose,
              ),
            ),
        ],
      ),
    );
  }
}

class _SwitchRow extends StatelessWidget {
  const _SwitchRow({
    required this.avatar,
    required this.label,
    required this.onTap,
    this.trailing,
  });
  final Widget avatar;
  final String label;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(12),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 40),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Row(
                  children: [
                    avatar,
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: body(14, weight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        ?trailing,
      ],
    );
  }
}

Future<void> switchStoredAccount(
  BuildContext context,
  Session session,
  TrackPlayer? player,
  int id, {
  VoidCallback? onClose,
}) async {
  final router = GoRouter.of(context);
  onClose?.call();
  if (VoiceCall.instance.active) await VoiceCall.instance.leave();
  if (player != null) await player.stop();
  final ok = await session.switchTo(id);
  if (!ok) {
    if (context.mounted) {
      toast(context, tr('Цей акаунт більше не збережено на пристрої — увійдіть ще раз.'));
    }
    return;
  }
  _refreshHome(session);
  router.go('/feed');
}

Future<void> beginAddingAccount(
  BuildContext context,
  Session session,
  TrackPlayer player, {
  VoidCallback? onClose,
}) async {
  final router = GoRouter.of(context);
  onClose?.call();
  if (VoiceCall.instance.active) await VoiceCall.instance.leave();
  await player.stop();
  await session.prepareAddAccount();
  router.go('/login');
}

Future<void> removeStoredAccount(
  BuildContext context,
  Session session,
  TrackPlayer? player,
  StoredAccount account, {
  VoidCallback? onClose,
}) async {
  final router = GoRouter.of(context);
  final current = account.id == session.myId;
  final ok = await confirm(
    context,
    tr('Прибрати {name} з цього пристрою?', {'name': account.name}),
    text: tr('Увійти знову доведеться паролем.'),
    action: tr('Прибрати акаунт'),
    danger: true,
  );
  if (!ok || !context.mounted) return;
  onClose?.call();
  if (current) {
    if (VoiceCall.instance.active) await VoiceCall.instance.leave();
    if (player != null) await player.stop();
  }
  await session.removeAccount(account.id);
  if (current) router.go('/login');
}

/// Віджети головного екрана читають поточний токен — після зміни акаунта оновити їх.
void refreshHomeWidgets(Session session) => _refreshHome(session);

void _refreshHome(Session session) {
  final api = session.token == null ? null : session.api;
  unawaited(
    FamilyWidget.refresh(api, session.prefs).then((_) {}, onError: (_, _) {}),
  );
  unawaited(PulseWidget.refresh(api).then((_) {}, onError: (_, _) {}));
  unawaited(AlertWidget.refresh(api).then((_) {}, onError: (_, _) {}));
}
