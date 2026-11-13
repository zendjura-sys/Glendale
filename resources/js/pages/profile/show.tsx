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
import type { StreamSlot } from '@/components/profile/stream-schedule';
import { SteamAchievements } from '@/components/profile/steam-achievements';
import {
    ProfileSectionBody,
    ProfileSectionTabs,
} from '@/components/profile/profile-sections';
import type { ProfileSection } from '@/components/profile/profile-sections';
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
    Eye,
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
import type { StreamInfo } from '@/components/streams/stream';
import { useFeature, usePlugin } from '@/lib/plugins';
import { setPageBackgroundVideo } from '@/lib/backgrounds';
import { useDataSaver } from '@/lib/data-saver';

const PROFILE_BLOCKS = [
    'track',
    'platforms',
    'steam',
    'steam_achievements',
    'setup',
    'stream_schedule',
    'cards',
    'games',
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
    stats: {
        friends: number;
        posts: number;
        photos: number;
        mutual: number;
        thanks?: number;
    };
    friends: UserCard[];
    photos: {
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
    posts: ScrollData<PostItem>;
    steamLibrary?: { name: string; hours: number; href: string | null }[];
    characters?: CharacterCardData[];
    stream?: StreamInfo | null;
    together?: TogetherPerson[];
    togetherOff?: boolean;
};

/** Вкладки під обкладинкою: записи, друзі, фото, аудіо, подяки — з лічильниками. */
function ProfileTabs({
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
    const tabs: {
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
            value: stats.posts,
            href: '#wall',
        },
        {
            key: 'friends',
            label: tr('Друзі'),
            icon: UsersRound,
            value: stats.friends,
            href: isSelf ? '/friends' : undefined,
        },
        {
            key: 'photos',
            label: tr('Фото'),
            icon: ImageIcon,
            value: stats.photos,
            href: photosHref ?? undefined,
        },
        ...(audio
            ? [
                  {
                      key: 'audio',
                      label: tr('Аудіо'),
                      icon: Music2,
                      value: audio.tracks,
                      href: audio.href,
                  },
              ]
            : []),
        ...((stats.thanks ?? 0) > 0
            ? [
                  {
                      key: 'thanks',
                      label: tr('Подяки'),
                      icon: HeartHandshake,
                      value: stats.thanks ?? 0,
                  },
              ]
            : []),
    ];

    return (
        <nav
            aria-label={tr('Розділи профілю')}
            className="mt-2 flex [scrollbar-width:none] gap-1 overflow-x-auto rounded-xl px-1 py-1 sm:mt-3"
        >
            {tabs.map((t) => {
                const Icon = t.icon;
                const body = (
                    <>
                        <Icon className="size-4 text-white/55" />
                        <span>{t.label}</span>
                        <span className="text-white/45 tabular-nums">
                            {compactNumber(t.value)}
                        </span>
                    </>
                );
                const cls =
                    'inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-medium text-white/85 transition';

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
                        className={cn(cls, 'hover:bg-[var(--gc-l3)]')}
                    >
                        {body}
                    </a>
                ) : (
                    <Link
                        key={t.key}
                        href={t.href}
                        className={cn(cls, 'hover:bg-[var(--gc-l3)]')}
                    >
                        {body}
                    </Link>
                );
            })}
        </nav>
    );
}

