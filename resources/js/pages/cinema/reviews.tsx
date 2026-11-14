import { Head, InfiniteScroll, Link } from '@inertiajs/react';
import { MessageSquareQuote } from 'lucide-react';
import { ReviewCard } from '@/components/cinema/movie-extras';
import type { MovieReview } from '@/components/cinema/movie-extras';
import { ListSkeleton } from '@/components/gc/skeletons';
import { EmptyState } from '@/components/gc/widget';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ScrollData } from '@/types';

/** Стрічка рецензій: друзів або всіх; спойлери приховані. */
export default function Reviews({
    tab,
    reviews,
}: {
    tab: 'friends' | 'all';
    reviews: ScrollData<MovieReview>;
}) {
    const tabs = [
        ['friends', tr('Друзі')],
        ['all', tr('Усі')],
    ] as const;

    return (
        <>
            <Head title={tr('Рецензії')} />
            <div className="mx-auto max-w-3xl space-y-4">
                <header>
                    <h1 className="font-display text-2xl font-bold text-white">
                        {tr('Рецензії')}
                    </h1>
                    <p className="mt-1 text-sm text-white/50">
                        {tr(
                            'Що думають про фільми й серіали ваші друзі та спільнота.',
                        )}
                    </p>
                </header>
                <div className="flex gap-2">
                    {tabs.map(([key, label]) => (
                        <Link
                            key={key}
                            href={`/cinema/reviews?tab=${key}`}
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
                {reviews.data.length === 0 ? (
                    <EmptyState
                        icon={MessageSquareQuote}
                        title={
                            tab === 'friends'
                                ? tr('Друзі ще не писали рецензій')
                                : tr('Рецензій поки немає')
                        }
                    />
                ) : (
                    <InfiniteScroll
                        data="reviews"
                        loading={<ListSkeleton rows={2} />}
                        className="space-y-3"
                    >
                        {reviews.data.map((review) => (
                            <ReviewCard
                                key={review.id}
                                review={review}
                                showMovie
                            />
                        ))}
                    </InfiniteScroll>
                )}
            </div>
        </>
    );
}
