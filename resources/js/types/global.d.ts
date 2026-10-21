import type { Auth, FirebaseConfig } from '@/types/auth';
import type { SharedBilling } from '@/types/billing';
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
                contacts: string;
                rights: string;
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
                analytics?: string | null;
                music_upload?: { max_mb: number; formats: string[] };
                /** Рік «Підсумків року», якщо зараз їхній сезон (грудень — січень). */
                wrapped?: number | null;
                social: {
                    discord: boolean;
                    google: FirebaseConfig | null;
                };
            };
            /** Оплата карткою (monobank): тарифи з адмінки, Google Pay. */
            billing: SharedBilling;
            nav: NavEntry[];
            modules: string[];
            plugins: Record<string, boolean>;
            /** Можливості інтерфейсу за режимом соцмережі: stories, live, playing. */
            features?: Record<string, boolean>;
            /** Сезонні прикраси (App\\Support\\Seasons): newyear, valentine, easter, independence, halloween. */
            season?: string | null;
            /** Показати вікно «Отримайте номер» (акаунт без внутрішнього номера). */
            phonePrompt?: boolean;
            /** Фірмовий фон з адмінки: картинки для ПК і телефона; default — типовий фон сайту. */
            siteBackground?: {
                desktop: string | null;
                mobile: string | null;
                default: boolean;
            } | null;
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
