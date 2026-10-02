import {
    Deferred,
    Head,
    InfiniteScroll,
    Link,
    usePage,
} from '@inertiajs/react';
import {
    Cake,
    Compass,
    Flame,
    Newspaper,
    Radio,
    Sparkles,
    UserPlus,
    UsersRound,
} from 'lucide-react';
import { FriendButton } from '@/components/gc/friend-button';
import { PersonRow } from '@/components/gc/person-card';
import { PostCard } from '@/components/gc/post-card';
import { PostComposer } from '@/components/gc/post-composer';
import { PostSkeleton } from '@/components/gc/post-skeleton';
import { UserAvatar } from '@/components/gc/user-avatar';
import { EmptyState, Widget, WidgetSkeleton } from '@/components/gc/widget';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PersonCard, PostItem, ScrollData, UserCard } from '@/types';

type Props = {
    tab: 'friends' | 'discover';
    hasFriends: boolean;
    posts: ScrollData<PostItem>;
    suggestions?: (UserCard & { mutual: number })[];
    onlineFriends?: UserCard[];
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
            label: 'Друзі',
            icon: UsersRound,
            href: '/feed',
            disabled: !hasFriends,
        },
        {
            key: 'discover',
            label: 'Рекомендації',
            icon: Flame,
            href: '/feed?tab=discover',
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
                    className={cn(
                        'flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition',
                        tab === item.key
                            ? 'nav-active text-white'
                            : 'text-white/55 hover:bg-white/[0.04] hover:text-white',
                        item.disabled && 'pointer-events-none opacity-40',
                    )}
                >
                    <item.icon
                        className={cn(
                            'size-4',
                            tab === item.key && 'text-[#8fa0ff]',
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
    hasFriends,
    posts,
    suggestions,
    onlineFriends,
    birthdays,
}: Props) {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="Новини" />
            <div className="flex gap-5">
                <div className="min-w-0 flex-1 space-y-4 xl:max-w-[640px]">
                    <PostComposer />
                    <FeedTabs tab={tab} hasFriends={hasFriends} />

                    {tab === 'discover' && !hasFriends && (
                        <div className="gradient-border glass flex items-center gap-4 rounded-3xl p-5">
                            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-brand shadow-[0_10px_30px_-8px_rgb(109_93_252/0.9)]">
                                <Sparkles className="size-6 text-white" />
                            </span>
                            <div className="text-sm">
                                <p className="font-semibold text-white">
                                    Ласкаво просимо в GameCon,{' '}
                                    {auth.user.first_name}!
                                </p>
                                <p className="mt-0.5 text-white/55">
                                    Поки що тут найпопулярніше за місяць.
                                    Додайте друзів, і їхні записи з'являться у
                                    вкладці «Друзі».
                                </p>
                            </div>
                        </div>
                    )}

                    {posts.data.length === 0 ? (
                        <EmptyState
                            icon={tab === 'friends' ? Newspaper : Compass}
                            title={
                                tab === 'friends'
                                    ? 'Стрічка поки порожня'
                                    : 'Тут ще нічого немає'
                            }
                            text="Напишіть перший запис або знайдіть друзів — і стрічка оживе."
                            action={
                                <Link
                                    href="/people"
                                    className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold"
                                >
                                    <UserPlus className="size-4" /> Знайти
                                    друзів
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
                        title="Зараз онлайн"
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
                                    Ніхто з друзів зараз не в мережі.
                                </p>
                            )}
                        </Deferred>
                    </Widget>

                    <Widget
                        title="Можливо, ви знайомі"
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
                                        Ви вже знайомі з усіма.{' '}
                                        <Link
                                            href="/people"
                                            className="text-[#9aa8ff] hover:underline"
                                        >
                                            Шукати людей
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
                            <Widget title="Дні народження" icon={Cake}>
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
