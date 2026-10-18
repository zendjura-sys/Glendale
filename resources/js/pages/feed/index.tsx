import {
    Deferred,
    Head,
    InfiniteScroll,
    Link,
    usePage,
} from '@inertiajs/react';
import {
    Cake,
    Globe,
    Compass,
    Flame,
    Newspaper,
    Radio,
    Sparkles,
    UserPlus,
    UsersRound,
} from 'lucide-react';
import { LanguageFilter, TomorrowCard } from '@/components/gc/feed-extras';
import type { TomorrowEvent } from '@/components/gc/feed-extras';
import { FriendButton } from '@/components/gc/friend-button';
import { PersonRow } from '@/components/gc/person-card';
import { PostCard } from '@/components/gc/post-card';
import { PostComposer } from '@/components/gc/post-composer';
import { PostSkeleton } from '@/components/gc/post-skeleton';
import { StoriesBar } from '@/components/gc/stories';
import { UserAvatar } from '@/components/gc/user-avatar';
import { EmptyState, Widget, WidgetSkeleton } from '@/components/gc/widget';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PersonCard, PostItem, ScrollData, UserCard } from '@/types';
import { FriendsLive } from '@/components/streams/stream';
import type { StreamInfo } from '@/components/streams/stream';
import { FeedQuests } from '@/components/quests/quest-list';
import type { Quest } from '@/components/quests/quest-list';
import { tr } from '@/lib/i18n';
import { useFeature } from '@/lib/plugins';

type Props = {
    tab: 'friends' | 'discover' | 'country';
    lang: string | null;
    languages: string[];
    tomorrow?: TomorrowEvent[];
    streaming?: StreamInfo[];
    quests?: Quest[];
    country: string | null;
    hasFriends: boolean;
    posts: ScrollData<PostItem>;
    suggestions?: (UserCard & { mutual: number })[];
    onlineFriends?: UserCard[];
    playingNow?: UserCard[];
    picks?: {
        kind: string;
        title: string;
        href: string;
        image: string | null;
    }[];
    sameGame?: (UserCard & { shared_game: string })[];
    birthdays?: (UserCard & { birthday: string })[];
};

function FeedTabs({
    tab,
    hasFriends,
}: {
    tab: Props['tab'];
    hasFriends: boolean;
}) {
    const tabs = [
        {
            key: 'friends',
            label: tr('Друзі'),
            icon: UsersRound,
            href: '/feed',
            disabled: !hasFriends,
        },
        {
            key: 'discover',
            label: tr('Рекомендації'),
            icon: Flame,
            href: '/feed?tab=discover',
            disabled: false,
        },
        {
            key: 'country',
            label: tr('Країна'),
            icon: Globe,
            href: '/feed?tab=country',
            disabled: false,
        },
    ];

    return (
        <div className="glass flex gap-1 rounded-2xl p-1">
            {tabs.map((item) => (
                <Link
                    key={item.key}
                    href={item.href}
                    preserveScroll={false}
                    aria-current={tab === item.key ? 'page' : undefined}
                    className={cn(
                        'flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition',
                        tab === item.key
                            ? 'nav-active text-white'
                            : 'text-white/55 hover:bg-white/[0.04] hover:text-white',
                        item.disabled && 'pointer-events-none opacity-40',
                    )}
                >
                    <item.icon
                        aria-hidden
                        className={cn(
                            'size-4',
                            tab === item.key && 'text-gc-lilac-400',
                        )}
                    />
                    {item.label}
                </Link>
            ))}
        </div>
    );
}

