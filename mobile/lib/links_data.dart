import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// «Зв’язки й дані» — як картки на сторінці «Акаунт» сайту: Telegram і Discord для ботів,
// сервери з входом через GameCon (скасувати доступ) і вивантаження своїх даних.
// «Вигляд профілю» — тема сторінки за улюбленою грою й порядок блоків профілю.

class ConnectionsScreen extends StatefulWidget {
  const ConnectionsScreen({super.key});

  @override
  State<ConnectionsScreen> createState() => _ConnectionsScreenState();
}

class _ConnectionsScreenState extends State<ConnectionsScreen> {
  bool exporting = false;

  Future<void> _export() async {
    final api = AppScope.read(context).session.api;
    setState(() => exporting = true);
    try {
      final token = api.token();
      final response = await http.get(Uri.parse('${Api.root}${Api.site('/settings/account/export')}'), headers: {if (token != null) 'Authorization': 'Bearer $token', 'Accept': 'application/json'});
      if (response.statusCode != 200) throw Exception(tr('Не вдалося вивантажити дані. Спробуйте за годину.'));
      await SharePlus.instance.share(ShareParams(files: [XFile.fromData(response.bodyBytes, mimeType: 'application/json', name: 'gamecon-data.json')], text: tr('Мої дані GameCon')));
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/settings/account')),
      builder: (d, reload) {
        final telegram = mapOf(d['telegram']);
        final connections = maps(d['connections']);
        final linked = telegram['username'] != null;
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Зв’язки й дані'), subtitle: tr('Месенджери, сервери з входом через GameCon і ваші дані.')),
            Glass(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                CardTitle(tr('Telegram і Discord'), icon: LucideIcons.messagesSquare),
                Text(tr('Щоб кнопки «Піду» в групах ботів GameCon записували саме вас.'), style: body(12.5, color: muted)),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('Telegram', style: body(14.5, weight: FontWeight.w600)),
                  subtitle: Text(linked ? (text(telegram['username']) == null || text(telegram['username'])!.isEmpty ? tr('Прив’язано') : '@${telegram['username']}') : tr('Не прив’язано'), style: body(12.5, color: muted)),
                  trailing: linked
                      ? TextButton(
                          onPressed: () async {
                            await attempt(context, () => api.delete(Api.site('/bots/telegram/account')));
                            await reload();
                          },
                          child: Text(tr('Відв’язати'), style: body(13, color: dangerSoft)),
                        )
                      : telegram['available'] == true
                          ? TextButton(
                              onPressed: () async {
                                try {
                                  final r = await api.post(Api.site('/bots/telegram/account'));
                                  final url = text(r['redirect']);
                                  if (url != null) await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
                                } catch (e) {
                                  if (context.mounted) toast(context, e);
                                }
                              },
                              child: Text(tr('Прив’язати'), style: body(13, color: primary)),
                            )
                          : Text(tr('Скоро'), style: body(12, color: faint)),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('Discord', style: body(14.5, weight: FontWeight.w600)),
                  subtitle: Text(
                    telegram['discord'] != null ? (text(telegram['discord']) ?? tr('Прив’язано')) : tr('Увійдіть через Discord на сторінці входу, щоб прив’язати.'),
                    style: body(12.5, color: muted),
                  ),
                ),
              ]),
            ),
            if (connections.isNotEmpty) ...[
              const SizedBox(height: 12),
              Glass(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  CardTitle(tr('Підключені сервери'), icon: LucideIcons.server),
                  Text(tr('Сервери, куди ви входили через GameCon. Скасуйте доступ, якщо більше там не граєте.'), style: body(12.5, color: muted)),
                  for (final c in connections)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(text(c['server']) ?? '', style: body(14.5, weight: FontWeight.w600)),
                      subtitle: Text(text(c['name']) ?? '', style: body(12.5, color: faint)),
                      onTap: text(c['slug']) == null ? null : () => context.push('/servers/${c['slug']}'),
                      trailing: TextButton(
                        onPressed: () async {
                          if (!await confirm(context, tr('Скасувати доступ?'), text: tr('Сервер більше не бачитиме ваш акаунт.'), action: tr('Скасувати доступ'), danger: true)) return;
                          if (!context.mounted) return;
                          await attempt(context, () => api.delete(Api.site('/settings/account/connections/${c['client_id']}')));
                          await reload();
                        },
                        child: Text(tr('Скасувати'), style: body(13, color: dangerSoft)),
                      ),
                    ),
                ]),
              ),
            ],
            const SizedBox(height: 12),
            Glass(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                CardTitle(tr('Мої дані'), icon: LucideIcons.download),
                Text(tr('Профіль, записи, друзі й повідомлення одним файлом JSON — збережіть або надішліть собі.'), style: body(12.5, color: muted)),
                const SizedBox(height: 10),
                GhostButton(label: exporting ? tr('Готуємо файл…') : tr('Вивантажити мої дані'), icon: LucideIcons.download, onPressed: exporting ? null : _export),
              ]),
            ),
          ],
        );
      },
    );
  }
}

class ProfileLookScreen extends StatefulWidget {
  const ProfileLookScreen({super.key});

  @override
  State<ProfileLookScreen> createState() => _ProfileLookScreenState();
}

class _ProfileLookScreenState extends State<ProfileLookScreen> {
  Map<String, dynamic>? base;
  List<String> blocks = [];
  bool saving = false;

  static Map<String, String> get _labels => {
    'platforms': tr('Платформи'),
    'steam': tr('Бібліотека Steam'),
    'steam_achievements': tr('Досягнення Steam'),
    'setup': tr('Мій сетап'),
    'stream_schedule': tr('Розклад стрімів'),
    'games': tr('Ігри: граю зараз'),
    'about': tr('Про себе'),
    'achievements': tr('Досягнення'),
    'characters': tr('Персонажі RP'),
    'audio': tr('Аудіозаписи'),
    'friends': tr('Друзі'),
    'photos': tr('Фото'),
  };

