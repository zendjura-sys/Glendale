import { Link, router } from '@inertiajs/react';
import {
    ChevronRight,
    Earth,
    Eye,
    EyeOff,
    Link2,
    Lock,
    MessageCircle,
    MoreHorizontal,
    Pencil,
    Pin,
    PinOff,
    Quote,
    Share2,
    Trash2,
    UsersRound,
    Volume2,
    VolumeX,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MovieCardEmbed } from '@/components/cinema/movie-card';
import { MusicCard } from '@/components/music/music-card';
import { api } from '@/lib/api';
import { compactNumber, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PostItem } from '@/types';
import { MentionText } from './mention-text';
import { SaveButton } from './save-button';
import { Comments } from './comments';
import { CommunityAvatar } from './community-avatar';
import { ReactionBar } from './reaction-bar';
import { MediaGrid } from './media-grid';
import { UserAvatar } from './user-avatar';
import { VerifiedBadge } from './verified-badge';
import {
    TranslateToggle,
    useContentTranslation,
} from '@/components/gc/translate';
import { tr } from '@/lib/i18n';

const visibilityMeta = {
    public: { icon: Earth, label: tr('Усім') },
    friends: { icon: UsersRound, label: tr('Лише друзям') },
    private: { icon: Lock, label: tr('Тільки мені') },
} as const;

const LONG_TEXT = 420;

