import { Head, Link, router } from '@inertiajs/react';
import { Check, Gem, Gift, Package, Sparkles } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { tr } from '@/lib/i18n';
import { motionOr, RISE } from '@/lib/motion';
import { cn } from '@/lib/utils';

type Cell = {
    day: number;
    kind: 'shards' | 'pack' | 'frame';
    amount: number;
    value?: string;
    claimed: boolean;
    next: boolean;
    claimed_on: string | null;
};

type Props = {
    month: string;
    claimed: number;
    today_claimed: boolean;
    can_claim: boolean;
    plus: boolean;
    days_left: number;
    cells: Cell[];
    got: { kind: Cell['kind']; amount: number } | null;
};

function rewardText(kind: Cell['kind'], amount: number): string {
    switch (kind) {
        case 'pack':
            return tr('Набір карток');
        case 'frame':
            return tr('Рамка «Постійний гість»');
        default:
            return tr('{n} кристалів', { n: amount });
    }
}

function RewardGlyph({ kind }: { kind: Cell['kind'] }) {
    const Icon = kind === 'pack' ? Package : kind === 'frame' ? Sparkles : Gem;

    return (
        <Icon
            className={cn(
                'size-5',
                kind === 'frame'
                    ? 'text-amber-400'
                    : kind === 'pack'
                      ? 'text-sky-400'
                      : 'text-violet-400',
            )}
        />
    );
}

export default function RewardsCalendar({
    month,
    claimed,
    today_claimed,
    can_claim,
    plus,
    days_left,
    cells,
    got,
}: Props) {
    const reduce = useReducedMotion();
    const [busy, setBusy] = useState(false);
    const [shown, setShown] = useState(got);
    useEffect(() => setShown(got), [got]);
    const rawMonth = new Date(`${month}-01T12:00:00`).toLocaleDateString(
        'uk-UA',
        { month: 'long', year: 'numeric' },
    );
    const monthName = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);

    const claim = () => {
        setBusy(true);
        router.post(
            '/rewards/claim',
            {},
            { preserveScroll: true, onFinish: () => setBusy(false) },
        );
    };

    return (
        <>
            <Head title={tr('Нагороди за вхід')} />
            <div className="mx-auto max-w-3xl space-y-5">
                <section className="gc-solid flex flex-wrap items-center gap-4 rounded-xl p-5">
                    <div className="min-w-0 flex-1">
                        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-white">
                            <Gift className="size-6 text-primary" />
                            {tr('Нагороди за вхід')}
                        </h1>
                        <p className="mt-1 text-sm text-white/60">
                            {tr(
                                'Заходьте щодня й забирайте нагороду — кожен день відкриває наступну клітинку. Пропуск не обнуляє прогрес.',
                            )}
                        </p>
                        <p className="mt-2 text-sm text-white/75">
                            {monthName} ·{' '}
                            {tr('{n} з 28 · до кінця місяця {d} дн.', {
                                n: claimed,
                                d: days_left,
                            })}
                        </p>
                        {plus && (
                            <p className="mt-1 text-xs text-primary">
                                {tr('З GameCon+ кристалів удвічі більше')}
                            </p>
                        )}
                    </div>
                    <Button disabled={!can_claim || busy} onClick={claim}>
                        {today_claimed
                            ? tr('Сьогодні вже забрано')
                            : tr('Забрати нагороду дня')}
                    </Button>
                </section>

                <ol className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                    {cells.map((c, i) => (
                        <m.li
                            key={c.day}
                            initial={reduce ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={motionOr(reduce, {
                                ...RISE,
                                delay: i * 0.015,
                            })}
                            className={cn(
                                'gc-solid relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl p-2 text-center',
                                c.next && 'ring-2 ring-primary',
                                c.claimed && 'opacity-60',
                                c.day === 28 && 'sm:col-span-1',
                            )}
                        >
                            <span className="absolute top-1.5 left-2 text-[11px] text-white/45 tabular-nums">
                                {c.day}
                            </span>
                            {c.claimed ? (
                                <Check className="size-6 text-emerald-400" />
                            ) : (
                                <RewardGlyph kind={c.kind} />
                            )}
                            <span className="text-[11px] leading-tight text-white/75">
                                {c.kind === 'shards'
                                    ? `+${plus ? c.amount * 2 : c.amount}`
                                    : c.kind === 'pack'
                                      ? tr('Набір')
                                      : tr('Рамка')}
                            </span>
                        </m.li>
                    ))}
                </ol>

                <p className="text-sm text-white/55">
                    {tr('Кристали й набори — для')}{' '}
                    <Link
                        href="/cards"
                        className="text-primary hover:underline"
                    >
                        {tr('колекційних карток')}
                    </Link>
                    .
                </p>
            </div>

            <AnimatePresence>
                {shown && (
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                        onClick={() => setShown(null)}
                    >
                        <m.div
                            initial={reduce ? false : { scale: 0.9 }}
                            animate={{ scale: 1 }}
                            transition={motionOr(reduce, RISE)}
                            className="gc-solid flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl p-6 text-center"
                        >
                            <span className="flex size-14 items-center justify-center rounded-full bg-white/10">
                                <RewardGlyph kind={shown.kind} />
                            </span>
                            <h2 className="font-display text-xl font-bold text-foreground">
                                {rewardText(shown.kind, shown.amount)}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {tr('Повертайтеся завтра по наступну.')}
                            </p>
                            <Button
                                asChild={shown.kind === 'pack'}
                                onClick={() => setShown(null)}
                            >
                                {shown.kind === 'pack' ? (
                                    <Link href="/cards">
                                        {tr('Відкрити набір')}
                                    </Link>
                                ) : (
                                    tr('Чудово')
                                )}
                            </Button>
                        </m.div>
                    </m.div>
                )}
            </AnimatePresence>
        </>
    );
}
