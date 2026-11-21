import { Link, router } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { Headphones } from 'lucide-react';
import { playFrom } from '@/lib/player';
import type { TrackCard, UserCard } from '@/types';

type Contact = UserCard & {
    chat_id: number | null;
    unread: number;
    /** Що друг слухає зараз: трек і секунда, з якої «Слухати разом». */
    listening?: { track: TrackCard; position: number } | null;
};

export type RailData = {
    me?: {
        level: number | null;
        streak: number | null;
        reward?: boolean;
        family: {
            name: string;
            href: string;
            tag?: string;
            nickname?: string;
            rank?: number;
            rank_title?: string;
            balance?: number;
            warns?: number;
            warn_limit?: number;
            server?: string | null;
        } | null;
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
    season?: {
        title: string;
        level: number;
        into: number;
        need: number;
        max_level: number;
    } | null;
    servers?: {
        id: number;
        name: string;
        href: string;
        tagline: string | null;
        website: string | null;
        online: number;
        max: number | null;
        featured: boolean;
    }[];
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
                    <div key={user.id} className="gc-solid rounded-2xl p-4">
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
                                className="h-9 rounded-xl text-sm font-semibold text-white/80 hover:bg-[var(--gc-l3)]"
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
/**
 * Контакти горизонтально (блок лобі): аватар зверху, ім’я під ним в одну лінію (не виходить за межі),
 * непрочитане — значок на аватарі, «слухає» — нотка. Гортається вбік.
 */
export function ContactsRow({ data }: { data: RailData }) {
    if (data.contacts.length === 0) return null;

    return (
        <section className="p-4">
            <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
                {tr('Контакти')}
                <span className="text-sm font-normal text-[var(--gc-text-2)] tabular-nums">
                    {data.contacts_total}
                </span>
            </h3>
            <ul className="gc-contacts-row">
                {data.contacts.map((contact) => (
                    <li key={contact.id}>
                        <Link
                            href={
                                contact.chat_id
                                    ? `/messages/${contact.chat_id}`
                                    : `/${contact.username}`
                            }
                            className="gc-contacts-row__item"
                            title={contact.name}
                        >
                            <span className="relative">
                                <UserAvatar user={contact} size="lg" />
                                {contact.unread > 0 && (
                                    <span className="gc-contacts-row__unread">
                                        {contact.unread}
                                    </span>
                                )}
                            </span>
                            <span className="gc-contacts-row__name">
                                {contact.first_name || contact.name}
                            </span>
                            {contact.listening && (
                                <span
                                    className="gc-contacts-row__listen"
                                    aria-label={tr('Слухає музику')}
                                >
                                    ♪
                                </span>
                            )}
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export function Contacts({ data }: { data: RailData }) {
    if (data.contacts.length === 0) return null;

    return (
        <section>
            <Heading title={tr('Контакти')} count={data.contacts_total} />
            <div className="gc-solid space-y-0.5 rounded-2xl p-2">
                {data.contacts.map((contact) => (
                    <div
                        key={contact.id}
                        className="flex items-center gap-1 rounded-xl transition hover:bg-[var(--gc-l3)]"
                    >
                        <Link
                            href={
                                contact.chat_id
                                    ? `/messages/${contact.chat_id}`
                                    : `/${contact.username}`
                            }
                            className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-sm font-medium text-white"
                        >
                            <UserAvatar user={contact} size="sm" />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate">
                                    {contact.name}
                                </span>
                                {contact.listening && (
                                    <span className="block truncate text-xs font-normal text-primary">
                                        ♪ {contact.listening.track.title} —{' '}
                                        {contact.listening.track.artist}
                                    </span>
                                )}
                            </span>
                            {contact.unread > 0 && (
                                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white tabular-nums">
                                    {contact.unread}
                                </span>
                            )}
                        </Link>
                        {contact.listening && (
                            <button
                                type="button"
                                onClick={() =>
                                    void playFrom(
                                        [contact.listening!.track],
                                        0,
                                        contact.listening!.position,
                                        true,
                                        {
                                            label: tr('Разом з {name}', {
                                                name:
                                                    contact.first_name ||
                                                    contact.name,
                                            }),
                                            href: `/${contact.username}`,
                                        },
                                    )
                                }
                                aria-label={tr('Слухати разом з {name}', {
                                    name: contact.name,
                                })}
                                title={tr('Слухати разом')}
                                className="mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-primary hover:bg-white/[0.08]"
                            >
                                <Headphones className="size-4" />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
