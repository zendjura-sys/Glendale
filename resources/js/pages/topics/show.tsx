import { Head, InfiniteScroll } from '@inertiajs/react';
import { Hash } from 'lucide-react';
import { useState } from 'react';
import { PostCard } from '@/components/gc/post-card';
import { FeedSkeleton } from '@/components/gc/skeletons';
import { EmptyState } from '@/components/gc/widget';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { PostItem as Post, ScrollData } from '@/types';

/** Сторінка теми: записи з #хештегом і кнопка «Стежити». */
export default function TopicShow({
    tag,
    following,
    posts,
}: {
    tag: string;
    following: boolean;
    posts: ScrollData<Post>;
}) {
    const [on, setOn] = useState(following);
    const [busy, setBusy] = useState(false);

    return (
        <>
            <Head title={`#${tag}`} />
            <div className="mx-auto w-full max-w-2xl space-y-4">
                <div className="glass flex items-center gap-3 rounded-2xl p-4">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-gc-indigo/20 text-gc-lilac-300">
                        <Hash className="size-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate font-display text-xl font-semibold text-white">
                            #{tag}
                        </h1>
                        <p className="text-sm text-white/50">
                            {tr('Записи з цим хештегом')}
                        </p>
                    </div>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                            setBusy(true);
                            void api<{ following: boolean }>(
                                'POST',
                                `/t/${encodeURIComponent(tag)}/follow`,
                            )
                                .then((d) => setOn(d.following))
                                .finally(() => setBusy(false));
                        }}
                        className={cn(
                            'h-10 rounded-xl px-4 text-sm font-semibold transition',
                            on
                                ? 'bg-white/[0.08] text-white hover:bg-white/[0.12]'
                                : 'btn-glow',
                        )}
                    >
                        {on ? tr('Ви стежите') : tr('Стежити')}
                    </button>
                </div>
                {posts.data.length === 0 ? (
                    <EmptyState
                        icon={Hash}
                        title={tr('Тут поки тихо')}
                        text={tr('Напишіть перший запис з #{tag}.', { tag })}
                    />
                ) : (
                    <InfiniteScroll
                        data="posts"
                        loading={<FeedSkeleton count={2} />}
                        preserveUrl
                    >
                        <div className="space-y-4">
                            {posts.data.map((post) => (
                                <PostCard key={post.id} post={post} />
                            ))}
                        </div>
                    </InfiniteScroll>
                )}
            </div>
        </>
    );
}
