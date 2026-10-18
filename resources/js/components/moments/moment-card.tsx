import { Link, router } from '@inertiajs/react';
import { ExternalLink, Heart, Play, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { api } from '@/lib/api';
import { shortNumber, timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

export type MomentCardData = {
    id: number;
    title: string;
    provider: 'youtube' | 'twitch' | 'medal';
    provider_label: string;
    url: string;
    player: string | null;
    thumbnail: string | null;
    likes: number;
    liked: boolean;
    can_delete: boolean;
    user: UserCard;
    game: { slug: string; name: string } | null;
    server: { slug: string; name: string } | null;
    created_at: string;
};

const PROVIDER_TONE: Record<string, string> = {
    youtube: 'bg-rose-500/85',
    twitch: 'bg-violet-500/85',
    medal: 'bg-amber-500/85',
};

/** Кліп: обкладинка → плеєр по натисканню, автор, гра й «подобається». */
export function MomentCard({ moment }: { moment: MomentCardData }) {
    const [playing, setPlaying] = useState(false);
    const [liked, setLiked] = useState(moment.liked);
    const [likes, setLikes] = useState(moment.likes);

    const like = () => {
        setLiked(!liked);
        setLikes((n) => n + (liked ? -1 : 1));
        api<{ liked: boolean; likes: number }>(
            'POST',
            `/moments/${moment.id}/like`,
        )
            .then((r) => {
                setLiked(r.liked);
                setLikes(r.likes);
            })
            .catch(() => {
                setLiked(moment.liked);
                setLikes(moment.likes);
            });
    };

    return (
        <article className="glass flex min-w-0 flex-col overflow-hidden rounded-3xl">
            <div className="relative aspect-video w-full bg-black/40">
                {playing && moment.player ? (
                    <iframe
                        src={moment.player}
                        title={moment.title}
                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                        className="absolute inset-0 size-full"
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() =>
                            moment.player
                                ? setPlaying(true)
                                : window.open(moment.url, '_blank', 'noopener')
                        }
                        aria-label={tr('Дивитися «{title}»', {
                            title: moment.title,
                        })}
                        className="group absolute inset-0 block size-full"
                    >
                        {moment.thumbnail ? (
                            <img
                                src={moment.thumbnail}
                                alt=""
                                loading="lazy"
                                className="size-full object-cover transition group-hover:opacity-90"
                            />
                        ) : (
                            <span className="block size-full bg-gradient-to-br from-gc-indigo/40 via-black/40 to-black/70" />
                        )}
                        <span className="absolute inset-0 flex items-center justify-center">
                            <span className="flex size-14 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition group-hover:scale-105">
                                {moment.player ? (
                                    <Play className="ml-0.5 size-6 fill-white" />
                                ) : (
                                    <ExternalLink className="size-6" />
                                )}
                            </span>
                        </span>
                        <span
                            className={cn(
                                'absolute top-2.5 left-2.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white',
                                PROVIDER_TONE[moment.provider],
                            )}
                        >
                            {moment.provider_label}
                        </span>
                    </button>
                )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                <h3 className="line-clamp-2 font-semibold break-words text-white">
                    {moment.title}
                </h3>
                <div className="flex flex-wrap gap-1.5 text-xs">
                    {moment.game && (
                        <Link
                            href={`/moments?game=${moment.game.slug}`}
                            className="max-w-full truncate rounded-full bg-white/[0.06] px-2.5 py-0.5 text-white/70 hover:text-white"
                        >
                            🎮 {moment.game.name}
                        </Link>
                    )}
                    {moment.server && (
                        <Link
                            href={`/servers/${moment.server.slug}`}
                            className="max-w-full truncate rounded-full bg-white/[0.06] px-2.5 py-0.5 text-white/70 hover:text-white"
                        >
                            {moment.server.name}
                        </Link>
                    )}
                </div>
                <div className="mt-auto flex items-center gap-2">
                    <Link
                        href={`/${moment.user.username}`}
                        className="flex min-w-0 flex-1 items-center gap-2"
                    >
                        <UserAvatar
                            user={moment.user}
                            size="sm"
                            showOnline={false}
                        />
                        <span className="min-w-0">
                            <span className="block truncate text-sm text-white">
                                {moment.user.name}
                            </span>
                            <span className="block text-xs text-white/40">
                                {timeAgo(moment.created_at)}
                            </span>
                        </span>
                    </Link>
                    {moment.can_delete && (
                        <button
                            type="button"
                            aria-label={tr('Видалити момент')}
                            onClick={() => {
                                if (
                                    window.confirm(tr('Видалити цей момент?'))
                                ) {
                                    router.delete(`/moments/${moment.id}`, {
                                        preserveScroll: true,
                                    });
                                }
                            }}
                            className="shrink-0 rounded-lg p-2 text-white/40 transition hover:bg-white/[0.06] hover:text-rose-200"
                        >
                            <Trash2 className="size-4" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={like}
                        aria-pressed={liked}
                        aria-label={tr('Подобається')}
                        className={cn(
                            'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm transition',
                            liked
                                ? 'bg-rose-500/15 text-rose-200'
                                : 'bg-white/[0.05] text-white/70 hover:text-white',
                        )}
                    >
                        <Heart
                            className={cn(
                                'size-4',
                                liked && 'fill-rose-400 text-rose-400',
                            )}
                        />
                        <span className="tabular-nums">
                            {shortNumber(likes)}
                        </span>
                    </button>
                </div>
            </div>
        </article>
    );
}
