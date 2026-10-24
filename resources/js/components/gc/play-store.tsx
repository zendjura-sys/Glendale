import { usePage } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

/**
 * Офіційні значки Google Play (public/images), обрізані до краю значка.
 * На сайті — WebP висотою 104 px (удвічі більше за показані 52 px); PNG 815×245 — оригінал від Google.
 */
export const PLAY_BADGES = [
    {
        value: 'get',
        src: '/images/google-play-badge.webp',
        alt: 'Get it on Google Play',
        title: tr('Публічний'),
        text: tr('Застосунок опубліковано — значок «Get it on Google Play».'),
    },
    {
        value: 'preregister',
        src: '/images/google-play-preregister.webp',
        alt: 'Pre-register on Google Play',
        title: tr('Попередня реєстрація'),
        text: tr(
            'Застосунок ще не вийшов — значок «Pre-register on Google Play».',
        ),
    },
] as const;

/**
 * Офіційний значок Google Play, обраний в адмінці.
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

    const badge =
        PLAY_BADGES.find((b) => b.value === store.badge) ?? PLAY_BADGES[0];

    return (
        <a
            href={store.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={badge.alt}
            className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-[10px] transition hover:opacity-85 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none',
                className,
            )}
        >
            <img
                src={badge.src}
                alt={badge.alt}
                width={346}
                height={104}
                loading="lazy"
                decoding="async"
                className={cn('w-auto', compact ? 'h-11' : 'h-13')}
            />
        </a>
    );
}
