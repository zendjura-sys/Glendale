import { usePage } from '@inertiajs/react';
import { useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Сезонні прикраси сайту (сезон приходить із сервера — App\Support\Seasons):
 *  newyear      — сніг і гірлянда під шапкою (Новий рік і Різдво);
 *  valentine    — серця, що повільно спливають;
 *  easter       — писанки в кутах і пелюстки;
 *  independence — синьо-жовта стрічка під шапкою;
 *  halloween    — гарбузи в кутах, кажани й осіннє листя.
 * Лише CSS і SVG; не перехоплюють натискання; за «зменшити рух» стоять нерухомо.
 */

/** Детермінований псевдовипадок: прикраси не «стрибають» між рендерами. */
function rand(seed: number): number {
    const x = Math.sin(seed * 78.233 + 12.9898) * 43758.5453;

    return x - Math.floor(x);
}

/** Частинки, що падають чи спливають: позиція, розмір, тривалість, затримка. */
function Particles({
    count,
    className,
    children,
    seed,
}: {
    count: number;
    className: string;
    children?: (i: number) => ReactNode;
    seed: number;
}) {
    const items = useMemo(
        () =>
            Array.from({ length: count }, (_, i) => ({
                left: rand(seed + i) * 100,
                size: 0.6 + rand(seed + i * 3) * 0.9,
                duration: 9 + rand(seed + i * 7) * 12,
                delay: -rand(seed + i * 11) * 20,
                drift: (rand(seed + i * 13) - 0.5) * 80,
            })),
        [count, seed],
    );

    return (
        <>
            {items.map((item, i) => (
                <span
                    key={i}
                    className={className}
                    style={
                        {
                            left: `${item.left}%`,
                            '--size': item.size,
                            '--drift': `${item.drift}px`,
                            animationDuration: `${item.duration}s`,
                            animationDelay: `${item.delay}s`,
                        } as CSSProperties
                    }
                >
                    {children?.(i)}
                </span>
            ))}
        </>
    );
}

function Garland() {
    const bulbs = 18;
    const colors = ['#ff5a5a', '#ffd166', '#4cc9f0', '#80ed99', '#c77dff'];

    return (
        <svg
            className="season-garland"
            viewBox="0 0 1000 40"
            preserveAspectRatio="none"
        >
            <path
                d="M0 4 Q 55 30 111 4 T 222 4 T 333 4 T 444 4 T 555 4 T 666 4 T 777 4 T 888 4 T 1000 4"
                fill="none"
                stroke="rgb(255 255 255 / 0.25)"
                strokeWidth="1.5"
            />
            {Array.from({ length: bulbs }, (_, i) => {
                const x = (i + 0.5) * (1000 / bulbs);
                const phase = ((x % 111) / 111) * Math.PI;
                const y = 6 + Math.sin(phase) * 15;

                return (
                    <circle
                        key={i}
                        cx={x}
                        cy={y + 6}
                        r="4.5"
                        fill={colors[i % colors.length]}
                        className="season-bulb"
                        style={{ animationDelay: `${(i % 4) * 0.45}s` }}
                    />
                );
            })}
        </svg>
    );
}

const HEART =
    'M12 21s-7.5-4.6-9.5-9.3C1 8 3.3 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.7 0 6 3.5 4.5 7.2C19.5 16.4 12 21 12 21z';

function Egg({
    colors,
    className,
}: {
    colors: [string, string];
    className: string;
}) {
    return (
        <svg viewBox="0 0 60 76" className={className}>
            <ellipse cx="30" cy="40" rx="26" ry="34" fill={colors[0]} />
            <path
                d="M6 34 Q 18 26 30 34 T 54 34"
                stroke={colors[1]}
                strokeWidth="4"
                fill="none"
            />
            <path
                d="M5 48 Q 18 56 30 48 T 55 48"
                stroke={colors[1]}
                strokeWidth="4"
                fill="none"
            />
            <circle cx="30" cy="20" r="3.5" fill={colors[1]} />
            <circle cx="20" cy="62" r="2.5" fill={colors[1]} />
            <circle cx="40" cy="62" r="2.5" fill={colors[1]} />
        </svg>
    );
}

function Pumpkin({ className }: { className: string }) {
    return (
        <svg viewBox="0 0 80 70" className={className}>
            <path
                d="M38 10 q2-8 9-9"
                stroke="#3f6212"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
            />
            <ellipse cx="40" cy="42" rx="36" ry="26" fill="#f97316" />
            <ellipse cx="40" cy="42" rx="20" ry="26" fill="#fb923c" />
            <ellipse cx="40" cy="42" rx="8" ry="26" fill="#f97316" />
            <path
                d="M24 36 l7 -6 l3 8 Z M46 38 l7 -8 l3 8 Z"
                fill="#fde68a"
                className="season-pumpkin-eyes"
            />
            <path
                d="M26 52 q14 10 28 0 l-5 2 l-3 -4 l-4 5 l-4 -5 l-4 5 l-3 -4 Z"
                fill="#fde68a"
                className="season-pumpkin-eyes"
            />
        </svg>
    );
}

export function Seasonal() {
    const season = usePage().props.season ?? null;

    if (!season) return null;

    return (
        <div aria-hidden className={`season season--${season}`}>
            {season === 'newyear' && (
                <>
                    <Garland />
                    <Particles count={36} seed={7} className="season-snow" />
                </>
            )}
            {season === 'valentine' && (
                <Particles count={14} seed={19} className="season-heart">
                    {() => (
                        <svg viewBox="0 0 24 24">
                            <path d={HEART} />
                        </svg>
                    )}
                </Particles>
            )}
            {season === 'easter' && (
                <>
                    <Particles count={16} seed={31} className="season-petal" />
                    <Egg
                        colors={['#fde68a', '#f472b6']}
                        className="season-corner season-corner--left"
                    />
                    <Egg
                        colors={['#a5f3fc', '#a78bfa']}
                        className="season-corner season-corner--right"
                    />
                </>
            )}
            {season === 'independence' && <div className="season-ribbon" />}
            {season === 'halloween' && (
                <>
                    <Particles count={14} seed={53} className="season-leaf" />
                    <Pumpkin className="season-corner season-corner--left" />
                    <Pumpkin className="season-corner season-corner--right" />
                    <Particles count={4} seed={43} className="season-bat">
                        {() => (
                            <svg viewBox="0 0 64 28">
                                <path d="M32 10c-3-6-7-8-10-6 2 2 2 5 0 7-4-4-10-6-15-3 4 1 6 4 6 8 4-3 9-3 12 0 2-3 5-4 7-3 2-1 5 0 7 3 3-3 8-3 12 0 0-4 2-7 6-8-5-3-11-1-15 3-2-2-2-5 0-7-3-2-7 0-10 6z" />
                            </svg>
                        )}
                    </Particles>
                </>
            )}
        </div>
    );
}
