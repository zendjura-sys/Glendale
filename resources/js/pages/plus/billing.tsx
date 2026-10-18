import { Head, Link, router } from '@inertiajs/react';
import {
    CheckCircle2,
    Clock,
    CreditCard,
    ExternalLink,
    RefreshCw,
    Trash2,
    XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PaymentBadges } from '@/components/billing/payment-badges';
import { PlusTabs } from '@/components/billing/plus-tabs';
import { Toggle } from '@/components/gc/admin';
import { PlusBadge } from '@/components/gc/plus';
import { api } from '@/lib/api';
import { money, ORDER_STATUS, useProducts } from '@/lib/billing';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { PRODUCT_LABELS } from '@/lib/plus';
import { cn } from '@/lib/utils';
import type { PaymentOrderCard, SavedCard } from '@/types/billing';

type Renewal = {
    owner_type: 'user' | 'family';
    owner_id: number;
    name: string | null;
    until: string | null;
    product: string | null;
    active: boolean;
    failed: boolean;
    card: SavedCard | null;
};

type Props = {
    orders: PaymentOrderCard[];
    cards: SavedCard[];
    renewals: Renewal[];
    /** Залишок старого балансу (до переходу на оплату карткою), копійки. */
    credit: number;
    available: boolean;
    open: number | null;
};

const btn =
    'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-40';
const secondary = cn(btn, 'bg-white/[0.06] text-white/85 hover:bg-white/10');

