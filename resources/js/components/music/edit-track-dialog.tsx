import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import type { LocalTrack } from '@/types';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';

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

    useEffect(() => {
        if (!track) return;
        setReady(false);
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

    const save = async () => {
        if (!track) return;
        setSaving(true);
        try {
            const response = await api<{ track: LocalTrack }>(
                'PATCH',
                `/music/tracks/${track.id}`,
                data,
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
            <DialogContent className="glass-strong gap-0 rounded-3xl border-white/10 p-6 text-white sm:max-w-md">
                <DialogTitle className="font-display text-xl">
                    {tr('Редагування треку')}
                </DialogTitle>
                <div className="mt-5 grid gap-3">
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
                        </label>
                    )}
                </div>
                <div className="mt-6 flex justify-end gap-2">
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
