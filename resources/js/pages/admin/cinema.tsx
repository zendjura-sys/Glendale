import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    Bot,
    CheckCircle2,
    Clapperboard,
    DownloadCloud,
    Eye,
    EyeOff,
    Film,
    Loader2,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    Sparkles,
    Star,
    Trash2,
    TriangleAlert,
    UsersRound,
    Wand2,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { MoviePoster } from '@/components/cinema/movie-tile';
import {
    PageHeader,
    Pagination,
    Pill,
    StatCard,
    Toggle,
    selectClass,
} from '@/components/gc/admin';
import { Input } from '@/components/ui/input';
import { compactNumber, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { MovieCard, MovieOption, MovieType, Paginated } from '@/types';
import { tr } from '@/lib/i18n';

type AdminMovie = MovieCard & {
    is_published: boolean;
    is_featured: boolean;
    sources_count: number;
    views_count: number;
    watchers_count: number;
    comments_count: number;
    kinopoisk_id: string | null;
    imdb_id: string | null;
    shikimori_id: string | null;
    tmdb_id: string | null;
    origin: 'manual' | 'kodik' | 'flixcdn';
    enriched_at: string | null;
    created_at: string;
    deleted_at: string | null;
};

type AutoConfig = {
    enabled: boolean;
    providers: ('kodik' | 'flixcdn')[];
    kodik_types: string[];
    pages: number;
    interval: number;
    publish: boolean;
    enrich: boolean;
    enrich_limit: number;
    min_year: number | null;
    only_with_ids: boolean;
};

type LastRun = {
    trigger: string;
    started_at: string;
    finished_at: string;
    created: number;
    updated: number;
    skipped: number;
    enriched: number;
    duration: number;
    providers: Record<
        string,
        { created: number; updated: number; skipped: number }
    >;
    errors: string[];
};

type Filter =
    | 'all'
    | 'published'
    | 'hidden'
    | 'featured'
    | 'no_sources'
    | 'not_enriched'
    | 'trashed';

type Props = {
    movies: Paginated<AdminMovie>;
    filters: { q: string; type: MovieType | null; filter: Filter };
    types: MovieOption<MovieType>[];
    stats: {
        movies: number;
        published: number;
        featured: number;
        sources: number;
        views: number;
        watchers: number;
        trashed: number;
        not_enriched: number;
        auto: number;
    };
    providers: {
        kodik: boolean;
        flixcdn: boolean;
        flixcdn_api: boolean;
        metadata: boolean;
    };
    auto: {
        config: AutoConfig;
        last: LastRun | null;
        running: boolean;
        kodik_types: MovieOption[];
        intervals: number[];
    };
};

const filterTabs: { key: Filter; label: string }[] = [
    { key: 'all', label: tr('Усі') },
    { key: 'published', label: tr('Опубліковані') },
    { key: 'hidden', label: tr('Приховані') },
    { key: 'featured', label: tr('У банері') },
    { key: 'no_sources', label: tr('Без плеєра') },
    { key: 'not_enriched', label: tr('Без метаданих') },
    { key: 'trashed', label: tr('Кошик') },
];

function intervalLabel(minutes: number) {
    if (minutes < 60) return tr('кожні {minutes} хв', { minutes });
    if (minutes === 60) return tr('щогодини');
    if (minutes === 1440) return tr('раз на добу');

    return tr('кожні {v} год', { v: minutes / 60 });
}

function AutoImportPanel({
    auto,
    providers,
    notEnriched,
}: {
    auto: Props['auto'];
    providers: Props['providers'];
    notEnriched: number;
}) {
    const form = useForm<AutoConfig>({ ...auto.config });
    const { data, setData } = form;
    const [running, setRunning] = useState(auto.running);
    const last = auto.last;

    const toggleIn = (key: 'providers' | 'kodik_types', value: string) => {
        const list = data[key] as string[];
        const next = list.includes(value)
            ? list.filter((v) => v !== value)
            : [...list, value];
        if (key === 'providers') {
            setData('providers', next as AutoConfig['providers']);
        } else {
            setData('kodik_types', next);
        }
    };

    const run = (enrichOnly = false) => {
        setRunning(true);
        router.post(
            '/admin/cinema/auto/run',
            { enrich_only: enrichOnly },
            { preserveScroll: true },
        );
    };

    const providerCards = [
        {
            key: 'kodik' as const,
            label: 'Kodik',
            ready: providers.kodik,
            hint: tr('Оновлення каталогу з усіма озвучками'),
        },
        {
            key: 'flixcdn' as const,
            label: 'FlixCDN',
            ready: providers.flixcdn_api,
            hint: tr('Через «API: оновлення» з кабінету'),
        },
    ];

    return (
        <section className="glass relative mb-5 overflow-hidden rounded-3xl p-5 sm:p-6">
            <div className="pointer-events-none absolute -top-24 -right-20 size-80 rounded-full bg-[#6d5dfc]/15 blur-3xl" />
            <header className="relative mb-5 flex flex-wrap items-center gap-4">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6d5dfc] to-[#f04fd8] shadow-[0_10px_30px_-10px_rgb(168_85_247/0.9)]">
                    <Bot className="size-6 text-white" />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold text-white">
                        {tr('Автонаповнення каталогу')}
                        {data.enabled ? (
                            <Pill tone="green">
                                <CheckCircle2 className="size-3" />{' '}
                                {intervalLabel(data.interval)}
                            </Pill>
                        ) : (
                            <Pill>{tr('Вимкнено')}</Pill>
                        )}
                        {running && (
                            <Pill tone="blue">
                                <Loader2 className="size-3 animate-spin" />{' '}
                                {tr('Виконується')}
                            </Pill>
                        )}
                    </h2>
                    <p className="text-sm text-white/50">
                        {tr(
                            'Нові тайтли з плеєрів додаються самі, плеєри наявних оновлюються, а метадані підтягуються з TMDB, Shikimori та IMDb.',
                        )}
                    </p>
                </div>
                <Toggle
                    checked={data.enabled}
                    onChange={(v) => setData('enabled', v)}
                    label={tr('Увімкнути автонаповнення')}
                />
            </header>

            <div className="relative grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {providerCards.map((p) => {
                            const on = data.providers.includes(p.key);

                            return (
                                <button
                                    key={p.key}
                                    type="button"
                                    onClick={() => toggleIn('providers', p.key)}
                                    className={cn(
                                        'flex items-start gap-3 rounded-2xl border p-3.5 text-left transition',
                                        on
                                            ? 'border-[#8fa0ff]/40 bg-[#6d5dfc]/10'
                                            : 'border-white/[0.08] bg-white/[0.02] hover:border-white/15',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition',
                                            on
                                                ? 'border-transparent bg-gradient-brand'
                                                : 'border-white/20',
                                        )}
                                    >
                                        {on && (
                                            <CheckCircle2 className="size-3.5 text-white" />
                                        )}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="flex items-center gap-2 text-sm font-semibold text-white">
                                            {p.label}
                                            {p.ready ? (
                                                <Pill tone="green">
                                                    {tr('підключено')}
                                                </Pill>
                                            ) : (
                                                <Pill tone="gold">
                                                    {tr('немає ключів')}
                                                </Pill>
                                            )}
                                        </span>
                                        <span className="mt-0.5 block text-xs text-white/45">
                                            {p.hint}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-medium text-white/50">
                            {tr('Типи Kodik')}{' '}
                            <span className="text-white/30">
                                {tr('(нічого не вибрано — усі)')}
                            </span>
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {auto.kodik_types.map((t) => (
                                <button
                                    key={t.key}
                                    type="button"
                                    onClick={() =>
                                        toggleIn('kodik_types', t.key)
                                    }
                                    className={cn(
                                        'rounded-full border px-3 py-1 text-xs transition',
                                        data.kodik_types.includes(t.key)
                                            ? 'border-[#8fa0ff]/50 bg-[#6d5dfc]/20 text-white'
                                            : 'border-white/10 text-white/55 hover:text-white',
                                    )}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <label className="grid gap-1.5 text-xs text-white/50">
                            {tr('Частота')}
                            <select
                                value={data.interval}
                                onChange={(e) =>
                                    setData('interval', Number(e.target.value))
                                }
                                className={selectClass}
                            >
                                {auto.intervals.map((i) => (
                                    <option key={i} value={i}>
                                        {intervalLabel(i)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="grid gap-1.5 text-xs text-white/50">
                            {tr('Сторінок за запуск (×100)')}
                            <Input
                                type="number"
                                min={1}
                                max={20}
                                value={data.pages}
                                onChange={(e) =>
                                    setData('pages', Number(e.target.value))
                                }
                            />
                        </label>
                        <label className="grid gap-1.5 text-xs text-white/50">
                            {tr('Не старіші за рік')}
                            <Input
                                type="number"
                                min={1900}
                                max={2100}
                                placeholder={tr('будь-які')}
                                value={data.min_year ?? ''}
                                onChange={(e) =>
                                    setData(
                                        'min_year',
                                        e.target.value
                                            ? Number(e.target.value)
                                            : null,
                                    )
                                }
                            />
                        </label>
                        <label className="grid gap-1.5 text-xs text-white/50">
                            {tr('Збагачувати за запуск')}
                            <Input
                                type="number"
                                min={1}
                                max={500}
                                value={data.enrich_limit}
                                onChange={(e) =>
                                    setData(
                                        'enrich_limit',
                                        Number(e.target.value),
                                    )
                                }
                            />
                        </label>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {(
                            [
                                ['publish', tr('Публікувати одразу')],
                                ['enrich', tr('Підтягувати метадані')],
                                ['only_with_ids', tr('Лише із зовнішніми ID')],
                            ] as const
                        ).map(([key, label]) => (
                            <label
                                key={key}
                                className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-sm text-white/75"
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

                    {Object.keys(form.errors).length > 0 && (
                        <p className="text-xs text-rose-300">
                            {Object.values(form.errors)[0]}
                        </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={form.processing}
                            onClick={() =>
                                form.put('/admin/cinema/auto', {
                                    preserveScroll: true,
                                })
                            }
                            className="btn-glow inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                        >
                            {tr('Зберегти')}
                        </button>
                        <button
                            type="button"
                            disabled={
                                running ||
                                (!providers.kodik && !providers.flixcdn_api)
                            }
                            onClick={() => run()}
                            className="inline-flex items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-40"
                        >
                            <RefreshCw
                                className={cn(
                                    'size-4',
                                    running && 'animate-spin',
                                )}
                            />
                            {tr('Запустити зараз')}
                        </button>
                        <button
                            type="button"
                            disabled={
                                running ||
                                !providers.metadata ||
                                notEnriched === 0
                            }
                            onClick={() => run(true)}
                            className="inline-flex items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-40"
                        >
                            <Wand2 className="size-4" />
                            {tr('Збагатити метадані (')}
                            {notEnriched})
                        </button>
                    </div>
                </div>

                <aside className="rounded-2xl bg-white/[0.035] p-4 text-sm">
                    <p className="font-semibold text-white">
                        {tr('Останній запуск')}
                    </p>
                    {last ? (
                        <>
                            <p className="mt-0.5 text-xs text-white/45">
                                {timeAgo(last.finished_at)} ·{' '}
                                {last.trigger === 'manual'
                                    ? tr('вручну')
                                    : tr('за розкладом')}{' '}
                                · {last.duration} {tr('с')}
                            </p>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                {(
                                    [
                                        [
                                            'created',
                                            tr('Нових'),
                                            'text-emerald-300',
                                        ],
                                        [
                                            'updated',
                                            tr('Оновлено'),
                                            'text-[#9cbcff]',
                                        ],
                                        [
                                            'enriched',
                                            tr('Збагачено'),
                                            'text-[#d3b0ff]',
                                        ],
                                        [
                                            'skipped',
                                            tr('Пропущено'),
                                            'text-white/50',
                                        ],
                                    ] as const
                                ).map(([key, label, tone]) => (
                                    <div
                                        key={key}
                                        className="rounded-xl bg-black/25 px-3 py-2"
                                    >
                                        <p
                                            className={cn(
                                                'font-display text-xl font-bold tabular-nums',
                                                tone,
                                            )}
                                        >
                                            {compactNumber(last[key])}
                                        </p>
                                        <p className="text-xs text-white/45">
                                            {label}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            {Object.entries(last.providers).map(
                                ([key, counts]) => (
                                    <p
                                        key={key}
                                        className="mt-2 text-xs text-white/50"
                                    >
                                        <b className="text-white/75">
                                            {key === 'kodik'
                                                ? 'Kodik'
                                                : 'FlixCDN'}
                                        </b>
                                        : +{counts.created}
                                        {tr(', оновлено')} {counts.updated}
                                    </p>
                                ),
                            )}
                            {last.errors.length > 0 && (
                                <ul className="mt-3 space-y-1">
                                    {last.errors.map((e) => (
                                        <li
                                            key={e}
                                            className="flex gap-1.5 text-xs text-amber-200/90"
                                        >
                                            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                                            {e}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </>
                    ) : (
                        <p className="mt-1 text-xs text-white/45">
                            {tr(
                                'Ще не запускалося. Підключіть Kodik або FlixCDN в',
                            )}{' '}
                            <Link
                                href="/admin/integrations"
                                className="text-[#9aa8ff] hover:text-white"
                            >
                                {tr('інтеграціях')}
                            </Link>{' '}
                            {tr('і натисніть «Запустити зараз».')}
                        </p>
                    )}
                    <p className="mt-4 text-xs leading-relaxed text-white/35">
                        {tr(
                            'Розклад працює через планувальник Laravel: на сервері має бути cron',
                        )}{' '}
                        <code>php artisan schedule:run</code> {tr('щохвилини.')}
                    </p>
                </aside>
            </div>
        </section>
    );
}

export default function AdminCinema({
    movies,
    filters,
    types,
    stats,
    providers,
    auto,
}: Props) {
    const [q, setQ] = useState(filters.q);

    const apply = (patch: Partial<Props['filters']>) => {
        const next = { ...filters, q, ...patch };
        router.get(
            '/admin/cinema',
            {
                q: next.q || undefined,
                type: next.type ?? undefined,
                filter: next.filter === 'all' ? undefined : next.filter,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        apply({ q });
    };

    const flag = (movie: AdminMovie, key: 'is_published' | 'is_featured') =>
        router.patch(
            `/admin/cinema/${movie.id}/flags`,
            { [key]: !movie[key] },
            { preserveScroll: true },
        );

    const remove = (movie: AdminMovie) => {
        if (
            movie.deleted_at &&
            !confirm(
                tr('Видалити фільм назавжди разом з коментарями та списками?'),
            )
        ) {
            return;
        }
        router.delete(`/admin/cinema/${movie.id}`, { preserveScroll: true });
    };

    return (
        <>
            <Head title={tr('Кіно — Адмін-панель')} />
            <PageHeader
                title={tr('Кіно')}
                description={tr(
                    'Каталог фільмів, плеєри Kodik/FlixCDN, автонаповнення й метадані',
                )}
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Link
                            href="/admin/cinema/import"
                            className="glass inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white/85 hover:text-white"
                        >
                            <DownloadCloud className="size-4" /> {tr('Імпорт')}
                        </Link>
                        <Link
                            href="/admin/cinema/create"
                            className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                        >
                            <Plus className="size-4" /> {tr('Додати вручну')}
                        </Link>
                    </div>
                }
            />

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label={tr('Тайтлів')}
                    value={compactNumber(stats.movies)}
                    icon={Film}
                    hint={tr('{published} опубліковано · {auto} автоматично', {
                        published: stats.published,
                        auto: stats.auto,
                    })}
                />
                <StatCard
                    label={tr('Плеєрів (озвучок)')}
                    value={compactNumber(stats.sources)}
                    icon={Clapperboard}
                    tone="from-[#22d3a6] to-[#38e1ff]"
                    delay={60}
                />
                <StatCard
                    label={tr('Переглядів')}
                    value={compactNumber(stats.views)}
                    icon={Eye}
                    tone="from-[#f5b342] to-[#f04fd8]"
                    delay={120}
                />
                <StatCard
                    label={tr('У списках глядачів')}
                    value={compactNumber(stats.watchers)}
                    icon={UsersRound}
                    tone="from-[#f04fd8] to-[#a855f7]"
                    delay={180}
                />
            </div>

            <AutoImportPanel
                auto={auto}
                providers={providers}
                notEnriched={stats.not_enriched}
            />

            <div className="glass mb-4 flex flex-col gap-3 rounded-2xl p-2.5 lg:flex-row lg:items-center">
                <div className="scrollbar-none flex gap-1 overflow-x-auto">
                    {filterTabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => apply({ filter: tab.key })}
                            className={cn(
                                'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                                filters.filter === tab.key
                                    ? 'bg-gradient-brand text-white'
                                    : 'text-white/55 hover:text-white',
                            )}
                        >
                            {tab.label}
                            {tab.key === 'trashed' && ` (${stats.trashed})`}
                            {tab.key === 'not_enriched' &&
                                ` (${stats.not_enriched})`}
                        </button>
                    ))}
                </div>
                <form onSubmit={submit} className="relative flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/30" />
                    <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={tr('Назва або оригінальна назва')}
                        className="h-10 pl-10"
                    />
                </form>
                <select
                    value={filters.type ?? ''}
                    onChange={(e) =>
                        apply({
                            type: (e.target.value || null) as MovieType | null,
                        })
                    }
                    className={selectClass}
                >
                    <option value="">{tr('Усі типи')}</option>
                    {types.map((t) => (
                        <option key={t.key} value={t.key}>
                            {t.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="glass overflow-hidden rounded-3xl">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                        <thead>
                            <tr className="border-b border-white/[0.06] text-left text-xs tracking-wider text-white/40 uppercase">
                                <th className="px-4 py-3 font-medium">
                                    {tr('Тайтл')}
                                </th>
                                <th className="px-3 py-3 font-medium">
                                    {tr('Джерело')}
                                </th>
                                <th className="px-3 py-3 text-right font-medium">
                                    {tr('Плеєри')}
                                </th>
                                <th className="px-3 py-3 text-right font-medium">
                                    {tr('Перегляди')}
                                </th>
                                <th className="px-3 py-3 font-medium">
                                    {tr('Показ')}
                                </th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {movies.data.map((movie) => (
                                <tr
                                    key={movie.id}
                                    className={cn(
                                        'border-b border-white/[0.04] transition last:border-0 hover:bg-white/[0.03]',
                                        movie.deleted_at && 'opacity-60',
                                    )}
                                >
                                    <td className="px-4 py-2.5">
                                        <Link
                                            href={`/admin/cinema/${movie.id}/edit`}
                                            className="flex items-center gap-3"
                                        >
                                            <MoviePoster
                                                movie={movie}
                                                className="aspect-[2/3] w-10 shrink-0 rounded-lg [&_span]:hidden [&_svg]:size-4"
                                            />
                                            <span className="min-w-0">
                                                <span className="block truncate font-medium text-white hover:underline">
                                                    {movie.title}
                                                </span>
                                                <span className="flex items-center gap-1.5 truncate text-xs text-white/45">
                                                    {[
                                                        movie.year,
                                                        movie.type_label,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                    {movie.rating && (
                                                        <span className="inline-flex items-center gap-0.5 text-[#f5b342]">
                                                            <Star className="size-3 fill-current" />
                                                            {movie.rating.toFixed(
                                                                1,
                                                            )}
                                                        </span>
                                                    )}
                                                </span>
                                            </span>
                                        </Link>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <div className="flex flex-wrap gap-1">
                                            <Pill
                                                tone={
                                                    movie.origin === 'manual'
                                                        ? 'default'
                                                        : 'blue'
                                                }
                                            >
                                                {movie.origin === 'manual'
                                                    ? tr('Вручну')
                                                    : movie.origin === 'kodik'
                                                      ? 'Kodik'
                                                      : 'FlixCDN'}
                                            </Pill>
                                            {movie.enriched_at ? (
                                                <Pill tone="violet">
                                                    <Sparkles className="size-3" />
                                                    {tr('метадані')}
                                                </Pill>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">
                                        {movie.sources_count > 0 ? (
                                            <span className="text-white/70">
                                                {movie.sources_count}
                                            </span>
                                        ) : (
                                            <span className="text-amber-300/80">
                                                {tr('немає')}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-white/65 tabular-nums">
                                        {compactNumber(movie.views_count)}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-3">
                                            <span
                                                className="flex items-center gap-1.5 text-xs text-white/45"
                                                title={tr('Опубліковано')}
                                            >
                                                <Toggle
                                                    checked={movie.is_published}
                                                    onChange={() =>
                                                        flag(
                                                            movie,
                                                            'is_published',
                                                        )
                                                    }
                                                    disabled={
                                                        !!movie.deleted_at
                                                    }
                                                    label={tr('Опубліковано')}
                                                />
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    flag(movie, 'is_featured')
                                                }
                                                className={cn(
                                                    'flex size-8 items-center justify-center rounded-lg transition',
                                                    movie.is_featured
                                                        ? 'bg-amber-400/15 text-amber-300'
                                                        : 'text-white/30 hover:bg-white/10 hover:text-white',
                                                )}
                                                title={tr(
                                                    'Показувати в банері',
                                                )}
                                            >
                                                <Sparkles className="size-4" />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex justify-end gap-1.5">
                                            {!movie.deleted_at && (
                                                <a
                                                    href={movie.href}
                                                    className="flex size-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
                                                    title={tr(
                                                        'Відкрити на сайті',
                                                    )}
                                                >
                                                    {movie.is_published ? (
                                                        <Eye className="size-4" />
                                                    ) : (
                                                        <EyeOff className="size-4" />
                                                    )}
                                                </a>
                                            )}
                                            {movie.deleted_at && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        router.post(
                                                            `/admin/cinema/${movie.id}/restore`,
                                                            {},
                                                            {
                                                                preserveScroll: true,
                                                            },
                                                        )
                                                    }
                                                    className="flex size-8 items-center justify-center rounded-lg text-emerald-300 hover:bg-emerald-400/10"
                                                    title={tr('Відновити')}
                                                >
                                                    <RotateCcw className="size-4" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => remove(movie)}
                                                className="flex size-8 items-center justify-center rounded-lg text-rose-300 hover:bg-rose-400/10"
                                                title={
                                                    movie.deleted_at
                                                        ? tr(
                                                              'Видалити назавжди',
                                                          )
                                                        : tr('У кошик')
                                                }
                                            >
                                                <Trash2 className="size-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {movies.data.length === 0 && (
                    <div className="px-6 py-14 text-center text-sm text-white/40">
                        {tr('Тайтлів не знайдено')}
                    </div>
                )}
            </div>

            <Pagination data={movies} />
        </>
    );
}
