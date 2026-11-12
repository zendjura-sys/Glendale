import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    Crown,
    Minus,
    Swords,
    Trophy,
    UsersRound,
} from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { FamilyLogo } from '@/components/families/family-logo';
import { Segmented } from '@/components/families/ui';
import { Toggle } from '@/components/gc/admin';
import { EmptyState } from '@/components/gc/widget';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FamilyCard, GtaServerCard } from '@/types';

type Period = 'week' | 'month' | 'all';

type Row = FamilyCard & {
    place: number;
    points: number;
    bizwar_wins: number;
    contracts: number;
    events: number;
    active: number;
    change: number | null;
};

type Props = {
    server: GtaServerCard;
    period: Period;
    periods: Record<Period, string>;
    rows: Row[];
};

const MEDAL = ['text-amber-300', 'text-slate-200', 'text-orange-300'];

function Change({ value }: { value: number | null }) {
    if (value === null) {
        return <span className="text-xs text-white/30">{tr('нова')}</span>;
    }
    if (value === 0) {
        return (
            <Minus
                className="size-3.5 text-white/30"
                aria-label={tr('Без змін')}
            />
        );
    }
    const up = value > 0;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums',
                up ? 'text-emerald-400' : 'text-rose-400',
            )}
            aria-label={
                up
                    ? tr('Піднялась на {n}', { n: value })
                    : tr('Опустилась на {n}', { n: -value })
            }
        >
            {up ? (
                <ArrowUp className="size-3.5" />
            ) : (
                <ArrowDown className="size-3.5" />
            )}
            {Math.abs(value)}
        </span>
    );
}

