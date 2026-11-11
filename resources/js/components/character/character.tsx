import { useEffect, useId, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { CharacterConfig, VoiceReading } from '@/lib/character';
import { faceOffset, shade } from '@/lib/character';
import { cn } from '@/lib/utils';
import {
    ACCESSORIES,
    BG_COLORS,
    BROW_PRESETS,
    EARS_GEOMETRY,
    EYE_COLOR_PALETTES,
    EYE_SHAPES,
    FACIAL_HAIR_PRESETS,
    HAIR_COLORS,
    HAIR_PRESETS,
    HEAD_SHAPES,
    LIP_TINTS,
    MOUTH_PRESETS,
    NOSE_PRESETS,
    OUTFIT_COLORS,
    OUTFIT_PRESETS,
    PUPILS,
    SKIN_PALETTES,
} from './geometry';
import type { EyeColor, EyeShape, OutfitPreset, SkinPalette } from './geometry';

/** Ліве око на голові: центр рідної геометрії ока (95, 155) стає (114, 156). */
const EYE_LEFT = 'translate(42 37) scale(0.76)';
/** Праве — те саме ліве око дзеркально, центр (186, 156). */
const EYE_RIGHT = 'translate(258 37) scale(-0.76 0.76)';
/** Брови намальовані в просторі голови під старе око — переводимо в рідні координати ока й ставимо разом з ним. */
const BROW_TO_EYE = 'translate(95 155) scale(1.3889) translate(-92 -154)';
/** Ліве й праве око з ручним зсувом пари: dy — вгору/вниз, gap — ширше/вужче. */
const eyeLeft = (dy: number, gap: number) =>
    `translate(${-gap} ${dy}) ${EYE_LEFT}`;
const eyeRight = (dy: number, gap: number) =>
    `translate(${gap} ${dy}) ${EYE_RIGHT}`;
/** Волосся обгортає ширшу голову (64..236). */
const HAIR_FIT = 'translate(-15 -4) scale(1.1 1.03)';
/** Окуляри над новими очима (114 і 186). */
const GLASSES_FIT = 'translate(21 22) scale(0.86)';

/** Кадри: уся фігура, голова (картки вибору), обличчя (очі, брови, ніс, рот). */
const VIEWS = {
    full: '0 0 300 320',
    head: '30 26 240 240',
    face: '50 92 200 180',
    card: '20 15 260 265',
    body: '0 0 300 320',
} as const;

/**
 * Персонаж у стилі Stereo (SVG 300×320): пласкі шари кольору шкіри без чорних контурів, голова «пливе»
 * над одягом, волосся двома шарами (позаду голови й над лобом). З `meter` — говорить: нижня губа
 * опускається за гучністю, рот відкривається ширше чи вужче за тембром, голова злегка хитається.
 */
export function Character({
    config,
    meter,
    background = true,
    zoom,
    outfit: withOutfit = true,
    className,
    title,
}: {
    config: CharacterConfig;
    meter?: (() => VoiceReading | null) | null;
    background?: boolean;
    /** Крупний план: 'head' — голова, 'face' — обличчя. */
    zoom?: 'head' | 'face' | 'card' | 'body';
    /** Без одягу — як у мініатюрах вибору. */
    outfit?: boolean;
    className?: string;
    title?: string;
}) {
    const uid = useId().replace(/:/g, '');
    const head = useRef<SVGGElement>(null);
    const lower = useRef<SVGGElement>(null);
    const upper = useRef<SVGGElement>(null);
    const inside = useRef<SVGPathElement>(null);

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
            if (lower.current)
                lower.current.setAttribute(
                    'transform',
                    `translate(0 ${(open * 12).toFixed(2)})`,
                );
            if (upper.current)
                upper.current.setAttribute(
                    'transform',
                    `translate(0 ${(-open * 2).toFixed(2)})`,
                );
            if (inside.current) {
                // Порожнина рота: ширша на високому голосі, вужча й глибша на низькому.
                const w = 14 + r.pitch * 8;
                const depth = 222 + open * 16;
                inside.current.setAttribute(
                    'd',
                    speaking
                        ? `M ${150 - w} 218 Q 150 ${216 - open * 2} ${150 + w} 218 Q 150 ${depth} ${150 - w} 218 Z`
                        : '',
                );
            }
            if (head.current && !reduce) {
                const bob = speaking ? Math.sin(t / 5) * open * 4 : 0;
                const tilt = speaking ? (r.pitch - 0.5) * 5 * open : 0;
                head.current.setAttribute(
                    'transform',
                    `translate(0 ${(-bob).toFixed(2)}) rotate(${tilt.toFixed(2)} 150 200)`,
                );
            }
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(frame);
    }, [meter]);

    const skin = SKIN_PALETTES[config.skin] ?? SKIN_PALETTES[0];
    const headShape = HEAD_SHAPES[config.head] ?? HEAD_SHAPES[0];
    const hairColor = (HAIR_COLORS[config.hairColor] ?? HAIR_COLORS[0]).hex;
    const hair = HAIR_PRESETS[config.hair] ?? HAIR_PRESETS[0];
    const outfit = OUTFIT_PRESETS[config.outfit] ?? OUTFIT_PRESETS[0];
    const outfitColor = OUTFIT_COLORS[config.outfitColor] ?? OUTFIT_COLORS[0];
    const bg = BG_COLORS[config.bg] ?? BG_COLORS[0];
    const tint = LIP_TINTS[config.lipTint] ?? 'natural';
    const lip = tint === 'natural' ? skin.lip : tint;
    const leftColor =
        EYE_COLOR_PALETTES[config.eyeColor] ?? EYE_COLOR_PALETTES[0];
    const rightColor = config.hetero
        ? (EYE_COLOR_PALETTES[config.eyeColorRight] ?? leftColor)
        : leftColor;
    const eyeDy = faceOffset(config, 'eyeY');
    const eyeSpread = faceOffset(config, 'eyeSpread');
    const noseDy = faceOffset(config, 'noseY');
    // Рот не заїжджає на ніс: тримаємо щонайменше 8 px від зсунутого носа.
    const mouthDy = Math.max(faceOffset(config, 'mouthY'), noseDy - 8);
    // Темна шкіра: тонкий світлий обідок на бровах, переніссі й губах, щоб риси не зливалися.
    const rim = ['deep_bronze', 'espresso', 'ebony'].includes(skin.id);
    const id = (name: string) => `${name}${uid}`;
    const url = (name: string) => `url(#${id(name)})`;

    return (
        <svg
            viewBox={VIEWS[zoom ?? 'full']}
            preserveAspectRatio={
                zoom === 'card' || zoom === 'body'
                    ? 'xMidYMid meet'
                    : 'xMidYMid slice'
            }
            role="img"
            aria-label={title}
            className={cn('character-svg', className)}
        >
            {title && <title>{title}</title>}
            <defs>
                <radialGradient id={id('bg')} cx="50%" cy="38%" r="70%">
                    <stop offset="0%" stopColor={shade(bg, -0.18)} />
                    <stop offset="100%" stopColor={bg} />
                </radialGradient>
                <linearGradient id={id('hair')} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={hairColor} />
                    <stop offset="55%" stopColor={hairColor} />
                    <stop
                        offset="100%"
                        stopColor={
                            config.hairOmbre
                                ? shade(hairColor, -0.55)
                                : hairColor
                        }
                    />
                </linearGradient>
                <clipPath id={id('head')}>
                    <path d={headShape.head} />
                </clipPath>
                <IrisGradient id={id('irisL')} color={leftColor} />
                <IrisGradient id={id('irisR')} color={rightColor} />
            </defs>

            {background && <rect width="300" height="320" fill={url('bg')} />}

            {/* Шар 1–2: тіло одягу, потім шия поверх нього */}
            {withOutfit && <OutfitBody preset={outfit} color={outfitColor} />}
            {withOutfit && (
                <path
                    d="M 120 224 C 122 244, 120 258, 115 270 C 130 282, 170 282, 185 270 C 180 258, 178 244, 180 224 Z"
                    fill={skin.base}
                />
            )}
            {/* Тінь від підборіддя на шиї: під головою, тож голова її перекриває й при хитанні */}
            {withOutfit && (
                <path
                    d="M 116 236 C 126 266, 174 266, 184 236 L 185 270 C 170 282, 130 282, 115 270 Z"
                    fill={skin.shadow}
                />
            )}

            <g ref={head}>
                {hair.back && (
                    <path
                        d={hair.back}
                        transform={HAIR_FIT}
                        fill={url('hair')}
                    />
                )}

                <Ears skin={skin} />
                <EarAccessory kind={config.extra} />

                {/* Голова: пласкі шари кольору без контурів */}
                <path d={headShape.head} fill={skin.base} />
                <g clipPath={url('head')}>
                    <path
                        d="M 210 110 C 238 172, 214 246, 150 272 L 150 300 L 270 300 L 270 90 Z"
                        fill={skin.shadow}
                        opacity="0.55"
                    />
                    <path
                        d="M 104 70 C 120 58, 168 56, 190 72 C 168 66, 126 68, 104 84 Z"
                        fill={skin.highlight}
                        opacity="0.6"
                    />
                    <path d={headShape.chinShadow} fill={skin.shadow} />
                    {hair.front && (
                        <path
                            d={hair.front}
                            transform={`translate(0 6) ${HAIR_FIT}`}
                            fill={skin.shadow}
                            opacity="0.6"
                        />
                    )}
                </g>

                {config.blush === 1 && (
                    <g fill="#F472B6" opacity="0.22">
                        <path d="M 92 196 C 92 186, 124 186, 124 196 C 124 205, 92 205, 92 196 Z" />
                        <path d="M 176 196 C 176 186, 208 186, 208 196 C 208 205, 176 205, 176 196 Z" />
                    </g>
                )}
                {config.freckles === 1 && (
                    <g fill={skin.deep} opacity="0.6">
                        {[
                            [104, 186],
                            [112, 182],
                            [118, 188],
                            [108, 192],
                            [196, 186],
                            [188, 182],
                            [182, 188],
                            [192, 192],
                            [142, 176],
                            [158, 176],
                        ].map(([x, y]) => (
                            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.7" />
                        ))}
                    </g>
                )}

                <Brows
                    kind={config.brows}
                    color={shade(hairColor, 0.08)}
                    skin={skin}
                    rim={rim}
                    dy={eyeDy}
                    gap={eyeSpread}
                />

                <Eyes
                    dy={eyeDy}
                    gap={eyeSpread}
                    shape={EYE_SHAPES[config.eyes] ?? EYE_SHAPES[0]}
                    pupil={PUPILS[config.pupil]?.id ?? 'round'}
                    left={leftColor}
                    right={rightColor}
                    leftUrl={url('irisL')}
                    rightUrl={url('irisR')}
                    uid={uid}
                />

                <g transform={`translate(0 ${noseDy})`}>
                    <Nose kind={config.nose} skin={skin} rim={rim} />
                </g>

                <g transform={`translate(0 ${mouthDy})`}>
                    <Mouth
                        kind={config.mouth}
                        lip={lip}
                        skin={skin}
                        rim={rim}
                        upperRef={upper}
                        lowerRef={lower}
                        insideRef={inside}
                    />
                </g>

                {/* Борода й вуса рухаються разом із ротом */}
                <g transform={`translate(0 ${mouthDy})`}>
                    <FacialHair kind={config.facialHair} color={hairColor} />
                </g>

                {hair.front && (
                    <path
                        d={hair.front}
                        transform={HAIR_FIT}
                        fill={url('hair')}
                    />
                )}

                <FaceAccessory kind={config.extra} dy={eyeDy} gap={eyeSpread} />
            </g>

            {/* Шар 8: комір і зав'язки поверх шиї — шия заходить в одяг */}
            {withOutfit && <OutfitCollar preset={outfit} color={outfitColor} />}
        </svg>
    );
}

