import type { PostMovie } from './cinema';
import type { TrackCard } from './music';

export type PlayingInfo = {
    kind: 'server' | 'game';
    id: number | null;
    label: string;
    icon: string | null;
    url: string | null;
    note: string | null;
    until: string;
    auto: boolean;
};

export type UserCard = {
    id: number;
    username: string;
    name: string;
    first_name: string;
    avatar_url: string | null;
    is_online: boolean;
    is_verified: boolean;
    status: string | null;
    /** «Граю в…»: сервер GTA або гра (автоматично чи вручну). */
    playing?: PlayingInfo | null;
    /** Лише в чаті сім’ї. */
    family_rank?: { rank: number; title: string | null; tag: string };
};

export type Relation = 'none' | 'friends' | 'outgoing' | 'incoming' | 'self';

export type PersonCard = UserCard & {
    city?: string | null;
    relation?: Relation;
    mutual?: number;
};

export type Attachment = {
    id: number;
    type: 'image' | 'video';
    url: string;
    width: number | null;
    height: number | null;
};

export type CommentItem = {
    id: number;
    body: string;
    parent_id: number | null;
    likes_count: number;
    liked: boolean;
    created_at: string;
    user: UserCard;
    can_delete: boolean;
};

export type Visibility = 'public' | 'friends' | 'private';

export type PostItem = {
    id: number;
    body: string | null;
    visibility: Visibility;
    is_pinned: boolean;
    comments_enabled: boolean;
    likes_count: number;
    comments_count: number;
    views_count: number;
    created_at: string;
    author: UserCard;
    publisher: {
        id: number;
        name: string;
        slug: string;
        href: string;
        avatar_url: string | null;
        is_verified: boolean;
    } | null;
    wall: { name: string; href: string } | null;
    attachments: Attachment[];
    music: TrackCard | null;
    movie: PostMovie | null;
    liked: boolean;
    comments: CommentItem[];
    can: { delete: boolean; pin: boolean; comment: boolean };
};

export type NavEntry = {
    key: string;
    label: string;
    icon: string;
    href: string;
};

export type ScrollData<T> = {
    data: T[];
};

export type NotificationItem = {
    id: string;
    kind: string;
    text: string;
    excerpt: string | null;
    url: string | null;
    actor: UserCard | null;
    read: boolean;
    created_at: string;
};

export type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
};

export type GameCard = {
    id: number;
    slug: string;
    name: string;
    category: 'pc' | 'mobile' | 'console';
    category_label: string;
    platforms: { key: string; label: string }[];
    genres: string[];
    cover: string | null;
    year: number | null;
};

export type ClanCard = {
    id: number;
    slug: string;
    type: 'clan' | 'guild';
    type_label: string;
    name: string;
    display_name: string;
    tag: string;
    logo_url: string | null;
    members_count: number;
    is_recruiting: boolean;
    join_mode: 'open' | 'request' | 'closed';
    game: GameCard | null;
    pending?: boolean;
};
