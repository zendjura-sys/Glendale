import { Link, router, usePage } from '@inertiajs/react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
    Airplay,
    AudioLines,
    Blend,
    ChevronDown,
    FastForward,
    GripHorizontal,
    Infinity as InfinityIcon,
    Languages,
    ListMusic,
    Loader2,
    MessageSquareQuote,
    MicVocal,
    MoonStar,
    Pause,
    Play,
    Repeat,
    Repeat1,
    Rewind,
    Share,
    Shuffle,
    Star,
    Volume1,
    Volume2,
    X,
} from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import type { PanInfo } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type {
    CSSProperties,
    PointerEvent as ReactPointerEvent,
    ReactNode,
} from 'react';
import { toast } from 'sonner';
import { DevicesButton, RemoteLine } from '@/components/music/connect-ui';
import { TrackCover } from '@/components/music/track-cover';
import { api } from '@/lib/api';
import { usePlayback } from '@/lib/connect';
import { setSing as setSingLevel } from '@/lib/audio-graph';
import { useCoverColor } from '@/lib/cover-color';
import { formatDuration } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { activeLine, parseLyrics } from '@/lib/lyrics';
import type { Lyrics } from '@/lib/lyrics';
import { EASE_OUT, motionOr, RISE, SNAP } from '@/lib/motion';
import {
    audioElement,
    getPlayerState,
    clearUpNext,
    cycleRepeat,
    jumpTo,
    moveInQueue,
    removeFromQueue,
    seek,
    setCrossfade,
    setLyricsTranslate,
    setNormalizeVolume,
    setSleepTimer,
    toggleAutoplay,
    toggleShuffle,
    usePlayer,
} from '@/lib/player';
import { cn } from '@/lib/utils';
import type { TrackCard } from '@/types';
import { OutputSheet } from './output-sheet';
import { QualityBadge } from './ui';
import {
    artistHref,
    toggleFavorite,
    TrackMenu,
    useTrack,
    useTrackActions,
} from './track-actions';

/**
 * «Зараз грає» як в Apple Music (iOS 26): тло з кольорів обкладинки, велика обкладинка, що
 * зменшується на паузі, назва з зірочкою «Улюблене» й меню «⋯», прогрес зі значком якості,
 * кнопки, гучність і нижній ряд — текст пісні, вивід звуку, черга.
 * Текст — караоке рядками, «Караоке» (мікрофон) приглушує голос. Черга — «Далі в черзі»
 * з перемішуванням, повтором і ∞ (автовідтворення схожих), історія й перетягування.
 * На ПК — дві колонки: обкладинка й керування ліворуч, текст чи черга праворуч.
 */

type View = 'artwork' | 'lyrics' | 'queue';

// ───────────────────────── Текст пісні ─────────────────────────

const lyricsCache = new Map<string, Lyrics | null>();

function lyricsUrl(track: TrackCard | null): string | null {
    if (!track) return null;
    if (track.source === 'local') return `/music/tracks/${track.id}/lyrics`;
    if (track.source === 'spotify') {
        const q = new URLSearchParams({
            artist: track.artist,
            title: track.title,
        });
        if (track.duration > 0)
            q.set('duration', String(Math.round(track.duration)));

        return `/music/lyrics/find?${q}`;
    }

    return null;
}

/** Текст пісні: undefined — завантажується, null — немає. Свій трек сервер шукає в каталозі LRCLIB. */
function useLyrics(track: TrackCard | null): Lyrics | null | undefined {
    const url = lyricsUrl(track);
    const [lyrics, setLyrics] = useState<Lyrics | null | undefined>(
        url === null ? null : lyricsCache.get(url),
    );

    useEffect(() => {
        if (url === null) {
            setLyrics(null);

            return;
        }
        if (lyricsCache.has(url)) {
            setLyrics(lyricsCache.get(url));

            return;
        }
        let alive = true;
        setLyrics(undefined);
        void api<{ lyrics: string | null }>('GET', url)
            .then((r) => {
                const text = r.lyrics?.trim();
                const parsed = text ? parseLyrics(text) : null;
                lyricsCache.set(url, parsed);
                if (alive) setLyrics(parsed);
            })
            .catch(() => alive && setLyrics(null));

        return () => {
            alive = false;
        };
    }, [url]);

    return lyrics;
}

// ───────────────────────── «Караоке»: приглушення голосу (lib/audio-graph.ts) ─────────────────────────

const setSing = (level: number) => setSingLevel(audioElement(), level);

// ───────────────────────── Частини екрана ─────────────────────────

