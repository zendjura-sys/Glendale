import { Head, Link, router } from '@inertiajs/react';
import {
    Popcorn,
    ArrowLeft,
    MessageCircle,
    Pause,
    Play,
    Plus,
    Share2,
    Star,
    Tv,
    EllipsisVertical,
    Copy,
    CircleAlert,
    Clapperboard,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    EpisodePicker,
    episodeLink,
    firstPick,
    supportsEpisodes,
} from '@/components/cinema/episode-picker';
import type { EpisodePick, Season } from '@/components/cinema/episode-picker';
import { MoviePoster, PosterRow } from '@/components/cinema/movie-tile';
import { CinemaShell } from '@/components/cinema/cinema-side';
import type { CinemaSideData } from '@/components/cinema/cinema-side';
import { MovieList } from '@/components/cinema/movie-row';
import type { MovieRowItem } from '@/components/cinema/movie-row';
import { TitleDesktop, TitleSection } from '@/components/cinema/title-desktop';
import { ShareMovieDialog } from '@/components/cinema/share-movie-dialog';
import { VoicePicker } from '@/components/cinema/voice-picker';
import {
    AudienceBar,
    RatingBreakdown,
} from '@/components/cinema/audience-stats';
import type { Audience } from '@/components/cinema/audience-stats';
import { AddToList, MovieReviews } from '@/components/cinema/movie-extras';
import { Comments } from '@/components/gc/comments';
import { PinButton } from '@/components/gc/pin-button';
import { SaveButton } from '@/components/gc/save-button';
import { UserAvatar } from '@/components/gc/user-avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api, ApiError } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import { playQueue, toggle, usePlayer } from '@/lib/player';
import { Equalizer, TrackCover } from '@/components/music/track-cover';
import { cn } from '@/lib/utils';
import { usePlugin } from '@/lib/plugins';
import type {
    CommentItem,
    LocalTrack,
    MovieCard,
    MovieDetail,
    MovieFriend,
    MovieOption,
    MoviePlayer,
    MovieState,
    MovieStatus,
} from '@/types';
import { tr } from '@/lib/i18n';

type Props = {
    movie: MovieDetail;
    players: MoviePlayer[];
    state: MovieState;
    statuses: MovieOption<MovieStatus>[];
    friends: { users: MovieFriend[]; total: number };
    seen: MovieFriend[];
    taste: (MovieFriend & { shared: number })[];
    episodeMarks: string[];
    /** Посерійний режим (вмикається в адмінці); приходить окремим запитом. */
    episodes?: Season[] | null;
    similar: MovieCard[];
    comments: CommentItem[];
    can: { manage: boolean };
    soundtrack: LocalTrack[];
    saved: boolean;
    pinned: boolean;
    inTopTen: boolean;
    audience: Audience;
    side?: CinemaSideData;
};

type StateResponse = {
    state: MovieState;
    user_rating: number | null;
    ratings_count: number;
    watchers_count: number;
};

const ratingSources: {
    key: keyof MovieDetail['ratings'];
    label: string;
    tone: string;
}[] = [
    { key: 'imdb', label: 'IMDb', tone: 'text-[#f5c518]' },
    { key: 'tmdb', label: 'TMDB', tone: 'text-[#01d277]' },
    { key: 'shikimori', label: 'Shikimori', tone: 'text-[#8fb4ff]' },
];

