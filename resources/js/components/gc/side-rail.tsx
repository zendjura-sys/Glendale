import { Link, usePage } from '@inertiajs/react';
import { MessageCircle, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { Widget } from '@/components/gc/widget';
import { RailWidgets } from '@/components/feed/side-widgets';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { GC_4K } from '@/lib/shell-breakpoints';
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

/**
 * Четверта колонка на 4K+.
 * На /feed і кіно — онлайн + повідомлення (третя колонка там своя).
 * На решті сайту ContextRail уже має соцвіджети — тут лише зайві блоки.
 */
export function SideRail() {
    const { url } = usePage();
    const [data, setData] = useState<Rail | null>(null);
    const [wide, setWide] = useState(false);
    const ownThird =
        url.startsWith('/feed') ||
        url.startsWith('/cinema') ||
        url.startsWith('/movies');

    useEffect(() => {
        const query = window.matchMedia(GC_4K);
        const sync = () => setWide(query.matches);
        sync();
        query.addEventListener('change', sync);
        return () => query.removeEventListener('change', sync);
    }, []);

    useEffect(() => {
        if (!wide || !ownThird) return;
        const load = () =>
            api<Rail>('GET', '/me/rail')
                .then(setData)
                .catch(() => undefined);
        void load();
        const timer = window.setInterval(load, 60_000);
        return () => window.clearInterval(timer);
    }, [wide, ownThird]);

    if (!wide) return null;

    return (
        <aside
            aria-label={tr('Додаткові віджети')}
            className="gc-split-hide gc-col-ultra sticky top-[calc(88px+env(safe-area-inset-top))] h-fit w-[300px] shrink-0 space-y-4 min-[3000px]:w-[320px]"
        >
            {ownThird && (
                <>
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
                                    className="flex items-center gap-2.5 rounded-xl px-1 py-1.5 text-sm text-white/85 transition hover:bg-[var(--gc-l3)] hover:text-white"
                                >
                                    <UserAvatar user={friend} size="sm" />
                                    <span className="truncate">
                                        {friend.name}
                                    </span>
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
                                        className="flex items-center gap-2.5 rounded-xl px-1 py-1.5 text-sm text-white/85 transition hover:bg-[var(--gc-l3)] hover:text-white"
                                    >
                                        {chat.peer ? (
                                            <UserAvatar
                                                user={chat.peer}
                                                size="sm"
                                            />
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
                </>
            )}
            <RailWidgets />
        </aside>
    );
}
