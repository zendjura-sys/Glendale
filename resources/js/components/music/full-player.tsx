import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
    ChevronDown,
    Loader2,
    MicVocal,
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
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { PanInfo } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useCoverColor } from '@/lib/cover-color';
import { formatDuration } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { activeLine, parseLyrics } from '@/lib/lyrics';
import type { Lyrics } from '@/lib/lyrics';
import { EASE_OUT, motionOr, RISE, SNAP } from '@/lib/motion';
import {
    cycleRepeat,
    jumpTo,
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
import type { TrackCard } from '@/types';
import { TrackCover } from './track-cover';
import { Waveform } from './waveform';

/**
 * Повноекранний плеєр («Зараз грає»): тло в кольорі обкладинки, вініл визирає з-за обкладинки
 * й крутиться під час гри, прогрес-хвиля, свайп по обкладинці — інший трек, скляна панель
 * керування, караоке-текст (LRC). Телефон — одна колонка (обкладинка ↔ текст), ПК — дві.
 */

const SWIPE = 80;

function useLyrics(track: TrackCard | null, enabled: boolean) {
    const [state, setState] = useState<{
        key: string;
        lyrics: Lyrics | null;
    } | null>(null);
    const key = track?.key ?? null;
    const local = track?.source === 'local' && track.has_lyrics;
    const id = track?.source === 'local' ? track.id : null;

    useEffect(() => {
        if (!enabled || !local || id === null || key === null) return;
        if (state?.key === key) return;
        let alive = true;
        void api<{ lyrics: string | null }>(
            'GET',
            `/music/tracks/${id}/lyrics`,
        ).then((response) => {
            if (!alive) return;
            const text = response.lyrics?.trim();
            setState({ key, lyrics: text ? parseLyrics(text) : null });
        });

        return () => {
            alive = false;
        };
    }, [enabled, local, id, key, state?.key]);

    return local && state?.key === key ? state.lyrics : null;
}

/** Вініл: борозни, відблиск і «яблуко» з обкладинкою; крутиться лише під час гри. */
function Vinyl({
    cover,
    spinning,
}: {
    cover: string | null;
    spinning: boolean;
}) {
    return (
        <div
            aria-hidden
            className="absolute inset-[3%] animate-[spin_8s_linear_infinite] rounded-full shadow-[0_20px_50px_-20px_rgb(0_0_0/0.9)] motion-reduce:animate-none"
            style={{
                animationPlayState: spinning ? 'running' : 'paused',
                background:
                    'repeating-radial-gradient(circle at center, #0b0b10 0 1.5px, #15151c 1.5px 3px)',
            }}
        >
            <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_30deg,transparent_0deg,rgb(255_255_255/0.09)_40deg,transparent_90deg,transparent_180deg,rgb(255_255_255/0.07)_220deg,transparent_270deg)]" />
            <div className="absolute inset-[33%] overflow-hidden rounded-full bg-[var(--tint)] ring-4 ring-black/40">
                {cover && (
                    <img
                        src={cover}
                        alt=""
                        className="size-full object-cover"
                    />
                )}
                <span className="absolute top-1/2 left-1/2 size-[9%] -translate-1/2 rounded-full bg-[#0b0b10]" />
            </div>
        </div>
    );
}

