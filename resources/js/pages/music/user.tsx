import { Deferred, Head, InfiniteScroll, Link } from '@inertiajs/react';
import { Headphones } from 'lucide-react';
import { SongList } from '@/components/am/song-list';
import {
    EmptyNote,
    LargeTitle,
    PlayShuffle,
    SectionHeader,
    Shelf,
    Tile,
} from '@/components/am/ui';
import { UserAvatar } from '@/components/gc/user-avatar';
import { NowPlayingCard } from '@/components/music/now-playing';
import { PlaylistCover } from '@/components/music/playlist-card';
import { tr } from '@/lib/i18n';
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

/** Музика іншої людини (з профілю): що грає зараз, її плейлисти й пісні — у стилі розділу. */
export default function MusicUser({
    owner,
    tracks,
    total,
    playlists,
    nowPlaying,
}: Props) {
    return (
        <>
            <Head title={tr('Музика {name}', { name: owner.name })} />
            <LargeTitle
                title=""
                className="pb-0"
                back={{
                    href: `/${owner.username}`,
                    label: owner.first_name || owner.name,
                }}
            />
            <div className="flex items-center gap-4 px-[var(--am-gutter)]">
                <Link href={`/${owner.username}`} className="shrink-0">
                    <UserAvatar user={owner} size="xl" showOnline={false} />
                </Link>
                <div className="min-w-0">
                    <h1 className="am-title2 truncate lg:text-[30px] lg:leading-9">
                        {owner.name}
                    </h1>
                    <p className="am-subhead text-[var(--am-label2)]">
                        {tr('{n} пісень у медіатеці', { n: total })}
                    </p>
                </div>
            </div>

            <Deferred data="nowPlaying" fallback={null}>
                {nowPlaying ? (
                    <div className="px-[var(--am-gutter)] pt-5 lg:max-w-xl">
                        <NowPlayingCard track={nowPlaying} />
                    </div>
                ) : (
                    <></>
                )}
            </Deferred>

            {playlists.length > 0 && (
                <>
                    <SectionHeader title={tr('Плейлисти')} />
                    <Shelf>
                        {playlists.map((p) => (
                            <Tile
                                key={p.id}
                                href={`/music/playlists/${p.id}`}
                                art={
                                    <PlaylistCover
                                        playlist={p}
                                        className="am-art w-full rounded-[8px]"
                                    />
                                }
                                title={p.title}
                                subtitle={tr('{n} пісень', {
                                    n: p.tracks_count,
                                })}
                            />
                        ))}
                    </Shelf>
                </>
            )}

            <SectionHeader title={tr('Пісні')} />
            {tracks.data.length === 0 ? (
                <EmptyNote
                    icon={<Headphones className="size-12" />}
                    title={tr('Тут поки тихо')}
                    text={tr('{name} ще не додав(-ла) пісень.', {
                        name: owner.first_name || owner.name,
                    })}
                />
            ) : (
                <>
                    <div className="px-[var(--am-gutter)] pb-3">
                        <PlayShuffle
                            onPlay={() => playQueue(tracks.data, 0)}
                            onShuffle={() =>
                                playQueue(shuffled(tracks.data), 0)
                            }
                        />
                    </div>
                    <InfiniteScroll data="tracks" preserveUrl>
                        <SongList
                            tracks={tracks.data}
                            extra={(t) => t.album ?? undefined}
                        />
                    </InfiniteScroll>
                </>
            )}
        </>
    );
}
