import { Link } from '@inertiajs/react';
import { Trophy } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type Row = { place: number; days: number; user: UserCard };

export type LeaderboardData = {
    top: Row[];
    friends: Row[];
    me: { place: number; days: number } | null;
};

function days(n: number) {
    return tr('{count} дн.', { count: n });
}

/** Лідерборд гри за 30 днів: загалом і серед друзів, ваше місце. */
export function GameLeaderboard({ data }: { data: LeaderboardData }) {
    const [tab, setTab] = useState<'top' | 'friends'>('top');
    const rows = tab === 'top' ? data.top : data.friends;

    return (
        <div>
            <div className="mb-3 flex items-center gap-2">
                {data.friends.length > 0 && (
                    <div className="flex rounded-xl bg-white/[0.04] p-1">
                        {(
                            [
                                ['top', tr('Усі')],
                                ['friends', tr('Друзі')],
                            ] as const
                        ).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setTab(value)}
                                className={cn(
                                    'h-8 rounded-lg px-3 text-[13px] font-medium transition',
                                    tab === value
                                        ? 'bg-white/10 text-white'
                                        : 'text-white/50 hover:text-white',
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
                {data.me && (
                    <span className="ml-auto text-sm text-white/55">
                        {tr('Ваше місце: #{place} · {days}', {
                            place: data.me.place,
                            days: days(data.me.days),
                        })}
                    </span>
                )}
            </div>
            <ol className="space-y-1.5">
                {rows.map((row, index) => (
                    <li
                        key={row.user.id}
                        className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/[0.04]"
                    >
                        <span
                            className={cn(
                                'w-6 text-center font-display text-sm font-bold tabular-nums',
                                index === 0
                                    ? 'text-amber-300'
                                    : index < 3
                                      ? 'text-white/80'
                                      : 'text-white/40',
                            )}
                        >
                            {tab === 'top' ? row.place : index + 1}
                        </span>
                        <Link
                            href={`/${row.user.username}`}
                            className="flex min-w-0 flex-1 items-center gap-2.5"
                        >
                            <UserAvatar user={row.user} size="xs" />
                            <span className="truncate text-sm text-white">
                                {row.user.name}
                            </span>
                        </Link>
                        {index === 0 && (
                            <Trophy className="size-4 text-amber-300" />
                        )}
                        <span className="text-sm text-white/55 tabular-nums">
                            {days(row.days)}
                        </span>
                    </li>
                ))}
            </ol>
        </div>
    );
}
