import { Link, router } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

type Contact = UserCard & { chat_id: number | null; unread: number };

export type RailData = {
    me?: {
        level: number | null;
        streak: number | null;
        family: { name: string; href: string } | null;
        track: {
            id: number;
            title: string;
            artist?: string | null;
            cover_url?: string | null;
        } | null;
        playing: { label: string; icon?: string | null } | null;
    };
    voice?: {
        id: number;
        name: string;
        owner: string;
        href: string;
        count: number;
        people: UserCard[];
    }[];
    in_game?: (UserCard & { playing: { label: string } | null })[];
    requests: UserCard[];
    requests_total: number;
    contacts: Contact[];
    contacts_total: number;
};

/** Дані бічної колонки (/me/rail), оновлення раз на хвилину. */
export function useRail(enabled = true) {
    const [data, setData] = useState<RailData | null>(null);
    const load = useCallback(
        () =>
            api<RailData>('GET', '/me/rail')
                .then(setData)
                .catch(() => undefined),
        [],
    );
    useEffect(() => {
        if (!enabled) return;
        void load();
        const timer = window.setInterval(() => void load(), 60_000);
        return () => window.clearInterval(timer);
    }, [enabled, load]);

    return { data, reload: load };
}

function Heading({ title, count }: { title: string; count: number }) {
    return (
        <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold tracking-wide text-white/45 uppercase">
                {title}
            </h3>
            {count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--vkui--color_background_accent)] px-1.5 text-[11px] font-bold text-white tabular-nums">
                    {count}
                </span>
            )}
        </div>
    );
}

/** Заявки в друзі: картка на кожну заявку з «Прийняти» / «Відхилити» (як у Spacepark). */
export function FriendRequests({
    data,
    reload,
}: {
    data: RailData;
    reload: () => void;
}) {
    if (data.requests.length === 0) return null;
    const act = (user: UserCard, accept: boolean) =>
        accept
            ? router.post(
                  `/friends/${user.username}/accept`,
                  {},
                  { preserveScroll: true, onFinish: reload },
              )
            : router.delete(`/friends/${user.username}`, {
                  preserveScroll: true,
                  onFinish: reload,
              });

    return (
        <section>
            <Heading title={tr('Заявки')} count={data.requests_total} />
            <div className="space-y-3">
                {data.requests.map((user) => (
                    <div key={user.id} className="glass rounded-2xl p-4">
                        <p className="flex items-start gap-3 text-sm text-white/60">
                            <UserAvatar user={user} size="sm" />
                            <span>
                                <Link
                                    href={`/${user.username}`}
                                    className="font-semibold text-white hover:underline"
                                >
                                    {user.name}
                                </Link>{' '}
                                {tr('хоче додати вас у друзі')}
                            </span>
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => act(user, true)}
                                className="btn-glow h-9 rounded-xl text-sm font-semibold"
                            >
                                {tr('Прийняти')}
                            </button>
                            <button
                                type="button"
                                onClick={() => act(user, false)}
                                className="h-9 rounded-xl border border-white/10 text-sm font-semibold text-white/80 hover:bg-white/[0.05]"
                            >
                                {tr('Відхилити')}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

/** Контакти: друзі (спершу ті, хто був у мережі нещодавно) з лічильником непрочитаних — відкриває чат. */
export function Contacts({ data }: { data: RailData }) {
    if (data.contacts.length === 0) return null;

    return (
        <section>
            <Heading title={tr('Контакти')} count={data.contacts_total} />
            <div className="glass space-y-0.5 rounded-2xl p-2">
                {data.contacts.map((contact) => (
                    <Link
                        key={contact.id}
                        href={
                            contact.chat_id
                                ? `/messages/${contact.chat_id}`
                                : `/${contact.username}`
                        }
                        className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm font-medium text-white transition hover:bg-white/[0.05]"
                    >
                        <UserAvatar user={contact} size="sm" />
                        <span className="min-w-0 flex-1 truncate">
                            {contact.name}
                        </span>
                        {contact.unread > 0 && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white tabular-nums">
                                {contact.unread}
                            </span>
                        )}
                    </Link>
                ))}
            </div>
        </section>
    );
}
