import type { Auth } from '@/types/auth';
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
                announcement: string | null;
            };
            nav: NavEntry[];
            modules: string[];
            counters: {
                friend_requests: number;
                notifications: number;
                messages: number;
            } | null;
            [key: string]: unknown;
        };
    }
}
