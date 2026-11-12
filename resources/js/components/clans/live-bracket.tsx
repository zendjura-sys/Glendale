import { Crown, Radio } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type BracketData = {
    teams: string[];
    semi: [number | null, number | null][];
    final: [number | null, number | null];
};

type Side = { name: string; score: number | null; win: boolean };

/** Переможець пари: більший рахунок, якщо обидва внесені й не нічия. */
function winner(a: number | null, b: number | null): 0 | 1 | null {
    if (a === null || b === null || a === b) return null;

    return a > b ? 0 : 1;
}

function Score({ value }: { value: number | null }) {
    const reduce = useReducedMotion();

    return (
        <span className="relative grid w-7 place-items-center overflow-hidden font-display text-base font-bold tabular-nums">
            <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                    key={value ?? 'none'}
                    initial={reduce ? false : { y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={reduce ? undefined : { y: -12, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                >
                    {value ?? '–'}
                </motion.span>
            </AnimatePresence>
        </span>
    );
}

function Match({ label, sides }: { label: string; sides: [Side, Side] }) {
    return (
        <div className="w-full">
            <p className="mb-1 text-[11px] font-medium text-white/40">
                {label}
            </p>
            <div className="overflow-hidden rounded-xl bg-white/[0.04]">
                {sides.map((side, i) => (
                    <div
                        key={i}
                        className={cn(
                            'flex items-center gap-2 px-3 py-2 text-sm',
                            i === 0 && 'border-b border-white/[0.06]',
                            side.win
                                ? 'bg-primary/15 font-semibold text-white'
                                : 'text-white/70',
                        )}
                    >
                        <span className="min-w-0 flex-1 truncate">
                            {side.name || tr('Чекаємо')}
                        </span>
                        <Score value={side.score} />
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Сітка заходу клану на 4 команди: півфінали → фінал → переможець. Поки захід іде
 * (від старту й до 6 годин після), рахунок оновлюється сам кожні 15 секунд.
 */
export function LiveBracket({
    url,
    initial,
    startsAt,
}: {
    url: string;
    initial: BracketData;
    startsAt: string;
}) {
    const [bracket, setBracket] = useState<BracketData>(initial);
    const started = Date.parse(startsAt) <= Date.now();
    const live = started && Date.now() - Date.parse(startsAt) < 6 * 3600_000;

    useEffect(() => setBracket(initial), [initial]);
    useEffect(() => {
        if (!live) return;
        const load = () => {
            if (document.hidden) return;
            api<{ bracket: BracketData | null }>('GET', url)
                .then((d) => d.bracket && setBracket(d.bracket))
                .catch(() => undefined);
        };
        const timer = window.setInterval(load, 15_000);

        return () => window.clearInterval(timer);
    }, [live, url]);

    const t = bracket.teams;
    const semi = bracket.semi.map(([a, b]) => winner(a, b));
    const finalists = [
        semi[0] === null ? '' : t[semi[0]],
        semi[1] === null ? '' : t[2 + semi[1]],
    ];
    const champ = winner(bracket.final[0], bracket.final[1]);

    return (
        <section className="mt-3 rounded-2xl bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center gap-2">
                <p className="text-xs font-semibold text-white/70">
                    {tr('Турнірна сітка')}
                </p>
                {live && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-rose-300">
                        <Radio className="size-3" />
                        {tr('Наживо')}
                    </span>
                )}
            </div>
            <div className="grid items-center gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-3">
                    {[0, 1].map((m) => (
                        <Match
                            key={m}
                            label={tr('Півфінал {n}', { n: m + 1 })}
                            sides={[
                                {
                                    name: t[m * 2],
                                    score: bracket.semi[m][0],
                                    win: semi[m] === 0,
                                },
                                {
                                    name: t[m * 2 + 1],
                                    score: bracket.semi[m][1],
                                    win: semi[m] === 1,
                                },
                            ]}
                        />
                    ))}
                </div>
                <Match
                    label={tr('Фінал')}
                    sides={[
                        {
                            name: finalists[0],
                            score: bracket.final[0],
                            win: champ === 0,
                        },
                        {
                            name: finalists[1],
                            score: bracket.final[1],
                            win: champ === 1,
                        },
                    ]}
                />
                <div className="flex min-w-28 flex-col items-center gap-1 rounded-xl bg-amber-400/10 px-3 py-3 text-center">
                    <Crown
                        className={cn(
                            'size-6',
                            champ !== null ? 'text-amber-300' : 'text-white/25',
                        )}
                    />
                    <span className="text-[11px] text-white/45">
                        {tr('Переможець')}
                    </span>
                    <span className="max-w-32 truncate text-sm font-bold text-white">
                        {champ !== null ? finalists[champ] : '—'}
                    </span>
                </div>
            </div>
        </section>
    );
}
