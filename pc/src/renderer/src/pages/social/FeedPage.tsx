import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Loading, PageHeader, Tabs } from '@/components/kit';
import { Composer, type Post, PostCard } from '@/components/Post';
import { Avatar } from '@/components/ui';
import { api, type User } from '@/lib/api';
import { useNav } from '@/lib/nav';

type Feed = { tab: string; posts: { data: Post[]; current_page?: number; last_page?: number; next_page_url?: string | null }; suggestions?: (User & { mutual?: number })[]; online_friends?: User[] };

/** «Новини»: стрічка друзів / цікаве / країна, новий запис із фото, вподобайки й коментарі; збоку — хто онлайн і кого додати. */
export function FeedPage() {
    const nav = useNav();
    const [tab, setTab] = useState<'friends' | 'discover' | 'country'>('friends');
    const [posts, setPosts] = useState<Post[] | null>(null);
    const [page, setPage] = useState(1);
    const [more, setMore] = useState(false);
    const [side, setSide] = useState<Feed | null>(null);
    const load = useCallback(
        async (p = 1) => {
            const d = await api<Feed>('GET', `/api/v1/feed?tab=${tab}&page=${p}`).catch(() => null);
            if (!d) return;
            setPosts((x) => (p === 1 ? d.posts.data : [...(x ?? []), ...d.posts.data]));
            setMore(!!d.posts.next_page_url || (d.posts.last_page ?? 0) > p);
            setPage(p);
            if (p === 1) setSide(d);
        },
        [tab],
    );
    useEffect(() => {
        setPosts(null);
        void load(1);
    }, [load]);
    const hasSide = !!(side?.online_friends?.length || side?.suggestions?.length);
    return (
        <div className="flex h-full flex-col">
            <PageHeader title="Новини" subtitle="Друзі, спільноти й цікаве" />
            <Tabs
                tabs={[
                    { id: 'friends', label: 'Друзі й підписки' },
                    { id: 'discover', label: 'Цікаве' },
                    { id: 'country', label: 'Україна' },
                ]}
                value={tab}
                onChange={setTab}
            />
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className={`mx-auto grid gap-5 ${hasSide ? 'max-w-[1180px] grid-cols-[minmax(0,1fr)_300px] max-[1100px]:grid-cols-1' : 'max-w-[780px] grid-cols-1'}`}>
                    <div className="space-y-4">
                        <Composer onPosted={() => void load(1)} />
                        {posts === null && <Loading />}
                        {posts?.length === 0 && <p className="py-10 text-center text-sm text-white/45">Тут поки тихо. Додайте друзів чи підпишіться на спільноти.</p>}
                        {posts?.map((p) => (
                            <PostCard key={p.id} post={p} onDeleted={() => setPosts((x) => x?.filter((y) => y.id !== p.id) ?? null)} />
                        ))}
                        {more && (
                            <div className="text-center">
                                <Button onClick={() => void load(page + 1)}>Показати ще</Button>
                            </div>
                        )}
                    </div>
                    {hasSide && <aside className="space-y-4 max-[1100px]:hidden">
                        {side?.online_friends && side.online_friends.length > 0 && (
                            <Card title="Друзі онлайн">
                                <div className="flex flex-wrap gap-2">
                                    {side.online_friends.map((u) => (
                                        <button key={u.id} type="button" title={u.name} onClick={() => u.username && nav.go(`/u/${u.username}`)}>
                                            <Avatar user={u} size={38} dot="online" />
                                        </button>
                                    ))}
                                </div>
                            </Card>
                        )}
                        {side?.suggestions && side.suggestions.length > 0 && (
                            <Card title="Можливо, знайомі">
                                {side.suggestions.slice(0, 6).map((u) => (
                                    <button key={u.id} type="button" onClick={() => u.username && nav.go(`/u/${u.username}`)} className="flex w-full items-center gap-2.5 rounded-xl px-1 py-1.5 text-left hover:bg-white/5">
                                        <Avatar user={u} size={34} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm">{u.name}</span>
                                            {u.mutual ? <span className="text-xs text-white/45">{u.mutual} спільних друзів</span> : null}
                                        </span>
                                    </button>
                                ))}
                            </Card>
                        )}
                    </aside>}
                </div>
            </div>
        </div>
    );
}
