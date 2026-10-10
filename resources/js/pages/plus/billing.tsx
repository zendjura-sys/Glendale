import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowDownLeft,
    ArrowUpRight,
    Clock,
    RefreshCw,
    Wallet,
    Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { PayMethod, TopupCard } from '@/components/billing/billing-host';
import { PlusTabs } from '@/components/billing/plus-tabs';
import { Toggle } from '@/components/gc/admin';
import { PlusBadge } from '@/components/gc/plus';
import { api } from '@/lib/api';
import { money, openTopup, TX_LABELS } from '@/lib/billing';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { PLUS_PRICES, PRODUCT_LABELS } from '@/lib/plus';
import type { PlusProduct } from '@/lib/plus';
import { cn } from '@/lib/utils';

type Renewal = {
    owner_type: 'user' | 'family';
    owner_id: number;
    name: string | null;
    until: string | null;
    product: string | null;
    active: boolean;
    failed: boolean;
};

type Transaction = {
    id: number;
    amount: number;
    balance_after: number;
    type: string;
    description: string;
    product: string | null;
    created_at: string;
};

type Props = {
    balance: number;
    methods: PayMethod[];
    topups: TopupCard[];
    transactions: Transaction[];
    renewals: Renewal[];
    open: number | null;
};

const btn =
    'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-40';
const primary = cn(
    btn,
    'bg-[var(--btn-primary,#6366f1)] text-white hover:opacity-90',
);
const secondary = cn(btn, 'bg-white/[0.06] text-white/85 hover:bg-white/10');