function Progress({ live }: { live: boolean }) {
    const player = usePlayback();
    const { seek } = player;
    const actions = useTrackActions();
    const bar = useRef<HTMLDivElement>(null);
    const [drag, setDrag] = useState<number | null>(null);
    const duration = player.duration;
    const position = drag ?? player.position;
    const ratio = duration > 0 ? Math.min(position / duration, 1) : 0;
    const track = player.current;
    const quality = track?.source === 'local' ? track.quality : null;

    const at = (clientX: number) => {
        const r = bar.current?.getBoundingClientRect();
        if (!r || duration <= 0) return 0;

        return (
            Math.min(Math.max((clientX - r.left) / r.width, 0), 1) * duration
        );
    };

    if (live) {
        return (
            <div className="flex items-center justify-center gap-2 py-3">
                <span className="rounded-md bg-[var(--am-accent)] px-2 py-0.5 text-[11px] font-bold tracking-wide text-white">
                    LIVE
                </span>
                <span className="text-[13px] text-white/70">
                    {tr('Пряма трансляція')}
                </span>
            </div>
        );
    }

    return (
        <div>
            <div
                ref={bar}
                role="slider"
                tabIndex={0}
                aria-label={tr('Перемотати')}
                aria-valuemin={0}
                aria-valuemax={Math.round(duration)}
                aria-valuenow={Math.round(position)}
                onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setDrag(at(e.clientX));
                }}
                onPointerMove={(e) => drag !== null && setDrag(at(e.clientX))}
                onPointerUp={(e) => {
                    if (drag !== null) seek(at(e.clientX));
                    setDrag(null);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') seek(player.position + 5);
                    if (e.key === 'ArrowLeft') seek(player.position - 5);
                }}
                className="group flex h-6 cursor-pointer touch-none items-center"
            >
                <div
                    className={cn(
                        'relative w-full overflow-hidden rounded-full bg-white/25 transition-[height]',
                        drag !== null ? 'h-3' : 'h-[7px]',
                    )}
                >
                    <span
                        className="absolute inset-y-0 left-0 bg-white/85"
                        style={{ width: `${ratio * 100}%` }}
                    />
                </div>
            </div>
            <div className="flex items-center justify-between text-[12px] font-medium text-white/60 tabular-nums">
                <span>{formatDuration(position)}</span>
                {track && (quality === 'lossless' || quality === 'hires') ? (
                    <button
                        type="button"
                        onClick={() => actions.info(track)}
                        aria-label={tr('Відомості про пісню')}
                    >
                        <QualityBadge
                            quality={quality}
                            className="bg-white/15 text-white/80 transition hover:bg-white/25"
                        />
                    </button>
                ) : null}
                <span>-{formatDuration(Math.max(duration - position, 0))}</span>
            </div>
        </div>
    );
}

/**
 * «⏪ / ⏩» як в Apple Music: дотик — попередній чи наступний трек, утримання — перемотка
 * (що довше тримаєш, то швидше).
 */
function SkipButton({
    direction,
    disabled,
    remote,
    onStep,
    label,
    className,
    children,
}: {
    direction: 1 | -1;
    disabled: boolean;
    /** Інший пристрій: лише дотик (перемотка утриманням — тільки тут). */
    remote: boolean;
    onStep: () => void;
    label: string;
    className: string;
    children: ReactNode;
}) {
    const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const held = useRef(false);
    const since = useRef(0);

    const stop = () => {
        clearTimeout(timer.current);
        clearInterval(timer.current);
        timer.current = undefined;
    };

    return (
        <button
            type="button"
            disabled={disabled}
            aria-label={label}
            className={className}
            onPointerDown={() => {
                held.current = false;
                since.current = Date.now();
                if (remote) return;
                timer.current = setTimeout(() => {
                    held.current = true;
                    timer.current = setInterval(() => {
                        const speed = Date.now() - since.current > 2500 ? 6 : 2;
                        seek(getPlayerState().position + direction * speed);
                    }, 200);
                }, 400);
            }}
            onPointerUp={stop}
            onPointerLeave={stop}
            onPointerCancel={stop}
            onClick={() => {
                if (held.current) {
                    held.current = false;

                    return;
                }
                onStep();
            }}
        >
            {children}
        </button>
    );
}

function Controls({ live }: { live: boolean }) {
    const player = usePlayback();
    const reduce = useReducedMotion();
    const btn =
        'flex size-16 items-center justify-center rounded-full text-white transition active:scale-90 disabled:opacity-30';

    return (
        <div className="flex items-center justify-around py-2">
            <SkipButton
                direction={-1}
                disabled={live}
                remote={!!player.remote}
                onStep={player.prev}
                label={tr('Попередній')}
                className={btn}
            >
                <Rewind className="size-9 fill-current" />
            </SkipButton>
            <m.button
                type="button"
                onClick={player.toggle}
                whileTap={reduce ? undefined : { scale: 0.85 }}
                transition={SNAP}
                aria-label={player.playing ? tr('Пауза') : tr('Відтворити')}
                className={btn}
            >
                {player.loading && !player.playing ? (
                    <Loader2 className="size-10 animate-spin" />
                ) : player.playing ? (
                    <Pause className="size-12 fill-current" />
                ) : (
                    <Play className="ml-1 size-12 fill-current" />
                )}
            </m.button>
            <SkipButton
                direction={1}
                disabled={live}
                remote={!!player.remote}
                onStep={player.next}
                label={tr('Наступний')}
                className={btn}
            >
                <FastForward className="size-9 fill-current" />
            </SkipButton>
        </div>
    );
}

function Volume() {
    const player = usePlayback();
    const value = player.muted ? 0 : player.volume;

    return (
        <div className="flex items-center gap-3 py-2 text-white/60">
            <Volume1 className="size-4 shrink-0" />
            <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={value}
                onChange={(e) => player.setVolume(Number(e.target.value))}
                aria-label={tr('Гучність')}
                className="am-np-range flex-1"
                style={{ '--value': `${value * 100}%` } as CSSProperties}
            />
            <Volume2 className="size-4 shrink-0" />
        </div>
    );
}

