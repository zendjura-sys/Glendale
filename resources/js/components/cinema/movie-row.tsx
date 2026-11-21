import { Link } from '@inertiajs/react';
import { Bookmark, CircleCheck, Clock3, EllipsisVertical } from 'lucide-react';
import { MoviePoster } from '@/components/cinema/movie-tile';
import { PosterBadges, PosterHover } from '@/components/cinema/poster-badges';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { MovieCard, MovieStatus } from '@/types';

export type MovieRowItem = MovieCard & {
    description?: string | null;
    my_status?: MovieStatus | null;
    saved?: boolean;
    comments_count?: number;
    last_at?: string;
    progress?: {
        season: number | null;
        episode: number;
        voice?: string | null;
        at?: string | null;
    } | null;
};

/** Колір мітки статусу перегляду на постері. */
export const STATUS_TONE: Record<MovieStatus, string> = {
    watching: 'bg-emerald-500/85',
    planned: 'bg-violet-500/85',
    watched: 'bg-sky-500/85',
    on_hold: 'bg-amber-500/85',
    dropped: 'bg-rose-500/85',
};

export function statusLabel(status: MovieStatus): string {
    return {
        watching: tr('дивлюсь'),
        planned: tr('в планах'),
        watched: tr('переглянуто'),
        on_hold: tr('відкладено'),
        dropped: tr('кинуто'),
    }[status];
}

/** «6 з 12 еп» / «12 еп» — за прогресом і кількістю серій. */
export function episodesLabel(movie: MovieRowItem): string | null {
    if (movie.type === 'movie') return null;
    const total = movie.episodes_count;
    const seen = movie.progress?.episode;
    if (seen && total) return tr('{seen} з {total} еп', { seen, total });
    if (seen) return tr('{seen} з ? еп', { seen });
    if (total) return tr('{total} еп', { total });

    return null;
}

/**
 * Рядок тайтлу (як у каталогах аніме): постер з міткою статусу, назва, «еп • рейтинг», опис
 * і меню «⋮». `variant="history"` — замість опису остання серія з озвучкою й час перегляду.
 */
export function MovieRow({
    movie,
    variant = 'default',
    extra,
}: {
    movie: MovieRowItem;
    variant?: 'default' | 'history' | 'compact';
    extra?: React.ReactNode;
}) {
    const meta = [
        episodesLabel(movie),
        movie.rating ? `${movie.rating.toFixed(1)}★` : null,
    ].filter(Boolean);

    return (
        <article className="group relative flex gap-4">
            <Link
                href={movie.href}
                className={cn(
                    'relative shrink-0 overflow-hidden rounded-2xl bg-white/[0.06]',
                    variant === 'compact'
                        ? 'w-[72px]'
                        : 'w-[104px] sm:w-[120px]',
                )}
            >
                <MoviePoster
                    movie={movie}
                    className="aspect-[2/3] w-full transition duration-500 group-hover:scale-105"
                />
                {variant === 'compact' ? (
                    movie.my_status && (
                        <span
                            data-on-dark
                            className={cn(
                                'absolute inset-x-1.5 bottom-1.5 truncate rounded-full py-0.5 text-center text-[11px] font-semibold text-white backdrop-blur',
                                STATUS_TONE[movie.my_status],
                            )}
                        >
                            {statusLabel(movie.my_status)}
                        </span>
                    )
                ) : (
                    <PosterBadges movie={movie} size="sm" />
                )}
            </Link>
            <div className="min-w-0 flex-1 py-0.5 pr-7">
                <Link href={movie.href}>
                    <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold text-white group-hover:underline">
                        {movie.title}
                    </h3>
                </Link>
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] text-white/55 tabular-nums">
                    {[
                        variant !== 'compact' && movie.my_status
                            ? statusLabel(movie.my_status)
                            : null,
                        ...meta,
                    ]
                        .filter(Boolean)
                        .join(' • ') || movie.type_label}
                    {movie.saved && (
                        <Bookmark className="size-3.5 fill-amber-400 text-amber-400" />
                    )}
                </p>
                {variant === 'history' && movie.progress ? (
                    <div className="mt-2 space-y-1 text-[13px] text-white/60">
                        <p className="flex items-center gap-2">
                            <CircleCheck className="size-4 shrink-0 text-rose-400" />
                            {tr('{n} серія', { n: movie.progress.episode })}
                            {movie.progress.voice &&
                                ` • ${movie.progress.voice}`}
                        </p>
                        {movie.progress.at && (
                            <p className="flex items-center gap-2">
                                <Clock3 className="size-4 shrink-0 text-teal-400" />
                                {formatDate(movie.progress.at)}
                            </p>
                        )}
                    </div>
                ) : (
                    movie.description &&
                    variant !== 'compact' && (
                        <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-white/50">
                            {movie.description}
                        </p>
                    )
                )}
                {extra}
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger
                    aria-label={tr('Дії')}
                    className="absolute top-0 right-0 rounded-full p-1 text-white/45 hover:text-white"
                >
                    <EllipsisVertical className="size-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                        <Link href={movie.href}>{tr('Відкрити')}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href={`${movie.href}#player`}>
                            {tr('Дивитися')}
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onSelect={() =>
                            void navigator.clipboard?.writeText(
                                window.location.origin + movie.href,
                            )
                        }
                    >
                        {tr('Скопіювати посилання')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </article>
    );
}

/** Плитка сітки каталогу (широкий екран): постер з міткою статусу, під ним назва й «еп • рейтинг». */
export function MovieGridTile({ movie }: { movie: MovieRowItem }) {
    const meta = [
        episodesLabel(movie),
        movie.rating ? `${movie.rating.toFixed(1)}★` : null,
    ].filter(Boolean);

    return (
        <Link href={movie.href} className="group block min-w-0">
            <span className="relative block overflow-hidden rounded-2xl bg-white/[0.06]">
                <MoviePoster
                    movie={movie}
                    className="aspect-[2/3] w-full transition duration-500 group-hover:scale-105"
                />
                <PosterBadges movie={movie} size="sm" />
                <PosterHover href={movie.href} />
            </span>
            <span className="mt-2 line-clamp-2 block text-[13px] leading-snug font-semibold text-white">
                {movie.title}
            </span>
            <span className="mt-0.5 block truncate text-xs text-white/50 tabular-nums">
                {[
                    movie.my_status ? statusLabel(movie.my_status) : null,
                    ...meta,
                ]
                    .filter(Boolean)
                    .join(' • ') || movie.type_label}
            </span>
        </Link>
    );
}

/**
 * Список тайтлів як у каталогах аніме: на телефоні — рядки з описом, на ширших екранах —
 * сітка постерів із назвою під ними.
 */
export function MovieList({
    movies,
    variant = 'default',
}: {
    movies: MovieRowItem[];
    variant?: 'default' | 'history';
}) {
    return (
        <>
            <div className="grid gap-6 sm:hidden">
                {movies.map((movie) => (
                    <MovieRow key={movie.id} movie={movie} variant={variant} />
                ))}
            </div>
            {variant === 'history' ? (
                <div className="hidden gap-6 sm:grid @3xl:grid-cols-2">
                    {movies.map((movie) => (
                        <MovieRow
                            key={movie.id}
                            movie={movie}
                            variant="history"
                        />
                    ))}
                </div>
            ) : (
                <div className="hidden grid-cols-3 gap-x-4 gap-y-5 sm:grid @2xl:grid-cols-4 @4xl:grid-cols-5 @6xl:grid-cols-6">
                    {movies.map((movie) => (
                        <MovieGridTile key={movie.id} movie={movie} />
                    ))}
                </div>
            )}
        </>
    );
}
