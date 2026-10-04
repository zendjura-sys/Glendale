import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    Check,
    DownloadCloud,
    Loader2,
    Search,
    Sparkles,
    Star,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { MoviePoster } from '@/components/cinema/movie-tile';
import { PageHeader, Pill, Toggle, selectClass } from '@/components/gc/admin';
import { EmptyState } from '@/components/gc/widget';
import { Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { MovieOption, MovieType } from '@/types';
import { tr } from '@/lib/i18n';

type Provider = 'kodik' | 'flixcdn';

type Candidate = {
    key: string;
    type: MovieType;
    type_label: string;
    title: string;
    title_original: string | null;
    year: number | null;
    description: string | null;
    poster_url: string | null;
    genres: string[];
    rating_imdb: number | null;
    rating_shikimori: number | null;
    imdb_id: string | null;
    shikimori_id: string | null;
    episodes_count: number | null;
    translations: string[];
    sources_count: number;
    quality: string | null;
    imported: { id: number; slug: string } | null;
};

type Props = {
    providers: Record<
        Provider,
        { configured: boolean; search: boolean; latest: boolean }
    >;
    types: MovieOption<MovieType>[];
};

const searchBy = [
    { key: 'title', label: tr('За назвою') },
    { key: 'imdb_id', label: 'IMDb ID' },
    { key: 'shikimori_id', label: 'Shikimori ID' },
];

export default function AdminCinemaImport({ providers }: Props) {
    const [provider, setProvider] = useState<Provider>(
        providers.kodik.configured || !providers.flixcdn.configured
            ? 'kodik'
            : 'flixcdn',
    );
    const [q, setQ] = useState('');
    const [by, setBy] = useState('title');
    const [results, setResults] = useState<Candidate[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState<Set<string>>(new Set());
    const [publish, setPublish] = useState(true);
    const [enrich, setEnrich] = useState(true);
    const caps = providers[provider];

    const load = async (url: string) => {
        setLoading(true);
        try {
            const response = await api<{ candidates: Candidate[] }>('GET', url);
            setResults(response.candidates);
        } catch (e) {
            toast.error(
                e instanceof ApiError
                    ? e.message
                    : tr('Не вдалося виконати запит.'),
            );
        } finally {
            setLoading(false);
        }
    };

    const search = (e: FormEvent) => {
        e.preventDefault();
        if (!q.trim()) return;
        void load(
            `/admin/cinema/remote/${provider}/search?${new URLSearchParams({ q: q.trim(), by })}`,
        );
    };

    const importOne = async (c: Candidate) => {
        setImporting((s) => new Set(s).add(c.key));
        try {
            const response = await api<{
                movie: { id: number; slug: string };
                message: string;
            }>('POST', '/admin/cinema/remote/import', {
                provider,
                key: c.key,
                q: by === 'title' ? q : null,
                publish,
                enrich,
            });
            toast.success(response.message);
            setResults(
                (list) =>
                    list?.map((item) =>
                        item.key === c.key
                            ? {
                                  ...item,
                                  imported: {
                                      id: response.movie.id,
                                      slug: response.movie.slug,
                                  },
                              }
                            : item,
                    ) ?? null,
            );
        } catch (e) {
            toast.error(
                e instanceof ApiError
                    ? e.message
                    : tr('Не вдалося імпортувати.'),
            );
        } finally {
            setImporting((s) => {
                const next = new Set(s);
                next.delete(c.key);

                return next;
            });
        }
    };

    const importAll = async () => {
        for (const c of results?.filter((r) => !r.imported) ?? []) {
            await importOne(c);
        }
    };

    const fresh = results?.filter((r) => !r.imported).length ?? 0;

    return (
        <>
            <Head title={tr('Імпорт фільмів — Адмін-панель')} />
            <Link
                href="/admin/cinema"
                className="mb-3 inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
            >
                <ArrowLeft className="size-4" /> {tr('До каталогу')}
            </Link>
            <PageHeader
                title={tr('Імпорт тайтлів')}
                description={tr(
                    'Знайдіть фільм, серіал чи аніме в Kodik або FlixCDN — усі озвучки стануть плеєрами, а метадані підтягнуться з TMDB, Shikimori та IMDb.',
                )}
            />

            <div className="glass mb-5 space-y-3 rounded-3xl p-4">
                <div className="flex flex-wrap items-center gap-2">
                    {(['kodik', 'flixcdn'] as const).map((p) => (
                        <button
                            key={p}
                            type="button"
                            onClick={() => {
                                setProvider(p);
                                setResults(null);
                            }}
                            className={cn(
                                'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition',
                                provider === p
                                    ? 'nav-active text-white'
                                    : 'text-white/55 hover:bg-white/[0.05] hover:text-white',
                            )}
                        >
                            {p === 'kodik' ? 'Kodik' : 'FlixCDN'}
                            {!providers[p].configured && (
                                <Pill tone="gold">{tr('немає ключів')}</Pill>
                            )}
                        </button>
                    ))}
                    <div className="ml-auto flex flex-wrap items-center gap-4 text-sm text-white/70">
                        <label className="flex items-center gap-2">
                            <Toggle
                                checked={publish}
                                onChange={setPublish}
                                label={tr('Публікувати')}
                            />
                            {tr('Публікувати')}
                        </label>
                        <label className="flex items-center gap-2">
                            <Toggle
                                checked={enrich}
                                onChange={setEnrich}
                                label={tr('Метадані')}
                            />
                            {tr('Метадані')}
                        </label>
                    </div>
                </div>

                {!caps.configured ? (
                    <p className="rounded-2xl bg-amber-300/10 px-4 py-3 text-sm text-amber-100/90">
                        {provider === 'kodik' ? 'Kodik' : 'FlixCDN'}{' '}
                        {tr('ще не підключено. Вкажіть ключі в')}{' '}
                        <Link
                            href="/admin/integrations"
                            className="font-semibold underline"
                        >
                            {tr('Інтеграціях')}
                        </Link>
                        .
                    </p>
                ) : (
                    <form
                        onSubmit={search}
                        className="flex flex-col gap-2 md:flex-row"
                    >
                        <select
                            value={by}
                            onChange={(e) => setBy(e.target.value)}
                            className={selectClass}
                            disabled={!caps.search}
                        >
                            {searchBy.map((s) => (
                                <option key={s.key} value={s.key}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/30" />
                            <Input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder={
                                    caps.search
                                        ? tr('Наприклад: Дюна, tt1160419 …')
                                        : tr(
                                              'Пошук недоступний: не задано адресу «API: пошук»',
                                          )
                                }
                                disabled={!caps.search}
                                className="h-10 pl-10"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!caps.search || loading || !q.trim()}
                            className="btn-glow inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold disabled:opacity-40"
                        >
                            {tr('Знайти')}
                        </button>
                        <button
                            type="button"
                            disabled={!caps.latest || loading}
                            onClick={() =>
                                load(`/admin/cinema/remote/${provider}/latest`)
                            }
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-4 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-40"
                        >
                            <Sparkles className="size-4" />{' '}
                            {tr('Свіжі оновлення')}
                        </button>
                    </form>
                )}
            </div>

            {loading && (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-white/50">
                    <Loader2 className="size-5 animate-spin" /> {tr('Шукаємо…')}
                </div>
            )}

            {!loading && results !== null && results.length === 0 && (
                <EmptyState
                    icon={Search}
                    title={tr('Нічого не знайдено')}
                    text={tr('Спробуйте іншу назву або пошук за ID.')}
                />
            )}

            {!loading && results && results.length > 0 && (
                <>
                    <div className="mb-3 flex items-center gap-3">
                        <p className="flex-1 text-sm text-white/50">
                            {tr('Знайдено')} {results.length}
                            {tr(', нових')} {fresh}
                        </p>
                        <button
                            type="button"
                            disabled={fresh === 0 || importing.size > 0}
                            onClick={importAll}
                            className="glass inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white/85 hover:text-white disabled:opacity-40"
                        >
                            <DownloadCloud className="size-4" />{' '}
                            {tr('Імпортувати всі нові')}
                        </button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        {results.map((c) => (
                            <article
                                key={c.key}
                                className="glass flex gap-4 rounded-3xl p-3.5"
                            >
                                <MoviePoster
                                    movie={{
                                        id: c.title.length,
                                        title: c.title,
                                        poster: c.poster_url,
                                    }}
                                    className="aspect-[2/3] w-[88px] shrink-0 rounded-xl ring-1 ring-white/10"
                                />
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <p className="line-clamp-2 font-semibold text-white">
                                        {c.title}
                                    </p>
                                    <p className="truncate text-xs text-white/45">
                                        {[
                                            c.title_original,
                                            c.year,
                                            c.type_label,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </p>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                        {(c.rating_imdb ??
                                            c.rating_shikimori) && (
                                            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#f5b342]">
                                                <Star className="size-3 fill-current" />
                                                {(
                                                    c.rating_imdb ??
                                                    c.rating_shikimori
                                                )?.toFixed(1)}
                                            </span>
                                        )}
                                        <Pill tone="blue">
                                            {c.sources_count}{' '}
                                            {c.sources_count === 1
                                                ? tr('плеєр')
                                                : tr('плеєрів')}
                                        </Pill>
                                        {c.quality && <Pill>{c.quality}</Pill>}
                                        {c.episodes_count &&
                                            c.episodes_count > 1 && (
                                                <Pill>
                                                    {c.episodes_count}{' '}
                                                    {tr('еп.')}
                                                </Pill>
                                            )}
                                    </div>
                                    {c.translations.length > 0 && (
                                        <p className="mt-1.5 line-clamp-2 text-xs text-white/45">
                                            {c.translations.join(', ')}
                                        </p>
                                    )}
                                    <div className="mt-auto flex gap-2 pt-2.5">
                                        {c.imported ? (
                                            <>
                                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                                                    <Check className="size-4" />{' '}
                                                    {tr('У каталозі')}
                                                </span>
                                                <Link
                                                    href={`/admin/cinema/${c.imported.id}/edit`}
                                                    className="ml-auto text-xs text-[#9aa8ff] hover:text-white"
                                                >
                                                    {tr('Редагувати')}
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() => importOne(c)}
                                                    disabled={importing.has(
                                                        c.key,
                                                    )}
                                                    className="text-xs text-white/50 hover:text-white"
                                                >
                                                    {tr('Оновити плеєри')}
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => importOne(c)}
                                                disabled={importing.has(c.key)}
                                                className="btn-glow inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold disabled:opacity-50"
                                            >
                                                {importing.has(c.key) ? (
                                                    <Loader2 className="size-3.5 animate-spin" />
                                                ) : (
                                                    <DownloadCloud className="size-3.5" />
                                                )}
                                                {tr('Імпортувати')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </>
            )}
        </>
    );
}