export default function CinemaShow({
    movie,
    players,
    state: initialState,
    statuses,
    friends,
    seen,
    taste,
    episodeMarks,
    episodes,
    similar,
    comments,
    can,
    soundtrack,
    saved,
    pinned,
    inTopTen,
    audience,
    side,
}: Props) {
    const [state, setState] = useState(initialState);
    const tenOn = usePlugin('top_ten');
    const listsOn = usePlugin('movie_lists');
    const reviewsOn = usePlugin('movie_reviews');
    const [stats, setStats] = useState({
        user_rating: movie.user_rating,
        ratings_count: movie.ratings_count,
        watchers_count: movie.watchers_count,
    });
    const [commentsCount, setCommentsCount] = useState(movie.comments_count);
    const marks = episodeMarks;
    const [sharing, setSharing] = useState(false);
    const [moreText, setMoreText] = useState(false);
    const providers = useMemo(
        () => [...new Set(players.map((p) => p.provider))],
        [players],
    );
    const [chosen, setProvider] = useState<string | null>(
        providers[0] ?? (movie.trailer_url ? 'trailer' : null),
    );
    // Після оновлення сторінки обраного провайдера може вже не бути — тоді беремо перший наявний.
    const provider =
        chosen === 'trailer' ||
        (chosen !== null && (providers as string[]).includes(chosen))
            ? chosen
            : (providers[0] ?? (movie.trailer_url ? 'trailer' : null));
    const providerPlayers = players.filter((p) => p.provider === provider);
    const [playerKey, setPlayerKey] = useState<string | null>(
        providerPlayers[0]?.key ?? null,
    );
    const player =
        providerPlayers.find((p) => p.key === playerKey) ?? providerPlayers[0];
    const startedRef = useRef(false);
    const frameRef = useRef<HTMLIFrameElement>(null);
    // Серія обирається під плеєром (сам плеєр — без перемикачів): одразу наступна непереглянута.
    const [pick, setPick] = useState<EpisodePick | null>(() =>
        episodes?.length ? firstPick(episodes, episodeMarks) : null,
    );
    // Список серій приходить окремим запитом (defer): тоді й обираємо серію.
    const [picked, setPicked] = useState(false);
    useEffect(() => {
        if (picked || !episodes?.length) return;
        setPicked(true);
        setPick((current) => current ?? firstPick(episodes, episodeMarks));
    }, [episodes, episodeMarks, picked]);
    // Поки список серій вантажиться, плеєр не показуємо, щоб він не перезапускався.
    const waitingEpisodes =
        episodes === undefined &&
        player !== undefined &&
        supportsEpisodes(player.provider) &&
        (movie.episodes_count ?? 0) > 1;
    // Фільм (або серіал без списку серій у посерійному режимі вимкнено): Kodik без перемикачів лише для фільмів.
    const bare = !((movie.episodes_count ?? 0) > 1);
    const episodeMode =
        provider !== 'trailer' &&
        pick !== null &&
        player !== undefined &&
        supportsEpisodes(player.provider);

    const apply = (response: StateResponse) => {
        setState(response.state);
        setStats({
            user_rating: response.user_rating,
            ratings_count: response.ratings_count,
            watchers_count: response.watchers_count,
        });
    };

    const setStatus = async (status: MovieStatus | null) => {
        const previous = state;
        setState({ ...state, status });
        try {
            apply(
                await api<StateResponse>(
                    'PATCH',
                    `/cinema/${movie.slug}/status`,
                    { status },
                ),
            );
            if (status) {
                toast.success(
                    tr('Додано до списку «{label}».', {
                        label: statuses.find((s) => s.key === status)?.label,
                    }),
                );
            }
        } catch (e) {
            setState(previous);
            toast.error(
                e instanceof ApiError ? e.message : tr('Не вдалося зберегти.'),
            );
        }
    };

    const rate = async (rating: number | null) => {
        const previous = state;
        setState({ ...state, rating });
        try {
            apply(
                await api<StateResponse>(
                    'PUT',
                    `/cinema/${movie.slug}/rating`,
                    {
                        rating,
                    },
                ),
            );
        } catch {
            setState(previous);
            toast.error(tr('Не вдалося зберегти оцінку.'));
        }
    };

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (startedRef.current) return;
            // Лише події нашого плеєра, а не інших вкладок чи вбудованого вмісту.
            if (event.source !== frameRef.current?.contentWindow) return;
            const data = event.data as { key?: string; event?: string } | null;
            const key =
                typeof data === 'object' && data
                    ? (data.key ?? data.event ?? '')
                    : String(data ?? '');
            if (!/play|start|time_update/i.test(key)) return;
            startedRef.current = true;
            void api<StateResponse>('POST', `/cinema/${movie.slug}/started`)
                .then(apply)
                .catch(() => undefined);
        };
        window.addEventListener('message', onMessage);

        return () => window.removeEventListener('message', onMessage);
    }, [movie.slug]);

    const choose = (next: string) => {
        setProvider(next);
        setPlayerKey(players.find((p) => p.provider === next)?.key ?? null);
    };

    const playTrailer = () => {
        choose('trailer');
        document
            .getElementById('player')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    // Посилання «…#trailer» (віджет «Трейлери») — одразу вмикаємо трейлер.
    useEffect(() => {
        if (window.location.hash === '#trailer' && movie.trailer_url) {
            playTrailer();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [movie.id]);

    const ratings = ratingSources.filter((r) => movie.ratings[r.key]);
    const tabs = [
        ...providers.map((p) => ({
            key: p,
            label: players.find((pl) => pl.provider === p)?.provider_label ?? p,
        })),
        ...(movie.trailer_url
            ? [{ key: 'trailer', label: tr('Трейлер') }]
            : []),
    ];

    const moreMenu = (
        <DropdownMenu>
            <DropdownMenuTrigger
                aria-label={tr('Ще')}
                className="flex size-12 items-center justify-center rounded-full text-white/80 hover:bg-white/[0.06]"
            >
                <EllipsisVertical className="size-6" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="min-w-56 rounded-2xl p-1.5"
            >
                <DropdownMenuItem
                    onSelect={() => setSharing(true)}
                    className="gap-3 rounded-xl px-3 py-2.5"
                >
                    <Share2 className="size-5" />
                    {tr('Поділитися')}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onSelect={() => {
                        void navigator.clipboard?.writeText(
                            window.location.href,
                        );
                        toast.success(tr('Посилання скопійовано'));
                    }}
                    className="gap-3 rounded-xl px-3 py-2.5"
                >
                    <Copy className="size-5" />
                    {tr('Скопіювати посилання')}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onSelect={() =>
                        router.post(`/cinema/${movie.slug}/watch`, {
                            player_key: player?.key ?? null,
                        })
                    }
                    className="gap-3 rounded-xl px-3 py-2.5"
                >
                    <Popcorn className="size-5" />
                    {tr('Дивитися разом')}
                </DropdownMenuItem>
                {tenOn && (
                    <DropdownMenuItem
                        onSelect={() =>
                            router.post('/cinema/ten', {
                                movie_id: movie.id,
                            })
                        }
                        className="gap-3 rounded-xl px-3 py-2.5"
                    >
                        <Star className="size-5" />
                        {inTopTen ? tr('У десятці') : tr('У десятку')}
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem
                    asChild
                    className="gap-3 rounded-xl px-3 py-2.5 text-rose-400"
                >
                    <Link
                        href={`/support?subject=${encodeURIComponent(movie.title)}`}
                    >
                        <CircleAlert className="size-5" />
                        {tr('Поскаржитися')}
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    return (
        <>
            <Head title={movie.title} />
            <CinemaShell side={side}>
                {/*
                 * Широкий екран — постер ліворуч, банер угорі; горизонтальний сенсорний екран — постер
                 * закріплений ліворуч (з кнопками «назад» і «додати»), уміст прокручується праворуч.
                 */}
                <div className="gc-title">
                    <aside className="gc-title-aside">
                        <div className="gc-title-aside-in">
                            <div className="gc-title-rail">
                                <Link
                                    href="/cinema"
                                    aria-label={tr('Назад')}
                                    className="flex size-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md"
                                >
                                    <ArrowLeft className="size-5" />
                                </Link>
                                {listsOn && (
                                    <AddToList
                                        movieId={movie.id}
                                        slug={movie.slug}
                                    />
                                )}
                            </div>
                            <MoviePoster
                                movie={movie}
                                className="aspect-[2/3] w-full rounded-[28px] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.9)]"
                            />
                        </div>
                    </aside>
                    <div className="min-w-0 space-y-5">
                        <div className="gc-title-desk">
                            <TitleDesktop
                                movie={movie}
                                statuses={statuses}
                                status={state.status}
                                onStatus={(status) => void setStatus(status)}
                                watchers={stats.watchers_count}
                                commentsCount={commentsCount}
                                ratings={ratings.map((r) => ({
                                    ...r,
                                    value: movie.ratings[r.key]!,
                                }))}
                                onTrailer={
                                    movie.trailer_url ? playTrailer : undefined
                                }
                                canManage={can.manage}
                                playLabel={
                                    state.status === 'watching'
                                        ? tr('Продовжити перегляд')
                                        : tr('Дивитися онлайн')
                                }
                                menu={moreMenu}
                                actions={
                                    <>
                                        <SaveButton
                                            kind="movie"
                                            id={movie.id}
                                            saved={saved}
                                        />
                                        {listsOn && (
                                            <AddToList
                                                movieId={movie.id}
                                                slug={movie.slug}
                                            />
                                        )}
                                        <PinButton
                                            kind="movie"
                                            id={movie.id}
                                            pinned={pinned}
                                        />
                                    </>
                                }
                            />
                        </div>

                        <section
                            id="player"
                            className="glass scroll-mt-24 overflow-hidden rounded-2xl"
                        >
                            {tabs.length === 0 ? (
                                <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-black/40 p-6 text-center">
                                    <Tv className="size-10 text-white/25" />
                                    <p className="font-display text-lg font-semibold text-white">
                                        {tr('Плеєр ще не додано')}
                                    </p>
                                    <p className="max-w-sm text-sm text-white/45">
                                        {tr(
                                            'Додайте фільм до списку «В планах» — ми нагадаємо, щойно він з’явиться.',
                                        )}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] p-3">
                                        <div className="scrollbar-none flex max-w-full gap-1 overflow-x-auto">
                                            {tabs.map((tab) => (
                                                <button
                                                    key={tab.key}
                                                    type="button"
                                                    onClick={() =>
                                                        choose(tab.key)
                                                    }
                                                    className={cn(
                                                        'rounded-xl px-3.5 py-2 text-sm font-semibold transition',
                                                        provider === tab.key
                                                            ? 'nav-active text-white'
                                                            : 'text-white/55 hover:bg-white/[0.05] hover:text-white',
                                                    )}
                                                >
                                                    {tab.label}
                                                </button>
                                            ))}
                                        </div>
                                        {players.length === 1 &&
                                            provider !== 'trailer' &&
                                            player?.translation && (
                                                <span className="ml-auto max-w-full truncate rounded-xl border border-white/[0.06] px-3 py-2 text-sm text-white/60">
                                                    {player.translation}
                                                </span>
                                            )}
                                        {provider !== 'trailer' &&
                                            players.length > 1 && (
                                                <div className="ml-auto max-w-full">
                                                    <VoicePicker
                                                        players={players}
                                                        current={player}
                                                        onPick={(p) => {
                                                            setProvider(
                                                                p.provider,
                                                            );
                                                            setPlayerKey(p.key);
                                                        }}
                                                    />
                                                </div>
                                            )}
                                    </div>
                                    <div className="relative aspect-video bg-black">
                                        <iframe
                                            ref={frameRef}
                                            key={
                                                provider === 'trailer'
                                                    ? 'trailer'
                                                    : episodeMode
                                                      ? `${player.key}:${pick.season}:${pick.episode}`
                                                      : player?.key
                                            }
                                            src={
                                                provider === 'trailer'
                                                    ? (movie.trailer_url ?? '')
                                                    : player && !waitingEpisodes
                                                      ? episodeLink(
                                                            player.provider,
                                                            player.link,
                                                            episodeMode
                                                                ? pick
                                                                : null,
                                                            episodeMode || bare,
                                                        )
                                                      : undefined
                                            }
                                            title={movie.title}
                                            className="absolute inset-0 size-full"
                                            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                                            allowFullScreen
                                            referrerPolicy="origin"
                                        />
                                    </div>
                                    {episodes &&
                                        episodes.length > 0 &&
                                        provider !== 'trailer' && (
                                            <EpisodePicker
                                                seasons={episodes}
                                                value={pick}
                                                onChange={setPick}
                                                supported={supportsEpisodes(
                                                    player?.provider,
                                                )}
                                                watched={marks}
                                            />
                                        )}
                                </>
                            )}
                        </section>

                        <div className="grid grid-cols-1 gap-5 @5xl:grid-cols-[1fr_280px]">
                            <div className="min-w-0 space-y-5">
                                {movie.description && (
                                    <section className="glass rounded-2xl p-5">
                                        <h2 className="mb-2 font-display text-lg font-semibold text-white">
                                            {tr('Про що')}
                                        </h2>
                                        <p
                                            className={cn(
                                                'text-[15px] leading-relaxed whitespace-pre-line text-white/75',
                                                !moreText && 'line-clamp-5',
                                            )}
                                        >
                                            {movie.description}
                                        </p>
                                        {!moreText &&
                                            movie.description.length > 320 && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setMoreText(true)
                                                    }
                                                    className="mt-2 w-full text-center text-sm font-semibold text-white"
                                                >
                                                    {tr('Докладніше…')}
                                                </button>
                                            )}
                                    </section>
                                )}
                                <RatingBreakdown
                                    audience={audience}
                                    mine={state.rating}
                                    onRate={(r) => void rate(r)}
                                />
                                <AudienceBar
                                    audience={audience}
                                    statuses={statuses}
                                />
                                <Soundtrack
                                    tracks={soundtrack}
                                    slug={movie.slug}
                                    canAdd={can.manage}
                                />
                                {reviewsOn && (
                                    <MovieReviews slug={movie.slug} />
                                )}
                                <section
                                    id="comments"
                                    className="glass scroll-mt-24 rounded-2xl p-5"
                                >
                                    <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-white">
                                        <MessageCircle className="size-5 text-gc-lilac-400" />
                                        {tr('Обговорення')}
                                        <span className="text-sm font-normal text-white/40">
                                            {commentsCount}
                                        </span>
                                    </h2>
                                    {!movie.comments_enabled && (
                                        <p className="mb-3 text-sm text-white/45">
                                            {tr(
                                                'Коментарі до цього фільму вимкнено.',
                                            )}
                                        </p>
                                    )}
                                    <Comments
                                        endpoint={`/cinema/${movie.slug}/comments`}
                                        initial={comments}
                                        total={commentsCount}
                                        canComment={movie.comments_enabled}
                                        onCountChange={setCommentsCount}
                                        className={cn(
                                            comments.length === 0 &&
                                                'border-t-0 pt-0',
                                        )}
                                    />
                                </section>
                            </div>
                            <aside className="space-y-5">
                                {seen.length > 0 && (
                                    <section className="glass rounded-2xl p-5">
                                        <h2 className="mb-3 font-display text-sm font-semibold text-white/70">
                                            {tr('Уже бачили')}
                                        </h2>
                                        <ul className="space-y-2">
                                            {seen.map((friend) => (
                                                <li key={friend.id}>
                                                    <Link
                                                        href={`/${friend.username}`}
                                                        className="flex items-center gap-2 text-sm text-white"
                                                    >
                                                        <UserAvatar
                                                            user={friend}
                                                            size="sm"
                                                        />
                                                        <span className="truncate">
                                                            {friend.name}
                                                        </span>
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                )}
                                {taste.length > 0 && (
                                    <section className="glass rounded-2xl p-5">
                                        <h2 className="mb-3 font-display text-sm font-semibold text-white/70">
                                            {tr('Схожий смак')}
                                        </h2>
                                        <ul className="space-y-2">
                                            {taste.map((friend) => (
                                                <li key={friend.id}>
                                                    <Link
                                                        href={`/${friend.username}`}
                                                        className="flex items-center justify-between gap-2 text-sm text-white"
                                                    >
                                                        <span className="flex min-w-0 items-center gap-2">
                                                            <UserAvatar
                                                                user={friend}
                                                                size="sm"
                                                            />
                                                            <span className="truncate">
                                                                {friend.name}
                                                            </span>
                                                        </span>
                                                        <span className="shrink-0 text-xs text-white/45">
                                                            {friend.shared}
                                                        </span>
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                )}
                                <section className="glass rounded-2xl p-5">
                                    <h2 className="mb-3 font-display text-sm font-semibold text-white/70">
                                        {tr('Друзі та цей фільм')}
                                    </h2>
                                    {friends.users.length === 0 ? (
                                        <p className="text-sm text-white/45">
                                            {tr(
                                                'Ніхто з друзів ще не додав його до списку. Будьте першим і порадьте!',
                                            )}
                                        </p>
                                    ) : (
                                        <ul className="space-y-2.5">
                                            {friends.users.map((f) => (
                                                <li key={f.id}>
                                                    <Link
                                                        href={`/${f.username}`}
                                                        className="flex items-center gap-2.5 rounded-xl p-1 transition hover:bg-white/[0.04]"
                                                    >
                                                        <UserAvatar
                                                            user={f}
                                                            size="sm"
                                                        />
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate text-sm font-medium text-white">
                                                                {f.name}
                                                            </span>
                                                            <span className="block text-xs text-white/45">
                                                                {
                                                                    statuses.find(
                                                                        (s) =>
                                                                            s.key ===
                                                                            f.movie_status,
                                                                    )?.label
                                                                }
                                                            </span>
                                                        </span>
                                                        {f.movie_rating && (
                                                            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-gc-amber">
                                                                <Star className="size-3 fill-current" />
                                                                {f.movie_rating}
                                                            </span>
                                                        )}
                                                    </Link>
                                                </li>
                                            ))}
                                            {friends.total >
                                                friends.users.length && (
                                                <li className="pl-1 text-xs text-white/40">
                                                    {tr('і ще')}{' '}
                                                    {friends.total -
                                                        friends.users.length}
                                                </li>
                                            )}
                                        </ul>
                                    )}
                                </section>
                            </aside>
                        </div>

                        {similar.length > 0 && (
                            <>
                                <div className="sm:hidden">
                                    <PosterRow
                                        title={tr('Схоже')}
                                        movies={similar}
                                    />
                                </div>
                                <TitleSection
                                    icon={<Clapperboard />}
                                    title={tr('Схоже за жанром')}
                                    className="max-sm:hidden"
                                >
                                    <MovieList
                                        movies={similar as MovieRowItem[]}
                                    />
                                </TitleSection>
                            </>
                        )}
                    </div>
                </div>
            </CinemaShell>
            <ShareMovieDialog
                movie={movie}
                description={movie.description}
                open={sharing}
                onOpenChange={setSharing}
            />
        </>
    );
}

/** Саундтрек як список у плеєрі: обкладинка з «Слухати», назва, виконавець, тривалість. */
function Soundtrack({
    tracks,
    slug,
    canAdd,
}: {
    tracks: LocalTrack[];
    slug: string;
    canAdd: boolean;
}) {
    const player = usePlayer();
    const [adding, setAdding] = useState(false);

    return (
        <section className="glass rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold text-white">
                    {tr('Саундтрек')}
                </h2>
                {canAdd && (
                    <button
                        type="button"
                        onClick={() => setAdding((v) => !v)}
                        aria-label={tr('Додати трек')}
                        title={tr('Додати трек')}
                        className={cn(
                            'flex size-9 items-center justify-center rounded-full transition',
                            adding
                                ? 'bg-primary text-white'
                                : 'bg-white/[0.06] text-white/70 hover:bg-white/10 hover:text-white',
                        )}
                    >
                        <Plus
                            className={cn(
                                'size-5 transition-transform',
                                adding && 'rotate-45',
                            )}
                        />
                    </button>
                )}
            </div>
            {adding && <SoundtrackForm slug={slug} />}
            <ol className="space-y-0.5">
                {tracks.map((track, index) => {
                    const isCurrent = player.current?.key === track.key;
                    const playing = isCurrent && player.playing;

                    return (
                        <li
                            key={track.key}
                            className={cn(
                                'group flex items-center gap-3 rounded-2xl p-2 pr-3 transition hover:bg-white/[0.045]',
                                isCurrent &&
                                    'bg-gradient-to-r from-gc-indigo/15 to-transparent',
                            )}
                        >
                            <button
                                type="button"
                                onClick={() =>
                                    isCurrent
                                        ? toggle()
                                        : playQueue(tracks, index)
                                }
                                className="relative shrink-0"
                                aria-label={
                                    playing ? tr('Пауза') : tr('Слухати')
                                }
                            >
                                <TrackCover
                                    url={track.cover_url}
                                    seed={track.key}
                                    className="size-12 rounded-xl"
                                />
                                <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
                                    {playing ? (
                                        <Pause className="size-4 fill-white text-white" />
                                    ) : (
                                        <Play className="ml-0.5 size-4 fill-white text-white" />
                                    )}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    isCurrent
                                        ? toggle()
                                        : playQueue(tracks, index)
                                }
                                className="min-w-0 flex-1 text-left"
                            >
                                <p
                                    className={cn(
                                        'flex items-center gap-2 text-[15px] font-medium',
                                        isCurrent
                                            ? 'text-[#c3caff]'
                                            : 'text-white',
                                    )}
                                >
                                    {isCurrent && (
                                        <Equalizer paused={!playing} />
                                    )}
                                    <span className="truncate">
                                        {track.title}
                                    </span>
                                </p>
                                <p className="truncate text-xs text-white/50">
                                    {track.artist}
                                </p>
                            </button>
                            {track.duration ? (
                                <span className="shrink-0 text-xs text-white/40 tabular-nums">
                                    {formatDuration(track.duration)}
                                </span>
                            ) : null}
                        </li>
                    );
                })}
            </ol>
            {tracks.length === 0 && (
                <p className="text-sm text-white/45">
                    {tr('Треків ще немає.')}
                </p>
            )}
        </section>
    );
}

function SoundtrackForm({ slug }: { slug: string }) {
    const [query, setQuery] = useState('');
    const [hits, setHits] = useState<
        { id: number; title: string; artist: string }[]
    >([]);

    return (
        <form
            className="mb-3 space-y-2"
            onSubmit={(event) => {
                event.preventDefault();
                void api<{
                    tracks: { id: number; title: string; artist: string }[];
                }>(
                    'GET',
                    `/music/search?q=${encodeURIComponent(query)}&scope=all`,
                ).then((response) => setHits(response.tracks));
            }}
        >
            <div className="flex gap-2">
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={tr('Знайти трек')}
                    className="h-11 min-w-0 flex-1 rounded-xl bg-white/10 px-3 text-sm text-white placeholder:text-white/40"
                />
                <button
                    type="submit"
                    className="h-11 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white"
                >
                    {tr('Шукати')}
                </button>
            </div>
            {hits.map((track) => (
                <button
                    key={track.id}
                    type="button"
                    className="block w-full rounded-xl bg-white/[0.04] px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                    onClick={() =>
                        router.post(`/cinema/${slug}/soundtrack`, {
                            track_id: track.id,
                        })
                    }
                >
                    {track.artist} — {track.title}
                </button>
            ))}
        </form>
    );
}
