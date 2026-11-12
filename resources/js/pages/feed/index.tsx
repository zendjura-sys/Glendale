import {
    Contacts,
    FriendRequests,
    useRail,
} from '@/components/gc/rail-widgets';
import {
    Deferred,
    Head,
    InfiniteScroll,
    Link,
    usePage,
} from '@inertiajs/react';
import { NewcomerWeek } from '@/components/onboarding/newcomer-week';
import type { NewcomerData } from '@/components/onboarding/newcomer-week';
import {
    Activity,
    Cake,
    Globe,
    Compass,
    Flame,
    Newspaper,
    Radio,
    Sparkles,
    UserPlus,
    UsersRound,
    Hash,
} from 'lucide-react';
import {
    ChronoSwitch,
    LanguageFilter,
    TomorrowCard,
} from '@/components/gc/feed-extras';
import type { TomorrowEvent } from '@/components/gc/feed-extras';
import { FriendButton } from '@/components/gc/friend-button';
import { PersonRow } from '@/components/gc/person-card';
import { PostCard } from '@/components/gc/post-card';
import { PostComposer } from '@/components/gc/post-composer';
import { PostSkeleton } from '@/components/gc/post-skeleton';
import { StoriesBar } from '@/components/gc/stories';
import { UserAvatar } from '@/components/gc/user-avatar';
import { WrappedBanner } from '@/components/gc/wrapped-banner';
import { HomeWidgetsEditor } from '@/components/gc/engagement';
import { FeedPulse, FeedSideCards, useHub } from '@/components/gc/feed-pulse';
import { FriendActivity } from '@/components/feed/friend-activity';
import { PromoBanner } from '@/components/feed/promo-banner';
import { SideWidgets, useSideWidgets } from '@/components/feed/side-widgets';
import { WhileAway } from '@/components/feed/while-away';
import type { WhileAwayData } from '@/components/feed/while-away';
import { EmptyState, Widget, WidgetSkeleton } from '@/components/gc/widget';
import { formatDate } from '@/lib/format';
import type { PersonCard, PostItem, ScrollData, UserCard } from '@/types';
import { FriendsLive } from '@/components/streams/stream';
import type { StreamInfo } from '@/components/streams/stream';
import type { Quest } from '@/components/quests/quest-list';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';
import { cn } from '@/lib/utils';
import { useFeature } from '@/lib/plugins';

type Props = {
    whileAway?: WhileAwayData | null;
    newcomer?: NewcomerData | null;
    tab: 'friends' | 'activity' | 'discover' | 'country' | 'topics';
    topics?: string[] | null;
    onlyFriends?: boolean;
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
    const topicsOn = usePlugin('topic_follows');
    const tabs = [
        {
            key: 'friends',
            label: tr('Друзі'),
            icon: UsersRound,
            href: '/feed',
            disabled: !hasFriends,
        },
        ...(hasFriends
            ? [
                  {
                      key: 'activity',
                      label: tr('Активність'),
                      icon: Activity,
                      href: '/feed?tab=activity',
                      disabled: false,
                  },
              ]
            : []),
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
        ...(topicsOn
            ? [
                  {
                      key: 'topics',
                      label: tr('Теми'),
                      icon: Hash,
                      href: '/feed?tab=topics',
                      disabled: false,
                  },
              ]
            : []),
    ];

    // Пігулки: активна — суцільна небесна; прокручуються вбік, активна — завжди в полі зору.
    return (
        <nav
            ref={(el) => {
                el?.querySelector<HTMLElement>(
                    '[aria-current="page"]',
                )?.scrollIntoView({ block: 'nearest', inline: 'center' });
            }}
            aria-label={tr('Стрічка')}
            className="flex [scrollbar-width:none] gap-2 overflow-x-auto"
        >
            {tabs.map((item) => (
                <Link
                    key={item.key}
                    href={item.href}
                    preserveScroll
                    aria-current={tab === item.key ? 'page' : undefined}
                    className={cn(
                        'flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition',
                        tab === item.key
                            ? 'bg-sky-500 text-white'
                            : 'gc-solid text-white/70 hover:text-white',
                    )}
                >
                    <item.icon aria-hidden className="size-4" />
                    {item.label}
                </Link>
            ))}
        </nav>
    );
}

