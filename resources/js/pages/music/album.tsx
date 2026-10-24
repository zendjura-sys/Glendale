import { Head, Link } from '@inertiajs/react';
import { AlbumTile } from '@/components/am/cards';
import { SongList } from '@/components/am/song-list';
import {
    LargeTitle,
    PlayShuffle,
    QualityBadge,
    SectionHeader,
    Shelf,
} from '@/components/am/ui';
import { TrackCover } from '@/components/music/track-cover';
import { formatLength } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { playQueue, shuffled } from '@/lib/player';
import type { AlbumCard, LocalTrack } from '@/types';

type Album = {
    title: string;
    artist: string;
    artist_href: string;
    cover_url: string | null;
    year: number | null;
    genre: string | null;
    duration: number;
    quality: 'lossless' | 'hires' | null;
    tracks: LocalTrack[];
    more_by: AlbumCard[];
};

/** Сторінка альбому як в Apple Music: обкладинка по центру, назва, виконавець червоним, «Слухати / Перемішати». */
export default function MusicAlbum({ album }: { album: Album }) {
    return (
        <>
            <Head title={`${album.title} · ${album.artist}`} />
            <LargeTitle
                title=""
                back={{ href: '/music/library/albums', label: tr('Альбоми') }}
                className="pb-0"
            />
            <div className="px-[var(--am-gutter)] lg:flex lg:items-end lg:gap-8">
                <TrackCover
                    url={album.cover_url}
                    seed={`${album.artist}|${album.title}`}
                    className="am-art mx-auto aspect-square w-[min(70vw,300px)] rounded-[10px] shadow-[0_18px_40px_-16px_rgb(0_0_0/0.45)] lg:mx-0 lg:w-[270px]"
                />
                <div className="mt-4 text-center lg:mt-0 lg:text-left">
                    <h1 className="am-title2 lg:text-[30px] lg:leading-9">
                        {album.title}
                    </h1>
                    <Link
                        href={album.artist_href}
                        className="am-title2 font-normal text-[var(--am-accent)] hover:underline"
                    >
                        {album.artist}
                    </Link>
                    <p className="am-footnote mt-1 flex flex-wrap items-center justify-center gap-1.5 font-semibold text-[var(--am-label2)] lg:justify-start">
                        {[album.genre, album.year].filter(Boolean).join(' · ')}
                        <QualityBadge quality={album.quality} />
                    </p>
                    <div className="mt-4 lg:w-[420px]">
                        <PlayShuffle
                            onPlay={() => playQueue(album.tracks, 0)}
                            onShuffle={() =>
                                playQueue(shuffled(album.tracks), 0)
                            }
                        />
                    </div>
                </div>
            </div>

            <SongList
                tracks={album.tracks}
                variant="numbered"
                className="mt-5"
            />
            <p className="am-footnote px-[var(--am-gutter)] pt-3 text-[var(--am-label2)]">
                {tr('{n} пісень, {length}', {
                    n: album.tracks.length,
                    length: formatLength(album.duration),
                })}
            </p>

            {album.more_by.length > 0 && (
                <>
                    <SectionHeader
                        title={tr('Ще від: {artist}', { artist: album.artist })}
                        href={album.artist_href}
                    />
                    <Shelf>
                        {album.more_by.map((a) => (
                            <AlbumTile key={a.href} album={a} showYear />
                        ))}
                    </Shelf>
                </>
            )}
        </>
    );
}
