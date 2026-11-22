import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Жива вікторина спільноти, як на сайті: ведучий складає питання й веде раунди, учасники
/// відповідають на час (бали за швидкість), після показу відповіді — таблиця лідерів.
/// Сайт оновлює стан через канал спільноти; тут — опитування кожні 2 с, поки вікторина йде.
class CommunityQuizScreen extends StatefulWidget {
  const CommunityQuizScreen({required this.slug, super.key});
  final String slug;

  @override
  State<CommunityQuizScreen> createState() => _CommunityQuizScreenState();
}

class _CommunityQuizScreenState extends State<CommunityQuizScreen> {
  Map<String, dynamic>? data;
  Object? error;
  bool busy = false;
  Timer? poll;
  Timer? tick;

  Api get api => AppScope.read(context).session.api;
  String get _base => Api.site('/c/${widget.slug}/quiz');
  Map<String, dynamic>? get quiz => data?['quiz'] is Map ? mapOf(data!['quiz']) : null;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    poll = Timer.periodic(const Duration(seconds: 2), (_) {
      final phase = quiz?['phase'];
      if (phase == 'question' || phase == 'reveal') _load();
    });
    tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && quiz?['phase'] == 'question') setState(() {});
    });
  }

  @override
  void dispose() {
    poll?.cancel();
    tick?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final r = await api.get(_base);
      if (mounted) {
        setState(() {
          data = r;
          error = null;
        });
      }
    } catch (e) {
      if (mounted && data == null) setState(() => error = e);
    }
  }

  Future<void> _act(Future<Map<String, dynamic>> Function() call) async {
    setState(() => busy = true);
    try {
      final r = await call();
      if (mounted && r['quiz'] is Map) setState(() => data = {...?data, 'quiz': r['quiz']});
      await _load();
    } catch (e) {
      if (mounted) toast(context, e, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  int _left(Map<String, dynamic> q) {
    final at = DateTime.tryParse(text(q['phase_at']) ?? '');
    if (at == null) return intOf(q['seconds']);
    return (intOf(q['seconds']) - DateTime.now().difference(at).inSeconds).clamp(0, 999);
  }

  @override
  Widget build(BuildContext context) {
    if (data == null) {
      return error != null
          ? ScreenScroll(onRefresh: _load, children: [EmptyState(icon: LucideIcons.lock, title: tr('Вікторина доступна учасникам спільноти'), text: '$error')])
          : const Center(child: CircularProgressIndicator());
    }
    final q = quiz;
    final host = data!['can_host'] == true;
    return ScreenScroll(onRefresh: _load, children: [
      PageTitle(text(q?['title']) ?? tr('Вікторина'), subtitle: q == null ? null : tr('Питання {n} з {total} · ваші бали: {p}', {'n': intOf(q['index']) + 1, 'total': q['total'], 'p': q['my_points']})),
      if (q == null || q['phase'] == 'done') ...[
        if (q != null) _Leaders(leaders: maps(q['leaders']), title: tr('Підсумки вікторини')),
        if (q == null && !host) EmptyState(icon: LucideIcons.circleHelp, title: tr('Зараз вікторини немає'), text: tr('Коли ведучий її запустить, вона з’явиться тут.')),
        if (host) ...[
          const SizedBox(height: 12),
          PrimaryButton(label: tr('Нова вікторина'), icon: LucideIcons.plus, onPressed: busy ? null : _create),
        ],
      ] else ...[
        _question(q, host),
        if (q['phase'] == 'reveal') ...[const SizedBox(height: 12), _Leaders(leaders: maps(q['leaders']), title: tr('Лідери'))],
        if (host) ...[
          const SizedBox(height: 14),
          PrimaryButton(
            label: switch (q['phase']) {
              'draft' => tr('Почати вікторину'),
              'question' => tr('Показати відповідь'),
              _ => intOf(q['index']) + 1 >= intOf(q['total']) ? tr('Завершити') : tr('Наступне питання'),
            },
            icon: LucideIcons.play,
            busy: busy,
            onPressed: () => _act(() => api.post('$_base/${q['id']}/advance')),
          ),
          if (q['phase'] == 'draft') ...[
            const SizedBox(height: 8),
            GhostButton(label: tr('Скласти заново'), icon: LucideIcons.pencil, onPressed: busy ? null : _create),
          ],
        ],
      ],
    ]);
  }

  Widget _question(Map<String, dynamic> q, bool host) {
    final question = q['question'] is Map ? mapOf(q['question']) : null;
    if (question == null) {
      return EmptyState(icon: LucideIcons.hourglass, title: tr('Вікторина скоро почнеться'), text: tr('Ведучий ще готує питання.'));
    }
    final phase = q['phase'];
    final options = (question['options'] as List? ?? const []).map((o) => '$o').toList();
    final answer = question['answer'];
    final choice = q['my_choice'];
    final left = _left(q);
    final canAnswer = phase == 'question' && choice == null && left > 0 && !host;
    return Glass(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (phase == 'question')
          Row(children: [
            Icon(LucideIcons.timer, size: 16, color: left <= 5 ? const Color(0xFFFF7A55) : muted),
            const SizedBox(width: 6),
            Text(tr('{s} с', {'s': left}), style: body(13, color: left <= 5 ? const Color(0xFFFF7A55) : muted, weight: FontWeight.w700)),
            const Spacer(),
            Text(tr('Відповіли: {n}', {'n': q['answered']}), style: body(12.5, color: muted)),
          ]),
        const SizedBox(height: 8),
        Text(text(question['q']) ?? '', style: body(18, weight: FontWeight.w700)),
        const SizedBox(height: 12),
        for (var i = 0; i < options.length; i++) ...[
          _Option(
            label: options[i],
            state: answer != null
                ? (i == answer ? _OptionState.right : (i == choice ? _OptionState.wrong : _OptionState.idle))
                : (i == choice ? _OptionState.chosen : _OptionState.idle),
            onTap: canAnswer
                ? () => _act(() async {
                      final r = await api.post('$_base/${q['id']}/answer', {'question': q['index'], 'choice': i});
                      if (mounted) setState(() => data = {...?data, 'quiz': {...q, 'my_choice': r['choice']}});
                      return const <String, dynamic>{};
                    })
                : null,
          ),
          const SizedBox(height: 8),
        ],
        if (phase == 'question' && choice != null) Text(tr('Відповідь прийнято — чекаємо на показ.'), style: body(12.5, color: muted)),
      ]),
    );
  }

  Future<void> _create() async {
    final title = TextEditingController();
    final questions = <({TextEditingController q, List<TextEditingController> options, int answer})>[];
    void addQuestion() => questions.add((q: TextEditingController(), options: List.generate(4, (_) => TextEditingController()), answer: 0));
    addQuestion();
    final saved = await showGcSheet<bool>(
      context,
      title: tr('Нова вікторина'),
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheet) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          GcField(controller: title, label: tr('Назва вікторини')),
          for (var n = 0; n < questions.length; n++) ...[
            const SizedBox(height: 14),
            Text(tr('Питання {n}', {'n': n + 1}), style: body(14, weight: FontWeight.w700)),
            const SizedBox(height: 6),
            GcField(controller: questions[n].q, label: tr('Текст питання')),
            for (var i = 0; i < 4; i++)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Row(children: [
                  IconButton(
                    tooltip: tr('Правильна відповідь'),
                    onPressed: () => setSheet(() => questions[n] = (q: questions[n].q, options: questions[n].options, answer: i)),
                    icon: Icon(questions[n].answer == i ? LucideIcons.circleCheck : LucideIcons.circle, color: questions[n].answer == i ? primary : faint),
                  ),
                  Expanded(child: GcField(controller: questions[n].options[i], label: tr('Варіант {n}', {'n': i + 1}), dense: true)),
                ]),
              ),
          ],
          const SizedBox(height: 12),
          if (questions.length < 20) GhostButton(label: tr('Додати питання'), icon: LucideIcons.plus, onPressed: () => setSheet(addQuestion)),
          const SizedBox(height: 8),
          PrimaryButton(
            label: tr('Зберегти чернетку'),
            onPressed: () async {
              final payload = [
                for (final item in questions)
                  if (item.q.text.trim().isNotEmpty)
                    () {
                      final filled = [for (final o in item.options) o.text.trim()];
                      final kept = [for (var i = 0; i < filled.length; i++) if (filled[i].isNotEmpty) i];
                      return {'q': item.q.text.trim(), 'options': [for (final i in kept) filled[i]], 'answer': kept.indexOf(item.answer).clamp(0, 3)};
                    }(),
              ];
              final ok = await attempt(sheet, () async {
                final r = await api.post(_base, {'title': title.text.trim(), 'questions': payload});
                if (mounted) setState(() => data = {...?data, 'quiz': r['quiz']});
                return r;
              });
              if (ok && sheet.mounted) Navigator.of(sheet).pop(true);
            },
          ),
        ]),
      ),
    );
    title.dispose();
    for (final item in questions) {
      item.q.dispose();
      for (final o in item.options) {
        o.dispose();
      }
    }
    if (saved == true) await _load();
  }
}

