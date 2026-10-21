import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    Check,
    CreditCard,
    Plus,
    RefreshCw,
    RotateCcw,
    Trash2,
    Wallet,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, Pill, StatCard, Toggle } from '@/components/gc/admin';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { money, ORDER_STATUS } from '@/lib/billing';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { PRODUCT_LABELS } from '@/lib/plus';
import { cn } from '@/lib/utils';
import type { PaymentBadge, PaymentOrderCard } from '@/types/billing';

type UserRef = { id: number; name: string; username: string };

type Product = {
    key: string;
    kind: 'plus' | 'family' | 'gift' | 'promo' | 'phone';
    promo: 'top' | 'highlight' | 'banner' | null;
    name: string;
    price: number;
    old_price: number | null;
    days: number;
    recurring: boolean;
    enabled: boolean;
    badge: string | null;
    position: number;
    custom: boolean;
};

type Rules = {
    renew_before_hours: number;
    retry_hours: number;
    retry_max: number;
    order_hours: number;
    card_renewals: boolean;
    offer_save_card: boolean;
    badges: PaymentBadge[];
};

type GooglePaySettings = {
    enabled: boolean;
    environment: 'TEST' | 'PRODUCTION';
    merchant_id: string | null;
    merchant_name: string;
    gateway: string;
    gateway_merchant_id: string | null;
    ready: boolean;
};

type Props = {
    stats: {
        paid_month: number;
        orders_month: number;
        renewals: number;
        renewals_card: number;
        cards: number;
        legacy_balance: number;
    };
    monobank: boolean;
    orders: (PaymentOrderCard & { user: UserRef })[];
    payments: {
        id: number;
        product: string;
        amount: number;
        status: string;
        provider: string;
        user: UserRef | null;
        created_at: string;
    }[];
    balances: { id: number; name: string; username: string; balance: number }[];
    transactions: {
        id: number;
        amount: number;
        type: string;
        description: string;
        created_at: string;
        user: UserRef;
        by: string | null;
    }[];
    products: Product[];
    rules: Rules;
    google_pay: GooglePaySettings;
    webhook: string;
};

const button =
    'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--btn-primary,#6366f1)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40';
const ghost =
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-xs font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-40';
const field =
    'h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 text-sm text-white';

const KIND_LABELS = (): Record<Product['kind'], string> => ({
    plus: tr('GameCon+'),
    family: tr('Сім’я'),
    gift: tr('Подарунок'),
    promo: tr('Просування'),
    phone: tr('Номер'),
});

const PROMO_LABELS = (): Record<string, string> => ({
    top: tr('Топ каталогу'),
    highlight: tr('Виділена картка'),
    banner: tr('Банер'),
});

const BADGE_LABELS: Record<PaymentBadge, string> = {
    plata: 'plata by mono',
    visa: 'Visa',
    mastercard: 'Mastercard',
    maestro: 'Maestro',
    prostir: 'ПРОСТІР',
    apple_pay: 'Apple Pay',
    google_pay: 'Google Pay',
};

