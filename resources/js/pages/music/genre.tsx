import { Head } from '@inertiajs/react';
import { Radio } from 'lucide-react';
import { AlbumTile } from '@/components/am/cards';
import { SongColumns } from '@/components/am/song-list';
import { LargeTitle, SectionHeader, Shelf } from '@/components/am/ui';
import { tr } from '@/lib/i18n';
import { playStation } from '@/lib/player';
import type { AlbumCard, LocalTrack, StationCard } from '@/types';

export default function MusicGenre({
    genre,
}: {
    genre: {
        name: string;
        popular: LocalTrack[];
        latest: LocalTrack[];
        albums: AlbumCard[];
        station: StationCard;
    };
}) {
    return (
        <>
            <Head title={genre.name} />
            <LargeTitle
                title={genre.name}
                back={{ href: '/music/search', label: tr('Пошук') }}
            />
            <div className="px-[var(--am-gutter)]">
                <button
                    type="button"
                    onClick={() => void playStation(genre.station.key)}
                    className="am-headline inline-flex h-10 items-center gap-2 rounded-full px-4 text-white"
                    style={{
                        background: `linear-gradient(145deg, ${genre.station.colors[0]}, ${genre.station.colors[1]})`,
                    }}
                >
                    <Radio className="size-5" /> {tr('Станція жанру')}
                </button>
            </div>
            {genre.popular.length > 0 && (
                <>
                    <SectionHeader title={tr('Популярне')} />
                    <SongColumns tracks={genre.popular} />
                </>
            )}
            {genre.latest.length > 0 && (
                <>
                    <SectionHeader title={tr('Новинки')} />
                    <SongColumns tracks={genre.latest} />
                </>
            )}
            {genre.albums.length > 0 && (
                <>
                    <SectionHeader title={tr('Альбоми')} />
                    <Shelf>
                        {genre.albums.map((a) => (
                            <AlbumTile key={a.href} album={a} />
                        ))}
                    </Shelf>
                </>
            )}
        </>
    );
}
