import { Link } from '@inertiajs/react';
import { m, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type UnderlineTab = {
    key: string;
    label: ReactNode;
    href?: string;
    onClick?: () => void;
    count?: number;
    icon?: ReactNode;
};

/**
 * Вкладки з підкресленням активної (як у мобільних каталогах): горизонтальна прокрутка,
 * активна вкладка — повний колір і риска під нею, що плавно перетікає (без руху — миттєво).
 */
export function UnderlineTabs({
    tabs,
    active,
    className,
    before,
}: {
    tabs: UnderlineTab[];
    active: string;
    className?: string;
    /** Елемент перед вкладками (напр. кнопка фільтрів). */
    before?: ReactNode;
}) {
    const reduce = useReducedMotion();
    const id = useId();
    const scroller = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scroller.current
            ?.querySelector<HTMLElement>('[data-active]')
            ?.scrollIntoView({
                block: 'nearest',
                inline: 'center',
                behavior: 'instant',
            });
    }, [active]);

    return (
        <div className={cn('flex items-center gap-1', className)}>
            {before}
            <div
                ref={scroller}
                role="tablist"
                className="scrollbar-none flex min-w-0 flex-1 gap-1 overflow-x-auto"
            >
                {tabs.map((tab) => {
                    const on = tab.key === active;
                    const body = (
                        <>
                            <span className="flex items-center gap-1.5">
                                {tab.icon}
                                {tab.label}
                                {tab.count !== undefined && tab.count > 0 && (
                                    <span className="text-xs font-normal text-white/40 tabular-nums">
                                        {tab.count}
                                    </span>
                                )}
                            </span>
                            {on && (
                                <m.span
                                    layoutId={`ut-${id}`}
                                    transition={
                                        reduce
                                            ? { duration: 0 }
                                            : {
                                                  type: 'spring',
                                                  stiffness: 500,
                                                  damping: 38,
                                              }
                                    }
                                    className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-[var(--vkui--color_text_accent,currentColor)]"
                                />
                            )}
                        </>
                    );
                    const className = cn(
                        'relative shrink-0 px-3 pt-2 pb-3 text-[15px] font-semibold whitespace-nowrap transition-colors',
                        on ? 'text-white' : 'text-white/45 hover:text-white/80',
                    );

                    return tab.href ? (
                        <Link
                            key={tab.key}
                            href={tab.href}
                            role="tab"
                            aria-selected={on}
                            data-active={on || undefined}
                            preserveScroll
                            className={className}
                        >
                            {body}
                        </Link>
                    ) : (
                        <button
                            key={tab.key}
                            type="button"
                            role="tab"
                            aria-selected={on}
                            data-active={on || undefined}
                            onClick={tab.onClick}
                            className={className}
                        >
                            {body}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
