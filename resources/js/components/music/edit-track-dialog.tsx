import { ImagePlus, Loader2, Undo2, WandSparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { TrackCover } from '@/components/music/track-cover';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import type { LocalTrack } from '@/types';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';

/** Назви джерел метаданих для підпису «Знайдено в: …». */
const SOURCES: Record<string, string> = {
    tags: tr('теги файлу'),
    acoustid: 'AcoustID',
    musicbrainz: 'MusicBrainz',
    coverartarchive: 'Cover Art Archive',
    discogs: 'Discogs',
    spotify: 'Spotify',
    lastfm: 'Last.fm',
    lrclib: 'LRCLIB',
};

type Suggestion = {
    fields: Partial<
        Record<
            | 'title'
            | 'artist'
            | 'album'
            | 'genre'
            | 'lyrics'
            | 'year'
            | 'track_no',
            { value: string | number; source: string }
        >
    >;
    cover: { url: string | null; embedded: boolean; source: string } | null;
    sources: string[];
};

const fields = [
    ['title', tr('Назва')],
    ['artist', tr('Виконавець')],
    ['album', tr('Альбом')],
    ['genre', tr('Жанр')],
] as const;

export function EditTrackDialog({
    track,
    onOpenChange,
    onSaved,
}: {
    track: LocalTrack | null;
    onOpenChange: (open: boolean) => void;
    onSaved: (track: LocalTrack) => void;
}) {
    const lyricsOn = usePlugin('lyrics');
    const [data, setData] = useState({
        title: '',
        artist: '',
        album: '',
        genre: '',
        lyrics: '',
    });
    const [saving, setSaving] = useState(false);
    const [ready, setReady] = useState(false);
    // Нова обкладинка (файл) і її прев’ю; на сервер іде лише разом зі «Зберегти».
    const [cover, setCover] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const coverInput = useRef<HTMLInputElement>(null);
    // «Знайти дані автоматично»: обкладинка з джерела (посилання або вбудована у файл) і що було до підказки.
    const [found, setFound] = useState<{
        url: string | null;
        embedded: boolean;
    } | null>(null);
    const [looking, setLooking] = useState(false);
    const [sources, setSources] = useState<string[]>([]);
    const [before, setBefore] = useState<typeof data | null>(null);

    useEffect(() => {
        if (!cover) {
            setPreview(null);

            return;
        }
        const url = URL.createObjectURL(cover);
        setPreview(url);

        return () => URL.revokeObjectURL(url);
    }, [cover]);

    const pickCover = (file: File | undefined) => {
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            toast.error(
                tr('Обкладинка має бути картинкою (JPG, PNG або WebP).'),
            );

            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error(tr('Обкладинка завелика (максимум 5 МБ).'));

            return;
        }
        setCover(file);
    };

    useEffect(() => {
        if (!track) return;
        setReady(false);
        setCover(null);
        setFound(null);
        setSources([]);
        setBefore(null);
        setData({
            title: track.title,
            artist: track.artist,
            album: track.album ?? '',
            genre: track.genre ?? '',
            lyrics: '',
        });
        void api<{ lyrics: string | null }>(
            'GET',
            `/music/tracks/${track.id}/lyrics`,
        )
            .then((response) =>
                setData((current) => ({
                    ...current,
                    lyrics: response.lyrics ?? '',
                })),
            )
            .finally(() => setReady(true));
    }, [track]);

    const lookup = async () => {
        if (!track) return;
        setLooking(true);
        try {
            const result = await api<Suggestion>(
                'GET',
                `/music/tracks/${track.id}/metadata`,
            );
            const next = { ...data };
            const filled: string[] = [];
            for (const key of ['title', 'artist', 'album', 'genre'] as const) {
                const value = result.fields[key]?.value;
                if (value !== undefined && String(value) !== next[key]) {
                    next[key] = String(value);
                    filled.push(key);
                }
            }
            // Текст — лише якщо свого ще немає (не перетираємо вставлений вручну).
            const lyrics = result.fields.lyrics?.value;
            if (lyricsOn && lyrics && !next.lyrics.trim()) {
                next.lyrics = String(lyrics);
                filled.push('lyrics');
            }
            if (result.cover && !cover) {
                setFound({
                    url: result.cover.url,
                    embedded: result.cover.embedded,
                });
                filled.push('cover');
            }
            const used = result.sources.filter((source) => source in SOURCES);
            setSources(used);
            if (filled.length === 0) {
                toast.message(
                    used.length > 0
                        ? tr('Нового нічого не знайдено — дані вже збігаються.')
                        : tr(
                              'Нічого не знайдено. Перевірте назву й виконавця.',
                          ),
                );

                return;
            }
            setBefore(data);
            setData(next);
            toast.success(tr('Дані заповнено — перевірте й збережіть.'));
        } catch (error) {
            toast.error(
                error instanceof ApiError
                    ? error.message
                    : tr('Не вдалося знайти дані.'),
            );
        } finally {
            setLooking(false);
        }
    };

    const save = async () => {
        if (!track) return;
        setSaving(true);
        try {
            let body: Record<string, unknown> | FormData = {
                ...data,
                ...(found?.url ? { cover_url: found.url } : {}),
                ...(found?.embedded ? { cover_embedded: true } : {}),
            };
            let method: 'PATCH' | 'POST' = 'PATCH';
            if (cover) {
                // Файл — лише multipart POST: у PATCH PHP файлів не розбирає (Laravel читає _method).
                const form = new FormData();
                Object.entries(data).forEach(([key, value]) =>
                    form.append(key, value),
                );
                form.append('cover', cover);
                form.append('_method', 'PATCH');
                body = form;
                method = 'POST';
            }
            const response = await api<{ track: LocalTrack }>(
                method,
                `/music/tracks/${track.id}`,
                body,
            );
            onSaved(response.track);
            onOpenChange(false);
            toast.success(tr('Трек оновлено.'));
        } catch (error) {
            toast.error(
                error instanceof ApiError ? error.message : tr('Не вдалося.'),
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={track !== null} onOpenChange={onOpenChange}>
            <DialogContent className="glass-strong flex max-h-[calc(100dvh-2rem)] flex-col gap-0 rounded-3xl border-white/10 p-0 text-white sm:max-w-md">
                <DialogTitle className="shrink-0 px-6 pt-6 font-display text-xl">
                    {tr('Редагування треку')}
                </DialogTitle>
                {/* Поля прокручуються, а «Зберегти» завжди видно — не ховається під панеллю Android. */}
                <div className="mt-5 grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain px-6 pb-2">
                    <div className="flex items-center gap-4">
                        <TrackCover
                            url={preview ?? found?.url ?? track?.cover_url}
                            seed={track?.id}
                            className="size-20 rounded-2xl"
                        />
                        <div className="min-w-0">
                            <button
                                type="button"
                                onClick={() => coverInput.current?.click()}
                                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/[0.06] px-3.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.1] hover:text-white"
                            >
                                <ImagePlus className="size-4" />
                                {track?.cover_url || preview
                                    ? tr('Змінити обкладинку')
                                    : tr('Додати обкладинку')}
                            </button>
                            <span className="mt-1.5 block text-xs text-white/45">
                                {tr('JPG, PNG або WebP, до 5 МБ')}
                            </span>
                        </div>
                        <input
                            ref={coverInput}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(event) => {
                                pickCover(event.target.files?.[0]);
                                event.target.value = '';
                            }}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => void lookup()}
                            disabled={looking || !ready}
                            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-gc-blue/20 px-3.5 text-sm font-semibold text-gc-sky transition hover:bg-gc-blue/30 disabled:opacity-50"
                        >
                            {looking ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <WandSparkles className="size-4" />
                            )}
                            {looking
                                ? tr('Шукаємо…')
                                : tr('Знайти дані автоматично')}
                        </button>
                        {before && (
                            <button
                                type="button"
                                onClick={() => {
                                    setData(before);
                                    setBefore(null);
                                    setFound(null);
                                }}
                                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm text-white/60 hover:bg-white/5 hover:text-white"
                            >
                                <Undo2 className="size-4" />
                                {tr('Повернути')}
                            </button>
                        )}
                        {sources.length > 0 && (
                            <span className="basis-full text-xs text-white/45">
                                {tr('Джерела: {list}', {
                                    list: sources
                                        .map((source) => SOURCES[source])
                                        .join(', '),
                                })}
                            </span>
                        )}
                    </div>
                    {fields.map(([key, label]) => (
                        <label
                            key={key}
                            className="text-sm font-medium text-white/80"
                        >
                            {label}
                            <input
                                value={data[key]}
                                onChange={(event) =>
                                    setData({
                                        ...data,
                                        [key]: event.target.value,
                                    })
                                }
                                maxLength={key === 'genre' ? 40 : 150}
                                className="input-glass mt-1.5 h-10 w-full rounded-xl px-3.5 text-sm text-white focus:outline-none"
                            />
                        </label>
                    ))}
                    {lyricsOn && (
                        <label className="text-sm font-medium text-white/80">
                            {tr('Текст пісні')}
                            <textarea
                                value={data.lyrics}
                                onChange={(event) =>
                                    setData({
                                        ...data,
                                        lyrics: event.target.value,
                                    })
                                }
                                maxLength={8000}
                                rows={6}
                                className="input-glass mt-1.5 w-full rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
                            />
                            <span className="mt-1.5 block text-xs font-normal text-white/45">
                                {tr(
                                    'Вставте текст у форматі LRC ([01:23.45] рядок) — у плеєрі рядки підсвічуватимуться в такт пісні.',
                                )}
                            </span>
                        </label>
                    )}
                </div>
                <div className="flex shrink-0 justify-end gap-2 border-t border-white/10 px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="rounded-xl px-4 py-2.5 text-sm text-white/60 hover:bg-white/5 hover:text-white"
                    >
                        {tr('Скасувати')}
                    </button>
                    <button
                        type="button"
                        onClick={save}
                        disabled={
                            saving ||
                            !ready ||
                            !data.title.trim() ||
                            !data.artist.trim()
                        }
                        className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                    >
                        {tr('Зберегти')}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
