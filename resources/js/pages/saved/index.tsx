import { Head, Link } from '@inertiajs/react';
import { Bookmark } from 'lucide-react';
import { PostCard } from '@/components/gc/post-card';
import { EmptyState } from '@/components/gc/widget';
import type { PostItem } from '@/types';
import { tr } from '@/lib/i18n';

type Card = {
    kind: 'movie' | 'game' | 'server';
    title: string;
    hint: string;
    href: string;
    image: string | null;
};

type Item = { kind: 'post'; post: PostItem } | Card;

export default function Saved({ items }: { items: Item[] }) {
    return (
        <>
            <Head title={tr('Збережене')} />
            <div className="mx-auto max-w-[640px] space-y-4">
                <h1 className="font-display text-2xl font-semibold text-white">
                    {tr('Збережене')}
                </h1>
                {items.length === 0 ? (
                    <EmptyState
                        icon={Bookmark}
                        title={tr(
                            'Тут з’являться пости, фільми, ігри й сервери',
                        )}
                    />
                ) : (
                    items.map((item, index) =>
                        item.kind === 'post' ? (
                            <PostCard
                                key={`post-${item.post.id}`}
                                post={item.post}
                            />
                        ) : (
                            <Link
                                key={`${item.kind}-${item.href}-${index}`}
                                href={item.href}
                                className="glass flex items-center gap-3 rounded-2xl p-3"
                            >
                                {item.image ? (
                                    <img
                                        src={item.image}
                                        alt=""
                                        className="size-14 rounded-xl object-cover"
                                    />
                                ) : (
                                    <span className="flex size-14 items-center justify-center rounded-xl bg-white/10 text-xs font-semibold text-white/60 uppercase">
                                        {item.hint.slice(0, 2)}
                                    </span>
                                )}
                                <span className="min-w-0">
                                    <span className="block truncate font-medium text-white">
                                        {item.title}
                                    </span>
                                    <span className="block text-xs text-white/45">
                                        {tr(item.hint)}
                                    </span>
                                </span>
                            </Link>
                        ),
                    )
                )}
            </div>
        </>
    );
}
