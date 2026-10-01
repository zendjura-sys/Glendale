import { Link, router } from '@inertiajs/react';
import {
    ChevronRight,
    Earth,
    Eye,
    Link2,
    Lock,
    MessageCircle,
    MoreHorizontal,
    Pin,
    PinOff,
    Trash2,
    UsersRound,
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
import { Comments } from './comments';
import { CommunityAvatar } from './community-avatar';
import { LikeButton } from './like-button';
import { MediaGrid } from './media-grid';
import { UserAvatar } from './user-avatar';
import { VerifiedBadge } from './verified-badge';

const visibilityMeta = {
    public: { icon: Earth, label: 'Усім' },
    friends: { icon: UsersRound, label: 'Лише друзям' },
    private: { icon: Lock, label: 'Тільки мені' },
} as const;

const LONG_TEXT = 420;

export function PostCard({
    post,
    expanded = false,
}: {
    post: PostItem;
    expanded?: boolean;
}) {
    const [liked, setLiked] = useState(post.liked);
    const [likes, setLikes] = useState(post.likes_count);
    const [commentsCount, setCommentsCount] = useState(post.comments_count);
    const [showComments, setShowComments] = useState(
        expanded || post.comments.length > 0,
    );
    const [focusComment, setFocusComment] = useState(false);
    const [fullText, setFullText] = useState(expanded);
    const [deleted, setDeleted] = useState(false);

    const Visibility = visibilityMeta[post.visibility].icon;
    const publisherHref = post.publisher?.href ?? `/${post.author.username}`;
    const body = post.body ?? '';
    const isLong = body.length > LONG_TEXT;

    const toggleLike = async () => {
        setLiked(!liked);
        setLikes((value) => value + (liked ? -1 : 1));

        try {
            const response = await api<{ liked: boolean; likes_count: number }>(
                'POST',
                `/posts/${post.id}/like`,
            );
            setLiked(response.liked);
            setLikes(response.likes_count);
        } catch {
            setLiked(liked);
            setLikes(post.likes_count);
        }
    };

    const copyLink = async () => {
        await navigator.clipboard?.writeText(
            `${window.location.origin}/posts/${post.id}`,
        );
        toast.success('Посилання скопійовано.');
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
                        </Link>
                        <span>·</span>
                        <Visibility
                            className="size-3.5"
                            aria-label={visibilityMeta[post.visibility].label}
                        />
                        {post.is_pinned && (
                            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-[#4f8bff]/15 px-2 py-0.5 text-[11px] font-medium text-[#9fb6ff]">
                                <Pin className="size-3" /> Закріплено
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
                        className="glass-strong w-52 rounded-2xl border-white/10 p-1.5 text-white"
                    >
                        <DropdownMenuItem
                            className="rounded-lg focus:bg-white/[0.06]"
                            onSelect={copyLink}
                        >
                            <Link2 /> Копіювати посилання
                        </DropdownMenuItem>
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
                                {post.is_pinned ? 'Відкріпити' : 'Закріпити'}
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
                                    Видалити запис
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </header>

            {body && (
                <div className="mt-3.5 text-[15px] leading-relaxed break-words whitespace-pre-line text-white/90">
                    {isLong && !fullText
                        ? `${body.slice(0, LONG_TEXT).trimEnd()}…`
                        : body}
                    {isLong && !fullText && (
                        <button
                            type="button"
                            onClick={() => setFullText(true)}
                            className="ml-1 font-medium text-[#9aa8ff] hover:text-white"
                        >
                            Показати повністю
                        </button>
                    )}
                </div>
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

            <footer className="mt-4 flex items-center gap-2">
                <LikeButton liked={liked} count={likes} onToggle={toggleLike} />
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
                    aria-label="Коментарі"
                >
                    <MessageCircle className="size-[18px]" />
                    {commentsCount > 0 && (
                        <span className="tabular-nums">
                            {compactNumber(commentsCount)}
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={copyLink}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.045] px-3.5 text-sm font-medium text-white/65 transition hover:bg-white/[0.08] hover:text-white"
                    aria-label="Поділитися"
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
