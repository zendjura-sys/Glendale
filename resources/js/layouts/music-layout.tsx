import { Link, router, usePage } from '@inertiajs/react';
import {
    ChevronLeft,
    Clock3,
    Disc3,
    FastForward,
    House,
    LayoutGrid,
    Library,
    ListMusic,
    MessageSquareQuote,
    Mic2,
    Music2,
    Pause,
    Play,
    Radio,
    Repeat,
    Repeat1,
    Rewind,
    Search,
    Shuffle,
    Star,
    Tags,
    Upload,
    Volume1,
    Volume2,
    VolumeX,
} from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import type { PanInfo } from 'motion/react';
import { lazy, Suspense, useEffect, useState } from 'react';
import type { CSSProperties, PropsWithChildren, ReactNode } from 'react';
import { TrackActionsProvider } from '@/components/am/track-actions';
import { IncomingCall } from '@/components/gc/incoming-call';
import { InboxListener } from '@/components/gc/inbox-listener';
import { NotificationsMenu } from '@/components/gc/notifications-menu';
import { VoiceBar } from '@/components/gc/voice-bar';
import { BillingHost } from '@/components/billing/billing-host';
import { SpotifyLogo, TrackCover } from '@/components/music/track-cover';
import { UploadTracksDialog } from '@/components/music/upload-dialog';
import { api } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { motionOr, SNAP } from '@/lib/motion';
import {
    cycleRepeat,
    getPlayerState,
    next,
    prev,
    seek,
    setVolume,
    toggle,
    toggleMute,
    toggleShuffle,
    usePlayer,
} from '@/lib/player';
import { cn } from '@/lib/utils';
import { LAST_PAGE_KEY, UserMenu } from '@/layouts/social-layout';

const NowPlaying = lazy(() =>
    import('@/components/am/now-playing').then((module) => ({
        default: module.NowPlaying,
    })),
);

/**
 * Розділ «Музика» в стилі Apple Music. Телефон: великі заголовки, внизу «скляна» панель
 * (Головна, Нове, Радіо, Медіатека) і кругла кнопка пошуку, над нею — міні-плеєр.
 * ПК: бічне меню з пошуком, медіатекою й плейлистами, угорі — панель відтворення.
 * Повернутися в GameCon — «‹ GameCon» угорі меню (ПК) чи на кожній сторінці (телефон).
 */

type View = 'artwork' | 'lyrics' | 'queue';

/** Відкрити «Зараз грає» з будь-якого місця розділу (міні-плеєр, панель ПК, кнопки тексту й черги). */
let openNowPlaying: (view?: View) => void = () => {};
export function showNowPlaying(view?: View) {
    openNowPlaying(view);
}

function useActive() {
    const { url } = usePage();
    const path = url.split('?')[0];

    return (href: string, exact = false) =>
        exact ? path === href : path === href || path.startsWith(`${href}/`);
}

const TABS = [
    { href: '/music', label: () => tr('Головна'), icon: House, exact: true },
    { href: '/music/new', label: () => tr('Нове'), icon: LayoutGrid },
    { href: '/music/radio', label: () => tr('Радіо'), icon: Radio },
    { href: '/music/library', label: () => tr('Медіатека'), icon: Library },
];

// ───────────────────────── ПК: бічне меню ─────────────────────────

function SideLink({
    href,
    icon,
    label,
    exact,
}: {
    href: string;
    icon: ReactNode;
    label: string;
    exact?: boolean;
}) {
    const active = useActive()(href, exact);

    return (
        <Link
            href={href}
            className={cn(
                'am-subhead flex h-8 items-center gap-2.5 rounded-md px-2.5 transition',
                active
                    ? 'bg-[var(--am-fill2)] font-semibold'
                    : 'hover:bg-[var(--am-fill)]',
            )}
        >
            <span className="flex w-5 justify-center text-[var(--am-accent)] [&_svg]:size-[18px]">
                {icon}
            </span>
            <span className="truncate">{label}</span>
        </Link>
    );
}

