import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:just_audio/just_audio.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'api.dart';
import 'game_tools.dart' show pickGame;
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

/// Розваги через міст сайту: «Що подивитися?», «Вгадай пісню», вікторина дня й ігровий щоденник.

const _right = Color(0xFF34D399);
const _wrong = Color(0xFFF87171);

/// Варіант відповіді: звичайний, обраний, правильний чи хибний.
class _Option extends StatelessWidget {
  const _Option({required this.label, required this.onTap, this.chosen = false, this.right = false, this.wrong = false});
  final String label;
  final VoidCallback? onTap;
  final bool chosen;
  final bool right;
  final bool wrong;

  @override
  Widget build(BuildContext context) {
    final fill = right
        ? _right.withValues(alpha: 0.22)
        : wrong
        ? _wrong.withValues(alpha: 0.22)
        : chosen
        ? primary.withValues(alpha: 0.85)
        : ink.withValues(alpha: 0.06);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: fill,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Row(children: [
                Expanded(child: Text(label, style: body(14, color: chosen && !right && !wrong ? Colors.white : ink))),
                if (right) const Icon(LucideIcons.check, size: 18, color: _right),
                if (wrong) const Icon(LucideIcons.x, size: 18, color: _wrong),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

/// Найкращі за сьогодні.
class _Leaderboard extends StatelessWidget {
  const _Leaderboard({required this.rows});
  final List<Map<String, dynamic>> rows;

  @override
  Widget build(BuildContext context) {
    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        CardTitle(tr('Найкращі сьогодні'), icon: LucideIcons.trophy),
        const SizedBox(height: 8),
        if (rows.isEmpty) Text(tr('Ще ніхто не зіграв — будьте першими.'), style: body(13.5, color: muted)),
        for (final (i, row) in rows.indexed)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(children: [
              SizedBox(width: 22, child: Text('${i + 1}', style: body(12.5, color: muted))),
              Avatar(name: text(mapOf(row['user'])['name']) ?? '', url: text(mapOf(row['user'])['avatar_url']), size: 30),
              const SizedBox(width: 10),
              Expanded(child: Text(text(mapOf(row['user'])['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14))),
              Text('${intOf(row['score'])}/${intOf(row['total'])}', style: body(14, weight: FontWeight.w600)),
            ]),
          ),
      ]),
    );
  }
}

// ───────────────────────── Що подивитися? ─────────────────────────

class RouletteScreen extends StatefulWidget {
  const RouletteScreen({super.key});

  @override
  State<RouletteScreen> createState() => _RouletteScreenState();
}

class _RouletteScreenState extends State<RouletteScreen> {
  String type = '';
  String genre = '';
  bool unseen = true;
  bool busy = false;
  bool empty = false;
  Map<String, dynamic>? movie;

  Future<void> _spin() async {
    setState(() => busy = true);
    final query = [if (type.isNotEmpty) 'type=$type', if (genre.isNotEmpty) 'genre=${Uri.encodeQueryComponent(genre)}', if (unseen) 'unseen=1'].join('&');
    try {
      final d = await AppScope.read(context).session.api.get(Api.site('/cinema/roulette/spin?$query'));
      if (!mounted) return;
      setState(() {
        movie = d['movie'] is Map ? mapOf(d['movie']) : null;
        empty = movie == null;
      });
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/cinema/roulette')),
      builder: (d, _) {
        final types = mapOf(d['types']);
        final genres = (d['genres'] is List ? d['genres'] as List : const []).map((g) => '$g').toList();
        final m = movie;
        return ScreenScroll(
          children: [
            PageTitle(tr('Що подивитися?')),
            Glass(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Segmented(
                  scroll: true,
                  options: [SegmentOption('', tr('Усе')), for (final e in types.entries) SegmentOption(e.key, tr('${e.value}'))],
                  selected: type,
                  onSelect: (v) => setState(() => type = v),
                ),
                const SizedBox(height: 10),
                GcSelect<String>(
                  value: genre,
                  expand: true,
                  items: [('', tr('Будь-який жанр')), for (final g in genres) (g, g)],
                  onChanged: (v) => setState(() => genre = v ?? ''),
                ),
                const SizedBox(height: 6),
                SwitchListTile.adaptive(
                  contentPadding: EdgeInsets.zero,
                  value: unseen,
                  onChanged: (v) => setState(() => unseen = v),
                  title: Text(tr('Без переглянутого'), style: body(14)),
                ),
                PrimaryButton(label: movie == null ? tr('Крутити') : tr('Ще раз'), icon: LucideIcons.dices, busy: busy, onPressed: busy ? null : _spin),
              ]),
            ),
            const SizedBox(height: 12),
            if (empty) Glass(child: Text(tr('За такими фільтрами нічого не знайшлося — спробуйте інший жанр чи рік.'), style: body(14, color: soft))),
            if (m != null)
              Glass(
                onTap: () => context.push('/cinema/${m['slug']}'),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: SizedBox(
                      width: 96,
                      height: 144,
                      child: absolute(m['poster']) != null
                          ? Image.network(absolute(m['poster'])!, fit: BoxFit.cover, errorBuilder: (_, _, _) => Container(color: ink.withValues(alpha: 0.06)))
                          : Container(color: ink.withValues(alpha: 0.06), child: Icon(LucideIcons.film, color: muted)),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text([tr(text(m['type_label']) ?? ''), if (m['year'] != null) '${m['year']}'].join(' · '), style: body(12, color: muted)),
                      const SizedBox(height: 4),
                      Text(text(m['title']) ?? '', style: display(18)),
                      if (text(m['description']) != null) ...[
                        const SizedBox(height: 6),
                        Text(text(m['description'])!, maxLines: 5, overflow: TextOverflow.ellipsis, style: body(13.5, color: soft)),
                      ],
                    ]),
                  ),
                ]),
              ),
          ],
        );
      },
    );
  }
}

