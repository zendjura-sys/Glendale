import { Head, InfiniteScroll, Link, router } from '@inertiajs/react';
import {
    BookOpen,
    CalendarDays,
    Camera,
    Check,
    ClipboardCheck,
    Crown,
    Globe,
    Hash,
    ImageIcon,
    Info,
    Lock,
    MapPin,
    Megaphone,
    PenLine,
    ScrollText,
    Settings,
    ShieldCheck,
    Tag,
    Timer,
    UserPlus,
    UsersRound,
    X,
} from 'lucide-react';
import { DonationJarCard } from '@/components/gc/donation-jar';
import type { DonationJar } from '@/components/gc/donation-jar';
import { useRef } from 'react';
import { membersLabel } from '@/components/communities/community-card';
import { JoinButton } from '@/components/communities/join-button';
import { roleLabels } from '@/components/communities/roles';
import { CommunityAvatar } from '@/components/gc/community-avatar';
import { InviteLinkButton } from '@/components/gc/invite-link';
import { PostCard } from '@/components/gc/post-card';
import { PostComposer } from '@/components/gc/post-composer';
import { PostSkeleton } from '@/components/gc/post-skeleton';
import { VoiceRooms } from '@/components/gc/voice-rooms';
import { ListenRoomButton } from '@/components/music/listen-room-button';
import { UserAvatar } from '@/components/gc/user-avatar';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import { EmptyState, Widget } from '@/components/gc/widget';
import { compactNumber, formatDate, plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    CommunityDetails,
    CommunityRole,
    MembershipStatus,
    PostItem,
    ScrollData,
    UserCard,
} from '@/types';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';

