import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { BG, EYE, HAIR, LIP, mix, OUTFIT, shade, SKIN } from '@/lib/character';
import type { CharacterConfig, VoiceReading } from '@/lib/character';
import { cn } from '@/lib/utils';
import { AnimeEye } from './anime-eyes';

const INK = '#211a1d';

/** Центри очей і рота (SVG 200×200). */
const EYE_Y = 94;
const EYE_DX = 18;
const MOUTH_Y = 129;

/**
 * Персонаж-аватар (SVG 200×200): об’ємна шкіра, волосся з відблиском, очі з райдужкою й відблисками,
 * губи з двох половинок. З `meter` — «говорить»: губи розходяться за гучністю, форма рота — за тембром,
 * голова злегка хитається. Анімація — атрибутами SVG у requestAnimationFrame, без перемальовування React.
 */
export function Character({
    config,
    meter,
    background = true,
    zoom,
    className,
    title,
}: {
    config: CharacterConfig;
    /** Поточна гучність і тембр голосу; null — мовчить. */
    meter?: (() => VoiceReading | null) | null;
    background?: boolean;
    /** 'face' — крупний план обличчя (для вибору очей, губ, макіяжу). */
    zoom?: 'face';
    className?: string;
    title?: string;
}) {
    const uid = useId().replace(/:/g, '');
    const head = useRef<SVGGElement>(null);
    const upper = useRef<SVGGElement>(null);
    const lower = useRef<SVGGElement>(null);
    const inside = useRef<SVGEllipseElement>(null);
    const still = useRef<SVGGElement>(null);

    useEffect(() => {
        if (!meter) return;
        const reduce = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches;
        let frame = 0;
        let t = 0;
        const tick = () => {
            t += 1;
            const r = meter() ?? { level: 0, pitch: 0.5 };
            const open = r.level;
            const speaking = open > 0.06;
            if (still.current)
                still.current.style.opacity = speaking ? '0' : '1';
            if (upper.current)
                upper.current.setAttribute(
                    'transform',
                    `translate(0 ${(-open * 1.6).toFixed(2)})`,
                );
            if (lower.current)
                lower.current.setAttribute(
                    'transform',
                    `translate(0 ${(open * 7.5).toFixed(2)})`,
                );
            if (inside.current) {
                inside.current.style.opacity = speaking ? '1' : '0';
                // Низький голос — округлий рот, високий — ширший.
                inside.current.setAttribute(
                    'rx',
                    String(5 + r.pitch * 5 + open * 2),
                );
                inside.current.setAttribute('ry', String(1 + open * 5));
                inside.current.setAttribute('cy', String(MOUTH_Y + open * 3));
            }
            if (head.current && !reduce) {
                const bob = speaking ? Math.sin(t / 5) * open * 2.5 : 0;
                const tilt = speaking ? (r.pitch - 0.5) * 4 * open : 0;
                head.current.setAttribute(
                    'transform',
                    `translate(0 ${(-bob).toFixed(2)}) rotate(${tilt.toFixed(2)} 100 120)`,
                );
            }
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(frame);
    }, [meter]);

    const skin = SKIN[config.skin] ?? SKIN[0];
    const earScale = (CHEEK + 1) / 50;
    const hair = HAIR[config.hairColor] ?? HAIR[0];
    const id = (name: string) => `${name}${uid}`;
    const url = (name: string) => `url(#${id(name)})`;
    const lip =
        LIP[config.lipColor] === 'natural' || !LIP[config.lipColor]
            ? mix(skin, '#b4505e', 0.42)
            : LIP[config.lipColor];

    return (
        <svg
            viewBox={zoom === 'face' ? '60 70 80 80' : '0 0 200 200'}
            role="img"
            aria-label={title}
            className={cn('character-svg', className)}
        >
            {title && <title>{title}</title>}
            <defs>
                <radialGradient id={id('skin')} cx="45%" cy="38%" r="65%">
                    <stop offset="0%" stopColor={shade(skin, -0.12)} />
                    <stop offset="60%" stopColor={skin} />
                    <stop offset="100%" stopColor={shade(skin, 0.1)} />
                </radialGradient>
                <linearGradient id={id('neck')} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={shade(skin, 0.28)} />
                    <stop offset="55%" stopColor={shade(skin, 0.12)} />
                </linearGradient>
                <linearGradient id={id('hair')} x1="0.2" y1="0" x2="0.8" y2="1">
                    <stop offset="0%" stopColor={shade(hair, -0.28)} />
                    <stop offset="45%" stopColor={hair} />
                    <stop offset="100%" stopColor={shade(hair, 0.28)} />
                </linearGradient>
                <radialGradient id={id('iris')} cx="50%" cy="45%" r="55%">
                    <stop
                        offset="0%"
                        stopColor={shade(EYE[config.eyeColor] ?? EYE[0], -0.45)}
                    />
                    <stop
                        offset="70%"
                        stopColor={EYE[config.eyeColor] ?? EYE[0]}
                    />
                    <stop
                        offset="100%"
                        stopColor={shade(EYE[config.eyeColor] ?? EYE[0], 0.35)}
                    />
                </radialGradient>
                <linearGradient id={id('cloth')} x1="0" y1="0" x2="0" y2="1">
                    <stop
                        offset="0%"
                        stopColor={shade(
                            OUTFIT[config.outfitColor] ?? OUTFIT[0],
                            -0.12,
                        )}
                    />
                    <stop
                        offset="100%"
                        stopColor={shade(
                            OUTFIT[config.outfitColor] ?? OUTFIT[0],
                            0.18,
                        )}
                    />
                </linearGradient>
                <radialGradient id={id('bg')} cx="50%" cy="35%" r="75%">
                    <stop
                        offset="0%"
                        stopColor={shade(BG[config.bg] ?? BG[0], -0.18)}
                    />
                    <stop
                        offset="100%"
                        stopColor={shade(BG[config.bg] ?? BG[0], 0.12)}
                    />
                </radialGradient>
                <clipPath id={id('frame')}>
                    <rect width="200" height="200" />
                </clipPath>
            </defs>
            <g clipPath={url('frame')}>
                {background && (
                    <rect width="200" height="200" fill={url('bg')} />
                )}
                <Body config={config} skin={skin} cloth={url('cloth')} />
                <g ref={head}>
                    {hairBack(config.hair, url('hair'))}
                    {/* Шия за макетом: рівна, внизу м’яко переходить у плечі. */}
                    <path d={neckPath(config.build)} fill={url('neck')} />
                    {config.outfit === 4 && (
                        <rect
                            x={100 - neckWidth(config.build) / 2 - 3}
                            y="138"
                            width={neckWidth(config.build) + 6}
                            height="24"
                            rx="9"
                            fill={url('cloth')}
                        />
                    )}
                    {tattooNeck(config.tattoo)}
                    {/* Вуха й сережки — на ширині вилиць обраного типу обличчя. */}
                    <g
                        transform={`translate(100 0) scale(${earScale} 1) translate(-100 0)`}
                    >
                        <Ears skin={skin} />
                        {earrings(config.earrings)}
                    </g>
                    <path d={HEAD_PATH} fill={url('skin')} />
                    {makeupUnder(config.makeup, skin)}
                    {tattooFace(config.tattoo)}
                    {beard(config.beard, url('hair'))}
                    <Eyes
                        config={config}
                        skin={skin}
                        iris={url('iris')}
                        uid={uid}
                    />
                    {brows(
                        config.brows,
                        shade(hair, 0.1),
                        eyeGap(config.eyeGap) - EYE_DX,
                        config.sex !== 1,
                    )}
                    <g transform="translate(0 5)">{nose(config.nose, skin)}</g>
                    <Lips
                        config={config}
                        color={lip}
                        upperRef={upper}
                        lowerRef={lower}
                        insideRef={inside}
                        stillRef={still}
                    />
                    {config.beard === 3 && mustache(url('hair'))}
                    {hairFront(config.hair, url('hair'), hair)}
                    <g
                        transform={
                            config.extra >= 1 && config.extra <= 3
                                ? 'translate(0 -4)'
                                : undefined
                        }
                    >
                        {extra(config.extra)}
                    </g>
                </g>
            </g>
        </svg>
    );
}

function neckFactor(build: number): number {
    return [0.86, 1, 1.12, 1.06][build] ?? 1;
}

function neckWidth(build: number): number {
    return 52.8 * neckFactor(build);
}

function neckPath(build: number): string {
    const w = 26.4 * neckFactor(build);
    const f = 33 * neckFactor(build);

    return `M${100 - w} 120 L${100 - w} 143 C${100 - w} 150 ${100 - f + 3} 155 ${100 - f} 160 L${100 + f} 160 C${100 + f - 3} 155 ${100 + w} 150 ${100 + w} 143 L${100 + w} 120 Z`;
}

/* ---------- Тіло й одяг ---------- */

function Body({
    config,
    skin,
    cloth,
}: {
    config: CharacterConfig;
    skin: string;
    cloth: string;
}) {
    const hw = [58, 68, 80, 76][config.build] ?? 68;
    const color = OUTFIT[config.outfitColor] ?? OUTFIT[0];
    const dark = shade(color, 0.25);
    const shoulders = `M${100 - hw} 200 C${100 - hw + 2} 174 ${100 - hw * 0.62} 154 100 153 C${100 + hw * 0.62} 154 ${100 + hw - 2} 174 ${100 + hw} 200 Z`;
    const athletic =
        config.build === 3 ? (
            <path
                d="M84 176 Q100 184 116 176 M100 182 L100 198"
                stroke={dark}
                strokeWidth="1.6"
                strokeLinecap="round"
                fill="none"
                opacity="0.45"
            />
        ) : null;

    switch (config.outfit) {
        case 1: // футболка з V-вирізом
            return (
                <g>
                    <path d={shoulders} fill={cloth} />
                    <path
                        d="M86 153 L100 172 L114 153 Z"
                        fill={shade(skin, 0.15)}
                    />
                    <path
                        d="M86 153 L100 172 L114 153"
                        stroke={dark}
                        strokeWidth="2"
                        fill="none"
                    />
                    {athletic}
                </g>
            );
        case 2: // куртка поверх світлої футболки
            return (
                <g>
                    <path d={shoulders} fill={cloth} />
                    <path d="M88 153 L100 200 L112 153 Z" fill="#eef1f5" />
                    <path
                        d="M88 152 L82 176 L97 200 M112 152 L118 176 L103 200"
                        stroke={dark}
                        strokeWidth="3"
                        fill="none"
                        strokeLinejoin="round"
                    />
                </g>
            );
        case 3: // сорочка з комірцем
            return (
                <g>
                    <path d={shoulders} fill={cloth} />
                    <path
                        d="M84 151 L100 164 L93 175 Z M116 151 L100 164 L107 175 Z"
                        fill="#fff"
                    />
                    <path
                        d="M100 164 L100 200"
                        stroke={dark}
                        strokeWidth="1.6"
                    />
                    <circle cx="100" cy="181" r="1.4" fill={dark} />
                    <circle cx="100" cy="192" r="1.4" fill={dark} />
                </g>
            );
        case 4: // водолазка
            return (
                <g>
                    <path d={shoulders} fill={cloth} />
                    {athletic}
                </g>
            );
        case 5: // бомбер-варсіті: контрастні рукави й літера
            return (
                <g>
                    <path d={shoulders} fill={cloth} />
                    <path
                        d={`M${100 - hw} 200 C${100 - hw + 2} 176 ${100 - hw * 0.8} 160 ${100 - hw * 0.55} 156 L${100 - hw * 0.42} 200 Z M${100 + hw} 200 C${100 + hw - 2} 176 ${100 + hw * 0.8} 160 ${100 + hw * 0.55} 156 L${100 + hw * 0.42} 200 Z`}
                        fill="#eef1f5"
                    />
                    <path
                        d="M84 154 Q100 166 116 154"
                        stroke="#eef1f5"
                        strokeWidth="4"
                        fill="none"
                        strokeLinecap="round"
                    />
                    <text
                        x="80"
                        y="188"
                        fontSize="16"
                        fontWeight="800"
                        fill="#eef1f5"
                        fontFamily="system-ui"
                    >
                        G
                    </text>
                </g>
            );
        case 6: // шкіряна куртка
            return (
                <g>
                    <path d={shoulders} fill="#1d1e24" />
                    <path d="M90 153 L100 200 L110 153 Z" fill={cloth} />
                    <path
                        d="M90 153 L80 172 L94 178 L98 200 M110 153 L120 172 L106 178 L102 200"
                        stroke="#3b3d47"
                        strokeWidth="2.4"
                        fill="none"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M108 160 L113 196"
                        stroke="#c9ccd6"
                        strokeWidth="1.4"
                        strokeDasharray="2 2"
                    />
                    <path
                        d="M80 172 L94 178"
                        stroke="#5c5f6b"
                        strokeWidth="1"
                    />
                </g>
            );
        case 7: // пуховик
            return (
                <g>
                    <path d={shoulders} fill={cloth} />
                    {[166, 178, 190].map((yy) => (
                        <path
                            key={yy}
                            d={`M${100 - hw + 6} ${yy} Q100 ${yy + 4} ${100 + hw - 6} ${yy}`}
                            stroke={dark}
                            strokeWidth="1.6"
                            fill="none"
                            opacity="0.6"
                        />
                    ))}
                    <path
                        d="M84 152 C88 144 112 144 116 152 C112 158 88 158 84 152 Z"
                        fill={dark}
                    />
                    <path
                        d="M100 156 L100 200"
                        stroke={dark}
                        strokeWidth="1.6"
                    />
                </g>
            );
        case 8: // костюм із краваткою
            return (
                <g>
                    <path d={shoulders} fill="#252a36" />
                    <path d="M88 153 L100 200 L112 153 Z" fill="#fff" />
                    <path
                        d="M88 153 L80 176 L98 200 M112 153 L120 176 L102 200"
                        stroke="#121520"
                        strokeWidth="2.6"
                        fill="none"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M97 158 L103 158 L105 186 L100 192 L95 186 Z"
                        fill={cloth}
                    />
                    <path
                        d="M96.5 154 L103.5 154 L102 159 L98 159 Z"
                        fill={dark}
                    />
                </g>
            );
        case 9: // джинсова куртка
            return (
                <g>
                    <path d={shoulders} fill="#4a6fa5" />
                    <path d="M90 153 L100 200 L110 153 Z" fill={cloth} />
                    <path
                        d="M90 153 L82 172 L96 200 M110 153 L118 172 L104 200"
                        stroke="#2f4a75"
                        strokeWidth="2.4"
                        fill="none"
                    />
                    <rect
                        x="74"
                        y="176"
                        width="14"
                        height="10"
                        rx="2"
                        fill="none"
                        stroke="#e0b25a"
                        strokeWidth="1"
                        strokeDasharray="2 1.5"
                    />
                    <rect
                        x="112"
                        y="176"
                        width="14"
                        height="10"
                        rx="2"
                        fill="none"
                        stroke="#e0b25a"
                        strokeWidth="1"
                        strokeDasharray="2 1.5"
                    />
                </g>
            );
        case 10: // спортивний костюм: дві смуги й блискавка
            return (
                <g>
                    <path d={shoulders} fill={cloth} />
                    <path
                        d={`M${100 - hw * 0.72} 158 L${100 - hw * 0.92} 200 M${100 - hw * 0.64} 158 L${100 - hw * 0.82} 200 M${100 + hw * 0.72} 158 L${100 + hw * 0.92} 200 M${100 + hw * 0.64} 158 L${100 + hw * 0.82} 200`}
                        stroke="#eef1f5"
                        strokeWidth="2.6"
                    />
                    <path
                        d="M88 150 L100 156 L112 150 L112 156 L100 162 L88 156 Z"
                        fill={dark}
                    />
                    <path
                        d="M100 160 L100 200"
                        stroke="#c9ccd6"
                        strokeWidth="1.6"
                    />
                </g>
            );
        case 11: // оверсайз-футболка з принтом
            return (
                <g>
                    <path
                        d={`M${100 - hw - 6} 200 C${100 - hw - 4} 172 ${100 - hw * 0.66} 154 100 153 C${100 + hw * 0.66} 154 ${100 + hw + 4} 172 ${100 + hw + 6} 200 Z`}
                        fill={cloth}
                    />
                    <path
                        d="M88 153 Q100 162 112 153"
                        stroke={dark}
                        strokeWidth="3"
                        fill="none"
                    />
                    <circle
                        cx="100"
                        cy="182"
                        r="11"
                        fill="none"
                        stroke="#eef1f5"
                        strokeWidth="2.4"
                    />
                    <path
                        d="M104 178 A6 6 0 1 0 105 186 L105 183 L101 183"
                        stroke="#eef1f5"
                        strokeWidth="2.2"
                        fill="none"
                        strokeLinecap="round"
                    />
                </g>
            );
        case 12: // топ на бретелях
            return (
                <g>
                    <path d={shoulders} fill={shade(skin, 0.08)} />
                    <path
                        d={`M${100 - hw * 0.62} 200 L${100 - hw * 0.5} 172 Q100 160 ${100 + hw * 0.5} 172 L${100 + hw * 0.62} 200 Z`}
                        fill={cloth}
                    />
                    <path
                        d={`M${100 - hw * 0.5} 172 L${100 - hw * 0.42} 152 M${100 + hw * 0.5} 172 L${100 + hw * 0.42} 152`}
                        stroke={cloth}
                        strokeWidth="2.4"
                    />
                    <path
                        d={`M${100 - hw * 0.5} 172 Q100 160 ${100 + hw * 0.5} 172`}
                        stroke={dark}
                        strokeWidth="1.4"
                        fill="none"
                    />
                </g>
            );
        case 13: // спортивна джерсі з номером
            return (
                <g>
                    <path d={shoulders} fill={cloth} />
                    <path
                        d="M86 152 L100 168 L114 152"
                        stroke="#eef1f5"
                        strokeWidth="3.4"
                        fill="none"
                        strokeLinejoin="round"
                    />
                    <path
                        d={`M${100 - hw} 200 C${100 - hw + 2} 180 ${100 - hw * 0.8} 166 ${100 - hw * 0.66} 162 M${100 + hw} 200 C${100 + hw - 2} 180 ${100 + hw * 0.8} 166 ${100 + hw * 0.66} 162`}
                        stroke="#eef1f5"
                        strokeWidth="3"
                        fill="none"
                    />
                    <text
                        x="100"
                        y="194"
                        textAnchor="middle"
                        fontSize="18"
                        fontWeight="800"
                        fill="#eef1f5"
                        fontFamily="system-ui"
                    >
                        7
                    </text>
                </g>
            );
        default: // худі
            return (
                <g>
                    <path d={shoulders} fill={cloth} />
                    <path
                        d="M68 158 C74 174 126 174 132 158 C124 151 76 151 68 158 Z"
                        fill={dark}
                    />
                    <path
                        d="M93 168 L91 188 M107 168 L109 188"
                        stroke="#eef1f5"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                    {athletic}
                </g>
            );
    }
}

/* ---------- Голова ---------- */

/**
 * Голова за макетом (контур знято з еталонного рисунка й переведено в криві): одна форма для всіх.
 * Тім’я y=34, підборіддя y=155, найширше місце (±44) — на рівні скронь.
 */
const HEAD_PATH =
    'M100 34 C104.4 34.0 109.4 34.7 113.1 35.5 C116.8 36.2 119.6 37.4 122.0 38.4 C124.3 39.4 125.8 40.4 127.3 41.4 C128.9 42.4 130.0 43.4 131.2 44.4 C132.3 45.3 133.2 46.3 134.1 47.3 C135.0 48.3 135.7 49.3 136.4 50.3 C137.2 51.2 137.8 52.2 138.4 53.2 C139.0 54.2 139.5 55.2 139.9 56.2 C140.3 57.2 140.5 58.1 140.9 59.1 C141.2 60.1 141.6 61.1 141.9 62.1 C142.2 63.1 142.5 64.1 142.7 65.0 C142.9 66.0 143.0 67.0 143.1 68.0 C143.2 69.0 143.3 69.8 143.4 71.0 C143.5 72.2 143.7 73.5 143.8 75.0 C143.9 76.5 144.0 78.5 144.0 80.0 C144.0 81.5 143.8 82.5 143.7 84.0 C143.6 85.5 143.6 87.3 143.5 89.0 C143.4 90.7 143.2 92.2 143.0 94.0 C142.8 95.8 142.6 98.2 142.4 100.0 C142.2 101.8 141.9 103.3 141.6 105.0 C141.3 106.7 141.0 108.3 140.6 110.0 C140.2 111.7 139.9 113.2 139.4 115.0 C138.9 116.8 138.4 118.8 137.8 120.5 C137.2 122.2 136.7 123.8 136.0 125.5 C135.3 127.2 134.5 128.8 133.6 130.5 C132.7 132.2 131.7 134.2 130.4 136.0 C129.1 137.8 127.4 139.9 126.0 141.6 C124.6 143.3 123.6 144.5 122.0 145.9 C120.3 147.3 118.0 148.7 116.0 149.9 C114.1 151.1 112.1 152.4 110.1 153.2 C108.2 154.0 105.9 154.5 104.2 154.8 C102.5 155.1 101.4 155.1 100.0 155.1 C98.6 155.1 97.5 155.1 95.8 154.8 C94.1 154.5 91.8 154.0 89.9 153.2 C87.9 152.4 85.9 151.1 84.0 149.9 C82.0 148.7 79.7 147.3 78.0 145.9 C76.4 144.5 75.4 143.3 74.0 141.6 C72.6 139.9 70.9 137.8 69.6 136.0 C68.3 134.2 67.3 132.2 66.4 130.5 C65.5 128.8 64.7 127.2 64.0 125.5 C63.3 123.8 62.8 122.2 62.2 120.5 C61.6 118.8 61.1 116.8 60.6 115.0 C60.1 113.2 59.8 111.7 59.4 110.0 C59.0 108.3 58.7 106.7 58.4 105.0 C58.1 103.3 57.8 101.8 57.6 100.0 C57.4 98.2 57.2 95.8 57.0 94.0 C56.8 92.2 56.6 90.7 56.5 89.0 C56.4 87.3 56.4 85.5 56.3 84.0 C56.2 82.5 56.0 81.5 56.0 80.0 C56.0 78.5 56.1 76.5 56.2 75.0 C56.3 73.5 56.5 72.2 56.6 71.0 C56.7 69.8 56.8 69.0 56.9 68.0 C57.0 67.0 57.1 66.0 57.3 65.0 C57.5 64.1 57.8 63.1 58.1 62.1 C58.4 61.1 58.8 60.1 59.1 59.1 C59.5 58.1 59.7 57.2 60.1 56.2 C60.5 55.2 61.0 54.2 61.6 53.2 C62.1 52.2 62.8 51.2 63.6 50.3 C64.3 49.3 65.0 48.3 65.9 47.3 C66.8 46.3 67.7 45.3 68.8 44.4 C70.0 43.4 71.1 42.4 72.7 41.4 C74.2 40.4 75.7 39.4 78.0 38.4 C80.4 37.4 83.2 36.2 86.9 35.5 C90.6 34.7 95.6 34.0 100.0 34.0 Z';

/** Напівширина обличчя на рівні вух (для вух і сережок). */
const CHEEK = 42.5;

function Ears({ skin }: { skin: string }) {
    const base = shade(skin, 0.06);
    const inner = shade(skin, 0.22);

    return (
        <g>
            <ellipse cx="50" cy="103" rx="8" ry="15" fill={base} />
            <ellipse cx="150" cy="103" rx="8" ry="15" fill={base} />
            <path
                d="M52 94 C45 98 46 110 52 114"
                stroke={inner}
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
            />
            <path
                d="M148 94 C155 98 154 110 148 114"
                stroke={inner}
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
            />
        </g>
    );
}

function earrings(kind: number): ReactNode {
    if (kind === 1)
        return (
            <g fill="#f5c542">
                <circle cx="49" cy="110" r="2.4" />
                <circle cx="151" cy="110" r="2.4" />
            </g>
        );
    if (kind === 2)
        return (
            <g stroke="#f5c542" strokeWidth="1.8" fill="none">
                <circle cx="49" cy="115" r="5" />
                <circle cx="151" cy="115" r="5" />
            </g>
        );

    return null;
}

/* ---------- Волосся ---------- */

/**
 * «Шапка» волосся по формі голови: від тім’я до лінії росту волосся й скронь.
 * w — напівширина, top — верх, line — лінія волосся по центру, temple — де волосся закінчується на скронях.
 */
function cap(
    w: number,
    top: number,
    line: number,
    temple: number,
    part = 0,
): string {
    const l = 100 - w;
    const r = 100 + w;

    return `M${l} ${temple} C${l - 1} ${top + 10} ${100 - w * 0.55} ${top} 100 ${top} C${100 + w * 0.55} ${top} ${r + 1} ${top + 10} ${r} ${temple} C${r - 5} ${line + 10} ${100 + w * 0.45 + part} ${line} ${100 + part} ${line + (part ? 3 : 0)} C${100 - w * 0.45 + part} ${line} ${l + 5} ${line + 10} ${l} ${temple} Z`;
}

/** Довге волосся позаду: від тім’я до `len`, `flare` — наскільки розходиться донизу, `wave` — хвилястий край. */
function longBack(len: number, w = 56, flare = 4, wave = false): string {
    const l = 100 - w;
    const r = 100 + w;
    const bottom = wave
        ? `Q${r + flare - 4} ${len + 6} ${r - 6} ${len - 2} Q${100 + w * 0.55} ${len + 8} ${100 + w * 0.3} ${len - 4} L${100 - w * 0.3} ${len - 4} Q${100 - w * 0.55} ${len + 8} ${l + 6} ${len - 2} Q${l - flare + 4} ${len + 6} ${l - flare} ${len - 10}`
        : `Q${r + flare} ${len} ${r - 6} ${len} L${l + 6} ${len} Q${l - flare} ${len} ${l - flare} ${len - 10}`;

    return `M${l} 86 C${l - 2} 40 ${100 - w * 0.5} 26 100 26 C${100 + w * 0.5} 26 ${r + 2} 40 ${r} 86 L${r + flare} ${len - 10} ${bottom} Z`;
}

/** Пасма — тонкі темніші лінії для фактури. */
function strands(d: string, color: string): ReactNode {
    return (
        <path
            d={d}
            stroke={shade(color, 0.3)}
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
            opacity="0.5"
        />
    );
}

/** Відблиск на волоссі — світла дуга. */
function sheen(d: string, color: string): ReactNode {
    return (
        <path
            d={d}
            stroke={shade(color, -0.45)}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            opacity="0.45"
        />
    );
}

function curls(points: number[][], fill: string): ReactNode {
    return (
        <g fill={fill}>
            {points.map(([x, y, r]) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
            ))}
        </g>
    );
}

