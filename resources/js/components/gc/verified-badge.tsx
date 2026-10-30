import { useId } from 'react';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

/** Кольори й підписи позначки за видом (верифікація 2.0). */
const KINDS: Record<string, { from: string; to: string; label: () => string }> =
    {
        identity: {
            from: '#2f7bff',
            to: '#22d3ee',
            label: () => tr('Підтверджена особа'),
        },
        creator: {
            from: '#7c3aed',
            to: '#c084fc',
            label: () => tr('Підтверджений автор'),
        },
        business: {
            from: '#d97706',
            to: '#facc15',
            label: () => tr('Підтверджений бізнес'),
        },
        organization: {
            from: '#475569',
            to: '#94a3b8',
            label: () => tr('Підтверджена організація'),
        },
    };

export function VerifiedBadge({
    className,
    kind,
}: {
    className?: string;
    kind?: string | null;
}) {
    const look = (kind && KINDS[kind]) || null;
    const label = look ? look.label() : tr('Підтверджений профіль');
    const gradientId = `gc-verified${useId().replace(/[^\w-]/g, '')}`;

    return (
        <svg
            viewBox="0 0 24 24"
            className={cn('inline-block size-4 shrink-0', className)}
            aria-label={label}
        >
            <title>{label}</title>
            <defs>
                <linearGradient
                    id={gradientId}
                    x1="0"
                    y1="0"
                    x2="24"
                    y2="24"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stopColor={look?.from ?? '#2f7bff'} />
                    <stop offset="1" stopColor={look?.to ?? '#22d3ee'} />
                </linearGradient>
            </defs>
            <path
                fill={`url(#${gradientId})`}
                d="M12 1.5l2.4 1.8 3-.2 1 2.8 2.6 1.6-.6 2.9L22 13l-1.9 2.4.2 3-2.8 1-1.6 2.6-2.9-.6L12 22.5l-2.4-1.9-3 .2-1-2.8-2.6-1.6.6-2.9L2 11l1.9-2.4-.2-3 2.8-1L8.1 2l2.9.6L12 1.5z"
            />
            <path
                d="M7.8 12.3l2.8 2.8 5.6-5.8"
                fill="none"
                stroke="#fff"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
