import { Link, usePage } from '@inertiajs/react';
import {
    ChevronDown,
    Flame,
    Gamepad2,
    Mic,
    Power,
    Radar,
    Server,
    Siren,
    Target,
    Trophy,
    Volume2,
} from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { RailData } from '@/components/gc/rail-widgets';
import { UserAvatar } from '@/components/gc/user-avatar';
import { ReadyForm, left, stopReady } from '@/components/party/ready-to-play';
import type { ReadyState } from '@/components/party/ready-to-play';
import { QuestList } from '@/components/quests/quest-list';
import type { Quest } from '@/components/quests/quest-list';
import { api } from '@/lib/api';
import { plural } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';
import { cn } from '@/lib/utils';

const days = (n: number) => plural(n, [tr('день'), tr('дні'), tr('днів')]);

/**
 * Смуга над стрічкою одним рядком: серія днів, «Я готовий грати» і завдання дня.
 * Кнопки розгортають під собою форму готовності або список завдань — без трьох великих карток.
 */
export function FeedPulse({ quests }: { quests: Quest[] }) {
    const readyOn = usePlugin('ready_to_play');
    const streak = usePage().props.engagement?.streak?.days ?? 0;
    const reduce = useReducedMotion();
    const [state, setState] = useState<ReadyState | null>(null);
    const [panel, setPanel] = useState<'ready' | 'quests' | null>(null);
    const [busy, setBusy] = useState(false);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!readyOn) return;
        void api<ReadyState>('GET', '/ready')
            .then(setState)
            .catch(() => {});
        const tick = window.setInterval(() => setNow(Date.now()), 30_000);
        return () => window.clearInterval(tick);
    }, [readyOn]);

    const mine =
        state?.mine && new Date(state.mine.until).getTime() > now
            ? state.mine
            : null;
    const friends = (state?.friends ?? []).filter(
        (f) => new Date(f.until).getTime() > now,
    );
    const showQuests = quests.length > 0 && !quests.every((q) => q.claimed);
    const done = quests.filter((q) => q.done).length;

    if (streak < 1 && !state && !showQuests) return null;

    const toggle = (key: 'ready' | 'quests') =>
        setPanel((p) => (p === key ? null : key));

    return (
        <section className="gc-solid rounded-2xl p-2.5">
            <div className="flex items-stretch gap-2">
                {streak > 0 && (
                    <span
                        title={tr('Днів поспіль на GameCon')}
                        className="gc-solid-2 flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-amber-400"
                    >
                        <Flame className="size-4" />
                        <span className="tabular-nums">{streak}</span>
                        <span className="max-[440px]:hidden">
                            {days(streak)}
                        </span>
                    </span>
                )}
                {state &&
                    (mine ? (
                        <button
                            type="button"
                            onClick={() => toggle('ready')}
                            aria-expanded={panel === 'ready'}
                            className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-3 text-sm font-semibold text-emerald-400"
                        >
                            <span className="size-2 shrink-0 rounded-full bg-emerald-400" />
                            <span className="truncate">
                                {tr('Готові')} · {left(mine.until, now)}
                            </span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => toggle('ready')}
                            aria-expanded={panel === 'ready'}
                            className="btn-glow flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold"
                        >
                            <Gamepad2 className="size-4 shrink-0" />
                            <span className="truncate">
                                {tr('Я готовий грати')}
                            </span>
                            {friends.length > 0 && (
                                <span className="flex shrink-0 -space-x-2">
                                    {friends.slice(0, 3).map((f) => (
                                        <UserAvatar
                                            key={f.user.id}
                                            user={f.user}
                                            size="xs"
                                            showOnline={false}
                                        />
                                    ))}
                                </span>
                            )}
                        </button>
                    ))}
                {showQuests && (
                    <button
                        type="button"
                        onClick={() => toggle('quests')}
                        aria-expanded={panel === 'quests'}
                        aria-label={tr('Завдання дня')}
                        className="gc-solid-2 flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-sky-400"
                    >
                        <Target className="size-4" />
                        <span className="tabular-nums">
                            {done}/{quests.length}
                        </span>
                        <span className="text-xs max-[440px]:hidden">XP</span>
                        <ChevronDown
                            className={cn(
                                'size-4 transition',
                                panel === 'quests' && 'rotate-180',
                            )}
                        />
                    </button>
                )}
            </div>

            <AnimatePresence initial={false}>
                {panel && (
                    <m.div
                        key={panel}
                        initial={reduce ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={reduce ? undefined : { opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-1 pt-3">
                            {panel === 'quests' ? (
                                <>
                                    <QuestList quests={quests} />
                                    <Link
                                        href="/quests"
                                        className="mt-2 inline-block px-1 text-xs font-semibold text-sky-400 hover:underline"
                                    >
                                        {tr('Сезонний пропуск')}
                                    </Link>
                                </>
                            ) : (
                                state && (
                                    <>
                                        {mine ? (
                                            <div className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-2.5 text-sm">
                                                <span className="min-w-0 flex-1 truncate text-white">
                                                    {mine.game
                                                        ? tr(
                                                              'Готові грати в {game}',
                                                              {
                                                                  game: mine
                                                                      .game
                                                                      .name,
                                                              },
                                                          )
                                                        : tr('Готові грати')}
                                                </span>
                                                <button
                                                    type="button"
                                                    disabled={busy}
                                                    onClick={() => {
                                                        setBusy(true);
                                                        stopReady()
                                                            .then(setState)
                                                            .catch(() => {})
                                                            .finally(() =>
                                                                setBusy(false),
                                                            );
                                                    }}
                                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white"
                                                >
                                                    <Power className="size-3.5" />
                                                    {tr('Зняти')}
                                                </button>
                                            </div>
                                        ) : (
                                            <ReadyForm
                                                state={state}
                                                onSaved={setState}
                                                onCancel={() => setPanel(null)}
                                            />
                                        )}
                                        {friends.length > 0 ? (
                                            <ul className="space-y-1">
                                                {friends.map((f) => (
                                                    <li key={f.user.id}>
                                                        <Link
                                                            href={`/${f.user.username}`}
                                                            className="flex items-center gap-2.5 rounded-xl p-1.5 hover:bg-[var(--gc-l3)]"
                                                        >
                                                            <UserAvatar
                                                                user={f.user}
                                                                size="sm"
                                                            />
                                                            <span className="min-w-0 flex-1">
                                                                <span className="block truncate text-sm font-medium text-white">
                                                                    {
                                                                        f.user
                                                                            .first_name
                                                                    }
                                                                    {f.game &&
                                                                        ` · ${f.game.name}`}
                                                                </span>
                                                                <span className="block truncate text-xs text-white/50">
                                                                    {left(
                                                                        f.until,
                                                                        now,
                                                                    )}
                                                                </span>
                                                            </span>
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="px-1 pb-1 text-xs text-white/50">
                                                {tr(
                                                    'Зараз ніхто з друзів не позначив, що вільний. Будьте першим.',
                                                )}
                                            </p>
                                        )}
                                    </>
                                )
                            )}
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
        </section>
    );
}

export type HubData = {
    alerts: {
        active_count: number;
        latest?: string | null;
        region: {
            name: string;
            active: boolean;
            alert?: string | null;
            label?: string | null;
            started_at?: string | null;
        } | null;
    } | null;
};

/** Дані /me/hub (тривоги, штаб сім'ї) — раз на 2 хвилини. */
export function useHub(enabled = true) {
    const [data, setData] = useState<HubData | null>(null);
    useEffect(() => {
        if (!enabled) return;
        const load = () =>
            void api<HubData>('GET', '/me/hub')
                .then(setData)
                .catch(() => undefined);
        load();
        const timer = window.setInterval(load, 120_000);
        return () => window.clearInterval(timer);
    }, [enabled]);
    return data;
}

/**
 * Віджети між записами стрічки: після 2-го — голосовий штаб, після 4-го — тривога,
 * після 6-го — топ серверів, після 8-го — сезонний пропуск. Порожні — не показуються.
 */
export function FeedInsert({
    index,
    rail,
    hub,
}: {
    index: number;
    rail: RailData | null;
    hub: HubData | null;
}) {
    switch (index) {
        case 1:
            return <VoiceCard rail={rail} />;
        case 3:
            return <AlertCard hub={hub} />;
        case 5:
            return <ServersCard rail={rail} />;
        case 7:
            return <SeasonCard rail={rail} />;
        default:
            return null;
    }
}

function CardHead({
    icon: Icon,
    title,
    tone,
    aside,
}: {
    icon: typeof Mic;
    title: string;
    tone: string;
    aside?: React.ReactNode;
}) {
    return (
        <div className="mb-3 flex items-center gap-2">
            <Icon className={cn('size-5 shrink-0', tone)} />
            <h3 className="min-w-0 flex-1 truncate font-display text-[15px] font-bold text-white">
                {title}
            </h3>
            {aside}
        </div>
    );
}

function VoiceCard({ rail }: { rail: RailData | null }) {
    const rooms = rail?.voice ?? [];
    if (rooms.length === 0) return null;
    const total = rooms.reduce((sum, r) => sum + r.count, 0);

    return (
        <section className="gc-solid rounded-2xl p-4">
            <CardHead
                icon={Mic}
                tone="text-emerald-400"
                title={tr('Голосовий штаб')}
                aside={
                    <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        {tr('{n} у войсі', { n: total })}
                    </span>
                }
            />
            <div className="space-y-2">
                {rooms.slice(0, 2).map((room) => {
                    const names = room.people
                        .slice(0, 2)
                        .map((p) => p.first_name)
                        .join(', ');
                    const more = room.count - Math.min(2, room.people.length);
                    return (
                        <div
                            key={room.id}
                            className="gc-solid-2 rounded-2xl p-3"
                        >
                            <div className="flex items-center gap-2">
                                <Volume2 className="size-4 shrink-0 text-white/60" />
                                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                                    {room.name}
                                </span>
                                <span className="max-w-[40%] shrink-0 truncate rounded-lg bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-400">
                                    {room.owner}
                                </span>
                            </div>
                            <div className="mt-2.5 flex items-center gap-2">
                                <span className="flex shrink-0 -space-x-2">
                                    {room.people.slice(0, 3).map((p) => (
                                        <UserAvatar
                                            key={p.id}
                                            user={p}
                                            size="xs"
                                            showOnline={false}
                                        />
                                    ))}
                                </span>
                                <span className="min-w-0 truncate text-xs text-white/60">
                                    {names}
                                    {more > 0 && ` +${more}`}
                                </span>
                            </div>
                            <Link
                                href={room.href}
                                className="mt-3 flex h-10 items-center justify-center rounded-xl bg-emerald-500/15 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500/25"
                            >
                                {tr('Приєднатися в 1 клік')}
                            </Link>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

/** «00:34:18» від початку тривоги. */
function useElapsed(since: string | null | undefined): string | null {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!since) return;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [since]);
    if (!since) return null;
    const total = Math.max(
        0,
        Math.floor((now - new Date(since).getTime()) / 1000),
    );
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

function AlertCard({ hub }: { hub: HubData | null }) {
    const alerts = hub?.alerts;
    const region = alerts?.region?.active ? alerts.region : null;
    const elapsed = useElapsed(region?.started_at);
    if (!alerts || (alerts.active_count === 0 && !region)) return null;

    return (
        <section className="rounded-2xl bg-red-50 p-4 dark:bg-[#1c0d12]">
            <div className="flex gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-500">
                    <Siren className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="font-display text-[15px] leading-snug font-bold text-white">
                        {region
                            ? `${region.name} — ${region.label ?? tr('Повітряна тривога')}`
                            : tr('Тривога в {n} {word}', {
                                  n: alerts.active_count,
                                  word: plural(alerts.active_count, [
                                      tr('області'),
                                      tr('областях'),
                                      tr('областях'),
                                  ]),
                              })}
                        {elapsed && (
                            <span className="ml-1.5 font-mono text-red-400 tabular-nums">
                                {elapsed}
                            </span>
                        )}
                    </p>
                    {region && alerts.active_count > 1 && (
                        <p className="mt-0.5 text-xs text-white/50">
                            {tr('Областей у тривозі: {n}', {
                                n: alerts.active_count,
                            })}
                        </p>
                    )}
                    {alerts.latest && (
                        <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-white/70">
                            {alerts.latest}
                        </p>
                    )}
                </div>
            </div>
            <Link
                href="/alerts"
                className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-500"
            >
                <Radar className="size-4" />
                {tr('Радар цілей')}
            </Link>
        </section>
    );
}

function ServersCard({ rail }: { rail: RailData | null }) {
    const servers = rail?.servers ?? [];
    if (servers.length === 0) return null;

    return (
        <section className="gc-solid rounded-2xl p-4">
            <CardHead
                icon={Server}
                tone="text-sky-400"
                title={tr('Топ серверів')}
                aside={
                    <Link
                        href="/servers"
                        className="shrink-0 text-xs font-semibold text-sky-400"
                    >
                        Live
                    </Link>
                }
            />
            <div className="space-y-2">
                {servers.map((s) => (
                    <Link
                        key={s.id}
                        href={s.href}
                        className="gc-solid-2 block rounded-2xl p-3 transition hover:bg-[var(--gc-l3)]"
                    >
                        <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                                <p className="flex items-center gap-2">
                                    <span className="truncate text-sm font-bold text-white">
                                        {s.name}
                                    </span>
                                    {s.featured && (
                                        <span className="shrink-0 rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                                            {tr('Партнер')}
                                        </span>
                                    )}
                                </p>
                                {(s.tagline || s.website) && (
                                    <p className="mt-0.5 truncate text-xs text-white/50">
                                        {s.tagline ||
                                            s.website?.replace(
                                                /^https?:\/\//,
                                                '',
                                            )}
                                    </p>
                                )}
                            </div>
                            <div className="shrink-0 text-right">
                                <p className="text-sm font-bold text-emerald-400 tabular-nums">
                                    {s.online}
                                    {s.max ? ` / ${s.max}` : ''}
                                </p>
                                <p className="text-[11px] text-white/45">
                                    {tr('онлайн')}
                                </p>
                            </div>
                        </div>
                        {s.max ? (
                            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--gc-page)]">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400"
                                    style={{
                                        width: `${Math.min(100, Math.round((s.online / s.max) * 100))}%`,
                                    }}
                                />
                            </div>
                        ) : null}
                    </Link>
                ))}
            </div>
        </section>
    );
}

function SeasonCard({ rail }: { rail: RailData | null }) {
    const season = rail?.season;
    if (!season) return null;
    const streak = rail?.me?.streak ?? 0;
    const pct = season.need > 0 ? (season.into / season.need) * 100 : 100;

    return (
        <Link
            href="/quests"
            className="gc-solid block rounded-2xl p-4 transition hover:bg-[var(--gc-l2)]"
        >
            <div className="flex items-start gap-2">
                <Trophy className="mt-0.5 size-5 shrink-0 text-amber-400" />
                <p className="min-w-0 flex-1 font-display text-[15px] leading-snug font-bold text-white">
                    {season.title} · {tr('Рів. {n}', { n: season.level })}
                </p>
                {streak > 0 && (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-sky-400">
                        <Flame className="size-3.5 text-amber-400" />
                        {tr('Стрік {n} {word}', {
                            n: streak,
                            word: days(streak),
                        })}
                    </span>
                )}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--gc-l2)]">
                <div
                    className="h-full rounded-full bg-sky-400"
                    style={{ width: `${Math.max(3, Math.min(100, pct))}%` }}
                />
            </div>
            <p className="mt-2.5 text-[13px] text-white/60">
                {season.need > 0
                    ? tr('Залишилося {xp} XP до рівня {level}', {
                          xp: season.need - season.into,
                          level: season.level + 1,
                      })
                    : tr('Максимальний рівень сезону')}
            </p>
        </Link>
    );
}
