import { Head, Link, router } from '@inertiajs/react';
import { MovieTile, movieGridClass } from '@/components/cinema/movie-tile';
import { tr } from '@/lib/i18n';
import type { MovieCard, UserCard } from '@/types';

export default function CinemaTen({
    owner,
    movies,
    mine,
    following,
}: {
    owner: UserCard;
    movies: MovieCard[];
    mine: boolean;
    following: boolean;
}) {
    return (
        <>
            <Head title={tr('Мої десять')} />
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="font-display text-2xl font-bold text-white">
                        {mine
                            ? tr('Мої десять')
                            : tr('Десять {name}', { name: owner.first_name })}
                    </h1>
                    {!mine && (
                        <button
                            type="button"
                            onClick={() =>
                                router.post(`/cinema/ratings/${owner.username}`)
                            }
                            className="h-11 rounded-xl bg-white/10 px-4 text-sm text-white"
                        >
                            {following
                                ? tr('Не стежити за оцінками')
                                : tr('Стежити за оцінками')}
                        </button>
                    )}
                </div>
                {movies.length === 0 ? (
                    <p className="text-sm text-white/45">
                        {tr('Поки що порожньо.')}
                    </p>
                ) : (
                    <div className={movieGridClass}>
                        {movies.map((movie) => (
                            <MovieTile key={movie.id} movie={movie} />
                        ))}
                    </div>
                )}
                <Link href="/cinema" className="text-sm text-gc-lilac-300">
                    {tr('До каталогу')}
                </Link>
            </div>
        </>
    );
}
