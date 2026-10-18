import { router } from '@inertiajs/react';
import { AlertCircle, ArrowUp, Loader2, X } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { xsrfToken } from '@/lib/api';
import { formatBytes, formatDuration } from '@/lib/format';
import { guessFromFilename, readDuration, readTags } from '@/lib/id3';
import { motionOr, POP, RISE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { TrackCover } from './track-cover';
import { ProgressRing, SuccessCheck } from './upload-status';
import { tr } from '@/lib/i18n';

type Item = {
    id: string;
    file: File;
    title: string;
    artist: string;
    album: string;
    genre: string;
    duration: number;
    cover: Blob | null;
    coverUrl: string | null;
    status: 'ready' | 'uploading' | 'done' | 'error';
    progress: number;
    error?: string;
};

function send(item: Item, onProgress: (p: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        const form = new FormData();
        form.append('audio', item.file);
        form.append('title', item.title.trim());
        form.append('artist', item.artist.trim());
        if (item.album.trim()) form.append('album', item.album.trim());
        if (item.genre.trim()) form.append('genre', item.genre.trim());
        form.append('duration', String(item.duration));
        if (item.cover) form.append('cover', item.cover, 'cover.jpg');

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/music/tracks');
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.setRequestHeader('X-XSRF-TOKEN', xsrfToken());
        xhr.upload.onprogress = (event) =>
            event.lengthComputable &&
            onProgress(Math.round((event.loaded / event.total) * 100));
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) return resolve();
            try {
                const payload = JSON.parse(xhr.responseText);
                const first = payload.errors
                    ? (Object.values(payload.errors)[0] as string[])[0]
                    : payload.message;
                reject(new Error(first ?? tr('Помилка завантаження.')));
            } catch {
                reject(
                    new Error(
                        xhr.status === 413
                            ? tr('Файл завеликий для сервера.')
                            : tr('Помилка завантаження.'),
                    ),
                );
            }
        };
        xhr.onerror = () => reject(new Error(tr('Немає з’єднання.')));
        xhr.send(form);
    });
}

