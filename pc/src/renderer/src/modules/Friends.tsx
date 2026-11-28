import { Gamepad2, Radio } from 'lucide-react';
import type { ReactNode } from 'react';
import { NotchBadge, NotchedCard } from '@/components/NotchedCard';
import { Avatar, Empty } from '@/components/ui';
import { type User, useLive } from '@/lib/api';

type Friend = User & { playing?: { label?: string } | null };
type Pulse = { friends_online: number; playing: { name: string; label: string | null }[] };
type Cast = { live: number; listeners: number };

/** Друзі онлайн і голос: хто в мережі, хто в грі, живі голосові кімнати GameCast. */
export function FriendsModule({ header }: { header?: ReactNode }) {
    const online = useLive<{ users: { data: Friend[] } }>('/api/v1/friends?tab=online', 30_000, ['friends']);
    const pulse = useLive<Pulse>('/api/v1/me/pulse-widget', 30_000);
    const cast = useLive<Cast>('/api/v1/site/shows/pulse', 30_000);
    const friends = online.data?.users?.data ?? [];
    const playing = new Map((pulse.data?.playing ?? []).map((p) => [p.name, p.label]));
    return (
        <NotchedCard title="Друзі" subtitle="Хто зараз у мережі й голос" glow="blue" header={header} badge={<NotchBadge tone={friends.length ? 'cyan' : 'muted'}>{friends.length}</NotchBadge>} badgeWidth={44}>
            {friends.length === 0 ? <Empty>{online.error ?? (online.data ? 'Зараз ніхто з друзів не в мережі.' : 'Завантажуємо…')}</Empty> : null}
            <ul className="space-y-1">
                {friends.map((f) => {
                    const game = f.playing?.label ?? playing.get(f.first_name ?? f.name) ?? null;
                    return (
                        <li key={f.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
                            <Avatar user={f} size={32} dot="online" />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold">{f.name}</span>
                                <span className={`flex items-center gap-1 truncate text-xs ${game ? 'text-neon-cyan' : 'text-white/45'}`}>
                                    {game && <Gamepad2 size={12} strokeWidth={1.6} />}
                                    {game ?? 'В мережі'}
                                </span>
                            </span>
                        </li>
                    );
                })}
            </ul>
            <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/5">
                <Radio size={16} strokeWidth={1.6} className={cast.data?.live ? 'text-rose-400' : 'text-white/40'} />
                <span className="min-w-0 flex-1 text-xs text-white/70">
                    {cast.data?.live ? `GameCast: ${cast.data.live} в ефірі · ${cast.data.listeners} слухають` : 'GameCast: зараз тихо'}
                </span>
            </div>
        </NotchedCard>
    );
}
