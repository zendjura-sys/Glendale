import { Head, Link } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { uah } from '@/components/billing/support-author';
import { SettingsCard } from '@/layouts/settings/layout';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';

type Tier = {
    id?: number | null;
    name: string;
    price: number;
    perks: string | null;
};
type Sub = {
    author: { id: number; name: string; username: string };
    tier: string | null;
    price: number;
    expires_at: string;
    auto_renew: boolean;
};

const field =
    'input-glass h-10 w-full rounded-xl px-3 text-sm text-white placeholder:text-white/30 focus:outline-none';

/** Налаштування → «Підписки»: рівні автора, дохід і власні підписки на інших. */
export default function SubscriptionsSettings({
    tiers: initial,
    earnings,
    balance,
    subscriptions,
}: {
    tiers: Tier[];
    earnings: {
        subscribers: number;
        month: number;
        total: number;
        fee: number;
    };
    balance: number;
    subscriptions: Sub[];
}) {
    const [tiers, setTiers] = useState<Tier[]>(initial);
    const [subs, setSubs] = useState(subscriptions);
    const [busy, setBusy] = useState(false);
    const set = (i: number, patch: Partial<Tier>) =>
        setTiers((list) =>
            list.map((t, j) => (j === i ? { ...t, ...patch } : t)),
        );

    const save = async () => {
        setBusy(true);
        try {
            const result = await api<{ tiers: Tier[] }>(
                'PUT',
                '/settings/subscriptions/tiers',
                { tiers },
            );
            setTiers(result.tiers);
            toast.success(tr('Рівні збережено.'));
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : tr('Не вдалося'),
            );
        } finally {
            setBusy(false);
        }
    };
    const toggleRenew = async (sub: Sub) => {
        await api('PATCH', `/author-subscriptions/${sub.author.id}`, {
            on: !sub.auto_renew,
        });
        setSubs((list) =>
            list.map((s) =>
                s.author.id === sub.author.id
                    ? { ...s, auto_renew: !s.auto_renew }
                    : s,
            ),
        );
    };

    return (
        <>
            <Head title={tr('Підписки')} />
            <div className="space-y-5">
                <SettingsCard
                    title={tr('Платна підписка на вас')}
                    description={tr(
                        'До трьох рівнів на 30 днів. Підписники бачать ваші записи «лише для підписників». Вам нараховуються одиниці балансу (мінус частка платформи {fee}%) — їх можна витратити лише на сайті: GameCon+, просування, підписки. Одиниці не виводяться й не обмінюються на гроші.',
                        { fee: earnings.fee },
                    )}
                >
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            [tr('Підписників'), String(earnings.subscribers)],
                            [tr('Цього місяця'), uah(earnings.month)],
                            [tr('Усього'), uah(earnings.total)],
                        ].map(([label, value]) => (
                            <div
                                key={label}
                                className="rounded-2xl bg-white/[0.05] px-3 py-3 text-center"
                            >
                                <p className="font-display text-lg font-semibold text-white tabular-nums">
                                    {value}
                                </p>
                                <p className="text-xs text-white/45">{label}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 space-y-3">
                        {tiers.map((tier, i) => (
                            <div
                                key={tier.id ?? `new-${i}`}
                                className="space-y-2 rounded-2xl bg-white/[0.04] p-3"
                            >
                                <div className="flex gap-2">
                                    <input
                                        value={tier.name}
                                        onChange={(e) =>
                                            set(i, { name: e.target.value })
                                        }
                                        maxLength={40}
                                        placeholder={tr('Назва рівня')}
                                        className={field}
                                    />
                                    <label className="relative w-36 shrink-0">
                                        <input
                                            type="number"
                                            min={20}
                                            max={5000}
                                            value={tier.price / 100}
                                            onChange={(e) =>
                                                set(i, {
                                                    price: Math.round(
                                                        Number(e.target.value) *
                                                            100,
                                                    ),
                                                })
                                            }
                                            className={`${field} pr-14`}
                                            aria-label={tr('Ціна на місяць')}
                                        />
                                        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-white/40">
                                            {tr('од./міс')}
                                        </span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setTiers((list) =>
                                                list.filter((_, j) => j !== i),
                                            )
                                        }
                                        aria-label={tr('Видалити рівень')}
                                        className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white/45 hover:bg-white/[0.06] hover:text-white"
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                </div>
                                <textarea
                                    value={tier.perks ?? ''}
                                    onChange={(e) =>
                                        set(i, { perks: e.target.value })
                                    }
                                    maxLength={300}
                                    rows={2}
                                    placeholder={tr(
                                        'Що отримує підписник: закриті записи, ранній доступ, ім’я в стрімі…',
                                    )}
                                    className="input-glass w-full resize-none rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none"
                                />
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 flex flex-wrap justify-between gap-2">
                        {tiers.length < 3 ? (
                            <button
                                type="button"
                                onClick={() =>
                                    setTiers((list) => [
                                        ...list,
                                        { name: '', price: 5000, perks: '' },
                                    ])
                                }
                                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white/[0.06] px-4 text-sm text-white/80 hover:text-white"
                            >
                                <Plus className="size-4" />
                                {tr('Додати рівень')}
                            </button>
                        ) : (
                            <span />
                        )}
                        <button
                            type="button"
                            disabled={busy}
                            onClick={save}
                            className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                        >
                            {tr('Зберегти')}
                        </button>
                    </div>
                </SettingsCard>

                <SettingsCard
                    title={tr('Мої підписки')}
                    description={tr(
                        'На балансі: {sum}. Продовження списується з балансу за добу до кінця періоду.',
                        { sum: uah(balance) },
                    )}
                >
                    {subs.length === 0 ? (
                        <p className="text-sm text-white/45">
                            {tr('Ви ще ні на кого не підписані.')}
                        </p>
                    ) : (
                        <ul className="divide-y divide-white/[0.06]">
                            {subs.map((sub) => (
                                <li
                                    key={sub.author.id}
                                    className="flex items-center justify-between gap-3 py-3"
                                >
                                    <div className="min-w-0">
                                        <Link
                                            href={`/${sub.author.username}`}
                                            className="font-medium text-white hover:underline"
                                        >
                                            {sub.author.name}
                                        </Link>
                                        <p className="text-xs text-white/45">
                                            {sub.tier ?? '—'} · {uah(sub.price)}{' '}
                                            ·{' '}
                                            {tr('до {date}', {
                                                date: formatDate(
                                                    sub.expires_at,
                                                    false,
                                                ),
                                            })}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => toggleRenew(sub)}
                                        className="h-9 shrink-0 rounded-xl bg-white/[0.06] px-3 text-xs text-white/75 hover:text-white"
                                    >
                                        {sub.auto_renew
                                            ? tr('Вимкнути продовження')
                                            : tr('Увімкнути продовження')}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </SettingsCard>
            </div>
        </>
    );
}
