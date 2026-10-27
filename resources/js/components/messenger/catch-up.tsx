import { AtSign, CalendarClock, Flame, Link2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { plural } from '@/lib/format';
import { tr } from '@/lib/i18n';
import type { CatchUp } from '@/types';

const SECTIONS: Record<
    CatchUp['sections'][number]['key'],
    { title: string; icon: LucideIcon }
> = {
    mentions: { title: tr('Тебе згадали'), icon: AtSign },
    plans: { title: tr('Домовленості'), icon: CalendarClock },
    popular: { title: tr('Найбільше реакцій'), icon: Flame },
    links: { title: tr('Посилання'), icon: Link2 },
};

/**
 * «Поки тебе не було»: зведена непрочитаного в групі поверх стрічки повідомлень.
 * Пункт веде до повідомлення; закривається хрестиком.
 */
export function CatchUpCard({
    data,
    conversationId,
    onJump,
}: {
    data: CatchUp;
    conversationId: number;
    onJump: (id: number) => void;
}) {
    const reduce = useReducedMotion();
    const [open, setOpen] = useState(true);
    useEffect(() => setOpen(true), [conversationId]);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={reduce ? false : { opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    className="absolute inset-x-3 top-2 z-10 max-h-[60%] overflow-y-auto rounded-2xl border border-white/10 bg-[rgb(12_16_32/0.9)] p-3 shadow-[0_18px_40px_-20px_rgb(0_0_0/0.8)] backdrop-blur-xl"
                >
                    <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="font-display text-sm font-semibold text-white">
                                {tr('Поки тебе не було')}
                            </p>
                            <p className="text-xs text-white/50">
                                {data.count}{' '}
                                {plural(data.count, [
                                    tr('повідомлення'),
                                    tr('повідомлення'),
                                    tr('повідомлень'),
                                ])}{' '}
                                {tr('від')} {data.people}{' '}
                                {plural(data.people, [
                                    tr('людини'),
                                    tr('людей'),
                                    tr('людей'),
                                ])}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            aria-label={tr('Закрити')}
                            className="flex size-7 items-center justify-center rounded-lg text-white/50 hover:bg-white/[0.06] hover:text-white"
                        >
                            <X className="size-4" />
                        </button>
                    </div>

                    {data.sections.map((section) => {
                        const meta = SECTIONS[section.key];

                        return (
                            <div key={section.key} className="mt-2.5">
                                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-white/45">
                                    <meta.icon className="size-3.5 text-gc-lilac-300" />
                                    {meta.title}
                                </p>
                                <ul className="space-y-0.5">
                                    {section.items.map((item) => (
                                        <li key={item.id}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setOpen(false);
                                                    onJump(item.id);
                                                }}
                                                className="w-full truncate rounded-lg px-2 py-1 text-left text-[13px] text-white/80 transition hover:bg-white/[0.06]"
                                            >
                                                <span className="font-medium text-white">
                                                    {item.author}:
                                                </span>{' '}
                                                {section.key === 'links' &&
                                                item.link
                                                    ? item.link
                                                    : item.text}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}

                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            onJump(data.first_id);
                        }}
                        className="mt-2.5 h-8 w-full rounded-lg bg-white/[0.08] text-xs font-medium text-white transition hover:bg-white/[0.12]"
                    >
                        {tr('До першого непрочитаного')}
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
