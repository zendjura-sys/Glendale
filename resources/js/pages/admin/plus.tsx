import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    CreditCard,
    Crown,
    Sparkles,
    Ticket,
    Trash2,
    UsersRound,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { PageHeader, Pill, StatCard, Toggle } from '@/components/gc/admin';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { money } from '@/lib/billing';
import { PRODUCT_LABELS } from '@/lib/plus';
import { cn } from '@/lib/utils';

type Props = {
    stats: {
        users: number;
        families: number;
        renewals: number;
        payments_month: number;
    };
    grants: {
        id: number;
        source: string;
        note: string | null;
        starts_at: string;
        ends_at: string;
        by: string | null;
        owner: { kind: string; name: string; href: string } | null;
    }[];
    payments: {
        id: number;
        product: string;
        amount: number;
        currency: string;
        status: string;
        user: { name: string; username: string } | null;
        created_at: string;
    }[];
    codes: {
        id: number;
        code: string;
        days: number;
        type: PromoType;
        summary: string;
        new_only: boolean;
        products: string[] | null;
        note: string | null;
        uses: number;
        max_uses: number;
        expires_at: string | null;
        usable: boolean;
    }[];
    products: { key: string; name: string; kind: string }[];
};

type PromoType = 'days' | 'discount' | 'first_payment' | 'trial';

const PROMO_TYPES = (): Record<PromoType, { label: string; hint: string }> => ({
    days: {
        label: tr('Дні GameCon+'),
        hint: tr('Одразу дає GameCon+ на вказану кількість днів.'),
    },
    discount: {
        label: tr('Знижка на підписку'),
        hint: tr(
            'Відсоток або сума з кожної оплати — на вказану кількість оплат (порожньо — на всі, поки діє автопродовження).',
        ),
    },
    first_payment: {
        label: tr('Знижка на перший платіж'),
        hint: tr('Діє лише на одну, найближчу оплату.'),
    },
    trial: {
        label: tr('Безкоштовний період'),
        hint: tr(
            'Місяці або дні безкоштовно, після них — автопродовження обраного тарифу збереженою карткою.',
        ),
    },
});

const SOURCES = (): Record<string, string> => ({
    purchase: tr('Покупка'),
    renewal: tr('Автопродовження'),
    subscription: tr('Google Play'),
    gift: tr('Подарунок'),
    code: tr('Промокод'),
    admin: tr('Видано вручну'),
});

const button =
    'inline-flex h-10 items-center justify-center rounded-xl bg-[var(--btn-primary,#6366f1)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40';

