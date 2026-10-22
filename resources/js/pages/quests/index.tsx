import { Head, Link } from '@inertiajs/react';
import { Clock, Medal, Target, Trophy } from 'lucide-react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { QuestList } from '@/components/quests/quest-list';
import type { Quest } from '@/components/quests/quest-list';
import { clockTime, shortNumber } from '@/lib/format';
import { LOCALE, tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type Props = {
    quests: Quest[];
    season: {
        season: string;
        ends_at: string;
        top: { place: number; points: number; user: UserCard }[];
        me: { place: number | null; points: number };
    };
    completed: number;
    resets_at: string;
};

const PLACE_TONE = ['text-amber-300', 'text-slate-200', 'text-orange-300'];

export default function Quests({
    quests,
    season,
    completed,
    resets_at,
}: Props) {
    const month = new Intl.DateTimeFormat(LOCALE, {
        month: 'long',
        year: 'numeric',
    }).format(new Date(`${season.season}-15`));
    const daysLeft = Math.max(
        0,
        Math.ceil(
            (new Date(season.ends_at).getTime() - Date.now()) / 86_400_000,
        ),
    );

    return (
        <>
            <Head title={tr('Завдання й сезон')} />
            <div className="mx-auto max-w-3xl space-y-5">
                <section className="glass rounded-2xl p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-white">
                                <Target className="size-6 text-gc-lilac-300" />
                                {tr('Завдання дня')}
                            </h1>
                            <p className="mt-1 flex items-center gap-1.5 text-sm text-white/50">
                                <Clock className="size-4" />
                                {tr('Нові завдання о {time}', {
                                    time: clockTime(resets_at),
                                })}
                            </p>
                        </div>
                        <span className="rounded-chip bg-white/[0.06] px-3 py-1 text-xs text-white/60">
                            {tr('Виконано всього: {n}', { n: completed })}
                        </span>
                    </div>
                    <div className="mt-4">
                        <QuestList quests={quests} />
                    </div>
                </section>

                <section className="glass rounded-2xl p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                            <Trophy className="size-5 text-amber-300" />
                            {tr('Сезон: {month}', { month })}
                        </h2>
                        <span className="text-xs text-white/45">
                            {tr('До кінця сезону: {n} дн.', { n: daysLeft })}
                        </span>
                    </div>
                    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-gc-indigo/10 px-4 py-3">
                        <Medal className="size-5 shrink-0 text-[#c4b5fd]" />
                        <span className="min-w-0 flex-1 text-sm text-white/80">
                            {season.me.place
                                ? tr('Ваше місце: {place}', {
                                      place: season.me.place,
                                  })
                                : tr(
                                      'Виконайте завдання, щоб потрапити в таблицю.',
                                  )}
                        </span>
                        <span className="shrink-0 font-display text-lg font-bold text-white tabular-nums">
                            {shortNumber(season.me.points)}
                        </span>
                    </div>
                    {season.top.length > 0 && (
                        <ol className="mt-3 space-y-1">
                            {season.top.map((row) => (
                                <li key={row.user.id}>
                                    <Link
                                        href={`/${row.user.username}`}
                                        className="flex min-w-0 items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/[0.05]"
                                    >
                                        <span
                                            className={cn(
                                                'w-6 shrink-0 text-center font-display text-sm font-bold',
                                                PLACE_TONE[row.place - 1] ??
                                                    'text-white/40',
                                            )}
                                        >
                                            {row.place}
                                        </span>
                                        <UserAvatar
                                            user={row.user}
                                            size="sm"
                                            showOnline={false}
                                        />
                                        <span className="min-w-0 flex-1 truncate text-sm text-white">
                                            {row.user.name}
                                        </span>
                                        <span className="shrink-0 text-sm font-semibold text-white/80 tabular-nums">
                                            {shortNumber(row.points)}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ol>
                    )}
                    <p className="mt-3 text-xs text-white/40">
                        {tr(
                            'Очки сезону — досвід за виконані завдання цього місяця. Він же додається до вашого рівня.',
                        )}
                    </p>
                </section>
            </div>
        </>
    );
}
