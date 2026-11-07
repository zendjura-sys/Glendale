import { Head } from '@inertiajs/react';
import { CalendarDays } from 'lucide-react';
import { CinemaNav } from '@/components/cinema/cinema-nav';
import { MovieRow } from '@/components/cinema/movie-row';
import type { MovieRowItem } from '@/components/cinema/movie-row';
import { EmptyState } from '@/components/gc/widget';
import { tr } from '@/lib/i18n';

const DAYS = [
    () => tr('Понеділок'),
    () => tr('Вівторок'),
    () => tr('Середа'),
    () => tr('Четвер'),
    () => tr("П'ятниця"),
    () => tr('Субота'),
    () => tr('Неділя'),
];

/** Розклад онгоінгів: у які дні тижня виходять нові серії (за останніми оновленнями озвучок). */
export default function CinemaSchedule({
    days,
}: {
    days: { day: number; movies: MovieRowItem[] }[];
}) {
    const today = ((new Date().getDay() + 6) % 7) + 1;

    return (
        <>
            <Head title={tr('Розклад')} />
            <div className="space-y-5">
                <CinemaNav active="schedule" />
                {days.length === 0 ? (
                    <EmptyState
                        icon={CalendarDays}
                        title={tr('Розклад поки порожній')}
                        text={tr(
                            'Тут з’являться серіали й аніме, у яких зараз виходять нові серії.',
                        )}
                    />
                ) : (
                    days.map((group) => (
                        <section
                            key={group.day}
                            className="glass rounded-2xl p-5"
                        >
                            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                                {DAYS[group.day - 1]()}
                                {group.day === today && (
                                    <span className="rounded-full bg-[var(--vkui--color_background_accent)] px-2.5 py-0.5 text-xs font-semibold text-white">
                                        {tr('Сьогодні')}
                                    </span>
                                )}
                            </h2>
                            <div className="grid gap-5 lg:grid-cols-2">
                                {group.movies.map((movie) => (
                                    <MovieRow
                                        key={movie.id}
                                        movie={movie}
                                        variant="compact"
                                    />
                                ))}
                            </div>
                        </section>
                    ))
                )}
            </div>
        </>
    );
}
