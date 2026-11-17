import {
    Deferred,
    Head,
    InfiniteScroll,
    Link,
    router,
    usePage,
} from '@inertiajs/react';
import { ListSkeleton } from '@/components/gc/skeletons';
import {
    Briefcase,
    Clapperboard,
    Inbox,
    LayoutGrid,
    List,
    MessageCircleOff,
    Search,
    Send,
    Sparkles,
    Swords,
    UsersRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { FriendListRow } from '@/components/gc/friend-list-row';
import { GcSegmented } from '@/components/gc/gc-segmented';
import { PersonCard } from '@/components/gc/person-card';
import { EmptyState, Widget, WidgetSkeleton } from '@/components/gc/widget';
import { cn } from '@/lib/utils';
import type { PersonCard as Person, ScrollData } from '@/types';
import { tr } from '@/lib/i18n';
import { friendListAllowed } from '@/lib/modes';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { blurSwap, motionOr, SNAP } from '@/lib/motion';

type Tab =
    | 'all'
    | 'online'
    | 'requests'
    | 'outgoing'
    | 'raid'
    | 'cinema'
    | 'work'
    | 'stale';

type Props = {
    tab: Tab;
    q: string;
    users: ScrollData<Person>;
    counts: Record<Tab, number>;
    suggestions?: Person[];
};

const primaryTabs: { key: Tab; label: string }[] = [
    { key: 'all', label: tr('Усі друзі') },
    { key: 'online', label: tr('Онлайн') },
    { key: 'requests', label: tr('Заявки') },
];

const extraTabs: { key: Tab; label: string; icon: typeof UsersRound }[] = [
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

function tabHref(key: Tab) {
    return key === 'all' ? '/friends' : `/friends?tab=${key}`;
}

export default function Friends({ tab, q, users, counts, suggestions }: Props) {
    const [search, setSearch] = useState(q);
    /** Плитка лише на md+; на телефоні завжди список. */
    const [view, setView] = useState<'list' | 'grid'>('list');
    const { modules } = usePage().props;
    const useGrid = view === 'grid';
    const reduce = useReducedMotion();
    const swap = blurSwap(reduce);

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

    const extras = extraTabs.filter((item) =>
        friendListAllowed(item.key, modules),
    );

    return (
        <>
            <Head title={tr('Друзі')} />
            <div className="space-y-3 sm:space-y-4">
                <div className="gc-solid flex flex-col gap-2.5 rounded-2xl p-2.5 sm:p-3">
                    <GcSegmented
                        value={
                            primaryTabs.some((t) => t.key === tab) ? tab : 'all'
                        }
                        options={primaryTabs.map((item) => ({
                            key: item.key,
                            label: item.label,
                            href: tabHref(item.key),
                            count: counts[item.key],
                            badge:
                                item.key === 'requests' && counts.requests > 0,
                        }))}
                    />

                    <div className="flex flex-wrap items-center gap-2">
                        {extras.length > 0 && (
                            <div className="scrollbar-none flex min-w-0 flex-1 gap-1 overflow-x-auto">
                                {extras.map((item) => (
                                    <Link
                                        key={item.key}
                                        href={tabHref(item.key)}
                                        className={cn(
                                            'flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition',
                                            tab === item.key
                                                ? 'nav-active text-white'
                                                : 'text-white/50 hover:bg-[var(--gc-l3)] hover:text-white',
                                        )}
                                    >
                                        <item.icon className="size-3.5" />
                                        {item.label}
                                        <span className="rounded-full bg-white/[0.07] px-1.5 text-[10px] leading-4 text-white/55 tabular-nums">
                                            {counts[item.key]}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        )}
                        <label className="input-glass flex h-9 w-full items-center gap-2 rounded-xl px-2.5 sm:ml-auto sm:w-64">
                            <Search className="size-3.5 text-white/40" />
                            <input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder={tr('Пошук серед друзів')}
                                className="min-w-0 flex-1 bg-transparent text-xs text-white placeholder:text-white/35 focus:outline-none"
                            />
                        </label>
                        <div className="hidden items-center gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-0.5 md:flex">
                            <button
                                type="button"
                                aria-label={tr('Список')}
                                onClick={() => setView('list')}
                                className={cn(
                                    'flex size-8 items-center justify-center rounded-lg transition',
                                    !useGrid
                                        ? 'bg-white/[0.1] text-white'
                                        : 'text-white/45 hover:text-white',
                                )}
                            >
                                <List className="size-3.5" />
                            </button>
                            <button
                                type="button"
                                aria-label={tr('Плитка')}
                                onClick={() => setView('grid')}
                                className={cn(
                                    'flex size-8 items-center justify-center rounded-lg transition',
                                    useGrid
                                        ? 'bg-white/[0.1] text-white'
                                        : 'text-white/45 hover:text-white',
                                )}
                            >
                                <LayoutGrid className="size-3.5" />
                            </button>
                        </div>
                    </div>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                    <m.div
                        key={`${tab}-${useGrid ? 'g' : 'l'}`}
                        {...swap}
                        className="min-w-0"
                    >
                        {users.data.length === 0 ? (
                            <EmptyState
                                icon={tab === 'requests' ? Inbox : UsersRound}
                                title={empty[tab].title}
                                text={empty[tab].text}
                            />
                        ) : (
                            <InfiniteScroll
                                data="users"
                                loading={<ListSkeleton rows={3} card={false} />}
                                preserveUrl
                                className={cn(
                                    useGrid
                                        ? 'grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-2.5 lg:grid-cols-4'
                                        : 'flex flex-col gap-2',
                                )}
                            >
                                {users.data.map((person, index) => (
                                    <m.div
                                        key={person.id}
                                        initial={
                                            reduce
                                                ? false
                                                : { opacity: 0, y: 6 }
                                        }
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={motionOr(reduce, {
                                            ...SNAP,
                                            delay: Math.min(index, 8) * 0.03,
                                        })}
                                    >
                                        {useGrid ? (
                                            <>
                                                <div className="md:hidden">
                                                    <FriendListRow
                                                        person={person}
                                                    />
                                                </div>
                                                <div className="hidden md:block">
                                                    <PersonCard
                                                        person={person}
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <FriendListRow person={person} />
                                        )}
                                    </m.div>
                                ))}
                            </InfiniteScroll>
                        )}
                    </m.div>
                </AnimatePresence>

                <Widget title={tr('Можливо, ви знайомі')} icon={Sparkles}>
                    <Deferred
                        data="suggestions"
                        fallback={<WidgetSkeleton rows={2} />}
                    >
                        {suggestions && suggestions.length > 0 ? (
                            <div className="flex flex-col gap-2 md:grid md:grid-cols-3 md:gap-2.5 lg:grid-cols-4">
                                {suggestions.map((person) => (
                                    <div key={person.id}>
                                        <div className="md:hidden">
                                            <FriendListRow person={person} />
                                        </div>
                                        <div className="hidden md:block">
                                            <PersonCard person={person} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="px-1 text-[11px] leading-tight text-white/45">
                                {tr('Рекомендацій поки немає.')}
                            </p>
                        )}
                    </Deferred>
                </Widget>
            </div>
        </>
    );
}
