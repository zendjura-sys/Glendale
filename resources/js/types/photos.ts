import type { CommunityCard } from './community';
import type { CommentItem, UserCard } from './social';

export type AlbumPrivacy = 'public' | 'friends' | 'private';

export type PhotoThumb = {
    id: number;
    url: string;
    width: number | null;
    height: number | null;
    likes_count: number;
    comments_count: number;
    album_id?: number;
    alt?: string | null;
    is_sensitive?: boolean;
};

export type PhotoOwner = {
    type: 'user' | 'community';
    name: string;
    avatar_url: string | null;
    href: string;
    photos_href: string;
    user?: UserCard;
    community?: CommunityCard;
};

export type PhotoAlbumCard = {
    id: number;
    title: string;
    description: string | null;
    privacy: AlbumPrivacy;
    comments_enabled: boolean;
    photos_count: number;
    cover_url: string | null;
    updated_at: string;
};

export type PhotoAlbumDetails = PhotoAlbumCard & {
    owner: PhotoOwner;
    created_at?: string;
};

export type PhotoDetails = PhotoThumb & {
    caption: string | null;
    alt: string | null;
    is_sensitive: boolean;
    views_count: number;
    created_at: string;
    user: UserCard | null;
    liked: boolean;
    is_cover: boolean;
    position: number;
    album: PhotoAlbumDetails;
    prev_id: number | null;
    next_id: number | null;
    can: { edit: boolean; delete: boolean; cover: boolean; comment: boolean };
    tags: { id: number; username: string; name: string }[];
};

export type PhotoShowResponse = {
    photo: PhotoDetails;
    comments: CommentItem[];
};
