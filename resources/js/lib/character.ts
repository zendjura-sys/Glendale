/**
 * Персонаж-аватар: набір частин (номери варіантів). Межі — як у App\Support\Profile\Character::PARTS.
 */
export type CharacterConfig = {
    skin: number;
    head: number;
    hair: number;
    hairColor: number;
    eyes: number;
    eyeColor: number;
    brows: number;
    nose: number;
    mouth: number;
    beard: number;
    extra: number;
    outfit: number;
    outfitColor: number;
    bg: number;
};

export type CharacterPart = keyof CharacterConfig;

export const PARTS: Record<CharacterPart, number> = {
    skin: 8,
    head: 4,
    hair: 10,
    hairColor: 9,
    eyes: 5,
    eyeColor: 5,
    brows: 4,
    nose: 4,
    mouth: 5,
    beard: 5,
    extra: 7,
    outfit: 4,
    outfitColor: 8,
    bg: 8,
};

export const SKIN = [
    '#f9dcc4',
    '#f1c27d',
    '#e0ac69',
    '#c68642',
    '#a86b3c',
    '#8d5524',
    '#6b3e26',
    '#4a2c1d',
];
export const HAIR = [
    '#1f1a17',
    '#3b2a20',
    '#6b4423',
    '#a0662f',
    '#d9a441',
    '#ecdcb0',
    '#b0b4bb',
    '#c2413a',
    '#5b6cff',
];
export const EYE = ['#3b2a20', '#2f6f9f', '#3f7d4e', '#6b6f78', '#7a4fbf'];
export const OUTFIT = [
    '#2a3550',
    '#4f6bff',
    '#e2475b',
    '#2bb673',
    '#f2a33a',
    '#7c4dff',
    '#e9edf2',
    '#1f2430',
];
export const BG = [
    '#1d2a44',
    '#4f6bff',
    '#22d3ee',
    '#a855f7',
    '#f97316',
    '#10b981',
    '#e11d48',
    '#e5e7eb',
];

export const DEFAULT_CHARACTER: CharacterConfig = {
    skin: 1,
    head: 0,
    hair: 1,
    hairColor: 1,
    eyes: 1,
    eyeColor: 0,
    brows: 1,
    nose: 0,
    mouth: 0,
    beard: 0,
    extra: 0,
    outfit: 0,
    outfitColor: 1,
    bg: 0,
};

/** Набір із сервера (може бути порожнім або старим) → повний і в межах. */
export function normalizeCharacter(
    value: Partial<CharacterConfig> | null | undefined,
): CharacterConfig {
    const out = { ...DEFAULT_CHARACTER };
    if (!value) return out;
    (Object.keys(PARTS) as CharacterPart[]).forEach((part) => {
        const v = Number(value[part]);
        if (Number.isInteger(v) && v >= 0 && v < PARTS[part]) out[part] = v;
    });

    return out;
}

/** Випадковий персонаж — кнопка «Перемішати». */
export function randomCharacter(): CharacterConfig {
    const out = { ...DEFAULT_CHARACTER };
    (Object.keys(PARTS) as CharacterPart[]).forEach((part) => {
        out[part] = Math.floor(Math.random() * PARTS[part]);
    });
    // Аксесуари й борода — не в кожного, інакше всі виходять схожими.
    if (Math.random() < 0.5) out.extra = 0;
    if (Math.random() < 0.6) out.beard = 0;

    return out;
}

/** Затемнити колір (тіні шкіри, бров). */
export function shade(hex: string, amount: number): string {
    const n = parseInt(hex.slice(1), 16);
    const f = (c: number) =>
        Math.max(0, Math.min(255, Math.round(c * (1 - amount))));
    const r = f((n >> 16) & 255);
    const g = f((n >> 8) & 255);
    const b = f(n & 255);

    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export type VoiceReading = { level: number; pitch: number };

/**
 * Вимірювач голосу для персонажа: гучність (0…1) відкриває рот, «тембр» (0 — низький, 1 — високий)
 * міняє форму: низький голос — круглий рот, високий — ширший. Згладжено, щоб рот не тремтів.
 */
export function createVoiceMeter(stream: MediaStream): {
    read: () => VoiceReading;
    stop: () => void;
} {
    const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
    const ctx = new Ctx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
    const time = new Uint8Array(analyser.fftSize);
    const freq = new Uint8Array(analyser.frequencyBinCount);
    const binHz = ctx.sampleRate / analyser.fftSize;
    let level = 0;
    let pitch = 0.5;

    return {
        read() {
            analyser.getByteTimeDomainData(time);
            let sum = 0;
            for (let i = 0; i < time.length; i++) {
                const v = (time[i] - 128) / 128;
                sum += v * v;
            }
            const rms = Math.sqrt(sum / time.length);
            const target = Math.min(1, Math.max(0, (rms - 0.02) * 6));
            level += (target - level) * (target > level ? 0.55 : 0.25);

            if (level > 0.08) {
                analyser.getByteFrequencyData(freq);
                // Центр ваги спектра в мовному діапазоні 80–1200 Гц.
                let weighted = 0;
                let total = 0;
                const from = Math.floor(80 / binHz);
                const to = Math.min(freq.length, Math.ceil(1200 / binHz));
                for (let i = from; i < to; i++) {
                    weighted += freq[i] * i * binHz;
                    total += freq[i];
                }
                if (total > 0) {
                    const centroid = weighted / total;
                    const target = Math.min(
                        1,
                        Math.max(0, (centroid - 250) / 600),
                    );
                    pitch += (target - pitch) * 0.2;
                }
            }

            return { level, pitch };
        },
        stop() {
            source.disconnect();
            void ctx.close();
        },
    };
}
