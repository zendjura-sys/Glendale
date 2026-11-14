import { Head, Link } from '@inertiajs/react';
import {
    Check,
    Copy,
    Gift,
    Medal,
    Share2,
    Trophy,
    UserPlus,
} from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { plural } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type Props = {
    link: string;
    total: number;
    active: number;
    xp: number;
    ladder: { target: number; reached: boolean }[];
    next: { target: number; left: number; from: number } | null;
    people: (UserCard & {
        active: boolean;
        steps: {
            verified: boolean;
            avatar: boolean;
            post: boolean;
            played: boolean;
        };
    })[];
    leaderboard?: {
        period: 'month' | 'all';
        top: (UserCard & { place: number; count: number })[];
        me: { place: number | null; count: number };
    };
};

/** Медалі для перших трьох місць — без золота «з коробки», у кольорах сайту. */
const MEDAL = ['text-amber-300', 'text-slate-200', 'text-orange-300'];

const STEPS = () =>
    [
        ['verified', tr('Пошта')],
        ['avatar', tr('Аватар')],
        ['post', tr('Перший допис')],
        ['played', tr('Граю в…')],
    ] as const;

/** Нагорода за кожну сходинку — так само, як бейджі в Achievements. */
const REWARDS = (): Record<number, string> => ({
    1: tr('Бейдж «Запросив друга»'),
    5: tr('Бейдж «Збирач команди»'),
    10: tr('+300 XP до рівня'),
    25: tr('Бейдж «Амбасадор GameCon»'),
});

