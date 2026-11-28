import { Head, Link, router, usePage } from '@inertiajs/react';
import { Check, Sparkles, Wallet } from 'lucide-react';
import { useState } from 'react';
import { PlusTabs } from '@/components/billing/plus-tabs';
import { UserAvatar } from '@/components/gc/user-avatar';
import { BADGE_ICONS } from '@/components/season/cosmetics';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Item = {
    key: string;
    type: 'frame' | 'name' | 'badge' | 'header';
    value: string;
    name: string;
    colors?: string[];
    icon?: string;
    color?: string;
    price: number;
    owned: boolean;
    equipped: boolean;
};

const GROUPS: [Item['type'], () => string][] = [
    ['frame', () => tr('Рамки аватара')],
    ['name', () => tr('Колір ніку')],
    ['badge', () => tr('Значки біля імені')],
    ['header', () => tr('Ефекти шапки профілю')],
];

const units = (hundredths: number) =>
    (hundredths / 100).toLocaleString('uk-UA', { maximumFractionDigits: 2 });

/** Як предмет виглядатиме: рамка на моєму аватарі, нік кольором, значок, смуга шапки. */
function Preview({ item }: { item: Item }) {
    const user = usePage().props.auth.user;
    const gradient = (colors: string[] = []) =>
        colors.length > 1
            ? `linear-gradient(135deg, ${colors.join(', ')})`
            : colors[0];

    if (item.type === 'frame') {
        return (
            <span
                className="gc-shop-frame"
                style={{ background: gradient(item.colors) }}
            >
                <UserAvatar
                    // Без власної рамки — видно саме ту, що в магазині.
                    user={{ ...user, plus: null, cosmetics: null }}
                    size="md"
                    showOnline={false}
                />
            </span>
        );
    }
    if (item.type === 'name') {
        const colors = item.colors ?? [];
        return (
            <span
                className="max-w-full truncate px-2 text-lg font-bold"
                style={
                    colors.length > 1
                        ? {
                              backgroundImage: gradient(colors),
                              WebkitBackgroundClip: 'text',
                              color: 'transparent',
                          }
                        : { color: colors[0] }
                }
            >
                {user.username}
            </span>
        );
    }
    if (item.type === 'badge') {
        const Icon =
            BADGE_ICONS[item.icon as keyof typeof BADGE_ICONS] ?? Sparkles;
        return (
            <Icon
                className="size-8"
                style={{ color: item.color }}
                aria-hidden
            />
        );
    }
    return (
        <span
            className={cn('gc-shop-header', `is-${item.value}`)}
            aria-hidden
        />
    );
}

/**
 * Магазин оформлення (№255): рамки, кольори ніку, значки й ефекти шапки — назавжди за баланс.
 * Куплене одразу вдягається; знімати й міняти — тут або в інвентарі сезону.
 */
export default function Shop({
    items,
    balance,
}: {
    items: Item[];
    balance: number;
}) {
    const [busy, setBusy] = useState<string | null>(null);
    const post = (url: string, data: Record<string, string | null>) => {
        setBusy(data.key ?? data.value ?? 'x');
        router.post(url, data, {
            preserveScroll: true,
            onFinish: () => setBusy(null),
        });
    };

    return (
        <>
            <Head title={tr('Магазин оформлення')} />
            <div className="mx-auto max-w-4xl space-y-3.5">
                <PlusTabs current="shop" />
                <section className="gc-solid rounded-2xl p-3.5 sm:p-6">
                    <h1 className="font-display text-2xl font-bold text-white">
                        {tr('Магазин оформлення')}
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-white/60">
                        {tr(
                            'Рамки, кольори ніку, значки й ефекти шапки — назавжди, без підписки. Оплата з балансу GameCon.',
                        )}
                    </p>
                    <p className="mt-3 inline-flex items-center gap-2 text-sm text-white/75">
                        <Wallet className="size-4" />
                        {tr('На балансі: {n} од.', { n: units(balance) })}
                        <Link
                            href="/plus/billing"
                            className="text-sky-400 hover:text-white"
                        >
                            {tr('Поповнити')}
                        </Link>
                    </p>
                </section>

                {GROUPS.map(([type, label]) => {
                    const list = items.filter((item) => item.type === type);
                    if (list.length === 0) return null;
                    return (
                        <section
                            key={type}
                            className="gc-solid rounded-2xl p-3.5 sm:p-5"
                        >
                            <h2 className="mb-3 font-display text-lg font-semibold text-white">
                                {label()}
                            </h2>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                                {list.map((item) => (
                                    <article
                                        key={item.key}
                                        className={cn(
                                            'gc-shop-item',
                                            item.equipped && 'is-on',
                                        )}
                                    >
                                        <div className="gc-shop-item__preview">
                                            <Preview item={item} />
                                        </div>
                                        <p className="truncate text-sm font-semibold text-white">
                                            {item.name}
                                        </p>
                                        {item.owned ? (
                                            <button
                                                type="button"
                                                disabled={busy !== null}
                                                onClick={() =>
                                                    post('/shop/equip', {
                                                        type: item.type,
                                                        value: item.equipped
                                                            ? null
                                                            : item.value,
                                                    })
                                                }
                                                className="gc-ghost-btn w-full justify-center"
                                            >
                                                {item.equipped ? (
                                                    <>
                                                        <Check className="size-4" />
                                                        {tr('Вдягнуто')}
                                                    </>
                                                ) : (
                                                    tr('Вдягнути')
                                                )}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={busy !== null}
                                                onClick={() =>
                                                    post('/shop/buy', {
                                                        key: item.key,
                                                    })
                                                }
                                                className="gc-pill-primary w-full"
                                            >
                                                {tr('{n} од.', {
                                                    n: item.price,
                                                })}
                                            </button>
                                        )}
                                    </article>
                                ))}
                            </div>
                        </section>
                    );
                })}
            </div>
        </>
    );
}
