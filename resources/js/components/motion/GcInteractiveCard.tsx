import { m, useReducedMotion } from 'motion/react';
import {
    useCallback,
    type CSSProperties,
    type ReactNode,
    type PointerEvent,
} from 'react';
import { cn } from '@/lib/utils';
import { motionOr } from '@/lib/motion';

/**
 * Упругий відгук + матовий spotlight-блик по координатах вказівника.
 * При prefers-reduced-motion — лише легка зміна opacity.
 */
export function GcInteractiveCard({
    children,
    className,
    as: Tag = 'div',
    href,
    onClick,
}: {
    children: ReactNode;
    className?: string;
    as?: 'div' | 'button' | 'a';
    href?: string;
    onClick?: () => void;
}) {
    const reduce = useReducedMotion();

    const onMove = useCallback((e: PointerEvent<HTMLElement>) => {
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
        el.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    }, []);

    const shared = {
        onClick,
        onPointerMove: reduce ? undefined : onMove,
        whileHover: reduce ? undefined : { scale: 1.02, y: -1 },
        whileTap: reduce ? { opacity: 0.85 } : { scale: 0.95 },
        transition: motionOr(reduce, {
            type: 'spring' as const,
            stiffness: 420,
            damping: 28,
        }),
        className: cn('gc-interactive relative overflow-hidden', className),
        style: {
            '--mouse-x': '50%',
            '--mouse-y': '50%',
        } as CSSProperties,
    };

    const spotlight = !reduce && (
        <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 [[data-hover]_&]:opacity-100"
            style={{
                background:
                    'radial-gradient(320px circle at var(--mouse-x) var(--mouse-y), rgba(255,255,255,0.08), transparent 70%)',
            }}
        />
    );

    if (Tag === 'a') {
        return (
            <m.a href={href} {...shared}>
                {spotlight}
                {children}
            </m.a>
        );
    }
    if (Tag === 'button') {
        return (
            <m.button type="button" {...shared}>
                {spotlight}
                {children}
            </m.button>
        );
    }

    return (
        <m.div {...shared}>
            {spotlight}
            {children}
        </m.div>
    );
}