function BottomRow({
    view,
    onView,
    live,
}: {
    view: View;
    onView: (v: View) => void;
    live: boolean;
}) {
    const [output, setOutput] = useState(false);
    const btn = (on: boolean) =>
        cn(
            'flex size-11 items-center justify-center rounded-full text-white/75 transition active:scale-90 disabled:opacity-30',
            on && 'bg-white/20 text-white',
        );

    return (
        <div className="relative flex items-center justify-around pt-1 pb-2">
            <AnimatePresence>
                {output && <OutputSheet onClose={() => setOutput(false)} />}
            </AnimatePresence>
            <button
                type="button"
                onClick={() => onView(view === 'lyrics' ? 'artwork' : 'lyrics')}
                disabled={live}
                aria-label={tr('Текст пісні')}
                aria-pressed={view === 'lyrics'}
                className={btn(view === 'lyrics')}
            >
                <MessageSquareQuote className="size-[22px]" />
            </button>
            <button
                type="button"
                onClick={() => setOutput((o) => !o)}
                aria-label={tr('Вивід звуку')}
                aria-expanded={output}
                className={btn(output)}
            >
                <Airplay className="size-[22px]" />
            </button>
            <DevicesButton
                className={btn(false)}
                iconClassName="size-[22px]"
                wrapperClassName="static"
                sheetClassName="inset-x-0 w-auto"
            />
            <button
                type="button"
                onClick={() => onView(view === 'queue' ? 'artwork' : 'queue')}
                aria-label={tr('Далі в черзі')}
                aria-pressed={view === 'queue'}
                className={btn(view === 'queue')}
            >
                <ListMusic className="size-[22px]" />
            </button>
        </div>
    );
}

function TitleRow({ track, compact }: { track: TrackCard; compact?: boolean }) {
    const t = useTrack(track);
    const local = t.source === 'local' ? t : null;

    return (
        <div
            className={cn(
                'flex items-center gap-3',
                compact ? 'min-w-0 flex-1' : '',
            )}
        >
            <div className="min-w-0 flex-1">
                <p
                    className={cn(
                        'truncate font-semibold text-white',
                        compact ? 'text-[15px]' : 'text-[20px] leading-6',
                    )}
                >
                    {t.title}
                </p>
                {t.source === 'radio' || !t.artist ? (
                    <p
                        className={cn(
                            'truncate text-white/60',
                            compact ? 'text-[13px]' : 'text-[19px] leading-6',
                        )}
                    >
                        {t.source === 'radio'
                            ? tr('Пряма трансляція')
                            : t.artist}
                    </p>
                ) : (
                    <Link
                        href={artistHref(t.artist)}
                        className={cn(
                            'block max-w-full truncate text-white/60 transition hover:text-white/85 hover:underline',
                            compact ? 'text-[13px]' : 'text-[19px] leading-6',
                        )}
                    >
                        {t.artist}
                    </Link>
                )}
            </div>
            {local && (
                <button
                    type="button"
                    onClick={() => void toggleFavorite(local)}
                    aria-label={
                        local.favorite
                            ? tr('Прибрати з улюбленого')
                            : tr('Улюблене')
                    }
                    aria-pressed={local.favorite}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition active:scale-90"
                >
                    <Star
                        className={cn(
                            'size-[17px]',
                            local.favorite && 'fill-current',
                        )}
                    />
                </button>
            )}
            <TrackMenu
                track={t}
                triggerClassName="size-8 bg-white/15 text-white hover:bg-white/25 data-[state=open]:bg-white/25"
            />
        </div>
    );
}

/** Рядки тексту без міток часу — так само, як їх бачить перекладач на сервері (ContentTranslator::lyrics). */
function sourceLines(text: string): string[] {
    return text
        .replace(/\r/g, '')
        .split('\n')
        .map((line) => line.replace(/^(\[[0-9:.]+\]\s*)+/, '').trim())
        .filter((line) => !/^\[[a-z]+:.*\]$/i.test(line));
}

/** Переклад тексту пісні (DeepL, як для дописів): «оригінальний рядок → переклад». */
function useLyricsTranslation(trackId: number | null, enabled: boolean) {
    const [map, setMap] = useState<Map<string, string> | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setMap(null);
        if (!enabled || trackId === null) return;
        let alive = true;
        setLoading(true);
        void Promise.all([
            api<{ lyrics: string | null }>(
                'GET',
                `/music/tracks/${trackId}/lyrics`,
            ),
            api<{ translation: string; same: boolean }>('POST', '/translate', {
                type: 'track',
                id: trackId,
            }),
        ])
            .then(([source, result]) => {
                if (!alive || result.same || !source.lyrics) return;
                const original = sourceLines(source.lyrics);
                const translated = result.translation.split('\n');
                const next = new Map<string, string>();
                original.forEach((line, i) => {
                    const t = translated[i]?.trim();
                    if (line && t && t !== line) next.set(line, t);
                });
                setMap(next);
            })
            .catch(() => {
                if (alive) toast.error(tr('Не вдалося перекласти текст.'));
            })
            .finally(() => alive && setLoading(false));

        return () => {
            alive = false;
        };
    }, [trackId, enabled]);

    return { map, loading };
}

