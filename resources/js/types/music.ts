import type { UserCard } from './social';

export type TrackSource = 'local' | 'spotify' | 'radio';

type BaseTrack = {
    key: string;
    title: string;
    artist: string;
    album: string | null;
    duration: number;
    cover_url: string | null;
};

export type LocalTrack = BaseTrack & {
    source: 'local';
    id: number;
    url: string;
    genre: string | null;
    has_lyrics?: boolean;
    plays_count: number;
    user_id: number | null;
    in_library: boolean;
    /** Зірочка «Улюблене». */
    favorite?: boolean;
    year?: number | null;
    /** lossy, lossless (до 48 кГц) або hires (понад 48 кГц). */
    quality?: 'lossy' | 'lossless' | 'hires' | null;
    /** Формат файлу (ffprobe): кодек, частота, розрядність, бітрейт (кбіт/с), канали. */
    audio?: {
        codec: string;
        sample_rate: number | null;
        bit_depth: number | null;
        bitrate: number | null;
        channels: number | null;
    } | null;
};

export type SpotifyTrack = BaseTrack & {
    source: 'spotify';
    id: string;
    uri: string;
    url: string;
    explicit?: boolean;
};

/** Інтернет-радіостанція: грає тим самим плеєром, без тривалості й перемотки. */
export type RadioTrack = BaseTrack & {
    source: 'radio';
    id: number;
    url: string;
    genre: string | null;
    homepage: string | null;
    slug: string;
    live: true;
};

export type TrackCard = LocalTrack | SpotifyTrack | RadioTrack;

export type NowPlaying = TrackCard & {
    is_playing: boolean;
    via: 'gamecon' | 'spotify';
    progress?: number;
};

export type PlaylistCard = {
    id: number;
    title: string;
    description: string | null;
    cover_url: string | null;
    covers: string[];
    is_public: boolean;
    tracks_count: number;
    duration: number;
    user_id: number;
    updated_at: string;
};

export type PlaylistDetails = PlaylistCard & { owner: UserCard };

export type SpotifyAccountCard = {
    spotify_id: string;
    display_name: string | null;
    avatar_url: string | null;
    product: string | null;
    premium: boolean;
    show_now_playing: boolean;
    profile_url: string;
};

export type SpotifyPlaylist = {
    id: string;
    uri: string;
    name: string;
    description: string;
    cover_url: string | null;
    tracks_count: number;
    owner: string | null;
    url: string | null;
};

export type SharedMusic = {
    spotify: { connected: boolean; premium: boolean; configured: boolean };
} | null;

// ───────── Розділ «Музика» в стилі Apple Music (MusicCatalog) ─────────

export type MixCard = {
    kind: 'mix';
    key: 'favorites' | 'discovery' | 'new' | 'friends' | 'chill';
    colors: [string, string];
    covers: string[];
    href: string;
};

export type StationCard = {
    kind: 'station';
    /** me, genre:…, artist:…, track:… */
    key: string;
    name: string;
    colors: [string, string];
    covers: string[];
};

export type AlbumCard = {
    kind: 'album';
    title: string;
    artist: string;
    year: number | null;
    tracks_count: number;
    cover_url: string | null;
    href: string;
};

export type ArtistCard = {
    kind: 'artist';
    name: string;
    tracks_count: number;
    cover_url: string | null;
    href: string;
    plays?: number;
};

export type GenreCard = {
    name: string;
    tracks_count: number;
    cover_url: string | null;
    href: string;
};

export type LibraryPlaylist = PlaylistCard & {
    kind: 'playlist';
    href: string;
    is_featured?: boolean;
    category?: string | null;
};

export type RecentItem =
    | {
          kind: 'album';
          title: string;
          subtitle: string;
          cover_url: string | null;
          href: string;
      }
    | {
          kind: 'track';
          title: string;
          subtitle: string;
          cover_url: string | null;
          track: LocalTrack;
      }
    | {
          kind: 'playlist';
          title: string;
          subtitle: null;
          playlist: LibraryPlaylist;
          href: string;
      };

/** «Завантажити за посиланням»: файл завантажує сервер у фоні. */
export type TrackImportCard = {
    id: number;
    url: string;
    host: string;
    status: 'pending' | 'downloading' | 'processing' | 'done' | 'failed';
    error: string | null;
    progress: number | null;
    track: LocalTrack | null;
    created_at: string;
};
