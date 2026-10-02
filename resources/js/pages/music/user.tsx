import {
    Deferred,
    Head,
    InfiniteScroll,
    Link,
    usePage,
} from '@inertiajs/react';
import { ArrowLeft, Headphones, Play, Shuffle } from 'lucide-react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { EmptyState } from '@/components/gc/widget';
import { NowPlayingCard } from '@/components/music/now-playing';
import {
    PlaylistTile,
    playlistGridClass,
} from '@/components/music/playlist-card';
import { TrackList } from '@/components/music/track-list';
import { plural } from '@/lib/format';
import { playQueue, shuffled } from '@/lib/player';
import type {
    NowPlaying,
    PlaylistCard,
    ScrollData,
    TrackCard,
    UserCard,
} from '@/types';

type Props = {
    owner: UserCard;
    tracks: ScrollData<TrackCard>;
    total: number;
    playlists: PlaylistCard[];
    nowPlaying?: NowPlaying | null;
};

export default function MusicUser({
    owner,
    tracks,
    total,
    playlists,
    nowPlaying,
}: Props) {
    const { auth } = usePage().props;

    return (
        <>
            <Head title={`Музика ${owner.name}`} />
            <div className="space-y-5">
                <section className="glass relative overflow-hidden rounded-3xl p-5 sm:p-6">
                    <div className="pointer-events-none absolute -top-28 -right-10 size-80 rounded-full bg-[#a855f7]/20 blur-3xl" />
                    <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 flex-1 items-center gap-4">
                            <Link
                                href={`/${owner.username}`}
                                className="shrink-0"
                            >
                                <UserAvatar user={owner} size="lg" />
                            </Link>
                            <div className="min-w-0 flex-1">
                                <Link
                                    href={`/${owner.username}`}
                                    className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-white/45 hover:text-white"
                                >
                                    <ArrowLeft className="size-3.5" /> До
                                    профілю
                                </Link>
                                <h1 className="mt-0.5 truncate font-display text-xl font-bold text-white sm:text-2xl">
                                    <span className="text-gradient">
                                        Музика
                                    </span>{' '}
                                    {owner.name}
                                </h1>
                                <p className="mt-0.5 truncate text-sm text-white/50">
                                    {total}{' '}
                                    {plural(total, ['трек', 'треки', 'треків'])}
                                    {playlists.length > 0 &&
                                        ` · ${playlists.length} ${plural(
                                            playlists.length,
                                            [
                                                'плейлист',
                                                'плейлисти',
                                                'плейлистів',
                                            ],
                                        )}`}
                                </p>
                            </div>
                        </div>
                        {tracks.data.length > 0 && (
                            <div className="flex gap-2 sm:shrink-0">
                                <button
                                    type="button"
                                    onClick={() => playQueue(tracks.data, 0)}
                                    className="btn-glow inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold sm:flex-none"
                                >
                                    <Play className="size-4 fill-current" />
                                    Слухати
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        playQueue(shuffled(tracks.data), 0)
                                    }
                                    className="glass inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-white/80 hover:text-white"
                                    aria-label="Перемішати"
                                >
                                    <Shuffle className="size-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                <Deferred data="nowPlaying" fallback={<span hidden />}>
                    {nowPlaying ? <NowPlayingCard track={nowPlaying} /> : null}
                </Deferred>

                {playlists.length > 0 && (
                    <section className="glass rounded-3xl p-4 sm:p-5">
                        <h2 className="mb-3 font-display text-[13px] font-semibold tracking-wide text-white/70 uppercase">
                            Плейлисти
                        </h2>
                        <div className={playlistGridClass}>
                            {playlists.map((playlist) => (
                                <PlaylistTile
                                    key={playlist.id}
                                    playlist={playlist}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {tracks.data.length === 0 ? (
                    <EmptyState
                        icon={Headphones}
                        title="Аудіозаписів поки немає"
                        text={`${owner.first_name} ще не додав(ла) жодного треку.`}
                    />
                ) : (
                    <section className="glass rounded-3xl p-2 sm:p-3">
                        <h2 className="p-2 font-display text-[13px] font-semibold tracking-wide text-white/70 uppercase">
                            Аудіозаписи
                        </h2>
                        <InfiniteScroll data="tracks" preserveUrl>
                            <TrackList
                                tracks={tracks.data}
                                userId={auth.user.id}
                                isAdmin={auth.user.is_admin}
                            />
                        </InfiniteScroll>
                    </section>
                )}
            </div>
        </>
    );
}