export default function Feed({
    tab,
    lang,
    languages,
    tomorrow,
    streaming,
    quests,
    hasFriends,
    country,
    posts,
    suggestions,
    onlineFriends,
    playingNow,
    picks,
    sameGame,
    birthdays,
}: Props) {
    const { auth } = usePage().props;
    // Режим соцмережі може ховати історії й трансляції друзів.
    const storiesOn = useFeature('stories');
    const liveOn = useFeature('live');

    return (
        <>
            <Head title={tr('Новини')} />
            <div className="flex gap-5">
                <div className="min-w-0 flex-1 space-y-4 xl:max-w-[640px]">
                    {storiesOn && <StoriesBar />}
                    {liveOn && <FriendsLive streams={streaming ?? []} />}
                    <FeedQuests quests={quests ?? []} />
                    <TomorrowCard events={tomorrow ?? []} />
                    {(picks?.length ?? 0) > 0 && (
                        <div className="flex gap-2 overflow-x-auto">
                            {picks?.map((pick) => (
                                <Link
                                    key={pick.href}
                                    href={pick.href}
                                    className="glass shrink-0 rounded-2xl px-3 py-2 text-sm font-medium text-white"
                                >
                                    {pick.title}
                                </Link>
                            ))}
                        </div>
                    )}
                    {(sameGame?.length ?? 0) > 0 && (
                        <div className="glass flex gap-2 overflow-x-auto rounded-2xl p-3">
                            {sameGame?.map((person) => (
                                <Link
                                    key={person.id}
                                    href={`/${person.username}`}
                                    className="min-w-[140px] rounded-xl bg-white/[0.04] px-3 py-2"
                                >
                                    <span className="block truncate text-sm font-medium text-white">
                                        {person.first_name}
                                    </span>
                                    <span className="block truncate text-[11px] text-white/45">
                                        {person.shared_game}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                    {(playingNow?.length ?? 0) > 0 && (
                        <div className="glass flex gap-2 overflow-x-auto rounded-2xl p-3">
                            {playingNow?.map((person) => (
                                <Link
                                    key={person.id}
                                    href={
                                        person.playing?.url ||
                                        `/${person.username}`
                                    }
                                    className="flex min-w-[140px] items-center gap-2 rounded-xl bg-white/[0.04] px-2.5 py-2"
                                >
                                    <UserAvatar user={person} size="sm" />
                                    <span className="min-w-0">
                                        <span className="block truncate text-xs font-medium text-white">
                                            {person.first_name}
                                        </span>
                                        <span className="block truncate text-[11px] text-gc-lilac-200">
                                            {person.playing?.label}
                                        </span>
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                    <PostComposer />
                    <FeedTabs tab={tab} hasFriends={hasFriends} />
                    <LanguageFilter
                        tab={tab}
                        lang={lang}
                        languages={languages}
                    />

                    {tab === 'discover' && !hasFriends && (
                        <div className="gradient-border glass flex items-center gap-4 rounded-3xl p-5">
                            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-brand shadow-[0_10px_30px_-8px_rgb(109_93_252/0.9)]">
                                <Sparkles className="size-6 text-white" />
                            </span>
                            <div className="text-sm">
                                <p className="font-semibold text-white">
                                    {tr('Ласкаво просимо в GameCon,')}{' '}
                                    {auth.user.first_name}!
                                </p>
                                <p className="mt-0.5 text-white/55">
                                    {tr(
                                        "Поки що тут найпопулярніше за місяць. Додайте друзів, і їхні записи з'являться у вкладці «Друзі».",
                                    )}
                                </p>
                            </div>
                        </div>
                    )}

                    {posts.data.length === 0 ? (
                        <EmptyState
                            icon={
                                tab === 'country'
                                    ? Globe
                                    : tab === 'friends'
                                      ? Newspaper
                                      : Compass
                            }
                            title={
                                tab === 'country'
                                    ? tr('Стрічка країни порожня')
                                    : tab === 'friends'
                                      ? tr('Стрічка поки порожня')
                                      : tr('Тут ще нічого немає')
                            }
                            text={
                                tab === 'country' && !country
                                    ? tr(
                                          'Вкажіть країну в налаштуваннях профілю — і тут з’являться записи людей звідти.',
                                      )
                                    : tr(
                                          'Напишіть перший запис або знайдіть друзів — і стрічка оживе.',
                                      )
                            }
                            action={
                                <Link
                                    href="/people"
                                    className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold"
                                >
                                    <UserPlus className="size-4" />{' '}
                                    {tr('Знайти друзів')}
                                </Link>
                            }
                        />
                    ) : (
                        <InfiniteScroll
                            data="posts"
                            preserveUrl
                            buffer={600}
                            loading={<PostSkeleton />}
                            className="space-y-4"
                        >
                            {posts.data.map((post) => (
                                <PostCard key={post.id} post={post} />
                            ))}
                        </InfiniteScroll>
                    )}
                </div>

                <aside className="sticky top-[76px] hidden h-fit w-[320px] shrink-0 space-y-4 xl:block">
                    <Widget
                        title={tr('Зараз онлайн')}
                        icon={Radio}
                        href="/friends?tab=online"
                    >
                        <Deferred
                            data="onlineFriends"
                            fallback={<WidgetSkeleton rows={1} />}
                        >
                            {onlineFriends && onlineFriends.length > 0 ? (
                                <div className="flex flex-wrap gap-2 px-1">
                                    {onlineFriends.map((friend) => (
                                        <Link
                                            key={friend.id}
                                            href={`/${friend.username}`}
                                            title={friend.name}
                                            className="transition hover:-translate-y-0.5"
                                        >
                                            <UserAvatar
                                                user={friend}
                                                size="md"
                                            />
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <p className="px-1 text-sm text-white/45">
                                    {tr('Ніхто з друзів зараз не в мережі.')}
                                </p>
                            )}
                        </Deferred>
                    </Widget>

                    <Widget
                        title={tr('Можливо, ви знайомі')}
                        icon={UserPlus}
                        href="/friends"
                    >
                        <Deferred
                            data="suggestions"
                            fallback={<WidgetSkeleton />}
                        >
                            <div className="space-y-0.5">
                                {suggestions?.length === 0 && (
                                    <p className="px-1 text-sm text-white/45">
                                        {tr('Ви вже знайомі з усіма.')}{' '}
                                        <Link
                                            href="/people"
                                            className="text-gc-lilac-300 hover:underline"
                                        >
                                            {tr('Шукати людей')}
                                        </Link>
                                    </p>
                                )}
                                {(suggestions ?? []).map((person) => (
                                    <PersonRow
                                        key={person.id}
                                        person={person as PersonCard}
                                        action={
                                            <FriendButton
                                                username={person.username}
                                                relation="none"
                                                size="sm"
                                                className="!px-2.5"
                                            />
                                        }
                                    />
                                ))}
                            </div>
                        </Deferred>
                    </Widget>

                    <Deferred data="birthdays" fallback={<span hidden />}>
                        {birthdays && birthdays.length > 0 ? (
                            <Widget title={tr('Дні народження')} icon={Cake}>
                                <div className="space-y-0.5">
                                    {birthdays.map((person) => (
                                        <PersonRow
                                            key={person.id}
                                            person={{
                                                ...person,
                                                status: formatDate(
                                                    person.birthday,
                                                    false,
                                                ),
                                            }}
                                        />
                                    ))}
                                </div>
                            </Widget>
                        ) : null}
                    </Deferred>
                </aside>
            </div>
        </>
    );
}
