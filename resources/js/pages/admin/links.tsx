import { Head, Link, router } from '@inertiajs/react';
import { CheckCircle2, EyeOff, Link2, RotateCw, Unlink } from 'lucide-react';
import { PageHeader, Pagination, StatCard } from '@/components/gc/admin';
import { EmptyState } from '@/components/gc/widget';
import { timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { Paginated } from '@/types';

type Item = {
    id: number;
    source: string;
    field: string;
    kind: 'remote' | 'file';
    url: string;
    label: string | null;
    status: number | null;
    error: string | null;
    fails: number;
    failing_since: string | null;
    checked_at: string | null;
    edit_url: string | null;
};

type Props = {
    items: Paginated<Item>;
    filters: { source: string | null; tab: 'broken' | 'ignored' };
    sources: Record<string, string>;
    stats: {
        total: number;
        checked: number;
        broken: number;
        last_run: string | null;
    };
};

const FIELDS: Record<string, string> = {
    cover: 'Обкладинка',
    poster: 'Постер',
    backdrop: 'Фон',
    website: 'Сайт',
    image: 'Картинка',
};

function field(f: string): string {
    if (f.startsWith('link:'))
        return tr('Посилання: {store}', { store: f.slice(5) });

    return tr(FIELDS[f] ?? f);
}

/** Адмінка → Биті посилання: звіт нічної перевірки. Нічого не видаляється — лише показуємо, де виправити. */
export default function Links({ items, filters, sources, stats }: Props) {
    const visit = (next: Partial<Props['filters']>) =>
        router.get(
            '/admin/links',
            { ...filters, ...next },
            { preserveScroll: true, preserveState: true },
        );
    const act = (item: Item, action: 'ignore' | 'recheck', on = true) =>
        router.post(
            `/admin/links/${item.id}/${action}`,
            action === 'ignore' ? { on } : {},
            { preserveScroll: true },
        );

    return (
        <>
            <Head title={tr('Биті посилання — Адмін-панель')} />
            <PageHeader
                title={tr('Биті посилання й картинки')}
                description={tr(
                    'Щоночі перевіряємо обкладинки, постери, магазини ігор і сайти серверів. Битою адреса стає після двох невдач поспіль. Автоматика нічого не видаляє.',
                )}
            />

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                    label={tr('Адрес')}
                    value={stats.total}
                    icon={Link2}
                />
                <StatCard
                    label={tr('Перевірено')}
                    value={stats.checked}
                    icon={CheckCircle2}
                    delay={60}
                />
                <StatCard
                    label={tr('Битих')}
                    value={stats.broken}
                    icon={Unlink}
                    delay={120}
                />
                <div className="gc-solid rounded-2xl p-4">
                    <p className="text-sm text-white/55">
                        {tr('Остання перевірка')}
                    </p>
                    <p className="mt-1 font-display text-xl font-bold text-white">
                        {stats.last_run
                            ? timeAgo(stats.last_run)
                            : tr('Ще не було')}
                    </p>
                </div>
            </div>

            <div className="gc-solid mb-4 flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
                <div className="gc-solid-2 flex rounded-xl p-1 text-sm">
                    {(
                        [
                            ['broken', 'Биті'],
                            ['ignored', 'Ігноровані'],
                        ] as const
                    ).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => visit({ tab: key })}
                            className={cn(
                                'rounded-lg px-3 py-1.5 font-medium transition',
                                filters.tab === key
                                    ? 'bg-sky-500 text-white'
                                    : 'text-white/55 hover:text-white',
                            )}
                        >
                            {tr(label)}
                        </button>
                    ))}
                </div>
                <div className="gc-solid-2 flex flex-wrap rounded-xl p-1 text-sm">
                    {[[null, 'Усі'] as const, ...Object.entries(sources)].map(
                        ([key, label]) => (
                            <button
                                key={key ?? 'all'}
                                type="button"
                                onClick={() => visit({ source: key })}
                                className={cn(
                                    'rounded-lg px-3 py-1.5 font-medium transition',
                                    filters.source === key
                                        ? 'bg-sky-500 text-white'
                                        : 'text-white/55 hover:text-white',
                                )}
                            >
                                {tr(label)}
                            </button>
                        ),
                    )}
                </div>
            </div>

            {items.data.length === 0 ? (
                <EmptyState
                    icon={CheckCircle2}
                    title={
                        filters.tab === 'broken'
                            ? tr('Битих посилань немає')
                            : tr('Ігнорованих немає')
                    }
                    text={tr('Наступна перевірка — вночі.')}
                />
            ) : (
                <ul className="gc-solid divide-y divide-white/[0.06] rounded-2xl">
                    {items.data.map((item) => (
                        <li
                            key={item.id}
                            className="flex flex-wrap items-center gap-3 p-4"
                        >
                            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-500/15 text-rose-300">
                                <Unlink className="size-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-white">
                                    {item.label ?? '—'}
                                    <span className="ml-2 text-xs font-medium text-white/45">
                                        {tr(
                                            sources[item.source] ?? item.source,
                                        )}{' '}
                                        · {field(item.field)}
                                    </span>
                                </p>
                                <p className="truncate font-mono text-xs text-white/50">
                                    {item.url}
                                </p>
                                <p className="mt-0.5 text-xs text-rose-300">
                                    {item.error ??
                                        (item.status
                                            ? `HTTP ${item.status}`
                                            : '')}
                                    {item.failing_since && (
                                        <span className="text-white/40">
                                            {' · '}
                                            {tr('не працює з {time}', {
                                                time: timeAgo(
                                                    item.failing_since,
                                                ),
                                            })}
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                                <button
                                    type="button"
                                    onClick={() => act(item, 'recheck')}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-sm font-medium text-white/80 hover:text-white"
                                >
                                    <RotateCw className="size-4" />
                                    {tr('Перевірити')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        act(
                                            item,
                                            'ignore',
                                            filters.tab !== 'ignored',
                                        )
                                    }
                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-sm font-medium text-white/80 hover:text-white"
                                >
                                    <EyeOff className="size-4" />
                                    {filters.tab === 'ignored'
                                        ? tr('Повернути')
                                        : tr('Ігнорувати')}
                                </button>
                                {item.edit_url && (
                                    <Link
                                        href={item.edit_url}
                                        className="inline-flex h-9 items-center rounded-xl bg-sky-500 px-3 text-sm font-semibold text-white"
                                    >
                                        {tr('Виправити')}
                                    </Link>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <Pagination data={items} />
        </>
    );
}
