import { Deferred, Head, Link, router } from '@inertiajs/react';
import {
    Clock3,
    Crown,
    Plus,
    Search,
    ShieldCheck,
    Trophy,
    Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Pagination } from '@/components/gc/admin';
import { EmptyState, WidgetSkeleton } from '@/components/gc/widget';
import { FamilyLogo } from '@/components/families/family-logo';
import { RankBadge } from '@/components/families/ui';
import { PlusBadge } from '@/components/gc/plus';
import { ServerIcon } from '@/components/servers/server-icon';
import { uah } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { FamilyCard, Paginated, ServerOption } from '@/types';
import { tr } from '@/lib/i18n';

type Mine = FamilyCard & {
    membership: {
        status: 'active' | 'pending';
        display: string;
        rank: number;
        rank_title: string | null;
        balance: number | null;
    };
};

type Tab = 'all' | 'recruiting' | 'top';

type TopRow = FamilyCard & { score: number; place: number };

type Props = {
    mine: Mine[];
    families: Paginated<FamilyCard & { description?: string | null }>;
    filters: { server: string | null; q: string; tab: Tab };
    servers: ServerOption[];
    top?: TopRow[] | null;
    recruitingCount: number;
};

/**
 * Сім’ї: мої сім’ї зверху, далі каталог із вкладками «Усі», «Шукаємо» (відкритий набір)
 * і «Рейтинг сезону» (бали з підтверджених звітів за місяць серед усіх сімей).
 */
