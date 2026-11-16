import { usePage } from '@inertiajs/react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EASE_OUT, motionOr } from '@/lib/motion';

const SHELLS: [prefix: string, key: string][] = [['settings/', 'settings']];

/**
 * Перехід сторінок усередині persistent SocialLayout.
 * Хідер / док / плеєр лишаються; анімується лише {children}.
 */
export function GcPageTransition({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    const { component, url } = usePage();
    const reduce = useReducedMotion();
    const shell = SHELLS.find(([prefix]) => component.startsWith(prefix));
    const key = shell ? shell[1] : url.split('?')[0] || component;

    return (
        <AnimatePresence mode="popLayout" initial={false}>
            <m.div
                key={key}
                className={cn('gc-page gc-page-settled min-w-0', className)}
                initial={
                    reduce
                        ? false
                        : {
                              opacity: 0,
                              y: 18,
                              scale: 0.985,
                              filter: 'blur(6px)',
                          }
                }
                animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    filter: 'blur(0px)',
                    transition: motionOr(reduce, {
                        type: 'spring',
                        stiffness: 380,
                        damping: 32,
                        mass: 0.8,
                    }),
                }}
                exit={
                    reduce
                        ? { opacity: 0 }
                        : {
                              opacity: 0,
                              y: -12,
                              scale: 0.98,
                              filter: 'blur(4px)',
                              transition: {
                                  duration: 0.18,
                                  ease: EASE_OUT,
                              },
                          }
                }
            >
                {children}
            </m.div>
        </AnimatePresence>
    );
}
