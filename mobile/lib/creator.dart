import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'skeletons.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Дні розкладу: 1 — понеділок … 7 — неділя (як на сайті).
List<String> streamDays() => [
  tr('Понеділок'),
  tr('Вівторок'),
  tr('Середа'),
  tr('Четвер'),
  tr('Пʼятниця'),
  tr('Субота'),
  tr('Неділя'),
];

String _hhmm(String value) {
  final parts = value.split(':');
  var h = int.tryParse(parts.first) ?? 20;
  var m = parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0;
  if (h < 0) h = 0;
  if (h > 23) h = 23;
  if (m < 0) m = 0;
  if (m > 59) m = 59;
  return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}';
}

int _day(dynamic value) {
  final day = intOf(value, 5);
  if (day < 1) return 1;
  if (day > 7) return 7;
  return day;
}

/// «пн 20:00» у часовому поясі телефона (сервер віддає найближчий момент у UTC).
String slotWhen(dynamic iso) {
  final dt = DateTime.tryParse(text(iso) ?? '')?.toLocal();
  if (dt == null) return '';
  const short = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];
  return '${short[dt.weekday - 1]} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
}

String _eventLabel(String event) => switch (event) {
  'posts' => tr('Мої записи'),
  'streams' => tr('Початок стріму'),
  'news' => tr('Новини сервера'),
  _ => event,
};

/// Ціна рівня в сотих частках одиниць → «50» для поля.
String unitsInput(int hundredths) {
  if (hundredths % 100 == 0) return '${hundredths ~/ 100}';
  var text = (hundredths / 100).toStringAsFixed(2);
  text = text.replaceFirst(RegExp(r'0+$'), '').replaceFirst(RegExp(r'\.$'), '');
  return text.replaceAll('.', ',');
}

int? hundredthsOf(String raw) {
  final n = double.tryParse(
    raw.trim().replaceAll(' ', '').replaceAll(',', '.'),
  );
  if (n == null || n.isNaN || n.isInfinite) return null;
  return (n * 100).round();
}

/// «250 од.» — розрахункові одиниці балансу, не гроші.
String balanceUnits(dynamic hundredths) =>
    tr('{n} од.', {'n': unitsInput(intOf(hundredths))});

void _back(BuildContext context, [String fallback = '/settings']) {
  if (context.canPop()) {
    context.pop();
  } else {
    context.go(fallback);
  }
}

// ───────────────────────── Розклад стрімів ─────────────────────────

/// Слоти стріму на сторінці людини. Власник відкриває редактор.
class StreamSchedulePanel extends StatefulWidget {
  const StreamSchedulePanel({
    required this.username,
    required this.isSelf,
    super.key,
  });
  final String username;
  final bool isSelf;

  @override
  State<StreamSchedulePanel> createState() => _StreamSchedulePanelState();
}

