import { EYE_SHAPES, HAIR_PRESETS } from '@/components/character/geometry';

/**
 * Персонаж-аватар у стилі Stereo: номери варіантів частин (геометрія — components/character/geometry.ts).
 * Межі — як у App\Support\Profile\Character::PARTS. Форма й колір незалежні: будь-яка форма очей
 * з будь-яким кольором і зіницею, окремі кольори лівого й правого ока (гетерохромія).
 */
export type CharacterConfig = {
    skin: number;
    freckles: number;
    blush: number;
    head: number;
    hair: number;
    hairColor: number;
    hairOmbre: number;
    eyes: number;
    pupil: number;
    eyeColor: number;
    eyeColorRight: number;
    hetero: number;
    brows: number;
    nose: number;
    mouth: number;
    lipTint: number;
    facialHair: number;
    extra: number;
    outfit: number;
    outfitColor: number;
    bg: number;
    /** 0 — чоловічий, 1 — жіночий: які зачіски, форми очей і борода доступні. */
    gender: number;
    /** Вуса окремо від бороди. */
    mustache: number;
    /** Колір бороди й вусів: 0 — як волосся, далі HAIR_COLORS[n - 1]. */
    beardColor: number;
    /** Редактор обличчя: 0..20, 10 — без зсуву. Очі рухаються парою. */
    eyeY: number;
    eyeSpread: number;
    noseY: number;
    mouthY: number;
};

export type CharacterPart = keyof CharacterConfig;

export const PARTS: Record<CharacterPart, number> = {
    skin: 10,
    freckles: 2,
    blush: 2,
    head: 5,
    hair: 21,
    hairColor: 14,
    hairOmbre: 2,
    eyes: 11,
    pupil: 6,
    eyeColor: 12,
    eyeColorRight: 12,
    hetero: 2,
    brows: 6,
    nose: 5,
    mouth: 6,
    lipTint: 6,
    facialHair: 11,
    extra: 8,
    outfit: 4,
    outfitColor: 9,
    bg: 9,
    gender: 2,
    mustache: 8,
    beardColor: 15,
    eyeY: 21,
    eyeSpread: 21,
    noseY: 21,
    mouthY: 21,
};

