import { Head } from '@inertiajs/react';
import { ChevronLeft, Play, Radio } from 'lucide-react';
import { AlbumTile, ArtistTile } from '@/components/am/cards';
import { SongColumns } from '@/components/am/song-list';
import { SectionHeader, Shelf } from '@/components/am/ui';
import { TrackCover } from '@/components/music/track-cover';
import { tr } from '@/lib/i18n';
import { playQueue, playStation } from '@/lib/player';
import type { AlbumCard, ArtistCard, LocalTrack, StationCard } from '@/types';

type Artist = {
    name: string;
    cover_url: string | null;
    genre: string | null;
    tracks_count: number;
    listeners: number;
    top_songs: LocalTrack[];
    albums: AlbumCard[];
    singles: LocalTrack[];
    latest: LocalTrack | null;
    similar: ArtistCard[];
    station: StationCard;
};

/** Сторінка виконавця як в Apple Music: велике фото з ім’ям, червона кнопка, топ-пісні, альбоми, схожі. */
export default function MusicArtist({ artist }: { artist: Artist }) {
    return (
        <>
            <Head title={artist.name} />
            <div className="relative -mt-[env(safe-area-inset-top)] lg:mx-[var(--am-gutter)] lg:mt-2 lg:overflow-hidden lg:rounded-2xl">
                <TrackCover
                    url={artist.cover_url}
                    seed={artist.name}
                    className="aspect-square max-h-[70dvh] w-full object-cover sm:aspect-[16/9] lg:aspect-[21/9]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                <button
                    type="button"
                    onClick={() => history.back()}
                    aria-label={tr('Назад')}
                    className="am-glass absolute top-[calc(env(safe-area-inset-top)+10px)] left-4 flex size-9 items-center justify-center rounded-full text-[var(--am-label)] lg:hidden"
                >
                    <ChevronLeft className="size-6" />
                </button>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 px-[var(--am-gutter)] pb-5">
                    <div className="min-w-0 text-white">
                        {artist.genre && (
                            <p className="am-subhead text-white/80">
                                {artist.genre}
                            </p>
                        )}
                        <h1 className="text-[34px] leading-[1.05] font-bold tracking-tight lg:text-[52px]">
                            {artist.name}
                        </h1>
                    </div>
                    <button
                        type="button"
                        onClick={() => playQueue(artist.top_songs, 0)}
                        aria-label={tr('Слухати')}
                        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--am-accent)] text-white shadow-lg transition active:scale-95"
                    >
                        <Play className="ml-0.5 size-6 fill-current" />
                    </button>
                </div>
            </div>

            {artist.latest && (
                <div className="flex items-center gap-4 px-[var(--am-gutter)] pt-5">
                    <TrackCover
                        url={artist.latest.cover_url}
                        seed={artist.latest.key}
                        className="am-art size-24 shrink-0"
                    />
                    <div className="min-w-0">
                        <p className="am-caption text-[var(--am-label2)]">
                            {tr('Останній реліз')}
                        </p>
                        <p className="am-headline truncate">
                            {artist.latest.title}
                        </p>
                        {artist.latest.album && (
                            <p className="am-subhead truncate text-[var(--am-label2)]">
                                {artist.latest.album}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={() => playQueue([artist.latest!], 0)}
                            className="am-subhead mt-1.5 inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--am-fill)] px-3.5 font-semibold text-[var(--am-accent)]"
                        >
                            <Play className="size-3.5 fill-current" />{' '}
                            {tr('Слухати')}
                        </button>
                    </div>
                </div>
            )}

            <SectionHeader title={tr('Топ-пісні')} />
            <SongColumns tracks={artist.top_songs} />

            {artist.albums.length > 0 && (
                <>
                    <SectionHeader title={tr('Альбоми')} />
                    <Shelf>
                        {artist.albums.map((a) => (
                            <AlbumTile key={a.href} album={a} showYear />
                        ))}
                    </Shelf>
                </>
            )}

            {artist.singles.length > 0 && (
                <>
                    <SectionHeader title={tr('Сингли')} />
                    <Shelf>
                        {artist.singles.map((t, i) => (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => playQueue(artist.singles, i)}
                                className="group block min-w-0 text-left"
                            >
                                <TrackCover
                                    url={t.cover_url}
                                    seed={t.key}
                                    className="am-art aspect-square w-full"
                                />
                                <p className="am-footnote mt-1.5 truncate font-medium">
                                    {t.title}
                                </p>
                                {t.year && (
                                    <p className="am-footnote text-[var(--am-label2)]">
                                        {t.year}
                                    </p>
                                )}
                            </button>
                        ))}
                    </Shelf>
                </>
            )}

            <div className="px-[var(--am-gutter)] pt-6">
                <button
                    type="button"
                    onClick={() => void playStation(artist.station.key)}
                    className="flex w-full items-center gap-3 rounded-xl bg-[var(--am-bg2)] p-3 text-left sm:max-w-md"
                >
                    <span
                        className="flex size-12 items-center justify-center rounded-lg text-white"
                        style={{
                            background: `linear-gradient(145deg, ${artist.station.colors[0]}, ${artist.station.colors[1]})`,
                        }}
                    >
                        <Radio className="size-6" />
                    </span>
                    <span>
                        <span className="am-headline block">
                            {tr('Станція «{name}»', { name: artist.name })}
                        </span>
                        <span className="am-subhead block text-[var(--am-label2)]">
                            {tr('Виконавець і схожа музика')}
                        </span>
                    </span>
                </button>
            </div>

            {artist.similar.length > 0 && (
                <>
                    <SectionHeader title={tr('Схожі виконавці')} />
                    <Shelf className="[--am-tile:min(30vw,150px)]">
                        {artist.similar.map((a) => (
                            <ArtistTile key={a.name} artist={a} />
                        ))}
                    </Shelf>
                </>
            )}

            <div className="px-[var(--am-gutter)] pt-8">
                <h2 className="am-title2">{tr('Про виконавця')}</h2>
                <p className="am-subhead mt-1 text-[var(--am-label2)]">
                    {tr('{n} пісень у GameCon', { n: artist.tracks_count })}
                    {artist.listeners > 0 &&
                        ` · ${tr('{n} слухачів за місяць', { n: artist.listeners })}`}
                </p>
            </div>
        </>
    );
}
