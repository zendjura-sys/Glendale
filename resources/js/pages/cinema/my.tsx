import { Head, InfiniteScroll, Link } from '@inertiajs/react';
import { Bookmark } from 'lucide-react';
import { CinemaNav } from '@/components/cinema/cinema-nav';
import { CinemaShell } from '@/components/cinema/cinema-side';
import type { CinemaSideData } from '@/components/cinema/cinema-side';
import { ListCard } from '@/components/cinema/list-card';
import type { MovieListCard } from '@/components/cinema/list-card';
import { MovieList } from '@/components/cinema/movie-row';
import type { MovieRowItem } from '@/components/cinema/movie-row';
import { GridSkeleton } from '@/components/gc/skeletons';
import { UnderlineTabs } from '@/components/gc/underline-tabs';
import { EmptyState } from '@/components/gc/widget';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';
import type { MovieOption, MovieStatus, ScrollData } from '@/types';

type Props = {
    status: string;
    movies: ScrollData<MovieRowItem>;
    total: number;
    lists: MovieListCard[] | null;
    statuses: MovieOption<MovieStatus>[];
    counts: Record<string, number>;
    side?: CinemaSideData;
};

/**
 * «Закладки» кінопорталу: колекції, історія переглядів, обране й списки за статусами
 * (дивлюсь, у планах, переглянуто, відкладено, кинуто) — вкладками з підкресленням.
 */
export default function CinemaMy({
    status,
    movies,
    total,
    lists,
    statuses,
    counts,
    side,
}: Props) {
    const listsOn = usePlugin('movie_lists');
    const tabs = [
        ...(listsOn ? [{ key: 'lists', label: tr('Колекції') }] : []),
        { key: 'history', label: tr('Історія') },
        { key: 'saved', label: tr('Обране') },
        ...statuses.map((s) => ({
            key: s.key as string,
            label: s.label,
            count: counts[s.key] ?? 0,
        })),
        { key: 'all', label: tr('Усі'), count: counts.all ?? 0 },
        { key: 'rated', label: tr('Оцінені'), count: counts.rated ?? 0 },
    ].map((tab) => ({
        ...tab,
        href: tab.key === 'all' ? '/cinema/my' : `/cinema/my?status=${tab.key}`,
    }));

    return (
        <>
            <Head title={tr('Закладки')} />
            <CinemaShell side={side}>
                <CinemaNav active="my" />
                <div className="flex flex-wrap items-center gap-2">
                    <UnderlineTabs tabs={tabs} active={status} />
                    <Link
                        href="/cinema/import"
                        className="ml-auto rounded-xl bg-white/[0.07] px-3 py-1.5 text-sm font-medium text-white hover:bg-white/[0.11]"
                    >
                        {tr('Імпорт з Shikimori / MyAnimeList')}
                    </Link>
                </div>

                {status === 'lists' ? (
                    lists && lists.length > 0 ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {lists.map((list) => (
                                <ListCard key={list.id} list={list} />
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            icon={Bookmark}
                            title={tr('Колекцій поки немає')}
                            text={tr(
                                'Відкрийте фільм і додайте його в нову добірку.',
                            )}
                            action={
                                <Link
                                    href="/cinema/lists"
                                    className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold"
                                >
                                    {tr('Усі добірки')}
                                </Link>
                            }
                        />
                    )
                ) : movies.data.length === 0 ? (
                    <EmptyState
                        icon={Bookmark}
                        title={tr('Тут поки порожньо')}
                        text={tr(
                            'Відкрийте фільм і натисніть «Додати до списку».',
                        )}
                        action={
                            <Link
                                href="/cinema"
                                className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold"
                            >
                                {tr('До каталогу')}
                            </Link>
                        }
                    />
                ) : (
                    <section className="glass rounded-2xl p-4 sm:p-5">
                        <p className="mb-4 text-sm text-white/50 tabular-nums">
                            {tr('{n} всього', { n: total })}
                        </p>
                        <InfiniteScroll
                            data="movies"
                            loading={<GridSkeleton count={4} />}
                            preserveUrl
                        >
                            <MovieList
                                movies={movies.data}
                                variant={
                                    status === 'history' ? 'history' : 'default'
                                }
                            />
                        </InfiniteScroll>
                    </section>
                )}
            </CinemaShell>
        </>
    );
}
