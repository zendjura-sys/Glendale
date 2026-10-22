import { router, usePage } from '@inertiajs/react';
import {
    CheckCircle2,
    CreditCard,
    Loader2,
    ShieldCheck,
    Tag,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { GooglePayButton } from '@/components/billing/google-pay-button';
import { PlusBadge } from '@/components/gc/plus';
import { api } from '@/lib/api';
import { money, PURCHASE_EVENT, useProducts } from '@/lib/billing';
import type { PurchaseRequest } from '@/lib/billing';
import { tr } from '@/lib/i18n';
import { PRODUCT_LABELS } from '@/lib/plus';
import { cn } from '@/lib/utils';
import type { PaymentOrderCard, Quote } from '@/types/billing';

const btn =
    'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition disabled:opacity-40';
const primary = cn(btn, 'bg-primary text-white hover:opacity-90');
const secondary = cn(btn, 'bg-white/[0.06] text-white/85 hover:bg-white/10');

/** Вікно оплати для всього сайту: карткою через monobank (Visa, Mastercard, Apple Pay, Google Pay). */
export function BillingHost() {
    const [purchase, setPurchase] = useState<PurchaseRequest | null>(null);

    useEffect(() => {
        const onPurchase = (event: Event) =>
            setPurchase((event as CustomEvent<PurchaseRequest>).detail);
        window.addEventListener(PURCHASE_EVENT, onPurchase);

        return () => window.removeEventListener(PURCHASE_EVENT, onPurchase);
    }, []);

    if (!purchase) return null;

    return (
        <PurchaseDialog request={purchase} onClose={() => setPurchase(null)} />
    );
}

function Modal({
    title,
    subtitle,
    onClose,
    children,
}: {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: ReactNode;
}) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';

        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={(event) =>
                event.target === event.currentTarget && onClose()
            }
        >
            <div className="glass-strong flex max-h-[92dvh] w-full max-w-md animate-rise flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl">
                <header className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
                    <PlusBadge className="size-7 rounded-lg [&_svg]:size-5" />
                    <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-base font-bold text-white">
                            {title}
                        </span>
                        {subtitle && (
                            <span className="block truncate text-xs text-white/45">
                                {subtitle}
                            </span>
                        )}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
                        aria-label={tr('Закрити')}
                    >
                        <X className="size-5" />
                    </button>
                </header>
                <div className="flex-1 overflow-y-auto px-5 py-5">
                    {children}
                </div>
            </div>
        </div>
    );
}

/**
 * Оплата: ціна (зі знижкою за промокодом і залишком старого балансу) → сторінка оплати monobank
 * або нативний Google Pay. Для підписок — автопродовження збереженою карткою.
 */
