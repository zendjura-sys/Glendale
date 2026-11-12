import { Link, usePage } from '@inertiajs/react';
import {
    History,
    Clapperboard,
    Gamepad2,
    PenLine,
    Gift,
    ListMusic,
    Play,
    Podcast,
    Sparkles,
    Ticket,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { playQueue, usePlayer } from '@/lib/player';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';
import type { MovieCard } from '@/types/cinema';
import type { TrackCard } from '@/types/music';

type Giveaway = {
    id: number;
    title: string;
    store_label: string;
    worth: string | null;
    image: string | null;
    url: string;
    ends_at: string | null;
};

type Show = {
    id: number;
    title: string;
    topics: string[];
    listeners: number;
    host: UserCard | null;
};

export type ContinueItem = {
    kind: 'movie' | 'track' | 'game' | 'draft';
    title: string;
    hint: string;
    href: string;
    image: string | null;
    track?: TrackCard | null;
};

export type SideWidgetsData = {
    continue?: ContinueItem[];
    music: { mode: 'recent' | 'new'; tracks: TrackCard[] } | null;
    cinema: {
        ai: boolean;
        items: (MovieCard & { why: string | null })[];
    } | null;
    giveaways: Giveaway[] | null;
    gamecast: { live: number; listeners: number; shows: Show[] } | null;
};

let cache: SideWidgetsData | null = null;
let pending: Promise<SideWidgetsData> | null = null;
let loadedAt = 0;

/**
 * Дані віджетів: один спільний запит для всіх колонок (дані живуть хвилину між переходами).
 * enabled=false — не вантажимо, поки місце для віджетів не видно на цьому екрані.
 */
export function useSideWidgets(enabled = true): SideWidgetsData | null {
    const [data, setData] = useState<SideWidgetsData | null>(cache);
    useEffect(() => {
        if (!enabled) return;
        if (!pending || Date.now() - loadedAt > 60_000) {
            loadedAt = Date.now();
            pending = api<SideWidgetsData>('GET', '/feed/widgets').then((d) => {
                cache = d;

                return d;
            });
            pending.catch(() => {
                pending = null;
            });
        }
        let alive = true;
        pending.then((d) => alive && setData(d)).catch(() => undefined);

        return () => {
            alive = false;
        };
    }, [enabled]);

    return data;
}

/** Чи підходить ширина екрана (для колонок віджетів, що видно лише на певних ширинах). */
export function useMedia(query: string): boolean {
    const [match, setMatch] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia(query);
        const sync = () => setMatch(mq.matches);
        sync();
        mq.addEventListener('change', sync);

        return () => mq.removeEventListener('change', sync);
    }, [query]);

    return match;
}

function Card({
    icon: Icon,
    title,
    tone,
    href,
    aside,
    children,
    index,
}: {
    icon: typeof Gift;
    title: string;
    tone: string;
    href: string;
    aside?: React.ReactNode;
    children: React.ReactNode;
    index: number;
}) {
    const reduce = useReducedMotion();

    return (
        <motion.section
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : index * 0.05 }}
            className="gc-solid rounded-2xl p-4"
        >
            <div className="mb-3 flex items-center gap-2">
                <Icon className={cn('size-5 shrink-0', tone)} />
                <Link
                    href={href}
                    className="min-w-0 flex-1 truncate font-display text-[15px] font-bold text-white hover:underline"
                >
                    {title}
                </Link>
                {aside}
            </div>
            {children}
        </motion.section>
    );
}