/** Картка з рядками пісні для «Поділитися» (1080×1350): колір обкладинки, назва, рядки, GameCon. */
async function lyricsCard(
    lines: string[],
    track: TrackCard,
    tint: string | null,
): Promise<Blob | null> {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const base = tint ? `rgb(${tint})` : '#1d4fd1';
    const g = ctx.createLinearGradient(0, 0, 0, 1350);
    g.addColorStop(0, base);
    g.addColorStop(1, '#050913');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1080, 1350);
    const font = (w: number, size: number) =>
        `${w} ${size}px -apple-system, 'SF Pro Display', Inter, 'Segoe UI', Roboto, sans-serif`;

    let x = 96;
    if (track.cover_url) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = track.cover_url;
        try {
            await img.decode();
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(96, 110, 150, 150, 18);
            ctx.clip();
            ctx.drawImage(img, 96, 110, 150, 150);
            ctx.restore();
            x = 280;
        } catch {
            // Обкладинка з іншого домену без дозволу — картка без неї.
        }
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = font(700, 44);
    ctx.fillText(track.title.slice(0, 32), x, 175);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = font(500, 36);
    ctx.fillText(track.artist.slice(0, 36), x, 228);

    // Рядки: великим жирним шрифтом, з переносом за шириною.
    ctx.fillStyle = '#ffffff';
    ctx.font = font(800, 66);
    let y = 420;
    for (const line of lines) {
        let row = '';
        for (const word of line.split(' ')) {
            const test = row ? `${row} ${word}` : word;
            if (ctx.measureText(test).width > 888 && row) {
                ctx.fillText(row, 96, y);
                y += 82;
                row = word;
            } else row = test;
        }
        ctx.fillText(row, 96, y);
        y += 104;
        if (y > 1180) break;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = font(700, 34);
    ctx.fillText('GameCon', 96, 1270);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

async function shareLyrics(
    lines: string[],
    track: TrackCard,
    tint: string | null,
) {
    const blob = await lyricsCard(lines, track, tint);
    if (!blob) return;
    const file = new File([blob], 'gamecon-lyrics.png', { type: 'image/png' });
    try {
        if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: `${track.title} — ${track.artist}`,
            });

            return;
        }
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError')
            return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(tr('Картку з текстом збережено.'));
}

