import { ChevronLeft, ChevronRight, ImagePlus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/gc/user-avatar';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

type EventStory = {
    id: number;
    media_type: 'image' | 'video';
    url: string;
    caption: string | null;
    author: UserCard | null;
};

/** Спільні історії події: стрічка мініатюр, перегляд на весь екран, «Додати свою». */
export function EventStories({
    base,
    canAdd,
}: {
    base: string;
    canAdd: boolean;
}) {
    const [stories, setStories] = useState<EventStory[] | null>(null);
    const [open, setOpen] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => {
        void api<{ stories: EventStory[] }>('GET', `${base}/stories`)
            .then((d) => setStories(d.stories))
            .catch(() => setStories([]));
    }, [base]);

    const upload = (file: File) => {
        const data = new FormData();
        data.append('media', file);
        setBusy(true);
        void api<{ stories: EventStory[] }>('POST', `${base}/stories`, data)
            .then((d) => {
                setStories(d.stories);
                toast.success(tr('Історію додано до події.'));
            })
            .catch((e: unknown) =>
                toast.error(
                    e instanceof ApiError ? e.message : tr('Не вдалося.'),
                ),
            )
            .finally(() => setBusy(false));
    };

    if (stories === null || (stories.length === 0 && !canAdd)) return null;
    const current = open !== null ? stories[open] : null;

    return (
        <div className="mt-3">
            <div className="scrollbar-none flex gap-2 overflow-x-auto">
                {canAdd && (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => input.current?.click()}
                        className="flex h-24 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-white/[0.06] text-[11px] text-white/70 transition hover:bg-white/[0.1] disabled:opacity-50"
                    >
                        <ImagePlus className="size-5" />
                        {tr('Своя')}
                    </button>
                )}
                {stories.map((s, i) => (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => setOpen(i)}
                        className="relative h-24 w-16 shrink-0 overflow-hidden rounded-xl bg-white/[0.06]"
                    >
                        {s.media_type === 'video' ? (
                            <video
                                src={s.url}
                                muted
                                className="size-full object-cover"
                            />
                        ) : (
                            <img
                                src={s.url}
                                alt=""
                                loading="lazy"
                                className="size-full object-cover"
                            />
                        )}
                        {s.author && (
                            <span className="absolute bottom-1 left-1">
                                <UserAvatar
                                    user={s.author}
                                    size="xs"
                                    showOnline={false}
                                />
                            </span>
                        )}
                    </button>
                ))}
            </div>
            <input
                ref={input}
                type="file"
                accept="image/*,video/*"
                hidden
                onChange={(e) =>
                    e.target.files?.[0] && upload(e.target.files[0])
                }
            />
            {current && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setOpen(null)}
                >
                    <button
                        type="button"
                        aria-label={tr('Закрити')}
                        className="absolute top-4 right-4 text-white/80"
                        onClick={() => setOpen(null)}
                    >
                        <X className="size-7" />
                    </button>
                    {open! > 0 && (
                        <button
                            type="button"
                            aria-label={tr('Назад')}
                            className="absolute left-2 text-white/80"
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpen(open! - 1);
                            }}
                        >
                            <ChevronLeft className="size-9" />
                        </button>
                    )}
                    <div
                        className="max-h-[90dvh] max-w-[min(90vw,28rem)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {current.media_type === 'video' ? (
                            <video
                                src={current.url}
                                autoPlay
                                controls
                                className="max-h-[80dvh] rounded-2xl"
                            />
                        ) : (
                            <img
                                src={current.url}
                                alt={current.caption ?? ''}
                                className="max-h-[80dvh] rounded-2xl"
                            />
                        )}
                        <p className="mt-2 text-center text-sm text-white/80">
                            {current.author?.name}
                            {current.caption && ` · ${current.caption}`}
                        </p>
                    </div>
                    {open! < stories.length - 1 && (
                        <button
                            type="button"
                            aria-label={tr('Далі')}
                            className="absolute right-2 text-white/80"
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpen(open! + 1);
                            }}
                        >
                            <ChevronRight className="size-9" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
