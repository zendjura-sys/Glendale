import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { BG, EYE, HAIR, LIP, mix, OUTFIT, shade, SKIN } from '@/lib/character';
import type { CharacterConfig, VoiceReading } from '@/lib/character';
import { cn } from '@/lib/utils';

const INK = '#211a1d';

/** Центри очей і рота (SVG 200×200). */
const EYE_Y = 98;
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
                    <rect
                        x={100 - neckWidth(config.build) / 2}
                        y="124"
                        width={neckWidth(config.build)}
                        height="38"
                        rx="10"
                        fill={url('neck')}
                    />
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
                    <Ears skin={skin} />
                    {earrings(config.earrings)}
                    {headShape(config.head, url('skin'))}
                    {/* Тінь під волоссям на лобі — обличчя не виглядає пласким. */}
                    {config.hair !== 0 && (
                        <ellipse
                            cx="100"
                            cy="58"
                            rx="40"
                            ry="12"
                            fill={shade(skin, 0.2)}
                            opacity="0.35"
                        />
                    )}
                    {makeupUnder(config.makeup, skin)}
                    {tattooFace(config.tattoo)}
                    {beard(config.beard, url('hair'))}
                    <Eyes
                        config={config}
                        skin={skin}
                        iris={url('iris')}
                        uid={uid}
                    />
                    {brows(config.brows, shade(hair, 0.1))}
                    {nose(config.nose, skin)}
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
                    {extra(config.extra)}
                </g>
            </g>
        </svg>
    );
}

