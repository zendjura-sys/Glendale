import type { UserCard } from './social';

export type MovieType =
    | 'movie'
    | 'serial'
    | 'anime'
    | 'cartoon'
    | 'documentary';

export type MovieStatus = 'planned' | 'watching' | 'watched' | 'dropped';

export type MovieCard = {
    id: number;
    progress?: { season: number | null; episode: number } | null;
    slug: string;
    href: string;
    type: MovieType;
    type_label: string;
    title: string;
    title_original: string | null;
    year: number | null;
    poster: string | null;
    backdrop: string | null;
    genres: string[];
    rating: number | null;
    age_rating: string | null;
    episodes_count: number | null;
};

export type MovieFeatured = MovieCard & {
    description: string | null;
    duration: number | null;
};

export type MovieDetail = MovieCard & {
    description: string | null;
    countries: string[];
    duration: number | null;
    ratings: Partial<Record<'imdb' | 'shikimori' | 'tmdb', number>>;
    tagline: string | null;
    trailer_url: string | null;
    user_rating: number | null;
    ratings_count: number;
    watchers_count: number;
    views_count: number;
    comments_count: number;
    comments_enabled: boolean;
    is_published: boolean;
    imdb_id: string | null;
    shikimori_id: string | null;
    tmdb_id: string | null;
};

export type MoviePlayer = {
    key: string;
    id: number | null;
    provider: 'kodik' | 'flixcdn' | 'custom';
    provider_label: string;
    translation: string | null;
    translation_type: string | null;
    quality: string | null;
    link: string;
};

export type MovieState = {
    status: MovieStatus | null;
    rating: number | null;
    season: number | null;
    episode: number | null;
};

export type MovieOption<K extends string = string> = { key: K; label: string };

export type MovieFriend = UserCard & {
    movie_status: MovieStatus;
    movie_rating: number | null;
};

export type PostMovie = MovieCard & {
    description: string | null;
    available: boolean;
};
