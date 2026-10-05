import { Head, Link, router } from '@inertiajs/react';
import {
    FolderOpen,
    HardDrive,
    Heart,
    Images,
    MessageCircle,
    RotateCcw,
    Search,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, Pagination, StatCard } from '@/components/gc/admin';
import { Input } from '@/components/ui/input';
import { compactNumber, formatBytes, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Paginated, PhotoThumb, UserCard } from '@/types';
import { tr } from '@/lib/i18n';

type AdminPhoto = PhotoThumb & {
    caption: string | null;
    size: number | null;
    user: UserCard | null;
    album: { id: number; title: string; owner: string | null } | null;
    created_at: string;
    deleted_at: string | null;
};

type Props = {
    photos: Paginated<AdminPhoto>;
    filters: { q: string; trashed: boolean };
    stats: { photos: number; albums: number; size: number; trashed: number };
};

export default function AdminPhotos({ photos, filters, stats }: Props) {
    const [q, setQ] = useState(filters.q);

    const apply = (patch: Partial<Props['filters']>) => {
        const next = { ...filters, q, ...patch };
        router.get(
            '/admin/photos',
            { q: next.q || undefined, trashed: next.trashed ? 1 : undefined },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        apply({ q });
    };

    const remove = (photo: AdminPhoto) => {
        if (photo.deleted_at && !confirm(tr('Видалити фото назавжди?'))) return;
        router.delete(`/admin/photos/${photo.id}`, { preserveScroll: true });
    };

    return (
        <>
            <Head title={tr('Фотографії — Адмін-панель')} />
            <PageHeader
                title={tr('Фотографії')}
                description={
                    filters.trashed
                        ? tr('У кошику: {total}', { total: photos.total })
                        : tr('Модерація фото з усіх альбомів мережі')
                }
                actions={
                    <div className="glass flex rounded-xl p-1 text-sm">
                        {[
                            { label: tr('Активні'), value: false },
                            {
                                label: tr('Кошик ({trashed})', {
                                    trashed: stats.trashed,
                                }),
                                value: true,
                            },
                        ].map((tab) => (
                            <button
                                key={String(tab.value)}
                                type="button"
                                onClick={() => apply({ trashed: tab.value })}
                                className={cn(
                                    'rounded-lg px-3.5 py-1.5 font-medium transition',
                                    filters.trashed === tab.value
                                        ? 'bg-gradient-brand text-white'
                                        : 'text-white/55 hover:text-white',
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                }
            />

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard
                    label={tr('Фотографій')}
                    value={compactNumber(stats.photos)}
                    icon={Images}
                />
                <StatCard
                    label={tr('Альбомів')}
                    value={compactNumber(stats.albums)}
                    icon={FolderOpen}
                    tone="from-gc-mint to-gc-cyan"
                    delay={60}
                />
                <StatCard
                    label={tr('Займають на диску')}
                    value={formatBytes(stats.size)}
                    icon={HardDrive}
                    tone="from-gc-pink to-gc-purple"
                    delay={120}
                />
            </div>

            <form
                onSubmit={submit}
                className="glass relative mb-4 rounded-2xl p-2.5"
            >
                <Search className="pointer-events-none absolute top-1/2 left-6 size-4 -translate-y-1/2 text-white/30" />
                <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={tr('Опис, автор або назва альбому')}
                    className="h-10 pl-10"
                />
            </form>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {photos.data.map((photo) => (
                    <article
                        key={photo.id}
                        className={cn(
                            'glass group overflow-hidden rounded-2xl',
                            photo.deleted_at && 'opacity-70',
                        )}
                    >
                        <div className="relative aspect-square overflow-hidden bg-white/5">
                            <img
                                src={photo.url}
                                alt=""
                                loading="lazy"
                                className="size-full object-cover"
                            />
                            <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 transition group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                                {photo.deleted_at && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.post(
                                                `/admin/photos/${photo.id}/restore`,
                                                {},
                                                { preserveScroll: true },
                                            )
                                        }
                                        className="flex size-8 items-center justify-center rounded-lg bg-black/60 text-emerald-300 backdrop-blur hover:bg-black/80"
                                        title={tr('Відновити')}
                                    >
                                        <RotateCcw className="size-4" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => remove(photo)}
                                    className="flex size-8 items-center justify-center rounded-lg bg-black/60 text-rose-300 backdrop-blur hover:bg-black/80"
                                    title={
                                        photo.deleted_at
                                            ? tr('Видалити назавжди')
                                            : tr('У кошик')
                                    }
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </div>
                            <div className="absolute inset-x-0 bottom-0 flex gap-3 bg-gradient-to-t from-black/75 to-transparent px-2.5 pt-6 pb-2 text-xs text-white/80">
                                <span className="inline-flex items-center gap-1">
                                    <Heart className="size-3" />
                                    {photo.likes_count}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <MessageCircle className="size-3" />
                                    {photo.comments_count}
                                </span>
                                <span className="ml-auto">
                                    {formatBytes(photo.size)}
                                </span>
                            </div>
                        </div>
                        <div className="space-y-0.5 p-2.5 text-xs">
                            {photo.album && !photo.deleted_at ? (
                                <Link
                                    href={`/albums/${photo.album.id}?photo=${photo.id}`}
                                    className="block truncate font-medium text-white hover:underline"
                                >
                                    {photo.album.title}
                                </Link>
                            ) : (
                                <span className="block truncate font-medium text-white">
                                    {photo.album?.title ?? '—'}
                                </span>
                            )}
                            <span className="block truncate text-white/45">
                                {photo.album?.owner ?? photo.user?.name} ·{' '}
                                {timeAgo(photo.created_at)}
                            </span>
                        </div>
                    </article>
                ))}
            </div>
            {photos.data.length === 0 && (
                <div className="glass rounded-3xl px-6 py-14 text-center text-sm text-white/40">
                    {tr('Фотографій не знайдено')}
                </div>
            )}

            <Pagination data={photos} />
        </>
    );
}
