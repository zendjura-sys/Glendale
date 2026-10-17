import { Link } from '@inertiajs/react';
import { Lock, Music2 } from 'lucide-react';
import { formatLength, plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PlaylistCard as Playlist } from '@/types';

export function PlaylistCover({
    playlist,
    className,
}: {
    playlist: Pick<Playlist, 'id' | 'cover_url' | 'covers'>;
    className?: string;
}) {
    const covers = playlist.covers.slice(0, 4);

    return (
        <div
            className={cn(
                'relative aspect-square overflow-hidden bg-gradient-to-br from-[#1b2150] via-[#2a1a5c] to-[#0c1030]',
                className,
            )}
        >
            {playlist.cover_url ? (
                <img
                    loading="lazy"
                    decoding="async"
                    src={playlist.cover_url}
                    alt=""
                    className="size-full object-cover"
                />
            ) : covers.length >= 4 ? (
                <div className="grid size-full grid-cols-2 grid-rows-2">
                    {covers.map((url, i) => (
                        <img
                            loading="lazy"
                            decoding="async"
                            key={i}
                            src={url}
                            alt=""
                            className="size-full object-cover"
                        />
                    ))}
                </div>
            ) : covers.length > 0 ? (
                <img
                    loading="lazy"
                    decoding="async"
                    src={covers[0]}
                    alt=""
                    className="size-full object-cover"
                />
            ) : (
                <div className="flex size-full items-center justify-center">
                    <span className="absolute size-2/3 rounded-full bg-gc-indigo/30 blur-2xl" />
                    <Music2 className="relative size-1/3 text-white/60" />
                </div>
            )}
        </div>
    );
}

export function PlaylistTile({ playlist }: { playlist: Playlist }) {
    return (
        <Link href={`/music/playlists/${playlist.id}`} className="group block">
            <div className="relative overflow-hidden rounded-2xl shadow-[0_18px_40px_-20px_rgb(109_93_252/0.7)] ring-1 ring-white/10 transition duration-300 group-hover:-translate-y-1 group-hover:ring-gc-lilac-400/40">
                <PlaylistCover
                    playlist={playlist}
                    className="transition duration-500 group-hover:scale-105"
                />
                <div className="scrim scrim-dark pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100" />
                {!playlist.is_public && (
                    <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/50 backdrop-blur">
                        <Lock className="size-3.5 text-white/80" />
                    </span>
                )}
            </div>
            <p className="mt-2 truncate text-sm font-semibold text-white">
                {playlist.title}
            </p>
            <p className="truncate text-xs text-white/45">
                {playlist.tracks_count}{' '}
                {plural(playlist.tracks_count, ['трек', 'треки', 'треків'])}
                {playlist.duration > 0 &&
                    ` · ${formatLength(playlist.duration)}`}
            </p>
        </Link>
    );
}

export const playlistGridClass =
    'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4';
