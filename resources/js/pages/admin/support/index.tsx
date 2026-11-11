import { Head, Link, router } from '@inertiajs/react';
import { ChevronRight, Search } from 'lucide-react';
import { useState } from 'react';
import { PageHeader, Pagination, selectClass } from '@/components/gc/admin';
import { UserAvatar } from '@/components/gc/user-avatar';
import { StatusPill } from '@/components/support/support-ui';
import type { TicketCard } from '@/components/support/support-ui';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { Paginated } from '@/types';

const PRIORITY: Record<
    TicketCard['priority'],
    { label: () => string; className: string }
> = {
    urgent: { label: () => tr('Терміново'), className: 'text-red-400' },
    high: { label: () => tr('Високий'), className: 'text-amber-200' },
    normal: { label: () => tr('Звичайний'), className: 'text-white/50' },
    low: { label: () => tr('Низький'), className: 'text-white/35' },
};

type AdminTicket = TicketCard & {
    excerpt: { body: string; from_staff: boolean } | null;
};

/** Картка обраного звернення праворуч (лише на широкому екрані): хто, про що, останнє повідомлення. */
function TicketPreview({ ticket }: { ticket: AdminTicket }) {
    return (
        <aside className="gc-solid sticky top-20 hidden flex-col gap-5 rounded-2xl p-5 xl:flex">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs text-white/45 tabular-nums">
                        #{ticket.id} · {tr(ticket.category_label)}
                    </p>
                    <h2 className="mt-1 font-display text-lg font-bold break-words text-white">
                        {ticket.subject}
                    </h2>
                </div>
                <StatusPill status={ticket.status} staff />
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                    <dt className="text-xs text-white/45">{tr('Пріоритет')}</dt>
                    <dd className={PRIORITY[ticket.priority].className}>
                        {PRIORITY[ticket.priority].label()}
                    </dd>
                </div>
                <div>
                    <dt className="text-xs text-white/45">{tr('Оновлено')}</dt>
                    <dd className="text-white/80">
                        {formatDate(ticket.updated_at)}
                    </dd>
                </div>
            </dl>
            {ticket.excerpt && (
                <div className="gc-solid-2 rounded-xl p-3.5">
                    <p className="text-xs text-white/45">
                        {ticket.excerpt.from_staff
                            ? tr('Остання відповідь команди')
                            : tr('Останнє повідомлення')}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-white/80">
                        {ticket.excerpt.body}
                    </p>
                </div>
            )}
            {ticket.user && (
                <div className="gc-solid-2 flex items-center gap-3 rounded-xl p-3">
                    <UserAvatar
                        user={ticket.user}
                        size="sm"
                        showOnline={false}
                    />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">
                            {ticket.user.name}
                        </p>
                        <p className="truncate text-xs text-white/45">
                            @{ticket.user.username}
                        </p>
                    </div>
                    {ticket.assignee ? (
                        <span className="text-right text-xs text-white/45">
                            {tr('Веде')}
                            <br />
                            <span className="text-white/75">
                                {ticket.assignee.name}
                            </span>
                        </span>
                    ) : (
                        <span className="text-xs text-amber-200">
                            {tr('Без відповідального')}
                        </span>
                    )}
                </div>
            )}
            <Link
                href={`/admin/support/${ticket.id}`}
                className="btn-glow inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
            >
                {tr('Відкрити звернення')}
                <ChevronRight className="size-4" />
            </Link>
        </aside>
    );
}

