import { router } from '@inertiajs/react';

/**
 * Згода на cookie: «necessary» — лише обов’язкові (вхід, безпека, налаштування), «all» — ще й аналітика.
 * Зберігається в браузері; версія дає змогу перепитати, якщо склад cookie зміниться.
 */
export type Consent = 'all' | 'necessary';

const KEY = 'gc-consent';
const VERSION = 1;
const EVENT = 'gc:consent';

export function readConsent(): Consent | null {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as {
            v?: number;
            choice?: Consent;
        } | null;

        return raw?.v === VERSION &&
            (raw.choice === 'all' || raw.choice === 'necessary')
            ? raw.choice
            : null;
    } catch {
        return null;
    }
}

export function saveConsent(choice: Consent): void {
    try {
        localStorage.setItem(
            KEY,
            JSON.stringify({
                v: VERSION,
                choice,
                at: new Date().toISOString(),
            }),
        );
    } catch {
        // Приватний режим: вибір діє до кінця сесії.
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: choice }));
}

/** Відкрити банер знову (посилання «Налаштування cookie» у футері). */
export function reopenConsent(): void {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: null }));
}

export function onConsent(
    listener: (choice: Consent | null) => void,
): () => void {
    const handler = (e: Event) =>
        listener((e as CustomEvent<Consent | null>).detail);
    window.addEventListener(EVENT, handler);

    return () => window.removeEventListener(EVENT, handler);
}

type Gtag = (...args: unknown[]) => void;
declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: Gtag;
    }
}

let loaded: string | null = null;

/**
 * Google Analytics 4 — лише після згоди «all». Перегляди сторінок рахуємо й при переходах Inertia
 * (сайт не перезавантажує сторінку). IP анонімізує сам GA4.
 */
export function startAnalytics(id: string): void {
    if (loaded === id || typeof window === 'undefined') return;
    loaded = id;
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function gtag() {
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer!.push(arguments);
    };
    window.gtag('consent', 'default', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'granted',
    });
    window.gtag('js', new Date());
    window.gtag('config', id, { send_page_view: false });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);

    const view = () =>
        window.gtag?.('event', 'page_view', {
            page_location: window.location.href,
            page_title: document.title,
        });
    view();
    router.on('navigate', view);
}

/** Відкликали згоду — більше нічого не надсилаємо (gtag уже завантажено до перезавантаження сторінки). */
export function stopAnalytics(): void {
    window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
}
