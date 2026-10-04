import { useForm } from '@inertiajs/react';
import { Globe2, ImagePlus, Lock } from 'lucide-react';
import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { PlaylistCard } from '@/types';
import { tr } from '@/lib/i18n';

export function PlaylistDialog({
    open,
    onOpenChange,
    playlist,
    trackId,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    playlist?: PlaylistCard;
    trackId?: number;
}) {
    const form = useForm<{
        title: string;
        description: string;
        is_public: boolean;
        cover: File | null;
        track_id: number | null;
        stay: boolean;
    }>({
        title: playlist?.title ?? '',
        description: playlist?.description ?? '',
        is_public: playlist?.is_public ?? true,
        cover: null,
        track_id: trackId ?? null,
        stay: trackId !== undefined,
    });
    const [preview, setPreview] = useState<string | null>(
        playlist?.cover_url ?? null,
    );

    const submit = () => {
        const options = {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                if (!playlist) form.reset();
                onOpenChange(false);
            },
        };

        form.transform((data) => ({
            ...data,
            track_id: trackId ?? null,
            stay: trackId !== undefined,
            is_public: data.is_public ? 1 : 0,
        }));
        if (playlist) form.post(`/music/playlists/${playlist.id}`, options);
        else form.post('/music/playlists', options);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="glass-strong gap-0 rounded-3xl border-white/10 p-6 text-white sm:max-w-lg">
                <DialogTitle className="font-display text-xl">
                    {playlist
                        ? tr('Редагування плейлиста')
                        : tr('Новий плейлист')}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-white/50">
                    {tr(
                        'Зберіть настрій: для рейдів, нічного кодингу чи тренувань.',
                    )}
                </DialogDescription>

                <div className="mt-5 flex gap-4">
                    {playlist && (
                        <label className="group relative flex size-28 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-white/[0.05] ring-1 ring-white/10">
                            {preview ? (
                                <img
                                    src={preview}
                                    alt=""
                                    className="size-full object-cover"
                                />
                            ) : (
                                <ImagePlus className="size-7 text-white/40" />
                            )}
                            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-medium opacity-0 transition group-hover:opacity-100">
                                {tr('Обкладинка')}
                            </span>
                            <input
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (!file) return;
                                    form.setData('cover', file);
                                    setPreview(URL.createObjectURL(file));
                                }}
                            />
                        </label>
                    )}
                    <div className="min-w-0 flex-1 space-y-3">
                        <input
                            value={form.data.title}
                            onChange={(event) =>
                                form.setData('title', event.target.value)
                            }
                            maxLength={100}
                            autoFocus
                            placeholder={tr('Назва плейлиста')}
                            className="input-glass h-11 w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                        />
                        {form.errors.title && (
                            <p className="text-xs text-rose-300">
                                {form.errors.title}
                            </p>
                        )}
                        <textarea
                            value={form.data.description}
                            onChange={(event) =>
                                form.setData('description', event.target.value)
                            }
                            maxLength={500}
                            rows={playlist ? 2 : 3}
                            placeholder={tr('Опис (необов’язково)')}
                            className="input-glass w-full resize-none rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                        />
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                    {(
                        [
                            [true, tr('Публічний'), Globe2],
                            [false, tr('Лише для мене'), Lock],
                        ] as const
                    ).map(([value, label, Icon]) => (
                        <button
                            key={label}
                            type="button"
                            onClick={() => form.setData('is_public', value)}
                            className={cn(
                                'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition',
                                form.data.is_public === value
                                    ? 'border-[#7c8cff]/60 bg-[#6d5dfc]/15 text-white'
                                    : 'border-white/[0.07] text-white/55 hover:border-white/15',
                            )}
                        >
                            <Icon className="size-4" /> {label}
                        </button>
                    ))}
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
                        onClick={submit}
                        disabled={
                            form.processing || form.data.title.trim() === ''
                        }
                        className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                    >
                        {playlist ? tr('Зберегти') : tr('Створити')}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
