import { SupportAuthorButton } from '@/components/billing/support-author';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
    Deferred,
    Head,
    InfiniteScroll,
    Link,
    router,
    usePage,
} from '@inertiajs/react';
import { ErrorBoundary } from '@/components/gc/error-boundary';
import { CrosspostButton } from '@/components/gc/crosspost-button';
import { AuthorStatsButton } from '@/components/profile/author-stats';
import { AccountCard } from '@/components/profile/account-card';
import type { AccountCardData } from '@/components/profile/account-card';
import { GamerIds } from '@/components/profile/gamer-ids';
import type { GamerId } from '@/components/profile/gamer-ids';
import { MySetup } from '@/components/profile/my-setup';
import { ProfileTrack } from '@/components/profile/profile-track';
import { CardShowcase } from '@/components/cards/game-card';
import type { ShowcaseData } from '@/components/cards/game-card';
import type { TrackCard } from '@/types/music';
import type { SetupData } from '@/components/profile/my-setup';
import { StreamSchedule } from '@/components/profile/stream-schedule';
import { CinemaStats } from '@/components/profile/cinema-stats';
import type { CinemaStatsData } from '@/components/profile/cinema-stats';
import type { StreamSlot } from '@/components/profile/stream-schedule';
import { SteamAchievements } from '@/components/profile/steam-achievements';
import {
    ProfileSectionBody,
    ProfileSectionTabs,
} from '@/components/profile/profile-sections';
import type { ProfileSection } from '@/components/profile/profile-sections';
import { ProfileVisitorsCarousel } from '@/components/profile/profile-visitors';
import { BadgeStrip } from '@/components/profile/tiered-badges';
import type { TieredBadge } from '@/components/profile/tiered-badges';
import { EmbedButton } from '@/components/gc/embed-button';
import { CompatibilityChip } from '@/components/games/compatibility-chip';
import type { Compatibility } from '@/components/games/compatibility-chip';
import {
    Pin,
    Ban,
    CalendarDays,
    HeartHandshake,
    Newspaper,
    Camera,
    Cake,
    QrCode,
    Globe,
    ImageIcon,
    Lock,
    MapPin,
    MessageCircle,
    Music2,
    PenLine,
    ShieldCheck,
    UserPlus,
    UsersRound,
    Grid3x3,
    Swords,
    Video,
    X,
    Settings,
    Coins,
    Link2,
    Gamepad2,
    ChevronDown,
} from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { FriendButton } from '@/components/gc/friend-button';
import { PhoneBadge } from '@/components/phone/phone-badge';
import { PostCard } from '@/components/gc/post-card';
import { PostComposer } from '@/components/gc/post-composer';
import { PostSkeleton } from '@/components/gc/post-skeleton';
import { ReportPersonButton } from '@/components/gc/report-person';
import { UserAvatar } from '@/components/gc/user-avatar';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import { PlusBadge, plusNameProps } from '@/components/gc/plus';
import {
    CosmeticBadge,
    cosmeticNameStyle,
} from '@/components/season/cosmetics';
import { WatchedTogether } from '@/components/profile/watched-together';
import type { TogetherPerson } from '@/components/profile/watched-together';
import { EmptyState, Widget } from '@/components/gc/widget';
import { NowPlayingCard } from '@/components/music/now-playing';
import { AchievementsCard } from '@/components/gc/achievements';
import { StatusDialog, statusUntilLabel } from '@/components/gc/status-dialog';
import { BacklogWidget } from '@/components/games/backlog';
import type { BacklogSummary } from '@/components/games/backlog';
import { PlayingBadge } from '@/components/gc/playing';
import type { AchievementsData } from '@/components/gc/achievements';
import { CharactersWidget } from '@/components/characters/character-card';
import type { CharacterCardData } from '@/components/characters/character-card';
import {
    compactNumber,
    formatDate,
    languageName,
    lastSeen,
    plural,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    NowPlaying,
    PhoneCard,
    PostItem,
    Relation,
    ScrollData,
    UserCard,
    VideoBackground,
} from '@/types';
import { AffiliationBadges } from '@/components/gc/affiliation-badges';
import { UserRoles, UserTitle } from '@/components/gc/user-title';
import { LOCALE, tr } from '@/lib/i18n';
import { LiveBadge, ProfileStream } from '@/components/streams/stream';
import { StreamerShowcase } from '@/components/streams/streamer-showcase';
import type { StreamInfo } from '@/components/streams/stream';
import { useFeature, usePlugin } from '@/lib/plugins';
import { setPageBackgroundVideo } from '@/lib/backgrounds';

const PROFILE_BLOCKS = [
    'track',
    'platforms',
    'steam',
    'steam_achievements',
    'setup',
    'stream_schedule',
    'cards',
    'games',
    'cinema_stats',
    'about',
    'achievements',
    'audio',
    'friends',
    'photos',
    'characters',
];

function blockSequence(order: string[]): string[] {
    const picked: string[] = [];
    for (const key of order) {
        if (PROFILE_BLOCKS.includes(key) && !picked.includes(key))
            picked.push(key);
    }
    for (const key of PROFILE_BLOCKS) {
        if (!picked.includes(key)) picked.push(key);
    }

    return picked;
}

type Profile = UserCard & {
    last_name: string;
    cover_url: string | null;
    cover_video_url?: string | null;
    has_tiers?: boolean;
    /** GameCon+: кольори сторінки. */
    accent?: string[] | null;
    /** Візерунок ексклюзивної теми GameCon+. */
    pattern?: 'grid' | 'stars' | 'waves' | 'hex' | null;
    /** GameCon+: ефект шапки — сяйво внизу обкладинки або жива рамка. */
    header_fx?: 'aurora' | 'rim' | null;
    /** GameCon+: відеофон власника з бібліотеки — фон сторінки й для гостей. */
    background_video?: VideoBackground | null;
    /** Внутрішній номер (якщо власник показує його в профілі). */
    phone?: (PhoneCard & { can_call: boolean }) | null;
    about: string | null;
    city: string | null;
    birthday: string | null;
    website: string | null;
    gender: string | null;
    is_private: boolean;
    last_seen_at: string | null;
    joined_at: string | null;
    role: string;
    looking_for_group?: boolean;
    languages?: string[];
    pin?: { title: string; hint: string; href: string } | null;
    alias?: string | null;
    note?: string | null;
    list?: 'raid' | 'cinema' | 'work' | null;
    platforms?: {
        steam: string | null;
        xbox: string | null;
        xbox_name: string | null;
        playstation: string | null;
        playstation_name: string | null;
        ids?: GamerId[];
    } | null;
};

