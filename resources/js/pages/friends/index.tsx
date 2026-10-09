import { Deferred, Head, InfiniteScroll, Link, router } from '@inertiajs/react';
import { Briefcase, Clapperboard, Inbox, MessageCircleOff, Radio, Search, Send, Sparkles, Swords, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PersonCard } from '@/components/gc/person-card';
import { EmptyState, Widget, WidgetSkeleton } from '@/components/gc/widget';
import { cn } from '@/lib/utils';
import type { PersonCard as Person, ScrollData } from '@/types';
import { tr } from '@/lib/i18n';

type Tab = 'all' | 'online' | 'requests' | 'outgoing' | 'raid' | 'cinema' | 'work' | 'stale';

type Props = {
    tab: Tab;
    q: string;
    users: ScrollData<Person>;
    counts: Record<Tab, number>;
    suggestions?: Person[];
};

const tabs: { key: Tab; label: string; icon: typeof UsersRound }[] = [
    { key: 'all', label: tr('Усі друзі'), icon: UsersRound },
    { key: 'online', label: tr('Онлайн'), icon: Radio },
    { key: 'requests', label: tr('Заявки'), icon: Inbox },
    { key: 'outgoing', label: tr('Надіслані'), icon: Send },
    { key: 'raid', label: tr('Рейд'), icon: Swords },
    { key: 'cinema', label: tr('Кіно'), icon: Clapperboard },
    { key: 'work', label: tr('Робота'), icon: Briefcase },
    { key: 'stale', label: tr('Давно не писали'), icon: MessageCircleOff },
];

const empty: Record<Tab, { title: string; text: string }> = {
    all: {
        title: tr('У вас поки немає друзів'),
        text: tr(
            'Знайдіть знайомих через пошук або подивіться рекомендації нижче.',
        ),
    },
    online: {
        title: tr('Ніхто не онлайн'),
        text: tr('Коли друзі зайдуть у мережу, вони з’являться тут.'),
    },
    requests: {
        title: tr('Нових заявок немає'),
        text: tr('Коли хтось захоче додати вас у друзі, заявка з’явиться тут.'),
    },
    outgoing: {
        title: tr('Немає надісланих заявок'),
        text: tr('Заявки, які ви надіслали, чекають тут на відповідь.'),
    },
    raid: {
        title: tr('У рейді нікого'),
        text: tr('Позначте друга списком «Рейд» на його картці.'),
    },
    cinema: {
        title: tr('У кіно нікого'),
        text: tr('Позначте друга списком «Кіно» на його картці.'),
    },
    work: {
        title: tr('У роботі нікого'),
        text: tr('Позначте друга списком «Робота» на його картці.'),
    },
    stale: {
        title: tr('Усіх нещодавно написали'),
        text: tr('Тут друзі, з якими не було листування довше місяця.'),
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
            <Head title={tr('Друзі')} />
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
                                        tab === item.key && 'text-gc-lilac-400',
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
                            placeholder={tr('Пошук серед друзів')}
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

                <Widget title={tr('Можливо, ви знайомі')} icon={Sparkles}>
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
                                {tr('Рекомендацій поки немає.')}
                            </p>
                        )}
                    </Deferred>
                </Widget>
            </div>
        </>
    );
}
