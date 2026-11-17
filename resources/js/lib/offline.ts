/**
 * Офлайн-режим сайту (public/sw.js): реєструємо service worker на всіх сторінках
 * і чистимо збережені сторінки при виході з акаунта.
 * Після деплою новий SW (gc-static-v3) забирає контроль і один раз перезавантажує
 * вкладку — інакше звичайний браузер лишається на старому JS, а інкогніто вже новий.
 */
export const OFFLINE_PAGES_CACHE = 'gc-pages-v2';

export function registerOffline(): void {
    if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !import.meta.env.PROD
    )
        return;

    // Один reload, коли новий SW став controlling (після skipWaiting + claim).
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });

    window.addEventListener('load', () => {
        void navigator.serviceWorker
            .register('/sw.js', { scope: '/', updateViaCache: 'none' })
            .then((reg) => {
                void reg.update();
            })
            .catch(() => undefined);
    });
}

/** Вихід: стрічка й повідомлення цього акаунта не мають лишитися в кеші браузера. */
export function forgetOfflinePages(): void {
    if (typeof caches !== 'undefined')
        void caches.delete(OFFLINE_PAGES_CACHE).catch(() => undefined);
}
