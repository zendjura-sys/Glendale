import { Head, Link, router } from '@inertiajs/react';
import { CalendarClock, Check, Gift, Users } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { RewardIcon, rewardKind } from '@/components/season/level-track';
import type { Reward } from '@/components/season/level-track';
import {
    eventColors,
    metricLabel,
    metricNoun,
} from '@/components/season/site-event-theme';
import { Button } from '@/components/ui/button';
import { formatDate, shortNumber } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { motionOr, RISE } from '@/lib/motion';
import { cn } from '@/lib/utils';

type Task = { metric: string; target: number; done: number };

type EventCard = {
    id: number;
    slug: string;
    title: string;
    description: string | null;
    theme: string;
    starts_at: string;
    ends_at: string;
    active: boolean;
    tasks: Task[];
    goal: { metric: string; target: number; done: number } | null;
    reward: Reward[];
    complete: boolean;
    claimed: boolean;
    claimers: number;
};

type Props = {
    event: EventCard | null;
    past: {
        slug: string;
        title: string;
        theme: string;
        starts_at: string;
        ends_at: string;
        active: boolean;
    }[];
    next: { title: string; starts_at: string } | null;
};

function daysLeft(until: string): number {
    return Math.max(
        0,
        Math.ceil((new Date(until).getTime() - Date.now()) / 86_400_000),
    );
}

