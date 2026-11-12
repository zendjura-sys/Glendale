import { Head, router } from '@inertiajs/react';
import { Gem, Layers, Package, Pin, Sparkles, Wand2, X } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { GameCardArt, rarityLabel } from '@/components/cards/game-card';
import type { CardData, Rarity } from '@/components/cards/game-card';
import { Button } from '@/components/ui/button';
import { tr } from '@/lib/i18n';
import { motionOr, RISE } from '@/lib/motion';
import { cn } from '@/lib/utils';

type OwnedCard = CardData & { copies: number; showcase: boolean };

type Props = {
    cards: OwnedCard[];
    sets: { name: string; total: number; owned: number }[];
    shards: number;
    packs_opened: number;
    next_pack_at: string | null;
    pack_size: number;
    duplicates: number;
    dust: Record<Rarity, number>;
    craft: Record<Rarity, number>;
    drop: Record<Rarity, number>;
    opened: (CardData & { new: boolean })[] | null;
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
    dust,
    craft,
    drop,
    opened,
}: Props) {
    const reduce = useReducedMotion();
    const [set, setSet] = useState<string | null>(null);
    const [onlyMissing, setOnlyMissing] = useState(false);
    const [picked, setPicked] = useState<OwnedCard | null>(null);
    const [reveal, setReveal] = useState(opened);
    const [busy, setBusy] = useState(false);
    const left = useLeft(next_pack_at);
    const owned = cards.filter((c) => c.copies > 0).length;

    useEffect(() => setReveal(opened), [opened]);

    const list = useMemo(
        () =>
            cards.filter(
                (c) =>
                    (!set || c.set === set) && (!onlyMissing || c.copies === 0),
            ),
        [cards, set, onlyMissing],
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
        ? (cards.find((c) => c.id === picked.id) ?? picked)
        : null;

    return (
        <>
            <Head title={tr('Колекційні картки')} />
            <div className="mx-auto max-w-5xl space-y-5">
                <section className="gc-solid flex flex-wrap items-center gap-4 rounded-xl p-4 sm:p-5">
                    <div className="min-w-0 flex-1">
                        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-white">
                            <Layers className="size-6 text-primary" />
                            {tr('Колекційні картки')}
                        </h1>
                        <p className="mt-1 text-sm text-white/60">
                            {tr(
                                'Кожна гра каталогу — картка. Щодня безкоштовний набір, дублікати — в уламки, з уламків — картки, яких бракує.',
                            )}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm">
                            <span className="text-white">
                                <b className="tabular-nums">{owned}</b>
                                <span className="text-white/55">
                                    {' '}
                                    / {cards.length}
                                </span>
                            </span>
                            <span className="flex items-center gap-1 text-white">
                                <Gem className="size-4 text-violet-400" />
                                <b className="tabular-nums">{shards}</b>
                                <span className="text-white/55">
                                    {tr('уламків')}
                                </span>
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            disabled={busy || left !== null}
                            onClick={() => post('/cards/open')}
                        >
                            <Package className="size-4" />
                            {left
                                ? tr('Набір через {t}', { t: left })
                                : tr('Відкрити набір ({n})', { n: pack_size })}
                        </Button>
                        <Button
                            variant="secondary"
                            disabled={busy || duplicates === 0}
                            onClick={() => post('/cards/dust')}
                        >
                            <Sparkles className="size-4" />
                            {tr('Розібрати дублікати ({n})', {
                                n: duplicates,
                            })}
                        </Button>
                    </div>
                </section>

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
                    {sets.map((s) => (
                        <button
                            key={s.name}
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
                            onChange={(e) => setOnlyMissing(e.target.checked)}
                        />
                        {tr('Лише яких бракує')}
                    </label>
                </div>

                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
                    {list.map((c) => (
                        <button
                            key={c.id}
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

                <section className="gc-solid rounded-xl p-4 text-sm text-white/65">
                    <h2 className="mb-2 font-display text-base font-bold text-white">
                        {tr('Шанси й ціни')}
                    </h2>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {(Object.keys(drop) as Rarity[]).map((r) => (
                            <div
                                key={r}
                                className="rounded-lg bg-white/5 px-3 py-2"
                            >
                                <div className="font-semibold text-white">
                                    {rarityLabel(r)}
                                </div>
                                <div>{tr('Шанс: {n}%', { n: drop[r] })}</div>
                                <div>
                                    {tr('Дублікат: +{n}', { n: dust[r] })}
                                </div>
                                <div>
                                    {tr('Створити: {n}', { n: craft[r] })}
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
                            <p className="mt-3 text-center text-sm text-white/60">
                                {current.set}
                                {current.copies > 0 &&
                                    ` · ${tr('копій: {n}', { n: current.copies })}`}
                            </p>
                            <div className="mt-4 flex flex-col gap-2">
                                {current.copies === 0 ? (
                                    <Button
                                        disabled={
                                            busy ||
                                            shards < craft[current.rarity]
                                        }
                                        onClick={() =>
                                            post(`/cards/${current.id}/craft`)
                                        }
                                    >
                                        <Wand2 className="size-4" />
                                        {tr('Створити за {n} уламків', {
                                            n: craft[current.rarity],
                                        })}
                                    </Button>
                                ) : (
                                    <Button
                                        variant="secondary"
                                        disabled={busy}
                                        onClick={() =>
                                            post(
                                                `/cards/${current.id}/showcase`,
                                            )
                                        }
                                    >
                                        <Pin className="size-4" />
                                        {current.showcase
                                            ? tr('Прибрати з вітрини профілю')
                                            : tr('На вітрину профілю')}
                                    </Button>
                                )}
                            </div>
                        </m.div>
                    </m.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {reveal && reveal.length > 0 && (
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/80 p-4"
                    >
                        <h2 className="font-display text-2xl font-bold text-white">
                            {tr('Ваш набір')}
                        </h2>
                        <div className="flex flex-wrap justify-center gap-4">
                            {reveal.map((c, i) => (
                                <m.div
                                    key={`${c.id}-${i}`}
                                    initial={
                                        reduce
                                            ? false
                                            : {
                                                  rotateY: 180,
                                                  opacity: 0,
                                                  y: 20,
                                              }
                                    }
                                    animate={{ rotateY: 0, opacity: 1, y: 0 }}
                                    transition={motionOr(reduce, {
                                        delay: 0.25 + i * 0.35,
                                        duration: 0.55,
                                        ease: 'easeOut',
                                    })}
                                    className="relative w-36 sm:w-44"
                                >
                                    <GameCardArt card={c} />
                                    {c.new && (
                                        <span className="absolute -top-2 -left-2 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
                                            {tr('Нова')}
                                        </span>
                                    )}
                                </m.div>
                            ))}
                        </div>
                        <Button onClick={() => setReveal(null)}>
                            {tr('До альбому')}
                        </Button>
                    </m.div>
                )}
            </AnimatePresence>
        </>
    );
}
