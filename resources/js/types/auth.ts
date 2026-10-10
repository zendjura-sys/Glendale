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
    role: 'user' | 'moderator' | 'admin';
    is_admin: boolean;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    /** Ключі розділів нижньої панелі на телефоні (без «Меню»). */
    nav_tabs: string[];
    palette?: string;
    hide_spoilers?: boolean;
    /** Баланс рахунку, копійки (лише сайт). */
    balance?: number;
    /** GameCon+ активний до (ISO), null — немає. */
    plus_until?: string | null;
    profanity_mask?: string | null;
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
