import { useId } from 'react';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

export function VerifiedBadge({ className }: { className?: string }) {
    const gradientId = `gc-verified${useId().replace(/[^\w-]/g, '')}`;

    return (
        <svg
            viewBox="0 0 24 24"
            className={cn('inline-block size-4 shrink-0', className)}
            aria-label={tr('Підтверджений профіль')}
        >
            <title>{tr('Підтверджений профіль')}</title>
            <defs>
                <linearGradient
                    id={gradientId}
                    x1="0"
                    y1="0"
                    x2="24"
                    y2="24"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stopColor="#4f8bff" />
                    <stop offset="1" stopColor="#a855f7" />
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
