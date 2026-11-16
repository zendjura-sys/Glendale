import { warm, NAV_CACHE, primaryWarmUrls } from '@/lib/prefetch';

/** Ключові маршрути для предзавантаження під час прелоадера. */
const BOOT_ROUTES = ['/feed', '/messages', '/friends', '/communities'] as const;

/**
 * Поки крутиться прелоадер — гріємо стрічку, чати, друзів, меню/спільноти
 * і кілька іконок оболонки (Inertia prefetch + Image()).
 */
export function warmBootRoutes(username?: string | null): void {
    const routes = [
        ...BOOT_ROUTES,
        ...(username
            ? primaryWarmUrls({ username, modules: null })
            : []),
    ];
    for (const href of new Set(routes)) {
        warm(href, NAV_CACHE);
    }
    for (const src of [
        '/images/app/logo.webp',
        '/favicon.svg',
        '/apple-touch-icon.png',
    ]) {
        const img = new Image();
        img.decoding = 'async';
        img.src = src;
    }
}
