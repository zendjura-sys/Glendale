import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarCheck,
    CalendarClock,
    Check,
    Gamepad2,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { clockTime, formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { GameCard, UserCard } from '@/types';
import type { NightSummary } from './index';

type Option = {
    id: number;
    starts_at: string | null;
    game: GameCard | null;
    votes: number;
    voted: boolean;
    voters: UserCard[];
};

type Night = NightSummary & {
    note: string | null;
    is_host: boolean;
    my_status: 'invited' | 'going' | 'declined' | null;
    members: (UserCard & { status: 'invited' | 'going' | 'declined' })[];
    times: Option[];
    games: Option[];
};

const STATUS = {
    invited: () => tr('Ще не відповів'),
    going: () => tr('Буде'),
    declined: () => tr('Не зможе'),
};

/** Сторінка вечора: голоси за час і гру, відповіді друзів; організатор призначає. */
export default function GameNightShow({ night }: { night: Night }) {
    const planning = night.status === 'planning';
    const [time, setTime] = useState<number | null>(
        [...night.times].sort((a, b) => b.votes - a.votes)[0]?.id ?? null,
    );
    const [game, setGame] = useState<number | null>(
        [...night.games].sort((a, b) => b.votes - a.votes)[0]?.id ?? null,
    );
    const vote = (option: Option) =>
        router.post(
            `/game-nights/${night.id}/options/${option.id}/vote`,
            {},
            { preserveScroll: true, preserveState: true },
        );
    const respond = (status: 'going' | 'declined') =>
        router.post(
            `/game-nights/${night.id}/respond`,
            { status },
            { preserveScroll: true, preserveState: true },
        );
    const label = (o: Option) =>
        o.starts_at
            ? `${formatDate(o.starts_at, false)} · ${clockTime(o.starts_at)}`
            : (o.game?.name ?? '');

    const options = (
        title: string,
        list: Option[],
        icon: typeof Gamepad2,
        picked: number | null,
        pick: (id: number) => void,
    ) => {
        const Icon = icon;
        const max = Math.max(1, ...list.map((o) => o.votes));

        return (
            <section className="gc-solid rounded-2xl p-4">
                <h2 className="mb-3 text-sm font-medium text-white/60">
                    {title}
                </h2>
                <ul className="space-y-2">
                    {list.map((o) => (
                        <li
                            key={o.id}
                            className="gc-solid-2 relative overflow-hidden rounded-xl"
                        >
                            <span
                                className="absolute inset-y-0 left-0 bg-sky-500/15 transition-[width]"
                                style={{ width: `${(o.votes / max) * 100}%` }}
                            />
                            <div className="relative flex items-center gap-3 px-3 py-2.5">
                                <Icon className="size-4 text-sky-400" />
                                <span className="min-w-0 flex-1 truncate text-sm text-white">
                                    {label(o)}
                                </span>
                                <span className="flex -space-x-2">
                                    {o.voters.slice(0, 4).map((u) => (
                                        <UserAvatar
                                            key={u.id}
                                            user={u}
                                            size="xs"
                                            showOnline={false}
                                        />
                                    ))}
                                </span>
                                <span className="w-6 text-right text-sm font-semibold text-white/80 tabular-nums">
                                    {o.votes}
                                </span>
                                {planning && (
                                    <button
                                        type="button"
                                        onClick={() => vote(o)}
                                        aria-pressed={o.voted}
                                        className={cn(
                                            'h-8 rounded-lg px-3 text-xs font-semibold transition',
                                            o.voted
                                                ? 'bg-primary text-white'
                                                : 'bg-white/[0.08] text-white/75 hover:bg-white/[0.12]',
                                        )}
                                    >
                                        {o.voted
                                            ? tr('Мій голос')
                                            : tr('Підходить')}
                                    </button>
                                )}
                                {planning && night.is_host && (
                                    <input
                                        type="radio"
                                        checked={picked === o.id}
                                        onChange={() => pick(o.id)}
                                        aria-label={tr(
                                            'Обрати для призначення',
                                        )}
                                        className="size-4 accent-sky-400"
                                    />
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </section>
        );
    };

    return (
        <>
            <Head title={night.title} />
            <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
                <Link
                    href="/game-nights"
                    className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white"
                >
                    <ArrowLeft className="size-4" />
                    {tr('Ігрові вечори')}
                </Link>
                <section className="gc-solid rounded-2xl p-5">
                    <h1 className="font-display text-2xl font-semibold text-white">
                        {night.title}
                    </h1>
                    <p className="mt-1 text-sm text-white/50">
                        {night.host &&
                            tr('Організатор — {name}', {
                                name: night.host.name,
                            })}
                    </p>
                    {night.status === 'set' && night.starts_at && (
                        <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-200">
                            <CalendarCheck className="size-4" />
                            {formatDate(night.starts_at, false)} ·{' '}
                            {clockTime(night.starts_at)}
                            {night.game && ` · ${night.game.name}`}
                        </p>
                    )}
                    {night.note && (
                        <p className="mt-3 text-sm whitespace-pre-line text-white/70">
                            {night.note}
                        </p>
                    )}
                    {night.my_status && (
                        <div className="mt-4 flex gap-2">
                            {(['going', 'declined'] as const).map((status) => (
                                <button
                                    key={status}
                                    type="button"
                                    onClick={() => respond(status)}
                                    aria-pressed={night.my_status === status}
                                    className={cn(
                                        'inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition',
                                        night.my_status === status
                                            ? status === 'going'
                                                ? 'bg-primary text-white'
                                                : 'bg-white/15 text-white'
                                            : 'gc-solid-2 text-white/70 hover:bg-white/[0.1]',
                                    )}
                                >
                                    {status === 'going' ? (
                                        <Check className="size-4" />
                                    ) : (
                                        <X className="size-4" />
                                    )}
                                    {status === 'going'
                                        ? tr('Буду')
                                        : tr('Не зможу')}
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                {options(tr('Коли'), night.times, CalendarClock, time, setTime)}
                {night.games.length > 0 &&
                    options(
                        tr('У що граємо'),
                        night.games,
                        Gamepad2,
                        game,
                        setGame,
                    )}

                {planning && night.is_host && (
                    <div className="flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            onClick={() =>
                                confirm(tr('Скасувати вечір?')) &&
                                router.delete(`/game-nights/${night.id}`)
                            }
                            className="h-10 rounded-xl px-4 text-sm font-medium text-white/55 hover:text-red-400"
                        >
                            {tr('Скасувати')}
                        </button>
                        <button
                            type="button"
                            disabled={time === null}
                            onClick={() =>
                                router.post(
                                    `/game-nights/${night.id}/finalize`,
                                    { time, game },
                                    { preserveScroll: true },
                                )
                            }
                            className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                        >
                            {tr('Призначити вечір')}
                        </button>
                    </div>
                )}

                <section className="gc-solid rounded-2xl p-4">
                    <h2 className="mb-3 text-sm font-medium text-white/60">
                        {tr('Хто йде')}
                    </h2>
                    <ul className="space-y-2">
                        {night.members.map((member) => (
                            <li
                                key={member.id}
                                className="flex items-center gap-3"
                            >
                                <UserAvatar user={member} size="sm" />
                                <Link
                                    href={`/${member.username}`}
                                    className="min-w-0 flex-1 truncate text-sm text-white hover:underline"
                                >
                                    {member.name}
                                </Link>
                                <span
                                    className={cn(
                                        'rounded-chip px-2 py-0.5 text-[11px] font-medium',
                                        member.status === 'going'
                                            ? 'bg-emerald-500/15 text-emerald-200'
                                            : member.status === 'declined'
                                              ? 'gc-solid-2 text-white/45'
                                              : 'bg-sky-500/10 text-sky-400',
                                    )}
                                >
                                    {STATUS[member.status]()}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </>
    );
}
