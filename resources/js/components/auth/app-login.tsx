import { router } from '@inertiajs/react';
import { m, useReducedMotion } from 'motion/react';
import {
    CircleCheck,
    CircleX,
    Clock,
    RotateCcw,
    Send,
    Smartphone,
} from 'lucide-react';
import qrcode from 'qrcode-generator';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { LogoMark } from '@/components/gc/logo';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';

type LoginRequest = {
    id: string;
    secret: string;
    code: string;
    qr: string;
    deep_link: string;
    expires_at: string;
};

type Status =
    | 'creating'
    | 'pending'
    | 'approved'
    | 'denied'
    | 'expired'
    | 'error';

const POLL_MS = 2000;

const isPhone = () =>
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/** QR-код як SVG: темні модулі одним шляхом на білому полі (так його читає будь-яка камера). */
function QrCode({ value }: { value: string }) {
    const { size, path } = useMemo(() => {
        const qr = qrcode(0, 'M');
        qr.addData(value);
        qr.make();
        const count = qr.getModuleCount();
        let d = '';
        for (let row = 0; row < count; row++) {
            for (let col = 0; col < count; col++) {
                if (qr.isDark(row, col)) d += `M${col + 2} ${row + 2}h1v1h-1z`;
            }
        }

        return { size: count + 4, path: d };
    }, [value]);

    return (
        <svg
            viewBox={`0 0 ${size} ${size}`}
            className="size-44 rounded-[10px] bg-white"
            shapeRendering="crispEdges"
            role="img"
            aria-label={tr('QR-код для входу через застосунок')}
        >
            <path d={path} fill="#0b0f22" />
        </svg>
    );
}

/** Тихе «дихання» кілець навколо коду, поки чекаємо на застосунок. */
function Waiting({ code }: { code: string }) {
    const reduce = useReducedMotion();

    return (
        <div className="relative flex size-20 items-center justify-center">
            {!reduce &&
                [0, 1].map((i) => (
                    <m.span
                        key={i}
                        aria-hidden
                        className="absolute inset-0 rounded-full border border-primary/40"
                        initial={{ scale: 0.85, opacity: 0.6 }}
                        animate={{ scale: 1.45, opacity: 0 }}
                        transition={{
                            duration: 2.4,
                            delay: i * 1.2,
                            repeat: Infinity,
                            ease: 'easeOut',
                        }}
                    />
                ))}
            <span className="relative flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] font-display text-[26px] font-bold tracking-wider text-white tabular-nums">
                {code}
            </span>
        </div>
    );
}

function secondsLeft(expiresAt: string): number {
    return Math.max(0, Math.round((Date.parse(expiresAt) - Date.now()) / 1000));
}

/**
 * «Увійти через застосунок GameCon»: браузер створює запит, показує QR і 2 цифри,
 * у застосунку людина вибирає ці цифри й підтверджує — тут виконується вхід.
 */
