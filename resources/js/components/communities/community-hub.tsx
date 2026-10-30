import { Link } from '@inertiajs/react';
import { BookOpenText, CalendarDays, Medal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { Widget } from '@/components/gc/widget';
import { api } from '@/lib/api';
import { LOCALE, tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

export type CommunityEventItem = {
    id: number;
    title: string;
    description: string | null;
    place: string | null;
    starts_at: string;
    ends_at: string | null;
    going: number;
    my: 'going' | 'maybe' | null;
    stories: number;
};

type Hub = {
    events: CommunityEventItem[] | null;
    wiki: number | null;
    top: (UserCard & { points: number })[] | null;
    can_manage: boolean;
};

export function eventWhen(iso: string): string {
    return new Date(iso).toLocaleString(LOCALE, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Бічний блок спільноти: найближчі події, вікі й найактивніші учасники. */
export function CommunityHub({ slug }: { slug: string }) {
    const [hub, setHub] = useState<Hub | null>(null);

    useEffect(() => {
        void api<Hub>('GET', `/c/${slug}/hub`)
            .then(setHub)
            .catch(() => undefined);
    }, [slug]);

    if (!hub) return null;
    const showEvents =
        hub.events !== null && (hub.events.length > 0 || hub.can_manage);
    const showWiki = hub.wiki !== null && (hub.wiki > 0 || hub.can_manage);

    return (
        <>
            {showEvents && (
                <Widget
                    title={tr('Події')}
                    icon={CalendarDays}
                    action={
                        <Link
                            href={`/c/${slug}/calendar`}
                            className="text-xs text-gc-lilac-300 hover:text-white"
                        >
                            {tr('Календар')}
                        </Link>
                    }
                >
                    {hub.events!.length === 0 ? (
                        <p className="px-1 text-sm text-white/50">
                            {tr(
                                'Подій поки немає — додайте першу в календарі.',
                            )}
                        </p>
                    ) : (
                        <ul className="space-y-2 px-1">
                            {hub.events!.map((e) => (
                                <li key={e.id}>
                                    <Link
                                        href={`/c/${slug}/calendar?event=${e.id}`}
                                        className="block rounded-xl bg-white/[0.04] p-2.5 transition hover:bg-white/[0.07]"
                                    >
                                        <span className="block truncate text-sm font-medium text-white">
                                            {e.title}
                                        </span>
                                        <span className="text-xs text-white/45">
                                            {eventWhen(e.starts_at)}
                                            {e.going > 0 &&
                                                ` · ${tr('буде {count}', { count: e.going })}`}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Widget>
            )}
            {showWiki && (
                <Link
                    href={`/c/${slug}/wiki`}
                    className="glass flex items-center gap-3 rounded-2xl p-4 transition hover:bg-white/[0.06]"
                >
                    <BookOpenText className="size-5 text-gc-lilac-300" />
                    <span className="flex-1 text-sm font-medium text-white">
                        {tr('Вікі спільноти')}
                    </span>
                    <span className="text-xs text-white/45">
                        {hub.wiki
                            ? tr('{count} стор.', { count: hub.wiki })
                            : tr('Почати')}
                    </span>
                </Link>
            )}
            {hub.top && hub.top.length > 0 && (
                <Widget title={tr('Найактивніші')} icon={Medal}>
                    <ol className="space-y-1.5 px-1">
                        {hub.top.map((m, i) => (
                            <li key={m.id}>
                                <Link
                                    href={`/${m.username}`}
                                    className="flex items-center gap-2.5 text-sm text-white/85 hover:text-white"
                                >
                                    <span className="w-4 text-center text-xs text-white/40 tabular-nums">
                                        {i + 1}
                                    </span>
                                    <UserAvatar user={m} size="xs" />
                                    <span className="min-w-0 flex-1 truncate">
                                        {m.name}
                                    </span>
                                    <span className="text-xs text-gc-lilac-300 tabular-nums">
                                        {m.points}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ol>
                </Widget>
            )}
        </>
    );
}
