import { toast } from 'sonner';
import { tr } from '@/lib/i18n';

/**
 * Обробка звуку власних треків через Web Audio (одне джерело на елемент — створюється лише раз):
 *   «Вирівнювання гучності» (як Sound Check) — компресор, що підтягує тихі й притишує гучні треки;
 *   «Караоке» (Apple Music Sing) — голос у центрі стерео прибирається різницею каналів (L − R),
 *   а баси під 180 Гц повертаються з оригіналу, щоб не зникли бочка й бас.
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
};

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

    return { ctx, pre, compressor, makeup, post, dry, wet, bass };
}

function apply() {
    if (!graph) return;
    graph.pre.disconnect();
    graph.compressor.disconnect();
    graph.makeup.disconnect();
    if (normalizeOn) {
        graph.pre
            .connect(graph.compressor)
            .connect(graph.makeup)
            .connect(graph.post);
    } else {
        graph.pre.connect(graph.post);
    }
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
