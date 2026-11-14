import { Head, router } from '@inertiajs/react';
import {
    Gem,
    Gift,
    Layers,
    Package,
    Pin,
    Sparkles,
    Wand2,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import {
    GameCardArt,
    kindLabel,
    RANKS,
    RARITY,
    rarityLabel,
} from '@/components/cards/game-card';
import type { CardData, CardKind, Rarity } from '@/components/cards/game-card';
import { CardReveal, CrystalPicker } from '@/components/cards/card-open';
import type { DrawnCard } from '@/components/cards/card-open';
import { api, ApiError } from '@/lib/api';
import type { UserCard } from '@/types';
import { Button } from '@/components/ui/button';
import { tr } from '@/lib/i18n';
import { motionOr, RISE } from '@/lib/motion';
import { cn } from '@/lib/utils';

type OwnedCard = CardData & {
    copies: number;
    showcase: boolean;
    theme?: string | null;
};

type Props = {
    cards: OwnedCard[];
    sets: { kind: CardKind; name: string; total: number; owned: number }[];
    shards: number;
    packs_opened: number;
    next_pack_at: string | null;
    pack_size: number;
    duplicates: number;
    ranks: { rank: Rarity; drop: number; dust: number; craft: number }[];
    drops: { id: number; source: string; title: string; created_at: string }[];
    collections: {
        name: string;
        total: number;
        owned: number;
        cover: CardData | null;
    }[];
    friends?: UserCard[];
};

function useLeft(until: string | null): string | null {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!until) return;
        const id = window.setInterval(() => setNow(Date.now()), 30_000);

        return () => window.clearInterval(id);
    }, [until]);
    if (!until) return null;
    const left = new Date(until).getTime() - now;
    if (left <= 0) return null;

    return tr('{h} год {m} хв', {
        h: Math.floor(left / 3_600_000),
        m: Math.floor((left % 3_600_000) / 60_000),
    });
}