export default function AdminPlus({
    stats,
    grants,
    payments,
    codes,
    products,
}: Props) {
    const grant = useForm({ username: '', days: '30', note: '' });

    const submitGrant = (event: FormEvent) => {
        event.preventDefault();
        grant.post('/admin/plus/grants', {
            preserveScroll: true,
            onSuccess: () => grant.reset('username', 'note'),
        });
    };

    return (
        <>
            <Head title="GameCon+" />
            <PageHeader
                title="GameCon+"
                description={tr(
                    'Хто з GameCon+, ручна видача й промокоди. Рахунки, поповнення й товари в продажу — у розділі «Білінг».',
                )}
                actions={
                    <Link href="/admin/billing" className={button}>
                        {tr('Білінг')}
                    </Link>
                }
            />

            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                    label={tr('Людей з GameCon+')}
                    value={stats.users}
                    icon={Sparkles}
                />
                <StatCard
                    label={tr('Сімей з GameCon+')}
                    value={stats.families}
                    icon={Crown}
                    tone="from-amber-400 to-gc-coral"
                    delay={60}
                />
                <StatCard
                    label={tr('Автопродовжень')}
                    value={stats.renewals}
                    icon={UsersRound}
                    tone="from-gc-mint to-gc-cyan"
                    delay={120}
                />
                <StatCard
                    label={tr('Оплат цього місяця')}
                    value={stats.payments_month}
                    icon={CreditCard}
                    tone="from-gc-pink to-gc-purple"
                    delay={180}
                />
            </div>

            <div className="mb-5 grid gap-5 lg:grid-cols-2">
                <form
                    onSubmit={submitGrant}
                    className="glass space-y-3 rounded-3xl p-5"
                >
                    <h2 className="font-display text-lg font-bold text-white">
                        {tr('Видати GameCon+')}
                    </h2>
                    <p className="text-sm text-white/45">
                        {tr(
                            'Наприклад, за допомогу проєкту. Дні додаються після вже наявних.',
                        )}
                    </p>
                    <Input
                        value={grant.data.username}
                        onChange={(e) =>
                            grant.setData('username', e.target.value)
                        }
                        placeholder={tr('Нік, напр. @olena')}
                    />
                    <InputError message={grant.errors.username} />
                    <div className="grid grid-cols-[120px_1fr] gap-2">
                        <Input
                            type="number"
                            min={1}
                            value={grant.data.days}
                            onChange={(e) =>
                                grant.setData('days', e.target.value)
                            }
                            aria-label={tr('Днів')}
                        />
                        <Input
                            value={grant.data.note}
                            onChange={(e) =>
                                grant.setData('note', e.target.value)
                            }
                            placeholder={tr('Примітка (необов’язково)')}
                        />
                    </div>
                    <button
                        type="submit"
                        className={button}
                        disabled={grant.processing}
                    >
                        {tr('Видати')}
                    </button>
                </form>

                <PromoForm products={products} />
            </div>

            <section className="glass mb-5 rounded-3xl p-5">
                <h2 className="font-display text-lg font-bold text-white">
                    {tr('Діючі періоди')}
                </h2>
                {grants.length === 0 ? (
                    <p className="mt-3 text-sm text-white/40">
                        {tr('Поки нікого.')}
                    </p>
                ) : (
                    <ul className="mt-3 divide-y divide-white/[0.06]">
                        {grants.map((g) => (
                            <li
                                key={g.id}
                                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm"
                            >
                                {g.owner ? (
                                    <Link
                                        href={g.owner.href}
                                        className="font-medium text-white hover:underline"
                                    >
                                        {g.owner.name}
                                    </Link>
                                ) : (
                                    <span className="text-white/40">
                                        {tr('Видалено')}
                                    </span>
                                )}
                                {g.owner?.kind === 'family' && (
                                    <Pill tone="gold">{tr('Сім’я')}</Pill>
                                )}
                                <Pill
                                    tone={
                                        g.source === 'subscription'
                                            ? 'green'
                                            : 'violet'
                                    }
                                >
                                    {SOURCES()[g.source] ?? g.source}
                                </Pill>
                                {g.note && (
                                    <span className="text-xs text-white/45">
                                        {g.note}
                                    </span>
                                )}
                                <span className="ml-auto text-xs text-white/50">
                                    {tr('до {date}', {
                                        date: formatDate(g.ends_at),
                                    })}
                                </span>
                                {g.source !== 'subscription' && (
                                    <button
                                        type="button"
                                        title={tr('Зняти')}
                                        className="text-white/40 transition hover:text-rose-300"
                                        onClick={() => {
                                            if (
                                                window.confirm(
                                                    tr(
                                                        'Зняти цей період GameCon+?',
                                                    ),
                                                )
                                            ) {
                                                router.delete(
                                                    `/admin/plus/grants/${g.id}`,
                                                    { preserveScroll: true },
                                                );
                                            }
                                        }}
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
                <section className="glass rounded-3xl p-5">
                    <h2 className="font-display text-lg font-bold text-white">
                        {tr('Промокоди')}
                    </h2>
                    <ul className="mt-3 divide-y divide-white/[0.06]">
                        {codes.map((c) => (
                            <li
                                key={c.id}
                                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm"
                            >
                                <code className="font-mono text-white">
                                    {c.code}
                                </code>
                                <span className="text-xs text-white/60">
                                    {c.summary}
                                </span>
                                <span className="text-xs text-white/40 tabular-nums">
                                    {c.uses}/{c.max_uses}
                                </span>
                                {c.new_only && (
                                    <Pill tone="violet">{tr('лише нові')}</Pill>
                                )}
                                {!c.usable && <Pill>{tr('Неактивний')}</Pill>}
                                {(c.note || c.products) && (
                                    <span className="w-full text-xs text-white/40">
                                        {[
                                            c.products
                                                ?.map(
                                                    (key) =>
                                                        products.find(
                                                            (p) =>
                                                                p.key === key,
                                                        )?.name ?? key,
                                                )
                                                .join(', '),
                                            c.note,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </span>
                                )}
                                {c.expires_at && (
                                    <span className="text-xs text-white/40">
                                        {tr('до {date}', {
                                            date: formatDate(c.expires_at),
                                        })}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    title={tr('Видалити')}
                                    className="ml-auto text-white/40 transition hover:text-rose-300"
                                    onClick={() =>
                                        router.delete(
                                            `/admin/plus/codes/${c.id}`,
                                            { preserveScroll: true },
                                        )
                                    }
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </li>
                        ))}
                        {codes.length === 0 && (
                            <li className="py-2.5 text-sm text-white/40">
                                {tr('Поки немає.')}
                            </li>
                        )}
                    </ul>
                </section>

                <section className="glass rounded-3xl p-5">
                    <h2 className="font-display text-lg font-bold text-white">
                        {tr('Останні оплати')}
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
                                {p.status === 'refunded' && (
                                    <Pill tone="red">{tr('Повернено')}</Pill>
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
            </div>
        </>
    );
}

const field = 'space-y-1 text-xs text-white/50';

/** Новий промокод: тип (дні / знижка на підписку / на перший платіж / безкоштовний період) і обмеження. */
function PromoForm({ products }: { products: Props['products'] }) {
    const form = useForm({
        code: '',
        type: 'days' as PromoType,
        days: '30',
        months: '1',
        unit: 'percent' as 'percent' | 'amount',
        percent: '20',
        amount_off: '',
        payments: '',
        products: [] as string[],
        new_only: false,
        max_uses: '100',
        expires_at: '',
        note: '',
    });
    const type = form.data.type;
    const isDiscount = type === 'discount' || type === 'first_payment';
    const choices = products.filter((p) =>
        type === 'trial'
            ? p.kind === 'plus'
            : type === 'days'
              ? false
              : p.kind !== 'promo',
    );

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            code: data.code,
            type: data.type,
            days:
                data.type === 'days' ||
                (data.type === 'trial' && data.months === '')
                    ? data.days
                    : null,
            months: data.type === 'trial' ? data.months || 0 : null,
            percent:
                isDiscount && data.unit === 'percent' ? data.percent : null,
            amount_off:
                isDiscount && data.unit === 'amount' ? data.amount_off : null,
            payments: data.type === 'discount' ? data.payments || null : null,
            products: data.type === 'days' ? [] : data.products,
            new_only: data.new_only,
            max_uses: data.max_uses,
            expires_at: data.expires_at || null,
            note: data.note || null,
        }));
        form.post('/admin/plus/codes', {
            preserveScroll: true,
            onSuccess: () => form.reset('code', 'note'),
        });
    };

    return (
        <form onSubmit={submit} className="glass space-y-3 rounded-3xl p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                <Ticket className="size-5 text-indigo-300" />
                {tr('Новий промокод')}
            </h2>
            <div className="flex flex-wrap gap-1.5">
                {(Object.keys(PROMO_TYPES()) as PromoType[]).map((key) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => form.setData('type', key)}
                        className={cn(
                            'rounded-lg border px-2.5 py-1 text-xs transition',
                            type === key
                                ? 'border-indigo-400/50 bg-indigo-500/15 text-white'
                                : 'border-white/10 text-white/50 hover:text-white',
                        )}
                    >
                        {PROMO_TYPES()[key].label}
                    </button>
                ))}
            </div>
            <p className="text-xs text-white/45">{PROMO_TYPES()[type].hint}</p>
            <Input
                value={form.data.code}
                onChange={(e) => form.setData('code', e.target.value)}
                placeholder={tr('Код (порожньо — згенерувати)')}
                className="uppercase"
            />
            <InputError message={form.errors.code} />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {type === 'days' && (
                    <label className={field}>
                        {tr('Днів GameCon+')}
                        <Input
                            type="number"
                            min={1}
                            value={form.data.days}
                            onChange={(e) =>
                                form.setData('days', e.target.value)
                            }
                        />
                    </label>
                )}
                {type === 'trial' && (
                    <>
                        <label className={field}>
                            {tr('Місяців безкоштовно')}
                            <Input
                                type="number"
                                min={0}
                                value={form.data.months}
                                onChange={(e) =>
                                    form.setData('months', e.target.value)
                                }
                            />
                        </label>
                        <label className={field}>
                            {tr('або днів')}
                            <Input
                                type="number"
                                min={1}
                                value={form.data.days}
                                disabled={Number(form.data.months) > 0}
                                onChange={(e) =>
                                    form.setData('days', e.target.value)
                                }
                            />
                        </label>
                    </>
                )}
                {isDiscount && (
                    <>
                        <label className={field}>
                            {tr('Знижка')}
                            <select
                                className="h-9 w-full rounded-md border border-white/10 bg-white/[0.04] px-2 text-sm text-white"
                                value={form.data.unit}
                                onChange={(e) =>
                                    form.setData(
                                        'unit',
                                        e.target.value as 'percent' | 'amount',
                                    )
                                }
                            >
                                <option value="percent">%</option>
                                <option value="amount">₴</option>
                            </select>
                        </label>
                        {form.data.unit === 'percent' ? (
                            <label className={field}>
                                {tr('Відсоток')}
                                <Input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={form.data.percent}
                                    onChange={(e) =>
                                        form.setData('percent', e.target.value)
                                    }
                                />
                            </label>
                        ) : (
                            <label className={field}>
                                {tr('Сума, ₴')}
                                <Input
                                    type="number"
                                    min={1}
                                    value={form.data.amount_off}
                                    onChange={(e) =>
                                        form.setData(
                                            'amount_off',
                                            e.target.value,
                                        )
                                    }
                                />
                            </label>
                        )}
                    </>
                )}
                {type === 'discount' && (
                    <label className={field}>
                        {tr('На скільки оплат')}
                        <Input
                            type="number"
                            min={1}
                            value={form.data.payments}
                            placeholder={tr('усі')}
                            onChange={(e) =>
                                form.setData('payments', e.target.value)
                            }
                        />
                    </label>
                )}
                <label className={field}>
                    {tr('Використань')}
                    <Input
                        type="number"
                        min={1}
                        value={form.data.max_uses}
                        onChange={(e) =>
                            form.setData('max_uses', e.target.value)
                        }
                    />
                </label>
                <label className={field}>
                    {tr('Діє до')}
                    <Input
                        type="date"
                        value={form.data.expires_at}
                        onChange={(e) =>
                            form.setData('expires_at', e.target.value)
                        }
                    />
                </label>
            </div>
            <InputError
                message={
                    form.errors.days ??
                    form.errors.months ??
                    form.errors.percent ??
                    form.errors.amount_off ??
                    form.errors.payments ??
                    form.errors.max_uses ??
                    form.errors.expires_at
                }
            />

            {choices.length > 0 && (
                <div>
                    <p className="text-xs text-white/50">
                        {type === 'trial'
                            ? tr('Тарифи після безкоштовного періоду')
                            : tr(
                                  'Лише для тарифів (порожньо — для всіх підписок)',
                              )}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {choices.map((p) => {
                            const on = form.data.products.includes(p.key);

                            return (
                                <button
                                    key={p.key}
                                    type="button"
                                    onClick={() =>
                                        form.setData(
                                            'products',
                                            on
                                                ? form.data.products.filter(
                                                      (k) => k !== p.key,
                                                  )
                                                : [
                                                      ...form.data.products,
                                                      p.key,
                                                  ],
                                        )
                                    }
                                    className={cn(
                                        'rounded-lg border px-2 py-0.5 text-xs transition',
                                        on
                                            ? 'border-indigo-400/50 bg-indigo-500/15 text-white'
                                            : 'border-white/10 text-white/50 hover:text-white',
                                    )}
                                >
                                    {p.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <label className="flex items-center gap-3 text-sm text-white/80">
                <Toggle
                    checked={form.data.new_only}
                    onChange={(v) => form.setData('new_only', v)}
                />
                {tr('Лише для тих, хто ще не платив')}
            </label>
            <Input
                value={form.data.note}
                onChange={(e) => form.setData('note', e.target.value)}
                placeholder={tr('Нотатка (для кого, кампанія)')}
            />
            <button type="submit" className={button} disabled={form.processing}>
                {tr('Створити')}
            </button>
        </form>
    );
}
