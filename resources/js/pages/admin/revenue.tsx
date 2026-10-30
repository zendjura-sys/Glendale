import { Head, Link } from '@inertiajs/react';
import { motion, useReducedMotion } from 'motion/react';
import { uah } from '@/components/billing/support-author';
import { PageHeader } from '@/components/gc/admin';
import { tr } from '@/lib/i18n';

type Month = {
    month: string;
    payments: number;
    author_fee: number;
    promo: number;
    total: number;
};

const monthLabel = (key: string) =>
    new Date(`${key}-01T00:00:00`).toLocaleDateString('uk-UA', {
        month: 'short',
        year: '2-digit',
    });

/** Адмінка → «Доходи»: 12 місяців за джерелами, найкращі продукти й автори. */
export default function AdminRevenue({
    months,
    totals,
    products,
    authors,
}: {
    months: Month[];
    totals: { year: number; month: number; previous: number; refunded: number };
    products: { product: string; count: number; sum: number }[];
    authors: { id: number; name: string; username: string; sum: number }[];
}) {
    const reduce = useReducedMotion();
    const max = Math.max(1, ...months.map((m) => m.total));
    const change =
        totals.previous > 0
            ? Math.round(
                  ((totals.month - totals.previous) / totals.previous) * 100,
              )
            : null;

    return (
        <>
            <Head title={tr('Доходи — Адмін-панель')} />
            <PageHeader
                title={tr('Доходи')}
                description={tr(
                    'GameCon+ і покупки, комісія з підписок на авторів, просування спільнот — за 12 місяців.',
                )}
            />
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    [tr('За 12 місяців'), uah(totals.year), null],
                    [
                        tr('Цей місяць'),
                        uah(totals.month),
                        change === null
                            ? null
                            : `${change >= 0 ? '+' : ''}${change}%`,
                    ],
                    [tr('Минулий місяць'), uah(totals.previous), null],
                    [tr('Повернено'), uah(totals.refunded), null],
                ].map(([label, value, hint]) => (
                    <div key={label} className="glass rounded-2xl p-4">
                        <p className="text-xs text-white/45">{label}</p>
                        <p className="mt-1 font-display text-xl font-semibold text-white tabular-nums">
                            {value}
                            {hint && (
                                <span className="ml-2 text-xs font-medium text-emerald-300">
                                    {hint}
                                </span>
                            )}
                        </p>
                    </div>
                ))}
            </div>

            <section className="glass mb-4 rounded-2xl p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-4 text-xs text-white/55">
                    <span className="inline-flex items-center gap-1.5">
                        <span className="size-2.5 rounded-sm bg-gc-indigo" />
                        {tr('Платежі')}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="size-2.5 rounded-sm bg-sky-400" />
                        {tr('Комісія з підписок')}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="size-2.5 rounded-sm bg-white/50" />
                        {tr('Просування')}
                    </span>
                </div>
                <div className="mt-4 flex h-48 items-end gap-1.5 sm:gap-2.5">
                    {months.map((m, i) => (
                        <div
                            key={m.month}
                            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                            title={`${monthLabel(m.month)}: ${uah(m.total)}`}
                        >
                            <motion.div
                                initial={reduce ? false : { height: 0 }}
                                animate={{
                                    height: `${(m.total / max) * 100}%`,
                                }}
                                transition={{ delay: i * 0.03, duration: 0.5 }}
                                className="flex w-full flex-col-reverse overflow-hidden rounded-md"
                            >
                                {(
                                    [
                                        [m.payments, 'bg-gc-indigo'],
                                        [m.author_fee, 'bg-sky-400'],
                                        [m.promo, 'bg-white/50'],
                                    ] as const
                                ).map(([v, color]) =>
                                    v > 0 ? (
                                        <div
                                            key={color}
                                            className={color}
                                            style={{
                                                height: `${(v / Math.max(1, m.total)) * 100}%`,
                                            }}
                                        />
                                    ) : null,
                                )}
                            </motion.div>
                            <span className="text-[10px] text-white/40">
                                {monthLabel(m.month)}
                            </span>
                        </div>
                    ))}
                </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
                <section className="glass rounded-2xl p-4 sm:p-5">
                    <h2 className="font-display text-base font-semibold text-white">
                        {tr('Продукти')}
                    </h2>
                    <ul className="mt-3 divide-y divide-white/[0.06] text-sm">
                        {products.length === 0 && (
                            <li className="py-3 text-white/45">
                                {tr('Поки немає оплат.')}
                            </li>
                        )}
                        {products.map((p) => (
                            <li
                                key={p.product}
                                className="flex justify-between gap-3 py-2.5"
                            >
                                <span className="truncate text-white/80">
                                    {p.product}
                                </span>
                                <span className="shrink-0 text-white/55 tabular-nums">
                                    {p.count} ·{' '}
                                    <span className="text-white">
                                        {uah(p.sum)}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
                <section className="glass rounded-2xl p-4 sm:p-5">
                    <h2 className="font-display text-base font-semibold text-white">
                        {tr('Автори з найбільшим доходом')}
                    </h2>
                    <ul className="mt-3 divide-y divide-white/[0.06] text-sm">
                        {authors.length === 0 && (
                            <li className="py-3 text-white/45">
                                {tr('Поки ніхто не отримував підписок.')}
                            </li>
                        )}
                        {authors.map((a) => (
                            <li
                                key={a.id}
                                className="flex justify-between gap-3 py-2.5"
                            >
                                <Link
                                    href={`/${a.username}`}
                                    className="truncate text-white/80 hover:underline"
                                >
                                    {a.name}
                                </Link>
                                <span className="shrink-0 text-white tabular-nums">
                                    {uah(a.sum)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </>
    );
}
