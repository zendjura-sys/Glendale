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
    status: string | null;
    role: 'user' | 'moderator' | 'admin';
    is_admin: boolean;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    created_at: string;
    updated_at: string;
    /** Сумісність зі стартовими компонентами Laravel. */
    avatar?: string;
};

export type Auth = {
    user: User;
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
