import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    ExternalLink,
    ImagePlus,
    Plus,
    RefreshCw,
    Save,
    Trash2,
    Tv,
    Wand2,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { MoviePoster } from '@/components/cinema/movie-tile';
import { PageHeader, Pill, Toggle, selectClass } from '@/components/gc/admin';
import { Input } from '@/components/ui/input';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { MovieCard, MovieOption, MoviePlayer, MovieType } from '@/types';

type EditableMovie = MovieCard & {
    tagline: string | null;
    trailer_url: string | null;
    description: string | null;
    poster_url: string | null;
    backdrop_url: string | null;
    countries: string[];
    duration: number | null;
    rating_imdb: number | null;
    rating_shikimori: number | null;
    rating_tmdb: number | null;
    imdb_id: string | null;
    shikimori_id: string | null;
    tmdb_id: string | null;
    origin: string;
    is_published: boolean;
    is_featured: boolean;
    comments_enabled: boolean;
    views_count: number;
    watchers_count: number;
    comments_count: number;
    ratings_count: number;
    has_poster_file: boolean;
    has_backdrop_file: boolean;
    user_rating: number | null;
    deleted_at: string | null;
    enriched_at: string | null;
    synced_at: string | null;
    sources: MoviePlayer[];
    flixcdn_link: string | null;
};

type Props = {
    movie: EditableMovie | null;
    types: MovieOption<MovieType>[];
    providers: { kodik: boolean; flixcdn: boolean; metadata: boolean };
    metadata: { key: string; label: string; configured: boolean }[];
};

const field =
    'input-glass w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none';

function Field({
    label,
    error,
    children,
    className,
}: {
    label: string;
    error?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <label className={cn('grid gap-1.5', className)}>
            <span className="text-xs font-medium text-white/55">{label}</span>
            {children}
            {error && <span className="text-xs text-rose-300">{error}</span>}
        </label>
    );
}

