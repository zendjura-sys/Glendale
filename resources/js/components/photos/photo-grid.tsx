import { Heart, MessageCircle } from 'lucide-react';
import { compactNumber } from '@/lib/format';
import type { PhotoThumb } from '@/types';

export function PhotoTile({
    photo,
    onOpen,
}: {
    photo: PhotoThumb;
    onOpen: (photo: PhotoThumb) => void;
}) {
    return (
        <button
            type="button"
            onClick={() => onOpen(photo)}
            className="group relative aspect-square overflow-hidden rounded-2xl bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-[#7c8cff] focus-visible:outline-none"
        >
            <img
                src={photo.url}
                alt=""
                loading="lazy"
                className="size-full object-cover transition duration-500 group-hover:scale-110"
            />
            <span className="absolute inset-0 flex items-end justify-start gap-3 bg-gradient-to-t from-black/70 via-transparent to-transparent p-2.5 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                <span className="inline-flex items-center gap-1">
                    <Heart className="size-3.5" />
                    {compactNumber(photo.likes_count)}
                </span>
                <span className="inline-flex items-center gap-1">
                    <MessageCircle className="size-3.5" />
                    {compactNumber(photo.comments_count)}
                </span>
            </span>
        </button>
    );
}

export const photoGridClass =
    'grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-5';
