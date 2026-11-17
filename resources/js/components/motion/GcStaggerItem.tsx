import { m, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { motionOr } from '@/lib/motion';

/** Один елемент каскаду: пружина y/opacity/scale. */
export function GcStaggerItem({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    const reduce = useReducedMotion();

    return (
        <m.div
            className={cn(className)}
            variants={{
                hidden: reduce
                    ? { opacity: 0 }
                    : { opacity: 0, y: 20, scale: 0.96 },
                show: {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: motionOr(reduce, {
                        type: 'spring',
                        stiffness: 380,
                        damping: 28,
                    }),
                },
            }}
        >
            {children}
        </m.div>
    );
}
