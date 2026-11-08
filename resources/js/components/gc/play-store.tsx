import { usePage } from '@inertiajs/react';
import { StoreButton } from '@/components/app-promo/store-buttons';

/**
 * Кнопка Google Play (посилання — Адмінка → Дизайн → «Застосунок і магазини»).
 * Без посилання кнопки не видно.
 */
export function PlayStoreLink({
    className,
}: {
    className?: string;
    compact?: boolean;
}) {
    const url = usePage().props.site.app_links?.google_play;
    if (!url) return null;

    return <StoreButton store="google_play" url={url} className={className} />;
}
