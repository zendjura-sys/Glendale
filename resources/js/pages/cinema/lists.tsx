import { Head, InfiniteScroll, Link } from '@inertiajs/react';
import { ListVideo } from 'lucide-react';
import { ListCard } from '@/components/cinema/list-card';
import type { MovieListCard } from '@/components/cinema/list-card';
import { ListSkeleton } from '@/components/gc/skeletons';
import { EmptyState } from '@/components/gc/widget';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ScrollData } from '@/types';

/** Добірки фільмів: популярні, мої й ті, за якими стежу. */
export default function Lists({
    tab,
    lists,
}: {
    tab: 'popular' | 'mine' | 'following';
    lists: ScrollData<MovieListCard>;
}) {
    const tabs = [
        ['popular', tr('Популярні')],
        ['mine', tr('Мої')],
        ['following', tr('Стежу')],
    ] as const;

    return (
        <>
            <Head title={tr('Добірки фільмів')} />
            <div className="space-y-4">
                <header>
                    <h1 className="font-display text-2xl font-bold text-white">
                        {tr('Добірки фільмів')}
                    </h1>
                    <p className="mt-1 text-sm text-white/50">
                        {tr(
                            'Списки від людей: збирайте свої на сторінці фільму кнопкою «У добірку».',
                        )}
                    </p>
                </header>
                <div className="flex gap-2">
                    {tabs.map(([key, label]) => (
                        <Link
                            key={key}
                            href={`/cinema/lists?tab=${key}`}
                            preserveScroll
                            className={cn(
                                'rounded-chip px-4 py-1.5 text-sm font-semibold transition',
                                tab === key
                                    ? 'bg-primary text-white'
                                    : 'bg-white/[0.06] text-white/70 hover:text-white',
                            )}
                        >
                            {label}
                        </Link>
                    ))}
                </div>
                {lists.data.length === 0 ? (
                    <EmptyState
                        icon={ListVideo}
                        title={
                            tab === 'mine'
                                ? tr('У вас ще немає добірок')
                                : tr('Добірок поки немає')
                        }
                    />
                ) : (
                    <InfiniteScroll
                        data="lists"
                        loading={<ListSkeleton rows={2} />}
                        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
                    >
                        {lists.data.map((list) => (
                            <ListCard key={list.id} list={list} />
                        ))}
                    </InfiniteScroll>
                )}
            </div>
        </>
    );
}
