import { Link, usePage } from '@inertiajs/react';
import { usePlugin } from '@/lib/plugins';
import { useDraft, writeDraft } from '@/lib/drafts';
import {
    CornerDownRight,
    EyeOff,
    Pin,
    SendHorizontal,
    Timer,
    Smile,
    Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { plural, timeAgo } from '@/lib/format';
import { fitTextarea } from '@/lib/textarea';
import { splitQuotes } from '@/components/gc/quote-selection';
import { cn } from '@/lib/utils';
import type { CommentItem } from '@/types';
import { LikeButton } from './like-button';
import { UserAvatar } from './user-avatar';
import { VerifiedBadge } from './verified-badge';
import { nameDisplayProps, PlusBadge } from './plus';
import { ThanksButton } from './thanks-button';
import { RoleBadge } from '@/components/communities/role-badge';
import {
    CosmeticBadge,
    cosmeticNameStyle,
} from '@/components/season/cosmetics';
import {
    TranslateToggle,
    useContentTranslation,
} from '@/components/gc/translate';
import { MentionText } from './mention-text';
import { StickerPicker } from './stickers';
import { AffiliationBadges } from '@/components/gc/affiliation-badges';
import { UserRoles, UserTitle } from '@/components/gc/user-title';
import { tr } from '@/lib/i18n';

type CommentSort = 'old' | 'new' | 'reactions';

type Props = {
    /** Базовий URL коментарів, напр. `/posts/1/comments`. */
    endpoint: string;
    initial: CommentItem[];
    total: number;
    canComment: boolean;
    onCountChange: (count: number) => void;
    autoFocus?: boolean;
    /** Цитата з тексту запису (новий об’єкт — нова цитата). */
    quote?: { text: string } | null;
    className?: string;
    /** Повільний режим (гарячий запис) і адреса, щоб автор чи персонал його змінили. */
    slowMode?: { seconds: number; until: string; auto: boolean } | null;
    slowModeEndpoint?: string | null;
};

export function Comments({
    endpoint,
    initial,
    total,
    canComment,
    onCountChange,
    autoFocus,
    className,
    quote = null,
    slowMode: initialSlow = null,
    slowModeEndpoint = null,
}: Props) {
    const { auth } = usePage().props;
    const [comments, setComments] = useState(initial);
    const [loadedAll, setLoadedAll] = useState(initial.length >= total);
    const [body, setBody] = useState('');
    const draftsOn = usePlugin('local_drafts');
    // Чернетка коментаря — окремо для кожного запису чи фото.
    useDraft(draftsOn ? `comment:${endpoint}` : null, body, setBody);
    const [spoiler, setSpoiler] = useState(false);
    const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
    const [sending, setSending] = useState(false);
    const [sort, setSort] = useState<CommentSort>('old');
    const [sticker, setSticker] = useState<string | null>(null);
    const [pickingSticker, setPickingSticker] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    // «Відповісти цитатою» з тексту запису: цитата на початку поля, курсор — під нею.
    useEffect(() => {
        if (!quote) return;
        const quoted = quote.text
            .split('\n')
            .map((l) => `> ${l}`)
            .join('\n');
        setBody((current) => `${quoted}\n${current}`);
        window.setTimeout(() => {
            const el = inputRef.current;
            if (!el) return;
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
            fitTextarea(el, 160);
        }, 30);
    }, [quote]);

    const loadAll = async (next: CommentSort = sort) => {
        const response = await api<{ comments: CommentItem[] }>(
            'GET',
            `${endpoint}?sort=${next}`,
        );
        setComments(response.comments);
        setLoadedAll(true);
    };

    const chooseSort = (next: CommentSort) => {
        setSort(next);
        void loadAll(next);
    };

    const submit = async () => {
        if ((!body.trim() && !sticker) || sending) return;
        setSending(true);

        try {
            const response = await api<{
                comment: CommentItem;
                comments_count: number;
                slow_mode?: typeof slow;
            }>('POST', endpoint, {
                body,
                parent_id: replyTo?.id ?? null,
                spoiler,
                sticker,
            });
            setComments((list) => [...list, response.comment]);
            onCountChange(response.comments_count);
            if (response.slow_mode !== undefined) {
                setSlow(response.slow_mode);
                if (response.slow_mode && !slowModeEndpoint) {
                    setCooldown(response.slow_mode.seconds);
                }
            }
            setBody('');
            writeDraft(`comment:${endpoint}`, '');
            setSpoiler(false);
            setSticker(null);
            setPickingSticker(false);
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

    const pin = async (comment: CommentItem) => {
        const response = await api<{ id: number; is_pinned: boolean }>(
            'POST',
            `/comments/${comment.id}/pin`,
        );
        setComments((list) =>
            list.map((item) => ({
                ...item,
                is_pinned:
                    item.id === response.id
                        ? response.is_pinned
                        : response.is_pinned
                          ? false
                          : item.is_pinned,
            })),
        );
    };

    // Повільний режим: стан і зворотний відлік до наступного коментаря.
    const [slow, setSlow] = useState(initialSlow);
    const [cooldown, setCooldown] = useState(0);
    useEffect(() => {
        if (cooldown <= 0) return;
        const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);

        return () => window.clearTimeout(id);
    }, [cooldown]);
    const changeSlow = async (seconds: number) => {
        if (!slowModeEndpoint) return;
        const response = await api<{ slow_mode: typeof slow }>(
            'POST',
            slowModeEndpoint,
            { seconds, minutes: 60 },
        );
        setSlow(response.slow_mode);
    };

    // Приховані коментарі, які людина розгорнула.
    const [shown, setShown] = useState<Set<number>>(() => new Set());

    const setHidden = async (comment: CommentItem, hidden: boolean) => {
        const response = await api<{ comment: CommentItem }>(
            'POST',
            `/comments/${comment.id}/visibility`,
            { hidden },
        );
        setComments((list) =>
            list.map((item) =>
                item.id === comment.id
                    ? { ...item, ...response.comment }
                    : item,
            ),
        );
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
        <div className={cn('space-y-3 pt-3', className)}>
            {!loadedAll && total > comments.length && (
                <button
                    type="button"
                    onClick={() => void loadAll()}
                    className="text-[13px] font-medium text-sky-400 hover:text-white"
                >
                    {tr('Показати всі')} {total}{' '}
                    {plural(total, ['коментар', 'коментарі', 'коментарів'])}
                </button>
            )}

            {(comments.length > 1 || total > 1) && (
                <div className="flex gap-2 text-xs">
                    {(
                        [
                            ['new', tr('Нові')],
                            ['old', tr('Старі')],
                            ['reactions', tr('Реакції')],
                        ] as const
                    ).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => chooseSort(key)}
                            className={cn(
                                'rounded-chip px-2.5 py-1 font-medium',
                                sort === key
                                    ? 'bg-white/10 text-white'
                                    : 'text-white/45 hover:text-white',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}

            {[...comments]
                .sort((a, b) => {
                    const pin = Number(!!b.is_pinned) - Number(!!a.is_pinned);
                    if (pin !== 0) return pin;
                    if (sort === 'new') return b.id - a.id;
                    if (sort === 'reactions') {
                        return b.likes_count - a.likes_count || b.id - a.id;
                    }
                    return a.id - b.id;
                })
                .map((comment) => {
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
                                    {comment.is_pinned && (
                                        <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-sky-400">
                                            <Pin className="size-3" />{' '}
                                            {tr('Закріплено')}
                                        </span>
                                    )}
                                    <div className="flex flex-wrap items-center gap-1">
                                        <Link
                                            href={`/${comment.user.username}`}
                                            className="flex items-center gap-1 text-[13px] font-semibold text-white hover:underline"
                                        >
                                            <span
                                                {...nameDisplayProps(
                                                    comment.user.plus,
                                                    cosmeticNameStyle(
                                                        comment.user.cosmetics,
                                                    ),
                                                )}
                                            >
                                                {comment.user.name}
                                            </span>
                                            {comment.badge && (
                                                <RoleBadge
                                                    title={comment.badge.title}
                                                    color={comment.badge.color}
                                                />
                                            )}
                                            {comment.user.is_verified && (
                                                <VerifiedBadge
                                                    kind={
                                                        comment.user
                                                            .verified_kind
                                                    }
                                                    className="size-3"
                                                />
                                            )}
                                            {comment.user.plus && (
                                                <PlusBadge className="size-3.5" />
                                            )}
                                            <CosmeticBadge
                                                cosmetics={
                                                    comment.user.cosmetics
                                                }
                                                className="size-3.5"
                                            />
                                        </Link>
                                        <UserTitle user={comment.user} />
                                        <UserRoles
                                            roles={comment.user.roles}
                                            limit={1}
                                        />
                                        <AffiliationBadges
                                            badges={comment.user.badges}
                                            size={15}
                                        />
                                    </div>
                                    {comment.hidden &&
                                    !shown.has(comment.id) ? (
                                        <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-white/50">
                                            <EyeOff className="size-3.5" />
                                            {tr('Коментар приховано')}
                                            {comment.hidden.reason && (
                                                <span className="text-white/35">
                                                    · {comment.hidden.reason}
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                className="font-medium text-sky-400 hover:underline"
                                                onClick={() =>
                                                    setShown((set) =>
                                                        new Set(set).add(
                                                            comment.id,
                                                        ),
                                                    )
                                                }
                                            >
                                                {tr('Показати')}
                                            </button>
                                        </p>
                                    ) : (
                                        <p className="text-[14px] leading-snug break-words whitespace-pre-line text-white/85">
                                            {parent && (
                                                <span className="mr-1 text-sky-400">
                                                    {parent.user.first_name},
                                                </span>
                                            )}
                                            {comment.sticker && (
                                                <span className="mr-1 text-2xl leading-none">
                                                    {comment.sticker}
                                                </span>
                                            )}
                                            {comment.spoiler ? (
                                                <SpoilerText
                                                    text={comment.body}
                                                />
                                            ) : (
                                                comment.body && (
                                                    <CommentText
                                                        id={comment.id}
                                                        body={comment.body}
                                                    />
                                                )
                                            )}
                                        </p>
                                    )}
                                </div>
                                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pl-2 text-xs text-white/40">
                                    <span className="whitespace-nowrap">
                                        {timeAgo(comment.created_at)}
                                    </span>
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
                                    {comment.can_pin && (
                                        <button
                                            type="button"
                                            className="font-medium hover:text-white"
                                            onClick={() => void pin(comment)}
                                        >
                                            {comment.is_pinned
                                                ? tr('Відкріпити')
                                                : tr('Закріпити')}
                                        </button>
                                    )}
                                    {comment.can_moderate && (
                                        <button
                                            type="button"
                                            className="font-medium hover:text-white"
                                            onClick={() =>
                                                void setHidden(
                                                    comment,
                                                    !comment.hidden,
                                                )
                                            }
                                        >
                                            {comment.hidden
                                                ? tr('Повернути')
                                                : tr('Приховати')}
                                        </button>
                                    )}
                                    {comment.can_thank && (
                                        <ThanksButton
                                            kind="comment"
                                            id={comment.id}
                                            thanked={comment.thanked ?? false}
                                        />
                                    )}
                                    {comment.can_delete && (
                                        <button
                                            type="button"
                                            className="opacity-0 transition group-hover:opacity-100 hover:text-red-400 [@media(hover:none)]:opacity-100"
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

            {(slow || slowModeEndpoint) && (
                <div
                    className={cn(
                        'flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-xs',
                        slow
                            ? 'bg-amber-400/10 text-amber-300'
                            : 'text-white/45',
                    )}
                >
                    <Timer className="size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1">
                        {slow
                            ? slow.auto
                                ? tr(
                                      'Гаряче обговорення — повільний режим: один коментар на {s} с.',
                                      { s: slow.seconds },
                                  )
                                : tr(
                                      'Повільний режим: один коментар на {s} с.',
                                      { s: slow.seconds },
                                  )
                            : tr('Повільний режим вимкнено')}
                    </span>
                    {slowModeEndpoint && (
                        <select
                            aria-label={tr('Повільний режим')}
                            value={slow?.seconds ?? 0}
                            onChange={(e) =>
                                void changeSlow(Number(e.target.value))
                            }
                            className="rounded-lg bg-white/10 px-2 py-1 text-xs text-white"
                        >
                            <option value={0}>{tr('Вимкнено')}</option>
                            <option value={15}>{tr('15 с')}</option>
                            <option value={30}>{tr('30 с')}</option>
                            <option value={60}>{tr('1 хв')}</option>
                            <option value={120}>{tr('2 хв')}</option>
                            <option value={300}>{tr('5 хв')}</option>
                        </select>
                    )}
                </div>
            )}
            {canComment && (
                <div className="flex items-end gap-2.5 pt-1">
                    <UserAvatar user={auth.user} size="sm" showOnline={false} />
                    <div className="gc-comment-pill gc-solid-2 flex min-w-0 flex-1 flex-col rounded-2xl">
                        {replyTo && (
                            <div className="flex items-center gap-1.5 px-3.5 pt-2 text-xs text-sky-400">
                                <CornerDownRight className="size-3.5" />{' '}
                                {tr('Відповідь для')} {replyTo.user.first_name}
                                <button
                                    type="button"
                                    className="ml-auto text-white/60 hover:text-white"
                                    onClick={() => setReplyTo(null)}
                                >
                                    {tr('скасувати')}
                                </button>
                            </div>
                        )}
                        {pickingSticker && (
                            <div className="px-3 pt-2">
                                <StickerPicker
                                    value={sticker}
                                    onChange={setSticker}
                                />
                            </div>
                        )}
                        {/* Один рядок: стікер, текст, спойлер і «надіслати» — без зайвих рамок. */}
                        <div className="flex items-end gap-0.5 px-1">
                            <button
                                type="button"
                                onClick={() =>
                                    setPickingSticker((open) => !open)
                                }
                                aria-pressed={pickingSticker || !!sticker}
                                title={tr('Стікер')}
                                aria-label={tr('Стікер')}
                                className={cn(
                                    'mb-1 flex size-8 shrink-0 items-center justify-center rounded-xl transition hover:bg-[var(--gc-l3)]',
                                    pickingSticker || sticker
                                        ? 'text-sky-400'
                                        : 'text-white/60',
                                )}
                            >
                                <Smile className="size-[18px]" />
                            </button>
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
                                className="[field-sizing:content] max-h-40 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => setSpoiler((v) => !v)}
                                aria-pressed={spoiler}
                                title={tr('Спойлер')}
                                aria-label={tr('Спойлер')}
                                className={cn(
                                    'mb-1 flex size-8 shrink-0 items-center justify-center rounded-xl transition hover:bg-[var(--gc-l3)]',
                                    spoiler
                                        ? 'text-amber-400'
                                        : 'text-white/60',
                                )}
                            >
                                <EyeOff className="size-[18px]" />
                            </button>
                            <button
                                type="button"
                                onClick={submit}
                                disabled={
                                    (!body.trim() && !sticker) ||
                                    sending ||
                                    cooldown > 0
                                }
                                className="mb-1 flex h-8 min-w-8 shrink-0 items-center justify-center rounded-xl px-1 text-sky-400 transition hover:bg-[var(--gc-l3)] disabled:opacity-30"
                                aria-label={tr('Надіслати')}
                            >
                                {cooldown > 0 ? (
                                    <span className="text-xs font-semibold tabular-nums">
                                        {cooldown}
                                    </span>
                                ) : (
                                    <SendHorizontal className="size-[18px]" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SpoilerText({ text }: { text: string }) {
    const [open, setOpen] = useState(false);
    const hideSpoilers = usePage().props.auth.user?.hide_spoilers === true;
    if (!open) {
        return (
            <button
                type="button"
                className="text-white/70 underline"
                onClick={() => {
                    if (!hideSpoilers) {
                        setOpen(true);
                    }
                }}
            >
                {hideSpoilers
                    ? tr('Спойлери приховано в налаштуваннях')
                    : tr('Спойлер')}
            </button>
        );
    }

    return <MentionText text={text} />;
}

/** Текст коментаря з кнопкою «Перекласти». */
function CommentText({ id, body }: { id: number; body: string }) {
    const translation = useContentTranslation('comment', id);
    const parts = splitQuotes(translation.text ?? body);

    return (
        <>
            {parts.map((part, i) =>
                part.quote ? (
                    <span
                        key={i}
                        className="my-1 block rounded-r-lg bg-white/[0.04] py-1 pr-2 pl-2.5 text-white/65 italic shadow-[inset_3px_0_0_rgb(56,189,248)]"
                    >
                        {part.text}
                    </span>
                ) : (
                    <MentionText key={i} text={part.text.replace(/^\n+/, '')} />
                ),
            )}
            {translation.enabled && (
                <span className="mt-0.5 block">
                    <TranslateToggle state={translation} />
                </span>
            )}
        </>
    );
}
