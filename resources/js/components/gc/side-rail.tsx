import { Link } from '@inertiajs/react';
import { MessageCircle, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { Widget } from '@/components/gc/widget';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

type Rail = {
    online: UserCard[];
    chats: {
        id: number;
        title: string;
        avatar_url: string | null;
        peer: UserCard | null;
        unread: number;
    }[];
};

const WIDE = '(min-width: 2400px)';

/**
 * Четверта колонка на великих екранах (2K і більше): друзі онлайн і останні бесіди.
 * Дані підтягуються лише тоді, коли колонку справді видно, й оновлюються раз на хвилину.
 */
export function SideRail() {
    const [data, setData] = useState<Rail | null>(null);
    const [wide, setWide] = useState(false);

    useEffect(() => {
        const query = window.matchMedia(WIDE);
        const sync = () => setWide(query.matches);
        sync();
        query.addEventListener('change', sync);
        return () => query.removeEventListener('change', sync);
    }, []);

    useEffect(() => {
        if (!wide) return;
        const load = () =>
            api<Rail>('GET', '/me/rail')
                .then(setData)
                .catch(() => undefined);
        void load();
        const timer = window.setInterval(load, 60_000);
        return () => window.clearInterval(timer);
    }, [wide]);

    if (!wide) return null;

    return (
        <aside className="gc-split-hide sticky top-[calc(88px+env(safe-area-inset-top))] h-fit w-[300px] shrink-0 space-y-4">
            <Widget
                title={tr('Зараз онлайн')}
                icon={Radio}
                href="/friends?tab=online"
            >
                {data && data.online.length === 0 && (
                    <p className="px-1 text-sm text-white/45">
                        {tr('Ніхто з друзів зараз не в мережі.')}
                    </p>
                )}
                <div className="space-y-1">
                    {data?.online.map((friend) => (
                        <Link
                            key={friend.id}
                            href={`/${friend.username}`}
                            className="flex items-center gap-2.5 rounded-xl px-1 py-1.5 text-sm text-white/85 transition hover:bg-white/[0.05] hover:text-white"
                        >
                            <UserAvatar user={friend} size="sm" />
                            <span className="truncate">{friend.name}</span>
                        </Link>
                    ))}
                </div>
            </Widget>
            {data && data.chats.length > 0 && (
                <Widget
                    title={tr('Повідомлення')}
                    icon={MessageCircle}
                    href="/messages"
                >
                    <div className="space-y-1">
                        {data.chats.map((chat) => (
                            <Link
                                key={chat.id}
                                href={`/messages/${chat.id}`}
                                className="flex items-center gap-2.5 rounded-xl px-1 py-1.5 text-sm text-white/85 transition hover:bg-white/[0.05] hover:text-white"
                            >
                                {chat.peer ? (
                                    <UserAvatar user={chat.peer} size="sm" />
                                ) : (
                                    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-xs font-semibold">
                                        {chat.avatar_url ? (
                                            <img
                                                src={chat.avatar_url}
                                                alt=""
                                                className="size-full object-cover"
                                            />
                                        ) : (
                                            chat.title.slice(0, 1)
                                        )}
                                    </span>
                                )}
                                <span className="min-w-0 flex-1 truncate">
                                    {chat.title}
                                </span>
                                {chat.unread > 0 && (
                                    <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white tabular-nums">
                                        {chat.unread}
                                    </span>
                                )}
                            </Link>
                        ))}
                    </div>
                </Widget>
            )}
        </aside>
    );
}
