import { Link } from '@inertiajs/react';
import { Play, Radio } from 'lucide-react';
import { PlaylistCover } from '@/components/music/playlist-card';
import { tr } from '@/lib/i18n';
import { playStation } from '@/lib/player';
import { cn } from '@/lib/utils';
import type {
    AlbumCard,
    ArtistCard,
    GenreCard,
    LibraryPlaylist,
    MixCard,
    StationCard,
} from '@/types';
import { Artwork, MixArt, Tile } from './ui';

/** Назви й підписи міксів і станцій — тут, через tr(): сервер віддає лише ключі. */
export function mixTitle(key: MixCard['key']): {
    title: string;
    subtitle: string;
} {
    return {
        favorites: {
            title: tr('Мікс улюбленого'),
            subtitle: tr('Те, що ти слухаєш найчастіше'),
        },
        discovery: {
            title: tr('Мікс відкриттів'),
            subtitle: tr('Нове для тебе у твоїх жанрах'),
        },
        new: {
            title: tr('Мікс новинок'),
            subtitle: tr('Свіжі треки, що можуть сподобатись'),
        },
        friends: {
            title: tr('Мікс друзів'),
            subtitle: tr('Що слухають твої друзі'),
        },
        chill: {
            title: tr('Мікс для відпочинку'),
            subtitle: tr('Спокійна музика без поспіху'),
        },
    }[key];
}

export function stationTitle(station: StationCard): {
    title: string;
    subtitle: string;
} {
    if (station.key === 'me') {
        return {
            title: tr('Станція {name}', { name: station.name }),
            subtitle: tr('На основі того, що ти слухаєш'),
        };
    }
    if (station.key.startsWith('group:')) {
        return {
            title: tr('Станція «{name}»', { name: station.name }),
            subtitle: tr('Що слухають учасники групи'),
        };
    }
    if (station.key.startsWith('artist:')) {
        return {
            title: tr('Станція «{name}»', { name: station.name }),
            subtitle: tr('Виконавець і схожа музика'),
        };
    }

    return {
        title: tr('{name}: станція', { name: station.name }),
        subtitle: tr('Нескінченний потік жанру'),
    };
}

export function MixTile({ mix }: { mix: MixCard }) {
    const { title, subtitle } = mixTitle(mix.key);

    return (
        <Tile
            href={mix.href}
            art={
                <MixArt colors={mix.colors} covers={mix.covers} label={title} />
            }
            title={title}
            subtitle={subtitle}
        />
    );
}

export function StationTile({ station }: { station: StationCard }) {
    const { title, subtitle } = stationTitle(station);

    return (
        <Tile
            onClick={() => void playStation(station.key, title)}
            art={
                <div className="relative">
                    <MixArt
                        colors={station.colors}
                        covers={station.covers}
                        label={title}
                        icon={<Radio className="size-6" />}
                    />
                    <span className="absolute right-2.5 bottom-2.5 flex size-9 items-center justify-center rounded-full bg-black/35 text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
                        <Play className="ml-0.5 size-4 fill-current" />
                    </span>
                </div>
            }
            title={title}
            subtitle={subtitle}
        />
    );
}

export function AlbumTile({
    album,
    showYear,
}: {
    album: AlbumCard;
    showYear?: boolean;
}) {
    return (
        <Tile
            href={album.href}
            art={
                <Artwork
                    src={album.cover_url}
                    seed={`${album.artist}|${album.title}`}
                />
            }
            title={album.title}
            subtitle={
                showYear && album.year ? String(album.year) : album.artist
            }
        />
    );
}

export function ArtistTile({ artist }: { artist: ArtistCard }) {
    return (
        <Link href={artist.href} className="group block min-w-0 text-center">
            <Artwork
                src={artist.cover_url}
                seed={artist.name}
                round
                className="transition group-active:scale-[0.97]"
            />
            <p className="am-footnote mt-1.5 truncate font-medium">
                {artist.name}
            </p>
        </Link>
    );
}

export function PlaylistTile({ playlist }: { playlist: LibraryPlaylist }) {
    return (
        <Tile
            href={playlist.href}
            art={
                <PlaylistCover
                    playlist={playlist}
                    className="am-art w-full rounded-[8px]"
                />
            }
            title={playlist.title}
            subtitle={tr('{n} пісень', { n: playlist.tracks_count })}
        />
    );
}

/** Плитка жанру в «Пошуку» й «Новому»: синій прямокутник у кольорах проєкту із назвою й обкладинкою під кутом. */
const GENRE_COLORS = [
    '#2f7bff',
    '#1d6fe0',
    '#3d63ff',
    '#22a6e6',
    '#0e7fc0',
    '#4d6bff',
    '#1b4fd1',
    '#2b8cd8',
    '#3a58c9',
    '#167ab8',
];

export function GenreTile({
    genre,
    index,
}: {
    genre: GenreCard;
    index: number;
}) {
    return (
        <Link
            href={genre.href}
            className={cn(
                'relative block aspect-[16/10] overflow-hidden rounded-[10px] p-3 transition active:scale-[0.98]',
            )}
            style={{ background: GENRE_COLORS[index % GENRE_COLORS.length] }}
        >
            <span className="relative z-10 block max-w-[70%] text-[17px] leading-tight font-bold text-white">
                {genre.name}
            </span>
            {genre.cover_url && (
                <img
                    src={genre.cover_url}
                    alt=""
                    loading="lazy"
                    className="absolute -right-3 -bottom-3 size-[55%] rotate-[22deg] rounded-md object-cover shadow-lg"
                />
            )}
        </Link>
    );
}
