import { Head, InfiniteScroll, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    ImagePlus,
    MessageCircleOff,
    PenLine,
    Trash2,
    UploadCloud,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/gc/widget';
import { AlbumDialog, privacyMeta } from '@/components/photos/album-dialog';
import { PhotoTile, photoGridClass } from '@/components/photos/photo-grid';
import { PhotoViewer } from '@/components/photos/photo-viewer';
import { formatDate, plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    AlbumPrivacy,
    PhotoAlbumDetails,
    PhotoThumb,
    ScrollData,
} from '@/types';
import { tr } from '@/lib/i18n';

type Props = {
    album: PhotoAlbumDetails;
    photos: ScrollData<PhotoThumb>;
    openPhoto: number | null;
    can: { manage: boolean; upload: boolean };
    privacyOptions: AlbumPrivacy[];
    limits: { upload: number };
};

function setPhotoParam(id: number | null) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('photo', String(id));
    else url.searchParams.delete('photo');
    window.history.replaceState(window.history.state, '', url);
}

export default function PhotoAlbum({
    album,
    photos,
    openPhoto,
    can,
    privacyOptions,
    limits,
}: Props) {
    const [editing, setEditing] = useState(false);
    const [openId, setOpenId] = useState<number | null>(openPhoto);
    const [hidden, setHidden] = useState<number[]>([]);
    const [dragging, setDragging] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);
    const input = useRef<HTMLInputElement>(null);
    const Privacy = privacyMeta[album.privacy].icon;

    useEffect(() => setPhotoParam(openId), [openId]);

    const upload = (list: FileList | File[]) => {
        const files = Array.from(list).filter((file) =>
            file.type.startsWith('image/'),
        );
        if (files.length === 0) return;
        if (files.length > limits.upload) {
            toast.error(
                tr('За раз можна завантажити до {upload} фото.', {
                    upload: limits.upload,
                }),
            );

            return;
        }

        router.post(
            `/albums/${album.id}/photos`,
            { photos: files },
            {
                forceFormData: true,
                preserveScroll: true,
                onProgress: (event) => setProgress(event?.percentage ?? null),
                onError: (errors) =>
                    toast.error(
                        Object.values(errors)[0] ??
                            tr('Не вдалося завантажити фото.'),
                    ),
                onFinish: () => setProgress(null),
            },
        );
    };

    const destroy = () => {
        if (
            !window.confirm(
                tr('Видалити альбом «{title}» разом з усіма фото?', {
                    title: album.title,
                }),
            )
        )
            return;
        router.delete(`/albums/${album.id}`);
    };

    const preview = photos.data.find((photo) => photo.id === openId);

    return (
        <>
            <Head title={album.title} />
            <div
                className="space-y-5"
                onDragOver={(event) => {
                    if (!can.upload) return;
                    event.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={(event) => {
                    if (event.currentTarget === event.target)
                        setDragging(false);
                }}
                onDrop={(event) => {
                    if (!can.upload) return;
                    event.preventDefault();
                    setDragging(false);
                    upload(event.dataTransfer.files);
                }}
            >
                <section className="glass relative overflow-hidden rounded-3xl">
                    {album.cover_url && (
                        <img
                            src={album.cover_url}
                            alt=""
                            className="absolute inset-0 size-full scale-110 object-cover opacity-25 blur-2xl"
                        />
                    )}
                    <div className="pointer-events-none absolute -top-28 -right-10 size-80 rounded-full bg-gc-purple/20 blur-3xl" />
                    <div className="relative flex flex-wrap items-end gap-4 p-5 sm:p-6">
                        <div className="min-w-0 flex-1">
                            <Link
                                href={album.owner.photos_href}
                                className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white"
                            >
                                <ArrowLeft className="size-3.5" />
                                {tr('Фотографії')} {album.owner.name}
                            </Link>
                            <h1 className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">
                                {album.title}
                            </h1>
                            {album.description && (
                                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed whitespace-pre-line text-white/60">
                                    {album.description}
                                </p>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/55">
                                <span className="rounded-full bg-white/[0.06] px-3 py-1">
                                    {album.photos_count}{' '}
                                    {plural(album.photos_count, [
                                        'фотографія',
                                        'фотографії',
                                        'фотографій',
                                    ])}
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1">
                                    <Privacy className="size-3.5" />
                                    {privacyMeta[album.privacy].text}
                                </span>
                                {!album.comments_enabled && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1">
                                        <MessageCircleOff className="size-3.5" />
                                        {tr('Коментарі вимкнено')}
                                    </span>
                                )}
                                <span className="px-1">
                                    {tr('Оновлено')}{' '}
                                    {formatDate(album.updated_at, false)}
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {can.manage && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setEditing(true)}
                                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/[0.06] px-4 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                                    >
                                        <PenLine className="size-4" />
                                        <span className="hidden sm:inline">
                                            {tr('Редагувати')}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={destroy}
                                        className="inline-flex size-11 items-center justify-center rounded-xl bg-white/[0.06] text-white/60 transition hover:bg-rose-500/15 hover:text-rose-300"
                                        aria-label={tr('Видалити альбом')}
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                </>
                            )}
                            {can.upload && (
                                <button
                                    type="button"
                                    onClick={() => input.current?.click()}
                                    disabled={progress !== null}
                                    className="btn-glow inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold disabled:opacity-60"
                                >
                                    <ImagePlus className="size-4" />{' '}
                                    {tr('Додати фото')}
                                </button>
                            )}
                        </div>
                    </div>
                    {progress !== null && (
                        <div className="relative h-1 bg-white/5">
                            <div
                                className="h-full bg-gradient-brand transition-[width]"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}
                </section>

                <input
                    ref={input}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(event) => {
                        if (event.target.files) upload(event.target.files);
                        event.target.value = '';
                    }}
                />

                {photos.data.length === 0 ? (
                    can.upload ? (
                        <button
                            type="button"
                            onClick={() => input.current?.click()}
                            className={cn(
                                'glass flex w-full flex-col items-center rounded-3xl border-2 border-dashed px-6 py-16 text-center transition',
                                dragging
                                    ? 'border-gc-lilac-500 bg-gc-indigo/10'
                                    : 'border-white/10 hover:border-white/25',
                            )}
                        >
                            <UploadCloud className="size-12 text-gc-lilac-300" />
                            <span className="mt-4 font-display text-lg font-semibold text-white">
                                {tr('Перетягніть фото сюди')}
                            </span>
                            <span className="mt-1 text-sm text-white/50">
                                {tr('або натисніть, щоб вибрати — до')}{' '}
                                {limits.upload} {tr('файлів за раз')}
                            </span>
                        </button>
                    ) : (
                        <EmptyState
                            icon={ImagePlus}
                            title={tr('Альбом поки порожній')}
                        />
                    )
                ) : (
                    <section className="glass rounded-3xl p-3 sm:p-4">
                        <InfiniteScroll
                            data="photos"
                            preserveUrl
                            className={photoGridClass}
                        >
                            {photos.data
                                .filter((photo) => !hidden.includes(photo.id))
                                .map((photo) => (
                                    <PhotoTile
                                        key={photo.id}
                                        photo={photo}
                                        onOpen={(item) => setOpenId(item.id)}
                                    />
                                ))}
                        </InfiniteScroll>
                    </section>
                )}
            </div>

            {dragging && can.upload && (
                <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-[#05061a]/70 backdrop-blur-sm">
                    <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-gc-lilac-500 bg-gc-indigo/10 px-16 py-12 text-center">
                        <UploadCloud className="size-14 animate-bounce text-gc-lilac-300" />
                        <p className="mt-4 font-display text-xl font-semibold text-white">
                            {tr('Відпустіть, щоб завантажити в «')}
                            {album.title}»
                        </p>
                    </div>
                </div>
            )}

            {can.manage && (
                <AlbumDialog
                    open={editing}
                    onOpenChange={setEditing}
                    album={album}
                    community={album.owner.community?.slug}
                    privacyOptions={privacyOptions}
                />
            )}

            <PhotoViewer
                photoId={openId}
                previewUrl={preview?.url}
                onClose={() => setOpenId(null)}
                onNavigate={setOpenId}
                onDeleted={(id) => {
                    setHidden((list) => [...list, id]);
                    router.reload({ only: ['album'] });
                }}
                onCover={() => router.reload({ only: ['album'] })}
            />
        </>
    );
}
