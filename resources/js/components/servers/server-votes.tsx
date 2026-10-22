import { Link, router } from '@inertiajs/react';
import { Check, Trophy, Vote } from 'lucide-react';
import { useState } from 'react';
import { ServerIcon } from '@/components/servers/server-icon';
import { formatDate, shortNumber } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type VoteTopRow = {
    id: number;
    slug: string;
    name: string;
    icon: string | null;
    platform_label: string;
    votes: number;
};

export type ServerVotesInfo = {
    today: number;
    month: number;
    total: number;
    rank: number | null;
    voted_today: number | null;
    voted_here: boolean;
    daily: { date: string; votes: number }[] | null;
};

const MEDALS = ['text-amber-300', 'text-slate-200', 'text-orange-300'];

/** Топ серверів за голосами: сьогодні або цього місяця. */
export function VoteTops({
    day,
    month,
    votedToday,
}: {
    day: VoteTopRow[];
    month: VoteTopRow[];
    votedToday: number | null;
}) {
    const [period, setPeriod] = useState<'day' | 'month'>(
        day.length > 0 ? 'day' : 'month',
    );
    const rows = period === 'day' ? day : month;

    if (day.length === 0 && month.length === 0) {
        return null;
    }

    return (
        <section className="glass rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                    <Trophy className="size-5 text-amber-300" />
                    {tr('Топ за голосами')}
                </h2>
                <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1">
                    {(
                        [
                            ['day', tr('Сьогодні')],
                            ['month', tr('Місяць')],
                        ] as const
                    ).map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={period === value}
                            onClick={() => setPeriod(value)}
                            className={cn(
                                'h-8 rounded-lg px-3 text-xs font-semibold transition',
                                period === value
                                    ? 'bg-white/10 text-white'
                                    : 'text-white/50 hover:text-white',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>
            <p className="mt-1 text-xs text-white/45">
                {votedToday
                    ? tr('Ваш голос на сьогодні вже віддано. Новий — завтра.')
                    : tr(
                          'Один голос на день: відкрийте сервер і натисніть «Голосувати».',
                      )}
            </p>
            {rows.length === 0 ? (
                <p className="mt-4 text-sm text-white/45">
                    {tr('Сьогодні ще ніхто не голосував.')}
                </p>
            ) : (
                <ol className="mt-4 space-y-1.5">
                    {rows.map((row, index) => (
                        <li key={row.id}>
                            <Link
                                href={`/servers/${row.slug}`}
                                className="flex min-w-0 items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/[0.05]"
                            >
                                <span
                                    className={cn(
                                        'w-5 shrink-0 text-center font-display text-sm font-bold',
                                        MEDALS[index] ?? 'text-white/40',
                                    )}
                                >
                                    {index + 1}
                                </span>
                                <ServerIcon
                                    name={row.name}
                                    icon={row.icon}
                                    className="size-9"
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-white">
                                        {row.name}
                                    </span>
                                    <span className="block text-xs text-white/40">
                                        {row.platform_label}
                                    </span>
                                </span>
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-chip bg-gc-indigo/15 px-2.5 py-1 text-xs font-semibold text-[#c4b5fd] tabular-nums">
                                    <Vote className="size-3.5" />
                                    {shortNumber(row.votes)}
                                    {votedToday === row.id && (
                                        <Check
                                            className="size-3.5 text-emerald-300"
                                            aria-label={tr('Ваш голос')}
                                        />
                                    )}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

/** Голосування на сторінці сервера; власник бачить голоси за 30 днів. */
export function VotePanel({
    slug,
    votes,
}: {
    slug: string;
    votes: ServerVotesInfo;
}) {
    const [sending, setSending] = useState(false);
    const elsewhere = votes.voted_today !== null && !votes.voted_here;
    const vote = () =>
        router.post(
            `/servers/${slug}/vote`,
            {},
            {
                preserveScroll: true,
                onStart: () => setSending(true),
                onFinish: () => setSending(false),
            },
        );
    const peak = Math.max(1, ...(votes.daily ?? []).map((day) => day.votes));

    return (
        <section className="glass rounded-2xl p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                    <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                        <Vote className="size-5 text-gc-lilac-300" />
                        {tr('Голосування')}
                    </h2>
                    <p className="mt-1 text-sm text-white/50">
                        {votes.rank
                            ? tr('{rank} місце в топі місяця', {
                                  rank: votes.rank,
                              })
                            : tr(
                                  'Голосуйте щодня — сервер підніметься в топі.',
                              )}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={vote}
                    disabled={sending || votes.voted_today !== null}
                    className={cn(
                        'inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold sm:w-auto',
                        votes.voted_today === null
                            ? 'btn-glow'
                            : 'bg-white/[0.06] text-white/60',
                    )}
                >
                    {votes.voted_here ? (
                        <>
                            <Check className="size-4 text-emerald-300" />
                            {tr('Ви вже голосували сьогодні')}
                        </>
                    ) : elsewhere ? (
                        tr('Голос віддано іншому серверу')
                    ) : (
                        <>
                            <Vote className="size-4" />
                            {tr('Голосувати')}
                        </>
                    )}
                </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
                {(
                    [
                        [tr('Сьогодні'), votes.today],
                        [tr('За місяць'), votes.month],
                        [tr('Усього'), votes.total],
                    ] as const
                ).map(([label, value]) => (
                    <div
                        key={label}
                        className="min-w-0 rounded-2xl bg-white/[0.04] px-3 py-2.5"
                    >
                        <div className="font-display text-xl font-bold text-white tabular-nums">
                            {shortNumber(value)}
                        </div>
                        <div className="truncate text-xs text-white/45">
                            {label}
                        </div>
                    </div>
                ))}
            </div>
            {votes.daily && (
                <div className="mt-4">
                    <div className="mb-2 text-xs font-medium text-white/45">
                        {tr('Голоси за 30 днів — бачать власник і модератори')}
                    </div>
                    <div
                        className="flex h-20 items-end gap-[3px]"
                        role="img"
                        aria-label={tr('Голоси за 30 днів')}
                    >
                        {votes.daily.map((day) => (
                            <div
                                key={day.date}
                                title={`${formatDate(day.date)}: ${day.votes}`}
                                className="min-w-0 flex-1 rounded-t-sm bg-gc-indigo/70"
                                style={{
                                    height: `${Math.max(4, (day.votes / peak) * 100)}%`,
                                    opacity: day.votes === 0 ? 0.25 : 1,
                                }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