function hairBack(kind: number, fill: string): ReactNode {
    switch (kind) {
        case 4: // довге пряме
            return <path d={longBack(176, 55, 3)} fill={fill} />;
        case 8: // високий хвіст
            return (
                <path
                    d="M112 34 C150 30 168 70 160 118 C156 140 146 152 138 150 C148 120 146 80 120 52 Z"
                    fill={fill}
                />
            );
        case 9: // афро
            return <circle cx="100" cy="76" r="66" fill={fill} />;
        case 10: // каре з чубчиком
            return <path d={longBack(132, 57, 5)} fill={fill} />;
        case 11: // дві коси
            return (
                <g fill={fill}>
                    {[49, 151].map((x) => (
                        <g key={x}>
                            {[0, 1, 2, 3, 4].map((i) => (
                                <ellipse
                                    key={i}
                                    cx={x}
                                    cy={124 + i * 12}
                                    rx={8.5 - i * 0.6}
                                    ry="7.5"
                                />
                            ))}
                        </g>
                    ))}
                </g>
            );
        case 20: // довге чоловіче
            return <path d={longBack(148, 55, 2)} fill={fill} />;
        case 21: // хвилясте довге
            return <path d={longBack(172, 57, 8, true)} fill={fill} />;
        case 22: // кучеряве довге
            return curls(
                [
                    [52, 70, 16],
                    [148, 70, 16],
                    [46, 96, 16],
                    [154, 96, 16],
                    [46, 122, 15],
                    [154, 122, 15],
                    [50, 146, 14],
                    [150, 146, 14],
                    [62, 162, 12],
                    [138, 162, 12],
                    [76, 40, 18],
                    [124, 40, 18],
                    [100, 32, 18],
                ],
                fill,
            );
        case 25: // хвостики
            return (
                <g fill={fill}>
                    <path d="M54 92 C34 100 30 132 40 158 C46 168 54 166 54 156 C50 132 56 112 62 100 Z" />
                    <path d="M146 92 C166 100 170 132 160 158 C154 168 146 166 146 156 C150 132 144 112 138 100 Z" />
                </g>
            );
        case 26: // напівзібране
            return <path d={longBack(164, 55, 4)} fill={fill} />;
        case 27: // набік
            return <path d={longBack(170, 56, 6, true)} fill={fill} />;
        case 28: // подовжене каре
            return <path d={longBack(146, 57, 6)} fill={fill} />;
        case 29: // шторки
            return <path d={longBack(168, 55, 4)} fill={fill} />;
        default:
            return null;
    }
}

