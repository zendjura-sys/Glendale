import { Link } from '@inertiajs/react';
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/gc/user-avatar';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

type Comment = {
    id: number;
    body: string;
    user: UserCard | null;
    created_at: string;
    can_delete: boolean;
};

/** Обговорення добірки: коментарі знизу, нові — в кінці; автор, власник або модератор може видалити. */
export function ListComments({
    listId,
    initialCount,
}: {
    listId: number;
    initialCount: number;
}) {
    const reduce = useReducedMotion();
    const [comments, setComments] = useState<Comment[] | null>(null);
    const [more, setMore] = useState(false);
    const [count, setCount] = useState(initialCount);
    const [body, setBody] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api<{ comments: Comment[]; more: boolean }>(
            'GET',
            `/cinema/lists/${listId}/comments`,
        )
            .then((d) => {
                setComments(d.comments);
                setMore(d.more);
            })
            .catch(() => setComments([]));
    }, [listId]);

    const older = () => {
        if (!comments?.length) return;
        api<{ comments: Comment[]; more: boolean }>(
            'GET',
            `/cinema/lists/${listId}/comments?before=${comments[0].id}`,
        )
            .then((d) => {
                setComments([...d.comments, ...comments]);
                setMore(d.more);
            })
            .catch(() => undefined);
    };

    const send = (e: FormEvent) => {
        e.preventDefault();
        if (!body.trim() || busy) return;
        setBusy(true);
        api<{ comment: Comment; comments_count: number }>(
            'POST',
            `/cinema/lists/${listId}/comments`,
            { body },
        )
            .then((d) => {
                setComments([...(comments ?? []), d.comment]);
                setCount(d.comments_count);
                setBody('');
            })
            .catch((e: Error) => toast.error(e.message))
            .finally(() => setBusy(false));
    };

    const remove = (c: Comment) =>
        api<{ comments_count: number }>(
            'DELETE',
            `/cinema/lists/${listId}/comments/${c.id}`,
        )
            .then((d) => {
                setComments((comments ?? []).filter((x) => x.id !== c.id));
                setCount(d.comments_count);
            })
            .catch((e: Error) => toast.error(e.message));

    return (
        <section className="gc-solid rounded-2xl p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                <MessageCircle className="size-5 text-primary" />
                {tr('Обговорення')}
                {count > 0 && (
                    <span className="text-sm font-medium text-white/45 tabular-nums">
                        {count}
                    </span>
                )}
            </h2>

            {more && (
                <button
                    type="button"
                    onClick={older}
                    className="mt-3 text-sm font-medium text-primary hover:underline"
                >
                    {tr('Попередні коментарі')}
                </button>
            )}

            <ul className="mt-3 space-y-3">
                <AnimatePresence initial={false}>
                    {(comments ?? []).map((c) => (
                        <motion.li
                            key={c.id}
                            layout={!reduce}
                            initial={reduce ? false : { opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="group flex gap-3"
                        >
                            {c.user && <UserAvatar user={c.user} size="sm" />}
                            <div className="min-w-0 flex-1">
                                <p className="text-sm">
                                    {c.user && (
                                        <Link
                                            href={`/${c.user.username}`}
                                            className="font-semibold text-white hover:underline"
                                        >
                                            {c.user.name}
                                        </Link>
                                    )}
                                    <span className="ml-2 text-xs text-white/40">
                                        {timeAgo(c.created_at)}
                                    </span>
                                </p>
                                <p className="mt-0.5 text-sm break-words whitespace-pre-line text-white/80">
                                    {c.body}
                                </p>
                            </div>
                            {c.can_delete && (
                                <button
                                    type="button"
                                    onClick={() => remove(c)}
                                    aria-label={tr('Видалити коментар')}
                                    className="grid size-8 place-items-center rounded-lg text-white/40 opacity-0 transition group-hover:opacity-100 hover:bg-white/[0.06] hover:text-white focus:opacity-100"
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            )}
                        </motion.li>
                    ))}
                </AnimatePresence>
            </ul>

            {comments !== null && comments.length === 0 && (
                <p className="mt-2 text-sm text-white/50">
                    {tr('Поки тихо — напишіть, що думаєте про добірку.')}
                </p>
            )}

            <form onSubmit={send} className="mt-4 flex items-end gap-2">
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) send(e);
                    }}
                    rows={1}
                    maxLength={1000}
                    placeholder={tr('Ваш коментар…')}
                    className="input-glass max-h-40 min-h-10 w-full resize-y rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/35"
                />
                <button
                    type="submit"
                    disabled={!body.trim() || busy}
                    aria-label={tr('Надіслати')}
                    className="btn-glow grid size-10 shrink-0 place-items-center rounded-xl disabled:opacity-40"
                >
                    <Send className="size-4" />
                </button>
            </form>
        </section>
    );
}
