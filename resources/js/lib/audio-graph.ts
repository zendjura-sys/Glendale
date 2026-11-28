import { toast } from 'sonner';
import { tr } from '@/lib/i18n';

/**
 * Обробка звуку власних треків через Web Audio (одне джерело на елемент — створюється лише раз):
 *   «Вирівнювання гучності» (як Sound Check) — компресор, що підтягує тихі й притишує гучні треки;
 *   «Караоке» (Apple Music Sing) — голос у центрі стерео прибирається різницею каналів (L − R),
 *   а баси під 180 Гц повертаються з оригіналу, щоб не зникли бочка й бас.
 *   «Еквалайзер» (№269) — 5 смуг (peaking) і пресети; налаштування живе на цьому пристрої.
 * Граф будується, лише коли щось із цього увімкнено, — без нього звук іде напряму.
 */
type Graph = {
    ctx: AudioContext;
    pre: GainNode;
    compressor: DynamicsCompressorNode;
    makeup: GainNode;
    post: GainNode;
    dry: GainNode;
    wet: GainNode;
    bass: GainNode;
    eq: BiquadFilterNode[];
};

/** Смуги еквалайзера, Гц. */
export const EQ_BANDS = [60, 230, 910, 3600, 14000] as const;

/** Пресети: підсилення кожної смуги, дБ. */
export const EQ_PRESETS = {
    flat: [0, 0, 0, 0, 0],
    bass: [6, 3, 0, 0, 1],
    vocal: [-2, 0, 3, 4, 1],
    rock: [4, 1, -2, 2, 4],
    // Кроки й постріли в іграх — середина 2–4 кГц, баси тихіше.
    gaming: [-3, -1, 2, 5, 2],
    // Нічний: м’якші баси й верхи, тихі місця чутніші.
    night: [-4, 0, 2, 1, -3],
} as const satisfies Record<string, readonly number[]>;

export type EqPreset = keyof typeof EQ_PRESETS;

const EQ_KEY = 'gc-eq';

function readEq(): number[] {
    try {
        const raw = JSON.parse(localStorage.getItem(EQ_KEY) ?? 'null');
        if (
            Array.isArray(raw) &&
            raw.length === EQ_BANDS.length &&
            raw.every((v) => typeof v === 'number')
        ) {
            return raw.map((v: number) => Math.max(-12, Math.min(12, v)));
        }
    } catch {
        // Немає сховища — без еквалайзера.
    }
    return [...EQ_PRESETS.flat];
}

let eqGains: number[] = readEq();

let graph: Graph | null = null;
let normalizeOn = false;
let singLevel = 0;

function build(el: HTMLAudioElement): Graph {
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(el);
    const pre = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 24;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.4;
    const makeup = ctx.createGain();
    makeup.gain.value = 1.6;
    const post = ctx.createGain();
    // Еквалайзер: ланцюжок смуг перед «post» (вирівнювання гучності — до нього).
    const eq = EQ_BANDS.map((freq, i) => {
        const band = ctx.createBiquadFilter();
        band.type =
            i === 0
                ? 'lowshelf'
                : i === EQ_BANDS.length - 1
                  ? 'highshelf'
                  : 'peaking';
        band.frequency.value = freq;
        band.Q.value = 1;
        return band;
    });
    eq.reduce<AudioNode>((prev, band) => prev.connect(band), eq[0]);
    eq[eq.length - 1].connect(post);
    source.connect(pre);

    const dry = ctx.createGain();
    post.connect(dry).connect(ctx.destination);

    const splitter = ctx.createChannelSplitter(2);
    const left = ctx.createGain();
    const right = ctx.createGain();
    right.gain.value = -1;
    const wet = ctx.createGain();
    wet.gain.value = 0;
    const merger = ctx.createChannelMerger(2);
    post.connect(splitter);
    splitter.connect(left, 0);
    splitter.connect(right, 1);
    left.connect(wet);
    right.connect(wet);
    wet.connect(merger, 0, 0);
    wet.connect(merger, 0, 1);
    merger.connect(ctx.destination);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 180;
    const bass = ctx.createGain();
    bass.gain.value = 0;
    post.connect(lowpass).connect(bass).connect(ctx.destination);

    return { ctx, pre, compressor, makeup, post, dry, wet, bass, eq };
}

function apply() {
    if (!graph) return;
    graph.pre.disconnect();
    graph.compressor.disconnect();
    graph.makeup.disconnect();
    const head = graph.eq[0];
    if (normalizeOn) {
        graph.pre.connect(graph.compressor).connect(graph.makeup).connect(head);
    } else {
        graph.pre.connect(head);
    }
    graph.eq.forEach((band, i) => {
        band.gain.value = eqGains[i] ?? 0;
    });
    graph.dry.gain.value = 1 - singLevel;
    graph.wet.gain.value = singLevel * 0.9;
    graph.bass.gain.value = singLevel * 0.8;
}

function ensure(el: HTMLAudioElement): boolean {
    try {
        if (!graph) graph = build(el);
        void graph.ctx.resume();
        apply();

        return true;
    } catch {
        return false;
    }
}

/** Відновити контекст після паузи чи нового треку (браузер «присипляє» його без жесту). */
export function resumeAudioGraph() {
    if (graph && graph.ctx.state !== 'running') void graph.ctx.resume();
}

export function setNormalize(el: HTMLAudioElement, on: boolean) {
    normalizeOn = on;
    if (!on && !graph) return;
    ensure(el);
}

export function setSing(el: HTMLAudioElement, level: number) {
    singLevel = level;
    if (level === 0 && !graph) return;
    if (!ensure(el)) toast.error(tr('Караоке недоступне в цьому браузері.'));
}

/** Поточні підсилення смуг (дБ). */
export function eqGainsNow(): number[] {
    return [...eqGains];
}

const eqActive = () => eqGains.some((v) => v !== 0);

/** Задати еквалайзер (запам’ятовується на пристрої); усі 0 — звук без обробки. */
export function setEq(el: HTMLAudioElement, gains: number[]) {
    eqGains = gains.map((v) => Math.max(-12, Math.min(12, Math.round(v))));
    try {
        localStorage.setItem(EQ_KEY, JSON.stringify(eqGains));
    } catch {
        // Без сховища — діє до перезавантаження.
    }
    if (!eqActive() && !graph) return;
    if (!ensure(el))
        toast.error(tr('Еквалайзер недоступний у цьому браузері.'));
}

/** При запуску плеєра: збережений еквалайзер вмикає граф. */
export function restoreEq(el: HTMLAudioElement) {
    if (eqActive()) ensure(el);
}
