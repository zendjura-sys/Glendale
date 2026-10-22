import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { LOCALE } from '@/lib/i18n';

export const btnPrimary =
    'btn-glow inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50';
export const btnGhost =
    'glass inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3.5 text-sm text-white/75 transition hover:text-white disabled:opacity-50';
export const btnDanger =
    'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-500/15 px-3.5 text-sm font-medium text-rose-200 transition hover:bg-rose-500/25 disabled:opacity-50';
export const btnSuccess =
    'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-400/15 px-3.5 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/25 disabled:opacity-50';
export const textareaClass =
    'input-glass w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none';

export function Panel({
    title,
    icon: Icon,
    actions,
    children,
    className,
    padded = true,
}: {
    title?: ReactNode;
    icon?: LucideIcon;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    padded?: boolean;
}) {
    return (
        <section
            className={cn(
                'glass rounded-2xl',
                padded && 'p-4 sm:p-5',
                className,
            )}
        >
            {(title || actions) && (
                <div
                    className={cn(
                        'mb-4 flex flex-wrap items-center gap-2',
                        !padded && 'px-4 pt-4 sm:px-5 sm:pt-5',
                    )}
                >
                    {title && (
                        <h2 className="flex min-w-0 flex-1 items-center gap-2 font-display text-base font-semibold text-white">
                            {Icon && (
                                <Icon className="size-4 text-gc-lilac-200" />
                            )}
                            {title}
                        </h2>
                    )}
                    {actions}
                </div>
            )}
            {children}
        </section>
    );
}

export function Metric({
    label,
    value,
    hint,
    tone = 'text-white',
    icon: Icon,
}: {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    tone?: string;
    icon?: LucideIcon;
}) {
    return (
        <div className="glass relative overflow-hidden rounded-2xl px-4 py-3.5">
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-white/45">
                {label}
                {Icon && <Icon className="size-4 text-white/30" />}
            </div>
            <div
                className={cn(
                    'mt-1.5 font-display text-2xl leading-tight font-bold',
                    tone,
                )}
            >
                {value}
            </div>
            {hint && <div className="mt-1 text-xs text-white/40">{hint}</div>}
        </div>
    );
}

const rankTones = [
    'bg-white/[0.06] text-white/60',
    'bg-sky-400/10 text-sky-200',
    'bg-violet-400/12 text-violet-200',
    'bg-amber-300/15 text-amber-200',
];

export function RankBadge({
    rank,
    title,
    className,
}: {
    rank: number;
    title?: string | null;
    className?: string;
}) {
    const tone =
        rank >= 10
            ? 'bg-gradient-to-r from-amber-300/30 to-rose-400/30 text-amber-100 ring-1 ring-amber-300/30'
            : rankTones[Math.min(3, Math.floor((rank - 1) / 3))];

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-chip px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
                tone,
                className,
            )}
        >
            <span className="tabular-nums">{rank}</span>
            {title && <span className="font-medium opacity-80">{title}</span>}
        </span>
    );
}

export function Segmented<T extends string>({
    value,
    options,
    onChange,
    className,
}: {
    value: T;
    options: { value: T; label: ReactNode; badge?: number }[];
    onChange: (value: T) => void;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex max-w-full overflow-x-auto rounded-xl bg-white/[0.04] p-1 text-sm',
                className,
            )}
        >
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(o.value)}
                    className={cn(
                        'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition',
                        value === o.value
                            ? 'bg-white/10 text-white'
                            : 'text-white/50 hover:text-white',
                    )}
                >
                    {o.label}
                    {!!o.badge && (
                        <span className="rounded-full bg-rose-500/80 px-1.5 text-[11px] leading-4 text-white">
                            {o.badge}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}

export function Modal({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    wide,
}: {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    wide?: boolean;
}) {
    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent
                className={cn(
                    'glass-strong max-h-[92dvh] gap-0 overflow-y-auto rounded-dialog border-white/10 p-5 text-white sm:p-6',
                    wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
                )}
            >
                <DialogTitle className="font-display text-lg">
                    {title}
                </DialogTitle>
                <DialogDescription
                    className={cn(
                        'mt-1 text-sm text-white/50',
                        !description && 'sr-only',
                    )}
                >
                    {description ?? title}
                </DialogDescription>
                <div className="mt-4 space-y-4">{children}</div>
                {footer && (
                    <div className="mt-5 flex flex-wrap justify-end gap-2">
                        {footer}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

export function Empty({
    icon: Icon,
    text,
}: {
    icon: LucideIcon;
    text: string;
}) {
    return (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-white/40">
            <Icon className="size-7 text-white/20" />
            {text}
        </div>
    );
}

export function Amount({
    value,
    className,
}: {
    value: number;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'font-semibold whitespace-nowrap tabular-nums',
                value > 0
                    ? 'text-emerald-300'
                    : value < 0
                      ? 'text-rose-300'
                      : 'text-white/50',
                className,
            )}
        >
            {formatSigned(value)}
        </span>
    );
}

const whole = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });

function formatSigned(minor: number): string {
    const text = `${whole.format(Math.abs(minor) / 100)} ₴`;

    return minor > 0 ? `+${text}` : minor < 0 ? `−${text}` : text;
}

export const kyivDateTime = (iso: string) =>
    new Date(iso).toLocaleString(LOCALE, {
        timeZone: 'Europe/Kyiv',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });

export const kyivDate = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString(LOCALE, {
        day: 'numeric',
        month: 'long',
    });
