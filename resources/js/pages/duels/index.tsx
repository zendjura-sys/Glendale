import { Head, Link, router, useForm } from '@inertiajs/react';
import { Check, Swords, Trophy, X } from 'lucide-react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type Duel = {
    id: number;
    terms: string;
    status:
        | 'pending'
        | 'accepted'
        | 'declined'
        | 'cancelled'
        | 'finished'
        | 'disputed';
    game: { slug: string; name: string } | null;
    challenger: UserCard | null;
    opponent: UserCard | null;
    incoming: boolean;
    my_pick: number | null;
    winner_id: number | null;
    created_at: string;
};

const STATUS: Record<Duel['status'], () => string> = {
    pending: () => tr('Чекає відповіді'),
    accepted: () => tr('Гра триває'),
    declined: () => tr('Відхилено'),
    cancelled: () => tr('Скасовано'),
    finished: () => tr('Завершено'),
    disputed: () => tr('Різні результати'),
};

const field =
    'input-glass h-11 w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none';

/** Дуелі: виклик гравця, прийняти/відхилити, обидва вказують переможця. */
export default function Duels({
    duels,
    stats,
    games,
    to,
}: {
    duels: Duel[];
    stats: { wins: number; losses: number };
    games: { slug: string; name: string }[];
    to: string | null;
}) {
    const form = useForm({ username: to ?? '', game: '', terms: '' });
    const act = (duel: Duel, action: string, winner?: number) =>
        router.post(
            `/duels/${duel.id}`,
            { action, winner: winner ?? null },
            { preserveScroll: true },
        );

    return (
        <>
            <Head title={tr('Дуелі')} />
            <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-white">
                            <Swords className="size-6 text-gc-lilac-300" />
                            {tr('Дуелі')}
                        </h1>
                        <p className="mt-1 text-sm text-white/50">
                            {tr(
                                'Викличте друга 1 на 1 — результат підтверджують обоє.',
                            )}
                        </p>
                    </div>
                    <div className="flex gap-2 text-sm">
                        <span className="rounded-xl bg-emerald-500/15 px-3 py-1.5 text-emerald-200">
                            {tr('Перемог: {count}', { count: stats.wins })}
                        </span>
                        <span className="rounded-xl bg-white/[0.06] px-3 py-1.5 text-white/70">
                            {tr('Поразок: {count}', { count: stats.losses })}
                        </span>
                    </div>
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.post('/duels', {
                            preserveScroll: true,
                            onSuccess: () => form.reset('terms'),
                        });
                    }}
                    className="glass grid gap-2 rounded-2xl p-4 sm:grid-cols-2"
                >
                    <input
                        value={form.data.username}
                        onChange={(e) =>
                            form.setData('username', e.target.value)
                        }
                        placeholder={tr('@суперник')}
                        className={field}
                    />
                    <select
                        value={form.data.game}
                        onChange={(e) => form.setData('game', e.target.value)}
                        className={field}
                        aria-label={tr('Гра')}
                    >
                        <option value="">{tr('Гра (необовʼязково)')}</option>
                        {games.map((g) => (
                            <option key={g.slug} value={g.slug}>
                                {g.name}
                            </option>
                        ))}
                    </select>
                    <input
                        value={form.data.terms}
                        onChange={(e) => form.setData('terms', e.target.value)}
                        placeholder={tr('Умови: «1v1 на Mirage до 10 раундів»')}
                        maxLength={160}
                        className={cn(field, 'sm:col-span-2')}
                    />
                    {(form.errors.username || form.errors.terms) && (
                        <p className="text-xs text-rose-300 sm:col-span-2">
                            {form.errors.username ?? form.errors.terms}
                        </p>
                    )}
                    <div className="flex justify-end sm:col-span-2">
                        <button
                            type="submit"
                            disabled={
                                form.processing ||
                                !form.data.username.trim() ||
                                form.data.terms.trim().length < 3
                            }
                            className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                        >
                            <Swords className="size-4" />
                            {tr('Викликати')}
                        </button>
                    </div>
                </form>

                {duels.length === 0 && (
                    <p className="glass rounded-2xl p-6 text-center text-sm text-white/50">
                        {tr('Дуелей ще не було.')}
                    </p>
                )}
                <ul className="space-y-3">
                    {duels.map((d) => {
                        const other = d.incoming ? d.challenger : d.opponent;
                        const meWon =
                            d.status === 'finished' &&
                            d.winner_id !== null &&
                            d.winner_id !== other?.id;
                        return (
                            <li key={d.id} className="glass rounded-2xl p-4">
                                <div className="flex items-center gap-3">
                                    {other && (
                                        <UserAvatar user={other} size="sm" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm text-white">
                                            {d.incoming
                                                ? tr('Вас викликає')
                                                : tr('Ви викликали')}{' '}
                                            {other && (
                                                <Link
                                                    href={`/${other.username}`}
                                                    className="font-semibold hover:underline"
                                                >
                                                    {other.name}
                                                </Link>
                                            )}
                                            {d.game && (
                                                <span className="text-white/50">
                                                    {' '}
                                                    · {d.game.name}
                                                </span>
                                            )}
                                        </p>
                                        <p className="truncate text-sm text-white/65">
                                            {d.terms}
                                        </p>
                                    </div>
                                    <span
                                        className={cn(
                                            'shrink-0 rounded-chip px-2 py-0.5 text-xs',
                                            d.status === 'finished'
                                                ? meWon
                                                    ? 'bg-emerald-500/15 text-emerald-200'
                                                    : 'bg-rose-500/15 text-rose-200'
                                                : 'bg-white/[0.06] text-white/60',
                                        )}
                                    >
                                        {d.status === 'finished'
                                            ? meWon
                                                ? tr('Перемога')
                                                : tr('Поразка')
                                            : STATUS[d.status]()}
                                    </span>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                                    {d.status === 'pending' && d.incoming && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => act(d, 'accept')}
                                                className="btn-glow inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 font-semibold"
                                            >
                                                <Check className="size-4" />
                                                {tr('Прийняти')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    act(d, 'decline')
                                                }
                                                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3.5 text-white/70 hover:text-white"
                                            >
                                                <X className="size-4" />
                                                {tr('Відхилити')}
                                            </button>
                                        </>
                                    )}
                                    {d.status === 'pending' && !d.incoming && (
                                        <button
                                            type="button"
                                            onClick={() => act(d, 'cancel')}
                                            className="text-white/50 hover:text-rose-300"
                                        >
                                            {tr('Скасувати виклик')}
                                        </button>
                                    )}
                                    {(d.status === 'accepted' ||
                                        d.status === 'disputed') && (
                                        <>
                                            <span className="text-white/55">
                                                {d.my_pick
                                                    ? tr(
                                                          'Ваш результат надіслано.',
                                                      )
                                                    : tr('Хто переміг?')}
                                            </span>
                                            {[d.challenger, d.opponent].map(
                                                (p) =>
                                                    p ? (
                                                        <button
                                                            key={p.id}
                                                            type="button"
                                                            onClick={() =>
                                                                act(
                                                                    d,
                                                                    'report',
                                                                    p.id,
                                                                )
                                                            }
                                                            className={cn(
                                                                'inline-flex h-9 items-center gap-1.5 rounded-xl px-3 transition',
                                                                d.my_pick ===
                                                                    p.id
                                                                    ? 'bg-gc-indigo text-white'
                                                                    : 'bg-white/[0.06] text-white/75 hover:text-white',
                                                            )}
                                                        >
                                                            <Trophy className="size-4" />
                                                            {p.name}
                                                        </button>
                                                    ) : null,
                                            )}
                                        </>
                                    )}
                                    <span className="ml-auto text-xs text-white/40">
                                        {timeAgo(d.created_at)}
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </>
    );
}
