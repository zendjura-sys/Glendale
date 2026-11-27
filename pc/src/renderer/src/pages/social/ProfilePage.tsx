import { MessageSquare, UserCheck, UserMinus, UserPlus } from 'lucide-react';
import { Button, Card, Loading, StatTile, useSite, useToast, when } from '@/components/kit';
import { Composer, type Post, PostCard } from '@/components/Post';
import { Avatar } from '@/components/ui';
import { api, type User } from '@/lib/api';
import { useMe } from '@/lib/me';
import { useNav } from '@/lib/nav';
import { ArrowLeft, X } from 'lucide-react';

type Profile = {
    profile: User & { cover_url?: string | null; status?: string | null; title?: string | null; playing?: { label?: string } | null; badges?: { name: string; tag?: string | null; logo?: string | null }[] };
    relation: string;
    stats: { friends: number; posts: number; photos: number; mutual?: number; thanks?: number };
    friends: User[];
    photos: { id: number; url: string; thumb_url?: string }[];
    posts: { data: Post[] };
    achievements: { level: number; title: string; xp: number; next_xp: number; level_xp: number; earned: number; total: number; badges: { key: string; title: string; icon: string; earned: boolean }[] } | null;
    canMessage: boolean;
    canPost: boolean;
    canSeeContent: boolean;
    friendsSince: string | null;
    account?: { about?: string | null; city?: string | null; website?: string | null } | null;
};

