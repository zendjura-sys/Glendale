import { Head, Link } from '@inertiajs/react';
import { Dices, Film, Star } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { selectClass } from '@/components/gc/admin';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Movie = {
    id: number;
    slug: string;
    href: string;
    type_label: string;
    title: string;
    title_original: string | null;
    year: number | null;
    poster: string | null;
    genres: string[];
    rating: number | null;
    description: string | null;
};

/** «Що подивитися?» — випадковий тайтл з каталогу за типом, жанром і роком. */
export default function MovieRoulette({
    types,
    genres,
}: {
    types: Record<string, string>;
    genres: string[];
}) {
    const reduce = useReducedMotion();
    const [type, setType] = useState('');
    const [genre, setGenre] = useState('');
    const [from, setFrom] = useState('');
    const [unseen, setUnseen] = useState(true);
    const [movie, setMovie] = useState<Movie | null>(null);
    const [empty, setEmpty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [spins, setSpins] = useState(0);

    const spin = () => {
        setBusy(true);
        const query = new URLSearchParams();

        if (type) query.set('type', type);
        if (genre) query.set('genre', genre);
        if (from) query.set('from', from);
        if (unseen) query.set('unseen', '1');

        api<{ movie: Movie | null }>(
            'GET',
            `/cinema/roulette/spin?${query.toString()}`,
        )
            .then((data) => {
                setMovie(data.movie);
                setEmpty(data.movie === null);
                setSpins((n) => n + 1);
            })
            .catch((e) => toast.error((e as Error).message))
            .finally(() => setBusy(false));
    };

    return (
        <>
            <Head title={tr('Що подивитися?')} />
            <div className="mx-auto max-w-3xl space-y-4">
                <header>
                    <h1 className="font-display text-2xl font-bold text-white">
                        {tr('Що подивитися?')}
                    </h1>
                    <p className="mt-1 text-sm text-white/50">
                        {tr(
                            'Оберіть, що хочеться, — рулетка підкаже тайтл з каталогу.',
                        )}
                    </p>
                </header>

                <section className="glass space-y-3 rounded-2xl p-4">
                    <div className="flex flex-wrap gap-2">
                        {[['', tr('Усе')], ...Object.entries(types)].map(
                            ([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setType(key)}
                                    className={cn(
                                        'h-9 rounded-xl px-3 text-sm transition',
                                        type === key
                                            ? 'bg-primary text-white'
                                            : 'bg-white/[0.06] text-white/70 hover:text-white',
                                    )}
                                >
                                    {tr(label)}
                                </button>
                            ),
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={genre}
                            onChange={(e) => setGenre(e.target.value)}
                            className={selectClass}
                            aria-label={tr('Жанр')}
                        >
                            <option value="">{tr('Будь-який жанр')}</option>
                            {genres.map((g) => (
                                <option key={g} value={g}>
                                    {g}
                                </option>
                            ))}
                        </select>
                        <select
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                            className={selectClass}
                            aria-label={tr('Рік')}
                        >
                            <option value="">{tr('Будь-якого року')}</option>
                            {[2020, 2010, 2000, 1990].map((y) => (
                                <option key={y} value={y}>
                                    {tr('Не старше {year}', { year: y })}
                                </option>
                            ))}
                        </select>
                        <label className="flex items-center gap-2 text-sm text-white/70">
                            <input
                                type="checkbox"
                                checked={unseen}
                                onChange={(e) => setUnseen(e.target.checked)}
                                className="size-4 accent-[var(--color-primary)]"
                            />
                            {tr('Без переглянутого')}
                        </label>
                    </div>
                    <button
                        type="button"
                        onClick={spin}
                        disabled={busy}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white disabled:opacity-60 sm:w-auto sm:px-6"
                    >
                        <m.span
                            animate={
                                busy && !reduce
                                    ? { rotate: 360 }
                                    : { rotate: 0 }
                            }
                            transition={
                                busy
                                    ? {
                                          repeat: Infinity,
                                          duration: 0.8,
                                          ease: 'linear',
                                      }
                                    : { duration: 0 }
                            }
                            className="inline-flex"
                        >
                            <Dices className="size-4" />
                        </m.span>
                        {spins === 0 ? tr('Крутити') : tr('Ще раз')}
                    </button>
                </section>

                <AnimatePresence mode="wait">
                    {movie && (
                        <m.article
                            key={`${movie.id}-${spins}`}
                            initial={reduce ? false : { opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduce ? undefined : { opacity: 0, y: -8 }}
                            transition={{ duration: 0.25 }}
                            className="glass flex gap-4 rounded-2xl p-4"
                        >
                            {movie.poster ? (
                                <img
                                    src={movie.poster}
                                    alt=""
                                    className="aspect-[2/3] w-28 shrink-0 rounded-xl object-cover sm:w-36"
                                />
                            ) : (
                                <div className="flex aspect-[2/3] w-28 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] sm:w-36">
                                    <Film className="size-8 text-white/30" />
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="text-xs text-white/45">
                                    {tr(movie.type_label)}
                                    {movie.year ? ` · ${movie.year}` : ''}
                                    {movie.genres.length > 0
                                        ? ` · ${movie.genres.join(', ')}`
                                        : ''}
                                </p>
                                <h2 className="mt-1 font-display text-xl font-bold text-white">
                                    {movie.title}
                                </h2>
                                {movie.rating !== null && (
                                    <p className="mt-1 flex items-center gap-1 text-sm text-white/70">
                                        <Star className="size-3.5 text-amber-300" />
                                        {movie.rating.toFixed(1)}
                                    </p>
                                )}
                                {movie.description && (
                                    <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-white/70">
                                        {movie.description}
                                    </p>
                                )}
                                <Link
                                    href={movie.href}
                                    className="mt-3 inline-flex h-9 items-center rounded-xl bg-white/[0.08] px-4 text-sm font-medium text-white hover:bg-white/[0.12]"
                                >
                                    {tr('Відкрити')}
                                </Link>
                            </div>
                        </m.article>
                    )}
                </AnimatePresence>
                {empty && (
                    <p className="glass rounded-2xl p-5 text-center text-sm text-white/55">
                        {tr(
                            'За такими фільтрами нічого не знайшлося — спробуйте інший жанр чи рік.',
                        )}
                    </p>
                )}
            </div>
        </>
    );
}
