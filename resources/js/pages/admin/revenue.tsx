import { Head, Link } from '@inertiajs/react';
import { motion, useReducedMotion } from 'motion/react';
import { money as uah, units } from '@/lib/billing';
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
                    'Гроші — оплати карткою за 12 місяців. Підписки й просування за одиниці балансу — окремо: це використання вже оплачених послуг.',
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
                <div className="flex flex-wrap items-baseline justify-between gap-3 text-xs text-white/55">
                    <span>
                        {tr(
                            'Оплати карткою за місяцями (зокрема поповнення балансу)',
                        )}
                    </span>
                    <span>
                        {tr(
                            'Використано одиниць балансу: частка платформи з підписок {fee}, просування спільнот {promo}',
                            {
                                fee: units(
                                    months.reduce(
                                        (sum, m) => sum + m.author_fee,
                                        0,
                                    ),
                                ),
                                promo: units(
                                    months.reduce((sum, m) => sum + m.promo, 0),
                                ),
                            },
                        )}
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
                                className="w-full rounded-md bg-gc-indigo"
                            />
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
                        {tr('Автори з найбільшим нарахуванням одиниць')}
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
