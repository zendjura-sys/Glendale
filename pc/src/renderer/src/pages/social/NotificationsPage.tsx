import { CheckCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button, Loading, PageHeader, useToast, when } from '@/components/kit';
import { Avatar } from '@/components/ui';
import { api, type User } from '@/lib/api';
import { useNav } from '@/lib/nav';
import { hasPage } from '@/pages';

type Notice = { id: string; kind: string; text: string; excerpt: string | null; url: string | null; actor: User | null; actors?: User[]; count?: number; read: boolean; created_at: string };

/** «Сповіщення»: усе, що сталося, з переходом просто в програмі на потрібну сторінку. */
export function NotificationsPage() {
    const nav = useNav();
    const toast = useToast();
    const [list, setList] = useState<Notice[] | null>(null);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const load = useCallback(async () => {
        const r = await api<{ notifications: Notice[] }>('GET', '/api/v1/notifications').catch(() => ({ notifications: [] as Notice[] }));
        setList(r.notifications);
    }, []);
    useEffect(() => {
        void load();
    }, [load]);
    const readAll = async (): Promise<void> => {
        await api('POST', '/api/v1/notifications/read').then(() => toast('Усе прочитано.'), () => undefined);
        window.gamecon.sync.emit('notifications');
        await load();
    };
    const shown = (list ?? []).filter((n) => filter === 'all' || !n.read);
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title="Сповіщення"
                subtitle={`${(list ?? []).filter((n) => !n.read).length} нових`}
                actions={
                    <Button onClick={() => void readAll()}>
                        <CheckCheck size={16} /> Прочитати все
                    </Button>
                }
            />
            <div className="mx-auto flex w-full max-w-3xl gap-1.5 px-5 pb-3 min-[820px]:px-0">
                <Button small tone={filter === 'all' ? 'primary' : 'ghost'} onClick={() => setFilter('all')}>
                    Усі
                </Button>
                <Button small tone={filter === 'unread' ? 'primary' : 'ghost'} onClick={() => setFilter('unread')}>
                    Непрочитані
                </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
                <div className="mx-auto max-w-3xl space-y-1.5">
                    {list === null && <Loading />}
                    {shown.length === 0 && list !== null && <p className="py-12 text-center text-sm text-white/45">Поки тихо.</p>}
                    {shown.map((n) => {
                        const target = n.url && !n.url.startsWith('http') ? n.url : null;
                        const open = hasPage(target);
                        return (
                            <button
                                key={n.id}
                                type="button"
                                disabled={!open}
                                onClick={() => open && nav.go(target)}
                                className={`flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition ${n.read ? 'bg-white/[0.02] ring-white/[0.05]' : 'bg-neon-violet/[0.07] ring-neon-violet/20'} ${open ? 'hover:bg-white/[0.06]' : 'cursor-default'}`}
                            >
                                <Avatar user={n.actor ?? { name: 'G' }} size={40} />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[14px] text-white/90">{n.text}</span>
                                    {n.excerpt && <span className="mt-0.5 line-clamp-2 block text-[13px] text-white/50">{n.excerpt}</span>}
                                    <span className="mt-1 block text-[11px] text-white/35">{when(n.created_at)}</span>
                                </span>
                                {!n.read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-neon-violet shadow-[0_0_8px_#a855f7]" />}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