/** Адмінка → «Підтримка»: черга звернень; на широкому екрані — список і картка обраного поруч. */
export default function AdminSupport({
    tickets,
    filters,
    categories,
    stats,
}: {
    tickets: Paginated<AdminTicket>;
    filters: { status: string; category: string; mine: boolean; q: string };
    categories: Record<string, string>;
    stats: {
        open: number;
        unassigned: number;
        answered: number;
        first_response_minutes: number | null;
        rating: number;
    };
}) {
    const [q, setQ] = useState(filters.q);
    const [selected, setSelected] = useState<number | null>(null);
    const current =
        tickets.data.find((t) => t.id === selected) ?? tickets.data[0] ?? null;
    const apply = (patch: Partial<typeof filters>) =>
        router.get(
            '/admin/support',
            {
                ...filters,
                q,
                ...patch,
                mine: (patch.mine ?? filters.mine) ? 1 : undefined,
            },
            { preserveState: true, replace: true },
        );
    const response =
        stats.first_response_minutes === null
            ? '—'
            : stats.first_response_minutes < 60
              ? tr('{n} хв', { n: stats.first_response_minutes })
              : tr('{n} год', {
                    n: Math.round(stats.first_response_minutes / 60),
                });

    return (
        <>
            <Head title={tr('Підтримка — Адмін-панель')} />
            <PageHeader
                title={tr('Підтримка')}
                description={tr(
                    'Звернення людей: спершу ті, що чекають на нас.',
                )}
            />
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                {[
                    [tr('Чекають на нас'), String(stats.open)],
                    [tr('Без відповідального'), String(stats.unassigned)],
                    [tr('Чекають людину'), String(stats.answered)],
                    [tr('Перша відповідь'), response],
                    [
                        tr('Оцінка (90 днів)'),
                        stats.rating ? `${stats.rating} ★` : '—',
                    ],
                ].map(([label, value]) => (
                    <div key={label} className="gc-solid rounded-2xl p-4">
                        <p className="text-xs text-white/45">{label}</p>
                        <p className="mt-1 font-display text-xl font-semibold text-white tabular-nums">
                            {value}
                        </p>
                    </div>
                ))}
            </div>
            <div className="gc-solid mb-4 flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        apply({ q });
                    }}
                    className="relative min-w-[220px] flex-1"
                >
                    <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/30" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={tr('Номер, тема, логін або email')}
                        className="input-glass h-10 w-full rounded-xl pr-3 pl-10 text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                </form>
                <select
                    value={filters.status}
                    onChange={(e) => apply({ status: e.target.value })}
                    className={selectClass}
                >
                    <option value="active">{tr('Відкриті')}</option>
                    <option value="open">{tr('Чекають на нас')}</option>
                    <option value="answered">{tr('Чекають людину')}</option>
                    <option value="closed">{tr('Закриті')}</option>
                </select>
                <select
                    value={filters.category}
                    onChange={(e) => apply({ category: e.target.value })}
                    className={selectClass}
                >
                    <option value="">{tr('Усі теми')}</option>
                    {Object.entries(categories).map(([k, v]) => (
                        <option key={k} value={k}>
                            {tr(v)}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={() => apply({ mine: !filters.mine })}
                    className={cn(
                        'h-10 rounded-xl px-3.5 text-sm',
                        filters.mine
                            ? 'bg-gc-indigo text-white'
                            : 'gc-solid-2 text-white/70',
                    )}
                >
                    {tr('Мої')}
                </button>
            </div>
            <div className="grid items-start gap-4 xl:grid-cols-[1.5fr_1fr]">
                <div className="gc-solid overflow-hidden rounded-2xl">
                    {tickets.data.length === 0 ? (
                        <p className="px-5 py-10 text-center text-sm text-white/45">
                            {tr('Черга порожня.')}
                        </p>
                    ) : (
                        <ul className="divide-y divide-white/[0.05]">
                            {tickets.data.map((t) => (
                                <li key={t.id}>
                                    <Link
                                        href={`/admin/support/${t.id}`}
                                        onClick={(e) => {
                                            // На широкому екрані рядок лише обирає звернення — подробиці праворуч.
                                            if (
                                                window.matchMedia(
                                                    '(min-width: 1280px)',
                                                ).matches
                                            ) {
                                                e.preventDefault();
                                                setSelected(t.id);
                                            }
                                        }}
                                        className={cn(
                                            'flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--gc-l3)]',
                                            current?.id === t.id &&
                                                'xl:bg-[var(--gc-l3)] xl:shadow-[inset_3px_0_0_0_var(--color-sky-400)]',
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'size-2 shrink-0 rounded-full',
                                                t.unread
                                                    ? 'bg-gc-indigo'
                                                    : 'bg-transparent',
                                            )}
                                        />
                                        {t.user && (
                                            <UserAvatar
                                                user={t.user}
                                                size="sm"
                                                showOnline={false}
                                            />
                                        )}
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-white">
                                                #{t.id} · {t.subject}
                                            </span>
                                            <span className="block truncate text-xs text-white/45">
                                                {t.user?.name} ·{' '}
                                                {tr(t.category_label)} ·{' '}
                                                {formatDate(t.updated_at)}
                                            </span>
                                        </span>
                                        <span
                                            className={cn(
                                                'hidden text-xs sm:inline',
                                                PRIORITY[t.priority].className,
                                            )}
                                        >
                                            {PRIORITY[t.priority].label()}
                                        </span>
                                        {t.assignee ? (
                                            <UserAvatar
                                                user={t.assignee}
                                                size="xs"
                                                showOnline={false}
                                                className="hidden sm:inline-flex"
                                            />
                                        ) : (
                                            <span className="hidden w-7 sm:inline" />
                                        )}
                                        <StatusPill status={t.status} staff />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                {current && <TicketPreview ticket={current} />}
            </div>
            <Pagination data={tickets} />
        </>
    );
}
