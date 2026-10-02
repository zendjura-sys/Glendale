import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Globe2,
    ListMusic,
    Lock,
    Pause,
    PenLine,
    Play,
    Shuffle,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/gc/user-avatar';
import { EmptyState } from '@/components/gc/widget';
import { PlaylistCover } from '@/components/music/playlist-card';
import { PlaylistDialog } from '@/components/music/playlist-dialog';
import { TrackList } from '@/components/music/track-list';
import { api } from '@/lib/api';
import { formatLength, plural } from '@/lib/format';
import { playQueue, shuffled, toggle, usePlayer } from '@/lib/player';
import type { PlaylistDetails, TrackCard } from '@/types';

type Props = {
    playlist: PlaylistDetails;
    tracks: TrackCard[];
    can: { manage: boolean };
};

export default function PlaylistShow({ playlist, tracks, can }: Props) {
    const { auth } = usePage().props;
    const player = usePlayer();
    const [editing, setEditing] = useState(false);
    const [count, setCount] = useState(playlist.tracks_count);
    const keys = tracks.map((t) => t.key);
    const fromHere =
        player.current !== null &&
        keys.includes(player.current.key) &&
        player.queue.length === tracks.length;
    const playing = fromHere && player.playing;

    const detach = async (track: TrackCard) => {
        if (track.source !== 'local') return;
        const response = await api<{ tracks_count: number }>(
            'DELETE',
            `/music/playlists/${playlist.id}/tracks/${track.id}`,
        );
        setCount(response.tracks_count);
        toast.success('Трек прибрано з плейлиста.');
    };

    const destroy = () => {
        if (!window.confirm(`Видалити плейлист «${playlist.title}»?`)) return;
        router.delete(`/music/playlists/${playlist.id}`);
    };

    return (
        <>
            <Head title={playlist.title} />
            <div className="space-y-5">
                <section className="glass relative overflow-hidden rounded-3xl p-5 sm:p-7">
                    {playlist.covers[0] && (
                        <img
                            src={playlist.cover_url ?? playlist.covers[0]}
                            alt=""
                            className="pointer-events-none absolute inset-0 size-full scale-125 object-cover opacity-25 blur-3xl"
                        />
                    )}
                    <div className="pointer-events-none absolute -top-24 -right-10 size-72 rounded-full bg-[#a855f7]/25 blur-3xl" />
                    <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end">
                        <PlaylistCover
                            playlist={playlist}
                            className="w-44 shrink-0 rounded-2xl shadow-[0_24px_60px_-20px_rgb(109_93_252/0.9)] ring-1 ring-white/15 sm:w-52"
                        />
                        <div className="min-w-0 flex-1">
                            <Link
                                href="/music?tab=playlists"
                                className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white"
                            >
                                <ArrowLeft className="size-3.5" /> Плейлисти
                            </Link>
                            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-white/50 uppercase">
                                {playlist.is_public ? (
                                    <Globe2 className="size-3.5" />
                                ) : (
                                    <Lock className="size-3.5" />
                                )}
                                {playlist.is_public
                                    ? 'Відкритий плейлист'
                                    : 'Приватний плейлист'}
                            </p>
                            <h1 className="mt-1 font-display text-3xl font-bold break-words text-white sm:text-4xl">
                                {playlist.title}
                            </h1>
                            {playlist.description && (
                                <p className="mt-2 max-w-xl text-sm whitespace-pre-line text-white/60">
                                    {playlist.description}
                                </p>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/55">
                                <Link
                                    href={`/${playlist.owner.username}`}
                                    className="inline-flex items-center gap-2 font-medium text-white/85 hover:text-white"
                                >
                                    <UserAvatar
                                        user={playlist.owner}
                                        size="xs"
                                        showOnline={false}
                                    />
                                    {playlist.owner.name}
                                </Link>
                                <span>·</span>
                                <span>
                                    {count}{' '}
                                    {plural(count, ['трек', 'треки', 'треків'])}
                                </span>
                                {playlist.duration > 0 && (
                                    <>
                                        <span>·</span>
                                        <span>
                                            {formatLength(playlist.duration)}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="relative mt-5 flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={tracks.length === 0}
                            onClick={() =>
                                fromHere ? toggle() : playQueue(tracks, 0)
                            }
                            className="btn-glow inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-semibold disabled:opacity-40"
                        >
                            {playing ? (
                                <Pause className="size-4 fill-current" />
                            ) : (
                                <Play className="size-4 fill-current" />
                            )}
                            {playing ? 'Пауза' : 'Слухати'}
                        </button>
                        <button
                            type="button"
                            disabled={tracks.length === 0}
                            onClick={() => playQueue(shuffled(tracks), 0)}
                            className="glass inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white/85 hover:text-white disabled:opacity-40"
                        >
                            <Shuffle className="size-4" /> Перемішати
                        </button>
                        {can.manage && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setEditing(true)}
                                    className="glass inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white/85 hover:text-white"
                                >
                                    <PenLine className="size-4" /> Редагувати
                                </button>
                                <button
                                    type="button"
                                    onClick={destroy}
                                    className="glass inline-flex size-11 items-center justify-center rounded-xl text-rose-300 hover:text-rose-200"
                                    aria-label="Видалити плейлист"
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </>
                        )}
                    </div>
                </section>

                {tracks.length === 0 ? (
                    <EmptyState
                        icon={ListMusic}
                        title="Плейлист порожній"
                        text={
                            can.manage
                                ? 'Додайте треки через меню «⋯ → До плейлиста» у своїх аудіозаписах.'
                                : 'Автор ще не додав сюди треків.'
                        }
                        action={
                            can.manage && (
                                <Link
                                    href="/music"
                                    className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold"
                                >
                                    До аудіозаписів
                                </Link>
                            )
                        }
                    />
                ) : (
                    <section className="glass rounded-3xl p-2 sm:p-3">
                        <TrackList
                            tracks={tracks}
                            userId={auth.user.id}
                            isAdmin={auth.user.is_admin}
                            onRemove={can.manage ? detach : undefined}
                            removeLabel="Прибрати з плейлиста"
                        />
                    </section>
                )}
            </div>

            <PlaylistDialog
                open={editing}
                onOpenChange={setEditing}
                playlist={playlist}
            />
        </>
    );
}
