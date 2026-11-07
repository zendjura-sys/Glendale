import { Link } from '@inertiajs/react';
import {
    ChevronRight,
    Clapperboard,
    Eye,
    Info,
    MessageSquare,
    Pencil,
    Play,
    Star,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { MoviePoster } from '@/components/cinema/movie-tile';
import { PosterBadges, releaseLabel } from '@/components/cinema/poster-badges';
import { compactNumber } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { MovieDetail, MovieOption, MovieStatus } from '@/types';

/** Заголовок розділу сторінки тайтлу: значок в акцентному квадраті й назва. */
export function TitleSection({
    icon,
    title,
    action,
    children,
    className,
    id,
}: {
    icon: ReactNode;
    title: ReactNode;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
    id?: string;
}) {
    return (
        <section
            id={id}
            className={cn('glass scroll-mt-24 rounded-2xl p-5', className)}
        >
            <div className="mb-4 flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary [&_svg]:size-4">
                    {icon}
                </span>
                <h2 className="min-w-0 flex-1 font-display text-lg font-semibold text-white">
                    {title}
                </h2>
                {action}
            </div>
            {children}
        </section>
    );
}

/**
 * Верх сторінки тайтлу на ПК (як у класичних кінокаталогах): шапка з назвою, ряд статусів
 * перегляду, постер з бейджами й кнопками «Дивитися» / «Трейлер», таблиця відомостей.
 */
export function TitleDesktop({
    movie,
    statuses,
    status,
    onStatus,
    watchers,
    commentsCount,
    ratings,
    onTrailer,
    actions,
    menu,
    canManage,
    playLabel,
}: {
    movie: MovieDetail;
    statuses: MovieOption<MovieStatus>[];
    status: MovieStatus | null;
    onStatus: (status: MovieStatus | null) => void;
    watchers: number;
    commentsCount: number;
    ratings: { key: string; label: string; tone: string; value: number }[];
    onTrailer?: () => void;
    actions: ReactNode;
    menu: ReactNode;
    canManage: boolean;
    playLabel: string;
}) {
    const rows: [string, ReactNode][] = (
        [
            [tr('Країна'), movie.countries.join(', ') || null],
            [tr('Тип'), movie.type_label],
            [
                tr('Епізоди'),
                movie.type !== 'movie' && movie.episodes_count
                    ? movie.episodes_count
                    : null,
            ],
            [
                tr('Тривалість'),
                movie.duration ? tr('{m} хв', { m: movie.duration }) : null,
            ],
            [
                tr('Жанри'),
                movie.genres.length > 0 ? (
                    <span className="flex flex-wrap gap-x-2">
                        {movie.genres.map((g, i) => (
                            <Link
                                key={g}
                                href={`/cinema?genre=${encodeURIComponent(g)}`}
                                className="text-primary hover:underline"
                            >
                                {g}
                                {i < movie.genres.length - 1 && ','}
                            </Link>
                        ))}
                    </span>
                ) : null,
            ],
            [
                tr('Рік'),
                movie.year ? (
                    <Link
                        href={`/cinema?year=${movie.year}`}
                        className="hover:text-primary"
                    >
                        {movie.year}
                    </Link>
                ) : null,
            ],
            [tr('Статус'), releaseLabel(movie.release)],
            [tr('Вік'), movie.age_rating],
            [
                tr('Рейтинги'),
                ratings.length > 0 ? (
                    <span className="flex flex-wrap gap-x-3">
                        {ratings.map((r) => (
                            <span
                                key={r.key}
                                className={cn('font-semibold', r.tone)}
                            >
                                {r.label} {r.value.toFixed(1)}
                            </span>
                        ))}
                    </span>
                ) : null,
            ],
            [
                tr('Глядачі'),
                <span
                    key="w"
                    className="inline-flex items-center gap-3 tabular-nums"
                >
                    <span className="inline-flex items-center gap-1">
                        <Eye className="size-3.5" />
                        {compactNumber(movie.views_count)}
                    </span>
                    <span>
                        {compactNumber(watchers)} {tr('у списках')}
                    </span>
                </span>,
            ],
        ] as [string, ReactNode][]
    ).filter(([, v]) => v !== null && v !== undefined && v !== '');

    return (
        <div className="space-y-4">
            {/* Шапка: шлях, назва, оригінальна назва. */}
            <section className="glass rounded-2xl px-5 py-4">
                <nav className="flex items-center gap-1 text-xs text-white/45">
                    <Link href="/cinema" className="hover:text-primary">
                        {tr('Кіно')}
                    </Link>
                    <ChevronRight className="size-3.5" />
                    <Link
                        href={`/cinema?type=${movie.type}`}
                        className="hover:text-primary"
                    >
                        {movie.type_label}
                    </Link>
                    <ChevronRight className="size-3.5" />
                    <span className="truncate text-primary">{movie.title}</span>
                    {canManage && (
                        <a
                            href={`/admin/cinema/${movie.id}/edit`}
                            className="ml-auto inline-flex shrink-0 items-center gap-1 hover:text-white"
                        >
                            <Pencil className="size-3.5" />
                            {tr('Редагувати')}
                        </a>
                    )}
                </nav>
                <h1 className="mt-2 font-display text-[28px] leading-tight font-bold text-white">
                    {movie.title}
                </h1>
                {(movie.title_original &&
                    movie.title_original !== movie.title) ||
                movie.tagline ? (
                    <p className="mt-0.5 text-sm text-white/50">
                        {movie.title_original !== movie.title &&
                            movie.title_original}
                        {movie.tagline && (
                            <span className="italic">
                                {movie.title_original !== movie.title &&
                                movie.title_original
                                    ? ' · '
                                    : ''}
                                «{movie.tagline}»
                            </span>
                        )}
                    </p>
                ) : null}
            </section>

            {/* Ряд статусів перегляду — один клік без діалогу. */}
            <div className="glass scrollbar-none flex gap-1 overflow-x-auto rounded-2xl p-1.5">
                {[{ key: null, label: tr('Не дивлюсь') }, ...statuses].map(
                    (s) => {
                        const active = status === s.key;

                        return (
                            <button
                                key={s.key ?? 'none'}
                                type="button"
                                onClick={() =>
                                    onStatus(s.key as MovieStatus | null)
                                }
                                aria-pressed={active}
                                className={cn(
                                    'shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition',
                                    active
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-white/60 hover:bg-white/[0.06] hover:text-white',
                                )}
                            >
                                {s.label}
                            </button>
                        );
                    },
                )}
            </div>

            <div className="gc-td-grid grid gap-4 @3xl:grid-cols-[260px_minmax(0,1fr)]">
                {/* Постер з бейджами, «Дивитися» і «Трейлер». */}
                <section className="gc-td-poster glass self-start rounded-2xl p-4">
                    <div className="relative mx-auto max-w-[260px] overflow-hidden rounded-2xl">
                        <MoviePoster
                            movie={movie}
                            className="aspect-[2/3] w-full"
                        />
                        <PosterBadges movie={movie} />
                    </div>
                    <div className="mt-3 space-y-2">
                        <a
                            href="#player"
                            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-brand text-sm font-semibold text-white"
                        >
                            <Play className="size-4 fill-current" />
                            {playLabel}
                        </a>
                        {onTrailer && (
                            <button
                                type="button"
                                onClick={onTrailer}
                                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/[0.07] text-sm font-semibold text-white hover:bg-white/[0.12]"
                            >
                                <Clapperboard className="size-4" />
                                {tr('Дивитися трейлер')}
                            </button>
                        )}
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-4 text-sm tabular-nums">
                        {movie.rating ? (
                            <span className="inline-flex items-center gap-1 font-bold text-amber-400">
                                <Star className="size-4 fill-current" />
                                {movie.rating.toFixed(1)}
                            </span>
                        ) : null}
                        <a
                            href="#comments"
                            className="inline-flex items-center gap-1 text-white/60 hover:text-white"
                        >
                            <MessageSquare className="size-4" />
                            {compactNumber(commentsCount)}
                        </a>
                    </div>
                </section>

                {/* Відомості таблицею з чергуванням рядків. */}
                <TitleSection
                    icon={<Info />}
                    title={tr('Інформація')}
                    action={menu}
                    className="min-w-0"
                >
                    <dl className="overflow-hidden rounded-xl text-sm">
                        {rows.map(([label, value], i) => (
                            <div
                                key={label}
                                className={cn(
                                    'grid grid-cols-[150px_minmax(0,1fr)] gap-3 px-3 py-2',
                                    i % 2 === 0 && 'bg-white/[0.05]',
                                )}
                            >
                                <dt className="font-semibold text-white/80">
                                    {label}:
                                </dt>
                                <dd className="min-w-0 text-white/70">
                                    {value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    <div className="gc-flat-actions mt-4 flex flex-wrap items-center gap-2">
                        {actions}
                    </div>
                </TitleSection>
            </div>
        </div>
    );
}
