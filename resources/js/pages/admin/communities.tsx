import { Head, Link, router } from '@inertiajs/react';
import {
    BadgeCheck,
    FileText,
    Lock,
    RotateCcw,
    Search,
    Shield,
    Trash2,
    UsersRound,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import {
    PageHeader,
    Pagination,
    Pill,
    StatCard,
    Toggle,
    selectClass,
} from '@/components/gc/admin';
import { CommunityAvatar } from '@/components/gc/community-avatar';
import { Input } from '@/components/ui/input';
import { compactNumber, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CommunityCard, Paginated, UserCard } from '@/types';
import { tr } from '@/lib/i18n';

type AdminCommunity = CommunityCard & {
    owner: UserCard | null;
    posts_count: number;
    created_at: string;
    deleted_at: string | null;
};

type Props = {
    communities: Paginated<AdminCommunity>;
    filters: { q: string; type: string; trashed: boolean };
    stats: { total: number; verified: number; members: number };
};

export default function AdminCommunities({
    communities,
    filters,
    stats,
}: Props) {
    const [q, setQ] = useState(filters.q);

    const apply = (patch: Partial<Props['filters']>) => {
        const next = { ...filters, q, ...patch };
        router.get(
            '/admin/communities',
            { ...next, trashed: next.trashed ? 1 : undefined },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        apply({ q });
    };

    const remove = (c: AdminCommunity) => {
        if (
            c.deleted_at &&
            !confirm(
                tr('Видалити «{name}» назавжди разом із записами?', {
                    name: c.name,
                }),
            )
        ) {
            return;
        }

        router.delete(`/admin/communities/${c.id}`, { preserveScroll: true });
    };

    const verify = (c: AdminCommunity, value: boolean) =>
        router.patch(
            `/admin/communities/${c.id}`,
            { is_verified: value },
            { preserveScroll: true },
        );

    return (
        <>
            <Head title={tr('Спільноти — Адмін-панель')} />
            <PageHeader
                title={tr('Спільноти')}
                description={
                    filters.trashed
                        ? tr('У кошику: {total}', { total: communities.total })
                        : tr('Групи та публічні сторінки мережі')
                }
                actions={
                    <div className="glass flex rounded-xl p-1 text-sm">
                        {[
                            { label: tr('Активні'), value: false },
                            { label: tr('Кошик'), value: true },
                        ].map((tab) => (
                            <button
                                key={tab.label}
                                type="button"
                                onClick={() => apply({ trashed: tab.value })}
                                className={cn(
                                    'rounded-lg px-3.5 py-1.5 font-medium transition',
                                    filters.trashed === tab.value
                                        ? 'bg-gradient-brand text-white'
                                        : 'text-white/55 hover:text-white',
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                }
            />

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard
                    label={tr('Усього спільнот')}
                    value={compactNumber(stats.total)}
                    icon={Shield}
                />
                <StatCard
                    label={tr('Верифіковані')}
                    value={compactNumber(stats.verified)}
                    icon={BadgeCheck}
                    tone="from-gc-mint to-gc-cyan"
                    delay={60}
                />
                <StatCard
                    label={tr('Учасників сумарно')}
                    value={compactNumber(stats.members)}
                    icon={UsersRound}
                    tone="from-gc-pink to-gc-purple"
                    delay={120}
                />
            </div>

            <div className="glass mb-4 flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
                <form
                    onSubmit={submit}
                    className="relative min-w-[220px] flex-1"
                >
                    <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/30" />
                    <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={tr('Назва або адреса спільноти')}
                        className="h-10 pl-10"
                    />
                </form>
                <select
                    value={filters.type}
                    onChange={(e) => apply({ type: e.target.value })}
                    className={selectClass}
                >
                    <option value="">{tr('Усі типи')}</option>
                    <option value="group">{tr('Групи')}</option>
                    <option value="public">{tr('Публічні сторінки')}</option>
                </select>
            </div>

            <div className="grid gap-3">
                {communities.data.map((c) => (
                    <article
                        key={c.id}
                        className={cn(
                            'glass flex items-center gap-4 rounded-2xl p-4',
                            c.deleted_at && 'opacity-70',
                        )}
                    >
                        <CommunityAvatar community={c} size="md" />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                {c.deleted_at ? (
                                    <span className="font-semibold text-white">
                                        {c.name}
                                    </span>
                                ) : (
                                    <Link
                                        href={`/c/${c.slug}`}
                                        className="font-semibold text-white hover:underline"
                                    >
                                        {c.name}
                                    </Link>
                                )}
                                {c.is_verified && (
                                    <BadgeCheck className="size-4 text-[#7fb0ff]" />
                                )}
                                <Pill
                                    tone={
                                        c.type === 'group' ? 'blue' : 'violet'
                                    }
                                >
                                    {c.type === 'group'
                                        ? tr('Група')
                                        : tr('Публічна сторінка')}
                                </Pill>
                                {c.privacy === 'closed' && (
                                    <Pill tone="gold">
                                        <Lock className="size-3" />{' '}
                                        {tr('Закрита')}
                                    </Pill>
                                )}
                                {c.deleted_at && (
                                    <Pill tone="red">{tr('У кошику')}</Pill>
                                )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/45">
                                <span>/c/{c.slug}</span>
                                {c.category_label && (
                                    <span>{c.category_label}</span>
                                )}
                                <span className="flex items-center gap-1">
                                    <UsersRound className="size-3.5" />
                                    {compactNumber(c.members_count)}
                                </span>
                                <span className="flex items-center gap-1">
                                    <FileText className="size-3.5" />
                                    {c.posts_count}
                                </span>
                                {c.owner && (
                                    <span>
                                        {tr('Власник:')}{' '}
                                        <Link
                                            href={`/${c.owner.username}`}
                                            className="text-white/70 hover:underline"
                                        >
                                            {c.owner.name}
                                        </Link>
                                    </span>
                                )}
                                <span>
                                    {tr('створено')} {timeAgo(c.created_at)}
                                </span>
                            </div>
                        </div>
                        {!c.deleted_at && (
                            <label className="hidden items-center gap-2 text-xs text-white/50 sm:flex">
                                {tr('Верифікація')}
                                <Toggle
                                    checked={c.is_verified}
                                    onChange={(v) => verify(c, v)}
                                    label={tr('Верифікація')}
                                />
                            </label>
                        )}
                        <div className="flex shrink-0 gap-1.5">
                            {c.deleted_at && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.post(
                                            `/admin/communities/${c.id}/restore`,
                                            {},
                                            { preserveScroll: true },
                                        )
                                    }
                                    className="flex size-9 items-center justify-center rounded-xl text-emerald-300 transition hover:bg-emerald-400/10"
                                    title={tr('Відновити')}
                                >
                                    <RotateCcw className="size-4" />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => remove(c)}
                                className="flex size-9 items-center justify-center rounded-xl text-rose-300 transition hover:bg-rose-500/10"
                                title={
                                    c.deleted_at
                                        ? tr('Видалити назавжди')
                                        : tr('У кошик')
                                }
                            >
                                <Trash2 className="size-4" />
                            </button>
                        </div>
                    </article>
                ))}
                {communities.data.length === 0 && (
                    <div className="glass rounded-3xl px-6 py-14 text-center text-sm text-white/40">
                        {tr('Спільнот не знайдено')}
                    </div>
                )}
            </div>

            <Pagination data={communities} />
        </>
    );
}
