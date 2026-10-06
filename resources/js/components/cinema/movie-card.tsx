import { Link } from '@inertiajs/react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PostMovie } from '@/types';
import { MoviePoster, RatingBadge } from './movie-tile';
import { tr } from '@/lib/i18n';

/**
 * Фільм, прикріплений до запису на стіні.
 */
export function MovieCardEmbed({
    movie,
    className,
}: {
    movie: PostMovie;
    className?: string;
}) {
    const meta = [movie.year, movie.type_label, ...movie.genres.slice(0, 2)]
        .filter(Boolean)
        .join(' · ');

    const body = (
        <>
            {(movie.backdrop || movie.poster) && (
                <img
                    src={movie.backdrop ?? movie.poster ?? ''}
                    alt=""
                    className="pointer-events-none absolute inset-0 size-full object-cover opacity-30 blur-[2px] transition duration-700 group-hover:scale-105"
                />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-gc-ink via-gc-ink/85 to-gc-ink/40" />
            <div className="relative flex gap-4 p-3.5">
                <MoviePoster
                    movie={movie}
                    className="aspect-[2/3] w-[84px] shrink-0 rounded-xl ring-1 ring-white/10 sm:w-[96px]"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2">
                        <RatingBadge value={movie.rating} />
                        {movie.age_rating && (
                            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-xs font-semibold text-white/70">
                                {movie.age_rating}
                            </span>
                        )}
                    </div>
                    <p className="mt-1.5 line-clamp-2 font-display text-base leading-tight font-semibold text-white">
                        {movie.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-white/50">
                        {meta}
                    </p>
                    {movie.description && (
                        <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-white/60">
                            {movie.description}
                        </p>
                    )}
                    <span className="mt-auto pt-2.5">
                        {movie.available ? (
                            <span className="btn-glow inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold">
                                <Play className="size-3.5 fill-current" />{' '}
                                {tr('Дивитися')}
                            </span>
                        ) : (
                            <span className="text-xs text-white/40">
                                {tr('Фільм більше недоступний')}
                            </span>
                        )}
                    </span>
                </div>
            </div>
        </>
    );

    const classes = cn(
        'group relative block overflow-hidden rounded-2xl border border-white/[0.08] bg-abyss transition hover:border-gc-lilac-400/40',
        className,
    );

    return movie.available ? (
        <Link href={movie.href} className={classes}>
            {body}
        </Link>
    ) : (
        <div className={classes}>{body}</div>
    );
}
