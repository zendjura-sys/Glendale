import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
    ChevronLeft,
    Heart,
    ListMusic,
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
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import type { PanInfo } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { CSSProperties, ReactNode } from 'react';
import { api } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { activeLine, parseLyrics } from '@/lib/lyrics';
import type { Lyrics } from '@/lib/lyrics';
import { EASE_OUT, motionOr, RISE, SNAP } from '@/lib/motion';
import {
    cycleRepeat,
    jumpTo,
    next,
    patchTrack,
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
 * Повноекранний плеєр («Зараз грає») у фірмовому стилі: фіолетове тло з пурпурним сяйвом унизу,
 * кругла обкладинка з м’яким сяйвом, біла хвиля прогресу, кнопки з рідкого скла. Свайп по обкладинці —
 * інший трек, караоке-текст (LRC) і черга. Телефон — одна колонка (обкладинка ↔ текст/черга), ПК — дві.
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

/** Обкладинка-коло з м’яким сяйвом її ж кольору; свайп убік — інший трек. */
function Stage({
    track,
    direction,
    onSwipe,
}: {
    track: TrackCard;
    direction: number;
    onSwipe: (direction: 1 | -1) => void;
}) {
    const reduce = useReducedMotion();
    const end = (_: unknown, info: PanInfo) => {
        if (info.offset.x < -SWIPE || info.velocity.x < -600) onSwipe(1);
        else if (info.offset.x > SWIPE || info.velocity.x > 600) onSwipe(-1);
    };

    return (
        <div className="relative aspect-square w-[min(76vw,40dvh,380px)] lg:w-[min(32vw,58dvh,460px)]">
            {/* Сяйво: та сама обкладинка, сильно розмита, за колом. */}
            <div
                aria-hidden
                className="absolute inset-[6%] translate-y-[6%] rounded-full bg-[#a855f7] opacity-60 blur-[48px]"
            >
                {track.cover_url && (
                    <img
                        decoding="async"
                        src={track.cover_url}
                        alt=""
                        className="size-full rounded-full object-cover"
                    />
                )}
            </div>
            <AnimatePresence
                initial={false}
                custom={direction}
                mode="popLayout"
            >
                <m.div
                    key={track.key}
                    custom={direction}
                    variants={{
                        enter: (d: number) => ({
                            x: d * 70,
                            opacity: 0,
                            scale: 0.94,
                        }),
                        center: { x: 0, opacity: 1, scale: 1 },
                        exit: (d: number) => ({
                            x: d * -70,
                            opacity: 0,
                            scale: 0.94,
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
                        className="pointer-events-none size-full rounded-full ring-1 ring-white/20 select-none"
                    />
                </m.div>
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

/** Пласке матове скло: молочна заливка, сильне розмиття й тонкий світлий обідок — без тіней і відблисків. */
const GLASS =
    'bg-white/[0.14] ring-1 ring-white/30 ring-inset backdrop-blur-2xl backdrop-saturate-150';

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
                'relative flex size-12 items-center justify-center rounded-full transition-colors',
                active ? 'text-white' : 'text-white/75 hover:text-white',
            )}
        >
            {children}
            {active && (
                <span className="absolute bottom-0.5 size-1 rounded-full bg-white" />
            )}
        </button>
    );
}

/** Кругла скляна кнопка шапки (згорнути, улюблене). */
function GlassButton({
    onClick,
    label,
    pressed,
    children,
}: {
    onClick?: () => void;
    label: string;
    pressed?: boolean;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            aria-pressed={pressed}
            title={label}
            className={cn(
                'flex size-12 items-center justify-center rounded-full text-white transition-[background-color,transform] hover:bg-white/20 active:scale-95',
                GLASS,
            )}
        >
            {children}
        </button>
    );
}

/** Тло як у фірмовому плеєрі: бузковий верх, глибокий індиго посередині, пурпурне сяйво внизу. */
const BACKDROP = [
    'radial-gradient(120% 55% at 50% -5%, rgb(110 72 230 / 0.95), transparent 62%)',
    'radial-gradient(70% 45% at 8% 38%, rgb(124 58 237 / 0.55), transparent 70%)',
    'radial-gradient(70% 45% at 95% 45%, rgb(67 56 202 / 0.6), transparent 70%)',
    'radial-gradient(130% 50% at 50% 108%, rgb(192 38 211 / 0.95), rgb(147 51 234 / 0.55) 40%, transparent 72%)',
    'linear-gradient(180deg, #2b1a86 0%, #170f55 45%, #1b1063 68%, #5b21b6 100%)',
].join(', ');

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
    const lyrics = useLyrics(track, open);
    const [view, setView] = useState<'cover' | 'lyrics' | 'queue'>('cover');
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
    const flip = (target: 'lyrics' | 'queue') =>
        setView((v) => (v === target ? 'cover' : target));
    const toggleLibrary = async () => {
        if (track.source !== 'local') return;
        const saved = !track.in_library;
        patchTrack(track.key, { in_library: saved });
        try {
            await api(
                saved ? 'POST' : 'DELETE',
                `/music/tracks/${track.id}/library`,
            );
            toast.success(
                saved
                    ? tr('Додано до ваших аудіозаписів.')
                    : tr('Прибрано з ваших аудіозаписів.'),
            );
        } catch {
            patchTrack(track.key, { in_library: !saved });
        }
    };
    const RepeatIcon = player.repeat === 'one' ? Repeat1 : Repeat;
    const VolumeIcon =
        player.muted || player.volume === 0
            ? VolumeX
            : player.volume < 0.5
              ? Volume1
              : Volume2;
    const showLyrics = view === 'lyrics' && lyrics !== null;
    const showQueue = view === 'queue';
    const saved = track.source === 'local' && track.in_library;

    const info = (
        <AnimatePresence mode="wait" initial={false}>
            <m.div
                key={track.key}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
                className="min-w-0 text-center lg:text-left"
            >
                <h2 className="truncate font-display text-[1.65rem] leading-tight font-semibold tracking-tight text-white lg:text-[2.1rem]">
                    {track.title}
                </h2>
                <p className="mt-1.5 truncate text-[0.95rem] text-white/70">
                    {track.artist}
                    {track.album && (
                        <span className="text-white/45"> · {track.album}</span>
                    )}
                </p>
            </m.div>
        </AnimatePresence>
    );

    const progress = (
        <div>
            <Waveform
                seed={track.key}
                position={player.position}
                duration={player.duration}
                onSeek={seek}
                count={64}
                rest="bg-white/35"
                played="bg-white"
                className="h-14 [&>div]:gap-[3px]"
            />
            <div className="mt-2 flex justify-between text-sm text-white/75 tabular-nums">
                <span>{formatDuration(player.position)}</span>
                <span>{formatDuration(player.duration)}</span>
            </div>
        </div>
    );

    const controls = (
        <div className="flex items-center justify-between">
            <Control
                onClick={toggleShuffle}
                label={tr('Перемішати')}
                active={player.shuffle}
            >
                <Shuffle className="size-[22px]" />
            </Control>
            <Control onClick={() => go(-1)} label={tr('Попередній')}>
                <SkipBack className="size-7 fill-current" />
            </Control>
            <m.button
                type="button"
                onClick={toggle}
                whileTap={reduce ? undefined : { scale: 0.92 }}
                transition={SNAP}
                aria-label={player.playing ? tr('Пауза') : tr('Відтворити')}
                className={cn(
                    'flex size-[84px] items-center justify-center rounded-full text-white transition-colors hover:bg-white/20',
                    GLASS,
                )}
            >
                {player.loading && !player.playing ? (
                    <Loader2 className="size-8 animate-spin" />
                ) : player.playing ? (
                    <Pause className="size-8 fill-current" />
                ) : (
                    <Play className="ml-1 size-8 fill-current" />
                )}
            </m.button>
            <Control onClick={() => go(1)} label={tr('Наступний')}>
                <SkipForward className="size-7 fill-current" />
            </Control>
            <Control
                onClick={() => flip('queue')}
                label={tr('Далі в черзі')}
                active={showQueue}
            >
                <ListMusic className="size-[22px]" />
            </Control>
        </div>
    );

    // Другорядне: повтор, текст пісні, на ПК — гучність.
    const extras = (
        <div className="flex items-center justify-center gap-2 lg:justify-start">
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
            {lyrics && (
                <Control
                    onClick={() => flip('lyrics')}
                    label={tr('Текст пісні')}
                    active={showLyrics}
                >
                    <MicVocal className="size-[18px]" />
                </Control>
            )}
            <div className="ml-2 hidden items-center gap-2 lg:flex">
                <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={tr('Гучність')}
                    className="flex size-9 items-center justify-center rounded-full text-white/70 hover:text-white"
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
                    className="gc-range w-40"
                    style={
                        {
                            '--value': `${(player.muted ? 0 : player.volume) * 100}%`,
                        } as CSSProperties
                    }
                />
            </div>
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
                            <m.div
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
                                className="fixed inset-0 z-[60] overflow-hidden bg-[#170f55] text-white focus:outline-none"
                                style={{ backgroundImage: BACKDROP }}
                            >
                                <DialogPrimitive.Title className="sr-only">
                                    {tr('Зараз грає')}: {track.title}
                                </DialogPrimitive.Title>

                                <div className="relative mx-auto flex h-full max-w-6xl flex-col px-6 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:px-10">
                                    <header className="flex h-14 shrink-0 items-center gap-3">
                                        <DialogPrimitive.Close asChild>
                                            <GlassButton
                                                label={tr('Згорнути плеєр')}
                                            >
                                                <ChevronLeft className="size-6" />
                                            </GlassButton>
                                        </DialogPrimitive.Close>
                                        <p className="min-w-0 flex-1 truncate text-center text-lg font-medium text-white">
                                            {tr('Зараз грає')}
                                        </p>
                                        {track.source === 'local' ? (
                                            <GlassButton
                                                onClick={toggleLibrary}
                                                pressed={saved}
                                                label={
                                                    saved
                                                        ? tr(
                                                              'Прибрати з моїх аудіозаписів',
                                                          )
                                                        : tr(
                                                              'Додати до моїх аудіозаписів',
                                                          )
                                                }
                                            >
                                                <Heart
                                                    className={cn(
                                                        'size-[22px] transition-colors',
                                                        saved &&
                                                            'fill-current text-[#f472d0]',
                                                    )}
                                                />
                                            </GlassButton>
                                        ) : (
                                            <span className="size-12" />
                                        )}
                                    </header>

                                    <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-center lg:gap-16">
                                        {/* Обкладинка; на телефоні її місце займає текст пісні чи черга. */}
                                        <div className="flex min-h-0 items-center justify-center">
                                            {showLyrics && (
                                                <LyricsView
                                                    lyrics={lyrics}
                                                    position={player.position}
                                                    className="h-full w-full lg:hidden"
                                                />
                                            )}
                                            {showQueue && (
                                                <div className="h-full w-full overflow-y-auto pt-4 lg:hidden">
                                                    <UpNext
                                                        queue={player.queue}
                                                        index={player.index}
                                                    />
                                                </div>
                                            )}
                                            <div
                                                className={cn(
                                                    (showLyrics || showQueue) &&
                                                        'hidden lg:block',
                                                )}
                                            >
                                                <Stage
                                                    track={track}
                                                    direction={direction}
                                                    onSwipe={go}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex min-h-0 flex-col gap-6">
                                            {info}
                                            {progress}
                                            {controls}
                                            {extras}
                                            {/* ПК: текст пісні або «далі в черзі» під керуванням. */}
                                            <div className="hidden min-h-0 lg:block">
                                                {lyrics ? (
                                                    <LyricsView
                                                        lyrics={lyrics}
                                                        position={
                                                            player.position
                                                        }
                                                        className="h-[min(28dvh,260px)]"
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
                            </m.div>
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                )}
            </AnimatePresence>
        </DialogPrimitive.Root>
    );
}
