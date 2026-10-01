import { router } from '@inertiajs/react';
import {
    AlertCircle,
    CheckCircle2,
    Loader2,
    UploadCloud,
    X,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { TrackCover } from './track-cover';

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
                reject(new Error(first ?? 'Помилка завантаження.'));
            } catch {
                reject(
                    new Error(
                        xhr.status === 413
                            ? 'Файл завеликий для сервера.'
                            : 'Помилка завантаження.',
                    ),
                );
            }
        };
        xhr.onerror = () => reject(new Error('Немає з’єднання.'));
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
                toast.error(`«${file.name}» більший за ${maxMb} МБ.`);
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
                    error: 'Вкажіть назву й виконавця.',
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
                    error: error instanceof Error ? error.message : 'Помилка.',
                });
            }
        }
        setBusy(false);

        if (uploaded > 0) {
            toast.success(`Завантажено треків: ${uploaded}.`);
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
                    Завантаження музики
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-white/50">
                    Назву, виконавця й обкладинку підставимо з тегів файлу. До{' '}
                    {maxMb} МБ на трек.
                </DialogDescription>

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
                        'mt-4 flex flex-col items-center rounded-2xl border-2 border-dashed px-4 py-6 text-center transition sm:mt-5 sm:px-6 sm:py-7',
                        dragging
                            ? 'border-[#7c8cff] bg-[#6d5dfc]/10'
                            : 'border-white/10 hover:border-white/25',
                    )}
                >
                    <UploadCloud className="size-9 text-[#9aa8ff]" />
                    <span className="mt-2 text-sm font-semibold">
                        Перетягніть аудіофайли або натисніть
                    </span>
                    <span className="mt-1 text-xs text-white/45">
                        {formats
                            .filter(
                                (f) =>
                                    !['mpga', 'oga', 'mp4', 'webm'].includes(f),
                            )
                            .join(', ')
                            .toUpperCase()}
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
                        {items.map((item) => (
                            <li
                                key={item.id}
                                className="relative overflow-hidden rounded-2xl bg-white/[0.04] p-3"
                            >
                                {item.status === 'uploading' && (
                                    <span
                                        className="absolute inset-y-0 left-0 bg-[#6d5dfc]/15 transition-[width]"
                                        style={{ width: `${item.progress}%` }}
                                    />
                                )}
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
                                                            title: event.target
                                                                .value,
                                                        })
                                                    }
                                                    disabled={
                                                        item.status ===
                                                            'done' || busy
                                                    }
                                                    placeholder="Назва"
                                                    maxLength={150}
                                                    className="input-glass h-10 w-full min-w-0 rounded-lg px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                                                />
                                                <input
                                                    value={item.artist}
                                                    onChange={(event) =>
                                                        update(item.id, {
                                                            artist: event.target
                                                                .value,
                                                        })
                                                    }
                                                    disabled={
                                                        item.status ===
                                                            'done' || busy
                                                    }
                                                    placeholder="Виконавець"
                                                    maxLength={150}
                                                    className="input-glass h-10 w-full min-w-0 rounded-lg px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                                                />
                                            </div>
                                            <span className="flex size-10 shrink-0 items-center justify-center">
                                                {item.status === 'uploading' ? (
                                                    <Loader2 className="size-5 animate-spin text-[#9aa8ff]" />
                                                ) : item.status === 'done' ? (
                                                    <CheckCircle2 className="size-5 text-emerald-400" />
                                                ) : item.status === 'error' ? (
                                                    <AlertCircle className="size-5 text-rose-300" />
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setItems((all) =>
                                                                all.filter(
                                                                    (i) =>
                                                                        i.id !==
                                                                        item.id,
                                                                ),
                                                            )
                                                        }
                                                        className="rounded-full p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
                                                        aria-label="Прибрати"
                                                    >
                                                        <X className="size-4" />
                                                    </button>
                                                )}
                                            </span>
                                        </div>
                                        <p className="mt-1.5 truncate text-[11px] leading-4 text-white/40">
                                            {item.file.name} ·{' '}
                                            {formatBytes(item.file.size)}
                                            {item.duration > 0 &&
                                                ` · ${formatDuration(item.duration)}`}
                                            {item.album && ` · ${item.album}`}
                                            {item.error && (
                                                <span className="text-rose-300">
                                                    {' '}
                                                    · {item.error}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 sm:mt-5">
                    <button
                        type="button"
                        onClick={() => close(false)}
                        disabled={busy}
                        className="rounded-xl px-4 py-2.5 text-sm text-white/60 hover:bg-white/5 hover:text-white disabled:opacity-50"
                    >
                        {pending === 0 && items.length > 0
                            ? 'Готово'
                            : 'Скасувати'}
                    </button>
                    <button
                        type="button"
                        onClick={uploadAll}
                        disabled={busy || pending === 0}
                        className="btn-glow inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                    >
                        {busy && <Loader2 className="size-4 animate-spin" />}
                        Завантажити{pending > 0 ? ` (${pending})` : ''}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