/** Білінг (лише сайт, вкладка GameCon+): баланс, поповнення донатом, автопродовження й історія операцій. */
export default function BillingPage({
    balance,
    methods,
    topups,
    transactions,
    renewals,
    open,
}: Props) {
    useEffect(() => {
        if (open) openTopup({ topupId: open });
    }, [open]);

    const pending = topups.filter((t) => t.status === 'pending');

    return (
        <>
            <Head title={tr('Рахунок — GameCon+')} />
            <div className="mx-auto max-w-3xl space-y-5">
                <PlusTabs current="billing" balance={balance} />
                <section className="glass relative overflow-hidden rounded-3xl p-5 sm:p-7">
                    <p className="flex items-center gap-2 text-sm text-white/55">
                        <Wallet className="size-4 text-indigo-300" />
                        {tr('Особистий рахунок GameCon')}
                    </p>
                    <p className="mt-2 font-display text-4xl font-bold text-white tabular-nums sm:text-5xl">
                        {money(balance)}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                        <button
                            type="button"
                            className={primary}
                            disabled={methods.length === 0}
                            onClick={() => openTopup()}
                        >
                            <ArrowDownLeft className="size-4" />
                            {tr('Поповнити')}
                        </button>
                        <Link href="/plus" className={secondary}>
                            <PlusBadge className="size-4 rounded [&_svg]:size-3" />
                            GameCon+
                        </Link>
                    </div>
                    {methods.length === 0 ? (
                        <p className="mt-4 text-xs text-white/45">
                            {tr(
                                'Поповнення тимчасово недоступне — адміністрація налаштовує способи оплати.',
                            )}
                        </p>
                    ) : (
                        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/45">
                            {tr('Поповнення донатом:')}
                            {methods.map((m) => (
                                <span
                                    key={m.key}
                                    className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-white/70"
                                >
                                    {m.auto && (
                                        <Zap className="size-3 text-amber-200" />
                                    )}
                                    {m.label}
                                </span>
                            ))}
                        </p>
                    )}
                </section>

                {pending.length > 0 && (
                    <section className="glass rounded-3xl p-5">
                        <h2 className="font-display text-lg font-bold text-white">
                            {tr('Заявки на поповнення')}
                        </h2>
                        <ul className="mt-3 divide-y divide-white/[0.06]">
                            {pending.map((t) => (
                                <TopupRow key={t.id} topup={t} />
                            ))}
                        </ul>
                    </section>
                )}

                <section className="glass rounded-3xl p-5">
                    <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                        <RefreshCw className="size-5 text-indigo-300" />
                        {tr('Автопродовження')}
                    </h2>
                    <p className="mt-1 text-sm text-white/55">
                        {tr(
                            'За добу до кінця періоду ціна списується з рахунку. Не вистачає коштів — надішлемо сповіщення й спробуємо знову після поповнення.',
                        )}
                    </p>
                    <ul className="mt-4 space-y-3">
                        {renewals.map((r) => (
                            <RenewalRow
                                key={`${r.owner_type}-${r.owner_id}`}
                                renewal={r}
                            />
                        ))}
                    </ul>
                </section>

                <section className="glass rounded-3xl p-5">
                    <h2 className="font-display text-lg font-bold text-white">
                        {tr('Історія')}
                    </h2>
                    {transactions.length === 0 ? (
                        <p className="mt-3 text-sm text-white/40">
                            {tr('Операцій ще не було.')}
                        </p>
                    ) : (
                        <ul className="mt-3 divide-y divide-white/[0.06]">
                            {transactions.map((t) => (
                                <li
                                    key={t.id}
                                    className="flex items-center gap-3 py-2.5 text-sm"
                                >
                                    <span
                                        className={cn(
                                            'flex size-8 shrink-0 items-center justify-center rounded-full',
                                            t.amount > 0
                                                ? 'bg-emerald-400/10 text-emerald-300'
                                                : 'bg-white/[0.06] text-white/60',
                                        )}
                                    >
                                        {t.amount > 0 ? (
                                            <ArrowDownLeft className="size-4" />
                                        ) : (
                                            <ArrowUpRight className="size-4" />
                                        )}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-white">
                                            {t.product
                                                ? (PRODUCT_LABELS()[
                                                      t.product
                                                  ] ?? t.description)
                                                : t.description}
                                        </span>
                                        <span className="text-xs text-white/40">
                                            {TX_LABELS()[t.type] ?? t.type} ·{' '}
                                            {formatDate(t.created_at)}
                                        </span>
                                    </span>
                                    <span
                                        className={cn(
                                            'font-semibold tabular-nums',
                                            t.amount > 0
                                                ? 'text-emerald-200'
                                                : 'text-white/85',
                                        )}
                                    >
                                        {t.amount > 0 ? '+' : '−'}
                                        {money(Math.abs(t.amount))}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <p className="px-2 text-center text-xs text-white/40">
                    {tr(
                        'Кошти на рахунку не виводяться готівкою; невикористане поповнення можна повернути протягом 14 днів — див.',
                    )}{' '}
                    <Link href="/refund-policy" className="underline">
                        {tr('Політика повернення коштів і скасування')}
                    </Link>
                    .
                </p>
            </div>
        </>
    );
}

function TopupRow({ topup }: { topup: TopupCard }) {
    const cancel = () => {
        if (
            !window.confirm(
                tr('Скасувати заявку {code}?', { code: topup.code }),
            )
        )
            return;
        void api('DELETE', `/plus/billing/topups/${topup.id}`)
            .then(() => router.reload())
            .catch((e) => toast.error((e as Error).message));
    };

    return (
        <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 text-sm">
            <span className="min-w-0 flex-1">
                <span className="block font-mono font-semibold text-white">
                    {topup.code}
                </span>
                <span className="flex items-center gap-1 text-xs text-white/45">
                    <Clock className="size-3" />
                    {topup.claimed
                        ? tr('Перевіряємо донат')
                        : tr('Чекає на донат до {date}', {
                              date: formatDate(topup.expires_at),
                          })}
                </span>
            </span>
            <span className="font-semibold text-white tabular-nums">
                {topup.amount} ₴
            </span>
            <span className="flex w-full gap-2 sm:w-auto">
                <button
                    type="button"
                    className={cn(primary, 'h-9 flex-1 sm:flex-none')}
                    onClick={() => openTopup({ topupId: topup.id })}
                >
                    {topup.claimed ? tr('Деталі') : tr('Оплатити')}
                </button>
                <button
                    type="button"
                    className={cn(secondary, 'h-9 flex-1 sm:flex-none')}
                    onClick={cancel}
                >
                    {tr('Скасувати')}
                </button>
            </span>
        </li>
    );
}

function RenewalRow({ renewal }: { renewal: Renewal }) {
    const family = renewal.owner_type === 'family';
    const options: PlusProduct[] = family
        ? ['family_month', 'family_year']
        : ['plus_month', 'plus_year'];
    const [product, setProduct] = useState<string>(
        renewal.product ?? options[0],
    );
    const [busy, setBusy] = useState(false);

    const save = (active: boolean, next = product) => {
        setBusy(true);
        void api('POST', '/plus/billing/renewals', {
            product: next,
            active,
            family_id: family ? renewal.owner_id : null,
        })
            .then(() =>
                router.reload({
                    only: ['renewals', 'balance', 'transactions'],
                }),
            )
            .catch((e) => toast.error((e as Error).message))
            .finally(() => setBusy(false));
    };

    return (
        <li className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/[0.04] p-4">
            <span className="min-w-0 flex-1">
                <span className="block font-semibold text-white">
                    {family ? renewal.name : tr('Мій GameCon+')}
                </span>
                <span
                    className={cn(
                        'text-xs',
                        renewal.failed ? 'text-amber-200' : 'text-white/45',
                    )}
                >
                    {renewal.failed
                        ? tr('Бракує коштів — поповніть рахунок')
                        : renewal.until &&
                            new Date(renewal.until).getTime() > Date.now()
                          ? tr('Діє до {date}', {
                                date: formatDate(renewal.until),
                            })
                          : tr('Не активний')}
                </span>
            </span>
            <select
                value={product}
                disabled={busy}
                onChange={(e) => {
                    setProduct(e.target.value);
                    if (renewal.active) save(true, e.target.value);
                }}
                className="input-glass h-9 rounded-xl px-2.5 text-sm text-white"
                aria-label={tr('Період')}
            >
                {options.map((p) => (
                    <option key={p} value={p}>
                        {p.endsWith('_year') ? tr('Рік') : tr('Місяць')} ·{' '}
                        {PLUS_PRICES[p]} ₴
                    </option>
                ))}
            </select>
            <Toggle
                checked={renewal.active}
                onChange={(v) => save(v)}
                label={tr('Автопродовження')}
            />
        </li>
    );
}
