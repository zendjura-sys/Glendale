/**
 * Текст пісні для плеєра. Якщо в тексті є мітки часу LRC ([01:23.45] рядок) — це караоке:
 * рядки підсвічуються в такт. Інакше — звичайний текст без підсвічування (не вгадуємо таймінги).
 */

export type LyricLine = { time: number | null; text: string };
export type Lyrics = { timed: boolean; lines: LyricLine[] };

const STAMP = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
// Службові теги LRC: [ar:…], [ti:…], [offset:…] тощо.
const TAG = /^\[[a-z]+:.*\]$/i;

export function parseLyrics(source: string): Lyrics {
    const timed: LyricLine[] = [];
    const plain: LyricLine[] = [];

    for (const raw of source.replace(/\r/g, '').split('\n')) {
        const line = raw.trim();
        if (TAG.test(line)) continue;
        const stamps = [...line.matchAll(STAMP)];
        const text = line.replace(STAMP, '').trim();

        if (stamps.length === 0) {
            plain.push({ time: null, text: line });
            continue;
        }
        // Один рядок може мати кілька міток (приспів повторюється).
        for (const [, m, s, fraction = '0'] of stamps) {
            const seconds =
                Number(m) * 60 +
                Number(s) +
                Number(fraction.padEnd(3, '0')) / 1000;
            timed.push({ time: seconds, text });
        }
    }

    if (timed.length >= 3) {
        return {
            timed: true,
            lines: timed.sort((a, b) => (a.time ?? 0) - (b.time ?? 0)),
        };
    }

    return { timed: false, lines: plain.length ? plain : timed };
}

/** Індекс рядка, що звучить зараз (-1 — ще до першого рядка). */
export function activeLine(lines: LyricLine[], position: number): number {
    let index = -1;
    for (let i = 0; i < lines.length; i++) {
        if ((lines[i].time ?? Infinity) <= position + 0.15) index = i;
        else break;
    }

    return index;
}
