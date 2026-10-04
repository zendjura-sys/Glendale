import {
    Deferred,
    Head,
    InfiniteScroll,
    Link,
    router,
    usePage,
} from '@inertiajs/react';
import {
    CalendarDays,
    Camera,
    Gamepad2,
    Cake,
    Globe,
    ImageIcon,
    Lock,
    MapPin,
    MessageCircle,
    Music2,
    PenLine,
    ShieldCheck,
    UsersRound,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { FriendButton } from '@/components/gc/friend-button';
import { PostCard } from '@/components/gc/post-card';
import { PostComposer } from '@/components/gc/post-composer';
import { PostSkeleton } from '@/components/gc/post-skeleton';
import { UserAvatar } from '@/components/gc/user-avatar';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import { EmptyState, Widget } from '@/components/gc/widget';
import { NowPlayingCard } from '@/components/music/now-playing';
import { AchievementsCard } from '@/components/gc/achievements';
import { PlayingBadge, PlayingDialog } from '@/components/gc/playing';
import type { AchievementsData } from '@/components/gc/achievements';
import { compactNumber, formatDate, lastSeen, plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    NowPlaying,
    PostItem,
    Relation,
    ScrollData,
    UserCard,
} from '@/types';

type Profile = UserCard & {
    last_name: string;
    cover_url: string | null;
    about: string | null;
    city: string | null;
    birthday: string | null;
    website: string | null;
    gender: string | null;
    is_private: boolean;
    last_seen_at: string | null;
    joined_at: string | null;
    role: string;
};

type Props = {
    profile: Profile;
    relation: Relation;
    canSeeContent: boolean;
    canPost: boolean;
    canMessage: boolean;
    stats: {
        friends: number;
        posts: number;
        photos: number;
        mutual: number;
    };
    friends: UserCard[];
    photos: { id: number; url: string; href: string }[];
    photosHref: string | null;
    achievements?: AchievementsData;
    audio: { href: string; tracks: number } | null;
    nowPlaying?: NowPlaying | null;
    posts: ScrollData<PostItem>;
};

function Counter({
    value,
    label,
    href,
}: {
    value: number;
    label: string;
    href?: string;
}) {
    const content = (
        <>
            <span className="font-display text-xl font-bold text-white tabular-nums">
                {compactNumber(value)}
            </span>
            <span className="text-xs text-white/45">{label}</span>
        </>
    );

    return href ? (
        <Link
            href={href}
            className="flex flex-col items-center rounded-2xl px-4 py-2 transition hover:bg-white/[0.05]"
        >
            {content}
        </Link>
    ) : (
        <div className="flex flex-col items-center px-4 py-2">{content}</div>
    );
}

function Uploader({
    field,
    url,
    children,
    className,
}: {
    field: 'avatar' | 'cover';
    url: string;
    children: React.ReactNode;
    className?: string;
}) {
    const input = useRef<HTMLInputElement>(null);

    return (
        <>
            <input
                ref={input}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file)
                        router.post(
                            url,
                            { [field]: file },
                            { forceFormData: true, preserveScroll: true },
                        );
                }}
            />
            <button
                type="button"
                onClick={() => input.current?.click()}
                className={className}
            >
                {children}
            </button>
        </>
    );
}

