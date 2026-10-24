import { router } from '@inertiajs/react';
import {
    AlertCircle,
    CheckCircle2,
    Link2,
    Loader2,
    Play,
    X,
} from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { motionOr, RISE } from '@/lib/motion';
import { playQueue } from '@/lib/player';
import { cn } from '@/lib/utils';
import type { TrackImportCard } from '@/types/music';
import { TrackCover } from './track-cover';

const ACTIVE: TrackImportCard['status'][] = [
    'pending',
    'downloading',
    'processing',
];

/** Як часто питаємо сервер про стан, поки щось завантажується. */
const POLL_MS = 2500;

export const LINK_FORM_ID = 'music-link-import';

function isActive(item: TrackImportCard) {
    return ACTIVE.includes(item.status);
}

function statusLabel(item: TrackImportCard): string {
    switch (item.status) {
        case 'downloading':
            return item.progress === null
                ? tr('Завантажується…')
                : tr('Завантажується… {v}%', { v: item.progress });
        case 'processing':
            return tr('Обробка…');
        case 'done':
            return tr('Готово');
        case 'failed':
            return tr('Не вдалося');
        default:
            return tr('У черзі');
    }
}

/**
 * Вкладка «За посиланням»: сервер сам завантажує файл (пряме посилання, Google Диск, Dropbox, OneDrive)
 * і додає трек у медіатеку. Поки щось завантажується і вікно відкрите — стан оновлюється кожні 2,5 с.
 */
export function LinkImportPanel({
    open,
    onBusyChange,
}: {
    open: boolean;
    onBusyChange: (busy: boolean) => void;
}) {
    const [url, setUrl] = useState('');
    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [imports, setImports] = useState<TrackImportCard[]>([]);
    const known = useRef(new Map<number, TrackImportCard['status']>());
    const reduce = useReducedMotion();

    const apply = useCallback((next: TrackImportCard[]) => {
        // Щойно щось стало «Готово» — оновлюємо список треків на сторінці.
        const finished = next.some(
            (item) =>
                item.status === 'done' &&
                known.current.has(item.id) &&
                known.current.get(item.id) !== 'done',
        );
        known.current = new Map(next.map((item) => [item.id, item.status]));
        setImports(next);
        if (finished) {
            router.reload({ only: ['tracks', 'stats'], reset: ['tracks'] });
        }
    }, []);

    const load = useCallback(async () => {
        try {
            const data = await api<{ imports: TrackImportCard[] }>(
                'GET',
                '/music/imports',
            );
            apply(data.imports);
        } catch {
            // Мережа зникла — спробуємо на наступному кроці опитування.
        }
    }, [apply]);

    useEffect(() => {
        if (open) void load();
    }, [open, load]);

    const active = imports.some(isActive);
    useEffect(() => {
        if (!open || !active) return;
        const timer = window.setInterval(() => void load(), POLL_MS);

        return () => window.clearInterval(timer);
    }, [open, active, load]);

    useEffect(() => onBusyChange(sending), [sending, onBusyChange]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const link = url.trim();
        if (!link || sending) return;
        setSending(true);
        setError(null);
        try {
            const data = await api<{ import: TrackImportCard }>(
                'POST',
                '/music/tracks/import',
                {
                    url: link,
                    ...(title.trim() ? { title: title.trim() } : {}),
                    ...(artist.trim() ? { artist: artist.trim() } : {}),
                },
            );
            apply([
                data.import,
                ...imports.filter((item) => item.id !== data.import.id),
            ]);
            setUrl('');
            setTitle('');
            setArtist('');
            toast.success(tr('Посилання додано — трек завантажується'));
        } catch (caught) {
            setError(
                caught instanceof ApiError
                    ? (Object.values(caught.errors)[0]?.[0] ?? caught.message)
                    : tr('Немає з’єднання.'),
            );
        } finally {
            setSending(false);
        }
    };

    const dismiss = async (item: TrackImportCard) => {
        apply(imports.filter((i) => i.id !== item.id));
        try {
            await api('DELETE', `/music/imports/${item.id}`);
        } catch {
            void load();
        }
    };

    return (
        <div className="mt-4 flex min-h-0 flex-1 flex-col sm:mt-5">
            <form id={LINK_FORM_ID} onSubmit={submit} className="space-y-2">
                <label className="relative block">
                    <span className="sr-only">{tr('Посилання на файл')}</span>
                    <Link2 className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/35" />
                    <input
                        type="url"
                        inputMode="url"
                        value={url}
                        onChange={(event) => {
                            setUrl(event.target.value);
                            setError(null);
                        }}
                        placeholder="https://…"
                        maxLength={2000}
                        autoComplete="off"
                        spellCheck={false}
                        className={cn(
                            'input-glass h-12 w-full rounded-xl pr-3 pl-10 text-sm text-white placeholder:text-white/30 focus:outline-none',
                            error && 'ring-1 ring-rose-400/50',
                        )}
                    />
                </label>
                <p className="text-xs leading-relaxed text-white/45">
                    {tr(
                        'Пряме посилання на файл або посилання Google Диска, Dropbox чи OneDrive (доступ «усім, хто має посилання»).',
                    )}
                </p>
                {error && (
                    <p
                        role="alert"
                        className="flex items-start gap-1.5 text-sm text-rose-300"
                    >
                        <AlertCircle className="mt-0.5 size-4 shrink-0" />
                        {error}
                    </p>
                )}
                <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                    <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder={tr('Назва (необов’язково)')}
                        maxLength={150}
                        className="input-glass h-10 w-full min-w-0 rounded-lg px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                    <input
                        value={artist}
                        onChange={(event) => setArtist(event.target.value)}
                        placeholder={tr('Виконавець (необов’язково)')}
                        maxLength={150}
                        className="input-glass h-10 w-full min-w-0 rounded-lg px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                </div>
            </form>

            {imports.length > 0 && (
                <>
                    <h3 className="mt-5 text-sm font-semibold text-white/80">
                        {tr('Останні завантаження')}
                    </h3>
                    <ul className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                        <AnimatePresence initial={false}>
                            {imports.map((item) => (
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
                                        'rounded-2xl border p-3 transition-colors',
                                        item.status === 'done'
                                            ? 'border-emerald-400/20 bg-emerald-400/[0.05]'
                                            : item.status === 'failed'
                                              ? 'border-rose-400/25 bg-rose-400/[0.05]'
                                              : 'border-white/[0.07] bg-white/[0.04]',
                                    )}
                                >
                                    <ImportRow
                                        item={item}
                                        onDismiss={() => void dismiss(item)}
                                    />
                                </m.li>
                            ))}
                        </AnimatePresence>
                    </ul>
                </>
            )}
        </div>
    );
}