export default function SiteEventPage({ event, past, next }: Props) {
    const reduce = useReducedMotion();
    const [busy, setBusy] = useState(false);

    const claim = () => {
        if (!event) return;
        setBusy(true);
        router.post(
            `/season-events/${event.slug}/claim`,
            {},
            { preserveScroll: true, onFinish: () => setBusy(false) },
        );
    };

    return (
        <>
            <Head title={event?.title ?? tr('Сезонні події')} />
            <div className="mx-auto max-w-3xl space-y-5">
                {event ? (
                    <>
                        <m.section
                            initial={reduce ? false : { opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={motionOr(reduce, RISE)}
                            data-on-dark
                            className="relative overflow-hidden rounded-xl p-5 text-white sm:p-7"
                            style={{
                                backgroundImage: `linear-gradient(125deg, ${eventColors(event.theme).join(', ')})`,
                            }}
                        >
                            <p className="text-sm text-white/75">
                                {tr('Сезонна подія')}
                            </p>
                            <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
                                {event.title}
                            </h1>
                            {event.description && (
                                <p className="mt-2 max-w-xl text-sm text-white/85">
                                    {event.description}
                                </p>
                            )}
                            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/80">
                                <span className="flex items-center gap-1.5">
                                    <CalendarClock className="size-4" />
                                    {event.active
                                        ? tr('Ще {n} дн.', {
                                              n: daysLeft(event.ends_at),
                                          })
                                        : tr('Завершилась {date}', {
                                              date: formatDate(event.ends_at),
                                          })}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Users className="size-4" />
                                    {tr('Нагороду забрали: {n}', {
                                        n: shortNumber(event.claimers),
                                    })}
                                </span>
                            </p>
                        </m.section>

                        {event.goal && (
                            <section className="gc-solid rounded-xl p-4 sm:p-5">
                                <h2 className="font-display text-lg font-bold text-white">
                                    {tr('Спільна мета')}
                                </h2>
                                <p className="mt-1 text-sm text-white/60">
                                    {tr('Разом: {done} з {target} {noun}', {
                                        done: shortNumber(event.goal.done),
                                        target: shortNumber(event.goal.target),
                                        noun: metricNoun(event.goal.metric),
                                    })}
                                </p>
                                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                                    <m.div
                                        className="h-full rounded-full bg-primary"
                                        initial={
                                            reduce ? false : { width: '0%' }
                                        }
                                        animate={{
                                            width: `${Math.min(100, (event.goal.done / event.goal.target) * 100)}%`,
                                        }}
                                        transition={motionOr(reduce, {
                                            duration: 0.9,
                                            ease: 'easeOut',
                                        })}
                                    />
                                </div>
                            </section>
                        )}

                        <section className="gc-solid rounded-xl p-4 sm:p-5">
                            <h2 className="font-display text-lg font-bold text-white">
                                {tr('Завдання події')}
                            </h2>
                            <ul className="mt-3 space-y-3">
                                {event.tasks.map((t) => {
                                    const ok = t.done >= t.target;

                                    return (
                                        <li
                                            key={t.metric}
                                            className="flex items-center gap-3"
                                        >
                                            <span
                                                className={cn(
                                                    'flex size-8 shrink-0 items-center justify-center rounded-full',
                                                    ok
                                                        ? 'bg-emerald-500 text-white'
                                                        : 'bg-white/10 text-white/50',
                                                )}
                                            >
                                                <Check className="size-4" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-medium text-white">
                                                    {metricLabel(
                                                        t.metric,
                                                        t.target,
                                                    )}
                                                </div>
                                                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                                                    <div
                                                        className="h-full rounded-full bg-primary"
                                                        style={{
                                                            width: `${(t.done / t.target) * 100}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <span className="text-sm text-white/60 tabular-nums">
                                                {t.done}/{t.target}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                            <p className="mt-3 text-xs text-white/45">
                                {tr(
                                    'Рахується все, що ви зробили з початку події.',
                                )}
                            </p>
                        </section>

                        <section className="gc-solid rounded-xl p-4 sm:p-5">
                            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                                <Gift className="size-5 text-primary" />
                                {tr('Нагорода')}
                            </h2>
                            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                                {event.reward.map((r) => (
                                    <li
                                        key={`${r.type}:${r.value}`}
                                        className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2"
                                    >
                                        <RewardIcon reward={r} />
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold text-white">
                                                {r.name}
                                            </div>
                                            <div className="text-xs text-white/45">
                                                {rewardKind(r.type)}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-4 flex flex-wrap items-center gap-3">
                                {event.claimed ? (
                                    <>
                                        <span className="text-sm text-emerald-400">
                                            {tr(
                                                'Нагорода вже у вашому інвентарі.',
                                            )}
                                        </span>
                                        <Button asChild variant="secondary">
                                            <Link href="/season">
                                                {tr('Вдягнути')}
                                            </Link>
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        disabled={!event.complete || busy}
                                        onClick={claim}
                                    >
                                        {event.complete
                                            ? tr('Забрати нагороду')
                                            : tr('Виконайте всі завдання')}
                                    </Button>
                                )}
                            </div>
                        </section>
                    </>
                ) : (
                    <section className="gc-solid rounded-xl p-6 text-center">
                        <h1 className="font-display text-2xl font-bold text-white">
                            {tr('Зараз подій немає')}
                        </h1>
                        <p className="mt-2 text-sm text-white/60">
                            {next
                                ? tr('Наступна — «{title}», з {date}.', {
                                      title: next.title,
                                      date: formatDate(next.starts_at),
                                  })
                                : tr(
                                      'Сезонні події з’являються до свят і великих оновлень — слідкуйте за стрічкою.',
                                  )}
                        </p>
                    </section>
                )}

                {past.length > 0 && (
                    <section className="space-y-2">
                        <h2 className="font-display text-lg font-bold text-white">
                            {tr('Інші події')}
                        </h2>
                        <ul className="grid gap-2 sm:grid-cols-2">
                            {past.map((p) => (
                                <li key={p.slug}>
                                    <Link
                                        href={`/season-events/${p.slug}`}
                                        className="gc-solid flex items-center gap-3 rounded-xl p-3 hover:bg-white/5"
                                    >
                                        <span
                                            className="size-10 shrink-0 rounded-lg"
                                            style={{
                                                backgroundImage: `linear-gradient(135deg, ${eventColors(p.theme).join(', ')})`,
                                            }}
                                        />
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-semibold text-white">
                                                {p.title}
                                            </span>
                                            <span className="block text-xs text-white/50">
                                                {formatDate(p.starts_at)} —{' '}
                                                {formatDate(p.ends_at)}
                                            </span>
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
