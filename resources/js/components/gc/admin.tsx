import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { Paginated } from '@/types';

export function PageHeader({
    title,
    description,
    actions,
}: {
    title: string;
    description?: string;
    actions?: ReactNode;
}) {
    return (
        <div className="mb-6 flex flex-wrap items-end gap-4">
            <div className="min-w-0 flex-1">
                <h1 className="font-display text-[26px] leading-tight font-bold text-white">
                    {title}
                </h1>
                {description && (
                    <p className="mt-1 text-sm text-white/45">{description}</p>
                )}
            </div>
            {actions}
        </div>
    );
}

export function StatCard({
    label,
    value,
    hint,
    icon: Icon,
    tone = 'from-[#4f8bff] to-[#6d5dfc]',
    delay = 0,
}: {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    icon: LucideIcon;
    tone?: string;
    delay?: number;
}) {
    return (
        <div
            className="glass group relative animate-rise overflow-hidden rounded-3xl p-5"
            style={{ animationDelay: `${delay}ms` }}
        >
            <div
                className={cn(
                    'absolute -top-10 -right-10 size-32 rounded-full bg-gradient-to-br opacity-25 blur-2xl transition duration-500 group-hover:opacity-50',
                    tone,
                )}
            />
            <div className="relative flex items-start justify-between">
                <span className="text-[13px] font-medium text-white/50">
                    {label}
                </span>
                <span
                    className={cn(
                        'flex size-9 items-center justify-center rounded-xl bg-gradient-to-br shadow-[0_8px_24px_-8px_rgb(109_93_252/0.8)]',
                        tone,
                    )}
                >
                    <Icon className="size-[18px] text-white" />
                </span>
            </div>
            <div className="relative mt-3 font-display text-[30px] leading-none font-bold text-white">
                {value}
            </div>
            {hint && (
                <div className="relative mt-2 text-xs text-white/45">
                    {hint}
                </div>
            )}
        </div>
    );
}

export function Toggle({
    checked,
    onChange,
    disabled,
    label,
}: {
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    label?: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40',
                checked
                    ? 'bg-gradient-brand shadow-[0_0_18px_-2px_rgb(109_93_252/0.8)]'
                    : 'bg-white/10',
            )}
        >
            <span
                className={cn(
                    'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition',
                    checked && 'translate-x-5',
                )}
            />
        </button>
    );
}

const pillTones = {
    default: 'border-white/10 bg-white/[0.04] text-white/60',
    blue: 'border-[#4f8bff]/30 bg-[#4f8bff]/10 text-[#9cbcff]',
    violet: 'border-[#a855f7]/30 bg-[#a855f7]/10 text-[#d3b0ff]',
    gold: 'border-amber-300/30 bg-amber-300/10 text-amber-200',
    green: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    red: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
};

export function Pill({
    tone = 'default',
    children,
    className,
}: {
    tone?: keyof typeof pillTones;
    children: ReactNode;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
                pillTones[tone],
                className,
            )}
        >
            {children}
        </span>
    );
}

export function Pagination({ data }: { data: Paginated<unknown> }) {
    if (data.last_page <= 1) {
        return null;
    }

    return (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-white/40">
                {data.from}–{data.to} з {data.total}
            </span>
            <div className="flex flex-wrap gap-1">
                {data.links.map((link, i) => {
                    const label =
                        i === 0 ? (
                            <ChevronLeft className="size-4" />
                        ) : i === data.links.length - 1 ? (
                            <ChevronRight className="size-4" />
                        ) : (
                            link.label
                        );

                    return link.url ? (
                        <Link
                            key={i}
                            href={link.url}
                            preserveScroll
                            className={cn(
                                'flex h-9 min-w-9 items-center justify-center rounded-xl px-2 transition',
                                link.active
                                    ? 'bg-gradient-brand font-semibold text-white'
                                    : 'glass text-white/60 hover:text-white',
                            )}
                        >
                            {label}
                        </Link>
                    ) : (
                        <span
                            key={i}
                            className="flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-white/20"
                        >
                            {label}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}

export const selectClass =
    'input-glass h-10 rounded-xl px-3 text-sm text-white [color-scheme:dark]';