function hairFront(kind: number, fill: string, color: string): ReactNode {
    switch (kind) {
        case 1: // коротка
            return (
                <g>
                    <path d={cap(52, 28, 58, 90)} fill={fill} />
                    {strands(
                        'M78 40 L74 54 M92 34 L90 52 M108 34 L110 52 M122 40 L126 54',
                        color,
                    )}
                </g>
            );
        case 2: // їжак
            return <path d={cap(51, 31, 60, 92)} fill={fill} opacity="0.88" />;
        case 3: // кучері
            return curls(
                [
                    [56, 72, 13],
                    [66, 52, 14],
                    [84, 40, 15],
                    [104, 36, 15],
                    [122, 42, 14],
                    [138, 56, 13],
                    [146, 76, 11],
                    [52, 90, 10],
                    [148, 92, 10],
                    [92, 52, 10],
                    [112, 52, 10],
                ],
                fill,
            );
        case 4: // довге пряме — проділ посередині
            return (
                <g>
                    <path d={cap(54, 26, 54, 104)} fill={fill} />
                    <path
                        d="M100 27 L100 52"
                        stroke={shade(color, 0.35)}
                        strokeWidth="1.4"
                    />
                    {sheen('M70 44 Q84 32 96 30', color)}
                </g>
            );
        case 5: // гулька
            return (
                <g fill={fill}>
                    <circle cx="100" cy="20" r="15" />
                    <path d={cap(52, 30, 54, 88)} />
                    {strands('M88 22 Q100 14 112 22', color)}
                </g>
            );
        case 6: // ірокез
            return (
                <g>
                    <path d={cap(50, 34, 60, 90)} fill={fill} opacity="0.3" />
                    <path
                        d="M88 64 C86 38 94 18 100 10 C106 18 114 38 112 64 C108 56 92 56 88 64 Z"
                        fill={fill}
                    />
                </g>
            );
        case 7: // проділ набік
            return (
                <g>
                    <path d={cap(53, 25, 58, 92, 16)} fill={fill} />
                    <path
                        d="M118 28 C108 36 94 44 70 50"
                        stroke={shade(color, 0.3)}
                        strokeWidth="1.4"
                        fill="none"
                    />
                    {sheen('M78 38 Q96 28 116 30', color)}
                </g>
            );
        case 8: // високий хвіст — гладко зачесане
            return (
                <g>
                    <path d={cap(52, 28, 52, 92)} fill={fill} />
                    <circle cx="118" cy="34" r="5" fill={shade(color, 0.35)} />
                    {sheen('M76 42 Q94 30 114 34', color)}
                </g>
            );
        case 9: // афро — лінія лоба
            return <path d={cap(52, 40, 60, 88)} fill={fill} />;
        case 10: // каре з рівним чубчиком
            return (
                <g>
                    <path
                        d="M46 104 C42 50 70 26 100 26 C130 26 158 50 154 104 C150 92 148 82 146 76 L54 76 C52 82 50 92 46 104 Z"
                        fill={fill}
                    />
                    {strands(
                        'M70 60 L68 76 M86 58 L85 76 M100 58 L100 76 M114 58 L115 76 M130 60 L132 76',
                        color,
                    )}
                </g>
            );
        case 11: // дві коси — проділ посередині
            return (
                <g>
                    <path d={cap(53, 28, 56, 98)} fill={fill} />
                    <path
                        d="M100 29 L100 54"
                        stroke={shade(color, 0.35)}
                        strokeWidth="1.4"
                    />
                </g>
            );
        case 12: // піксі з косим чубчиком
            return (
                <g>
                    <path
                        d="M48 92 C44 50 72 28 102 28 C132 28 156 50 152 90 C146 74 136 66 124 62 C112 72 86 80 60 80 C54 82 50 86 48 92 Z"
                        fill={fill}
                    />
                    {sheen('M80 38 Q100 30 124 36', color)}
                </g>
            );
        case 13: // пучок на маківці
            return (
                <g fill={fill}>
                    <ellipse cx="100" cy="24" rx="13" ry="9" />
                    <path d={cap(52, 30, 52, 90)} />
                </g>
            );
        case 14: // зачесане назад
            return (
                <g>
                    <path d={cap(52, 24, 50, 90)} fill={fill} />
                    {strands(
                        'M82 50 Q84 36 92 28 M100 50 Q100 36 104 26 M118 50 Q118 36 114 28',
                        color,
                    )}
                    {sheen('M76 40 Q92 28 110 28', color)}
                </g>
            );
        case 15: // кок
            return (
                <g>
                    <path d={cap(52, 30, 56, 90)} fill={fill} />
                    <path
                        d="M70 52 C66 30 84 12 108 14 C126 16 136 30 132 48 C120 36 92 40 70 52 Z"
                        fill={fill}
                    />
                    {sheen('M84 26 Q100 16 118 22', color)}
                </g>
            );
        case 16: // андеркат: об’ємний верх, коротко на скронях
            return (
                <g>
                    <path d={cap(51, 34, 60, 92)} fill={fill} opacity="0.4" />
                    <path
                        d="M64 58 C62 30 82 18 104 18 C128 18 142 32 138 56 C126 46 112 44 100 48 C88 44 74 48 64 58 Z"
                        fill={fill}
                    />
                    {strands('M80 30 Q96 24 120 28', color)}
                </g>
            );
        case 17: // французький кроп: короткий рваний чубчик
            return (
                <g>
                    <path d={cap(52, 28, 62, 90)} fill={fill} />
                    <path
                        d="M66 58 L72 66 L78 59 L85 67 L92 60 L100 68 L108 60 L115 67 L122 59 L128 66 L134 58 Z"
                        fill={fill}
                    />
                </g>
            );
        case 18: // скуйовджене
            return (
                <g>
                    <path d={cap(53, 30, 58, 92)} fill={fill} />
                    <path
                        d="M58 46 L66 26 L74 40 L84 18 L92 36 L102 14 L110 34 L120 18 L126 38 L138 26 L142 48 Z"
                        fill={fill}
                    />
                </g>
            );
        case 19: // кучерявий верх, коротко з боків
            return (
                <g>
                    <path d={cap(51, 36, 62, 92)} fill={fill} opacity="0.45" />
                    {curls(
                        [
                            [74, 44, 11],
                            [88, 34, 12],
                            [104, 30, 12],
                            [120, 36, 11],
                            [132, 48, 9],
                            [80, 56, 8],
                            [96, 50, 9],
                            [112, 50, 9],
                            [126, 58, 7],
                        ],
                        fill,
                    )}
                </g>
            );
        case 20: // довге чоловіче — проділ посередині
            return (
                <g>
                    <path d={cap(54, 26, 54, 106)} fill={fill} />
                    <path
                        d="M100 27 L100 52"
                        stroke={shade(color, 0.35)}
                        strokeWidth="1.4"
                    />
                </g>
            );
        case 21: // хвилясте довге — чубчик набік
            return (
                <g>
                    <path d={cap(55, 26, 56, 106, -14)} fill={fill} />
                    {sheen('M74 40 Q88 30 104 30', color)}
                </g>
            );
        case 22: // кучеряве довге — лінія лоба
            return <path d={cap(53, 34, 56, 100)} fill={fill} />;
        case 23: // неохайна гулька
            return (
                <g>
                    <path d={cap(52, 30, 54, 92)} fill={fill} />
                    <circle cx="100" cy="22" r="14" fill={fill} />
                    {strands('M90 14 Q86 6 92 2 M110 14 Q116 6 112 2', color)}
                    <path
                        d="M56 86 Q52 100 58 112 M144 86 Q148 100 142 112"
                        stroke={fill}
                        strokeWidth="2.4"
                        fill="none"
                        strokeLinecap="round"
                    />
                </g>
            );
        case 24: // дві гульки
            return (
                <g fill={fill}>
                    <circle cx="66" cy="30" r="13" />
                    <circle cx="134" cy="30" r="13" />
                    <path d={cap(52, 30, 54, 92)} />
                    <path
                        d="M100 31 L100 52"
                        stroke={shade(color, 0.35)}
                        strokeWidth="1.4"
                    />
                </g>
            );
        case 25: // хвостики — проділ і резинки
            return (
                <g>
                    <path d={cap(53, 28, 54, 96)} fill={fill} />
                    <path
                        d="M100 29 L100 52"
                        stroke={shade(color, 0.35)}
                        strokeWidth="1.4"
                    />
                    <circle cx="54" cy="94" r="4" fill="#e2475b" />
                    <circle cx="146" cy="94" r="4" fill="#e2475b" />
                </g>
            );
        case 26: // напівзібране: верх у маленький пучок
            return (
                <g>
                    <path d={cap(54, 28, 54, 104)} fill={fill} />
                    <circle cx="100" cy="24" r="9" fill={fill} />
                    {sheen('M74 42 Q90 32 108 32', color)}
                </g>
            );
        case 27: // набік: пасмо закриває частину лоба
            return (
                <g>
                    <path d={cap(55, 26, 56, 106, 18)} fill={fill} />
                    <path
                        d="M124 30 C100 40 76 56 56 96 C58 70 70 46 96 34 Z"
                        fill={fill}
                    />
                    {sheen('M90 34 Q108 26 126 32', color)}
                </g>
            );
        case 28: // подовжене каре — проділ набік
            return (
                <g>
                    <path d={cap(55, 27, 56, 108, 12)} fill={fill} />
                    {sheen('M76 42 Q92 30 110 30', color)}
                </g>
            );
        case 29: // шторки: чубчик, розділений посередині
            return (
                <g>
                    <path d={cap(54, 26, 56, 106)} fill={fill} />
                    <path
                        d="M100 52 C92 58 80 64 62 86 C66 70 80 56 100 48 Z M100 52 C108 58 120 64 138 86 C134 70 120 56 100 48 Z"
                        fill={fill}
                    />
                </g>
            );
        default: // без волосся
            return null;
    }
}

