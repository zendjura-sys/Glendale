import { router, usePage } from '@inertiajs/react';
import {
    CheckCircle2,
    Copy,
    ExternalLink,
    Loader2,
    Wallet as WalletIcon,
    X,
    Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { PlusBadge } from '@/components/gc/plus';
import { api, ApiError } from '@/lib/api';
import {
    money,
    openPurchase,
    openTopup,
    PURCHASE_EVENT,
    TOPUP_EVENT,
} from '@/lib/billing';
import type { PurchaseRequest, TopupRequest } from '@/lib/billing';
import { tr } from '@/lib/i18n';
import { PLUS_PRICES, PRODUCT_LABELS } from '@/lib/plus';
import type { PlusProduct } from '@/lib/plus';
import { cn } from '@/lib/utils';

export type PayMethod = {
    key: string;
    label: string;
    url: string | null;
    auto: boolean;
    currency: string;
    note: string | null;
};

export type TopupCard = {
    id: number;
    code: string;
    amount: number;
    method: string | null;
    status: 'pending' | 'paid' | 'cancelled' | 'expired';
    claimed: boolean;
    credited: number | null;
    expires_at: string;
    created_at: string;
};

const btn =
    'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition disabled:opacity-40';
const primary = cn(
    btn,
    'bg-[var(--btn-primary,#6366f1)] text-white hover:opacity-90',
);
const secondary = cn(btn, 'bg-white/[0.06] text-white/85 hover:bg-white/10');

/** Вікна білінгу для всього сайту: покупка з рахунку й поповнення донатом. */
export function BillingHost() {
    const [purchase, setPurchase] = useState<PurchaseRequest | null>(null);
    const [topup, setTopup] = useState<TopupRequest | null>(null);

    useEffect(() => {
        const onPurchase = (event: Event) => {
            setTopup(null);
            setPurchase((event as CustomEvent<PurchaseRequest>).detail);
        };
        const onTopup = (event: Event) => {
            setPurchase(null);
            setTopup((event as CustomEvent<TopupRequest>).detail);
        };
        window.addEventListener(PURCHASE_EVENT, onPurchase);
        window.addEventListener(TOPUP_EVENT, onTopup);

        return () => {
            window.removeEventListener(PURCHASE_EVENT, onPurchase);
            window.removeEventListener(TOPUP_EVENT, onTopup);
        };
    }, []);

    if (purchase) {
        return (
            <PurchaseDialog
                request={purchase}
                onClose={() => setPurchase(null)}
            />
        );
    }
    if (topup) {
        return <TopupDialog request={topup} onClose={() => setTopup(null)} />;
    }

    return null;
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
            <div className="glass-strong flex max-h-[92dvh] w-full max-w-md animate-rise flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl">
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

/** Підтвердження покупки з рахунку; не вистачає — пропонує поповнити рівно на різницю. */
function PurchaseDialog({
    request,
    onClose,
}: {
    request: PurchaseRequest;
    onClose: () => void;
}) {
    const balance = usePage().props.auth.user?.balance ?? 0;
    const price = (PLUS_PRICES[request.product as PlusProduct] ?? 0) * 100;
    const title = PRODUCT_LABELS()[request.product] ?? 'GameCon+';
    const [renew, setRenew] = useState(true);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const shortfall = Math.max(0, price - balance);

    const pay = async () => {
        setBusy(true);
        try {
            await api('POST', '/plus/billing/purchase', {
                product: request.product,
                ...request.extra,
                renew: Boolean(request.renewable && renew),
            });
            setDone(true);
            router.reload();
        } catch (error) {
            const missing = Number(
                (error as ApiError).errors?.shortfall?.[0] ?? 0,
            );
            if (missing > 0) {
                openTopup({
                    amount: Math.ceil(missing / 100),
                    resume: request,
                });

                return;
            }
            toast.error((error as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title={title}
            subtitle={tr('Оплата з рахунку GameCon')}
            onClose={onClose}
        >
            {done ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <CheckCircle2 className="size-12 text-emerald-300" />
                    <p className="font-display text-xl font-bold text-white">
                        {tr('Готово!')}
                    </p>
                    <p className="max-w-xs text-sm text-white/55">
                        {tr('Покупку оплачено з рахунку й уже ввімкнено.')}
                    </p>
                    <button
                        type="button"
                        className={cn(primary, 'mt-2')}
                        onClick={onClose}
                    >
                        {tr('Чудово')}
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <dl className="space-y-2 rounded-2xl bg-white/[0.04] p-4 text-sm">
                        <div className="flex justify-between gap-3">
                            <dt className="text-white/55">{tr('Ціна')}</dt>
                            <dd className="font-semibold text-white tabular-nums">
                                {money(price)}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-white/55">
                                {tr('На рахунку')}
                            </dt>
                            <dd className="text-white tabular-nums">
                                {money(balance)}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-3 border-t border-white/[0.06] pt-2">
                            <dt className="text-white/55">
                                {shortfall > 0
                                    ? tr('Не вистачає')
                                    : tr('Залишиться')}
                            </dt>
                            <dd
                                className={cn(
                                    'font-semibold tabular-nums',
                                    shortfall > 0
                                        ? 'text-amber-200'
                                        : 'text-emerald-200',
                                )}
                            >
                                {money(
                                    shortfall > 0 ? shortfall : balance - price,
                                )}
                            </dd>
                        </div>
                    </dl>

                    {request.renewable && (
                        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.06] p-3.5">
                            <input
                                type="checkbox"
                                checked={renew}
                                onChange={(e) => setRenew(e.target.checked)}
                                className="mt-0.5 size-4 accent-[var(--btn-primary,#6366f1)]"
                            />
                            <span className="text-sm">
                                <span className="font-medium text-white">
                                    {tr('Автопродовження з рахунку')}
                                </span>
                                <span className="mt-0.5 block text-xs text-white/50">
                                    {tr(
                                        'За добу до кінця періоду ціна спишеться з рахунку сама. Вимкнути можна будь-коли в GameCon+ → Рахунок.',
                                    )}
                                </span>
                            </span>
                        </label>
                    )}

                    {shortfall > 0 ? (
                        <button
                            type="button"
                            className={cn(primary, 'w-full')}
                            onClick={() =>
                                openTopup({
                                    amount: Math.ceil(shortfall / 100),
                                    resume: request,
                                })
                            }
                        >
                            <WalletIcon className="size-4" />
                            {tr('Поповнити на {sum}', {
                                sum: money(shortfall),
                            })}
                        </button>
                    ) : (
                        <button
                            type="button"
                            className={cn(primary, 'w-full')}
                            disabled={busy}
                            onClick={pay}
                        >
                            {busy && (
                                <Loader2 className="size-4 animate-spin" />
                            )}
                            {tr('Оплатити {sum} з рахунку', {
                                sum: money(price),
                            })}
                        </button>
                    )}
                </div>
            )}
        </Modal>
    );
}

const AMOUNTS = [149, 399, 1290];

/**
 * Поповнення: сума → заявка з кодом → донат будь-яким способом з кодом у повідомленні → «Я оплатив».
 * Donatello зараховує сам за хвилину, інші — після перевірки адміністратором.
 */
function TopupDialog({
    request,
    onClose,
}: {
    request: TopupRequest;
    onClose: () => void;
}) {
    const [amount, setAmount] = useState(String(request.amount ?? 149));
    const [topup, setTopup] = useState<TopupCard | null>(null);
    const [methods, setMethods] = useState<PayMethod[]>([]);
    const [method, setMethod] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    // Відкрити наявну заявку (зі сторінки «Рахунок»).
    useEffect(() => {
        if (!request.topupId) return;
        void api<{ topup: TopupCard; methods: PayMethod[] }>(
            'GET',
            `/plus/billing/topups/${request.topupId}`,
        )
            .then((r) => {
                setTopup(r.topup);
                setMethods(r.methods);
                if (r.topup.method) setMethod(r.topup.method);
            })
            .catch(() => onClose());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [request.topupId]);

    // Поки чекаємо зарахування — перевіряємо статус кожні 5 секунд.
    useEffect(() => {
        if (!topup || topup.status !== 'pending' || !topup.claimed) return;
        const timer = window.setInterval(() => {
            void api<{ topup: TopupCard }>(
                'GET',
                `/plus/billing/topups/${topup.id}`,
            )
                .then((r) => {
                    if (r.topup.status !== 'pending') {
                        setTopup(r.topup);
                        router.reload();
                    }
                })
                .catch(() => undefined);
        }, 5000);

        return () => window.clearInterval(timer);
    }, [topup]);

    useEffect(() => {
        if (!method && methods.length > 0) setMethod(methods[0].key);
    }, [methods, method]);

    const create = async () => {
        setBusy(true);
        try {
            const r = await api<{ topup: TopupCard; methods: PayMethod[] }>(
                'POST',
                '/plus/billing/topups',
                { amount: Number(amount) },
            );
            setTopup(r.topup);
            setMethods(r.methods);
        } catch (error) {
            toast.error(
                (error as ApiError).errors?.amount?.[0] ??
                    (error as Error).message,
            );
        } finally {
            setBusy(false);
        }
    };

    const claim = async () => {
        if (!topup || !method) return;
        setBusy(true);
        try {
            const r = await api<{ topup: TopupCard }>(
                'POST',
                `/plus/billing/topups/${topup.id}/claim`,
                { method, note: note.trim() || null },
            );
            setTopup(r.topup);
            if (r.topup.status === 'paid') router.reload();
        } catch (error) {
            toast.error((error as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const copy = () => {
        if (!topup) return;
        void navigator.clipboard
            ?.writeText(topup.code)
            .then(() => toast.success(tr('Код скопійовано')));
    };

    const current = methods.find((m) => m.key === method) ?? null;

    if (topup?.status === 'paid') {
        return (
            <Modal title={tr('Рахунок поповнено')} onClose={onClose}>
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <CheckCircle2 className="size-12 text-emerald-300" />
                    <p className="font-display text-2xl font-bold text-white">
                        +{money(topup.credited ?? topup.amount * 100)}
                    </p>
                    <p className="max-w-xs text-sm text-white/55">
                        {tr('Кошти вже на рахунку. Дякуємо за підтримку!')}
                    </p>
                    {request.resume ? (
                        <button
                            type="button"
                            className={cn(primary, 'mt-2')}
                            onClick={() => openPurchase(request.resume!)}
                        >
                            {tr('Продовжити покупку')}
                        </button>
                    ) : (
                        <button
                            type="button"
                            className={cn(primary, 'mt-2')}
                            onClick={onClose}
                        >
                            {tr('Чудово')}
                        </button>
                    )}
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            title={tr('Поповнення рахунку')}
            subtitle={
                topup
                    ? tr('Заявка {code}', { code: topup.code })
                    : tr('Донатом через зручний сервіс')
            }
            onClose={onClose}
        >
            {!topup ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                        {AMOUNTS.map((value) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setAmount(String(value))}
                                className={cn(
                                    'h-11 rounded-xl border text-sm font-semibold transition',
                                    Number(amount) === value
                                        ? 'border-indigo-400/60 bg-indigo-500/15 text-white'
                                        : 'border-white/10 text-white/75 hover:border-white/25',
                                )}
                            >
                                {value} ₴
                            </button>
                        ))}
                    </div>
                    <label className="block text-xs text-white/50">
                        {tr('Своя сума, ₴')}
                        <input
                            type="number"
                            inputMode="numeric"
                            min={10}
                            max={50000}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="input-glass mt-1 h-11 w-full rounded-xl px-3.5 text-base text-white"
                        />
                    </label>
                    <button
                        type="button"
                        className={cn(primary, 'w-full')}
                        disabled={busy || Number(amount) < 10}
                        onClick={create}
                    >
                        {busy && <Loader2 className="size-4 animate-spin" />}
                        {tr('Далі')}
                    </button>
                    <p className="text-center text-xs text-white/40">
                        {tr(
                            'Кошти на рахунку можна витратити на GameCon+, подарунки й просування серверів.',
                        )}
                    </p>
                </div>
            ) : topup.status !== 'pending' ? (
                <p className="py-6 text-center text-sm text-white/55">
                    {tr('Ця заявка закрита. Створіть нову.')}
                </p>
            ) : topup.claimed ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <Loader2 className="size-10 animate-spin text-indigo-300" />
                    <p className="font-display text-lg font-bold text-white">
                        {tr('Чекаємо на донат')}
                    </p>
                    <p className="max-w-xs text-sm text-white/55">
                        {current?.auto
                            ? tr(
                                  'Donatello зараховує сам — зазвичай за хвилину. Вікно можна закрити: ми надішлемо сповіщення.',
                              )
                            : tr(
                                  'Адміністратор перевірить донат і зарахує кошти — зазвичай протягом доби. Ми надішлемо сповіщення.',
                              )}
                    </p>
                    <button
                        type="button"
                        className={secondary}
                        onClick={onClose}
                    >
                        {tr('Закрити')}
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="rounded-2xl border border-indigo-400/30 bg-indigo-500/[0.08] p-4 text-center">
                        <p className="text-xs text-white/55">
                            {tr('Код для повідомлення до донату')}
                        </p>
                        <button
                            type="button"
                            onClick={copy}
                            className="mt-1 inline-flex items-center gap-2 font-mono text-2xl font-bold tracking-wider text-white"
                        >
                            {topup.code}
                            <Copy className="size-4 text-white/50" />
                        </button>
                        <p className="mt-1 text-xs text-white/55">
                            {tr('Сума: {sum}', { sum: `${topup.amount} ₴` })}
                        </p>
                    </div>

                    {methods.length > 1 && (
                        <div className="flex flex-wrap gap-1.5">
                            {methods.map((m) => (
                                <button
                                    key={m.key}
                                    type="button"
                                    onClick={() => setMethod(m.key)}
                                    className={cn(
                                        'inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition',
                                        method === m.key
                                            ? 'border-indigo-400/60 bg-indigo-500/15 text-white'
                                            : 'border-white/10 text-white/65 hover:border-white/25',
                                    )}
                                >
                                    {m.auto && <Zap className="size-3.5" />}
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {current && (
                        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-white/70">
                            <li>
                                {tr('Відкрийте {name} і задонатьте {sum}.', {
                                    name: current.label,
                                    sum:
                                        current.currency === 'UAH'
                                            ? `${topup.amount} ₴`
                                            : tr('еквівалент {sum}', {
                                                  sum: `${topup.amount} ₴`,
                                              }),
                                })}
                            </li>
                            <li>
                                {tr('У повідомленні до донату напишіть код')}{' '}
                                <b className="font-mono whitespace-nowrap text-white">
                                    {topup.code}
                                </b>
                                .
                            </li>
                            <li>
                                {current.auto
                                    ? tr(
                                          'Натисніть «Я оплатив» — кошти зарахуються самі.',
                                      )
                                    : tr(
                                          'Натисніть «Я оплатив» — адміністратор перевірить і зарахує.',
                                      )}
                            </li>
                            {current.note && (
                                <li className="list-none text-xs text-white/50">
                                    {current.note}
                                </li>
                            )}
                        </ol>
                    )}

                    {current?.url && (
                        <a
                            href={current.url}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(secondary, 'w-full')}
                        >
                            <ExternalLink className="size-4" />
                            {tr('Відкрити {name}', { name: current.label })}
                        </a>
                    )}

                    {current && !current.auto && (
                        <input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            maxLength={300}
                            placeholder={tr(
                                'Ім’я в донаті або час (допоможе знайти платіж)',
                            )}
                            className="input-glass h-11 w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30"
                        />
                    )}

                    <button
                        type="button"
                        className={cn(primary, 'w-full')}
                        disabled={busy || !current}
                        onClick={claim}
                    >
                        {busy && <Loader2 className="size-4 animate-spin" />}
                        {tr('Я оплатив')}
                    </button>
                </div>
            )}
        </Modal>
    );
}
