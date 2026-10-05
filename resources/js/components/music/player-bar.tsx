import { router, usePage } from '@inertiajs/react';
import {
    Headphones,
    ListMusic,
    Loader2,
    Pause,
    Play,
    Repeat,
    Repeat1,
    Shuffle,
    SkipBack,
    SkipForward,
    Volume1,
    Volume2,
    VolumeX,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { formatDuration } from '@/lib/format';
import {
    closePlayer,
    cycleRepeat,
    jumpTo,
    next,
    prev,
    removeFromQueue,
    seek,
    setSpotifyAuth,
    setVolume,
    toggle,
    toggleMute,
    toggleShuffle,
    usePlayer,
} from '@/lib/player';
import { cn } from '@/lib/utils';
import { Equalizer, SpotifyLogo, TrackCover } from './track-cover';
import { tr } from '@/lib/i18n';

function Range({
    value,
    max,
    onChange,
    label,
    className,
}: {
    value: number;
    max: number;
    onChange: (value: number) => void;
    label: string;
    className?: string;
}) {
    const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0;

    return (
        <input
            type="range"
            min={0}
            max={max || 1}
            step={max > 10 ? 0.5 : 0.01}
            value={Math.min(value, max || 1)}
            aria-label={label}
            onChange={(event) => onChange(Number(event.target.value))}
            className={cn('gc-range w-full', className)}
            style={{ '--value': `${percent}%` } as React.CSSProperties}
        />
    );
}

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
                    ? 'text-[#8fa0ff] drop-shadow-[0_0_8px_rgb(124_140_255/0.9)]'
                    : 'text-white/60 hover:bg-white/[0.06] hover:text-white',
                className,
            )}
        >
            {children}
        </button>
    );
}

export function PlayerBar({ standalone }: { standalone?: boolean }) {
    const player = usePlayer();
    const { music } = usePage().props;
    const { currentUrl } = useCurrentUrl();
    const [queueOpen, setQueueOpen] = useState(false);
    const track = player.current;

    useEffect(() => {
        if (music) setSpotifyAuth(music.spotify);
    }, [music]);

    if (!track) return null;

    const VolumeIcon =
        player.muted || player.volume === 0
            ? VolumeX
            : player.volume < 0.5
              ? Volume1
              : Volume2;
    const RepeatIcon = player.repeat === 'one' ? Repeat1 : Repeat;
    const playButton = (
        <button
            type="button"
            onClick={toggle}
            aria-label={player.playing ? tr('Пауза') : tr('Відтворити')}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[#0b0d1d] shadow-[0_0_24px_-4px_rgb(139_107_255/0.9)] transition hover:scale-105"
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
                        'glass-strong fixed right-3 z-50 flex max-h-[min(460px,60vh)] w-[min(380px,calc(100vw-1.5rem))] animate-in flex-col overflow-hidden rounded-3xl border border-white/10 fade-in-0 slide-in-from-bottom-2 lg:bottom-[92px]',
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

            <div
                className={cn(
                    'pointer-events-none fixed inset-x-0 z-40 bg-transparent px-3 [view-transition-name:gc-player]',
                    standalone
                        ? 'bottom-[calc(env(safe-area-inset-bottom)+12px)] lg:left-[256px]'
                        : 'bottom-[calc(4.25rem+env(safe-area-inset-bottom))] lg:bottom-4',
                )}
            >
                <div className="pointer-events-auto relative mx-auto max-w-[1100px] overflow-hidden rounded-2xl border border-white/10 bg-[#0f1426]/70 shadow-[0_18px_50px_-28px_rgb(109_93_252/0.85)] backdrop-blur-md">
                    {player.current?.cover_url && (
                        <img
                            src={player.current.cover_url}
                            alt=""
                            className="pointer-events-none absolute inset-0 size-full scale-125 object-cover opacity-[0.12] blur-3xl"
                        />
                    )}

                    <div className="absolute inset-x-0 top-0 lg:hidden">
                        <div
                            className="h-0.5 bg-gradient-brand transition-[width]"
                            style={{
                                width: `${player.duration ? (player.position / player.duration) * 100 : 0}%`,
                            }}
                        />
                    </div>

                    <div className="relative mx-auto flex h-16 max-w-[1320px] items-center gap-3 px-3 lg:h-[76px] lg:gap-6 lg:px-5">
                        <div className="flex min-w-0 flex-1 items-center gap-3 lg:w-[30%] lg:flex-none">
                            <div className="relative">
                                <TrackCover
                                    url={track.cover_url}
                                    seed={track.key}
                                    className="size-11 rounded-xl lg:size-12"
                                />
                                {track.source === 'spotify' && (
                                    <span className="absolute -right-1 -bottom-1 rounded-full bg-[#0b0d1d] p-0.5">
                                        <SpotifyLogo className="size-3.5" />
                                    </span>
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">
                                    {track.title}
                                </p>
                                <p className="truncate text-xs text-white/50">
                                    {track.artist}
                                    {player.engine === 'embed' && (
                                        <span className="ml-1.5 text-[#1ed760]/80">
                                            {tr('· плеєр Spotify')}
                                        </span>
                                    )}
                                    {player.engine === 'sdk' && (
                                        <span className="ml-1.5 text-[#1ed760]/80">
                                            · Spotify Premium
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>

                        <div className="hidden flex-1 flex-col items-center gap-1 lg:flex">
                            <div className="flex items-center gap-2">
                                <IconButton
                                    onClick={toggleShuffle}
                                    label={tr('Перемішати')}
                                    active={player.shuffle}
                                >
                                    <Shuffle className="size-4" />
                                </IconButton>
                                <IconButton
                                    onClick={prev}
                                    label={tr('Попередній')}
                                >
                                    <SkipBack className="size-5 fill-current" />
                                </IconButton>
                                {playButton}
                                <IconButton
                                    onClick={next}
                                    label={tr('Наступний')}
                                >
                                    <SkipForward className="size-5 fill-current" />
                                </IconButton>
                                <IconButton
                                    onClick={cycleRepeat}
                                    label={
                                        player.repeat === 'one'
                                            ? tr('Повторювати трек')
                                            : player.repeat === 'all'
                                              ? tr('Повторювати чергу')
                                              : tr('Без повтору')
                                    }
                                    active={player.repeat !== 'off'}
                                >
                                    <RepeatIcon className="size-4" />
                                </IconButton>
                            </div>
                            <div className="flex w-full max-w-[560px] items-center gap-2.5 text-[11px] text-white/45 tabular-nums">
                                <span className="w-9 text-right">
                                    {formatDuration(player.position)}
                                </span>
                                <Range
                                    value={player.position}
                                    max={player.duration}
                                    onChange={seek}
                                    label={tr('Перемотати')}
                                />
                                <span className="w-9">
                                    {formatDuration(player.duration)}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 lg:w-[30%] lg:justify-end">
                            <div className="lg:hidden">{playButton}</div>
                            <IconButton
                                onClick={next}
                                label={tr('Наступний')}
                                className="lg:hidden"
                            >
                                <SkipForward className="size-5 fill-current" />
                            </IconButton>
                            <div className="hidden items-center gap-1 lg:flex">
                                <IconButton
                                    onClick={toggleMute}
                                    label={tr('Гучність')}
                                >
                                    <VolumeIcon className="size-[18px]" />
                                </IconButton>
                                <Range
                                    value={player.muted ? 0 : player.volume}
                                    max={1}
                                    onChange={setVolume}
                                    label={tr('Гучність')}
                                    className="w-24"
                                />
                            </div>
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
        </>
    );
}
