import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    Check,
    Clock,
    RefreshCw,
    RotateCcw,
    Wallet,
    X,
    Zap,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, Pill, StatCard, Toggle } from '@/components/gc/admin';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { money, TX_LABELS } from '@/lib/billing';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { PRODUCT_LABELS } from '@/lib/plus';
import { cn } from '@/lib/utils';

type UserRef = { id: number; name: string; username: string };

type Topup = {
    id: number;
    code: string;
    amount: number;
    method: string | null;
    status: string;
    claimed: boolean;
    credited: number | null;
    note?: string | null;
    claimed_at?: string | null;
    paid_at?: string | null;
    by?: string | null;
    created_at: string;
    user: UserRef;
};

type Method = {
    key: string;
    label: string;
    url: string | null;
    enabled: boolean;
    auto: boolean;
    currency: string;
    note: string | null;
    placeholder: string;
};

type Props = {
    stats: {
        balance: number;
        topups_month: number;
        claimed: number;
        renewals: number;
    };
    pending: Topup[];
    recent: Topup[];
    donations: {
        id: number;
        provider: string;
        name: string | null;
        message: string | null;
        amount: number;
        currency: string;
        code: string | null;
        donated_at: string;
    }[];
    payments: {
        id: number;
        product: string;
        amount: number;
        status: string;
        provider: string;
        user: UserRef | null;
        created_at: string;
    }[];
    transactions: {
        id: number;
        amount: number;
        type: string;
        description: string;
        created_at: string;
        user: UserRef;
        by: string | null;
    }[];
    methods: Method[];
    products: {
        key: string;
        kind: string;
        price: number;
        available: boolean;
    }[];
    donatello: { configured: boolean };
};

const button =
    'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--btn-primary,#6366f1)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40';
const ghost =
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-xs font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-40';

