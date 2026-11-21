import { router } from '@inertiajs/react';
import type { LinkPrefetchOption } from '@inertiajs/core';

/**
 * Підтягування сторінок до кліку — лише на ПК (hover / idle).
 * На телефоні/планшеті prefetch і mount-прогрів дають зайве CPU/мережу:
 * кожен таб нижньої панелі тягнув повний Inertia-візит одразу після сплешу.
 */

/** Кеш розділів шапки / нижньої панелі / меню. */
export const NAV_CACHE = '2m';

/** Кеш карток і посилань у стрічці / каталогах. */
export const CONTENT_CACHE = '1m';

/**
 * Постійна навігація на ПК: mount + hover.
 * На телефоні див. navPrefetch() → false.
 */
export const NAV_PREFETCH: LinkPrefetchOption[] = ['mount', 'hover'];

/** Картки в контенті на ПК: hover. */
export const CONTENT_PREFETCH: LinkPrefetchOption = 'hover';

const COARSE_MQ = '(hover: none) and (pointer: coarse)';

function browserSaveData(): boolean {
    return Boolean(
        (navigator as Navigator & { connection?: { saveData?: boolean } })
            .connection?.saveData,
    );
}

/** Телефон / планшет (той самий медіа-запит, що в app.css для мобільного UI). */
export function isCoarsePointer(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(COARSE_MQ).matches;
}

/** Чи можна гріти сторінки зараз (не телефон, не data-saver). */
export function canPrefetch(): boolean {
    if (typeof window === 'undefined') return false;
    if (isCoarsePointer()) return false;
    if (browserSaveData()) return false;
    if (document.documentElement.dataset.dataSaver === '1') return false;
    return true;
}

/** Prefetch для шапки / дока / меню — на телефоні вимкнено. */
export function navPrefetch(): false | LinkPrefetchOption[] {
    return canPrefetch() ? NAV_PREFETCH : false;
}

/** Prefetch для карток — на телефоні вимкнено. */
export function contentPrefetch(): false | LinkPrefetchOption {
    return canPrefetch() ? CONTENT_PREFETCH : false;
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

/** Кілька адрес під час простою (requestIdleCallback) — лише ПК. */
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
 * На телефоні не ставимо — canPrefetch() уже false, але слухач теж не вішаємо.
 * На миші не чіпаємо — там працює hover Inertia.
 */
export function installTouchPrefetch(): () => void {
    if (typeof document === 'undefined') return () => {};
    if (isCoarsePointer()) return () => {};

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

/** Основні розділи для прогріву після сплешу (лише ПК через warmIdle/canPrefetch). */
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