export default function AdminCinemaEdit({
    movie,
    types,
    providers,
    metadata,
}: Props) {
    const form = useForm({
        title: movie?.title ?? '',
        title_original: movie?.title_original ?? '',
        type: movie?.type ?? 'movie',
        year: movie?.year ?? '',
        tagline: movie?.tagline ?? '',
        description: movie?.description ?? '',
        genres: (movie?.genres ?? []).join(', '),
        countries: (movie?.countries ?? []).join(', '),
        duration: movie?.duration ?? '',
        age_rating: movie?.age_rating ?? '',
        rating_imdb: movie?.rating_imdb ?? '',
        rating_tmdb: movie?.rating_tmdb ?? '',
        rating_shikimori: movie?.rating_shikimori ?? '',
        imdb_id: movie?.imdb_id ?? '',
        tmdb_id: movie?.tmdb_id ?? '',
        shikimori_id: movie?.shikimori_id ?? '',
        poster_url: movie?.poster_url ?? '',
        backdrop_url: movie?.backdrop_url ?? '',
        trailer_url: movie?.trailer_url ?? '',
        poster: null as File | null,
        backdrop: null as File | null,
        remove_poster: false,
        remove_backdrop: false,
        is_published: movie?.is_published ?? true,
        is_featured: movie?.is_featured ?? false,
        comments_enabled: movie?.comments_enabled ?? true,
    });
    const { data, setData, errors } = form;
    const [posterPreview, setPosterPreview] = useState<string | null>(null);
    const source = useForm({ link: '', translation: '', quality: '' });

    const list = (value: string) =>
        value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);

    const submit = () => {
        form.transform((d) => ({
            ...d,
            genres: list(d.genres),
            countries: list(d.countries),
        }));
        form.post(movie ? `/admin/cinema/${movie.id}` : '/admin/cinema', {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                setData('poster', null);
                setData('backdrop', null);
            },
        });
    };

    const addSource = () =>
        movie &&
        source.post(`/admin/cinema/${movie.id}/sources`, {
            preserveScroll: true,
            onSuccess: () => source.reset(),
        });

    const preview: MovieCard = {
        ...(movie ?? {
            id: 0,
            slug: '',
            href: '#',
            type: 'movie',
            type_label: '',
            title_original: null,
            year: null,
            backdrop: null,
            genres: [],
            rating: null,
            age_rating: null,
            episodes_count: null,
        }),
        title: data.title || 'Без назви',
        poster:
            posterPreview ??
            (movie?.has_poster_file && !data.remove_poster
                ? movie.poster
                : data.poster_url || null),
    } as MovieCard;

    return (
        <>
            <Head
                title={`${movie ? movie.title : 'Новий фільм'} — Адмін-панель`}
            />
            <Link
                href="/admin/cinema"
                className="mb-3 inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
            >
                <ArrowLeft className="size-4" /> До каталогу
            </Link>
            <PageHeader
                title={movie ? movie.title : 'Новий фільм'}
                description={
                    movie
                        ? `Додано: ${movie.origin === 'manual' ? 'вручну' : movie.origin === 'kodik' ? 'Kodik' : 'FlixCDN'}${movie.enriched_at ? ` · метадані ${timeAgo(movie.enriched_at)}` : ''}${movie.synced_at ? ` · плеєри ${timeAgo(movie.synced_at)}` : ''}`
                        : 'Заповніть дані вручну або скористайтеся імпортом із Kodik/FlixCDN'
                }
                actions={
                    <div className="flex flex-wrap gap-2">
                        {movie && (
                            <>
                                <button
                                    type="button"
                                    disabled={!providers.metadata}
                                    onClick={() =>
                                        router.post(
                                            `/admin/cinema/${movie.id}/enrich`,
                                            {},
                                            { preserveScroll: true },
                                        )
                                    }
                                    className="glass inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white/85 hover:text-white disabled:opacity-40"
                                    title={metadata
                                        .filter((m) => m.configured)
                                        .map((m) => m.label)
                                        .join(', ')}
                                >
                                    <Wand2 className="size-4" /> Підтягнути
                                    метадані
                                </button>
                                <button
                                    type="button"
                                    disabled={
                                        !providers.kodik && !providers.flixcdn
                                    }
                                    onClick={() =>
                                        router.post(
                                            `/admin/cinema/${movie.id}/refresh`,
                                            {},
                                            { preserveScroll: true },
                                        )
                                    }
                                    className="glass inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white/85 hover:text-white disabled:opacity-40"
                                >
                                    <RefreshCw className="size-4" /> Оновити
                                    плеєри
                                </button>
                                <a
                                    href={movie.href}
                                    className="glass inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white/85 hover:text-white"
                                >
                                    <ExternalLink className="size-4" /> На сайті
                                </a>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={submit}
                            disabled={form.processing}
                            className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                        >
                            <Save className="size-4" /> Зберегти
                        </button>
                    </div>
                }
            />

            <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
                <div className="space-y-5">
                    <section className="glass grid gap-4 rounded-3xl p-5 sm:grid-cols-2">
                        <Field
                            label="Назва"
                            error={errors.title}
                            className="sm:col-span-2"
                        >
                            <input
                                className={field}
                                value={data.title}
                                onChange={(e) =>
                                    setData('title', e.target.value)
                                }
                            />
                        </Field>
                        <Field
                            label="Оригінальна назва"
                            error={errors.title_original}
                        >
                            <input
                                className={field}
                                value={data.title_original}
                                onChange={(e) =>
                                    setData('title_original', e.target.value)
                                }
                            />
                        </Field>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Тип" error={errors.type}>
                                <select
                                    className={cn(selectClass, 'h-[42px]')}
                                    value={data.type}
                                    onChange={(e) =>
                                        setData(
                                            'type',
                                            e.target.value as MovieType,
                                        )
                                    }
                                >
                                    {types.map((t) => (
                                        <option key={t.key} value={t.key}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Рік" error={errors.year}>
                                <input
                                    className={field}
                                    type="number"
                                    value={data.year}
                                    onChange={(e) =>
                                        setData('year', e.target.value)
                                    }
                                />
                            </Field>
                        </div>
                        <Field
                            label="Слоган"
                            error={errors.tagline}
                            className="sm:col-span-2"
                        >
                            <input
                                className={field}
                                value={data.tagline}
                                onChange={(e) =>
                                    setData('tagline', e.target.value)
                                }
                            />
                        </Field>
                        <Field
                            label="Опис"
                            error={errors.description}
                            className="sm:col-span-2"
                        >
                            <textarea
                                className={cn(field, 'min-h-32 resize-y')}
                                value={data.description}
                                onChange={(e) =>
                                    setData('description', e.target.value)
                                }
                            />
                        </Field>
                        <Field label="Жанри (через кому)" error={errors.genres}>
                            <input
                                className={field}
                                value={data.genres}
                                onChange={(e) =>
                                    setData('genres', e.target.value)
                                }
                                placeholder="фантастика, бойовик"
                            />
                        </Field>
                        <Field
                            label="Країни (через кому)"
                            error={errors.countries}
                        >
                            <input
                                className={field}
                                value={data.countries}
                                onChange={(e) =>
                                    setData('countries', e.target.value)
                                }
                            />
                        </Field>
                        <div className="grid grid-cols-2 gap-4">
                            <Field
                                label="Тривалість, хв"
                                error={errors.duration}
                            >
                                <input
                                    className={field}
                                    type="number"
                                    value={data.duration}
                                    onChange={(e) =>
                                        setData('duration', e.target.value)
                                    }
                                />
                            </Field>
                            <Field label="Вік" error={errors.age_rating}>
                                <input
                                    className={field}
                                    value={data.age_rating}
                                    onChange={(e) =>
                                        setData('age_rating', e.target.value)
                                    }
                                    placeholder="16+"
                                />
                            </Field>
                        </div>
                        <Field label="Трейлер" error={errors.trailer_url}>
                            <input
                                className={field}
                                value={data.trailer_url}
                                onChange={(e) =>
                                    setData('trailer_url', e.target.value)
                                }
                                placeholder="https://youtube.com/watch?v=…"
                            />
                        </Field>
                    </section>

                    <section className="glass rounded-3xl p-5">
                        <h2 className="mb-1 font-display text-base font-semibold text-white">
                            Рейтинги та зовнішні ID
                        </h2>
                        <p className="mb-4 text-xs text-white/45">
                            За ID метадані й плеєри знаходяться автоматично.
                            Рейтинги оновлюються при кожному збагаченні.
                        </p>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <Field label="IMDb ID" error={errors.imdb_id}>
                                <input
                                    className={cn(field, 'font-mono')}
                                    value={data.imdb_id}
                                    onChange={(e) =>
                                        setData(
                                            'imdb_id',
                                            e.target.value.trim(),
                                        )
                                    }
                                    placeholder="tt0133093"
                                />
                            </Field>
                            <Field label="TMDB ID" error={errors.tmdb_id}>
                                <input
                                    className={cn(field, 'font-mono')}
                                    value={data.tmdb_id}
                                    onChange={(e) =>
                                        setData(
                                            'tmdb_id',
                                            e.target.value.trim(),
                                        )
                                    }
                                    placeholder="movie:603"
                                />
                            </Field>
                            <Field
                                label="Shikimori ID"
                                error={errors.shikimori_id}
                            >
                                <input
                                    className={cn(field, 'font-mono')}
                                    value={data.shikimori_id}
                                    onChange={(e) =>
                                        setData(
                                            'shikimori_id',
                                            e.target.value.trim(),
                                        )
                                    }
                                />
                            </Field>
                            {(
                                [
                                    ['rating_imdb', 'Рейтинг IMDb'],
                                    ['rating_tmdb', 'Рейтинг TMDB'],
                                    ['rating_shikimori', 'Рейтинг Shikimori'],
                                ] as const
                            ).map(([key, label]) => (
                                <Field
                                    key={key}
                                    label={label}
                                    error={errors[key]}
                                >
                                    <input
                                        className={field}
                                        type="number"
                                        step="0.1"
                                        min={0}
                                        max={10}
                                        value={data[key]}
                                        onChange={(e) =>
                                            setData(key, e.target.value)
                                        }
                                    />
                                </Field>
                            ))}
                        </div>
                    </section>

                    <section className="glass rounded-3xl p-5">
                        <h2 className="mb-4 font-display text-base font-semibold text-white">
                            Зображення
                        </h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {(
                                [
                                    ['poster', 'Постер', 'has_poster_file'],
                                    ['backdrop', 'Фон', 'has_backdrop_file'],
                                ] as const
                            ).map(([key, label, hasFile]) => (
                                <div key={key} className="space-y-2">
                                    <Field
                                        label={`${label}: адреса`}
                                        error={errors[`${key}_url`]}
                                    >
                                        <input
                                            className={field}
                                            value={data[`${key}_url`]}
                                            onChange={(e) =>
                                                setData(
                                                    `${key}_url`,
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="https://…"
                                        />
                                    </Field>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/[0.06] px-3.5 py-2 text-xs text-white/80 hover:bg-white/10">
                                            <ImagePlus className="size-4" />
                                            {data[key]
                                                ? data[key]!.name
                                                : 'Завантажити файл'}
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file =
                                                        e.target.files?.[0] ??
                                                        null;
                                                    setData(key, file);
                                                    if (
                                                        key === 'poster' &&
                                                        file
                                                    ) {
                                                        setPosterPreview(
                                                            URL.createObjectURL(
                                                                file,
                                                            ),
                                                        );
                                                    }
                                                }}
                                            />
                                        </label>
                                        {movie?.[hasFile] && (
                                            <label className="flex items-center gap-2 text-xs text-white/55">
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        data[`remove_${key}`]
                                                    }
                                                    onChange={(e) =>
                                                        setData(
                                                            `remove_${key}`,
                                                            e.target.checked,
                                                        )
                                                    }
                                                />
                                                Прибрати завантажений
                                            </label>
                                        )}
                                    </div>
                                    {errors[key] && (
                                        <p className="text-xs text-rose-300">
                                            {errors[key]}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>

                    {movie && (
                        <section className="glass rounded-3xl p-5">
                            <h2 className="mb-1 flex items-center gap-2 font-display text-base font-semibold text-white">
                                <Tv className="size-4 text-[#8fa0ff]" />
                                Плеєри
                                <span className="text-sm font-normal text-white/40">
                                    {movie.sources.length}
                                </span>
                            </h2>
                            <p className="mb-4 text-xs text-white/45">
                                Kodik і FlixCDN оновлюються автоматично. Власний
                                плеєр — будь-який iframe або YouTube/Vimeo.
                            </p>
                            {movie.flixcdn_link && (
                                <div className="mb-2 flex items-center gap-3 rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-sm">
                                    <Pill tone="violet">FlixCDN</Pill>
                                    <span className="flex-1 truncate text-white/60">
                                        За шаблоном адреси
                                    </span>
                                </div>
                            )}
                            <ul className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
                                {movie.sources.map((s) => (
                                    <li
                                        key={s.key}
                                        className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3.5 py-2 text-sm"
                                    >
                                        <Pill
                                            tone={
                                                s.provider === 'kodik'
                                                    ? 'blue'
                                                    : s.provider === 'flixcdn'
                                                      ? 'violet'
                                                      : 'gold'
                                            }
                                        >
                                            {s.provider_label}
                                        </Pill>
                                        <span className="min-w-0 flex-1 truncate text-white/80">
                                            {s.translation ?? 'Без назви'}
                                            {s.quality && (
                                                <span className="text-white/40">
                                                    {' '}
                                                    · {s.quality}
                                                </span>
                                            )}
                                        </span>
                                        <a
                                            href={s.link}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-white/40 hover:text-white"
                                            title="Відкрити плеєр"
                                        >
                                            <ExternalLink className="size-4" />
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.delete(
                                                    `/admin/cinema/${movie.id}/sources/${s.id}`,
                                                    { preserveScroll: true },
                                                )
                                            }
                                            className="text-rose-300/70 hover:text-rose-300"
                                            title="Видалити"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_180px_110px_auto]">
                                <Input
                                    value={source.data.link}
                                    onChange={(e) =>
                                        source.setData('link', e.target.value)
                                    }
                                    placeholder="https://… (iframe, YouTube, Vimeo)"
                                />
                                <Input
                                    value={source.data.translation}
                                    onChange={(e) =>
                                        source.setData(
                                            'translation',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Озвучка"
                                />
                                <Input
                                    value={source.data.quality}
                                    onChange={(e) =>
                                        source.setData(
                                            'quality',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Якість"
                                />
                                <button
                                    type="button"
                                    onClick={addSource}
                                    disabled={
                                        source.processing || !source.data.link
                                    }
                                    className="btn-glow inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
                                >
                                    <Plus className="size-4" /> Додати
                                </button>
                            </div>
                            {source.errors.link && (
                                <p className="mt-1.5 text-xs text-rose-300">
                                    {source.errors.link}
                                </p>
                            )}
                        </section>
                    )}
                </div>

                <aside className="space-y-5">
                    <section className="glass rounded-3xl p-5">
                        <MoviePoster
                            movie={preview}
                            className="mx-auto aspect-[2/3] w-full max-w-[220px] rounded-2xl ring-1 ring-white/10"
                        />
                        <div className="mt-5 space-y-3">
                            {(
                                [
                                    ['is_published', 'Опубліковано'],
                                    ['is_featured', 'Показувати в банері'],
                                    ['comments_enabled', 'Коментарі'],
                                ] as const
                            ).map(([key, label]) => (
                                <label
                                    key={key}
                                    className="flex items-center justify-between gap-3 text-sm text-white/75"
                                >
                                    {label}
                                    <Toggle
                                        checked={data[key]}
                                        onChange={(v) => setData(key, v)}
                                        label={label}
                                    />
                                </label>
                            ))}
                        </div>
                    </section>
                    {movie && (
                        <section className="glass grid grid-cols-2 gap-3 rounded-3xl p-5 text-center">
                            {(
                                [
                                    ['Переглядів', movie.views_count],
                                    ['У списках', movie.watchers_count],
                                    ['Коментарів', movie.comments_count],
                                    ['Оцінок', movie.ratings_count],
                                ] as const
                            ).map(([label, value]) => (
                                <div
                                    key={label}
                                    className="rounded-2xl bg-white/[0.03] p-3"
                                >
                                    <p className="font-display text-xl font-bold text-white">
                                        {value}
                                    </p>
                                    <p className="text-[11px] text-white/45">
                                        {label}
                                    </p>
                                </div>
                            ))}
                        </section>
                    )}
                    <section className="glass rounded-3xl p-5 text-sm">
                        <p className="mb-2 font-semibold text-white">
                            Джерела метаданих
                        </p>
                        <ul className="space-y-1.5">
                            {metadata.map((m) => (
                                <li
                                    key={m.key}
                                    className="flex items-center justify-between text-white/65"
                                >
                                    {m.label}
                                    {m.configured ? (
                                        <Pill tone="green">активно</Pill>
                                    ) : (
                                        <Pill>вимкнено</Pill>
                                    )}
                                </li>
                            ))}
                        </ul>
                        <Link
                            href="/admin/integrations"
                            className="mt-3 inline-block text-xs text-[#9aa8ff] hover:text-white"
                        >
                            Налаштувати інтеграції →
                        </Link>
                    </section>
                </aside>
            </div>
        </>
    );
}
