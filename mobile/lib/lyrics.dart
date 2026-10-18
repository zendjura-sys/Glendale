import 'dart:math' as math;

/// Текст пісні для плеєра — так само, як на сайті (resources/js/lib/lyrics.ts). Якщо в тексті є
/// мітки часу LRC ([01:23.45] рядок) — це караоке: рядки підсвічуються в такт. Інакше — звичайний
/// текст без підсвічування (не вгадуємо таймінги).
class LyricLine {
  const LyricLine(this.time, this.text);

  /// Секунди від початку треку; null — рядок без мітки.
  final double? time;
  final String text;
}

class Lyrics {
  const Lyrics({required this.timed, required this.lines});
  final bool timed;
  final List<LyricLine> lines;
}

final _stamp = RegExp(r'\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]');
// Службові теги LRC: [ar:…], [ti:…], [offset:…] тощо.
final _tag = RegExp(r'^\[[a-z]+:.*\]$', caseSensitive: false);

Lyrics parseLyrics(String source) {
  final timed = <LyricLine>[];
  final plain = <LyricLine>[];

  for (final raw in source.replaceAll('\r', '').split('\n')) {
    final line = raw.trim();
    if (_tag.hasMatch(line)) continue;
    final stamps = _stamp.allMatches(line).toList();
    final text = line.replaceAll(_stamp, '').trim();

    if (stamps.isEmpty) {
      plain.add(LyricLine(null, line));
      continue;
    }
    // Один рядок може мати кілька міток (приспів повторюється).
    for (final m in stamps) {
      final fraction = (m.group(3) ?? '0').padRight(3, '0');
      timed.add(LyricLine(int.parse(m.group(1)!) * 60 + int.parse(m.group(2)!) + int.parse(fraction) / 1000, text));
    }
  }

  if (timed.length >= 3) {
    timed.sort((a, b) => (a.time ?? 0).compareTo(b.time ?? 0));
    return Lyrics(timed: true, lines: timed);
  }
  return Lyrics(timed: false, lines: plain.isNotEmpty ? plain : timed);
}

/// Індекс рядка, що звучить зараз (-1 — ще до першого рядка).
int activeLine(List<LyricLine> lines, double position) {
  var index = -1;
  for (var i = 0; i < lines.length; i++) {
    if ((lines[i].time ?? double.infinity) <= position + 0.15) {
      index = i;
    } else {
      break;
    }
  }
  return index;
}

int _imul(int a, int b) {
  a &= 0xFFFFFFFF;
  b &= 0xFFFFFFFF;
  final low = (a & 0xFFFF) * b;
  final high = (((a >> 16) * b) & 0xFFFF) << 16;
  return (low + high) & 0xFFFFFFFF;
}

/// Висоти смуг прогрес-хвилі — ті самі, що на сайті (components/music/waveform.tsx):
/// декоративна форма, стала для кожного треку.
List<double> waveformBars(String seed, int count) {
  var h = 2166136261;
  for (final unit in seed.codeUnits) {
    h ^= unit;
    h = _imul(h, 16777619);
  }
  double rand() {
    h = _imul(h ^ (h >> 15), 2246822507);
    h = _imul(h ^ (h >> 13), 3266489909);
    h ^= h >> 16;
    return (h & 0xFFFFFFFF) / 4294967296;
  }

  var previous = 0.5;
  return List.generate(count, (i) {
    // Плавна «пісня»: тихий вступ, гучніша середина, хвіст.
    final envelope = 0.45 + 0.55 * math.sin(math.pi * (i + 0.5) / count);
    previous = previous * 0.45 + rand() * 0.55;
    return (previous * envelope * 1.35).clamp(0.12, 1.0);
  });
}

