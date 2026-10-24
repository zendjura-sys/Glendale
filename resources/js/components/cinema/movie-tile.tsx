import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Clapperboard, Star } from 'lucide-react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { MovieCard } from '@/types';
import { tr } from '@/lib/i18n';

const hues = [216, 200, 222, 190, 210, 230];

export function MoviePoster({
    movie,
    className,
}: {
    movie: Pick<MovieCard, 'id' | 'title' | 'poster'>;
    className?: string;
}) {
    if (movie.poster) {
        return (
            <img
                src={movie.poster}
                alt=""
                loading="lazy"
                className={cn('object-cover', className)}
            />
        );
    }

    const hue = hues[movie.id % hues.length];

    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-2 p-3 text-center',
                className,
            )}
            style={{
                background: `radial-gradient(120% 90% at 20% 0%, hsl(${hue} 90% 60% / .55), transparent 60%), linear-gradient(160deg, hsl(${hue + 6} 60% 20%), #0b0d1f)`,
            }}
        >
            <Clapperboard className="size-8 text-white/50" />
            <span className="line-clamp-3 font-display text-sm font-semibold text-white/85">
                {movie.title}
            </span>
        </div>
    );
}

export function RatingBadge({
    value,
    className,
}: {
    value: number | null;
    className?: string;
}) {
    if (value === null || value === 0) return null;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-bold text-white tabular-nums shadow-lg',
                value >= 7
                    ? 'bg-emerald-500/90'
                    : value >= 5
                      ? 'bg-amber-500/90'
                      : 'bg-rose-500/90',
                className,
            )}
        >
            <Star className="size-2.5 fill-current" />
            {value.toFixed(1)}
        </span>
    );
}

export function MovieTile({
    movie,
    badge,
    className,
}: {
    movie: MovieCard;
    badge?: ReactNode;
    className?: string;
}) {
    return (
        <Link
            href={movie.href}
            className={cn('group block min-w-0', className)}
            prefetch
        >
            <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.08] transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_-18px_rgb(124_92_255/0.9)] group-hover:ring-gc-lilac-400/50">
                <MoviePoster
                    movie={movie}
                    className="size-full transition duration-500 group-hover:scale-105"
                />
                <div className="scrim scrim-dark absolute inset-0 opacity-0 transition group-hover:opacity-100" />
                <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
                    <RatingBadge value={movie.rating} />
                </div>
                {movie.age_rating && (
                    <span className="absolute top-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-xs font-semibold text-white/80 backdrop-blur">
                        {movie.age_rating}
                    </span>
                )}
                {badge && (
                    <div className="absolute inset-x-2 bottom-2">{badge}</div>
                )}
            </div>
            <p className="mt-2 line-clamp-2 text-[13px] leading-snug font-semibold text-white/90 group-hover:text-white">
                {movie.title}
            </p>
            <p className="mt-0.5 text-xs break-words text-white/40">
                {[
                    movie.progress
                        ? movie.progress.season
                            ? tr('Сезон {season}, серія {episode}', {
                                  season: movie.progress.season,
                                  episode: movie.progress.episode,
                              })
                            : tr('Серія {episode}', {
                                  episode: movie.progress.episode,
                              })
                        : null,
                    movie.year,
                    movie.type_label,
                    movie.genres[0],
                ]
                    .filter(Boolean)
                    .join(' · ')}
            </p>
        </Link>
    );
}

export const movieGridClass =
    'grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5';

export function PosterRow({
    title,
    action,
    movies,
}: {
    title: ReactNode;
    action?: ReactNode;
    movies: MovieCard[];
}) {
    const ref = useRef<HTMLDivElement>(null);
    const scroll = (dir: number) =>
        ref.current?.scrollBy({
            left: dir * ref.current.clientWidth * 0.85,
            behavior: 'smooth',
        });

    return (
        <section className="glass group/row relative rounded-2xl p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
                <h2 className="flex-1 font-display text-lg font-semibold text-white">
                    {title}
                </h2>
                {action}
                <div className="hidden gap-1 sm:flex">
                    <button
                        type="button"
                        onClick={() => scroll(-1)}
                        className="flex size-8 items-center justify-center rounded-lg bg-white/[0.05] text-white/60 transition hover:bg-white/10 hover:text-white"
                        aria-label={tr('Назад')}
                    >
                        <ChevronLeft className="size-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => scroll(1)}
                        className="flex size-8 items-center justify-center rounded-lg bg-white/[0.05] text-white/60 transition hover:bg-white/10 hover:text-white"
                        aria-label={tr('Далі')}
                    >
                        <ChevronRight className="size-4" />
                    </button>
                </div>
            </div>
            <div
                ref={ref}
                className="-mx-1 scrollbar-none flex snap-x gap-3 overflow-x-auto px-1 pt-1 pb-1"
            >
                {movies.map((movie) => (
                    <MovieTile
                        key={movie.id}
                        movie={movie}
                        className="w-[132px] shrink-0 snap-start sm:w-[150px]"
                    />
                ))}
            </div>
        </section>
    );
}
