import { router } from '@inertiajs/react';
import type { LinkPrefetchOption } from '@inertiajs/core';

/**
 * Безшовні переходи: підтягуємо дані сторінки до кліку.
 *
 * Телефон/планшет: немає hover — тому «mount» для постійної навігації й pointerdown
 * для карток у контенті. Десктоп: hover + той самий кеш.
 * Економія трафіку (data-saver) — не гріємо заздалегідь.
 */

/** Кеш розділів шапки / нижньої панелі / меню. */
export const NAV_CACHE = '2m';

/** Кеш карток і посилань у стрічці / каталогах. */
export const CONTENT_CACHE = '1m';

/**
 * Постійна навігація: mount гріє одразу (телефон), hover — при наведенні (ПК).
 * Inertia не вмішує hover+click в одні й ті самі обробники — click тут не ставимо.
 */
export const NAV_PREFETCH: LinkPrefetchOption[] = ['mount', 'hover'];

/** Картки в контенті: лише hover (ПК); дотик — через warmOnPointer / installTouchPrefetch. */
export const CONTENT_PREFETCH: LinkPrefetchOption = 'hover';

function browserSaveData(): boolean {
    return Boolean(
        (navigator as Navigator & { connection?: { saveData?: boolean } })
            .connection?.saveData,
    );
}

/** Чи можна гріти сторінки зараз (без режиму економії). */
export function canPrefetch(): boolean {
    if (typeof window === 'undefined') return false;
    if (browserSaveData()) return false;
    if (document.documentElement.dataset.dataSaver === '1') return false;
    return true;
}

function sameOriginPath(href: string): string | null {
    try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return null;
        if (
            url.pathname === window.location.pathname &&
            url.search === window.location.search
        ) {
            return null;
        }
        return url.pathname + url.search;
    } catch {
        return null;
    }
}

/** Підтягнути GET-сторінку в кеш Inertia (без переходу). */
export function warm(
    href: string,
    cacheFor: string | number = CONTENT_CACHE,
): void {
    if (!canPrefetch()) return;
    const path = sameOriginPath(href);
    if (!path) return;
    if (router.getCached(path) || router.getPrefetching(path)) return;
    try {
        router.prefetch(path, { method: 'get' }, { cacheFor });
    } catch {
        // Невалідний URL / не-GET — мовчки.
    }
}

/** Кілька адрес під час простою (requestIdleCallback). */
export function warmIdle(
    hrefs: string[],
    cacheFor: string | number = NAV_CACHE,
): void {
    if (!canPrefetch() || hrefs.length === 0) return;
    const run = () => {
        for (const href of hrefs) warm(href, cacheFor);
    };
    const ric = (
        window as Window & {
            requestIdleCallback?: (
                cb: () => void,
                opts?: { timeout: number },
            ) => number;
        }
    ).requestIdleCallback;
    if (ric) {
        ric(run, { timeout: 1500 });
    } else {
        window.setTimeout(run, 400);
    }
}

/** Дані вже в кеші — перехід без скелетона. */
export function isPrefetchReady(href: string): boolean {
    try {
        const url = new URL(href, window.location.origin);
        const path = url.pathname + url.search;
        return Boolean(router.getCached(path));
    } catch {
        return false;
    }
}

/** Prefetch ще летить — скоро буде готово. */
export function isPrefetching(href: string): boolean {
    try {
        const url = new URL(href, window.location.origin);
        const path = url.pathname + url.search;
        return Boolean(router.getPrefetching(path));
    } catch {
        return false;
    }
}

/**
 * Глобально: на дотик/стилус гріємо same-origin посилання до кліку.
 * На миші не чіпаємо — там працює hover Inertia.
 */
export function installTouchPrefetch(): () => void {
    if (typeof document === 'undefined') return () => {};

    const onPointerDown = (event: PointerEvent) => {
        if (event.pointerType === 'mouse') return;
        if (!canPrefetch()) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        const anchor = target.closest('a[href]');
        if (!(anchor instanceof HTMLAnchorElement)) return;
        if (anchor.target === '_blank' || anchor.hasAttribute('download'))
            return;
        if (anchor.getAttribute('href')?.startsWith('#')) return;
        warm(anchor.href, CONTENT_CACHE);
    };

    document.addEventListener('pointerdown', onPointerDown, {
        capture: true,
        passive: true,
    });

    return () =>
        document.removeEventListener('pointerdown', onPointerDown, true);
}

/** Основні розділи для прогріву після сплешу (телефон і ПК). */
export function primaryWarmUrls(input: {
    username?: string | null;
    modules?: string[] | null;
}): string[] {
    const modules = new Set(input.modules ?? []);
    const urls = ['/feed', '/messages', '/friends'];
    if (input.username) urls.push(`/${input.username}`);
    if (modules.has('servers') || modules.size === 0) urls.push('/servers');
    if (modules.has('cinema') || modules.size === 0) urls.push('/cinema');
    if (modules.has('music') || modules.size === 0) urls.push('/music');
    if (modules.has('families') || modules.size === 0) urls.push('/families');
    if (modules.has('games') || modules.size === 0) urls.push('/games');
    if (modules.has('communities') || modules.size === 0) {
        urls.push('/communities');
    }
    return urls;
}