export default function Invite({
    link,
    total,
    active,
    xp,
    ladder,
    next,
    people,
    leaderboard,
}: Props) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        void navigator.clipboard?.writeText(link);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
    };
    const share = () => {
        if (typeof navigator.share === 'function') {
            void navigator
                .share({
                    title: 'GameCon',
                    text: tr('Приєднуйся до мене на GameCon!'),
                    url: link,
                })
                .catch(() => undefined);
        } else {
            copy();
        }
    };

    return (
        <>
            <Head title={tr('Запросити друзів')} />
            <div className="mx-auto max-w-3xl space-y-5">
                <section className="gc-solid rounded-2xl p-5 sm:p-6">
                    <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-white">
                        <UserPlus className="size-6 text-sky-400" />
                        {tr('Запросити друзів')}
                    </h1>
                    <p className="mt-1 text-sm text-white/55">
                        {tr(
                            'Надішліть посилання: хто зареєструється за ним, одразу стане вашим другом. За кожного, хто підтвердить пошту, — 30 XP і бейджі.',
                        )}
                    </p>
                    <div className="gc-solid-2 mt-4 flex min-w-0 items-center gap-2 rounded-2xl p-2 pl-4">
                        <code className="min-w-0 flex-1 font-mono text-sm break-all text-white/85">
                            {link}
                        </code>
                        <button
                            type="button"
                            onClick={copy}
                            aria-label={tr('Копіювати')}
                            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-white transition hover:bg-white/[0.12]"
                        >
                            {copied ? (
                                <Check className="size-4 text-emerald-300" />
                            ) : (
                                <Copy className="size-4" />
                            )}
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={share}
                        className="btn-glow mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold sm:w-auto"
                    >
                        <Share2 className="size-4" />
                        {tr('Поділитися')}
                    </button>
                    <div className="mt-5 grid grid-cols-3 gap-2">
                        {(
                            [
                                [tr('Прийшли'), total],
                                [tr('Активні'), active],
                                [tr('Досвіду'), xp],
                            ] as const
                        ).map(([label, value]) => (
                            <div
                                key={label}
                                className="gc-solid-2 min-w-0 rounded-2xl px-3 py-2.5"
                            >
                                <div className="font-display text-xl font-bold text-white tabular-nums">
                                    {value}
                                </div>
                                <div className="truncate text-xs text-white/45">
                                    {label}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="gc-solid rounded-2xl p-5 sm:p-6">
                    <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                        <Gift className="size-5 text-amber-300" />
                        {tr('Нагороди')}
                    </h2>
                    {next ? (
                        <div className="mt-3">
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                                <span className="text-white/80">
                                    {tr('До нагороди «{reward}»', {
                                        reward: REWARDS()[next.target],
                                    })}
                                </span>
                                <span className="shrink-0 font-semibold text-white tabular-nums">
                                    {active}/{next.target}
                                </span>
                            </div>
                            <div className="gc-solid-2 mt-2 h-2 overflow-hidden rounded-full">
                                <div
                                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                                    style={{
                                        width: `${Math.max(4, ((active - next.from) / (next.target - next.from)) * 100)}%`,
                                    }}
                                />
                            </div>
                            <p className="mt-1.5 text-xs text-white/50">
                                {tr('Ще {n} {friends} — і нагорода ваша.', {
                                    n: next.left,
                                    friends: plural(next.left, [
                                        'активний друг',
                                        'активні друзі',
                                        'активних друзів',
                                    ]),
                                })}
                            </p>
                        </div>
                    ) : (
                        <p className="mt-3 text-sm text-emerald-200">
                            {tr(
                                'Усі нагороди отримано — дякуємо, що кличете друзів!',
                            )}
                        </p>
                    )}
                    <ol className="mt-4 space-y-2">
                        {ladder.map((step) => (
                            <li
                                key={step.target}
                                className={cn(
                                    'flex items-center gap-3 rounded-2xl px-4 py-3',
                                    step.reached
                                        ? 'bg-emerald-400/[0.07]'
                                        : 'gc-solid-2',
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex size-9 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold',
                                        step.reached
                                            ? 'bg-emerald-400/20 text-emerald-100'
                                            : 'gc-solid-2 text-white/60',
                                    )}
                                >
                                    {step.reached ? (
                                        <Check className="size-4" />
                                    ) : (
                                        step.target
                                    )}
                                </span>
                                <span className="min-w-0 flex-1 text-sm text-white/80">
                                    {step.target}{' '}
                                    {plural(step.target, [
                                        'активний друг',
                                        'активні друзі',
                                        'активних друзів',
                                    ])}{' '}
                                    — {REWARDS()[step.target]}
                                </span>
                            </li>
                        ))}
                    </ol>
                </section>

                {leaderboard && (
                    <section className="gc-solid rounded-2xl p-5">
                        <div className="flex flex-wrap items-center gap-3">
                            <h2 className="flex flex-1 items-center gap-2 font-display text-lg font-bold text-white">
                                <Trophy className="size-5 text-amber-300" />
                                {tr('Лідери запрошень')}
                            </h2>
                            <div className="gc-solid-2 flex rounded-xl p-1 text-sm">
                                {(
                                    [
                                        ['month', tr('30 днів')],
                                        ['all', tr('Увесь час')],
                                    ] as const
                                ).map(([key, label]) => (
                                    <Link
                                        key={key}
                                        href={`/invite?period=${key}`}
                                        preserveScroll
                                        only={['leaderboard']}
                                        className={cn(
                                            'rounded-lg px-3 py-1.5 font-medium transition',
                                            leaderboard.period === key
                                                ? 'bg-sky-500 text-white'
                                                : 'text-white/55 hover:text-white',
                                        )}
                                    >
                                        {label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                        <p className="mt-1 text-xs text-white/45">
                            {tr('Рахуються друзі, які підтвердили пошту.')}{' '}
                            {leaderboard.me.place
                                ? tr('Ваше місце: {place} ({n})', {
                                      place: leaderboard.me.place,
                                      n: leaderboard.me.count,
                                  })
                                : tr(
                                      'Запросіть першого друга — і ви з’явитесь у рейтингу.',
                                  )}
                        </p>
                        {leaderboard.top.length === 0 ? (
                            <p className="mt-4 text-sm text-white/50">
                                {tr(
                                    'Поки ніхто нікого не запросив — станьте першим.',
                                )}
                            </p>
                        ) : (
                            <ol className="mt-3 space-y-1">
                                {leaderboard.top.map((person) => (
                                    <li key={person.id}>
                                        <Link
                                            href={`/${person.username}`}
                                            className={cn(
                                                'flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-[var(--gc-l3)]',
                                                person.place ===
                                                    leaderboard.me.place &&
                                                    'bg-primary/10',
                                            )}
                                        >
                                            <span className="grid w-7 shrink-0 place-items-center text-sm font-bold text-white/60 tabular-nums">
                                                {person.place <= 3 ? (
                                                    <Medal
                                                        className={cn(
                                                            'size-5',
                                                            MEDAL[
                                                                person.place - 1
                                                            ],
                                                        )}
                                                    />
                                                ) : (
                                                    person.place
                                                )}
                                            </span>
                                            <UserAvatar
                                                user={person}
                                                size="sm"
                                            />
                                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                                                {person.name}
                                            </span>
                                            <span className="shrink-0 text-sm font-semibold text-white tabular-nums">
                                                {person.count}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>
                )}

                {people.length > 0 && (
                    <section className="gc-solid rounded-2xl p-5">
                        <h2 className="font-display text-lg font-bold text-white">
                            {tr('Ви запросили')}
                        </h2>
                        <p className="mt-0.5 text-xs text-white/45">
                            {tr(
                                'Смужки — перші кроки друга: пошта, аватар, перший допис і «Граю в…».',
                            )}
                        </p>
                        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                            {people.map((person) => (
                                <li key={person.id}>
                                    <Link
                                        href={`/${person.username}`}
                                        className="flex min-w-0 items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-[var(--gc-l3)]"
                                    >
                                        <UserAvatar user={person} size="sm" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm text-white">
                                                {person.name}
                                            </span>
                                            <span className="mt-1 flex gap-1">
                                                {STEPS().map(([key, label]) => (
                                                    <span
                                                        key={key}
                                                        title={label}
                                                        aria-label={label}
                                                        className={cn(
                                                            'h-1 flex-1 rounded-full',
                                                            person.steps[key]
                                                                ? 'bg-primary'
                                                                : 'bg-white/[0.1]',
                                                        )}
                                                    />
                                                ))}
                                            </span>
                                        </span>
                                        <span
                                            className={cn(
                                                'shrink-0 rounded-chip px-2 py-0.5 text-[11px]',
                                                person.active
                                                    ? 'bg-emerald-400/10 text-emerald-200'
                                                    : 'gc-solid-2 text-white/50',
                                            )}
                                        >
                                            {person.active
                                                ? tr('Активний')
                                                : tr('Чекаємо підтвердження')}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </>
    );
}
