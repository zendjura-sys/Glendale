import { Head, Link, router } from '@inertiajs/react';
import { ListOrdered, Trash2 } from 'lucide-react';
import { PostCard } from '@/components/gc/post-card';
import { EmptyState } from '@/components/gc/widget';
import { tr } from '@/lib/i18n';
import type { PostItem, UserCard } from '@/types';

/** Сторінка серії: записи автора по порядку частин. */
export default function SeriesShow({
    series,
    posts,
}: {
    series: {
        id: number;
        title: string;
        description: string | null;
        author: UserCard | null;
        mine: boolean;
    };
    posts: PostItem[];
}) {
    return (
        <>
            <Head title={series.title} />
            <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
                <section className="glass rounded-2xl p-5">
                    <p className="flex items-center gap-2 text-xs font-medium text-sky-300">
                        <ListOrdered className="size-4" />
                        {tr('Серія записів · {count}', {
                            count: String(posts.length),
                        })}
                    </p>
                    <h1 className="mt-2 font-display text-2xl font-semibold text-white">
                        {series.title}
                    </h1>
                    {series.description && (
                        <p className="mt-2 text-sm whitespace-pre-line text-white/65">
                            {series.description}
                        </p>
                    )}
                    <div className="mt-3 flex items-center gap-3 text-sm text-white/50">
                        {series.author && (
                            <Link
                                href={`/${series.author.username}`}
                                className="hover:text-white"
                            >
                                {series.author.name}
                            </Link>
                        )}
                        {series.mine && (
                            <button
                                type="button"
                                onClick={() =>
                                    confirm(
                                        tr(
                                            'Видалити серію? Самі записи залишаться.',
                                        ),
                                    ) && router.delete(`/series/${series.id}`)
                                }
                                className="ml-auto inline-flex items-center gap-1.5 text-white/45 hover:text-rose-300"
                            >
                                <Trash2 className="size-4" />
                                {tr('Видалити серію')}
                            </button>
                        )}
                    </div>
                </section>
                {posts.length === 0 ? (
                    <EmptyState
                        icon={ListOrdered}
                        title={tr('У серії поки немає записів')}
                        text={tr(
                            'Автор додає записи в серію з меню «…» на записі.',
                        )}
                    />
                ) : (
                    posts.map((post) => <PostCard key={post.id} post={post} />)
                )}
            </div>
        </>
    );
}
