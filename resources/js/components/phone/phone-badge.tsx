import { TIER_ICONS, TIER_LABELS } from '@/lib/phones';
import { cn } from '@/lib/utils';
import type { PhoneCard } from '@/types';

/**
 * Номер у кольорі свого рівня зі значком (бронза, срібло, золото, платина, діамант). Пласко, без 3D:
 * діамант лише м’яко переливається градієнтом.
 */
export function PhoneBadge({
    phone,
    size = 'md',
    className,
    showLabel = false,
}: {
    phone: Pick<PhoneCard, 'number' | 'tier'>;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    showLabel?: boolean;
}) {
    const Icon = TIER_ICONS[phone.tier];
    const label = TIER_LABELS()[phone.tier];

    return (
        <span
            className={cn(
                'phone-badge inline-flex items-center gap-1.5 font-semibold tabular-nums',
                `phone-tier--${phone.tier}`,
                size === 'sm' && 'text-[13px]',
                size === 'md' && 'text-[15px]',
                size === 'lg' && 'text-2xl tracking-tight sm:text-3xl',
                className,
            )}
            title={phone.tier === 'regular' ? undefined : label}
        >
            <Icon
                aria-hidden
                className={cn(
                    'phone-badge__icon shrink-0',
                    size === 'lg' ? 'size-6' : 'size-4',
                )}
            />
            <span className="phone-badge__number">{phone.number}</span>
            {showLabel && phone.tier !== 'regular' && (
                <span className="phone-badge__label rounded-full px-2 py-0.5 text-[11px] font-semibold">
                    {label}
                </span>
            )}
        </span>
    );
}
