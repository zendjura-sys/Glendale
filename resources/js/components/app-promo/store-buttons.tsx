import { Download } from 'lucide-react';
import type { ReactNode } from 'react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type StoreKey =
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
    | 'linux';

/** Магазини для телефона й комп'ютера та пряме завантаження — у такому порядку на сторінці. */
export const MOBILE_STORES: StoreKey[] = [
    'google_play',
    'app_store',
    'app_gallery',
    'galaxy_store',
    'amazon',
    'xiaomi',
    'apk',
];
export const DESKTOP_STORES: StoreKey[] = [
    'microsoft_store',
    'windows',
    'macos',
    'linux',
];

/** Значок Google Play: чотирикольоровий трикутник. */
function PlayMark() {
    return (
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
            <path
                d="M3.6 2.3 13.4 12 3.6 21.7c-.4-.2-.6-.6-.6-1.1V3.4c0-.5.2-.9.6-1.1Z"
                fill="#00d7fe"
            />
            <path
                d="m16.7 8.7-3.3 3.3-9.8-9.7c.3-.2.8-.2 1.2 0l11.9 6.4Z"
                fill="#00f076"
            />
            <path
                d="m16.7 15.3-11.9 6.4c-.4.2-.9.2-1.2 0l9.8-9.7 3.3 3.3Z"
                fill="#ff3a44"
            />
            <path
                d="m20.4 12.8-3.7 2.5-3.3-3.3 3.3-3.3 3.7 2.5c.8.5.8 1.1 0 1.6Z"
                fill="#ffd400"
            />
        </svg>
    );
}

/** Значок Apple. */
function AppleMark() {
    return (
        <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="currentColor"
            aria-hidden
        >
            <path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.2 1-4 2.5-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.6-1-2.6-4ZM14 5.6c.7-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.5 2.8-1.3Z" />
        </svg>
    );
}

/** Значок AppGallery: червоний квадрат. */
function GalleryMark() {
    return (
        <span
            className="grid size-5 place-items-center rounded-[7px] bg-[#e5133a] text-[10px] font-black text-white"
            aria-hidden
        >
            AG
        </span>
    );
}

/** Значок Galaxy Store. */
function GalaxyMark() {
    return (
        <span
            className="grid size-5 place-items-center rounded-[7px] bg-white/90 text-[10px] font-black text-[#1428a0]"
            aria-hidden
        >
            GS
        </span>
    );
}

/** Значок Microsoft / Windows: чотири квадрати. */
function WindowsMark({ brand = false }: { brand?: boolean }) {
    const c = brand
        ? ['#f25022', '#7fba00', '#00a4ef', '#ffb900']
        : ['#38bdf8', '#38bdf8', '#38bdf8', '#38bdf8'];

    return (
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
            <rect x="2" y="2" width="9.5" height="9.5" fill={c[0]} />
            <rect x="12.5" y="2" width="9.5" height="9.5" fill={c[1]} />
            <rect x="2" y="12.5" width="9.5" height="9.5" fill={c[2]} />
            <rect x="12.5" y="12.5" width="9.5" height="9.5" fill={c[3]} />
        </svg>
    );
}

/** Значок у квадраті з літерами (Amazon, Xiaomi). */
function LetterMark({
    text,
    bg,
    fg = '#fff',
}: {
    text: string;
    bg: string;
    fg?: string;
}) {
    return (
        <span
            className="grid size-5 place-items-center rounded-[7px] text-[10px] font-black"
            style={{ background: bg, color: fg }}
            aria-hidden
        >
            {text}
        </span>
    );
}

/** Значок Linux / Ubuntu: помаранчеве коло з трьома точками. */
function LinuxMark() {
    return (
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
            <circle cx="12" cy="12" r="11" fill="#e95420" />
            <circle
                cx="12"
                cy="12"
                r="5"
                fill="none"
                stroke="#fff"
                strokeWidth="2"
            />
            <circle cx="5.5" cy="12" r="2" fill="#fff" />
            <circle cx="15.3" cy="6.4" r="2" fill="#fff" />
            <circle cx="15.3" cy="17.6" r="2" fill="#fff" />
        </svg>
    );
}

export const STORES: Record<
    StoreKey,
    {
        top: () => string;
        name: string;
        mark: () => ReactNode;
        external: boolean;
    }
> = {
    google_play: {
        top: () => tr('Завантажити з'),
        name: 'Google Play',
        mark: () => <PlayMark />,
        external: true,
    },
    app_store: {
        top: () => tr('Завантажити в'),
        name: 'App Store',
        mark: () => <AppleMark />,
        external: true,
    },
    app_gallery: {
        top: () => tr('Шукайте в'),
        name: 'AppGallery',
        mark: () => <GalleryMark />,
        external: true,
    },
    galaxy_store: {
        top: () => tr('Доступно в'),
        name: 'Galaxy Store',
        mark: () => <GalaxyMark />,
        external: true,
    },
    apk: {
        top: () => tr('Пряме завантаження'),
        name: 'APK для Android',
        mark: () => <Download className="size-5 text-sky-300" />,
        external: false,
    },
    amazon: {
        top: () => tr('Доступно в'),
        name: 'Amazon Appstore',
        mark: () => <LetterMark text="a" bg="#ff9900" fg="#111" />,
        external: true,
    },
    xiaomi: {
        top: () => tr('Доступно в'),
        name: 'Xiaomi GetApps',
        mark: () => <LetterMark text="mi" bg="#ff6900" />,
        external: true,
    },
    microsoft_store: {
        top: () => tr('Завантажити з'),
        name: 'Microsoft Store',
        mark: () => <WindowsMark brand />,
        external: true,
    },
    windows: {
        top: () => tr('Завантажити для'),
        name: 'Windows',
        mark: () => <WindowsMark />,
        external: false,
    },
    macos: {
        top: () => tr('Завантажити для'),
        name: 'macOS',
        mark: () => <AppleMark />,
        external: false,
    },
    linux: {
        top: () => tr('Завантажити для'),
        name: 'Linux / Ubuntu',
        mark: () => <LinuxMark />,
        external: false,
    },
};

/** Кнопка магазину: суцільна темна плашка з живою градієнтною гранню, без розмиття. */
export function StoreButton({
    store,
    url,
    highlight = false,
    className,
}: {
    store: StoreKey;
    url: string;
    highlight?: boolean;
    className?: string;
}) {
    const s = STORES[store];

    return (
        <a
            href={url}
            target={s.external ? '_blank' : undefined}
            rel={s.external ? 'noopener noreferrer' : undefined}
            download={s.external ? undefined : true}
            className={cn(
                'group relative inline-flex h-14 items-center gap-3 rounded-2xl pr-5 pl-3.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 active:scale-[0.98]',
                // Рекомендована для пристрою — суцільна акцентна; решта — скло, як інші кнопки сайту.
                highlight
                    ? 'bg-[linear-gradient(135deg,#1d4ed8,#0ea5e9)] text-white shadow-[0_12px_32px_-12px_rgb(14_165_233/0.7)] hover:brightness-110'
                    : 'glass text-white hover:bg-white/[0.08]',
                className,
            )}
        >
            <span
                className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-xl',
                    highlight ? 'bg-white/15' : 'bg-white/[0.06]',
                )}
            >
                {s.mark()}
            </span>
            <span className="leading-tight">
                <span
                    className={cn(
                        'block text-[11px]',
                        highlight ? 'text-white/75' : 'text-white/55',
                    )}
                >
                    {s.top()}
                </span>
                <span className="block text-[15px] font-semibold tracking-tight">
                    {s.name}
                </span>
            </span>
        </a>
    );
}