export function UploadTracksDialog({
    open,
    onOpenChange,
    maxMb,
    formats,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    maxMb: number;
    formats: string[];
}) {
    const [items, setItems] = useState<Item[]>([]);
    const [busy, setBusy] = useState(false);
    const [dragging, setDragging] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const reduce = useReducedMotion();

    const update = (id: string, patch: Partial<Item>) =>
        setItems((all) =>
            all.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        );

    const addFiles = async (files: FileList | File[]) => {
        const audio = Array.from(files).filter(
            (file) =>
                file.type.startsWith('audio/') ||
                formats.includes(
                    file.name.split('.').pop()?.toLowerCase() ?? '',
                ),
        );
        for (const file of audio) {
            if (file.size > maxMb * 1024 * 1024) {
                toast.error(
                    tr('«{name}» більший за {maxMb} МБ.', {
                        name: file.name,
                        maxMb,
                    }),
                );
                continue;
            }
            const [tags, duration] = await Promise.all([
                readTags(file).catch(
                    () => ({}) as Awaited<ReturnType<typeof readTags>>,
                ),
                readDuration(file),
            ]);
            const guess = guessFromFilename(file.name);
            setItems((all) => [
                ...all,
                {
                    id: `${file.name}-${file.size}-${Math.random()}`,
                    file,
                    title: tags.title || guess.title,
                    artist: tags.artist || guess.artist,
                    album: tags.album ?? '',
                    genre: tags.genre ?? '',
                    duration,
                    cover: tags.cover ?? null,
                    coverUrl: tags.cover
                        ? URL.createObjectURL(tags.cover)
                        : null,
                    status: 'ready',
                    progress: 0,
                },
            ]);
        }
    };

    const uploadAll = async () => {
        setBusy(true);
        let uploaded = 0;
        for (const item of items) {
            if (item.status === 'done') continue;
            if (!item.title.trim() || !item.artist.trim()) {
                update(item.id, {
                    status: 'error',
                    error: tr('Вкажіть назву й виконавця.'),
                });
                continue;
            }
            update(item.id, {
                status: 'uploading',
                progress: 0,
                error: undefined,
            });
            try {
                await send(item, (progress) => update(item.id, { progress }));
                update(item.id, { status: 'done', progress: 100 });
                uploaded++;
            } catch (error) {
                update(item.id, {
                    status: 'error',
                    error:
                        error instanceof Error ? error.message : tr('Помилка.'),
                });
            }
        }
        setBusy(false);

        if (uploaded > 0) {
            toast.success(tr('Завантажено треків: {uploaded}.', { uploaded }));
            router.reload({ only: ['tracks', 'stats'], reset: ['tracks'] });
        }
    };

    const close = (value: boolean) => {
        if (busy) return;
        if (!value) setItems((all) => all.filter((i) => i.status !== 'done'));
        onOpenChange(value);
    };

    const pending = items.filter((i) => i.status !== 'done').length;

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="glass-strong flex max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-bottom)-0.75rem))] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-3xl border-white/10 p-4 text-white sm:max-w-2xl sm:p-6">
                <DialogTitle className="pr-8 font-display text-xl leading-tight">
                    {tr('Завантаження музики')}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-white/50">
                    {tr(
                        'Назву, виконавця й обкладинку підставимо з тегів файлу.',
                    )}
                </DialogDescription>

                {/* Зона перетягування: кільця навколо кнопки «дихають», а під файлом — розходяться ширше. */}
                <button
                    type="button"
                    onClick={() => input.current?.click()}
                    onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                        event.preventDefault();
                        setDragging(false);
                        void addFiles(event.dataTransfer.files);
                    }}
                    className={cn(
                        'group mt-4 flex flex-col items-center rounded-3xl border border-dashed px-4 text-center transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:mt-5',
                        items.length > 0 ? 'py-5' : 'py-9 sm:py-11',
                        dragging
                            ? 'border-primary bg-primary/[0.08]'
                            : 'border-white/15 bg-white/[0.02] hover:border-white/30',
                    )}
                >
                    <span className="relative flex size-16 items-center justify-center">
                        <span
                            aria-hidden
                            className={cn(
                                'absolute inset-0 rounded-full bg-primary/25 motion-safe:animate-[upload-ring_2.4s_ease-out_infinite]',
                                dragging && 'bg-primary/40',
                            )}
                        />
                        <span
                            aria-hidden
                            className="absolute inset-0 rounded-full bg-primary/20 motion-safe:animate-[upload-ring_2.4s_ease-out_1.2s_infinite]"
                        />
                        <m.span
                            animate={{ scale: dragging ? 1.12 : 1 }}
                            transition={motionOr(reduce, POP)}
                            className="relative flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_30px_-10px_var(--primary)]"
                        >
                            <ArrowUp className="size-7" strokeWidth={2.4} />
                        </m.span>
                    </span>
                    <span className="mt-4 text-[15px] font-semibold">
                        {dragging
                            ? tr('Відпустіть, щоб додати')
                            : tr('Перетягніть аудіофайли сюди')}
                    </span>
                    <span className="mt-1 text-sm text-white/50">
                        {tr('або')}{' '}
                        <span className="font-medium text-primary underline-offset-4 group-hover:underline">
                            {tr('оберіть на пристрої')}
                        </span>
                    </span>
                    <span className="mt-3 text-xs text-white/35">
                        {formats
                            .filter(
                                (f) =>
                                    !['mpga', 'oga', 'mp4', 'webm'].includes(f),
                            )
                            .join(', ')
                            .toUpperCase()}{' '}
                        ·{' '}
                        <span className="whitespace-nowrap">
                            {tr('до')} {maxMb} {tr('МБ')}
                        </span>
                    </span>
                </button>
                <input
                    ref={input}
                    type="file"
                    accept="audio/*"
                    multiple
                    hidden
                    onChange={(event) => {
                        if (event.target.files)
                            void addFiles(event.target.files);
                        event.target.value = '';
                    }}
                />

                {items.length > 0 && (
                    <ul className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                        <AnimatePresence initial={false}>
                            {items.map((item) => (
                                <m.li
                                    key={item.id}
                                    layout={!reduce}
                                    initial={
                                        reduce ? false : { opacity: 0, y: 12 }
                                    }
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={
                                        reduce
                                            ? undefined
                                            : { opacity: 0, x: -16 }
                                    }
                                    transition={motionOr(reduce, RISE)}
                                    className={cn(
                                        'relative overflow-hidden rounded-2xl border p-3 transition-colors',
                                        item.status === 'done'
                                            ? 'border-emerald-400/20 bg-emerald-400/[0.05]'
                                            : item.status === 'error'
                                              ? 'border-rose-400/25 bg-rose-400/[0.05]'
                                              : 'border-white/[0.07] bg-white/[0.04]',
                                    )}
                                >
                                    <div className="relative flex items-start gap-3">
                                        <TrackCover
                                            url={item.coverUrl}
                                            seed={item.file.name}
                                            className="size-12 shrink-0 rounded-xl"
                                        />
                                        <div className="@container min-w-0 flex-1">
                                            <div className="flex items-start gap-2">
                                                <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 @md:grid-cols-2">
                                                    <input
                                                        value={item.title}
                                                        onChange={(event) =>
                                                            update(item.id, {
                                                                title: event
                                                                    .target
                                                                    .value,
                                                            })
                                                        }
                                                        disabled={
                                                            item.status ===
                                                                'done' || busy
                                                        }
                                                        placeholder={tr(
                                                            'Назва',
                                                        )}
                                                        maxLength={150}
                                                        className="input-glass h-10 w-full min-w-0 rounded-lg px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                                                    />
                                                    <input
                                                        value={item.artist}
                                                        onChange={(event) =>
                                                            update(item.id, {
                                                                artist: event
                                                                    .target
                                                                    .value,
                                                            })
                                                        }
                                                        disabled={
                                                            item.status ===
                                                                'done' || busy
                                                        }
                                                        placeholder={tr(
                                                            'Виконавець',
                                                        )}
                                                        maxLength={150}
                                                        className="input-glass h-10 w-full min-w-0 rounded-lg px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                                                    />
                                                </div>
                                                <span className="flex size-11 shrink-0 items-center justify-center">
                                                    {item.status ===
                                                    'uploading' ? (
                                                        <ProgressRing
                                                            value={
                                                                item.progress
                                                            }
                                                        />
                                                    ) : item.status ===
                                                      'done' ? (
                                                        <SuccessCheck />
                                                    ) : item.status ===
                                                      'error' ? (
                                                        <AlertCircle className="size-5 text-rose-300" />
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setItems(
                                                                    (all) =>
                                                                        all.filter(
                                                                            (
                                                                                i,
                                                                            ) =>
                                                                                i.id !==
                                                                                item.id,
                                                                        ),
                                                                )
                                                            }
                                                            className="rounded-full p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
                                                            aria-label={tr(
                                                                'Прибрати',
                                                            )}
                                                        >
                                                            <X className="size-4" />
                                                        </button>
                                                    )}
                                                </span>
                                            </div>
                                            <p className="mt-1.5 truncate text-xs leading-4 text-white/40">
                                                {item.file.name} ·{' '}
                                                {formatBytes(item.file.size)}
                                                {item.duration > 0 &&
                                                    ` · ${formatDuration(item.duration)}`}
                                                {item.album &&
                                                    ` · ${item.album}`}
                                                {item.error && (
                                                    <span className="text-rose-300">
                                                        {' '}
                                                        · {item.error}
                                                    </span>
                                                )}
                                            </p>
                                            {item.status === 'uploading' && (
                                                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                                                    <div
                                                        className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                                                        style={{
                                                            width: `${item.progress}%`,
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </m.li>
                            ))}
                        </AnimatePresence>
                    </ul>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 sm:mt-5">
                    <button
                        type="button"
                        onClick={() => close(false)}
                        disabled={busy}
                        className="h-11 rounded-full border border-white/15 px-6 text-sm font-semibold text-white/80 transition-colors hover:border-white/30 hover:text-white disabled:opacity-50"
                    >
                        {pending === 0 && items.length > 0
                            ? tr('Готово')
                            : tr('Скасувати')}
                    </button>
                    <button
                        type="button"
                        onClick={uploadAll}
                        disabled={busy || pending === 0}
                        className="btn-glow inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold disabled:opacity-50"
                    >
                        {busy && <Loader2 className="size-4 animate-spin" />}
                        {tr('Завантажити')}
                        {pending > 0 ? ` (${pending})` : ''}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
