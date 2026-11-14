import { Head } from '@inertiajs/react';
import { Flame, History } from 'lucide-react';
import { PostCard } from '@/components/gc/post-card';
import { EmptyState } from '@/components/gc/widget';
import { formatDate, plural } from '@/lib/format';
import { tr } from '@/lib/i18n';
import type { PostItem } from '@/types';

/** «Цього дня»: власні записи, опубліковані цієї дати в минулі роки. */
export default function Memories({
    date,
    posts,
    streak,
}: {
    date: string;
    posts: PostItem[];
    streak: { days: number; best: number } | null;
}) {
    const year = new Date(date).getFullYear();

    return (
        <>
            <Head title={tr('Цього дня')} />
            <div className="mx-auto max-w-2xl space-y-4">
                <header>
                    <h1 className="font-display text-2xl font-bold text-white">
                        {tr('Цього дня')}
                    </h1>
                    <p className="mt-1 text-sm text-white/50">
                        {formatDate(date, false)}
                        {streak && streak.days > 0 && (
                            <span className="ml-3 inline-flex items-center gap-1 text-orange-300">
                                <Flame className="size-3.5" />
                                {tr('{days} {word} поспіль · рекорд {best}', {
                                    days: streak.days,
                                    word: plural(streak.days, [
                                        tr('день'),
                                        tr('дні'),
                                        tr('днів'),
                                    ]),
                                    best: streak.best,
                                })}
                            </span>
                        )}
                    </p>
                </header>
                {posts.length === 0 ? (
                    <EmptyState
                        icon={History}
                        title={tr('Сьогодні спогадів немає')}
                        text={tr(
                            'Тут з’являться ваші записи, опубліковані цієї дати в минулі роки.',
                        )}
                    />
                ) : (
                    posts.map((post) => (
                        <div key={post.id} className="space-y-2">
                            <p className="px-1 text-xs font-semibold text-sky-400">
                                {tr('{years} {word} тому', {
                                    years:
                                        year -
                                        new Date(post.created_at).getFullYear(),
                                    word: plural(
                                        year -
                                            new Date(
                                                post.created_at,
                                            ).getFullYear(),
                                        [tr('рік'), tr('роки'), tr('років')],
                                    ),
                                })}
                            </p>
                            <PostCard post={post} />
                        </div>
                    ))
                )}
            </div>
        </>
    );
}
