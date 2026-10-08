import { Head, Link, router } from '@inertiajs/react';
import {
    Popcorn,
    ArrowLeft,
    Bookmark,
    Check,
    ChevronDown,
    Clock,
    Eye,
    MessageCircle,
    Pencil,
    Play,
    Share2,
    Star,
    Tv,
    UsersRound,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { MoviePoster, PosterRow } from '@/components/cinema/movie-tile';
import { ShareMovieDialog } from '@/components/cinema/share-movie-dialog';
import { Comments } from '@/components/gc/comments';
import { SaveButton } from '@/components/gc/save-button';
import { UserAvatar } from '@/components/gc/user-avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api, ApiError } from '@/lib/api';
import { compactNumber, plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    CommentItem,
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
    similar: MovieCard[];
    comments: CommentItem[];
    can: { manage: boolean };
    saved: boolean;
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

const statusTone: Record<MovieStatus, string> = {
    planned: 'from-gc-blue to-gc-indigo',
    watching: 'from-gc-mint to-gc-cyan',
    watched: 'from-gc-purple to-gc-pink',
    dropped: 'from-gc-coral to-gc-pink',
};

function durationLabel(minutes: number | null) {
    if (!minutes) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    return h
        ? tr('{h} год{v}', { h, v: m ? tr(' {m} хв', { m }) : '' })
        : tr('{m} хв', { m });
}

function ScoreRing({ value, label }: { value: number; label: string }) {
    const pct = Math.max(0, Math.min(1, value / 10));

    return (
        <div className="flex items-center gap-2.5">
            <div
                className="relative flex size-12 items-center justify-center rounded-full"
                style={{
                    background: `conic-gradient(${value >= 7 ? '#22d3a6' : value >= 5 ? '#f5b342' : '#f43f5e'} ${pct * 360}deg, rgb(255 255 255 / 0.08) 0)`,
                }}
            >
                <span className="flex size-[40px] items-center justify-center rounded-full bg-[#0b0d1f] font-display text-sm font-bold text-white tabular-nums">
                    {value.toFixed(1)}
                </span>
            </div>
            <span className="text-xs leading-tight text-white/55">{label}</span>
        </div>
    );
}

function RatingPicker({
    value,
    onChange,
}: {
    value: number | null;
    onChange: (value: number | null) => void;
}) {
    const [hover, setHover] = useState<number | null>(null);
    const shown = hover ?? value ?? 0;

    return (
        <div className="flex items-center gap-2">
            <div
                className="flex items-center"
                onMouseLeave={() => setHover(null)}
            >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                        key={n}
                        type="button"
                        onMouseEnter={() => setHover(n)}
                        onClick={() => onChange(n === value ? null : n)}
                        className="p-0.5"
                        aria-label={tr('Оцінка {n}', { n })}
                    >
                        <Star
                            className={cn(
                                'size-[18px] transition',
                                n <= shown
                                    ? 'fill-gc-amber text-gc-amber drop-shadow-[0_0_6px_rgb(245_179_66/0.6)]'
                                    : 'text-white/20',
                            )}
                        />
                    </button>
                ))}
            </div>
            <span className="w-6 font-display text-sm font-bold text-white tabular-nums">
                {shown || ''}
            </span>
        </div>
    );
}

