import type { Auth, FirebaseConfig } from '@/types/auth';
import type { SharedMusic } from '@/types/music';
import type { NavEntry } from '@/types/social';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            locale: string;
            locales: { code: string; native: string }[];
            /** Підписи футера мовою інтерфейсу (lang/{locale}/ui.php). */
            footer: {
                year: number;
                terms: string;
                privacy: string;
                refund: string;
                pricing: string;
                rights: string;
                paddle: string;
            };
            auth: Auth;
            site: {
                name: string;
                tagline: string | null;
                description: string;
                play_store: {
                    url: string;
                    badge: 'get' | 'preregister';
                } | null;
                registration_open: boolean;
                translate: boolean;
                max_attachments: number;
                max_message_file_mb: number;
                announcement: string | null;
                social: {
                    discord: boolean;
                    google: FirebaseConfig | null;
                };
            };
            nav: NavEntry[];
            modules: string[];
            plugins: Record<string, boolean>;
            music: SharedMusic;
            counters: {
                friend_requests: number;
                notifications: number;
                messages: number;
            } | null;
            [key: string]: unknown;
        };
    }
}