export default function Feed({
    whileAway = null,
    newcomer = null,
    tab,
    topics = null,
    lang,
    onlyFriends,
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
    const widgetsOn = usePlugin('home_widgets');
    const engagement = usePage().props.engagement;
    const homeWidgets = engagement?.widgets ?? [
        'streak',
        'ready',
        'online',
        'suggestions',
        'birthdays',
    ];
    const liveOn = useFeature('live');
    // Spacepark: праворуч заявки в друзі й контакти (дані /me/rail).
    const { data: rail, reload: reloadRail } = useRail();
    const widgets = useSideWidgets();
    // Тривоги для картки в стрічці (лише Україна — сервер сам вирішує, чи показувати).
    const hub = useHub();

    return (
        <>
            <Head title={tr('Новини')} />
            <div className="flex gap-5">
                <div className="min-w-0 flex-1 space-y-4">
                    {/* Верх стрічки за макетом: моменти, одна смуга «серія · готовий грати · завдання»,
                        далі — Wrapped, «Завтра» й трансляції друзів (порожні не показуються). */}
                    {storiesOn && <StoriesBar />}
                    <WhileAway data={whileAway} />
                    <FeedPulse quests={quests ?? []} />
                    <WrappedBanner />
                    <TomorrowCard events={tomorrow ?? []} />
                    {liveOn && <FriendsLive streams={streaming ?? []} />}
                    {(picks?.length ?? 0) > 0 && (
                        <div className="flex gap-2 overflow-x-auto">
                            {picks?.map((pick) => (
                                <Link
                                    key={pick.href}
                                    href={pick.href}
                                    className="gc-solid shrink-0 rounded-2xl px-3 py-2 text-sm font-medium text-white"
                                >
                                    {pick.title}
                                </Link>
                            ))}
                        </div>
                    )}
                    {(sameGame?.length ?? 0) > 0 && (
                        <div className="gc-solid flex gap-2 overflow-x-auto rounded-2xl p-3">
                            {sameGame?.map((person) => (
                                <Link
                                    key={person.id}
                                    href={`/${person.username}`}
                                    className="gc-solid-2 min-w-[140px] rounded-xl px-3 py-2"
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
                        <div className="gc-solid flex gap-2 overflow-x-auto rounded-2xl p-3">
                            {playingNow?.map((person) => (
                                <Link
                                    key={person.id}
                                    href={
                                        person.playing?.url ||
                                        `/${person.username}`
                                    }
                                    className="gc-solid-2 flex min-w-[140px] items-center gap-2 rounded-xl px-2.5 py-2"
                                >
                                    <UserAvatar user={person} size="sm" />
                                    <span className="min-w-0">
                                        <span className="block truncate text-xs font-medium text-white">
                                            {person.first_name}
                                        </span>
                                        <span className="block truncate text-[11px] text-sky-400">
                                            {person.playing?.label}
                                        </span>
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                    {newcomer && <NewcomerWeek data={newcomer} />}
                    <PostComposer />
                    <PromoBanner />
                    {/* Планшет: ті самі віджети сіткою 2×2 над стрічкою (на ПК вони праворуч). */}
                    <SideWidgets
                        data={widgets}
                        className="hidden grid-cols-2 items-start gap-4 md:grid xl:hidden"
                    />
                    <FeedTabs tab={tab} hasFriends={hasFriends} />
                    {tab !== 'activity' && (
                        <div className="flex flex-wrap items-center gap-2">
                            <LanguageFilter
                                tab={tab}
                                lang={lang}
                                languages={languages}
                            />
                            {tab === 'friends' && (
                                <ChronoSwitch
                                    onlyFriends={onlyFriends ?? false}
                                />
                            )}
                        </div>
                    )}

                    {tab === 'discover' && !hasFriends && (
                        <div className="gradient-border gc-solid flex items-center gap-4 rounded-2xl p-5">
                            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500">
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

                    {tab === 'activity' ? (
                        <FriendActivity />
                    ) : posts.data.length === 0 ? (
                        <EmptyState
                            icon={
                                tab === 'country'
                                    ? Globe
                                    : tab === 'friends'
                                      ? Newspaper
                                      : Compass
                            }
                            title={
                                tab === 'topics'
                                    ? topics?.length
                                        ? tr('За вашими темами поки тихо')
                                        : tr('Ви ще не стежите за темами')
                                    : tab === 'country'
                                      ? tr('Стрічка країни порожня')
                                      : tab === 'friends'
                                        ? tr('Стрічка поки порожня')
                                        : tr('Тут ще нічого немає')
                            }
                            text={
                                tab === 'topics'
                                    ? tr(
                                          'Торкніться #хештегу в записі й натисніть «Стежити» — такі записи збиратимуться тут.',
                                      )
                                    : tab === 'country' && !country
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

                <aside className="gc-split-hide sticky top-[calc(88px+env(safe-area-inset-top))] hidden h-fit w-[320px] shrink-0 space-y-4 min-[1920px]:w-[360px] xl:block">
                    {rail && (
                        <>
                            <FriendRequests data={rail} reload={reloadRail} />
                            <Contacts data={rail} />
                        </>
                    )}
                    {/* Голосовий штаб, тривога, топ серверів і сезон — у правій колонці, не між записами. */}
                    <FeedSideCards rail={rail} hub={hub} />
                    <SideWidgets data={widgets} className="space-y-4" />
                    {homeWidgets.map((key) => {
                        switch (key) {
                            // Серія днів і «Готові грати» — у Bento-сітці стрічки.
                            case 'streak':
                            case 'ready':
                                return null;
                            case 'online':
                                // Контакти вже показують друзів — без дубля.
                                if (rail && rail.contacts.length > 0)
                                    return null;
                                return (
                                    <div key={key}>
                                        <Widget
                                            title={tr('Зараз онлайн')}
                                            icon={Radio}
                                            href="/friends?tab=online"
                                        >
                                            <Deferred
                                                data="onlineFriends"
                                                fallback={
                                                    <WidgetSkeleton rows={1} />
                                                }
                                            >
                                                {onlineFriends &&
                                                onlineFriends.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2 px-1">
                                                        {onlineFriends.map(
                                                            (friend) => (
                                                                <Link
                                                                    key={
                                                                        friend.id
                                                                    }
                                                                    href={`/${friend.username}`}
                                                                    title={
                                                                        friend.name
                                                                    }
                                                                    className="transition hover:-translate-y-0.5"
                                                                >
                                                                    <UserAvatar
                                                                        user={
                                                                            friend
                                                                        }
                                                                        size="md"
                                                                    />
                                                                </Link>
                                                            ),
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="px-1 text-sm text-white/45">
                                                        {tr(
                                                            'Ніхто з друзів зараз не в мережі.',
                                                        )}
                                                    </p>
                                                )}
                                            </Deferred>
                                        </Widget>
                                    </div>
                                );
                            case 'suggestions':
                                return (
                                    <div key={key}>
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
                                                    {suggestions?.length ===
                                                        0 && (
                                                        <p className="px-1 text-sm text-white/45">
                                                            {tr(
                                                                'Ви вже знайомі з усіма.',
                                                            )}{' '}
                                                            <Link
                                                                href="/people"
                                                                className="text-sky-400 hover:underline"
                                                            >
                                                                {tr(
                                                                    'Шукати людей',
                                                                )}
                                                            </Link>
                                                        </p>
                                                    )}
                                                    {(suggestions ?? []).map(
                                                        (person) => (
                                                            <PersonRow
                                                                key={person.id}
                                                                person={
                                                                    person as PersonCard
                                                                }
                                                                action={
                                                                    <FriendButton
                                                                        username={
                                                                            person.username
                                                                        }
                                                                        relation="none"
                                                                        size="sm"
                                                                        className="!px-2.5"
                                                                    />
                                                                }
                                                            />
                                                        ),
                                                    )}
                                                </div>
                                            </Deferred>
                                        </Widget>
                                    </div>
                                );
                            case 'birthdays':
                                return (
                                    <div key={key}>
                                        <Deferred
                                            data="birthdays"
                                            fallback={<span hidden />}
                                        >
                                            {birthdays &&
                                            birthdays.length > 0 ? (
                                                <Widget
                                                    title={tr('Дні народження')}
                                                    icon={Cake}
                                                >
                                                    <div className="space-y-0.5">
                                                        {birthdays.map(
                                                            (person) => (
                                                                <PersonRow
                                                                    key={
                                                                        person.id
                                                                    }
                                                                    person={{
                                                                        ...person,
                                                                        status: formatDate(
                                                                            person.birthday,
                                                                            false,
                                                                        ),
                                                                    }}
                                                                />
                                                            ),
                                                        )}
                                                    </div>
                                                </Widget>
                                            ) : null}
                                        </Deferred>
                                    </div>
                                );
                            default:
                                return null;
                        }
                    })}
                    {widgetsOn && <HomeWidgetsEditor widgets={homeWidgets} />}
                </aside>
            </div>
        </>
    );
}
