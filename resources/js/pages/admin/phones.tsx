import { Head, Link, router, useForm } from '@inertiajs/react';
import { Lock, Search, Settings2, Trash2, Wand2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, Pill } from '@/components/gc/admin';
import InputError from '@/components/input-error';
import { PhoneBadge } from '@/components/phone/phone-badge';
import { Input } from '@/components/ui/input';
import { tr } from '@/lib/i18n';
import { PHONE_TIERS, TIER_HINTS, TIER_LABELS } from '@/lib/phones';
import { cn } from '@/lib/utils';
import type { PhoneCard, PhoneTier } from '@/types';

type Chances = Record<Exclude<PhoneTier, 'regular'>, number>;
type Config = {
    premium_code: string;
    random_code: string;
    plus_discount: number;
    chances: Chances;
    random_cooldown_days: number;
};
type Rule = {
    id: number;
    number: string;
    tier: PhoneTier | null;
    auto_tier: PhoneTier;
    reserved: boolean;
    note: string | null;
};
type Owned = PhoneCard & {
    id: number;
    user: { id: number; name: string; username: string };
    created_at: string;
};

type Props = {
    config: Config;
    tiers: PhoneTier[];
    prices: Record<PhoneTier, number>;
    stats: {
        total: number;
        purchased: number;
        by_tier: Partial<Record<PhoneTier, number>>;
    };
    rules: Rule[];
    numbers: Owned[];
    search: string;
};

const card = 'glass mb-5 rounded-2xl p-4';

/**
 * Адмінка → Номери: коди мереж (+777 куплені, +555 випадкові), шанси рідкісного номера, знижка GameCon+,
 * безкоштовна зміна; правки рівня й резерв номерів; власники. Ціни — у Білінгу (товари «Номер +777»).
 */