/* ---------- Очі й брови ---------- */

type EyeShape = { w: number; h: number; hood: boolean; lift: number };

/**
 * Стилі очей: 0 — універсальні (тонкий гострий мигдаль), 1 — чоловічі (важка пласка повіка),
 * 2 — жіночі (велика райдужка, вії-«прапорці»), 3 — жіночі круглі, 4 — котячі (зіниця-щілина).
 */
function eyeShape(kind: number): EyeShape {
    // Розріз вузький (висота ≈ ширина / 3–3,5), як на зразках; райдужка більша за розріз.
    switch (kind) {
        case 1:
            return { w: 16.5, h: 5.2, hood: false, lift: 0.85 }; // чоловічі
        case 2:
            return { w: 15.5, h: 7.2, hood: false, lift: 1.15 }; // жіночі
        case 3:
            return { w: 14.5, h: 8.6, hood: false, lift: 1.05 }; // круглі
        case 4:
            return { w: 16, h: 6.2, hood: false, lift: 1.3 }; // котячі
        default:
            return { w: 17, h: 5, hood: false, lift: 1.1 }; // універсальні
    }
}

/** Відстань від центру обличчя до центру ока. */
function eyeGap(kind: number): number {
    return [14.5, 16.3, 18, 19.8, 21.6][kind] ?? EYE_DX;
}

