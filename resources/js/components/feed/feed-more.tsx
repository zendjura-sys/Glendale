import { ChevronDown } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { motionOr, SNAP } from '@/lib/motion';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Другорядні блоки над стрічкою (промо, підбірки, «продовжити») —
 * згорнуті за замовчуванням, щоб соцмережа лишалась: історії → допис → пости.
 */
export function FeedMore({
    children,
    count,
}: {
    children: ReactNode;
    /** Скільки блоків ховаємо — для підпису кнопки; 0 ховає секцію. */
    count: number;
}) {
    const [open, setOpen] = useState(false);
    const reduce = useReducedMotion();

    if (count < 1) {
        return null;
    }

    return (
        <section className="space-y-2">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="gc-solid-2 flex h-10 w-full items-center justify-between gap-2 rounded-xl px-3.5 text-left text-sm font-semibold text-white/70 transition hover:text-white"
            >
                <span>
                    {open
                        ? tr('Менше над стрічкою')
                        : count > 1
                          ? tr('Ще для вас ({n})', { n: count })
                          : tr('Ще для вас')}
                </span>
                <ChevronDown
                    className={cn(
                        'size-4 shrink-0 transition',
                        open && 'rotate-180',
                    )}
                />
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <m.div
                        key="feed-more"
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={
                            reduce ? { opacity: 0 } : { height: 0, opacity: 0 }
                        }
                        transition={motionOr(reduce, SNAP)}
                        className="space-y-4 overflow-hidden"
                    >
                        {children}
                    </m.div>
                )}
            </AnimatePresence>
        </section>
    );
}