function IrisGradient({ id, color }: { id: string; color: EyeColor }) {
    return (
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color.top} />
            <stop offset="50%" stopColor={color.mid} />
            <stop offset="100%" stopColor={color.bot} />
        </linearGradient>
    );
}

function Ears({ skin }: { skin: SkinPalette }) {
    return (
        <g>
            <path d={EARS_GEOMETRY.leftOuter} fill={skin.shadow} />
            <path d={EARS_GEOMETRY.leftInner} fill={skin.deep} />
            <path d={EARS_GEOMETRY.rightOuter} fill={skin.shadow} />
            <path d={EARS_GEOMETRY.rightInner} fill={skin.deep} />
        </g>
    );
}

/** Брова: ліва в просторі голови, права — дзеркально; «насічка» вирізається кольором шкіри. */
const RIM = 'rgba(255,255,255,0.12)';

function Brows({
    kind,
    color,
    skin,
    rim,
    dy,
    gap,
}: {
    kind: number;
    color: string;
    skin: SkinPalette;
    rim: boolean;
    dy: number;
    gap: number;
}) {
    const brow = BROW_PRESETS[kind] ?? BROW_PRESETS[0];
    const one = (
        <g>
            <path
                d={brow.path}
                fill={color}
                stroke={rim ? RIM : 'none'}
                strokeWidth="1.6"
                strokeLinejoin="round"
            />
            {brow.notch && <path d={brow.notch} fill={skin.base} />}
        </g>
    );

    return (
        <g className="eyebrows">
            <g transform={eyeLeft(dy, gap)}>
                <g transform={BROW_TO_EYE}>{one}</g>
            </g>
            <g transform={eyeRight(dy, gap)}>
                <g transform={BROW_TO_EYE}>{one}</g>
            </g>
        </g>
    );
}

