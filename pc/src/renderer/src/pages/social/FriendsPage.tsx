import { MessageSquare, Search, UserCheck, UserMinus, UserPlus, UserX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Loading, PageHeader, Tabs, useToast } from '@/components/kit';
import { Avatar } from '@/components/ui';
import { api, type User } from '@/lib/api';
import { useNav } from '@/lib/nav';

type Person = User & { relation?: string; mutual?: number; city?: string | null; status?: string | null; playing?: { label?: string } | null };
type Tab = 'all' | 'online' | 'requests' | 'outgoing' | 'find';

/** «Друзі»: усі, онлайн, заявки, надіслані й пошук людей — з діями просто на картці. */
export function FriendsPage() {
    const nav = useNav();
    const toast = useToast();
    const [tab, setTab] = useState<Tab>('all');
    const [q, setQ] = useState('');
    const [query, setQuery] = useState('');
    const [people, setPeople] = useState<Person[] | null>(null);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const load = useCallback(async () => {
        setPeople(null);
        const url = tab === 'find' ? `/api/v1/people?q=${encodeURIComponent(query)}` : `/api/v1/friends?tab=${tab}&q=${encodeURIComponent(query)}`;
        const r = await api<{ users: { data: Person[] }; counts?: Record<string, number> }>('GET', url).catch(() => ({ users: { data: [] as Person[] }, counts: undefined }));
        setPeople(r.users.data);
        if (r.counts) setCounts(r.counts);
    }, [tab, query]);
    useEffect(() => {
        void load();
    }, [load]);
    const act = async (method: string, path: string, ok: string): Promise<void> => {
        try {
            await api(method, path);
            toast(ok);
            await load();
        } catch (e) {
            toast((e as Error).message, 'error');
        }
    };
    const message = async (u: Person): Promise<void> => {
        try {
            const r = await api<{ id: number }>('POST', `/api/v1/messages/with/${u.id}`);
            nav.go(`/messages/${r.id}`);
        } catch (e) {
            toast((e as Error).message, 'error');
        }
    };
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title="Друзі"
                subtitle={`${counts.all ?? 0} друзів · ${counts.online ?? 0} онлайн`}
                actions={
                    <form onSubmit={(e) => (e.preventDefault(), setQuery(q.trim()))} className="relative">
                        <Search size={15} className="absolute top-3 left-3 text-white/40" />
                        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'find' ? 'Ім’я чи нік' : 'Пошук серед друзів'} className="!w-64 pl-9" />
                    </form>
                }
            />
            <Tabs
                tabs={[
                    { id: 'all', label: 'Усі', badge: null },
                    { id: 'online', label: 'Онлайн', badge: counts.online },
                    { id: 'requests', label: 'Заявки', badge: counts.requests },
                    { id: 'outgoing', label: 'Надіслані' },
                    { id: 'find', label: 'Знайти людей' },
                ]}
                value={tab}
                onChange={setTab}
            />
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {people === null && <Loading />}
                {people?.length === 0 && <p className="py-12 text-center text-sm text-white/45">{tab === 'requests' ? 'Нових заявок немає.' : tab === 'find' ? 'Введіть ім’я, щоб знайти людей.' : 'Тут поки порожньо.'}</p>}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                    {people?.map((u) => (
                        <div key={u.id} className="flex flex-col rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/[0.07]">
                            <button type="button" onClick={() => u.username && nav.go(`/u/${u.username}`)} className="flex items-center gap-3 text-left">
                                <Avatar user={u} size={52} dot={u.is_online ? 'online' : null} />
                                <span className="min-w-0">
                                    <span className="block truncate font-semibold hover:underline">{u.name}</span>
                                    <span className="block truncate text-xs text-white/45">{u.playing?.label ? `🎮 ${u.playing.label}` : (u.status ?? u.city ?? (u.username ? `@${u.username}` : ''))}</span>
                                    {!!u.mutual && <span className="block text-[11px] text-white/35">{u.mutual} спільних друзів</span>}
                                </span>
                            </button>
                            <div className="mt-3 flex gap-2">
                                {(u.relation === 'friends' || tab === 'all' || tab === 'online') && (
                                    <>
                                        <Button small tone="primary" onClick={() => void message(u)}>
                                            <MessageSquare size={14} /> Написати
                                        </Button>
                                        <Button small onClick={() => window.confirm(`Прибрати ${u.name} з друзів?`) && void act('DELETE', `/api/v1/friends/${u.username}`, 'Прибрано з друзів.')}>
                                            <UserMinus size={14} />
                                        </Button>
                                    </>
                                )}
                                {(u.relation === 'incoming' || tab === 'requests') && (
                                    <>
                                        <Button small tone="ok" onClick={() => void act('POST', `/api/v1/friends/${u.username}/accept`, 'Тепер ви друзі!')}>
                                            <UserCheck size={14} /> Прийняти
                                        </Button>
                                        <Button small tone="danger" onClick={() => void act('DELETE', `/api/v1/friends/${u.username}`, 'Заявку відхилено.')}>
                                            <UserX size={14} />
                                        </Button>
                                    </>
                                )}
                                {(u.relation === 'outgoing' || tab === 'outgoing') && (
                                    <Button small onClick={() => void act('DELETE', `/api/v1/friends/${u.username}`, 'Заявку скасовано.')}>
                                        Скасувати заявку
                                    </Button>
                                )}
                                {tab === 'find' && (!u.relation || u.relation === 'none') && (
                                    <Button small tone="primary" onClick={() => void act('POST', `/api/v1/friends/${u.username}`, 'Заявку надіслано.')}>
                                        <UserPlus size={14} /> Додати
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
