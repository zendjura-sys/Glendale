import {
    Airplay,
    FastForward,
    ListMusic,
    Loader2,
    MessageSquareQuote,
    Pause,
    Play,
    Repeat,
    Repeat1,
    Rewind,
    Shuffle,
    Volume1,
    Volume2,
    VolumeX,
} from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { OutputSheet } from '@/components/am/output-sheet';
import { TrackMenu } from '@/components/am/track-actions';
import { formatDuration } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { motionOr, SNAP } from '@/lib/motion';
import {
    cycleRepeat,
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
import { SpotifyLogo, TrackCover } from './track-cover';

type View = 'artwork' | 'lyrics' | 'queue';

/**
 * Плеєр ПК — плаваюча капсула з матового скла внизу вікна, як міні-плеєр на телефоні, але з усім
 * керуванням: обкладинка й назва (відкривають «Зараз грає»), перемішування, попередній / пауза /
 * наступний, повтор, прогрес із часом, гучність, текст, черга, вивід звуку й меню «⋯».
 * Однакова в «Музиці» (layouts/music-layout.tsx) і на решті сайту (components/music/player-bar.tsx).
 * Меню й аркуші з неї відкриваються вгору й лишаються над нею.
 */
export function PlayerCapsule({
    onOpen,
    extra,
}: {
    /** Відкрити «Зараз грає» (обкладинка, текст чи черга). */
    onOpen: (view?: View) => void;
    /** Додаткові кнопки праворуч (слухати разом, закрити плеєр). */
    extra?: ReactNode;
}) {
    const player = usePlayer();
    const reduce = useReducedMotion();
    const track = player.current;
    const [output, setOutput] = useState(false);
    const outputRef = useRef<HTMLDivElement>(null);

    // Аркуш «Вивід звуку» закривається кліком повз нього чи Esc.
    useEffect(() => {
        if (!output) return;
        const onDown = (e: PointerEvent) => {
            if (!outputRef.current?.contains(e.target as Node))
                setOutput(false);
        };
        const onKey = (e: KeyboardEvent) =>
            e.key === 'Escape' && setOutput(false);
        window.addEventListener('pointerdown', onDown);
        window.addEventListener('keydown', onKey);

        return () => {
            window.removeEventListener('pointerdown', onDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [output]);

    const live = track?.source === 'radio';
    const RepeatIcon = player.repeat === 'one' ? Repeat1 : Repeat;
    const VolumeIcon =
        player.muted || player.volume === 0
            ? VolumeX
            : player.volume < 0.5
              ? Volume1
              : Volume2;
    const volume = player.muted ? 0 : player.volume;
    const duration = player.duration;
    const percent =
        duration > 0 ? Math.min((player.position / duration) * 100, 100) : 0;
    const btn = (on = false) =>
        cn(
            'gc-capsule-btn flex size-9 shrink-0 items-center justify-center rounded-full transition disabled:pointer-events-none disabled:opacity-30',
            on && 'is-on',
        );

    return (
        <AnimatePresence>
            {track && (
                <m.div
                    key="capsule"
                    initial={reduce ? false : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, y: 20 }}
                    transition={motionOr(reduce, SNAP)}
                    className="glass-matte gc-capsule pointer-events-auto relative mx-auto flex h-16 w-full max-w-[1040px] items-center gap-2 rounded-full py-2 pr-3 pl-2 [view-transition-name:gc-player] xl:gap-3"
                >
                    <button
                        type="button"
                        onClick={() => onOpen()}
                        aria-label={tr('Зараз грає')}
                        title={tr('Зараз грає')}
                        className="flex w-[clamp(140px,18vw,240px)] min-w-0 shrink-0 items-center gap-3 rounded-full text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                        <span className="relative shrink-0">
                            <TrackCover
                                url={track.cover_url}
                                seed={track.key}
                                className="size-12 rounded-full object-cover"
                            />
                            {track.source === 'spotify' && (
                                <span className="absolute -right-0.5 -bottom-0.5 rounded-full bg-[#0b0d1d] p-0.5">
                                    <SpotifyLogo className="size-3" />
                                </span>
                            )}
                        </span>
                        <span className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold text-foreground">
                                {track.title}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                                {live ? tr('Пряма трансляція') : track.artist}
                            </span>
                        </span>
                    </button>

                    <div className="flex shrink-0 items-center">
                        <button
                            type="button"
                            onClick={toggleShuffle}
                            aria-label={tr('Перемішати')}
                            aria-pressed={player.shuffle}
                            disabled={live}
                            className={btn(player.shuffle)}
                        >
                            <Shuffle className="size-4" />
                        </button>
                        <button
                            type="button"
                            onClick={prev}
                            aria-label={tr('Попередній')}
                            disabled={live}
                            className={btn()}
                        >
                            <Rewind className="size-5 fill-current" />
                        </button>
                        <button
                            type="button"
                            onClick={toggle}
                            aria-label={
                                player.playing ? tr('Пауза') : tr('Відтворити')
                            }
                            className="gc-capsule-play mx-0.5 flex size-10 shrink-0 items-center justify-center rounded-full transition active:scale-95"
                        >
                            {player.loading && !player.playing ? (
                                <Loader2 className="size-5 animate-spin" />
                            ) : player.playing ? (
                                <Pause className="size-5 fill-current" />
                            ) : (
                                <Play className="ml-0.5 size-5 fill-current" />
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={next}
                            aria-label={tr('Наступний')}
                            disabled={live}
                            className={btn()}
                        >
                            <FastForward className="size-5 fill-current" />
                        </button>
                        <button
                            type="button"
                            onClick={cycleRepeat}
                            aria-label={
                                player.repeat === 'one'
                                    ? tr('Повторювати трек')
                                    : player.repeat === 'all'
                                      ? tr('Повторювати чергу')
                                      : tr('Без повтору')
                            }
                            aria-pressed={player.repeat !== 'off'}
                            disabled={live}
                            className={btn(player.repeat !== 'off')}
                        >
                            <RepeatIcon className="size-4" />
                        </button>
                    </div>

                    <div className="flex min-w-0 flex-1 items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
                        {live ? (
                            <span className="mx-auto">
                                {tr('Пряма трансляція')}
                            </span>
                        ) : (
                            <>
                                <span className="w-9 shrink-0 text-right">
                                    {formatDuration(player.position)}
                                </span>
                                <input
                                    type="range"
                                    min={0}
                                    max={duration || 1}
                                    step={duration > 10 ? 0.5 : 0.01}
                                    value={Math.min(
                                        player.position,
                                        duration || 1,
                                    )}
                                    onChange={(e) =>
                                        seek(Number(e.target.value))
                                    }
                                    aria-label={tr('Перемотати')}
                                    className="gc-capsule-range min-w-0 flex-1"
                                    style={
                                        {
                                            '--value': `${percent}%`,
                                        } as CSSProperties
                                    }
                                />
                                <span className="w-9 shrink-0">
                                    {formatDuration(duration)}
                                </span>
                            </>
                        )}
                    </div>

                    <div className="flex shrink-0 items-center">
                        <button
                            type="button"
                            onClick={toggleMute}
                            aria-label={tr('Гучність')}
                            className={btn()}
                        >
                            <VolumeIcon className="size-[18px]" />
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={volume}
                            onChange={(e) => setVolume(Number(e.target.value))}
                            aria-label={tr('Гучність')}
                            className="gc-capsule-range hidden w-20 xl:block"
                            style={
                                {
                                    '--value': `${volume * 100}%`,
                                } as CSSProperties
                            }
                        />
                    </div>

                    <div className="flex shrink-0 items-center">
                        <button
                            type="button"
                            onClick={() => onOpen('lyrics')}
                            aria-label={tr('Текст пісні')}
                            title={tr('Текст пісні')}
                            disabled={live}
                            className={btn()}
                        >
                            <MessageSquareQuote className="size-[18px]" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onOpen('queue')}
                            aria-label={tr('Далі в черзі')}
                            title={tr('Далі в черзі')}
                            className={btn()}
                        >
                            <ListMusic className="size-[18px]" />
                        </button>
                        <div ref={outputRef} className="relative">
                            <AnimatePresence>
                                {output && (
                                    <OutputSheet
                                        onClose={() => setOutput(false)}
                                        className="inset-x-auto right-0 mb-4 w-80"
                                    />
                                )}
                            </AnimatePresence>
                            <button
                                type="button"
                                onClick={() => setOutput((o) => !o)}
                                aria-label={tr('Вивід звуку')}
                                title={tr('Вивід звуку')}
                                aria-expanded={output}
                                className={btn(output)}
                            >
                                <Airplay className="size-[18px]" />
                            </button>
                        </div>
                        <TrackMenu
                            track={track}
                            side="top"
                            triggerClassName="gc-capsule-btn"
                        />
                        {extra}
                    </div>
                </m.div>
            )}
        </AnimatePresence>
    );
}

/** Кнопка в стилі капсули — для додаткових дій (`extra`). */
export function CapsuleButton({
    onClick,
    label,
    children,
}: {
    onClick: () => void;
    label: string;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className="gc-capsule-btn flex size-9 shrink-0 items-center justify-center rounded-full transition"
        >
            {children}
        </button>
    );
}
