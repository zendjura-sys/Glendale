import { Head, Link, router } from '@inertiajs/react';
import { Ban, Crown, FileText, Search, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FamilyLogo } from '@/components/families/family-logo';
import { VoiceTemplates } from '@/components/families/voice-templates';
import type { VoiceTemplate } from '@/components/families/voice-templates';
import { PageHeader, Pagination, Pill, StatCard } from '@/components/gc/admin';
import { timeAgo } from '@/lib/format';
import { uah } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { FamilyCard, Paginated, UserCard } from '@/types';
import { tr } from '@/lib/i18n';

type Status = FamilyCard['status'];

type AdminFamily = FamilyCard & {
    description: string | null;
    status_reason: string | null;
    owner: UserCard | null;
    leader: string | null;
    treasury: number;
    reports_week: number;
    created_at: string;
    verified_at: string | null;
};

type Props = {
    families: Paginated<AdminFamily>;
    filters: { status: Status; q: string };
    counts: Record<Status, number>;
    stats: { members: number; reports_week: number };
    statuses: Record<Status, string>;
    voice_templates: VoiceTemplate[];
};

export default function AdminFamilies({
    families,
    filters,
    counts,
    stats,
    statuses,
    voice_templates,
}: Props) {
    const [q, setQ] = useState(filters.q);

    const visit = (patch: Partial<Props['filters']>) =>
        router.get(
            '/admin/families',
            { ...filters, q, ...patch },
            { preserveState: true, preserveScroll: true, replace: true },
        );

    useEffect(() => {
        if (q === filters.q) return;
        const timer = setTimeout(() => visit({ q }), 300);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    const setStatus = (f: AdminFamily, status: Status) => {
        let reason: string | null = null;
        if (status === 'suspended') {
            reason = prompt(
                tr('Причина призупинення [{tag}] {name}', {
                    tag: f.tag,
                    name: f.name,
                }),
            );
            if (!reason) return;
        }
        router.patch(
            `/admin/families/${f.id}`,
            { status, reason },
            { preserveScroll: true },
        );
    };

    return (
        <>
            <Head title={tr('Сім’ї — Адмін-панель')} />
            <PageHeader
                title={tr('Сім’ї GTA RP')}
                description={tr(
                    'Верифікація нових сімей і контроль порушників',
                )}
            />

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard
                    label={tr('Очікують верифікації')}
                    value={counts.pending_verification}
                    icon={Crown}
                    tone="from-[#f59e0b] to-[#ef4444]"
                />
                <StatCard
                    label={tr('Учасників у сім’ях')}
                    value={stats.members}
                    icon={Users}
                    delay={60}
                />
                <StatCard
                    label={tr('Звітів за тиждень')}
                    value={stats.reports_week}
                    icon={FileText}
                    tone="from-gc-mint to-gc-cyan"
                    delay={120}
                />
            </div>

            <VoiceTemplates templates={voice_templates} />

            <div className="glass mb-4 flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
                <div className="scrollbar-none flex max-w-full overflow-x-auto rounded-xl bg-white/[0.04] p-1 text-sm">
                    {(Object.keys(statuses) as Status[]).map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => visit({ status: s })}
                            className={cn(
                                'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium whitespace-nowrap transition',
                                filters.status === s
                                    ? 'bg-gradient-brand text-white'
                                    : 'text-white/55 hover:text-white',
                            )}
                        >
                            {statuses[s]}
                            <span className="rounded-full bg-white/10 px-1.5 text-[11px] leading-5">
                                {counts[s]}
                            </span>
                        </button>
                    ))}
                </div>
                <label className="input-glass flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-xl px-3">
                    <Search className="size-4 text-white/35" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={tr('Назва або тег')}
                        className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                </label>
            </div>

            <div className="grid gap-3">
                {families.data.map((f) => (
                    <article
                        key={f.id}
                        className="glass flex flex-wrap items-center gap-4 rounded-2xl p-4"
                    >
                        <FamilyLogo family={f} />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <Link
                                    href={`/f/${f.slug}`}
                                    className="font-semibold text-white hover:underline"
                                >
                                    <span className="text-amber-300">
                                        [{f.tag}]
                                    </span>{' '}
                                    {f.name}
                                </Link>
                                {f.server && <Pill>{f.server.name}</Pill>}
                                <Pill
                                    tone={
                                        f.status === 'verified'
                                            ? 'green'
                                            : f.status === 'suspended'
                                              ? 'red'
                                              : 'gold'
                                    }
                                >
                                    {f.status_label}
                                </Pill>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/45">
                                {f.leader && (
                                    <span className="font-mono">
                                        {tr('Лідер:')} {f.leader}
                                    </span>
                                )}
                                {f.owner && (
                                    <Link
                                        href={`/${f.owner.username}`}
                                        className="hover:underline"
                                    >
                                        @{f.owner.username}
                                    </Link>
                                )}
                                <span>
                                    {f.members_count} {tr('учасн.')}
                                </span>
                                <span>
                                    {tr('скарбниця')} {uah(f.treasury)}
                                </span>
                                <span>
                                    {tr('звітів за тиждень:')} {f.reports_week}
                                </span>
                                <span>
                                    {tr('створено')} {timeAgo(f.created_at)}
                                </span>
                            </div>
                            {f.description && (
                                <p className="mt-1.5 line-clamp-2 text-xs text-white/55">
                                    {f.description}
                                </p>
                            )}
                            {f.status_reason && (
                                <p className="mt-1 text-xs text-rose-200/80">
                                    {tr('Причина:')} {f.status_reason}
                                </p>
                            )}
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                            {f.status !== 'verified' && (
                                <button
                                    type="button"
                                    onClick={() => setStatus(f, 'verified')}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-400/15 px-3 text-sm font-medium text-emerald-200 hover:bg-emerald-400/25"
                                >
                                    <ShieldCheck className="size-4" />
                                    {f.status === 'suspended'
                                        ? tr('Відновити')
                                        : tr('Верифікувати')}
                                </button>
                            )}
                            {f.status !== 'suspended' && (
                                <button
                                    type="button"
                                    onClick={() => setStatus(f, 'suspended')}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-rose-300 hover:bg-rose-500/10"
                                >
                                    <Ban className="size-4" />{' '}
                                    {tr('Призупинити')}
                                </button>
                            )}
                        </div>
                    </article>
                ))}
                {families.data.length === 0 && (
                    <div className="glass rounded-3xl px-6 py-14 text-center text-sm text-white/40">
                        {tr('Сімей у цьому статусі немає')}
                    </div>
                )}
            </div>
            <Pagination data={families} />
        </>
    );
}