function Sidebar({ onUpload }: { onUpload: () => void }) {
    const [q, setQ] = useState('');
    const [playlists, setPlaylists] = useState<{ id: number; title: string }[]>(
        [],
    );

    useEffect(() => {
        void api<{ playlists: { id: number; title: string }[] }>(
            'GET',
            '/music/playlists/mine',
        )
            .then((d) => setPlaylists(d.playlists))
            .catch(() => {});
    }, []);

    return (
        <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col overflow-y-auto border-r border-[var(--am-sep)] bg-[var(--am-bg2)] px-3 pt-4 pb-6 lg:flex">
            <Link
                href="/feed"
                className="am-subhead mb-3 flex items-center gap-1 px-1 text-[var(--am-accent)] hover:opacity-80"
            >
                <ChevronLeft className="size-5" strokeWidth={2.4} /> GameCon
            </Link>
            <p className="am-title2 mb-3 flex items-center gap-2 px-2.5">
                <span className="flex size-7 items-center justify-center rounded-[7px] bg-gradient-to-b from-[#fb5c74] to-[#fa233b] text-white">
                    <Music2 className="size-4" strokeWidth={2.6} />
                </span>
                {tr('Музика')}
            </p>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    router.visit(`/music/search?q=${encodeURIComponent(q)}`);
                }}
                className="mb-4 flex h-8 items-center gap-2 rounded-lg bg-[var(--am-fill)] px-2.5"
            >
                <Search className="size-4 text-[var(--am-label2)]" />
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={tr('Пошук')}
                    className="am-subhead min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--am-label2)]"
                />
            </form>
            <nav className="grid gap-0.5">
                {TABS.slice(0, 3).map((tab) => (
                    <SideLink
                        key={tab.href}
                        href={tab.href}
                        label={tab.label()}
                        icon={<tab.icon />}
                        exact={tab.exact}
                    />
                ))}
            </nav>
            <p className="am-footnote mt-5 mb-1 px-2.5 font-semibold text-[var(--am-label2)]">
                {tr('Медіатека')}
            </p>
            <nav className="grid gap-0.5">
                <SideLink
                    href="/music/library"
                    exact
                    label={tr('Нещодавно додане')}
                    icon={<Clock3 />}
                />
                <SideLink
                    href="/music/library/artists"
                    label={tr('Виконавці')}
                    icon={<Mic2 />}
                />
                <SideLink
                    href="/music/library/albums"
                    label={tr('Альбоми')}
                    icon={<Disc3 />}
                />
                <SideLink
                    href="/music/library/songs"
                    label={tr('Пісні')}
                    icon={<Music2 />}
                />
                <SideLink
                    href="/music/library/favorites"
                    label={tr('Улюблені пісні')}
                    icon={<Star />}
                />
                <SideLink
                    href="/music/library/genres"
                    label={tr('Жанри')}
                    icon={<Tags />}
                />
                <SideLink
                    href="/music/library/spotify"
                    label="Spotify"
                    icon={<SpotifyLogo className="size-4" />}
                />
            </nav>
            <p className="am-footnote mt-5 mb-1 px-2.5 font-semibold text-[var(--am-label2)]">
                {tr('Плейлисти')}
            </p>
            <nav className="grid gap-0.5">
                <SideLink
                    href="/music/library/playlists"
                    exact
                    label={tr('Усі плейлисти')}
                    icon={<LayoutGrid />}
                />
                {playlists.slice(0, 40).map((p) => (
                    <SideLink
                        key={p.id}
                        href={`/music/playlists/${p.id}`}
                        label={p.title}
                        icon={<ListMusic />}
                    />
                ))}
            </nav>
            <button
                type="button"
                onClick={onUpload}
                className="am-subhead mt-6 flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--am-fill)] font-semibold text-[var(--am-accent)] hover:bg-[var(--am-fill2)]"
            >
                <Upload className="size-4" /> {tr('Завантажити музику')}
            </button>
        </aside>
    );
}

// ───────────────────────── ПК: панель відтворення ─────────────────────────