function MusicCard({
    data,
    index,
}: {
    data: NonNullable<SideWidgetsData['music']>;
    index: number;
}) {
    const player = usePlayer();
    if (data.tracks.length === 0) return null;

    return (
        <Card
            icon={ListMusic}
            tone="text-sky-400"
            title={
                data.mode === 'recent'
                    ? tr('Продовжити слухати')
                    : tr('Нове в музиці')
            }
            href="/music"
            index={index}
        >
            <ul className="space-y-1">
                {data.tracks.map((t, i) => {
                    const current = player.current?.key === t.key;

                    return (
                        <li key={t.key}>
                            <button
                                type="button"
                                onClick={() =>
                                    playQueue(data.tracks, i, {
                                        label: tr('Віджет музики'),
                                        href: '/music',
                                    })
                                }
                                className={cn(
                                    'group flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition hover:bg-white/[0.05]',
                                    current && 'bg-white/[0.06]',
                                )}
                            >
                                <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-white/[0.06]">
                                    {t.cover_url && (
                                        <img
                                            src={t.cover_url}
                                            alt=""
                                            loading="lazy"
                                            onError={(e) => {
                                                e.currentTarget.style.display =
                                                    'none';
                                            }}
                                            className="size-full object-cover"
                                        />
                                    )}
                                    <span className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition group-hover:opacity-100">
                                        <Play className="size-4 fill-white text-white" />
                                    </span>
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span
                                        className={cn(
                                            'block truncate text-sm font-semibold',
                                            current
                                                ? 'text-sky-300'
                                                : 'text-white',
                                        )}
                                    >
                                        {t.title}
                                    </span>
                                    <span className="block truncate text-xs text-white/50">
                                        {t.artist}
                                    </span>
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </Card>
    );
}

function CinemaCard({
    data,
    index,
}: {
    data: NonNullable<SideWidgetsData['cinema']>;
    index: number;
}) {
    if (data.items.length === 0) return null;

    return (
        <Card
            icon={Sparkles}
            tone="text-violet-300"
            title={tr('Що подивитися')}
            href="/cinema"
            index={index}
            aside={
                <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-semibold text-white/55">
                    {data.ai ? tr('Підібрав ШІ') : tr('За вашим смаком')}
                </span>
            }
        >
            <div className="grid grid-cols-2 gap-2.5">
                {data.items.map((m) => (
                    <Link key={m.id} href={m.href} className="group min-w-0">
                        <span className="block aspect-[2/3] overflow-hidden rounded-xl bg-white/[0.06]">
                            {m.poster && (
                                <img
                                    src={m.poster}
                                    alt=""
                                    loading="lazy"
                                    className="size-full object-cover transition group-hover:scale-[1.03]"
                                />
                            )}
                        </span>
                        <span className="mt-1.5 block truncate text-[13px] font-semibold text-white">
                            {m.title}
                        </span>
                        <span className="block truncate text-[11px] text-white/45">
                            {m.why
                                ? m.why
                                : [m.type_label, m.year]
                                      .filter(Boolean)
                                      .join(' · ')}
                        </span>
                    </Link>
                ))}
            </div>
        </Card>
    );
}

function GiveawaysCard({ items, index }: { items: Giveaway[]; index: number }) {
    if (items.length === 0) return null;

    return (
        <Card
            icon={Gift}
            tone="text-emerald-400"
            title={tr('Роздачі ігор')}
            href="/games/deals"
            index={index}
        >
            <ul className="space-y-2">
                {items.map((g) => (
                    <li key={g.id}>
                        <a
                            href={g.url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-white/[0.05]"
                        >
                            <span className="h-11 w-20 shrink-0 overflow-hidden rounded-lg bg-white/[0.06]">
                                {g.image && (
                                    <img
                                        src={g.image}
                                        alt=""
                                        loading="lazy"
                                        className="size-full object-cover"
                                    />
                                )}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-white">
                                    {g.title}
                                </span>
                                <span className="flex items-center gap-1.5 truncate text-xs whitespace-nowrap text-white/50">
                                    <Ticket className="size-3" />
                                    {g.store_label}
                                    {g.worth && (
                                        <s className="text-white/35">
                                            {g.worth}
                                        </s>
                                    )}
                                    <span className="font-semibold text-emerald-400">
                                        {tr('Безкоштовно')}
                                    </span>
                                </span>
                            </span>
                        </a>
                    </li>
                ))}
            </ul>
        </Card>
    );
}

function GameCastCard({
    data,
    index,
}: {
    data: NonNullable<SideWidgetsData['gamecast']>;
    index: number;
}) {
    return (
        <Card
            icon={Podcast}
            tone={data.live > 0 ? 'text-rose-400' : 'text-sky-400'}
            title="GameCast"
            href="/shows"
            index={index}
            aside={
                data.live > 0 ? (
                    <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-rose-300">
                        <span className="size-1.5 rounded-full bg-rose-500" />
                        {tr('{n} в ефірі', { n: data.live })}
                    </span>
                ) : undefined
            }
        >
            {data.shows.length === 0 ? (
                <Link
                    href="/shows"
                    className="block rounded-xl bg-white/[0.04] p-3 text-sm text-white/60 transition hover:bg-white/[0.07] hover:text-white"
                >
                    {tr('Зараз тихо — почніть першу розмову')}
                </Link>
            ) : (
                <ul className="space-y-2">
                    {data.shows.map((s) => (
                        <li key={s.id}>
                            <Link
                                href={`/shows/${s.id}`}
                                className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2.5 transition hover:bg-white/[0.07]"
                            >
                                {s.host && (
                                    <UserAvatar user={s.host} size="sm" />
                                )}
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-white">
                                        {s.title}
                                    </span>
                                    <span className="block truncate text-xs text-white/50">
                                        {s.topics.length > 0
                                            ? s.topics
                                                  .map((t) => `#${t}`)
                                                  .join(' ')
                                            : s.host?.name}
                                    </span>
                                </span>
                                <span className="shrink-0 text-xs text-white/50 tabular-nums">
                                    {tr('{n} слух.', { n: s.listeners })}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}

/** Порядок віджетів; нові додаються сюди — і самі заповнюють вільні колонки. */
export const WIDGET_ORDER = [
    'continue',
    'gamecast',
    'music',
    'cinema',
    'giveaways',
] as const;
export type WidgetKey = (typeof WIDGET_ORDER)[number];

function ContinueCard({
    items,
    index,
}: {
    items: ContinueItem[];
    index: number;
}) {
    if (items.length === 0) return null;

    return (
        <Card
            icon={History}
            tone="text-sky-400"
            title={tr('Продовжити')}
            href="/feed"
            index={index}
        >
            <ContinueList items={items} />
        </Card>
    );
}

const KIND_ICON = {
    movie: Clapperboard,
    track: ListMusic,
    game: Gamepad2,
    draft: PenLine,
} as const;

/** Пункти «Продовжити»: обкладинка, назва й де зупинились; пісня вмикається одразу. */
export function ContinueList({
    items,
    horizontal = false,
}: {
    items: ContinueItem[];
    horizontal?: boolean;
}) {
    return (
        <ul
            className={
                horizontal
                    ? 'flex [scrollbar-width:none] gap-2.5 overflow-x-auto'
                    : 'space-y-1'
            }
        >
            {items.map((item, i) => {
                const Icon = KIND_ICON[item.kind];
                const body = (
                    <>
                        <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/[0.06] text-white/50">
                            {item.image ? (
                                <img
                                    src={item.image}
                                    alt=""
                                    loading="lazy"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                    }}
                                    className="absolute inset-0 size-full object-cover"
                                />
                            ) : null}
                            <Icon className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-white">
                                {item.title}
                            </span>
                            <span className="block truncate text-xs text-white/50">
                                {tr(item.hint)}
                            </span>
                        </span>
                    </>
                );
                const cls = cn(
                    'flex items-center gap-3 rounded-xl p-1.5 text-left transition hover:bg-white/[0.05]',
                    horizontal && 'gc-solid w-60 shrink-0 p-2.5',
                );

                return (
                    <li key={`${item.kind}-${i}`}>
                        {item.kind === 'track' && item.track ? (
                            <button
                                type="button"
                                onClick={() =>
                                    playQueue([item.track!], 0, {
                                        label: tr('Продовжити'),
                                        href: '/music',
                                    })
                                }
                                className={cn(cls, 'w-full')}
                            >
                                {body}
                            </button>
                        ) : (
                            <Link href={item.href} className={cls}>
                                {body}
                            </Link>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

/**
 * Віджети ПК: «Продовжити», GameCast, музика, «Що подивитися» (ШІ або за смаком), роздачі.
 * only — які саме показати (щоб розкласти по колонках); без нього — усі по порядку.
 */
export function SideWidgets({
    data,
    className,
    only,
}: {
    data: SideWidgetsData | null;
    className?: string;
    only?: readonly WidgetKey[];
}) {
    if (!data) return null;
    const keys = only ?? WIDGET_ORDER;

    return (
        <div className={className}>
            {keys.map((key, i) => {
                switch (key) {
                    case 'continue':
                        return data.continue && data.continue.length > 0 ? (
                            <ContinueCard
                                key={key}
                                items={data.continue}
                                index={i}
                            />
                        ) : null;
                    case 'gamecast':
                        return data.gamecast ? (
                            <GameCastCard
                                key={key}
                                data={data.gamecast}
                                index={i}
                            />
                        ) : null;
                    case 'music':
                        return data.music ? (
                            <MusicCard key={key} data={data.music} index={i} />
                        ) : null;
                    case 'cinema':
                        return data.cinema ? (
                            <CinemaCard
                                key={key}
                                data={data.cinema}
                                index={i}
                            />
                        ) : null;
                    case 'giveaways':
                        return data.giveaways ? (
                            <GiveawaysCard
                                key={key}
                                items={data.giveaways}
                                index={i}
                            />
                        ) : null;
                    default:
                        return null;
                }
            })}
        </div>
    );
}

/** Без «Продовжити» — у стрічці воно вже стоїть угорі окремим блоком. */
const exceptContinue = (onFeed: boolean): readonly WidgetKey[] =>
    onFeed ? WIDGET_ORDER.filter((k) => k !== 'continue') : WIDGET_ORDER;

/**
 * Дві колонки (планшет і невеликий ПК, 768–1279): віджети в лівій колонці під «Офіційним застосунком».
 * На ширших екранах тут нічого — віджети в третій (і четвертій) колонці.
 */
export function DockWidgets() {
    const { url } = usePage();
    const on = useMedia('(min-width: 768px) and (max-width: 1279px)');
    const data = useSideWidgets(on);
    if (!on) return null;

    return (
        <SideWidgets
            data={data}
            only={exceptContinue(url.startsWith('/feed'))}
            className="mt-1 space-y-3"
        />
    );
}

/**
 * Четверта колонка (2400+): у стрічці — друга половина віджетів (перша — у третій колонці),
 * на інших сторінках третьої колонки немає, тож тут усі віджети.
 */
export function RailWidgets() {
    const { url } = usePage();
    const on = useMedia('(min-width: 2400px)');
    const data = useSideWidgets(on);
    if (!on) return null;
    const onFeed = url.startsWith('/feed');

    return (
        <SideWidgets
            data={data}
            only={onFeed ? (['cinema', 'giveaways'] as const) : WIDGET_ORDER}
            className="space-y-4"
        />
    );
}

/** Третя колонка стрічки: на 3 колонках — усі віджети, на 4 — перша половина. */
export function FeedColumnWidgets({ data }: { data: SideWidgetsData | null }) {
    const four = useMedia('(min-width: 2400px)');

    return (
        <SideWidgets
            data={data}
            only={
                four ? (['gamecast', 'music'] as const) : exceptContinue(true)
            }
            className="space-y-4"
        />
    );
}
