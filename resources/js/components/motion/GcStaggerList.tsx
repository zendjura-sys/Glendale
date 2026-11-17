import { m, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { motionOr } from '@/lib/motion';

/** Каскадна хвиля списків / карток / bento. */
export function GcStaggerList({
    children,
    className,
    stagger = 0.045,
    delay = 0.05,
}: {
    children: ReactNode;
    className?: string;
    stagger?: number;
    delay?: number;
}) {
    const reduce = useReducedMotion();

    return (
        <m.div
            className={cn(className)}
            initial="hidden"
            animate="show"
            variants={{
                hidden: {},
                show: {
                    transition: motionOr(reduce, {
                        staggerChildren: stagger,
                        delayChildren: delay,
                    }),
                },
            }}
        >
            {children}
        </m.div>
    );
}
