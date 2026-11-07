import { Check, Lock, Plus, Smile, Sparkles } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { BADGE_ICONS } from './cosmetics';

export type Reward = {
    type: 'frame' | 'name' | 'badge' | 'header' | 'stickers' | 'xp';
    value: string;
    name: string;
    colors?: string[];
    icon?: string;
    color?: string;
    xp?: number;
};

export type PassLevel = {
    level: number;
    cost: number;
    total: number;
    free: Reward | null;
    plus: Reward | null;
    free_claimed: boolean;
    plus_claimed: boolean;
};

export type Track = 'free' | 'plus';

/** Як виглядає нагорода: рамка, колір ніку, значок, ефект шапки, стікери, досвід. */
export function RewardIcon({
    reward,
    className,
}: {
    reward: Reward;
    className?: string;
}) {
    const box = cn(
        'flex size-10 shrink-0 items-center justify-center rounded-control bg-white/[0.06]',
        className,
    );
    const colors = reward.colors ?? ['#6366f1'];
    switch (reward.type) {
        case 'frame':
            return (
                <span className={box}>
                    <span
                        className="size-6 rounded-full p-[3px]"
                        style={{
                            backgroundImage: `linear-gradient(135deg, ${colors.length > 1 ? colors.join(', ') : `${colors[0]}, ${colors[0]}`})`,
                        }}
                    >
                        <span className="block size-full rounded-full bg-void" />
                    </span>
                </span>
            );
        case 'name':
            return (
                <span className={box}>
                    <span
                        className="font-display text-base font-bold"
                        style={
                            colors.length > 1
                                ? {
                                      backgroundImage: `linear-gradient(90deg, ${colors.join(', ')})`,
                                      WebkitBackgroundClip: 'text',
                                      backgroundClip: 'text',
                                      color: 'transparent',
                                  }
                                : { color: colors[0] }
                        }
                    >
                        Aa
                    </span>
                </span>
            );
        case 'badge': {
            const Icon =
                BADGE_ICONS[reward.icon as keyof typeof BADGE_ICONS] ??
                Sparkles;

            return (
                <span className={box}>
                    <Icon
                        className="size-5"
                        style={{ color: reward.color }}
                        strokeWidth={2.4}
                    />
                </span>
            );
        }
        case 'header':
            return (
                <span className={box}>
                    <Sparkles className="size-5 text-primary" />
                </span>
            );
        case 'stickers':
            return (
                <span className={box}>
                    <Smile className="size-5 text-primary" />
                </span>
            );
        default:
            return (
                <span className={box}>
                    <span className="text-xs font-bold text-white tabular-nums">
                        +{reward.xp ?? 0}
                    </span>
                </span>
            );
    }
}

/** Назва типу нагороди. */
export function rewardKind(type: Reward['type']): string {
    return {
        frame: tr('Рамка аватара'),
        name: tr('Колір ніку'),
        badge: tr('Значок'),
        header: tr('Ефект шапки'),
        stickers: tr('Стікери'),
        xp: tr('Досвід'),
    }[type];
}

type Props = {
    levels: PassLevel[];
    /** Пройдено рівнів. */
    level: number;
    plus: boolean;
    onClaim?: (level: number, track: Track) => void;
    busy?: string | null;
};

/**
 * Горизонтальна доріжка рівнів: угорі — безкоштовні нагороди, внизу — GameCon+.
 * Поточний рівень підсвічено, доступні нагороди світяться.
 */
