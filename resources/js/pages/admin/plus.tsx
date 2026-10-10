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
import { PageHeader, Pill, StatCard } from '@/components/gc/admin';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { PRODUCT_LABELS } from '@/lib/plus';

type Props = {
    configured: boolean;
    stats: {
        users: number;
        families: number;
        subscriptions: number;
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
        uses: number;
        max_uses: number;
        expires_at: string | null;
        usable: boolean;
    }[];
};

const SOURCES = (): Record<string, string> => ({
    subscription: tr('Підписка'),
    gift: tr('Подарунок'),
    code: tr('Промокод'),
    admin: tr('Видано вручну'),
});

const button =
    'inline-flex h-10 items-center justify-center rounded-xl bg-[var(--btn-primary,#6366f1)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40';

export default function AdminPlus({
    configured,
    stats,
    grants,
    payments,
    codes,
}: Props) {
    const grant = useForm({ username: '', days: '30', note: '' });
    const code = useForm({
        code: '',
        days: '30',
        max_uses: '1',
        expires_at: '',
    });

    const submitGrant = (event: FormEvent) => {
        event.preventDefault();
        grant.post('/admin/plus/grants', {
            preserveScroll: true,
            onSuccess: () => grant.reset('username', 'note'),
        });
    };
    const submitCode = (event: FormEvent) => {
        event.preventDefault();
        code.post('/admin/plus/codes', {
            preserveScroll: true,
            onSuccess: () => code.reset('code'),
        });
    };

    return (
        <>
            <Head title="GameCon+" />
            <PageHeader
                title="GameCon+"
                description={tr(
                    'Підписники, оплати, ручна видача й промокоди. Ціни й товари — у Lemon Squeezy, ключі — в Інтеграції → «Оплата».',
                )}
                actions={
                    !configured && (
                        <Link href="/admin/integrations" className={button}>
                            {tr('Підключити оплату')}
                        </Link>
                    )
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
                    label={tr('Активних підписок')}
                    value={stats.subscriptions}
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

                <form
                    onSubmit={submitCode}
                    className="glass space-y-3 rounded-3xl p-5"
                >
                    <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                        <Ticket className="size-5 text-indigo-300" />
                        {tr('Новий промокод')}
                    </h2>
                    <Input
                        value={code.data.code}
                        onChange={(e) => code.setData('code', e.target.value)}
                        placeholder={tr('Код (порожньо — згенерувати)')}
                        className="uppercase"
                    />
                    <InputError message={code.errors.code} />
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <label className="space-y-1 text-xs text-white/50">
                            {tr('Днів')}
                            <Input
                                type="number"
                                min={1}
                                value={code.data.days}
                                onChange={(e) =>
                                    code.setData('days', e.target.value)
                                }
                            />
                        </label>
                        <label className="space-y-1 text-xs text-white/50">
                            {tr('Використань')}
                            <Input
                                type="number"
                                min={1}
                                value={code.data.max_uses}
                                onChange={(e) =>
                                    code.setData('max_uses', e.target.value)
                                }
                            />
                        </label>
                        <label className="col-span-2 space-y-1 text-xs text-white/50 sm:col-span-1">
                            {tr('Діє до')}
                            <Input
                                type="date"
                                value={code.data.expires_at}
                                onChange={(e) =>
                                    code.setData('expires_at', e.target.value)
                                }
                            />
                        </label>
                    </div>
                    <InputError message={code.errors.expires_at} />
                    <button
                        type="submit"
                        className={button}
                        disabled={code.processing}
                    >
                        {tr('Створити')}
                    </button>
                </form>
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
                                <span className="text-xs text-white/50">
                                    {tr('{days} дн. · {uses}/{max}', {
                                        days: c.days,
                                        uses: c.uses,
                                        max: c.max_uses,
                                    })}
                                </span>
                                {!c.usable && <Pill>{tr('Неактивний')}</Pill>}
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
                                    {(p.amount / 100).toFixed(2)} {p.currency}
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
