import { Head, InfiniteScroll, Link } from '@inertiajs/react';
import { ArrowLeft, Camera, FolderPlus, Images } from 'lucide-react';
import { useState } from 'react';
import { CommunityAvatar } from '@/components/gc/community-avatar';
import { UserAvatar } from '@/components/gc/user-avatar';
import { EmptyState } from '@/components/gc/widget';
import { AlbumCard } from '@/components/photos/album-card';
import { AlbumDialog } from '@/components/photos/album-dialog';
import { PhotoTile, photoGridClass } from '@/components/photos/photo-grid';
import { PhotoViewer } from '@/components/photos/photo-viewer';
import { plural } from '@/lib/format';
import type {
    AlbumPrivacy,
    PhotoAlbumCard,
    PhotoOwner,
    PhotoThumb,
    ScrollData,
} from '@/types';

type Props = {
    owner: PhotoOwner;
    albums: PhotoAlbumCard[];
    photos: ScrollData<PhotoThumb>;
    total: number;
    can: { create: boolean };
    privacyOptions: AlbumPrivacy[];
};

export default function PhotosIndex({
    owner,
    albums,
    photos,
    total,
    can,
    privacyOptions,
}: Props) {
    const [creating, setCreating] = useState(false);
    const [open, setOpen] = useState<PhotoThumb | null>(null);
    const [openId, setOpenId] = useState<number | null>(null);
    const [hidden, setHidden] = useState<number[]>([]);

    const title =
        owner.type === 'community'
            ? `Фотографії спільноти ${owner.name}`
            : `Фотографії ${owner.name}`;

    return (
        <>
            <Head title={title} />
            <div className="space-y-5">
                <section className="glass relative overflow-hidden rounded-3xl p-5 sm:p-6">
                    <div className="pointer-events-none absolute -top-28 -right-10 size-80 rounded-full bg-[#38e1ff]/15 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-32 left-16 size-72 rounded-full bg-[#a855f7]/20 blur-3xl" />
                    <div className="relative flex flex-wrap items-center gap-4">
                        <Link href={owner.href} className="shrink-0">
                            {owner.community ? (
                                <CommunityAvatar
                                    community={owner.community}
                                    size="lg"
                                    ring
                                />
                            ) : owner.user ? (
                                <UserAvatar user={owner.user} size="lg" />
                            ) : null}
                        </Link>
                        <div className="min-w-0 flex-1">
                            <Link
                                href={owner.href}
                                className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white"
                            >
                                <ArrowLeft className="size-3.5" />
                                {owner.type === 'community'
                                    ? 'До спільноти'
                                    : 'До профілю'}
                            </Link>
                            <h1 className="mt-0.5 truncate font-display text-2xl font-bold text-white">
                                <span className="text-gradient">
                                    Фотографії
                                </span>{' '}
                                {owner.name}
                            </h1>
                            <p className="mt-0.5 text-sm text-white/50">
                                {albums.length}{' '}
                                {plural(albums.length, [
                                    'альбом',
                                    'альбоми',
                                    'альбомів',
                                ])}{' '}
                                · {total}{' '}
                                {plural(total, [
                                    'фотографія',
                                    'фотографії',
                                    'фотографій',
                                ])}
                            </p>
                        </div>
                        {can.create && (
                            <button
                                type="button"
                                onClick={() => setCreating(true)}
                                className="btn-glow inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold"
                            >
                                <FolderPlus className="size-4" /> Створити
                                альбом
                            </button>
                        )}
                    </div>
                </section>

                {albums.length === 0 ? (
                    <EmptyState
                        icon={Camera}
                        title="Тут поки немає альбомів"
                        text={
                            can.create
                                ? 'Створіть перший альбом і поділіться найкращими кадрами.'
                                : 'Коли з’являться відкриті альбоми, вони будуть тут.'
                        }
                        action={
                            can.create && (
                                <button
                                    type="button"
                                    onClick={() => setCreating(true)}
                                    className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold"
                                >
                                    Створити альбом
                                </button>
                            )
                        }
                    />
                ) : (
                    <>
                        <section>
                            <h2 className="mb-3 px-1 font-display text-[13px] font-semibold tracking-wide text-white/70 uppercase">
                                Альбоми
                            </h2>
                            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                                {albums.map((album) => (
                                    <AlbumCard key={album.id} album={album} />
                                ))}
                            </div>
                        </section>

                        {photos.data.length > 0 && (
                            <section className="glass rounded-3xl p-3 sm:p-4">
                                <h2 className="mb-3 flex items-center gap-2 px-1 font-display text-[13px] font-semibold tracking-wide text-white/70 uppercase">
                                    <Images className="size-4 text-[#8fa0ff]" />
                                    Усі фотографії
                                </h2>
                                <InfiniteScroll
                                    data="photos"
                                    preserveUrl
                                    className={photoGridClass}
                                >
                                    {photos.data
                                        .filter(
                                            (photo) =>
                                                !hidden.includes(photo.id),
                                        )
                                        .map((photo) => (
                                            <PhotoTile
                                                key={photo.id}
                                                photo={photo}
                                                onOpen={(item) => {
                                                    setOpen(item);
                                                    setOpenId(item.id);
                                                }}
                                            />
                                        ))}
                                </InfiniteScroll>
                            </section>
                        )}
                    </>
                )}
            </div>

            <AlbumDialog
                open={creating}
                onOpenChange={setCreating}
                community={owner.community?.slug}
                privacyOptions={privacyOptions}
            />

            <PhotoViewer
                photoId={openId}
                previewUrl={open?.id === openId ? open?.url : null}
                onClose={() => setOpenId(null)}
                onNavigate={setOpenId}
                onDeleted={(id) => setHidden((list) => [...list, id])}
            />
        </>
    );
}
