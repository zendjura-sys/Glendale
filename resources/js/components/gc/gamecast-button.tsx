import { Link } from '@inertiajs/react';
import { ChevronRight, Podcast } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';
import { cn } from '@/lib/utils';

type Pulse = { live: number; listeners: number };

/** Спільний пульс ефіру: один запит на всі кнопки, оновлення раз на 30 с, поки вкладка видима. */
let cached: Pulse | null = null;
let loading: Promise<Pulse> | null = null;
let loadedAt = 0;

function usePulse(on: boolean): Pulse | null {
    const [pulse, setPulse] = useState<Pulse | null>(cached);

    useEffect(() => {
        if (!on) return;
        let alive = true;
        const load = () => {
            if (document.hidden) return;
            if (!loading || Date.now() - loadedAt > 25_000) {
                loadedAt = Date.now();
                loading = api<Pulse>('GET', '/shows/pulse').then((p) => {
                    cached = p;

                    return p;
                });
            }
            loading.then((p) => alive && setPulse(p)).catch(() => undefined);
        };
        load();
        const timer = window.setInterval(load, 30_000);

        return () => {
            alive = false;
            window.clearInterval(timer);
        };
    }, [on]);

    return pulse;
}

/** Висоти смужок «голосу» в кожному кадрі — як розмова, а не рівний метроном. */
const BARS = [
    [0.35, 0.9, 0.5, 0.75, 0.35],
    [0.6, 0.3, 1, 0.45, 0.6],
    [0.45, 1, 0.65, 0.3, 0.45],
    [0.8, 0.4, 0.7, 1, 0.8],
    [0.3, 0.65, 0.4, 0.85, 0.3],
];

/** Еквалайзер голосу: «говорить», коли є ефір, і ледь дихає, коли тихо. Без руху — статичний. */
function VoiceBars({
    live,
    count,
    className,
}: {
    live: boolean;
    count: number;
    className?: string;
}) {
    const reduce = useReducedMotion();

    return (
        <span
            aria-hidden
            className={cn('flex items-center gap-[3px]', className)}
        >
            {BARS.slice(0, count).map((frames, i) => (
                <m.span
                    key={i}
                    className="h-full w-[3px] origin-center rounded-full bg-current"
                    initial={{ scaleY: frames[0] }}
                    animate={
                        reduce
                            ? { scaleY: frames[2] }
                            : {
                                  scaleY: live
                                      ? frames
                                      : frames.map((f) => 0.25 + f * 0.2),
                              }
                    }
                    transition={
                        reduce
                            ? { duration: 0 }
                            : {
                                  duration: live ? 1 + i * 0.12 : 2.4,
                                  repeat: Infinity,
                                  ease: 'easeInOut',
                              }
                    }
                />
            ))}
        </span>
    );
}

/** Точка «в ефірі»: хвиля розходиться від неї, коли хтось говорить. */
function OnAir({ live }: { live: boolean }) {
    const reduce = useReducedMotion();

    return (
        <span className="relative grid size-2.5 place-items-center">
            {live && !reduce && (
                <m.span
                    className="absolute inset-0 rounded-full bg-rose-500"
                    initial={{ scale: 1, opacity: 0.7 }}
                    animate={{ scale: 2.6, opacity: 0 }}
                    transition={{
                        duration: 1.6,
                        repeat: Infinity,
                        ease: 'easeOut',
                    }}
                />
            )}
            <span
                className={cn(
                    'relative size-2.5 rounded-full',
                    live ? 'bg-rose-500' : 'bg-white/30',
                )}
            />
        </span>
    );
}

function summary(pulse: Pulse | null): string {
    if (!pulse) return tr('Подкасти наживо з #темами');
    if (pulse.live === 0) return tr('Зараз тихо — почніть першу розмову');

    if (pulse.listeners === 0)
        return tr('{rooms} в ефірі — заходьте першими', { rooms: pulse.live });

    return tr('{rooms} в ефірі · {people} слухають', {
        rooms: pulse.live,
        people: pulse.listeners,
    });
}

