import { Link, usePage } from '@inertiajs/react';
import { Crown, MessageCircle, Radio } from 'lucide-react';
import { FeedSideCards, useHub } from '@/components/gc/feed-pulse';
import {
    Contacts,
    FriendRequests,
    useRail,
} from '@/components/gc/rail-widgets';
import { UserAvatar } from '@/components/gc/user-avatar';
import { Widget } from '@/components/gc/widget';
import {
    SideWidgets,
    useMedia,
    useSideWidgets,
    WIDGET_ORDER,
} from '@/components/feed/side-widgets';
import { tr } from '@/lib/i18n';
import { GC_4K, GC_FHD } from '@/lib/shell-breakpoints';

/**
 * Третя колонка оболонки з FHD (весь сайт).
 * На /feed і кіно свій aside у сторінці — тут не дублюємо.
 */
export function ContextRail() {
    const { url } = usePage();
    const fhd = useMedia(GC_FHD);
    const four = useMedia(GC_4K);
    const ownAside =
        url.startsWith('/feed') ||
        url.startsWith('/cinema') ||
        url.startsWith('/movies');

    const enabled = fhd && !ownAside;
    const { data: rail, reload } = useRail(enabled);
    const hub = useHub(enabled);
    const widgets = useSideWidgets(enabled);

    if (!enabled) return null;

    const widgetKeys = four
        ? (['gamecast', 'music'] as const)
        : WIDGET_ORDER.filter((k) => k !== 'continue');

    const chats = rail?.chats ?? [];
    const online = rail?.online ?? [];

    return (
        <aside
            aria-label={tr('Віджети')}
            className="gc-split-hide gc-col-context sticky top-[calc(88px+env(safe-area-inset-top))] hidden h-fit w-[300px] shrink-0 space-y-4 min-[1920px]:block min-[2560px]:w-[340px] min-[3000px]:w-[320px]"
        >
            {rail && (
                <>
                    <FriendRequests data={rail} reload={reload} />
                    <Contacts data={rail} />
                </>
            )}
            {rail?.me?.family && (
                <Widget
                    title={tr('Моя сім’я')}
                    icon={Crown}
                    href={rail.me.family.href}
                >
                    <Link
                        href={rail.me.family.href}
                        className="flex items-center gap-2.5 rounded-xl px-1 py-1.5 text-sm text-white/85 transition hover:bg-[var(--gc-l3)] hover:text-white"
                    >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-xs font-bold text-amber-400">
                            {rail.me.family.tag ?? 'F'}
                        </span>
                        <span className="min-w-0">
                            <span className="block truncate font-semibold text-white">
                                {rail.me.family.name}
                            </span>
                            <span className="block truncate text-xs text-white/45">
                                {rail.me.family.rank_title ??
                                    rail.me.family.nickname ??
                                    tr('Відкрити')}
                            </span>
                        </span>
                    </Link>
                </Widget>
            )}
            {chats.length > 0 && (
                <Widget
                    title={tr('Повідомлення')}
                    icon={MessageCircle}
                    href="/messages"
                >
                    <div className="space-y-1">
                        {chats.slice(0, 6).map((chat) => (
                            <Link
                                key={chat.id}
                                href={`/messages/${chat.id}`}
                                className="flex items-center gap-2.5 rounded-xl px-1 py-1.5 text-sm text-white/85 transition hover:bg-[var(--gc-l3)] hover:text-white"
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
            {online.length > 0 && (
                <Widget
                    title={tr('Зараз онлайн')}
                    icon={Radio}
                    href="/friends?tab=online"
                >
                    <div className="space-y-1">
                        {online.slice(0, 8).map((friend) => (
                            <Link
                                key={friend.id}
                                href={`/${friend.username}`}
                                className="flex items-center gap-2.5 rounded-xl px-1 py-1.5 text-sm text-white/85 transition hover:bg-[var(--gc-l3)] hover:text-white"
                            >
                                <UserAvatar user={friend} size="sm" />
                                <span className="truncate">{friend.name}</span>
                            </Link>
                        ))}
                    </div>
                </Widget>
            )}
            <FeedSideCards rail={rail} hub={hub} />
            <SideWidgets
                data={widgets}
                only={widgetKeys}
                className="space-y-4"
            />
        </aside>
    );
}
