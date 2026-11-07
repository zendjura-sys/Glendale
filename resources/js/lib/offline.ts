/**
 * Офлайн-режим сайту (public/sw.js): реєструємо service worker на всіх сторінках
 * і чистимо збережені сторінки при виході з акаунта.
 */
export const OFFLINE_PAGES_CACHE = 'gc-pages-v2';

export function registerOffline(): void {
    if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !import.meta.env.PROD
    )
        return;
    window.addEventListener('load', () => {
        void navigator.serviceWorker
            .register('/sw.js', { scope: '/' })
            .catch(() => undefined);
    });
}

/** Вихід: стрічка й повідомлення цього акаунта не мають лишитися в кеші браузера. */
export function forgetOfflinePages(): void {
    if (typeof caches !== 'undefined')
        void caches.delete(OFFLINE_PAGES_CACHE).catch(() => undefined);
}
