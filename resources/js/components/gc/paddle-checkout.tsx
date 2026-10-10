import { router } from '@inertiajs/react';
import { CheckCircle2, Loader2, Lock, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PlusBadge } from '@/components/gc/plus';
import { LOCALE, tr } from '@/lib/i18n';
import { closePaddleCheckout, openPaddleCheckout } from '@/lib/paddle';
import type { PaddleEvent } from '@/lib/paddle';

/** Подія, якою будь-яка сторінка просить відкрити оплату (див. startCheckout у lib/plus.ts). */
export const CHECKOUT_EVENT = 'gc:paddle-checkout';

export type CheckoutRequest = {
    transactionId: string;
    token: string;
    sandbox: boolean;
    title: string;
};

const FRAME = 'gc-paddle-frame';

/**
 * Вікно оплати GameCon+: наше скло, шрифт Montserrat і акцент сайту довкола inline-чекауту Paddle.
 * Монтується один раз у SocialLayout і слухає CHECKOUT_EVENT.
 */
export function PaddleCheckoutHost() {
    const [request, setRequest] = useState<CheckoutRequest | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'done' | 'error'>(
        'loading',
    );

    useEffect(() => {
        const onOpen = (event: Event) => {
            setRequest((event as CustomEvent<CheckoutRequest>).detail);
            setState('loading');
        };
        window.addEventListener(CHECKOUT_EVENT, onOpen);

        return () => window.removeEventListener(CHECKOUT_EVENT, onOpen);
    }, []);

    useEffect(() => {
        if (!request) return;
        const onEvent = (event: PaddleEvent) => {
            if (event.name === 'checkout.loaded') setState('ready');
            if (event.name === 'checkout.completed') {
                setState('done');
                // Вебхук доходить за кілька секунд — оновлюємо сторінку трохи згодом.
                window.setTimeout(() => router.reload(), 3500);
            }
            if (event.name === 'checkout.error') setState('error');
        };
        void openPaddleCheckout({
            token: request.token,
            sandbox: request.sandbox,
            transactionId: request.transactionId,
            frameTarget: FRAME,
            locale: LOCALE,
            onEvent,
        }).catch(() => setState('error'));
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
        window.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';

        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [request]);

    const close = () => {
        closePaddleCheckout();
        setRequest(null);
    };

    if (!request) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={tr('Оплата')}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={(event) => event.target === event.currentTarget && close()}
        >
            <div className="glass-strong flex max-h-[92dvh] w-full max-w-lg animate-rise flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl">
                <header className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
                    <PlusBadge className="size-7 rounded-lg [&_svg]:size-5" />
                    <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-base font-bold text-white">
                            {request.title}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-white/45">
                            <Lock className="size-3" />
                            {tr('Безпечна оплата через Paddle')}
                        </span>
                    </span>
                    <button
                        type="button"
                        onClick={close}
                        className="rounded-xl p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
                        aria-label={tr('Закрити')}
                    >
                        <X className="size-5" />
                    </button>
                </header>
                <div className="relative min-h-[450px] flex-1 overflow-y-auto px-3 py-3 sm:px-4">
                    {state === 'loading' && (
                        <div className="absolute inset-0 flex items-center justify-center text-white/50">
                            <Loader2 className="size-6 animate-spin" />
                        </div>
                    )}
                    {state === 'done' ? (
                        <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center">
                            <CheckCircle2 className="size-12 text-emerald-300" />
                            <p className="font-display text-xl font-bold text-white">
                                {tr('Оплату прийнято!')}
                            </p>
                            <p className="max-w-xs text-sm text-white/55">
                                {tr(
                                    'GameCon+ увімкнеться за кілька секунд. Чек Paddle надіслав на вашу пошту.',
                                )}
                            </p>
                            <button
                                type="button"
                                onClick={close}
                                className="mt-2 inline-flex h-10 items-center rounded-xl bg-[var(--btn-primary,#6366f1)] px-5 text-sm font-semibold text-white"
                            >
                                {tr('Готово')}
                            </button>
                        </div>
                    ) : state === 'error' ? (
                        <p className="flex min-h-[420px] items-center justify-center text-center text-sm text-rose-200">
                            {tr(
                                'Не вдалося відкрити оплату. Спробуйте ще раз пізніше.',
                            )}
                        </p>
                    ) : (
                        <div className={FRAME} />
                    )}
                </div>
                <footer className="border-t border-white/[0.06] px-5 py-3 text-center text-[11px] text-white/40">
                    {tr(
                        'Payments securely processed by Paddle as Merchant of Record.',
                    )}
                </footer>
            </div>
        </div>
    );
}
