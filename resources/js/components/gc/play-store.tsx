import { usePage } from '@inertiajs/react';
import { cn } from '@/lib/utils';

/**
 * Офіційний значок «Get it on Google Play» (public/images/google-play-badge.png).
 * За правилами Google значок не змінюємо: лише масштабуємо висотою й лишаємо вільне місце довкола.
 */
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
            aria-label="Завантажити GameCon з Google Play"
            className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-[10px] transition hover:opacity-85 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none',
                className,
            )}
        >
            <img
                src="/images/google-play-badge.png"
                alt="Get it on Google Play"
                width={720}
                height={213}
                loading="lazy"
                decoding="async"
                className={cn('w-auto', compact ? 'h-11' : 'h-13')}
            />
        </a>
    );
}