export function LevelTrack({ levels, level, plus, onClaim, busy }: Props) {
    const reduce = useReducedMotion();
    const scroller = useRef<HTMLDivElement>(null);

    // Прокрутити до поточного рівня.
    useEffect(() => {
        const el = scroller.current?.querySelector<HTMLElement>(
            '[data-current="true"]',
        );
        if (el && scroller.current) {
            scroller.current.scrollLeft =
                el.offsetLeft - scroller.current.clientWidth / 2 + 48;
        }
    }, [level]);

    return (
        <div
            ref={scroller}
            className="-mx-1 [scrollbar-width:thin] overflow-x-auto px-1 pb-2"
        >
            <div className="flex w-max gap-2">
                <div className="flex w-16 shrink-0 flex-col gap-2 text-[11px] font-semibold text-white/50">
                    <span className="flex h-24 items-center">
                        {tr('Безкоштовно')}
                    </span>
                    <span className="h-7" />
                    <span className="flex h-24 items-center gap-1 text-primary">
                        <Plus className="size-3" strokeWidth={3} />
                        GameCon+
                    </span>
                </div>
                {levels.map((row, i) => {
                    const reached = row.level <= level;
                    const current = row.level === level + 1;

                    return (
                        <m.div
                            key={row.level}
                            data-current={current}
                            initial={reduce ? false : { opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.25,
                                delay: reduce ? 0 : Math.min(i, 12) * 0.02,
                            }}
                            className="flex w-24 shrink-0 flex-col gap-2"
                        >
                            <Cell
                                reward={row.free}
                                claimed={row.free_claimed}
                                reached={reached}
                                allowed
                                busy={busy === `${row.level}:free`}
                                onClaim={
                                    onClaim
                                        ? () => onClaim(row.level, 'free')
                                        : undefined
                                }
                            />
                            <div
                                className={cn(
                                    'flex h-7 items-center justify-center rounded-control text-xs font-bold tabular-nums',
                                    reached
                                        ? 'bg-primary text-white'
                                        : current
                                          ? 'bg-primary/15 text-white ring-1 ring-primary'
                                          : 'bg-white/[0.05] text-white/45',
                                )}
                                title={tr('{n} очок', { n: row.total })}
                            >
                                {row.level}
                            </div>
                            <Cell
                                reward={row.plus}
                                claimed={row.plus_claimed}
                                reached={reached}
                                allowed={plus}
                                premium
                                busy={busy === `${row.level}:plus`}
                                onClaim={
                                    onClaim
                                        ? () => onClaim(row.level, 'plus')
                                        : undefined
                                }
                            />
                        </m.div>
                    );
                })}
            </div>
        </div>
    );
}

function Cell({
    reward,
    claimed,
    reached,
    allowed,
    premium = false,
    busy,
    onClaim,
}: {
    reward: Reward | null;
    claimed: boolean;
    reached: boolean;
    allowed: boolean;
    premium?: boolean;
    busy: boolean;
    onClaim?: () => void;
}) {
    if (!reward) {
        return (
            <div className="h-24 rounded-xl border border-dashed border-white/[0.06]" />
        );
    }
    const claimable = reached && allowed && !claimed;

    return (
        <div
            className={cn(
                'relative flex h-24 flex-col items-center justify-between rounded-xl border p-2 text-center transition',
                premium
                    ? 'border-primary/20 bg-primary/[0.06]'
                    : 'border-white/[0.07] bg-white/[0.03]',
                claimable &&
                    'border-primary shadow-[0_0_18px_-4px_var(--color-primary)]',
                !reached && 'opacity-60',
            )}
        >
            <RewardIcon reward={reward} className="size-9" />
            <span className="line-clamp-1 w-full text-[11px] text-white/70">
                {reward.name}
            </span>
            {claimed ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                    <Check className="size-3" />
                    {tr('Отримано')}
                </span>
            ) : claimable && onClaim ? (
                <button
                    type="button"
                    onClick={onClaim}
                    disabled={busy}
                    className="h-6 w-full cursor-pointer rounded-md bg-primary text-[11px] font-semibold text-white transition hover:bg-primary/85 disabled:opacity-60"
                >
                    {tr('Забрати')}
                </button>
            ) : (
                <span className="flex items-center gap-1 text-[11px] text-white/40">
                    <Lock className="size-3" />
                    {reached && !allowed ? 'GameCon+' : tr('Рівень')}
                </span>
            )}
        </div>
    );
}
