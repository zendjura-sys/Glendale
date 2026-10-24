import { Head, router } from '@inertiajs/react';
import { Search as SearchIcon, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    AlbumTile,
    ArtistTile,
    GenreTile,
    PlaylistTile,
} from '@/components/am/cards';
import { SongList } from '@/components/am/song-list';
import { SectionHeader, Segmented, Shelf } from '@/components/am/ui';
import { TrackCover } from '@/components/music/track-cover';
import { BackToGameCon } from '@/layouts/music-layout';
import { tr } from '@/lib/i18n';
import { playQueue } from '@/lib/player';
import type {
    AlbumCard,
    ArtistCard,
    GenreCard,
    LibraryPlaylist,
    LocalTrack,
    RadioTrack,
} from '@/types';

type Results = {
    tracks: LocalTrack[];
    lyrics: (LocalTrack & { lyric: string })[];
    artists: ArtistCard[];
    albums: AlbumCard[];
    playlists: LibraryPlaylist[];
    stations: RadioTrack[];
};

/** Пошук як в Apple Music: каталог або «Ваша медіатека», знаходить і за рядком із тексту пісні. */
export default function MusicSearch({
    q,
    scope,
    results,
    categories,
}: {
    q: string;
    scope: 'all' | 'library';
    results: Results | null;
    categories: GenreCard[];
}) {
    const [query, setQuery] = useState(q);
    const [focused, setFocused] = useState(false);
    const first = useRef(true);

    useEffect(() => {
        if (first.current) {
            first.current = false;

            return;
        }
        const id = setTimeout(
            () =>
                router.get(
                    '/music/search',
                    { q: query || undefined, scope },
                    { preserveState: true, replace: true },
                ),
            300,
        );

        return () => clearTimeout(id);
    }, [query, scope]);

    const empty =
        results &&
        !results.tracks.length &&
        !results.lyrics.length &&
        !results.artists.length &&
        !results.albums.length &&
        !results.playlists.length &&
        !results.stations.length;

    return (
        <>
            <Head title={tr('Пошук')} />
            <BackToGameCon />
            <h1 className="am-large-title px-[var(--am-gutter)] pt-1 pb-2 lg:pt-4">
                {tr('Пошук')}
            </h1>

            <div className="sticky top-0 z-20 bg-[var(--am-bg)]/90 px-[var(--am-gutter)] pt-1 pb-3 backdrop-blur-xl lg:top-14">
                <div className="flex items-center gap-3">
                    <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[10px] bg-[var(--am-fill)] px-2.5">
                        <SearchIcon className="size-4 text-[var(--am-label2)]" />
                        <input
                            autoFocus={!q}
                            value={query}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={tr('Виконавці, пісні, тексти та інше')}
                            className="am-body min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--am-label2)]"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery('')}
                                aria-label={tr('Очистити')}
                                className="flex size-5 items-center justify-center rounded-full bg-[var(--am-label3)] text-[var(--am-bg)]"
                            >
                                <X className="size-3" strokeWidth={3} />
                            </button>
                        )}
                    </label>
                    {(focused || query) && (
                        <button
                            type="button"
                            onClick={() => setQuery('')}
                            className="am-body shrink-0 text-[var(--am-accent)] lg:hidden"
                        >
                            {tr('Скасувати')}
                        </button>
                    )}
                </div>
                {query && (
                    <Segmented
                        className="mt-3"
                        value={scope}
                        onChange={(value) =>
                            router.get(
                                '/music/search',
                                { q: query, scope: value },
                                { preserveState: true, replace: true },
                            )
                        }
                        options={[
                            { value: 'all', label: tr('Каталог GameCon') },
                            { value: 'library', label: tr('Ваша медіатека') },
                        ]}
                    />
                )}
            </div>

            {!results && (
                <>
                    <h2 className="am-title2 px-[var(--am-gutter)] pt-2 pb-3">
                        {tr('Перегляд за категоріями')}
                    </h2>
                    <div className="grid grid-cols-2 gap-3 px-[var(--am-gutter)] sm:grid-cols-3 lg:grid-cols-4">
                        {categories.map((g, i) => (
                            <GenreTile key={g.name} genre={g} index={i} />
                        ))}
                    </div>
                </>
            )}

            {empty && (
                <p className="am-body px-[var(--am-gutter)] pt-10 text-center text-[var(--am-label2)]">
                    {tr('Нічого не знайдено за запитом «{q}».', { q })}
                </p>
            )}

            {results && results.artists.length > 0 && (
                <>
                    <SectionHeader title={tr('Виконавці')} />
                    <Shelf className="[--am-tile:min(30vw,140px)]">
                        {results.artists.map((a) => (
                            <ArtistTile key={a.name} artist={a} />
                        ))}
                    </Shelf>
                </>
            )}
            {results && results.tracks.length > 0 && (
                <>
                    <SectionHeader title={tr('Пісні')} />
                    <SongList
                        tracks={results.tracks}
                        extra={(t) => t.album ?? undefined}
                    />
                </>
            )}
            {results && results.lyrics.length > 0 && (
                <>
                    <SectionHeader title={tr('Збіг у тексті пісні')} />
                    <ul className="px-[var(--am-gutter)]">
                        {results.lyrics.map((t, i) => (
                            <li key={t.key}>
                                <button
                                    type="button"
                                    onClick={() => playQueue(results.lyrics, i)}
                                    className="flex w-full items-center gap-3 py-1.5 text-left"
                                >
                                    <TrackCover
                                        url={t.cover_url}
                                        seed={t.key}
                                        className="am-art size-12 shrink-0 rounded-[5px]"
                                    />
                                    <span className="min-w-0 flex-1 border-b border-[var(--am-sep)] py-1">
                                        <span className="am-body block truncate">
                                            {t.title}
                                        </span>
                                        <span className="am-subhead block truncate text-[var(--am-label2)]">
                                            «…{t.lyric}…»
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {results && results.albums.length > 0 && (
                <>
                    <SectionHeader title={tr('Альбоми')} />
                    <Shelf>
                        {results.albums.map((a) => (
                            <AlbumTile key={a.href} album={a} />
                        ))}
                    </Shelf>
                </>
            )}
            {results && results.playlists.length > 0 && (
                <>
                    <SectionHeader title={tr('Плейлисти')} />
                    <Shelf>
                        {results.playlists.map((p) => (
                            <PlaylistTile key={p.id} playlist={p} />
                        ))}
                    </Shelf>
                </>
            )}
            {results && results.stations.length > 0 && (
                <>
                    <SectionHeader title={tr('Радіостанції')} />
                    <SongList tracks={results.stations} />
                </>
            )}
        </>
    );
}