type Props = {
    compatibility?: Compatibility | null;
    setup?: SetupData | null;
    cardShowcase?: ShowcaseData | null;
    cinemaStats?: CinemaStatsData | null;
    profileTrack?: TrackCard | null;
    streamSchedule?: StreamSlot[] | null;
    account?: AccountCardData | null;
    steamAchievements?: boolean;
    profile: Profile;
    relation: Relation;
    canSeeContent: boolean;
    limited?: boolean;
    blocked?: boolean;
    friendsSince?: string | null;
    anniversary?: boolean;
    anniversaryYears?: number;
    birthdayToday?: boolean;
    showVisitors?: boolean;
    visitors?: (UserCard & { visited_at: string })[];
    blockOrder?: string[];
    canPost: boolean;
    canMessage: boolean;
    stats?: {
        friends: number;
        posts: number;
        photos: number;
        mutual: number;
        thanks?: number;
    };
    friends?: UserCard[];
    photos?: {
        id: number;
        url: string;
        href: string;
        alt?: string | null;
        is_sensitive?: boolean;
    }[];
    photosHref: string | null;
    achievements?: AchievementsData;
    tieredBadges?: TieredBadge[];
    questPoints?: number | null;
    linkedAccounts?: { kind: string; label: string; href: string | null }[];
    wishlistVisible?: boolean;
    backlog?: BacklogSummary | null;
    ready?: {
        game: { name: string; slug: string } | null;
        until: string;
    } | null;
    audio: { href: string; tracks: number } | null;
    nowPlaying?: NowPlaying | null;
    posts?: ScrollData<PostItem>;
    steamLibrary?: { name: string; hours: number; href: string | null }[];
    characters?: CharacterCardData[];
    stream?: StreamInfo | null;
    together?: TogetherPerson[];
    togetherOff?: boolean;
};