export default function AdminPhones({
    config,
    prices,
    stats,
    rules,
    numbers,
    search,
}: Props) {
    const labels = TIER_LABELS();
    const hints = TIER_HINTS();
    const form = useForm<Config>(config);
    const rule = useForm<{
        number: string;
        tier: string;
        reserved: boolean;
        note: string;
    }>({
        number: '',
        tier: '',
        reserved: false,
        note: '',
    });
    const [q, setQ] = useState(search);

    const save = (e: FormEvent) => {
        e.preventDefault();
        form.put('/admin/phones', { preserveScroll: true });
    };
    const addRule = (e: FormEvent) => {
        e.preventDefault();
        rule.transform((data) => ({ ...data, tier: data.tier || null }));
        rule.post('/admin/phones/rules', {
            preserveScroll: true,
            onSuccess: () => rule.reset(),
        });
    };
    const chanceSum = Object.values(form.data.chances).reduce(
        (a, b) => a + Number(b || 0),
        0,
    );

    return (
        <>
            <Head title={tr('Номери — Адмін-панель')} />
            <PageHeader
                title={tr('Номери')}
                description={tr(
                    'Внутрішні номери GameCon: випадкові безкоштовні й куплені. Кожен номер (код оператора + 7 цифр) існує в одному екземплярі на всю мережу.',
                )}
            />

            <section className="mb-5 grid gap-3 sm:grid-cols-3">
                <div className="glass rounded-2xl p-4">
                    <p className="text-xs text-white/45">
                        {tr('Номерів видано')}
                    </p>
                    <p className="font-display text-2xl font-bold text-white">
                        {stats.total}
                    </p>
                </div>
                <div className="glass rounded-2xl p-4">
                    <p className="text-xs text-white/45">{tr('Куплено')}</p>
                    <p className="font-display text-2xl font-bold text-white">
                        {stats.purchased}
                    </p>
                </div>
                <div className="glass flex flex-wrap gap-x-3 gap-y-1 rounded-2xl p-4">
                    {PHONE_TIERS.map((t) => (
                        <span
                            key={t}
                            className={cn('text-sm', `phone-tier--${t}`)}
                        >
                            <span className="text-[color:var(--tier)]">
                                {labels[t]}
                            </span>{' '}
                            <span className="text-white/60 tabular-nums">
                                {stats.by_tier[t] ?? 0}
                            </span>
                        </span>
                    ))}
                </div>
            </section>

            <form onSubmit={save} className={card}>
                <h3 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-white">
                    <Settings2 className="size-4 text-white/50" />
                    {tr('Налаштування')}
                </h3>
                <div className="grid gap-3 sm:grid-cols-4">
                    <label className="text-sm text-white/70">
                        {tr('Код мережі куплених')}
                        <Input
                            value={form.data.premium_code}
                            onChange={(e) =>
                                form.setData(
                                    'premium_code',
                                    e.target.value
                                        .replace(/\D/g, '')
                                        .slice(0, 4),
                                )
                            }
                            className="mt-1"
                        />
                        <InputError message={form.errors.premium_code} />
                    </label>
                    <label className="text-sm text-white/70">
                        {tr('Код мережі випадкових')}
                        <Input
                            value={form.data.random_code}
                            onChange={(e) =>
                                form.setData(
                                    'random_code',
                                    e.target.value
                                        .replace(/\D/g, '')
                                        .slice(0, 4),
                                )
                            }
                            className="mt-1"
                        />
                        <InputError message={form.errors.random_code} />
                    </label>
                    <label className="text-sm text-white/70">
                        {tr('Знижка GameCon+, %')}
                        <Input
                            type="number"
                            min={0}
                            max={100}
                            value={form.data.plus_discount}
                            onChange={(e) =>
                                form.setData(
                                    'plus_discount',
                                    Number(e.target.value),
                                )
                            }
                            className="mt-1"
                        />
                        <InputError message={form.errors.plus_discount} />
                    </label>
                    <label className="text-sm text-white/70">
                        {tr('Безкоштовна зміна раз на, днів')}
                        <Input
                            type="number"
                            min={0}
                            max={365}
                            value={form.data.random_cooldown_days}
                            onChange={(e) =>
                                form.setData(
                                    'random_cooldown_days',
                                    Number(e.target.value),
                                )
                            }
                            className="mt-1"
                        />
                        <InputError
                            message={form.errors.random_cooldown_days}
                        />
                    </label>
                </div>

                <p className="mt-4 mb-2 text-sm font-medium text-white/80">
                    {tr('Шанс випадкового номера стати рідкісним, %')}
                </p>
                <div className="grid gap-3 sm:grid-cols-5">
                    {(Object.keys(form.data.chances) as (keyof Chances)[]).map(
                        (t) => (
                            <label
                                key={t}
                                className={cn('text-sm', `phone-tier--${t}`)}
                            >
                                <span className="text-[color:var(--tier)]">
                                    {labels[t]}
                                </span>
                                <Input
                                    type="number"
                                    step="0.001"
                                    min={0}
                                    max={100}
                                    value={form.data.chances[t]}
                                    onChange={(e) =>
                                        form.setData('chances', {
                                            ...form.data.chances,
                                            [t]: Number(e.target.value),
                                        })
                                    }
                                    className="mt-1"
                                />
                            </label>
                        ),
                    )}
                </div>
                <InputError
                    message={(form.errors as Record<string, string>).chances}
                />
                <p className="mt-2 text-xs text-white/40">
                    {tr('Звичайний номер випадає з рештою шансу: {n} %.', {
                        n: Math.max(0, 100 - chanceSum).toLocaleString(
                            'uk-UA',
                            { maximumFractionDigits: 3 },
                        ),
                    })}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                        type="submit"
                        disabled={form.processing || !form.isDirty}
                        className="h-10 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                        {tr('Зберегти')}
                    </button>
                    <span className="text-xs text-white/45">
                        {tr('Ціни')}:{' '}
                        {PHONE_TIERS.map(
                            (t) => `${labels[t]} ${prices[t]} ₴`,
                        ).join(' · ')}{' '}
                        ·{' '}
                        <Link
                            href="/admin/billing"
                            className="underline hover:text-white"
                        >
                            {tr('змінити в Білінгу')}
                        </Link>
                    </span>
                </div>
            </form>

            <section className={card}>
                <h3 className="mb-1 flex items-center gap-2 font-display text-base font-bold text-white">
                    <Wand2 className="size-4 text-white/50" />
                    {tr('Правки номерів')}
                </h3>
                <p className="mb-3 text-xs text-white/45">
                    {tr(
                        'Підвищити чи знизити рівень конкретного номера або зарезервувати його (ні купити, ні отримати випадково). Діє в обох мережах.',
                    )}
                </p>
                <form
                    onSubmit={addRule}
                    className="flex flex-wrap items-start gap-2"
                >
                    <div className="w-48">
                        <Input
                            value={rule.data.number}
                            onChange={(e) =>
                                rule.setData('number', e.target.value)
                            }
                            placeholder="05 123-45-67"
                        />
                        <InputError message={rule.errors.number} />
                    </div>
                    <select
                        value={rule.data.tier}
                        onChange={(e) => rule.setData('tier', e.target.value)}
                        className="h-9 rounded-md border border-white/10 bg-white/[0.04] px-2 text-sm text-white"
                    >
                        <option value="">{tr('Рівень — автоматично')}</option>
                        {PHONE_TIERS.map((t) => (
                            <option key={t} value={t}>
                                {labels[t]}
                            </option>
                        ))}
                    </select>
                    <label className="flex h-9 items-center gap-2 text-sm text-white/80">
                        <input
                            type="checkbox"
                            checked={rule.data.reserved}
                            onChange={(e) =>
                                rule.setData('reserved', e.target.checked)
                            }
                        />
                        {tr('Резерв')}
                    </label>
                    <Input
                        value={rule.data.note}
                        onChange={(e) => rule.setData('note', e.target.value)}
                        placeholder={tr('Нотатка')}
                        className="w-48"
                    />
                    <button
                        type="submit"
                        disabled={rule.processing}
                        className="h-9 rounded-xl bg-white/[0.08] px-4 text-sm font-semibold text-white hover:bg-white/[0.12]"
                    >
                        {tr('Додати')}
                    </button>
                </form>
                {rules.length > 0 && (
                    <ul className="mt-3 divide-y divide-white/[0.05]">
                        {rules.map((r) => (
                            <li
                                key={r.id}
                                className="flex flex-wrap items-center gap-2 py-2 text-sm"
                            >
                                <PhoneBadge
                                    phone={{
                                        number: r.number,
                                        tier: r.tier ?? r.auto_tier,
                                    }}
                                    size="sm"
                                />
                                {r.tier && r.tier !== r.auto_tier && (
                                    <span className="text-xs text-white/40">
                                        {tr('замість «{tier}»', {
                                            tier: labels[r.auto_tier],
                                        })}
                                    </span>
                                )}
                                {r.reserved && (
                                    <Pill tone="gold">
                                        <Lock className="mr-1 inline size-3" />
                                        {tr('Резерв')}
                                    </Pill>
                                )}
                                {r.note && (
                                    <span className="text-xs text-white/45">
                                        {r.note}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.delete(
                                            `/admin/phones/rules/${r.id}`,
                                            { preserveScroll: true },
                                        )
                                    }
                                    aria-label={tr('Прибрати')}
                                    className="ml-auto flex size-8 items-center justify-center rounded-lg text-white/45 hover:bg-white/[0.06] hover:text-red-300"
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                <ul className="mt-3 grid gap-1 text-xs text-white/40 sm:grid-cols-2">
                    {PHONE_TIERS.filter((t) => t !== 'regular').map((t) => (
                        <li key={t}>
                            <span
                                className={cn(
                                    `phone-tier--${t}`,
                                    'text-[color:var(--tier)]',
                                )}
                            >
                                {labels[t]}
                            </span>{' '}
                            — {hints[t]}
                        </li>
                    ))}
                </ul>
            </section>

            <section className={card}>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        router.get('/admin/phones', q ? { q } : {}, {
                            preserveState: true,
                            preserveScroll: true,
                        });
                    }}
                    className="mb-3 flex items-center gap-2"
                >
                    <div className="relative flex-1">
                        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
                        <Input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder={tr('Номер, нік або ім’я')}
                            className="pl-9"
                        />
                    </div>
                    <button
                        type="submit"
                        className="h-9 rounded-xl bg-white/[0.08] px-4 text-sm font-semibold text-white"
                    >
                        {tr('Знайти')}
                    </button>
                </form>
                {numbers.length === 0 ? (
                    <p className="text-sm text-white/45">
                        {tr('Нічого не знайдено.')}
                    </p>
                ) : (
                    <ul className="divide-y divide-white/[0.05]">
                        {numbers.map((n) => (
                            <li
                                key={n.id}
                                className="flex flex-wrap items-center gap-3 py-2 text-sm"
                            >
                                <PhoneBadge phone={n} size="sm" />
                                <Pill>
                                    {n.kind === 'purchased'
                                        ? tr('Куплений')
                                        : tr('Випадковий')}
                                </Pill>
                                <Link
                                    href={`/${n.user.username}`}
                                    className="text-white/70 hover:text-white"
                                >
                                    {n.user.name}{' '}
                                    <span className="text-white/40">
                                        @{n.user.username}
                                    </span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (
                                            window.confirm(
                                                tr(
                                                    'Вилучити номер {n}? Він стане вільним.',
                                                    { n: n.number },
                                                ),
                                            )
                                        ) {
                                            router.delete(
                                                `/admin/phones/numbers/${n.id}`,
                                                { preserveScroll: true },
                                            );
                                        }
                                    }}
                                    className="ml-auto text-xs text-white/45 hover:text-red-300"
                                >
                                    {tr('Вилучити')}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}
