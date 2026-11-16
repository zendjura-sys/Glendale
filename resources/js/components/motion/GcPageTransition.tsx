import { usePage } from '@inertiajs/react';
import { m, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const SHELLS: [prefix: string, key: string][] = [['settings/', 'settings']];

/**
 * Легкий перехід лише вмісту сторінки (persistent SocialLayout лишається).
 * Без AnimatePresence/popLayout і без filter/scale — вони дублюють DOM і ламають
 * position:fixed у нащадків (док зникає) або валять React 19 при швидких кліках.
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
        <m.div
            key={key}
            className={cn('gc-page gc-page-settled w-full min-w-0', className)}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
                reduce
                    ? { duration: 0 }
                    : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
            }
        >
            {children}
        </m.div>
    );
}
