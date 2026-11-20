import { Link, usePage } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    CalendarClock,
    Eye,
    EyeOff,
    Headphones,
    LayoutGrid,
    Play,
    Plus,
    RectangleHorizontal,
    Square,
} from 'lucide-react';
import { LayoutGroup, m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import type { TomorrowEvent } from '@/components/gc/feed-extras';
import type { RailData } from '@/components/gc/rail-widgets';
import { UserAvatar } from '@/components/gc/user-avatar';
import type { StreamInfo } from '@/components/streams/stream';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { motionOr, SNAP } from '@/lib/motion';
import { cn } from '@/lib/utils';

export type LayoutItem = { key: string; size: 'half' | 'full' };

/** Назви віджетів лобі — для режиму «Налаштувати». */
export function widgetTitle(key: string): string {
    const titles: Record<string, string> = {
        pulse: tr('Серія, «готовий грати» й завдання'),
        stories: tr('Моменти'),
        continue: tr('Продовжити'),
        alerts: tr('Тривоги'),
        requests: tr('Заявки в друзі'),
        contacts: tr('Контакти'),
        voice: tr('Голосові кімнати'),
        servers: tr('Топ серверів'),
        season: tr('Сезонний пропуск'),
        online: tr('Зараз онлайн'),
        playing: tr('Друзі в грі'),
        same_game: tr('Грають у те саме'),
        picks: tr('Добірки'),
        suggestions: tr('Можливо, ви знайомі'),
        birthdays: tr('Дні народження'),
        media: tr('Музика, кіно й розіграші'),
    };
    return titles[key] ?? key;
}

function greeting(hour: number): string {
    if (hour < 5) return tr('Доброї ночі');
    if (hour < 12) return tr('Доброго ранку');
    if (hour < 18) return tr('Добрий день');
    return tr('Добрий вечір');
}

/** Привітання лобі: хто ти, що відбувається, одним рядком — головне на зараз. */
export function LobbyHero({
    rail,
    events,
}: {
    rail: RailData | null;
    events: TomorrowEvent[];
}) {
    const { auth, counters } = usePage().props;
    const reduce = useReducedMotion();
    const online =
        (rail as (RailData & { online?: unknown[] }) | null)?.online?.length ??
        0;
    const inGame = rail?.in_game?.length ?? 0;
    const unread = counters?.messages ?? 0;
    const event = events[0];

    const second =
        inGame > 0
            ? tr('Друзі вже в грі.')
            : online > 0
              ? tr('Друзі поруч.')
              : tr('Чим займемось сьогодні?');
    const facts = [
        online > 0 && tr('{count} друзів онлайн', { count: online }),
        event &&
            tr('{title} о {time}', {
                title: event.title,
                time: new Date(event.starts_at).toLocaleTimeString('uk-UA', {
                    hour: '2-digit',
                    minute: '2-digit',
                }),
            }),
        unread > 0 && tr('{count} нові повідомлення', { count: unread }),
    ].filter(Boolean) as string[];

    return (
        <m.header
            className="gc-lobby-hero"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionOr(reduce, SNAP)}
        >
            <h1 className="gc-lobby-hero__title">
                {greeting(new Date().getHours())}, {auth.user.first_name}.{' '}
                <span className="gc-lobby-hero__muted">{second}</span>
            </h1>
            {facts.length > 0 && (
                <p className="gc-lobby-hero__facts">{facts.join(' · ')}</p>
            )}
        </m.header>
    );
}

/**
 * «Зараз»: живі плитки — голосова кімната з друзями, трансляція друга, найближча подія сім’ї.
 * Немає нічого живого — секції немає.
 */
