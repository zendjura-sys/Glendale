import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Gamepad2, X } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/gc/user-avatar';
import {
    BACKLOG_META,
    BACKLOG_STATUSES,
    saveBacklog,
} from '@/components/games/backlog';
import type { BacklogStatus } from '@/components/games/backlog';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { GameCard, UserCard } from '@/types';
import { GameCover } from './index';

type Item = { game: GameCard; updated_at: string };

type Props = {
    owner: UserCard;
    mine: boolean;
    board: Record<BacklogStatus, Item[]>;
    friends: { user: UserCard; game: GameCard; since: string }[];
};

/** Дошка «хочу — граю — пройшов — кинув»: своя (з керуванням) або друга (перегляд). */
export default function GameBacklog({ owner, mine, board, friends }: Props) {
    const reduce = useReducedMotion();
    const [columns, setColumns] = useState(board);
    // Телефон: одна колонка на екрані, перемикач зверху; посилання з профілю (#playing) відкриває потрібну.
    const [tab, setTab] = useState<BacklogStatus>('playing');
    useEffect(() => {
        const hash = window.location.hash.slice(1) as BacklogStatus;
        if (BACKLOG_STATUSES.includes(hash)) {
            setTab(hash);
        }
    }, []);

    const move = (
        item: Item,
        from: BacklogStatus,
        to: BacklogStatus | null,
    ) => {
        const before = columns;
        setColumns((cols) => {
            const next = { ...cols };
            next[from] = cols[from].filter((i) => i.game.id !== item.game.id);
            if (to) {
                next[to] = [
                    { ...item, updated_at: new Date().toISOString() },
                    ...cols[to],
                ];
            }

            return next;
        });
        saveBacklog(item.game.slug, to).catch(() => {
            setColumns(before);
            toast.error(tr('Не вдалося оновити бэклог.'));
        });
    };

    const total = BACKLOG_STATUSES.reduce(
        (sum, s) => sum + columns[s].length,
        0,
    );

    return (
        <>
            <Head
                title={
                    mine
                        ? tr('Мій бэклог')
                        : tr('Ігри {name}', { name: owner.first_name })
                }
            />
            <Link
                href="/games"
                className="mb-3 inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white"
            >
                <ArrowLeft className="size-4" /> {tr('Каталог ігор')}
            </Link>
            <div className="mb-4 flex items-center gap-3">
                {!mine && <UserAvatar user={owner} size="md" />}
                <div className="min-w-0">
                    <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-white">
                        {mine && (
                            <Gamepad2 className="size-6 shrink-0 text-gc-lilac-200" />
                        )}
                        {mine
                            ? tr('Мій бэклог')
                            : tr('Ігри {name}', { name: owner.first_name })}
                    </h1>
                    <p className="text-sm text-white/50">
                        {mine
                            ? tr(
                                  'Позначайте ігри на їхніх сторінках — тут вони збираються в чотири колонки.',
                              )
                            : tr('{n} ігор у бэклозі', { n: total })}
                    </p>
                </div>
            </div>

            {mine && friends.length > 0 && (
                <section className="glass mb-4 rounded-2xl p-4">
                    <h2 className="mb-3 px-1 text-[13px] font-semibold text-white/90">
                        {tr('Друзі зараз грають')}
                    </h2>
                    <ul className="flex snap-x [scrollbar-width:none] gap-3 overflow-x-auto pb-1">
                        {friends.map((f) => (
                            <li
                                key={f.user.id}
                                className="w-[132px] shrink-0 snap-start"
                            >
                                <Link
                                    href={`/games/${f.game.slug}`}
                                    className="group block"
                                >
                                    <span className="relative block aspect-[3/4] overflow-hidden rounded-xl bg-white/[0.04]">
                                        <GameCover
                                            game={f.game}
                                            className="transition duration-500 group-hover:scale-105"
                                        />
                                        <span className="absolute bottom-1.5 left-1.5">
                                            <UserAvatar
                                                user={f.user}
                                                size="sm"
                                            />
                                        </span>
                                    </span>
                                    <span className="mt-1.5 block truncate text-xs font-semibold text-white">
                                        {f.game.name}
                                    </span>
                                    <span className="block truncate text-[11px] text-white/50">
                                        {f.user.first_name}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Телефон: перемикач колонок. */}
            <div
                role="tablist"
                className="mb-3 grid grid-cols-4 gap-1 rounded-xl bg-white/[0.04] p-1 md:hidden"
            >
                {BACKLOG_STATUSES.map((s) => {
                    const meta = BACKLOG_META[s];

                    return (
                        <button
                            key={s}
                            type="button"
                            role="tab"
                            aria-selected={tab === s}
                            onClick={() => setTab(s)}
                            className={cn(
                                'flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-semibold transition',
                                tab === s
                                    ? 'bg-white/10 text-white'
                                    : 'text-white/55',
                            )}
                        >
                            <meta.icon className={cn('size-4', meta.tone)} />
                            {meta.label()} · {columns[s].length}
                        </button>
                    );
                })}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {BACKLOG_STATUSES.map((s) => {
                    const meta = BACKLOG_META[s];

                    return (
                        <section
                            key={s}
                            id={s}
                            className={cn(
                                'glass min-w-0 rounded-2xl p-3',
                                tab !== s && 'hidden md:block',
                            )}
                        >
                            <header className="mb-2 flex items-center gap-2 px-1">
                                <meta.icon
                                    className={cn('size-4', meta.tone)}
                                />
                                <h2 className="flex-1 text-sm font-semibold text-white">
                                    {meta.label()}
                                </h2>
                                <span className="text-xs text-white/45 tabular-nums">
                                    {columns[s].length}
                                </span>
                            </header>
                            {columns[s].length === 0 ? (
                                <p className="px-1 py-6 text-center text-xs text-white/40">
                                    {mine
                                        ? tr(
                                              'Порожньо. Позначте гру на її сторінці.',
                                          )
                                        : tr('Порожньо.')}
                                </p>
                            ) : (
                                <ul className="grid gap-1.5">
                                    <AnimatePresence initial={false}>
                                        {columns[s].map((item) => (
                                            <m.li
                                                key={item.game.id}
                                                layout={!reduce}
                                                initial={
                                                    reduce
                                                        ? false
                                                        : { opacity: 0, y: 6 }
                                                }
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={
                                                    reduce
                                                        ? undefined
                                                        : {
                                                              opacity: 0,
                                                              scale: 0.97,
                                                          }
                                                }
                                                className="group flex items-center gap-2.5 rounded-xl p-1.5 transition hover:bg-white/[0.04]"
                                            >
                                                <Link
                                                    href={`/games/${item.game.slug}`}
                                                    className="size-12 shrink-0 overflow-hidden rounded-lg"
                                                >
                                                    <GameCover
                                                        game={item.game}
                                                        className="text-xs"
                                                    />
                                                </Link>
                                                <div className="min-w-0 flex-1">
                                                    <Link
                                                        href={`/games/${item.game.slug}`}
                                                        className="block truncate text-sm font-medium text-white hover:underline"
                                                    >
                                                        {item.game.name}
                                                    </Link>
                                                    {mine ? (
                                                        <span className="mt-0.5 flex gap-0.5">
                                                            {BACKLOG_STATUSES.filter(
                                                                (to) =>
                                                                    to !== s,
                                                            ).map((to) => {
                                                                const target =
                                                                    BACKLOG_META[
                                                                        to
                                                                    ];

                                                                return (
                                                                    <button
                                                                        key={to}
                                                                        type="button"
                                                                        title={tr(
                                                                            'Перенести: {status}',
                                                                            {
                                                                                status: target.label(),
                                                                            },
                                                                        )}
                                                                        aria-label={tr(
                                                                            'Перенести: {status}',
                                                                            {
                                                                                status: target.label(),
                                                                            },
                                                                        )}
                                                                        onClick={() =>
                                                                            move(
                                                                                item,
                                                                                s,
                                                                                to,
                                                                            )
                                                                        }
                                                                        className="flex size-6 items-center justify-center rounded-md text-white/45 transition hover:bg-white/10 hover:text-white"
                                                                    >
                                                                        <target.icon className="size-3.5" />
                                                                    </button>
                                                                );
                                                            })}
                                                        </span>
                                                    ) : (
                                                        <span className="block text-[11px] text-white/45">
                                                            {formatDate(
                                                                item.updated_at,
                                                                false,
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                                {mine && (
                                                    <button
                                                        type="button"
                                                        aria-label={tr(
                                                            'Прибрати з бэклогу',
                                                        )}
                                                        onClick={() =>
                                                            move(item, s, null)
                                                        }
                                                        className="flex size-7 shrink-0 items-center justify-center rounded-lg text-white/35 opacity-100 transition hover:bg-white/10 hover:text-white md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                                                    >
                                                        <X className="size-4" />
                                                    </button>
                                                )}
                                            </m.li>
                                        ))}
                                    </AnimatePresence>
                                </ul>
                            )}
                        </section>
                    );
                })}
            </div>
        </>
    );
}
