import type { ReactNode } from 'react';

/**
 * Аніме-очі (6 стилів) — лише кубічні криві Безьє для контурів і вій, з гострими кінчиками.
 * Шари: білок із тінню під віями → райдужка (обрізана по розрізу) → зіниця → відблиски → вії, нижня повіка, складка.
 * Око будується в одиничних координатах: u від −1 (внутрішній кут) до +1 (зовнішній), v — униз, одиниця = піввширина ока.
 */

type Variant = {
    /** Висота верхньої дуги, зовнішній кут (від’ємне — вище), глибина нижньої дуги. */
    top: number;
    outer: number;
    bottom: number;
    /** Нахил верхньої лінії: >0 — внутрішній кут нижче (рішучий погляд). */
    slope: number;
    /** Товщина верхньої рамки вій. */
    lash: number;
    /** Кінчики вій назовні: [u, v] вершини. */
    spikes: [number, number][];
    /** Радіус райдужки (по горизонталі) і витягнутість по вертикалі. */
    iris: number;
    stretch: number;
    from: string;
    to: string;
    rim: string;
    pupil: 'round' | 'slit';
    rings?: boolean;
};

/** 6 стилів: котячі янтарні, круглі вугільні, сріблясті, рішучі багряні, привітні блакитні, чарівні пурпурні. */
const VARIANTS: Variant[] = [
    {
        top: 0.62,
        outer: 0.42,
        bottom: 0.42,
        slope: 0,
        lash: 0.2,
        spikes: [
            [1.32, -0.62],
            [1.2, -0.2],
        ],
        iris: 0.5,
        stretch: 1.12,
        from: '#FF8C00',
        to: '#FFEE55',
        rim: '#6a3500',
        pupil: 'slit',
    },
    {
        top: 0.92,
        outer: 0.2,
        bottom: 0.62,
        slope: 0,
        lash: 0.22,
        spikes: [
            [1.28, -0.66],
            [1.36, -0.32],
            [1.16, -0.02],
        ],
        iris: 0.62,
        stretch: 1.1,
        from: '#1A1A1A',
        to: '#666666',
        rim: '#0b0b0b',
        pupil: 'round',
    },
    {
        top: 0.6,
        outer: 0.18,
        bottom: 0.5,
        slope: 0.12,
        lash: 0.17,
        spikes: [[1.24, -0.3]],
        iris: 0.54,
        stretch: 1.05,
        from: '#4A4A4A',
        to: '#D0D0D0',
        rim: '#2a2a2a',
        pupil: 'round',
        rings: true,
    },
    {
        top: 0.5,
        outer: 0.36,
        bottom: 0.4,
        slope: 0.32,
        lash: 0.24,
        spikes: [
            [1.4, -0.58],
            [1.3, -0.16],
        ],
        iris: 0.5,
        stretch: 1.05,
        from: '#6B0018',
        to: '#FF1E56',
        rim: '#3a000c',
        pupil: 'round',
    },
    {
        top: 0.84,
        outer: 0.14,
        bottom: 0.6,
        slope: -0.06,
        lash: 0.18,
        spikes: [
            [1.22, -0.5],
            [1.26, -0.18],
        ],
        iris: 0.6,
        stretch: 1.12,
        from: '#0044AA',
        to: '#55FFFF',
        rim: '#002255',
        pupil: 'round',
    },
    {
        top: 0.78,
        outer: 0.28,
        bottom: 0.52,
        slope: 0,
        lash: 0.21,
        spikes: [
            [1.3, -0.72],
            [1.38, -0.4],
            [1.2, -0.08],
        ],
        iris: 0.58,
        stretch: 1.12,
        from: '#3A0066',
        to: '#FF66CC',
        rim: '#1f0038',
        pupil: 'round',
    },
];

export const ANIME_EYE_COUNT = VARIANTS.length;

/**
 * Одне аніме-око. `side` −1 — ліве (зовнішній кут ліворуч), 1 — праве.
 * `hw` — піввширина ока в одиницях SVG персонажа.
 */
