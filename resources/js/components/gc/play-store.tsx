import { usePage } from '@inertiajs/react';
import { useId } from 'react';
import { cn } from '@/lib/utils';

function PlayGlyph() {
    const gradientId = `gc-store${useId().replace(/[^\w-]/g, '')}`;

    return (
        <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden>
            <defs>
                <linearGradient id={gradientId} x1="4" y1="2" x2="20" y2="22">
                    <stop stopColor="#6fa2ff" />
                    <stop offset="0.55" stopColor="#8b6bff" />
                    <stop offset="1" stopColor="#f04fd8" />
                </linearGradient>
            </defs>
            <path
                d="M4.5 3.4c0-1.2 1.3-2 2.3-1.3l13.2 8.1c1 .6 1 2 0 2.6L6.8 20.9c-1 .6-2.3-.1-2.3-1.3V3.4Z"
                fill={`url(#${gradientId})`}
            />
        </svg>
    );
}

export function PlayStoreLink({
    className,
    compact = false,
}: {
    className?: string;
    compact?: boolean;
}) {
    const store = usePage().props.site.play_store;

    if (!store) {
        return null;
    }

    return (
        <a
            href={store.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                'inline-flex items-center gap-2.5 rounded-2xl border border-white/10 bg-[#101428] px-4 py-2 text-white transition hover:border-white/25',
                className,
            )}
        >
            <PlayGlyph />
            <span className="text-left leading-tight">
                {!compact && (
                    <span className="block text-[10px] font-medium tracking-wide text-white/50 uppercase">
                        Доступно в
                    </span>
                )}
                <span className="block text-sm font-semibold">Google Play</span>
            </span>
        </a>
    );
}
