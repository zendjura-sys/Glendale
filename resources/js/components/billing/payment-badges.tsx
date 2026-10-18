import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { PaymentBadge } from '@/types/billing';

/**
 * Значки способів оплати (футер, сторінка оплати). Пласкі «плитки» з власними
 * спрощеними позначками: без зображень з чужих серверів, у кольорах теми.
 * Список вмикає адміністратор (Адмінка → Білінг → Правила): показуємо лише те,
 * що справді приймає еквайринг monobank.
 */
const MARKS: Record<PaymentBadge, { label: string; mark: () => ReactNode }> = {
    visa: {
        label: 'Visa',
        mark: () => (
            <span className="text-[13px] font-black tracking-tight italic">
                VISA
            </span>
        ),
    },
    mastercard: {
        label: 'Mastercard',
        mark: () => <Circles left="#eb001b" right="#f79e1b" middle="#ff5f00" />,
    },
    maestro: {
        label: 'Maestro',
        mark: () => <Circles left="#0099df" right="#eb001b" middle="#6c6bbd" />,
    },
    prostir: {
        label: 'ПРОСТІР',
        mark: () => (
            <span className="text-[10px] font-extrabold tracking-wide">
                ПРОСТІР
            </span>
        ),
    },
    apple_pay: {
        label: 'Apple Pay',
        mark: () => (
            <span className="text-[11px] font-semibold">Apple Pay</span>
        ),
    },
    google_pay: {
        label: 'Google Pay',
        mark: () => (
            <span className="text-[11px] font-semibold">
                <span className="text-[#4285f4]">G</span> Pay
            </span>
        ),
    },
};

function Circles({
    left,
    right,
    middle,
}: {
    left: string;
    right: string;
    middle: string;
}) {
    return (
        <svg viewBox="0 0 32 20" className="h-4 w-auto" aria-hidden>
            <circle cx="11" cy="10" r="8" fill={left} />
            <circle cx="21" cy="10" r="8" fill={right} />
            <path
                d="M16 3.8a8 8 0 0 1 0 12.4 8 8 0 0 1 0-12.4z"
                fill={middle}
            />
        </svg>
    );
}

export function PaymentBadges({ className }: { className?: string }) {
    const badges = usePage().props.billing?.badges ?? [];
    if (badges.length === 0) return null;

    return (
        <ul
            className={cn('flex flex-wrap items-center gap-1.5', className)}
            aria-label={tr('Способи оплати')}
        >
            {badges.map((key) => {
                const badge = MARKS[key];
                if (!badge) return null;

                return (
                    <li
                        key={key}
                        title={badge.label}
                        className="flex h-7 min-w-11 items-center justify-center rounded-md border border-white/10 bg-white/[0.05] px-2 text-white/80"
                    >
                        {badge.mark()}
                        <span className="sr-only">{badge.label}</span>
                    </li>
                );
            })}
        </ul>
    );
}
