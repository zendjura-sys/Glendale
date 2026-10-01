import { useId } from 'react';
import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
    const gradientId = `gc-play${useId().replace(/[^\w-]/g, '')}`;

    return (
        <span
            className={cn(
                'relative inline-flex size-9 shrink-0 items-center justify-center',
                className,
            )}
        >
            <span className="bg-gradient-brand absolute inset-0 rounded-[30%] opacity-90 shadow-[0_8px_28px_-6px_rgb(109_93_252/0.9)]" />
            <span className="absolute inset-[1.5px] rounded-[28%] bg-[#0b0f22]" />
            <svg
                viewBox="0 0 32 32"
                className="relative size-[58%]"
                fill="none"
            >
                <defs>
                    <linearGradient
                        id={gradientId}
                        x1="6"
                        y1="4"
                        x2="28"
                        y2="28"
                        gradientUnits="userSpaceOnUse"
                    >
                        <stop stopColor="#6fa2ff" />
                        <stop offset="0.55" stopColor="#8b6bff" />
                        <stop offset="1" stopColor="#f04fd8" />
                    </linearGradient>
                </defs>
                <path
                    d="M9 6.8c0-1.9 2.1-3.1 3.7-2.1l13.2 8.2c1.5.9 1.5 3.2 0 4.1L12.7 25.3C11.1 26.3 9 25.1 9 23.2V6.8Z"
                    fill={`url(#${gradientId})`}
                />
            </svg>
        </span>
    );
}

export function Logo({
    className,
    compact = false,
}: {
    className?: string;
    compact?: boolean;
}) {
    return (
        <span className={cn('inline-flex items-center gap-2.5', className)}>
            <LogoMark />
            {!compact && (
                <span className="font-display text-[19px] font-bold tracking-tight text-white">
                    Game<span className="text-gradient">Con</span>
                </span>
            )}
        </span>
    );
}