/** Адмінка білінгу: оплати карткою (monobank), тарифи й правила підписок, Google Pay, залишки старого балансу. */
export default function AdminBilling({
    stats,
    monobank,
    orders,
    payments,
    balances,
    transactions,
    products,
    rules,
    google_pay,
    webhook,
}: Props) {
    return (
        <>
            <Head title={tr('Білінг')} />
            <PageHeader
                title={tr('Білінг')}
                description={tr(
                    'Оплата карткою через monobank: замовлення, повернення, тарифи, автопродовження й Google Pay.',
                )}
                actions={
                    <Link href="/admin/integrations" className={button}>
                        <CreditCard className="size-4" />
                        {monobank
                            ? tr('monobank підключено')
                            : tr('Підключити monobank')}
                    </Link>
                }
            />

            {!monobank && (
                <p className="mb-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
                    {tr(
                        'Оплата карткою вимкнена: вставте токен еквайрингу monobank в Адмінка → Інтеграції → monobank.',
                    )}
                </p>
            )}

            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                    label={tr('Оплачено цього місяця')}
                    value={money(stats.paid_month)}
                    hint={tr('{n} оплат', { n: stats.orders_month })}
                    icon={Check}
                    tone="from-gc-mint to-gc-cyan"
                />
                <StatCard
                    label={tr('Автопродовжень')}
                    value={stats.renewals}
                    hint={tr('з карткою: {n}', { n: stats.renewals_card })}
                    icon={RefreshCw}
                    tone="from-gc-pink to-gc-purple"
                    delay={60}
                />
                <StatCard
                    label={tr('Збережених карток')}
                    value={stats.cards}
                    icon={CreditCard}
                    delay={120}
                />
                <StatCard
                    label={tr('Залишки старого балансу')}
                    value={money(stats.legacy_balance)}
                    icon={Wallet}
                    tone="from-amber-400 to-gc-coral"
                    delay={180}
                />
            </div>

            <OrdersList orders={orders} />

            <ProductsForm products={products} />

            <div className="my-5 grid gap-5 lg:grid-cols-2">
                <RulesForm rules={rules} />
                <GooglePayForm settings={google_pay} webhook={webhook} />
            </div>

            {(stats.legacy_balance > 0 ||
                payments.length > 0 ||
                transactions.length > 0) && (
                <LegacySection
                    balances={balances}
                    payments={payments}
                    transactions={transactions}
                />
            )}
        </>
    );
}