class _StreamSchedulePanelState extends State<StreamSchedulePanel> {
  List<Map<String, dynamic>>? slots;
  bool hidden = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final session = AppScope.read(context).session;
    if (!session.pluginOn('stream_schedule')) {
      if (mounted) setState(() => hidden = true);
      return;
    }
    try {
      final List<Map<String, dynamic>> list;
      if (widget.isSelf) {
        final data = await session.api.get(
          Api.site('/settings/stream-schedule'),
        );
        list = maps(data['slots']);
      } else {
        // Чужий розклад — відкладене поле сторінки профілю (ті самі слоти, що на сайті).
        final data = await session.api.get(
          Api.site('/u/${widget.username}'),
          headers: const {
            'X-Inertia-Partial-Component': 'profile/show',
            'X-Inertia-Partial-Data': 'streamSchedule',
          },
        );
        list = maps(data['streamSchedule']);
      }
      if (!mounted) return;
      setState(() {
        slots = list;
        hidden = !widget.isSelf && list.isEmpty;
      });
    } catch (_) {
      if (mounted) setState(() => hidden = !widget.isSelf);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (hidden || slots == null) return const SizedBox.shrink();
    final list = slots!;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Glass(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            CardTitle(tr('Розклад стрімів'), icon: LucideIcons.calendarClock),
            const SizedBox(height: 10),
            if (list.isEmpty)
              Text(
                tr('Коли ви стрімите? Глядачі побачать найближчий стрім.'),
                style: body(13.5, color: muted),
              )
            else ...[
              _NextStream(slot: list.first),
              for (final slot in list.skip(1))
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Row(
                    children: [
                      Icon(LucideIcons.calendarClock, size: 16, color: faint),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _slotLine(slot),
                          style: body(13.5, color: soft),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
            if (widget.isSelf) ...[
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerLeft,
                child: GhostButton(
                  label: list.isEmpty ? tr('Додати розклад') : tr('Змінити'),
                  icon: LucideIcons.pencil,
                  compact: true,
                  expand: false,
                  onPressed: () async {
                    await context.push('/settings/stream-schedule');
                    if (mounted) await _load();
                  },
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

String _slotLine(Map<String, dynamic> slot) {
  final when = slotWhen(slot['next_at']);
  final title = text(slot['title']);
  if (title == null) return when;
  return '$when · $title';
}

class _NextStream extends StatelessWidget {
  const _NextStream({required this.slot});
  final Map<String, dynamic> slot;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: primary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Icon(LucideIcons.radio, color: accent),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tr('Наступний стрім'), style: body(12, color: muted)),
                Text(_slotLine(slot), style: body(14, weight: FontWeight.w700)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SlotDraft {
  _SlotDraft({required this.day, required this.time, String title = ''})
    : title = TextEditingController(text: title);
  int day;
  String time;
  final TextEditingController title;
  void dispose() => title.dispose();
}

/// Редактор щотижневих слотів (`PUT /site/settings/stream-schedule`).
class StreamScheduleScreen extends StatefulWidget {
  const StreamScheduleScreen({super.key});

  @override
  State<StreamScheduleScreen> createState() => _StreamScheduleScreenState();
}

class _StreamScheduleScreenState extends State<StreamScheduleScreen> {
  List<_SlotDraft>? slots;
  bool busy = false;
  Object? error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    for (final slot in slots ?? const <_SlotDraft>[]) {
      slot.dispose();
    }
    super.dispose();
  }

  void _drop(_SlotDraft slot) {
    WidgetsBinding.instance.addPostFrameCallback((_) => slot.dispose());
  }

  Future<void> _load() async {
    final api = AppScope.read(context).session.api;
    try {
      final data = await api.get(Api.site('/settings/stream-schedule'));
      if (!mounted) return;
      final previous = slots ?? const <_SlotDraft>[];
      setState(() {
        slots = [
          for (final row in maps(data['slots']))
            _SlotDraft(
              day: _day(row['day']),
              time: _hhmm(text(row['time']) ?? '20:00'),
              title: text(row['title']) ?? '',
            ),
        ];
        error = null;
      });
      for (final slot in previous) {
        _drop(slot);
      }
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  Future<void> _pickTime(_SlotDraft slot) async {
    final parts = slot.time.split(':');
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: int.tryParse(parts.first) ?? 20,
        minute: parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0,
      ),
    );
    if (picked == null || !mounted) return;
    setState(
      () => slot.time =
          '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}',
    );
  }

  Future<void> _save() async {
    final list = slots;
    if (list == null) return;
    setState(() => busy = true);
    final ok = await attempt(
      context,
      () =>
          AppScope.read(context).session.api
              .put(Api.site('/settings/stream-schedule'), {
                'slots': [
                  for (final slot in list)
                    {
                      'day': slot.day,
                      'time': slot.time,
                      'title': slot.title.text.trim(),
                    },
                ],
              }),
      success: tr('Розклад збережено.'),
    );
    if (!mounted) return;
    setState(() => busy = false);
    if (ok) _back(context);
  }

  void _remove(_SlotDraft slot) {
    setState(() => slots?.remove(slot));
    _drop(slot);
  }

  @override
  Widget build(BuildContext context) {
    final list = slots;
    if (error != null && list == null) {
      return Center(
        child: EmptyState(
          icon: LucideIcons.calendarClock,
          title: tr('Розклад не відкрився'),
          text: '$error',
          action: tr('Спробувати знову'),
          onAction: _load,
        ),
      );
    }
    if (list == null) return const ScreenSkeleton();
    final days = streamDays();
    return ScreenScroll(
      onRefresh: _load,
      children: [
        PageTitle(
          tr('Розклад стрімів'),
          subtitle: tr(
            'Час — за Києвом; глядачі бачать його у своєму часовому поясі.',
          ),
          trailing: RoundIcon(
            icon: LucideIcons.arrowLeft,
            onTap: () => _back(context),
          ),
        ),
        Glass(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final slot in list) ...[
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<int>(
                          value: slot.day,
                          isExpanded: true,
                          dropdownColor: popover,
                          borderRadius: BorderRadius.circular(16),
                          style: body(14.5),
                          items: [
                            for (var i = 0; i < days.length; i++)
                              DropdownMenuItem(
                                value: i + 1,
                                child: Text(days[i], style: body(14.5)),
                              ),
                          ],
                          onChanged: busy
                              ? null
                              : (value) {
                                  if (value != null) {
                                    setState(() => slot.day = value);
                                  }
                                },
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    GhostButton(
                      label: slot.time,
                      icon: LucideIcons.clock,
                      compact: true,
                      expand: false,
                      onPressed: busy
                          ? null
                          : () {
                              _pickTime(slot);
                            },
                    ),
                    IconButton(
                      tooltip: tr('Видалити'),
                      onPressed: busy ? null : () => _remove(slot),
                      icon: Icon(LucideIcons.trash2, color: muted, size: 18),
                    ),
                  ],
                ),
                GcField(controller: slot.title, label: tr('Що стрімите')),
                const SizedBox(height: 12),
              ],
              if (list.length < 7)
                GhostButton(
                  label: tr('Додати слот'),
                  icon: LucideIcons.plus,
                  compact: true,
                  onPressed: busy
                      ? null
                      : () => setState(
                          () => list.add(_SlotDraft(day: 5, time: '20:00')),
                        ),
                ),
              const SizedBox(height: 12),
              PrimaryButton(
                label: tr('Зберегти'),
                icon: LucideIcons.check,
                busy: busy,
                onPressed: busy
                    ? null
                    : () {
                        _save();
                      },
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ───────────────────────── Автопостинг ─────────────────────────

/// Discord-вебхук або Telegram-канал: свої записи, старт стріму чи новини сервера.
class CrosspostScreen extends StatefulWidget {
  const CrosspostScreen({this.ownerType = 'user', this.ownerId, super.key});
  final String ownerType;
  final int? ownerId;

  @override
  State<CrosspostScreen> createState() => _CrosspostScreenState();
}

class _CrosspostScreenState extends State<CrosspostScreen> {
  final target = TextEditingController();
  List<Map<String, dynamic>>? targets;
  List<String> events = const [];
  Set<String> picked = {};
  String platform = 'discord';
  bool busy = false;
  Object? error;

  @override
  void dispose() {
    target.removeListener(_onTarget);
    target.dispose();
    super.dispose();
  }

  void _onTarget() {
    if (mounted) setState(() {});
  }

  int? get _ownerId {
    if (widget.ownerId != null) return widget.ownerId;
    if (widget.ownerType != 'user') return null;
    final raw = AppScope.read(context).session.me?['id'];
    if (raw is int) return raw;
    return int.tryParse('${raw ?? ''}');
  }

  String? get _base {
    final id = _ownerId;
    if (id == null) return null;
    return Api.site('/crosspost/${widget.ownerType}/$id');
  }

  @override
  void initState() {
    super.initState();
    target.addListener(_onTarget);
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final base = _base;
    if (base == null) {
      if (mounted) setState(() => error = tr('Немає прав на автопостинг.'));
      return;
    }
    try {
      final data = await AppScope.read(context).session.api.get(base);
      if (!mounted) return;
      final rawEvents = data['events'];
      final nextEvents = rawEvents is List
          ? [for (final event in rawEvents) '$event']
          : <String>[];
      setState(() {
        targets = maps(data['targets']);
        events = nextEvents;
        if (picked.isEmpty) picked = nextEvents.toSet();
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  Future<void> _run(
    Future<Map<String, dynamic>> Function(Api api, String base) action, {
    String? success,
    bool clear = false,
  }) async {
    final base = _base;
    if (base == null || busy) return;
    setState(() => busy = true);
    try {
      final data = await action(AppScope.read(context).session.api, base);
      if (!mounted) return;
      setState(() {
        targets = maps(data['targets']);
        if (clear) target.clear();
      });
      if (success != null) toast(context, success);
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = targets;
    if (error != null && list == null) {
      return Center(
        child: EmptyState(
          icon: LucideIcons.send,
          title: tr('Автопостинг недоступний'),
          text: '$error',
          action: tr('Спробувати знову'),
          onAction: _load,
        ),
      );
    }
    if (list == null) return const ScreenSkeleton();
    return ScreenScroll(
      onRefresh: _load,
      children: [
        PageTitle(
          tr('Автопостинг'),
          subtitle: tr(
            'Discord: вебхук каналу (Налаштування каналу → Інтеграції → Вебхуки). Telegram: додайте бота GameCon адміністратором каналу й вкажіть @канал.',
          ),
          trailing: RoundIcon(
            icon: LucideIcons.arrowLeft,
            onTap: () => _back(context),
          ),
        ),
        if (list.isNotEmpty)
          Glass(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                for (final row in list)
                  ListTile(
                    title: Text(
                      text(row['label']) ??
                          (row['platform'] == 'telegram'
                              ? 'Telegram'
                              : 'Discord'),
                      style: body(14.5, weight: FontWeight.w600),
                    ),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          [
                            for (final event
                                in (row['events'] is List
                                    ? row['events'] as List
                                    : const []))
                              _eventLabel('$event'),
                          ].join(' · '),
                          style: body(12, color: muted),
                        ),
                        if (text(row['last_error']) != null)
                          Text(
                            text(row['last_error'])!,
                            style: body(12, color: dangerSoft),
                          ),
                      ],
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        GcSwitch(
                          value: row['enabled'] == true,
                          onChanged: busy
                              ? null
                              : (on) {
                                  _run(
                                    (api, base) => api.patch(
                                      '$base/${row['id']}',
                                      {'enabled': on},
                                    ),
                                  );
                                },
                        ),
                        IconButton(
                          tooltip: tr('Видалити'),
                          onPressed: busy
                              ? null
                              : () {
                                  _run(
                                    (api, base) =>
                                        api.delete('$base/${row['id']}'),
                                  );
                                },
                          icon: Icon(
                            LucideIcons.trash2,
                            size: 18,
                            color: muted,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        const SizedBox(height: 12),
        Glass(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Segmented(
                options: [
                  SegmentOption('discord', 'Discord'),
                  SegmentOption('telegram', 'Telegram'),
                ],
                selected: platform,
                onSelect: (value) => setState(() => platform = value),
              ),
              const SizedBox(height: 12),
              GcField(
                controller: target,
                label: platform == 'discord'
                    ? 'https://discord.com/api/webhooks/…'
                    : tr('@назва_каналу'),
              ),
              if (events.length > 1) ...[
                const SizedBox(height: 8),
                for (final event in events)
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    value: picked.contains(event),
                    title: Text(_eventLabel(event), style: body(14)),
                    onChanged: busy
                        ? null
                        : (on) => setState(() {
                            if (on == true) {
                              picked.add(event);
                            } else {
                              picked.remove(event);
                            }
                          }),
                  ),
              ],
              const SizedBox(height: 12),
              PrimaryButton(
                label: tr('Підключити'),
                icon: LucideIcons.send,
                busy: busy,
                onPressed: busy || target.text.trim().isEmpty || picked.isEmpty
                    ? null
                    : () {
                        _run(
                          (api, base) => api.post(base, {
                            'platform': platform,
                            'target': target.text.trim(),
                            'events': picked.toList(),
                          }),
                          success: tr(
                            'Канал підключено — там уже є пробне повідомлення.',
                          ),
                          clear: true,
                        );
                      },
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ───────────────────────── Статистика автора ─────────────────────────

/// Останні 30 днів: підсумки, реакції по днях і найкращі записи. Лише для себе.
class AuthorStatsScreen extends StatelessWidget {
  const AuthorStatsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = AppScope.of(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/me/author-stats')),
      builder: (data, reload) {
        final totals = mapOf(data['totals']);
        final days = maps(data['days']);
        final top = maps(data['top']);
        var peak = 1;
        for (final day in days) {
          final n = intOf(day['likes']) + intOf(day['comments']);
          if (n > peak) peak = n;
        }
        final cards = [
          (LucideIcons.penLine, tr('Записів'), intOf(totals['posts'])),
          (LucideIcons.eye, tr('Переглядів'), intOf(totals['views'])),
          (LucideIcons.heart, tr('Вподобань'), intOf(totals['likes'])),
          (
            LucideIcons.messageCircle,
            tr('Коментарів'),
            intOf(totals['comments']),
          ),
        ];
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(
              tr('Статистика автора'),
              subtitle: tr('Останні 30 днів. Бачите лише ви.'),
              trailing: RoundIcon(
                icon: LucideIcons.arrowLeft,
                onTap: () => _back(context, '/profile'),
              ),
            ),
            Row(
              children: [
                Expanded(
                  child: _StatTile(
                    icon: cards[0].$1,
                    label: cards[0].$2,
                    value: cards[0].$3,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _StatTile(
                    icon: cards[1].$1,
                    label: cards[1].$2,
                    value: cards[1].$3,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _StatTile(
                    icon: cards[2].$1,
                    label: cards[2].$2,
                    value: cards[2].$3,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _StatTile(
                    icon: cards[3].$1,
                    label: cards[3].$2,
                    value: cards[3].$3,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Glass(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(tr('Реакції по днях'), style: body(12.5, color: muted)),
                  const SizedBox(height: 10),
                  SizedBox(
                    height: 96,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        for (final day in days)
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 1,
                              ),
                              child: Tooltip(
                                message:
                                    '${shortStamp(day['day'])}: ${intOf(day['likes'])} ♥ · ${intOf(day['comments'])} 💬',
                                child: Align(
                                  alignment: Alignment.bottomCenter,
                                  child: FractionallySizedBox(
                                    heightFactor:
                                        ((intOf(day['likes']) +
                                                    intOf(day['comments'])) /
                                                peak)
                                            .clamp(0.04, 1.0)
                                            .toDouble(),
                                    widthFactor: 1,
                                    child: DecoratedBox(
                                      decoration: BoxDecoration(
                                        color:
                                            intOf(day['likes']) +
                                                    intOf(day['comments']) >
                                                0
                                            ? primary.withValues(alpha: 0.75)
                                            : primary.withValues(alpha: 0.25),
                                        borderRadius:
                                            const BorderRadius.vertical(
                                              top: Radius.circular(3),
                                            ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (top.isNotEmpty) ...[
              const SizedBox(height: 12),
              Glass(
                padding: const EdgeInsets.fromLTRB(8, 12, 8, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Text(
                        tr('Найкращі записи'),
                        style: body(12.5, color: muted),
                      ),
                    ),
                    const SizedBox(height: 6),
                    for (final post in top)
                      ListTile(
                        title: Text(
                          text(post['excerpt']) ?? tr('Запис без тексту'),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: body(14),
                        ),
                        subtitle: Text(
                          '👁 ${intOf(post['views'])}   ♥ ${intOf(post['likes'])}   💬 ${intOf(post['comments'])}',
                          style: body(12, color: muted),
                        ),
                        onTap: () => context.push('/posts/${post['id']}'),
                      ),
                  ],
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.icon,
    required this.label,
    required this.value,
  });
  final IconData icon;
  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Glass(
      padding: const EdgeInsets.fromLTRB(10, 12, 10, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: faint),
          const SizedBox(height: 6),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text('$value', style: display(18)),
          ),
          Text(label, style: body(11, color: muted)),
        ],
      ),
    );
  }
}

// ───────────────────────── Рівні підписки автора ─────────────────────────

class _TierDraft {
  _TierDraft({
    this.id,
    required String name,
    required String price,
    required String perks,
  }) : name = TextEditingController(text: name),
       price = TextEditingController(text: price),
       perks = TextEditingController(text: perks);
  final int? id;
  final TextEditingController name;
  final TextEditingController price;
  final TextEditingController perks;
  void dispose() {
    name.dispose();
    price.dispose();
    perks.dispose();
  }
}

/// Налаштування рівнів платної підписки на вас. Оформлення підписки лишається на сайті.
class AuthorTiersScreen extends StatefulWidget {
  const AuthorTiersScreen({super.key});

  @override
  State<AuthorTiersScreen> createState() => _AuthorTiersScreenState();
}

class _AuthorTiersScreenState extends State<AuthorTiersScreen> {
  List<_TierDraft>? tiers;
  Map<String, dynamic> earnings = const {};
  int balance = 0;
  List<Map<String, dynamic>> subs = const [];
  bool busy = false;
  Object? error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    for (final tier in tiers ?? const <_TierDraft>[]) {
      tier.dispose();
    }
    super.dispose();
  }

  void _replace(List<Map<String, dynamic>> rows) {
    final previous = tiers ?? const <_TierDraft>[];
    tiers = [
      for (final row in rows)
        _TierDraft(
          id: row['id'] == null ? null : intOf(row['id']),
          name: text(row['name']) ?? '',
          price: unitsInput(intOf(row['price'], 5000)),
          perks: text(row['perks']) ?? '',
        ),
    ];
    if (previous.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        for (final tier in previous) {
          tier.dispose();
        }
      });
    }
  }

  Future<void> _load() async {
    try {
      final data = await AppScope.read(context).session.api
          .get(Api.site('/settings/subscriptions'));
      if (!mounted) return;
      setState(() {
        _replace(maps(data['tiers']));
        earnings = mapOf(data['earnings']);
        balance = intOf(data['balance']);
        subs = maps(data['subscriptions']);
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  Future<void> _save() async {
    final list = tiers;
    if (list == null || busy) return;
    final payload = <Map<String, dynamic>>[];
    for (final tier in list) {
      final name = tier.name.text.trim();
      final price = hundredthsOf(tier.price.text);
      if (name.length < 2) {
        toast(context, tr('Назва рівня — від 2 символів.'));
        return;
      }
      if (price == null || price < 2000) {
        toast(context, tr('Мінімальна ціна — 20 одиниць за 30 днів.'));
        return;
      }
      if (price > 500000) {
        toast(context, tr('Максимальна ціна — 5000 одиниць за 30 днів.'));
        return;
      }
      final perks = tier.perks.text.trim();
      payload.add({
        if (tier.id != null) 'id': tier.id,
        'name': name.length > 40 ? name.substring(0, 40) : name,
        'price': price,
        'perks': perks.isEmpty
            ? null
            : (perks.length > 300 ? perks.substring(0, 300) : perks),
      });
    }
    setState(() => busy = true);
    try {
      final result = await AppScope.read(context).session.api
          .put(Api.site('/settings/subscriptions/tiers'), {'tiers': payload});
      if (!mounted) return;
      setState(() => _replace(maps(result['tiers'])));
      toast(context, tr('Рівні збережено.'));
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _renew(Map<String, dynamic> sub) async {
    final author = mapOf(sub['author']);
    final username = text(author['username']);
    if (username == null) return;
    final next = sub['auto_renew'] != true;
    final ok = await attempt(
      context,
      () =>
          AppScope.read(context).session.api
              .patch(Api.site('/author-subscriptions/$username'), {'on': next}),
    );
    if (ok && mounted) {
      setState(() {
        subs = [
          for (final row in subs)
            mapOf(row['author'])['id'] == author['id']
                ? {...row, 'auto_renew': next}
                : row,
        ];
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = tiers;
    if (error != null && list == null) {
      return Center(
        child: EmptyState(
          icon: LucideIcons.heartHandshake,
          title: tr('Підписки недоступні'),
          text: '$error',
          action: tr('Спробувати знову'),
          onAction: _load,
        ),
      );
    }
    if (list == null) return const ScreenSkeleton();
    final fee = intOf(earnings['fee'], 10);
    return ScreenScroll(
      onRefresh: _load,
      children: [
        PageTitle(
          tr('Підписки'),
          subtitle: tr('Платні рівні й ваші підписки'),
          trailing: RoundIcon(
            icon: LucideIcons.arrowLeft,
            onTap: () => _back(context),
          ),
        ),
        Glass(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              CardTitle(
                tr('Платна підписка на вас'),
                icon: LucideIcons.heartHandshake,
              ),
              const SizedBox(height: 6),
              Text(
                tr(
                  'До трьох рівнів на 30 днів. Підписники бачать ваші записи «лише для підписників». Вам нараховуються одиниці балансу (мінус частка платформи {fee}%) — їх можна витратити лише на сайті: GameCon+, просування, підписки. Одиниці не виводяться й не обмінюються на гроші.',
                  {'fee': fee},
                ),
                style: body(12.5, color: muted).copyWith(height: 1.4),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _StatTile(
                      icon: LucideIcons.users,
                      label: tr('Підписників'),
                      value: intOf(earnings['subscribers']),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _MoneyTile(
                      label: tr('Цього місяця'),
                      value: balanceUnits(earnings['month']),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _MoneyTile(
                      label: tr('Усього'),
                      value: balanceUnits(earnings['total']),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              for (final tier in list) ...[
                Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.fromLTRB(10, 10, 4, 10),
                  decoration: BoxDecoration(
                    color: raised,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: GcField(
                              controller: tier.name,
                              label: tr('Назва рівня'),
                              dense: true,
                            ),
                          ),
                          const SizedBox(width: 8),
                          SizedBox(
                            width: 108,
                            child: GcField(
                              controller: tier.price,
                              label: tr('од./міс'),
                              dense: true,
                              keyboard: TextInputType.number,
                            ),
                          ),
                          IconButton(
                            tooltip: tr('Видалити рівень'),
                            onPressed: busy
                                ? null
                                : () {
                                    setState(() => list.remove(tier));
                                    WidgetsBinding.instance
                                        .addPostFrameCallback(
                                          (_) => tier.dispose(),
                                        );
                                  },
                            icon: Icon(
                              LucideIcons.trash2,
                              size: 18,
                              color: muted,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      GcField(
                        controller: tier.perks,
                        label: tr(
                          'Що отримує підписник: закриті записи, ранній доступ, ім’я в стрімі…',
                        ),
                        maxLines: 3,
                        minLines: 2,
                      ),
                    ],
                  ),
                ),
              ],
              if (list.length < 3)
                GhostButton(
                  label: tr('Додати рівень'),
                  icon: LucideIcons.plus,
                  compact: true,
                  onPressed: busy
                      ? null
                      : () => setState(
                          () => list.add(
                            _TierDraft(name: '', price: '50', perks: ''),
                          ),
                        ),
                ),
              const SizedBox(height: 12),
              PrimaryButton(
                label: tr('Зберегти'),
                icon: LucideIcons.check,
                busy: busy,
                onPressed: busy
                    ? null
                    : () {
                        _save();
                      },
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Glass(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              CardTitle(tr('Мої підписки'), icon: LucideIcons.wallet),
              const SizedBox(height: 6),
              Text(
                tr(
                  'На балансі: {sum}. Продовження списується з балансу за добу до кінця періоду.',
                  {'sum': balanceUnits(balance)},
                ),
                style: body(12.5, color: muted),
              ),
              const SizedBox(height: 8),
              if (subs.isEmpty)
                Text(
                  tr('Ви ще ні на кого не підписані.'),
                  style: body(13.5, color: muted),
                )
              else
                for (final sub in subs)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        GestureDetector(
                          onTap: text(mapOf(sub['author'])['username']) == null
                              ? null
                              : () => context.push(
                                  '/u/${mapOf(sub['author'])['username']}',
                                ),
                          child: Text(
                            text(mapOf(sub['author'])['name']) ?? '',
                            style: body(14.5, weight: FontWeight.w600),
                          ),
                        ),
                        Text(
                          '${text(sub['tier']) ?? '—'} · ${balanceUnits(sub['price'])} · ${tr('до {date}', {'date': shortStamp(sub['expires_at'])})}',
                          style: body(12, color: muted),
                        ),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: TextButton(
                            onPressed: () {
                              _renew(sub);
                            },
                            child: Text(
                              sub['auto_renew'] == true
                                  ? tr('Вимкнути продовження')
                                  : tr('Увімкнути продовження'),
                              style: body(12.5, color: accent),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MoneyTile extends StatelessWidget {
  const _MoneyTile({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Glass(
      padding: const EdgeInsets.fromLTRB(10, 12, 10, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(value, style: display(16)),
          ),
          Text(label, style: body(11, color: muted)),
        ],
      ),
    );
  }
}
