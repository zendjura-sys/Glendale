import { router } from '@inertiajs/react';
import { Gem, Sparkles } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { GameCardArt, RANKS, RARITY } from '@/components/cards/game-card';
import type { CardData, Rarity } from '@/components/cards/game-card';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { motionOr, RISE } from '@/lib/motion';

export type DrawnCard = CardData & {
    new: boolean;
    copies: number;
    dust: number;
};

/** Межа бусту кристалами (як на сервері): +50%. */
const BOOST_CAP = 50000;

/**
 * Шанс рангу R і вище з кристалами — та сама формула, що на сервері: 10 кристалів = +0,01%,
 * шанс забирається з нижчих рангів і додається рангам від R.
 */
export function highChance(
    ranks: { rank: Rarity; drop: number }[],
    crystals: number,
): number {
    const w: Record<string, number> = {};
    ranks.forEach((r) => (w[r.rank] = Math.round(r.drop * 1000)));
    const high = RANKS.slice(RANKS.indexOf('R'));
    let take = Math.min(Math.max(0, crystals), BOOST_CAP);
    const boost = take;
    for (const r of RANKS) {
        if (take <= 0 || high.includes(r)) break;
        const cut = Math.min(w[r] ?? 0, take);
        w[r] -= cut;
        take -= cut;
    }
    const given = boost - take;
    const highTotal = high.reduce((sum, r) => sum + (w[r] ?? 0), 0);
    high.forEach(
        (r) =>
            (w[r] += Math.round(
                (given * (w[r] ?? 0)) / Math.max(1, highTotal),
            )),
    );
    const total = Object.values(w).reduce((a, b) => a + b, 0);

    return (
        Math.round(
            (high.reduce((sum, r) => sum + (w[r] ?? 0), 0) /
                Math.max(1, total)) *
                10000,
        ) / 100
    );
}

/** Вибір кристалів перед відкриттям картки чи набору. */
export function CrystalPicker({
    title,
    shards,
    ranks,
    onOpen,
    onClose,
}: {
    title: string;
    shards: number;
    ranks: { rank: Rarity; drop: number }[];
    onOpen: (crystals: number) => void;
    onClose: () => void;
}) {
    const reduce = useReducedMotion();
    const max = Math.min(shards, BOOST_CAP);
    const [crystals, setCrystals] = useState(0);
    const base = useMemo(() => highChance(ranks, 0), [ranks]);
    const chance = useMemo(
        () => highChance(ranks, crystals),
        [ranks, crystals],
    );

    return (
        <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={onClose}
        >
            <m.div
                initial={reduce ? false : { scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                transition={motionOr(reduce, RISE)}
                onClick={(e) => e.stopPropagation()}
                className="gc-solid w-full max-w-sm space-y-4 rounded-2xl p-5"
            >
                <h2 className="font-display text-xl font-bold text-foreground">
                    {title}
                </h2>
                {max > 0 ? (
                    <>
                        <p className="text-sm text-muted-foreground">
                            {tr(
                                'Докладіть кристали — кожні 10 додають 0,01% шансу на рідкісну картку. Кристали списуються під час відкриття.',
                            )}
                        </p>
                        <div className="space-y-2">
                            <input
                                type="range"
                                min={0}
                                max={max}
                                step={10}
                                value={crystals}
                                onChange={(e) =>
                                    setCrystals(Number(e.target.value))
                                }
                                className="h-2 w-full cursor-pointer accent-violet-500"
                                aria-label={tr('Кристали')}
                            />
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-1 text-foreground">
                                    <Gem className="size-4 text-violet-400" />
                                    {crystals} / {max}
                                </span>
                                <span className="text-muted-foreground">
                                    {tr('R і вище: {a}% → {b}%', {
                                        a: base,
                                        b: chance,
                                    })}
                                </span>
                            </div>
                        </div>
                    </>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {tr(
                            'Кристалів поки немає — розщеплюйте дублікати, щоб підвищувати шанс на рідкісні картки.',
                        )}
                    </p>
                )}
                <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => onOpen(crystals)}>
                        <Sparkles className="size-4" />
                        {tr('Відкрити')}
                    </Button>
                    <Button variant="ghost" onClick={onClose}>
                        {tr('Пізніше')}
                    </Button>
                </div>
            </m.div>
        </m.div>
    );
}

/** Осколки, на які розлітається картка під час розщеплення. */
const SHARDS = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2 + (i % 2 ? 0.3 : -0.2);
    const dist = 120 + ((i * 37) % 80);

    return {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        r: ((i * 53) % 220) - 110,
        clip: [
            'polygon(50% 0, 100% 40%, 60% 100%, 0 60%)',
            'polygon(0 0, 100% 20%, 70% 100%)',
            'polygon(30% 0, 100% 50%, 0 100%)',
        ][i % 3],
        size: 18 + ((i * 29) % 26),
    };
});

