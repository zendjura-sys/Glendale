import { Head, Link, router } from '@inertiajs/react';
import {
    Cake,
    CalendarClock,
    CalendarDays,
    MessageCircle,
    Newspaper,
    RefreshCw,
    Sparkles,
    Target,
    Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { EmptyState } from '@/components/gc/widget';
import { tr } from '@/lib/i18n';

type Fact = { icon: string; text: string; href: string | null };

const ICONS: Record<string, LucideIcon> = {
    shift: CalendarClock,
    event: CalendarDays,
    tournament: Trophy,
    birthday: Cake,
    quest: Target,
    unread: MessageCircle,
    post: Newspaper,
};

/** «Сьогодні»: факти дня людини й короткий переказ від ШІ поверх них. */
export default function Today({
    date,
    facts,
    summary,
    ai,
}: {
    date: string;
    facts: Fact[];
    summary: string | null;
    ai: boolean;
}) {
    const reduce = useReducedMotion();
    const [busy, setBusy] = useState(false);
    const day = new Date(`${date}T12:00:00`).toLocaleDateString('uk-UA', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });

    return (
        <>
            <Head title={tr('Сьогодні')} />
            <div className="mx-auto max-w-[640px] space-y-4">
                <header>
                    <h1 className="font-display text-xl font-semibold text-white sm:text-2xl">
                        {tr('Сьогодні')}
                    </h1>
                    <p className="mt-1 text-sm text-white/45 first-letter:uppercase">
                        {day}
                    </p>
                </header>

                {ai && facts.length > 0 && (
                    <section
                        className="gc-solid rounded-2xl p-4"
                        data-today-summary
                    >
                        <div className="mb-2 flex items-center gap-2">
                            <Sparkles className="size-4 text-primary" />
                            <h2 className="text-sm font-semibold text-white">
                                {tr('Зведення дня')}
                            </h2>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                    router.get(
                                        '/today',
                                        { refresh: 1 },
                                        {
                                            preserveScroll: true,
                                            replace: true,
                                            onStart: () => setBusy(true),
                                            onFinish: () => setBusy(false),
                                        },
                                    )
                                }
                                aria-label={tr('Оновити зведення')}
                                className="ml-auto grid size-8 place-items-center rounded-lg text-white/55 transition hover:text-white disabled:opacity-40"
                            >
                                <RefreshCw
                                    className={
                                        busy && !reduce
                                            ? 'size-4 animate-spin'
                                            : 'size-4'
                                    }
                                />
                            </button>
                        </div>
                        <p className="text-[15px] leading-relaxed text-white/85">
                            {summary ??
                                tr(
                                    'ШІ зараз не відповідає — нижче все, що чекає на вас сьогодні.',
                                )}
                        </p>
                    </section>
                )}

                {facts.length === 0 ? (
                    <EmptyState
                        icon={CalendarDays}
                        title={tr('Сьогодні тихо')}
                        text={tr(
                            'Подій, змін і непрочитаного немає. Загляньте в стрічку або знайдіть, з ким пограти.',
                        )}
                    />
                ) : (
                    <ul
                        className="gc-solid divide-y divide-white/[0.06] rounded-2xl"
                        data-today-facts
                    >
                        {facts.map((fact, i) => {
                            const Icon = ICONS[fact.icon] ?? CalendarDays;
                            const body = (
                                <>
                                    <Icon className="mt-0.5 size-[18px] shrink-0 text-primary" />
                                    <span className="min-w-0 text-sm text-white/85">
                                        {fact.text}
                                    </span>
                                </>
                            );

                            return (
                                <m.li
                                    key={`${fact.icon}-${i}`}
                                    initial={
                                        reduce ? false : { opacity: 0, y: 6 }
                                    }
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{
                                        delay: reduce ? 0 : i * 0.03,
                                    }}
                                >
                                    {fact.href ? (
                                        <Link
                                            href={fact.href}
                                            className="flex gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
                                        >
                                            {body}
                                        </Link>
                                    ) : (
                                        <div className="flex gap-3 px-4 py-3">
                                            {body}
                                        </div>
                                    )}
                                </m.li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </>
    );
}