export function AnimeEye({
    variant,
    side,
    cx,
    cy,
    hw,
    uid,
    lashes,
}: {
    variant: number;
    side: -1 | 1;
    cx: number;
    cy: number;
    hw: number;
    uid: string;
    /** Додаткові вії (0 — як у стилі, 1–2 — довші кінчики). */
    lashes: number;
}): ReactNode {
    const v = VARIANTS[variant] ?? VARIANTS[0];
    const P = (u: number, y: number) =>
        `${(cx + side * u * hw).toFixed(2)} ${(cy + y * hw).toFixed(2)}`;
    const id = (name: string) => `${name}${side}${uid}`;
    const inner: [number, number] = [-1, 0.12 + v.slope * 0.5];
    const outer: [number, number] = [1, -v.outer];
    // Верхня дуга (керуючі точки) і нижня.
    const tc1: [number, number] = [-0.55, -v.top * 1.05 + v.slope * 0.3];
    const tc2: [number, number] = [0.45, -v.top * 1.12];
    const bc1: [number, number] = [0.72, v.bottom * 0.95];
    const bc2: [number, number] = [-0.45, v.bottom * 1.05];
    const p = (q: [number, number]) => P(q[0], q[1]);
    const opening = `M${p(inner)} C${p(tc1)} ${p(tc2)} ${p(outer)} C${p(bc1)} ${p(bc2)} ${p(inner)} Z`;

    // Рамка вій: верхня дуга, гострі кінчики назовні, назад — вище дуги (товща до зовнішнього кута).
    const t = v.lash * (1 + lashes * 0.18);
    const spikes = v.spikes
        .map(([u, y], i) => {
            const len = 1 + lashes * 0.12;
            const tip: [number, number] = [
                1 + (u - 1) * len,
                y * len - (i === 0 ? lashes * 0.06 : 0),
            ];
            const back: [number, number] = [
                1 - 0.06 * (i + 1),
                -v.outer - t * (0.45 + i * 0.25),
            ];

            return `C${P(tip[0] - 0.08, tip[1] + 0.06)} ${P(tip[0] - 0.02, tip[1] + 0.02)} ${p(tip)} C${P(tip[0] - 0.16, tip[1] + 0.14)} ${p(back)} ${p(back)}`;
        })
        .join(' ');
    const lashFrame = `M${P(inner[0] - 0.04, inner[1] + 0.02)} C${p(tc1)} ${p(tc2)} ${p(outer)} ${spikes} C${P(tc2[0], tc2[1] - t * 1.15)} ${P(tc1[0], tc1[1] - t * 0.7)} ${P(inner[0] + 0.06, inner[1] - t * 0.35)} Z`;

    // Тонка нижня повіка: від середини до зовнішнього кута, гострі кінці.
    const lower = `M${P(-0.15, v.bottom * 0.98)} C${P(0.35, v.bottom * 1.02)} ${P(0.78, v.bottom * 0.62)} ${P(1.04, -v.outer + 0.1)} C${P(0.74, v.bottom * 0.52)} ${P(0.32, v.bottom * 0.88)} ${P(-0.15, v.bottom * 0.98)} Z`;

    // Складка повіки над оком — тонка крива з гострими кінцями.
    const ct = -v.top * 1.12 - t - 0.22;
    const crease = `M${P(-0.55, ct + 0.12 + v.slope * 0.25)} C${P(-0.1, ct - 0.16)} ${P(0.5, ct - 0.12)} ${P(0.98, -v.outer - t - 0.22)} C${P(0.5, ct - 0.04)} ${P(-0.1, ct - 0.08)} ${P(-0.55, ct + 0.12 + v.slope * 0.25)} Z`;

    // Тінь під віями на білку.
    const shadow = `M${p(inner)} C${p(tc1)} ${p(tc2)} ${p(outer)} L${P(1, -v.outer + 0.28)} C${P(0.45, -v.top * 0.55)} ${P(-0.55, -v.top * 0.45)} ${P(-1, inner[1] + 0.2)} Z`;

    const icx = 0.04;
    const icy = (v.bottom - v.top) * 0.22 + 0.08;
    const rx = v.iris;
    const ry = v.iris * v.stretch;

    return (
        <g>
            <defs>
                <clipPath id={id('open')}>
                    <path d={opening} />
                </clipPath>
                <linearGradient id={id('iris')} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={v.rim} />
                    <stop offset="38%" stopColor={v.from} />
                    <stop offset="100%" stopColor={v.to} />
                </linearGradient>
                <radialGradient id={id('glow')} cx="50%" cy="80%" r="55%">
                    <stop offset="0%" stopColor={v.to} stopOpacity="0.85" />
                    <stop offset="100%" stopColor={v.to} stopOpacity="0" />
                </radialGradient>
            </defs>
            <path d={crease} fill="#211a1d" opacity="0.55" />
            {/* Шар 1: білок */}
            <path d={opening} fill="#FFFFFF" />
            <g clipPath={`url(#${id('open')})`}>
                <path d={shadow} fill="#E2E6F0" />
                {/* Шар 2: райдужка */}
                <ellipse
                    cx={cx + side * icx * hw}
                    cy={cy + icy * hw}
                    rx={rx * hw}
                    ry={ry * hw}
                    fill={`url(#${id('iris')})`}
                />
                <ellipse
                    cx={cx + side * icx * hw}
                    cy={cy + (icy + ry * 0.35) * hw}
                    rx={rx * hw * 0.8}
                    ry={ry * hw * 0.55}
                    fill={`url(#${id('glow')})`}
                />
                {v.rings &&
                    [0.78, 0.58, 0.4].map((k) => (
                        <ellipse
                            key={k}
                            cx={cx + side * icx * hw}
                            cy={cy + icy * hw}
                            rx={rx * hw * k}
                            ry={ry * hw * k}
                            fill="none"
                            stroke="#f2f2f2"
                            strokeOpacity="0.45"
                            strokeWidth={hw * 0.035}
                        />
                    ))}
                <ellipse
                    cx={cx + side * icx * hw}
                    cy={cy + icy * hw}
                    rx={rx * hw}
                    ry={ry * hw}
                    fill="none"
                    stroke={v.rim}
                    strokeWidth={hw * 0.07}
                />
                {/* Шар 3: зіниця */}
                {v.pupil === 'slit' ? (
                    <path
                        d={`M${P(icx, icy - ry * 0.82)} C${P(icx + 0.12, icy - ry * 0.3)} ${P(icx + 0.12, icy + ry * 0.3)} ${P(icx, icy + ry * 0.82)} C${P(icx - 0.12, icy + ry * 0.3)} ${P(icx - 0.12, icy - ry * 0.3)} ${P(icx, icy - ry * 0.82)} Z`}
                        fill="#140a00"
                    />
                ) : (
                    <ellipse
                        cx={cx + side * icx * hw}
                        cy={cy + (icy + 0.02) * hw}
                        rx={rx * hw * 0.36}
                        ry={ry * hw * 0.4}
                        fill="#0d0b12"
                    />
                )}
                {/* Тінь від вій на верхній частині райдужки */}
                <path d={shadow} fill="#000" opacity="0.18" />
                {/* Шар 4: відблиски */}
                <ellipse
                    cx={cx - side * (rx * 0.32) * hw}
                    cy={cy + (icy - ry * 0.38) * hw}
                    rx={hw * rx * 0.34}
                    ry={hw * rx * 0.3}
                    fill="#FFFFFF"
                />
                <ellipse
                    cx={cx + side * (rx * 0.45) * hw}
                    cy={cy + (icy + ry * 0.42) * hw}
                    rx={hw * rx * 0.13}
                    ry={hw * rx * 0.13}
                    fill="#FFFFFF"
                />
            </g>
            {/* Шар 5: вії й нижня повіка */}
            <path d={lashFrame} fill="#16121a" />
            <path d={lower} fill="#16121a" opacity="0.75" />
        </g>
    );
}
