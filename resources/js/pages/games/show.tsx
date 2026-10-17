import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    BookOpen,
    Clapperboard,
    Building2,
    CalendarDays,
    Check,
    Clock,
    ExternalLink,
    Gamepad2,
    Globe,
    Images,
    Languages,
    Play,
    Plus,
    ShieldCheck,
    Star,
    Swords,
    Users,
    X,
} from 'lucide-react';
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { EventList, GameEventForm } from '@/components/events/event-card';
import type { CalendarEvent } from '@/components/events/event-card';
import { PlayingNow } from '@/components/gc/playing';
import { FollowButton } from '@/components/gc/follow-button';
import { PinButton } from '@/components/gc/pin-button';
import { SaveButton } from '@/components/gc/save-button';
import { cn } from '@/lib/utils';
import type { ClanCard, GameCard, UserCard } from '@/types';
import { GameCover } from './index';
import { LOCALE, tr } from '@/lib/i18n';
import { MomentCard } from '@/components/moments/moment-card';
import type { MomentCardData } from '@/components/moments/moment-card';
import { usePlugin } from '@/lib/plugins';

type Details = {
    summary?: string;
    storyline?: string;
    screenshots?: string[];
    artworks?: string[];
    videos?: { id: string; name: string }[];
    developers?: string[];
    publishers?: string[];
    engines?: string[];
    franchises?: string[];
    themes?: string[];
    perspectives?: string[];
    multiplayer?: {
        online_max?: number;
        offline_max?: number;
        online_coop_max?: number;
        offline_coop_max?: number;
        online_coop?: boolean;
        offline_coop?: boolean;
        lan?: boolean;
        campaign_coop?: boolean;
        split_screen?: boolean;
        drop_in?: boolean;
    };
    age_ratings?: string[];
    release_dates?: { platform: string; date: string | null }[];
    languages?: {
        name: string;
        audio: boolean;
        subtitles: boolean;
        interface: boolean;
    }[];
    websites?: { kind: string; label: string; url: string }[];
    ratings?: {
        critics?: number;
        critics_count?: number;
        players?: number;
        players_count?: number;
        total?: number;
        total_count?: number;
    };
    hypes?: number;
    time_to_beat?: { hastily?: number; normally?: number; completely?: number };
    igdb_url?: string;
};

type PosterPalette = {
    base: string;
    accent: string;
    soft: string;
    swatches: Record<string, string>;
} | null;

type Props = {
    palette?: PosterPalette;
    game: GameCard & {
        genres: string[];
        modes: { key: string; label: string }[];
        released: string | null;
        rating: number | null;
        links: { store: string; label: string; url: string }[];
        collections: string[];
        details: Details;
    };
    similar: GameCard[];
    clans: ClanCard[];
    features: Record<string, boolean>;
    playing_now: UserCard[];
    playing_count: number;
    events: CalendarEvent[];
    event_types: Record<string, string>;
    can_add_event: boolean;
    saved: boolean;
    following: boolean;
    pinned: boolean;
    steam_friends: UserCard[];
    can_curate: boolean;
    guides: {
        id: number;
        title: string;
        body: string;
        created_at: string;
        user: UserCard | null;
        mine: boolean;
    }[];
    moments?: MomentCardData[];
};

const STORE_STYLE: Record<string, string> = {
    steam: 'bg-[#1b2838] hover:bg-[#2a475e]',
    gplay: 'bg-[#01875f] hover:bg-[#03a374]',
    appstore: 'bg-[#0a84ff] hover:bg-[#3a9bff]',
    epic: 'bg-[#2a2a2a] hover:bg-[#3a3a3a]',
};

const date = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString(LOCALE) : '—';

function Section({
    title,
    icon: Icon,
    children,
}: {
    title: string;
    icon: typeof Users;
    children: ReactNode;
}) {
    return (
        <section className="glass mt-4 rounded-3xl p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
                <Icon className="size-4 text-gc-lilac-200" />
                <h2 className="font-display text-base font-semibold text-white">
                    {title}
                </h2>
            </div>
            {children}
        </section>
    );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="rounded-2xl bg-white/[0.03] p-3">
            <p className="text-xs tracking-wide text-white/40 uppercase">
                {label}
            </p>
            <p className="mt-0.5 text-sm text-white/85">{value}</p>
        </div>
    );
}

