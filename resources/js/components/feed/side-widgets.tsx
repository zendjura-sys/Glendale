import { Link } from '@inertiajs/react';
import { Gift, ListMusic, Play, Podcast, Sparkles, Ticket } from 'lucide-react';
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

export type SideWidgetsData = {
    music: { mode: 'recent' | 'new'; tracks: TrackCard[] } | null;
    cinema: {
        ai: boolean;
        items: (MovieCard & { why: string | null })[];
    } | null;
    giveaways: Giveaway[] | null;
    gamecast: { live: number; listeners: number; shows: Show[] } | null;
};

let cache: SideWidgetsData | null = null;

/** Дані віджетів (один запит на сторінку; між переходами — з пам’яті). */
export function useSideWidgets(): SideWidgetsData | null {
    const [data, setData] = useState<SideWidgetsData | null>(cache);
    useEffect(() => {
        api<SideWidgetsData>('GET', '/feed/widgets')
            .then((d) => {
                cache = d;
                setData(d);
            })
            .catch(() => undefined);
    }, []);

    return data;
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

/**
 * Віджети ПК і планшета: музика, «Що подивитися» (ШІ або за смаком), роздачі ігор і GameCast.
 * На ПК — у правій колонці стопкою, на планшеті — сіткою 2×2 над стрічкою.
 */
export function SideWidgets({
    data,
    className,
}: {
    data: SideWidgetsData | null;
    className?: string;
}) {
    if (!data) return null;
    let i = 0;

    return (
        <div className={className}>
            {data.gamecast && <GameCastCard data={data.gamecast} index={i++} />}
            {data.music && <MusicCard data={data.music} index={i++} />}
            {data.cinema && <CinemaCard data={data.cinema} index={i++} />}
            {data.giveaways && (
                <GiveawaysCard items={data.giveaways} index={i++} />
            )}
        </div>
    );
}
