import { Head, Link, router } from '@inertiajs/react';
import {
    ChevronDown,
    ChevronUp,
    Heart,
    ListOrdered,
    ListVideo,
    Lock,
    Pencil,
    Trash2,
    UserPlus,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import type { MovieListCard } from '@/components/cinema/list-card';
import { ListComments } from '@/components/cinema/list-comments';
import { Toggle } from '@/components/gc/admin';
import { UserAvatar } from '@/components/gc/user-avatar';
import { EmptyState } from '@/components/gc/widget';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { MovieCard } from '@/types/cinema';

type Props = {
    list: MovieListCard & { mine: boolean; liked: boolean; following: boolean };
    movies: (MovieCard & { note: string | null })[];
};

/**
 * Добірка: постери тайтлів; власник редагує, прибирає й (для рейтингу) змінює порядок,
 * інші — лайк і «Стежити». Унизу — обговорення.
 */
export default function List({ list, movies: initial }: Props) {
    const [movies, setMovies] = useState(initial);
    useEffect(() => setMovies(initial), [initial]);
    const [liked, setLiked] = useState(list.liked);
    const [likes, setLikes] = useState(list.likes_count);
    const [following, setFollowing] = useState(list.following);
    const [followers, setFollowers] = useState(list.followers_count);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({
        title: list.title,
        description: list.description ?? '',
        is_public: list.is_public,
        is_ranked: list.is_ranked ?? false,
    });
    const ranked = list.is_ranked ?? false;

    // Зсунути тайтл у рейтингу на крок вгору чи вниз і зберегти порядок.
    const move = (index: number, dir: -1 | 1) => {
        const target = index + dir;
        if (target < 0 || target >= movies.length) return;
        const next = [...movies];
        [next[index], next[target]] = [next[target], next[index]];
        setMovies(next);
        api('PUT', `/cinema/lists/${list.id}/order`, {
            ids: next.map((m) => m.id),
        }).catch((e: Error) => {
            toast.error(e.message);
            setMovies(movies);
        });
    };

    const like = () =>
        api<{ liked: boolean; likes_count: number }>(
            'POST',
            `/cinema/lists/${list.id}/like`,
        )
            .then((d) => {
                setLiked(d.liked);
                setLikes(d.likes_count);
            })
            .catch((e: Error) => toast.error(e.message));
    const follow = () =>
        api<{ following: boolean; followers_count: number }>(
            'POST',
            `/cinema/lists/${list.id}/follow`,
        )
            .then((d) => {
                setFollowing(d.following);
                setFollowers(d.followers_count);
            })
            .catch((e: Error) => toast.error(e.message));
    const save = (e: FormEvent) => {
        e.preventDefault();
        api('PUT', `/cinema/lists/${list.id}`, form)
            .then(() => {
                setEditing(false);
                router.reload();
            })
            .catch((e: Error) => toast.error(e.message));
    };
    const remove = () => {
        if (!window.confirm(tr('Видалити добірку?'))) return;
        api('DELETE', `/cinema/lists/${list.id}`)
            .then(() => router.visit('/cinema/lists?tab=mine'))
            .catch(() => undefined);
    };
    const drop = (movie: MovieCard) =>
        api('POST', `/cinema/lists/${list.id}/items`, {
            movie: movie.id,
            on: false,
        })
            .then(() => router.reload({ only: ['movies', 'list'] }))
            .catch(() => undefined);

    return (
        <>
            <Head title={list.title} />
            <div className="space-y-4">
                <header className="glass rounded-2xl p-5">
                    <div className="flex flex-wrap items-start gap-4">
                        <div className="min-w-0 flex-1">
                            <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-white">
                                {!list.is_public && (
                                    <Lock className="size-5 text-white/45" />
                                )}
                                {list.title}
                            </h1>
                            {ranked && (
                                <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                                    <ListOrdered className="size-4" />
                                    {tr('Рейтинг · топ-{n}', {
                                        n: movies.length,
                                    })}
                                </p>
                            )}
                            {list.description && (
                                <p className="mt-1 text-sm whitespace-pre-line text-white/60">
                                    {list.description}
                                </p>
                            )}
                            {list.user && (
                                <Link
                                    href={`/${list.user.username}`}
                                    className="mt-3 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
                                >
                                    <UserAvatar user={list.user} size="xs" />
                                    {list.user.name}
                                </Link>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {list.mine ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setEditing(true)}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.06] px-3.5 text-sm font-semibold text-white"
                                    >
                                        <Pencil className="size-4" />
                                        {tr('Змінити')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={remove}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.06] px-3.5 text-sm text-white/70 hover:text-white"
                                        aria-label={tr('Видалити добірку')}
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={like}
                                        className={cn(
                                            'inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition',
                                            liked
                                                ? 'bg-rose-500/20 text-rose-200'
                                                : 'bg-white/[0.06] text-white',
                                        )}
                                    >
                                        <Heart
                                            className={cn(
                                                'size-4',
                                                liked && 'fill-current',
                                            )}
                                        />
                                        {likes}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={follow}
                                        className={cn(
                                            'inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition',
                                            following
                                                ? 'bg-primary/25 text-white'
                                                : 'btn-glow',
                                        )}
                                    >
                                        <UserPlus className="size-4" />
                                        {following
                                            ? tr('Стежу · {n}', {
                                                  n: followers,
                                              })
                                            : tr('Стежити')}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {movies.length === 0 ? (
                    <EmptyState
                        icon={ListVideo}
                        title={tr('Добірка порожня')}
                        text={tr(
                            'Додайте тайтли кнопкою «У добірку» на сторінці фільму.',
                        )}
                    />
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        {movies.map((movie, index) => (
                            <div key={movie.id} className="group relative">
                                {ranked && (
                                    <span
                                        className={cn(
                                            'pointer-events-none absolute top-2 left-2 z-10 grid size-9 place-items-center rounded-xl font-display text-base font-bold tabular-nums shadow-lg',
                                            index < 3
                                                ? 'bg-primary text-white'
                                                : 'bg-black/65 text-white backdrop-blur',
                                        )}
                                    >
                                        {index + 1}
                                    </span>
                                )}
                                <Link href={movie.href} className="block">
                                    <div className="aspect-[2/3] overflow-hidden rounded-2xl bg-white/[0.05]">
                                        {movie.poster && (
                                            <img
                                                src={movie.poster}
                                                alt=""
                                                loading="lazy"
                                                className="size-full object-cover transition group-hover:scale-[1.02]"
                                            />
                                        )}
                                    </div>
                                    <p className="mt-2 truncate text-sm font-semibold text-white">
                                        {movie.title}
                                    </p>
                                    <p className="truncate text-xs text-white/45">
                                        {[movie.year, movie.type_label]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </p>
                                </Link>
                                {list.mine && ranked && (
                                    <div className="absolute bottom-16 left-2 flex flex-col gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                                        <button
                                            type="button"
                                            onClick={() => move(index, -1)}
                                            disabled={index === 0}
                                            className="rounded-full bg-black/60 p-1.5 text-white disabled:opacity-30"
                                            aria-label={tr('Вище')}
                                        >
                                            <ChevronUp className="size-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => move(index, 1)}
                                            disabled={
                                                index === movies.length - 1
                                            }
                                            className="rounded-full bg-black/60 p-1.5 text-white disabled:opacity-30"
                                            aria-label={tr('Нижче')}
                                        >
                                            <ChevronDown className="size-4" />
                                        </button>
                                    </div>
                                )}
                                {list.mine && (
                                    <button
                                        type="button"
                                        onClick={() => drop(movie)}
                                        className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                                        aria-label={tr('Прибрати з добірки')}
                                    >
                                        <X className="size-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {(list.is_public || list.mine) && (
                    <ListComments
                        listId={list.id}
                        initialCount={list.comments_count ?? 0}
                    />
                )}
            </div>
            <Dialog open={editing} onOpenChange={setEditing}>
                <DialogContent className="gap-3 sm:max-w-md">
                    <DialogTitle className="font-display text-lg font-semibold text-white">
                        {tr('Добірка')}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {tr('Назва, опис і видимість добірки')}
                    </DialogDescription>
                    <form onSubmit={save} className="space-y-3">
                        <input
                            value={form.title}
                            onChange={(e) =>
                                setForm({ ...form, title: e.target.value })
                            }
                            maxLength={80}
                            className="input-glass h-10 w-full rounded-xl px-3 text-sm text-white"
                        />
                        <textarea
                            value={form.description}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    description: e.target.value,
                                })
                            }
                            maxLength={500}
                            rows={3}
                            placeholder={tr('Опис (необов’язково)')}
                            className="input-glass w-full rounded-xl p-3 text-sm text-white placeholder:text-white/30"
                        />
                        <label className="flex items-center justify-between gap-3 text-sm text-white/70">
                            {tr('Видно всім')}
                            <Toggle
                                checked={form.is_public}
                                onChange={(v) =>
                                    setForm({ ...form, is_public: v })
                                }
                                label={tr('Видно всім')}
                            />
                        </label>
                        <label className="flex items-center justify-between gap-3 text-sm text-white/70">
                            <span>
                                {tr('Рейтинг')}
                                <span className="block text-xs text-white/40">
                                    {tr('Нумерувати тайтли: топ-10, топ-50…')}
                                </span>
                            </span>
                            <Toggle
                                checked={form.is_ranked}
                                onChange={(v) =>
                                    setForm({ ...form, is_ranked: v })
                                }
                                label={tr('Рейтинг')}
                            />
                        </label>
                        <button
                            type="submit"
                            className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold"
                        >
                            {tr('Зберегти')}
                        </button>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