type Props = {
    community: CommunityDetails;
    /** Банка Monobank спільноти (відкладений проп). */
    donation?: DonationJar | null;
    membership: { status: MembershipStatus; role: CommunityRole } | null;
    can: {
        view: boolean;
        post: boolean;
        post_as_community: boolean;
        manage: boolean;
        moderate: boolean;
    };
    tags: string[];
    tag: string | null;
    queue: PostItem[];
    my_pending: number;
    rules: {
        rules: boolean;
        handbook: boolean;
        premoderation: boolean;
        slow_mode: number;
    };
    stats: {
        members: number;
        posts: number;
        friends: number;
        requests: number;
    };
    members: UserCard[];
    managers: (UserCard & { role: CommunityRole })[];
    photos: {
        count: number;
        items: {
            id: number;
            url: string;
            href: string;
            alt?: string | null;
            is_sensitive?: boolean;
        }[];
        can_create: boolean;
    } | null;
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
    photos,
    posts,
    tags,
    tag,
    queue,
    my_pending,
    rules,
    donation,
}: Props) {
    const channelsOn = usePlugin('community_channels');
    const isPublic = community.type === 'public';
    const moderate = (postId: number, approve: boolean) => {
        const url = `/c/${community.slug}/queue/${postId}`;
        const options = { preserveScroll: true };
        if (approve) {
            router.post(url, {}, options);
        } else {
            router.delete(url, options);
        }
    };

    return (
        <>
            <Head title={community.name} />

            <section className="glass relative overflow-hidden rounded-2xl">
                <div className="relative isolate h-48 overflow-hidden sm:h-64">
                    {community.cover_url ? (
                        <img
                            decoding="async"
                            fetchPriority="high"
                            src={community.cover_url}
                            alt=""
                            className="size-full object-cover"
                        />
                    ) : (
                        <div className="size-full bg-[radial-gradient(circle_at_15%_30%,#4f8bff_0%,transparent_45%),radial-gradient(circle_at_70%_20%,#22d3ee_0%,transparent_45%),radial-gradient(circle_at_95%_100%,#38e1ff_0%,transparent_45%)] opacity-80" />
                    )}
                    <div className="scrim absolute inset-0" />
                    <div className="grid-lines absolute inset-0 opacity-40" />
                    {can.manage && (
                        <ImageUpload
                            slug={community.slug}
                            field="cover"
                            className="absolute top-4 right-4 inline-flex items-center gap-2 rounded-xl bg-black/40 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-black/60"
                        >
                            <Camera className="size-4" />{' '}
                            {tr('Змінити обкладинку')}
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
                                    className="absolute inset-[3px] flex items-center justify-center rounded-[17px] bg-black/55 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100"
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
                                        ? tr('Публічна сторінка')
                                        : community.privacy === 'closed'
                                          ? tr('Закрита група')
                                          : tr('Відкрита група')}
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
                            {channelsOn && membership?.status === 'active' && (
                                <Link
                                    href={`/c/${community.slug}/channels`}
                                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:brightness-110"
                                >
                                    <Hash className="size-4" />
                                    {tr('Канали')}
                                </Link>
                            )}
                            {can.manage && (
                                <>
                                    <InviteLinkButton
                                        url={`/c/${community.slug}/invite-link`}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.11]"
                                    />
                                    <Link
                                        href={`/c/${community.slug}/members${stats.requests ? '?tab=requests' : ''}`}
                                        className="relative inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.11]"
                                    >
                                        <UserPlus className="size-4" />
                                        {tr('Учасники')}
                                        {stats.requests > 0 && (
                                            <span className="rounded-full bg-gradient-brand px-1.5 text-[11px] leading-5">
                                                {stats.requests}
                                            </span>
                                        )}
                                    </Link>
                                    <Link
                                        href={`/c/${community.slug}/settings`}
                                        className="inline-flex size-10 items-center justify-center rounded-xl bg-white/[0.07] text-white transition hover:bg-white/[0.11]"
                                        aria-label={tr('Керування')}
                                        title={tr('Керування')}
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
                                    <MapPin className="size-4 text-gc-lilac-400" />
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
                                    <Globe className="size-4 text-gc-cyan" />
                                    {community.website.replace(
                                        /^https?:\/\//,
                                        '',
                                    )}
                                </a>
                            )}
                            <span className="inline-flex items-center gap-1.5">
                                <CalendarDays className="size-4 text-white/40" />
                                {tr('Створено')}{' '}
                                {formatDate(community.created_at)}
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
                            {photos && (
                                <Link
                                    href={`/c/${community.slug}/photos`}
                                    className="flex flex-col items-center rounded-2xl px-4 py-2 transition hover:bg-white/[0.05]"
                                >
                                    <span className="font-display text-xl font-bold text-white tabular-nums">
                                        {compactNumber(photos.count)}
                                    </span>
                                    <span className="text-xs text-white/45">
                                        {tr('фото')}
                                    </span>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {!can.view ? (
                <div className="mt-5">
                    <EmptyState
                        icon={Lock}
                        title={tr('Це закрита група')}
                        text={tr(
                            'Записи та учасників бачать лише учасники. Подайте заявку — адміністратори розглянуть її найближчим часом.',
                        )}
                    />
                </div>
            ) : (
                <div className="mt-5 flex flex-col gap-5 xl:flex-row">
                    <aside className="w-full shrink-0 space-y-4 xl:sticky xl:top-[76px] xl:order-last xl:h-fit xl:w-[320px]">
                        {membership?.status === 'active' && (
                            <VoiceRooms
                                owner={{ type: 'community', id: community.id }}
                                label={community.name}
                                href={`/c/${community.slug}`}
                            />
                        )}
                        {membership?.status === 'active' && (
                            <ListenRoomButton
                                group="community"
                                id={community.id}
                            />
                        )}
                        <DonationJarCard
                            jar={donation}
                            title={tr('Підтримати спільноту')}
                        />
                        {(community.description ||
                            rules.rules ||
                            rules.handbook) && (
                            <Widget title={tr('Інформація')} icon={Info}>
                                {community.description && (
                                    <p className="px-1 text-sm leading-relaxed whitespace-pre-line text-white/75">
                                        {community.description}
                                    </p>
                                )}
                                {(rules.rules || rules.handbook) && (
                                    <div
                                        className={cn(
                                            'flex flex-wrap gap-2 px-1',
                                            community.description && 'mt-3',
                                        )}
                                    >
                                        {rules.rules && (
                                            <Link
                                                href={`/c/${community.slug}/rules`}
                                                className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-sm font-medium text-white transition hover:bg-white/[0.1]"
                                            >
                                                <ScrollText className="size-4" />
                                                {tr('Правила')}
                                            </Link>
                                        )}
                                        {rules.handbook && (
                                            <Link
                                                href={`/c/${community.slug}/handbook`}
                                                className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-sm font-medium text-white transition hover:bg-white/[0.1]"
                                            >
                                                <BookOpen className="size-4" />
                                                {tr('Довідник')}
                                            </Link>
                                        )}
                                    </div>
                                )}
                            </Widget>
                        )}

                        {photos && (photos.count > 0 || photos.can_create) && (
                            <Widget
                                title={tr('Фотографії')}
                                icon={ImageIcon}
                                action={
                                    <Link
                                        href={`/c/${community.slug}/photos`}
                                        className="text-xs text-gc-lilac-300 hover:text-white"
                                    >
                                        {photos.count > 0
                                            ? tr('Усі {count}', {
                                                  count: photos.count,
                                              })
                                            : tr('Створити альбом')}
                                    </Link>
                                }
                            >
                                {photos.items.length > 0 ? (
                                    <div className="grid grid-cols-3 gap-1.5 overflow-hidden rounded-2xl">
                                        {photos.items.map((photo) => (
                                            <Link
                                                key={photo.id}
                                                href={photo.href}
                                                className="group aspect-square overflow-hidden bg-white/5"
                                            >
                                                <img
                                                    src={photo.url}
                                                    alt={photo.alt ?? ''}
                                                    loading="lazy"
                                                    className={cn(
                                                        'size-full object-cover transition duration-500',
                                                        photo.is_sensitive
                                                            ? 'scale-110 blur-2xl'
                                                            : 'group-hover:scale-110',
                                                    )}
                                                />
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="px-1 text-sm text-white/45">
                                        {tr('Додайте перший альбом спільноти.')}
                                    </p>
                                )}
                            </Widget>
                        )}

                        <Widget
                            title={isPublic ? tr('Підписники') : tr('Учасники')}
                            icon={UsersRound}
                            action={
                                <Link
                                    href={`/c/${community.slug}/members`}
                                    className="text-xs text-gc-lilac-300 hover:text-white"
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
                                    {tr('тут')}
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
                            <Widget title={tr('Керівники')} icon={ShieldCheck}>
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
                                                        <Crown className="size-3 text-gc-gold" />
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
                        {can.moderate && queue.length > 0 && (
                            <section
                                id="queue"
                                className="glass space-y-3 rounded-2xl p-4 sm:p-5"
                            >
                                <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                                    <ClipboardCheck className="size-4 text-gc-amber" />
                                    {tr('Черга на перевірку')}
                                    <span className="rounded-chip bg-gc-amber/15 px-2 text-xs leading-5 text-gc-amber">
                                        {queue.length}
                                    </span>
                                </h2>
                                {queue.map((post) => (
                                    <div key={post.id} className="space-y-2">
                                        <PostCard post={post} />
                                        <div className="flex flex-wrap justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    moderate(post.id, false)
                                                }
                                                className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.1] hover:text-white"
                                            >
                                                <X className="size-4" />
                                                {tr('Відхилити')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    moderate(post.id, true)
                                                }
                                                className="inline-flex h-9 items-center gap-2 rounded-xl bg-gc-indigo px-3 text-sm font-semibold text-white transition hover:bg-gc-indigo/85"
                                            >
                                                <Check className="size-4" />
                                                {tr('Опублікувати')}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </section>
                        )}

                        {can.post && (
                            <PostComposer
                                community={{
                                    id: community.id,
                                    slug: community.slug,
                                    name: community.name,
                                    avatar_url: community.avatar_url,
                                    type: community.type,
                                    canPostAsCommunity: can.post_as_community,
                                    tags,
                                }}
                            />
                        )}

                        {can.post &&
                            !can.moderate &&
                            (rules.premoderation ||
                                rules.slow_mode > 0 ||
                                my_pending > 0) && (
                                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-white/50">
                                    {rules.premoderation && (
                                        <span className="inline-flex items-center gap-1">
                                            <ClipboardCheck className="size-3.5" />
                                            {tr(
                                                'Записи з’являються після перевірки керівниками',
                                            )}
                                        </span>
                                    )}
                                    {rules.slow_mode > 0 && (
                                        <span className="inline-flex items-center gap-1">
                                            <Timer className="size-3.5" />
                                            {tr(
                                                'Повільний режим: один запис на {minutes} хв',
                                                {
                                                    minutes: Math.round(
                                                        rules.slow_mode / 60,
                                                    ),
                                                },
                                            )}
                                        </span>
                                    )}
                                    {my_pending > 0 && (
                                        <span className="text-gc-amber">
                                            {tr(
                                                'Ваших записів на перевірці: {count}',
                                                {
                                                    count: my_pending,
                                                },
                                            )}
                                        </span>
                                    )}
                                </p>
                            )}

                        {tags.length > 0 && (
                            <nav
                                aria-label={tr('Мітки')}
                                className="flex gap-2 overflow-x-auto pb-1"
                            >
                                {[null, ...tags].map((item) => (
                                    <Link
                                        key={item ?? '*'}
                                        href={`/c/${community.slug}${item ? `?tag=${encodeURIComponent(item)}` : ''}`}
                                        preserveScroll
                                        className={cn(
                                            'inline-flex h-8 shrink-0 items-center gap-1 rounded-control px-3 text-xs font-medium transition',
                                            tag === item
                                                ? 'bg-gc-indigo text-white'
                                                : 'bg-white/[0.05] text-white/65 hover:text-white',
                                        )}
                                    >
                                        {item ? (
                                            <>
                                                <Hash className="size-3" />
                                                {item}
                                            </>
                                        ) : (
                                            tr('Усі записи')
                                        )}
                                    </Link>
                                ))}
                            </nav>
                        )}

                        {posts.data.length === 0 ? (
                            <EmptyState
                                icon={PenLine}
                                title={tr('Тут поки тихо')}
                                text={
                                    can.post
                                        ? tr(
                                              'Опублікуйте перший запис — розкажіть, про що ця спільнота.',
                                          )
                                        : tr(
                                              'Новини з’являться тут, щойно адміністратори щось опублікують.',
                                          )
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
