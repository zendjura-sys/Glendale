import { Link } from '@inertiajs/react';
import { Group, Header, Placeholder } from '@vkontakte/vkui';
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

/** Блок бічної колонки чи сторінки — Group з VKUI: заголовок Header (іконка, «Усі» праворуч) і вміст. */
export function Widget({
    title,
    icon: Icon,
    href,
    action,
    className,
    children,
}: Props) {
    return (
        <Group
            mode="card"
            separator="hide"
            className={cn('gc-vk-group', className)}
            header={
                <Header
                    size="m"
                    before={
                        Icon && (
                            <Icon
                                aria-hidden
                                className="size-4 text-[var(--vkui--color_icon_accent)]"
                            />
                        )
                    }
                    after={
                        action ??
                        (href && (
                            <Link
                                href={href}
                                className="text-[13px] text-[var(--vkui--color_text_accent)] hover:underline"
                            >
                                {tr('Усі')}
                            </Link>
                        ))
                    }
                >
                    {title}
                </Header>
            }
        >
            <div className="px-5 pb-5">{children}</div>
        </Group>
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

/** Порожній стан — Placeholder з VKUI: іконка в акцентному колі, заголовок, пояснення й дія. */
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
        <Group mode="card" separator="hide" className="gc-vk-group">
            <Placeholder
                icon={
                    <span className="flex size-16 items-center justify-center rounded-full bg-[var(--vkui--color_background_accent)]/10 text-[var(--vkui--color_icon_accent)]">
                        <Icon aria-hidden className="size-8" />
                    </span>
                }
                title={title}
                action={action}
            >
                {text}
            </Placeholder>
        </Group>
    );
}