export default function CinemaShow({
    movie,
    players,
    state: initialState,
    statuses,
    friends,
    similar,
    comments,
    can,
    saved,
}: Props) {
    const [state, setState] = useState(initialState);
    const [stats, setStats] = useState({
        user_rating: movie.user_rating,
        ratings_count: movie.ratings_count,
        watchers_count: movie.watchers_count,
    });
    const [commentsCount, setCommentsCount] = useState(movie.comments_count);
    const [sharing, setSharing] = useState(false);
    const providers = useMemo(
        () => [...new Set(players.map((p) => p.provider))],
        [players],
    );
    const [provider, setProvider] = useState<string | null>(
        providers[0] ?? (movie.trailer_url ? 'trailer' : null),
    );
    const providerPlayers = players.filter((p) => p.provider === provider);
    const [playerKey, setPlayerKey] = useState<string | null>(
        providerPlayers[0]?.key ?? null,
    );
    const player =
        providerPlayers.find((p) => p.key === playerKey) ?? providerPlayers[0];
    const startedRef = useRef(false);

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

    const currentStatus = statuses.find((s) => s.key === state.status);
    const ratings = ratingSources.filter((r) => movie.ratings[r.key]);
    const meta = [
        movie.year,
        movie.type_label,
        durationLabel(movie.duration),
        movie.countries.slice(0, 2).join(', ') || null,
    ].filter(Boolean);
    const tabs = [
        ...providers.map((p) => ({
            key: p,
            label: players.find((pl) => pl.provider === p)?.provider_label ?? p,
        })),
        ...(movie.trailer_url
            ? [{ key: 'trailer', label: tr('Трейлер') }]
            : []),
    ];

    return (
        <>
            <Head title={movie.title} />
            <div className="space-y-5">
                <section className="relative isolate overflow-hidden rounded-3xl border border-white/[0.08] bg-gc-ink">
                    {(movie.backdrop || movie.poster) && (
                        <img
                            src={movie.backdrop ?? movie.poster ?? ''}
                            alt=""
                            className={cn(
                                'absolute inset-0 -z-10 size-full object-cover opacity-60',
                                !movie.backdrop && 'scale-110 blur-3xl',
                            )}
                        />
                    )}
                    <div className="absolute inset-0 -z-10 bg-gradient-to-r from-gc-ink via-gc-ink/85 to-gc-ink/30" />
                    <div className="absolute inset-0 -z-10 bg-gradient-to-t from-gc-ink via-gc-ink/40 to-transparent" />

                    <div className="p-5 sm:p-7">
                        <div className="mb-5 flex items-center gap-2">
                            <Link
                                href="/cinema"
                                className="inline-flex items-center gap-1.5 rounded-xl bg-black/30 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur transition hover:text-white"
                            >
                                <ArrowLeft className="size-3.5" /> {tr('Кіно')}
                            </Link>
                            {!movie.is_published && (
                                <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-200">
                                    {tr('Приховано')}
                                </span>
                            )}
                            {can.manage && (
                                <a
                                    href={`/admin/cinema/${movie.id}/edit`}
                                    className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-black/30 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur transition hover:text-white"
                                >
                                    <Pencil className="size-3.5" />{' '}
                                    {tr('Редагувати')}
                                </a>
                            )}
                        </div>

                        <div className="flex flex-col gap-6 sm:flex-row">
                            <div className="mx-auto w-[180px] shrink-0 sm:mx-0 sm:w-[210px]">
                                <MoviePoster
                                    movie={movie}
                                    className="aspect-[2/3] w-full rounded-2xl shadow-[0_30px_60px_-20px_rgb(0_0_0/0.9)] ring-1 ring-white/15"
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h1 className="font-display text-3xl leading-tight font-bold text-white sm:text-4xl">
                                    {movie.title}
                                </h1>
                                {movie.title_original &&
                                    movie.title_original !== movie.title && (
                                        <p className="mt-1 text-sm text-white/45">
                                            {movie.title_original}
                                        </p>
                                    )}
                                {movie.tagline && (
                                    <p className="mt-2 text-sm text-[#b9c3ff]/80 italic">
                                        «{movie.tagline}»
                                    </p>
                                )}
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-white/70">
                                    {meta.map((item, i) => (
                                        <span
                                            key={i}
                                            className="inline-flex items-center gap-1"
                                        >
                                            {i > 0 && (
                                                <span className="mr-1 text-white/25">
                                                    •
                                                </span>
                                            )}
                                            {i === 2 &&
                                                movie.duration !== null && (
                                                    <Clock className="size-3.5" />
                                                )}
                                            {item}
                                        </span>
                                    ))}
                                    {movie.age_rating && (
                                        <span className="rounded border border-white/25 px-1.5 text-xs font-semibold">
                                            {movie.age_rating}
                                        </span>
                                    )}
                                    {movie.episodes_count &&
                                        movie.episodes_count > 1 && (
                                            <span className="inline-flex items-center gap-1 text-white/55">
                                                <Tv className="size-3.5" />
                                                {movie.episodes_count}{' '}
                                                {plural(movie.episodes_count, [
                                                    'епізод',
                                                    'епізоди',
                                                    'епізодів',
                                                ])}
                                            </span>
                                        )}
                                </div>
                                {movie.genres.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {movie.genres.map((genre) => (
                                            <Link
                                                key={genre}
                                                href={`/cinema?genre=${encodeURIComponent(genre)}`}
                                                className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs text-white/70 backdrop-blur transition hover:border-gc-lilac-400/40 hover:text-white"
                                            >
                                                {genre}
                                            </Link>
                                        ))}
                                    </div>
                                )}

                                {(ratings.length > 0 ||
                                    stats.user_rating !== null) && (
                                    <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
                                        {stats.user_rating !== null && (
                                            <ScoreRing
                                                value={stats.user_rating}
                                                label={`GameCon · ${stats.ratings_count}`}
                                            />
                                        )}
                                        {ratings.map((r) => (
                                            <div
                                                key={r.key}
                                                className="flex flex-col"
                                            >
                                                <span
                                                    className={cn(
                                                        'font-display text-xl font-bold tabular-nums',
                                                        r.tone,
                                                    )}
                                                >
                                                    {movie.ratings[
                                                        r.key
                                                    ]!.toFixed(1)}
                                                </span>
                                                <span className="text-xs text-white/45">
                                                    {r.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-6 flex flex-wrap items-center gap-2">
                                    {players.length > 0 && (
                                        <a
                                            href="#player"
                                            className="btn-glow inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-semibold"
                                        >
                                            <Play className="size-4 fill-current" />
                                            {state.status === 'watching'
                                                ? tr('Продовжити')
                                                : tr('Дивитися')}
                                        </a>
                                    )}
                                    {players.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.post(
                                                    `/cinema/${movie.slug}/watch`,
                                                    {
                                                        player_key:
                                                            player?.key ?? null,
                                                    },
                                                )
                                            }
                                            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
                                        >
                                            <Popcorn className="size-4" />
                                            {tr('Дивитися разом')}
                                        </button>
                                    )}
                                    <SaveButton kind="movie" id={movie.id} saved={saved} />
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                className={cn(
                                                    'inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition',
                                                    currentStatus
                                                        ? `bg-gradient-to-r ${statusTone[currentStatus.key]}`
                                                        : 'border border-white/15 bg-white/[0.08] backdrop-blur hover:bg-white/15',
                                                )}
                                            >
                                                {currentStatus ? (
                                                    <Check className="size-4" />
                                                ) : (
                                                    <Bookmark className="size-4" />
                                                )}
                                                {currentStatus?.label ??
                                                    tr('Додати до списку')}
                                                <ChevronDown className="size-4 opacity-60" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            align="start"
                                            className="glass-strong min-w-52 rounded-2xl border-white/10 p-1.5 text-white"
                                        >
                                            {statuses.map((s) => (
                                                <DropdownMenuItem
                                                    key={s.key}
                                                    onSelect={() =>
                                                        setStatus(s.key)
                                                    }
                                                    className="gap-2 rounded-xl px-3 py-2"
                                                >
                                                    <span
                                                        className={cn(
                                                            'size-2.5 rounded-full bg-gradient-to-r',
                                                            statusTone[s.key],
                                                        )}
                                                    />
                                                    {s.label}
                                                    {state.status === s.key && (
                                                        <Check className="ml-auto size-4" />
                                                    )}
                                                </DropdownMenuItem>
                                            ))}
                                            {state.status && (
                                                <DropdownMenuItem
                                                    onSelect={() =>
                                                        setStatus(null)
                                                    }
                                                    className="gap-2 rounded-xl px-3 py-2 text-rose-300"
                                                >
                                                    <X className="size-4" />
                                                    {tr('Прибрати зі списку')}
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <button
                                        type="button"
                                        onClick={() => setSharing(true)}
                                        className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
                                    >
                                        <Share2 className="size-4" />{' '}
                                        {tr('Порадити')}
                                    </button>
                                </div>

                                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/50">
                                    <span className="inline-flex items-center gap-2">
                                        {tr('Ваша оцінка:')}
                                        <RatingPicker
                                            value={state.rating}
                                            onChange={rate}
                                        />
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <Eye className="size-3.5" />
                                        {compactNumber(movie.views_count)}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <UsersRound className="size-3.5" />
                                        {compactNumber(
                                            stats.watchers_count,
                                        )}{' '}
                                        {tr('у списках')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section
                    id="player"
                    className="glass scroll-mt-24 overflow-hidden rounded-3xl"
                >
                    {tabs.length === 0 ? (
                        <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-black/40 p-6 text-center">
                            <Tv className="size-10 text-white/25" />
                            <p className="font-display text-lg font-semibold text-white">
                                {tr('Плеєр ще не додано')}
                            </p>
                            <p className="max-w-sm text-sm text-white/45">
                                {tr(
                                    'Додайте фільм до списку «Буду дивитися» — ми нагадаємо, щойно він з’явиться.',
                                )}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] p-3">
                                <div className="flex gap-1">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => choose(tab.key)}
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
                                {providerPlayers.length > 1 && (
                                    <select
                                        value={player?.key}
                                        onChange={(e) =>
                                            setPlayerKey(e.target.value)
                                        }
                                        className="input-glass ml-auto h-10 max-w-full rounded-xl px-3 text-sm text-white [color-scheme:dark]"
                                        aria-label={tr('Озвучка')}
                                    >
                                        {providerPlayers.map((p) => (
                                            <option key={p.key} value={p.key}>
                                                {p.translation ??
                                                    tr('Оригінал')}
                                                {p.quality
                                                    ? ` · ${p.quality}`
                                                    : ''}
                                            </option>
                                        ))}
                                    </select>
                                )}
                                {providerPlayers.length === 1 &&
                                    player?.translation && (
                                        <span className="ml-auto text-xs text-white/45">
                                            {player.translation}
                                            {player.quality &&
                                                ` · ${player.quality}`}
                                        </span>
                                    )}
                            </div>
                            <div className="relative aspect-video bg-black">
                                <iframe
                                    key={
                                        provider === 'trailer'
                                            ? 'trailer'
                                            : player?.key
                                    }
                                    src={
                                        provider === 'trailer'
                                            ? (movie.trailer_url ?? '')
                                            : player?.link
                                    }
                                    title={movie.title}
                                    className="absolute inset-0 size-full"
                                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                                    allowFullScreen
                                    referrerPolicy="origin"
                                />
                            </div>
                        </>
                    )}
                </section>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
                    <div className="min-w-0 space-y-5">
                        {movie.description && (
                            <section className="glass rounded-3xl p-5">
                                <h2 className="mb-2 font-display text-lg font-semibold text-white">
                                    {tr('Про що')}
                                </h2>
                                <p className="text-[15px] leading-relaxed whitespace-pre-line text-white/75">
                                    {movie.description}
                                </p>
                            </section>
                        )}
                        <section className="glass rounded-3xl p-5">
                            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-white">
                                <MessageCircle className="size-5 text-gc-lilac-400" />
                                {tr('Обговорення')}
                                <span className="text-sm font-normal text-white/40">
                                    {commentsCount}
                                </span>
                            </h2>
                            {!movie.comments_enabled && (
                                <p className="mb-3 text-sm text-white/45">
                                    {tr('Коментарі до цього фільму вимкнено.')}
                                </p>
                            )}
                            <Comments
                                endpoint={`/cinema/${movie.slug}/comments`}
                                initial={comments}
                                total={commentsCount}
                                canComment={movie.comments_enabled}
                                onCountChange={setCommentsCount}
                                className={cn(
                                    comments.length === 0 && 'border-t-0 pt-0',
                                )}
                            />
                        </section>
                    </div>
                    <aside className="space-y-5">
                        <section className="glass rounded-3xl p-5">
                            <h2 className="mb-3 font-display text-sm font-semibold tracking-wide text-white/70 uppercase">
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
                                    {friends.total > friends.users.length && (
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
                    <PosterRow title={tr('Схоже')} movies={similar} />
                )}
            </div>

            <ShareMovieDialog
                movie={movie}
                description={movie.description}
                open={sharing}
                onOpenChange={setSharing}
            />
        </>
    );
}
