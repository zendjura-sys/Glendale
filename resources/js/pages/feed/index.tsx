import {
    ContactsRow,
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
import { PostSkeleton } from '@/components/gc/post-skeleton';
import { StoriesBar } from '@/components/gc/stories';
import { UserAvatar } from '@/components/gc/user-avatar';
import { WrappedBanner } from '@/components/gc/wrapped-banner';
import { SiteEventBanner } from '@/components/season/site-event-banner';
import {
    AlertCard,
    FeedPulse,
    SeasonCard,
    ServersCard,
    useHub,
    VoiceCard,
} from '@/components/gc/feed-pulse';
import {
    CategoryPicker,
    LobbyHero,
    NowPlayingWidget,
    isNewIn,
    shownIn,
    useNowBlocks,
} from '@/components/lobby/lobby';
import type { LiveBlockData } from '@/components/lobby/lobby';
import { BentoCell, LiveBlock } from '@/components/lobby/bento-feed';
import { LiveChips } from '@/components/gc/live-dock';
import { isMediaPost, MediaPostBlock } from '@/components/lobby/media-blocks';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { FriendActivity } from '@/components/feed/friend-activity';
import { PromoBanner } from '@/components/feed/promo-banner';
import {
    ContinueList,
    FeedColumnWidgets,
    SideWidgets,
    useSideWidgets,
} from '@/components/feed/side-widgets';
import { WhileAway } from '@/components/feed/while-away';
import type { WhileAwayData } from '@/components/feed/while-away';
import { EmptyState, Widget, WidgetSkeleton } from '@/components/gc/widget';
import { formatDate } from '@/lib/format';
import type { PersonCard, PostItem, ScrollData, UserCard } from '@/types';
import { FriendsLive } from '@/components/streams/stream';
import type { StreamInfo } from '@/components/streams/stream';
import { WeeklyChallenges } from '@/components/quests/quest-list';
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
    weekly?: Quest[];
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
    weekly,
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
    const { auth, modules } = usePage().props;
    // Режим соцмережі може ховати історії й трансляції друзів.
    const storiesOn = useFeature('stories');
    const widgetsOn = usePlugin('home_widgets');
    const engagement = usePage().props.engagement;
    const liveOn = useFeature('live');
    // Spacepark: праворуч заявки в друзі й контакти (дані /me/rail).
    const { data: rail, reload: reloadRail } = useRail();
    // Віджети потрібні для «Продовжити» на всіх екранах і для третьої колонки на ПК.
    const widgets = useSideWidgets();
    // Тривоги для картки в стрічці (лише Україна — сервер сам вирішує, чи показувати).
    const hub = useHub();

    const sideWidget = (key: string): ReactNode => {
        switch (key) {
            // Серія днів і «Готові грати» — у Bento-сітці стрічки.
            case 'streak':
            case 'ready':
                return null;
            case 'online':
                // Контакти вже показують друзів — без дубля.
                if (rail && rail.contacts.length > 0) return null;
                return (
                    <div key={key}>
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
                                    {suggestions?.length === 0 && (
                                        <p className="px-1 text-sm text-white/45">
                                            {tr('Ви вже знайомі з усіма.')}{' '}
                                            <Link
                                                href="/people"
                                                className="text-sky-400 underline underline-offset-2"
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
                    </div>
                );
            case 'birthdays':
                return (
                    <div key={key}>
                        <Deferred data="birthdays" fallback={<span hidden />}>
                            {birthdays && birthdays.length > 0 ? (
                                <Widget
                                    title={tr('Дні народження')}
                                    icon={Cake}
                                >
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
                    </div>
                );
            default:
                return null;
        }
    };

    // Кожен блок лобі — віджет: розклад (порядок, розмір, видимість) людина задає сама.
    const continueItems = widgets?.continue ?? [];
    const available = [
        'pulse',
        'weekly',
        ...(storiesOn ? ['stories'] : []),
        'continue',
        'alerts',
        'requests',
        'contacts',
        'voice',
        'servers',
        'season',
        'online',
        'playing',
        'same_game',
        'picks',
        'suggestions',
        'birthdays',
        'media',
        ...(modules.includes('music') ? ['player'] : []),
    ];
    const renderWidget = (key: string): ReactNode => {
        switch (key) {
            case 'pulse':
                return <FeedPulse quests={quests ?? []} />;
            case 'weekly':
                return <WeeklyChallenges quests={weekly ?? []} />;
            case 'stories':
                return storiesOn ? <StoriesBar /> : null;
            case 'continue':
                return continueItems.length > 0 ? (
                    <section
                        aria-label={tr('Продовжити')}
                        className="space-y-2"
                    >
                        <h3 className="px-1 text-sm font-semibold text-[var(--gc-text-2)]">
                            {tr('Продовжити')}
                        </h3>
                        <ContinueList items={continueItems} horizontal />
                    </section>
                ) : null;
            case 'alerts':
                return hub ? <AlertCard hub={hub} /> : null;
            case 'requests':
                return rail && rail.requests.length > 0 ? (
                    <FriendRequests data={rail} reload={reloadRail} />
                ) : null;
            case 'contacts':
                return rail && rail.contacts.length > 0 ? (
                    <ContactsRow data={rail} />
                ) : null;
            case 'voice':
                return <VoiceCard rail={rail} />;
            case 'servers':
                return <ServersCard rail={rail} />;
            case 'season':
                return <SeasonCard rail={rail} />;
            case 'player':
                return modules.includes('music') ? <NowPlayingWidget /> : null;
            case 'media':
                return (
                    <FeedColumnWidgets
                        data={widgets}
                        all
                        className="gc-widget-subgrid"
                    />
                );
            case 'picks':
                return (picks?.length ?? 0) > 0 ? (
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
                ) : null;
            case 'same_game':
                return (sameGame?.length ?? 0) > 0 ? (
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
                ) : null;
            case 'playing':
                return (playingNow?.length ?? 0) > 0 ? (
                    <div className="gc-solid flex gap-2 overflow-x-auto rounded-2xl p-3">
                        {playingNow?.map((person) => (
                            <Link
                                key={person.id}
                                href={
                                    person.playing?.url || `/${person.username}`
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
                ) : null;
            default:
                return sideWidget(key);
        }
    };

    const [selectedState, setSelected] = useState<string[]>(
        engagement?.categories ?? [],
    );
    // Живі блоки: категорія (розділ) + підкатегорія (функціонал), мітка в куті — що відбувається.
    const selected = selectedState;
    const nowBlocks = useNowBlocks({
        rail,
        streams: liveOn ? (streaming ?? []) : [],
        events: tomorrow ?? [],
        resume: continueItems[0] ?? null,
    });
    const media = (only: Parameters<typeof SideWidgets>[0]['only']) => (
        <SideWidgets data={widgets} only={only} />
    );
    const WIDGETS: {
        key: string;
        category: string;
        sub: string;
        badge: string;
        tone?: LiveBlockData['tone'];
        wide?: boolean;
        node: () => ReactNode;
    }[] = [
        {
            key: 'alerts',
            category: 'alerts',
            sub: 'air',
            badge: tr('Тривога'),
            tone: 'alert',
            node: () => renderWidget('alerts'),
        },
        {
            key: 'player',
            category: 'music',
            sub: 'player',
            badge: tr('Грає зараз'),
            tone: 'live',
            node: () => renderWidget('player'),
        },
        {
            key: 'gamecast',
            category: 'live',
            sub: 'gamecast',
            badge: 'GameCast',
            tone: 'live',
            node: () => media(['gamecast']),
        },
        {
            key: 'livecast',
            category: 'live',
            sub: 'livecast',
            badge: 'LiveCast',
            tone: 'live',
            node: () => media(['livecast']),
        },
        {
            key: 'voice-card',
            category: 'voice',
            sub: 'rooms',
            badge: tr('Голос'),
            tone: 'live',
            node: () => renderWidget('voice'),
        },
        {
            key: 'playing',
            category: 'games',
            sub: 'playing',
            badge: tr('У грі'),
            tone: 'live',
            node: () => renderWidget('playing'),
        },
        {
            key: 'requests',
            category: 'friends',
            sub: 'requests',
            badge: tr('Заявки'),
            tone: 'accent',
            node: () => renderWidget('requests'),
        },
        {
            key: 'pulse',
            category: 'quests',
            sub: 'daily',
            badge: tr('Завдання'),
            tone: 'accent',
            node: () => renderWidget('pulse'),
        },
        {
            key: 'weekly',
            category: 'quests',
            sub: 'weekly',
            badge: tr('Тиждень'),
            tone: 'accent',
            node: () => renderWidget('weekly'),
        },
        {
            key: 'stories',
            category: 'moments',
            sub: 'stories',
            badge: tr('Історії'),
            wide: true,
            node: () => renderWidget('stories'),
        },
        {
            key: 'contacts',
            category: 'friends',
            sub: 'contacts',
            badge: tr('Друзі'),
            node: () => renderWidget('contacts'),
        },
        {
            key: 'online',
            category: 'friends',
            sub: 'online',
            badge: tr('Онлайн'),
            tone: 'live',
            node: () => renderWidget('online'),
        },
        {
            key: 'season',
            category: 'quests',
            sub: 'season',
            badge: tr('Сезон'),
            node: () => renderWidget('season'),
        },
        {
            key: 'servers',
            category: 'servers',
            sub: 'top',
            badge: tr('Онлайн'),
            tone: 'live',
            node: () => renderWidget('servers'),
        },
        {
            key: 'music',
            category: 'music',
            sub: 'new',
            badge: tr('Музика'),
            node: () => media(['music']),
        },
        {
            key: 'cinema',
            category: 'cinema',
            sub: 'watch',
            badge: tr('Кіно'),
            node: () => media(['cinema']),
        },
        {
            key: 'picks',
            category: 'cinema',
            sub: 'picks',
            badge: tr('Добірка'),
            node: () => renderWidget('picks'),
        },
        {
            key: 'same',
            category: 'games',
            sub: 'same',
            badge: tr('Ігри'),
            node: () => renderWidget('same_game'),
        },
        {
            key: 'giveaways',
            category: 'games',
            sub: 'giveaways',
            badge: tr('Роздачі'),
            node: () => media(['giveaways']),
        },
        {
            key: 'suggestions',
            category: 'friends',
            sub: 'suggestions',
            badge: tr('Люди'),
            node: () => renderWidget('suggestions'),
        },
        {
            key: 'birthdays',
            category: 'friends',
            sub: 'birthdays',
            badge: tr('Свято'),
            tone: 'accent',
            node: () => renderWidget('birthdays'),
        },
    ];
    const blocks: LiveBlockData[] = [
        ...nowBlocks,
        ...WIDGETS.map((w) => ({ ...w, node: w.node() })),
    ].filter(
        (b) =>
            b.node !== null &&
            b.node !== false &&
            shownIn(selected, b.category, b.sub),
    );
    const catalog = engagement?.catalog ?? [];
    const postsOn = shownIn(selected, 'feed', 'posts');

    const grid = (
        <>
            <LiveBlock wide>
                <div className="gc-lobby-hero-block">
                    <LobbyHero rail={rail} events={tomorrow ?? []} />
                    <LiveChips />
                    <CategoryPicker
                        selected={selectedState}
                        onChange={setSelected}
                    />
                </div>
            </LiveBlock>
            {shownIn(selected, 'feed', 'while_away') && (
                <LiveBlock wide badge={tr('Поки тебе не було')} tone="accent">
                    <WhileAway data={whileAway} />
                </LiveBlock>
            )}
            {shownIn(selected, 'events', 'soon') && (
                <LiveBlock wide badge={tr('Подія')} tone="accent">
                    <WrappedBanner />
                    <SiteEventBanner />
                </LiveBlock>
            )}
            {blocks.map((b) => (
                <LiveBlock
                    key={b.key}
                    badge={b.badge}
                    tone={b.tone}
                    wide={b.wide}
                    isNew={isNewIn(catalog, b.category, b.sub)}
                >
                    {b.node}
                </LiveBlock>
            ))}
        </>
    );

    return (
        <>
            <Head title={tr('Лобі')} />
            <div className="gc-lobby-wide space-y-4">
                {postsOn && tab !== 'activity' && posts.data.length > 0 ? (
                    <InfiniteScroll
                        data="posts"
                        preserveUrl
                        buffer={600}
                        loading={<PostSkeleton />}
                        className="gc-bento gc-lobby-bento"
                    >
                        {grid}
                        {posts.data.map((post) => (
                            <BentoCell
                                key={post.id}
                                post={post}
                                badge={tr('Допис')}
                            >
                                {isMediaPost(post) ? (
                                    <MediaPostBlock post={post} />
                                ) : (
                                    <PostCard post={post} />
                                )}
                            </BentoCell>
                        ))}
                    </InfiniteScroll>
                ) : (
                    <div className="gc-bento gc-lobby-bento">{grid}</div>
                )}
                {postsOn && tab === 'activity' && <FriendActivity />}
                {postsOn && tab !== 'activity' && posts.data.length === 0 && (
                    <EmptyState
                        icon={
                            tab === 'country'
                                ? Globe
                                : tab === 'friends'
                                  ? Newspaper
                                  : Compass
                        }
                        title={tr('Стрічка поки порожня')}
                        text={tr(
                            'Напишіть перший запис або знайдіть друзів — і стрічка оживе.',
                        )}
                        action={
                            <Link
                                href="/people"
                                className="gc-primary-btn h-10 px-5"
                            >
                                <UserPlus className="size-4" />{' '}
                                {tr('Знайти друзів')}
                            </Link>
                        }
                    />
                )}
            </div>
        </>
    );
}