export default function Families({
    mine,
    families,
    filters,
    servers,
    top,
    recruitingCount,
}: Props) {
    const [q, setQ] = useState(filters.q);

    const visit = (patch: Partial<Props['filters']>) => {
        const next = { ...filters, q, ...patch };
        router.get(
            '/families',
            {
                server: next.server || undefined,
                q: next.q || undefined,
                tab: next.tab === 'all' ? undefined : next.tab,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    useEffect(() => {
        if (q === filters.q) return;
        const timer = setTimeout(() => visit({ q }), 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    const tabs: { key: Tab; label: string; count?: number }[] = [
        { key: 'all', label: tr('Усі') },
        { key: 'recruiting', label: tr('Шукаємо'), count: recruitingCount },
        { key: 'top', label: tr('Рейтинг сезону') },
    ];

    return (
        <>
            <Head title={tr('Сім’ї')} />
            <div className="gc-lobby-wide space-y-8">
                <header className="flex flex-wrap items-end justify-between gap-5 px-1 pt-3">
                    <div className="max-w-2xl">
                        <h1 className="gc-page-title">{tr('Сім’ї')}</h1>
                        <p className="mt-3 text-[15px] leading-relaxed text-[var(--gc-text-2)]">
                            {tr(
                                'Штаб для тих, хто тримається разом: звіти й виплати, склад, зміни, дисципліна й рейтинг — без таблиць і ручних підрахунків.',
                            )}
                        </p>
                    </div>
                    <Link
                        href="/families/create"
                        className="gc-primary-btn h-11 px-5"
                    >
                        <Plus className="size-4" /> {tr('Створити сім’ю')}
                    </Link>
                </header>

                {mine.length > 0 && (
                    <section
                        aria-labelledby="my-families"
                        className="space-y-3"
                    >
                        <h2 id="my-families" className="gc-lobby-label">
                            {tr('Мої сім’ї')}
                        </h2>
                        <div className="gc-family-grid">
                            {mine.map((f) => (
                                <Link
                                    key={f.id}
                                    href={`/f/${f.slug}`}
                                    className="gc-family-card flex items-center gap-4 p-4"
                                >
                                    <FamilyLogo family={f} size="lg" />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate font-semibold">
                                            <span className="text-[var(--gc-accent)]">
                                                [{f.tag}]
                                            </span>{' '}
                                            {f.name}
                                        </div>
                                        <div className="truncate text-xs text-[var(--gc-text-2)]">
                                            {f.membership.display}
                                        </div>
                                        <div className="mt-2 flex items-center gap-2">
                                            {f.membership.status ===
                                            'pending' ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/10 px-2 py-0.5 text-xs text-amber-400">
                                                    <Clock3 className="size-3" />
                                                    {tr('Заявка на розгляді')}
                                                </span>
                                            ) : (
                                                <>
                                                    <RankBadge
                                                        rank={f.membership.rank}
                                                        title={
                                                            f.membership
                                                                .rank_title
                                                        }
                                                    />
                                                    <span className="text-xs font-semibold text-[var(--gc-live)]">
                                                        {uah(
                                                            f.membership
                                                                .balance,
                                                        )}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                <section aria-label={tr('Каталог сімей')} className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div role="tablist" className="gc-segment">
                            {tabs.map((t) => (
                                <button
                                    key={t.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={filters.tab === t.key}
                                    onClick={() => visit({ tab: t.key })}
                                    className={cn(
                                        'gc-segment__item',
                                        filters.tab === t.key && 'is-active',
                                    )}
                                >
                                    {t.key === 'top' && (
                                        <Trophy className="size-4" />
                                    )}
                                    {t.label}
                                    {!!t.count && (
                                        <span className="gc-segment__count">
                                            {t.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                        <label className="gc-field ml-auto min-w-[200px] flex-1 sm:max-w-[320px]">
                            <Search className="size-4 text-[var(--gc-text-2)]" />
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder={tr('Назва або тег')}
                                aria-label={tr('Пошук сім’ї')}
                            />
                        </label>
                        <select
                            value={filters.server ?? ''}
                            onChange={(e) =>
                                visit({ server: e.target.value || null })
                            }
                            aria-label={tr('Сервер')}
                            className="gc-field gc-field--select"
                        >
                            <option value="">{tr('Усі сервери')}</option>
                            {servers.map((s) => (
                                <option key={s.id} value={s.slug}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {filters.tab === 'top' ? (
                        <Deferred
                            data="top"
                            fallback={<WidgetSkeleton rows={5} />}
                        >
                            <SeasonTop rows={top ?? []} />
                        </Deferred>
                    ) : families.data.length === 0 ? (
                        <EmptyState
                            icon={Crown}
                            title={
                                filters.tab === 'recruiting'
                                    ? tr('Зараз ніхто не шукає')
                                    : tr('Сімей поки немає')
                            }
                            text={
                                filters.tab === 'recruiting'
                                    ? tr(
                                          'Загляньте пізніше або створіть свою сім’ю.',
                                      )
                                    : tr(
                                          'Створіть першу сім’ю на своєму сервері — після верифікації вона з’явиться тут.',
                                      )
                            }
                        />
                    ) : (
                        <>
                            <div className="gc-family-grid">
                                {families.data.map((f) => (
                                    <FamilyTile key={f.id} family={f} />
                                ))}
                            </div>
                            <Pagination data={families} />
                        </>
                    )}
                </section>
            </div>
        </>
    );
}

function FamilyTile({
    family: f,
}: {
    family: FamilyCard & { description?: string | null };
}) {
    return (
        <Link
            href={`/f/${f.slug}`}
            className="gc-family-card group flex flex-col"
        >
            <div className="relative h-24 overflow-hidden rounded-t-[8px]">
                {f.cover_url ? (
                    <img
                        loading="lazy"
                        decoding="async"
                        src={f.cover_url}
                        alt=""
                        className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                ) : (
                    <div
                        className="size-full"
                        style={{
                            backgroundImage: f.plus?.accent
                                ? `linear-gradient(135deg, ${f.plus.accent.join(', ')})`
                                : 'linear-gradient(135deg, color-mix(in oklab, var(--gc-accent-strong) 35%, var(--gc-l2)), var(--gc-l2))',
                        }}
                    />
                )}
                {f.plus && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white">
                        <PlusBadge className="size-3.5 [&_svg]:size-2.5" />
                        GameCon+
                    </span>
                )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4 pt-0">
                <div className="-mt-7 flex items-end gap-3">
                    <FamilyLogo
                        family={f}
                        size="lg"
                        className="ring-4 ring-[var(--gc-l1)]"
                    />
                    <div className="flex min-w-0 items-center gap-1.5 pb-1 font-semibold">
                        <span className="text-[var(--gc-accent)]">
                            [{f.tag}]
                        </span>
                        <span className="truncate">{f.name}</span>
                        {f.status === 'verified' && (
                            <ShieldCheck
                                className="size-4 shrink-0 text-[var(--gc-live)]"
                                aria-label={tr('Перевірена')}
                            />
                        )}
                    </div>
                </div>
                {f.description && (
                    <p className="line-clamp-2 text-[13px] text-[var(--gc-text-2)]">
                        {f.description}
                    </p>
                )}
                <div className="mt-auto flex items-center gap-3 pt-1 text-xs text-[var(--gc-text-2)]">
                    {f.server && (
                        <span className="flex min-w-0 items-center gap-1.5">
                            <ServerIcon
                                name={f.server.name}
                                icon={f.server.icon}
                                className="size-4 rounded"
                            />
                            <span className="truncate">{f.server.name}</span>
                        </span>
                    )}
                    <span className="flex items-center gap-1">
                        <Users className="size-3.5" />
                        {f.members_count}
                    </span>
                    <span
                        className={cn(
                            'ml-auto shrink-0 rounded-full px-2 py-0.5 font-medium',
                            f.is_recruiting
                                ? 'bg-[color-mix(in_oklab,var(--gc-live)_14%,transparent)] text-[var(--gc-live)]'
                                : 'bg-[var(--gc-l2)]',
                        )}
                    >
                        {f.is_recruiting ? tr('Шукаємо') : tr('Набір закрито')}
                    </span>
                </div>
            </div>
        </Link>
    );
}

/** Рейтинг сезону: місце, сім’я, сервер і бали за місяць. */
function SeasonTop({ rows }: { rows: TopRow[] }) {
    if (rows.length === 0) {
        return (
            <EmptyState
                icon={Trophy}
                title={tr('Рейтинг ще порожній')}
                text={tr(
                    'Бали нараховуються за підтверджені звіти. Перші з’являться, щойно сім’ї почнуть звітувати цього місяця.',
                )}
            />
        );
    }

    return (
        <ol className="gc-top-list" aria-label={tr('Рейтинг сімей за місяць')}>
            {rows.map((row) => (
                <li key={row.id}>
                    <Link href={`/f/${row.slug}`} className="gc-top-row">
                        <span
                            className={cn(
                                'gc-top-place',
                                row.place <= 3 && `is-${row.place}`,
                            )}
                        >
                            {row.place}
                        </span>
                        <FamilyLogo family={row} size="md" />
                        <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">
                                <span className="text-[var(--gc-accent)]">
                                    [{row.tag}]
                                </span>{' '}
                                {row.name}
                            </span>
                            <span className="block truncate text-xs text-[var(--gc-text-2)]">
                                {row.server?.name ?? '—'} ·{' '}
                                {tr('{n} учасників', { n: row.members_count })}
                            </span>
                        </span>
                        <span className="text-right">
                            <span className="block font-semibold tabular-nums">
                                {row.score.toLocaleString('uk-UA')}
                            </span>
                            <span className="block text-xs text-[var(--gc-text-2)]">
                                {tr('балів')}
                            </span>
                        </span>
                    </Link>
                </li>
            ))}
        </ol>
    );
}
