import type { PlusMark } from './social';

export type User = {
    id: number;
    username: string;
    name: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url: string | null;
    cover_url: string | null;
    is_online: boolean;
    is_verified: boolean;
    plus?: PlusMark | null;
    status: string | null;
    status_emoji?: string | null;
    status_until?: string | null;
    role: 'user' | 'moderator' | 'admin';
    is_admin: boolean;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    /** Ключі розділів нижньої панелі на телефоні (без «Меню»). */
    nav_tabs: string[];
    palette?: string;
    /** Режим соцмережі (id), див. NetworkModes на сервері. */
    network_mode?: string;
    /** Стиль інтерфейсу: flat (основний), hero, material, flex. */
    skin?: string;
    theme?: 'system' | 'dark' | 'light';
    /** Фон сайту: сцена, чи рухається вона, і відео YouTube (лише з GameCon+). */
    background?: SiteBackgroundPrefs;
    /** Внутрішній номер GameCon (+555 випадковий / +777 куплений). */
    phone?: PhoneCard | null;
    hide_spoilers?: boolean;
    /** GameCon+ активний до (ISO), null — немає. */
    plus_until?: string | null;
    profanity_mask?: string | null;
    /** «Показувати, що я слухаю»: інші бачать, що грає (усі джерела). */
    show_listening?: boolean;
    morning_digest?: boolean;
    data_saver?: boolean;
    streamer_mode?: boolean;
    notify_sound?: 'off' | 'soft' | 'pixel' | 'arcade' | 'drop';
    created_at: string;
    updated_at: string;
    /** Сумісність зі стартовими компонентами Laravel. */
    avatar?: string;
};

export type Auth = {
    user: User;
};

export type FirebaseConfig = {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string | null;
};

export type SocialProvider = 'discord' | 'google';

export type SocialConnection = {
    provider: SocialProvider;
    label: string;
    connected: boolean;
    account: string | null;
    available: boolean;
};

export type Passkey = {
    id: number;
    name: string;
    authenticator: string | null;
    created_at_diff: string;
    last_used_at_diff: string | null;
};

export type TwoFactorSetupData = {
    svg: string;
    url: string;
};

export type TwoFactorSecretKey = {
    secretKey: string;
};

export type SiteBackgroundPreset =
    | 'custom'
    | 'dune'
    | 'aurora'
    | 'night'
    | 'ocean'
    | 'mesh'
    | 'none';

export type SiteBackgroundPrefs = {
    preset: SiteBackgroundPreset;
    motion: boolean;
    video: string | null;
};

export type PhoneTier =
    | 'regular'
    | 'bronze'
    | 'silver'
    | 'gold'
    | 'platinum'
    | 'diamond';

export type PhoneCard = {
    number: string;
    tier: PhoneTier;
    kind: 'random' | 'purchased';
};
