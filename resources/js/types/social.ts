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
    /** manual | steam | discord */
    source?: string | null;
    /** З якого часу в цій грі. */
    since?: string | null;
};

export type UserCard = {
    id: number;
    username: string;
    name: string;
    first_name: string;
    avatar_url: string | null;
    is_online: boolean;
    /** Мережевий статус: online | idle | dnd | offline. */
    presence?: string | null;
    is_verified: boolean;
    /** Логотипи сім'ї, клану, сервера й гри біля ніка. */
    badges?: import('@/components/gc/affiliation-badges').AffiliationBadge[];
    /** Команда сайту: 'admin' | 'moderator'. */
    staff?: string | null;
    /** Назва й колір ролі команди, створеної адміністратором. */
    staff_title?: { name: string; color: string } | null;
    /** Власна роль-підпис підписника GameCon+. */
    title?: { name: string; color: string } | null;
    /** Персонаж-аватар (конструктор у налаштуваннях); у шоу говорить замість фото. */
    character?: Partial<import('@/lib/character').CharacterConfig> | null;
    /** Ролі-плашки (звичайні, святкові, нагородні, преміум) з Адмінка → Ролі. */
    roles?: UserRoleCard[];
    /** Вид позначки (верифікація 2.0): identity, creator, business, organization. */
    verified_kind?: string | null;
    /** Спеціальний акаунт (стрімер, бізнес…); null — особистий. */
    account_type?: string | null;
    status: string | null;
    /** Емодзі швидкого статусу («🎮»); null — немає. */
    status_emoji?: string | null;
    /** До якого часу діє статус (ISO); null — постійний. */
    status_until?: string | null;
    /** «Граю в…»: сервер GTA або гра (автоматично чи вручну). */
    playing?: PlayingInfo | null;
    /** GameCon+: null — без підписки. */
    plus?: PlusMark | null;
    /** Вдягнута косметика сезонного пропуску: null — нічого. */
    cosmetics?: Cosmetics | null;
    event_frame?: string | null;
    live?: boolean;
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
    can_thank?: boolean;
    thanked?: boolean;
    badge?: { title: string; color: string | null } | null;
    /** Приховано (токсичність або вручну) — показуємо згорнутим. */
    hidden?: { reason: string | null } | null;
    can_moderate?: boolean;
};

export type Visibility = 'public' | 'friends' | 'private';

/** #тег гри в тексті запису. */
export type GameTag = { tag: string; slug: string; name: string };

export type PostItem = {
    id: number;
    body: string | null;
    /** #Згадки ігор у тексті. */
    games?: GameTag[];
    spoiler?: boolean;
    sticker?: string | null;
    visibility: Visibility;
    is_pinned: boolean;
    comments_enabled: boolean;
    /** Повільний режим коментарів (гарячий запис). */
    slow_mode?: { seconds: number; until: string; auto: boolean } | null;
    likes_count: number;
    comments_count: number;
    views_count: number;
    created_at: string;
    edited_at?: string | null;
    author: UserCard;
    /** Сім'я автора (верифікована): значок «Лідер STARK» і сервер під ім'ям. */
    family?: {
        tag: string;
        name: string;
        href: string;
        rank: number;
        rank_title: string;
        server: string | null;
    } | null;
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
    subscribers_only?: boolean;
    locked?: boolean;
    poll?: {
        id: number;
        question: string;
        total: number;
        voted: number | null;
        anonymous?: boolean;
        options: {
            id: number;
            label: string;
            votes: number;
            voters?: {
                id: number;
                name: string;
                username: string;
                avatar_url: string | null;
            }[];
        }[];
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
    series?: {
        id: number;
        title: string;
        count: number;
        position: number;
    } | null;
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
        series?: boolean;
        slow_mode?: boolean;
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
/** Косметика сезонного пропуску на картці користувача (значення лише з сервера). */
export type Cosmetics = {
    frame: string[] | null;
    name: string[] | null;
    badge: { icon: string; color: string; name: string } | null;
};

export type PlusMark = {
    name: string[] | null;
    frame: string[] | null;
    /** Анімація ніку: flow — перелив, shine — відблиск. */
    fx?: 'flow' | 'shine' | 'neon' | 'rainbow' | null;
    /** Рух рамки аватара (GameCon+). */
    motion?: 'spin' | 'pulse' | 'glint' | null;
};

/** Роль-плашка користувача («old», «Big Sponsor»). */
export type UserRoleCard = {
    id: number;
    name: string;
    kind: string;
    color: string;
    icon: string | null;
    description: string | null;
};
