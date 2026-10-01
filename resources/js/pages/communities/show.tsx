import { Head, InfiniteScroll, Link, router } from '@inertiajs/react';
import {
    CalendarDays,
    Camera,
    Crown,
    Globe,
    Info,
    Lock,
    MapPin,
    Megaphone,
    PenLine,
    Settings,
    ShieldCheck,
    Tag,
    UserPlus,
    UsersRound,
} from 'lucide-react';
import { useRef } from 'react';
import { membersLabel } from '@/components/communities/community-card';
import { JoinButton } from '@/components/communities/join-button';
import { roleLabels } from '@/components/communities/roles';
import { CommunityAvatar } from '@/components/gc/community-avatar';
import { PostCard } from '@/components/gc/post-card';
import { PostComposer } from '@/components/gc/post-composer';
import { PostSkeleton } from '@/components/gc/post-skeleton';
import { UserAvatar } from '@/components/gc/user-avatar';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import { EmptyState, Widget } from '@/components/gc/widget';
import { compactNumber, formatDate, plural } from '@/lib/format';
import type {
    CommunityDetails,
    CommunityRole,
    MembershipStatus,
    PostItem,
    ScrollData,
    UserCard,
} from '@/types';

type Props = {
    community: CommunityDetails;
    membership: { status: MembershipStatus; role: CommunityRole } | null;
    can: {
        view: boolean;
        post: boolean;
        post_as_community: boolean;
        manage: boolean;
    };
    stats: {
        members: number;
        posts: number;
        friends: number;
        requests: number;
    };
    members: UserCard[];
    managers: (UserCard & { role: CommunityRole })[];
    posts: ScrollData<PostItem>;
};

