import { router, usePage } from '@inertiajs/react';
import {
    Headphones,
    ListMusic,
    Loader2,
    Pause,
    Play,
    SkipForward,
    X,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { usePlayback } from '@/lib/connect';
import {
    closePlayer,
    jumpTo,
    removeFromQueue,
    setSpotifyAuth,
} from '@/lib/player';
import { cn } from '@/lib/utils';
import { RemoteLine } from './connect-ui';
import { CapsuleButton, PlayerCapsule } from './player-capsule';
import { Equalizer, SpotifyLogo, TrackCover } from './track-cover';
import { tr } from '@/lib/i18n';
import { TrackActionsProvider } from '@/components/am/track-actions';

// Повноекранний «Зараз грає» (як у розділі «Музика», стиль Apple Music) — окремим файлом:
// вантажиться, лише коли його вперше відкривають.
const NowPlaying = lazy(() =>
    import('@/components/am/now-playing').then((module) => ({
        default: module.NowPlaying,
    })),
);

function IconButton({
    onClick,
    label,
    active,
    children,
    className,
}: {
    onClick: () => void;
    label: string;
    active?: boolean;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className={cn(
                'flex size-9 items-center justify-center rounded-full transition',
                active
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:bg-white/[0.06] hover:text-white',
                className,
            )}
        >
            {children}
        </button>
    );
}

export function PlayerBar({ standalone }: { standalone?: boolean }) {
    // Грає інший пристрій (GameCon Connect) — показуємо його трек, кнопки керують ним.
    const player = usePlayback();
    const { toggle, next, remote } = player;
    const { music } = usePage().props;
    const { currentUrl } = useCurrentUrl();
    const [queueOpen, setQueueOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [fullLoaded, setFullLoaded] = useState(false);
    const [view, setView] = useState<'artwork' | 'lyrics' | 'queue'>('artwork');
    const track = player.current;

    useEffect(() => {
        if (music) setSpotifyAuth(music.spotify);
    }, [music]);

    if (!track) return null;

    const playButton = (
        <button
            type="button"
            onClick={toggle}
            aria-label={player.playing ? tr('Пауза') : tr('Відтворити')}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[#0b0d1d] transition-colors hover:bg-white/90"
        >
            {player.loading && !player.playing ? (
                <Loader2 className="size-5 animate-spin" />
            ) : player.playing ? (
                <Pause className="size-5 fill-current" />
            ) : (
                <Play className="ml-0.5 size-5 fill-current" />
            )}
        </button>
    );

    return (
        <>
            {queueOpen && (
                <div
                    className={cn(
                        'glass-strong fixed right-3 z-50 flex max-h-[min(460px,60vh)] w-[min(380px,calc(100vw-1.5rem))] animate-in flex-col overflow-hidden rounded-3xl border border-white/10 fade-in-0 slide-in-from-bottom-2 lg:hidden',
                        standalone ? 'bottom-[92px]' : 'bottom-[148px]',
                    )}
                >
                    <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                        <span className="font-display text-sm font-semibold text-white">
                            {tr('Черга відтворення')}
                        </span>
                        <span className="text-xs text-white/45">
                            {player.queue.length}
                        </span>
                    </header>
                    <ol className="min-h-0 flex-1 overflow-y-auto p-2">
                        {player.queue.map((item, i) => (
                            <li key={`${item.key}-${i}`}>
                                <div
                                    className={cn(
                                        'group flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/[0.05]',
                                        i === player.index && 'bg-white/[0.06]',
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() => jumpTo(i)}
                                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                    >
                                        <TrackCover
                                            url={item.cover_url}
                                            seed={item.key}
                                            className="size-9 rounded-lg"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span
                                                className={cn(
                                                    'block truncate text-[13px] font-medium',
                                                    i === player.index
                                                        ? 'text-[#b3bcff]'
                                                        : 'text-white',
                                                )}
                                            >
                                                {item.title}
                                            </span>
                                            <span className="block truncate text-xs text-white/45">
                                                {item.artist}
                                            </span>
                                        </span>
                                        {i === player.index && (
                                            <Equalizer
                                                paused={!player.playing}
                                            />
                                        )}
                                    </button>
                                    {i !== player.index && (
                                        <button
                                            type="button"
                                            onClick={() => removeFromQueue(i)}
                                            className="rounded-full p-1 text-white/30 opacity-0 transition group-hover:opacity-100 hover:text-white [@media(hover:none)]:opacity-100"
                                            aria-label={tr('Прибрати з черги')}
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            )}

            {/* ПК: та сама капсула, що й у «Музиці», — внизу вікна, з усім керуванням. */}
            <div
                className={cn(
                    'pointer-events-none fixed inset-x-0 bottom-4 z-[45] hidden px-6 lg:block',
                    standalone && 'lg:left-[276px]',
                )}
            >
                {/* Меню «⋯» капсули відкриває діалоги (поділитися, відомості) — потрібен провайдер дій. */}
                <TrackActionsProvider>
                    <PlayerCapsule
                        onOpen={(v) => {
                            setQueueOpen(false);
                            setView(v ?? 'artwork');
                            setFullLoaded(true);
                            setExpanded(true);
                        }}
                        extra={
                            <>
                                {track.source === 'local' &&
                                    !currentUrl.startsWith('/listen/') && (
                                        <CapsuleButton
                                            onClick={() =>
                                                router.post('/music/together', {
                                                    track_id: track.id,
                                                })
                                            }
                                            label={tr('Слухати разом')}
                                        >
                                            <Headphones className="size-[18px]" />
                                        </CapsuleButton>
                                    )}
                                <CapsuleButton
                                    onClick={closePlayer}
                                    label={tr('Закрити плеєр')}
                                >
                                    <X className="size-[18px]" />
                                </CapsuleButton>
                            </>
                        }
                    />
                </TrackActionsProvider>
            </div>

            {/* Телефон: міні-плеєр над нижньою панеллю. */}
            <div
                className={cn(
                    'pointer-events-none fixed inset-x-0 z-[45] bg-transparent px-3 lg:hidden',
                    standalone
                        ? 'bottom-[calc(env(safe-area-inset-bottom)+12px)]'
                        : 'bottom-[calc(5.25rem+env(safe-area-inset-bottom))]',
                )}
            >
                {/* Матове нейтральне скло без підсвітки кольором обкладинки; ім'я переходу — на самій панелі, інакше розмиття не бачить сторінку. */}
                <div className="glass-matte pointer-events-auto relative mx-auto max-w-[1100px] overflow-hidden rounded-full [view-transition-name:gc-player]">
                    <div className="absolute inset-x-0 top-0">
                        <div
                            className="h-0.5 bg-primary transition-[width]"
                            style={{
                                width: `${player.duration ? (player.position / player.duration) * 100 : 0}%`,
                            }}
                        />
                    </div>

                    <div className="relative mx-auto flex h-16 max-w-[1320px] items-center gap-3 px-3">
                        <button
                            type="button"
                            onClick={() => {
                                setQueueOpen(false);
                                setFullLoaded(true);
                                setExpanded(true);
                            }}
                            aria-label={tr('Відкрити плеєр')}
                            title={tr('Відкрити плеєр')}
                            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                            <span className="relative shrink-0">
                                <TrackCover
                                    url={track.cover_url}
                                    seed={track.key}
                                    className="size-11 rounded-xl"
                                />
                                {track.source === 'spotify' && (
                                    <span className="absolute -right-1 -bottom-1 rounded-full bg-[#0b0d1d] p-0.5">
                                        <SpotifyLogo className="size-3.5" />
                                    </span>
                                )}
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-white">
                                    {track.title}
                                </span>
                                {remote && <RemoteLine device={remote} />}
                                <span
                                    className={cn(
                                        'block truncate text-xs text-white/50',
                                        remote && 'hidden',
                                    )}
                                >
                                    {track.artist}
                                    {player.engine === 'embed' && (
                                        <span className="ml-1.5 text-spotify/80">
                                            {tr('· плеєр Spotify')}
                                        </span>
                                    )}
                                    {player.engine === 'sdk' && (
                                        <span className="ml-1.5 text-spotify/80">
                                            · Spotify Premium
                                        </span>
                                    )}
                                </span>
                            </span>
                        </button>

                        <div className="flex items-center gap-1">
                            {playButton}
                            <IconButton onClick={next} label={tr('Наступний')}>
                                <SkipForward className="size-5 fill-current" />
                            </IconButton>
                            {track?.source === 'local' &&
                                !currentUrl.startsWith('/listen/') && (
                                    <IconButton
                                        onClick={() =>
                                            router.post('/music/together', {
                                                track_id: track.id,
                                            })
                                        }
                                        label={tr('Слухати разом')}
                                    >
                                        <Headphones className="size-[18px]" />
                                    </IconButton>
                                )}
                            <IconButton
                                onClick={() => setQueueOpen((open) => !open)}
                                label={tr('Черга')}
                                active={queueOpen}
                            >
                                <ListMusic className="size-[18px]" />
                            </IconButton>
                            <IconButton
                                onClick={() => {
                                    setQueueOpen(false);
                                    closePlayer();
                                }}
                                label={tr('Закрити плеєр')}
                            >
                                <X className="size-[18px]" />
                            </IconButton>
                        </div>
                    </div>
                </div>
            </div>
            {fullLoaded && expanded && (
                <Suspense fallback={null}>
                    <TrackActionsProvider>
                        <NowPlaying
                            view={view}
                            onView={setView}
                            onClose={() => setExpanded(false)}
                        />
                    </TrackActionsProvider>
                </Suspense>
            )}
        </>
    );
}