/** Bento-лічильники: 4 рівні комірки (Аудіо завжди з цифрою, навіть 0). */
function ProfileBentoStats({
    stats,
    audio,
    isSelf,
    photosHref,
}: {
    stats: { friends: number; posts: number; photos: number; thanks?: number };
    audio?: { tracks: number; href: string } | null;
    isSelf: boolean;
    photosHref?: string | null;
}) {
    const cells: {
        key: string;
        label: string;
        icon: typeof PenLine;
        value: number;
        href?: string;
    }[] = [
        {
            key: 'posts',
            label: tr('Записи'),
            icon: Newspaper,
            value: stats?.posts ?? 0,
            href: '#wall',
        },
        {
            key: 'friends',
            label: tr('Друзі'),
            icon: UsersRound,
            value: stats?.friends ?? 0,
            href: isSelf ? '/friends' : undefined,
        },
        {
            key: 'photos',
            label: tr('Фото'),
            icon: ImageIcon,
            value: stats?.photos ?? 0,
            href: photosHref ?? undefined,
        },
        {
            key: 'audio',
            label: tr('Аудіо'),
            icon: Music2,
            value: audio?.tracks ?? 0,
            href: audio?.href,
        },
    ];

    return (
        <nav
            aria-label={tr('Розділи профілю')}
            className="mb-3 grid grid-cols-4 gap-1.5 px-4"
        >
            {cells.map((t) => {
                const Icon = t.icon;
                const body = (
                    <>
                        <span className="text-sm font-bold text-white tabular-nums">
                            {compactNumber(t.value)}
                        </span>
                        <span className="mt-0.5 flex max-w-full items-center gap-1 text-[11px] text-white/50">
                            <Icon className="size-3 shrink-0 opacity-80" />
                            <span className="truncate">{t.label}</span>
                        </span>
                    </>
                );
                const cls =
                    'flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03] px-1 py-2 transition';

                if (!t.href) {
                    return (
                        <span key={t.key} className={cls}>
                            {body}
                        </span>
                    );
                }

                return t.href.startsWith('#') ? (
                    <a
                        key={t.key}
                        href={t.href}
                        className={cn(cls, 'hover:bg-white/[0.06]')}
                    >
                        {body}
                    </a>
                ) : (
                    <Link
                        key={t.key}
                        href={t.href}
                        className={cn(cls, 'hover:bg-white/[0.06]')}
                    >
                        {body}
                    </Link>
                );
            })}
            {(stats?.thanks ?? 0) > 0 && (
                <span className="col-span-4 flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-[11px] text-white/60">
                    <HeartHandshake className="size-3.5 text-rose-300" />
                    {tr('Подяки')}{' '}
                    <span className="font-semibold text-white tabular-nums">
                        {compactNumber(stats.thanks ?? 0)}
                    </span>
                </span>
            )}
        </nav>
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
    compatibility = null,
    setup = null,
    cardShowcase = null,
    cinemaStats = null,
    profileTrack = null,
    streamSchedule = null,
    account = null,
    steamAchievements = false,
    profile,
    relation,
    canSeeContent,
    limited = false,
    blocked = false,
    friendsSince = null,
    anniversary = false,
    anniversaryYears = 0,
    birthdayToday = false,
    showVisitors = false,
    visitors = [],
    blockOrder = [],
    canPost,
    canMessage,
    stats = { friends: 0, posts: 0, photos: 0, mutual: 0 },
    friends = [],
    photos = [],
    photosHref,
    achievements,
    tieredBadges = [],
    questPoints = null,
    linkedAccounts = [],
    wishlistVisible = false,
    backlog = null,
    ready = null,
    audio,
    nowPlaying,
    posts = { data: [] },
    steamLibrary,
    together = [],
    togetherOff = false,
    characters = [],
    stream = null,
}: Props) {
    // deferIf / Deferred можуть віддати null або не-масив — не покладаємось на дефолти параметрів.
    const asList = <T,>(value: T[] | null | undefined): T[] =>
        Array.isArray(value) ? value : [];
    const safeStats = {
        friends: stats?.friends ?? 0,
        posts: stats?.posts ?? 0,
        photos: stats?.photos ?? 0,
        mutual: stats?.mutual ?? 0,
        thanks: stats?.thanks,
    };
    const safeFriends = asList(friends);
    const safePhotos = asList(photos);
    const safeVisitors = asList(visitors);
    const safeBlockOrder = asList(blockOrder);
    const safeTieredBadges = asList(tieredBadges);
    const safeLinkedAccounts = asList(linkedAccounts);
    const safeTogether = asList(together);
    const safeCharacters = asList(characters);
    const safeSteamLibrary = asList(steamLibrary);
    const safePosts = {
        data: asList(posts?.data),
    };
    const { modules, auth } = usePage().props;
    const isSelf = relation === 'self';
    const [section, setSection] = useState<ProfileSection>('main');
    const wishlistVisibility =
        ((auth.user as { wishlist_visibility?: string } | null)
            ?.wishlist_visibility as 'all' | 'friends' | 'none' | undefined) ??
        'friends';
    const statusOn = usePlugin('status_emoji');
    const gamerIdsOn = usePlugin('gamer_ids');
    const profileTrackOn = usePlugin('profile_track');
    const pixelOn = usePlugin('pixel_avatar');
    const duelsOn = usePlugin('duels');
    const videoCoverOn = usePlugin('plus_video_cover');
    const [statusOpen, setStatusOpen] = useState(false);
    const [toolsOpen, setToolsOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const reduce = useReducedMotion();
    // Профіль відкритий гостям і пошуковикам — замість дій лише запрошення приєднатися.
    const guest = !auth.user;
    // Кольори ефекту шапки: кольори сторінки, інакше колір ніку, інакше акцент сайту.
    const headerColors = profile.accent?.length
        ? profile.accent
        : profile.plus?.name?.length
          ? [...profile.plus.name, '#a855f7']
          : ['#6366f1', '#a855f7', '#22d3ee'];
    const nameProps = profile.plus
        ? plusNameProps(profile.plus)
        : {
              style: cosmeticNameStyle(profile.cosmetics),
              className: undefined,
          };
    // Відеофон учасника GameCon+ замінює фон сайту, поки відкрита його сторінка.
    useEffect(() => {
        setPageBackgroundVideo(profile.background_video ?? null);

        return () => setPageBackgroundVideo(null);
    }, [profile.background_video]);
    const charactersOn = usePlugin('rp_characters');
    const liveOn = useFeature('live');
    const playingOn = useFeature('playing');
    // Роль команди: назва з Адмінка → Команда → Ролі, інакше — загальна.
    const roleBadge =
        profile.staff_title?.name ??
        (profile.role === 'admin'
            ? tr('Адміністратор')
            : profile.role === 'moderator'
              ? tr('Модератор')
              : null);

    return (
        <>
            <Head title={profile.name} />

            {/* Bento-картка профілю: без обкладинки/банера, компактна ієрархія. */}
            <section className="gc-solid relative isolate overflow-hidden rounded-2xl">
                {profile.accent && (
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 opacity-20 blur-3xl"
                        style={{
                            backgroundImage: `radial-gradient(circle at 20% 30%, ${profile.accent[0]} 0%, transparent 55%), radial-gradient(circle at 80% 40%, ${profile.accent[1]} 0%, transparent 55%), radial-gradient(circle at 50% 90%, ${profile.accent[2]} 0%, transparent 60%)`,
                        }}
                    />
                )}
                {profile.header_fx === 'rim' && (
                    <div
                        aria-hidden
                        className="profile-rim"
                        style={{
                            backgroundImage: `linear-gradient(120deg, ${headerColors.join(', ')}, ${headerColors[0]})`,
                        }}
                    />
                )}

                {/* 1. Компактна шапка: аватар + ім’я + статус + шестерня */}
                <div className="flex items-center gap-3.5 p-4">
                    <div className="shrink-0">
                        <div
                            className={cn(
                                'group relative isolate w-fit rounded-full',
                                !profile.plus?.frame && 'glow-ring',
                            )}
                        >
                            <UserAvatar
                                user={profile}
                                size="xl"
                                ring={!profile.plus?.frame}
                                className="!size-[76px] !text-2xl"
                            />
                            {isSelf && (
                                <Uploader
                                    field="avatar"
                                    url="/me/avatar"
                                    className="absolute inset-[4px] flex items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100"
                                >
                                    <Camera className="size-5" />
                                </Uploader>
                            )}
                        </div>
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                            <h1
                                className={cn(
                                    'truncate text-lg font-bold text-white',
                                    nameProps.className,
                                )}
                                style={nameProps.style}
                            >
                                {profile.alias || profile.name}
                            </h1>
                            {liveOn && stream?.live && <LiveBadge />}
                            {profile.is_verified && (
                                <VerifiedBadge
                                    kind={profile.verified_kind}
                                    className="size-4 shrink-0"
                                />
                            )}
                            {profile.plus && (
                                <Link
                                    href="/plus"
                                    title="GameCon+"
                                    className="shrink-0"
                                >
                                    <PlusBadge className="size-5 rounded-md [&_svg]:size-3.5" />
                                </Link>
                            )}
                        </div>
                        <p className="truncate text-xs text-white/50">
                            @{profile.username}
                            <span className="text-white/30"> · </span>
                            {profile.is_online ? (
                                <span className="text-emerald-400/90">
                                    {tr('онлайн')}
                                </span>
                            ) : (
                                lastSeen(profile.last_seen_at, profile.gender)
                            )}
                        </p>
                        {statusOn &&
                            (isSelf ||
                                profile.status ||
                                profile.status_emoji) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (isSelf) setStatusOpen(true);
                                    }}
                                    disabled={!isSelf}
                                    className={cn(
                                        'mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.05] px-2.5 py-0.5 text-[11px] text-white/75',
                                        isSelf
                                            ? 'transition hover:bg-white/[0.09]'
                                            : 'cursor-default',
                                    )}
                                >
                                    <span aria-hidden>
                                        {profile.status_emoji || '😊'}
                                    </span>
                                    <span className="truncate">
                                        {profile.status ||
                                            (isSelf
                                                ? tr('Встановити статус')
                                                : '')}
                                    </span>
                                    {profile.status_until && (
                                        <span className="shrink-0 text-white/40">
                                            ·{' '}
                                            {statusUntilLabel(
                                                profile.status_until,
                                            )}
                                        </span>
                                    )}
                                </button>
                            )}
                        {isSelf && statusOn && (
                            <StatusDialog
                                user={profile}
                                open={statusOpen}
                                onOpenChange={setStatusOpen}
                            />
                        )}
                    </div>
                    {isSelf && (
                        <button
                            type="button"
                            onClick={() => setToolsOpen((v) => !v)}
                            aria-expanded={toolsOpen}
                            aria-label={tr('Інструменти сторінки')}
                            title={tr('Інструменти сторінки')}
                            className={cn(
                                'flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-white transition',
                                toolsOpen && 'bg-white/[0.12]',
                            )}
                        >
                            <Settings
                                className={cn(
                                    'size-4 transition-transform duration-300',
                                    toolsOpen && 'rotate-90',
                                )}
                            />
                        </button>
                    )}
                </div>

                {/* 2. Сітка лічильників */}
                <ProfileBentoStats
                    stats={safeStats}
                    audio={audio}
                    isSelf={isSelf}
                    photosHref={photosHref}
                />

                {/* 3. Кнопки дій в один ряд + додаткові дії без втрати функцій */}
                <div className="mb-3 grid grid-cols-2 gap-2 px-4">
                    <Link
                        href={`/${profile.username}/card`}
                        className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.05] text-xs font-medium text-white transition hover:bg-white/[0.10]"
                    >
                        <QrCode className="size-3.5" /> Game Card
                    </Link>
                    {guest ? (
                        <Link
                            href="/register"
                            className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/[0.12] bg-primary text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                        >
                            <UserPlus className="size-3.5" />
                            {tr('Приєднатися')}
                        </Link>
                    ) : isSelf ? (
                        <Link
                            href="/settings/profile"
                            className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.08] text-xs font-semibold text-white transition hover:bg-white/[0.14]"
                        >
                            <PenLine className="size-3.5" />{' '}
                            {tr('Редагувати профіль')}
                        </Link>
                    ) : (
                        <div className="[&_a]:h-9 [&_a]:w-full [&_a]:rounded-xl [&_a]:text-xs [&_button]:h-9 [&_button]:w-full [&_button]:rounded-xl [&_button]:text-xs">
                            <FriendButton
                                username={profile.username}
                                relation={relation}
                            />
                        </div>
                    )}
                </div>
                {!guest && !isSelf && (
                    <div className="mb-3 flex flex-wrap items-center gap-1.5 px-4">
                        {profile.has_tiers && (
                            <SupportAuthorButton
                                username={profile.username}
                                name={profile.name}
                            />
                        )}
                        {modules.includes('messages') && canMessage && (
                            <Link
                                href={`/messages/with/${profile.username}`}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 text-[11px] font-medium text-white/80 transition hover:bg-white/[0.10]"
                            >
                                <MessageCircle className="size-3.5" />{' '}
                                {tr('Написати')}
                            </Link>
                        )}
                        {duelsOn && (
                            <Link
                                href={`/duels?to=${profile.username}`}
                                aria-label={tr('Викликати на дуель')}
                                title={tr('Викликати на дуель')}
                                className="inline-flex size-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.05] text-white/80 transition hover:bg-white/[0.10]"
                            >
                                <Swords className="size-3.5" />
                            </Link>
                        )}
                        {modules.includes('messages') &&
                            canMessage &&
                            relation === 'friends' &&
                            birthdayToday && (
                                <Link
                                    href={`/messages/with/${profile.username}?text=${encodeURIComponent('З днем народження!')}`}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-2.5 text-[11px] font-semibold text-gc-ink transition hover:bg-white/90"
                                >
                                    <Cake className="size-3.5" />{' '}
                                    {tr('Привітати')}
                                </Link>
                            )}
                        <button
                            type="button"
                            onClick={() =>
                                router.post(
                                    `/block/${profile.username}`,
                                    {},
                                    { preserveScroll: true },
                                )
                            }
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 text-[11px] font-medium text-white/70 transition hover:bg-white/[0.10]"
                        >
                            <Ban className="size-3.5" />
                            {blocked ? tr('Зняти обмеження') : tr('Обмежити')}
                        </button>
                        <ReportPersonButton
                            username={profile.username}
                            name={profile.name}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 text-[11px] font-medium text-white/70 transition hover:bg-white/[0.10]"
                        />
                    </div>
                )}

                {/* 4. Ролі / ранг + ігри / соцмережі — два рівні ряди */}
                <div className="mb-3 space-y-2 px-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <CosmeticBadge
                            cosmetics={profile.cosmetics}
                            className="!h-7 !w-7"
                        />
                        <span className="contents [&_a]:h-7 [&_a]:rounded-lg [&_a]:px-2.5 [&_a]:text-[11px] [&_span]:h-7 [&_span]:rounded-lg [&_span]:px-2.5 [&_span]:text-[11px]">
                            <AffiliationBadges
                                badges={profile.badges}
                                size={18}
                            />
                        </span>
                        {!roleBadge && profile.title && (
                            <UserTitle
                                user={{ title: profile.title }}
                                className="flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium"
                            />
                        )}
                        <UserRoles
                            roles={profile.roles}
                            className="flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium"
                        />
                        {roleBadge && (
                            <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 px-2.5 text-[11px] font-medium text-gold">
                                <ShieldCheck className="size-3" /> {roleBadge}
                            </span>
                        )}
                        <Deferred data="questPoints" fallback={<span hidden />}>
                            {questPoints !== null && questPoints > 0 ? (
                                <span
                                    title={tr('Очки за виконані завдання')}
                                    className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-amber-400/10 px-2.5 text-[11px] font-medium text-amber-300 tabular-nums"
                                >
                                    <Coins className="size-3.5" />
                                    {tr('{n} очок', {
                                        n: questPoints.toLocaleString('uk-UA'),
                                    })}
                                </span>
                            ) : null}
                        </Deferred>
                    </div>
                    <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto">
                        <ErrorBoundary fallback={null}>
                            <Deferred
                                data="tieredBadges"
                                fallback={<span hidden />}
                            >
                                <span className="contents [&_*]:!h-7 [&_a]:shrink-0 [&_button]:shrink-0">
                                    <BadgeStrip
                                        badges={safeTieredBadges}
                                        isSelf={isSelf}
                                    />
                                </span>
                            </Deferred>
                        </ErrorBoundary>
                        {safeLinkedAccounts.map((a) =>
                            a.href ? (
                                <a
                                    key={a.kind}
                                    href={a.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 text-[11px] text-white/75 transition hover:text-white"
                                >
                                    <Link2 className="size-3.5" />
                                    {a.label}
                                </a>
                            ) : null,
                        )}
                        {profile.looking_for_group && (
                            <span className="inline-flex h-7 shrink-0 items-center rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 text-[11px] font-medium text-white">
                                {tr('Шукаю групу')}
                            </span>
                        )}
                        {ready && (
                            <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-400/10 px-2.5 text-[11px] font-semibold text-emerald-300">
                                <span className="size-1.5 rounded-full bg-emerald-400" />
                                {ready.game
                                    ? tr('Готовий грати в {game}', {
                                          game: ready.game.name,
                                      })
                                    : tr('Готовий грати зараз')}
                            </span>
                        )}
                        {profile.pin && (
                            <Link
                                href={profile.pin.href}
                                className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 text-[11px] text-white/80"
                            >
                                <span className="text-white/40">
                                    {tr(profile.pin.hint)}
                                </span>
                                {profile.pin.title}
                            </Link>
                        )}
                        {profile.playing && playingOn && (
                            <span className="inline-flex h-7 shrink-0 items-center [&_*]:!h-7">
                                <PlayingBadge playing={profile.playing} />
                            </span>
                        )}
                    </div>
                    <ErrorBoundary fallback={null}>
                        <Deferred data="together" fallback={<span hidden />}>
                            <WatchedTogether
                                key={profile.id}
                                people={safeTogether}
                                isSelf={isSelf}
                                hiddenForOthers={togetherOff}
                            />
                        </Deferred>
                    </ErrorBoundary>
                    <ErrorBoundary fallback={null}>
                        <Deferred
                            data="compatibility"
                            fallback={<span hidden />}
                        >
                            {compatibility && compatibility.score > 0 ? (
                                <CompatibilityChip data={compatibility} />
                            ) : null}
                        </Deferred>
                    </ErrorBoundary>
                    {profile.alias && (
                        <p className="text-xs text-white/45">{profile.name}</p>
                    )}
                    {profile.note && (
                        <p className="text-xs text-white/60">{profile.note}</p>
                    )}
                </div>

                {/* Шестерня: інструменти + зміна обкладинки (функція лишається, банера немає). */}
                <AnimatePresence initial={false}>
                    {isSelf && toolsOpen && (
                        <motion.div
                            initial={
                                reduce
                                    ? { opacity: 0 }
                                    : { opacity: 0, height: 0 }
                            }
                            animate={
                                reduce
                                    ? { opacity: 1 }
                                    : { opacity: 1, height: 'auto' }
                            }
                            exit={
                                reduce
                                    ? { opacity: 0 }
                                    : { opacity: 0, height: 0 }
                            }
                            className="overflow-hidden"
                        >
                            <div className="mb-3 flex flex-wrap gap-2 px-4">
                                {!profile.is_private && (
                                    <EmbedButton
                                        path={`/widget/u/${profile.username}`}
                                    />
                                )}
                                <CrosspostButton
                                    owner={{
                                        type: 'user',
                                        id: profile.id,
                                    }}
                                />
                                <AuthorStatsButton />
                                {pixelOn && (
                                    <Link
                                        href="/settings/pixel-avatar"
                                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 text-xs font-semibold text-white transition hover:bg-white/[0.10]"
                                    >
                                        <Grid3x3 className="size-3.5" />
                                        {tr('Піксель-аватар')}
                                    </Link>
                                )}
                                <Uploader
                                    field="cover"
                                    url="/me/cover"
                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 text-xs font-semibold text-white transition hover:bg-white/[0.10]"
                                >
                                    <Camera className="size-3.5" />
                                    {tr('Змінити обкладинку')}
                                </Uploader>
                                {videoCoverOn &&
                                    new Date(
                                        auth.user?.plus_until ?? 0,
                                    ).getTime() > Date.now() && (
                                        <>
                                            <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 text-xs font-semibold text-white transition hover:bg-white/[0.10]">
                                                <Video className="size-3.5" />
                                                {profile.cover_video_url
                                                    ? tr('Інше відео')
                                                    : tr('Відеообкладинка')}
                                                <input
                                                    type="file"
                                                    accept="video/mp4,video/webm"
                                                    hidden
                                                    onChange={(event) => {
                                                        const file =
                                                            event.target
                                                                .files?.[0];
                                                        if (file)
                                                            router.post(
                                                                '/me/cover-video',
                                                                {
                                                                    video: file,
                                                                },
                                                                {
                                                                    forceFormData: true,
                                                                    preserveScroll: true,
                                                                },
                                                            );
                                                    }}
                                                />
                                            </label>
                                            {profile.cover_video_url && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        router.delete(
                                                            '/me/cover-video',
                                                            {
                                                                preserveScroll: true,
                                                            },
                                                        )
                                                    }
                                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 text-xs font-semibold text-white transition hover:bg-white/[0.10]"
                                                >
                                                    <X className="size-3.5" />
                                                    {tr('Прибрати відео')}
                                                </button>
                                            )}
                                        </>
                                    )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 5. Спойлер «Детальна інформація» */}
                {(friendsSince ||
                    profile.phone ||
                    profile.city ||
                    profile.birthday ||
                    profile.website ||
                    profile.joined_at ||
                    (profile.languages?.length ?? 0) > 0) && (
                    <div className="mx-4 mb-4">
                        <button
                            type="button"
                            onClick={() => setDetailsOpen((v) => !v)}
                            aria-expanded={detailsOpen}
                            className="flex w-full items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-xs text-white/60 transition hover:bg-white/[0.04]"
                        >
                            <span className="flex min-w-0 items-center gap-1.5 truncate">
                                {profile.city && (
                                    <>
                                        <MapPin className="size-3.5 shrink-0 text-sky-400" />
                                        <span className="truncate">
                                            {profile.city}
                                        </span>
                                    </>
                                )}
                                {profile.city && profile.birthday && (
                                    <span className="text-white/25">•</span>
                                )}
                                {profile.birthday && (
                                    <>
                                        <Cake className="size-3.5 shrink-0 text-gc-pink" />
                                        <span className="truncate">
                                            {formatDate(
                                                profile.birthday,
                                                false,
                                            )}
                                        </span>
                                    </>
                                )}
                                {!profile.city && !profile.birthday && (
                                    <span>{tr('Детальна інформація')}</span>
                                )}
                            </span>
                            <span className="inline-flex shrink-0 items-center gap-1 text-white/50">
                                {tr('Детальніше')}
                                <ChevronDown
                                    className={cn(
                                        'size-3.5 transition-transform',
                                        detailsOpen && 'rotate-180',
                                    )}
                                />
                            </span>
                        </button>
                        <AnimatePresence initial={false}>
                            {detailsOpen && (
                                <motion.div
                                    initial={
                                        reduce
                                            ? { opacity: 0 }
                                            : { opacity: 0, height: 0 }
                                    }
                                    animate={
                                        reduce
                                            ? { opacity: 1 }
                                            : { opacity: 1, height: 'auto' }
                                    }
                                    exit={
                                        reduce
                                            ? { opacity: 0 }
                                            : { opacity: 0, height: 0 }
                                    }
                                    className="overflow-hidden"
                                >
                                    <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-[12px] text-white/65">
                                        {friendsSince && (
                                            <span className="col-span-2 inline-flex items-center gap-1.5">
                                                <CalendarDays className="size-3.5" />
                                                {anniversary
                                                    ? tr(
                                                          'Річниця дружби · {years}',
                                                          {
                                                              years: anniversaryYears,
                                                          },
                                                      )
                                                    : tr('Друзі з {date}', {
                                                          date: formatDate(
                                                              friendsSince,
                                                              false,
                                                          ),
                                                      })}
                                            </span>
                                        )}
                                        {profile.phone &&
                                            (profile.phone.can_call ? (
                                                <Link
                                                    href={`/phone?dial=${encodeURIComponent(profile.phone.number)}`}
                                                    title={tr('Набрати номер')}
                                                    className="inline-flex items-center rounded-lg transition hover:opacity-80"
                                                >
                                                    <PhoneBadge
                                                        phone={profile.phone}
                                                        size="sm"
                                                    />
                                                </Link>
                                            ) : (
                                                <PhoneBadge
                                                    phone={profile.phone}
                                                    size="sm"
                                                />
                                            ))}
                                        {profile.website && (
                                            <a
                                                href={profile.website}
                                                target="_blank"
                                                rel="noreferrer nofollow"
                                                className="inline-flex min-w-0 items-center gap-1.5 hover:text-white"
                                            >
                                                <Globe className="size-3.5 shrink-0 text-gc-cyan" />
                                                <span className="truncate">
                                                    {profile.website.replace(
                                                        /^https?:\/\//,
                                                        '',
                                                    )}
                                                </span>
                                            </a>
                                        )}
                                        {(profile.languages?.length ?? 0) >
                                            0 && (
                                            <div className="col-span-2 flex flex-wrap gap-1.5">
                                                {profile.languages?.map(
                                                    (code) => (
                                                        <span
                                                            key={code}
                                                            className="rounded-lg border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/70"
                                                        >
                                                            {languageName(
                                                                code,
                                                                LOCALE,
                                                            )}
                                                        </span>
                                                    ),
                                                )}
                                            </div>
                                        )}
                                        {profile.joined_at && (
                                            <span className="col-span-2 inline-flex items-center gap-1.5 text-white/50">
                                                <CalendarDays className="size-3.5 text-white/40" />
                                                {tr('В GameCon з')}{' '}
                                                {formatDate(profile.joined_at)}
                                            </span>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </section>

            {!canSeeContent ? (
                <div className="mt-5">
                    <EmptyState
                        icon={Lock}
                        title={
                            limited
                                ? tr('Перегляд обмежено')
                                : tr('Це закритий профіль')
                        }
                        text={
                            limited
                                ? tr('Власник сторінки показує вам менше.')
                                : tr(
                                      'Додайте {first_name} у друзі, щоб бачити записи, фото та інформацію.',
                                      { first_name: profile.first_name },
                                  )
                        }
                    />
                </div>
            ) : (
                <>
                    <ProfileSectionTabs
                        value={section}
                        onChange={setSection}
                        wishlist={wishlistVisible}
                    />
                    {section !== 'main' && (
                        <div className="mt-4">
                            {/* key + ErrorBoundary: зміна вкладки не лишає stale-дані й не валить увесь профіль. */}
                            <ErrorBoundary
                                key={`${section}:${profile.username}`}
                                resetKey={`${section}:${profile.username}`}
                                fallback={
                                    <EmptyState
                                        icon={Gamepad2}
                                        title={tr('Не вдалося відкрити розділ')}
                                        text={tr(
                                            'Спробуйте ще раз або поверніться на Головне.',
                                        )}
                                    />
                                }
                            >
                                <ProfileSectionBody
                                    key={`${section}:${profile.username}`}
                                    section={section}
                                    username={profile.username}
                                    isSelf={isSelf}
                                    visibility={wishlistVisibility}
                                />
                            </ErrorBoundary>
                        </div>
                    )}
                    {section === 'main' &&
                        liveOn &&
                        account?.type === 'streamer' && (
                            <ErrorBoundary fallback={null}>
                                <StreamerShowcase
                                    stream={stream ?? null}
                                    account={account}
                                    schedule={streamSchedule}
                                />
                            </ErrorBoundary>
                        )}
                    <div
                        className={cn(
                            'mt-5 flex flex-col gap-5 xl:flex-row',
                            section !== 'main' && 'hidden',
                        )}
                    >
                        <aside className="w-full shrink-0 space-y-4 xl:sticky xl:top-[76px] xl:h-fit xl:w-[320px]">
                            {showVisitors && (
                                <div className="gc-solid rounded-2xl px-4 pt-3.5 pb-3.5 ring-1 ring-white/[0.05]">
                                    <ProfileVisitorsCarousel
                                        visitors={safeVisitors}
                                    />
                                </div>
                            )}
                            {liveOn &&
                                stream &&
                                account?.type !== 'streamer' && (
                                    <ProfileStream stream={stream} />
                                )}
                            {account && (
                                <ErrorBoundary fallback={null}>
                                    <AccountCard data={account} />
                                </ErrorBoundary>
                            )}
                            {blockSequence(safeBlockOrder).map((key) => {
                                const widgets: Record<string, ReactNode> = {
                                    // Ігрові блоки — лише в режимах, де є «Граю в…» (не в «Класиці», «Кіномані»…).
                                    track: (
                                        <Deferred
                                            data="profileTrack"
                                            fallback={<span hidden />}
                                        >
                                            {(profileTrack ||
                                                (isSelf && profileTrackOn)) && (
                                                <ProfileTrack
                                                    track={profileTrack}
                                                    isSelf={
                                                        isSelf && profileTrackOn
                                                    }
                                                />
                                            )}
                                        </Deferred>
                                    ),
                                    platforms: playingOn &&
                                        profile.platforms && (
                                            <GamerIds
                                                steam={profile.platforms.steam}
                                                ids={
                                                    profile.platforms.ids ?? []
                                                }
                                                isSelf={isSelf && gamerIdsOn}
                                            />
                                        ),
                                    steam: playingOn && (
                                        <Deferred
                                            data="steamLibrary"
                                            fallback={<span hidden />}
                                        >
                                            {safeSteamLibrary.length > 0 ? (
                                                <Widget
                                                    title={tr(
                                                        'Бібліотека Steam',
                                                    )}
                                                >
                                                    <div className="space-y-1 px-1">
                                                        {safeSteamLibrary.map(
                                                            (game) =>
                                                                game.href ? (
                                                                    <Link
                                                                        key={
                                                                            game.name
                                                                        }
                                                                        href={
                                                                            game.href
                                                                        }
                                                                        className="flex justify-between gap-3 text-sm text-white"
                                                                    >
                                                                        <span className="truncate">
                                                                            {
                                                                                game.name
                                                                            }
                                                                        </span>
                                                                        <span className="text-xs text-white/40">
                                                                            {
                                                                                game.hours
                                                                            }
                                                                            г
                                                                        </span>
                                                                    </Link>
                                                                ) : (
                                                                    <div
                                                                        key={
                                                                            game.name
                                                                        }
                                                                        className="flex justify-between gap-3 text-sm text-white/80"
                                                                    >
                                                                        <span className="truncate">
                                                                            {
                                                                                game.name
                                                                            }
                                                                        </span>
                                                                        <span className="text-xs text-white/40">
                                                                            {
                                                                                game.hours
                                                                            }
                                                                            г
                                                                        </span>
                                                                    </div>
                                                                ),
                                                        )}
                                                    </div>
                                                </Widget>
                                            ) : null}
                                        </Deferred>
                                    ),
                                    steam_achievements: steamAchievements &&
                                        canSeeContent && (
                                            <SteamAchievements
                                                username={profile.username}
                                            />
                                        ),
                                    setup: (
                                        <Deferred
                                            data="setup"
                                            fallback={<span hidden />}
                                        >
                                            {setup ? (
                                                <MySetup
                                                    data={setup}
                                                    isSelf={isSelf}
                                                />
                                            ) : null}
                                        </Deferred>
                                    ),
                                    stream_schedule: (
                                        <Deferred
                                            data="streamSchedule"
                                            fallback={<span hidden />}
                                        >
                                            {streamSchedule ? (
                                                <StreamSchedule
                                                    slots={streamSchedule}
                                                    isSelf={isSelf}
                                                />
                                            ) : null}
                                        </Deferred>
                                    ),
                                    cinema_stats: (
                                        <Deferred
                                            data="cinemaStats"
                                            fallback={<span hidden />}
                                        >
                                            {cinemaStats ? (
                                                <CinemaStats
                                                    data={cinemaStats}
                                                />
                                            ) : null}
                                        </Deferred>
                                    ),
                                    cards: (
                                        <Deferred
                                            data="cardShowcase"
                                            fallback={<span hidden />}
                                        >
                                            {cardShowcase ? (
                                                <CardShowcase
                                                    data={cardShowcase}
                                                    isSelf={isSelf}
                                                />
                                            ) : null}
                                        </Deferred>
                                    ),
                                    about: profile.about && (
                                        <Widget title={tr('Про себе')}>
                                            <p className="px-1 text-sm leading-relaxed whitespace-pre-line text-white/75">
                                                {profile.about}
                                            </p>
                                        </Widget>
                                    ),
                                    characters: (
                                        <Deferred
                                            data="characters"
                                            fallback={<span hidden />}
                                        >
                                            {(safeCharacters.length > 0 ||
                                                (isSelf && charactersOn)) && (
                                                <CharactersWidget
                                                    characters={safeCharacters}
                                                    isSelf={isSelf}
                                                />
                                            )}
                                        </Deferred>
                                    ),
                                    games: (
                                        <Deferred
                                            data="backlog"
                                            fallback={<span hidden />}
                                        >
                                            {backlog ? (
                                                <BacklogWidget
                                                    data={backlog}
                                                    isSelf={isSelf}
                                                />
                                            ) : null}
                                        </Deferred>
                                    ),
                                    achievements: (
                                        <Deferred
                                            data="achievements"
                                            fallback={<span hidden />}
                                        >
                                            {achievements ? (
                                                <AchievementsCard
                                                    data={achievements}
                                                    isSelf={isSelf}
                                                />
                                            ) : null}
                                        </Deferred>
                                    ),
                                    audio: audio && (
                                        <>
                                            <Deferred
                                                data="nowPlaying"
                                                fallback={<span hidden />}
                                            >
                                                {nowPlaying ? (
                                                    <NowPlayingCard
                                                        track={nowPlaying}
                                                    />
                                                ) : null}
                                            </Deferred>
                                            {audio.tracks > 0 && (
                                                <Link
                                                    href={audio.href}
                                                    className="gc-solid group flex items-center gap-3 rounded-2xl p-4 transition hover:border-white/15"
                                                >
                                                    <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-gc-purple to-gc-blue">
                                                        <Music2 className="size-5 text-white" />
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block text-sm font-semibold text-white">
                                                            {tr('Аудіозаписи')}
                                                        </span>
                                                        <span className="block text-xs text-white/45">
                                                            {audio.tracks}{' '}
                                                            {plural(
                                                                audio.tracks,
                                                                [
                                                                    'трек',
                                                                    'треки',
                                                                    'треків',
                                                                ],
                                                            )}
                                                        </span>
                                                    </span>
                                                    <span className="text-xs text-white/40 transition group-hover:text-white">
                                                        {tr('Слухати →')}
                                                    </span>
                                                </Link>
                                            )}
                                        </>
                                    ),
                                    friends: (
                                        <Widget
                                            title={tr('Друзі')}
                                            icon={UsersRound}
                                            action={
                                                safeStats.mutual > 0 ? (
                                                    <span className="text-xs text-white/45">
                                                        {safeStats.mutual}{' '}
                                                        {plural(
                                                            safeStats.mutual,
                                                            [
                                                                'спільний',
                                                                'спільні',
                                                                'спільних',
                                                            ],
                                                        )}
                                                    </span>
                                                ) : undefined
                                            }
                                        >
                                            {safeFriends.length === 0 ? (
                                                <p className="px-1 text-sm text-white/45">
                                                    {tr('Поки немає друзів.')}
                                                </p>
                                            ) : (
                                                <div className="grid grid-cols-3 gap-2">
                                                    {safeFriends.map(
                                                        (friend) => (
                                                            <Link
                                                                key={friend.id}
                                                                href={`/${friend.username}`}
                                                                className="flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center transition hover:bg-[var(--gc-l3)]"
                                                            >
                                                                <UserAvatar
                                                                    user={
                                                                        friend
                                                                    }
                                                                    size="lg"
                                                                />
                                                                <span className="w-full truncate text-xs text-white/75">
                                                                    {
                                                                        friend.first_name
                                                                    }
                                                                </span>
                                                            </Link>
                                                        ),
                                                    )}
                                                </div>
                                            )}
                                        </Widget>
                                    ),
                                    photos: safePhotos.length > 0 && (
                                        <Widget
                                            title={tr('Фото')}
                                            icon={ImageIcon}
                                            action={
                                                photosHref ? (
                                                    <Link
                                                        href={photosHref}
                                                        className="text-xs text-cyan-300/80 transition hover:text-cyan-200"
                                                    >
                                                        {tr('Усі')}{' '}
                                                        {safeStats.photos}
                                                    </Link>
                                                ) : undefined
                                            }
                                        >
                                            <div className="grid grid-cols-3 gap-1.5 overflow-hidden rounded-2xl">
                                                {safePhotos.map((photo) => (
                                                    <Link
                                                        key={photo.id}
                                                        href={photo.href}
                                                        className="group aspect-square overflow-hidden bg-white/5"
                                                    >
                                                        <img
                                                            src={photo.url}
                                                            alt={
                                                                photo.alt ?? ''
                                                            }
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
                                        </Widget>
                                    ),
                                };
                                const node = widgets[key];
                                if (!node) return null;

                                // Віджет не валить усю сторінку — лише ховається.
                                return (
                                    <ErrorBoundary key={key} fallback={null}>
                                        {node}
                                    </ErrorBoundary>
                                );
                            })}
                        </aside>

                        <div
                            id="wall"
                            className="min-w-0 flex-1 scroll-mt-24 space-y-4"
                        >
                            <ErrorBoundary fallback={null}>
                                {canPost && (
                                    <PostComposer
                                        wall={isSelf ? null : profile}
                                    />
                                )}

                                {(safePosts.data?.length ?? 0) === 0 ? (
                                    <EmptyState
                                        icon={PenLine}
                                        title={tr('На стіні поки порожньо')}
                                        text={
                                            isSelf
                                                ? tr(
                                                      'Розкажіть світу щось цікаве — перший запис завжди найкращий.',
                                                  )
                                                : tr(
                                                      '{first_name} ще нічого не публікував(-ла).',
                                                      {
                                                          first_name:
                                                              profile.first_name,
                                                      },
                                                  )
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
                                        {(safePosts.data ?? []).some(
                                            (p) => p.is_pinned,
                                        ) && (
                                            <p className="flex items-center gap-1.5 px-1 text-xs font-semibold text-white/50">
                                                <Pin className="size-3.5" />
                                                {tr('Закріплене')}
                                            </p>
                                        )}
                                        {(safePosts.data ?? []).map(
                                            (post, i) => (
                                                <Fragment key={post.id}>
                                                    {/* Межа між закріпленими й рештою стрічки. */}
                                                    {i > 0 &&
                                                        !post.is_pinned &&
                                                        (safePosts.data ?? [])[
                                                            i - 1
                                                        ]?.is_pinned && (
                                                            <p className="px-1 pt-2 text-xs font-semibold text-white/50">
                                                                {tr(
                                                                    'Усі записи',
                                                                )}
                                                            </p>
                                                        )}
                                                    <PostCard post={post} />
                                                </Fragment>
                                            ),
                                        )}
                                    </InfiniteScroll>
                                )}
                            </ErrorBoundary>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