export const DEFAULT_CHARACTER: CharacterConfig = {
    skin: 5,
    freckles: 0,
    blush: 0,
    head: 0,
    hair: 1,
    hairColor: 1,
    hairOmbre: 0,
    eyes: 0,
    pupil: 0,
    eyeColor: 0,
    eyeColorRight: 0,
    hetero: 0,
    brows: 0,
    nose: 0,
    mouth: 0,
    lipTint: 0,
    facialHair: 0,
    extra: 0,
    outfit: 0,
    outfitColor: 0,
    bg: 0,
    gender: 0,
    mustache: 0,
    beardColor: 0,
    eyeY: 10,
    eyeSpread: 10,
    noseY: 10,
    mouthY: 10,
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

/** Номери зачісок, які показуємо для статі (унісекс — обом). */
export function hairFor(gender: number): number[] {
    const want = gender === 1 ? 'f' : 'm';

    return HAIR_PRESETS.flatMap((h, i) =>
        (h.sex ?? 'u') === 'u' || h.sex === want ? [i] : [],
    );
}

/** Форми очей для статі: female_* — жіночі, male_* — чоловічі, решта — обом. */
export function eyesFor(gender: number): number[] {
    const other = gender === 1 ? 'male_' : 'female_';

    return EYE_SHAPES.flatMap((e, i) => (e.id.startsWith(other) ? [] : [i]));
}

/** Перемкнути стать: якщо поточна зачіска чи очі не з цього набору — беремо перші доступні, жінкам прибираємо бороду. */
export function withGender(
    config: CharacterConfig,
    gender: number,
): CharacterConfig {
    const hair = hairFor(gender);
    const eyes = eyesFor(gender);
    const firstHair =
        gender === 1
            ? HAIR_PRESETS.findIndex((h) => h.sex === 'f')
            : (hair[1] ?? hair[0]);

    return {
        ...config,
        gender,
        hair: hair.includes(config.hair) ? config.hair : firstHair,
        eyes: eyes.includes(config.eyes) ? config.eyes : eyes[0],
        facialHair: gender === 1 ? 0 : config.facialHair,
        mustache: gender === 1 ? 0 : config.mustache,
    };
}

const pick = (list: number[]) => list[Math.floor(Math.random() * list.length)];

/** Випадковий персонаж — кнопка «Перемішати». Борода, аксесуари й незвичні зіниці — не в кожного. */
export function randomCharacter(): CharacterConfig {
    const out = { ...DEFAULT_CHARACTER };
    (Object.keys(PARTS) as CharacterPart[]).forEach((part) => {
        out[part] = Math.floor(Math.random() * PARTS[part]);
    });
    if (Math.random() < 0.6) out.facialHair = 0;
    if (Math.random() < 0.5) out.extra = 0;
    if (Math.random() < 0.7) out.pupil = 0;
    if (Math.random() < 0.85) out.hetero = 0;
    if (Math.random() < 0.7) out.hairOmbre = 0;
    if (Math.random() < 0.6) out.freckles = 0;
    if (Math.random() < 0.5) out.lipTint = 0;
    out.eyeColorRight = out.eyeColor;
    // Зачіска й очі — з набору своєї статі, жінкам без бороди.
    out.hair = pick(hairFor(out.gender));
    out.eyes = pick(eyesFor(out.gender));
    if (out.gender === 1) {
        out.facialHair = 0;
        out.mustache = 0;
    }
    if (Math.random() < 0.6) out.mustache = 0;
    if (Math.random() < 0.7) out.beardColor = 0;
    // Положення рис лишаємо за замовчуванням — випадкові зсуви виглядають криво.
    out.eyeY = 10;
    out.eyeSpread = 10;
    out.noseY = 10;
    out.mouthY = 10;

    return out;
}

/** Затемнити (amount > 0) чи висвітлити (amount < 0) колір. */
export function shade(hex: string, amount: number): string {
    const n = parseInt(hex.slice(1), 16);
    const f = (c: number) =>
        Math.max(
            0,
            Math.min(
                255,
                Math.round(
                    amount >= 0 ? c * (1 - amount) : c + (255 - c) * -amount,
                ),
            ),
        );
    const r = f((n >> 16) & 255);
    const g = f((n >> 8) & 255);
    const b = f(n & 255);

    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Змішати два кольори (t — частка другого). */
export function mix(a: string, b: string, t: number): string {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const ch = (s: number) =>
        Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);

    return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

export type VoiceReading = { level: number; pitch: number };

/**
 * Вимірювач голосу для персонажа: гучність (0…1) відкриває рот, «тембр» (0 — низький, 1 — високий)
 * міняє форму: низький голос — круглий рот, високий — ширший. Згладжено, щоб рот не тремтів.
 */
export function createVoiceMeter(
    stream: MediaStream,
    shared?: AudioContext,
): {
    read: () => VoiceReading;
    stop: () => void;
} {
    const ctx = shared ?? newAudioContext();
    void ctx.resume().catch(() => undefined);
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
            if (!shared) void ctx.close();
        },
    };
}

export function newAudioContext(): AudioContext {
    const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;

    return new Ctx();
}

/** Зсув риси обличчя в пікселях SVG: значення 0..20, 10 — центр. */
export const FACE_STEPS = {
    eyeY: 1.5,
    eyeSpread: 1.2,
    noseY: 1,
    mouthY: 1.2,
} as const;

export function faceOffset(
    config: CharacterConfig,
    key: keyof typeof FACE_STEPS,
): number {
    const v = config[key] - 10;
    // Очі: всередину — дрібний крок (між очима лише кілька пікселів), назовні — щоб не вийти за скроні.
    if (key === 'eyeSpread') return v < 0 ? v * 0.35 : v * 0.8;

    return v * FACE_STEPS[key];
}