function Pupil({
    kind,
    shape,
    color,
}: {
    kind: string;
    shape: EyeShape;
    color: EyeColor;
}) {
    const cy = shape.irisCy;
    const k = shape.irisRx / 19;
    switch (kind) {
        case 'slit':
            return (
                <path
                    d={`M 95 ${cy - shape.irisRy * 0.8} C 99 ${cy - 6}, 99 ${cy + 6}, 95 ${cy + shape.irisRy * 0.8} C 91 ${cy + 6}, 91 ${cy - 6}, 95 ${cy - shape.irisRy * 0.8} Z`}
                    fill="#0b0710"
                />
            );
        case 'ringed':
            return (
                <g>
                    {[0.8, 0.6].map((r) => (
                        <ellipse
                            key={r}
                            cx="95"
                            cy={cy}
                            rx={shape.irisRx * r}
                            ry={shape.irisRy * r}
                            fill="none"
                            stroke="#F8FAFC"
                            strokeOpacity="0.55"
                            strokeWidth="1.4"
                        />
                    ))}
                    <ellipse
                        cx="95"
                        cy={cy}
                        rx={8 * k}
                        ry={9.5 * k}
                        fill="#0b0f19"
                    />
                </g>
            );
        case 'cyber_ring':
            return (
                <g>
                    <ellipse
                        cx="95"
                        cy={cy}
                        rx={10.5 * k}
                        ry={11.5 * k}
                        fill="none"
                        stroke={color.bot}
                        strokeWidth="1.8"
                        strokeDasharray="4 2.4"
                    />
                    <ellipse
                        cx="95"
                        cy={cy}
                        rx={7 * k}
                        ry={8 * k}
                        fill="#020617"
                    />
                </g>
            );
        case 'star': {
            const pts = Array.from({ length: 10 }, (_, i) => {
                const a = -Math.PI / 2 + (i * Math.PI) / 5;
                const r = (i % 2 === 0 ? 10 : 4.2) * k;

                return `${(95 + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`;
            });

            return <path d={`M ${pts.join(' L ')} Z`} fill="#0b0710" />;
        }
        case 'heart':
            return (
                <path
                    d={`M 95 ${cy + 8 * k} C ${95 - 12 * k} ${cy}, ${95 - 9 * k} ${cy - 10 * k}, 95 ${cy - 4 * k} C ${95 + 9 * k} ${cy - 10 * k}, ${95 + 12 * k} ${cy}, 95 ${cy + 8 * k} Z`}
                    fill="#0b0710"
                />
            );
        default:
            return (
                <ellipse
                    cx="95"
                    cy={cy}
                    rx={9 * k}
                    ry={11 * k}
                    fill="#07060a"
                />
            );
    }
}