export function AppLoginButton() {
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState<Status>('creating');
    const [request, setRequest] = useState<LoginRequest | null>(null);
    const [login, setLogin] = useState('');
    const [sent, setSent] = useState(false);
    const [sending, setSending] = useState(false);
    const [left, setLeft] = useState(0);
    const reduce = useReducedMotion();
    const alive = useRef(false);

    const create = useCallback(async (hint?: string) => {
        setStatus('creating');
        try {
            const created = await api<LoginRequest>(
                'POST',
                '/login/app/requests',
                hint ? { login: hint } : {},
            );
            if (!alive.current) return null;
            setRequest(created);
            setLeft(secondsLeft(created.expires_at));
            setStatus('pending');

            return created;
        } catch {
            if (alive.current) setStatus('error');

            return null;
        }
    }, []);

    const start = async () => {
        alive.current = true;
        setOpen(true);
        setSent(false);
        const created = await create();
        // На телефоні одразу пробуємо відкрити застосунок.
        if (created && isPhone()) window.location.href = created.deep_link;
    };

    const close = (value: boolean) => {
        setOpen(value);
        if (!value) {
            alive.current = false;
            setRequest(null);
        }
    };

    const send = async () => {
        const hint = login.trim();
        if (!hint || sending) return;
        setSending(true);
        const created = await create(hint);
        setSending(false);
        if (created) setSent(true);
    };

    // Опитування стану кожні 2 с; підтверджено — сервер уже виконав вхід.
    useEffect(() => {
        if (!open || status !== 'pending' || !request) return;
        let stopped = false;
        const timer = window.setInterval(async () => {
            setLeft(secondsLeft(request.expires_at));
            try {
                const result = await api<{ status: Status; redirect?: string }>(
                    'GET',
                    `/login/app/requests/${request.id}?secret=${encodeURIComponent(request.secret)}`,
                );
                if (stopped || result.status === 'pending') return;
                setStatus(result.status);
                if (result.status === 'approved') {
                    router.visit(result.redirect ?? '/feed');
                }
            } catch {
                if (!stopped && secondsLeft(request.expires_at) === 0)
                    setStatus('expired');
            }
        }, POLL_MS);

        return () => {
            stopped = true;
            window.clearInterval(timer);
        };
    }, [open, status, request]);

    const minutes = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

    return (
        <>
            <button
                type="button"
                onClick={start}
                className="flex h-12 w-full items-center justify-center gap-2.5 rounded-control border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition-colors hover:border-white/20 hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                data-test="app-login"
            >
                <LogoMark className="size-6" />
                {tr('Увійти через застосунок GameCon')}
            </button>

            <Dialog open={open} onOpenChange={close}>
                <DialogContent className="glass-strong gap-0 rounded-dialog border-white/10 p-6 text-white sm:max-w-sm">
                    <DialogTitle className="pr-6 text-base font-semibold">
                        {tr('Вхід через застосунок')}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-white/55">
                        {tr(
                            'Відскануйте код телефоном або відкрийте запит у застосунку GameCon і виберіть там це число.',
                        )}
                    </DialogDescription>

                    <m.div
                        key={
                            status === 'pending' || status === 'creating'
                                ? 'wait'
                                : status
                        }
                        initial={reduce ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-5 flex flex-col items-center gap-4"
                        aria-live="polite"
                    >
                        {status === 'creating' && (
                            <div className="flex h-60 items-center justify-center">
                                <Spinner />
                            </div>
                        )}

                        {status === 'pending' && request && (
                            <>
                                <QrCode value={request.qr} />
                                <Waiting code={request.code} />
                                <p className="flex items-center gap-1.5 text-xs text-white/45">
                                    <Clock className="size-3.5" />
                                    {tr('Чекаємо на підтвердження')} · {minutes}
                                </p>
                                {isPhone() && (
                                    <Button
                                        asChild
                                        variant="outline"
                                        className="w-full"
                                    >
                                        <a href={request.deep_link}>
                                            <Smartphone />
                                            {tr('Відкрити застосунок')}
                                        </a>
                                    </Button>
                                )}
                            </>
                        )}

                        {status === 'approved' && (
                            <Outcome
                                icon={
                                    <CircleCheck className="size-8 text-emerald-400" />
                                }
                                title={tr('Вхід підтверджено в застосунку')}
                            />
                        )}

                        {(status === 'denied' ||
                            status === 'expired' ||
                            status === 'error') && (
                            <>
                                <Outcome
                                    icon={
                                        <CircleX className="size-8 text-rose-400" />
                                    }
                                    title={
                                        status === 'denied'
                                            ? tr('Вхід скасовано в застосунку')
                                            : status === 'expired'
                                              ? tr(
                                                    'Час на підтвердження вийшов',
                                                )
                                              : tr(
                                                    'Щось пішло не так. Спробуйте ще раз.',
                                                )
                                    }
                                />
                                <Button
                                    variant="secondary"
                                    className="w-full"
                                    onClick={() => {
                                        setSent(false);
                                        void create();
                                    }}
                                >
                                    <RotateCcw />
                                    {tr('Спробувати знову')}
                                </Button>
                            </>
                        )}
                    </m.div>

                    {status === 'pending' && (
                        <form
                            className="mt-5 grid gap-2 border-t border-white/10 pt-5"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void send();
                            }}
                        >
                            <label
                                htmlFor="app-login-hint"
                                className="text-xs text-white/55"
                            >
                                {tr('Ваш логін або пошта')}
                            </label>
                            <Input
                                id="app-login-hint"
                                value={login}
                                onChange={(event) =>
                                    setLogin(event.target.value)
                                }
                                autoComplete="username"
                                placeholder="you@gamecon.online"
                                maxLength={255}
                            />
                            <Button
                                type="submit"
                                variant="outline"
                                disabled={!login.trim() || sending}
                            >
                                {sending ? <Spinner /> : <Send />}
                                {tr('Надіслати запит у застосунок')}
                            </Button>
                            {sent && (
                                <p className="text-xs text-white/50">
                                    {tr(
                                        'Якщо в цього акаунта є застосунок, запит уже там.',
                                    )}
                                </p>
                            )}
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function Outcome({ icon, title }: { icon: ReactNode; title: string }) {
    return (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
            {icon}
            <p className="text-sm font-medium text-white">{title}</p>
        </div>
    );
}