  Api get api => AppScope.read(context).session.api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final d = await api.get(Api.site('/settings/appearance'));
      if (!mounted) return;
      setState(() {
        base = d;
        blocks = [for (final b in (d['profile_blocks'] as List? ?? const [])) '$b'];
      });
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _saveBlocks() async {
    final d = base!;
    final quiet = mapOf(d['quiet']);
    setState(() => saving = true);
    await attempt(
      context,
      () => api.put(Api.site('/settings/appearance'), {
        'palette': text(d['palette']) ?? 'default',
        'languages': d['languages'] ?? const [],
        'looking_for_group': d['looking_for_group'] == true,
        'quiet_enabled': quiet['enabled'] == true,
        'quiet_from': text(quiet['from']) ?? '23:00',
        'quiet_to': text(quiet['to']) ?? '08:00',
        'profile_blocks': blocks,
      }),
      success: tr('Порядок збережено.'),
    );
    if (mounted) setState(() => saving = false);
  }

  Future<void> _pickGame() async {
    final picked = await showGcSheet<Map<String, dynamic>>(context, title: tr('Улюблена гра'), height: MediaQuery.sizeOf(context).height * 0.7, builder: (sheet) => const _GamePicker());
    if (picked == null || !mounted) return;
    await attempt(context, () => api.put(Api.site('/settings/game-theme'), {'game_id': picked['id']}), success: tr('Тему профілю оновлено.'));
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final d = base;
    if (d == null) return const ScreenScroll(children: [SizedBox(height: 200, child: Center(child: CircularProgressIndicator()))]);
    final theme = mapOf(d['gameTheme']);
    final game = mapOf(theme['game']);
    return ScreenScroll(children: [
      PageTitle(tr('Вигляд профілю'), subtitle: tr('Тема сторінки за улюбленою грою й порядок блоків.')),
      if (d['gameThemeOn'] == true)
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CardTitle(tr('Тема профілю за грою'), icon: LucideIcons.palette),
            if (game.isNotEmpty)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: ClipRRect(borderRadius: BorderRadius.circular(8), child: SizedBox(width: 40, height: 52, child: NetImage(text(game['cover'])))),
                title: Text(text(game['name']) ?? '', style: body(14.5, weight: FontWeight.w600)),
                subtitle: Text(tr('Кольори сторінки взято з обкладинки'), style: body(12, color: faint)),
              )
            else
              Text(tr('Оберіть гру — сторінка профілю набере її кольори.'), style: body(13, color: muted)),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: GhostButton(label: game.isEmpty ? tr('Обрати гру') : tr('Інша гра'), icon: LucideIcons.gamepad2, compact: true, onPressed: _pickGame)),
              if (game.isNotEmpty) ...[
                const SizedBox(width: 8),
                Expanded(
                  child: GhostButton(label: tr('Прибрати'), compact: true, onPressed: () async {
                    await attempt(context, () => api.put(Api.site('/settings/game-theme'), {'game_id': null}));
                    await _load();
                  }),
                ),
              ],
            ]),
          ]),
        ),
      const SizedBox(height: 12),
      Glass(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          CardTitle(tr('Порядок блоків'), icon: LucideIcons.arrowUpDown),
          Text(tr('Перетягніть, щоб змінити порядок на сторінці профілю.'), style: body(12.5, color: muted)),
          ReorderableListView(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            buildDefaultDragHandles: false,
            onReorderItem: (from, to) => setState(() => blocks.insert(to, blocks.removeAt(from))),
            children: [
              for (final (i, b) in blocks.indexed)
                ListTile(
                  key: ValueKey(b),
                  contentPadding: EdgeInsets.zero,
                  title: Text(_labels[b] ?? b, style: body(14.5)),
                  trailing: ReorderableDragStartListener(index: i, child: Icon(LucideIcons.gripVertical, color: muted)),
                ),
            ],
          ),
          const SizedBox(height: 8),
          PrimaryButton(label: tr('Зберегти порядок'), icon: LucideIcons.check, busy: saving, onPressed: _saveBlocks),
        ]),
      ),
    ]);
  }
}

/// Пошук гри для теми профілю (той самий каталог, що й «Ігри»).
class _GamePicker extends StatefulWidget {
  const _GamePicker();

  @override
  State<_GamePicker> createState() => _GamePickerState();
}

class _GamePickerState extends State<_GamePicker> {
  final query = TextEditingController();
  List<Map<String, dynamic>> games = [];

  @override
  void dispose() {
    query.dispose();
    super.dispose();
  }

  Future<void> _search(String q) async {
    if (q.trim().length < 2) return;
    try {
      final d = await AppScope.read(context).session.api.get('/api/v1/games?q=${Uri.encodeQueryComponent(q.trim())}');
      if (mounted) setState(() => games = Listing.parse(d['games']).items);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Column(children: [
        SearchField(controller: query, hint: tr('Назва гри'), onSearch: _search),
        const SizedBox(height: 8),
        Expanded(
          child: ListView(children: [
            for (final g in games)
              ListTile(
                leading: ClipRRect(borderRadius: BorderRadius.circular(6), child: SizedBox(width: 32, height: 42, child: NetImage(text(g['cover'])))),
                title: Text(text(g['name']) ?? '', style: body(14.5, weight: FontWeight.w600)),
                onTap: () => Navigator.pop(context, g),
              ),
          ]),
        ),
      ]),
    );
  }
}
