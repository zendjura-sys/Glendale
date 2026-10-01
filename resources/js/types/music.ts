import type { UserCard } from './social';

export type TrackSource = 'local' | 'spotify';

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
    plays_count: number;
    user_id: number | null;
    in_library: boolean;
};

export type SpotifyTrack = BaseTrack & {
    source: 'spotify';
    id: string;
    uri: string;
    url: string;
    explicit?: boolean;
};

export type TrackCard = LocalTrack | SpotifyTrack;

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
