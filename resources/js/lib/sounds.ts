/**
 * Звуки сповіщень без файлів — короткі мелодії з Web Audio API (Налаштування → Оформлення).
 * Браузер дозволяє звук лише після першої взаємодії зі сторінкою; до неї мовчимо.
 */
export type NotifySound = 'off' | 'soft' | 'pixel' | 'arcade' | 'drop';

export const NOTIFY_SOUNDS: NotifySound[] = [
    'off',
    'soft',
    'pixel',
    'arcade',
    'drop',
];

type Note = {
    f: number;
    to?: number;
    at: number;
    len: number;
    wave: OscillatorType;
    vol: number;
};

const PATTERNS: Record<Exclude<NotifySound, 'off'>, Note[]> = {
    // М’який дзвіночок: дві чисті ноти вгору.
    soft: [
        { f: 880, at: 0, len: 0.16, wave: 'sine', vol: 0.18 },
        { f: 1318.5, at: 0.11, len: 0.28, wave: 'sine', vol: 0.15 },
    ],
    // 8-біт: швидке арпеджіо.
    pixel: [
        { f: 1046.5, at: 0, len: 0.07, wave: 'square', vol: 0.06 },
        { f: 1318.5, at: 0.07, len: 0.07, wave: 'square', vol: 0.06 },
        { f: 1568, at: 0.14, len: 0.12, wave: 'square', vol: 0.06 },
    ],
    // Монетка з аркади.
    arcade: [
        { f: 987.8, at: 0, len: 0.08, wave: 'square', vol: 0.06 },
        { f: 1318.5, at: 0.08, len: 0.32, wave: 'square', vol: 0.06 },
    ],
    // Крапля: тон, що швидко падає.
    drop: [{ f: 1200, to: 380, at: 0, len: 0.22, wave: 'sine', vol: 0.2 }],
};

let ctx: AudioContext | null = null;
let last = 0;

function context(): AudioContext | null {
    if (typeof window === 'undefined' || !('AudioContext' in window))
        return null;
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);

    return ctx;
}

/** Програти звук. force — для прослуховування в налаштуваннях (без паузи між звуками). */
export function playNotifySound(
    sound: NotifySound | undefined | null,
    force = false,
): void {
    if (!sound || sound === 'off') return;
    const now = Date.now();
    if (!force && now - last < 1500) return;
    last = now;
    try {
        const audio = context();
        if (!audio || audio.state !== 'running') return;
        const start = audio.currentTime + 0.01;
        for (const note of PATTERNS[sound]) {
            const osc = audio.createOscillator();
            const gain = audio.createGain();
            osc.type = note.wave;
            osc.frequency.setValueAtTime(note.f, start + note.at);
            if (note.to)
                osc.frequency.exponentialRampToValueAtTime(
                    note.to,
                    start + note.at + note.len,
                );
            gain.gain.setValueAtTime(0.0001, start + note.at);
            gain.gain.exponentialRampToValueAtTime(
                note.vol,
                start + note.at + 0.015,
            );
            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                start + note.at + note.len,
            );
            osc.connect(gain).connect(audio.destination);
            osc.start(start + note.at);
            osc.stop(start + note.at + note.len + 0.02);
        }
    } catch {
        // Без звуку — не біда.
    }
}

/** Розблокувати звук після першого дотику до сторінки (вимога браузерів). */
export function unlockSoundOnGesture(): void {
    if (typeof window === 'undefined') return;
    const unlock = () => {
        context();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
}
