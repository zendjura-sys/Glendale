import { Head, Link } from '@inertiajs/react';
import { BookmarkCheck, Check, Clock } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { PostCard } from '@/components/gc/post-card';
import { EmptyState } from '@/components/gc/widget';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import type { PostItem } from '@/types';

/** «Прочитати пізніше»: черга записів; прочитав — позначив, і запис зникає. */
export default function ReadLater({ posts }: { posts: PostItem[] }) {
    const [items, setItems] = useState(posts);
    const reduce = useReducedMotion();
    const done = async (id: number) => {
        await api('POST', `/posts/${id}/later`);
        setItems((list) => list.filter((post) => post.id !== id));
    };

    return (
        <>
            <Head title={tr('Прочитати пізніше')} />
            <div className="mx-auto max-w-[640px] space-y-4">
                <div className="flex items-end justify-between gap-3">
                    <div>
                        <h1 className="font-display text-2xl font-semibold text-white">
                            {tr('Прочитати пізніше')}
                        </h1>
                        <p className="mt-1 text-sm text-white/45">
                            {tr(
                                'Записи, відкладені на потім. Прочитали — позначте, і запис зникне зі списку.',
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
                {items.length === 0 ? (
                    <EmptyState
                        icon={Clock}
                        title={tr('Список порожній')}
                        text={tr(
                            'У меню «…» будь-якого запису оберіть «Прочитати пізніше».',
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
                                    onClick={() => done(post.id)}
                                    className="glass ml-auto flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-white/80 transition hover:text-white"
                                >
                                    <Check className="size-4 text-emerald-300" />
                                    {tr('Прочитано')}
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
                {items.length > 0 && (
                    <p className="flex items-center justify-center gap-1.5 text-xs text-white/35">
                        <BookmarkCheck className="size-3.5" />
                        {tr('{n} у черзі', { n: items.length })}
                    </p>
                )}
            </div>
        </>
    );
}
