import { Link } from '@inertiajs/react';
import { Eye, Heart, ListPlus, Lock, Plus, Star, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { Toggle } from '@/components/gc/admin';
import { UserAvatar } from '@/components/gc/user-avatar';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
    CriteriaBars,
    CriteriaChips,
    CriteriaInput,
} from '@/components/gc/review-criteria';
import type { Criteria } from '@/components/gc/review-criteria';
import type { MovieCard } from '@/types/cinema';
import type { UserCard } from '@/types';

export type MovieReview = {
    id: number;
    body: string;
    score: number;
    criteria?: Criteria | null;
    spoiler: boolean;
    likes_count: number;
    liked: boolean;
    mine: boolean;
    user: UserCard | null;
    movie: MovieCard | null;
    created_at: string;
};

/** Рецензія: спойлер прихований під розмиттям, доки не натиснути. */
export function ReviewCard({
    review,
    showMovie = false,
    onDelete,
}: {
    review: MovieReview;
    showMovie?: boolean;
    onDelete?: () => void;
}) {
    const [open, setOpen] = useState(!review.spoiler || review.mine);
    const [liked, setLiked] = useState(review.liked);
    const [likes, setLikes] = useState(review.likes_count);

    const like = () =>
        api<{ liked: boolean; likes_count: number }>(
            'POST',
            `/cinema/reviews/${review.id}/like`,
        )
            .then((d) => {
                setLiked(d.liked);
                setLikes(d.likes_count);
            })
            .catch((e: Error) => toast.error(e.message));

    return (
        <article className="glass rounded-2xl p-4">
            <div className="flex gap-3">
                {showMovie && review.movie && (
                    <Link
                        href={review.movie.href}
                        className="w-16 shrink-0 overflow-hidden rounded-xl bg-white/[0.06]"
                    >
                        {review.movie.poster && (
                            <img
                                src={review.movie.poster}
                                alt=""
                                loading="lazy"
                                className="aspect-[2/3] w-full object-cover"
                            />
                        )}
                    </Link>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        {review.user && (
                            <UserAvatar user={review.user} size="sm" />
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">
                                {review.user?.name}
                            </p>
                            <p className="truncate text-xs text-white/45">
                                {showMovie && review.movie
                                    ? `${review.movie.title} · `
                                    : ''}
                                {formatDate(review.created_at)}
                            </p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-chip bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-200">
                            <Star className="size-3.5 fill-current" />
                            {review.score}/10
                        </span>
                    </div>
                    <CriteriaChips kind="movie" criteria={review.criteria} />
                    <div className="relative mt-3">
                        <p
                            className={cn(
                                'text-sm leading-relaxed whitespace-pre-line text-white/80',
                                !open &&
                                    'pointer-events-none blur-sm select-none',
                            )}
                        >
                            {review.body}
                        </p>
                        {!open && (
                            <button
                                type="button"
                                onClick={() => setOpen(true)}
                                className="absolute inset-0 flex items-center justify-center"
                            >
                                <span className="inline-flex items-center gap-1.5 rounded-chip bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">
                                    <Eye className="size-3.5" />
                                    {tr('Спойлер — показати')}
                                </span>
                            </button>
                        )}
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs">
                        <button
                            type="button"
                            disabled={review.mine}
                            onClick={like}
                            className={cn(
                                'inline-flex items-center gap-1.5 transition',
                                liked
                                    ? 'text-rose-300'
                                    : 'text-white/50 hover:text-white',
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
                        {review.mine && onDelete && (
                            <button
                                type="button"
                                onClick={onDelete}
                                className="ml-auto inline-flex items-center gap-1 text-white/40 hover:text-white"
                            >
                                <Trash2 className="size-3.5" />
                                {tr('Видалити')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </article>
    );
}

type ReviewsData = {
    reviews: { data: MovieReview[] };
    summary: {
        count: number;
        average: number;
        criteria?: Record<string, number | null>;
    };
    mine: MovieReview | null;
};

/** Рецензії на сторінці тайтлу: свій текст (форма) і чужі, найпопулярніші першими. */
export function MovieReviews({ slug }: { slug: string }) {
    const [data, setData] = useState<ReviewsData | null>(null);
    const [writing, setWriting] = useState(false);
    const [body, setBody] = useState('');
    const [score, setScore] = useState(8);
    const [spoiler, setSpoiler] = useState(false);
    const [criteria, setCriteria] = useState<Criteria>({});
    const [busy, setBusy] = useState(false);

    const load = () =>
        api<ReviewsData>('GET', `/cinema/${slug}/reviews`)
            .then((d) => {
                setData(d);
                if (d.mine) {
                    setBody(d.mine.body);
                    setScore(d.mine.score);
                    setSpoiler(d.mine.spoiler);
                    setCriteria(d.mine.criteria ?? {});
                }
            })
            .catch(() => undefined);

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        api('POST', `/cinema/${slug}/reviews`, {
            body,
            score,
            spoiler,
            criteria,
        })
            .then(() => {
                toast.success(tr('Рецензію опубліковано.'));
                setWriting(false);
                void load();
            })
            .catch((e: Error) => toast.error(e.message))
            .finally(() => setBusy(false));
    };

    const remove = () =>
        api('DELETE', `/cinema/${slug}/reviews`)
            .then(() => {
                setBody('');
                void load();
            })
            .catch(() => undefined);

    return (
        <section className="glass rounded-2xl p-5">
            <div className="mb-3 flex items-center gap-2">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                    <Star className="size-5 text-amber-300" />
                    {tr('Рецензії')}
                </h2>
                {data && data.summary.count > 0 && (
                    <span className="text-sm text-white/45">
                        {data.summary.count} · ★ {data.summary.average}
                    </span>
                )}
                <button
                    type="button"
                    onClick={() => setWriting((v) => !v)}
                    className="ml-auto text-sm font-medium text-sky-300 hover:text-white"
                >
                    {data?.mine ? tr('Змінити мою') : tr('Написати рецензію')}
                </button>
            </div>
            {data?.summary.criteria && (
                <div className="mb-4">
                    <CriteriaBars
                        kind="movie"
                        averages={data.summary.criteria}
                    />
                </div>
            )}
            {writing && (
                <form onSubmit={submit} className="mb-4 space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                        {Array.from({ length: 10 }, (_, i) => i + 1).map(
                            (n) => (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => setScore(n)}
                                    className={cn(
                                        'size-9 rounded-lg text-sm font-semibold transition',
                                        n <= score
                                            ? 'bg-amber-400/80 text-black'
                                            : 'bg-white/[0.06] text-white/60',
                                    )}
                                >
                                    {n}
                                </button>
                            ),
                        )}
                    </div>
                    <CriteriaInput
                        kind="movie"
                        value={criteria}
                        onChange={setCriteria}
                    />
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={5}
                        maxLength={5000}
                        placeholder={tr('Що сподобалось, що ні, кому радите…')}
                        className="input-glass w-full rounded-xl p-3 text-sm text-white placeholder:text-white/30"
                    />
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-white/70">
                            {tr('Є спойлери — сховати текст')}
                        </span>
                        <Toggle
                            checked={spoiler}
                            onChange={setSpoiler}
                            label={tr('Є спойлери — сховати текст')}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={busy}
                        className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold"
                    >
                        {tr('Опублікувати')}
                    </button>
                </form>
            )}
            <div className="space-y-3">
                {data?.reviews.data.length === 0 && !writing && (
                    <p className="text-sm text-white/45">
                        {tr('Рецензій ще немає — будьте першими.')}
                    </p>
                )}
                {data?.reviews.data.map((review) => (
                    <ReviewCard
                        key={review.id}
                        review={review}
                        onDelete={remove}
                    />
                ))}
            </div>
        </section>
    );
}

type MyList = {
    id: number;
    title: string;
    items_count: number;
    is_public: boolean;
    contains: boolean;
};

/** «У добірку»: мої добірки з позначкою, де вже є цей тайтл, і створення нової. */
export function AddToList({
    movieId,
    slug,
}: {
    movieId: number;
    slug: string;
}) {
    const [lists, setLists] = useState<MyList[] | null>(null);
    const [title, setTitle] = useState('');
    const [isPublic, setIsPublic] = useState(true);

    const open = () =>
        api<{ lists: MyList[] }>('GET', `/cinema/${slug}/lists`)
            .then((d) => setLists(d.lists))
            .catch(() => undefined);

    const toggle = (list: MyList) =>
        api('POST', `/cinema/lists/${list.id}/items`, {
            movie: movieId,
            on: !list.contains,
        })
            .then(() =>
                setLists(
                    (all) =>
                        all?.map((l) =>
                            l.id === list.id
                                ? {
                                      ...l,
                                      contains: !l.contains,
                                      items_count:
                                          l.items_count + (l.contains ? -1 : 1),
                                  }
                                : l,
                        ) ?? null,
                ),
            )
            .catch((e: Error) => toast.error(e.message));

    const create = (e: FormEvent) => {
        e.preventDefault();
        api('POST', '/cinema/lists', {
            title,
            is_public: isPublic,
            movie: movieId,
        })
            .then(() => {
                setTitle('');
                toast.success(tr('Добірку створено.'));
                void open();
            })
            .catch((e: Error) => toast.error(e.message));
    };

    return (
        <>
            <button
                type="button"
                onClick={open}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 px-3 text-sm text-white"
            >
                <ListPlus className="size-4" />
                {tr('У добірку')}
            </button>
            <Dialog
                open={lists !== null}
                onOpenChange={(v) => !v && setLists(null)}
            >
                <DialogContent className="max-h-[calc(100dvh-2rem)] gap-3 overflow-y-auto sm:max-w-md">
                    <div>
                        <DialogTitle className="font-display text-lg font-semibold text-white">
                            {tr('Додати в добірку')}
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-sm text-white/50">
                            <Link
                                href="/cinema/lists?tab=mine"
                                className="hover:text-white"
                            >
                                {tr('Усі мої добірки')}
                            </Link>
                        </DialogDescription>
                    </div>
                    <div className="space-y-1">
                        {lists?.map((list) => (
                            <button
                                key={list.id}
                                type="button"
                                onClick={() => toggle(list)}
                                className={cn(
                                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.06]',
                                    list.contains && 'bg-primary/15',
                                )}
                            >
                                <span className="min-w-0 flex-1 truncate text-white">
                                    {list.title}
                                </span>
                                {!list.is_public && (
                                    <Lock className="size-3.5 text-white/40" />
                                )}
                                <span className="text-xs text-white/45">
                                    {list.items_count}
                                </span>
                                <span
                                    className={cn(
                                        'flex size-5 items-center justify-center rounded-md border',
                                        list.contains
                                            ? 'border-primary bg-primary text-white'
                                            : 'border-white/25',
                                    )}
                                >
                                    {list.contains && '✓'}
                                </span>
                            </button>
                        ))}
                    </div>
                    <form
                        onSubmit={create}
                        className="space-y-2 border-t border-white/[0.06] pt-3"
                    >
                        <div className="flex gap-2">
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                maxLength={80}
                                placeholder={tr(
                                    'Нова добірка, напр. «Хорори на вечір»',
                                )}
                                className="input-glass h-10 min-w-0 flex-1 rounded-xl px-3 text-sm text-white placeholder:text-white/30"
                            />
                            <button
                                type="submit"
                                disabled={title.trim().length < 2}
                                className="btn-glow inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold"
                            >
                                <Plus className="size-4" />
                                {tr('Створити')}
                            </button>
                        </div>
                        <label className="flex items-center justify-between gap-3 text-sm text-white/70">
                            {tr('Видно всім')}
                            <Toggle
                                checked={isPublic}
                                onChange={setIsPublic}
                                label={tr('Видно всім')}
                            />
                        </label>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