/** Оплата й підписки (лише сайт, вкладка GameCon+): автопродовження, збережені картки, історія оплат. */
export default function BillingPage({
    orders,
    cards,
    renewals,
    credit,
    available,
    open,
}: Props) {
    const opened = open ? orders.find((o) => o.id === open) : undefined;

    // Повернулися зі сторінки оплати: поки банк думає — питаємо статус кілька разів.
    useEffect(() => {
        if (!opened || opened.status !== 'pending') return;
        let tries = 0;
        const timer = window.setInterval(async () => {
            tries += 1;
            const result = await api<{ order: PaymentOrderCard }>(
                'GET',
                `/plus/billing/orders/${opened.id}`,
            ).catch(() => null);
            if (result && result.order.status !== 'pending') {
                window.clearInterval(timer);
                router.reload();
            }
            if (tries >= 10) window.clearInterval(timer);
        }, 3000);

        return () => window.clearInterval(timer);
    }, [opened]);

    return (
        <>
            <Head title={tr('Оплата й підписки — GameCon+')} />
            <div className="mx-auto max-w-3xl space-y-5">
                <PlusTabs current="billing" />

                {opened && <OrderResult order={opened} />}

                <section className="glass rounded-3xl p-5 sm:p-7">
                    <p className="flex items-center gap-2 text-sm text-white/55">
                        <CreditCard className="size-4 text-indigo-300" />
                        {tr('Оплата карткою через monobank')}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-white/70">
                        {available
                            ? tr(
                                  'GameCon+, подарунки й просування серверів оплачуються карткою Visa чи Mastercard, через Apple Pay, Google Pay або в застосунку monobank — на захищеній сторінці банку.',
                              )
                            : tr(
                                  'Оплата карткою тимчасово недоступна — адміністрація підключає еквайринг.',
                              )}
                    </p>
                    <PaymentBadges className="mt-4" />
                    {credit > 0 && (
                        <p className="mt-4 rounded-2xl bg-emerald-400/10 p-3 text-sm text-emerald-100">
                            {tr(
                                'У вас лишився залишок старого балансу {sum} — він автоматично зарахується в ціну наступної покупки.',
                                { sum: money(credit) },
                            )}
                        </p>
                    )}
                    <div className="mt-5 flex flex-wrap gap-2">
                        <Link href="/plus" className={secondary}>
                            <PlusBadge className="size-4 rounded [&_svg]:size-3" />
                            {tr('Тарифи GameCon+')}
                        </Link>
                    </div>
                </section>

                <section className="glass rounded-3xl p-5">
                    <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                        <RefreshCw className="size-4 text-indigo-300" />
                        {tr('Автопродовження')}
                    </h2>
                    <p className="mt-1 text-sm text-white/50">
                        {tr(
                            'Перед кінцем періоду оплата спишеться зі збереженої картки. Без картки — нагадаємо, щоб ви оплатили вручну.',
                        )}
                    </p>
                    <ul className="mt-3 divide-y divide-white/[0.06]">
                        {renewals.map((r) => (
                            <RenewalRow
                                key={`${r.owner_type}-${r.owner_id}`}
                                renewal={r}
                                cards={cards}
                            />
                        ))}
                    </ul>
                </section>

                <section className="glass rounded-3xl p-5">
                    <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                        <CreditCard className="size-4 text-indigo-300" />
                        {tr('Збережені картки')}
                    </h2>
                    {cards.length === 0 ? (
                        <p className="mt-2 text-sm text-white/50">
                            {tr(
                                'Карток немає. Під час оплати з автопродовженням можна зберегти картку — її токен зберігає monobank, номер картки ми не бачимо.',
                            )}
                        </p>
                    ) : (
                        <ul className="mt-3 space-y-2">
                            {cards.map((card) => (
                                <CardRow key={card.id} card={card} />
                            ))}
                        </ul>
                    )}
                </section>

                <section className="glass rounded-3xl p-5">
                    <h2 className="font-display text-lg font-bold text-white">
                        {tr('Історія оплат')}
                    </h2>
                    {orders.length === 0 ? (
                        <p className="mt-2 text-sm text-white/50">
                            {tr('Оплат ще не було.')}
                        </p>
                    ) : (
                        <ul className="mt-3 divide-y divide-white/[0.06]">
                            {orders.map((o) => (
                                <OrderRow key={o.id} order={o} />
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </>
    );
}

function useProductName(): (key: string) => string {
    const products = useProducts();

    return (key: string) => products[key]?.name ?? PRODUCT_LABELS()[key] ?? key;
}

/** Результат після повернення зі сторінки оплати monobank. */
function OrderResult({ order }: { order: PaymentOrderCard }) {
    const name = useProductName();
    const tone =
        order.status === 'paid'
            ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
            : order.status === 'pending'
              ? 'border-white/10 bg-white/[0.04] text-white/80'
              : 'border-rose-400/30 bg-rose-500/10 text-rose-100';

    return (
        <section
            className={cn(
                'flex items-start gap-3 rounded-3xl border p-4',
                tone,
            )}
        >
            {order.status === 'paid' ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            ) : order.status === 'pending' ? (
                <Clock className="mt-0.5 size-5 shrink-0 animate-pulse" />
            ) : (
                <XCircle className="mt-0.5 size-5 shrink-0" />
            )}
            <div className="min-w-0 text-sm">
                <p className="font-semibold">
                    {order.status === 'paid'
                        ? tr('Оплачено: {name}', { name: name(order.product) })
                        : order.status === 'pending'
                          ? tr('Чекаємо підтвердження від банку…')
                          : tr('Оплата не пройшла')}
                </p>
                {order.failure && order.status !== 'paid' && (
                    <p className="mt-0.5 opacity-80">{order.failure}</p>
                )}
                {order.status === 'pending' && order.page_url && (
                    <a
                        href={order.page_url}
                        className="mt-2 inline-flex items-center gap-1 underline"
                    >
                        {tr('Повернутися до оплати')}
                        <ExternalLink className="size-3.5" />
                    </a>
                )}
            </div>
        </section>
    );
}

function OrderRow({ order }: { order: PaymentOrderCard }) {
    const name = useProductName();
    const statusTone: Record<string, string> = {
        paid: 'text-emerald-200',
        pending: 'text-white/60',
        refunded: 'text-sky-200',
    };

    return (
        <li className="flex items-center gap-3 py-3 text-sm">
            <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">
                    {name(order.product)}
                    {order.kind === 'renewal' && (
                        <span className="ml-2 text-xs text-white/45">
                            {tr('автопродовження')}
                        </span>
                    )}
                </p>
                <p className="text-xs text-white/45">
                    {formatDate(order.paid_at ?? order.created_at)} ·{' '}
                    {order.code}
                    {order.masked_pan && ` · ${order.masked_pan}`}
                    {order.discount > 0 &&
                        ` · ${tr('знижка {sum}', { sum: money(order.discount) })}`}
                </p>
            </div>
            <div className="text-right">
                <p className="font-semibold text-white tabular-nums">
                    {money(order.amount)}
                </p>
                <p
                    className={cn(
                        'text-xs',
                        statusTone[order.status] ?? 'text-rose-200',
                    )}
                >
                    {ORDER_STATUS()[order.status] ?? order.status}
                </p>
            </div>
            {order.status === 'pending' && order.page_url && (
                <a
                    href={order.page_url}
                    className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white"
                    aria-label={tr('Оплатити')}
                >
                    <ExternalLink className="size-4" />
                </a>
            )}
        </li>
    );
}

function CardRow({ card }: { card: SavedCard }) {
    const remove = () => {
        if (
            !window.confirm(
                tr(
                    'Видалити картку? Автопродовження з нею перейде на ручну оплату.',
                ),
            )
        ) {
            return;
        }
        void api('DELETE', `/plus/billing/cards/${card.id}`)
            .then(() => router.reload({ only: ['cards', 'renewals'] }))
            .catch((error: Error) => toast.error(error.message));
    };

    return (
        <li className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3">
            <CreditCard className="size-5 text-white/50" />
            <span className="flex-1 font-mono text-sm text-white tabular-nums">
                {card.masked_pan}
            </span>
            {card.payment_system && (
                <span className="text-xs text-white/45 uppercase">
                    {card.payment_system}
                </span>
            )}
            <button
                type="button"
                onClick={remove}
                className="rounded-lg p-2 text-white/45 hover:bg-rose-500/10 hover:text-rose-200"
                aria-label={tr('Видалити картку')}
            >
                <Trash2 className="size-4" />
            </button>
        </li>
    );
}

function RenewalRow({
    renewal,
    cards,
}: {
    renewal: Renewal;
    cards: SavedCard[];
}) {
    const products = useProducts();
    const name = useProductName();
    const family = renewal.owner_type === 'family';
    const options = Object.entries(products)
        .filter(
            ([, p]) =>
                p.available &&
                p.recurring &&
                p.kind === (family ? 'family' : 'plus'),
        )
        .map(([key]) => key);
    const [product, setProduct] = useState(renewal.product ?? options[0]);
    const [cardId, setCardId] = useState<number | null>(
        renewal.card?.id ?? cards[0]?.id ?? null,
    );

    const save = (
        active: boolean,
        nextProduct = product,
        nextCard = cardId,
    ) => {
        if (!nextProduct) return;
        void api('POST', '/plus/billing/renewals', {
            product: nextProduct,
            active,
            family_id: family ? renewal.owner_id : null,
            card_id: nextCard,
        })
            .then(() => router.reload({ only: ['renewals'] }))
            .catch((error: Error) => toast.error(error.message));
    };

    return (
        <li className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">
                    {family ? renewal.name : tr('Мій GameCon+')}
                </p>
                <p
                    className={cn(
                        'text-xs',
                        renewal.failed ? 'text-amber-200' : 'text-white/45',
                    )}
                >
                    {renewal.failed
                        ? tr(
                              'Останнє продовження не вдалося — спробуємо ще раз',
                          )
                        : renewal.until &&
                            new Date(renewal.until).getTime() > Date.now()
                          ? tr('Діє до {date}', {
                                date: formatDate(renewal.until),
                            })
                          : tr('Не активний')}
                </p>
            </div>
            {options.length > 0 && (
                <select
                    value={product}
                    onChange={(e) => {
                        setProduct(e.target.value);
                        if (renewal.active) save(true, e.target.value);
                    }}
                    className="h-9 rounded-xl border border-white/10 bg-white/[0.04] px-2 text-xs text-white"
                    aria-label={tr('Тариф')}
                >
                    {options.map((key) => (
                        <option key={key} value={key}>
                            {name(key)} · {products[key].price} ₴
                        </option>
                    ))}
                </select>
            )}
            {cards.length > 0 && (
                <select
                    value={cardId ?? ''}
                    onChange={(e) => {
                        const next = e.target.value
                            ? Number(e.target.value)
                            : null;
                        setCardId(next);
                        if (renewal.active) save(true, product, next);
                    }}
                    className="h-9 rounded-xl border border-white/10 bg-white/[0.04] px-2 text-xs text-white"
                    aria-label={tr('Картка')}
                >
                    {cards.map((card) => (
                        <option key={card.id} value={card.id}>
                            {card.masked_pan}
                        </option>
                    ))}
                </select>
            )}
            <Toggle
                checked={renewal.active}
                onChange={(value) => save(value)}
                label={tr('Автопродовження')}
            />
        </li>
    );
}
