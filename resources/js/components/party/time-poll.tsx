import { router } from '@inertiajs/react';
import { Check, Pin, Vote } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { clockTime, dayLabel, plural } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

export type TimePollData = {
    decided: boolean;
    options: {
        id: number;
        starts_at: string;
        votes: number;
        mine: boolean;
        picked: boolean;
        voters: UserCard[];
    }[];
};

/**
 * Голосування за час гри: кожен позначає всі зручні варіанти («мені підходить»),
 * автор закріплює один — він стає часом старту паті.
 */
export function TimePoll({
    partyId,
    poll,
    canPick,
    open,
}: {
    partyId: number;
    poll: TimePollData;
    canPick: boolean;
    open: boolean;
}) {
    const reduce = useReducedMotion();
    const max = Math.max(1, ...poll.options.map((option) => option.votes));
    const active = open && !poll.decided;
    const toggle = (id: number) => {
        const mine = poll.options.filter((o) => o.mine).map((o) => o.id);
        const next = mine.includes(id)
            ? mine.filter((item) => item !== id)
            : [...mine, id];
        router.post(
            `/party/${partyId}/time`,
            { slots: next },
            { preserveScroll: true },
        );
    };

    return (
        <div className="space-y-3 rounded-2xl bg-white/[0.03] p-4">
            <div className="flex items-center gap-2">
                <Vote className="size-4 text-gc-lilac-300" />
                <h2 className="flex-1 text-sm font-semibold text-white">
                    {poll.decided
                        ? tr('Час обрано голосуванням')
                        : tr('Коли граємо?')}
                </h2>
                {active && (
                    <span className="text-xs text-white/45">
                        {tr('Позначте всі зручні варіанти')}
                    </span>
                )}
            </div>
            <ul className="space-y-2">
                {poll.options.map((option) => (
                    <li
                        key={option.id}
                        className={cn(
                            'relative overflow-hidden rounded-xl bg-white/[0.04]',
                            option.picked && 'ring-1 ring-gc-lilac-400/60',
                        )}
                    >
                        <motion.span
                            aria-hidden
                            className="absolute inset-y-0 left-0 bg-gc-indigo/15"
                            initial={reduce ? false : { width: 0 }}
                            animate={{
                                width: `${(option.votes / max) * 100}%`,
                            }}
                            transition={{ duration: 0.4, ease: 'easeOut' }}
                        />
                        <div className="relative flex items-center gap-3 px-3 py-2.5">
                            <button
                                type="button"
                                disabled={!active}
                                aria-pressed={option.mine}
                                onClick={() => toggle(option.id)}
                                className={cn(
                                    'flex size-6 shrink-0 items-center justify-center rounded-lg border transition',
                                    option.mine
                                        ? 'border-transparent bg-primary text-white'
                                        : 'border-white/20 text-transparent',
                                    active
                                        ? 'hover:border-white/40'
                                        : 'cursor-default',
                                )}
                                aria-label={tr('Мені підходить')}
                            >
                                <Check className="size-4" />
                            </button>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium text-white">
                                    {dayLabel(option.starts_at)} ·{' '}
                                    {clockTime(option.starts_at)}
                                </span>
                                <span className="block text-xs text-white/45 tabular-nums">
                                    {option.votes}{' '}
                                    {plural(option.votes, [
                                        tr('голос'),
                                        tr('голоси'),
                                        tr('голосів'),
                                    ])}
                                </span>
                            </span>
                            {option.voters.length > 0 && (
                                <span className="hidden -space-x-1.5 sm:flex">
                                    {option.voters.map((voter) => (
                                        <span
                                            key={voter.id}
                                            title={voter.name}
                                            className="rounded-full ring-2 ring-[var(--background)]"
                                        >
                                            <UserAvatar
                                                user={voter}
                                                size="xs"
                                            />
                                        </span>
                                    ))}
                                </span>
                            )}
                            {option.picked && (
                                <span className="inline-flex items-center gap-1 rounded-chip bg-gc-indigo/20 px-2 py-0.5 text-xs font-semibold text-[#c4b5fd]">
                                    <Pin className="size-3" />
                                    {tr('Обрано')}
                                </span>
                            )}
                            {canPick && active && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.post(
                                            `/party/${partyId}/time/${option.id}`,
                                            {},
                                            { preserveScroll: true },
                                        )
                                    }
                                    className="h-8 shrink-0 rounded-lg bg-white/[0.08] px-3 text-xs font-semibold text-white transition hover:bg-white/[0.14]"
                                >
                                    {tr('Закріпити')}
                                </button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
