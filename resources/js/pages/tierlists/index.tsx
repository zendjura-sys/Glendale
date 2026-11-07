import { Head, InfiniteScroll, Link } from '@inertiajs/react';
import { Eye, LayoutList, Plus } from 'lucide-react';
import { TIER_COLORS } from '@/components/games/tier-colors';
import { GridSkeleton } from '@/components/gc/skeletons';
import { EmptyState } from '@/components/gc/widget';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ScrollData, UserCard } from '@/types';

type Card = {
    id: number;
    title: string;
    author: UserCard | null;
    game: { slug: string; name: string; cover: string | null } | null;
    is_public: boolean;
    views: number;
    preview: { label: string; color: string; count: number }[];
};

/** Тір-листи: популярні, нові, мої (і для окремої гри). */
export default function TierListsIndex({
    lists,
    tab,
    game,
}: {
    lists: ScrollData<Card>;
    tab: 'top' | 'new' | 'mine';
    game: { slug: string; name: string } | null;
}) {
    const query = (t: string) =>
        `/tierlists?tab=${t}${game ? `&game=${game.slug}` : ''}`;

    return (
        <>
            <Head title={tr('Тір-листи')} />
            <div className="mx-auto w-full max-w-5xl px-4 py-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-white">
                            <LayoutList className="size-6 text-gc-lilac-300" />
                            {game
                                ? tr('Тір-листи: {game}', { game: game.name })
                                : tr('Тір-листи')}
                        </h1>
                        <p className="mt-1 text-sm text-white/50">
                            {tr(
                                'Хто сильніший? Розставте по рівнях і поділіться.',
                            )}
                        </p>
                    </div>
                    <Link
                        href={`/tierlists/new${game ? `?game=${game.slug}` : ''}`}
                        className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                    >
                        <Plus className="size-4" />
                        {tr('Створити')}
                    </Link>
                </div>
                <div className="mt-4 flex gap-2">
                    {(
                        [
                            ['top', tr('Популярні')],
                            ['new', tr('Нові')],
                            ['mine', tr('Мої')],
                        ] as const
                    ).map(([value, label]) => (
                        <Link
                            key={value}
                            href={query(value)}
                            preserveScroll
                            className={cn(
                                'h-8 rounded-chip px-3 text-[13px] leading-8 font-medium transition',
                                tab === value
                                    ? 'bg-white/12 text-white'
                                    : 'text-white/50 hover:text-white',
                            )}
                        >
                            {label}
                        </Link>
                    ))}
                </div>
                {lists.data.length === 0 ? (
                    <div className="mt-6">
                        <EmptyState
                            icon={LayoutList}
                            title={tr('Тут поки порожньо')}
                            text={tr('Створіть перший тір-лист.')}
                        />
                    </div>
                ) : (
                    <InfiniteScroll
                        data="lists"
                        loading={<GridSkeleton count={3} />}
                        preserveUrl
                    >
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {lists.data.map((list) => (
                                <Link
                                    key={list.id}
                                    href={`/tierlists/${list.id}`}
                                    className="glass group block rounded-2xl p-4 transition hover:bg-white/[0.06]"
                                >
                                    <div className="space-y-1">
                                        {list.preview
                                            .slice(0, 5)
                                            .map((tier, i) => (
                                                <div
                                                    key={i}
                                                    className="flex items-center gap-1.5"
                                                >
                                                    <span
                                                        className={cn(
                                                            'w-6 rounded text-center text-[11px] font-bold text-black/80',
                                                            TIER_COLORS[
                                                                tier.color
                                                            ],
                                                        )}
                                                    >
                                                        {tier.label}
                                                    </span>
                                                    <span
                                                        className="h-2 rounded-full bg-white/15"
                                                        style={{
                                                            width: `${Math.min(100, 8 + tier.count * 9)}%`,
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                    </div>
                                    <p className="mt-3 truncate font-semibold text-white">
                                        {list.title}
                                    </p>
                                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-white/45">
                                        {[list.author?.name, list.game?.name]
                                            .filter(Boolean)
                                            .join(' · ')}
                                        <Eye className="ml-auto size-3.5 shrink-0" />
                                        {list.views}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    </InfiniteScroll>
                )}
            </div>
        </>
    );
}
