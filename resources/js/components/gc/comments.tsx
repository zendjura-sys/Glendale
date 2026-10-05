import { Link, usePage } from '@inertiajs/react';
import { CornerDownRight, SendHorizontal, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { plural, timeAgo } from '@/lib/format';
import { fitTextarea } from '@/lib/textarea';
import { cn } from '@/lib/utils';
import type { CommentItem } from '@/types';
import { LikeButton } from './like-button';
import { UserAvatar } from './user-avatar';
import { VerifiedBadge } from './verified-badge';
import {
    TranslateToggle,
    useContentTranslation,
} from '@/components/gc/translate';
import { tr } from '@/lib/i18n';

type Props = {
    /** Базовий URL коментарів, напр. `/posts/1/comments`. */
    endpoint: string;
    initial: CommentItem[];
    total: number;
    canComment: boolean;
    onCountChange: (count: number) => void;
    autoFocus?: boolean;
    className?: string;
};

export function Comments({
    endpoint,
    initial,
    total,
    canComment,
    onCountChange,
    autoFocus,
    className,
}: Props) {
    const { auth } = usePage().props;
    const [comments, setComments] = useState(initial);
    const [loadedAll, setLoadedAll] = useState(initial.length >= total);
    const [body, setBody] = useState('');
    const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
    const [sending, setSending] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const loadAll = async () => {
        const response = await api<{ comments: CommentItem[] }>(
            'GET',
            endpoint,
        );
        setComments(response.comments);
        setLoadedAll(true);
    };

    const submit = async () => {
        if (!body.trim() || sending) return;
        setSending(true);

        try {
            const response = await api<{
                comment: CommentItem;
                comments_count: number;
            }>('POST', endpoint, {
                body,
                parent_id: replyTo?.id ?? null,
            });
            setComments((list) => [...list, response.comment]);
            onCountChange(response.comments_count);
            setBody('');
            setReplyTo(null);
        } catch (error) {
            toast.error(
                error instanceof ApiError
                    ? error.message
                    : tr('Не вдалося надіслати коментар.'),
            );
        } finally {
            setSending(false);
        }
    };

    const remove = async (comment: CommentItem) => {
        const response = await api<{ comments_count: number }>(
            'DELETE',
            `/comments/${comment.id}`,
        );
        setComments((list) =>
            list.filter(
                (item) =>
                    item.id !== comment.id && item.parent_id !== comment.id,
            ),
        );
        onCountChange(response.comments_count);
    };

    const toggleLike = async (comment: CommentItem) => {
        setComments((list) =>
            list.map((item) =>
                item.id === comment.id
                    ? {
                          ...item,
                          liked: !item.liked,
                          likes_count: item.likes_count + (item.liked ? -1 : 1),
                      }
                    : item,
            ),
        );
        const response = await api<{ liked: boolean; likes_count: number }>(
            'POST',
            `/comments/${comment.id}/like`,
        );
        setComments((list) =>
            list.map((item) =>
                item.id === comment.id ? { ...item, ...response } : item,
            ),
        );
    };

    const byId = new Map(comments.map((c) => [c.id, c]));

    return (
        <div
            className={cn(
                'space-y-3 border-t border-white/[0.06] pt-3',
                className,
            )}
        >
            {!loadedAll && total > comments.length && (
                <button
                    type="button"
                    onClick={loadAll}
                    className="text-[13px] font-medium text-[#9aa8ff] hover:text-white"
                >
                    {tr('Показати всі')} {total}{' '}
                    {plural(total, ['коментар', 'коментарі', 'коментарів'])}
                </button>
            )}

            {comments.map((comment) => {
                const parent = comment.parent_id
                    ? byId.get(comment.parent_id)
                    : null;

                return (
                    <div
                        key={comment.id}
                        className={cn(
                            'group flex animate-rise gap-2.5',
                            comment.parent_id && 'pl-10',
                        )}
                    >
                        <Link href={`/${comment.user.username}`}>
                            <UserAvatar user={comment.user} size="sm" />
                        </Link>
                        <div className="min-w-0 flex-1">
                            <div className="inline-block max-w-full rounded-2xl rounded-tl-md bg-white/[0.045] px-3.5 py-2">
                                <Link
                                    href={`/${comment.user.username}`}
                                    className="flex items-center gap-1 text-[13px] font-semibold text-white hover:underline"
                                >
                                    {comment.user.name}
                                    {comment.user.is_verified && (
                                        <VerifiedBadge className="size-3" />
                                    )}
                                </Link>
                                <p className="text-[14px] leading-snug break-words whitespace-pre-line text-white/85">
                                    {parent && (
                                        <span className="mr-1 text-[#9aa8ff]">
                                            {parent.user.first_name},
                                        </span>
                                    )}
                                    <CommentText
                                        id={comment.id}
                                        body={comment.body}
                                    />
                                </p>
                            </div>
                            <div className="mt-1 flex items-center gap-3 pl-2 text-xs text-white/40">
                                <span>{timeAgo(comment.created_at)}</span>
                                {canComment && (
                                    <button
                                        type="button"
                                        className="font-medium hover:text-white"
                                        onClick={() => {
                                            setReplyTo(comment);
                                            inputRef.current?.focus();
                                        }}
                                    >
                                        {tr('Відповісти')}
                                    </button>
                                )}
                                {comment.can_delete && (
                                    <button
                                        type="button"
                                        className="opacity-0 transition group-hover:opacity-100 hover:text-rose-300 [@media(hover:none)]:opacity-100"
                                        onClick={() => remove(comment)}
                                        aria-label={tr('Видалити коментар')}
                                    >
                                        <Trash2 className="size-3.5" />
                                    </button>
                                )}
                                <span className="ml-auto">
                                    <LikeButton
                                        size="sm"
                                        liked={comment.liked}
                                        count={comment.likes_count}
                                        onToggle={() => toggleLike(comment)}
                                    />
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })}

            {canComment && (
                <div className="flex items-end gap-2.5 pt-1">
                    <UserAvatar user={auth.user} size="sm" showOnline={false} />
                    <div className="input-glass flex min-w-0 flex-1 flex-col rounded-2xl">
                        {replyTo && (
                            <div className="flex items-center gap-1.5 px-3.5 pt-2 text-xs text-[#9aa8ff]">
                                <CornerDownRight className="size-3.5" />{' '}
                                {tr('Відповідь для')} {replyTo.user.first_name}
                                <button
                                    type="button"
                                    className="ml-auto text-white/40 hover:text-white"
                                    onClick={() => setReplyTo(null)}
                                >
                                    {tr('скасувати')}
                                </button>
                            </div>
                        )}
                        <div className="flex items-end">
                            <textarea
                                ref={inputRef}
                                rows={1}
                                autoFocus={autoFocus}
                                value={body}
                                onChange={(event) => {
                                    setBody(event.target.value);
                                    fitTextarea(event.target, 160);
                                }}
                                onKeyDown={(event) => {
                                    if (
                                        event.key === 'Enter' &&
                                        !event.shiftKey
                                    ) {
                                        event.preventDefault();
                                        void submit();
                                    }
                                }}
                                placeholder={tr('Написати коментар…')}
                                className="[field-sizing:content] max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={submit}
                                disabled={!body.trim() || sending}
                                className="m-1 flex size-8 items-center justify-center rounded-xl text-[#9aa8ff] transition hover:bg-white/10 disabled:opacity-30"
                                aria-label={tr('Надіслати')}
                            >
                                <SendHorizontal className="size-[18px]" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/** Текст коментаря з кнопкою «Перекласти». */
function CommentText({ id, body }: { id: number; body: string }) {
    const translation = useContentTranslation('comment', id);

    return (
        <>
            {translation.text ?? body}
            {translation.enabled && (
                <span className="mt-0.5 block">
                    <TranslateToggle state={translation} />
                </span>
            )}
        </>
    );
}
