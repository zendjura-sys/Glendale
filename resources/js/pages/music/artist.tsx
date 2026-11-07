import { Head } from '@inertiajs/react';
import {
    Calendar,
    ChevronLeft,
    MapPin,
    Music2,
    Play,
    Plus,
    Radio,
    Shuffle,
    Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { AlbumTile, ArtistTile } from '@/components/am/cards';
import { SongColumns } from '@/components/am/song-list';
import {
    toggleLibrary,
    TrackMenu,
    useTrack,
} from '@/components/am/track-actions';
import { SectionHeader, Shelf } from '@/components/am/ui';
import { TrackCover } from '@/components/music/track-cover';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { playQueue, playStation, shuffled } from '@/lib/player';
import { cn } from '@/lib/utils';
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

type Info = {
    bio: string | null;
    bio_url: string | null;
    image_url: string | null;
    origin: string | null;
    born: string | null;
    formed: string | null;
    genres: string[];
    followers: number;
    spotify_url: string | null;
};

type Fact = { icon: typeof MapPin; label: string; value: string };

/** Дата з Wikidata: «1988-05-05» → «5 травня 1988 р.», «1988-00-00» → «1988». */
function formatFactDate(value: string | null): string | null {
    if (!value) return null;
    const [y, m, d] = value.split('-').map(Number);
    if (!y) return null;
    if (!m || !d) return String(y);

    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function useArtistInfo(name: string): Info | null | undefined {
    const [info, setInfo] = useState<Info | null | undefined>(undefined);

    useEffect(() => {
        let alive = true;
        setInfo(undefined);
        void api<{ info: Info }>(
            'GET',
            `/music/artist/info?name=${encodeURIComponent(name)}`,
        )
            .then((r) => alive && setInfo(r.info))
            .catch(() => alive && setInfo(null));

        return () => {
            alive = false;
        };
    }, [name]);

    return info;
}

/** «Останній реліз»: обкладинка, рік, назва, альбом і «+ Додати», як в Apple Music. */
function LatestRelease({ track: raw }: { track: LocalTrack }) {
    const track = useTrack(raw) as LocalTrack;

    return (
        <div className="flex items-center gap-4 px-[var(--am-gutter)] pt-5">
            <button
                type="button"
                onClick={() => playQueue([track], 0)}
                className="shrink-0 transition active:scale-[0.97]"
                aria-label={tr('Слухати')}
            >
                <TrackCover
                    url={track.cover_url}
                    seed={track.key}
                    className="am-art size-28"
                />
            </button>
            <div className="min-w-0 flex-1">
                <p className="am-caption font-semibold text-[var(--am-label2)]">
                    {track.year ?? tr('Останній реліз')}
                </p>
                <p className="am-headline truncate">{track.title}</p>
                <p className="am-subhead truncate text-[var(--am-label2)]">
                    {track.album ?? tr('Сингл')}
                </p>
                {!track.in_library && (
                    <button
                        type="button"
                        onClick={() => void toggleLibrary(track)}
                        className="am-subhead mt-2 inline-flex h-8 items-center gap-1 rounded-full bg-[var(--am-fill)] px-3.5 font-semibold text-[var(--am-accent)]"
                    >
                        <Plus className="size-4" strokeWidth={2.6} />
                        {tr('Додати')}
                    </button>
                )}
            </div>
            <TrackMenu track={track} />
        </div>
    );
}

/** «Про виконавця»: картка з описом (розгортається), місто, дата, жанри й слухачі. */
function About({
    artist,
    info,
}: {
    artist: Artist;
    info: Info | null | undefined;
}) {
    const [open, setOpen] = useState(false);
    const born = formatFactDate(info?.born ?? null);
    const formed = formatFactDate(info?.formed ?? null);
    const genres = info?.genres.length ? info.genres.join(', ') : artist.genre;
    const facts: Fact[] = [];
    if (info?.origin)
        facts.push({
            icon: MapPin,
            label: born ? tr('Місце народження') : tr('Звідки'),
            value: info.origin,
        });
    if (born)
        facts.push({
            icon: Calendar,
            label: tr('Дата народження'),
            value: born,
        });
    if (formed)
        facts.push({ icon: Calendar, label: tr('Засновано'), value: formed });
    if (genres) facts.push({ icon: Music2, label: tr('Жанр'), value: genres });
    if (info && info.followers > 0)
        facts.push({
            icon: Users,
            label: tr('Підписники у Spotify'),
            value: info.followers.toLocaleString(),
        });
    if (artist.listeners > 0)
        facts.push({
            icon: Users,
            label: tr('Слухачів у GameCon за місяць'),
            value: artist.listeners.toLocaleString(),
        });

    const title = (
        <h2 className="am-title2">
            {tr('Про виконавця {name}', { name: artist.name })}
        </h2>
    );

    if (info === undefined) {
        return (
            <div className="px-[var(--am-gutter)] pt-8">
                {title}
                <div className="mt-3 space-y-2 rounded-2xl bg-[var(--am-bg2)] p-4">
                    <span className="skeleton block h-3.5 w-full rounded" />
                    <span className="skeleton block h-3.5 w-11/12 rounded" />
                    <span className="skeleton block h-3.5 w-2/3 rounded" />
                </div>
            </div>
        );
    }

    if (!info?.bio && facts.length === 0) return null;

    return (
        <div className="px-[var(--am-gutter)] pt-8 lg:max-w-3xl">
            {title}
            {info?.bio && (
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    className="mt-3 block w-full rounded-2xl bg-[var(--am-bg2)] p-4 text-left transition active:scale-[0.99]"
                >
                    <p
                        className={cn(
                            'am-body text-[var(--am-label)]',
                            !open && 'line-clamp-4',
                        )}
                    >
                        {info.bio}
                    </p>
                    <span className="am-subhead mt-1 block font-semibold text-[var(--am-accent)]">
                        {open ? tr('Згорнути') : tr('Ще')}
                    </span>
                </button>
            )}
            {open && info?.bio_url && (
                <a
                    href={info.bio_url}
                    target="_blank"
                    rel="noreferrer"
                    className="am-footnote mt-2 inline-block text-[var(--am-label2)] underline"
                >
                    {tr('Джерело: Вікіпедія')}
                </a>
            )}
            {facts.length > 0 && (
                <dl className="mt-3 grid gap-x-6 sm:grid-cols-2">
                    {facts.map((fact) => (
                        <div
                            key={fact.label}
                            className="flex items-start gap-3 border-b border-[var(--am-sep)] py-3"
                        >
                            <fact.icon className="mt-0.5 size-5 shrink-0 text-[var(--am-label2)]" />
                            <div className="min-w-0">
                                <dt className="am-footnote text-[var(--am-label2)]">
                                    {fact.label}
                                </dt>
                                <dd className="am-body">{fact.value}</dd>
                            </div>
                        </div>
                    ))}
                </dl>
            )}
        </div>
    );
}

/**
 * Сторінка виконавця як в Apple Music: фото на всю ширину з ім’ям і червоною кнопкою, «Останній реліз»,
 * «Топ-пісні», альбоми, сингли, станція, схожі виконавці й «Про виконавця» (опис, місто, дати).
 */
export default function MusicArtist({ artist }: { artist: Artist }) {
    const info = useArtistInfo(artist.name);
    const hero = info?.image_url ?? artist.cover_url;
    const songs = artist.top_songs;

    return (
        <>
            <Head title={artist.name} />
            <div className="relative -mt-[env(safe-area-inset-top)] lg:mx-[var(--am-gutter)] lg:mt-2 lg:overflow-hidden lg:rounded-2xl">
                <TrackCover
                    url={hero}
                    seed={artist.name}
                    className="aspect-square max-h-[72dvh] w-full object-cover object-top sm:aspect-[16/9] lg:aspect-[21/9]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/25" />
                <button
                    type="button"
                    onClick={() => history.back()}
                    aria-label={tr('Назад')}
                    className="am-glass absolute top-[calc(env(safe-area-inset-top)+10px)] left-4 flex size-9 items-center justify-center rounded-full text-[var(--am-label)] lg:hidden"
                >
                    <ChevronLeft className="size-6" />
                </button>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 px-[var(--am-gutter)] pb-5">
                    <h1 className="min-w-0 text-[34px] leading-[1.05] font-bold tracking-tight text-white lg:text-[52px]">
                        {artist.name}
                    </h1>
                    <div className="flex shrink-0 items-center gap-2">
                        {songs.length > 1 && (
                            <button
                                type="button"
                                onClick={() => playQueue(shuffled(songs), 0)}
                                aria-label={tr('Перемішати')}
                                className="am-glass flex size-11 items-center justify-center rounded-full text-[var(--am-label)]"
                            >
                                <Shuffle className="size-5" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() =>
                                songs.length > 0
                                    ? playQueue(songs, 0)
                                    : void playStation(artist.station.key)
                            }
                            aria-label={tr('Слухати')}
                            className="flex size-12 items-center justify-center rounded-full bg-[var(--am-accent)] text-white shadow-lg transition active:scale-95"
                        >
                            <Play className="ml-0.5 size-6 fill-current" />
                        </button>
                    </div>
                </div>
            </div>

            {artist.latest && <LatestRelease track={artist.latest} />}

            {songs.length > 0 && (
                <>
                    <SectionHeader title={tr('Топ-пісні')} />
                    <SongColumns tracks={songs} />
                </>
            )}

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
                    <SectionHeader title={tr('Сингли та EP')} />
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

            <About artist={artist} info={info} />

            {artist.tracks_count > 0 && (
                <p className="am-footnote px-[var(--am-gutter)] pt-4 text-[var(--am-label2)]">
                    {tr('{n} пісень у GameCon', { n: artist.tracks_count })}
                </p>
            )}
        </>
    );
}
