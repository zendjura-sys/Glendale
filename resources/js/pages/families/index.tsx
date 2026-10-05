import { Head, Link, router } from '@inertiajs/react';
import { Clock3, Crown, Plus, Search, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Pagination, selectClass } from '@/components/gc/admin';
import { EmptyState } from '@/components/gc/widget';
import { FamilyLogo } from '@/components/families/family-logo';
import { RankBadge } from '@/components/families/ui';
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

type Props = {
    mine: Mine[];
    families: Paginated<FamilyCard>;
    filters: { server: string | null; q: string };
    servers: ServerOption[];
};

export default function Families({ mine, families, filters, servers }: Props) {
    const [q, setQ] = useState(filters.q);

    const visit = (patch: Partial<Props['filters']>) => {
        const next = { ...filters, q, ...patch };
        router.get(
            '/families',
            { server: next.server || undefined, q: next.q || undefined },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    useEffect(() => {
        if (q === filters.q) return;
        const timer = setTimeout(() => visit({ q }), 300);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    return (
        <>
            <Head title={tr('Сім’ї GTA RP')} />
            <div className="space-y-5">
                <section className="glass noise relative overflow-hidden rounded-3xl p-5 sm:p-7">
                    <div className="pointer-events-none absolute -top-24 -right-10 size-96 rounded-full bg-amber-400/20 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-40 left-10 size-96 rounded-full bg-gc-indigo/25 blur-3xl" />
                    <div className="relative flex flex-wrap items-end justify-between gap-5">
                        <div className="max-w-xl">
                            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-semibold tracking-wider text-amber-200 uppercase">
                                <Crown className="size-3.5" /> Family ERP
                            </span>
                            <h1 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">
                                {tr('Сім’ї')}{' '}
                                <span className="text-gradient">GTA RP</span>
                            </h1>
                            <p className="mt-2 text-sm leading-relaxed text-white/55">
                                {tr(
                                    'Звіти про бізвари й контракти, автоматичні виплати, депозити, склад з квотами, дисципліна й рейтинг — без таблиць і ручних підрахунків.',
                                )}
                            </p>
                        </div>
                        <Link
                            href="/families/create"
                            className="btn-glow inline-flex h-12 items-center gap-2 rounded-2xl px-6 text-sm font-semibold"
                        >
                            <Plus className="size-4" /> {tr('Створити сім’ю')}
                        </Link>
                    </div>
                </section>

                {mine.length > 0 && (
                    <section>
                        <h2 className="mb-3 font-display text-lg font-semibold text-white">
                            {tr('Мої сім’ї')}
                        </h2>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {mine.map((f) => (
                                <Link
                                    key={f.id}
                                    href={`/f/${f.slug}`}
                                    className="glass group flex items-center gap-4 rounded-3xl p-4 transition hover:bg-white/[0.06]"
                                >
                                    <FamilyLogo family={f} size="lg" />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate font-semibold text-white">
                                            <span className="text-amber-300">
                                                [{f.tag}]
                                            </span>{' '}
                                            {f.name}
                                        </div>
                                        <div className="truncate font-mono text-xs text-white/50">
                                            {f.membership.display}
                                        </div>
                                        <div className="mt-1.5 flex items-center gap-2">
                                            {f.membership.status ===
                                            'pending' ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/10 px-2 py-0.5 text-xs text-amber-200">
                                                    <Clock3 className="size-3" />{' '}
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
                                                    <span className="text-xs font-semibold text-emerald-300">
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

                <section>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <h2 className="mr-auto font-display text-lg font-semibold text-white">
                            {tr('Каталог сімей')}
                        </h2>
                        <label className="input-glass flex h-10 min-w-[200px] items-center gap-2 rounded-xl px-3">
                            <Search className="size-4 text-white/35" />
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder={tr('Назва або тег')}
                                className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                            />
                        </label>
                        <select
                            value={filters.server ?? ''}
                            onChange={(e) =>
                                visit({ server: e.target.value || null })
                            }
                            className={selectClass}
                        >
                            <option value="">{tr('Усі сервери')}</option>
                            {servers.map((s) => (
                                <option key={s.id} value={s.slug}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {families.data.length === 0 ? (
                        <EmptyState
                            icon={Crown}
                            title={tr('Сімей поки немає')}
                            text={tr(
                                'Створіть першу сім’ю на своєму сервері — після верифікації вона з’явиться тут.',
                            )}
                        />
                    ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {families.data.map((f, i) => (
                                <Link
                                    key={f.id}
                                    href={`/f/${f.slug}`}
                                    className="glass group relative animate-rise overflow-hidden rounded-3xl transition hover:-translate-y-0.5"
                                    style={{ animationDelay: `${i * 30}ms` }}
                                >
                                    <div className="h-20 overflow-hidden">
                                        {f.cover_url ? (
                                            <img
                                                src={f.cover_url}
                                                alt=""
                                                className="size-full object-cover opacity-80 transition group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="size-full bg-[linear-gradient(135deg,#f59e0b33,#6d5dfc44)]" />
                                        )}
                                    </div>
                                    <div className="-mt-8 flex items-end gap-3 px-4">
                                        <FamilyLogo
                                            family={f}
                                            size="lg"
                                            className="ring-4 ring-[#0d1120]"
                                        />
                                        <div className="min-w-0 pb-1">
                                            <div className="flex items-center gap-1.5 truncate font-semibold text-white">
                                                <span className="text-amber-300">
                                                    [{f.tag}]
                                                </span>
                                                <span className="truncate">
                                                    {f.name}
                                                </span>
                                                <ShieldCheck className="size-4 shrink-0 text-emerald-300" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="px-4 pt-2 pb-4">
                                        {f.description && (
                                            <p className="line-clamp-2 text-xs text-white/50">
                                                {f.description}
                                            </p>
                                        )}
                                        <div className="mt-3 flex items-center gap-3 text-xs text-white/50">
                                            {f.server && (
                                                <span className="flex min-w-0 items-center gap-1.5">
                                                    <ServerIcon
                                                        name={f.server.name}
                                                        icon={f.server.icon}
                                                        className="size-5 rounded-md text-[8px]"
                                                    />
                                                    <span className="truncate">
                                                        {f.server.name}
                                                    </span>
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Users className="size-3.5" />
                                                {f.members_count}
                                            </span>
                                            <span
                                                className={cn(
                                                    'ml-auto rounded-full px-2 py-0.5 text-xs font-medium',
                                                    f.is_recruiting
                                                        ? 'bg-emerald-400/10 text-emerald-200'
                                                        : 'bg-white/[0.05] text-white/40',
                                                )}
                                            >
                                                {f.is_recruiting
                                                    ? tr('Набір відкрито')
                                                    : tr('Набір закрито')}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                    <Pagination data={families} />
                </section>
            </div>
        </>
    );
}