function PurchaseDialog({
    request,
    onClose,
}: {
    request: PurchaseRequest;
    onClose: () => void;
}) {
    const { billing } = usePage().props;
    const product = useProducts()[request.product];
    const title =
        product?.name ?? PRODUCT_LABELS()[request.product] ?? 'GameCon+';
    const renewable = Boolean(product?.recurring);
    const [quote, setQuote] = useState<Quote | null>(null);
    const [renew, setRenew] = useState(true);
    const [saveCard, setSaveCard] = useState(billing.save_card);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);

    const load = useCallback(async () => {
        try {
            setQuote(
                await api<Quote>(
                    'GET',
                    `/plus/billing/quote?product=${encodeURIComponent(request.product)}`,
                ),
            );
        } catch (error) {
            toast.error((error as Error).message);
        }
    }, [request.product]);

    useEffect(() => {
        void load();
    }, [load]);

    const body = () => ({
        product: request.product,
        ...request.extra,
        renew: renewable && renew,
        save_card: renewable && renew && saveCard,
    });

    const finish = (order: PaymentOrderCard, redirect: string | null) => {
        if (redirect) {
            window.location.href = redirect;

            return;
        }
        if (order.status === 'paid') {
            setDone(true);
            router.reload();
        }
    };

    const pay = async () => {
        setBusy(true);
        try {
            const result = await api<{
                order: PaymentOrderCard;
                redirect: string | null;
            }>('POST', '/plus/billing/purchase', body());
            finish(result.order, result.redirect);
        } catch (error) {
            toast.error((error as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const googlePay = async (token: string) => {
        setBusy(true);
        try {
            const created = await api<{ order: PaymentOrderCard }>(
                'POST',
                '/plus/billing/purchase',
                body(),
            );
            if (created.order.status === 'paid') {
                finish(created.order, null);

                return;
            }
            const result = await api<{
                order: PaymentOrderCard;
                redirect: string | null;
            }>('POST', `/plus/billing/orders/${created.order.id}/google-pay`, {
                token,
            });
            if (result.redirect || result.order.status === 'paid') {
                finish(result.order, result.redirect);
            } else if (result.order.status === 'failed') {
                toast.error(
                    result.order.failure ?? tr('Банк відхилив оплату.'),
                );
            } else {
                window.location.href = `/plus/billing?order=${result.order.id}`;
            }
        } catch (error) {
            toast.error((error as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const applyCode = async () => {
        if (!code.trim()) return;
        setBusy(true);
        try {
            const result = await api<{ message: string }>(
                'POST',
                '/plus/billing/promo',
                { code: code.trim(), product: request.product },
            );
            toast.success(result.message);
            setCode('');
            await load();
            router.reload({ only: ['auth'] });
        } catch (error) {
            toast.error((error as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title={title}
            subtitle={tr('Оплата карткою · monobank')}
            onClose={onClose}
        >
            {done ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <CheckCircle2 className="size-12 text-emerald-300" />
                    <p className="font-display text-xl font-bold text-white">
                        {tr('Готово!')}
                    </p>
                    <p className="max-w-xs text-sm text-white/55">
                        {tr('Оплату зараховано, усе вже ввімкнено.')}
                    </p>
                    <button
                        type="button"
                        className={cn(primary, 'mt-2')}
                        onClick={onClose}
                    >
                        {tr('Чудово')}
                    </button>
                </div>
            ) : !quote ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="size-6 animate-spin text-white/50" />
                </div>
            ) : (
                <div className="space-y-4">
                    <dl className="space-y-2 rounded-2xl bg-white/[0.04] p-4 text-sm">
                        <div className="flex justify-between gap-3">
                            <dt className="text-white/55">{tr('Ціна')}</dt>
                            <dd className="text-white tabular-nums">
                                {product?.old_price &&
                                    product.old_price > product.price && (
                                        <s className="mr-2 text-white/35">
                                            {money(product.old_price * 100)}
                                        </s>
                                    )}
                                {money(quote.price)}
                            </dd>
                        </div>
                        {quote.discount > 0 && (
                            <div className="flex justify-between gap-3">
                                <dt className="text-white/55">
                                    {tr('Знижка за промокодом')}
                                </dt>
                                <dd className="text-emerald-200 tabular-nums">
                                    −{money(quote.discount)}
                                </dd>
                            </div>
                        )}
                        {quote.credit > 0 && (
                            <div className="flex justify-between gap-3">
                                <dt className="text-white/55">
                                    {tr('Залишок балансу')}
                                </dt>
                                <dd className="text-emerald-200 tabular-nums">
                                    −{money(quote.credit)}
                                </dd>
                            </div>
                        )}
                        <div className="flex justify-between gap-3 border-t border-white/[0.06] pt-2">
                            <dt className="font-medium text-white">
                                {tr('До сплати')}
                            </dt>
                            <dd className="font-display text-lg font-bold text-white tabular-nums">
                                {money(quote.amount)}
                            </dd>
                        </div>
                    </dl>

                    {quote.promo && (
                        <p className="flex items-center gap-2 text-xs text-emerald-200/80">
                            <Tag className="size-3.5" /> {quote.promo}
                        </p>
                    )}

                    <div className="flex gap-2">
                        <input
                            value={code}
                            onChange={(e) =>
                                setCode(e.target.value.toUpperCase())
                            }
                            placeholder={tr('Промокод')}
                            maxLength={32}
                            className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white uppercase placeholder:text-white/35 placeholder:normal-case focus:outline-none"
                        />
                        <button
                            type="button"
                            className={secondary}
                            disabled={busy || !code.trim()}
                            onClick={applyCode}
                        >
                            {tr('Застосувати')}
                        </button>
                    </div>

                    {renewable && (
                        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.06] p-3.5">
                            <input
                                type="checkbox"
                                checked={renew}
                                onChange={(e) => setRenew(e.target.checked)}
                                className="mt-0.5 size-4 accent-primary"
                            />
                            <span className="text-sm">
                                <span className="font-medium text-white">
                                    {tr('Автопродовження')}
                                </span>
                                <span className="mt-0.5 block text-xs text-white/50">
                                    {tr(
                                        'Перед кінцем періоду оплата спишеться зі збереженої картки. Вимкнути можна будь-коли в GameCon+ → Оплата.',
                                    )}
                                </span>
                            </span>
                        </label>
                    )}
                    {renewable &&
                        renew &&
                        billing.save_card &&
                        quote.amount > 0 && (
                            <label className="flex cursor-pointer items-center gap-3 px-1 text-xs text-white/60">
                                <input
                                    type="checkbox"
                                    checked={saveCard}
                                    onChange={(e) =>
                                        setSaveCard(e.target.checked)
                                    }
                                    className="size-4 accent-primary"
                                />
                                {tr(
                                    'Зберегти картку в monobank для автопродовження (номер картки ми не бачимо й не зберігаємо)',
                                )}
                            </label>
                        )}

                    {!quote.available && quote.amount > 0 ? (
                        <p className="rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-100">
                            {tr(
                                'Оплата карткою тимчасово недоступна. Спробуйте пізніше.',
                            )}
                        </p>
                    ) : (
                        <div className="space-y-2">
                            <button
                                type="button"
                                className={cn(primary, 'w-full')}
                                disabled={busy}
                                onClick={pay}
                            >
                                {busy ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <CreditCard className="size-4" />
                                )}
                                {quote.amount > 0
                                    ? tr('Оплатити {sum}', {
                                          sum: money(quote.amount),
                                      })
                                    : tr('Отримати')}
                            </button>
                            {billing.google_pay && quote.amount > 0 && (
                                <GooglePayButton
                                    config={billing.google_pay}
                                    amount={quote.amount}
                                    disabled={busy}
                                    onToken={googlePay}
                                />
                            )}
                        </div>
                    )}

                    <p className="flex items-start gap-2 text-[11px] leading-relaxed text-white/40">
                        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                            {tr(
                                'Оплата на захищеній сторінці monobank: Visa, Mastercard, Apple Pay, Google Pay. Натискаючи «Оплатити», ви приймаєте публічну оферту й просите почати надання послуги одразу; у такому разі під час відмови протягом 14 днів кошти повертаються пропорційно невикористаному періоду.',
                            )}{' '}
                            <a
                                href="/terms"
                                target="_blank"
                                rel="noreferrer"
                                className="underline hover:text-white"
                            >
                                {tr('Оферта')}
                            </a>
                            {' · '}
                            <a
                                href="/refund-policy"
                                target="_blank"
                                rel="noreferrer"
                                className="underline hover:text-white"
                            >
                                {tr('Повернення коштів')}
                            </a>
                        </span>
                    </p>
                </div>
            )}
        </Modal>
    );
}
