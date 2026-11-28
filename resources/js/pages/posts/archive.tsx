import { Head, Link } from '@inertiajs/react';
import { Archive, ArchiveRestore, Timer } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PostCard } from '@/components/gc/post-card';
import { EmptyState } from '@/components/gc/widget';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { PostItem } from '@/types';

const label = (days: number) =>
    days === 0
        ? tr('Вимкнено')
        : days === 365
          ? tr('Через рік')
          : days % 30 === 0 && days > 30
            ? tr('Через {n} міс.', { n: days / 30 })
            : tr('Через {n} днів', { n: days });

/** Архів записів: сховане зі стіни лишається тут; автоархів ховає старі записи сам. */
export default function PostArchivePage({
    posts,
    total,
    auto,
    options,
}: {
    posts: PostItem[];
    total: number;
    auto: number;
    options: number[];
}) {
    const reduce = useReducedMotion();
    const [items, setItems] = useState(posts);
    const [days, setDays] = useState(auto);

    const restore = async (id: number) => {
        const res = await api<{ message: string }>(
            'POST',
            `/posts/${id}/archive`,
        );
        setItems((list) => list.filter((post) => post.id !== id));
        toast.success(res.message);
    };
    const saveAuto = async (value: number) => {
        const previous = days;
        setDays(value);
        try {
            const res = await api<{ message: string }>(
                'PUT',
                '/settings/archive',
                { auto: value },
            );
            toast.success(res.message);
        } catch {
            setDays(previous);
            toast.error(tr('Не вдалося зберегти'));
        }
    };

    return (
        <>
            <Head title={tr('Архів записів')} />
            <div className="mx-auto max-w-[640px] space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                    <div>
                        <h1 className="font-display text-xl font-semibold text-white sm:text-2xl">
                            {tr('Архів записів')}
                        </h1>
                        <p className="mt-1 text-sm text-white/45">
                            {tr(
                                'Записи зі стіни, які ви сховали. Їх бачите лише ви — повернути можна будь-коли.',
                            )}
                        </p>
                    </div>
                    <Link
                        href="/saved"
                        className="shrink-0 text-sm text-white/55 hover:text-white"
                    >
                        {tr('Збережене')}
                    </Link>
                </div>

                <section
                    className="gc-solid space-y-3 rounded-2xl p-4"
                    data-archive-auto
                >
                    <div className="flex items-start gap-3">
                        <Timer className="mt-0.5 size-5 shrink-0 text-primary" />
                        <div className="min-w-0">
                            <h2 className="text-sm font-semibold text-white">
                                {tr('Автоархів старих записів')}
                            </h2>
                            <p className="text-xs text-white/50">
                                {tr(
                                    'Записи на вашій стіні старші за обраний строк самі переходять в архів. Закріплені лишаються на місці.',
                                )}
                            </p>
                        </div>
                    </div>
                    <div
                        role="radiogroup"
                        aria-label={tr('Автоархів старих записів')}
                        className="flex [scrollbar-width:none] gap-1 overflow-x-auto rounded-xl bg-white/[0.05] p-1"
                    >
                        {options.map((value) => (
                            <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={days === value}
                                onClick={() => saveAuto(value)}
                                className={cn(
                                    'h-9 shrink-0 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition',
                                    days === value
                                        ? 'bg-primary text-white'
                                        : 'text-white/60 hover:text-white',
                                )}
                            >
                                {label(value)}
                            </button>
                        ))}
                    </div>
                </section>

                {items.length === 0 ? (
                    <EmptyState
                        icon={Archive}
                        title={tr('Архів порожній')}
                        text={tr(
                            'У меню «…» свого запису оберіть «В архів» — він зникне зі стіни, але не видалиться.',
                        )}
                    />
                ) : (
                    <AnimatePresence initial={false}>
                        {items.map((post) => (
                            <motion.div
                                key={post.id}
                                layout={!reduce}
                                exit={
                                    reduce
                                        ? { opacity: 0 }
                                        : { opacity: 0, scale: 0.97 }
                                }
                                className="space-y-2"
                            >
                                <PostCard post={post} />
                                <button
                                    type="button"
                                    onClick={() => restore(post.id)}
                                    className="gc-solid ml-auto flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-white/80 transition hover:text-white"
                                >
                                    <ArchiveRestore className="size-4 text-primary" />
                                    {tr('Повернути на стіну')}
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
                {total > items.length && (
                    <p className="text-center text-xs text-white/35">
                        {tr('Показано {n} з {total}', {
                            n: items.length,
                            total,
                        })}
                    </p>
                )}
            </div>
        </>
    );
}
