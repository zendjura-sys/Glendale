import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Gift, Loader2, Package } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';

type Pack = {
    id: number;
    name: string;
    description: string | null;
    emoji: string;
    price: number;
    gifts_count: number;
};

type Opened = {
    id: number;
    gift: {
        name: string;
        emoji: string;
        rarity_label: string;
        flavor: string | null;
    } | null;
};

type Props = {
    packs: Pack[];
    inventory: Opened[];
    balance: number;
};

function money(kopecks: number) {
    return `${(kopecks / 100).toFixed(kopecks % 100 === 0 ? 0 : 2)} ₴`;
}

/** Магазин паків подарунків GameCast. */
export default function GiftShop({ packs, inventory, balance }: Props) {
    const [bal, setBal] = useState(balance);
    const [inv, setInv] = useState(inventory);
    const [busy, setBusy] = useState<number | null>(null);
    const [opened, setOpened] = useState<Opened[] | null>(null);

    const buy = async (pack: Pack) => {
        setBusy(pack.id);
        try {
            const res = await api<{
                opened: Opened[];
                balance: number;
            }>('POST', `/shows/gifts/packs/${pack.id}`);
            setOpened(res.opened);
            setBal(res.balance);
            setInv((prev) => [...res.opened, ...prev]);
            toast.success(tr('Пак відкрито!'));
        } catch (e) {
            toast.error(
                e instanceof ApiError ? e.message : tr('Не вдалося купити'),
            );
        } finally {
            setBusy(null);
        }
    };

    return (
        <>
            <Head title={tr('Паки подарунків — GameCast')} />
            <div className="mx-auto max-w-3xl px-4 py-6">
                <Link
                    href="/shows"
                    className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white"
                >
                    <ArrowLeft className="size-4" /> GameCast
                </Link>
                <h1 className="font-display text-2xl font-bold text-white">
                    {tr('Паки подарунків')}
                </h1>
                <p className="mt-1 text-sm text-white/55">
                    {tr(
                        'Купуйте паки з балансу GameCon. Усередині — від сміття до божественних і унікальних подарунків для ведучих і гостей.',
                    )}
                </p>
                <p className="mt-3 text-sm font-semibold text-emerald-200">
                    {tr('Баланс')}: {money(bal)}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {packs.map((p) => (
                        <div
                            key={p.id}
                            className="gc-solid flex flex-col rounded-2xl p-4"
                        >
                            <div className="flex items-start gap-3">
                                <span className="text-3xl">{p.emoji}</span>
                                <div className="min-w-0 flex-1">
                                    <h2 className="font-display text-lg font-bold text-white">
                                        {p.name}
                                    </h2>
                                    {p.description && (
                                        <p className="mt-1 text-sm text-white/55">
                                            {p.description}
                                        </p>
                                    )}
                                    <p className="mt-2 text-xs text-white/45">
                                        {tr('{n} подарунків', {
                                            n: p.gifts_count,
                                        })}{' '}
                                        · {money(p.price)}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={busy !== null}
                                onClick={() => void buy(p)}
                                className="btn-glow mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 font-semibold text-black disabled:opacity-50"
                            >
                                {busy === p.id ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <Package className="size-4" />
                                )}
                                {tr('Купити й відкрити')}
                            </button>
                        </div>
                    ))}
                </div>

                {opened && (
                    <section className="gc-solid mt-6 rounded-2xl p-4">
                        <h3 className="mb-3 font-display font-bold text-white">
                            {tr('Щойно випало')}
                        </h3>
                        <ul className="space-y-2">
                            {opened.map((o) => (
                                <li
                                    key={o.id}
                                    className="flex items-center gap-2 text-sm text-white/80"
                                >
                                    <span className="text-xl">
                                        {o.gift?.emoji}
                                    </span>
                                    <span className="font-semibold">
                                        {o.gift?.name}
                                    </span>
                                    <span className="text-white/45">
                                        ({o.gift?.rarity_label})
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {inv.length > 0 && (
                    <section className="mt-6">
                        <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-white">
                            <Gift className="size-4 text-amber-300" />
                            {tr('Інвентар')}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {inv.map((o) => (
                                <span
                                    key={o.id}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-2.5 py-1.5 text-sm text-white"
                                    title={o.gift?.flavor ?? undefined}
                                >
                                    {o.gift?.emoji} {o.gift?.name}
                                </span>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </>
    );
}