function ImageUpload({
    slug,
    field,
    className,
    children,
}: {
    slug: string;
    field: 'avatar' | 'cover';
    className?: string;
    children: React.ReactNode;
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
                    if (file) {
                        router.post(
                            `/c/${slug}/images/${field}`,
                            { [field]: file },
                            { forceFormData: true, preserveScroll: true },
                        );
                    }
                    event.target.value = '';
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

export default function CommunityShow({
    community,
    membership,
    can,
    stats,
    members,
    managers,
    posts,
}: Props) {
    const isPublic = community.type === 'public';

    return (
        <>
            <Head title={community.name} />

            <section className="glass relative overflow-hidden rounded-[28px]">
                <div className="relative h-48 overflow-hidden sm:h-64">
                    {community.cover_url ? (
                        <img
                            src={community.cover_url}
                            alt=""
                            className="size-full object-cover"
                        />
                    ) : (
                        <div className="size-full bg-[radial-gradient(circle_at_15%_30%,#4f8bff_0%,transparent_45%),radial-gradient(circle_at_70%_20%,#a855f7_0%,transparent_45%),radial-gradient(circle_at_95%_100%,#38e1ff_0%,transparent_45%)] opacity-80" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#070a16] via-[#070a16]/30 to-transparent" />
                    <div className="grid-lines absolute inset-0 opacity-40" />
                    {can.manage && (
                        <ImageUpload
                            slug={community.slug}
                            field="cover"
                            className="absolute top-4 right-4 inline-flex items-center gap-2 rounded-xl bg-black/40 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-black/60"
                        >
                            <Camera className="size-4" /> Змінити обкладинку
                        </ImageUpload>
                    )}
                </div>

                <div className="relative px-5 pb-5 sm:px-8">
                    <div className="-mt-16 flex flex-col gap-5 sm:-mt-20 sm:flex-row sm:items-end">
                        <div className="group relative w-fit">
                            <CommunityAvatar
                                community={community}
                                size="hero"
                                ring
                            />
                            {can.manage && (
                                <ImageUpload
                                    slug={community.slug}
                                    field="avatar"
                                    className="absolute inset-[3px] flex items-center justify-center rounded-[35px] bg-black/55 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100"
                                >
                                    <Camera className="size-7" />
                                </ImageUpload>
                            )}
                        </div>

                        <div className="min-w-0 flex-1 pb-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-[30px]">
                                    {community.name}
                                </h1>
                                {community.is_verified && (
                                    <VerifiedBadge className="size-6" />
                                )}
                            </div>
                            {community.status && (
                                <p className="mt-1.5 text-[15px] text-white/75">
                                    {community.status}
                                </p>
                            )}
                            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/45">
                                <span className="inline-flex items-center gap-1">
                                    {isPublic ? (
                                        <Megaphone className="size-3.5" />
                                    ) : (
                                        <UsersRound className="size-3.5" />
                                    )}
                                    {isPublic
                                        ? 'Публічна сторінка'
                                        : community.privacy === 'closed'
                                          ? 'Закрита група'
                                          : 'Відкрита група'}
                                </span>
                                {community.category_label && (
                                    <span className="inline-flex items-center gap-1">
                                        <Tag className="size-3.5" />
                                        {community.category_label}
                                    </span>
                                )}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pb-1">
                            <JoinButton
                                community={community}
                                status={membership?.status ?? null}
                                role={membership?.role}
                            />
                            {can.manage && (
                                <>
                                    <Link
                                        href={`/c/${community.slug}/members${stats.requests ? '?tab=requests' : ''}`}
                                        className="relative inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.11]"
                                    >
                                        <UserPlus className="size-4" />
                                        Учасники
                                        {stats.requests > 0 && (
                                            <span className="rounded-full bg-gradient-brand px-1.5 text-[11px] leading-5">
                                                {stats.requests}
                                            </span>
                                        )}
                                    </Link>
                                    <Link
                                        href={`/c/${community.slug}/settings`}
                                        className="inline-flex size-10 items-center justify-center rounded-xl bg-white/[0.07] text-white transition hover:bg-white/[0.11]"
                                        aria-label="Керування"
                                        title="Керування"
                                    >
                                        <Settings className="size-4" />
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
                        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-white/55">
                            {community.city && (
                                <span className="inline-flex items-center gap-1.5">
                                    <MapPin className="size-4 text-[#8fa0ff]" />
                                    {community.city}
                                </span>
                            )}
                            {community.website && (
                                <a
                                    href={community.website}
                                    target="_blank"
                                    rel="noreferrer nofollow"
                                    className="inline-flex items-center gap-1.5 hover:text-white"
                                >
                                    <Globe className="size-4 text-[#38e1ff]" />
                                    {community.website.replace(
                                        /^https?:\/\//,
                                        '',
                                    )}
                                </a>
                            )}
                            <span className="inline-flex items-center gap-1.5">
                                <CalendarDays className="size-4 text-white/40" />
                                Створено {formatDate(community.created_at)}
                            </span>
                        </div>
                        <div className="flex">
                            <Link
                                href={`/c/${community.slug}/members`}
                                className="flex flex-col items-center rounded-2xl px-4 py-2 transition hover:bg-white/[0.05]"
                            >
                                <span className="font-display text-xl font-bold text-white tabular-nums">
                                    {compactNumber(stats.members)}
                                </span>
                                <span className="text-xs text-white/45">
                                    {isPublic
                                        ? plural(stats.members, [
                                              'підписник',
                                              'підписники',
                                              'підписників',
                                          ])
                                        : plural(stats.members, [
                                              'учасник',
                                              'учасники',
                                              'учасників',
                                          ])}
                                </span>
                            </Link>
                            <div className="flex flex-col items-center px-4 py-2">
                                <span className="font-display text-xl font-bold text-white tabular-nums">
                                    {compactNumber(stats.posts)}
                                </span>
                                <span className="text-xs text-white/45">
                                    {plural(stats.posts, [
                                        'запис',
                                        'записи',
                                        'записів',
                                    ])}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {!can.view ? (
                <div className="mt-5">
                    <EmptyState
                        icon={Lock}
                        title="Це закрита група"
                        text="Записи та учасників бачать лише учасники. Подайте заявку — адміністратори розглянуть її найближчим часом."
                    />
                </div>
            ) : (
                <div className="mt-5 flex flex-col gap-5 xl:flex-row">
                    <aside className="w-full shrink-0 space-y-4 xl:sticky xl:top-[76px] xl:order-last xl:h-fit xl:w-[320px]">
                        {community.description && (
                            <Widget title="Інформація" icon={Info}>
                                <p className="px-1 text-sm leading-relaxed whitespace-pre-line text-white/75">
                                    {community.description}
                                </p>
                            </Widget>
                        )}

                        <Widget
                            title={isPublic ? 'Підписники' : 'Учасники'}
                            icon={UsersRound}
                            action={
                                <Link
                                    href={`/c/${community.slug}/members`}
                                    className="text-xs text-[#9aa8ff] hover:text-white"
                                >
                                    {membersLabel(stats.members, isPublic)}
                                </Link>
                            }
                        >
                            {stats.friends > 0 && (
                                <p className="mb-2 px-1 text-xs text-white/50">
                                    {stats.friends}{' '}
                                    {plural(stats.friends, [
                                        'ваш друг',
                                        'ваші друзі',
                                        'ваших друзів',
                                    ])}{' '}
                                    тут
                                </p>
                            )}
                            <div className="grid grid-cols-3 gap-2">
                                {members.map((member) => (
                                    <Link
                                        key={member.id}
                                        href={`/${member.username}`}
                                        className="flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center transition hover:bg-white/[0.04]"
                                    >
                                        <UserAvatar user={member} size="lg" />
                                        <span className="w-full truncate text-xs text-white/75">
                                            {member.first_name}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </Widget>

                        {managers.length > 0 && (
                            <Widget title="Керівники" icon={ShieldCheck}>
                                <div className="space-y-1">
                                    {managers.map((manager) => (
                                        <Link
                                            key={manager.id}
                                            href={`/${manager.username}`}
                                            className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-white/[0.04]"
                                        >
                                            <UserAvatar
                                                user={manager}
                                                size="sm"
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium text-white">
                                                    {manager.name}
                                                </span>
                                                <span className="flex items-center gap-1 text-xs text-white/45">
                                                    {manager.role ===
                                                        'owner' && (
                                                        <Crown className="size-3 text-[#ffd36b]" />
                                                    )}
                                                    {roleLabels[manager.role]}
                                                </span>
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </Widget>
                        )}
                    </aside>

                    <div className="min-w-0 flex-1 space-y-4">
                        {can.post && (
                            <PostComposer
                                community={{
                                    id: community.id,
                                    slug: community.slug,
                                    name: community.name,
                                    avatar_url: community.avatar_url,
                                    type: community.type,
                                    canPostAsCommunity: can.post_as_community,
                                }}
                            />
                        )}

                        {posts.data.length === 0 ? (
                            <EmptyState
                                icon={PenLine}
                                title="Тут поки тихо"
                                text={
                                    can.post
                                        ? 'Опублікуйте перший запис — розкажіть, про що ця спільнота.'
                                        : 'Новини з’являться тут, щойно адміністратори щось опублікують.'
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
                </div>
            )}
        </>
    );
}
