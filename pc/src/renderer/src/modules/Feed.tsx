import { Heart, MessageCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { NotchBadge, NotchedCard } from '@/components/NotchedCard';
import { Avatar, Empty } from '@/components/ui';
import { ago, api, type User, useLive } from '@/lib/api';

type Post = { id: number; body: string | null; author: User; created_at: string; likes_count: number; comments_count: number; liked?: boolean; attachments?: { type: string; url: string }[] };
type FeedData = { posts: { data: Post[] } };

/** Live Feed: стрічка друзів і спільнот; лайк синхронізується з усіма вікнами. */
export function FeedModule({ header }: { header?: ReactNode }) {
    const { data, error, reload } = useLive<FeedData>('/api/v1/feed', 30_000, ['feed']);
    const posts = data?.posts?.data ?? [];
    const fresh = posts.filter((p) => Date.now() - new Date(p.created_at).getTime() < 3_600_000).length;
    const like = async (post: Post): Promise<void> => {
        await api('POST', `/api/v1/posts/${post.id}/like`).catch(() => undefined);
        await reload();
        window.gamecon.sync.emit('feed');
    };
    return (
        <NotchedCard title="Новини" subtitle="Друзі й спільноти" glow="cyan" header={header} badge={<NotchBadge tone={fresh ? 'cyan' : 'muted'}>{fresh ? `+${fresh}` : '0'}</NotchBadge>} badgeWidth={54}>
            {error && !data ? <Empty>{error}</Empty> : posts.length === 0 ? <Empty>{data ? 'Поки тихо — підпишіться на друзів чи спільноти.' : 'Завантажуємо…'}</Empty> : null}
            <div className="space-y-2">
                {posts.slice(0, 20).map((post) => {
                    const image = post.attachments?.find((a) => a.type === 'image');
                    return (
                        <article key={post.id} className="rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/5">
                            <div className="flex items-center gap-2.5">
                                <Avatar user={post.author} size={32} />
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold">{post.author.name}</div>
                                    <div className="text-[11px] text-white/40">{ago(post.created_at)}</div>
                                </div>
                            </div>
                            {post.body && (
                                <p data-selectable className="mt-2 line-clamp-4 text-[13px] leading-snug text-white/85">
                                    {post.body}
                                </p>
                            )}
                            {image && <img src={image.url} alt="" draggable={false} className="mt-2 max-h-48 w-full rounded-lg object-cover" />}
                            <div className="mt-2 flex gap-4 text-xs text-white/50">
                                <button type="button" onClick={() => void like(post)} className={`no-drag flex items-center gap-1.5 hover:text-white ${post.liked ? 'text-neon-violet' : ''}`}>
                                    <Heart size={14} strokeWidth={1.6} fill={post.liked ? 'currentColor' : 'none'} /> {post.likes_count}
                                </button>
                                <span className="flex items-center gap-1.5">
                                    <MessageCircle size={14} strokeWidth={1.6} /> {post.comments_count}
                                </span>
                            </div>
                        </article>
                    );
                })}
            </div>
        </NotchedCard>
    );
}
