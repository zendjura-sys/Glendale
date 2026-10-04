import { Head, Link, router } from '@inertiajs/react';
import {
    DownloadCloud,
    Eye,
    EyeOff,
    Gamepad2,
    Layers,
    PlugZap,
    Search,
    Swords,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    PageHeader,
    Pagination,
    Pill,
    StatCard,
    Toggle,
} from '@/components/gc/admin';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { GameCard, Paginated } from '@/types';
import { GameCover } from '../games/index';
import { tr } from '@/lib/i18n';

type AdminGame = GameCard & {
    is_published: boolean;
    source: string;
    clans_count: number;
    updated_at: string | null;
};

type Props = {
    games: Paginated<AdminGame>;
    filters: { q: string; status: string | null; category: string | null };
    categories: Record<string, string>;
    features: { key: string; label: string; text: string }[];
    enabled: Record<string, boolean>;
    stats: {
        total: number;
        hidden: number;
        igdb: number;
        rawg: number;
        clans: number;
        source: string | null;
        last_sync: string | null;
    };
};

/** Адмінка → Ігри: можливості каталогу (увімкнути / вимкнути), оновлення й приховування ігор. */
export default function AdminGames({
    games,
    filters,
    categories,
    features,
    enabled,
    stats,
}: Props) {
    const [on, setOn] = useState(enabled);
    const [q, setQ] = useState(filters.q);
    const [syncing, setSyncing] = useState(false);
    const dirty = features.some((f) => on[f.key] !== enabled[f.key]);

    useEffect(() => setOn(enabled), [enabled]);

    const visit = (patch: Partial<Props['filters']>) =>
        router.get(
            '/admin/games',
            Object.fromEntries(
                Object.entries({ ...filters, q, ...patch }).filter(
                    ([, v]) => v !== null && v !== '',
                ),
            ),
            { preserveState: true, preserveScroll: true, replace: true },
        );

    useEffect(() => {
        if (q === filters.q) return;
        const timer = setTimeout(() => visit({ q }), 300);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    return (
        <>
            <Head title={tr('Ігри — адмінка')} />
            <PageHeader
                title={tr('Каталог ігор')}
                description={tr(
                    'Що показувати в каталозі й на сторінці гри, оновлення з IGDB і приховування окремих ігор.',
                )}
                actions={
                    <>
                        <Link
                            href="/admin/integrations"
                            className="glass inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm text-white/75 hover:text-white"
                        >
                            <PlugZap className="size-4" /> {tr('Ключі IGDB')}
                        </Link>
                        <button
                            type="button"
                            disabled={syncing}
                            onClick={() =>
                                router.post(
                                    '/admin/games/sync',
                                    {},
                                    {
                                        preserveScroll: true,
                                        onStart: () => setSyncing(true),
                                        onFinish: () => setSyncing(false),
                                    },
                                )
                            }
                            className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
                        >
                            <DownloadCloud
                                className={cn(
                                    'size-4',
                                    syncing && 'animate-pulse',
                                )}
                            />
                            {syncing ? tr('Оновлюємо…') : tr('Оновити зараз')}
                        </button>
                    </>
                }
            />

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                    label={tr('Ігор у каталозі')}
                    value={stats.total}
                    hint={
                        stats.hidden
                            ? tr('{hidden} приховано', { hidden: stats.hidden })
                            : undefined
                    }
                    icon={Gamepad2}
                />
                <StatCard
                    label={tr('З IGDB')}
                    value={stats.igdb}
                    hint={stats.rawg ? `RAWG: ${stats.rawg}` : undefined}
                    icon={Layers}
                    delay={50}
                />
                <StatCard
                    label={tr('Джерело оновлень')}
                    value={stats.source ?? '—'}
                    hint={
                        stats.last_sync
                            ? tr('оновлено {timeAgo}', {
                                  timeAgo: timeAgo(stats.last_sync),
                              })
                            : tr('щодня о 04:40')
                    }
                    icon={DownloadCloud}
                    delay={100}
                />
                <StatCard
                    label={tr('Кланів')}
                    value={stats.clans}
                    icon={Swords}
                    delay={150}
                />
            </div>

            <section className="glass mb-6 rounded-3xl p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                    <h2 className="flex-1 font-display text-lg font-semibold text-white">
                        {tr('Можливості')}
                    </h2>
                    <button
                        type="button"
                        onClick={() =>
                            setOn(
                                Object.fromEntries(
                                    features.map((f) => [f.key, true]),
                                ),
                            )
                        }
                        className="text-xs text-white/55 hover:text-white"
                    >
                        {tr('Увімкнути все')}
                    </button>
                    <button
                        type="button"
                        disabled={!dirty}
                        onClick={() =>
                            router.put('/admin/games/features', on, {
                                preserveScroll: true,
                            })
                        }
                        className="btn-glow inline-flex h-9 items-center rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
                    >
                        {tr('Зберегти')}
                    </button>
                </div>
                <p className="mb-4 text-sm text-white/50">
                    {tr('Вимкнене зникає одразу й на сайті, і в застосунку.')}
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                    {features.map((f) => (
                        <label
                            key={f.key}
                            className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white/[0.03] p-3 transition hover:bg-white/[0.05]"
                        >
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-white">
                                    {f.label}
                                </span>
                                <span className="block text-xs text-white/50">
                                    {f.text}
                                </span>
                            </span>
                            <Toggle
                                checked={on[f.key] ?? true}
                                onChange={(value) =>
                                    setOn({ ...on, [f.key]: value })
                                }
                                label={f.label}
                            />
                        </label>
                    ))}
                </div>
            </section>

            <section className="glass rounded-3xl p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <label className="input-glass flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-xl px-3">
                        <Search className="size-4 text-white/35" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder={tr('Назва гри')}
                            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                        />
                    </label>
                    <select
                        value={filters.category ?? ''}
                        onChange={(e) =>
                            visit({ category: e.target.value || null })
                        }
                        className="input-glass h-10 rounded-xl px-3 text-sm text-white"
                        aria-label={tr('Розділ')}
                    >
                        <option value="">{tr('Усі розділи')}</option>
                        {Object.entries(categories).map(([key, label]) => (
                            <option key={key} value={key}>
                                {label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={filters.status ?? ''}
                        onChange={(e) =>
                            visit({ status: e.target.value || null })
                        }
                        className="input-glass h-10 rounded-xl px-3 text-sm text-white"
                        aria-label={tr('Стан')}
                    >
                        <option value="">{tr('Усі')}</option>
                        <option value="published">{tr('У каталозі')}</option>
                        <option value="hidden">{tr('Приховані')}</option>
                    </select>
                </div>

                <div className="divide-y divide-white/[0.05]">
                    {games.data.map((g) => (
                        <div
                            key={g.id}
                            className="flex items-center gap-3 py-2.5"
                        >
                            <span className="h-10 w-16 shrink-0 overflow-hidden rounded-lg">
                                <GameCover game={g} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <Link
                                    href={`/games/${g.slug}`}
                                    className={cn(
                                        'block truncate text-sm font-semibold hover:underline',
                                        g.is_published
                                            ? 'text-white'
                                            : 'text-white/40 line-through',
                                    )}
                                >
                                    {g.name}
                                </Link>
                                <span className="flex flex-wrap items-center gap-1.5 text-xs text-white/45">
                                    {g.category_label} · {g.source}
                                    {g.clans_count > 0 &&
                                        tr(' · {clans_count} кланів', {
                                            clans_count: g.clans_count,
                                        })}
                                </span>
                            </span>
                            {!g.is_published && (
                                <Pill tone="gold">{tr('приховано')}</Pill>
                            )}
                            <button
                                type="button"
                                onClick={() =>
                                    router.patch(
                                        `/admin/games/${g.id}`,
                                        { is_published: !g.is_published },
                                        { preserveScroll: true },
                                    )
                                }
                                className="rounded-lg p-2 text-white/55 hover:bg-white/10 hover:text-white"
                                aria-label={
                                    g.is_published
                                        ? tr('Приховати')
                                        : tr('Показати')
                                }
                                title={
                                    g.is_published
                                        ? tr('Приховати')
                                        : tr('Показати')
                                }
                            >
                                {g.is_published ? (
                                    <EyeOff className="size-4" />
                                ) : (
                                    <Eye className="size-4" />
                                )}
                            </button>
                        </div>
                    ))}
                </div>
                <Pagination data={games} />
            </section>
        </>
    );
}
