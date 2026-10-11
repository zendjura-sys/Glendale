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
    /** GameCon+: null — без підписки. */
    plus?: PlusMark | null;
    /** Лише в чаті сім’ї. */
    family_rank?: { rank: number; title: string | null; tag: string };
};

export type Relation = 'none' | 'friends' | 'outgoing' | 'incoming' | 'self';

export type FriendList = 'raid' | 'cinema' | 'work';

export type PersonCard = UserCard & {
    city?: string | null;
    relation?: Relation;
    mutual?: number;
    alias?: string | null;
    note?: string | null;
    list?: FriendList | null;
    markable?: boolean;
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
    spoiler?: boolean;
    sticker?: string | null;
    is_pinned?: boolean;
    can_pin?: boolean;
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
    spoiler?: boolean;
    sticker?: string | null;
    visibility: Visibility;
    is_pinned: boolean;
    comments_enabled: boolean;
    likes_count: number;
    comments_count: number;
    views_count: number;
    created_at: string;
    edited_at?: string | null;
    author: UserCard;
    badge?: { title: string; color: string | null } | null;
    tag?: { name: string; href: string } | null;
    pending?: boolean;
    lang?: string | null;
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
    link?: {
        url: string;
        title: string;
        thumbnail: string | null;
        author: string | null;
        site?: string;
    } | null;
    card?: {
        kind: string;
        id: number;
        title: string;
        hint: string;
        href: string;
        image: string | null;
    } | null;
    saved?: boolean;
    poll?: {
        id: number;
        question: string;
        total: number;
        voted: number | null;
        options: { id: number; label: string; votes: number }[];
    } | null;
    reaction?: string | null;
    liked: boolean;
    shared?: {
        name: string;
        username: string;
        href: string;
        post_href?: string;
        body: string;
        community?: { name: string; href: string } | null;
    } | null;
    quoted?: {
        id: number;
        name: string;
        username: string;
        href: string;
        body: string;
    } | null;
    muted?: boolean;
    comments: CommentItem[];
    can: {
        delete: boolean;
        edit?: boolean;
        pin: boolean;
        comment: boolean;
        hide?: boolean;
        mute?: boolean;
        share?: boolean;
        quote?: boolean;
    };
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

/** Оформлення GameCon+ у картці: готові кольори ніку й рамки (null — стандартні). */
export type PlusMark = {
    name: string[] | null;
    frame: string[] | null;
    /** Анімація ніку: flow — перелив, shine — відблиск. */
    fx?: 'flow' | 'shine' | null;
};
