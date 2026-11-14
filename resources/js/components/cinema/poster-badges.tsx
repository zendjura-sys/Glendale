import { router } from '@inertiajs/react';
import { Info, Play } from 'lucide-react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { MovieCard } from '@/types';

const RELEASE: Record<
    NonNullable<MovieCard['release']>,
    { label: string; tone: string }
> = {
    announced: { label: 'Анонс', tone: 'bg-sky-500/90 text-white' },
    ongoing: { label: 'Виходить', tone: 'bg-emerald-500/90 text-white' },
    released: { label: 'Завершено', tone: 'bg-black/70 text-amber-300' },
};

export function releaseLabel(
    release: MovieCard['release'] | null,
): string | null {
    return release ? tr(RELEASE[release].label) : null;
}

/**
 * Динамічні бейджі на постері: ліворуч угорі — скільки переглянуто (%), праворуч — статус виходу,
 * ліворуч унизу — кількість серій і вікове обмеження. Кожен бейдж з'являється лише коли є дані.
 */
export function PosterBadges({
    movie,
    size = 'md',
}: {
    movie: MovieCard;
    size?: 'sm' | 'md';
}) {
    const chip = cn(
        'rounded-lg font-bold tabular-nums backdrop-blur-md',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]',
    );
    const pct = movie.progress_pct;
    const series = movie.type !== 'movie' && (movie.episodes_count ?? 0) > 1;

    return (
        <span data-on-dark className="pointer-events-none absolute inset-0">
            {pct !== null && pct !== undefined && (
                <span
                    className={cn(
                        chip,
                        'absolute top-2 left-2',
                        pct >= 100
                            ? 'bg-emerald-500/90 text-white'
                            : pct > 0
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-white/85 text-black/60',
                    )}
                >
                    {pct}%
                </span>
            )}
            {movie.release && (
                <span
                    className={cn(
                        chip,
                        'absolute top-2 right-2',
                        RELEASE[movie.release].tone,
                    )}
                >
                    {tr(RELEASE[movie.release].label)}
                </span>
            )}
            <span className="absolute bottom-2 left-2 flex flex-col items-start gap-1">
                {series && (
                    <span className={cn(chip, 'bg-white/90 text-black')}>
                        {tr('{n} серій', { n: movie.episodes_count ?? 0 })}
                    </span>
                )}
                {movie.age_rating && (
                    <span className={cn(chip, 'bg-rose-500/90 text-white')}>
                        {movie.age_rating.replace(/^(\d+)\+?$/, '$1+')}
                    </span>
                )}
            </span>
        </span>
    );
}

/** Шар при наведенні: «Дивитися» і «Інформація» поверх постера (всередині посилання — тому кнопки, не <a>). */
export function PosterHover({ href }: { href: string }) {
    const go = (e: React.MouseEvent, to: string) => {
        e.preventDefault();
        e.stopPropagation();
        router.visit(to);
    };

    return (
        <span
            data-on-dark
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:hidden"
        >
            <span
                role="button"
                tabIndex={-1}
                onClick={(e) => go(e, `${href}#player`)}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-2 text-xs font-semibold text-white"
            >
                <Play className="size-3.5 fill-current" />
                {tr('Дивитися')}
            </span>
            <span
                role="button"
                tabIndex={-1}
                onClick={(e) => go(e, href)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold text-white"
            >
                <Info className="size-3.5" />
                {tr('Інформація')}
            </span>
        </span>
    );
}