function Stage({
    track,
    playing,
    direction,
    onSwipe,
}: {
    track: TrackCard;
    playing: boolean;
    direction: number;
    onSwipe: (direction: 1 | -1) => void;
}) {
    const reduce = useReducedMotion();
    const end = (_: unknown, info: PanInfo) => {
        if (info.offset.x < -SWIPE || info.velocity.x < -600) onSwipe(1);
        else if (info.offset.x > SWIPE || info.velocity.x > 600) onSwipe(-1);
    };

    return (
        // Обкладинка + вініл, що визирає праворуч; зсув ліворуч центрує всю композицію.
        <div className="relative aspect-square w-[min(64vw,40dvh,360px)] -translate-x-[16%] lg:w-[min(30vw,62dvh,440px)]">
            <motion.div
                className="absolute inset-0"
                initial={reduce ? false : { x: '0%' }}
                animate={{ x: '34%' }}
                transition={motionOr(reduce, { ...RISE, delay: 0.15 })}
            >
                <Vinyl cover={track.cover_url} spinning={playing} />
            </motion.div>
            <AnimatePresence
                initial={false}
                custom={direction}
                mode="popLayout"
            >
                <motion.div
                    key={track.key}
                    custom={direction}
                    variants={{
                        enter: (d: number) => ({
                            x: d * 70,
                            opacity: 0,
                            filter: 'blur(8px)',
                        }),
                        center: { x: 0, opacity: 1, filter: 'blur(0px)' },
                        exit: (d: number) => ({
                            x: d * -70,
                            opacity: 0,
                            filter: 'blur(8px)',
                        }),
                    }}
                    initial={reduce ? false : 'enter'}
                    animate="center"
                    exit={reduce ? undefined : 'exit'}
                    transition={
                        reduce
                            ? { duration: 0 }
                            : { duration: 0.35, ease: EASE_OUT }
                    }
                    drag="x"
                    dragSnapToOrigin
                    dragElastic={0.35}
                    onDragEnd={end}
                    className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
                >
                    <TrackCover
                        url={track.cover_url}
                        seed={track.key}
                        className="pointer-events-none size-full rounded-[22px] shadow-[0_30px_70px_-25px_rgb(0_0_0/0.9)] ring-1 ring-white/10 select-none"
                    />
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

function LyricsView({
    lyrics,
    position,
    className,
}: {
    lyrics: Lyrics;
    position: number;
    className?: string;
}) {
    const reduce = useReducedMotion();
    const box = useRef<HTMLDivElement>(null);
    const touched = useRef(0);
    const current = lyrics.timed ? activeLine(lyrics.lines, position) : -1;

    // Тримаємо поточний рядок по центру, але не заважаємо, якщо людина щойно гортала сама.
    useEffect(() => {
        const el = box.current;
        if (!el || current < 0 || Date.now() - touched.current < 3000) return;
        const line = el.querySelector<HTMLElement>(`[data-line="${current}"]`);
        if (!line) return;
        el.scrollTo({
            top: line.offsetTop - el.clientHeight / 2 + line.clientHeight / 2,
            behavior: reduce ? 'auto' : 'smooth',
        });
    }, [current, reduce]);

    const mark = () => {
        touched.current = Date.now();
    };

    return (
        <div
            ref={box}
            onWheel={mark}
            onTouchMove={mark}
            className={cn(
                'relative [scrollbar-width:none] overflow-y-auto overscroll-contain [mask-image:linear-gradient(transparent,#000_14%,#000_86%,transparent)]',
                className,
            )}
        >
            <div className="py-[30%]">
                {lyrics.timed ? (
                    lyrics.lines.map((line, i) => (
                        <button
                            key={i}
                            type="button"
                            data-line={i}
                            onClick={() => seek(line.time ?? 0)}
                            className={cn(
                                'block w-full origin-left py-1.5 text-left font-display text-[clamp(1.25rem,2.4vw,1.75rem)] leading-snug font-bold tracking-tight transition-[color,opacity,transform] duration-300',
                                i === current
                                    ? 'scale-100 text-white'
                                    : i < current
                                      ? 'scale-[0.97] text-white/30'
                                      : 'scale-[0.97] text-white/45 hover:text-white/70',
                            )}
                        >
                            {line.text || '♪'}
                        </button>
                    ))
                ) : (
                    <p className="text-lg leading-relaxed whitespace-pre-wrap text-white/80">
                        {lyrics.lines.map((line) => line.text).join('\n')}
                    </p>
                )}
            </div>
        </div>
    );
}

function UpNext({ queue, index }: { queue: TrackCard[]; index: number }) {
    const upcoming = queue.slice(index + 1, index + 6);
    if (upcoming.length === 0) return null;

    return (
        <div>
            <p className="mb-2 text-sm font-medium text-white/50">
                {tr('Далі в черзі')}
            </p>
            <ol className="grid gap-1">
                {upcoming.map((item, i) => (
                    <li key={`${item.key}-${i}`}>
                        <button
                            type="button"
                            onClick={() => jumpTo(index + 1 + i)}
                            className="flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-white/[0.07]"
                        >
                            <TrackCover
                                url={item.cover_url}
                                seed={item.key}
                                className="size-10 rounded-lg"
                            />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-white">
                                    {item.title}
                                </span>
                                <span className="block truncate text-xs text-white/50">
                                    {item.artist}
                                </span>
                            </span>
                        </button>
                    </li>
                ))}
            </ol>
        </div>
    );
}

function Control({
    onClick,
    label,
    active,
    children,
}: {
    onClick: () => void;
    label: string;
    active?: boolean;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            aria-pressed={active}
            title={label}
            className={cn(
                'flex size-11 items-center justify-center rounded-full transition-colors',
                active
                    ? 'bg-white/15 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white',
            )}
        >
            {children}
        </button>
    );
}

export function FullPlayer({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const player = usePlayer();
    const reduce = useReducedMotion();
    const track = player.current;
    const tint = useCoverColor(track?.cover_url);
    const lyrics = useLyrics(track, open);
    const [view, setView] = useState<'cover' | 'lyrics'>('cover');
    const [direction, setDirection] = useState(1);

    useEffect(() => {
        if (open && !track) onOpenChange(false);
    }, [open, track, onOpenChange]);

    if (!track) return null;

    const go = (d: 1 | -1) => {
        setDirection(d);
        if (d === 1) next();
        else prev();
    };
    const RepeatIcon = player.repeat === 'one' ? Repeat1 : Repeat;
    const VolumeIcon =
        player.muted || player.volume === 0
            ? VolumeX
            : player.volume < 0.5
              ? Volume1
              : Volume2;
    const showLyrics = view === 'lyrics' && lyrics !== null;

    const info = (
        <div className="min-w-0">
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={track.key}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.25, ease: EASE_OUT }}
                >
                    <h2 className="truncate font-display text-2xl font-bold tracking-tight text-white lg:text-[2rem]">
                        {track.title}
                    </h2>
                    <p className="mt-1 truncate text-base text-white/60">
                        {track.artist}
                        {track.album && (
                            <span className="text-white/40">
                                {' '}
                                · {track.album}
                            </span>
                        )}
                    </p>
                </motion.div>
            </AnimatePresence>
        </div>
    );

    const progress = (
        <div>
            <Waveform
                seed={track.key}
                position={player.position}
                duration={player.duration}
                onSeek={seek}
            />
            <div className="mt-1.5 flex justify-between text-xs text-white/50 tabular-nums">
                <span>{formatDuration(player.position)}</span>
                <span>{formatDuration(player.duration)}</span>
            </div>
        </div>
    );

    const controls = (
        <div className="liquid-glass flex items-center justify-between rounded-[26px] px-3 py-2.5">
            <Control
                onClick={toggleShuffle}
                label={tr('Перемішати')}
                active={player.shuffle}
            >
                <Shuffle className="size-[18px]" />
            </Control>
            <Control onClick={() => go(-1)} label={tr('Попередній')}>
                <SkipBack className="size-6 fill-current" />
            </Control>
            <motion.button
                type="button"
                onClick={toggle}
                whileTap={reduce ? undefined : { scale: 0.92 }}
                transition={SNAP}
                aria-label={player.playing ? tr('Пауза') : tr('Відтворити')}
                className="flex size-16 items-center justify-center rounded-full bg-white text-[#0b0d1d] transition-colors hover:bg-white/90"
            >
                {player.loading && !player.playing ? (
                    <Loader2 className="size-7 animate-spin" />
                ) : player.playing ? (
                    <Pause className="size-7 fill-current" />
                ) : (
                    <Play className="ml-1 size-7 fill-current" />
                )}
            </motion.button>
            <Control onClick={() => go(1)} label={tr('Наступний')}>
                <SkipForward className="size-6 fill-current" />
            </Control>
            <Control
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
                <RepeatIcon className="size-[18px]" />
            </Control>
        </div>
    );

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <AnimatePresence>
                {open && (
                    <DialogPrimitive.Portal forceMount>
                        <DialogPrimitive.Content
                            forceMount
                            asChild
                            aria-describedby={undefined}
                        >
                            <motion.div
                                initial={
                                    reduce
                                        ? { opacity: 0 }
                                        : { opacity: 0, y: 40 }
                                }
                                animate={{ opacity: 1, y: 0 }}
                                exit={
                                    reduce
                                        ? { opacity: 0 }
                                        : { opacity: 0, y: 40 }
                                }
                                transition={motionOr(reduce, RISE)}
                                className="fixed inset-0 z-[60] overflow-hidden bg-background text-white focus:outline-none"
                                style={
                                    {
                                        '--tint': tint
                                            ? `rgb(${tint})`
                                            : 'var(--primary)',
                                    } as CSSProperties
                                }
                            >
                                <DialogPrimitive.Title className="sr-only">
                                    {tr('Зараз грає')}: {track.title}
                                </DialogPrimitive.Title>

                                {/* Тло: розмита обкладинка + колір обкладинки + затемнення під текст. */}
                                <div
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0"
                                >
                                    {track.cover_url && (
                                        <img
                                            src={track.cover_url}
                                            alt=""
                                            className="absolute inset-0 size-full scale-150 object-cover opacity-45 blur-[90px] transition-opacity duration-700"
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,color-mix(in_oklab,var(--tint)_55%,transparent),transparent_65%)] transition-[background] duration-700" />
                                    <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.15),rgb(0_0_0/0.35)_45%,rgb(0_0_0/0.75))]" />
                                </div>

                                <div className="relative mx-auto flex h-full max-w-6xl flex-col px-5 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.25rem)] lg:px-10">
                                    <header className="flex h-14 shrink-0 items-center gap-3">
                                        <DialogPrimitive.Close
                                            aria-label={tr('Згорнути плеєр')}
                                            className="flex size-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                                        >
                                            <ChevronDown className="size-6" />
                                        </DialogPrimitive.Close>
                                        <p className="min-w-0 flex-1 truncate text-center text-sm font-medium text-white/60">
                                            {tr('Зараз грає')}
                                        </p>
                                        {lyrics ? (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setView((v) =>
                                                        v === 'lyrics'
                                                            ? 'cover'
                                                            : 'lyrics',
                                                    )
                                                }
                                                aria-pressed={showLyrics}
                                                aria-label={tr('Текст пісні')}
                                                title={tr('Текст пісні')}
                                                className={cn(
                                                    'flex size-11 items-center justify-center rounded-full transition-colors lg:invisible',
                                                    showLyrics
                                                        ? 'bg-white/15 text-white'
                                                        : 'text-white/70 hover:bg-white/10 hover:text-white',
                                                )}
                                            >
                                                <MicVocal className="size-5" />
                                            </button>
                                        ) : (
                                            <span className="size-11" />
                                        )}
                                    </header>

                                    <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-center lg:gap-16">
                                        {/* Обкладинка (на телефоні міняється на текст). */}
                                        <div className="flex min-h-0 items-center justify-center">
                                            {showLyrics ? (
                                                <LyricsView
                                                    lyrics={lyrics}
                                                    position={player.position}
                                                    className="h-full w-full lg:hidden"
                                                />
                                            ) : null}
                                            <div
                                                className={cn(
                                                    showLyrics &&
                                                        'hidden lg:block',
                                                )}
                                            >
                                                <Stage
                                                    track={track}
                                                    playing={player.playing}
                                                    direction={direction}
                                                    onSwipe={go}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex min-h-0 flex-col gap-5">
                                            {info}
                                            {progress}
                                            {controls}
                                            <div className="hidden items-center gap-2 lg:flex">
                                                <button
                                                    type="button"
                                                    onClick={toggleMute}
                                                    aria-label={tr('Гучність')}
                                                    className="flex size-9 items-center justify-center rounded-full text-white/60 hover:text-white"
                                                >
                                                    <VolumeIcon className="size-[18px]" />
                                                </button>
                                                <input
                                                    type="range"
                                                    min={0}
                                                    max={1}
                                                    step={0.01}
                                                    value={
                                                        player.muted
                                                            ? 0
                                                            : player.volume
                                                    }
                                                    onChange={(e) =>
                                                        setVolume(
                                                            Number(
                                                                e.target.value,
                                                            ),
                                                        )
                                                    }
                                                    aria-label={tr('Гучність')}
                                                    className="gc-range w-40"
                                                    style={
                                                        {
                                                            '--value': `${(player.muted ? 0 : player.volume) * 100}%`,
                                                        } as CSSProperties
                                                    }
                                                />
                                            </div>
                                            {/* ПК: текст пісні або «далі в черзі» під керуванням. */}
                                            <div className="hidden min-h-0 lg:block">
                                                {lyrics ? (
                                                    <LyricsView
                                                        lyrics={lyrics}
                                                        position={
                                                            player.position
                                                        }
                                                        className="h-[min(32dvh,300px)]"
                                                    />
                                                ) : (
                                                    <UpNext
                                                        queue={player.queue}
                                                        index={player.index}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                )}
            </AnimatePresence>
        </DialogPrimitive.Root>
    );
}