// ───────────────────────── Вгадай пісню ─────────────────────────

class MusicQuizScreen extends StatefulWidget {
  const MusicQuizScreen({super.key});

  @override
  State<MusicQuizScreen> createState() => _MusicQuizScreenState();
}

class _MusicQuizScreenState extends State<MusicQuizScreen> {
  AudioPlayer? audio;
  Timer? stopTimer;
  String? round;
  List<Map<String, dynamic>> questions = [];
  int index = 0;
  int? picked;
  Map<String, dynamic>? result;
  bool done = false;
  bool busy = false;
  int clip = 15;

  @override
  void dispose() {
    stopTimer?.cancel();
    audio?.dispose();
    super.dispose();
  }

  Future<void> _play(Map<String, dynamic> q) async {
    stopTimer?.cancel();
    final url = absolute(q['audio']);
    if (url == null) return;
    try {
      final player = audio ??= AudioPlayer(useProxyForRequestHeaders: false);
      await player.setUrl(url, initialPosition: Duration(seconds: intOf(q['start'])));
      unawaited(player.play());
      stopTimer = Timer(Duration(seconds: clip), () => player.pause());
    } catch (_) {
      // Без звуку (тест чи збій мережі) питання все одно можна пройти.
    }
  }

  Future<void> _start() async {
    final scope = AppScope.read(context);
    // Основний плеєр замовкає, щоб не заважати.
    unawaited(scope.player.pause());
    setState(() => busy = true);
    try {
      final d = await scope.session.api.post(Api.site('/music/quiz'));
      if (!mounted) return;
      setState(() {
        round = text(d['round']);
        questions = maps(d['questions']);
        index = 0;
        picked = null;
        result = null;
        done = false;
      });
      if (questions.isNotEmpty) unawaited(_play(questions.first));
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _choose(int option) async {
    if (round == null || picked != null) return;
    setState(() => picked = option);
    try {
      final r = await AppScope.read(context).session.api.post(Api.site('/music/quiz/$round'), {'question': index, 'option': option});
      if (mounted) setState(() => result = r);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  void _next() {
    final r = result;
    if (r == null) return;
    if (r['finished'] == true) {
      stopTimer?.cancel();
      audio?.pause();
      setState(() => done = true);
      return;
    }
    setState(() {
      index++;
      picked = null;
      result = null;
    });
    unawaited(_play(questions[index]));
  }

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/music/quiz')),
      builder: (d, reload) {
        clip = intOf(d['clip'], 15);
        final best = d['best'];
        final r = result;
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(tr('Вгадай пісню')),
            Text(
              [tr('П’ять уривків по {clip} секунд — оберіть, що звучить.', {'clip': '$clip'}), if (best != null) tr('Ваш найкращий сьогодні: {score}', {'score': '$best'})].join(' '),
              style: body(13.5, color: muted),
            ),
            const SizedBox(height: 12),
            if (round == null || done)
              Glass(
                child: Column(children: [
                  Icon(LucideIcons.music2, size: 40, color: primary),
                  if (done && r != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text('${intOf(r['score'])}/${intOf(r['total'])}', style: display(30))),
                  const SizedBox(height: 14),
                  PrimaryButton(label: done ? tr('Ще раунд') : tr('Почати'), busy: busy, onPressed: busy ? null : _start),
                ]),
              )
            else if (index < questions.length)
              Glass(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(tr('Питання {n} з {total}', {'n': '${index + 1}', 'total': '${questions.length}'}), style: body(13, color: muted))),
                    GhostButton(label: tr('Ще раз'), icon: LucideIcons.play, expand: false, compact: true, onPressed: () => _play(questions[index])),
                  ]),
                  const SizedBox(height: 10),
                  for (final (i, option) in (questions[index]['options'] is List ? questions[index]['options'] as List : const []).indexed)
                    _Option(
                      label: '$option',
                      onTap: picked == null ? () => _choose(i) : null,
                      right: r != null && intOf(r['answer']) == i,
                      wrong: r != null && picked == i && intOf(r['answer']) != i,
                    ),
                  if (r != null) PrimaryButton(label: r['finished'] == true ? tr('Результат') : tr('Далі'), onPressed: _next),
                ]),
              ),
            const SizedBox(height: 12),
            _Leaderboard(rows: maps(d['top'])),
          ],
        );
      },
    );
  }
}