/**
 * Око в стилі ілюстрації: густа лінія верхніх вій з «хвостиком» назовні, складка повіки,
 * висока райдужка (темніша вгорі, світліша внизу), великий відблиск, тонка нижня повіка біля зовнішнього кута.
 * Усе будується в локальних координатах ока: u — від внутрішнього кута (−) до зовнішнього (+).
 */
function Eyes({
    config,
    skin,
    iris,
    uid,
}: {
    config: CharacterConfig;
    skin: string;
    iris: string;
    uid: string;
}) {
    const base = eyeShape(config.eyes);
    const k = ([0.8, 0.9, 1, 1.12, 1.25][config.eyeSize] ?? 1) * 1.12;
    const s = { ...base, w: base.w * k, h: base.h * k };
    const style = config.eyes;
    const universal = style === 0;
    const male = style === 1;
    const anime = style >= 2;
    const dx = eyeGap(config.eyeGap);
    const tilt = config.eyeTilt === 1 ? 9 : config.eyeTilt === 2 ? -7 : 0;
    const liner = config.makeup === 2 || config.makeup === 4;
    const shadow = config.makeup === 3 || config.makeup === 4;
    const irisColor = EYE[config.eyeColor] ?? EYE[0];

    return (
        <g className="character-eyes">
            {[-1, 1].map((side) => {
                const cx = 100 + side * dx;
                const cy = EYE_Y;
                // Стилі 2–7 — аніме-очі (окремий компонент на кривих Безьє).
                if (style >= 2) {
                    const angle = side === -1 ? tilt : -tilt;

                    return (
                        <g
                            key={side}
                            transform={`rotate(${angle} ${cx} ${cy})`}
                        >
                            <AnimeEye
                                variant={style - 2}
                                side={side as -1 | 1}
                                cx={cx}
                                cy={cy}
                                hw={10.4 * k}
                                uid={uid}
                                lashes={config.lashes}
                            />
                        </g>
                    );
                }
                const hw = s.w / 2;
                const h = s.h;
                // Локальна точка → SVG: зовнішній кут завжди назовні від центру обличчя.
                const P = (u: number, v: number) =>
                    `${(cx + side * u).toFixed(2)} ${(cy + v).toFixed(2)}`;
                // Чоловіче й універсальне — пласкіші, з гострими кутами.
                const inner = P(-hw, male ? 1.4 : universal ? 0.6 : 0.8);
                const outer = P(hw, male ? -1.2 : universal ? -1 : -0.4);
                const topC1 = male
                    ? P(-hw * 0.5, -h * 0.82)
                    : P(-hw * 0.45, -h * s.lift);
                const topC2 = male
                    ? P(hw * 0.45, -h * 0.9)
                    : P(hw * 0.5, -h * 0.98);
                // Універсальні: верх рівний (легкий підйом до зовнішнього кута), низ — півдуга.
                const eye = universal
                    ? `M${P(-hw, -h * 0.2)} L${P(hw, -h * 0.55)} C${P(hw * 0.7, h * 1.05)} ${P(-hw * 0.55, h * 1.1)} ${P(-hw, -h * 0.2)} Z`
                    : male
                      ? `M${inner} C${topC1} ${topC2} ${outer} C${P(hw * 0.55, h * 0.48)} ${P(-hw * 0.4, h * 0.62)} ${inner} Z`
                      : `M${inner} C${topC1} ${topC2} ${outer} C${P(hw * 0.45, h * 0.72)} ${P(-hw * 0.5, h * 0.78)} ${inner} Z`;
                const clip = `eye${side}${uid}`;
                // Райдужка більша за розріз — повіки зрізають її згори й знизу.
                const ir = universal
                    ? h * 0.98
                    : Math.min(h * (anime ? 0.78 : 0.72), hw * 0.48);
                const irisY = universal ? h * 0.3 : 0.8;
                const iry = anime ? ir * 1.12 : ir;
                // Аніме-очі — густа лінія вій із «хвостиком», чоловічі — рівна, універсальні — тонка.
                const t = liner ? 3.4 : anime ? 2.6 : universal ? 1.3 : 1.6;
                const wing = liner ? 6 : anime ? 2.6 : universal ? 4.5 : 1;
                const angle = side === -1 ? tilt : -tilt;
                // Густа лінія вій: верхня крива, «хвостик», назад вище кривої.
                const lash = universal
                    ? // Тонка лінія, що виходить гострим кінчиком за зовнішній кут.
                      `M${P(-hw - 0.6, -h * 0.2 + 0.5)} L${P(hw + 2.2, -h * 0.55 - 0.1)} L${P(hw + 0.6, -h * 0.55 - t - 0.5)} L${P(-hw + 0.6, -h * 0.2 - t * 0.7)} Z`
                    : male
                      ? // Рівна товста лінія з гачком донизу на зовнішньому куті.
                        `M${inner} C${topC1} ${topC2} ${outer} L${P(hw + 1.6, 2.2)} L${P(hw + 2.4, -1.4)} L${P(hw - 0.4, -h * 0.25 - t)} C${P(hw * 0.45, -h * 0.9 - t)} ${P(-hw * 0.5, -h * 0.82 - t * 0.7)} ${P(-hw - 0.3, 0.6)} Z`
                      : `M${P(-hw + 0.4, 0.4)} C${topC1} ${topC2} ${outer} L${P(hw + wing, -h * 0.6 - 2.2)} L${P(hw - 1.2, -h * 0.32 - t * 0.6)} C${P(hw * 0.5, -h * 0.98 - t)} ${P(-hw * 0.45, -h * s.lift - t * 0.7)} ${P(-hw - 0.4, -0.6)} Z`;

                return (
                    <g key={side} transform={`rotate(${angle} ${cx} ${cy})`}>
                        {shadow && (
                            <ellipse
                                cx={cx + side * 1.5}
                                cy={cy - h * 0.75}
                                rx={hw + 3.5}
                                ry={h * 0.7 + 2.5}
                                fill="#8a5aa8"
                                opacity="0.35"
                            />
                        )}
                        {/* Складка повіки — лише в аніме-очей */}
                        {anime && (
                            <path
                                d={`M${P(-hw * 0.5, -h * (s.hood ? 0.9 : 1.05) - 1.8)} Q${P(hw * 0.1, -h * (s.hood ? 1.1 : 1.22) - 2.2)} ${P(hw * 0.85, -h * 0.72 - 1.8)}`}
                                stroke={shade(skin, 0.3)}
                                strokeWidth="0.9"
                                fill="none"
                                strokeLinecap="round"
                                opacity="0.32"
                            />
                        )}
                        <clipPath id={clip}>
                            <path d={eye} />
                        </clipPath>
                        <path d={eye} fill="#fbfbfe" />
                        <g clipPath={`url(#${clip})`}>
                            <ellipse
                                cx={cx + side * 0.6}
                                cy={cy + irisY}
                                rx={ir}
                                ry={iry}
                                fill={iris}
                            />
                            <ellipse
                                cx={cx + side * 0.6}
                                cy={cy + irisY}
                                rx={ir}
                                ry={iry}
                                fill="none"
                                stroke={shade(irisColor, 0.55)}
                                strokeWidth="0.7"
                            />
                            <ellipse
                                cx={cx + side * 0.6}
                                cy={cy + irisY + 0.2}
                                rx={style === 4 ? ir * 0.16 : ir * 0.4}
                                ry={style === 4 ? iry * 0.78 : iry * 0.5}
                                fill={INK}
                            />
                            {/* Тінь від верхньої повіки */}
                            <path
                                d={`M${P(-hw - 1, -h * 1.4)} L${P(hw + 1, -h * 1.4)} L${P(hw + 1, -h * 0.25)} Q${P(0, -h * 0.35)} ${P(-hw - 1, -h * 0.05)} Z`}
                                fill={INK}
                                opacity={anime ? 0.16 : 0.24}
                            />
                            {s.hood && (
                                <path
                                    d={`M${P(-hw - 1, -h * 1.4)} L${P(hw + 1, -h * 1.4)} L${P(hw + 1, -h * 0.15)} Q${P(0, -h * 0.55)} ${P(-hw - 1, -h * 0.1)} Z`}
                                    fill={skin}
                                />
                            )}
                            {/* Відблиски */}
                            <ellipse
                                cx={cx - side * ir * 0.25}
                                cy={cy - iry * 0.32}
                                rx={ir * 0.36}
                                ry={ir * 0.3}
                                fill="#fff"
                            />
                            <circle
                                cx={cx + side * ir * 0.42}
                                cy={cy + iry * 0.42}
                                r={ir * 0.14}
                                fill="#fff"
                                opacity="0.85"
                            />
                        </g>
                        <path d={lash} fill={INK} />
                        {/* Нижня повіка — коротка лінія біля зовнішнього кута */}
                        <path
                            d={
                                universal
                                    ? `M${P(-hw * 0.4, h * 0.82)} C${P(hw * 0.2, h * 0.95)} ${P(hw * 0.75, h * 0.6)} ${P(hw, -h * 0.55)}`
                                    : male
                                      ? `M${P(-hw * 0.4, h * 0.42)} Q${P(hw * 0.25, h * 0.5)} ${P(hw * 0.85, 0.1)}`
                                      : `M${P(hw * 0.05, h * 0.62)} Q${P(hw * 0.6, h * 0.55)} ${P(hw * 0.95, h * 0.05)}`
                            }
                            stroke={INK}
                            strokeWidth="0.9"
                            fill="none"
                            strokeLinecap="round"
                            opacity="0.7"
                        />
                        {!universal &&
                            (config.lashes > 0 || anime) &&
                            (config.lashes > 0
                                ? [0.35, 0.65, 0.92]
                                : [0.7, 0.95]
                            ).map((at, i) => {
                                const len =
                                    (config.lashes === 2
                                        ? 4.6
                                        : config.lashes === 1
                                          ? 3
                                          : 2.2) +
                                    i * 0.6;
                                const u = hw * at;
                                const v = -h * (0.95 - at * 0.55) - t * 0.6;

                                return (
                                    <path
                                        key={at}
                                        d={`M${P(u, v)} Q${P(u + len * 0.4, v - len * 0.7)} ${P(u + len, v - len * 0.6)}`}
                                        stroke={INK}
                                        strokeWidth="1.1"
                                        fill="none"
                                        strokeLinecap="round"
                                    />
                                );
                            })}
                    </g>
                );
            })}
        </g>
    );
}