/** Одне око в рідних координатах (центр 95, 155). Відблиски — окремо, без дзеркала. */
function Eye({
    shape,
    pupil,
    color,
    fill,
    clipId,
}: {
    shape: EyeShape;
    pupil: string;
    color: EyeColor;
    fill: string;
    clipId: string;
}) {
    const ink = '#16121a';
    const open = shape.sclera !== '';

    return (
        <g>
            {shape.eyelidCrease && (
                <path
                    d={shape.eyelidCrease}
                    stroke={ink}
                    strokeWidth="1.6"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.4"
                />
            )}
            {open && (
                <>
                    <clipPath id={clipId}>
                        <path d={shape.sclera} />
                    </clipPath>
                    <path d={shape.sclera} fill="#FFFFFF" />
                    <g clipPath={`url(#${clipId})`}>
                        <g className="iris-pupil-group">
                            <ellipse
                                cx="95"
                                cy={shape.irisCy}
                                rx={shape.irisRx}
                                ry={shape.irisRy}
                                fill={fill}
                            />
                            <ellipse
                                cx="95"
                                cy={shape.irisCy}
                                rx={shape.irisRx}
                                ry={shape.irisRy}
                                fill="none"
                                stroke={color.rim}
                                strokeWidth="2.5"
                            />
                            <Pupil kind={pupil} shape={shape} color={color} />
                        </g>
                        <path
                            d={shape.upperShadow}
                            fill="#E2E6F0"
                            opacity="0.5"
                        />
                        <path
                            d={shape.upperShadow}
                            fill="#0f172a"
                            opacity="0.18"
                        />
                    </g>
                </>
            )}
            <g className="upper-lid">
                <path d={shape.upperLash} fill={ink} />
                {shape.lashSpikes && <path d={shape.lashSpikes} fill={ink} />}
            </g>
            {shape.lowerLash && (
                <path d={shape.lowerLash} fill={ink} opacity="0.75" />
            )}
        </g>
    );
}