/** Адмінка білінгу: черга поповнень, донати без заявки, корекція балансу, повернення, способи й товари. */
export default function AdminBilling({
    stats,
    pending,
    recent,
    donations,
    payments,
    transactions,
    methods,
    products,
    donatello,
}: Props) {
    return (
        <>
            <Head title={tr('Білінг')} />
            <PageHeader
                title={tr('Білінг')}
                description={tr(
                    'Рахунки учасників: поповнення донатом, покупки з рахунку й автопродовження GameCon+.',
                )}
                actions={
                    donatello.configured ? (
                        <button
                            type="button"
                            className={button}
                            onClick={() =>
                                router.post(
                                    '/admin/billing/donations/sync',
                                    {},
                                    { preserveScroll: true },
                                )
                            }
                        >
                            <RefreshCw className="size-4" />
                            {tr('Перевірити Donatello')}
                        </button>
                    ) : (
                        <Link href="/admin/integrations" className={button}>
                            {tr('Підключити Donatello')}
                        </Link>
                    )
                }
            />

            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                    label={tr('На рахунках разом')}
                    value={money(stats.balance)}
                    icon={Wallet}
                />
                <StatCard
                    label={tr('Поповнено цього місяця')}
                    value={money(stats.topups_month)}
                    icon={Check}
                    tone="from-gc-mint to-gc-cyan"
                    delay={60}
                />
                <StatCard
                    label={tr('Чекають перевірки')}
                    value={stats.claimed}
                    icon={Clock}
                    tone="from-amber-400 to-gc-coral"
                    delay={120}
                />
                <StatCard
                    label={tr('Автопродовжень')}
                    value={stats.renewals}
                    icon={RefreshCw}
                    tone="from-gc-pink to-gc-purple"
                    delay={180}
                />
            </div>

            <section className="glass mb-5 rounded-3xl p-5">
                <h2 className="font-display text-lg font-bold text-white">
                    {tr('Заявки на поповнення')}
                </h2>
                <p className="mt-1 text-sm text-white/45">
                    {tr(
                        'Знайдіть донат з цим кодом у кабінеті сервісу й натисніть «Зарахувати». Якщо прийшла інша сума — вкажіть фактичну.',
                    )}
                </p>
                {pending.length === 0 ? (
                    <p className="mt-3 text-sm text-white/40">
                        {tr('Немає відкритих заявок.')}
                    </p>
                ) : (
                    <ul className="mt-3 divide-y divide-white/[0.06]">
                        {pending.map((t) => (
                            <PendingRow key={t.id} topup={t} />
                        ))}
                    </ul>
                )}
            </section>

            {donations.length > 0 && (
                <section className="glass mb-5 rounded-3xl p-5">
                    <h2 className="font-display text-lg font-bold text-white">
                        {tr('Донати без заявки')}
                    </h2>
                    <p className="mt-1 text-sm text-white/45">
                        {tr(
                            'Прийшли через API, але код не знайдено (немає, помилка або інша валюта). Впишіть код заявки, щоб зарахувати.',
                        )}
                    </p>
                    <ul className="mt-3 divide-y divide-white/[0.06]">
                        {donations.map((d) => (
                            <DonationRow key={d.id} donation={d} />
                        ))}
                    </ul>
                </section>
            )}

            <div className="mb-5 grid gap-5 lg:grid-cols-2">
                <AdjustForm />
                <ProductsForm products={products} />
            </div>

            <MethodsForm methods={methods} />

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <section className="glass rounded-3xl p-5">
                    <h2 className="font-display text-lg font-bold text-white">
                        {tr('Покупки')}
                    </h2>
                    <ul className="mt-3 divide-y divide-white/[0.06]">
                        {payments.map((p) => (
                            <li
                                key={p.id}
                                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm"
                            >
                                <span className="min-w-0 flex-1 text-white">
                                    {PRODUCT_LABELS()[p.product] ?? p.product}
                                    {p.user && (
                                        <Link
                                            href={`/${p.user.username}`}
                                            className="ml-1.5 text-white/50 hover:underline"
                                        >
                                            {p.user.name}
                                        </Link>
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
                                        title={tr('Повернути на рахунок')}
                                        className="text-white/40 transition hover:text-amber-200"
                                        onClick={() => {
                                            if (
                                                window.confirm(
                                                    tr(
                                                        'Повернути покупку на рахунок? Доступ і просування буде знято.',
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
                            <li className="py-2.5 text-sm text-white/40">
                                {tr('Поки немає.')}
                            </li>
                        )}
                    </ul>
                </section>

                <section className="glass rounded-3xl p-5">
                    <h2 className="font-display text-lg font-bold text-white">
                        {tr('Зараховані поповнення')}
                    </h2>
                    <ul className="mt-3 divide-y divide-white/[0.06]">
                        {recent.map((t) => (
                            <li
                                key={t.id}
                                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm"
                            >
                                <code className="font-mono text-white/80">
                                    {t.code}
                                </code>
                                <Link
                                    href={`/${t.user.username}`}
                                    className="min-w-0 flex-1 truncate text-white hover:underline"
                                >
                                    {t.user.name}
                                </Link>
                                <span className="text-emerald-200 tabular-nums">
                                    +{money(t.credited ?? 0)}
                                </span>
                                <span className="text-xs text-white/40">
                                    {t.by ?? ''}{' '}
                                    {t.paid_at && formatDate(t.paid_at)}
                                </span>
                            </li>
                        ))}
                        {recent.length === 0 && (
                            <li className="py-2.5 text-sm text-white/40">
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
                                        <span className="text-white/80 tabular-nums">
                                            {t.amount > 0 ? '+' : '−'}
                                            {money(Math.abs(t.amount))}
                                        </span>
                                        <span className="text-white/40">
                                            {TX_LABELS()[t.type]} · {t.by ?? ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </section>
            </div>
        </>
    );
}

function PendingRow({ topup }: { topup: Topup }) {
    const [amount, setAmount] = useState(String(topup.amount));

    return (
        <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 text-sm">
            <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                    <code className="font-mono font-semibold text-white">
                        {topup.code}
                    </code>
                    <Link
                        href={`/${topup.user.username}`}
                        className="text-white/70 hover:underline"
                    >
                        {topup.user.name}
                    </Link>
                    {topup.claimed ? (
                        <Pill tone="gold">
                            {tr('Оплатив')}
                            {topup.method ? ` · ${topup.method}` : ''}
                        </Pill>
                    ) : (
                        <Pill>{tr('Ще не оплатив')}</Pill>
                    )}
                </span>
                {topup.note && (
                    <span className="mt-0.5 block text-xs text-white/50">
                        «{topup.note}»
                    </span>
                )}
                <span className="text-xs text-white/40">
                    {formatDate(topup.created_at)}
                </span>
            </span>
            <Input
                type="number"
                min={1}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-9 w-24"
                aria-label={tr('Сума, ₴')}
            />
            <button
                type="button"
                className={cn(ghost, 'bg-emerald-500/20 text-emerald-100')}
                onClick={() => {
                    if (
                        window.confirm(
                            tr('Зарахувати {sum} ₴ на рахунок {name}?', {
                                sum: amount,
                                name: topup.user.name,
                            }),
                        )
                    ) {
                        router.post(
                            `/admin/billing/topups/${topup.id}/confirm`,
                            { amount },
                            { preserveScroll: true },
                        );
                    }
                }}
            >
                <Check className="size-3.5" />
                {tr('Зарахувати')}
            </button>
            <button
                type="button"
                title={tr('Скасувати')}
                className={ghost}
                onClick={() =>
                    router.post(
                        `/admin/billing/topups/${topup.id}/cancel`,
                        {},
                        { preserveScroll: true },
                    )
                }
            >
                <X className="size-3.5" />
            </button>
        </li>
    );
}

function DonationRow({ donation }: { donation: Props['donations'][number] }) {
    const [code, setCode] = useState(donation.code ?? '');

    return (
        <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 text-sm">
            <span className="min-w-0 flex-1">
                <span className="font-semibold text-white">
                    {donation.amount} {donation.currency}
                </span>
                <span className="ml-2 text-white/60">
                    {donation.name ?? tr('Анонім')}
                </span>
                {donation.message && (
                    <span className="mt-0.5 block truncate text-xs text-white/45">
                        «{donation.message}»
                    </span>
                )}
                <span className="text-xs text-white/40">
                    {donation.provider} · {formatDate(donation.donated_at)}
                </span>
            </span>
            <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="GC-XXXXXX"
                className="h-9 w-32 font-mono uppercase"
            />
            <button
                type="button"
                className={ghost}
                disabled={code.trim().length < 6}
                onClick={() =>
                    router.post(
                        `/admin/billing/donations/${donation.id}/attach`,
                        { code },
                        { preserveScroll: true },
                    )
                }
            >
                {tr('Зарахувати')}
            </button>
        </li>
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
        <form onSubmit={submit} className="glass space-y-3 rounded-3xl p-5">
            <h2 className="font-display text-lg font-bold text-white">
                {tr('Корекція балансу')}
            </h2>
            <p className="text-sm text-white/45">
                {tr(
                    'Плюс — зарахувати (наприклад, оплата переказом), мінус — списати. Причина видна в історії людини.',
                )}
            </p>
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
            <button type="submit" className={button} disabled={form.processing}>
                {tr('Застосувати')}
            </button>
        </form>
    );
}

function ProductsForm({ products }: { products: Props['products'] }) {
    const [enabled, setEnabled] = useState<string[]>(
        products.filter((p) => p.available).map((p) => p.key),
    );
    const toggle = (key: string, on: boolean) =>
        setEnabled((list) =>
            on ? [...list, key] : list.filter((k) => k !== key),
        );

    return (
        <section className="glass space-y-3 rounded-3xl p-5">
            <h2 className="font-display text-lg font-bold text-white">
                {tr('Товари в продажу')}
            </h2>
            <p className="text-sm text-white/45">
                {tr(
                    'Вимкнений товар зникає зі сторінок цін і GameCon+, його автопродовження зупиняється. Вже куплене діє до кінця.',
                )}
            </p>
            <ul className="space-y-1.5">
                {products.map((p) => (
                    <li
                        key={p.key}
                        className="flex items-center gap-3 text-sm text-white/80"
                    >
                        <span className="min-w-0 flex-1 truncate">
                            {PRODUCT_LABELS()[p.key] ?? p.key}
                        </span>
                        <span className="text-white/50 tabular-nums">
                            {p.price} ₴
                        </span>
                        <Toggle
                            checked={enabled.includes(p.key)}
                            onChange={(v) => toggle(p.key, v)}
                            label={PRODUCT_LABELS()[p.key] ?? p.key}
                        />
                    </li>
                ))}
            </ul>
            <button
                type="button"
                className={button}
                onClick={() =>
                    router.put(
                        '/admin/billing/products',
                        { enabled },
                        { preserveScroll: true },
                    )
                }
            >
                {tr('Зберегти')}
            </button>
        </section>
    );
}

function MethodsForm({ methods }: { methods: Method[] }) {
    const form = useForm({
        methods: methods.map((m) => ({
            key: m.key,
            enabled: m.enabled,
            url: m.url ?? '',
            label: m.label,
            note: m.note ?? '',
        })),
    });
    const set = (
        index: number,
        patch: Partial<(typeof form.data.methods)[number]>,
    ) =>
        form.setData(
            'methods',
            form.data.methods.map((m, i) =>
                i === index ? { ...m, ...patch } : m,
            ),
        );
    const errors = form.errors as Record<string, string | undefined>;

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.put('/admin/billing/methods', { preserveScroll: true });
            }}
            className="glass space-y-4 rounded-3xl p-5"
        >
            <div>
                <h2 className="font-display text-lg font-bold text-white">
                    {tr('Способи поповнення')}
                </h2>
                <p className="mt-1 text-sm text-white/45">
                    {tr(
                        'Посилання на ваші сторінки донатів. Donatello з токеном API зараховує сам (позначка ⚡), інші ви підтверджуєте в «Заявках».',
                    )}
                </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
                {form.data.methods.map((m, i) => (
                    <div
                        key={m.key}
                        className="space-y-2 rounded-2xl border border-white/[0.06] p-4"
                    >
                        <div className="flex items-center gap-2">
                            <span className="flex flex-1 items-center gap-1.5 font-semibold text-white">
                                {methods[i].auto && (
                                    <Zap className="size-4 text-amber-200" />
                                )}
                                {methods[i].label}
                                <span className="text-xs font-normal text-white/40">
                                    {methods[i].currency}
                                </span>
                            </span>
                            <Toggle
                                checked={m.enabled}
                                onChange={(v) => set(i, { enabled: v })}
                                label={methods[i].label}
                            />
                        </div>
                        <Input
                            value={m.url}
                            onChange={(e) => set(i, { url: e.target.value })}
                            placeholder={methods[i].placeholder}
                        />
                        <InputError message={errors[`methods.${i}.url`]} />
                        {m.key === 'other' && (
                            <Input
                                value={m.label}
                                onChange={(e) =>
                                    set(i, { label: e.target.value })
                                }
                                placeholder={tr(
                                    'Назва, напр. «Банка Monobank»',
                                )}
                            />
                        )}
                        <Input
                            value={m.note}
                            onChange={(e) => set(i, { note: e.target.value })}
                            placeholder={tr('Підказка людям (необов’язково)')}
                        />
                    </div>
                ))}
            </div>
            <button type="submit" className={button} disabled={form.processing}>
                {tr('Зберегти')}
            </button>
        </form>
    );
}
