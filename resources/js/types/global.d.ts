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
                child_safety: string;
                rights: string;
            };
            auth: Auth;
            site: {
                name: string;
                tagline: string | null;
                description: string;
                /** Магазини застосунку з посиланнями (Адмінка → Дизайн). */
                app_links: Partial<
                    Record<
                        | 'google_play'
                        | 'app_store'
                        | 'app_gallery'
                        | 'galaxy_store'
                        | 'amazon'
                        | 'xiaomi'
                        | 'microsoft_store'
                        | 'apk'
                        | 'windows'
                        | 'macos'
                        | 'linux',
                        string
                    >
                >;
                play_store: {
                    url: string;
                    badge: 'get' | 'preregister';
                } | null;
                registration_open: boolean;
                auth_images?: {
                    site_desktop?: string | null;
                    site_mobile?: string | null;
                };
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
            /** Серія днів поспіль, спогади «цього дня», рамка свята. */
            engagement?: {
                streak: {
                    days: number;
                    best: number;
                    milestone: number | null;
                } | null;
                memories: number;
                frame: { season: string; on: boolean } | null;
                widgets: string[];
            } | null;
            /** Режим «очима людини» (адміністратор переглядає сайт як ця людина). */
            viewAs?: { name: string; username: string } | null;
            /** Розділи адмінки, доручені модератору. */
            staffSections?: string[] | null;
            airAlerts?: boolean;
            /** Активний збій зі сторінки статусу (null — усе працює). */
            incident?: {
                id: number;
                title: string;
                severity: 'minor' | 'major';
                status: string;
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
