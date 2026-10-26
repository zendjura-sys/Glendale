import { Gamepad2, Star } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type CommunityRatingData = {
    average: number | null;
    count: number;
    distribution: number[];
    mine: number | null;
    played: boolean;
};

/**
 * Оцінка гри від гравців GameCon (1–10). Ставлять лише ті, хто грав: статус «Граю»
 * або позначка «Я грав у цю гру».
 */
export function CommunityRating({
    slug,
    initial,
}: {
    slug: string;
    initial: CommunityRatingData;
}) {
    const [data, setData] = useState(initial);
    const [busy, setBusy] = useState(false);
    const max = Math.max(1, ...data.distribution);

    const send = async (url: string, body: Record<string, unknown> = {}) => {
        setBusy(true);
        try {
            setData(await api<CommunityRatingData>('POST', url, body));
        } catch (e) {
            toast.error(
                e instanceof Error ? e.message : tr('Не вдалося зберегти.'),
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-1">
                <p className="font-display text-4xl font-bold text-white tabular-nums">
                    {data.average !== null ? data.average.toFixed(1) : '—'}
                    <span className="text-base font-medium text-white/40">
                        /10
                    </span>
                </p>
                <p className="text-xs text-white/50">
                    {data.average !== null
                        ? tr('{n} оцінок гравців GameCon', { n: data.count })
                        : tr('Потрібно щонайменше 3 оцінки')}
                </p>
            </div>
            <div className="flex h-16 items-end gap-1" aria-hidden>
                {data.distribution.map((count, i) => (
                    <div
                        key={i}
                        className="flex flex-1 flex-col items-center gap-1"
                    >
                        <div
                            className={cn(
                                'w-full rounded-t-md transition-all',
                                data.mine === i + 1
                                    ? 'bg-primary'
                                    : 'bg-white/15',
                            )}
                            style={{
                                height: `${Math.max(4, (count / max) * 48)}px`,
                            }}
                        />
                        <span className="text-[10px] text-white/40 tabular-nums">
                            {i + 1}
                        </span>
                    </div>
                ))}
            </div>
            <div className="sm:col-span-2">
                {data.played ? (
                    <div>
                        <p className="mb-2 text-sm text-white/60">
                            {data.mine
                                ? tr('Ваша оцінка — {n}. Можна змінити.', {
                                      n: data.mine,
                                  })
                                : tr('Ваша оцінка:')}
                        </p>
                        <div className="grid grid-cols-10 gap-1">
                            {Array.from({ length: 10 }, (_, i) => i + 1).map(
                                (score) => (
                                    <button
                                        key={score}
                                        type="button"
                                        disabled={busy}
                                        aria-pressed={data.mine === score}
                                        onClick={() =>
                                            send(`/games/${slug}/rating`, {
                                                score:
                                                    data.mine === score
                                                        ? null
                                                        : score,
                                            })
                                        }
                                        className={cn(
                                            'grid h-9 place-items-center rounded-lg text-sm font-semibold tabular-nums transition disabled:opacity-50',
                                            data.mine !== null &&
                                                score <= data.mine
                                                ? 'bg-primary text-white'
                                                : 'bg-white/[0.06] text-white/70 hover:bg-white/10',
                                        )}
                                    >
                                        {score}
                                    </button>
                                ),
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/[0.03] p-3">
                        <Star className="size-4 shrink-0 text-white/45" />
                        <p className="min-w-0 flex-1 text-sm text-white/60">
                            {tr('Оцінювати можуть ті, хто грав у цю гру.')}
                        </p>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => send(`/games/${slug}/played`)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-50"
                        >
                            <Gamepad2 className="size-4" />
                            {tr('Я грав у цю гру')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
