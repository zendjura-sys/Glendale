import { CalendarDays, Camera, MessagesSquare, PenLine, Swords } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Loading, PageHeader, Tabs } from '@/components/kit';
import { Composer, type Post, PostCard } from '@/components/Post';
import { Avatar } from '@/components/ui';
import { api, type User } from '@/lib/api';
import { useMe } from '@/lib/me';
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
                <div className="mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)_300px] gap-5 max-[1100px]:grid-cols-1">
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
                    <aside className="space-y-4 max-[1100px]:hidden">
                        <QuickActions />
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
                                    <button
                                        key={u.id}
                                        type="button"
                                        onClick={() => u.username && nav.go(`/u/${u.username}`)}
                                        className="flex w-full items-center gap-2.5 rounded-xl px-1 py-1.5 text-left hover:bg-white/5"
                                    >
                                        <Avatar user={u} size={34} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm">{u.name}</span>
                                            {u.mutual ? <span className="text-xs text-white/45">{u.mutual} спільних друзів</span> : null}
                                        </span>
                                    </button>
                                ))}
                            </Card>
                        )}
                        <UpcomingEvents />
                        <HotTopics />
                    </aside>
                </div>
            </div>
        </div>
    );
}

/** Швидкі дії: написати статтю, додати кліп, зібрати паті, обговорити — лише ввімкнені розділи. */
function QuickActions() {
    const nav = useNav();
    const { sections } = useMe();
    const items = [
        { id: 'articles', label: 'Стаття', icon: PenLine, to: '/articles/new' },
        { id: 'moments', label: 'Кліп', icon: Camera, to: '/moments' },
        { id: 'party', label: 'Паті', icon: Swords, to: '/party' },
        { id: 'discussions', label: 'Тема', icon: MessagesSquare, to: '/discussions' },
    ].filter((i) => !sections || sections.includes(i.id));
    if (!items.length) return null;
    return (
        <div className="grid grid-cols-4 gap-2">
            {items.map((i) => (
                <button
                    key={i.id}
                    type="button"
                    onClick={() => nav.go(i.to)}
                    className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/[0.04] py-3 text-xs text-white/70 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:text-white"
                >
                    <i.icon size={18} className="text-neon-cyan" />
                    {i.label}
                </button>
            ))}
        </div>
    );
}

type Ev = { key: string; title: string; type_label: string; starts_at: string; where: { name: string }; status: string | null };
function UpcomingEvents() {
    const nav = useNav();
    const { sections } = useMe();
    const [list, setList] = useState<Ev[] | null>(null);
    const on = !sections || sections.includes('events');
    useEffect(() => {
        if (on)
            void api<{ events: Ev[] }>('GET', '/api/v1/site/events').then(
                (d) => setList(d.events.slice(0, 4)),
                () => setList([]),
            );
    }, [on]);
    if (!on || !list?.length) return null;
    return (
        <Card
            title={
                <span className="flex items-center gap-2">
                    <CalendarDays size={15} /> Найближчі події
                </span>
            }
            actions={
                <Button small onClick={() => nav.go('/events')}>
                    Усі
                </Button>
            }
        >
            <div className="space-y-2">
                {list.map((e) => {
                    const d = new Date(e.starts_at);
                    return (
                        <button key={e.key} type="button" onClick={() => nav.go('/events')} className="flex w-full items-center gap-3 rounded-lg p-1 text-left hover:bg-white/5">
                            <span className="grid w-11 shrink-0 place-items-center rounded-lg bg-white/[0.06] py-1 leading-tight">
                                <b className="text-base">{d.getDate()}</b>
                                <span className="text-[10px] text-white/50 uppercase">{d.toLocaleDateString('uk-UA', { month: 'short' })}</span>
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{e.title}</span>
                                <span className="block truncate text-[11px] text-white/45">
                                    {d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })} · {e.where.name}
                                </span>
                            </span>
                            {e.status === 'going' && <span className="size-2 rounded-full bg-emerald-400" />}
                        </button>
                    );
                })}
            </div>
        </Card>
    );
}

type Topic = { id: number; title: string; category_label: string; replies_count: number };
function HotTopics() {
    const nav = useNav();
    const { sections } = useMe();
    const [list, setList] = useState<Topic[] | null>(null);
    const on = !sections || sections.includes('discussions');
    useEffect(() => {
        if (on)
            void api<{ discussions: { data: Topic[] } }>('GET', '/api/v1/discussions/list?sort=top').then(
                (d) => setList(d.discussions.data.slice(0, 5)),
                () => setList([]),
            );
    }, [on]);
    if (!on || !list?.length) return null;
    return (
        <Card
            title={
                <span className="flex items-center gap-2">
                    <MessagesSquare size={15} /> Гарячі обговорення
                </span>
            }
            actions={
                <Button small onClick={() => nav.go('/discussions')}>
                    Усі
                </Button>
            }
        >
            <div className="space-y-1">
                {list.map((t, i) => (
                    <button key={t.id} type="button" onClick={() => nav.go(`/discussions/${t.id}`)} className="flex w-full items-start gap-2.5 rounded-lg p-1.5 text-left hover:bg-white/5">
                        <span className="w-4 shrink-0 text-sm font-bold text-white/35">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-sm">{t.title}</span>
                            <span className="text-[11px] text-white/45">
                                {t.category_label} · {t.replies_count} відп.
                            </span>
                        </span>
                    </button>
                ))}
            </div>
        </Card>
    );
}