function ImportRow({
    item,
    onDismiss,
}: {
    item: TrackImportCard;
    onDismiss: () => void;
}) {
    const track = item.status === 'done' ? item.track : null;
    const running = isActive(item);

    return (
        <div className="flex items-start gap-3">
            <TrackCover
                url={track?.cover_url ?? null}
                seed={track?.key ?? item.url}
                className="size-11 shrink-0 rounded-xl"
            />
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                    {track ? `${track.title} · ${track.artist}` : item.host}
                </p>
                <p
                    className={cn(
                        'mt-0.5 flex items-center gap-1.5 text-xs',
                        item.status === 'failed'
                            ? 'text-rose-300'
                            : item.status === 'done'
                              ? 'text-emerald-300'
                              : 'text-white/50',
                    )}
                >
                    {running ? (
                        <Loader2 className="size-3.5 animate-spin" />
                    ) : item.status === 'done' ? (
                        <CheckCircle2 className="size-3.5" />
                    ) : (
                        <AlertCircle className="size-3.5" />
                    )}
                    {statusLabel(item)}
                </p>
                {running && (
                    <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={item.progress ?? undefined}
                        className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"
                    >
                        {item.status === 'downloading' &&
                        item.progress !== null ? (
                            <div
                                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                                style={{ width: `${item.progress}%` }}
                            />
                        ) : (
                            <div className="h-full w-1/3 rounded-full bg-primary/70 motion-safe:animate-pulse" />
                        )}
                    </div>
                )}
                {item.status === 'failed' && item.error && (
                    <p className="mt-1 text-xs leading-relaxed text-rose-200/80">
                        {item.error}
                    </p>
                )}
                {track && (
                    <button
                        type="button"
                        onClick={() => playQueue([track], 0)}
                        className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 text-xs font-semibold text-white/85 transition-colors hover:border-white/30 hover:text-white"
                    >
                        <Play className="size-3.5" />
                        {tr('Слухати')}
                    </button>
                )}
            </div>
            {!running && (
                <button
                    type="button"
                    onClick={onDismiss}
                    className="rounded-full p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
                    aria-label={tr('Прибрати')}
                >
                    <X className="size-4" />
                </button>
            )}
        </div>
    );
}