function Eyes({
    dy,
    gap,
    shape,
    pupil,
    left,
    right,
    leftUrl,
    rightUrl,
    uid,
}: {
    dy: number;
    gap: number;
    shape: EyeShape;
    pupil: string;
    left: EyeColor;
    right: EyeColor;
    leftUrl: string;
    rightUrl: string;
    uid: string;
}) {
    const open = shape.sclera !== '';
    // Відблиски — світло згори ліворуч від центру райдужки.
    const glints = open ? (
        <g>
            <ellipse
                cx={95 - shape.irisRx * 0.37}
                cy={shape.irisCy - shape.irisRy * 0.38}
                rx={shape.irisRx * 0.29}
                ry={shape.irisRx * 0.24}
                fill="#FFFFFF"
            />
            <ellipse
                cx={95 + shape.irisRx * 0.34}
                cy={shape.irisCy + shape.irisRy * 0.33}
                rx={shape.irisRx * 0.12}
                ry={shape.irisRx * 0.12}
                fill="#FFFFFF"
            />
        </g>
    ) : null;

    return (
        <g className="character-eyes">
            <g className="eye-left" transform={eyeLeft(dy, gap)}>
                <Eye
                    shape={shape}
                    pupil={pupil}
                    color={left}
                    fill={leftUrl}
                    clipId={`el${uid}`}
                />
                {glints}
            </g>
            <g className="eye-right" transform={eyeRight(dy, gap)}>
                <Eye
                    shape={shape}
                    pupil={pupil}
                    color={right}
                    fill={rightUrl}
                    clipId={`er${uid}`}
                />
                {/* Відблиски дзеркалимо назад довкола центру ока — світло з того самого боку. */}
                <g transform="translate(190 0) scale(-1, 1)">{glints}</g>
            </g>
        </g>
    );
}