export default function CardsAlbum({
    cards,
    sets,
    shards,
    next_pack_at,
    pack_size,
    duplicates,
    ranks,
    drops,
    collections,
    friends,
}: Props) {
    const reduce = useReducedMotion();
    const [view, setView] = useState<'collections' | 'album'>(
        collections.length > 0 ? 'collections' : 'album',
    );
    const [theme, setTheme] = useState<string | null>(null);
    const [kind, setKind] = useState<CardKind | null>(null);
    const [set, setSet] = useState<string | null>(null);
    const kinds = Array.from(new Set(cards.map((c) => c.kind)));
    const craftOf = (r: Rarity) => ranks.find((x) => x.rank === r)?.craft ?? 0;
    const [onlyMissing, setOnlyMissing] = useState(false);
    const [picked, setPicked] = useState<OwnedCard | null>(null);
    const [reveal, setReveal] = useState<DrawnCard[] | null>(null);
    // Що відкриваємо: набір або зароблену картку (спершу — вибір кристалів).
    const [opening, setOpening] = useState<
        { kind: 'pack' } | { kind: 'drop'; id: number; title: string } | null
    >(null);
    const [giftTo, setGiftTo] = useState<number | ''>('');

    const doOpen = async (crystals: number) => {
        if (!opening) return;
        const target = opening;
        setOpening(null);
        setBusy(true);
        try {
            const response = await api<{ cards: DrawnCard[] }>(
                'POST',
                target.kind === 'pack'
                    ? '/cards/open'
                    : `/cards/drops/${target.id}/open`,
                { crystals },
            );
            setReveal(response.cards);
        } catch (error) {
            toast.error(
                error instanceof ApiError
                    ? error.message
                    : tr('Не вдалося відкрити.'),
            );
        } finally {
            setBusy(false);
        }
    };
    const [busy, setBusy] = useState(false);
    const left = useLeft(next_pack_at);
    const owned = cards.filter((c) => c.copies > 0).length;
    // Три найрідкісніші картки людини — віялом у шапці.
    const topOwned = useMemo(
        () =>
            cards
                .filter((c) => c.copies > 0)
                .sort(
                    (a, b) => RANKS.indexOf(b.rarity) - RANKS.indexOf(a.rarity),
                )
                .slice(0, 3),
        [cards],
    );
    const best = topOwned[0] ?? null;
    const heroOrder =
        topOwned.length === 3
            ? [topOwned[1], topOwned[0], topOwned[2]]
            : topOwned;

    const list = useMemo(
        () =>
            cards.filter(
                (c) =>
                    (!theme || c.theme === theme) &&
                    (!kind || c.kind === kind) &&
                    (!set || c.set === set) &&
                    (!onlyMissing || c.copies === 0),
            ),
        [cards, theme, kind, set, onlyMissing],
    );

    const post = (url: string, after?: () => void) => {
        setBusy(true);
        router.post(
            url,
            {},
            {
                preserveScroll: true,
                onFinish: () => setBusy(false),
                onSuccess: after,
            },
        );
    };

    const current = picked
        ? (cards.find((c) => c.key === picked.key) ?? picked)
        : null;

    return (
        <>
            <Head title={tr('Колекційні картки')} />
            <div className="mx-auto max-w-5xl space-y-5">
                <m.section
                    initial={reduce ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={motionOr(reduce, RISE)}
                    data-on-dark
                    className="relative overflow-hidden rounded-2xl p-5 text-white sm:p-7"
                    style={{
                        background:
                            'radial-gradient(120% 140% at 0% 0%, #4338ca 0%, transparent 55%), radial-gradient(90% 120% at 100% 100%, #7c3aed 0%, transparent 60%), #0b1220',
                    }}
                >
                    <div className="relative flex flex-wrap items-center gap-6">
                        <div className="min-w-0 flex-1">
                            <h1 className="flex items-center gap-2 font-display text-3xl font-bold">
                                <Layers className="size-7 text-indigo-300" />
                                {tr('Колекційні картки')}
                            </h1>
                            <p className="mt-1 max-w-xl text-sm text-white/70">
                                {tr(
                                    'Ігри, персонажі аніме, фільмів і серіалів — 16 рангів від N до U. Набір щодня, картки за перегляд і гру, дублікати — в кристали.',
                                )}
                            </p>
                            <div className="mt-4 flex flex-wrap items-center gap-5">
                                <div className="flex items-center gap-3">
                                    <svg
                                        viewBox="0 0 44 44"
                                        className="size-12 -rotate-90"
                                        aria-hidden
                                    >
                                        <circle
                                            cx="22"
                                            cy="22"
                                            r="19"
                                            fill="none"
                                            strokeWidth="4"
                                            className="stroke-white/15"
                                        />
                                        <circle
                                            cx="22"
                                            cy="22"
                                            r="19"
                                            fill="none"
                                            strokeWidth="4"
                                            strokeLinecap="round"
                                            className="stroke-indigo-300"
                                            strokeDasharray={2 * Math.PI * 19}
                                            strokeDashoffset={
                                                2 *
                                                Math.PI *
                                                19 *
                                                (1 -
                                                    owned /
                                                        Math.max(
                                                            1,
                                                            cards.length,
                                                        ))
                                            }
                                        />
                                    </svg>
                                    <div>
                                        <div className="font-display text-xl font-bold tabular-nums">
                                            {owned}
                                            <span className="text-sm text-white/55">
                                                {' '}
                                                / {cards.length}
                                            </span>
                                        </div>
                                        <div className="text-xs text-white/60">
                                            {tr('зібрано')}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-1 font-display text-xl font-bold tabular-nums">
                                        <Gem className="size-4 text-violet-300" />
                                        {shards}
                                    </div>
                                    <div className="text-xs text-white/60">
                                        {tr('кристалів')}
                                    </div>
                                </div>
                                {best && (
                                    <div>
                                        <div
                                            className="font-display text-xl font-bold"
                                            style={{
                                                color: RARITY[best.rarity].ring,
                                            }}
                                        >
                                            {best.rarity}
                                        </div>
                                        <div className="text-xs text-white/60">
                                            {tr('найрідкісніша')}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="mt-5 flex flex-wrap gap-2">
                                <Button
                                    disabled={busy || left !== null}
                                    onClick={() => setOpening({ kind: 'pack' })}
                                    className="bg-white text-[#0b1220] hover:bg-white/90"
                                >
                                    <Package className="size-4" />
                                    {left
                                        ? tr('Набір через {t}', { t: left })
                                        : tr('Відкрити набір ({n})', {
                                              n: pack_size,
                                          })}
                                </Button>
                                <Button
                                    variant="secondary"
                                    disabled={busy || duplicates === 0}
                                    onClick={() => post('/cards/dust')}
                                    className="bg-white/10 text-white hover:bg-white/20"
                                >
                                    <Sparkles className="size-4" />
                                    {tr('Розщепити дублікати ({n})', {
                                        n: duplicates,
                                    })}
                                </Button>
                            </div>
                        </div>
                        {topOwned.length > 0 && (
                            <div className="hidden shrink-0 items-end sm:flex">
                                {heroOrder.map((c, i) => (
                                    <m.div
                                        key={c.key}
                                        initial={
                                            reduce
                                                ? false
                                                : { opacity: 0, y: 16 }
                                        }
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={motionOr(reduce, {
                                            ...RISE,
                                            delay: 0.1 + i * 0.08,
                                        })}
                                        className={cn(
                                            'w-24 lg:w-28',
                                            i > 0 && '-ml-8',
                                            i === 1 && 'z-10 mb-3 w-28 lg:w-32',
                                        )}
                                    >
                                        <GameCardArt card={c} />
                                    </m.div>
                                ))}
                            </div>
                        )}
                    </div>
                </m.section>

                {drops.length > 0 && (
                    <section className="gc-solid space-y-3 rounded-xl p-4">
                        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                            <Gift className="size-5 text-primary" />
                            {tr('Отримані картки')}
                            <span className="rounded-full bg-primary px-2 text-xs text-white">
                                {drops.length}
                            </span>
                        </h2>
                        <ul className="grid gap-2 sm:grid-cols-2">
                            {drops.map((d) => (
                                <li
                                    key={d.id}
                                    className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold text-white">
                                            {d.title}
                                        </span>
                                        <span className="block text-xs text-white/50">
                                            {d.source === 'game'
                                                ? tr('За гру')
                                                : d.source === 'episodes'
                                                  ? tr('За 10 серій')
                                                  : tr('За перегляд')}
                                        </span>
                                    </span>
                                    <Button
                                        size="sm"
                                        disabled={busy}
                                        onClick={() =>
                                            setOpening({
                                                kind: 'drop',
                                                id: d.id,
                                                title: d.title,
                                            })
                                        }
                                    >
                                        {tr('Відкрити')}
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <div className="flex gap-2">
                    {(
                        [
                            ['collections', tr('Колекції')],
                            ['album', tr('Альбом')],
                        ] as const
                    ).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setView(key)}
                            className={cn(
                                'rounded-xl px-4 py-2 font-display text-sm font-semibold',
                                view === key
                                    ? 'bg-primary text-white'
                                    : 'gc-solid text-white/70',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                    {theme && (
                        <button
                            type="button"
                            onClick={() => setTheme(null)}
                            className="ml-auto flex items-center gap-1 rounded-xl bg-white/5 px-3 py-2 text-sm text-white/70"
                        >
                            {theme}
                            <X className="size-3.5" />
                        </button>
                    )}
                </div>

                {view === 'collections' ? (
                    collections.length === 0 ? (
                        <p className="gc-solid rounded-xl p-5 text-sm text-white/60">
                            {tr(
                                'Тематичні колекції ще формуються — ІІ розкладає картки за наборами (фентезі, меха, супергерої…).',
                            )}
                        </p>
                    ) : (
                        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {collections.map((col, i) => (
                                <m.li
                                    key={col.name}
                                    initial={
                                        reduce ? false : { opacity: 0, y: 10 }
                                    }
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={motionOr(reduce, {
                                        ...RISE,
                                        delay: Math.min(i, 8) * 0.04,
                                    })}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTheme(col.name);
                                            setView('album');
                                        }}
                                        className="gc-solid flex w-full items-center gap-4 rounded-2xl p-3 text-left transition hover:bg-white/5"
                                    >
                                        {col.cover && (
                                            <GameCardArt
                                                card={col.cover}
                                                locked={
                                                    !cards.find(
                                                        (c) =>
                                                            c.key ===
                                                            col.cover?.key,
                                                    )?.copies
                                                }
                                                className="w-16 shrink-0"
                                            />
                                        )}
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-display text-base font-bold text-white">
                                                {col.name}
                                            </span>
                                            <span className="block text-xs text-white/55">
                                                {tr('{o} з {t} карток', {
                                                    o: col.owned,
                                                    t: col.total,
                                                })}
                                            </span>
                                            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/10">
                                                <span
                                                    className="block h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400"
                                                    style={{
                                                        width: `${(col.owned / Math.max(1, col.total)) * 100}%`,
                                                    }}
                                                />
                                            </span>
                                        </span>
                                    </button>
                                </m.li>
                            ))}
                        </ul>
                    )
                ) : (
                    <>
                        {kinds.length > 1 && (
                            <div className="flex flex-wrap gap-2">
                                {[null, ...kinds].map((k) => (
                                    <button
                                        key={k ?? 'all'}
                                        type="button"
                                        onClick={() => {
                                            setKind(k);
                                            setSet(null);
                                        }}
                                        className={cn(
                                            'rounded-xl px-4 py-2 text-sm font-semibold',
                                            kind === k
                                                ? 'bg-primary text-white'
                                                : 'gc-solid text-white/70',
                                        )}
                                    >
                                        {k ? kindLabel(k) : tr('Усі картки')}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setSet(null)}
                                className={cn(
                                    'rounded-full px-3 py-1.5 text-sm',
                                    set === null
                                        ? 'bg-primary text-white'
                                        : 'gc-solid text-white/70',
                                )}
                            >
                                {tr('Усі')}
                            </button>
                            {sets
                                .filter((s) => !kind || s.kind === kind)
                                .slice(0, 24)
                                .map((s) => (
                                    <button
                                        key={`${s.kind}:${s.name}`}
                                        type="button"
                                        onClick={() => setSet(s.name)}
                                        className={cn(
                                            'rounded-full px-3 py-1.5 text-sm',
                                            set === s.name
                                                ? 'bg-primary text-white'
                                                : 'gc-solid text-white/70',
                                        )}
                                    >
                                        {s.name}{' '}
                                        <span className="tabular-nums opacity-70">
                                            {s.owned}/{s.total}
                                        </span>
                                    </button>
                                ))}
                            <label className="ml-auto flex items-center gap-2 text-sm text-white/70">
                                <input
                                    type="checkbox"
                                    checked={onlyMissing}
                                    onChange={(e) =>
                                        setOnlyMissing(e.target.checked)
                                    }
                                />
                                {tr('Лише яких бракує')}
                            </label>
                        </div>

                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
                            {list.map((c) => (
                                <button
                                    key={c.key}
                                    type="button"
                                    onClick={() => setPicked(c)}
                                    className="text-left transition-transform hover:-translate-y-0.5"
                                >
                                    <GameCardArt
                                        card={c}
                                        locked={c.copies === 0}
                                        copies={c.copies}
                                    />
                                </button>
                            ))}
                        </div>
                    </>
                )}

                <section className="gc-solid rounded-xl p-4 text-sm text-white/65">
                    <h2 className="mb-2 font-display text-base font-bold text-white">
                        {tr('Шанси й ціни')}
                    </h2>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-8">
                        {ranks.map((r) => (
                            <div
                                key={r.rank}
                                className="rounded-lg bg-white/5 px-2.5 py-1.5"
                            >
                                <div
                                    className="font-black"
                                    style={{ color: RARITY[r.rank].ring }}
                                >
                                    {r.rank}
                                </div>
                                <div className="text-[11px] leading-snug">
                                    {tr('Шанс: {n}%', { n: r.drop })}
                                    <br />
                                    {tr('Дублікат: +{n}', { n: r.dust })}
                                    <br />
                                    {tr('Створити: {n}', { n: r.craft })}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <AnimatePresence>
                {current && (
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                        onClick={() => setPicked(null)}
                    >
                        <m.div
                            initial={reduce ? false : { scale: 0.95, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            transition={motionOr(reduce, RISE)}
                            className="gc-solid w-full max-w-sm rounded-2xl p-5"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    aria-label={tr('Закрити')}
                                    onClick={() => setPicked(null)}
                                    className="text-white/60"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>
                            <GameCardArt
                                card={current}
                                locked={current.copies === 0}
                                className="mx-auto w-48"
                            />
                            <p className="mt-3 text-center text-sm text-muted-foreground">
                                {rarityLabel(current.rarity)} ·{' '}
                                {kindLabel(current.kind)} · {current.set}
                                {current.copies > 0 &&
                                    ` · ${tr('копій: {n}', { n: current.copies })}`}
                            </p>
                            <div className="mt-4 flex flex-col gap-2">
                                {current.copies === 0 ? (
                                    <Button
                                        disabled={
                                            busy ||
                                            shards < craftOf(current.rarity)
                                        }
                                        onClick={() =>
                                            post(`/cards/${current.key}/craft`)
                                        }
                                    >
                                        <Wand2 className="size-4" />
                                        {tr('Створити за {n} кристалів', {
                                            n: craftOf(current.rarity),
                                        })}
                                    </Button>
                                ) : (
                                    <>
                                        {current.copies > 1 && (
                                            <>
                                                <Button
                                                    variant="secondary"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        void api(
                                                            'POST',
                                                            `/cards/${current.key}/split`,
                                                            { count: 1 },
                                                        ).then(() =>
                                                            router.reload(),
                                                        )
                                                    }
                                                >
                                                    <Gem className="size-4" />
                                                    {tr(
                                                        'Розщепити дублікат (+{n})',
                                                        {
                                                            n:
                                                                ranks.find(
                                                                    (r) =>
                                                                        r.rank ===
                                                                        current.rarity,
                                                                )?.dust ?? 0,
                                                        },
                                                    )}
                                                </Button>
                                                <div className="flex gap-2">
                                                    <select
                                                        aria-label={tr(
                                                            'Кому подарувати',
                                                        )}
                                                        value={giftTo}
                                                        onChange={(e) =>
                                                            setGiftTo(
                                                                e.target.value
                                                                    ? Number(
                                                                          e
                                                                              .target
                                                                              .value,
                                                                      )
                                                                    : '',
                                                            )
                                                        }
                                                        className="input-glass h-9 min-w-0 flex-1 rounded-xl px-2 text-sm text-white"
                                                    >
                                                        <option value="">
                                                            {friends
                                                                ? tr(
                                                                      'Подарувати другу…',
                                                                  )
                                                                : tr(
                                                                      'Завантаження…',
                                                                  )}
                                                        </option>
                                                        {(friends ?? []).map(
                                                            (f) => (
                                                                <option
                                                                    key={f.id}
                                                                    value={f.id}
                                                                >
                                                                    {f.name}
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                    <Button
                                                        size="sm"
                                                        disabled={
                                                            busy || !giftTo
                                                        }
                                                        onClick={() =>
                                                            router.post(
                                                                `/cards/${current.key}/gift`,
                                                                {
                                                                    user_id:
                                                                        giftTo,
                                                                },
                                                                {
                                                                    preserveScroll: true,
                                                                    onSuccess:
                                                                        () =>
                                                                            setGiftTo(
                                                                                '',
                                                                            ),
                                                                },
                                                            )
                                                        }
                                                    >
                                                        <Gift className="size-4" />
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                        <Button
                                            variant="secondary"
                                            disabled={busy}
                                            onClick={() =>
                                                post(
                                                    `/cards/${current.key}/showcase`,
                                                )
                                            }
                                        >
                                            <Pin className="size-4" />
                                            {current.showcase
                                                ? tr(
                                                      'Прибрати з вітрини профілю',
                                                  )
                                                : tr('На вітрину профілю')}
                                        </Button>
                                    </>
                                )}
                            </div>
                        </m.div>
                    </m.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {opening && (
                    <CrystalPicker
                        title={
                            opening.kind === 'pack'
                                ? tr('Відкрити набір ({n})', { n: pack_size })
                                : tr('Картка за «{t}»', { t: opening.title })
                        }
                        shards={shards}
                        ranks={ranks}
                        onOpen={(c) => void doOpen(c)}
                        onClose={() => setOpening(null)}
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {reveal && reveal.length > 0 && (
                    <CardReveal
                        cards={reveal}
                        onClose={() => setReveal(null)}
                    />
                )}
            </AnimatePresence>
        </>
    );
}