function Score({
    label,
    value,
    count,
}: {
    label: string;
    value?: number;
    count?: number;
}) {
    if (!value) return null;
    const tone =
        value >= 75
            ? 'text-emerald-300'
            : value >= 50
              ? 'text-amber-200'
              : 'text-rose-300';

    return (
        <div className="rounded-2xl bg-white/[0.03] p-3 text-center">
            <p className={cn('font-display text-2xl font-semibold', tone)}>
                {value}
            </p>
            <p className="text-xs text-white/55">{label}</p>
            {count ? (
                <p className="text-xs text-white/35">
                    {count} {tr('оцінок')}
                </p>
            ) : null}
        </div>
    );
}

function GuideForm({ slug }: { slug: string }) {
    const form = useForm({ title: '', body: '' });

    return (
        <form
            className="mb-4 space-y-2"
            onSubmit={(event) => {
                event.preventDefault();
                form.post(`/games/${slug}/guides`, {
                    preserveScroll: true,
                    onSuccess: () => form.reset(),
                });
            }}
        >
            <input
                value={form.data.title}
                maxLength={80}
                onChange={(event) => form.setData('title', event.target.value)}
                placeholder={tr('Назва гіда')}
                className="input-glass h-10 w-full rounded-xl px-3 text-sm text-white placeholder:text-white/30"
            />
            <textarea
                value={form.data.body}
                maxLength={5000}
                rows={4}
                onChange={(event) => form.setData('body', event.target.value)}
                placeholder={tr('Коротко: як почати, що зібрати, чого уникати')}
                className="input-glass w-full rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30"
            />
            <button
                type="submit"
                disabled={form.processing}
                className="btn-glow h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
            >
                {tr('Опублікувати гід')}
            </button>
        </form>
    );
}

/** Сторінка гри: опис, медіа, мультиплеєр, рейтинги, компанії, мови, магазини, спільнота й клани. */
/**
 * Акцент сайту на сторінці гри — з постера (свотчі Palette API, порахував сервер).
 * Змінні перевизначаються лише всередині сторінки, тож кнопки, мітки й посилання беруть колір гри.
 */
function paletteStyle(palette: PosterPalette): CSSProperties | undefined {
    if (!palette) return undefined;

    return {
        '--color-gc-blue': palette.accent,
        '--color-gc-indigo': palette.accent,
        '--color-gc-purple': palette.soft,
        '--color-gc-pink': palette.accent,
        '--color-gc-lilac-200': palette.soft,
        '--color-gc-lilac-300': palette.soft,
        '--color-gc-lilac-400': palette.accent,
        '--color-gc-lilac-500': palette.accent,
        '--primary': palette.accent,
        '--ring': palette.accent,
        '--gc-gradient': `linear-gradient(120deg, ${palette.accent}, ${palette.soft})`,
    } as CSSProperties;
}

/** Матове «рідке скло» для кнопок під постером. */
const POSTER_GLASS =
    'h-10 rounded-xl border-gc-lilac-400/35 bg-gc-indigo/[0.14] px-3.5 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18)] backdrop-blur-xl backdrop-saturate-150 hover:bg-gc-indigo/25';

