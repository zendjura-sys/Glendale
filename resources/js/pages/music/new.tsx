import { Head, Link } from '@inertiajs/react';
import { AlbumTile, GenreTile, PlaylistTile } from '@/components/am/cards';
import { SongColumns, SongList } from '@/components/am/song-list';
import { SectionHeader, Shelf } from '@/components/am/ui';
import { PlaylistCover } from '@/components/music/playlist-card';
import { BackToGameCon } from '@/layouts/music-layout';
import { tr } from '@/lib/i18n';
import type {
    AlbumCard,
    GenreCard,
    LibraryPlaylist,
    LocalTrack,
} from '@/types';

type Data = {
    featured: LibraryPlaylist[];
    latest_songs: LocalTrack[];
    new_albums: AlbumCard[];
    chart_cards: LocalTrack[];
    moods: { category: string; playlists: LibraryPlaylist[] }[];
    genres: GenreCard[];
};

/** Назви настроїв і занять (категорії добірок редакції). */
export function moodLabel(category: string): string {
    return (
        {
            energy: tr('Енергія'),
            chill: tr('Релакс'),
            focus: tr('Фокус'),
            workout: tr('Тренування'),
            party: tr('Вечірка'),
            sleep: tr('Сон'),
            road: tr('У дорогу'),
            gaming: tr('Для гри'),
            sad: tr('Сум'),
            happy: tr('Гарний настрій'),
        }[category] ?? category
    );
}

/** Широкий банер добірки редакції з підписом над ним, як «Нове» в Apple Music. */
function Hero({ playlist }: { playlist: LibraryPlaylist }) {
    return (
        <Link
            href={playlist.href}
            className="block min-w-0 transition active:scale-[0.99]"
        >
            <p className="am-caption text-[var(--am-label2)]">
                {tr('Добірка редакції')}
            </p>
            <p className="am-title2 truncate font-normal">{playlist.title}</p>
            <p className="am-title2 mb-2 truncate font-normal text-[var(--am-label2)]">
                GameCon
            </p>
            <div className="relative overflow-hidden rounded-[12px]">
                <PlaylistCover
                    playlist={playlist}
                    className="am-art aspect-[16/10] w-full rounded-[12px]"
                />
                {playlist.description && (
                    <p className="am-footnote absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/60 to-transparent px-4 pt-10 pb-3 text-white">
                        {playlist.description}
                    </p>
                )}
            </div>
        </Link>
    );
}

export default function MusicNew({ data }: { data: Data }) {
    return (
        <>
            <Head title={tr('Нове')} />
            <BackToGameCon />
            <h1 className="am-large-title px-[var(--am-gutter)] pt-1 pb-2 lg:pt-4">
                {tr('Нове')}
            </h1>

            {data.featured.length > 0 && (
                <Shelf className="pt-2 [--am-tile:min(86vw,520px)]">
                    {data.featured.map((p) => (
                        <Hero key={p.id} playlist={p} />
                    ))}
                </Shelf>
            )}

            {data.latest_songs.length > 0 && (
                <>
                    <SectionHeader title={tr('Останні пісні')} />
                    <SongColumns tracks={data.latest_songs} />
                </>
            )}

            {data.new_albums.length > 0 && (
                <>
                    <SectionHeader title={tr('Нові релізи')} />
                    <Shelf>
                        {data.new_albums.map((a) => (
                            <AlbumTile key={a.href} album={a} />
                        ))}
                    </Shelf>
                </>
            )}

            {data.chart_cards.length > 0 && (
                <>
                    <SectionHeader
                        title={tr('Топ пісень за тиждень')}
                        href="/music/charts"
                        subtitle={tr('Що найбільше слухають у GameCon')}
                    />
                    <SongList
                        tracks={data.chart_cards.slice(0, 10)}
                        variant="chart"
                        className="lg:columns-2 lg:gap-10"
                    />
                </>
            )}

            {data.moods.map((mood) => (
                <div key={mood.category}>
                    <SectionHeader title={moodLabel(mood.category)} />
                    <Shelf>
                        {mood.playlists.map((p) => (
                            <PlaylistTile key={p.id} playlist={p} />
                        ))}
                    </Shelf>
                </div>
            ))}

            {data.genres.length > 0 && (
                <>
                    <SectionHeader title={tr('Перегляд за категоріями')} />
                    <div className="grid grid-cols-2 gap-3 px-[var(--am-gutter)] sm:grid-cols-3 lg:grid-cols-4">
                        {data.genres.map((g, i) => (
                            <GenreTile key={g.name} genre={g} index={i} />
                        ))}
                    </div>
                </>
            )}
        </>
    );
}