function Nose({
    kind,
    skin,
    rim,
}: {
    kind: number;
    skin: SkinPalette;
    rim: boolean;
}) {
    const n = NOSE_PRESETS[kind] ?? NOSE_PRESETS[0];

    return (
        <g>
            <path d={n.bridgeShadow} fill={skin.shadow} />
            <path
                d={n.bridgeHighlight}
                fill={skin.highlight}
                stroke={rim ? RIM : 'none'}
                strokeWidth="1.4"
            />
            <path d={n.tipShadow} fill={skin.shadow} />
            <path
                d={n.nostrils}
                stroke={skin.deep}
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
            />
        </g>
    );
}

function Mouth({
    kind,
    lip,
    skin,
    rim,
    upperRef,
    lowerRef,
    insideRef,
}: {
    kind: number;
    lip: string;
    skin: SkinPalette;
    rim: boolean;
    upperRef: RefObject<SVGGElement | null>;
    lowerRef: RefObject<SVGGElement | null>;
    insideRef: RefObject<SVGPathElement | null>;
}) {
    const m = MOUTH_PRESETS[kind] ?? MOUTH_PRESETS[0];

    return (
        <g>
            {m.chinDimple && (
                <path
                    d={m.chinDimple}
                    stroke={skin.shadow}
                    strokeWidth="1.8"
                    fill="none"
                    strokeLinecap="round"
                />
            )}
            <path ref={insideRef} d="" fill="#3a1820" />
            <g ref={lowerRef}>
                {m.lowerLip && (
                    <path
                        d={m.lowerLip}
                        fill={lip}
                        stroke={rim ? RIM : 'none'}
                        strokeWidth="1.2"
                    />
                )}
            </g>
            <g ref={upperRef}>
                {m.upperLip && (
                    <path
                        d={m.upperLip}
                        fill={shade(lip, 0.12)}
                        stroke={rim ? RIM : 'none'}
                        strokeWidth="1.2"
                    />
                )}
            </g>
            <path
                d={m.centerLine}
                stroke={shade(lip, 0.42)}
                strokeWidth={m.upperLip ? 1.4 : 2.2}
                fill="none"
                strokeLinecap="round"
            />
            {m.ring && (
                <path
                    d={m.ring}
                    stroke="#D4AF37"
                    strokeWidth="1.8"
                    fill="none"
                    strokeLinecap="round"
                />
            )}
        </g>
    );
}

function FacialHair({ kind, color }: { kind: number; color: string }) {
    const f = FACIAL_HAIR_PRESETS[kind];
    if (!f || !f.path) return null;

    return (
        <path d={f.path} fill={color} opacity={f.opacity} fillRule="evenodd" />
    );
}

/** Сережки біля вух. */
function EarAccessory({ kind }: { kind: number }): ReactNode {
    const id = ACCESSORIES[kind]?.id;
    if (id === 'gold_hoops')
        return (
            <g
                stroke="#D4AF37"
                strokeWidth="2.6"
                fill="none"
                strokeLinecap="round"
            >
                <path d="M 56 186 A 7 7 0 1 0 68 188" />
                <path d="M 244 186 A 7 7 0 1 1 232 188" />
            </g>
        );
    if (id === 'cross_studs')
        return (
            <g stroke="#CBD5E1" strokeWidth="2.2" strokeLinecap="round">
                <path d="M 60 180 L 60 192 M 55 186 L 65 186" />
                <path d="M 240 180 L 240 192 M 235 186 L 245 186" />
            </g>
        );

    return null;
}

