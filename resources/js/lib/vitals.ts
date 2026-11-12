import { router } from '@inertiajs/react';

/**
 * Монітор швидкості: LCP і TTFB першого завантаження, INP (найдовша взаємодія) і CLS кожної
 * сторінки. Без cookie й акаунта — лише назва сторінки (компонент Inertia), тип пристрою й числа.
 * Надсилаємо, коли людина переходить на іншу сторінку або ховає вкладку.
 */
type Sample = { metric: 'LCP' | 'INP' | 'CLS' | 'TTFB'; value: number };

let page = '';
let samples: Sample[] = [];
let inp = 0;
let cls = 0;
let lcp = 0;
let firstLoad = true;

function device(): 'mobile' | 'tablet' | 'desktop' {
    const w = window.innerWidth;

    return w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
}

function flush() {
    if (!page) return;
    if (firstLoad && lcp > 0)
        samples.push({ metric: 'LCP', value: Math.round(lcp) });
    if (inp > 0) samples.push({ metric: 'INP', value: Math.round(inp) });
    samples.push({ metric: 'CLS', value: Number(cls.toFixed(4)) });
    const body = JSON.stringify({ page, device: device(), samples });
    try {
        if (
            !navigator.sendBeacon?.(
                '/api/vitals',
                new Blob([body], { type: 'text/plain' }),
            )
        ) {
            void fetch('/api/vitals', {
                method: 'POST',
                body,
                keepalive: true,
            }).catch(() => undefined);
        }
    } catch {
        // Заміри не важливіші за сторінку.
    }
    samples = [];
    inp = 0;
    cls = 0;
    firstLoad = false;
}

function observe(
    type: string,
    cb: (entries: PerformanceEntryList) => void,
    extra: Record<string, unknown> = {},
) {
    try {
        new PerformanceObserver((list) => cb(list.getEntries())).observe({
            type,
            buffered: true,
            ...extra,
        } as PerformanceObserverInit);
    } catch {
        // Браузер не підтримує цей тип — просто без нього.
    }
}

/** Сторінку дізнаємося з події navigate — Inertia надсилає її і при першому завантаженні. */
export function installVitals() {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window))
        return;
    // Один з чотирьох візитів — цього досить для p75 і не навантажує сервер.
    if (Math.random() > 0.25) return;

    const nav = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined;
    if (nav && nav.responseStart > 0)
        samples.push({ metric: 'TTFB', value: Math.round(nav.responseStart) });

    observe('largest-contentful-paint', (entries) => {
        const last = entries[entries.length - 1];
        if (last && firstLoad) lcp = last.startTime;
    });
    observe(
        'event',
        (entries) => {
            for (const e of entries as (PerformanceEntry & {
                interactionId?: number;
            })[]) {
                if (e.interactionId) inp = Math.max(inp, e.duration);
            }
        },
        { durationThreshold: 40 },
    );
    observe('layout-shift', (entries) => {
        for (const e of entries as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
        })[]) {
            if (!e.hadRecentInput) cls += e.value;
        }
    });

    router.on('navigate', (event) => {
        const next = event.detail.page.component;
        if (next === page) return;
        flush();
        page = next;
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush();
    });
}