export default function ProfileShow({
    profile,
    relation,
    canSeeContent,
    canPost,
    canMessage,
    stats,
    friends,
    photos,
    photosHref,
    achievements,
    audio,
    nowPlaying,
    posts,
}: Props) {
    const { modules } = usePage().props;
    const isSelf = relation === 'self';
    const [playingOpen, setPlayingOpen] = useState(false);
    const roleBadge =
        profile.role === 'admin'
            ? 'Адміністратор'
            : profile.role === 'moderator'
              ? 'Модератор'
              : null;

    return (
        <>
            <Head title={profile.name} />

            <section className="glass relative overflow-hidden rounded-[28px]">
                <div className="relative h-52 overflow-hidden sm:h-72">
                    {profile.cover_url ? (
                        <img
                            src={profile.cover_url}
                            alt=""
                            className="size-full object-cover"
                        />
                    ) : (
                        <div className="size-full bg-[radial-gradient(circle_at_20%_20%,#4f8bff_0%,transparent_45%),radial-gradient(circle_at_80%_30%,#a855f7_0%,transparent_45%),radial-gradient(circle_at_50%_100%,#f04fd8_0%,transparent_50%)] opacity-80" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#070a16] via-[#070a16]/30 to-transparent" />
                    <div className="grid-lines absolute inset-0 opacity-40" />
                    {isSelf && (
                        <Uploader
                            field="cover"
                            url="/me/cover"
                            className="absolute top-4 right-4 inline-flex items-center gap-2 rounded-xl bg-black/40 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-black/60"
                        >
                            <Camera className="size-4" /> Змінити обкладинку
                        </Uploader>
                    )}
                </div>

                <div className="relative px-5 pb-5 sm:px-8">
                    <div className="-mt-20 flex flex-col gap-5 sm:-mt-24 sm:flex-row sm:items-end">
                        <div className="group relative w-fit">
                            <UserAvatar user={profile} size="hero" ring />
                            {isSelf && (
                                <Uploader
                                    field="avatar"
                                    url="/me/avatar"
                                    className="absolute inset-[6px] flex items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100"
                                >
                                    <Camera className="size-7" />
                                </Uploader>
                            )}
                        </div>

                        <div className="min-w-0 flex-1 pb-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-[30px]">
                                    {profile.name}
                                </h1>
                                {profile.is_verified && (
                                    <VerifiedBadge className="size-6" />
                                )}
                                {roleBadge && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold text-gold">
                                        <ShieldCheck className="size-3" />{' '}
                                        {roleBadge}
                                    </span>
                                )}
                            </div>
                            {profile.status && (
                                <p className="mt-1.5 text-[15px] text-white/75">
                                    {profile.status}
                                </p>
                            )}
                            {(profile.playing || isSelf) && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {profile.playing && (
                                        <PlayingBadge
                                            playing={profile.playing}
                                        />
                                    )}
                                    {isSelf && (
                                        <button
                                            type="button"
                                            onClick={() => setPlayingOpen(true)}
                                            className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-white/60 hover:text-white"
                                        >
                                            <Gamepad2 className="size-3.5" />
                                            {profile.playing
                                                ? 'Змінити'
                                                : 'Граю в…'}
                                        </button>
                                    )}
                                </div>
                            )}
                            {isSelf && (
                                <PlayingDialog
                                    open={playingOpen}
                                    onOpenChange={setPlayingOpen}
                                />
                            )}
                            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-white/45">
                                {profile.is_online ? (
                                    <>
                                        <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgb(52_211_153)]" />{' '}
                                        онлайн
                                    </>
                                ) : (
                                    lastSeen(
                                        profile.last_seen_at,
                                        profile.gender,
                                    )
                                )}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pb-1">
                            {isSelf ? (
                                <Link
                                    href="/settings/profile"
                                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.11]"
                                >
                                    <PenLine className="size-4" /> Редагувати
                                    профіль
                                </Link>
                            ) : (
                                <>
                                    <FriendButton
                                        username={profile.username}
                                        relation={relation}
                                    />
                                    {modules.includes('messages') &&
                                        canMessage && (
                                            <Link
                                                href={`/messages/with/${profile.username}`}
                                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.11]"
                                            >
                                                <MessageCircle className="size-4" />{' '}
                                                Написати
                                            </Link>
                                        )}
                                </>
                            )}
                        </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
                        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-white/55">
                            {profile.city && (
                                <span className="inline-flex items-center gap-1.5">
                                    <MapPin className="size-4 text-[#8fa0ff]" />{' '}
                                    {profile.city}
                                </span>
                            )}
                            {profile.birthday && (
                                <span className="inline-flex items-center gap-1.5">
                                    <Cake className="size-4 text-[#f04fd8]" />{' '}
                                    {formatDate(profile.birthday, false)}
                                </span>
                            )}
                            {profile.website && (
                                <a
                                    href={profile.website}
                                    target="_blank"
                                    rel="noreferrer nofollow"
                                    className="inline-flex items-center gap-1.5 hover:text-white"
                                >
                                    <Globe className="size-4 text-[#38e1ff]" />{' '}
                                    {profile.website.replace(
                                        /^https?:\/\//,
                                        '',
                                    )}
                                </a>
                            )}
                            {profile.joined_at && (
                                <span className="inline-flex items-center gap-1.5">
                                    <CalendarDays className="size-4 text-white/40" />{' '}
                                    В GameCon з {formatDate(profile.joined_at)}
                                </span>
                            )}
                        </div>
                        <div className="flex">
                            <Counter
                                value={stats.friends}
                                label={plural(stats.friends, [
                                    'друг',
                                    'друзі',
                                    'друзів',
                                ])}
                                href={isSelf ? '/friends' : undefined}
                            />
                            <Counter
                                value={stats.posts}
                                label={plural(stats.posts, [
                                    'запис',
                                    'записи',
                                    'записів',
                                ])}
                            />
                            <Counter
                                value={stats.photos}
                                label="фото"
                                href={photosHref ?? undefined}
                            />
                            {audio && (
                                <Counter
                                    value={audio.tracks}
                                    label="аудіо"
                                    href={audio.href}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {!canSeeContent ? (
                <div className="mt-5">
                    <EmptyState
                        icon={Lock}
                        title="Це закритий профіль"
                        text={`Додайте ${profile.first_name} у друзі, щоб бачити записи, фото та інформацію.`}
                    />
                </div>
            ) : (
                <div className="mt-5 flex flex-col gap-5 xl:flex-row">
                    <aside className="w-full shrink-0 space-y-4 xl:sticky xl:top-[76px] xl:h-fit xl:w-[320px]">
                        {profile.about && (
                            <Widget title="Про себе">
                                <p className="px-1 text-sm leading-relaxed whitespace-pre-line text-white/75">
                                    {profile.about}
                                </p>
                            </Widget>
                        )}

                        {achievements && (
                            <AchievementsCard
                                data={achievements}
                                isSelf={isSelf}
                            />
                        )}

                        {audio && (
                            <Deferred
                                data="nowPlaying"
                                fallback={<span hidden />}
                            >
                                {nowPlaying ? (
                                    <NowPlayingCard track={nowPlaying} />
                                ) : null}
                            </Deferred>
                        )}

                        {audio && audio.tracks > 0 && (
                            <Link
                                href={audio.href}
                                className="glass group flex items-center gap-3 rounded-3xl p-4 transition hover:border-white/15"
                            >
                                <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#a855f7] to-[#4f8bff] shadow-[0_10px_30px_-10px_rgb(168_85_247/0.9)]">
                                    <Music2 className="size-5 text-white" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold text-white">
                                        Аудіозаписи
                                    </span>
                                    <span className="block text-xs text-white/45">
                                        {audio.tracks}{' '}
                                        {plural(audio.tracks, [
                                            'трек',
                                            'треки',
                                            'треків',
                                        ])}
                                    </span>
                                </span>
                                <span className="text-xs text-white/40 transition group-hover:text-white">
                                    Слухати →
                                </span>
                            </Link>
                        )}

                        <Widget
                            title="Друзі"
                            icon={UsersRound}
                            action={
                                stats.mutual > 0 ? (
                                    <span className="text-xs text-white/45">
                                        {stats.mutual}{' '}
                                        {plural(stats.mutual, [
                                            'спільний',
                                            'спільні',
                                            'спільних',
                                        ])}
                                    </span>
                                ) : undefined
                            }
                        >
                            {friends.length === 0 ? (
                                <p className="px-1 text-sm text-white/45">
                                    Поки немає друзів.
                                </p>
                            ) : (
                                <div className="grid grid-cols-3 gap-2">
                                    {friends.map((friend) => (
                                        <Link
                                            key={friend.id}
                                            href={`/${friend.username}`}
                                            className="flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center transition hover:bg-white/[0.04]"
                                        >
                                            <UserAvatar
                                                user={friend}
                                                size="lg"
                                            />
                                            <span className="w-full truncate text-xs text-white/75">
                                                {friend.first_name}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </Widget>

                        {photos.length > 0 && (
                            <Widget
                                title="Фото"
                                icon={ImageIcon}
                                action={
                                    photosHref ? (
                                        <Link
                                            href={photosHref}
                                            className="text-xs text-cyan-300/80 transition hover:text-cyan-200"
                                        >
                                            Усі {stats.photos}
                                        </Link>
                                    ) : undefined
                                }
                            >
                                <div className="grid grid-cols-3 gap-1.5 overflow-hidden rounded-2xl">
                                    {photos.map((photo) => (
                                        <Link
                                            key={photo.id}
                                            href={photo.href}
                                            className="group aspect-square overflow-hidden bg-white/5"
                                        >
                                            <img
                                                src={photo.url}
                                                alt=""
                                                loading="lazy"
                                                className="size-full object-cover transition duration-500 group-hover:scale-110"
                                            />
                                        </Link>
                                    ))}
                                </div>
                            </Widget>
                        )}
                    </aside>

                    <div className="min-w-0 flex-1 space-y-4">
                        {canPost && (
                            <PostComposer wall={isSelf ? null : profile} />
                        )}

                        {posts.data.length === 0 ? (
                            <EmptyState
                                icon={PenLine}
                                title="На стіні поки порожньо"
                                text={
                                    isSelf
                                        ? 'Розкажіть світу щось цікаве — перший запис завжди найкращий.'
                                        : `${profile.first_name} ще нічого не публікував(-ла).`
                                }
                            />
                        ) : (
                            <InfiniteScroll
                                data="posts"
                                preserveUrl
                                buffer={600}
                                loading={<PostSkeleton />}
                                className={cn('space-y-4')}
                            >
                                {posts.data.map((post) => (
                                    <PostCard key={post.id} post={post} />
                                ))}
                            </InfiniteScroll>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
