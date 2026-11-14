import { Link, usePage } from '@inertiajs/react';
import {
    House,
    LayoutGrid,
    Library,
    Radio,
    Search,
    TrendingUp,
    Upload,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { TrackActionsProvider } from '@/components/am/track-actions';
import { UploadTracksDialog } from '@/components/music/upload-dialog';
import { tr } from '@/lib/i18n';
import {
    getPlayerState,
    next,
    prev,
    seek,
    setVolume,
    toggle,
    toggleMute,
} from '@/lib/player';
import { cn } from '@/lib/utils';

/**
 * Розділ «Музика» в єдиному стилі сайту: загальна шапка, меню й плеєр сайту, а розділи
 * музики — пігулками вгорі (як у кіно). Завантаження треків і клавіші керування — тут.
 */

const TABS = [
    { href: '/music', label: () => tr('Головна'), icon: House, exact: true },
    { href: '/music/new', label: () => tr('Нове'), icon: LayoutGrid },
    { href: '/music/radio', label: () => tr('Радіо'), icon: Radio },
    { href: '/music/charts', label: () => tr('Чарти'), icon: TrendingUp },
    { href: '/music/library', label: () => tr('Медіатека'), icon: Library },
    { href: '/music/search', label: () => tr('Пошук'), icon: Search },
];

function MusicNav({ onUpload }: { onUpload: () => void }) {
    const { url } = usePage();
    const path = url.split('?')[0];
    const active = (href: string, exact = false) =>
        exact ? path === href : path === href || path.startsWith(`${href}/`);

    return (
        <nav
            aria-label={tr('Музика')}
            ref={(el) => {
                el?.querySelector<HTMLElement>(
                    '[aria-current="page"]',
                )?.scrollIntoView({ block: 'nearest', inline: 'center' });
            }}
            className="gc-solid mb-4 flex [scrollbar-width:none] items-center gap-1 overflow-x-auto rounded-2xl p-1.5"
        >
            {TABS.map((tab) => {
                const on =
                    active(tab.href, tab.exact) ||
                    (tab.href === '/music/library' &&
                        active('/music/playlists'));
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        aria-current={on ? 'page' : undefined}
                        className={cn(
                            'flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition',
                            on
                                ? 'bg-sky-500 text-white'
                                : 'text-white/70 hover:bg-[var(--gc-l2)] hover:text-white',
                        )}
                    >
                        <tab.icon className="size-4" />
                        {tab.label()}
                    </Link>
                );
            })}
            <button
                type="button"
                onClick={onUpload}
                className="ml-auto flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold text-sky-400 transition hover:bg-[var(--gc-l2)]"
            >
                <Upload className="size-4" />
                {tr('Завантажити')}
            </button>
        </nav>
    );
}

/**
 * Клавіші, як у Apple Music на комп’ютері: пробіл — пауза, ← / → — перемотка на 10 с,
 * Shift + ← / → — попередній чи наступний трек, ↑ / ↓ — гучність, M — без звуку.
 * Не заважають, коли людина друкує в полі.
 */
function useMusicShortcuts() {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (
                e.defaultPrevented ||
                e.metaKey ||
                e.ctrlKey ||
                e.altKey ||
                target?.closest(
                    'input, textarea, select, [contenteditable="true"], [role="slider"], [role="menu"], [role="dialog"] button',
                )
            )
                return;
            const state = getPlayerState();
            if (!state.current) return;
            switch (e.key) {
                case ' ':
                    if (target?.closest('button, a')) return;
                    toggle();
                    break;
                case 'ArrowRight':
                    if (e.shiftKey) next();
                    else seek(state.position + 10);
                    break;
                case 'ArrowLeft':
                    if (e.shiftKey) prev();
                    else seek(state.position - 10);
                    break;
                case 'ArrowUp':
                    setVolume(state.volume + 0.05);
                    break;
                case 'ArrowDown':
                    setVolume(state.volume - 0.05);
                    break;
                case 'm':
                case 'M':
                case 'ь':
                case 'Ь':
                    toggleMute();
                    break;
                default:
                    return;
            }
            e.preventDefault();
        };
        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, []);
}

export default function MusicLayout({ children }: PropsWithChildren) {
    const { site } = usePage().props;
    const [uploading, setUploading] = useState(false);
    useMusicShortcuts();

    useEffect(() => {
        const upload = () => setUploading(true);
        window.addEventListener('am:upload', upload);
        return () => window.removeEventListener('am:upload', upload);
    }, []);

    return (
        <TrackActionsProvider>
            <div className="am am-in-site [--am-gap:12px] [--am-gutter:0px] [--am-tile:min(42vw,190px)] lg:[--am-gap:20px] lg:[--am-tile:184px]">
                <MusicNav onUpload={() => setUploading(true)} />
                {children}
            </div>
            <UploadTracksDialog
                open={uploading}
                onOpenChange={setUploading}
                maxMb={site.music_upload?.max_mb ?? 30}
                formats={site.music_upload?.formats ?? []}
            />
        </TrackActionsProvider>
    );
}

/** Сумісність сторінок: повернення на сайт тепер не потрібне — музика в загальній оболонці. */
export function BackToGameCon() {
    return null;
}

/** Завантаження музики з будь-якої сторінки розділу. */
export function useUploadMusic() {
    return () => window.dispatchEvent(new CustomEvent('am:upload'));
}