/** Окуляри, візор і гарнітура поверх обличчя. */
function FaceAccessory({
    kind,
    dy,
    gap,
}: {
    kind: number;
    dy: number;
    gap: number;
}): ReactNode {
    // Окуляри розтягуються від центру разом із відстанню між очима (лінзи на ±36 від центру).
    const wide = `translate(150 ${dy}) scale(${((36 + gap) / 36).toFixed(3)} 1) translate(-150 0)`;
    const a = ACCESSORIES[kind];
    if (
        !a ||
        a.id === 'none' ||
        a.id === 'gold_hoops' ||
        a.id === 'cross_studs'
    )
        return null;
    if (a.frame)
        return (
            <path
                d={a.frame}
                transform={`${wide} ${GLASSES_FIT}`}
                fill={a.lensFill}
                stroke={a.stroke}
                strokeWidth={a.strokeWidth}
                strokeLinejoin="round"
                fillRule="evenodd"
            />
        );
    if (a.id === 'cyber_visor')
        return (
            <g transform={`translate(0 ${dy})`}>
                <path
                    d="M 52 136 C 90 126, 210 126, 248 136 L 244 168 C 210 176, 90 176, 56 168 Z"
                    fill="rgba(34,211,238,0.3)"
                    stroke="#22D3EE"
                    strokeWidth="2"
                />
                <path
                    d="M 66 152 L 234 152"
                    stroke="#ECFEFF"
                    strokeOpacity="0.55"
                    strokeWidth="1.5"
                />
            </g>
        );
    if (a.id === 'headset')
        return (
            <g>
                <path
                    d="M 62 146 C 54 48, 246 48, 238 146"
                    stroke="#1F2430"
                    strokeWidth="9"
                    fill="none"
                    strokeLinecap="round"
                />
                <path
                    d="M 46 146 C 46 138, 70 138, 70 146 L 70 184 C 70 192, 46 192, 46 184 Z"
                    fill="#1F2430"
                />
                <path
                    d="M 230 146 C 230 138, 254 138, 254 146 L 254 184 C 254 192, 230 192, 230 184 Z"
                    fill="#1F2430"
                />
                <path
                    d="M 58 184 C 66 224, 102 238, 124 232"
                    stroke="#1F2430"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                />
                <path
                    d="M 122 232 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0"
                    fill="#4F6BFF"
                />
            </g>
        );

    return null;
}

/** Одяг: колір користувача на тілі й комірі, тіні й зав'язки — на 18 % темніші. */
function OutfitBody({
    preset,
    color,
}: {
    preset: OutfitPreset;
    color: string;
}) {
    const dark = shade(color, 0.18);

    return (
        <g>
            <path d={preset.body} fill={color} />
            {/* Тінь плечей з боків і западина під коміром */}
            <path
                d="M 32 320 C 38 282, 54 262, 82 252 C 66 270, 60 294, 62 320 Z M 268 320 C 262 282, 246 262, 218 252 C 234 270, 240 294, 238 320 Z"
                fill={dark}
            />
            <path
                d="M 104 250 C 120 262, 180 262, 196 250 C 182 286, 118 286, 104 250 Z"
                fill={dark}
            />
        </g>
    );
}

function OutfitCollar({
    preset,
    color,
}: {
    preset: OutfitPreset;
    color: string;
}) {
    const dark = shade(color, 0.18);

    if (preset.id === 'suit')
        return (
            <g>
                {/* Біла сорочка у V-вирізі, лацкани — колір костюма з тінню */}
                <path d={preset.hoodCollar} fill="#F8FAFC" />
                <path
                    d="M 96 242 L 150 290 L 126 254 Z M 204 242 L 150 290 L 174 254 Z"
                    fill={dark}
                />
                <path
                    d={preset.strings}
                    stroke={shade(color, 0.45)}
                    strokeWidth="7"
                    strokeLinecap="round"
                />
            </g>
        );

    return (
        <g>
            <path d={preset.hoodCollar} fill={color} />
            {/* Внутрішній край коміра — темніший, щоб був об'єм */}
            <path
                d={preset.hoodCollar}
                fill="none"
                stroke={dark}
                strokeWidth="2.5"
                strokeLinejoin="round"
            />
            {preset.hasHood && (
                <path
                    d="M 96 262 C 118 282, 182 282, 204 262"
                    stroke={dark}
                    strokeWidth="5"
                    fill="none"
                    strokeLinecap="round"
                />
            )}
            {preset.strings && (
                <path
                    d={preset.strings}
                    stroke={dark}
                    strokeWidth={preset.id === 'tactical' ? 5 : 3}
                    strokeLinecap="round"
                />
            )}
        </g>
    );
}