function Transport() {
    const player = usePlayer();
    const track = player.current;
    const live = track?.source === 'radio';
    const RepeatIcon = player.repeat === 'one' ? Repeat1 : Repeat;
    const VolumeIcon =
        player.muted || player.volume === 0
            ? VolumeX
            : player.volume < 0.5
              ? Volume1
              : Volume2;
    const iconBtn =
        'flex size-9 items-center justify-center rounded-md text-[var(--am-label)] transition hover:bg-[var(--am-fill)] disabled:opacity-30';

    return (
        <div className="glass-matte glass-matte--bar sticky top-0 z-30 hidden h-14 items-center gap-4 px-5 lg:flex">
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={toggleShuffle}
                    aria-label={tr('Перемішати')}
                    disabled={!track || live}
                    className={cn(
                        iconBtn,
                        player.shuffle && 'text-[var(--am-accent)]',
                    )}
                >
                    <Shuffle className="size-[18px]" />
                </button>
                <button
                    type="button"
                    onClick={prev}
                    aria-label={tr('Попередній')}
                    disabled={!track || live}
                    className={iconBtn}
                >
                    <Rewind className="size-6 fill-current" />
                </button>
                <button
                    type="button"
                    onClick={toggle}
                    aria-label={player.playing ? tr('Пауза') : tr('Відтворити')}
                    disabled={!track}
                    className={cn(iconBtn, 'size-10')}
                >
                    {player.playing ? (
                        <Pause className="size-7 fill-current" />
                    ) : (
                        <Play className="size-7 fill-current" />
                    )}
                </button>
                <button
                    type="button"
                    onClick={next}
                    aria-label={tr('Наступний')}
                    disabled={!track || live}
                    className={iconBtn}
                >
                    <FastForward className="size-6 fill-current" />
                </button>
                <button
                    type="button"
                    onClick={cycleRepeat}
                    aria-label={tr('Повтор')}
                    disabled={!track || live}
                    className={cn(
                        iconBtn,
                        player.repeat !== 'off' && 'text-[var(--am-accent)]',
                    )}
                >
                    <RepeatIcon className="size-[18px]" />
                </button>
            </div>

            {/* «Дисплей»: обкладинка, назва й тонкий прогрес — як у Apple Music на Mac. */}
            <div className="flex h-11 min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-lg bg-[var(--am-fill)] pr-3">
                {track ? (
                    <>
                        <button
                            type="button"
                            onClick={() => showNowPlaying()}
                            aria-label={tr('Зараз грає')}
                            className="shrink-0"
                        >
                            <TrackCover
                                url={track.cover_url}
                                seed={track.key}
                                className="size-11 rounded-l-lg object-cover"
                            />
                        </button>
                        <div className="min-w-0 flex-1 text-center">
                            <p className="am-footnote truncate font-semibold">
                                {track.title}
                            </p>
                            <p className="am-footnote truncate text-[var(--am-label2)]">
                                {live ? tr('Пряма трансляція') : track.artist}
                            </p>
                            {!live && player.duration > 0 && (
                                <div
                                    className="relative mt-0.5 h-[3px] cursor-pointer rounded-full bg-[var(--am-fill2)]"
                                    onClick={(e) => {
                                        const r =
                                            e.currentTarget.getBoundingClientRect();
                                        seek(
                                            ((e.clientX - r.left) / r.width) *
                                                player.duration,
                                        );
                                    }}
                                >
                                    <span
                                        className="absolute inset-y-0 left-0 rounded-full bg-[var(--am-label2)]"
                                        style={{
                                            width: `${(player.position / player.duration) * 100}%`,
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                        {!live && (
                            <span className="am-footnote shrink-0 text-[var(--am-label2)] tabular-nums">
                                {formatDuration(player.position)}
                            </span>
                        )}
                    </>
                ) : (
                    <p className="am-footnote flex-1 text-center text-[var(--am-label3)]">
                        <Music2 className="mx-auto size-5" />
                    </p>
                )}
            </div>

            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={tr('Гучність')}
                    className={iconBtn}
                >
                    <VolumeIcon className="size-[18px]" />
                </button>
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={player.muted ? 0 : player.volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    aria-label={tr('Гучність')}
                    className="am-volume w-24"
                    style={
                        {
                            '--value': `${(player.muted ? 0 : player.volume) * 100}%`,
                        } as CSSProperties
                    }
                />
                <button
                    type="button"
                    onClick={() => showNowPlaying('lyrics')}
                    aria-label={tr('Текст пісні')}
                    disabled={!track}
                    className={iconBtn}
                >
                    <MessageSquareQuote className="size-[18px]" />
                </button>
                <button
                    type="button"
                    onClick={() => showNowPlaying('queue')}
                    aria-label={tr('Далі в черзі')}
                    disabled={!track}
                    className={iconBtn}
                >
                    <ListMusic className="size-[18px]" />
                </button>
            </div>
            <div className="am-site-controls flex items-center gap-0.5 border-l border-[var(--am-sep)] pl-3">
                <NotificationsMenu />
                <UserMenu />
            </div>
        </div>
    );
}

/** Куди веде «‹ Назад»: остання сторінка сайту поза «Музикою», інакше — стрічка. */
function lastSitePage(): string {
    try {
        return sessionStorage.getItem(LAST_PAGE_KEY) || '/feed';
    } catch {
        return '/feed';
    }
}

/**
 * Шапка розділу на телефоні — те саме матове скло, що й шапка сайту: ліворуч аватар (меню
 * облікового запису) і сповіщення, праворуч «‹ Назад» — повернення на сайт.
 */
function PhoneHeader() {
    const [back, setBack] = useState('/feed');

    useEffect(() => setBack(lastSitePage()), []);

    return (
        <header className="glass-matte glass-matte--bar am-site-controls sticky top-0 z-30 pt-[env(safe-area-inset-top)] lg:hidden">
            <div className="flex h-14 items-center gap-1 px-2">
                <UserMenu />
                <NotificationsMenu />
                <Link
                    href={back}
                    className="am-body ml-auto inline-flex min-h-11 items-center gap-0.5 rounded-[10px] pr-2 pl-1 font-medium text-[var(--am-accent)] active:opacity-70"
                >
                    <ChevronLeft className="size-6" strokeWidth={2.4} />
                    {tr('Назад')}
                </Link>
            </div>
        </header>
    );
}

// ───────────────────────── Телефон: міні-плеєр і панель вкладок ─────────────────────────

function MiniPlayer() {
    const player = usePlayer();
    const reduce = useReducedMotion();
    const track = player.current;

    return (
        <AnimatePresence>
            {track && (
                <m.div
                    initial={reduce ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, y: 16 }}
                    transition={motionOr(reduce, SNAP)}
                    // Свайп убік — наступний чи попередній трек, як у міні-плеєрі Apple Music.
                    drag={reduce || track.source === 'radio' ? false : 'x'}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.35}
                    dragSnapToOrigin
                    onDragEnd={(_: unknown, info: PanInfo) => {
                        if (info.offset.x < -70) next();
                        else if (info.offset.x > 70) prev();
                    }}
                    className="glass-matte pointer-events-auto mx-auto mb-2 flex h-14 max-w-[560px] touch-pan-y items-center gap-3 rounded-full pr-2 pl-2"
                >
                    <button
                        type="button"
                        onClick={() => showNowPlaying()}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        aria-label={tr('Зараз грає')}
                    >
                        <TrackCover
                            url={track.cover_url}
                            seed={track.key}
                            className="size-10 shrink-0 rounded-full object-cover"
                        />
                        <span className="min-w-0">
                            <span className="am-subhead block truncate font-medium">
                                {track.title}
                            </span>
                            <span className="am-footnote block truncate text-[var(--am-label2)]">
                                {track.source === 'radio'
                                    ? tr('Пряма трансляція')
                                    : track.artist}
                            </span>
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={toggle}
                        aria-label={
                            player.playing ? tr('Пауза') : tr('Відтворити')
                        }
                        className="flex size-10 items-center justify-center rounded-full"
                    >
                        {player.playing ? (
                            <Pause className="size-6 fill-current" />
                        ) : (
                            <Play className="size-6 fill-current" />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={next}
                        disabled={track.source === 'radio'}
                        aria-label={tr('Наступний')}
                        className="flex size-10 items-center justify-center rounded-full disabled:opacity-30"
                    >
                        <FastForward className="size-6 fill-current" />
                    </button>
                </m.div>
            )}
        </AnimatePresence>
    );
}

/**
 * Нижня панель «Музики» — той самий матовий острів, що й панель сайту (layouts/social-layout.tsx):
 * та сама висота, радіус і відступи, спільне ім'я переходу gc-tabbar — при вході в розділ панель
 * сайту плавно перетікає в цю, а при виході повертається.
 */
function TabBar() {
    const active = useActive();
    const tabs = [
        ...TABS.map((tab) => ({
            href: tab.href,
            label: tab.label(),
            icon: tab.icon,
            on:
                active(tab.href, tab.exact) ||
                (tab.href === '/music/library' && active('/music/playlists')),
        })),
        {
            href: '/music/search',
            label: tr('Пошук'),
            icon: Search,
            on: active('/music/search'),
        },
    ];

    return (
        <nav
            className="glass-matte flex flex-col overflow-hidden rounded-[35px] [view-transition-name:gc-tabbar]"
            aria-label={tr('Розділи музики')}
        >
            <span aria-hidden className="h-4 shrink-0" />
            <div className="flex items-stretch px-1 pb-1">
                {tabs.map((tab) => (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={cn(
                            'glass-matte-tab flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full pt-1 text-[11px] font-medium transition-colors active:opacity-70',
                            tab.on
                                ? 'text-[var(--am-accent)]'
                                : 'text-[var(--am-label2)]',
                        )}
                        aria-current={tab.on ? 'page' : undefined}
                    >
                        <tab.icon
                            className="size-[22px]"
                            strokeWidth={tab.on ? 2.4 : 2}
                        />
                        <span className="max-w-full truncate px-0.5">
                            {tab.label}
                        </span>
                    </Link>
                ))}
            </div>
        </nav>
    );
}

// ───────────────────────── Макет ─────────────────────────

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
    const { auth, modules, site } = usePage().props;
    const [view, setView] = useState<View | null>(null);
    const [uploading, setUploading] = useState(false);
    const player = usePlayer();
    useMusicShortcuts();

    useEffect(() => {
        openNowPlaying = (v) => setView(v ?? 'artwork');
        const upload = () => setUploading(true);
        window.addEventListener('am:upload', upload);

        return () => {
            openNowPlaying = () => {};
            window.removeEventListener('am:upload', upload);
        };
    }, []);

    return (
        <div className="am min-h-dvh [--am-gap:12px] [--am-gutter:20px] [--am-tile:min(42vw,190px)] lg:[--am-gap:20px] lg:[--am-gutter:40px] lg:[--am-tile:184px]">
            {modules.includes('messages') && (
                <>
                    <InboxListener userId={auth.user.id} />
                    <IncomingCall userId={auth.user.id} />
                </>
            )}
            <TrackActionsProvider>
                <div className="flex">
                    <Sidebar onUpload={() => setUploading(true)} />
                    <div className="min-w-0 flex-1">
                        <Transport />
                        <PhoneHeader />
                        <main
                            id="main-content"
                            className={cn(
                                'mx-auto max-w-[1280px] lg:pt-4',
                                player.current
                                    ? 'pb-[calc(env(safe-area-inset-bottom)+150px)]'
                                    : 'pb-[calc(env(safe-area-inset-bottom)+90px)]',
                                'lg:pb-16',
                            )}
                        >
                            {children}
                        </main>
                    </div>
                </div>

                {/* Телефон: міні-плеєр над «скляною» панеллю. */}
                <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] lg:hidden">
                    <MiniPlayer />
                    <div className="pointer-events-auto mx-auto max-w-[560px]">
                        <TabBar />
                    </div>
                </div>

                {view !== null && (
                    <Suspense fallback={null}>
                        <NowPlaying
                            view={view}
                            onView={setView}
                            onClose={() => setView(null)}
                        />
                    </Suspense>
                )}
                <UploadTracksDialog
                    open={uploading}
                    onOpenChange={setUploading}
                    maxMb={site.music_upload?.max_mb ?? 30}
                    formats={site.music_upload?.formats ?? []}
                />
            </TrackActionsProvider>
            <VoiceBar />
            <BillingHost />
        </div>
    );
}

/** Кнопка «‹ GameCon» для телефона: на ПК повернення — у бічному меню. */
export function BackToGameCon() {
    // Повернення на сайт тепер у шапці розділу (PhoneHeader); лишено для сумісності сторінок.
    return null;
}

/** Завантаження музики з будь-якої сторінки розділу. */
export function useUploadMusic() {
    return () => window.dispatchEvent(new CustomEvent('am:upload'));
}