/** Сторінка людини (і «Моя сторінка»): обкладинка, статус, дружба й повідомлення, показники, друзі, фото, досягнення, стіна з записами. */
export function ProfilePage({ username }: { username: string }) {
    const { me } = useMe();
    const nav = useNav();
    const toast = useToast();
    const page = useSite<Profile>(`/u/${username}`);
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    const u = d.profile;
    const mine = me?.id === u.id;
    const act = async (method: string, path: string, ok: string): Promise<void> => {
        try {
            await api(method, path);
            toast(ok);
            await page.reload();
        } catch (e) {
            toast((e as Error).message, 'error');
        }
    };
    const message = async (): Promise<void> => {
        const r = await api<{ id: number }>('POST', `/api/v1/messages/with/${u.id}`).catch((e: Error) => (toast(e.message, 'error'), null));
        if (r) nav.go(`/messages/${r.id}`);
    };
    const lvl = d.achievements;
    return (
        <div className="h-full overflow-y-auto">
            {/* Обкладинка з кнопками навігації поверх. */}
            <div className="relative h-52 bg-gradient-to-br from-neon-blue/30 via-neon-violet/25 to-neon-cyan/20">
                {u.cover_url && <img src={u.cover_url} alt="" className="h-full w-full object-cover" />}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0c0f17] to-transparent" />
                <div className="absolute top-4 left-5 flex gap-2">
                    <button type="button" onClick={nav.back} aria-label="Назад" className="grid h-11 w-11 place-items-center rounded-xl bg-black/40 ring-1 ring-white/15 backdrop-blur hover:bg-black/60">
                        <ArrowLeft size={19} />
                    </button>
                </div>
                <button type="button" onClick={nav.close} aria-label="Закрити" className="absolute top-4 right-5 grid h-11 w-11 place-items-center rounded-xl bg-black/40 ring-1 ring-white/15 backdrop-blur hover:bg-black/60">
                    <X size={18} />
                </button>
            </div>
            <div className="mx-auto -mt-16 max-w-[1180px] px-5 pb-8">
                <div className="relative flex items-end gap-5">
                    <span className="rounded-full ring-4 ring-[#0c0f17]">
                        <Avatar user={u} size={120} dot={u.is_online ? 'online' : null} />
                    </span>
                    <div className="min-w-0 flex-1 pb-2">
                        <h1 className="truncate text-2xl font-bold">{u.name}</h1>
                        <p className="truncate text-sm text-white/55">
                            @{u.username}
                            {u.status ? ` · ${u.status}` : ''}
                            {u.playing?.label ? ` · 🎮 ${u.playing.label}` : ''}
                        </p>
                    </div>
                    {!mine && (
                        <div className="flex gap-2 pb-2">
                            {d.canMessage && (
                                <Button tone="primary" onClick={() => void message()}>
                                    <MessageSquare size={16} /> Написати
                                </Button>
                            )}
                            {d.relation === 'friends' && (
                                <Button onClick={() => window.confirm(`Прибрати ${u.name} з друзів?`) && void act('DELETE', `/api/v1/friends/${u.username}`, 'Прибрано з друзів.')}>
                                    <UserMinus size={16} /> У друзях
                                </Button>
                            )}
                            {d.relation === 'incoming' && (
                                <Button tone="ok" onClick={() => void act('POST', `/api/v1/friends/${u.username}/accept`, 'Тепер ви друзі!')}>
                                    <UserCheck size={16} /> Прийняти заявку
                                </Button>
                            )}
                            {d.relation === 'outgoing' && <Button onClick={() => void act('DELETE', `/api/v1/friends/${u.username}`, 'Заявку скасовано.')}>Заявку надіслано</Button>}
                            {(!d.relation || d.relation === 'none') && (
                                <Button onClick={() => void act('POST', `/api/v1/friends/${u.username}`, 'Заявку надіслано.')}>
                                    <UserPlus size={16} /> Додати в друзі
                                </Button>
                            )}
                        </div>
                    )}
                </div>
                <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                    <StatTile label="Друзів" value={d.stats.friends} />
                    <StatTile label="Записів" value={d.stats.posts} />
                    <StatTile label="Фото" value={d.stats.photos} />
                    {!!d.stats.mutual && <StatTile label="Спільних друзів" value={d.stats.mutual} />}
                    {lvl && <StatTile label={lvl.title} value={`Рівень ${lvl.level}`} hint={`${lvl.earned}/${lvl.total} досягнень`} accent />}
                    {d.friendsSince && <StatTile label="Друзі з" value={when(d.friendsSince, false)} />}
                </div>
                {!d.canSeeContent ? (
                    <p className="py-12 text-center text-sm text-white/45">Сторінка закрита — бачать лише друзі.</p>
                ) : (
                    <div className="mt-5 grid grid-cols-[300px_minmax(0,1fr)] gap-5 max-[1000px]:grid-cols-1">
                        <aside className="space-y-4">
                            {d.friends.length > 0 && (
                                <Card title={`Друзі · ${d.stats.friends}`}>
                                    <div className="grid grid-cols-4 gap-2">
                                        {d.friends.slice(0, 12).map((f) => (
                                            <button key={f.id} type="button" title={f.name} onClick={() => f.username && nav.go(`/u/${f.username}`)} className="flex flex-col items-center gap-1 rounded-xl p-1 hover:bg-white/5">
                                                <Avatar user={f} size={44} dot={f.is_online ? 'online' : null} />
                                                <span className="w-full truncate text-center text-[11px] text-white/60">{f.first_name ?? f.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </Card>
                            )}
                            {d.photos.length > 0 && (
                                <Card title={`Фото · ${d.stats.photos}`}>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {d.photos.slice(0, 9).map((p) => (
                                            <img key={p.id} src={p.thumb_url ?? p.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                                        ))}
                                    </div>
                                </Card>
                            )}
                            {lvl && lvl.badges.some((b) => b.earned) && (
                                <Card title="Досягнення">
                                    <div className="flex flex-wrap gap-1.5">
                                        {lvl.badges
                                            .filter((b) => b.earned)
                                            .slice(0, 18)
                                            .map((b) => (
                                                <span key={b.key} title={b.title} className="rounded-lg bg-amber-300/10 px-2 py-1 text-xs text-amber-200 ring-1 ring-amber-300/20">
                                                    {b.title}
                                                </span>
                                            ))}
                                    </div>
                                </Card>
                            )}
                        </aside>
                        <div className="space-y-4">
                            {(mine || d.canPost) && <Composer wall={mine ? undefined : u.username} onPosted={() => void page.reload()} placeholder={mine ? 'Що нового?' : `Написати на стіні ${u.first_name ?? u.name}`} />}
                            {d.posts.data.length === 0 && <p className="py-8 text-center text-sm text-white/45">Записів ще немає.</p>}
                            {d.posts.data.map((p) => (
                                <PostCard key={p.id} post={p} onDeleted={() => void page.reload()} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