/**
 * Жива кнопка GameCast у меню телефона: на ширину двох плиток. Ліворуч еквалайзер, що «говорить»,
 * поки йде ефір; під назвою — скільки кімнат і слухачів зараз.
 */
export function GameCastTile({ className }: { className?: string }) {
    const on = usePlugin('live_shows');
    const pulse = usePulse(on);
    const reduce = useReducedMotion();
    const live = (pulse?.live ?? 0) > 0;
    if (!on) return null;

    return (
        <Link
            href="/shows"
            className={cn(
                'group relative flex items-center gap-3 overflow-hidden rounded-[1.35rem] bg-[#141a33] p-3.5 text-left transition active:scale-[0.99]',
                className,
            )}
        >
            {/* Тихе сяйво, що повільно пливе за кнопкою, поки йде ефір */}
            {live && !reduce && (
                <m.span
                    aria-hidden
                    className="pointer-events-none absolute -inset-y-6 w-40 rounded-full bg-rose-500/20 blur-2xl"
                    initial={{ x: '-40%' }}
                    animate={{ x: ['-40%', '260%', '-40%'] }}
                    transition={{
                        duration: 9,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                />
            )}
            <span
                className={cn(
                    'relative grid size-12 shrink-0 place-items-center rounded-2xl',
                    live
                        ? 'bg-rose-500/15 text-rose-300'
                        : 'bg-white/[0.06] text-sky-300',
                )}
            >
                <VoiceBars live={live} count={5} className="h-6" />
            </span>
            <span className="relative min-w-0 flex-1">
                <span className="flex items-center gap-2">
                    <span className="font-display text-[15px] font-bold tracking-tight text-white">
                        GameCast
                    </span>
                    <OnAir live={live} />
                    {live && (
                        <span className="text-[10px] font-bold text-rose-300">
                            {tr('НАЖИВО')}
                        </span>
                    )}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-white/60">
                    {summary(pulse)}
                </span>
            </span>
            <ChevronRight className="relative size-4 shrink-0 text-white/45 transition group-hover:translate-x-0.5 group-hover:text-white" />
        </Link>
    );
}

/** Кнопка GameCast у шапці (ПК, планшет): значок подкастів, підпис на широких екранах і лічильник ефіру. */
export function GameCastHeaderButton({ className }: { className?: string }) {
    const on = usePlugin('live_shows');
    const pulse = usePulse(on);
    const reduce = useReducedMotion();
    const live = (pulse?.live ?? 0) > 0;
    if (!on) return null;

    return (
        <Link
            href="/shows"
            title={`GameCast · ${summary(pulse)}`}
            aria-label={`GameCast · ${summary(pulse)}`}
            className={cn(
                'relative h-9 shrink-0 items-center gap-2 rounded-full px-2.5 text-[13px] font-semibold transition lg:px-3.5',
                live
                    ? 'bg-rose-500/15 text-rose-100 hover:bg-rose-500/25'
                    : 'bg-white/[0.06] text-white/85 hover:bg-white/[0.1] hover:text-white',
                className,
            )}
        >
            <span className="relative grid size-5 place-items-center">
                {/* Хвиля від значка, поки йде ефір */}
                {live && !reduce && (
                    <m.span
                        aria-hidden
                        className="absolute inset-0 rounded-full border-2 border-rose-400"
                        initial={{ scale: 0.6, opacity: 0.8 }}
                        animate={{ scale: 1.9, opacity: 0 }}
                        transition={{
                            duration: 1.8,
                            repeat: Infinity,
                            ease: 'easeOut',
                        }}
                    />
                )}
                <Podcast
                    className={cn(
                        'relative size-[18px]',
                        live ? 'text-rose-300' : 'text-sky-300',
                    )}
                />
            </span>
            <span className="hidden lg:inline">GameCast</span>
            {live && (
                <span className="rounded-full bg-rose-500 px-1.5 text-[11px] leading-[18px] font-bold text-white tabular-nums">
                    {pulse?.live}
                </span>
            )}
        </Link>
    );
}