function neckWidth(build: number): number {
    return [20, 24, 30, 27][build] ?? 24;
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

function headShape(kind: number, fill: string): ReactNode {
    switch (kind) {
        case 1: // кругле
            return <circle cx="100" cy="96" r="49" fill={fill} />;
        case 2: // квадратне підборіддя
            return (
                <path
                    d="M54 74 C54 48 74 42 100 42 C126 42 146 48 146 74 L146 112 C146 136 126 148 100 148 C74 148 54 136 54 112 Z"
                    fill={fill}
                />
            );
        case 3: // видовжене
            return <ellipse cx="100" cy="95" rx="43" ry="57" fill={fill} />;
        case 4: // «сердечко»: широкі вилиці, гостре підборіддя
            return (
                <path
                    d="M52 88 C52 58 72 42 100 42 C128 42 148 58 148 88 C148 118 124 146 100 150 C76 146 52 118 52 88 Z"
                    fill={fill}
                />
            );
        default: // овальне
            return (
                <path
                    d="M53 92 C53 60 74 42 100 42 C126 42 147 60 147 92 C147 126 126 150 100 150 C74 150 53 126 53 92 Z"
                    fill={fill}
                />
            );
    }
}

function Ears({ skin }: { skin: string }) {
    const base = shade(skin, 0.06);
    const inner = shade(skin, 0.22);

    return (
        <g>
            <ellipse cx="54" cy="101" rx="8" ry="11" fill={base} />
            <ellipse cx="146" cy="101" rx="8" ry="11" fill={base} />
            <path
                d="M56 95 C51 98 52 106 56 108"
                stroke={inner}
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
            />
            <path
                d="M144 95 C149 98 148 106 144 108"
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
                <circle cx="53" cy="111" r="2.4" />
                <circle cx="147" cy="111" r="2.4" />
            </g>
        );
    if (kind === 2)
        return (
            <g stroke="#f5c542" strokeWidth="1.8" fill="none">
                <circle cx="53" cy="116" r="5" />
                <circle cx="147" cy="116" r="5" />
            </g>
        );

    return null;
}

/* ---------- Волосся ---------- */

function hairBack(kind: number, fill: string): ReactNode {
    switch (kind) {
        case 4: // довге
            return (
                <path
                    d="M48 94 C42 46 72 30 100 30 C128 30 158 46 152 94 L158 172 C142 180 124 168 120 152 L80 152 C76 168 58 180 42 172 Z"
                    fill={fill}
                />
            );
        case 8: // хвіст
            return (
                <path
                    d="M136 60 C166 64 174 102 162 140 C158 154 146 160 140 152 C152 128 152 96 134 80 Z"
                    fill={fill}
                />
            );
        case 9: // афро
            return <circle cx="100" cy="78" r="66" fill={fill} />;
        case 10: // хвиляста каре
            return (
                <path
                    d="M48 96 C42 48 72 32 100 32 C128 32 158 48 152 96 C156 112 150 128 140 134 C134 124 130 118 128 112 L72 112 C70 118 66 124 60 134 C50 128 44 112 48 96 Z"
                    fill={fill}
                />
            );
        case 11: // дві коси
            return (
                <g fill={fill}>
                    {[52, 148].map((x) => (
                        <g key={x}>
                            {[0, 1, 2, 3].map((i) => (
                                <ellipse
                                    key={i}
                                    cx={x}
                                    cy={128 + i * 13}
                                    rx="9"
                                    ry="8"
                                />
                            ))}
                        </g>
                    ))}
                </g>
            );
        default:
            return null;
    }
}

/** Відблиск на волоссі — тонка світла дуга. */
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

function hairFront(kind: number, fill: string, color: string): ReactNode {
    switch (kind) {
        case 1: // коротке
            return (
                <g>
                    <path
                        d="M52 92 C48 50 74 34 100 34 C128 34 152 50 148 92 C140 70 122 58 100 60 C80 58 62 68 52 92 Z"
                        fill={fill}
                    />
                    {sheen('M74 46 Q90 38 108 40', color)}
                </g>
            );
        case 2: // їжак
            return (
                <path
                    d="M56 82 C58 50 80 38 100 38 C122 38 142 50 144 82 C130 64 116 58 100 58 C84 58 70 64 56 82 Z"
                    fill={fill}
                    opacity="0.9"
                />
            );
        case 3: // кучері
            return (
                <g fill={fill}>
                    {[
                        [58, 74, 13],
                        [70, 55, 14],
                        [88, 45, 15],
                        [108, 43, 15],
                        [126, 51, 14],
                        [140, 67, 13],
                        [147, 86, 10],
                        [53, 90, 10],
                    ].map(([x, y, r]) => (
                        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
                    ))}
                </g>
            );
        case 4: // довге — чубчик набік
            return (
                <g>
                    <path
                        d="M52 92 C52 52 76 36 100 36 C124 36 148 52 148 92 C140 68 120 56 100 58 C86 68 66 78 52 92 Z"
                        fill={fill}
                    />
                    {sheen('M70 52 Q86 40 106 42', color)}
                </g>
            );
        case 5: // гулька
            return (
                <g fill={fill}>
                    <circle cx="100" cy="30" r="16" />
                    <path d="M54 88 C52 52 76 38 100 38 C124 38 148 52 146 88 C134 66 118 60 100 60 C82 60 66 66 54 88 Z" />
                </g>
            );
        case 6: // ірокез
            return (
                <path
                    d="M88 70 C86 42 94 24 100 18 C106 24 114 42 112 70 C108 62 92 62 88 70 Z"
                    fill={fill}
                />
            );
        case 7: // проділ набік
            return (
                <g>
                    <path
                        d="M50 98 C46 52 72 32 102 32 C132 32 154 52 150 98 C146 76 136 64 120 58 C110 70 80 72 62 66 C56 74 52 86 50 98 Z"
                        fill={fill}
                    />
                    {sheen('M80 42 Q100 34 124 40', color)}
                </g>
            );
        case 8: // хвіст — передня частина
            return (
                <g>
                    <path
                        d="M52 90 C50 52 74 36 100 36 C126 36 150 52 148 90 C138 66 118 58 100 60 C82 58 64 66 52 90 Z"
                        fill={fill}
                    />
                    {sheen('M74 46 Q92 38 112 42', color)}
                </g>
            );
        case 9: // афро — лінія лоба
            return (
                <path
                    d="M56 82 C62 56 80 46 100 46 C120 46 138 56 144 82 C128 66 116 62 100 62 C84 62 72 66 56 82 Z"
                    fill={fill}
                />
            );
        case 10: // каре — чубчик
            return (
                <g>
                    <path
                        d="M52 96 C50 54 74 36 100 36 C126 36 150 54 148 96 C142 78 132 68 118 64 C104 72 84 74 66 68 C58 76 54 86 52 96 Z"
                        fill={fill}
                    />
                    {sheen('M72 48 Q92 38 116 44', color)}
                </g>
            );
        case 11: // коси — проділ посередині
            return (
                <g>
                    <path
                        d="M52 96 C50 52 76 36 100 36 C124 36 150 52 148 96 C144 72 124 58 100 58 C76 58 56 72 52 96 Z"
                        fill={fill}
                    />
                    <path
                        d="M100 37 L100 58"
                        stroke={shade(color, 0.35)}
                        strokeWidth="1.5"
                    />
                </g>
            );
        case 12: // піксі
            return (
                <g>
                    <path
                        d="M54 86 C52 50 76 36 102 36 C130 36 150 52 146 84 C140 66 128 60 116 60 C104 70 82 76 62 76 C58 78 56 82 54 86 Z"
                        fill={fill}
                    />
                    {sheen('M84 42 Q102 36 122 42', color)}
                </g>
            );
        case 13: // пучок на маківці
            return (
                <g fill={fill}>
                    <ellipse cx="100" cy="34" rx="14" ry="10" />
                    <path d="M56 80 C58 50 80 40 100 40 C120 40 142 50 144 80 C130 64 116 60 100 60 C84 60 70 64 56 80 Z" />
                </g>
            );
        default: // лиса голова
            return null;
    }
}

/* ---------- Очі й брови ---------- */

type EyeShape = { w: number; h: number; hood: boolean };

function eyeShape(kind: number): EyeShape {
    switch (kind) {
        case 1:
            return { w: 12, h: 11, hood: false }; // круглі
        case 2:
            return { w: 13.5, h: 6, hood: false }; // вузькі
        case 3:
            return { w: 13, h: 8.5, hood: true }; // з нависанням повік
        case 4:
            return { w: 14.5, h: 12.5, hood: false }; // великі
        default:
            return { w: 13.5, h: 8.5, hood: false }; // мигдалеві
    }
}

function eyePath(x: number, y: number, s: EyeShape): string {
    const hw = s.w / 2;

    return `M${x - hw} ${y} C${x - hw * 0.55} ${y - s.h * 0.95} ${x + hw * 0.55} ${y - s.h * 0.95} ${x + hw} ${y} C${x + hw * 0.5} ${y + s.h * 0.7} ${x - hw * 0.5} ${y + s.h * 0.7} ${x - hw} ${y} Z`;
}

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
    const s = eyeShape(config.eyes);
    // Розріз: кут нахилу для лівого ока; праве — дзеркально.
    const tilt = config.eyeTilt === 1 ? 9 : config.eyeTilt === 2 ? -7 : 0;
    const liner = config.makeup === 2 || config.makeup === 4;
    const shadow = config.makeup === 3 || config.makeup === 4;

    return (
        <g className="character-eyes">
            {[-1, 1].map((side) => {
                const x = 100 + side * EYE_DX;
                const y = EYE_Y;
                const angle = side === -1 ? tilt : -tilt;
                const path = eyePath(x, y, s);
                const clip = `eye${side}${uid}`;
                const r = Math.min(s.h * 0.5 + 1.2, 5.6);
                const hw = s.w / 2;
                const outer = x + side * hw;

                return (
                    <g key={side} transform={`rotate(${angle} ${x} ${y})`}>
                        {shadow && (
                            <ellipse
                                cx={x}
                                cy={y - s.h * 0.6}
                                rx={hw + 3}
                                ry={s.h * 0.75 + 2}
                                fill="#8a5aa8"
                                opacity="0.38"
                            />
                        )}
                        <clipPath id={clip}>
                            <path d={path} />
                        </clipPath>
                        <path d={path} fill="#fbfbfd" />
                        <g clipPath={`url(#${clip})`}>
                            <circle cx={x} cy={y + 0.4} r={r} fill={iris} />
                            <circle
                                cx={x}
                                cy={y + 0.4}
                                r={r * 0.46}
                                fill={INK}
                            />
                            <circle
                                cx={x + r * 0.38}
                                cy={y - r * 0.38}
                                r={r * 0.28}
                                fill="#fff"
                            />
                            <circle
                                cx={x - r * 0.35}
                                cy={y + r * 0.42}
                                r={r * 0.13}
                                fill="#fff"
                                opacity="0.8"
                            />
                            {/* Тінь від верхньої повіки на білку */}
                            <path
                                d={`M${x - hw} ${y - s.h * 0.95} L${x + hw} ${y - s.h * 0.95} L${x + hw} ${y - s.h * 0.35} Q${x} ${y - s.h * 0.1} ${x - hw} ${y - s.h * 0.35} Z`}
                                fill={INK}
                                opacity="0.12"
                            />
                            {s.hood && (
                                <path
                                    d={`M${x - hw - 1} ${y - s.h} L${x + hw + 1} ${y - s.h} L${x + hw + 1} ${y - s.h * 0.2} Q${x} ${y - s.h * 0.45} ${x - hw - 1} ${y - s.h * 0.2} Z`}
                                    fill={skin}
                                />
                            )}
                        </g>
                        {/* Лінія верхніх вій */}
                        <path
                            d={`M${x - hw} ${y} C${x - hw * 0.55} ${y - s.h * 0.95} ${x + hw * 0.55} ${y - s.h * 0.95} ${x + hw} ${y}`}
                            stroke={INK}
                            strokeWidth={liner ? 2.6 : 1.7}
                            fill="none"
                            strokeLinecap="round"
                        />
                        {s.hood && (
                            <path
                                d={`M${x - hw} ${y - s.h * 0.55} Q${x} ${y - s.h * 1.25} ${x + hw} ${y - s.h * 0.55}`}
                                stroke={shade(skin, 0.25)}
                                strokeWidth="1.2"
                                fill="none"
                            />
                        )}
                        {/* Нижня повіка — ледь помітна */}
                        <path
                            d={`M${x - hw * 0.8} ${y + s.h * 0.42} Q${x} ${y + s.h * 0.78} ${x + hw * 0.8} ${y + s.h * 0.42}`}
                            stroke={shade(skin, 0.3)}
                            strokeWidth="1"
                            fill="none"
                            opacity="0.6"
                        />
                        {liner && (
                            <path
                                d={`M${outer} ${y} L${outer + side * 5} ${y - 3.5} L${outer - side * 1} ${y - 1.6} Z`}
                                fill={INK}
                            />
                        )}
                        {config.lashes > 0 &&
                            [0, 1, 2].map((i) => {
                                const t = 0.55 + i * 0.2;
                                const lx = x + side * hw * t;
                                const ly = y - s.h * 0.9 * (1 - t * t) - 0.4;
                                const len = config.lashes === 2 ? 4.2 : 2.6;

                                return (
                                    <path
                                        key={i}
                                        d={`M${lx} ${ly} l${side * len * 0.7} ${-len}`}
                                        stroke={INK}
                                        strokeWidth="1.2"
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
): ReactNode {
    const inner = 100 + side * 8;
    const outer = 100 + side * 29;
    const mid = 100 + side * 19;
    const y = 82;
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

function brows(kind: number, color: string): ReactNode {
    const set = (arch: number, thick: number, lift: number) => (
        <g>
            {brow(-1, arch, thick, lift, color)}
            {brow(1, arch, thick, lift, color)}
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
    const s = lipShape(config.lips);
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
