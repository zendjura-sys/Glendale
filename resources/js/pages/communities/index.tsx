import { Head, InfiniteScroll, Link, router, usePage } from '@inertiajs/react';
import { GridSkeleton } from '@/components/gc/skeletons';
import {
    Compass,
    Crown,
    Flame,
    LogIn,
    Plus,
    Search,
    SearchX,
    Shield,
    Sparkles,
    TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    CommunityTile,
    membersLabel,
} from '@/components/communities/community-card';
import { CommunityAvatar } from '@/components/gc/community-avatar';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import { CreateCommunityDialog } from '@/components/communities/create-community-dialog';
import { EmptyState } from '@/components/gc/widget';
import { cn } from '@/lib/utils';
import type { CommunityListItem, ScrollData } from '@/types';
import { tr } from '@/lib/i18n';

type Tab = 'mine' | 'managed' | 'discover';
type Sort = 'popular' | 'active' | 'growing' | 'new';

type Section = {
    key: 'active' | 'growing' | 'new';
    title: string;
    items: CommunityListItem[];
};

const SECTION_ICONS: Record<Section['key'], LucideIcon> = {
    active: Flame,
    growing: TrendingUp,
    new: Sparkles,
};

type Props = {
    tab: Tab;
    filters: { q: string; category: string | null; sort: Sort };
    categories: Record<string, string>;
    counts: { mine: number; managed: number };
    sections: Section[];
    communities: ScrollData<CommunityListItem>;
};

