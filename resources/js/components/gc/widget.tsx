import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import type { PropsWithChildren, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

type Props = PropsWithChildren<{
    title: string;
    icon?: LucideIcon;
    href?: string;
    action?: ReactNode;
    className?: string;
}>;

export function Widget({
    title,
    icon: Icon,
    href,
    action,
    className,
    children,
}: Props) {
    return (
        <section className={cn('glass rounded-3xl p-4', className)}>
            <header className="mb-3 flex items-center gap-2 px-1">
                {Icon && <Icon className="size-4 text-gc-lilac-400" />}
                <h3 className="font-display text-[13px] font-semibold tracking-wide text-white/90 uppercase">
                    {title}
                </h3>
                <span className="ml-auto">
                    {action ??
                        (href && (
                            <Link
                                href={href}
                                className="text-xs font-medium text-white/45 hover:text-white"
                            >
                                {tr('Усі')}
                            </Link>
                        ))}
                </span>
            </header>
            {children}
        </section>
    );
}

export function WidgetSkeleton({ rows = 3 }: { rows?: number }) {
    return (
        <div className="space-y-3 px-1">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                    <span className="skeleton size-11 rounded-full" />
                    <span className="flex-1 space-y-2">
                        <span className="skeleton block h-3 w-2/3 rounded" />
                        <span className="skeleton block h-3 w-1/3 rounded" />
                    </span>
                </div>
            ))}
        </div>
    );
}

export function EmptyState({
    icon: Icon,
    title,
    text,
    action,
}: {
    icon: LucideIcon;
    title: string;
    text?: string;
    action?: ReactNode;
}) {
    return (
        <div className="glass flex flex-col items-center rounded-3xl px-6 py-14 text-center">
            <span className="relative mb-5 flex size-16 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
                <span className="absolute inset-0 rounded-2xl bg-gradient-brand opacity-20 blur-xl" />
                <Icon className="relative size-7 text-gc-lilac-300" />
            </span>
            <h3 className="font-display text-lg font-semibold text-white">
                {title}
            </h3>
            {text && (
                <p className="mt-2 max-w-sm text-sm text-white/50">{text}</p>
            )}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}