export function PostCard({
    post,
    expanded = false,
}: {
    post: PostItem;
    expanded?: boolean;
}) {
    const [reaction, setReaction] = useState<string | null>(post.reaction ?? (post.liked ? 'like' : null));
    const [likes, setLikes] = useState(post.likes_count);
    const [commentsCount, setCommentsCount] = useState(post.comments_count);
    const [showComments, setShowComments] = useState(
        expanded || post.comments.length > 0,
    );
    const [focusComment, setFocusComment] = useState(false);
    const [fullText, setFullText] = useState(expanded);
    const [deleted, setDeleted] = useState(false);
    const [poll, setPoll] = useState(post.poll ?? null);
    const [spoilerOpen, setSpoilerOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editBody, setEditBody] = useState(post.body ?? '');
    const [quoting, setQuoting] = useState(false);
    const [quoteBody, setQuoteBody] = useState('');

    const Visibility = visibilityMeta[post.visibility].icon;
    const publisherHref = post.publisher?.href ?? `/${post.author.username}`;
    const translation = useContentTranslation('post', post.id);
    const body = translation.text ?? post.body ?? '';
    const isLong = body.length > LONG_TEXT;

    const pickReaction = async (next: string) => {
        const previous = reaction;
        const removing = previous === next;
        setReaction(removing ? null : next);
        setLikes((value) => value + (previous === null ? 1 : removing ? -1 : 0));

        try {
            const response = await api<{ reaction: string | null; likes_count: number }>(
                'POST',
                `/posts/${post.id}/like`,
                { reaction: next },
            );
            setReaction(response.reaction);
            setLikes(response.likes_count);
        } catch {
            setReaction(previous);
            setLikes(post.likes_count);
        }
    };

    const copyLink = async () => {
        await navigator.clipboard?.writeText(
            `${window.location.origin}/posts/${post.id}`,
        );
        toast.success(tr('Посилання скопійовано.'));
    };

    if (deleted) {
        return null;
    }

    return (
        <article className="glass animate-rise rounded-3xl p-4 sm:p-5">
            <header className="flex items-start gap-3">
                <Link href={publisherHref} className="shrink-0">
                    {post.publisher ? (
                        <CommunityAvatar community={post.publisher} size="md" />
                    ) : (
                        <UserAvatar user={post.author} size="md" />
                    )}
                </Link>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-1.5 text-[15px] leading-tight">
                        <Link
                            href={publisherHref}
                            className="flex items-center gap-1 font-semibold text-white hover:underline"
                        >
                            {post.publisher?.name ?? post.author.name}
                            {(post.publisher ?? post.author).is_verified && (
                                <VerifiedBadge />
                            )}
                        </Link>
                        {post.wall && (
                            <>
                                <ChevronRight className="size-3.5 text-white/30" />
                                <Link
                                    href={post.wall.href}
                                    className="font-semibold text-white/80 hover:underline"
                                >
                                    {post.wall.name}
                                </Link>
                            </>
                        )}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-white/45">
                        <Link
                            href={`/posts/${post.id}`}
                            className="hover:text-white/80"
                        >
                            {timeAgo(post.created_at)}
                            {post.edited_at && (
                                <span> · {tr('змінено')}</span>
                            )}
                        </Link>
                        <span>·</span>
                        <Visibility
                            className="size-3.5"
                            aria-label={visibilityMeta[post.visibility].label}
                        />
                        {post.is_pinned && (
                            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-gc-blue/15 px-2 py-0.5 text-xs font-medium text-[#9fb6ff]">
                                <Pin className="size-3" /> {tr('Закріплено')}
                            </span>
                        )}
                    </div>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger className="rounded-full p-1.5 text-white/40 transition outline-none hover:bg-white/[0.06] hover:text-white">
                        <MoreHorizontal className="size-5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        className="glass-strong w-60 rounded-2xl border-white/10 p-1.5 text-white"
                    >
                        <DropdownMenuItem
                            className="rounded-lg focus:bg-white/[0.06]"
                            onSelect={copyLink}
                        >
                            <Link2 /> {tr('Копіювати посилання')}
                        </DropdownMenuItem>
                        {post.can.edit && (
                            <DropdownMenuItem
                                className="rounded-lg focus:bg-white/[0.06]"
                                onSelect={() => setEditing(true)}
                            >
                                <Pencil /> {tr('Редагувати')}
                            </DropdownMenuItem>
                        )}
                        {post.can.share && (
                            <DropdownMenuItem
                                className="rounded-lg focus:bg-white/[0.06]"
                                onSelect={() =>
                                    router.post(
                                        `/posts/${post.id}/share`,
                                        {},
                                        { preserveScroll: true },
                                    )
                                }
                            >
                                <Share2 /> {tr('Поділитися на стіні')}
                            </DropdownMenuItem>
                        )}
                        {post.can.quote && (
                            <DropdownMenuItem
                                className="rounded-lg focus:bg-white/[0.06]"
                                onSelect={() => setQuoting(true)}
                            >
                                <Quote /> {tr('Цитувати')}
                            </DropdownMenuItem>
                        )}
                        {post.can.hide && (
                            <DropdownMenuItem
                                className="rounded-lg focus:bg-white/[0.06]"
                                onSelect={() =>
                                    router.post(
                                        `/posts/${post.id}/hide`,
                                        {},
                                        { preserveScroll: true },
                                    )
                                }
                            >
                                <EyeOff /> {tr('Не цікаво')}
                            </DropdownMenuItem>
                        )}
                        {post.can.mute && (
                            <DropdownMenuItem
                                className="rounded-lg focus:bg-white/[0.06]"
                                onSelect={() =>
                                    router.post(
                                        `/posts/${post.id}/mute`,
                                        {},
                                        { preserveScroll: true },
                                    )
                                }
                            >
                                {post.muted ? <Volume2 /> : <VolumeX />}{' '}
                                {post.muted ? tr('Зняти заглушку') : tr('Заглушити')}
                            </DropdownMenuItem>
                        )}
                        {post.can.pin && (
                            <DropdownMenuItem
                                className="rounded-lg focus:bg-white/[0.06]"
                                onSelect={() =>
                                    router.post(
                                        `/posts/${post.id}/pin`,
                                        {},
                                        { preserveScroll: true },
                                    )
                                }
                            >
                                {post.is_pinned ? <PinOff /> : <Pin />}{' '}
                                {post.is_pinned
                                    ? tr('Відкріпити')
                                    : tr('Закріпити')}
                            </DropdownMenuItem>
                        )}
                        {post.can.delete && (
                            <>
                                <DropdownMenuSeparator className="bg-white/5" />
                                <DropdownMenuItem
                                    className="rounded-lg text-rose-300 focus:bg-rose-500/10 focus:text-rose-200"
                                    onSelect={() =>
                                        router.delete(`/posts/${post.id}`, {
                                            preserveScroll: true,
                                            onSuccess: () => setDeleted(true),
                                        })
                                    }
                                >
                                    <Trash2 className="text-rose-300" />{' '}
                                    {tr('Видалити запис')}
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </header>

            {quoting && (
                <form
                    className="mt-3 space-y-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (!quoteBody.trim()) return;
                        router.post(
                            `/posts/${post.id}/quote`,
                            { body: quoteBody },
                            {
                                preserveScroll: true,
                                onSuccess: () => {
                                    setQuoting(false);
                                    setQuoteBody('');
                                },
                            },
                        );
                    }}
                >
                    <textarea
                        value={quoteBody}
                        onChange={(event) => setQuoteBody(event.target.value)}
                        rows={3}
                        placeholder={tr('Ваш коментар до цитати…')}
                        className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none"
                    />
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="h-9 rounded-xl bg-white px-3 text-sm font-medium text-black"
                        >
                            {tr('Опублікувати')}
                        </button>
                        <button
                            type="button"
                            className="h-9 rounded-xl px-3 text-sm text-white/60"
                            onClick={() => {
                                setQuoting(false);
                                setQuoteBody('');
                            }}
                        >
                            {tr('Скасувати')}
                        </button>
                    </div>
                </form>
            )}

            {editing ? (
                <form
                    className="mt-3 space-y-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        router.patch(
                            `/posts/${post.id}`,
                            { body: editBody },
                            {
                                preserveScroll: true,
                                onSuccess: () => setEditing(false),
                            },
                        );
                    }}
                >
                    <textarea
                        value={editBody}
                        onChange={(event) => setEditBody(event.target.value)}
                        rows={4}
                        className="input-glass w-full rounded-xl px-3 py-2 text-sm text-white"
                    />
                    <div className="flex gap-2">
                        <button type="submit" className="btn-glow h-9 rounded-xl px-3 text-sm font-semibold">
                            {tr('Зберегти')}
                        </button>
                        <button
                            type="button"
                            className="h-9 rounded-xl px-3 text-sm text-white/60"
                            onClick={() => {
                                setEditBody(post.body ?? '');
                                setEditing(false);
                            }}
                        >
                            {tr('Скасувати')}
                        </button>
                    </div>
                </form>
            ) : body && post.spoiler && !spoilerOpen ? (
                <button
                    type="button"
                    onClick={() => setSpoilerOpen(true)}
                    className="mt-3.5 rounded-xl bg-white/10 px-3 py-2 text-sm text-white/70"
                >
                    {tr('Спойлер')}
                </button>
            ) : body && (
                <div className="mt-3.5 text-[15px] leading-relaxed break-words whitespace-pre-line text-white/90">
                    {isLong && !fullText ? (
                        <MentionText text={`${body.slice(0, LONG_TEXT).trimEnd()}…`} />
                    ) : (
                        <MentionText text={body} />
                    )}
                    {isLong && !fullText && (
                        <button
                            type="button"
                            onClick={() => setFullText(true)}
                            className="ml-1 font-medium text-gc-lilac-300 hover:text-white"
                        >
                            {tr('Показати повністю')}
                        </button>
                    )}
                    <div>
                        <TranslateToggle
                            state={translation}
                            className="mt-1.5"
                        />
                    </div>
                </div>
            )}

            {post.sticker && (
                <div className="mt-3 text-5xl leading-none" aria-hidden>
                    {post.sticker}
                </div>
            )}

            {post.quoted && (
                <Link
                    href={`/posts/${post.quoted.id}`}
                    className="mt-3.5 block rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
                >
                    <span className="text-xs text-white/40">{tr('Цитата')}</span>
                    <span className="mt-0.5 block text-sm font-medium text-white">
                        {post.quoted.name}
                    </span>
                    {post.quoted.body && (
                        <span className="mt-1 block line-clamp-3 text-sm text-white/70">
                            {post.quoted.body}
                        </span>
                    )}
                </Link>
            )}

            {post.shared && (
                <Link
                    href={post.shared.href}
                    className="mt-3.5 block rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
                >
                    <span className="text-xs text-white/40">{tr('Запис')}</span>
                    <span className="mt-0.5 block text-sm font-medium text-white">
                        {post.shared.name}
                    </span>
                    {post.shared.body && post.shared.body !== (post.body ?? '') && (
                        <span className="mt-1 block line-clamp-3 text-sm text-white/70">
                            {post.shared.body}
                        </span>
                    )}
                </Link>
            )}

            {post.attachments.length > 0 && (
                <div className="mt-3.5">
                    <MediaGrid items={post.attachments} />
                </div>
            )}

            {post.music && <MusicCard track={post.music} className="mt-3.5" />}

            {post.movie && (
                <MovieCardEmbed movie={post.movie} className="mt-3.5" />
            )}

            {post.card && (
                <Link
                    href={post.card.href}
                    className="mt-3.5 flex items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                >
                    {post.card.image && (
                        <img src={post.card.image} alt="" className="size-14 rounded-xl object-cover" />
                    )}
                    <span className="min-w-0">
                        <span className="block text-xs text-white/40">{tr(post.card.hint)}</span>
                        <span className="block truncate text-sm font-medium text-white">{post.card.title}</span>
                    </span>
                </Link>
            )}

            {poll && (
                <div className="mt-3.5 space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-sm font-medium text-white">{poll.question}</p>
                    {poll.options.map((option) => {
                        const share = poll.total > 0 ? Math.round((option.votes / poll.total) * 100) : 0;
                        const chosen = poll.voted === option.id;

                        return (
                            <button
                                key={option.id}
                                type="button"
                                onClick={async () => {
                                    const next = await api<NonNullable<PostItem['poll']>>(
                                        'POST',
                                        `/posts/${post.id}/poll`,
                                        { option_id: option.id },
                                    );
                                    setPoll(next);
                                }}
                                className={cn(
                                    'relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm',
                                    chosen ? 'border-gc-lilac-400/50 text-white' : 'border-white/10 text-white/80 hover:border-white/20',
                                )}
                            >
                                <span
                                    className="absolute inset-y-0 left-0 bg-gc-indigo/25"
                                    style={{ width: `${poll.voted ? share : 0}%` }}
                                />
                                <span className="relative flex items-center justify-between gap-3">
                                    <span>{option.label}</span>
                                    {poll.voted !== null && (
                                        <span className="text-xs text-white/50 tabular-nums">{share}%</span>
                                    )}
                                </span>
                            </button>
                        );
                    })}
                    <p className="text-xs text-white/40">
                        {tr('{total} голосів', { total: poll.total })}
                    </p>
                </div>
            )}

            {post.link && (
                <a
                    href={post.link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3.5 flex overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
                >
                    {post.link.thumbnail && (
                        <img
                            src={post.link.thumbnail}
                            alt=""
                            className="h-24 w-40 shrink-0 object-cover"
                        />
                    )}
                    <span className="min-w-0 p-3">
                        <span className="block text-xs text-white/40">
                            YouTube
                            {post.link.author ? ` · ${post.link.author}` : ''}
                        </span>
                        <span className="mt-1 block line-clamp-2 text-sm font-medium text-white">
                            {post.link.title}
                        </span>
                    </span>
                </a>
            )}

            <footer className="mt-4 flex items-center gap-2">
                <ReactionBar reaction={reaction} count={likes} onPick={pickReaction} />
                <button
                    type="button"
                    onClick={() => {
                        setShowComments(true);
                        setFocusComment(true);
                    }}
                    className={cn(
                        'inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.045] px-3.5 text-sm font-medium text-white/65 transition hover:bg-white/[0.08] hover:text-white',
                        !post.comments_enabled &&
                            'pointer-events-none opacity-40',
                    )}
                    aria-label={tr('Коментарі')}
                >
                    <MessageCircle className="size-[18px]" />
                    {commentsCount > 0 && (
                        <span className="tabular-nums">
                            {compactNumber(commentsCount)}
                        </span>
                    )}
                </button>
                <SaveButton kind="post" id={post.id} saved={post.saved ?? false} compact />
                <button
                    type="button"
                    onClick={copyLink}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.045] px-3.5 text-sm font-medium text-white/65 transition hover:bg-white/[0.08] hover:text-white"
                    aria-label={tr('Поділитися')}
                >
                    <Link2 className="size-[18px]" />
                </button>
                {post.views_count > 0 && (
                    <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-white/35">
                        <Eye className="size-4" />{' '}
                        {compactNumber(post.views_count)}
                    </span>
                )}
            </footer>

            {showComments && (
                <div className="mt-3">
                    <Comments
                        endpoint={`/posts/${post.id}/comments`}
                        initial={post.comments}
                        total={commentsCount}
                        canComment={post.can.comment}
                        onCountChange={setCommentsCount}
                        autoFocus={focusComment}
                    />
                </div>
            )}
        </article>
    );
}