/** GameCon+: відеообкладинка (MP4/WebM до 15 МБ) — поставити чи прибрати. */
function VideoCoverButton({ has }: { has: boolean }) {
    const input = useRef<HTMLInputElement>(null);

    return (
        <div className="absolute top-4 left-4 flex gap-1.5 max-sm:hidden">
            <input
                ref={input}
                type="file"
                accept="video/mp4,video/webm"
                hidden
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file)
                        router.post(
                            '/me/cover-video',
                            { video: file },
                            { forceFormData: true, preserveScroll: true },
                        );
                }}
            />
            <button
                type="button"
                onClick={() => input.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-black/40 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-black/60"
            >
                <Video className="size-4" />
                <span className="sr-only sm:not-sr-only">
                    {has ? tr('Інше відео') : tr('Відеообкладинка')}
                </span>
            </button>
            {has && (
                <button
                    type="button"
                    onClick={() =>
                        router.delete('/me/cover-video', {
                            preserveScroll: true,
                        })
                    }
                    aria-label={tr('Прибрати відео')}
                    className="inline-flex items-center rounded-xl bg-black/40 px-2.5 py-2 text-white backdrop-blur-md transition hover:bg-black/60"
                >
                    <X className="size-4" />
                </button>
            )}
        </div>
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
    stats,
    friends,
    photos,
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
    posts,
    steamLibrary,
    together = [],
    togetherOff = false,
    characters = [],
    stream = null,
}: Props) {
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
    const dataSaver = useDataSaver();
    const [statusOpen, setStatusOpen] = useState(false);
    const [toolsOpen, setToolsOpen] = useState(false);
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

            <section className="gc-solid relative isolate overflow-hidden rounded-2xl p-2 sm:p-3">
                {profile.accent && (
                    // Кольори сторінки (GameCon+ або улюблена гра): м’який відсвіт під шапкою.
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 top-40 -z-10 h-72 opacity-25 blur-3xl sm:top-56"
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
                {/* Обкладинка на всю ширину картки: аватар, ім’я й кнопки — поверх неї, на затемненні знизу ліворуч. */}
                <div className="profile-cover relative isolate overflow-hidden rounded-xl sm:h-80">
                    {/* На телефоні обкладинки немає — лише аватар, ім’я й кнопки на картці. */}
                    <div className="absolute inset-0 -z-10 max-sm:hidden">
                        {profile.cover_video_url && !dataSaver ? (
                            <video
                                src={profile.cover_video_url}
                                autoPlay
                                muted
                                loop
                                playsInline
                                poster={profile.cover_url ?? undefined}
                                className="size-full object-cover"
                            />
                        ) : profile.cover_url ? (
                            <img
                                decoding="async"
                                fetchPriority="high"
                                src={profile.cover_url}
                                alt=""
                                className="size-full object-cover object-[center_30%]"
                            />
                        ) : profile.accent ? (
                            <div
                                className="size-full opacity-80"
                                style={{
                                    backgroundImage: `radial-gradient(circle at 20% 20%, ${profile.accent[0]} 0%, transparent 45%), radial-gradient(circle at 80% 30%, ${profile.accent[1]} 0%, transparent 45%), radial-gradient(circle at 50% 100%, ${profile.accent[2]} 0%, transparent 50%)`,
                                }}
                            />
                        ) : (
                            <div className="size-full bg-[radial-gradient(circle_at_20%_20%,#4f8bff_0%,transparent_45%),radial-gradient(circle_at_80%_30%,#22d3ee_0%,transparent_45%),radial-gradient(circle_at_50%_100%,#0ea5e9_0%,transparent_50%)] opacity-80" />
                        )}
                        {profile.pattern && (
                            <div
                                aria-hidden
                                className={`profile-pattern profile-pattern-${profile.pattern}`}
                            />
                        )}
                        {profile.header_fx === 'aurora' && (
                            <div
                                aria-hidden
                                className="profile-aurora absolute inset-x-0 bottom-0 z-10 h-2/3 [mask-image:linear-gradient(to_top,black,transparent)] opacity-45 mix-blend-screen"
                                style={{
                                    backgroundImage: `linear-gradient(90deg, ${headerColors.join(', ')}, ${headerColors[0]})`,
                                }}
                            />
                        )}
                        {profile.accent && profile.cover_url && (
                            <div
                                aria-hidden
                                className="absolute inset-x-0 bottom-0 z-10 h-1"
                                style={{
                                    backgroundImage: `linear-gradient(90deg, ${profile.accent.join(', ')})`,
                                }}
                            />
                        )}
                    </div>
                    {/* Темніше там, де текст: знизу й ліворуч, обкладинка вгорі лишається яскравою. */}
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgb(5_10_20/0.88)_0%,rgb(5_10_20/0.55)_32%,rgb(5_10_20/0.12)_62%,transparent_80%),radial-gradient(ellipse_at_0%_100%,rgb(5_10_20/0.6),transparent_60%)] max-sm:hidden"
                    />
                    {isSelf &&
                        videoCoverOn &&
                        new Date(auth.user?.plus_until ?? 0).getTime() >
                            Date.now() && (
                            <VideoCoverButton
                                has={Boolean(profile.cover_video_url)}
                            />
                        )}
                    {isSelf && (
                        <Uploader
                            field="cover"
                            url="/me/cover"
                            className="absolute top-4 right-4 inline-flex items-center gap-2 rounded-xl bg-black/40 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-black/60 max-sm:hidden"
                        >
                            <Camera className="size-4" />
                            <span className="sr-only sm:not-sr-only">
                                {tr('Змінити обкладинку')}
                            </span>
                        </Uploader>
                    )}
                    <div className="flex items-end gap-4 px-2 pt-3 sm:absolute sm:inset-x-0 sm:bottom-0 sm:gap-5 sm:p-6">
                        <div className="shrink-0">
                            <div
                                className={cn(
                                    'group relative isolate w-fit rounded-full',
                                    !profile.plus?.frame && 'glow-ring',
                                )}
                            >
                                <UserAvatar
                                    user={profile}
                                    size="hero"
                                    ring={!profile.plus?.frame}
                                />
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
                        </div>
                        <div className="min-w-0 pb-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1
                                    className={cn(
                                        'font-display text-xl leading-tight font-bold tracking-tight text-white sm:text-[34px] sm:drop-shadow-[0_1px_8px_rgb(0_0_0/0.45)]',
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
                                        className="size-6"
                                    />
                                )}
                                {profile.plus && (
                                    <Link href="/plus" title="GameCon+">
                                        <PlusBadge className="size-6 rounded-lg [&_svg]:size-4" />
                                    </Link>
                                )}
                            </div>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-white/75">
                                <span>@{profile.username}</span>
                                {profile.is_online ? (
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className="size-2 rounded-full bg-emerald-400" />
                                        {tr('онлайн')}
                                    </span>
                                ) : (
                                    <span>
                                        {lastSeen(
                                            profile.last_seen_at,
                                            profile.gender,
                                        )}
                                    </span>
                                )}
                            </p>
                        </div>
                        <div
                            data-on-dark
                            className="ml-auto hidden flex-wrap items-center justify-end gap-2 lg:flex"
                        >
                            <Link
                                href={`/${profile.username}/card`}
                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-black/45 px-4 text-sm font-semibold text-white transition hover:bg-black/60"
                            >
                                <QrCode className="size-4" /> Game Card
                            </Link>
                            {isSelf && (
                                <button
                                    type="button"
                                    onClick={() => setToolsOpen((v) => !v)}
                                    aria-expanded={toolsOpen}
                                    aria-label={tr('Інструменти сторінки')}
                                    title={tr('Інструменти сторінки')}
                                    className={cn(
                                        'inline-flex size-10 items-center justify-center rounded-xl text-white transition',
                                        toolsOpen
                                            ? 'bg-black/70'
                                            : 'bg-black/45 hover:bg-black/60',
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
                            {guest ? (
                                <Link
                                    href="/register"
                                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                                >
                                    <UserPlus className="size-4" />
                                    {tr('Приєднатися й додати в друзі')}
                                </Link>
                            ) : isSelf ? (
                                <Link
                                    href="/settings/profile"
                                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-black/45 px-4 text-sm font-semibold text-white transition hover:bg-black/60"
                                >
                                    <PenLine className="size-4" />{' '}
                                    {tr('Редагувати профіль')}
                                </Link>
                            ) : (
                                <>
                                    {profile.has_tiers && (
                                        <SupportAuthorButton
                                            username={profile.username}
                                            name={profile.name}
                                        />
                                    )}
                                    <FriendButton
                                        username={profile.username}
                                        relation={relation}
                                    />
                                    {modules.includes('messages') &&
                                        canMessage && (
                                            <Link
                                                href={`/messages/with/${profile.username}`}
                                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-black/45 px-4 text-sm font-semibold text-white transition hover:bg-black/60"
                                            >
                                                <MessageCircle className="size-4" />{' '}
                                                {tr('Написати')}
                                            </Link>
                                        )}
                                    {duelsOn && (
                                        <Link
                                            href={`/duels?to=${profile.username}`}
                                            aria-label={tr(
                                                'Викликати на дуель',
                                            )}
                                            title={tr('Викликати на дуель')}
                                            className="inline-flex size-10 items-center justify-center rounded-xl bg-black/45 text-white transition hover:bg-black/60"
                                        >
                                            <Swords className="size-4" />
                                        </Link>
                                    )}
                                    {modules.includes('messages') &&
                                        canMessage &&
                                        relation === 'friends' &&
                                        birthdayToday && (
                                            <Link
                                                href={`/messages/with/${profile.username}?text=${encodeURIComponent('З днем народження!')}`}
                                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-gc-ink transition hover:bg-white/90"
                                            >
                                                <Cake className="size-4" />{' '}
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
                                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-black/45 px-4 text-sm font-semibold text-white/80 transition hover:bg-black/60"
                                    >
                                        <Ban className="size-4" />
                                        {blocked
                                            ? tr('Зняти обмеження')
                                            : tr('Обмежити')}
                                    </button>
                                    <ReportPersonButton
                                        username={profile.username}
                                        name={profile.name}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-black/45 px-4 text-sm font-semibold text-white/80 transition hover:bg-black/60"
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <ProfileTabs
                    stats={stats}
                    audio={audio}
                    isSelf={isSelf}
                    photosHref={photosHref}
                />

                <div className="px-3 pt-3 pb-3 sm:px-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <CosmeticBadge
                            cosmetics={profile.cosmetics}
                            className="size-6"
                        />
                        <AffiliationBadges badges={profile.badges} size={24} />
                        {!roleBadge && profile.title && (
                            <UserTitle
                                user={{ title: profile.title }}
                                className="px-2.5 py-1 text-xs"
                            />
                        )}
                        <UserRoles
                            roles={profile.roles}
                            className="px-2.5 py-1 text-xs"
                        />
                        <BadgeStrip badges={tieredBadges} isSelf={isSelf} />
                        {questPoints !== null && questPoints > 0 && (
                            <span
                                title={tr('Очки за виконані завдання')}
                                className="inline-flex items-center gap-1 rounded-chip bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300 tabular-nums"
                            >
                                <Coins className="size-3.5" />
                                {tr('{n} очок', {
                                    n: questPoints.toLocaleString('uk-UA'),
                                })}
                            </span>
                        )}
                        {linkedAccounts.map((a) =>
                            a.href ? (
                                <a
                                    key={a.kind}
                                    href={a.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-chip bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-white/75 transition hover:text-white"
                                >
                                    <Link2 className="size-3.5" />
                                    {a.label}
                                </a>
                            ) : null,
                        )}
                        {roleBadge && (
                            <span className="inline-flex items-center gap-1 rounded-chip border-gold/30 bg-gold/10 px-2.5 py-0.5 text-xs font-semibold text-gold">
                                <ShieldCheck className="size-3" /> {roleBadge}
                            </span>
                        )}
                    </div>
                    {profile.alias && (
                        <p className="mt-1 text-sm text-white/45">
                            {profile.name}
                        </p>
                    )}
                    {profile.note && (
                        <p className="mt-1 text-sm text-white/60">
                            {profile.note}
                        </p>
                    )}
                    {ready && (
                        <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-chip bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                            <span className="size-1.5 rounded-full bg-emerald-400" />
                            {ready.game
                                ? tr('Готовий грати в {game}', {
                                      game: ready.game.name,
                                  })
                                : tr('Готовий грати зараз')}
                        </p>
                    )}
                    {(profile.status || profile.status_emoji) && (
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[15px] text-white/75">
                            {profile.status_emoji && (
                                <span className="text-lg leading-none">
                                    {profile.status_emoji}
                                </span>
                            )}
                            {profile.status}
                            {profile.status_until && (
                                <span className="text-xs text-white/40">
                                    · {statusUntilLabel(profile.status_until)}
                                </span>
                            )}
                            {isSelf && statusOn && (
                                <button
                                    type="button"
                                    onClick={() => setStatusOpen(true)}
                                    className="text-xs font-medium text-sky-400 hover:text-white"
                                >
                                    {tr('Змінити')}
                                </button>
                            )}
                        </p>
                    )}
                    {isSelf &&
                        statusOn &&
                        !profile.status &&
                        !profile.status_emoji && (
                            <button
                                type="button"
                                onClick={() => setStatusOpen(true)}
                                className="gc-solid-2 mt-1.5 inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
                            >
                                <span aria-hidden>🙂</span>
                                {tr('Встановити статус')}
                            </button>
                        )}
                    {isSelf && statusOn && (
                        <StatusDialog
                            user={profile}
                            open={statusOpen}
                            onOpenChange={setStatusOpen}
                        />
                    )}
                    {(profile.looking_for_group ||
                        (profile.languages?.length ?? 0) > 0) && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {profile.looking_for_group && (
                                <span className="rounded-chip bg-white/[0.08] px-2.5 py-1 text-xs font-medium text-white">
                                    {tr('Шукаю групу')}
                                </span>
                            )}
                            {profile.languages?.map((code) => (
                                <span
                                    key={code}
                                    className="gc-solid-2 rounded-chip px-2.5 py-1 text-xs text-white/70"
                                >
                                    {languageName(code, LOCALE)}
                                </span>
                            ))}
                        </div>
                    )}
                    {/* «Граю в…» — лише коли людина справді грає; налаштування — у Налаштуваннях профілю. */}
                    {profile.pin && (
                        <Link
                            href={profile.pin.href}
                            className="gc-solid-2 mt-2 inline-flex items-center gap-2 rounded-chip px-3 py-1 text-xs text-white/80"
                        >
                            <span className="text-white/40">
                                {tr(profile.pin.hint)}
                            </span>
                            {profile.pin.title}
                        </Link>
                    )}
                    {profile.playing && (
                        <div className="mt-2">
                            {playingOn && (
                                <PlayingBadge playing={profile.playing} />
                            )}
                        </div>
                    )}
                    <WatchedTogether
                        key={profile.id}
                        people={together}
                        isSelf={isSelf}
                        hiddenForOthers={togetherOff}
                    />
                    {compatibility && compatibility.score > 0 && (
                        <div className="mt-2">
                            <CompatibilityChip data={compatibility} />
                        </div>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-2 lg:hidden">
                        <Link
                            href={`/${profile.username}/card`}
                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.11]"
                        >
                            <QrCode className="size-4" /> Game Card
                        </Link>
                        {isSelf && (
                            <button
                                type="button"
                                onClick={() => setToolsOpen((v) => !v)}
                                aria-expanded={toolsOpen}
                                aria-label={tr('Інструменти сторінки')}
                                title={tr('Інструменти сторінки')}
                                className={cn(
                                    'inline-flex size-10 items-center justify-center rounded-xl text-white transition',
                                    toolsOpen
                                        ? 'bg-white/[0.16]'
                                        : 'bg-white/[0.07] hover:bg-white/[0.11]',
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
                        {guest ? (
                            <Link
                                href="/register"
                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                            >
                                <UserPlus className="size-4" />
                                {tr('Приєднатися й додати в друзі')}
                            </Link>
                        ) : isSelf ? (
                            <Link
                                href="/settings/profile"
                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.11]"
                            >
                                <PenLine className="size-4" />{' '}
                                {tr('Редагувати профіль')}
                            </Link>
                        ) : (
                            <>
                                {profile.has_tiers && (
                                    <SupportAuthorButton
                                        username={profile.username}
                                        name={profile.name}
                                    />
                                )}
                                <FriendButton
                                    username={profile.username}
                                    relation={relation}
                                />
                                {modules.includes('messages') && canMessage && (
                                    <Link
                                        href={`/messages/with/${profile.username}`}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.11]"
                                    >
                                        <MessageCircle className="size-4" />{' '}
                                        {tr('Написати')}
                                    </Link>
                                )}
                                {duelsOn && (
                                    <Link
                                        href={`/duels?to=${profile.username}`}
                                        aria-label={tr('Викликати на дуель')}
                                        title={tr('Викликати на дуель')}
                                        className="inline-flex size-10 items-center justify-center rounded-xl bg-white/[0.07] text-white transition hover:bg-white/[0.11]"
                                    >
                                        <Swords className="size-4" />
                                    </Link>
                                )}
                                {modules.includes('messages') &&
                                    canMessage &&
                                    relation === 'friends' &&
                                    birthdayToday && (
                                        <Link
                                            href={`/messages/with/${profile.username}?text=${encodeURIComponent('З днем народження!')}`}
                                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-gc-ink transition hover:bg-white/90"
                                        >
                                            <Cake className="size-4" />{' '}
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
                                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm font-semibold text-white/80 transition hover:bg-white/[0.11]"
                                >
                                    <Ban className="size-4" />
                                    {blocked
                                        ? tr('Зняти обмеження')
                                        : tr('Обмежити')}
                                </button>
                                <ReportPersonButton
                                    username={profile.username}
                                    name={profile.name}
                                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm font-semibold text-white/80 transition hover:bg-white/[0.11]"
                                />
                            </>
                        )}
                    </div>
                    {/* Шестерня: віджет, автопостинг, статистика, піксель-аватар — не захаращують шапку. */}
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
                                <div className="mt-4 flex flex-wrap justify-end gap-2">
                                    {isSelf && !profile.is_private && (
                                        <EmbedButton
                                            path={`/widget/u/${profile.username}`}
                                        />
                                    )}
                                    {isSelf && (
                                        <CrosspostButton
                                            owner={{
                                                type: 'user',
                                                id: profile.id,
                                            }}
                                        />
                                    )}
                                    {isSelf && <AuthorStatsButton />}
                                    {isSelf && pixelOn && (
                                        <Link
                                            href="/settings/pixel-avatar"
                                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.11]"
                                        >
                                            <Grid3x3 className="size-4" />
                                            {tr('Піксель-аватар')}
                                        </Link>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-white/55">
                        {friendsSince && (
                            <span className="inline-flex items-center gap-1.5">
                                <CalendarDays className="size-3.5" />
                                {anniversary
                                    ? tr('Річниця дружби · {years}', {
                                          years: anniversaryYears,
                                      })
                                    : tr('Друзі з {date}', {
                                          date: formatDate(friendsSince, false),
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
                                <PhoneBadge phone={profile.phone} size="sm" />
                            ))}
                        {profile.city && (
                            <span className="inline-flex items-center gap-1.5">
                                <MapPin className="size-4 text-sky-400" />{' '}
                                {profile.city}
                            </span>
                        )}
                        {profile.birthday && (
                            <span className="inline-flex items-center gap-1.5">
                                <Cake className="size-4 text-gc-pink" />{' '}
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
                                <Globe className="size-4 text-gc-cyan" />{' '}
                                {profile.website.replace(/^https?:\/\//, '')}
                            </a>
                        )}
                        {profile.joined_at && (
                            <span className="inline-flex items-center gap-1.5">
                                <CalendarDays className="size-4 text-white/40" />{' '}
                                {tr('В GameCon з')}{' '}
                                {formatDate(profile.joined_at)}
                            </span>
                        )}
                    </div>
                </div>
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
                            <ProfileSectionBody
                                section={section}
                                username={profile.username}
                                isSelf={isSelf}
                                visibility={wishlistVisibility}
                            />
                        </div>
                    )}
                    <div
                        className={cn(
                            'mt-5 flex flex-col gap-5 xl:flex-row',
                            section !== 'main' && 'hidden',
                        )}
                    >
                        <aside className="w-full shrink-0 space-y-4 xl:sticky xl:top-[76px] xl:h-fit xl:w-[320px]">
                            {showVisitors && (
                                <Widget title={tr('Хто заходив')} icon={Eye}>
                                    {visitors.length === 0 ? (
                                        <p className="px-1 text-sm text-white/45">
                                            {tr('Поки ніхто не заходив.')}
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {visitors.map((visitor) => (
                                                <Link
                                                    key={visitor.id}
                                                    href={`/${visitor.username}`}
                                                    className="flex items-center gap-2 rounded-2xl px-1 py-1 transition hover:bg-[var(--gc-l3)]"
                                                >
                                                    <UserAvatar
                                                        user={visitor}
                                                        size="sm"
                                                    />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-sm text-white">
                                                            {visitor.first_name}
                                                        </span>
                                                        <span className="block text-xs text-white/40">
                                                            {formatDate(
                                                                visitor.visited_at,
                                                                false,
                                                            )}
                                                        </span>
                                                    </span>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </Widget>
                            )}
                            {liveOn && stream && (
                                <ProfileStream stream={stream} />
                            )}
                            {account && <AccountCard data={account} />}
                            {blockSequence(blockOrder).map((key) => {
                                const widgets: Record<string, ReactNode> = {
                                    // Ігрові блоки — лише в режимах, де є «Граю в…» (не в «Класиці», «Кіномані»…).
                                    track: (profileTrack ||
                                        (isSelf && profileTrackOn)) && (
                                        <ProfileTrack
                                            track={profileTrack}
                                            isSelf={isSelf && profileTrackOn}
                                        />
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
                                    steam: playingOn &&
                                        (steamLibrary?.length ?? 0) > 0 && (
                                            <Widget
                                                title={tr('Бібліотека Steam')}
                                            >
                                                <div className="space-y-1 px-1">
                                                    {steamLibrary?.map(
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
                                        ),
                                    steam_achievements: steamAchievements &&
                                        canSeeContent && (
                                            <SteamAchievements
                                                username={profile.username}
                                            />
                                        ),
                                    setup: setup && (
                                        <MySetup data={setup} isSelf={isSelf} />
                                    ),
                                    stream_schedule: streamSchedule && (
                                        <StreamSchedule
                                            slots={streamSchedule}
                                            isSelf={isSelf}
                                        />
                                    ),
                                    cards: cardShowcase && (
                                        <CardShowcase
                                            data={cardShowcase}
                                            isSelf={isSelf}
                                        />
                                    ),
                                    about: profile.about && (
                                        <Widget title={tr('Про себе')}>
                                            <p className="px-1 text-sm leading-relaxed whitespace-pre-line text-white/75">
                                                {profile.about}
                                            </p>
                                        </Widget>
                                    ),
                                    characters: (characters.length > 0 ||
                                        (isSelf && charactersOn)) && (
                                        <CharactersWidget
                                            characters={characters}
                                            isSelf={isSelf}
                                        />
                                    ),
                                    games: backlog && (
                                        <BacklogWidget
                                            data={backlog}
                                            isSelf={isSelf}
                                        />
                                    ),
                                    achievements: achievements && (
                                        <AchievementsCard
                                            data={achievements}
                                            isSelf={isSelf}
                                        />
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
                                                    {tr('Поки немає друзів.')}
                                                </p>
                                            ) : (
                                                <div className="grid grid-cols-3 gap-2">
                                                    {friends.map((friend) => (
                                                        <Link
                                                            key={friend.id}
                                                            href={`/${friend.username}`}
                                                            className="flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center transition hover:bg-[var(--gc-l3)]"
                                                        >
                                                            <UserAvatar
                                                                user={friend}
                                                                size="lg"
                                                            />
                                                            <span className="w-full truncate text-xs text-white/75">
                                                                {
                                                                    friend.first_name
                                                                }
                                                            </span>
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                        </Widget>
                                    ),
                                    photos: photos.length > 0 && (
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
                                                        {stats.photos}
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

                                return <Fragment key={key}>{node}</Fragment>;
                            })}
                        </aside>

                        <div
                            id="wall"
                            className="min-w-0 flex-1 scroll-mt-24 space-y-4"
                        >
                            {canPost && (
                                <PostComposer wall={isSelf ? null : profile} />
                            )}

                            {posts.data.length === 0 ? (
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
                                    {posts.data.some((p) => p.is_pinned) && (
                                        <p className="flex items-center gap-1.5 px-1 text-xs font-semibold text-white/50">
                                            <Pin className="size-3.5" />
                                            {tr('Закріплене')}
                                        </p>
                                    )}
                                    {posts.data.map((post, i) => (
                                        <Fragment key={post.id}>
                                            {/* Межа між закріпленими й рештою стрічки. */}
                                            {i > 0 &&
                                                !post.is_pinned &&
                                                posts.data[i - 1].is_pinned && (
                                                    <p className="px-1 pt-2 text-xs font-semibold text-white/50">
                                                        {tr('Усі записи')}
                                                    </p>
                                                )}
                                            <PostCard post={post} />
                                        </Fragment>
                                    ))}
                                </InfiniteScroll>
                            )}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