// ───────────────────────── Вікторина дня ─────────────────────────

class TriviaScreen extends StatefulWidget {
  const TriviaScreen({super.key});

  @override
  State<TriviaScreen> createState() => _TriviaScreenState();
}

class _TriviaScreenState extends State<TriviaScreen> {
  final answers = <int, int>{};
  Map<String, dynamic>? played;
  List<Map<String, dynamic>>? top;
  bool busy = false;

  Future<void> _submit(int count) async {
    setState(() => busy = true);
    try {
      final r = await AppScope.read(context).session.api.post(Api.site('/games/trivia'), {
        'answers': [for (var i = 0; i < count; i++) answers[i]],
      });
      if (!mounted) return;
      setState(() {
        played = r;
        top = maps(r['top']);
      });
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/games/trivia')),
      builder: (d, _) {
        final questions = maps(d['questions']);
        final done = played ?? (d['played'] is Map ? mapOf(d['played']) : null);
        final correct = done == null ? const [] : (done['answers'] is List ? done['answers'] as List : const []);
        return ScreenScroll(
          children: [
            PageTitle(tr('Вікторина дня')),
            Text(tr('П’ять питань про ігри — однакові для всіх. Одна спроба, нові питання завтра.'), style: body(13.5, color: muted)),
            const SizedBox(height: 12),
            if (questions.isEmpty)
              EmptyState(icon: LucideIcons.trophy, title: tr('Сьогодні вікторини немає'), text: tr('У каталозі ігор поки замало даних для питань.'))
            else ...[
              if (done != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Glass(
                    child: Row(children: [
                      const Icon(LucideIcons.trophy, size: 30, color: Color(0xFFFCD34D)),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${intOf(done['score'])}/${intOf(done['total'])}', style: display(24)),
                          Text(tr('Нові питання — завтра.'), style: body(13, color: muted)),
                        ]),
                      ),
                    ]),
                  ),
                ),
              for (final (qi, q) in questions.indexed)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Glass(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(tr('Питання {n} з {total}', {'n': '${qi + 1}', 'total': '${questions.length}'}), style: body(12, color: muted)),
                      const SizedBox(height: 4),
                      Text(text(q['question']) ?? '', style: body(15.5, weight: FontWeight.w600)),
                      if (absolute(q['image']) != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 10),
                          child: ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.network(absolute(q['image'])!, height: 180, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox.shrink())),
                        ),
                      const SizedBox(height: 10),
                      for (final (oi, option) in (q['options'] is List ? q['options'] as List : const []).indexed)
                        _Option(
                          label: '$option',
                          chosen: answers[qi] == oi,
                          right: done != null && qi < correct.length && intOf(correct[qi]) == oi,
                          wrong: done != null && answers[qi] == oi && qi < correct.length && intOf(correct[qi]) != oi,
                          onTap: done == null ? () => setState(() => answers[qi] = oi) : null,
                        ),
                    ]),
                  ),
                ),
              if (done == null) PrimaryButton(label: tr('Перевірити'), busy: busy, onPressed: answers.length == questions.length && !busy ? () => _submit(questions.length) : null),
            ],
            const SizedBox(height: 12),
            _Leaderboard(rows: top ?? maps(d['top'])),
          ],
        );
      },
    );
  }
}

