import { useForm } from '@inertiajs/react';
import { Globe2, Lock, MessageCircle, UsersRound } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { AlbumPrivacy, PhotoAlbumCard } from '@/types';

export const privacyMeta: Record<
    AlbumPrivacy,
    { label: string; text: string; icon: typeof Globe2 }
> = {
    public: { label: 'Усі', text: 'Бачать усі користувачі', icon: Globe2 },
    friends: {
        label: 'Друзі',
        text: 'Лише ваші друзі',
        icon: UsersRound,
    },
    private: { label: 'Тільки я', text: 'Приватний альбом', icon: Lock },
};

export function AlbumDialog({
    open,
    onOpenChange,
    album,
    community,
    privacyOptions,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    album?: PhotoAlbumCard;
    community?: string;
    privacyOptions: AlbumPrivacy[];
}) {
    const form = useForm({
        title: album?.title ?? '',
        description: album?.description ?? '',
        privacy: album?.privacy ?? ('public' as AlbumPrivacy),
        comments_enabled: album?.comments_enabled ?? true,
        community: community ?? null,
    });

    const submit = () => {
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                if (!album) form.reset();
                onOpenChange(false);
            },
        };

        if (album) form.patch(`/albums/${album.id}`, options);
        else form.post('/albums', options);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="glass-strong gap-0 rounded-3xl border-white/10 p-6 text-white sm:max-w-lg">
                <DialogTitle className="font-display text-xl">
                    {album ? 'Редагування альбому' : 'Новий альбом'}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-white/50">
                    Скріншоти, турніри, косплей чи меми — збирайте моменти
                    разом.
                </DialogDescription>

                <label className="mt-5 block text-sm font-medium text-white/80">
                    Назва
                    <input
                        value={form.data.title}
                        onChange={(event) =>
                            form.setData('title', event.target.value)
                        }
                        maxLength={80}
                        autoFocus
                        placeholder="Наприклад, «Кращі моменти сезону»"
                        className="input-glass mt-1.5 h-11 w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                </label>
                {form.errors.title && (
                    <p className="mt-1 text-xs text-rose-300">
                        {form.errors.title}
                    </p>
                )}

                <label className="mt-4 block text-sm font-medium text-white/80">
                    Опис
                    <textarea
                        value={form.data.description}
                        onChange={(event) =>
                            form.setData('description', event.target.value)
                        }
                        maxLength={500}
                        rows={3}
                        placeholder="Необов'язково"
                        className="input-glass mt-1.5 w-full resize-none rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                </label>

                <div className="mt-4 text-sm font-medium text-white/80">
                    Хто бачить альбом
                    <div
                        className={cn(
                            'mt-1.5 grid gap-2',
                            privacyOptions.length === 3
                                ? 'grid-cols-3'
                                : 'grid-cols-2',
                        )}
                    >
                        {privacyOptions.map((value) => {
                            const meta = privacyMeta[value];
                            const active = form.data.privacy === value;

                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() =>
                                        form.setData('privacy', value)
                                    }
                                    className={cn(
                                        'flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-xs transition',
                                        active
                                            ? 'border-[#7c8cff]/60 bg-[#6d5dfc]/15 text-white shadow-[0_0_24px_-10px_rgb(124_92_255/0.9)]'
                                            : 'border-white/[0.07] bg-white/[0.03] text-white/55 hover:border-white/15',
                                    )}
                                >
                                    <meta.icon className="size-4" />
                                    {value === 'public' && community
                                        ? 'Усі відвідувачі'
                                        : value === 'private' && community
                                          ? 'Лише керівники'
                                          : meta.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-white/80">
                    <MessageCircle className="size-4 text-[#9aa8ff]" />
                    <span className="flex-1">Дозволити коментарі</span>
                    <input
                        type="checkbox"
                        checked={form.data.comments_enabled}
                        onChange={(event) =>
                            form.setData(
                                'comments_enabled',
                                event.target.checked,
                            )
                        }
                        className="size-4 accent-[#7c5cff]"
                    />
                </label>

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="rounded-xl px-4 py-2.5 text-sm text-white/60 hover:bg-white/5 hover:text-white"
                    >
                        Скасувати
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={
                            form.processing || form.data.title.trim() === ''
                        }
                        className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                    >
                        {album ? 'Зберегти' : 'Створити'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
