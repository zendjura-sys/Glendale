import { Link } from '@inertiajs/react';
import { Images } from 'lucide-react';
import { plural } from '@/lib/format';
import type { PhotoAlbumCard } from '@/types';
import { privacyMeta } from './album-dialog';

export function AlbumCard({ album }: { album: PhotoAlbumCard }) {
    const Privacy = privacyMeta[album.privacy].icon;

    return (
        <Link
            href={`/albums/${album.id}`}
            className="group relative block aspect-[4/3] overflow-hidden rounded-3xl bg-white/[0.04] ring-1 ring-white/[0.06] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-18px_rgb(124_92_255/0.75)] hover:ring-gc-lilac-500/40"
        >
            {album.cover_url ? (
                <img
                    src={album.cover_url}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-105"
                />
            ) : (
                <span className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgb(124_92_255/0.35),transparent_60%),radial-gradient(circle_at_80%_90%,rgb(56_225_255/0.2),transparent_55%)]">
                    <Images className="size-10 text-white/25" />
                </span>
            )}
            <span className="absolute inset-0 bg-gradient-to-t from-[#070a1c] via-[#070a1c]/30 to-transparent" />
            {album.privacy !== 'public' && (
                <span className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-black/40 backdrop-blur">
                    <Privacy className="size-3.5 text-white/80" />
                </span>
            )}
            <span className="absolute inset-x-0 bottom-0 p-4">
                <span className="block truncate font-display text-[15px] font-semibold text-white">
                    {album.title}
                </span>
                <span className="mt-0.5 block text-xs text-white/55">
                    {album.photos_count}{' '}
                    {plural(album.photos_count, [
                        'фотографія',
                        'фотографії',
                        'фотографій',
                    ])}
                </span>
            </span>
        </Link>
    );
}