/** Одна картка в показі: дублікат можна лишити або розщепити (з анімацією). */
function RevealCard({ card, index }: { card: DrawnCard; index: number }) {
    const reduce = useReducedMotion();
    const [state, setState] = useState<
        'shown' | 'kept' | 'splitting' | 'split'
    >('shown');
    const tone = RARITY[card.rarity];

    const split = async () => {
        setState('splitting');
        try {
            await api('POST', `/cards/${card.key}/split`, { count: 1 });
            window.setTimeout(() => setState('split'), reduce ? 0 : 900);
        } catch (error) {
            setState('shown');
            toast.error(
                error instanceof ApiError
                    ? error.message
                    : tr('Не вдалося розщепити.'),
            );
        }
    };

    return (
        <m.div
            initial={reduce ? false : { rotateY: 180, opacity: 0, y: 20 }}
            animate={{ rotateY: 0, opacity: 1, y: 0 }}
            transition={motionOr(reduce, {
                delay: 0.25 + index * 0.35,
                duration: 0.55,
                ease: 'easeOut',
            })}
            className="relative flex w-36 flex-col items-center gap-2 sm:w-44"
        >
            <div className="relative w-full">
                <AnimatePresence>
                    {state !== 'split' && state !== 'splitting' && (
                        <m.div exit={{ opacity: 0, scale: 0.9 }}>
                            <GameCardArt card={card} />
                        </m.div>
                    )}
                </AnimatePresence>
                {(state === 'splitting' || state === 'split') && (
                    <div className="relative aspect-[5/7] w-full">
                        {!reduce &&
                            SHARDS.map((s, i) => (
                                <m.span
                                    key={i}
                                    className="absolute top-1/2 left-1/2"
                                    style={{
                                        width: s.size,
                                        height: s.size,
                                        clipPath: s.clip,
                                        background: `linear-gradient(135deg, ${tone.ring}, ${tone.ring2 ?? '#a78bfa'})`,
                                        boxShadow: `0 0 12px ${tone.glow}`,
                                    }}
                                    initial={{
                                        x: 0,
                                        y: 0,
                                        opacity: 1,
                                        rotate: 0,
                                        scale: 1,
                                    }}
                                    animate={{
                                        x: s.x,
                                        y: s.y,
                                        opacity: 0,
                                        rotate: s.r,
                                        scale: 0.3,
                                    }}
                                    transition={{
                                        duration: 0.9,
                                        ease: 'easeOut',
                                    }}
                                />
                            ))}
                        <m.div
                            initial={
                                reduce ? false : { scale: 0.2, opacity: 0 }
                            }
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{
                                delay: reduce ? 0 : 0.35,
                                type: 'spring',
                                stiffness: 260,
                                damping: 14,
                            }}
                            className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white"
                        >
                            <Gem className="size-12 text-violet-300 drop-shadow-[0_0_16px_rgba(167,139,250,0.8)]" />
                            <span className="font-display text-xl font-bold">
                                +{card.dust}
                            </span>
                            <span className="text-xs text-white/70">
                                {tr('кристалів')}
                            </span>
                        </m.div>
                    </div>
                )}
                {card.new && (
                    <span className="absolute -top-2 -left-2 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
                        {tr('Нова')}
                    </span>
                )}
            </div>
            {!card.new && state === 'shown' && (
                <div className="flex w-full flex-col gap-1.5">
                    <span className="text-center text-xs text-white/70">
                        {tr('Дублікат (у вас {n})', { n: card.copies })}
                    </span>
                    <div className="flex gap-1.5">
                        <Button
                            size="sm"
                            variant="secondary"
                            className="flex-1"
                            onClick={() => setState('kept')}
                        >
                            {tr('Залишити')}
                        </Button>
                        <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => void split()}
                        >
                            <Gem className="size-3.5" />+{card.dust}
                        </Button>
                    </div>
                </div>
            )}
        </m.div>
    );
}

/** Показ відкритих карток. */
export function CardReveal({
    cards,
    onClose,
}: {
    cards: DrawnCard[];
    onClose: () => void;
}) {
    return (
        <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-on-dark
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 overflow-y-auto bg-black/85 p-4"
        >
            <h2 className="font-display text-2xl font-bold text-white">
                {cards.length > 1 ? tr('Ваш набір') : tr('Ваша картка')}
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
                {cards.map((c, i) => (
                    <RevealCard key={`${c.key}-${i}`} card={c} index={i} />
                ))}
            </div>
            <Button
                onClick={() => {
                    onClose();
                    router.reload();
                }}
            >
                {tr('До альбому')}
            </Button>
        </m.div>
    );
}
