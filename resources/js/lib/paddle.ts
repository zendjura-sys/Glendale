/**
 * Paddle.js v2 — оплата GameCon+.
 *
 * Як це працює:
 *  1. Сервер (POST /plus/checkout) створює транзакцію Paddle з товаром і custom_data (user_id, family_id…)
 *     і повертає її ID разом із client-side token.
 *  2. loadPaddle() один раз підвантажує https://cdn.paddle.com/paddle/v2/paddle.js і викликає Paddle.Initialize().
 *  3. openPaddleCheckout() відкриває **inline**-чекаут у нашому власному вікні (components/gc/paddle-checkout.tsx):
 *     довкола — наше скло, шрифт і кольори, усередині — форма Paddle з темою сайту й мовою інтерфейсу.
 *     Колір кнопок і логотип у самій формі задаються в кабінеті Paddle → Checkout settings → Branding (#6366F1).
 *  4. Після checkout.completed вебхук Paddle → Cashier → GameCon+ вмикається за кілька секунд.
 */

export type PaddleEvent = {
    name?: string;
    data?: { transaction_id?: string; status?: string } | null;
};

type PaddleGlobal = {
    Environment: { set: (env: 'sandbox' | 'production') => void };
    Initialize: (options: {
        token: string;
        eventCallback?: (event: PaddleEvent) => void;
        checkout?: { settings?: Record<string, unknown> };
    }) => void;
    Checkout: {
        open: (options: Record<string, unknown>) => void;
        close: () => void;
    };
    Initialized?: boolean;
};

declare global {
    interface Window {
        Paddle?: PaddleGlobal;
    }
}

const SDK = 'https://cdn.paddle.com/paddle/v2/paddle.js';

/** Мови, які підтримує чекаут Paddle; решта — англійська. */
const PADDLE_LOCALES: Record<string, string> = {
    uk: 'uk',
    en: 'en',
    de: 'de',
    fr: 'fr',
    es: 'es',
    it: 'it',
    ja: 'ja',
    ko: 'ko',
    zh: 'zh-Hans',
    ru: 'ru',
    pl: 'pl',
    pt: 'pt',
    nl: 'nl',
    tr: 'tr',
};

export function paddleLocale(locale: string): string {
    return PADDLE_LOCALES[locale.split('-')[0].toLowerCase()] ?? 'en';
}

/** Тема чекауту = тема сайту (GameCon за замовчуванням темний). */
export function paddleTheme(): 'dark' | 'light' {
    return document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light';
}

let loading: Promise<PaddleGlobal> | null = null;
let listener: ((event: PaddleEvent) => void) | null = null;

/** Підвантажує SDK і ініціалізує Paddle (один раз на сторінку). */
export function loadPaddle(
    token: string,
    sandbox: boolean,
): Promise<PaddleGlobal> {
    loading ??= new Promise<PaddleGlobal>((resolve, reject) => {
        const ready = () => {
            const paddle = window.Paddle;
            if (!paddle) {
                reject(new Error('Paddle.js не завантажився'));

                return;
            }
            if (sandbox) paddle.Environment.set('sandbox');
            paddle.Initialize({
                token,
                // Усі події чекауту йдуть у поточне вікно оплати.
                eventCallback: (event) => listener?.(event),
            });
            resolve(paddle);
        };
        if (window.Paddle) {
            ready();

            return;
        }
        const script = document.createElement('script');
        script.src = SDK;
        script.async = true;
        script.onload = ready;
        script.onerror = () => {
            loading = null;
            reject(new Error('Paddle.js не завантажився'));
        };
        document.head.appendChild(script);
    });

    return loading;
}

/**
 * Відкриває inline-чекаут у контейнері frameTarget (клас елемента).
 * customData вже записана в транзакцію сервером — тут лише вигляд.
 */
export async function openPaddleCheckout(options: {
    token: string;
    sandbox: boolean;
    transactionId: string;
    frameTarget: string;
    locale: string;
    onEvent: (event: PaddleEvent) => void;
}): Promise<void> {
    const paddle = await loadPaddle(options.token, options.sandbox);
    listener = options.onEvent;
    paddle.Checkout.open({
        transactionId: options.transactionId,
        settings: {
            displayMode: 'inline',
            frameTarget: options.frameTarget,
            frameInitialHeight: 450,
            // Прозорий фон і без рамки — форма «вростає» в наше вікно.
            frameStyle:
                'width: 100%; min-width: 312px; background-color: transparent; border: none;',
            theme: paddleTheme(),
            locale: paddleLocale(options.locale),
            variant: 'one-page',
            allowLogout: false,
            showAddDiscounts: true,
        },
    });
}

export function closePaddleCheckout(): void {
    listener = null;
    window.Paddle?.Checkout.close();
}