export function NowTiles({
    rail,
    streams,
    events,
}: {
    rail: RailData | null;
    streams: StreamInfo[];
    events: TomorrowEvent[];
}) {
    const reduce = useReducedMotion();
    const room = rail?.voice?.find((r) => r.count > 0);
    const stream = streams.find((s) => s.live);
    const event = events[0];
    const tiles: ReactNode[] = [];

    if (room) {
        tiles.push(
            <Link
                key="voice"
                href={room.href}
                className="gc-now-tile gc-now-tile--voice"
            >
                <span className="gc-now-tile__kicker">
                    {tr('Голосова')} · {room.name}
                </span>
                <span className="gc-now-tile__title">
                    {room.people[0]
                        ? tr('{name} і ще {count}', {
                              name: room.people[0].first_name,
                              count: Math.max(0, room.count - 1),
                          })
                        : tr('{count} у кімнаті', { count: room.count })}
                </span>
                <span className="mt-auto flex items-end justify-between gap-3">
                    <span className="flex -space-x-2">
                        {room.people.slice(0, 3).map((p) => (
                            <UserAvatar
                                key={p.id}
                                user={p}
                                size="sm"
                                showOnline={false}
                            />
                        ))}
                    </span>
                    <span className="gc-now-tile__cta">
                        <Headphones className="size-4" />
                        {tr('Зайти')}
                    </span>
                </span>
            </Link>,
        );
    }
    if (stream) {
        tiles.push(
            <a
                key="stream"
                href={stream.url}
                target="_blank"
                rel="noreferrer"
                className="gc-now-tile gc-now-tile--live"
            >
                <span className="gc-now-tile__kicker">
                    {stream.user?.first_name ?? stream.channel}
                    {stream.viewers
                        ? ` · ${tr('{count} глядачів', { count: stream.viewers })}`
                        : ''}
                </span>
                <span className="gc-now-tile__badge">LIVE</span>
                <span className="gc-now-tile__title line-clamp-2">
                    {stream.title ?? stream.game ?? stream.platform_label}
                </span>
                <span className="mt-auto">
                    <span className="gc-now-tile__cta">
                        <Play className="size-4" />
                        {tr('Дивитись')}
                    </span>
                </span>
            </a>,
        );
    }
    if (event) {
        tiles.push(
            <Link
                key="event"
                href={event.where?.url ?? '/feed'}
                className="gc-now-tile"
            >
                <span className="gc-now-tile__kicker">
                    {event.where?.name ?? event.type_label} ·{' '}
                    {new Date(event.starts_at).toLocaleTimeString('uk-UA', {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </span>
                <span className="gc-now-tile__title line-clamp-2">
                    {event.title}
                </span>
                <span className="mt-auto flex items-center gap-2 text-sm text-[var(--gc-text-2)]">
                    <CalendarClock className="size-4" />
                    {event.type_label}
                </span>
            </Link>,
        );
    }

    if (tiles.length === 0) return null;

    return (
        <section aria-labelledby="gc-now" className="space-y-3">
            <h2 id="gc-now" className="gc-lobby-label">
                <span className="gc-live-dot" aria-hidden />
                {tr('Зараз')}
            </h2>
            <div className="gc-now-grid">
                {tiles.map((tile, i) => (
                    <m.div
                        key={i}
                        className="flex"
                        initial={reduce ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={motionOr(reduce, {
                            ...SNAP,
                            delay: 0.04 * i,
                        })}
                    >
                        {tile}
                    </m.div>
                ))}
            </div>
        </section>
    );
}

/**
 * Дошка віджетів лобі: кожен блок — віджет. У режимі «Налаштувати» — порядок (вгору/вниз),
 * розмір (½ або на всю ширину), показати/сховати. Розклад — у профілі (home_layout), спільний із застосунком.
 */
export function WidgetBoard({
    layout: initial,
    available,
    render,
    editable = true,
}: {
    layout: LayoutItem[];
    /** Плагін «Віджети головної» вимкнено — розклад за замовчуванням, без «Налаштувати». */
    editable?: boolean;
    /** Віджети, доступні цій людині (модулі, плагіни, режим). */
    available: string[];
    render: (key: string) => ReactNode;
}) {
    const reduce = useReducedMotion();
    const [layout, setLayout] = useState<LayoutItem[]>(() =>
        initial.filter((i) => available.includes(i.key)),
    );
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const hidden = available.filter((k) => !layout.some((i) => i.key === k));

    const move = (index: number, dir: -1 | 1) =>
        setLayout((list) => {
            const next = [...list];
            const to = index + dir;
            if (to < 0 || to >= next.length) return list;
            [next[index], next[to]] = [next[to], next[index]];
            return next;
        });
    const resize = (index: number) =>
        setLayout((list) =>
            list.map((item, i) =>
                i === index
                    ? { ...item, size: item.size === 'full' ? 'half' : 'full' }
                    : item,
            ),
        );
    const hide = (index: number) =>
        setLayout((list) => list.filter((_, i) => i !== index));
    const show = (key: string) =>
        setLayout((list) => [...list, { key, size: 'half' }]);

    const save = () => {
        setSaving(true);
        // Віджети, яких ця людина зараз не бачить (інший режим), зберігаємо на своїх місцях наприкінці.
        const keep = initial.filter((i) => !available.includes(i.key));
        api<{ message: string }>('PUT', '/settings/home-layout', {
            layout: [...layout, ...keep],
        })
            .then((r) => {
                toast.success(r.message);
                setEditing(false);
            })
            .catch(() => toast.error(tr('Не вдалося зберегти лобі.')))
            .finally(() => setSaving(false));
    };

    return (
        <section aria-label={tr('Віджети')} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <h2 className="gc-lobby-label">{tr('Твоє лобі')}</h2>
                {editing ? (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="gc-ghost-btn"
                            onClick={() => {
                                setLayout(
                                    initial.filter((i) =>
                                        available.includes(i.key),
                                    ),
                                );
                                setEditing(false);
                            }}
                        >
                            {tr('Скасувати')}
                        </button>
                        <button
                            type="button"
                            className="gc-primary-btn"
                            disabled={saving}
                            onClick={save}
                        >
                            {tr('Зберегти')}
                        </button>
                    </div>
                ) : (
                    editable && (
                        <button
                            type="button"
                            className="gc-ghost-btn"
                            onClick={() => setEditing(true)}
                        >
                            <LayoutGrid className="size-4" />
                            {tr('Налаштувати')}
                        </button>
                    )
                )}
            </div>
            <LayoutGroup>
                <div className="gc-widget-grid">
                    {layout.map((item, index) => {
                        const body = render(item.key);
                        if (!editing && !body) return null;
                        return (
                            <m.div
                                key={item.key}
                                layout={!reduce}
                                transition={motionOr(reduce, SNAP)}
                                className={cn(
                                    'gc-widget-cell min-w-0',
                                    item.size === 'full' && 'is-full',
                                    editing && 'is-editing',
                                )}
                            >
                                {editing && (
                                    <div className="gc-widget-tools">
                                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                                            {widgetTitle(item.key)}
                                        </span>
                                        <ToolButton
                                            label={tr('Вгору')}
                                            disabled={index === 0}
                                            onClick={() => move(index, -1)}
                                        >
                                            <ArrowUp className="size-4" />
                                        </ToolButton>
                                        <ToolButton
                                            label={tr('Вниз')}
                                            disabled={
                                                index === layout.length - 1
                                            }
                                            onClick={() => move(index, 1)}
                                        >
                                            <ArrowDown className="size-4" />
                                        </ToolButton>
                                        <ToolButton
                                            label={
                                                item.size === 'full'
                                                    ? tr('Звичайний розмір')
                                                    : tr('На всю ширину')
                                            }
                                            onClick={() => resize(index)}
                                        >
                                            {item.size === 'full' ? (
                                                <Square className="size-4" />
                                            ) : (
                                                <RectangleHorizontal className="size-4" />
                                            )}
                                        </ToolButton>
                                        <ToolButton
                                            label={tr('Сховати')}
                                            onClick={() => hide(index)}
                                        >
                                            <EyeOff className="size-4" />
                                        </ToolButton>
                                    </div>
                                )}
                                {body ??
                                    (editing && (
                                        <p className="gc-widget-empty">
                                            {tr(
                                                'Зараз тут порожньо — віджет з’явиться, коли буде що показати.',
                                            )}
                                        </p>
                                    ))}
                            </m.div>
                        );
                    })}
                </div>
            </LayoutGroup>
            {editing && hidden.length > 0 && (
                <div className="gc-widget-hidden">
                    <span className="text-sm text-[var(--gc-text-2)]">
                        {tr('Сховані:')}
                    </span>
                    {hidden.map((key) => (
                        <button
                            key={key}
                            type="button"
                            className="gc-ghost-btn"
                            onClick={() => show(key)}
                        >
                            <Plus className="size-4" />
                            {widgetTitle(key)}
                        </button>
                    ))}
                </div>
            )}
            {!editing && layout.length === 0 && (
                <button
                    type="button"
                    className="gc-widget-empty w-full"
                    onClick={() => setEditing(true)}
                >
                    <Eye className="mr-2 inline size-4" />
                    {tr('Усі віджети сховані. Налаштувати лобі')}
                </button>
            )}
        </section>
    );
}

function ToolButton({
    label,
    disabled,
    onClick,
    children,
}: {
    label: string;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onClick}
            className="gc-widget-tool"
        >
            {children}
        </button>
    );
}
