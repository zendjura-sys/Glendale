import { Deferred, Head, InfiniteScroll, Link, router } from '@inertiajs/react';
import { Inbox, Radio, Search, Send, Sparkles, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PersonCard } from '@/components/gc/person-card';
import { EmptyState, Widget, WidgetSkeleton } from '@/components/gc/widget';
import { cn } from '@/lib/utils';
import type { PersonCard as Person, ScrollData } from '@/types';

type Tab = 'all' | 'online' | 'requests' | 'outgoing';

type Props = {
    tab: Tab;
    q: string;
    users: ScrollData<Person>;
    counts: Record<Tab, number>;
    suggestions?: Person[];
};

const tabs: { key: Tab; label: string; icon: typeof UsersRound }[] = [
    { key: 'all', label: 'Усі друзі', icon: UsersRound },
    { key: 'online', label: 'Онлайн', icon: Radio },
    { key: 'requests', label: 'Заявки', icon: Inbox },
    { key: 'outgoing', label: 'Надіслані', icon: Send },
];

const empty: Record<Tab, { title: string; text: string }> = {
    all: {
        title: 'У вас поки немає друзів',
        text: 'Знайдіть знайомих через пошук або подивіться рекомендації нижче.',
    },
    online: {
        title: 'Ніхто не онлайн',
        text: 'Коли друзі зайдуть у мережу, вони з’являться тут.',
    },
    requests: {
        title: 'Нових заявок немає',
        text: 'Коли хтось захоче додати вас у друзі, заявка з’явиться тут.',
    },
    outgoing: {
        title: 'Немає надісланих заявок',
        text: 'Заявки, які ви надіслали, чекають тут на відповідь.',
    },
};

export default function Friends({ tab, q, users, counts, suggestions }: Props) {
    const [search, setSearch] = useState(q);

    useEffect(() => {
        if (search === q) return;
        const timer = setTimeout(() => {
            router.get(
                '/friends',
                {
                    tab: tab === 'all' ? undefined : tab,
                    q: search || undefined,
                },
                { preserveState: true, replace: true },
            );
        }, 300);

        return () => clearTimeout(timer);
    }, [search, q, tab]);

    return (
        <>
            <Head title="Друзі" />
            <div className="space-y-5">
                <div className="glass flex flex-col gap-3 rounded-3xl p-3 md:flex-row md:items-center">
                    <div className="scrollbar-none flex gap-1 overflow-x-auto">
                        {tabs.map((item) => (
                            <Link
                                key={item.key}
                                href={
                                    item.key === 'all'
                                        ? '/friends'
                                        : `/friends?tab=${item.key}`
                                }
                                className={cn(
                                    'flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition',
                                    tab === item.key
                                        ? 'nav-active text-white'
                                        : 'text-white/55 hover:bg-white/[0.04] hover:text-white',
                                )}
                            >
                                <item.icon
                                    className={cn(
                                        'size-4',
                                        tab === item.key && 'text-[#8fa0ff]',
                                    )}
                                />
                                {item.label}
                                <span
                                    className={cn(
                                        'rounded-full px-1.5 text-[11px] leading-5 tabular-nums',
                                        item.key === 'requests' &&
                                            counts.requests > 0
                                            ? 'bg-gradient-brand text-white'
                                            : 'bg-white/[0.07] text-white/60',
                                    )}
                                >
                                    {counts[item.key]}
                                </span>
                            </Link>
                        ))}
                    </div>
                    <label className="input-glass flex h-10 items-center gap-2 rounded-xl px-3 md:ml-auto md:w-72">
                        <Search className="size-4 text-white/40" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Пошук серед друзів"
                            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
                        />
                    </label>
                </div>

                {users.data.length === 0 ? (
                    <EmptyState
                        icon={tab === 'requests' ? Inbox : UsersRound}
                        title={empty[tab].title}
                        text={empty[tab].text}
                    />
                ) : (
                    <InfiniteScroll
                        data="users"
                        preserveUrl
                        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                    >
                        {users.data.map((person) => (
                            <PersonCard key={person.id} person={person} />
                        ))}
                    </InfiniteScroll>
                )}

                <Widget title="Можливо, ви знайомі" icon={Sparkles}>
                    <Deferred
                        data="suggestions"
                        fallback={<WidgetSkeleton rows={2} />}
                    >
                        {suggestions && suggestions.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                {suggestions.map((person) => (
                                    <PersonCard
                                        key={person.id}
                                        person={person}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="px-1 text-sm text-white/45">
                                Рекомендацій поки немає.
                            </p>
                        )}
                    </Deferred>
                </Widget>
            </div>
        </>
    );
}