export default function Communities({
    tab,
    filters,
    categories,
    counts,
    sections,
    communities,
}: Props) {
    const signedIn = Boolean(usePage().props.auth.user);
    const [q, setQ] = useState(filters.q);
    const [creating, setCreating] = useState(false);

    const visit = (
        patch: Partial<{
            tab: Tab;
            q: string;
            category: string | null;
            sort: Sort;
        }>,
    ) => {
        const next = {
            tab,
            q,
            category: filters.category,
            sort: filters.sort,
            ...patch,
        };
        router.get(
            '/communities',
            {
                tab: signedIn ? next.tab : undefined,
                q: next.q || undefined,
                category: next.category || undefined,
                sort:
                    next.tab === 'discover' && next.sort !== 'popular'
                        ? next.sort
                        : undefined,
            },
            { preserveState: true, replace: true },
        );
    };

    useEffect(() => {
        if (q === filters.q) return;
        const timer = setTimeout(() => visit({ q }), 300);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    const tabs: {
        value: Tab;
        label: string;
        icon: typeof Shield;
        count?: number;
    }[] = [
        {
            value: 'mine',
            label: tr('Мої спільноти'),
            icon: Shield,
            count: counts.mine,
        },
        {
            value: 'managed',
            label: tr('Керую'),
            icon: Crown,
            count: counts.managed,
        },
        { value: 'discover', label: tr('Огляд'), icon: Compass },
    ];
    const sorts: { value: Sort; label: string }[] = [
        { value: 'popular', label: tr('Популярні') },
        { value: 'active', label: tr('Активні') },
        { value: 'growing', label: tr('Ростуть') },
        { value: 'new', label: tr('Нові') },
    ];

    return (
        <>
            <Head title={tr('Спільноти')} />
            <div className="space-y-5">
                <section className="glass relative overflow-hidden rounded-2xl p-5 sm:p-6">
                    <div className="pointer-events-none absolute -top-28 -right-10 size-80 rounded-full bg-gc-purple/25 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-32 left-10 size-72 rounded-full bg-gc-blue/15 blur-3xl" />
                    <div className="relative flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1 className="font-display text-2xl font-bold text-white">
                                <span className="text-gradient">
                                    {tr('Спільноти')}
                                </span>{' '}
                                {tr('за інтересами')}
                            </h1>
                            <p className="mt-1 text-sm text-white/50">
                                {tr(
                                    'Клани, фандоми, команди та сторінки улюблених ігор — усе в одному місці.',
                                )}
                            </p>
                        </div>
                        {signedIn ? (
                            <button
                                type="button"
                                onClick={() => setCreating(true)}
                                className="btn-glow inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold"
                            >
                                <Plus className="size-4" />{' '}
                                {tr('Створити спільноту')}
                            </button>
                        ) : (
                            <Link
                                href="/register"
                                className="btn-glow inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold"
                            >
                                <LogIn className="size-4" />
                                {tr('Приєднатися до GameCon')}
                            </Link>
                        )}
                    </div>

                    <div className="relative mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
                        <div
                            className={cn(
                                'flex shrink-0 rounded-xl bg-white/[0.04] p-1',
                                !signedIn && 'hidden',
                            )}
                        >
                            {tabs.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => visit({ tab: item.value })}
                                    className={cn(
                                        'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition',
                                        tab === item.value
                                            ? 'bg-white/10 text-white'
                                            : 'text-white/50 hover:text-white',
                                    )}
                                >
                                    <item.icon className="size-4" />
                                    {item.label}
                                    {!!item.count && (
                                        <span className="rounded-full bg-white/10 px-1.5 text-[11px] leading-5 text-white/70">
                                            {item.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                        <label className="input-glass flex h-11 min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3.5">
                            <Search className="size-4 text-white/40" />
                            <input
                                value={q}
                                onChange={(event) => setQ(event.target.value)}
                                placeholder={tr('Назва або адреса спільноти')}
                                className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
                            />
                        </label>
                    </div>

                    {tab === 'discover' && (
                        <div className="relative mt-4 flex gap-1 overflow-x-auto">
                            {sorts.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => visit({ sort: item.value })}
                                    className={cn(
                                        'h-8 shrink-0 rounded-lg px-3 text-[13px] font-medium transition',
                                        filters.sort === item.value
                                            ? 'bg-white/10 text-white'
                                            : 'text-white/50 hover:text-white',
                                    )}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="relative mt-4 -mb-1 flex gap-2 overflow-x-auto pb-1">
                        {[
                            ['', tr('Усі тематики')],
                            ...Object.entries(categories),
                        ].map(([key, label]) => {
                            const active = (filters.category ?? '') === key;

                            return (
                                <button
                                    key={key || 'all'}
                                    type="button"
                                    onClick={() =>
                                        visit({ category: key || null })
                                    }
                                    className={cn(
                                        'shrink-0 rounded-control border px-3.5 py-1.5 text-xs font-medium transition',
                                        active
                                            ? 'border-transparent bg-gradient-brand text-white shadow-[0_0_18px_-4px_rgb(124_92_255/0.9)]'
                                            : 'border-white/[0.08] text-white/55 hover:border-white/20 hover:text-white',
                                    )}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </section>

                {sections.map((section) => (
                    <ExploreSection key={section.key} section={section} />
                ))}

                {communities.data.length === 0 ? (
                    <EmptyState
                        icon={SearchX}
                        title={
                            tab === 'mine'
                                ? tr('Ви ще не вступили до жодної спільноти')
                                : tab === 'managed'
                                  ? tr('Ви поки нічим не керуєте')
                                  : tr('Нічого не знайдено')
                        }
                        text={
                            tab === 'discover'
                                ? tr(
                                      'Спробуйте інший запит або створіть власну спільноту.',
                                  )
                                : tr(
                                      'Знайдіть цікаві спільноти в огляді або створіть свою.',
                                  )
                        }
                        action={
                            <button
                                type="button"
                                onClick={() =>
                                    tab !== 'discover'
                                        ? visit({ tab: 'discover' })
                                        : signedIn
                                          ? setCreating(true)
                                          : router.visit('/register')
                                }
                                className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold"
                            >
                                {tab === 'discover'
                                    ? tr('Створити спільноту')
                                    : tr('Перейти до огляду')}
                            </button>
                        }
                    />
                ) : (
                    <InfiniteScroll
                        data="communities"
                        loading={<GridSkeleton shape="wide" count={3} />}
                        preserveUrl
                        className="grid grid-cols-1 gap-x-8 divide-y divide-white/[0.07] lg:grid-cols-2 lg:divide-y-0 lg:[&>*]:border-b lg:[&>*]:border-white/[0.07]"
                    >
                        {communities.data.map((community) => (
                            <CommunityTile
                                key={community.id}
                                community={community}
                            />
                        ))}
                    </InfiniteScroll>
                )}
            </div>

            <CreateCommunityDialog
                open={creating}
                onOpenChange={setCreating}
                categories={categories}
            />
        </>
    );
}

/** Добірка над каталогом: компактні плитки в ряд, гортаються вбік. */
function ExploreSection({ section }: { section: Section }) {
    const Icon = SECTION_ICONS[section.key];
    const title = {
        active: tr('Зараз активні'),
        growing: tr('Ростуть'),
        new: tr('Нові'),
    }[section.key];

    return (
        <section className="glass rounded-2xl p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
                <Icon className="size-4 text-gc-lilac-300" />
                {title}
            </h2>
            <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
                {section.items.map((community) => (
                    <Link
                        key={community.id}
                        href={`/c/${community.slug}`}
                        className="flex w-44 shrink-0 flex-col items-center gap-2 rounded-xl px-3 py-3.5 text-center transition hover:bg-white/[0.06]"
                    >
                        <CommunityAvatar community={community} size="lg" />
                        <span className="flex max-w-full items-center gap-1 text-sm font-semibold text-white">
                            <span className="truncate">{community.name}</span>
                            {community.is_verified && (
                                <VerifiedBadge className="size-3.5 shrink-0" />
                            )}
                        </span>
                        <span className="text-xs text-white/50">
                            {section.key === 'active' && community.voice_now
                                ? tr('{n} у голосових', {
                                      n: community.voice_now,
                                  })
                                : section.key === 'growing' &&
                                    community.growth_week
                                  ? tr('+{n} за тиждень', {
                                        n: community.growth_week,
                                    })
                                  : membersLabel(
                                        community.members_count,
                                        community.type === 'public',
                                    )}
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
}
