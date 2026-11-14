import { Head, Link, router } from '@inertiajs/react';
import { Search, Shield, Swords, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader, Pagination, StatCard } from '@/components/gc/admin';
import { UserAvatar } from '@/components/gc/user-avatar';
import { timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ClanCard, Paginated, UserCard } from '@/types';

type AdminClan = ClanCard & {
    description: string | null;
    owner: UserCard | null;
    created_at: string;
};

type Props = {
    clans: Paginated<AdminClan>;
    filters: { type: string | null; q: string; sort: 'members' | 'new' };
    types: Record<string, string>;
    stats: { clans: number; guilds: number; members: number };
};

/** Адмінка → Клани: пошук, власник, учасники й видалення (із причиною, у журнал). */
export default function AdminClans({ clans, filters, types, stats }: Props) {
    const [q, setQ] = useState(filters.q);
    const visit = (patch: Partial<Props['filters']>) =>
        router.get(
            '/admin/clans',
            { ...filters, q, ...patch },
            { preserveState: true, preserveScroll: true, replace: true },
        );

    useEffect(() => {
        if (q === filters.q) return;
        const timer = setTimeout(() => visit({ q }), 300);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    const remove = (c: AdminClan) => {
        const reason = prompt(
            tr('Видалити «{name}»? Вкажіть причину (піде в журнал).', {
                name: c.name,
            }),
        );
        if (reason === null) return;
        router.delete(`/admin/clans/${c.id}`, {
            data: { reason },
            preserveScroll: true,
        });
    };

    return (
        <>
            <Head title={tr('Клани — Адмін-панель')} />
            <PageHeader
                title={tr('Клани й гільдії')}
                description={tr(
                    'Пошук, власники й видалення кланів, що порушують правила.',
                )}
            />

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard
                    label={tr('Кланів')}
                    value={stats.clans}
                    icon={Swords}
                />
                <StatCard
                    label={tr('Гільдій')}
                    value={stats.guilds}
                    icon={Shield}
                    delay={60}
                />
                <StatCard
                    label={tr('Учасників')}
                    value={stats.members}
                    icon={Users}
                    delay={120}
                />
            </div>

            <div className="gc-solid mb-4 flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
                <div className="gc-solid-2 flex rounded-xl p-1 text-sm">
                    {[[null, tr('Усі')] as const, ...Object.entries(types)].map(
                        ([key, label]) => (
                            <button
                                key={key ?? 'all'}
                                type="button"
                                onClick={() => visit({ type: key })}
                                className={cn(
                                    'rounded-lg px-3 py-1.5 font-medium transition',
                                    filters.type === key
                                        ? 'bg-sky-500 text-white'
                                        : 'text-white/55 hover:text-white',
                                )}
                            >
                                {tr(label)}
                            </button>
                        ),
                    )}
                </div>
                <div className="gc-solid-2 flex rounded-xl p-1 text-sm">
                    {(
                        [
                            ['members', 'Більші'],
                            ['new', 'Нові'],
                        ] as const
                    ).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => visit({ sort: key })}
                            className={cn(
                                'rounded-lg px-3 py-1.5 font-medium transition',
                                filters.sort === key
                                    ? 'bg-white/[0.12] text-white'
                                    : 'text-white/55 hover:text-white',
                            )}
                        >
                            {tr(label)}
                        </button>
                    ))}
                </div>
                <label className="relative ml-auto min-w-[12rem] flex-1 sm:max-w-xs">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={tr('Назва, тег або адреса')}
                        className="input-glass h-10 w-full rounded-xl pr-3 pl-9 text-sm text-white"
                    />
                </label>
            </div>

            {clans.data.length === 0 ? (
                <p className="text-sm text-white/45">
                    {tr('Нічого не знайдено.')}
                </p>
            ) : (
                <ul className="space-y-2">
                    {clans.data.map((c) => (
                        <li
                            key={c.id}
                            className="gc-solid flex flex-wrap items-center gap-3 rounded-2xl p-3"
                        >
                            <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/[0.06]">
                                {c.logo_url ? (
                                    <img
                                        src={c.logo_url}
                                        alt=""
                                        className="size-full object-cover"
                                    />
                                ) : (
                                    <Swords className="size-5 text-amber-400" />
                                )}
                            </span>
                            <div className="min-w-0 flex-1">
                                <Link
                                    href={`/clans/${c.slug}`}
                                    className="font-semibold text-white hover:underline"
                                >
                                    {c.tag && (
                                        <span className="text-white/50">
                                            [{c.tag}]{' '}
                                        </span>
                                    )}
                                    {c.name}
                                </Link>
                                <p className="text-xs text-white/50">
                                    {tr(c.type_label)} ·{' '}
                                    {tr('{n} учасників', {
                                        n: c.members_count,
                                    })}
                                    {c.game && ` · ${c.game.name}`} ·{' '}
                                    {timeAgo(c.created_at)}
                                </p>
                            </div>
                            {c.owner && (
                                <Link
                                    href={`/${c.owner.username}`}
                                    className="flex items-center gap-2 text-sm text-white/70 hover:text-white"
                                >
                                    <UserAvatar user={c.owner} size="xs" />
                                    {c.owner.name}
                                </Link>
                            )}
                            <button
                                type="button"
                                onClick={() => remove(c)}
                                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-red-500/15 px-3 text-sm text-red-400 hover:bg-red-500/25"
                            >
                                <Trash2 className="size-4" />
                                {tr('Видалити')}
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <Pagination data={clans} />
        </>
    );
}