/** Брова — заповнена форма: товща біля перенісся, тонша на кінці. */
function brow(
    side: -1 | 1,
    arch: number,
    thick: number,
    lift: number,
    color: string,
    shift: number,
    male = false,
): ReactNode {
    // Брови йдуть за посадкою очей.
    const inner = 100 + side * (8 + shift);
    const outer = 100 + side * (29 + shift);
    const mid = 100 + side * (19 + shift);
    // Чоловічі брови — нижче, прямі й густіші.
    const y = male ? 85.5 : 82;
    const yIn = y + lift;
    const yOut = y + 1.5 - lift * 0.4;

    return (
        <path
            key={side}
            d={`M${inner} ${yIn} Q${mid} ${y - arch} ${outer} ${yOut} Q${mid} ${y - arch - thick * 0.6} ${inner} ${yIn - thick} Z`}
            fill={color}
        />
    );
}

function brows(
    kind: number,
    color: string,
    shift = 0,
    male = false,
): ReactNode {
    const set = (arch: number, thick: number, lift: number) => (
        <g>
            {brow(
                -1,
                male ? arch * 0.45 : arch,
                male ? thick * 1.45 : thick,
                lift,
                color,
                shift,
                male,
            )}
            {brow(
                1,
                male ? arch * 0.45 : arch,
                male ? thick * 1.45 : thick,
                lift,
                color,
                shift,
                male,
            )}
        </g>
    );

    switch (kind) {
        case 1:
            return set(6, 3.4, 0); // з вигином
        case 2:
            return set(2, 5.5, 0); // густі
        case 3:
            return set(1, 3.6, 4); // насуплені
        case 4:
            return set(8, 2.4, -1); // тонкі високі
        default:
            return set(2, 3.2, 0); // рівні
    }
}

