import { Star } from 'lucide-react';
import { compactNumber } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { MovieOption, MovieStatus } from '@/types';

export type Audience = {
    ratings: Record<string, number>;
    statuses: Partial<Record<MovieStatus, number>>;
};

const STATUS_COLOR: Record<MovieStatus, string> = {
    watching: '#5fb26c',
    planned: '#a776c8',
    watched: '#3fa7d6',
    on_hold: '#e0a63a',
    dropped: '#d9534f',
};

/**
 * Рейтинг GameCon: середнє за 5-зірковою шкалою, кількість голосів і розподіл 5→1
 * (оцінки 1–10 зводяться попарно), власна оцінка зірками.
 */
export function RatingBreakdown({
    audience,
    mine,
    onRate,
}: {
    audience: Audience;
    mine: number | null;
    onRate: (rating: number | null) => void;
}) {
    const stars = [0, 0, 0, 0, 0];
    let sum = 0;
    let votes = 0;
    for (const [key, count] of Object.entries(audience.ratings)) {
        const r = Number(key);
        if (!count || r < 1 || r > 10) continue;
        stars[Math.ceil(r / 2) - 1] += count;
        sum += (r / 2) * count;
        votes += count;
    }
    const max = Math.max(1, ...stars);
    const myStars = mine ? Math.ceil(mine / 2) : 0;

    return (
        <section className="glass rounded-2xl p-5">
            <h2 className="mb-3 text-lg font-semibold text-white">
                {tr('Рейтинг')}
            </h2>
            <div className="flex items-center gap-6">
                <div className="text-center">
                    <p className="font-display text-5xl font-bold text-white tabular-nums">
                        {votes ? (sum / votes).toFixed(2) : '—'}
                    </p>
                    <p className="mt-1 text-xs text-white/50 tabular-nums">
                        {tr('{n} голосів', { n: compactNumber(votes) })}
                    </p>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                    {[5, 4, 3, 2, 1].map((s) => (
                        <div key={s} className="flex items-center gap-2">
                            <span className="w-3 text-xs text-white/50 tabular-nums">
                                {s}
                            </span>
                            <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                                <span
                                    className="block h-full rounded-full bg-white/85"
                                    style={{
                                        width: `${(stars[s - 1] / max) * 100}%`,
                                    }}
                                />
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
                <span className="text-sm text-white/55">
                    {tr('Ваша оцінка')}
                </span>
                <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                        <button
                            key={s}
                            type="button"
                            aria-label={tr('{n} із 5', { n: s })}
                            onClick={() => onRate(myStars === s ? null : s * 2)}
                        >
                            <Star
                                className={cn(
                                    'size-7 transition',
                                    s <= myStars
                                        ? 'fill-amber-400 text-amber-400'
                                        : 'text-white/50 hover:text-white',
                                )}
                            />
                        </button>
                    ))}
                </div>
            </div>
        </section>
    );
}

/** «В списках у людей»: кольорова смуга за статусами й легенда з кількістю. */
export function AudienceBar({
    audience,
    statuses,
}: {
    audience: Audience;
    statuses: MovieOption<MovieStatus>[];
}) {
    const items = statuses
        .map((s) => ({ ...s, count: audience.statuses[s.key] ?? 0 }))
        .filter((s) => s.count > 0);
    const total = items.reduce((sum, s) => sum + s.count, 0);
    if (total === 0) return null;

    return (
        <section className="glass rounded-2xl p-5">
            <h2 className="mb-3 text-lg font-semibold text-white">
                {tr('В списках у людей')}
            </h2>
            <div className="flex h-4 overflow-hidden rounded-full">
                {items.map((s) => (
                    <span
                        key={s.key}
                        title={`${s.label}: ${s.count}`}
                        style={{
                            width: `${(s.count / total) * 100}%`,
                            background: STATUS_COLOR[s.key],
                        }}
                    />
                ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {items.map((s) => (
                    <span key={s.key} className="flex items-center gap-2">
                        <span
                            className="size-3 shrink-0 rounded-full"
                            style={{ background: STATUS_COLOR[s.key] }}
                        />
                        <span className="text-white/65">{s.label}</span>
                        <span className="font-semibold text-white tabular-nums">
                            {compactNumber(s.count)}
                        </span>
                    </span>
                ))}
            </div>
        </section>
    );
}