function OrdersList({ orders }: { orders: Props['orders'] }) {
    const labels = PRODUCT_LABELS();
    const tones: Record<string, 'green' | 'red' | 'blue' | 'default'> = {
        paid: 'green',
        refunded: 'blue',
        pending: 'default',
    };

    return (
        <section className="glass mb-5 rounded-3xl p-5">
            <h2 className="font-display text-lg font-bold text-white">
                {tr('Оплати')}
            </h2>
            {orders.length === 0 ? (
                <p className="mt-3 text-sm text-white/40">
                    {tr('Поки немає.')}
                </p>
            ) : (
                <ul className="mt-3 divide-y divide-white/[0.06]">
                    {orders.map((o) => (
                        <li
                            key={o.id}
                            className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm"
                        >
                            <code className="font-mono text-xs text-white/60">
                                {o.code}
                            </code>
                            <span className="min-w-0 flex-1 truncate text-white">
                                {labels[o.product] ?? o.product}
                                <Link
                                    href={`/${o.user.username}`}
                                    className="ml-1.5 text-white/50 hover:underline"
                                >
                                    {o.user.name}
                                </Link>
                                {o.kind === 'renewal' && (
                                    <span className="ml-1.5 text-xs text-white/40">
                                        {tr('автопродовження')}
                                    </span>
                                )}
                            </span>
                            {o.masked_pan && (
                                <span className="font-mono text-xs text-white/45">
                                    {o.masked_pan}
                                </span>
                            )}
                            <span className="text-white/80 tabular-nums">
                                {money(o.amount)}
                                {o.discount > 0 && (
                                    <span className="ml-1 text-xs text-white/40">
                                        (−{money(o.discount)})
                                    </span>
                                )}
                            </span>
                            <Pill tone={tones[o.status] ?? 'red'}>
                                {ORDER_STATUS()[o.status] ?? o.status}
                            </Pill>
                            {o.status === 'paid' && (
                                <button
                                    type="button"
                                    title={tr('Повернути кошти на картку')}
                                    className="text-white/40 transition hover:text-amber-200"
                                    onClick={() => {
                                        if (
                                            window.confirm(
                                                tr(
                                                    'Повернути {sum} на картку платника? Доступ і просування буде знято.',
                                                    { sum: money(o.amount) },
                                                ),
                                            )
                                        ) {
                                            router.post(
                                                `/admin/billing/orders/${o.id}/refund`,
                                                {},
                                                { preserveScroll: true },
                                            );
                                        }
                                    }}
                                >
                                    <RotateCcw className="size-4" />
                                </button>
                            )}
                            <span className="text-xs text-white/40">
                                {formatDate(o.paid_at ?? o.created_at)}
                            </span>
                            {o.failure && o.status !== 'paid' && (
                                <span className="w-full text-xs text-rose-200/70">
                                    {o.failure}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

type ProductRow = Product & { isNew?: boolean };

/** Редактор тарифів: ціна, строк, назва, «стара» ціна, позначка, порядок, автопродовження, продаж; нові тарифи. */
function ProductsForm({ products }: { products: Product[] }) {
    const [rows, setRows] = useState<ProductRow[]>(products);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const update = (index: number, patch: Partial<ProductRow>) =>
        setRows((list) =>
            list.map((row, i) => (i === index ? { ...row, ...patch } : row)),
        );
    const move = (index: number, delta: number) =>
        setRows((list) => {
            const next = [...list];
            const target = index + delta;
            if (target < 0 || target >= next.length) return list;
            [next[index], next[target]] = [next[target], next[index]];

            return next;
        });
    const add = () =>
        setRows((list) => [
            ...list,
            {
                key: '',
                kind: 'plus',
                promo: null,
                name: '',
                price: 100,
                old_price: null,
                days: 30,
                recurring: true,
                enabled: true,
                badge: null,
                position: list.length,
                custom: true,
                isNew: true,
            },
        ]);

    const save = (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        router.put(
            '/admin/billing/products',
            {
                products: rows.map((row) => ({
                    key: row.key.trim(),
                    kind: row.kind,
                    promo: row.kind === 'promo' ? (row.promo ?? 'top') : null,
                    name: row.name,
                    price: row.price,
                    old_price: row.old_price || null,
                    days: row.days,
                    recurring: row.recurring,
                    enabled: row.enabled,
                    badge: row.badge || null,
                })),
            },
            {
                preserveScroll: true,
                onError: (e) => setErrors(e),
                onSuccess: () => setErrors({}),
                onFinish: () => setSaving(false),
            },
        );
    };

    return (
        <form onSubmit={save} className="glass rounded-3xl p-5">
            <div className="flex flex-wrap items-center gap-3">
                <h2 className="flex-1 font-display text-lg font-bold text-white">
                    {tr('Тарифи')}
                </h2>
                <button type="button" className={ghost} onClick={add}>
                    <Plus className="size-4" />
                    {tr('Новий тариф')}
                </button>
                <button type="submit" className={button} disabled={saving}>
                    {tr('Зберегти тарифи')}
                </button>
            </div>
            <p className="mt-1 text-sm text-white/45">
                {tr(
                    'Ціни в гривнях. «Стара» ціна показується закресленою. Базові тарифи можна лише зняти з продажу; власні — видалити. Зміна ціни діє на нові оплати й наступні продовження.',
                )}
            </p>
            <div className="mt-4 space-y-3">
                {rows.map((row, i) => (
                    <div
                        key={row.isNew ? `new-${i}` : row.key}
                        className={cn(
                            'grid gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 sm:grid-cols-[1fr_1fr_90px_90px_80px] lg:grid-cols-[150px_1.4fr_110px_90px_90px_80px_120px_auto]',
                            !row.enabled && 'opacity-60',
                        )}
                    >
                        <label className="text-xs text-white/45">
                            {tr('Ключ')}
                            {row.isNew ? (
                                <input
                                    className={field}
                                    value={row.key}
                                    onChange={(e) =>
                                        update(i, {
                                            key: e.target.value.toLowerCase(),
                                        })
                                    }
                                    placeholder="plus_quarter"
                                />
                            ) : (
                                <code className="block h-9 truncate py-2 font-mono text-white/70">
                                    {row.key}
                                </code>
                            )}
                        </label>
                        <label className="text-xs text-white/45">
                            {tr('Назва')}
                            <input
                                className={field}
                                value={row.name}
                                onChange={(e) =>
                                    update(i, { name: e.target.value })
                                }
                            />
                        </label>
                        <label className="text-xs text-white/45">
                            {tr('Тип')}
                            {row.isNew ? (
                                <select
                                    className={field}
                                    value={row.kind}
                                    onChange={(e) =>
                                        update(i, {
                                            kind: e.target
                                                .value as Product['kind'],
                                            recurring:
                                                e.target.value === 'plus' ||
                                                e.target.value === 'family',
                                        })
                                    }
                                >
                                    {Object.entries(KIND_LABELS())
                                        // Номери продаються лише за рівнями (phone_*), нових таких тарифів не буває.
                                        .filter(([kind]) => kind !== 'phone')
                                        .map(([key, label]) => (
                                            <option key={key} value={key}>
                                                {label}
                                            </option>
                                        ))}
                                </select>
                            ) : (
                                <span className="block h-9 py-2 text-white/70">
                                    {KIND_LABELS()[row.kind]}
                                    {row.promo &&
                                        ` · ${PROMO_LABELS()[row.promo]}`}
                                </span>
                            )}
                        </label>
                        <label className="text-xs text-white/45">
                            {tr('Ціна, ₴')}
                            <input
                                type="number"
                                min={1}
                                className={field}
                                value={row.price}
                                onChange={(e) =>
                                    update(i, { price: Number(e.target.value) })
                                }
                            />
                        </label>
                        <label className="text-xs text-white/45">
                            {tr('Стара, ₴')}
                            <input
                                type="number"
                                min={0}
                                className={field}
                                value={row.old_price ?? ''}
                                onChange={(e) =>
                                    update(i, {
                                        old_price: e.target.value
                                            ? Number(e.target.value)
                                            : null,
                                    })
                                }
                            />
                        </label>
                        <label className="text-xs text-white/45">
                            {tr('Днів')}
                            <input
                                type="number"
                                min={1}
                                className={field}
                                value={row.days}
                                onChange={(e) =>
                                    update(i, { days: Number(e.target.value) })
                                }
                            />
                        </label>
                        <label className="text-xs text-white/45">
                            {tr('Позначка')}
                            <input
                                className={field}
                                value={row.badge ?? ''}
                                onChange={(e) =>
                                    update(i, { badge: e.target.value })
                                }
                                placeholder={tr('−28%')}
                            />
                        </label>
                        <div className="flex flex-wrap items-end gap-3 pb-1">
                            {row.isNew && row.kind === 'promo' && (
                                <select
                                    className={cn(field, 'w-auto')}
                                    value={row.promo ?? 'top'}
                                    onChange={(e) =>
                                        update(i, {
                                            promo: e.target
                                                .value as Product['promo'],
                                        })
                                    }
                                    aria-label={tr('Вид просування')}
                                >
                                    {Object.entries(PROMO_LABELS()).map(
                                        ([key, label]) => (
                                            <option key={key} value={key}>
                                                {label}
                                            </option>
                                        ),
                                    )}
                                </select>
                            )}
                            {(row.kind === 'plus' || row.kind === 'family') && (
                                <span className="flex items-center gap-1.5 text-xs text-white/55">
                                    <Toggle
                                        checked={row.recurring}
                                        onChange={(v) =>
                                            update(i, { recurring: v })
                                        }
                                        label={tr('Автопродовження')}
                                    />
                                    {tr('Підписка')}
                                </span>
                            )}
                            <span className="flex items-center gap-1.5 text-xs text-white/55">
                                <Toggle
                                    checked={row.enabled}
                                    onChange={(v) => update(i, { enabled: v })}
                                    label={tr('У продажу')}
                                />
                                {tr('У продажу')}
                            </span>
                            <span className="ml-auto flex items-center">
                                <button
                                    type="button"
                                    className="p-1.5 text-white/40 hover:text-white"
                                    onClick={() => move(i, -1)}
                                    aria-label={tr('Вище')}
                                >
                                    <ArrowUp className="size-4" />
                                </button>
                                <button
                                    type="button"
                                    className="p-1.5 text-white/40 hover:text-white"
                                    onClick={() => move(i, 1)}
                                    aria-label={tr('Нижче')}
                                >
                                    <ArrowDown className="size-4" />
                                </button>
                                {row.custom && (
                                    <button
                                        type="button"
                                        className="p-1.5 text-white/40 hover:text-rose-200"
                                        onClick={() =>
                                            setRows((list) =>
                                                list.filter((_, j) => j !== i),
                                            )
                                        }
                                        aria-label={tr('Видалити тариф')}
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                )}
                            </span>
                        </div>
                        {Object.entries(errors)
                            .filter(([key]) => key.startsWith(`products.${i}.`))
                            .map(([key, message]) => (
                                <p
                                    key={key}
                                    className="text-xs text-rose-300 sm:col-span-full"
                                >
                                    {message}
                                </p>
                            ))}
                    </div>
                ))}
            </div>
        </form>
    );
}

function NumberField({
    label,
    hint,
    value,
    onChange,
    max,
}: {
    label: string;
    hint?: string;
    value: number;
    onChange: (value: number) => void;
    max: number;
}) {
    return (
        <label className="block text-sm text-white/80">
            {label}
            <input
                type="number"
                min={1}
                max={max}
                className={cn(field, 'mt-1')}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
            />
            {hint && <span className="text-xs text-white/40">{hint}</span>}
        </label>
    );
}

function RulesForm({ rules }: { rules: Rules }) {
    const form = useForm<Rules>(rules);
    const toggleBadge = (key: PaymentBadge) =>
        form.setData(
            'badges',
            form.data.badges.includes(key)
                ? form.data.badges.filter((b) => b !== key)
                : [...form.data.badges, key],
        );

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.put('/admin/billing/rules', { preserveScroll: true });
            }}
            className="glass space-y-3 rounded-3xl p-5"
        >
            <h2 className="font-display text-lg font-bold text-white">
                {tr('Правила підписок')}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
                <NumberField
                    label={tr('Продовжувати за, год')}
                    hint={tr('до кінця періоду')}
                    value={form.data.renew_before_hours}
                    onChange={(v) => form.setData('renew_before_hours', v)}
                    max={168}
                />
                <NumberField
                    label={tr('Повтор через, год')}
                    hint={tr('після невдалої оплати')}
                    value={form.data.retry_hours}
                    onChange={(v) => form.setData('retry_hours', v)}
                    max={168}
                />
                <NumberField
                    label={tr('Спроб продовження')}
                    value={form.data.retry_max}
                    onChange={(v) => form.setData('retry_max', v)}
                    max={10}
                />
                <NumberField
                    label={tr('Час на оплату, год')}
                    hint={tr('потім замовлення скасовується')}
                    value={form.data.order_hours}
                    onChange={(v) => form.setData('order_hours', v)}
                    max={72}
                />
            </div>
            <label className="flex items-center gap-3 text-sm text-white/80">
                <Toggle
                    checked={form.data.card_renewals}
                    onChange={(v) => form.setData('card_renewals', v)}
                />
                {tr('Автопродовження збереженою карткою')}
            </label>
            <label className="flex items-center gap-3 text-sm text-white/80">
                <Toggle
                    checked={form.data.offer_save_card}
                    onChange={(v) => form.setData('offer_save_card', v)}
                />
                {tr('Пропонувати зберегти картку під час оплати')}
            </label>
            <div>
                <p className="text-sm text-white/80">
                    {tr('Значки оплати внизу сайту')}
                </p>
                <p className="text-xs text-white/40">
                    {tr(
                        'Вмикайте лише ті, що приймає ваш договір еквайрингу monobank.',
                    )}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                    {(Object.keys(BADGE_LABELS) as PaymentBadge[]).map(
                        (key) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => toggleBadge(key)}
                                className={cn(
                                    'rounded-lg border px-2.5 py-1 text-xs transition',
                                    form.data.badges.includes(key)
                                        ? 'border-indigo-400/50 bg-indigo-500/15 text-white'
                                        : 'border-white/10 text-white/50 hover:text-white',
                                )}
                            >
                                {BADGE_LABELS[key]}
                            </button>
                        ),
                    )}
                </div>
            </div>
            <InputError
                message={Object.values(form.errors)[0] as string | undefined}
            />
            <button type="submit" className={button} disabled={form.processing}>
                {tr('Зберегти правила')}
            </button>
        </form>
    );
}

function GooglePayForm({
    settings,
    webhook,
}: {
    settings: GooglePaySettings;
    webhook: string;
}) {
    const form = useForm({
        enabled: settings.enabled,
        environment: settings.environment,
        merchant_id: settings.merchant_id ?? '',
        merchant_name: settings.merchant_name,
        gateway: settings.gateway,
        gateway_merchant_id: settings.gateway_merchant_id ?? '',
    });

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.put('/admin/billing/google-pay', { preserveScroll: true });
            }}
            className="glass space-y-3 rounded-3xl p-5"
        >
            <div className="flex items-center gap-3">
                <h2 className="flex-1 font-display text-lg font-bold text-white">
                    Google Pay
                </h2>
                <Pill tone={settings.ready ? 'green' : 'default'}>
                    {settings.ready ? tr('Працює') : tr('Не налаштовано')}
                </Pill>
            </div>
            <p className="text-sm text-white/45">
                {tr(
                    'На сторінці оплати monobank Google Pay і Apple Pay працюють і без цього. Тут — власна кнопка Google Pay у вікні оплати: потрібні Merchant ID з Google Pay & Wallet Console і gatewayMerchantId від monobank.',
                )}
            </p>
            <label className="flex items-center gap-3 text-sm text-white/80">
                <Toggle
                    checked={form.data.enabled}
                    onChange={(v) => form.setData('enabled', v)}
                />
                {tr('Показувати кнопку Google Pay')}
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-white/80">
                    {tr('Середовище')}
                    <select
                        className={cn(field, 'mt-1')}
                        value={form.data.environment}
                        onChange={(e) =>
                            form.setData(
                                'environment',
                                e.target.value as 'TEST' | 'PRODUCTION',
                            )
                        }
                    >
                        <option value="TEST">TEST</option>
                        <option value="PRODUCTION">PRODUCTION</option>
                    </select>
                </label>
                <label className="text-sm text-white/80">
                    {tr('Назва продавця')}
                    <Input
                        className="mt-1"
                        value={form.data.merchant_name}
                        onChange={(e) =>
                            form.setData('merchant_name', e.target.value)
                        }
                    />
                </label>
                <label className="text-sm text-white/80">
                    Merchant ID (Google)
                    <Input
                        className="mt-1"
                        value={form.data.merchant_id}
                        onChange={(e) =>
                            form.setData('merchant_id', e.target.value)
                        }
                        placeholder="BCR2DN…"
                    />
                </label>
                <label className="text-sm text-white/80">
                    gatewayMerchantId (monobank)
                    <Input
                        className="mt-1"
                        value={form.data.gateway_merchant_id}
                        onChange={(e) =>
                            form.setData('gateway_merchant_id', e.target.value)
                        }
                    />
                </label>
            </div>
            <InputError
                message={Object.values(form.errors)[0] as string | undefined}
            />
            <button type="submit" className={button} disabled={form.processing}>
                {tr('Зберегти')}
            </button>
            <p className="border-t border-white/[0.06] pt-3 text-xs text-white/40">
                {tr('Адреса вебхука monobank (підставляється автоматично):')}{' '}
                <code className="font-mono break-all text-white/70">
                    {webhook}
                </code>
            </p>
        </form>
    );
}

function LegacySection({
    balances,
    payments,
    transactions,
}: {
    balances: Props['balances'];
    payments: Props['payments'];
    transactions: Props['transactions'];
}) {
    return (
        <section className="glass rounded-3xl p-5">
            <h2 className="font-display text-lg font-bold text-white">
                {tr('Старий баланс')}
            </h2>
            <p className="mt-1 text-sm text-white/45">
                {tr(
                    'Поповнення рахунку вимкнено. Залишки автоматично зараховуються в ціну наступної оплати людини; їх можна скоригувати вручну.',
                )}
            </p>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
                <div>
                    <AdjustForm />
                    {balances.length > 0 && (
                        <ul className="mt-4 divide-y divide-white/[0.06]">
                            {balances.map((u) => (
                                <li
                                    key={u.id}
                                    className="flex items-center gap-3 py-2 text-sm"
                                >
                                    <Link
                                        href={`/${u.username}`}
                                        className="min-w-0 flex-1 truncate text-white hover:underline"
                                    >
                                        {u.name}
                                    </Link>
                                    <span className="text-white/80 tabular-nums">
                                        {money(u.balance)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-white/80">
                        {tr('Покупки з балансу')}
                    </h3>
                    <ul className="mt-2 divide-y divide-white/[0.06]">
                        {payments.map((p) => (
                            <li
                                key={p.id}
                                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
                            >
                                <span className="min-w-0 flex-1 text-white">
                                    {PRODUCT_LABELS()[p.product] ?? p.product}
                                    {p.user && (
                                        <span className="ml-1.5 text-white/50">
                                            {p.user.name}
                                        </span>
                                    )}
                                </span>
                                <span className="text-white/80 tabular-nums">
                                    {money(p.amount)}
                                </span>
                                {p.status === 'refunded' ? (
                                    <Pill tone="red">{tr('Повернено')}</Pill>
                                ) : (
                                    <button
                                        type="button"
                                        title={tr('Повернути на баланс')}
                                        className="text-white/40 transition hover:text-amber-200"
                                        onClick={() => {
                                            if (
                                                window.confirm(
                                                    tr(
                                                        'Повернути покупку на баланс? Доступ і просування буде знято.',
                                                    ),
                                                )
                                            ) {
                                                router.post(
                                                    `/admin/billing/payments/${p.id}/refund`,
                                                    {},
                                                    { preserveScroll: true },
                                                );
                                            }
                                        }}
                                    >
                                        <RotateCcw className="size-4" />
                                    </button>
                                )}
                                <span className="text-xs text-white/40">
                                    {formatDate(p.created_at)}
                                </span>
                            </li>
                        ))}
                        {payments.length === 0 && (
                            <li className="py-2 text-sm text-white/40">
                                {tr('Поки немає.')}
                            </li>
                        )}
                    </ul>
                    {transactions.length > 0 && (
                        <>
                            <h3 className="mt-5 text-sm font-semibold text-white/80">
                                {tr('Корекції й повернення')}
                            </h3>
                            <ul className="mt-2 divide-y divide-white/[0.06]">
                                {transactions.map((t) => (
                                    <li
                                        key={t.id}
                                        className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-xs"
                                    >
                                        <span className="min-w-0 flex-1 text-white/80">
                                            {t.user.name} · {t.description}
                                        </span>
                                        <span
                                            className={cn(
                                                'tabular-nums',
                                                t.amount > 0
                                                    ? 'text-emerald-200'
                                                    : 'text-rose-200',
                                            )}
                                        >
                                            {t.amount > 0 ? '+' : ''}
                                            {money(t.amount)}
                                        </span>
                                        <span className="text-white/40">
                                            {t.by ?? ''}{' '}
                                            {formatDate(t.created_at)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}

function AdjustForm() {
    const form = useForm({ username: '', amount: '', reason: '' });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/admin/billing/adjust', {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    return (
        <form onSubmit={submit} className="space-y-2">
            <h3 className="text-sm font-semibold text-white/80">
                {tr('Корекція залишку')}
            </h3>
            <Input
                value={form.data.username}
                onChange={(e) => form.setData('username', e.target.value)}
                placeholder={tr('Нік, напр. @olena')}
            />
            <InputError message={form.errors.username} />
            <div className="grid grid-cols-[120px_1fr] gap-2">
                <Input
                    type="number"
                    step="0.01"
                    value={form.data.amount}
                    onChange={(e) => form.setData('amount', e.target.value)}
                    placeholder="±₴"
                    aria-label={tr('Сума, ₴')}
                />
                <Input
                    value={form.data.reason}
                    onChange={(e) => form.setData('reason', e.target.value)}
                    placeholder={tr('Причина')}
                />
            </div>
            <InputError message={form.errors.amount ?? form.errors.reason} />
            <button type="submit" className={ghost} disabled={form.processing}>
                {tr('Застосувати')}
            </button>
        </form>
    );
}