/* ---------- Ніс ---------- */

function nose(kind: number, skin: string): ReactNode {
    const shadow = shade(skin, 0.22);
    const light = shade(skin, -0.25);

    switch (kind) {
        case 1: // кирпатий
            return (
                <g>
                    <ellipse
                        cx="100"
                        cy="112"
                        rx="5.5"
                        ry="4"
                        fill={shadow}
                        opacity="0.55"
                    />
                    <circle
                        cx="98.5"
                        cy="110.5"
                        r="1.6"
                        fill={light}
                        opacity="0.7"
                    />
                </g>
            );
        case 2: // прямий довгий
            return (
                <g>
                    <path
                        d="M97 96 C98 104 99 108 96 113 C98 116 103 116 105 113"
                        stroke={shadow}
                        strokeWidth="1.8"
                        fill="none"
                        strokeLinecap="round"
                    />
                    <path
                        d="M101 98 L102 110"
                        stroke={light}
                        strokeWidth="1.6"
                        opacity="0.6"
                        strokeLinecap="round"
                    />
                </g>
            );
        case 3: // широкий
            return (
                <g fill={shadow}>
                    <path
                        d="M92 113 C94 108 106 108 108 113 C104 117 96 117 92 113 Z"
                        opacity="0.5"
                    />
                    <ellipse cx="95.5" cy="113" rx="1.8" ry="1.3" />
                    <ellipse cx="104.5" cy="113" rx="1.8" ry="1.3" />
                </g>
            );
        default: // маленький
            return (
                <g>
                    <path
                        d="M95 112 Q100 116 105 112"
                        stroke={shadow}
                        strokeWidth="1.8"
                        fill="none"
                        strokeLinecap="round"
                    />
                    <path
                        d="M100 100 Q101 106 100 109"
                        stroke={light}
                        strokeWidth="1.6"
                        opacity="0.6"
                        strokeLinecap="round"
                        fill="none"
                    />
                </g>
            );
    }
}

/* ---------- Губи й вираз ---------- */

type LipShape = { w: number; up: number; low: number; bow: number };

function lipShape(kind: number): LipShape {
    switch (kind) {
        case 1:
            return { w: 19, up: 4.2, low: 6, bow: 1.6 }; // повні
        case 2:
            return { w: 15, up: 4.4, low: 4.6, bow: 2.6 }; // «сердечко»
        case 3:
            return { w: 23, up: 3, low: 4, bow: 1 }; // широкі
        case 4:
            return { w: 12, up: 2.8, low: 3.6, bow: 1.2 }; // маленькі
        default:
            return { w: 17, up: 2.4, low: 3.2, bow: 1 }; // тонкі
    }
}

function Lips({
    config,
    color,
    upperRef,
    lowerRef,
    insideRef,
    stillRef,
}: {
    config: CharacterConfig;
    color: string;
    upperRef: React.RefObject<SVGGElement | null>;
    lowerRef: React.RefObject<SVGGElement | null>;
    insideRef: React.RefObject<SVGEllipseElement | null>;
    stillRef: React.RefObject<SVGGElement | null>;
}) {
    const base = lipShape(config.lips);
    // Ширина губ — як на схемі пропорцій (≈ відстань між зіницями).
    const male = config.sex !== 1;
    // Чоловічі губи — ширші й тонші (за схемою пропорцій).
    const s = {
        ...base,
        w: base.w * (male ? 1.5 : 1.3),
        up: base.up * (male ? 0.75 : 1),
        low: base.low * (male ? 0.85 : 1),
    };
    const y = MOUTH_Y;
    const hw = s.w / 2;
    // Вираз: куточки губ угору (усмішка), рівно, однобічно (ухмилка).
    const expr = config.mouth;
    const liftL = expr === 0 || expr === 2 ? 2.6 : expr === 3 ? 0 : 0;
    const liftR = expr === 0 || expr === 2 ? 2.6 : expr === 3 ? 3.2 : 0;
    const lx = 100 - hw;
    const rx = 100 + hw;
    const ly = y - liftL;
    const ry = y - liftR;
    const seam = expr === 0 || expr === 2 ? y + 1.6 : y;
    const upper = `M${lx} ${ly} C${lx + hw * 0.35} ${y - s.up} ${100 - 3} ${y - s.up - 0.5} 100 ${y - s.up + s.bow} C${100 + 3} ${y - s.up - 0.5} ${rx - hw * 0.35} ${y - s.up} ${rx} ${ry} Q100 ${seam + 0.6} ${lx} ${ly} Z`;
    const lower = `M${lx} ${ly} Q100 ${seam + 0.6} ${rx} ${ry} C${rx - hw * 0.25} ${y + s.low} ${lx + hw * 0.25} ${y + s.low} ${lx} ${ly} Z`;
    const dark = shade(color, 0.3);

    return (
        <g>
            <ellipse
                ref={insideRef}
                cx="100"
                cy={y}
                rx="7"
                ry="1"
                fill="#3a1820"
                style={{ opacity: 0 }}
            />
            <g ref={stillRef}>
                {expr === 2 && (
                    // Широка усмішка — видно зуби
                    <g>
                        <path
                            d={`M${lx + 1} ${ly + 0.5} Q100 ${y + 9} ${rx - 1} ${ry + 0.5} Z`}
                            fill="#3a1820"
                        />
                        <path
                            d={`M${lx + 2.5} ${ly + 0.8} Q100 ${y + 3.8} ${rx - 2.5} ${ry + 0.8} L${rx - 4} ${ry + 2.6} Q100 ${y + 5.4} ${lx + 4} ${ly + 2.6} Z`}
                            fill="#fff"
                        />
                    </g>
                )}
                {expr === 4 && (
                    <ellipse
                        cx="100"
                        cy={y + 1.5}
                        rx="4"
                        ry="4.6"
                        fill="#3a1820"
                    />
                )}
            </g>
            <g ref={upperRef}>
                <path d={upper} fill={dark} />
            </g>
            <g ref={lowerRef}>
                <path
                    d={
                        expr === 2
                            ? `M${lx} ${ly} Q100 ${y + 9.5} ${rx} ${ry} C${rx - hw * 0.25} ${y + s.low + 5} ${lx + hw * 0.25} ${y + s.low + 5} ${lx} ${ly} Z`
                            : lower
                    }
                    fill={color}
                />
                <ellipse
                    cx="101.5"
                    cy={y + s.low * 0.45 + (expr === 2 ? 5 : 0)}
                    rx={hw * 0.35}
                    ry="0.9"
                    fill="#fff"
                    opacity="0.35"
                />
            </g>
            <path
                d={`M${lx} ${ly} Q100 ${seam + 0.6} ${rx} ${ry}`}
                stroke={shade(color, 0.5)}
                strokeWidth="0.9"
                fill="none"
                strokeLinecap="round"
            />
        </g>
    );
}

