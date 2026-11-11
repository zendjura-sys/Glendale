import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { BG, EYE, HAIR, OUTFIT, shade, SKIN } from '@/lib/character';
import type { CharacterConfig, VoiceReading } from '@/lib/character';
import { cn } from '@/lib/utils';

const INK = '#1f2430';

/**
 * Персонаж-аватар (SVG 200×200). З `meter` — «говорить»: гучність відкриває рот і злегка хитає голову,
 * тембр міняє форму рота. Анімація — через атрибути SVG у requestAnimationFrame, без перемальовування React.
 */
export function Character({
    config,
    meter,
    background = true,
    className,
    title,
}: {
    config: CharacterConfig;
    /** Поточна гучність і тембр голосу; null — мовчить. */
    meter?: (() => VoiceReading | null) | null;
    background?: boolean;
    className?: string;
    title?: string;
}) {
    const clip = useId().replace(/:/g, '');
    const head = useRef<SVGGElement>(null);
    const still = useRef<SVGGElement>(null);
    const talk = useRef<SVGEllipseElement>(null);
    const tongue = useRef<SVGEllipseElement>(null);

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
            if (talk.current) {
                talk.current.style.opacity = speaking ? '1' : '0';
                // Низький голос — округлий рот, високий — ширший і нижчий.
                talk.current.setAttribute(
                    'rx',
                    String(6 + r.pitch * 6 + open * 2),
                );
                talk.current.setAttribute('ry', String(1.5 + open * 9));
            }
            if (tongue.current) {
                tongue.current.style.opacity = open > 0.35 ? '1' : '0';
                tongue.current.setAttribute('cy', String(128 + open * 5));
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
    const skinDark = shade(skin, 0.14);

    return (
        <svg
            viewBox="0 0 200 200"
            role="img"
            aria-label={title}
            className={cn('character-svg', className)}
        >
            {title && <title>{title}</title>}
            <defs>
                <clipPath id={`c${clip}`}>
                    <rect width="200" height="200" />
                </clipPath>
            </defs>
            <g clipPath={`url(#c${clip})`}>
                {background && (
                    <rect width="200" height="200" fill={BG[config.bg]} />
                )}
                <Outfit config={config} skinDark={skinDark} />
                <g ref={head}>
                    {hairBack(config.hair, hair)}
                    {/* Шия й вуха */}
                    <rect
                        x="88"
                        y="126"
                        width="24"
                        height="32"
                        rx="10"
                        fill={skinDark}
                    />
                    <circle cx="55" cy="98" r="9" fill={skinDark} />
                    <circle cx="145" cy="98" r="9" fill={skinDark} />
                    {headShape(config.head, skin)}
                    {beard(config.beard, hair)}
                    <Eyes config={config} skin={skin} />
                    {brows(config.brows, shade(hair, 0.15))}
                    {nose(config.nose, skinDark)}
                    <g ref={still}>{mouth(config.mouth)}</g>
                    <ellipse
                        ref={talk}
                        cx="100"
                        cy="126"
                        rx="8"
                        ry="2"
                        fill="#3a1d24"
                        style={{ opacity: 0 }}
                    />
                    <ellipse
                        ref={tongue}
                        cx="100"
                        cy="130"
                        rx="5"
                        ry="2.5"
                        fill="#e0707a"
                        style={{ opacity: 0 }}
                    />
                    {config.beard === 3 && mustache(hair)}
                    {hairFront(config.hair, hair)}
                    {extra(config.extra)}
                </g>
            </g>
        </svg>
    );
}

function headShape(kind: number, skin: string): ReactNode {
    switch (kind) {
        case 1:
            return <circle cx="100" cy="94" r="50" fill={skin} />;
        case 2:
            return (
                <path
                    d="M54 70 C54 46 72 40 100 40 C128 40 146 46 146 70 L146 112 C146 136 126 148 100 148 C74 148 54 136 54 112 Z"
                    fill={skin}
                />
            );
        case 3:
            return <ellipse cx="100" cy="94" rx="43" ry="58" fill={skin} />;
        default:
            return <ellipse cx="100" cy="94" rx="47" ry="54" fill={skin} />;
    }
}

function hairBack(kind: number, color: string): ReactNode {
    switch (kind) {
        case 4: // довге
            return (
                <path
                    d="M50 92 C44 46 72 30 100 30 C128 30 156 46 150 92 L156 168 C142 176 124 166 120 150 L80 150 C76 166 58 176 44 168 Z"
                    fill={color}
                />
            );
        case 8: // хвіст
            return (
                <path
                    d="M136 60 C164 64 172 100 160 136 C156 150 146 156 140 150 C150 128 150 96 134 80 Z"
                    fill={color}
                />
            );
        case 9: // афро
            return <circle cx="100" cy="76" r="66" fill={color} />;
        default:
            return null;
    }
}

function hairFront(kind: number, color: string): ReactNode {
    switch (kind) {
        case 1: // коротке
            return (
                <path
                    d="M52 92 C48 50 74 34 100 34 C128 34 152 50 148 92 C140 70 122 58 100 60 C80 58 62 68 52 92 Z"
                    fill={color}
                />
            );
        case 2: // їжак
            return (
                <path
                    d="M56 80 C58 50 80 38 100 38 C122 38 142 50 144 80 C130 64 116 58 100 58 C84 58 70 64 56 80 Z"
                    fill={color}
                    opacity="0.85"
                />
            );
        case 3: // кучері
            return (
                <g fill={color}>
                    {[
                        [58, 72, 13],
                        [70, 54, 14],
                        [88, 44, 15],
                        [108, 42, 15],
                        [126, 50, 14],
                        [140, 66, 13],
                        [146, 84, 10],
                        [54, 88, 10],
                    ].map(([x, y, r]) => (
                        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
                    ))}
                </g>
            );
        case 4: // довге — чубчик
            return (
                <path
                    d="M52 90 C52 52 76 36 100 36 C124 36 148 52 148 90 C138 66 118 56 100 58 C86 66 66 76 52 90 Z"
                    fill={color}
                />
            );
        case 5: // гулька
            return (
                <g fill={color}>
                    <circle cx="100" cy="30" r="16" />
                    <path d="M54 86 C52 52 76 38 100 38 C124 38 148 52 146 86 C134 66 118 60 100 60 C82 60 66 66 54 86 Z" />
                </g>
            );
        case 6: // ірокез
            return (
                <path
                    d="M88 70 C86 42 94 24 100 18 C106 24 114 42 112 70 C108 62 92 62 88 70 Z"
                    fill={color}
                />
            );
        case 7: // проділ набік
            return (
                <path
                    d="M50 96 C46 52 72 32 102 32 C132 32 154 52 150 96 C146 76 136 64 120 58 C110 70 80 72 62 66 C56 74 52 84 50 96 Z"
                    fill={color}
                />
            );
        case 8: // хвіст — передня частина
            return (
                <path
                    d="M52 88 C50 52 74 36 100 36 C126 36 150 52 148 88 C138 66 118 58 100 60 C82 58 64 66 52 88 Z"
                    fill={color}
                />
            );
        case 9: // афро — лінія лоба
            return (
                <path
                    d="M56 80 C62 56 80 46 100 46 C120 46 138 56 144 80 C128 66 116 62 100 62 C84 62 72 66 56 80 Z"
                    fill={color}
                />
            );
        default: // лиса голова
            return null;
    }
}

function Eyes({ config, skin }: { config: CharacterConfig; skin: string }) {
    const iris = EYE[config.eyeColor] ?? EYE[0];
    const pair = (render: (x: number) => ReactNode) => (
        <g className="character-eyes">
            {render(82)}
            {render(118)}
        </g>
    );

    switch (config.eyes) {
        case 1:
            return pair((x) => (
                <g key={x}>
                    <ellipse cx={x} cy="96" rx="7.5" ry="6.5" fill="#fff" />
                    <circle cx={x} cy="96.5" r="4.2" fill={iris} />
                    <circle cx={x} cy="96.5" r="2" fill={INK} />
                    <circle cx={x + 1.6} cy="94.8" r="1.2" fill="#fff" />
                </g>
            ));
        case 2: // сонні
            return pair((x) => (
                <g key={x}>
                    <ellipse cx={x} cy="97" rx="7.5" ry="5.5" fill="#fff" />
                    <circle cx={x} cy="98" r="3.8" fill={iris} />
                    <path
                        d={`M${x - 8.5} 97 C${x - 6} 90 ${x + 6} 90 ${x + 8.5} 97 Z`}
                        fill={skin}
                    />
                    <path
                        d={`M${x - 8} 97 L${x + 8} 97`}
                        stroke={INK}
                        strokeWidth="1.6"
                        strokeLinecap="round"
                    />
                </g>
            ));
        case 3: // усміхнені дуги
            return (
                <g>
                    {[82, 118].map((x) => (
                        <path
                            key={x}
                            d={`M${x - 7} 98 Q${x} 90 ${x + 7} 98`}
                            stroke={INK}
                            strokeWidth="2.6"
                            strokeLinecap="round"
                            fill="none"
                        />
                    ))}
                </g>
            );
        case 4: // широкі
            return pair((x) => (
                <g key={x}>
                    <circle cx={x} cy="96" r="8" fill="#fff" />
                    <circle cx={x} cy="96" r="4.8" fill={iris} />
                    <circle cx={x} cy="96" r="2.2" fill={INK} />
                    <circle cx={x + 2} cy="94" r="1.4" fill="#fff" />
                </g>
            ));
        default: // крапки
            return pair((x) => (
                <circle key={x} cx={x} cy="96" r="4.5" fill={INK} />
            ));
    }
}

function brows(kind: number, color: string): ReactNode {
    const line = (d: string, w = 3) => (
        <path
            d={d}
            stroke={color}
            strokeWidth={w}
            strokeLinecap="round"
            fill="none"
        />
    );

    switch (kind) {
        case 1:
            return (
                <g>
                    {line('M74 83 Q82 77 90 81')}
                    {line('M110 81 Q118 77 126 83')}
                </g>
            );
        case 2:
            return (
                <g>
                    {line('M73 82 L91 80', 5)}
                    {line('M109 80 L127 82', 5)}
                </g>
            );
        case 3:
            return (
                <g>
                    {line('M74 79 L90 84')}
                    {line('M110 84 L126 79')}
                </g>
            );
        default:
            return (
                <g>
                    {line('M74 82 L90 82')}
                    {line('M110 82 L126 82')}
                </g>
            );
    }
}

function nose(kind: number, color: string): ReactNode {
    switch (kind) {
        case 1:
            return <ellipse cx="100" cy="110" rx="5" ry="3.6" fill={color} />;
        case 2:
            return (
                <path
                    d="M100 96 L105 114 L97 115"
                    stroke={color}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
            );
        case 3:
            return (
                <g fill={color}>
                    <path
                        d="M93 112 Q100 117 107 112"
                        stroke={color}
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        fill="none"
                    />
                    <circle cx="95" cy="110" r="1.6" />
                    <circle cx="105" cy="110" r="1.6" />
                </g>
            );
        default:
            return (
                <path
                    d="M100 102 Q105 110 99 112"
                    stroke={color}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    fill="none"
                />
            );
    }
}

function mouth(kind: number): ReactNode {
    const stroke = {
        stroke: '#5a2d34',
        strokeWidth: 2.8,
        strokeLinecap: 'round' as const,
        fill: 'none',
    };

    switch (kind) {
        case 1:
            return <path d="M90 126 L110 126" {...stroke} />;
        case 2:
            return (
                <g>
                    <path d="M86 122 Q100 142 114 122 Z" fill="#3a1d24" />
                    <path d="M89 123 L111 123 L109 127 L91 127 Z" fill="#fff" />
                </g>
            );
        case 3:
            return <path d="M90 127 Q103 131 112 122" {...stroke} />;
        case 4:
            return <ellipse cx="100" cy="127" rx="5" ry="6" fill="#3a1d24" />;
        default:
            return <path d="M88 123 Q100 134 112 123" {...stroke} />;
    }
}

function beard(kind: number, color: string): ReactNode {
    switch (kind) {
        case 1: // щетина
            return (
                <path
                    d="M58 104 C60 146 80 150 100 150 C120 150 140 146 142 104 C134 132 118 140 100 140 C82 140 66 132 58 104 Z"
                    fill={color}
                    opacity="0.28"
                />
            );
        case 2: // борода
            return (
                <path
                    d="M56 100 C56 152 80 162 100 162 C120 162 144 152 144 100 C136 130 122 138 100 138 C78 138 64 130 56 100 Z"
                    fill={color}
                />
            );
        case 4: // цапина
            return <ellipse cx="100" cy="142" rx="10" ry="8" fill={color} />;
        default:
            return null;
    }
}

function mustache(color: string): ReactNode {
    return (
        <path
            d="M84 119 C92 112 98 114 100 117 C102 114 108 112 116 119 C108 123 102 121 100 120 C98 121 92 123 84 119 Z"
            fill={color}
        />
    );
}

function extra(kind: number): ReactNode {
    switch (kind) {
        case 1: // круглі окуляри
            return (
                <g
                    stroke={INK}
                    strokeWidth="2.4"
                    fill="rgb(255 255 255 / 0.12)"
                >
                    <circle cx="82" cy="96" r="11" />
                    <circle cx="118" cy="96" r="11" />
                    <path d="M93 96 L107 96" fill="none" />
                </g>
            );
        case 2: // квадратні окуляри
            return (
                <g
                    stroke={INK}
                    strokeWidth="2.4"
                    fill="rgb(255 255 255 / 0.12)"
                >
                    <rect x="70" y="87" width="24" height="18" rx="4" />
                    <rect x="106" y="87" width="24" height="18" rx="4" />
                    <path d="M94 95 L106 95" fill="none" />
                </g>
            );
        case 3: // темні окуляри
            return (
                <g>
                    <path
                        d="M68 88 L96 88 L94 102 C92 108 74 108 70 102 Z M104 88 L132 88 L130 102 C126 108 108 108 106 102 Z"
                        fill={INK}
                    />
                    <path d="M96 91 L104 91" stroke={INK} strokeWidth="3" />
                    <path
                        d="M74 92 L82 92 M110 92 L118 92"
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
                        d="M50 98 C46 40 154 40 150 98"
                        stroke={INK}
                        strokeWidth="7"
                        fill="none"
                        strokeLinecap="round"
                    />
                    <rect
                        x="42"
                        y="86"
                        width="16"
                        height="28"
                        rx="7"
                        fill={INK}
                    />
                    <rect
                        x="142"
                        y="86"
                        width="16"
                        height="28"
                        rx="7"
                        fill={INK}
                    />
                    <rect
                        x="46"
                        y="92"
                        width="6"
                        height="16"
                        rx="3"
                        fill="#4f6bff"
                    />
                    <rect
                        x="148"
                        y="92"
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
                        d="M52 76 C52 42 76 30 100 30 C124 30 148 42 148 76 Z"
                        fill="#e2475b"
                    />
                    <path
                        d="M48 76 L152 76 C152 82 150 84 146 84 L54 84 C50 84 48 82 48 76 Z"
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
                        d="M54 74 C54 38 78 26 100 26 C122 26 146 38 146 74 Z"
                        fill="#2bb673"
                    />
                    <rect
                        x="50"
                        y="66"
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

function Outfit({
    config,
    skinDark,
}: {
    config: CharacterConfig;
    skinDark: string;
}) {
    const color = OUTFIT[config.outfitColor] ?? OUTFIT[0];
    const dark = shade(color, 0.22);
    const body = (
        <path
            d="M26 200 C30 168 58 150 100 150 C142 150 170 168 174 200 Z"
            fill={color}
        />
    );

    switch (config.outfit) {
        case 1: // футболка з V-вирізом
            return (
                <g>
                    {body}
                    <path d="M86 150 L100 170 L114 150 Z" fill={skinDark} />
                </g>
            );
        case 2: // куртка
            return (
                <g>
                    {body}
                    <path d="M90 150 L100 200 L110 150 Z" fill="#e9edf2" />
                    <path
                        d="M90 150 L84 176 L98 200 M110 150 L116 176 L102 200"
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
                    {body}
                    <path
                        d="M84 148 L100 162 L94 172 Z M116 148 L100 162 L106 172 Z"
                        fill="#fff"
                    />
                    <path d="M100 162 L100 200" stroke={dark} strokeWidth="2" />
                </g>
            );
        default: // худі
            return (
                <g>
                    {body}
                    <path
                        d="M70 156 C76 170 124 170 130 156 C124 150 76 150 70 156 Z"
                        fill={dark}
                    />
                    <path
                        d="M92 166 L90 186 M108 166 L110 186"
                        stroke="#e9edf2"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                </g>
            );
    }
}
