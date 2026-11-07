import { Head, Link } from '@inertiajs/react';
import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { CinemaNav } from '@/components/cinema/cinema-nav';
import { CinemaShell } from '@/components/cinema/cinema-side';
import type { CinemaSideData } from '@/components/cinema/cinema-side';
import type { MovieRowItem } from '@/components/cinema/movie-row';
import { MoviePoster } from '@/components/cinema/movie-tile';
import { PosterBadges } from '@/components/cinema/poster-badges';
import { UnderlineTabs } from '@/components/gc/underline-tabs';
import { EmptyState } from '@/components/gc/widget';
import { tr } from '@/lib/i18n';

const DAYS = [
    () => tr('Пн'),
    () => tr('Вт'),
    () => tr('Ср'),
    () => tr('Чт'),
    () => tr('Пт'),
    () => tr('Сб'),
    () => tr('Нд'),
];

/** Час виходу серії на постері: «чт, 19:30». */
function timeLabel(iso?: string) {
    if (!iso) return null;
    const d = new Date(iso);

    return d.toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Розклад онгоінгів: вкладки днів тижня з підкресленням (сьогодні — першим вибором),
 * під ними постери з бейджами й часом, коли зазвичай з'являється нова серія.
 */
export default function CinemaSchedule({
    days,
    side,
}: {
    days: { day: number; movies: MovieRowItem[] }[];
    side?: CinemaSideData;
}) {
    const today = ((new Date().getDay() + 6) % 7) + 1;
    const [active, setActive] = useState(
        days.some((d) => d.day === today) ? today : (days[0]?.day ?? today),
    );
    const group = days.find((d) => d.day === active);

    return (
        <>
            <Head title={tr('Розклад')} />
            <CinemaShell side={side}>
                <CinemaNav active="schedule" />
                <section className="glass rounded-2xl p-5">
                    <h1 className="font-display text-xl font-semibold text-white">
                        {tr('Розклад нових серій на тиждень')}
                    </h1>
                    <UnderlineTabs
                        className="mt-3"
                        active={String(active)}
                        tabs={Array.from({ length: 7 }, (_, i) => i + 1).map(
                            (day) => ({
                                key: String(day),
                                label:
                                    day === today
                                        ? tr('Сьогодні')
                                        : DAYS[day - 1](),
                                count:
                                    days.find((d) => d.day === day)?.movies
                                        .length || undefined,
                                onClick: () => setActive(day),
                            }),
                        )}
                    />
                    {!group || group.movies.length === 0 ? (
                        <EmptyState
                            icon={CalendarDays}
                            title={tr('Цього дня нових серій немає')}
                            text={tr(
                                'Тут з’являться серіали й аніме, у яких зараз виходять нові серії.',
                            )}
                        />
                    ) : (
                        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5">
                            {group.movies.map((movie) => (
                                <Link
                                    key={movie.id}
                                    href={movie.href}
                                    className="group min-w-0"
                                >
                                    <span className="relative block overflow-hidden rounded-2xl">
                                        <MoviePoster
                                            movie={movie}
                                            className="aspect-[2/3] w-full transition duration-500 group-hover:scale-105"
                                        />
                                        <PosterBadges
                                            movie={{
                                                ...movie,
                                                age_rating: null,
                                            }}
                                            size="sm"
                                        />
                                        {timeLabel(movie.last_at) && (
                                            <span
                                                data-on-dark
                                                className="absolute bottom-2 left-2 rounded-lg bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground tabular-nums"
                                            >
                                                {timeLabel(movie.last_at)}
                                            </span>
                                        )}
                                    </span>
                                    <span className="mt-2 line-clamp-2 text-[13px] font-semibold text-white group-hover:text-primary">
                                        {movie.title}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                    <p className="mt-6 rounded-xl bg-white/[0.04] p-4 text-[13px] leading-relaxed text-white/55">
                        {tr(
                            'Розклад складається з того, коли в озвучок з’являлися нові серії за останні три тижні, тож це орієнтир, а не точний графік студій. Додайте тайтл до «Дивлюся», щоб отримувати сповіщення про нові серії.',
                        )}
                    </p>
                </section>
            </CinemaShell>
        </>
    );
}
