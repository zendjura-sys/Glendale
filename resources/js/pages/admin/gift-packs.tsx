import { Head, router, useForm } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    Gift,
    Package,
    Plus,
    Sparkles,
    Trash2,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { PageHeader, Pill, StatCard, Toggle } from '@/components/gc/admin';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Rarity = {
    key: string;
    label: string;
    tone: string;
    order: number;
};

type GiftCard = {
    id: number;
    name: string;
    emoji: string;
    rarity: string;
    rarity_label: string;
    flavor: string | null;
    stock: number | null;
    is_unique: boolean;
};

type Pack = {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    emoji: string;
    price: number;
    gifts_count: number;
    odds: Record<string, number>;
    pity_after: number;
    is_active: boolean;
    position: number;
};

type Props = {
    packs: Pack[];
    gifts: GiftCard[];
    rarities: Rarity[];
    defaults: {
        odds: Record<string, number>;
        price: number;
        gifts_count: number;
        pity_after: number;
    };
    stats: { packs: number; gifts: number; active_packs: number };
};

function uah(kopecks: number) {
    return `${(kopecks / 100).toFixed(kopecks % 100 === 0 ? 0 : 2)} ₴`;
}

export default function AdminGiftPacks({
    packs,
    gifts,
    rarities,
    defaults,
    stats,
}: Props) {
    const packForm = useForm({
        name: '',
        description: '',
        emoji: '🎁',
        price: defaults.price,
        gifts_count: defaults.gifts_count,
        pity_after: defaults.pity_after,
        odds: { ...defaults.odds },
        is_active: true,
    });
    const giftForm = useForm({
        name: '',
        emoji: '✨',
        rarity: 'common',
        flavor: '',
        stock: '' as string | number,
        is_active: true,
    });

    const createPack = (e: FormEvent) => {
        e.preventDefault();
        packForm.post('/admin/gift-packs', {
            preserveScroll: true,
            onSuccess: () =>
                packForm.setData({
                    name: '',
                    description: '',
                    emoji: '🎁',
                    price: defaults.price,
                    gifts_count: defaults.gifts_count,
                    pity_after: defaults.pity_after,
                    odds: { ...defaults.odds },
                    is_active: true,
                }),
        });
    };

    const createGift = (e: FormEvent) => {
        e.preventDefault();
        giftForm.transform((data) => ({
            ...data,
            stock:
                data.stock === '' || data.stock === null
                    ? null
                    : Number(data.stock),
        }));
        giftForm.post('/admin/gift-packs/gifts', {
            preserveScroll: true,
            onSuccess: () =>
                giftForm.setData({
                    name: '',
                    emoji: '✨',
                    rarity: 'common',
                    flavor: '',
                    stock: '',
                    is_active: true,
                }),
        });
    };

    return (
        <>
            <Head title={tr('Паки подарунків — Адмін-панель')} />
            <PageHeader
                title={tr('Паки GameCast')}
                description={tr(
                    'Назву пака задаєте ви. Люди купують пак з балансу й отримують випадкові подарунки за рідкістю — дарують ведучим і гостям в ефірі.',
                )}
            />

            <div className="mb-3.5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard
                    label={tr('Паків')}
                    value={stats.packs}
                    icon={Package}
                />
                <StatCard
                    label={tr('У каталозі')}
                    value={stats.gifts}
                    icon={Gift}
                    tone="from-gc-pink to-gc-purple"
                    delay={60}
                />
                <StatCard
                    label={tr('В продажу')}
                    value={stats.active_packs}
                    icon={Sparkles}
                    tone="from-gc-mint to-gc-cyan"
                    delay={120}
                />
            </div>

            <form
                onSubmit={createPack}
                className="gc-solid mb-4 space-y-3 rounded-2xl p-4"
            >
                <h2 className="font-display text-base font-bold text-white">
                    {tr('Новий пак')}
                </h2>
                <p className="text-xs text-white/45">
                    {tr(
                        'Назву встановлюєте самі — вона з’явиться в магазині подарунків GameCast.',
                    )}
                </p>
                <div className="flex flex-wrap gap-2">
                    <Input
                        value={packForm.data.emoji}
                        onChange={(e) =>
                            packForm.setData('emoji', e.target.value)
                        }
                        className="h-10 w-16 text-center text-lg"
                        maxLength={8}
                    />
                    <div className="min-w-[220px] flex-1">
                        <Input
                            value={packForm.data.name}
                            onChange={(e) =>
                                packForm.setData('name', e.target.value)
                            }
                            placeholder={tr('Назва пака (обов’язково)')}
                            className="h-10"
                        />
                        <InputError
                            message={packForm.errors.name}
                            className="mt-1"
                        />
                    </div>
                    <Input
                        type="number"
                        value={packForm.data.price}
                        onChange={(e) =>
                            packForm.setData(
                                'price',
                                Number(e.target.value) || 0,
                            )
                        }
                        placeholder={tr('Ціна, коп.')}
                        className="h-10 w-28"
                    />
                    <Input
                        type="number"
                        value={packForm.data.gifts_count}
                        onChange={(e) =>
                            packForm.setData(
                                'gifts_count',
                                Number(e.target.value) || 1,
                            )
                        }
                        placeholder={tr('К-сть')}
                        className="h-10 w-20"
                        min={1}
                        max={30}
                    />
                </div>
                <Input
                    value={packForm.data.description}
                    onChange={(e) =>
                        packForm.setData('description', e.target.value)
                    }
                    placeholder={tr('Опис для магазину (необов’язково)')}
                    className="h-10"
                />
                <div className="grid gap-2 sm:grid-cols-5">
                    {rarities.map((r) => (
                        <label
                            key={r.key}
                            className="rounded-xl bg-white/[0.04] px-2 py-1.5 text-xs text-white/70"
                        >
                            <span className="mb-1 block truncate">
                                {r.label}
                            </span>
                            <Input
                                type="number"
                                value={packForm.data.odds[r.key] ?? 0}
                                onChange={(e) =>
                                    packForm.setData('odds', {
                                        ...packForm.data.odds,
                                        [r.key]: Number(e.target.value) || 0,
                                    })
                                }
                                className="h-8"
                                min={0}
                            />
                        </label>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <label className="text-xs text-white/55">
                        {tr('Pity (гарантія rare+) після')}{' '}
                        <Input
                            type="number"
                            value={packForm.data.pity_after}
                            onChange={(e) =>
                                packForm.setData(
                                    'pity_after',
                                    Number(e.target.value) || 0,
                                )
                            }
                            className="ml-1 inline-flex h-8 w-16"
                            min={0}
                        />
                    </label>
                    <button
                        type="submit"
                        disabled={
                            packForm.processing || !packForm.data.name.trim()
                        }
                        className="btn-glow flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white disabled:opacity-50"
                    >
                        <Plus className="size-4" /> {tr('Створити пак')}
                    </button>
                </div>
            </form>

            <div className="mb-6 grid gap-3">
                {packs.map((pack, i) => (
                    <PackRow
                        key={pack.id}
                        pack={pack}
                        rarities={rarities}
                        first={i === 0}
                        last={i === packs.length - 1}
                    />
                ))}
                {packs.length === 0 && (
                    <div className="gc-solid rounded-2xl px-6 py-12 text-center text-sm text-white/40">
                        {tr(
                            'Ще немає паків — створіть перший із власною назвою.',
                        )}
                    </div>
                )}
            </div>

            <form
                onSubmit={createGift}
                className="gc-solid mb-4 flex flex-wrap items-start gap-2 rounded-2xl p-4"
            >
                <h2 className="w-full font-display text-base font-bold text-white">
                    {tr('Новий подарунок у каталог')}
                </h2>
                <Input
                    value={giftForm.data.emoji}
                    onChange={(e) => giftForm.setData('emoji', e.target.value)}
                    className="h-10 w-16 text-center text-lg"
                />
                <Input
                    value={giftForm.data.name}
                    onChange={(e) => giftForm.setData('name', e.target.value)}
                    placeholder={tr('Назва')}
                    className="h-10 min-w-[160px] flex-1"
                />
                <select
                    value={giftForm.data.rarity}
                    onChange={(e) => giftForm.setData('rarity', e.target.value)}
                    className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white"
                >
                    {rarities.map((r) => (
                        <option key={r.key} value={r.key}>
                            {r.label}
                        </option>
                    ))}
                </select>
                <Input
                    value={giftForm.data.flavor}
                    onChange={(e) => giftForm.setData('flavor', e.target.value)}
                    placeholder={tr('Фраза')}
                    className="h-10 min-w-[160px] flex-1"
                />
                <Input
                    value={giftForm.data.stock}
                    onChange={(e) => giftForm.setData('stock', e.target.value)}
                    placeholder={tr('Сток (порожньо = ∞)')}
                    className="h-10 w-36"
                />
                <button
                    type="submit"
                    disabled={giftForm.processing || !giftForm.data.name.trim()}
                    className="btn-glow flex h-10 items-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                    <Plus className="size-4" /> {tr('Додати')}
                </button>
            </form>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {gifts.map((g) => (
                    <div
                        key={g.id}
                        className="gc-solid flex items-start gap-3 rounded-2xl p-3"
                    >
                        <span className="text-2xl">{g.emoji}</span>
                        <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-white">
                                {g.name}
                            </div>
                            <Pill className="mt-1">{g.rarity_label}</Pill>
                            {g.flavor && (
                                <p className="mt-1 text-xs text-white/45">
                                    {g.flavor}
                                </p>
                            )}
                            {g.stock !== null && (
                                <p className="mt-1 text-xs text-amber-200/80">
                                    {tr('Залишок')}: {g.stock}
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            className="rounded-lg p-2 text-white/40 hover:bg-rose-500/20 hover:text-rose-300"
                            onClick={() => {
                                if (
                                    confirm(
                                        tr('Видалити подарунок з каталогу?'),
                                    )
                                ) {
                                    router.delete(
                                        `/admin/gift-packs/gifts/${g.id}`,
                                        { preserveScroll: true },
                                    );
                                }
                            }}
                        >
                            <Trash2 className="size-4" />
                        </button>
                    </div>
                ))}
            </div>
        </>
    );
}

function PackRow({
    pack,
    rarities,
    first,
    last,
}: {
    pack: Pack;
    rarities: Rarity[];
    first: boolean;
    last: boolean;
}) {
    const [name, setName] = useState(pack.name);

    return (
        <div className="gc-solid rounded-2xl p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-2xl">{pack.emoji}</span>
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => {
                        if (name.trim() && name !== pack.name) {
                            router.patch(
                                `/admin/gift-packs/${pack.id}`,
                                { name: name.trim() },
                                { preserveScroll: true },
                            );
                        }
                    }}
                    className="h-9 min-w-[180px] flex-1 font-semibold"
                />
                <span className="text-sm text-white/50">{uah(pack.price)}</span>
                <span className="text-sm text-white/50">
                    ×{pack.gifts_count}
                </span>
                <Toggle
                    checked={pack.is_active}
                    onChange={(on) =>
                        router.patch(
                            `/admin/gift-packs/${pack.id}`,
                            { is_active: on },
                            { preserveScroll: true },
                        )
                    }
                />
                <button
                    type="button"
                    disabled={first}
                    className="rounded-lg p-2 text-white/40 hover:bg-white/10 disabled:opacity-30"
                    onClick={() =>
                        router.patch(
                            `/admin/gift-packs/${pack.id}`,
                            { move: 'up' },
                            { preserveScroll: true },
                        )
                    }
                >
                    <ArrowUp className="size-4" />
                </button>
                <button
                    type="button"
                    disabled={last}
                    className="rounded-lg p-2 text-white/40 hover:bg-white/10 disabled:opacity-30"
                    onClick={() =>
                        router.patch(
                            `/admin/gift-packs/${pack.id}`,
                            { move: 'down' },
                            { preserveScroll: true },
                        )
                    }
                >
                    <ArrowDown className="size-4" />
                </button>
                <button
                    type="button"
                    className="rounded-lg p-2 text-white/40 hover:bg-rose-500/20 hover:text-rose-300"
                    onClick={() => {
                        if (confirm(tr('Видалити пак?'))) {
                            router.delete(`/admin/gift-packs/${pack.id}`, {
                                preserveScroll: true,
                            });
                        }
                    }}
                >
                    <Trash2 className="size-4" />
                </button>
            </div>
            {pack.description && (
                <p className="mb-2 text-sm text-white/50">{pack.description}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
                {rarities.map((r) => (
                    <span
                        key={r.key}
                        className={cn(
                            'rounded-lg bg-white/[0.05] px-2 py-1 text-[11px] text-white/55',
                        )}
                    >
                        {r.label}: {pack.odds[r.key] ?? 0}
                    </span>
                ))}
            </div>
        </div>
    );
}
