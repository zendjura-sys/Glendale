import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'shell.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

const _channel = MethodChannel('gamecon/app');

/// «Грає в…»: сервер GTA або гра, з іконкою; дотик — на сторінку сервера чи гри.
class PlayingBadge extends StatelessWidget {
  const PlayingBadge(this.playing, {super.key});
  final Map<String, dynamic> playing;

  @override
  Widget build(BuildContext context) {
    final icon = text(playing['icon']);
    final note = text(playing['note']);
    final url = text(playing['url']);
    return GestureDetector(
      onTap: url == null ? null : () => context.push(appPathFor(url)),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(color: green.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null)
            NetImage(icon, width: 16, height: 16, radius: 4)
          else
            Icon(playing['kind'] == 'server' ? LucideIcons.server : LucideIcons.gamepad2, size: 14, color: green),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              'Грає в ${playing['label']}${note != null ? ' · $note' : ''}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: body(12.5, color: const Color(0xFFA7F3D0), weight: FontWeight.w600),
            ),
          ),
        ]),
      ),
    );
  }
}

/// Налаштування «Граю в…»: автоматично (Discord, Steam, телефон) або вручну.
class PlayingSettingsScreen extends StatefulWidget {
  const PlayingSettingsScreen({super.key});

  @override
  State<PlayingSettingsScreen> createState() => _PlayingSettingsScreenState();
}

class _PlayingSettingsScreenState extends State<PlayingSettingsScreen> with WidgetsBindingObserver {
  Map<String, dynamic>? data;
  final search = TextEditingController();
  final note = TextEditingController();
  final steam = TextEditingController();
  Timer? _debounce;
  List<Map<String, dynamic>> options = [];
  Map<String, dynamic>? picked;
  int hours = 3;
  bool mobile = false;
  bool usageAccess = false;
  bool _awaitingAccess = false;

  Session get session => AppScope.read(context).session;
  Api get api => session.api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      mobile = session.prefs.getBool('playing_mobile') ?? false;
      _load();
      _search();
      _checkAccess();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _debounce?.cancel();
    for (final c in [search, note, steam]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Повернулися з системних налаштувань «Доступ до використання» — перевіряємо й вмикаємо.
    if (state == AppLifecycleState.resumed && _awaitingAccess) {
      _awaitingAccess = false;
      _checkAccess().then((_) {
        if (usageAccess) _setMobile(true);
      });
    }
  }

