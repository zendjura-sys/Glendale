import { Crown, Flame, Gem, Shield, Star, Zap } from 'lucide-react';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type { Cosmetics } from '@/types';

/** Іконки значків сезонного пропуску (ключі — з config/season_pass.php). */
export const BADGE_ICONS = {
    star: Star,
    flame: Flame,
    zap: Zap,
    shield: Shield,
    crown: Crown,
    gem: Gem,
} as const;

/** Колір ніку з пропуску (лише якщо немає оформлення GameCon+). */
export function cosmeticNameStyle(
    cosmetics: Cosmetics | null | undefined,
): CSSProperties | undefined {
    const colors = cosmetics?.name;
    if (!colors?.length) return undefined;
    if (colors.length === 1) return { color: colors[0] };

    return {
        backgroundImage: `linear-gradient(90deg, ${colors.join(', ')})`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
    };
}

/** Значок сезону біля імені. */
export function CosmeticBadge({
    cosmetics,
    className,
}: {
    cosmetics: Cosmetics | null | undefined;
    className?: string;
}) {
    const badge = cosmetics?.badge;
    if (!badge) return null;
    const Icon = BADGE_ICONS[badge.icon as keyof typeof BADGE_ICONS] ?? Star;

    return (
        <span
            title={badge.name}
            aria-label={badge.name}
            className={cn('inline-flex shrink-0 items-center', className)}
            style={{ color: badge.color }}
        >
            <Icon className="size-full" strokeWidth={2.4} />
        </span>
    );
}
