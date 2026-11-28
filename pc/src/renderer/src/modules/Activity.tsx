import { Bell, BellRing } from 'lucide-react';
import type { ReactNode } from 'react';
import { NotchedCard } from '@/components/NotchedCard';
import { Avatar, Empty } from '@/components/ui';
import { ago, api, type User, useLive } from '@/lib/api';

type Notice = { id: string; kind: string; text: string; excerpt?: string | null; url?: string | null; actor?: User | null; created_at?: string; read_at?: string | null };

/** Live Activity: живі сповіщення (лайки, коментарі, заявки, тривоги); «Прочитати все» — у всіх вікнах. */
export function ActivityModule({ header }: { header?: ReactNode }) {
    const { data, error, reload } = useLive<{ notifications: Notice[]; unread: number }>('/api/v1/notifications', 20_000, ['activity']);
    const rows = data?.notifications ?? [];
    const unread = data?.unread ?? 0;
    const readAll = async (): Promise<void> => {
        await api('POST', '/api/v1/notifications/read').catch(() => undefined);
        await reload();
        window.gamecon.sync.emit('activity');
    };
    return (
        <NotchedCard
            title="Сповіщення"
            subtitle="Живі події"
            glow="violet"
            header={header}
            badge={
                <button type="button" onClick={() => void readAll()} title="Прочитати все" className={`no-drag grid h-full w-full place-items-center rounded-full ring-1 ${unread ? 'bg-neon-violet/20 text-neon-violet ring-neon-violet/50' : 'bg-white/5 text-white/50 ring-white/15'}`}>
                    {unread ? <BellRing size={15} strokeWidth={1.6} /> : <Bell size={15} strokeWidth={1.6} />}
                </button>
            }
            badgeWidth={34}
        >
            {rows.length === 0 ? <Empty>{error ?? (data ? 'Нових подій немає.' : 'Завантажуємо…')}</Empty> : null}
            <ul className="space-y-1">
                {rows.slice(0, 30).map((n) => (
                    <li key={n.id} className={`flex items-start gap-2.5 rounded-xl px-2 py-1.5 ${n.read_at ? '' : 'bg-white/[0.04]'}`}>
                        <Avatar user={n.actor ?? { name: 'G' }} size={28} />
                        <span className="min-w-0 flex-1">
                            <span data-selectable className="block text-[13px] leading-snug text-white/85">
                                {n.text}
                            </span>
                            {n.created_at && <span className="text-[11px] text-white/40">{ago(n.created_at)}</span>}
                        </span>
                    </li>
                ))}
            </ul>
        </NotchedCard>
    );
}