function LyricsPanel({
    lyrics,
    singing,
    onSing,
    tint,
}: {
    lyrics: Lyrics;
    singing: number;
    onSing: (v: number) => void;
    tint: string | null;
}) {
    const player = usePlayer();
    const { site } = usePage().props;
    const reduce = useReducedMotion();
    const box = useRef<HTMLDivElement>(null);
    const touched = useRef(0);
    const current = lyrics.timed
        ? activeLine(lyrics.lines, player.position)
        : -1;
    const [singOpen, setSingOpen] = useState(false);
    const [selecting, setSelecting] = useState(false);
    const [picked, setPicked] = useState<number[]>([]);
    const track = player.current;
    const local = track?.source === 'local' ? track : null;
    const canTranslate = !!local && !!site.translate;
    const { map: translation, loading: translating } = useLyricsTranslation(
        local?.id ?? null,
        canTranslate && player.lyricsTranslate,
    );

    useEffect(() => {
        setSelecting(false);
        setPicked([]);
    }, [track?.key]);

    useEffect(() => {
        const el = box.current;
        if (
            !el ||
            selecting ||
            current < 0 ||
            Date.now() - touched.current < 3000
        )
            return;
        const line = el.querySelector<HTMLElement>(`[data-line="${current}"]`);
        if (!line) return;
        el.scrollTo({
            top: line.offsetTop - el.clientHeight * 0.3,
            behavior: reduce ? 'auto' : 'smooth',
        });
    }, [current, reduce, selecting]);

    const pick = (i: number) =>
        setPicked((list) =>
            list.includes(i)
                ? list.filter((n) => n !== i)
                : list.length >= 6
                  ? list
                  : [...list, i].sort((a, b) => a - b),
        );

    const tool = (on: boolean) =>
        cn(
            'flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold backdrop-blur-xl transition',
            on ? 'bg-white text-black' : 'bg-white/20 text-white',
        );

    return (
        <div className="relative h-full min-h-0">
            <div
                ref={box}
                onWheel={() => (touched.current = Date.now())}
                onTouchMove={() => (touched.current = Date.now())}
                className="h-full [scrollbar-width:none] overflow-y-auto overscroll-contain [mask-image:linear-gradient(transparent,#000_8%,#000_80%,transparent)]"
            >
                <div className="py-[18%] pr-14">
                    {lyrics.lines.map((line, i) => {
                        const timed = lyrics.timed;
                        const distance =
                            current < 0 ? 2 : Math.abs(i - current);
                        const active = !timed || i === current;
                        const chosen = picked.includes(i);
                        const translated = translation?.get(line.text);

                        return (
                            <button
                                key={i}
                                type="button"
                                data-line={i}
                                onClick={() =>
                                    selecting
                                        ? pick(i)
                                        : timed && seek(line.time ?? 0)
                                }
                                style={{
                                    filter:
                                        reduce || active || selecting
                                            ? undefined
                                            : `blur(${Math.min(distance, 3) * 0.6}px)`,
                                }}
                                className={cn(
                                    'block w-full origin-left rounded-xl py-2 text-left font-bold tracking-tight transition-[color,filter,transform,background-color] duration-500',
                                    timed
                                        ? 'text-[30px] leading-[1.15] lg:text-[36px]'
                                        : 'text-[24px] leading-snug',
                                    selecting
                                        ? chosen
                                            ? 'bg-white/20 px-2 text-white'
                                            : 'px-2 text-white/45'
                                        : timed && i === current
                                          ? 'scale-100 text-white'
                                          : timed
                                            ? 'scale-[0.98] text-white/35 hover:text-white/60'
                                            : 'text-white/85',
                                )}
                            >
                                {line.text || '♪'}
                                {translated && (
                                    <span className="mt-1 block text-[17px] leading-snug font-semibold text-white/60 lg:text-[19px]">
                                        {translated}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Верхні дії: переклад (вмикається й вимикається) і «Поділитися рядками». */}
            <div className="absolute top-0 right-0 flex gap-1.5">
                {canTranslate && (
                    <button
                        type="button"
                        onClick={() =>
                            setLyricsTranslate(!player.lyricsTranslate)
                        }
                        aria-pressed={player.lyricsTranslate}
                        title={
                            player.lyricsTranslate
                                ? tr('Вимкнути переклад')
                                : tr('Показувати переклад')
                        }
                        className={tool(player.lyricsTranslate)}
                    >
                        {translating ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Languages className="size-4" />
                        )}
                        {tr('Переклад')}
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => {
                        setSelecting((s) => !s);
                        setPicked(current >= 0 ? [current] : []);
                    }}
                    aria-pressed={selecting}
                    aria-label={tr('Поділитися рядками')}
                    className={tool(selecting)}
                >
                    {selecting ? (
                        <X className="size-4" />
                    ) : (
                        <Share className="size-4" />
                    )}
                </button>
            </div>

            {selecting && track && (
                <div className="absolute inset-x-0 bottom-4 flex justify-center">
                    <button
                        type="button"
                        disabled={picked.length === 0}
                        onClick={() =>
                            void shareLyrics(
                                picked.map((i) => lyrics.lines[i].text),
                                track,
                                tint,
                            ).then(() => {
                                setSelecting(false);
                                setPicked([]);
                            })
                        }
                        className="flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-semibold text-black shadow-xl disabled:opacity-50"
                    >
                        <Share className="size-4" />
                        {picked.length > 0
                            ? tr('Поділитися ({n})', { n: picked.length })
                            : tr('Оберіть рядки')}
                    </button>
                </div>
            )}

            {/* «Караоке»: кнопка-мікрофон і вертикальний повзунок гучності голосу, як Apple Music Sing. */}
            {local && !selecting && (
                <div className="absolute right-0 bottom-4 flex flex-col items-center gap-2">
                    <AnimatePresence>
                        {singOpen && (
                            <m.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 8 }}
                                className="relative h-40 w-12 overflow-hidden rounded-2xl bg-white/20 backdrop-blur-xl"
                            >
                                <span
                                    className="absolute inset-x-0 bottom-0 bg-white/90"
                                    style={{
                                        height: `${(1 - singing) * 100}%`,
                                    }}
                                />
                                <input
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    value={1 - singing}
                                    onChange={(e) =>
                                        onSing(1 - Number(e.target.value))
                                    }
                                    aria-label={tr('Гучність голосу')}
                                    className="absolute inset-0 cursor-pointer opacity-0 [direction:rtl] [writing-mode:vertical-lr]"
                                />
                            </m.div>
                        )}
                    </AnimatePresence>
                    <button
                        type="button"
                        onClick={() => setSingOpen((o) => !o)}
                        aria-label={tr('Караоке')}
                        aria-pressed={singing > 0}
                        className={cn(
                            'flex size-12 items-center justify-center rounded-2xl backdrop-blur-xl transition',
                            singing > 0
                                ? 'bg-white text-black'
                                : 'bg-white/20 text-white',
                        )}
                    >
                        <MicVocal className="size-6" />
                    </button>
                </div>
            )}
        </div>
    );
}

/** Перетягування в черзі: тримайте за «≡» і ведіть угору чи вниз. */
function QueueRow({
    track,
    index,
    rowHeight,
    onMove,
}: {
    track: TrackCard;
    index: number;
    rowHeight: number;
    onMove: (from: number, to: number) => void;
}) {
    const [offset, setOffset] = useState<number | null>(null);
    const start = useRef(0);

    const down = (e: ReactPointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = e.clientY;
        setOffset(0);
    };
    const move = (e: ReactPointerEvent) =>
        offset !== null && setOffset(e.clientY - start.current);
    const up = () => {
        if (offset !== null) {
            const steps = Math.round(offset / rowHeight);
            if (steps !== 0) onMove(index, index + steps);
        }
        setOffset(null);
    };

    return (
        <li
            className={cn(
                'relative flex items-center gap-3 py-1.5',
                offset !== null && 'z-10 rounded-xl bg-white/15 shadow-xl',
            )}
            style={{
                height: rowHeight,
                transform:
                    offset !== null ? `translateY(${offset}px)` : undefined,
            }}
        >
            <button
                type="button"
                onClick={() => jumpTo(index)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
                <TrackCover
                    url={track.cover_url}
                    seed={track.key}
                    className="size-11 shrink-0 rounded-[5px]"
                />
                <span className="min-w-0">
                    <span className="block truncate text-[15px] text-white">
                        {track.title}
                    </span>
                    <span className="block truncate text-[13px] text-white/55">
                        {track.artist}
                    </span>
                </span>
            </button>
            <button
                type="button"
                onClick={() => removeFromQueue(index)}
                aria-label={tr('Прибрати з черги')}
                className="flex size-8 items-center justify-center text-white/40 hover:text-white"
            >
                <X className="size-4" />
            </button>
            <span
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={() => setOffset(null)}
                className="flex size-8 cursor-grab touch-none items-center justify-center text-white/50 active:cursor-grabbing"
                aria-label={tr('Перетягнути')}
            >
                <GripHorizontal className="size-5" />
            </span>
        </li>
    );
}

const CROSSFADE = [0, 3, 6, 9, 12];
const SLEEP: (number | 'track')[] = [15, 30, 45, 60, 'track'];

/**
 * «Звук» під чергою: плавні переходи (Crossfade), вирівнювання гучності (Sound Check) і таймер сну.
 * Налаштування переходів і гучності запам’ятовуються в браузері.
 */
function PlaybackSettings() {
    const player = usePlayer();
    const { site } = usePage().props;
    const [, tick] = useState(0);
    const minutesLeft =
        typeof player.sleep === 'number'
            ? Math.max(Math.ceil((player.sleep - Date.now()) / 60_000), 0)
            : null;

    useEffect(() => {
        if (typeof player.sleep !== 'number') return;
        const id = setInterval(() => tick((n) => n + 1), 15_000);

        return () => clearInterval(id);
    }, [player.sleep]);

    const chip = (on: boolean) =>
        cn(
            'h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold transition',
            on
                ? 'bg-white text-black'
                : 'bg-white/12 text-white/85 hover:bg-white/20',
        );

    return (
        <div className="mt-6 space-y-4 border-t border-white/10 pt-4 pb-2">
            <p className="text-[17px] font-semibold text-white">{tr('Звук')}</p>
            <div>
                <p className="flex items-center gap-2 text-[13px] text-white/60">
                    <Blend className="size-4" />
                    {tr('Плавні переходи між треками')}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {CROSSFADE.map((sec) => (
                        <button
                            key={sec}
                            type="button"
                            onClick={() => setCrossfade(sec)}
                            aria-pressed={player.crossfade === sec}
                            className={chip(player.crossfade === sec)}
                        >
                            {sec === 0 ? tr('Вимк.') : tr('{n} с', { n: sec })}
                        </button>
                    ))}
                </div>
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="min-w-0">
                    <span className="flex items-center gap-2 text-[15px] text-white">
                        <AudioLines className="size-4" />
                        {tr('Вирівнювання гучності')}
                    </span>
                    <span className="block text-[12px] text-white/50">
                        {tr('Тихі й гучні пісні звучать однаково')}
                    </span>
                </span>
                <input
                    type="checkbox"
                    checked={player.normalize}
                    onChange={(e) => setNormalizeVolume(e.target.checked)}
                    className="size-5 shrink-0 accent-[var(--am-accent)]"
                />
            </label>
            {site.translate && (
                <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="min-w-0">
                        <span className="flex items-center gap-2 text-[15px] text-white">
                            <Languages className="size-4" />
                            {tr('Переклад тексту пісень')}
                        </span>
                        <span className="block text-[12px] text-white/50">
                            {tr('Переклад під кожним рядком; можна вимкнути')}
                        </span>
                    </span>
                    <input
                        type="checkbox"
                        checked={player.lyricsTranslate}
                        onChange={(e) => setLyricsTranslate(e.target.checked)}
                        className="size-5 shrink-0 accent-[var(--am-accent)]"
                    />
                </label>
            )}
            <div>
                <p className="flex items-center gap-2 text-[13px] text-white/60">
                    <MoonStar className="size-4" />
                    {player.sleep === 'track'
                        ? tr('Таймер сну: наприкінці треку')
                        : minutesLeft !== null
                          ? tr('Таймер сну: зупиниться через {n} хв', {
                                n: minutesLeft,
                            })
                          : tr('Таймер сну')}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {SLEEP.map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setSleepTimer(value)}
                            className={chip(
                                value === 'track'
                                    ? player.sleep === 'track'
                                    : false,
                            )}
                        >
                            {value === 'track'
                                ? tr('Кінець треку')
                                : tr('{n} хв', { n: value })}
                        </button>
                    ))}
                    {player.sleep !== null && (
                        <button
                            type="button"
                            onClick={() => setSleepTimer(null)}
                            className={chip(false)}
                        >
                            {tr('Вимкнути')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function QueuePanel() {
    const player = usePlayer();
    const upcoming = player.queue.slice(player.index + 1);
    const pill = (on: boolean) =>
        cn(
            'flex h-9 flex-1 items-center justify-center rounded-full transition',
            on ? 'bg-white text-black' : 'bg-white/15 text-white',
        );
    const RepeatIcon = player.repeat === 'one' ? Repeat1 : Repeat;
    const live = player.current?.source === 'radio';

    return (
        <div className="flex h-full min-h-0 flex-col">
            {!live && (
                <div className="flex gap-2 pb-3">
                    <button
                        type="button"
                        onClick={toggleShuffle}
                        aria-pressed={player.shuffle}
                        aria-label={tr('Перемішати')}
                        className={pill(player.shuffle)}
                    >
                        <Shuffle className="size-[18px]" />
                    </button>
                    <button
                        type="button"
                        onClick={cycleRepeat}
                        aria-pressed={player.repeat !== 'off'}
                        aria-label={tr('Повтор')}
                        className={pill(player.repeat !== 'off')}
                    >
                        <RepeatIcon className="size-[18px]" />
                    </button>
                    <button
                        type="button"
                        onClick={toggleAutoplay}
                        aria-pressed={player.autoplay}
                        aria-label={tr('Автовідтворення')}
                        title={tr('Автовідтворення: після черги грати схожі')}
                        className={pill(player.autoplay)}
                    >
                        <InfinityIcon className="size-5" />
                    </button>
                </div>
            )}
            <div className="min-h-0 flex-1 [scrollbar-width:none] overflow-y-auto">
                {player.played.length > 0 && (
                    <details className="mb-3">
                        <summary className="cursor-pointer py-1 text-[15px] font-semibold text-white/80">
                            {tr('Історія')}
                        </summary>
                        <ol>
                            {player.played.slice(0, 15).map((t) => (
                                <li
                                    key={t.key}
                                    className="flex items-center gap-3 py-1.5 opacity-60"
                                >
                                    <TrackCover
                                        url={t.cover_url}
                                        seed={t.key}
                                        className="size-11 shrink-0 rounded-[5px]"
                                    />
                                    <span className="min-w-0">
                                        <span className="block truncate text-[15px] text-white">
                                            {t.title}
                                        </span>
                                        <span className="block truncate text-[13px] text-white/55">
                                            {t.artist}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </details>
                )}
                <div className="flex items-baseline justify-between">
                    <p className="text-[17px] font-semibold text-white">
                        {tr('Далі в черзі')}
                    </p>
                    {upcoming.length > 0 && (
                        <button
                            type="button"
                            onClick={clearUpNext}
                            className="text-[15px] text-white/70 hover:text-white"
                        >
                            {tr('Очистити')}
                        </button>
                    )}
                </div>
                {player.from && (
                    <p className="truncate text-[13px] text-white/55">
                        {tr('Грає з:')}{' '}
                        {player.from.href ? (
                            <Link
                                href={player.from.href}
                                className="font-semibold text-white/80 hover:underline"
                            >
                                {player.from.label}
                            </Link>
                        ) : (
                            <span className="font-semibold text-white/80">
                                {player.from.label}
                            </span>
                        )}
                    </p>
                )}
                {player.station && (
                    <p className="text-[13px] text-white/55">
                        {tr('Зі станції — нові треки додаються самі')}
                    </p>
                )}
                {!player.station && player.autoplay && !live && (
                    <p className="text-[13px] text-white/55">
                        {tr(
                            '∞ Автовідтворення: після черги гратимуть схожі треки',
                        )}
                    </p>
                )}
                <ol className="mt-2">
                    {upcoming.map((t, i) => (
                        <QueueRow
                            key={`${t.key}-${i}`}
                            track={t}
                            index={player.index + 1 + i}
                            rowHeight={56}
                            onMove={(from, to) =>
                                moveInQueue(
                                    from,
                                    Math.min(
                                        Math.max(to, player.index + 1),
                                        player.queue.length - 1,
                                    ),
                                )
                            }
                        />
                    ))}
                </ol>
                {upcoming.length === 0 && (
                    <p className="py-6 text-center text-[15px] text-white/50">
                        {tr('Черга порожня')}
                    </p>
                )}
                <PlaybackSettings />
            </div>
        </div>
    );
}

function CompactHeader({ track }: { track: TrackCard }) {
    return (
        <div className="flex items-center gap-3 pb-4">
            <TrackCover
                url={track.cover_url}
                seed={track.key}
                className="size-16 shrink-0 rounded-[6px] shadow-lg"
            />
            <TitleRow track={track} compact />
        </div>
    );
}

// ───────────────────────── Екран ─────────────────────────

/** Текст пісні в панелі: завантаження, «немає тексту» або караоке. */
function LyricsArea({
    lyrics,
    singing,
    onSing,
    tint,
}: {
    lyrics: Lyrics | null | undefined;
    singing: number;
    onSing: (v: number) => void;
    tint: string | null;
}) {
    if (lyrics === undefined) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="size-8 animate-spin text-white/60" />
            </div>
        );
    }
    if (lyrics === null) {
        return (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <MessageSquareQuote className="size-10 text-white/40" />
                <p className="mt-3 text-[20px] font-bold text-white/85">
                    {tr('Тексту поки немає')}
                </p>
                <p className="mt-1 text-[15px] text-white/55">
                    {tr('Для цієї пісні текст ще не додали.')}
                </p>
            </div>
        );
    }

    return (
        <LyricsPanel
            lyrics={lyrics}
            singing={singing}
            onSing={onSing}
            tint={tint}
        />
    );
}

export function NowPlaying({
    view,
    onView,
    onClose,
}: {
    view: View;
    onView: (view: View) => void;
    onClose: () => void;
}) {
    // Грає інший пристрій — його трек; кнопки керують ним (GameCon Connect).
    const player = usePlayback();
    const reduce = useReducedMotion();
    const track = player.current;
    const lyrics = useLyrics(track);
    const tint = useCoverColor(track?.cover_url);
    const [singing, setSinging] = useState(0);
    const [open, setOpen] = useState(true);

    useEffect(() => {
        if (!track) onClose();
    }, [track, onClose]);

    // Перехід на іншу сторінку (виконавець, альбом із меню) — згортаємо плеєр, як в Apple Music.
    useEffect(() => router.on('start', () => setOpen(false)), []);

    // Караоке діє лише на власних треках; на іншому треку голос повертається.
    useEffect(() => {
        if (singing > 0 && track?.source !== 'local') {
            setSinging(0);
            setSing(0);
        }
    }, [track, singing]);

    if (!track) return null;
    const live = track.source === 'radio';
    const sing = (v: number) => {
        setSinging(v);
        setSing(v);
    };
    const close = () => setOpen(false);
    const panel =
        view === 'lyrics' && !live
            ? 'lyrics'
            : view === 'queue'
              ? 'queue'
              : null;
    const base = tint ? `rgb(${tint})` : '#2c2c2e';

    const controls = (
        <div className="mx-auto w-full max-w-[560px]">
            {player.remote && (
                <RemoteLine
                    device={player.remote}
                    withButton
                    className="mb-2 text-[13px]"
                />
            )}
            <Progress live={live} />
            <Controls live={live} />
            <Volume />
            <BottomRow view={view} onView={onView} live={live} />
        </div>
    );

    const panelBody =
        panel === 'lyrics' ? (
            <LyricsArea
                lyrics={lyrics}
                singing={singing}
                onSing={sing}
                tint={tint}
            />
        ) : (
            <QueuePanel />
        );

    return (
        <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && close()}>
            <AnimatePresence onExitComplete={onClose}>
                {open && (
                    <DialogPrimitive.Portal forceMount>
                        <DialogPrimitive.Content
                            forceMount
                            asChild
                            aria-describedby={undefined}
                        >
                            <m.div
                                initial={
                                    reduce ? { opacity: 0 } : { y: '100%' }
                                }
                                animate={reduce ? { opacity: 1 } : { y: 0 }}
                                exit={reduce ? { opacity: 0 } : { y: '100%' }}
                                transition={motionOr(reduce, {
                                    type: 'spring',
                                    stiffness: 300,
                                    damping: 34,
                                })}
                                drag={reduce ? false : 'y'}
                                dragListener={!panel}
                                dragConstraints={{ top: 0, bottom: 0 }}
                                dragElastic={{ top: 0, bottom: 0.6 }}
                                onDragEnd={(_: unknown, info: PanInfo) => {
                                    if (
                                        info.offset.y > 140 ||
                                        info.velocity.y > 800
                                    )
                                        close();
                                }}
                                data-now-playing
                                className="am fixed inset-0 z-[70] overflow-hidden text-white focus:outline-none"
                                style={{ background: base }}
                            >
                                <DialogPrimitive.Title className="sr-only">
                                    {tr('Зараз грає')}: {track.title}
                                </DialogPrimitive.Title>

                                {/* Тло: колір обкладинки, затемнений донизу, щоб білий текст читався завжди. */}
                                <div
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.05),rgb(0_0_0/0.45))]"
                                />

                                {/* Телефон, головний вигляд: обкладинка на весь екран угорі, що тане в колір тла (iOS 26). */}
                                <AnimatePresence initial={false}>
                                    {!panel && (
                                        <m.div
                                            key="hero"
                                            aria-hidden
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.25 }}
                                            className="pointer-events-none absolute inset-x-0 top-0 h-[72dvh] lg:hidden"
                                        >
                                            <TrackCover
                                                url={track.cover_url}
                                                seed={track.key}
                                                className="size-full rounded-none [mask-image:linear-gradient(to_bottom,#000_50%,transparent_98%)] object-cover"
                                            />
                                        </m.div>
                                    )}
                                </AnimatePresence>

                                {/* Текст і черга: розмита обкладинка на тлі. */}
                                {panel && track.cover_url && (
                                    <img
                                        aria-hidden
                                        src={track.cover_url}
                                        alt=""
                                        className="pointer-events-none absolute inset-[-25%] size-[150%] max-w-none object-cover opacity-60 blur-[80px] saturate-150 lg:hidden"
                                    />
                                )}

                                <div className="relative mx-auto flex h-full max-w-[1200px] flex-col px-6 pt-[calc(env(safe-area-inset-top)+8px)] pb-[calc(env(safe-area-inset-bottom)+8px)] lg:px-12">
                                    <div className="flex h-8 shrink-0 items-center justify-center">
                                        <button
                                            type="button"
                                            onClick={close}
                                            aria-label={tr('Згорнути')}
                                            className="flex h-8 w-14 items-center justify-center"
                                        >
                                            <span className="h-[5px] w-9 rounded-full bg-white/60 shadow lg:hidden" />
                                            <ChevronDown className="hidden size-7 text-white/70 lg:block" />
                                        </button>
                                    </div>

                                    {/* Телефон. */}
                                    <div className="flex min-h-0 flex-1 flex-col lg:hidden">
                                        {panel ? (
                                            <m.div
                                                key={panel}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{
                                                    duration: 0.2,
                                                    ease: EASE_OUT,
                                                }}
                                                className="flex min-h-0 flex-1 flex-col pt-2"
                                            >
                                                <CompactHeader track={track} />
                                                <div className="min-h-0 flex-1">
                                                    {panelBody}
                                                </div>
                                            </m.div>
                                        ) : (
                                            <m.div
                                                key="artwork"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={motionOr(
                                                    reduce,
                                                    RISE,
                                                )}
                                                className="flex min-h-0 flex-1 flex-col justify-end pb-2"
                                            >
                                                <TitleRow track={track} />
                                            </m.div>
                                        )}
                                        <div className="shrink-0 pt-2">
                                            {controls}
                                        </div>
                                    </div>

                                    {/* ПК: ліворуч обкладинка й керування, праворуч текст чи черга. */}
                                    <div className="hidden min-h-0 flex-1 items-center gap-16 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                        <div className="flex flex-col gap-6">
                                            <m.div
                                                animate={{
                                                    scale:
                                                        player.playing || live
                                                            ? 1
                                                            : 0.86,
                                                }}
                                                transition={motionOr(reduce, {
                                                    type: 'spring',
                                                    stiffness: 260,
                                                    damping: 26,
                                                })}
                                                className="mx-auto aspect-square w-full max-w-[min(38vw,58dvh,560px)]"
                                            >
                                                <TrackCover
                                                    url={track.cover_url}
                                                    seed={track.key}
                                                    className="size-full rounded-[12px] shadow-[0_24px_60px_-18px_rgb(0_0_0/0.6)]"
                                                />
                                            </m.div>
                                            <div className="mx-auto w-full max-w-[560px]">
                                                <TitleRow track={track} />
                                            </div>
                                            {controls}
                                        </div>
                                        <div className="h-[min(78dvh,760px)] min-h-0">
                                            {view === 'queue' || live ? (
                                                <QueuePanel />
                                            ) : (
                                                <LyricsArea
                                                    lyrics={lyrics}
                                                    singing={singing}
                                                    onSing={sing}
                                                    tint={tint}
                                                />
                                            )}
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
