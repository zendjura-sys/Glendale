import { ChevronRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Майстер–деталь для адмінки (як у «Підтримці»): ліворуч список, праворуч вибраний запис.
 * На вузькому екрані деталі відкриваються під рядком, на широкому — у правій колонці (липкій).
 */
export function MasterDetail<T>({
    items,
    getKey,
    renderRow,
    renderDetail,
    empty,
}: {
    items: T[];
    getKey: (item: T) => number | string;
    renderRow: (item: T, active: boolean) => ReactNode;
    renderDetail: (item: T) => ReactNode;
    empty: string;
}) {
    const reduce = useReducedMotion();
    const [selected, setSelected] = useState<number | string | null>(
        items[0] ? getKey(items[0]) : null,
    );
    const current =
        items.find((i) => getKey(i) === selected) ?? items[0] ?? null;

    if (items.length === 0)
        return <p className="text-sm text-white/45">{empty}</p>;

    return (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,22rem)_1fr]">
            <ul className="space-y-1.5 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-1">
                {items.map((item) => {
                    const key = getKey(item);
                    const active = current !== null && getKey(current) === key;

                    return (
                        <li key={key}>
                            <button
                                type="button"
                                onClick={() => setSelected(key)}
                                aria-pressed={active}
                                className={cn(
                                    'flex w-full items-center gap-2 rounded-xl p-3 text-left transition',
                                    active
                                        ? 'bg-primary/12 ring-1 ring-primary/40'
                                        : 'gc-solid-2 hover:bg-white/[0.05]',
                                )}
                            >
                                <span className="min-w-0 flex-1">
                                    {renderRow(item, active)}
                                </span>
                                <ChevronRight
                                    className={cn(
                                        'size-4 shrink-0 text-white/30 transition lg:block',
                                        active && 'rotate-90 lg:rotate-0',
                                    )}
                                />
                            </button>
                            {/* Телефон: деталі під рядком */}
                            <AnimatePresence initial={false}>
                                {active && (
                                    <motion.div
                                        initial={
                                            reduce
                                                ? false
                                                : { opacity: 0, height: 0 }
                                        }
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={
                                            reduce
                                                ? { opacity: 0 }
                                                : { opacity: 0, height: 0 }
                                        }
                                        className="overflow-hidden lg:hidden"
                                    >
                                        <div className="pt-2">
                                            {renderDetail(item)}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </li>
                    );
                })}
            </ul>
            <div className="hidden lg:block">
                {current ? (
                    <div className="sticky top-24">
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={getKey(current)}
                                initial={reduce ? false : { opacity: 0, x: 8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={reduce ? undefined : { opacity: 0 }}
                                transition={{ duration: 0.15 }}
                            >
                                {renderDetail(current)}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                ) : (
                    <p className="text-sm text-white/45">
                        {tr('Виберіть запис ліворуч.')}
                    </p>
                )}
            </div>
        </div>
    );
}
