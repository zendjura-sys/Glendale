import { Gift } from 'lucide-react';
import { PlusBadge } from '@/components/gc/plus';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type GiftTheme = 'ice' | 'neon' | 'gold';

export const GIFT_THEMES = (): { value: GiftTheme; label: string }[] => [
    { value: 'ice', label: tr('Крига') },
    { value: 'neon', label: tr('Неон') },
    { value: 'gold', label: tr('Золото') },
];

const BG: Record<GiftTheme, string> = {
    ice: 'bg-[linear-gradient(140deg,#0c2a4a_0%,#0b1a33_55%,#071222_100%)]',
    neon: 'bg-[linear-gradient(140deg,#2a0d4a_0%,#14123a_55%,#071222_100%)]',
    gold: 'bg-[linear-gradient(140deg,#3d2a08_0%,#1d1a12_55%,#0d0f14_100%)]',
};
const ACCENT: Record<GiftTheme, string> = {
    ice: 'text-sky-300',
    neon: 'text-fuchsia-300',
    gold: 'text-amber-300',
};

/** Листівка подарунка GameCon+: оформлення, хто дарує, на скільки й побажання. */
export function GiftCardArt({
    theme,
    from,
    to,
    days,
    message,
    className,
}: {
    theme: GiftTheme;
    from: string;
    to: string;
    days: number;
    message?: string | null;
    className?: string;
}) {
    return (
        <div
            data-on-dark
            className={cn(
                'relative overflow-hidden rounded-3xl p-6 text-white shadow-[0_20px_50px_-20px_rgb(0_0_0/0.6)]',
                BG[theme],
                className,
            )}
        >
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-display text-lg font-bold">
                    <PlusBadge className="size-7 rounded-lg [&_svg]:size-5" />
                    GameCon+
                </span>
                <Gift className={cn('size-6', ACCENT[theme])} />
            </div>
            <p className={cn('mt-6 text-sm font-semibold', ACCENT[theme])}>
                {days >= 365
                    ? tr('Подарунок на рік')
                    : tr('Подарунок на {n} днів', { n: days })}
            </p>
            <p className="mt-1 font-display text-2xl leading-tight font-bold break-words">
                {to ? tr('Кому: {name}', { name: to }) : tr('Кому: другові')}
            </p>
            {message && (
                <p className="mt-4 rounded-2xl bg-white/[0.08] p-3 text-sm leading-relaxed break-words whitespace-pre-line text-white/90">
                    {message}
                </p>
            )}
            <p className="mt-5 text-xs text-white/60">
                {tr('Від: {name}', { name: from })}
            </p>
        </div>
    );
}
