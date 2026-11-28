import { Link } from '@inertiajs/react';
import { m, useReducedMotion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { motionOr, SNAP } from '@/lib/motion';
import { cn } from '@/lib/utils';

export type GcSegmentOption = {
    key: string;
    label: ReactNode;
    href?: string;
    count?: number | string | null;
    badge?: boolean;
};

/**
 * Компактний сегментований контроль із «перетікаючою» капсулою (SNAP)
 * і м’яким hover-підсвічуванням комірки (еталон 21st segmented tabs).
 */
export function GcSegmented({
    options,
    value,
    onChange,
    className,
    equal = true,
}: {
    options: GcSegmentOption[];
    value: string;
    onChange?: (key: string) => void;
    className?: string;
    /** Рівні комірки (grid) — для 2–4 вкладок, щоб підписи не обрізались. */
    equal?: boolean;
}) {
    const reduce = useReducedMotion();
    const [hover, setHover] = useState<string | null>(null);

    return (
        <div
            role="tablist"
            onMouseLeave={() => setHover(null)}
            className={cn(
                'relative rounded-xl border border-white/[0.07] bg-white/[0.04] p-1',
                equal
                    ? 'grid gap-1'
                    : 'flex max-w-full [scrollbar-width:none] gap-1 overflow-x-auto',
                className,
            )}
            style={
                equal
                    ? {
                          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
                      }
                    : undefined
            }
        >
            {options.map((opt) => {
                const on = opt.key === value;
                const hovered = hover === opt.key && !on;
                const inner = (
                    <>
                        {on && (
                            <m.span
                                layoutId="gc-segmented-pill"
                                transition={motionOr(reduce, SNAP)}
                                className="absolute inset-0 rounded-lg bg-white/[0.12] shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
                            />
                        )}
                        {hovered && !reduce && (
                            <span className="absolute inset-0 rounded-lg bg-white/[0.05] transition-opacity" />
                        )}
                        <span className="relative truncate">{opt.label}</span>
                        {opt.count != null && opt.count !== '' && (
                            <span
                                className={cn(
                                    'relative shrink-0 rounded-full px-1.5 text-[10px] leading-4 tabular-nums',
                                    opt.badge
                                        ? 'bg-sky-500 text-white'
                                        : 'bg-white/[0.07] text-white/55',
                                )}
                            >
                                {opt.count}
                            </span>
                        )}
                    </>
                );
                const cls = cn(
                    'relative flex min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-xs font-medium transition-colors duration-200',
                    on ? 'text-white' : 'text-white/55 hover:text-white',
                    !equal && 'shrink-0 px-2.5',
                );
                const handlers = {
                    onMouseEnter: () => setHover(opt.key),
                    onFocus: () => setHover(opt.key),
                };

                if (opt.href) {
                    return (
                        <Link
                            key={opt.key}
                            href={opt.href}
                            role="tab"
                            aria-selected={on}
                            className={cls}
                            {...handlers}
                        >
                            {inner}
                        </Link>
                    );
                }

                return (
                    <button
                        key={opt.key}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => onChange?.(opt.key)}
                        className={cls}
                        {...handlers}
                    >
                        {inner}
                    </button>
                );
            })}
        </div>
    );
}