// ───────────────────────── Ігровий щоденник ─────────────────────────

String _moodLabel(String mood) => switch (mood) {
  'great' => tr('Чудово'),
  'meh' => tr('Так собі'),
  'bad' => tr('Погано'),
  _ => tr('Добре'),
};

Color _moodColor(String mood) => switch (mood) {
  'great' => const Color(0xFF34D399),
  'meh' => const Color(0xFFFCD34D),
  'bad' => const Color(0xFFF87171),
  _ => const Color(0xFF38BDF8),
};

/// «2026-10-31» → «31.10.2026».
String _day(String? iso) {
  final d = DateTime.tryParse(iso ?? '');
  if (d == null) return iso ?? '';
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(d.day)}.${two(d.month)}.${d.year}';
}

String _minutes(int m) => m >= 60 ? tr('{h} год {m} хв', {'h': '${m ~/ 60}', 'm': '${m % 60}'}) : tr('{m} хв', {'m': '$m'});

class JournalScreen extends StatelessWidget {
  const JournalScreen({this.username, super.key});
  final String? username;

  Future<void> _write(BuildContext context, VoidCallback reload) async {
    final note = TextEditingController();
    final minutes = TextEditingController();
    var mood = 'good';
    var public = false;
    Map<String, dynamic>? game;
    await showGcSheet<void>(
      context,
      title: tr('Новий запис'),
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheet) => Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          GhostButton(
            label: game == null ? tr('Гра (необов’язково)') : text(game!['name']) ?? '',
            icon: LucideIcons.gamepad2,
            onPressed: () async {
              final g = await pickGame(sheet);
              if (g != null) setSheet(() => game = g);
            },
          ),
          const SizedBox(height: 10),
          GcField(controller: note, label: tr('Що сьогодні було в грі?'), maxLines: 5, minLines: 3),
          const SizedBox(height: 10),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final m in const ['great', 'good', 'meh', 'bad'])
              ChoiceChip(
                label: Text(_moodLabel(m)),
                selected: mood == m,
                avatar: CircleAvatar(radius: 5, backgroundColor: _moodColor(m)),
                onSelected: (_) => setSheet(() => mood = m),
              ),
          ]),
          const SizedBox(height: 10),
          GcField(controller: minutes, label: tr('Хвилин у грі'), keyboard: TextInputType.number, icon: LucideIcons.clock),
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            value: public,
            onChanged: (v) => setSheet(() => public = v),
            title: Text(tr('Показувати іншим'), style: body(14)),
          ),
          PrimaryButton(
            label: tr('Записати'),
            onPressed: () async {
              if (note.text.trim().length < 2) return;
              final ok = await attempt(
                sheet,
                () => AppScope.read(sheet).session.api.post(Api.site('/journal'), {
                  'body': note.text.trim(),
                  'mood': mood,
                  'is_public': public,
                  if (game != null) 'game_id': game!['id'],
                  if (int.tryParse(minutes.text.trim()) != null) 'minutes': int.parse(minutes.text.trim()),
                }),
              );
              if (ok && sheet.mounted) Navigator.of(sheet).pop();
            },
          ),
        ]),
      ),
    );
    reload();
  }

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).session.api;
    return Remote(
      load: () => api.get(Api.site(username == null ? '/journal' : '/journal/$username')),
      builder: (d, reload) {
        final mine = d['mine'] == true;
        final owner = mapOf(d['owner']);
        final stats = mapOf(d['stats']);
        final entries = maps(mapOf(d['entries'])['data']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            PageTitle(mine ? tr('Ігровий щоденник') : tr('Щоденник · {name}', {'name': text(owner['name']) ?? ''})),
            Text(
              tr('{entries} записів · {games} ігор · {time} у грі', {'entries': '${intOf(stats['entries'])}', 'games': '${intOf(stats['games'])}', 'time': _minutes(intOf(stats['minutes']))}),
              style: body(13.5, color: muted),
            ),
            const SizedBox(height: 12),
            if (mine) ...[PrimaryButton(label: tr('Новий запис'), icon: LucideIcons.plus, onPressed: () => _write(context, reload)), const SizedBox(height: 12)],
            if (entries.isEmpty)
              EmptyState(
                icon: LucideIcons.bookOpen,
                title: mine ? tr('Щоденник порожній') : tr('Відкритих записів немає'),
                text: mine ? tr('Записуйте, що відбувалося в грі, — за рік вийде ціла історія.') : null,
              ),
            for (final e in entries)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Glass(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Expanded(
                        child: Wrap(spacing: 10, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                          Row(mainAxisSize: MainAxisSize.min, children: [
                            Container(width: 8, height: 8, decoration: BoxDecoration(color: _moodColor(text(e['mood']) ?? ''), shape: BoxShape.circle)),
                            const SizedBox(width: 6),
                            Text(_moodLabel(text(e['mood']) ?? ''), style: body(12.5, color: muted)),
                          ]),
                          Text(_day(text(e['played_on'])), style: body(12.5, color: muted)),
                          if (text(mapOf(e['game'])['name']) != null) Text(text(mapOf(e['game'])['name'])!, style: body(12.5, color: soft, weight: FontWeight.w600)),
                          if (e['minutes'] != null) Text(_minutes(intOf(e['minutes'])), style: body(12.5, color: muted)),
                          if (mine && e['is_public'] != true) Icon(LucideIcons.lock, size: 13, color: muted),
                        ]),
                      ),
                      if (mine)
                        GestureDetector(
                          onTap: () async {
                            if (!await confirm(context, tr('Видалити запис зі щоденника?'), danger: true)) return;
                            if (!context.mounted) return;
                            if (await attempt(context, () => api.delete(Api.site('/journal/${e['id']}')))) reload();
                          },
                          child: Padding(padding: const EdgeInsets.only(left: 8), child: Icon(LucideIcons.trash2, size: 17, color: muted, semanticLabel: tr('Видалити'))),
                        ),
                    ]),
                    const SizedBox(height: 8),
                    Text(text(e['body']) ?? '', style: body(14.5)),
                  ]),
                ),
              ),
          ],
        );
      },
    );
  }
}
