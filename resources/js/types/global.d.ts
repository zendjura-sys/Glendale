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
            auth: Auth;
            site: {
                name: string;
                tagline: string | null;
                registration_open: boolean;
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