/** Сервер → публічний рейтинг сімей: п’єдестал, таблиця, період і фільтр «набір відкрито». */
export default function ServerFamilies({
    server,
    period,
    periods,
    rows,
}: Props) {
    const reduce = useReducedMotion();
    const [recruiting, setRecruiting] = useState(false);
    const list = recruiting ? rows.filter((r) => r.is_recruiting) : rows;
    const podium = list.slice(0, 3);
    const order = [1, 0, 2].filter((i) => podium[i]);

    return (
        <>
            <Head
                title={tr('Рейтинг сімей · {server}', { server: server.name })}
            />
            <div className="space-y-4">
                <header className="flex flex-wrap items-center gap-3">
                    <Link
                        href={`/servers/${server.slug}`}
                        className="grid size-10 place-items-center rounded-xl text-white/60 hover:bg-white/[0.06] hover:text-white"
                        aria-label={tr('До сервера')}
                    >
                        <ArrowLeft className="size-5" />
                    </Link>
                    <div className="min-w-0 flex-1">
                        <h1 className="font-display text-2xl font-bold text-white">
                            {tr('Рейтинг сімей')}
                        </h1>
                        <p className="text-sm text-white/50">{server.name}</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-white/70">
                        {tr('Лише з відкритим набором')}
                        <Toggle
                            checked={recruiting}
                            onChange={setRecruiting}
                            label={tr('Лише з відкритим набором')}
                        />
                    </label>
                    <Segmented
                        value={period}
                        options={(Object.keys(periods) as Period[]).map(
                            (p) => ({
                                value: p,
                                label: periods[p],
                            }),
                        )}
                        onChange={(p) =>
                            router.get(
                                `/servers/${server.slug}/families`,
                                { period: p },
                                { preserveScroll: true, preserveState: true },
                            )
                        }
                    />
                </header>

                {list.length === 0 ? (
                    <section className="gc-solid rounded-2xl p-5">
                        <EmptyState
                            icon={Crown}
                            title={
                                recruiting
                                    ? tr('Зараз ніхто не набирає')
                                    : tr('Тут ще немає сімей')
                            }
                            text={tr(
                                'Сім’ї з’являються в рейтингу після верифікації й перших звітів.',
                            )}
                        />
                    </section>
                ) : (
                    <>
                        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
                            {order.map((i, k) => {
                                const row = podium[i];

                                return (
                                    <m.div
                                        key={row.id}
                                        initial={
                                            reduce
                                                ? false
                                                : { opacity: 0, y: 12 }
                                        }
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: k * 0.06 }}
                                        className={cn(i === 0 && 'sm:-mt-6')}
                                    >
                                        <Link
                                            href={`/f/${row.slug}`}
                                            className={cn(
                                                'gc-solid flex flex-col items-center gap-2 rounded-2xl p-5 text-center hover:bg-[var(--gc-l3)]',
                                                i === 0 && 'sm:pb-8',
                                            )}
                                        >
                                            <Trophy
                                                className={cn(
                                                    'size-6',
                                                    MEDAL[i],
                                                )}
                                            />
                                            <FamilyLogo family={row} />
                                            <div className="font-semibold break-words text-white">
                                                <span className="text-sky-400">
                                                    [{row.tag}]
                                                </span>{' '}
                                                {row.name}
                                            </div>
                                            <div className="font-display text-3xl font-bold text-white tabular-nums">
                                                {row.points}
                                            </div>
                                            <div className="text-xs text-white/45">
                                                {tr('балів')} ·{' '}
                                                {tr('{n} учасн.', {
                                                    n: row.members_count,
                                                })}
                                            </div>
                                        </Link>
                                    </m.div>
                                );
                            })}
                        </div>

                        <section className="gc-solid overflow-x-auto rounded-2xl">
                            <table className="w-full min-w-[640px] text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-white/40">
                                        <th className="px-4 py-3 font-medium">
                                            #
                                        </th>
                                        <th className="px-2 py-3 font-medium">
                                            {tr('Сім’я')}
                                        </th>
                                        <th className="px-2 py-3 text-right font-medium">
                                            {tr('Бали')}
                                        </th>
                                        <th className="px-2 py-3 text-right font-medium">
                                            <Swords
                                                className="ml-auto size-3.5"
                                                aria-label={tr(
                                                    'Перемоги в бізварах',
                                                )}
                                            />
                                        </th>
                                        <th className="px-2 py-3 text-right font-medium">
                                            {tr('Контракти')}
                                        </th>
                                        <th className="px-2 py-3 text-right font-medium">
                                            {tr('Події')}
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            {tr('Активні')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {list.map((row) => (
                                        <tr
                                            key={row.id}
                                            className="cursor-pointer hover:bg-[var(--gc-l3)]"
                                            onClick={() =>
                                                router.visit(`/f/${row.slug}`)
                                            }
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={cn(
                                                            'w-6 font-display text-base font-bold tabular-nums',
                                                            MEDAL[
                                                                row.place - 1
                                                            ] ??
                                                                'text-white/35',
                                                        )}
                                                    >
                                                        {row.place}
                                                    </span>
                                                    <Change
                                                        value={row.change}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-2 py-3">
                                                <Link
                                                    href={`/f/${row.slug}`}
                                                    className="flex items-center gap-3"
                                                >
                                                    <FamilyLogo family={row} />
                                                    <span className="min-w-0">
                                                        <span className="block font-semibold break-words text-white">
                                                            <span className="text-sky-400">
                                                                [{row.tag}]
                                                            </span>{' '}
                                                            {row.name}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-xs text-white/45">
                                                            <UsersRound className="size-3" />
                                                            {row.members_count}
                                                            {row.is_recruiting && (
                                                                <span className="ml-1 rounded-md bg-emerald-500/15 px-1.5 text-emerald-300">
                                                                    {tr(
                                                                        'набір',
                                                                    )}
                                                                </span>
                                                            )}
                                                        </span>
                                                    </span>
                                                </Link>
                                            </td>
                                            <td className="px-2 py-3 text-right font-display text-base font-bold text-white tabular-nums">
                                                {row.points}
                                            </td>
                                            <td className="px-2 py-3 text-right text-white/70 tabular-nums">
                                                {row.bizwar_wins}
                                            </td>
                                            <td className="px-2 py-3 text-right text-white/70 tabular-nums">
                                                {row.contracts}
                                            </td>
                                            <td className="px-2 py-3 text-right text-white/70 tabular-nums">
                                                {row.events}
                                            </td>
                                            <td className="px-4 py-3 text-right text-white/70 tabular-nums">
                                                {row.active}/{row.members_count}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>
                        <p className="text-xs text-white/40">
                            {tr(
                                'Бали — сума балів учасників за звіти (бізвари, контракти, інвестиції) і події. Стрілка — зміна місця від учора.',
                            )}
                        </p>
                    </>
                )}
            </div>
        </>
    );
}
