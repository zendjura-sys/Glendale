import { router } from '@inertiajs/react';
import { Film, ImageIcon, Pause, Play, Scissors, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { selectClass } from '@/components/gc/admin';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Option = { slug: string; name: string };

const MAX_SECONDS = 90;
const MAX_BYTES = 300 * 1024 * 1024;
const fmt = (t: number) =>
    `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;

/**
 * Власний кліп: обрати файл, обрізати початок і кінець прямо в плеєрі, взяти кадр на обкладинку.
 * Саму обрізку робить сервер (ffmpeg) — у браузері лише вибір меж, тож працює на будь-якому пристрої.
 */
export function ClipUploader({
    games,
    servers,
    defaultGame,
    onDone,
}: {
    games: Option[];
    servers: Option[];
    defaultGame?: string | null;
    onDone: () => void;
}) {
    const video = useRef<HTMLVideoElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [src, setSrc] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);
    const [start, setStart] = useState(0);
    const [end, setEnd] = useState(0);
    const [time, setTime] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [poster, setPoster] = useState<Blob | null>(null);
    const [posterUrl, setPosterUrl] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [game, setGame] = useState(defaultGame ?? '');
    const [server, setServer] = useState('');
    const [progress, setProgress] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    // Браузер не вміє цей кодек (буває з H.265/MKV) — межі вводяться вручну, обріже сервер.
    const [noPreview, setNoPreview] = useState(false);

    useEffect(
        () => () => {
            if (src) URL.revokeObjectURL(src);
            if (posterUrl) URL.revokeObjectURL(posterUrl);
        },
        [src, posterUrl],
    );

    const pick = (f: File | null) => {
        setError(null);
        if (!f) return;
        if (f.size > MAX_BYTES) {
            setError(tr('Файл до 300 МБ.'));

            return;
        }
        setFile(f);
        setSrc(URL.createObjectURL(f));
        setTitle(f.name.replace(/\.[^.]+$/, '').slice(0, 140));
        setPoster(null);
        setPosterUrl(null);
        setNoPreview(false);
    };

    const loaded = () => {
        const d = video.current?.duration ?? 0;
        setDuration(d);
        setStart(0);
        setEnd(Math.min(d, MAX_SECONDS));
    };

    // Відтворення лише в межах обрізки (по колу).
    const tick = () => {
        const v = video.current;
        if (!v) return;
        setTime(v.currentTime);
        if (v.currentTime >= end || v.currentTime < start - 0.2) {
            v.currentTime = start;
        }
    };

    const toggle = () => {
        const v = video.current;
        if (!v) return;
        if (v.paused) {
            if (v.currentTime < start || v.currentTime >= end)
                v.currentTime = start;
            void v.play();
            setPlaying(true);
        } else {
            v.pause();
            setPlaying(false);
        }
    };

    const setBound = (which: 'start' | 'end', value: number) => {
        const v = video.current;
        if (which === 'start') {
            const s = Math.min(value, end - 1);
            setStart(Math.max(0, s));
            // Довжина не більше MAX_SECONDS: тягнемо кінець за собою.
            if (end - s > MAX_SECONDS) setEnd(s + MAX_SECONDS);
            if (v) v.currentTime = Math.max(0, s);
        } else {
            const e = Math.max(value, start + 1);
            setEnd(Math.min(duration, e));
            if (e - start > MAX_SECONDS) setStart(e - MAX_SECONDS);
            if (v) v.currentTime = Math.max(start, e - 1);
        }
    };

    const grabPoster = () => {
        const v = video.current;
        if (!v || !v.videoWidth) return;
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 960 / v.videoWidth);
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        canvas
            .getContext('2d')
            ?.drawImage(v, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
            (blob) => {
                if (!blob) return;
                setPoster(blob);
                setPosterUrl(URL.createObjectURL(blob));
            },
            'image/jpeg',
            0.86,
        );
    };

    const submit = () => {
        if (!file) return;
        setError(null);
        router.post(
            '/moments/upload',
            {
                video: file,
                start: start.toFixed(2),
                end: end.toFixed(2),
                title: title.trim(),
                game,
                server,
                ...(poster
                    ? {
                          poster: new File([poster], 'poster.jpg', {
                              type: 'image/jpeg',
                          }),
                      }
                    : {}),
            },
            {
                forceFormData: true,
                onProgress: (e) => setProgress(e?.percentage ?? null),
                onError: (errors) =>
                    setError(
                        Object.values(errors)[0] ??
                            tr('Не вдалося завантажити.'),
                    ),
                onFinish: () => setProgress(null),
                onSuccess: onDone,
            },
        );
    };

    const pct = (t: number) => (duration ? (t / duration) * 100 : 0);
    const length = end - start;

    if (!src) {
        return (
            <label className="gc-solid-2 flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-white/10 p-8 text-center hover:border-white/25">
                <Film className="size-8 text-sky-400" />
                <span className="font-semibold text-white">
                    {tr('Оберіть відео')}
                </span>
                <span className="text-sm text-white/50">
                    {tr(
                        'MP4, WebM, MOV чи MKV до 300 МБ. Кліп — до {n} секунд, обріжете далі.',
                        { n: MAX_SECONDS },
                    )}
                </span>
                <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                    className="sr-only"
                    onChange={(e) => pick(e.target.files?.[0] ?? null)}
                />
                {error && (
                    <span className="text-sm text-rose-300">{error}</span>
                )}
            </label>
        );
    }

    return (
        <div className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl bg-black">
                <video
                    ref={video}
                    src={src}
                    onLoadedMetadata={loaded}
                    onTimeUpdate={tick}
                    onPause={() => setPlaying(false)}
                    onError={() => {
                        setNoPreview(true);
                        setStart(0);
                        setEnd(MAX_SECONDS);
                    }}
                    playsInline
                    className="aspect-video w-full object-contain"
                />
                <button
                    type="button"
                    onClick={toggle}
                    aria-label={
                        playing ? tr('Пауза') : tr('Переглянути обрізку')
                    }
                    className="absolute bottom-3 left-3 grid size-11 place-items-center rounded-full bg-black/60 text-white"
                >
                    {playing ? (
                        <Pause className="size-5" />
                    ) : (
                        <Play className="ml-0.5 size-5 fill-white" />
                    )}
                </button>
            </div>

            {noPreview ? (
                <div className="space-y-2 rounded-2xl bg-amber-500/10 p-3">
                    <p className="text-sm text-amber-200">
                        {tr(
                            'Браузер не може показати це відео, але сервер його обріже. Вкажіть початок і кінець у секундах.',
                        )}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-white/60">
                            {tr('Початок, с')}
                            <input
                                type="number"
                                min={0}
                                step={0.5}
                                value={start}
                                onChange={(e) =>
                                    setStart(
                                        Math.max(
                                            0,
                                            Number(e.target.value) || 0,
                                        ),
                                    )
                                }
                                className="input-glass mt-1 h-10 w-full rounded-xl px-3 text-sm text-white"
                            />
                        </label>
                        <label className="text-xs text-white/60">
                            {tr('Кінець, с')}
                            <input
                                type="number"
                                min={1}
                                step={0.5}
                                value={end}
                                onChange={(e) =>
                                    setEnd(
                                        Math.max(
                                            start + 1,
                                            Number(e.target.value) || 0,
                                        ),
                                    )
                                }
                                className="input-glass mt-1 h-10 w-full rounded-xl px-3 text-sm text-white"
                            />
                        </label>
                    </div>
                </div>
            ) : (
                <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs text-white/55 tabular-nums">
                        <span className="flex items-center gap-1.5">
                            <Scissors className="size-3.5" /> {fmt(start)} —{' '}
                            {fmt(end)}
                        </span>
                        <span
                            className={cn(
                                length > MAX_SECONDS && 'text-rose-300',
                            )}
                        >
                            {tr('Довжина {t} · до {n} с', {
                                t: fmt(length),
                                n: MAX_SECONDS,
                            })}
                        </span>
                    </div>
                    <div className="relative h-10 rounded-xl bg-white/[0.05]">
                        <div
                            className="absolute inset-y-0 rounded-xl bg-primary/25 ring-2 ring-primary"
                            style={{
                                left: `${pct(start)}%`,
                                width: `${pct(end) - pct(start)}%`,
                            }}
                        />
                        <div
                            className="absolute inset-y-0 w-0.5 bg-white"
                            style={{ left: `${pct(time)}%` }}
                            aria-hidden
                        />
                        <input
                            type="range"
                            min={0}
                            max={duration || 0}
                            step={0.1}
                            value={start}
                            onChange={(e) =>
                                setBound('start', Number(e.target.value))
                            }
                            aria-label={tr('Початок кліпу')}
                            className="gc-trim-range absolute inset-0 w-full"
                        />
                        <input
                            type="range"
                            min={0}
                            max={duration || 0}
                            step={0.1}
                            value={end}
                            onChange={(e) =>
                                setBound('end', Number(e.target.value))
                            }
                            aria-label={tr('Кінець кліпу')}
                            className="gc-trim-range absolute inset-0 w-full"
                        />
                    </div>
                </div>
            )}

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                    value={title}
                    maxLength={140}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={tr('Назва кліпу')}
                    className="input-glass h-11 rounded-xl px-3.5 text-sm text-white"
                />
                <button
                    type="button"
                    disabled={noPreview}
                    onClick={grabPoster}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-4 text-sm font-medium text-white/80"
                >
                    {posterUrl ? (
                        <img src={posterUrl} alt="" className="h-7 rounded" />
                    ) : (
                        <ImageIcon className="size-4" />
                    )}
                    {tr('Цей кадр — обкладинка')}
                </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <select
                    value={game}
                    onChange={(e) => setGame(e.target.value)}
                    className={cn(selectClass, 'h-11')}
                    aria-label={tr('Гра')}
                >
                    <option value="">{tr('Гра (необов’язково)')}</option>
                    {games.map((g) => (
                        <option key={g.slug} value={g.slug}>
                            {g.name}
                        </option>
                    ))}
                </select>
                <select
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                    className={cn(selectClass, 'h-11')}
                    aria-label={tr('Сервер')}
                >
                    <option value="">{tr('Сервер (необов’язково)')}</option>
                    {servers.map((s) => (
                        <option key={s.slug} value={s.slug}>
                            {s.name}
                        </option>
                    ))}
                </select>
            </div>
            {error && <p className="text-sm text-rose-300">{error}</p>}
            {progress !== null && (
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                        className="h-full bg-primary transition-[width]"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => {
                        setSrc(null);
                        setFile(null);
                    }}
                    className="h-11 rounded-xl px-4 text-sm font-medium text-white/70 hover:bg-white/[0.06]"
                >
                    {tr('Інше відео')}
                </button>
                <button
                    type="button"
                    disabled={
                        progress !== null ||
                        title.trim().length < 2 ||
                        length > MAX_SECONDS + 0.5
                    }
                    onClick={submit}
                    className="btn-glow inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold disabled:opacity-60"
                >
                    <Upload className="size-4" />
                    {progress !== null
                        ? tr('Завантажуємо… {n}%', { n: Math.round(progress) })
                        : tr('Опублікувати кліп')}
                </button>
            </div>
        </div>
    );
}
