import type { PropsWithChildren } from 'react';
import { cn } from '@/lib/utils';

/**
 * Bento Grid — сітка плиток різного розміру (6 колонок на ширших екранах, одна на телефоні).
 * Плитки — звичайні картки сайту (VK-стиль, неонові кнопки); порожні плитки ховаються,
 * а картки в ряду тягнуться на однакову висоту.
 */
export function BentoGrid({
    className,
    children,
}: PropsWithChildren<{ className?: string }>) {
    return (
        <div
            className={cn(
                'gc-bento grid grid-flow-row-dense grid-cols-1 gap-4 sm:grid-cols-6',
                className,
            )}
        >
            {children}
        </div>
    );
}

const SPAN = {
    2: 'sm:col-span-2',
    3: 'sm:col-span-3',
    4: 'sm:col-span-4',
    6: 'sm:col-span-6',
} as const;

export function BentoTile({
    span = 6,
    tall = false,
    className,
    children,
}: PropsWithChildren<{
    /** Ширина плитки з 6 колонок. */
    span?: keyof typeof SPAN;
    /** Висока плитка — на два ряди. */
    tall?: boolean;
    className?: string;
}>) {
    return (
        <div
            className={cn(
                'gc-bento-tile min-w-0',
                SPAN[span],
                tall && 'sm:row-span-2',
                className,
            )}
        >
            {children}
        </div>
    );
}

/** Ряд плиток (напр. 4 + 2): якщо одна плитка порожня, решта тягнеться на всю ширину. */
export function BentoRow({ children }: PropsWithChildren) {
    return (
        <div className="gc-bento-row grid grid-flow-row-dense grid-cols-1 gap-4 sm:col-span-6 sm:grid-cols-6">
            {children}
        </div>
    );
}
