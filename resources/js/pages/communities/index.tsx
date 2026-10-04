import { Head, InfiniteScroll, router } from '@inertiajs/react';
import { Compass, Crown, Plus, Search, Shield, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CommunityTile } from '@/components/communities/community-card';
import { CreateCommunityDialog } from '@/components/communities/create-community-dialog';
import { EmptyState } from '@/components/gc/widget';
import { cn } from '@/lib/utils';
import type { CommunityListItem, ScrollData } from '@/types';
import { tr } from '@/lib/i18n';

type Tab = 'mine' | 'managed' | 'discover';

type Props = {
    tab: Tab;
    filters: { q: string; category: string | null };
    categories: Record<string, string>;
    counts: { mine: number; managed: number };
    communities: ScrollData<CommunityListItem>;
};

export default function Communities({
    tab,
    filters,
    categories,
    counts,
    communities,
}: Props) {
    const [q, setQ] = useState(filters.q);
    const [creating, setCreating] = useState(false);

    const visit = (
        patch: Partial<{ tab: Tab; q: string; category: string | null }>,
    ) => {
        const next = { tab, q, category: filters.category, ...patch };
        router.get(
            '/communities',
            {
                tab: next.tab,
                q: next.q || undefined,
                category: next.category || undefined,
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

    return (
        <>
            <Head title={tr('Спільноти')} />
            <div className="space-y-5">
                <section className="glass relative overflow-hidden rounded-3xl p-5 sm:p-6">
                    <div className="pointer-events-none absolute -top-28 -right-10 size-80 rounded-full bg-[#a855f7]/25 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-32 left-10 size-72 rounded-full bg-[#4f8bff]/15 blur-3xl" />
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
                        <button
                            type="button"
                            onClick={() => setCreating(true)}
                            className="btn-glow inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold"
                        >
                            <Plus className="size-4" />{' '}
                            {tr('Створити спільноту')}
                        </button>
                    </div>

                    <div className="relative mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
                        <div className="flex shrink-0 rounded-xl bg-white/[0.04] p-1">
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
                        <label className="input-glass flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3.5">
                            <Search className="size-4 text-white/40" />
                            <input
                                value={q}
                                onChange={(event) => setQ(event.target.value)}
                                placeholder={tr('Назва або адреса спільноти')}
                                className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
                            />
                        </label>
                    </div>

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
                                        'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition',
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
                                    tab === 'discover'
                                        ? setCreating(true)
                                        : visit({ tab: 'discover' })
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
                        preserveUrl
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
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
