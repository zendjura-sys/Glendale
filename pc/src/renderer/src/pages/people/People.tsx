import { Check, MapPin, MessageSquare, Search, UserPlus, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Card, Input, Loading, PageHeader, StatTile, useToast } from '@/components/kit';
import { Avatar } from '@/components/ui';
import { api, type User } from '@/lib/api';
import { useNav } from '@/lib/nav';

type Person = User & {
    city: string | null;
    status?: string | null;
    relation: 'none' | 'friends' | 'incoming' | 'outgoing' | string;
    mutual: number;
    playing?: { name?: string } | string | null;
    live?: boolean;
};
type Result = { users: { data: Person[]; current_page: number; last_page: number; total: number } };

/** «Пошук людей»: ім’я, місто, стать, онлайн — і одразу «Додати в друзі» чи «Написати». */
export function PeoplePage() {
    const nav = useNav();
    const toast = useToast();
    const [f, setF] = useState({ q: '', city: '', gender: '', online: false });
    const [query, setQuery] = useState(f);
    const [page, setPage] = useState(1);
    const [data, setData] = useState<Result | null>(null);
    const [error, setError] = useState<string | null>(null);
    const load = async (): Promise<void> => {
        const qs = new URLSearchParams({
            page: String(page),
            ...(query.q && { q: query.q }),
            ...(query.city && { city: query.city }),
            ...(query.gender && { gender: query.gender }),
            ...(query.online && { online: '1' }),
        });
        try {
            setData(await api<Result>('GET', `/api/v1/people?${qs}`));
        } catch (e) {
            setError((e as Error).message);
        }
    };
    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, page]);
    const act = async (method: string, path: string, ok: string): Promise<void> => {
        try {
            await api(method, path);
            toast(ok);
            await load();
        } catch (e) {
            toast((e as Error).message, 'error');
        }
    };
    const apply = (next = f): void => {
        setQuery(next);
        setPage(1);
    };
    const users = data?.users.data ?? [];
    const pill = (on: boolean): string => `h-10 rounded-xl px-3.5 text-sm ring-1 transition ${on ? 'bg-white/10 text-white ring-white/25' : 'text-white/60 ring-white/10 hover:bg-white/5'}`;
    return (
        <div className="flex h-full flex-col">
            <PageHeader title="Пошук людей" subtitle={data ? `Знайдено ${data.users.total}` : 'Знайдіть друзів і тиммейтів'} />
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] gap-5 overflow-y-auto p-5 max-[1100px]:grid-cols-1">
                <div className="min-w-0">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            apply();
                        }}
                        className="mb-4 flex flex-wrap gap-2"
                    >
                        <div className="relative min-w-60 flex-1">
                            <Search size={15} className="absolute top-3 left-3 text-white/40" />
                            <Input value={f.q} placeholder="Ім’я або нік" onChange={(e) => setF({ ...f, q: e.target.value })} className="pl-9" />
                        </div>
                        <div className="relative w-48">
                            <MapPin size={15} className="absolute top-3 left-3 text-white/40" />
                            <Input value={f.city} placeholder="Місто" onChange={(e) => setF({ ...f, city: e.target.value })} className="pl-9" />
                        </div>
                        <Button type="submit" tone="primary">
                            Знайти
                        </Button>
                    </form>
                    <div className="mb-4 flex flex-wrap gap-1.5">
                        {[
                            ['', 'Усі'],
                            ['female', 'Дівчата'],
                            ['male', 'Хлопці'],
                        ].map(([k, l]) => (
                            <button key={k} type="button" className={pill(f.gender === k)} onClick={() => (setF({ ...f, gender: k }), apply({ ...f, gender: k }))}>
                                {l}
                            </button>
                        ))}
                        <button type="button" className={pill(f.online)} onClick={() => (setF({ ...f, online: !f.online }), apply({ ...f, online: !f.online }))}>
                            <span className="mr-1.5 inline-block size-2 rounded-full bg-emerald-400" /> Зараз онлайн
                        </button>
                    </div>
                    {!data && <Loading error={error} />}
                    {data && users.length === 0 && (
                        <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
                            <Users size={34} className="mb-3 text-white/25" />
                            <p className="font-semibold">Нікого не знайдено</p>
                            <p className="mt-1 text-sm text-white/45">Спробуйте інше ім’я чи місто або приберіть фільтри.</p>
                        </div>
                    )}
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
                        {users.map((u) => (
                            <div key={u.id} className="flex flex-col rounded-2xl bg-white/[0.04] p-3.5 ring-1 ring-white/10">
                                <button type="button" onClick={() => u.username && nav.go(`/u/${u.username}`)} className="flex items-center gap-3 text-left">
                                    <Avatar user={u} size={48} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-semibold">{u.name}</span>
                                        <span className="block truncate text-xs text-white/45">
                                            {u.is_online ? <span className="text-emerald-300">онлайн</span> : `@${u.username}`}
                                            {u.city ? ` · ${u.city}` : ''}
                                        </span>
                                    </span>
                                </button>
                                {u.status && <p className="mt-2 line-clamp-2 text-sm text-white/60">{u.status}</p>}
                                {u.mutual > 0 && <p className="mt-1 text-xs text-neon-cyan">{u.mutual} спільних друзів</p>}
                                <div className="mt-auto flex gap-2 pt-3">
                                    {u.relation === 'friends' && (
                                        <span className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-400/10 text-xs text-emerald-300">
                                            <Check size={13} /> Друзі
                                        </span>
                                    )}
                                    {u.relation === 'incoming' && (
                                        <>
                                            <Button small tone="ok" onClick={() => void act('POST', `/api/v1/friends/${u.username}/accept`, 'Тепер ви друзі!')}>
                                                <Check size={13} /> Прийняти
                                            </Button>
                                            <Button small onClick={() => void act('DELETE', `/api/v1/friends/${u.username}`, 'Заявку відхилено.')}>
                                                <X size={13} />
                                            </Button>
                                        </>
                                    )}
                                    {u.relation === 'outgoing' && (
                                        <Button small onClick={() => void act('DELETE', `/api/v1/friends/${u.username}`, 'Заявку скасовано.')}>
                                            Скасувати заявку
                                        </Button>
                                    )}
                                    {(u.relation === 'none' || !u.relation) && (
                                        <Button small tone="primary" onClick={() => void act('POST', `/api/v1/friends/${u.username}`, 'Заявку надіслано.')}>
                                            <UserPlus size={13} /> Додати
                                        </Button>
                                    )}
                                    <Button small onClick={() => u.username && nav.go(`/u/${u.username}`)}>
                                        <MessageSquare size={13} />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {data && data.users.last_page > 1 && (
                        <div className="mt-5 flex items-center justify-center gap-2 text-sm">
                            <Button small disabled={page <= 1} onClick={() => setPage(page - 1)}>
                                ←
                            </Button>
                            {page} / {data.users.last_page}
                            <Button small disabled={page >= data.users.last_page} onClick={() => setPage(page + 1)}>
                                →
                            </Button>
                        </div>
                    )}
                </div>
                <aside className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <StatTile label="Знайдено" value={data?.users.total ?? '—'} accent />
                        <StatTile label="Онлайн тут" value={users.filter((u) => u.is_online).length} />
                    </div>
                    {users.some((u) => u.relation === 'incoming') && (
                        <Card title="Хочуть дружити">
                            {users
                                .filter((u) => u.relation === 'incoming')
                                .map((u) => (
                                    <div key={u.id} className="flex items-center gap-2 py-1">
                                        <Avatar user={u} size={28} />
                                        <span className="flex-1 truncate text-sm">{u.name}</span>
                                        <Button small tone="ok" onClick={() => void act('POST', `/api/v1/friends/${u.username}/accept`, 'Тепер ви друзі!')}>
                                            <Check size={13} />
                                        </Button>
                                    </div>
                                ))}
                        </Card>
                    )}
                    <Card title="Порада">
                        <p className="text-sm text-white/55">Шукаєте команду під конкретну гру? Спробуйте «Підбір тиммейтів» у «Пошуку паті» — там враховуються ігри, час і мова.</p>
                        <div className="mt-3">
                            <Button small onClick={() => nav.go('/party')}>
                                Відкрити підбір
                            </Button>
                        </div>
                    </Card>
                </aside>
            </div>
        </div>
    );
}