export default function GameShow({
    palette = null,
    game,
    similar,
    clans,
    features,
    playing_now,
    playing_count,
    events,
    event_types,
    can_add_event,
    saved,
    following,
    pinned,
    guides,
    steam_friends,
    can_curate,
    moments = [],
}: Props) {
    const d = game.details ?? {};
    const guidesOn = usePlugin('game_guides');
    const [video, setVideo] = useState<string | null>(null);
    const [shot, setShot] = useState<string | null>(null);
    const mp = d.multiplayer ?? {};
    const mpFacts: [string, string][] = [
        ...(mp.online_max
            ? [
                  [
                      tr('Онлайн'),
                      tr('до {online_max} гравців', {
                          online_max: mp.online_max,
                      }),
                  ] as [string, string],
              ]
            : []),
        ...(mp.online_coop_max
            ? [
                  [
                      tr('Онлайн-кооператив'),
                      tr('до {online_coop_max}', {
                          online_coop_max: mp.online_coop_max,
                      }),
                  ] as [string, string],
              ]
            : []),
        ...(mp.offline_max
            ? [
                  [
                      tr('На одному пристрої'),
                      tr('до {offline_max}', { offline_max: mp.offline_max }),
                  ] as [string, string],
              ]
            : []),
        ...(mp.offline_coop_max
            ? [
                  [
                      tr('Локальний кооператив'),
                      tr('до {offline_coop_max}', {
                          offline_coop_max: mp.offline_coop_max,
                      }),
                  ] as [string, string],
              ]
            : []),
    ];
    const mpFlags = [
        mp.online_coop && tr('Онлайн-кооператив'),
        mp.offline_coop && tr('Локальний кооператив'),
        mp.campaign_coop && tr('Сюжет у кооперативі'),
        mp.lan && 'LAN',
        mp.split_screen && tr('Розділений екран'),
        mp.drop_in && tr('Вхід посеред гри'),
    ].filter(Boolean) as string[];
    const ua = d.languages?.find((l) => l.name === 'Українська');
    const beat = d.time_to_beat;

    return (
        <div className="relative isolate" style={paletteStyle(palette)}>
            {palette && (
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-[-12px] -top-6 -z-10 h-[620px] opacity-70 blur-3xl"
                    style={{
                        background: `radial-gradient(60% 55% at 25% 25%, ${palette.accent}66, transparent 70%), radial-gradient(55% 50% at 85% 45%, ${palette.soft}33, transparent 75%)`,
                    }}
                />
            )}
            <Head title={game.name} />
            <Link
                href="/games"
                className="mb-3 inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white"
            >
                <ArrowLeft className="size-4" /> {tr('Каталог ігор')}
            </Link>
            <div
                className="glass overflow-hidden rounded-3xl"
                style={
                    palette
                        ? {
                              backgroundImage: `linear-gradient(to bottom, ${palette.base}e6, ${palette.accent}26 360px, transparent 760px)`,
                          }
                        : undefined
                }
            >
                <div className="relative flex min-h-[300px] flex-col justify-start overflow-hidden sm:min-h-[340px]">
                    <div
                        className="absolute inset-0 [mask-image:linear-gradient(to_bottom,black_45%,transparent)]"
                        aria-hidden
                    >
                        {d.artworks?.[0] ? (
                            <img
                                src={d.artworks[0]}
                                alt=""
                                className="size-full object-cover"
                            />
                        ) : (
                            <GameCover game={game} />
                        )}
                    </div>
                    <div className="scrim scrim-top scrim-dark absolute inset-x-0 top-0 h-2/3" />
                    <div className="relative space-y-3 p-4 sm:p-6">
                        <h1 className="font-display text-[28px] leading-[1.1] font-bold tracking-tight break-words text-white drop-shadow-[0_2px_12px_rgb(0_0_0/0.6)] sm:text-4xl">
                            {game.name}
                        </h1>
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-white/85">
                            {game.released && (
                                <span>{game.released.slice(0, 4)}</span>
                            )}
                            {game.platforms.length > 0 && (
                                <span>
                                    {game.platforms
                                        .map((p) => p.label)
                                        .join(' · ')}
                                </span>
                            )}
                            {game.rating ? (
                                <span className="inline-flex items-center gap-1">
                                    <Star className="size-3.5 fill-amber-300 text-amber-300" />
                                    {game.rating.toFixed(1)}
                                </span>
                            ) : null}
                        </p>
                        {(d.age_ratings?.length ?? 0) > 0 && (
                            <p className="flex flex-wrap gap-1.5">
                                {d.age_ratings?.map((a) => (
                                    <span
                                        key={a}
                                        className="rounded-md border border-white/30 bg-black/20 px-1.5 py-0.5 text-xs font-medium text-white/85 backdrop-blur-md"
                                    >
                                        {a}
                                    </span>
                                ))}
                            </p>
                        )}
                    </div>
                </div>
                <div className="space-y-4 p-4 sm:p-5">
                    <div className="flex flex-wrap gap-2">
                        <FollowButton
                            kind="game"
                            id={game.id}
                            following={following}
                            className={POSTER_GLASS}
                        />
                        <PinButton
                            kind="game"
                            id={game.id}
                            pinned={pinned}
                            className={POSTER_GLASS}
                        />
                        <SaveButton
                            kind="game"
                            id={game.id}
                            saved={saved}
                            className={POSTER_GLASS}
                        />
                    </div>
                    {(game.modes.length > 0 || game.genres.length > 0) && (
                        <div className="flex flex-wrap gap-1.5">
                            {game.modes.map((m) => (
                                <Link
                                    key={m.key}
                                    href={`/games?mode=${m.key}`}
                                    className="rounded-lg bg-gc-indigo/20 px-2.5 py-1 text-xs text-gc-lilac-200 hover:bg-gc-indigo/30"
                                >
                                    {m.label}
                                </Link>
                            ))}
                            {game.genres.map((g) => (
                                <Link
                                    key={g}
                                    href={`/games?genre=${encodeURIComponent(g)}`}
                                    className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs text-white/70 hover:bg-white/10"
                                >
                                    {g}
                                </Link>
                            ))}
                        </div>
                    )}
                    {d.summary && (
                        <p className="text-sm whitespace-pre-line text-white/75">
                            {d.summary}
                        </p>
                    )}
                    {game.links.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {game.links.map((l) => (
                                <a
                                    key={l.store + l.url}
                                    href={l.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={cn(
                                        'inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition',
                                        STORE_STYLE[l.store] ??
                                            'bg-white/[0.08] hover:bg-white/15',
                                    )}
                                >
                                    {l.label}{' '}
                                    <ExternalLink className="size-4 opacity-70" />
                                </a>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-white/45">
                            {tr(
                                'Посилання на магазини з’являться після наступного оновлення каталогу.',
                            )}
                        </p>
                    )}
                </div>
            </div>

            <div className="mt-4">
                <PlayingNow users={playing_now} count={playing_count} />
            </div>

            {(steam_friends.length > 0 || can_curate) && (
                <section className="glass mt-4 space-y-3 rounded-3xl p-4 sm:p-5">
                    {steam_friends.length > 0 && (
                        <div>
                            <h2 className="font-display text-base font-semibold text-white">
                                {tr('Друзі з цією грою в Steam')}
                            </h2>
                            <p className="mt-2 text-sm text-white/70">
                                {steam_friends
                                    .map((friend) => friend.name)
                                    .join(', ')}
                            </p>
                        </div>
                    )}
                    {can_curate && (
                        <form
                            className="flex flex-wrap gap-3 text-sm text-white/80"
                            onSubmit={(event) => {
                                event.preventDefault();
                                const data = new FormData(event.currentTarget);
                                router.post(`/games/${game.slug}/collections`, {
                                    duo: data.get('duo') === 'on',
                                    evening: data.get('evening') === 'on',
                                });
                            }}
                        >
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    name="duo"
                                    defaultChecked={game.collections.includes(
                                        'duo',
                                    )}
                                />
                                {tr('На двох')}
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    name="evening"
                                    defaultChecked={game.collections.includes(
                                        'evening',
                                    )}
                                />
                                {tr('На вечір')}
                            </label>
                            <button
                                type="submit"
                                className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-black"
                            >
                                {tr('Зберегти добірку')}
                            </button>
                        </form>
                    )}
                </section>
            )}

            {(events.length > 0 || can_add_event) && (
                <section className="glass mt-4 rounded-3xl p-4 sm:p-5">
                    <div className="mb-3 flex items-center gap-2">
                        <CalendarDays className="size-4 text-gc-lilac-200" />
                        <h2 className="flex-1 font-display text-base font-semibold text-white">
                            {tr('Події гри')}
                        </h2>
                        <Link
                            href="/events?kind=game"
                            className="text-sm text-gc-lilac-200 hover:text-white"
                        >
                            {tr('Календар')}
                        </Link>
                    </div>
                    {events.length === 0 ? (
                        <p className="text-sm text-white/45">
                            {tr('Найближчих подій немає.')}
                        </p>
                    ) : (
                        <EventList events={events} />
                    )}
                    {can_add_event && (
                        <details className="mt-4 rounded-2xl bg-white/[0.03] p-3">
                            <summary className="cursor-pointer text-sm font-semibold text-white/80">
                                {tr('Нова подія гри')}
                            </summary>
                            <div className="mt-3">
                                <GameEventForm
                                    gameSlug={game.slug}
                                    types={event_types}
                                />
                            </div>
                        </details>
                    )}
                </section>
            )}

            {(d.videos?.length || d.screenshots?.length) && (
                <Section title={tr('Трейлери й скриншоти')} icon={Images}>
                    <div className="flex [scrollbar-width:thin] gap-2 overflow-x-auto pb-1">
                        {d.videos?.map((v) => (
                            <button
                                key={v.id}
                                type="button"
                                onClick={() => setVideo(v.id)}
                                className="group relative h-32 w-56 shrink-0 overflow-hidden rounded-2xl bg-black"
                                title={v.name}
                            >
                                <img
                                    src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`}
                                    alt=""
                                    loading="lazy"
                                    className="size-full object-cover opacity-80 transition group-hover:opacity-100"
                                />
                                <span className="absolute inset-0 flex items-center justify-center">
                                    <span className="flex size-11 items-center justify-center rounded-full bg-black/60">
                                        <Play className="size-5 fill-white text-white" />
                                    </span>
                                </span>
                                <span className="absolute inset-x-2 bottom-1.5 truncate text-left text-xs text-white/85">
                                    {v.name}
                                </span>
                            </button>
                        ))}
                        {d.screenshots?.map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => setShot(s)}
                                className="h-32 w-56 shrink-0 overflow-hidden rounded-2xl bg-black"
                            >
                                <img
                                    src={s}
                                    alt=""
                                    loading="lazy"
                                    className="size-full object-cover"
                                />
                            </button>
                        ))}
                    </div>
                </Section>
            )}

            {(mpFacts.length > 0 || mpFlags.length > 0) && (
                <Section title={tr('Мультиплеєр')} icon={Users}>
                    {mpFacts.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {mpFacts.map(([label, value]) => (
                                <Fact key={label} label={label} value={value} />
                            ))}
                        </div>
                    )}
                    {mpFlags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {mpFlags.map((f) => (
                                <span
                                    key={f}
                                    className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-200"
                                >
                                    {f}
                                </span>
                            ))}
                        </div>
                    )}
                </Section>
            )}

            {d.ratings &&
                (d.ratings.critics || d.ratings.players || d.ratings.total) && (
                    <Section title={tr('Рейтинги')} icon={Star}>
                        <div className="grid grid-cols-3 gap-2">
                            <Score
                                label={tr('Загальний')}
                                value={d.ratings.total}
                                count={d.ratings.total_count}
                            />
                            <Score
                                label={tr('Критики')}
                                value={d.ratings.critics}
                                count={d.ratings.critics_count}
                            />
                            <Score
                                label={tr('Гравці')}
                                value={d.ratings.players}
                                count={d.ratings.players_count}
                            />
                        </div>
                    </Section>
                )}

            <Section title={tr('Про гру')} icon={Gamepad2}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {d.developers?.length ? (
                        <Fact
                            label={tr('Розробник')}
                            value={d.developers.join(', ')}
                        />
                    ) : null}
                    {d.publishers?.length ? (
                        <Fact
                            label={tr('Видавець')}
                            value={d.publishers.join(', ')}
                        />
                    ) : null}
                    {game.released && (
                        <Fact label={tr('Вихід')} value={date(game.released)} />
                    )}
                    {d.engines?.length ? (
                        <Fact
                            label={tr('Рушій')}
                            value={d.engines.join(', ')}
                        />
                    ) : null}
                    {d.franchises?.length ? (
                        <Fact
                            label={tr('Серія')}
                            value={d.franchises.join(', ')}
                        />
                    ) : null}
                    {d.perspectives?.length ? (
                        <Fact
                            label={tr('Камера')}
                            value={d.perspectives.join(', ')}
                        />
                    ) : null}
                    {d.themes?.length ? (
                        <Fact label={tr('Теми')} value={d.themes.join(', ')} />
                    ) : null}
                    {beat && (beat.normally || beat.hastily) ? (
                        <Fact
                            label={tr('Проходження')}
                            value={
                                <span className="inline-flex items-center gap-1">
                                    <Clock className="size-3.5" />
                                    {[
                                        beat.hastily &&
                                            tr('швидко {hastily} год', {
                                                hastily: beat.hastily,
                                            }),
                                        beat.normally &&
                                            tr('зазвичай {normally} год', {
                                                normally: beat.normally,
                                            }),
                                        beat.completely &&
                                            tr('на 100% {completely} год', {
                                                completely: beat.completely,
                                            }),
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </span>
                            }
                        />
                    ) : null}
                    {d.hypes ? (
                        <Fact
                            label={tr('Очікують')}
                            value={tr('{hypes} гравців', { hypes: d.hypes })}
                        />
                    ) : null}
                </div>
                {d.storyline && (
                    <details className="mt-3 rounded-2xl bg-white/[0.03] p-3 text-sm text-white/70">
                        <summary className="flex cursor-pointer items-center gap-1.5 text-white/85">
                            <BookOpen className="size-4" /> {tr('Сюжет')}
                        </summary>
                        <p className="mt-2 whitespace-pre-line">
                            {d.storyline}
                        </p>
                    </details>
                )}
            </Section>

            {d.release_dates && d.release_dates.length > 1 && (
                <Section title={tr('Дати виходу')} icon={CalendarDays}>
                    <div className="flex flex-wrap gap-2">
                        {d.release_dates.map((r) => (
                            <span
                                key={r.platform}
                                className="rounded-xl bg-white/[0.04] px-3 py-1.5 text-sm text-white/75"
                            >
                                {r.platform}:{' '}
                                <span className="text-white">
                                    {date(r.date)}
                                </span>
                            </span>
                        ))}
                    </div>
                </Section>
            )}

            {d.languages && d.languages.length > 0 && (
                <Section title={tr('Мови')} icon={Languages}>
                    <p
                        className={cn(
                            'mb-3 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm',
                            ua
                                ? 'bg-emerald-500/15 text-emerald-200'
                                : 'bg-white/[0.04] text-white/55',
                        )}
                    >
                        <ShieldCheck className="size-4" />
                        {ua
                            ? tr('Українська: {v}', {
                                  v:
                                      [
                                          ua.interface && tr('інтерфейс'),
                                          ua.subtitles && tr('субтитри'),
                                          ua.audio && tr('озвучення'),
                                      ]
                                          .filter(Boolean)
                                          .join(', ') || tr('є'),
                              })
                            : tr('Української локалізації немає')}
                    </p>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[420px] text-xs">
                            <thead>
                                <tr className="text-white/40">
                                    <th className="py-1.5 text-left font-medium">
                                        {tr('Мова')}
                                    </th>
                                    <th className="font-medium">
                                        {tr('Інтерфейс')}
                                    </th>
                                    <th className="font-medium">
                                        {tr('Субтитри')}
                                    </th>
                                    <th className="font-medium">
                                        {tr('Озвучення')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {d.languages.map((l) => (
                                    <tr
                                        key={l.name}
                                        className="border-t border-white/[0.05] text-white/70"
                                    >
                                        <td className="py-1.5">{l.name}</td>
                                        {(
                                            [
                                                'interface',
                                                'subtitles',
                                                'audio',
                                            ] as const
                                        ).map((k) => (
                                            <td key={k} className="text-center">
                                                {l[k] ? (
                                                    <Check
                                                        className="mx-auto size-4 text-emerald-300"
                                                        aria-label={tr('Так')}
                                                    />
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Section>
            )}

            {moments.length > 0 && (
                <Section title={tr('Моменти')} icon={Clapperboard}>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {moments.map((moment) => (
                            <MomentCard key={moment.id} moment={moment} />
                        ))}
                    </div>
                    <Link
                        href={`/moments?game=${game.slug}`}
                        className="mt-4 inline-flex text-sm font-medium text-gc-lilac-300 hover:text-white"
                    >
                        {tr('Усі моменти гри →')}
                    </Link>
                </Section>
            )}

            {guidesOn && (
                <Section title={tr('Гіди')} icon={BookOpen}>
                    <GuideForm slug={game.slug} />
                    {guides.length === 0 ? (
                        <p className="text-sm text-white/45">
                            {tr('Гідів ще немає. Напишіть перший.')}
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {guides.map((guide) => (
                                <article
                                    key={guide.id}
                                    className="rounded-2xl bg-white/[0.04] p-4"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-semibold text-white">
                                                {guide.title}
                                            </h3>
                                            {guide.user && (
                                                <Link
                                                    href={`/${guide.user.username}`}
                                                    className="text-xs text-white/45 hover:text-white"
                                                >
                                                    {guide.user.name}
                                                </Link>
                                            )}
                                            <p className="mt-2 text-sm whitespace-pre-line text-white/75">
                                                {guide.body}
                                            </p>
                                        </div>
                                        {guide.mine && (
                                            <button
                                                type="button"
                                                className="text-xs text-rose-200 hover:text-rose-100"
                                                onClick={() =>
                                                    router.delete(
                                                        `/games/${game.slug}/guides/${guide.id}`,
                                                    )
                                                }
                                            >
                                                {tr('Видалити')}
                                            </button>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </Section>
            )}

            {(d.websites?.length || d.igdb_url) && (
                <Section title={tr('Спільнота й посилання')} icon={Globe}>
                    <div className="flex flex-wrap gap-2">
                        {d.websites?.map((w) => (
                            <a
                                key={w.kind}
                                href={w.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-sm text-white/80 hover:bg-white/10"
                            >
                                {w.label}{' '}
                                <ExternalLink className="size-3.5 opacity-60" />
                            </a>
                        ))}
                        {d.igdb_url && (
                            <a
                                href={d.igdb_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-sm text-white/80 hover:bg-white/10"
                            >
                                IGDB{' '}
                                <ExternalLink className="size-3.5 opacity-60" />
                            </a>
                        )}
                    </div>
                </Section>
            )}

            {features.clans !== false && (
                <section className="glass mt-4 rounded-3xl p-4 sm:p-5">
                    <div className="mb-3 flex items-center gap-2">
                        <Swords className="size-4 text-gc-lilac-200" />
                        <h2 className="flex-1 font-display text-base font-semibold text-white">
                            {tr('Клани й гільдії')}
                        </h2>
                        <Link
                            href={`/clans/create?game=${game.slug}`}
                            className="btn-glow inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold"
                        >
                            <Plus className="size-4" /> {tr('Створити')}
                        </Link>
                    </div>
                    {clans.length === 0 ? (
                        <p className="text-sm text-white/45">
                            {tr(
                                'Ще немає жодного клану для цієї гри — створіть перший.',
                            )}
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {clans.map((c) => (
                                <Link
                                    key={c.id}
                                    href={`/clans/${c.slug}`}
                                    className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3 transition hover:bg-white/[0.06]"
                                >
                                    <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 text-sm font-bold text-white">
                                        {c.logo_url ? (
                                            <img
                                                src={c.logo_url}
                                                alt=""
                                                className="size-full object-cover"
                                            />
                                        ) : (
                                            c.tag
                                        )}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold text-white">
                                            {c.display_name}
                                        </span>
                                        <span className="flex items-center gap-1 text-xs text-white/45">
                                            <Users className="size-3.5" />{' '}
                                            {c.members_count}
                                            {c.is_recruiting && (
                                                <span className="ml-2 text-emerald-300">
                                                    {tr('набір відкрито')}
                                                </span>
                                            )}
                                        </span>
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {similar.length > 0 && (
                <Section title={tr('Схожі ігри')} icon={Building2}>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {similar.map((g) => (
                            <Link
                                key={g.id}
                                href={`/games/${g.slug}`}
                                className="overflow-hidden rounded-2xl bg-white/[0.03] transition hover:bg-white/[0.06]"
                            >
                                <span className="block aspect-[16/9] overflow-hidden">
                                    <GameCover game={g} />
                                </span>
                                <span className="block truncate px-2.5 py-2 text-sm text-white">
                                    {g.name}
                                </span>
                            </Link>
                        ))}
                    </div>
                </Section>
            )}

            {(video || shot) && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
                    onClick={() => {
                        setVideo(null);
                        setShot(null);
                    }}
                >
                    <button
                        type="button"
                        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white"
                        aria-label={tr('Закрити')}
                    >
                        <X className="size-5" />
                    </button>
                    {video ? (
                        <iframe
                            src={`https://www.youtube-nocookie.com/embed/${video}?autoplay=1`}
                            title={tr('Трейлер')}
                            allow="autoplay; encrypted-media; fullscreen"
                            allowFullScreen
                            className="aspect-video w-full max-w-4xl rounded-2xl"
                        />
                    ) : (
                        <img
                            src={shot!.replace('t_screenshot_big', 't_1080p')}
                            alt=""
                            className="max-h-full max-w-full rounded-2xl"
                        />
                    )}
                </div>
            )}
        </div>
    );
}
