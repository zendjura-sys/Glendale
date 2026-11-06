import { Link } from '@inertiajs/react';
import { Megaphone } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useEffect, useId, useMemo, useState } from 'react';
import outline from '@/data/ukraine-outline.json';
import type { AlertRegion } from '@/components/alerts/alert-map';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const W = 200;
const H = 120;
const LNG0 = 22.0;
const LNG1 = 40.4;
const LAT0 = 44.2;
const LAT1 = 52.5;
/** Межа синього й жовтого на «мапі-прапорі» (широта). */
const FLAG_SPLIT = 48.6;

function project(lat: number, lng: number): [number, number] {
    return [
        ((lng - LNG0) / (LNG1 - LNG0)) * W,
        ((LAT1 - lat) / (LAT1 - LAT0)) * H,
    ];
}

/**
 * Кнопка «Мапа тривог»: контур України в кольорах прапора, області з тривогою
 * світяться червоним (живі дані, раз на хвилину), поверх — гучномовець.
 */
export function AlertMapButton({
    className,
    current = false,
    row = false,
}: {
    className?: string;
    current?: boolean;
    /** Горизонтально (мапа ліворуч, підпис праворуч) — для мобільного меню. */
    row?: boolean;
}) {
    const reduce = useReducedMotion();
    const id = useId().replace(/:/g, '');
    const [regions, setRegions] = useState<AlertRegion[]>([]);

    useEffect(() => {
        let alive = true;
        const load = () =>
            api<{ regions: AlertRegion[] }>('GET', '/alerts/state')
                .then((d) => alive && setRegions(d.regions))
                .catch(() => undefined);
        void load();
        const timer = window.setInterval(load, 60_000);
        return () => {
            alive = false;
            window.clearInterval(timer);
        };
    }, []);

    const path = useMemo(
        () =>
            (outline as number[][][])
                .map(
                    (ring) =>
                        'M' +
                        ring
                            .map(([lng, lat]) =>
                                project(lat, lng)
                                    .map((v) => v.toFixed(1))
                                    .join(','),
                            )
                            .join('L') +
                        'Z',
                )
                .join(''),
        [],
    );
    const active = regions.filter((r) => r.active);
    const split = project(FLAG_SPLIT, LNG0)[1];

    return (
        <Link
            href="/alerts"
            prefetch
            aria-current={current ? 'page' : undefined}
            aria-label={
                active.length
                    ? tr('Мапа тривог: тривога в {n} регіонах', {
                          n: active.length,
                      })
                    : tr('Мапа тривог')
            }
            className={cn(
                'group relative flex shrink-0 overflow-hidden rounded-2xl bg-[#0b1a33]/80 p-3 ring-1 ring-sky-300/25 transition hover:ring-sky-300/50',
                row ? 'items-center gap-3' : 'flex-col gap-1.5',
                current && 'ring-sky-300/60',
                className,
            )}
        >
            <svg
                viewBox={`0 0 ${W} ${H}`}
                className={row ? 'h-auto w-36 shrink-0' : 'h-auto w-full'}
                aria-hidden
            >
                <defs>
                    <clipPath id={`ua-${id}`}>
                        <path d={path} />
                    </clipPath>
                    <filter
                        id={`glow-${id}`}
                        x="-50%"
                        y="-50%"
                        width="200%"
                        height="200%"
                    >
                        <feGaussianBlur stdDeviation="5" />
                    </filter>
                </defs>
                <g clipPath={`url(#ua-${id})`}>
                    <rect width={W} height={split} fill="#1f5fd1" />
                    <rect y={split} width={W} height={H} fill="#f5c518" />
                    {active.map((r) => {
                        const [x, y] = project(r.lat, r.lng);
                        return (
                            <m.circle
                                key={r.slug}
                                cx={x}
                                cy={y}
                                r={r.slug === 'kyiv' ? 8 : 17}
                                fill="#ef2b2b"
                                filter={`url(#glow-${id})`}
                                initial={{ opacity: 0 }}
                                animate={
                                    reduce
                                        ? { opacity: 0.85 }
                                        : { opacity: [0.65, 0.95, 0.65] }
                                }
                                transition={
                                    reduce
                                        ? undefined
                                        : {
                                              duration: 3,
                                              repeat: Infinity,
                                              ease: 'easeInOut',
                                          }
                                }
                            />
                        );
                    })}
                </g>
                <path
                    d={path}
                    fill="none"
                    stroke="rgb(255 255 255 / 0.35)"
                    strokeWidth={0.8}
                />
            </svg>
            <Megaphone
                className={cn(
                    'absolute -translate-y-1/2 -rotate-12 text-red-600 transition group-hover:scale-110 motion-reduce:transition-none',
                    row
                        ? 'top-1/2 left-[3.4rem] size-8'
                        : 'top-[30%] left-[38%] size-10',
                )}
                strokeWidth={2.6}
                aria-hidden
            />
            <span
                className={cn(
                    'flex gap-2',
                    row
                        ? 'min-w-0 flex-1 flex-col'
                        : 'items-baseline justify-between',
                )}
            >
                <span className="font-display text-[15px] leading-tight font-extrabold text-white">
                    {tr('Мапа тривог')}
                </span>
                <span
                    className={cn(
                        'text-[11px] leading-tight whitespace-nowrap',
                        active.length ? 'text-red-300' : 'text-white/50',
                    )}
                >
                    {active.length
                        ? tr('Тривога: {n}', { n: active.length })
                        : tr('Тривог немає')}
                </span>
            </span>
        </Link>
    );
}