  Future<void> _load() async {
    try {
      final result = await api.get(Api.site('/me/playing'));
      if (mounted) setState(() => data = result);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _checkAccess() async {
    if (!Platform.isAndroid) return;
    try {
      final ok = await _channel.invokeMethod<bool>('usageAccess') ?? false;
      if (mounted) setState(() => usageAccess = ok);
    } catch (_) {}
  }

  Future<void> _search() async {
    try {
      final result = await api.get(Api.site('/me/playing/search?q=${Uri.encodeQueryComponent(search.text.trim())}'));
      if (mounted) setState(() => options = [...maps(result['servers']), ...maps(result['games'])]);
    } catch (_) {}
  }

  Future<void> _act(Future<dynamic> Function() action) async {
    if (await attempt(context, action)) await _load();
  }

  /// Ігри з телефона: потрібен «Доступ до використання»; перевірка — у фоні раз на 15 хвилин.
  Future<void> _setMobile(bool on) async {
    if (on && !usageAccess) {
      final go = await confirm(
        context,
        'Доступ до використання',
        text: 'Щоб GameCon бачив, у яку гру ви граєте на телефоні, дозвольте «Доступ до використання» для GameCon у налаштуваннях, що відкриються. '
            'На сервер надсилається лише гра, що на екрані (застосунки категорії «Ігри» або з каталогу GameCon), — нічого іншого.',
        action: 'Відкрити налаштування',
      );
      if (!go) return;
      _awaitingAccess = true;
      await _channel.invokeMethod('openUsageAccess');
      return;
    }
    try {
      if (on) {
        final packages = await api.get('/api/v1/me/playing/packages');
        final list = (packages['packages'] is List ? packages['packages'] as List : const []).map((p) => '$p').join(',');
        await session.prefs.setString('game_packages', list);
      } else {
        await api.post('/api/v1/me/playing/mobile', {'package': null});
      }
      await session.prefs.setBool('playing_mobile', on);
      await _channel.invokeMethod('playingSchedule', {'enabled': on});
      if (on) await _channel.invokeMethod('playingCheck');
      if (!mounted) return;
      setState(() => mobile = on);
      toast(context, on ? 'Готово: гра з телефона з’являтиметься в статусі.' : 'Ігри з телефона більше не показуються.');
      await _load();
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) return const Center(child: CircularProgressIndicator(strokeWidth: 2.4));
    final playing = d['playing'] is Map ? mapOf(d['playing']) : null;
    final discord = mapOf(d['discord']);
    final steamInfo = mapOf(d['steam']);
    final hoursList = (d['hours'] is List ? d['hours'] as List : const [1, 3, 6, 12, 24]).map((h) => intOf(h)).toList();

    return ScreenScroll(
      onRefresh: _load,
      children: [
        const PageTitle('Граю в…', subtitle: 'Статус біля аватарки: де ви зараз граєте. Ставиться сам або вручну.'),
        if (playing != null)
          Glass(
            child: Row(children: [
              Expanded(child: Align(alignment: Alignment.centerLeft, child: PlayingBadge(playing))),
              Text(playing['auto'] == true ? 'автоматично' : 'вручну', style: body(11.5, color: faint)),
              IconButton(
                tooltip: 'Прибрати',
                onPressed: () => _act(() => api.delete(Api.site('/me/playing'))),
                icon: const Icon(LucideIcons.x, size: 18, color: muted),
              ),
            ]),
          ),
        const SizedBox(height: 12),
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text('Автоматично', style: body(15, weight: FontWeight.w700))),
              GcSwitch(value: d['auto'] == true, onChanged: (v) => _act(() => api.put(Api.site('/me/playing/auto'), {'auto': v}))),
            ]),
            const SizedBox(height: 6),
            Text('Статус ставиться сам, щойно ви запускаєте гру.', style: body(12.5, color: muted)),
            const SizedBox(height: 12),
            if (Platform.isAndroid) ...[
              Row(children: [
                const Icon(LucideIcons.smartphone, size: 18, color: primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Ігри на цьому телефоні', style: body(14, weight: FontWeight.w600)),
                    Text(usageAccess ? 'Доступ до використання надано' : 'Потрібен «Доступ до використання»', style: body(12, color: usageAccess ? green : faint)),
                  ]),
                ),
                GcSwitch(value: mobile && usageAccess, onChanged: _setMobile),
              ]),
              const Divider(height: 24, color: line),
            ],
            Row(children: [
              const Icon(LucideIcons.messageCircle, size: 18, color: primary),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Discord', style: body(14, weight: FontWeight.w600)),
                  Text(
                    discord['linked'] == true
                        ? 'Прив’язано. Будьте на Discord-сервері GameCon і ввімкніть показ активності.'
                        : 'Прив’яжіть Discord — гра й сервер GTA підтягнуться з вашого статусу в Discord.',
                    style: body(12, color: faint),
                  ),
                ]),
              ),
              if (discord['linked'] != true)
                TextButton(
                  onPressed: () => launchUrl(Uri.parse('${Api.root}/auth/discord'), mode: LaunchMode.externalApplication),
                  child: Text('Прив’язати', style: body(13, color: primary, weight: FontWeight.w700)),
                ),
            ]),
            if (steamInfo['available'] == true) ...[
              const Divider(height: 24, color: line),
              Row(children: [
                const Icon(LucideIcons.monitor, size: 18, color: primary),
                const SizedBox(width: 10),
                Expanded(child: Text('Steam (ігри на ПК)', style: body(14, weight: FontWeight.w600))),
                if (steamInfo['linked'] == true)
                  TextButton(
                    onPressed: () => _act(() => api.delete(Api.site('/me/playing/steam'))),
                    child: Text('Відв’язати', style: body(13, color: dangerSoft)),
                  ),
              ]),
              if (steamInfo['linked'] != true) ...[
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(child: GcField(controller: steam, label: 'Посилання на профіль Steam', dense: true)),
                  const SizedBox(width: 8),
                  PrimaryButton(
                    label: 'Прив’язати',
                    expand: false,
                    compact: true,
                    onPressed: () => _act(() => api.post(Api.site('/me/playing/steam'), {'profile': steam.text.trim()})),
                  ),
                ]),
              ] else
                Text('Прив’язано', style: body(12, color: green)),
            ],
          ]),
        ),
        const SectionLabel('Вручну'),
        GcField(
          controller: search,
          label: 'Сервер GTA або гра',
          icon: LucideIcons.search,
          dense: true,
          onChanged: (_) {
            _debounce?.cancel();
            _debounce = Timer(const Duration(milliseconds: 300), _search);
          },
        ),
        const SizedBox(height: 6),
        for (final o in options)
          ListTile(
            contentPadding: EdgeInsets.zero,
            selected: picked?['kind'] == o['kind'] && picked?['id'] == o['id'],
            selectedTileColor: indigo.withValues(alpha: 0.15),
            leading: text(o['icon']) != null
                ? NetImage(text(o['icon']), width: 36, height: 36, radius: 9)
                : Icon(o['kind'] == 'server' ? LucideIcons.server : LucideIcons.gamepad2, color: muted),
            title: Text(text(o['label']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14)),
            subtitle: Text(text(o['hint']) ?? '', style: body(11.5, color: faint)),
            onTap: () => setState(() => picked = o),
          ),
        if (picked != null) ...[
          const SizedBox(height: 8),
          GcField(controller: note, label: 'Підпис: сім’я, персонаж… (необов’язково)'),
          const SizedBox(height: 8),
          ChipRow(options: [for (final h in hoursList) ('$h', 'на $h год')], selected: '$hours', onSelect: (v) => setState(() => hours = int.parse(v))),
          const SizedBox(height: 10),
          PrimaryButton(
            label: 'Поставити «Граю в ${picked!['label']}»',
            icon: LucideIcons.gamepad2,
            onPressed: () => _act(() => api.put(Api.site('/me/playing'), {'kind': picked!['kind'], 'id': picked!['id'], 'note': note.text.trim(), 'hours': hours})),
          ),
        ],
      ],
    );
  }
}
