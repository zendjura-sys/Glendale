import { usePage } from '@inertiajs/react';
import { useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Сезонні прикраси сайту (сезон приходить із сервера — App\Support\Seasons):
 *  newyear      — сніг, хвойна гірлянда й вогники під шапкою, ялинкові кути, шапка Санти на аватарах;
 *  valentine    — серця, що повільно спливають;
 *  easter       — писанки в кутах і пелюстки;
 *  independence — синьо-жовта стрічка під шапкою;
 *  halloween    — гарбузи в кутах, кажани й осіннє листя.
 * Фон теж «святкує»: шар .season-bg підфарбовує будь-який фон під сезон.
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
        <>
            {/* Святковий відтінок фону: лягає на будь-яку сцену, фірмову картинку чи відео. */}
            <div aria-hidden className={`season-bg season-bg--${season}`} />
            {/* Задній план: ялинкові кути видно в полях і крізь скляні картки, текст вони не закривають. */}
            {season === 'newyear' && (
                <div aria-hidden className="season-lights" />
            )}
            {season === 'newyear' && (
                <div aria-hidden className="season-back">
                    <img
                        src="/images/seasons/newyear/corner-bottom.webp"
                        alt=""
                        className="season-ny-corner season-ny-corner--bottom"
                    />
                    <img
                        src="/images/seasons/newyear/corner-top.webp"
                        alt=""
                        className="season-ny-corner season-ny-corner--top"
                    />
                </div>
            )}
            <div aria-hidden className={`season season--${season}`}>
                {season === 'newyear' && (
                    <>
                        <div className="season-pine" />
                        <img
                            src="/images/seasons/newyear/branch-baubles.webp"
                            alt=""
                            className="season-ny-branch"
                        />
                        <Particles
                            count={36}
                            seed={7}
                            className="season-snow"
                        />
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
                        <Particles
                            count={16}
                            seed={31}
                            className="season-petal"
                        />
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
                        <Particles
                            count={14}
                            seed={53}
                            className="season-leaf"
                        />
                        <Pumpkin className="season-corner season-corner--left" />
                        <Pumpkin className="season-corner season-corner--right" />
                        <Particles count={5} seed={43} className="season-bat">
                            {() => <span className="season-bat-wings" />}
                        </Particles>
                    </>
                )}
            </div>
        </>
    );
}
