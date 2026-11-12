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
    provider: 'youtube' | 'twitch' | 'medal' | 'upload';
    provider_label: string;
    url: string;
    player: string | null;
    /** Власний кліп: пряме відео й стан обробки. */
    video?: string | null;
    status?: 'ready' | 'processing' | 'failed';
    duration?: number | null;
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
    youtube: 'bg-red-500/85',
    twitch: 'bg-sky-500/85',
    medal: 'bg-amber-500/85',
    upload: 'bg-indigo-500/85',
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
        <article className="gc-solid flex min-w-0 flex-col overflow-hidden rounded-2xl">
            <div className="relative aspect-video w-full bg-black/40">
                {moment.status === 'processing' ||
                moment.status === 'failed' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-center text-sm text-white/80">
                        {moment.status === 'processing' ? (
                            <>
                                <span className="size-6 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />
                                {tr('Обрізаємо й стискаємо…')}
                            </>
                        ) : (
                            tr('Не вдалося обробити відео')
                        )}
                    </div>
                ) : playing && moment.video ? (
                    <video
                        src={moment.video}
                        poster={moment.thumbnail ?? undefined}
                        controls
                        autoPlay
                        playsInline
                        className="absolute inset-0 size-full bg-black object-contain"
                    />
                ) : playing && moment.player ? (
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
                            moment.player || moment.video
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
                                {moment.player || moment.video ? (
                                    <Play className="ml-0.5 size-6 fill-white" />
                                ) : (
                                    <ExternalLink className="size-6" />
                                )}
                            </span>
                        </span>
                        <span
                            className={cn(
                                'absolute top-2.5 left-2.5 rounded-chip px-2 py-0.5 text-[11px] font-semibold text-white',
                                PROVIDER_TONE[moment.provider],
                            )}
                        >
                            {moment.provider_label}
                        </span>
                        {moment.duration ? (
                            <span className="absolute right-2.5 bottom-2.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-semibold text-white tabular-nums">
                                {Math.floor(moment.duration / 60)}:
                                {String(moment.duration % 60).padStart(2, '0')}
                            </span>
                        ) : null}
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
                            className="gc-solid-2 max-w-full truncate rounded-control px-2.5 py-0.5 text-white/70 hover:text-white"
                        >
                            🎮 {moment.game.name}
                        </Link>
                    )}
                    {moment.server && (
                        <Link
                            href={`/servers/${moment.server.slug}`}
                            className="gc-solid-2 max-w-full truncate rounded-control px-2.5 py-0.5 text-white/70 hover:text-white"
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
                            className="shrink-0 rounded-lg p-2 text-white/40 transition hover:bg-[var(--gc-l3)] hover:text-red-400"
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
                            'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control px-3 text-sm transition',
                            liked
                                ? 'bg-red-500/15 text-red-400'
                                : 'gc-solid-2 text-white/70 hover:text-white',
                        )}
                    >
                        <Heart
                            className={cn(
                                'size-4',
                                liked && 'fill-red-400 text-red-400',
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
