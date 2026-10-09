import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Link } from '@inertiajs/react';
import {
    ChevronLeft,
    ChevronRight,
    Download,
    Eye,
    ImageIcon,
    Link2,
    MoreHorizontal,
    PenLine,
    Trash2,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CommunityAvatar } from '@/components/gc/community-avatar';
import { Comments } from '@/components/gc/comments';
import { LikeButton } from '@/components/gc/like-button';
import { UserAvatar } from '@/components/gc/user-avatar';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api, ApiError } from '@/lib/api';
import { compactNumber, timeAgo } from '@/lib/format';
import type { CommentItem, PhotoDetails, PhotoShowResponse } from '@/types';
import { tr } from '@/lib/i18n';

type Props = {
    photoId: number | null;
    previewUrl?: string | null;
    onClose: () => void;
    onNavigate: (id: number) => void;
    onUpdated?: (photo: PhotoDetails) => void;
    onDeleted?: (id: number) => void;
    onCover?: (photo: PhotoDetails) => void;
};

const itemClass = 'rounded-lg focus:bg-white/[0.06]';

export function PhotoViewer({
    photoId,
    previewUrl,
    onClose,
    onNavigate,
    onUpdated,
    onDeleted,
    onCover,
}: Props) {
    const [data, setData] = useState<{
        photo: PhotoDetails;
        comments: CommentItem[];
    } | null>(null);
    const [editing, setEditing] = useState(false);
    const [caption, setCaption] = useState('');
    const [alt, setAlt] = useState('');
    const [sensitive, setSensitive] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const [tagName, setTagName] = useState('');

    useEffect(() => {
        if (photoId === null) return;
        let cancelled = false;
        setEditing(false);
        setRevealed(false);

        api<PhotoShowResponse>('GET', `/photos/${photoId}`)
            .then((response) => {
                if (!cancelled) setData(response);
            })
            .catch((error) => {
                toast.error(
                    error instanceof ApiError && error.status === 404
                        ? tr('Фото недоступне.')
                        : tr('Не вдалося відкрити фото.'),
                );
                onClose();
            });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [photoId]);

    const photo = data?.photo.id === photoId ? data.photo : null;

    useEffect(() => {
        if (photoId === null) return;
        const onKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            if (target.closest('input, textarea')) return;
            if (event.key === 'ArrowLeft' && photo?.prev_id)
                onNavigate(photo.prev_id);
            if (event.key === 'ArrowRight' && photo?.next_id)
                onNavigate(photo.next_id);
        };
        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [photoId, photo, onNavigate]);

    const patch = (next: Partial<PhotoDetails>) => {
        if (!data) return;
        const updated = { ...data.photo, ...next };
        setData({ ...data, photo: updated });
        onUpdated?.(updated);
    };

    const toggleLike = async () => {
        if (!photo) return;
        patch({
            liked: !photo.liked,
            likes_count: photo.likes_count + (photo.liked ? -1 : 1),
        });
        const response = await api<{ liked: boolean; likes_count: number }>(
            'POST',
            `/photos/${photo.id}/like`,
        );
        patch(response);
    };

    const saveCaption = async () => {
        if (!photo) return;
        const response = await api<{
            caption: string | null;
            alt: string | null;
            is_sensitive: boolean;
        }>('PATCH', `/photos/${photo.id}`, {
            caption,
            alt,
            is_sensitive: sensitive,
        });
        patch(response);
        setEditing(false);
    };

    const makeCover = async () => {
        if (!photo) return;
        await api('POST', `/photos/${photo.id}/cover`);
        patch({ is_cover: true });
        onCover?.(photo);
        toast.success(tr('Обкладинку альбому оновлено.'));
    };

    const remove = async () => {
        if (!photo || !window.confirm(tr('Видалити це фото?'))) return;
        await api('DELETE', `/photos/${photo.id}`);
        toast.success(tr('Фото видалено.'));
        onDeleted?.(photo.id);
        const next = photo.next_id ?? photo.prev_id;
        if (next) onNavigate(next);
        else onClose();
    };

    const copyLink = async () => {
        if (!photo) return;
        await navigator.clipboard?.writeText(
            `${window.location.origin}/albums/${photo.album.id}?photo=${photo.id}`,
        );
        toast.success(tr('Посилання скопійовано.'));
    };

    const imageUrl = photo?.url ?? previewUrl ?? null;
    const owner = photo?.album.owner;

    return (
        <DialogPrimitive.Root
            open={photoId !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#03040d]/92 backdrop-blur-xl data-[state=open]:animate-in data-[state=open]:fade-in-0" />
                <DialogPrimitive.Content
                    aria-describedby={undefined}
                    className="fixed inset-0 z-50 flex flex-col outline-none lg:flex-row"
                >
                    <DialogPrimitive.Title className="sr-only">
                        {tr('Перегляд фото')}
                    </DialogPrimitive.Title>

                    <div
                        className="relative flex min-h-[55vh] flex-1 items-center justify-center p-3 sm:p-6"
                        onClick={(event) => {
                            if (event.target === event.currentTarget) onClose();
                        }}
                    >
                        {imageUrl ? (
                            <>
                                <img
                                    key={imageUrl}
                                    src={imageUrl}
                                    alt={photo?.alt ?? ''}
                                    className={cn(
                                        'max-h-[calc(55vh-1.5rem)] max-w-full animate-in rounded-xl object-contain shadow-[0_30px_120px_-30px_rgb(124_92_255/0.6)] duration-300 fade-in-0 zoom-in-95 lg:max-h-[calc(100vh-3rem)]',
                                        photo?.is_sensitive &&
                                            !revealed &&
                                            'scale-105 blur-3xl',
                                    )}
                                />
                                {photo?.is_sensitive && !revealed && (
                                    <button
                                        type="button"
                                        onClick={() => setRevealed(true)}
                                        className="absolute rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15"
                                    >
                                        {tr('Показати')}
                                    </button>
                                )}
                            </>
                        ) : (
                            <span className="skeleton size-72 rounded-2xl" />
                        )}

                        {photo?.prev_id && (
                            <button
                                type="button"
                                onClick={() => onNavigate(photo.prev_id!)}
                                className="absolute top-1/2 left-3 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.06] text-white/80 ring-1 ring-white/10 backdrop-blur transition hover:bg-white/15 hover:text-white sm:left-6"
                                aria-label={tr('Попереднє фото')}
                            >
                                <ChevronLeft className="size-6" />
                            </button>
                        )}
                        {photo?.next_id && (
                            <button
                                type="button"
                                onClick={() => onNavigate(photo.next_id!)}
                                className="absolute top-1/2 right-3 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.06] text-white/80 ring-1 ring-white/10 backdrop-blur transition hover:bg-white/15 hover:text-white sm:right-6"
                                aria-label={tr('Наступне фото')}
                            >
                                <ChevronRight className="size-6" />
                            </button>
                        )}

                        <div className="absolute top-3 left-3 flex items-center gap-2 sm:top-5 sm:left-6">
                            {photo && (
                                <span className="rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white/75 backdrop-blur">
                                    {photo.position} {tr('з')}{' '}
                                    {photo.album.photos_count} ·{' '}
                                    <Link
                                        href={`/albums/${photo.album.id}`}
                                        className="text-white hover:underline"
                                    >
                                        {photo.album.title}
                                    </Link>
                                </span>
                            )}
                        </div>
                        <DialogPrimitive.Close
                            className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full bg-white/[0.06] text-white/80 ring-1 ring-white/10 backdrop-blur transition hover:bg-white/15 hover:text-white sm:top-5 sm:right-6 lg:hidden"
                            aria-label={tr('Закрити')}
                        >
                            <X className="size-5" />
                        </DialogPrimitive.Close>
                    </div>

                    <aside className="glass-strong flex max-h-[45vh] w-full shrink-0 flex-col border-white/[0.06] lg:max-h-none lg:w-[400px] lg:border-l">
                        <header className="flex items-center gap-3 border-b border-white/[0.06] p-4">
                            {owner ? (
                                <>
                                    <Link href={owner.href} onClick={onClose}>
                                        {owner.community ? (
                                            <CommunityAvatar
                                                community={owner.community}
                                                size="sm"
                                            />
                                        ) : owner.user ? (
                                            <UserAvatar
                                                user={owner.user}
                                                size="sm"
                                            />
                                        ) : null}
                                    </Link>
                                    <div className="min-w-0 flex-1">
                                        <Link
                                            href={owner.href}
                                            onClick={onClose}
                                            className="flex items-center gap-1 truncate text-sm font-semibold text-white hover:underline"
                                        >
                                            {owner.name}
                                            {(owner.user?.is_verified ||
                                                owner.community
                                                    ?.is_verified) && (
                                                <VerifiedBadge className="size-3.5" />
                                            )}
                                        </Link>
                                        <p className="text-xs text-white/45">
                                            {timeAgo(photo!.created_at)}
                                            {photo!.user &&
                                                owner.type === 'community' &&
                                                tr(' · додав(ла) {name}', {
                                                    name: photo!.user.name,
                                                })}
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-1 items-center gap-3">
                                    <span className="skeleton size-9 rounded-full" />
                                    <span className="skeleton h-4 w-32 rounded" />
                                </div>
                            )}

                            {photo && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger className="rounded-full p-1.5 text-white/50 transition outline-none hover:bg-white/[0.06] hover:text-white">
                                        <MoreHorizontal className="size-5" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="glass-strong z-[60] w-56 rounded-2xl border-white/10 p-1.5 text-white"
                                    >
                                        <DropdownMenuItem
                                            className={itemClass}
                                            onSelect={copyLink}
                                        >
                                            <Link2 />{' '}
                                            {tr('Копіювати посилання')}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className={itemClass}
                                            asChild
                                        >
                                            <a
                                                href={photo.url}
                                                download
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                <Download /> {tr('Завантажити')}
                                            </a>
                                        </DropdownMenuItem>
                                        {photo.can.edit && (
                                            <DropdownMenuItem
                                                className={itemClass}
                                                onSelect={() => {
                                                    setCaption(
                                                        photo.caption ?? '',
                                                    );
                                                    setAlt(photo.alt ?? '');
                                                    setSensitive(
                                                        photo.is_sensitive,
                                                    );
                                                    setEditing(true);
                                                }}
                                            >
                                                <PenLine />{' '}
                                                {tr('Редагувати опис')}
                                            </DropdownMenuItem>
                                        )}
                                        {photo.can.cover && !photo.is_cover && (
                                            <DropdownMenuItem
                                                className={itemClass}
                                                onSelect={makeCover}
                                            >
                                                <ImageIcon />{' '}
                                                {tr('Зробити обкладинкою')}
                                            </DropdownMenuItem>
                                        )}
                                        {photo.can.delete && (
                                            <>
                                                <DropdownMenuSeparator className="bg-white/5" />
                                                <DropdownMenuItem
                                                    className="rounded-lg text-rose-300 focus:bg-rose-500/10 focus:text-rose-200"
                                                    onSelect={remove}
                                                >
                                                    <Trash2 className="text-rose-300" />{' '}
                                                    {tr('Видалити фото')}
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                            <DialogPrimitive.Close
                                className="hidden rounded-full p-1.5 text-white/50 transition hover:bg-white/[0.06] hover:text-white lg:block"
                                aria-label={tr('Закрити')}
                            >
                                <X className="size-5" />
                            </DialogPrimitive.Close>
                        </header>

                        <div className="min-h-0 flex-1 overflow-y-auto p-4">
                            {photo && (
                                <>
                                    {editing ? (
                                        <div className="mb-4">
                                            <textarea
                                                value={caption}
                                                onChange={(event) =>
                                                    setCaption(
                                                        event.target.value,
                                                    )
                                                }
                                                maxLength={500}
                                                rows={3}
                                                autoFocus
                                                placeholder={tr(
                                                    'Опис фотографії',
                                                )}
                                                className="input-glass w-full resize-none rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                                            />
                                            <input
                                                value={alt}
                                                onChange={(event) =>
                                                    setAlt(event.target.value)
                                                }
                                                maxLength={200}
                                                placeholder={tr(
                                                    'Підпис для тих, хто не бачить зображення',
                                                )}
                                                className="input-glass mt-2 w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                                            />
                                            <label className="mt-2 flex items-center gap-2 text-sm text-white/70">
                                                <input
                                                    type="checkbox"
                                                    checked={sensitive}
                                                    onChange={(event) =>
                                                        setSensitive(
                                                            event.target
                                                                .checked,
                                                        )
                                                    }
                                                />
                                                {tr('Чутливе фото')}
                                            </label>
                                            <div className="mt-2 flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setEditing(false)
                                                    }
                                                    className="rounded-lg px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 hover:text-white"
                                                >
                                                    {tr('Скасувати')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={saveCaption}
                                                    className="btn-glow rounded-lg px-4 py-1.5 text-xs font-semibold"
                                                >
                                                    {tr('Зберегти')}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        photo.caption && (
                                            <p className="mb-4 text-[15px] leading-relaxed whitespace-pre-line text-white/85">
                                                {photo.caption}
                                            </p>
                                        )
                                    )}

                                    {(photo.tags.length > 0 ||
                                        photo.can.edit) && (
                                        <div className="mb-4">
                                            <p className="mb-2 text-xs text-white/45">
                                                {tr('На фото')}
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {photo.tags.map((person) => (
                                                    <span
                                                        key={person.username}
                                                        className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-sm text-white"
                                                    >
                                                        <Link
                                                            href={`/${person.username}`}
                                                        >
                                                            {person.name}
                                                        </Link>
                                                        {photo.can.edit && (
                                                            <button
                                                                type="button"
                                                                className="text-white/40 hover:text-white"
                                                                onClick={async () => {
                                                                    await api(
                                                                        'DELETE',
                                                                        `/photos/${photo.id}/tags/${person.username}`,
                                                                    );
                                                                    patch({
                                                                        tags: photo.tags.filter(
                                                                            (
                                                                                item,
                                                                            ) =>
                                                                                item.username !==
                                                                                person.username,
                                                                        ),
                                                                    });
                                                                }}
                                                            >
                                                                ×
                                                            </button>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                            {photo.can.edit && (
                                                <form
                                                    className="mt-2 flex gap-2"
                                                    onSubmit={async (event) => {
                                                        event.preventDefault();
                                                        if (!tagName.trim())
                                                            return;
                                                        const response =
                                                            await api<{
                                                                user: PhotoDetails['tags'][number];
                                                            }>(
                                                                'POST',
                                                                `/photos/${photo.id}/tags`,
                                                                {
                                                                    username:
                                                                        tagName.trim(),
                                                                },
                                                            );
                                                        patch({
                                                            tags: [
                                                                ...photo.tags,
                                                                response.user,
                                                            ],
                                                        });
                                                        setTagName('');
                                                    }}
                                                >
                                                    <input
                                                        value={tagName}
                                                        onChange={(event) =>
                                                            setTagName(
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                        placeholder={tr(
                                                            'Позначити друга',
                                                        )}
                                                        className="input-glass h-9 min-w-0 flex-1 rounded-xl px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                                                    />
                                                </form>
                                            )}
                                        </div>
                                    )}

                                    <div className="mb-4 flex items-center gap-2">
                                        <LikeButton
                                            liked={photo.liked}
                                            count={photo.likes_count}
                                            onToggle={toggleLike}
                                        />
                                        {photo.is_cover && (
                                            <span className="rounded-full bg-gc-indigo/15 px-3 py-1.5 text-xs font-medium text-[#b3bcff]">
                                                {tr('Обкладинка альбому')}
                                            </span>
                                        )}
                                        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-white/40">
                                            <Eye className="size-4" />
                                            {compactNumber(photo.views_count)}
                                        </span>
                                    </div>

                                    {photo.can.comment ||
                                    data!.comments.length > 0 ? (
                                        <Comments
                                            key={photo.id}
                                            endpoint={`/photos/${photo.id}/comments`}
                                            initial={data!.comments}
                                            total={photo.comments_count}
                                            canComment={photo.can.comment}
                                            onCountChange={(count) =>
                                                patch({ comments_count: count })
                                            }
                                        />
                                    ) : (
                                        <p className="border-t border-white/[0.06] pt-4 text-center text-xs text-white/40">
                                            {tr(
                                                'Коментарі до цього альбому вимкнено.',
                                            )}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    </aside>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