enum _OptionState { idle, chosen, right, wrong }

class _Option extends StatelessWidget {
  const _Option({required this.label, required this.state, this.onTap});
  final String label;
  final _OptionState state;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color = switch (state) {
      _OptionState.right => const Color(0xFF3EE0A8),
      _OptionState.wrong => const Color(0xFFFF7A55),
      _OptionState.chosen => primary,
      _OptionState.idle => null,
    };
    return Material(
      color: (color ?? fg).withValues(alpha: color == null ? 0.05 : 0.16),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: color ?? Colors.transparent, width: 1.5)),
          child: Text(label, style: body(15, weight: FontWeight.w600)),
        ),
      ),
    );
  }
}

class _Leaders extends StatelessWidget {
  const _Leaders({required this.leaders, required this.title});
  final List<Map<String, dynamic>> leaders;
  final String title;

  @override
  Widget build(BuildContext context) {
    if (leaders.isEmpty) return const SizedBox.shrink();
    return Glass(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CardTitle(title, icon: LucideIcons.trophy),
        for (var i = 0; i < leaders.length; i++)
          UserTile(
            user: mapOf(leaders[i]['user']),
            size: 36,
            subtitle: tr('{n} місце', {'n': i + 1}),
            trailing: Text('${leaders[i]['points']}', style: body(15, color: primary, weight: FontWeight.w700)),
          ),
      ]),
    );
  }
}