/* ---------- Тату ---------- */

const TATTOO = '#26304a';

/** Тату на шиї й ключиці (під одягом не видно лише там, де він закриває). */
function tattooNeck(kind: number): ReactNode {
    switch (kind) {
        case 1: // зірка на шиї
            return (
                <path
                    d="M110 136 L112 141 L117 141 L113 144 L114.5 149 L110 146 L105.5 149 L107 144 L103 141 L108 141 Z"
                    fill="none"
                    stroke={TATTOO}
                    strokeWidth="1.7"
                    opacity="0.9"
                />
            );
        case 2: // племінне — гострі хвилі вздовж шиї
            return (
                <path
                    d="M88 128 C92 134 86 138 91 144 C95 149 88 152 92 158 L95 158 C92 152 99 148 95 143 C91 138 97 133 92 127 Z M108 130 L112 136 L109 142 L114 148 L111 156 L114 156 L117 148 L112 142 L115 136 L111 129 Z"
                    fill={TATTOO}
                    opacity="0.9"
                />
            );
        case 3: // напис на ключиці
            return (
                <path
                    d="M80 160 c3 -4 5 2 8 -1 s4 -3 6 0 s5 2 7 -2 s4 0 6 1 s5 -3 8 0"
                    fill="none"
                    stroke={TATTOO}
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    opacity="0.9"
                />
            );
        case 4: // троянда на шиї
            return (
                <g fill="none" stroke={TATTOO} strokeWidth="1.6" opacity="0.9">
                    <circle cx="90" cy="142" r="5" />
                    <path d="M90 138 Q93 142 90 145 Q87 142 90 138" />
                    <path d="M86 147 Q82 152 85 157 M94 147 Q99 150 97 156" />
                </g>
            );
        default:
            return null;
    }
}

/** Тату на обличчі: сльоза під оком і дві лінії на вилиці. */
function tattooFace(kind: number): ReactNode {
    if (kind !== 5) return null;

    return (
        <g fill={TATTOO} opacity="0.9">
            <path d="M118 108 C116 111 116 113 118 114 C120 113 120 111 118 108 Z" />
            <path
                d="M68 104 L74 102 M67 108 L74 106"
                stroke={TATTOO}
                strokeWidth="1.4"
                strokeLinecap="round"
            />
        </g>
    );
}

/* ---------- Макіяж, борода, аксесуари ---------- */

function makeupUnder(kind: number, skin: string): ReactNode {
    if (kind === 1)
        return (
            <g fill="#f0607a" opacity="0.28">
                <ellipse cx="74" cy="114" rx="9" ry="5.5" />
                <ellipse cx="126" cy="114" rx="9" ry="5.5" />
            </g>
        );
    if (kind === 5)
        return (
            <g fill={shade(skin, 0.38)} opacity="0.75">
                {[
                    [86, 110],
                    [90, 114],
                    [83, 115],
                    [114, 110],
                    [110, 114],
                    [117, 115],
                    [96, 106],
                    [104, 106],
                ].map(([x, y]) => (
                    <circle key={`${x}-${y}`} cx={x} cy={y} r="0.95" />
                ))}
            </g>
        );

    return null;
}

function beard(kind: number, fill: string): ReactNode {
    switch (kind) {
        case 1: // щетина
            return (
                <path
                    d="M58 106 C60 146 80 152 100 152 C120 152 140 146 142 106 C134 132 118 142 100 142 C82 142 66 132 58 106 Z"
                    fill={fill}
                    opacity="0.26"
                />
            );
        case 2: // борода
            return (
                <path
                    d="M55 100 C55 154 80 164 100 164 C120 164 145 154 145 100 C138 128 124 140 100 140 C76 140 62 128 55 100 Z"
                    fill={fill}
                />
            );
        case 4: // цапина
            return <ellipse cx="100" cy="145" rx="10" ry="8" fill={fill} />;
        default:
            return null;
    }
}

function mustache(fill: string): ReactNode {
    return (
        <path
            d="M84 122 C92 115 98 117 100 120 C102 117 108 115 116 122 C108 126 102 124 100 123 C98 124 92 126 84 122 Z"
            fill={fill}
        />
    );
}

function extra(kind: number): ReactNode {
    switch (kind) {
        case 1: // круглі окуляри
            return (
                <g stroke={INK} strokeWidth="2.2" fill="rgb(255 255 255 / 0.1)">
                    <circle cx="82" cy="98" r="11.5" />
                    <circle cx="118" cy="98" r="11.5" />
                    <path d="M93.5 97 Q100 94 106.5 97" fill="none" />
                </g>
            );
        case 2: // квадратні окуляри
            return (
                <g stroke={INK} strokeWidth="2.2" fill="rgb(255 255 255 / 0.1)">
                    <rect x="69" y="88" width="26" height="19" rx="5" />
                    <rect x="105" y="88" width="26" height="19" rx="5" />
                    <path d="M95 96 L105 96" fill="none" />
                </g>
            );
        case 3: // темні окуляри
            return (
                <g>
                    <path
                        d="M67 90 L96 90 L94 104 C92 110 74 110 70 104 Z M104 90 L133 90 L130 104 C126 110 108 110 106 104 Z"
                        fill={INK}
                    />
                    <path d="M96 93 L104 93" stroke={INK} strokeWidth="3" />
                    <path
                        d="M73 94 L81 94 M109 94 L117 94"
                        stroke="#fff"
                        strokeOpacity="0.35"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                </g>
            );
        case 4: // навушники
            return (
                <g>
                    <path
                        d="M50 100 C46 40 154 40 150 100"
                        stroke={INK}
                        strokeWidth="7"
                        fill="none"
                        strokeLinecap="round"
                    />
                    <rect
                        x="41"
                        y="88"
                        width="16"
                        height="28"
                        rx="7"
                        fill={INK}
                    />
                    <rect
                        x="143"
                        y="88"
                        width="16"
                        height="28"
                        rx="7"
                        fill={INK}
                    />
                    <rect
                        x="45"
                        y="94"
                        width="6"
                        height="16"
                        rx="3"
                        fill="#4f6bff"
                    />
                    <rect
                        x="149"
                        y="94"
                        width="6"
                        height="16"
                        rx="3"
                        fill="#4f6bff"
                    />
                </g>
            );
        case 5: // кепка
            return (
                <g>
                    <path
                        d="M52 78 C52 42 76 30 100 30 C124 30 148 42 148 78 Z"
                        fill="#e2475b"
                    />
                    <path
                        d="M48 78 L152 78 C152 84 150 86 146 86 L54 86 C50 86 48 84 48 78 Z"
                        fill={shade('#e2475b', 0.25)}
                    />
                    <circle
                        cx="100"
                        cy="32"
                        r="4"
                        fill={shade('#e2475b', 0.25)}
                    />
                </g>
            );
        case 6: // шапка-біні
            return (
                <g>
                    <path
                        d="M54 76 C54 38 78 26 100 26 C122 26 146 38 146 76 Z"
                        fill="#2bb673"
                    />
                    <rect
                        x="50"
                        y="68"
                        width="100"
                        height="16"
                        rx="7"
                        fill={shade('#2bb673', 0.25)}
                    />
                </g>
            );
        default:
            return null;
    }
}
