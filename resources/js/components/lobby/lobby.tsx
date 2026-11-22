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
    Music,
    Pause,
    Plus,
    Rows3,
    SkipBack,
    SkipForward,
    Send,
    RectangleHorizontal,
    Square,
    Award,
    Sparkles,
} from 'lucide-react';
import { LayoutGroup, m, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import type { TomorrowEvent } from '@/components/gc/feed-extras';
import { useRowSpan } from '@/components/lobby/bento-feed';
import {
    ratioOf,
    VoicePlayer,
    VoiceReplyButton,
} from '@/components/lobby/media-blocks';
import { next, prev, toggle, usePlayer } from '@/lib/player';
import type { RailData } from '@/components/gc/rail-widgets';
import { BADGE_ICONS } from '@/components/gc/achievements';
import { UserAvatar } from '@/components/gc/user-avatar';
import type { StreamInfo } from '@/components/streams/stream';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { motionOr, SNAP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';
import { usePlugin } from '@/lib/plugins';
import { left, stopReady } from '@/components/party/ready-to-play';
import type { ReadyState } from '@/components/party/ready-to-play';

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
        player: tr('Зараз грає'),
    };
    return titles[key] ?? key;
}

function greeting(hour: number): string {
    if (hour < 5) return tr('Доброї ночі');
    if (hour < 12) return tr('Доброго ранку');
    if (hour < 18) return tr('Добрий день');
    return tr('Добрий вечір');
}

/**
 * «Готовий грати» — компактний перемикач у привітанні (як у макеті): увімкнути на 2 год одним дотиком,
 * вимкнути так само. Друзі бачать статус у своєму доку й лобі.
 */
function ReadyToggle() {
    const on = usePlugin('ready_to_play');
    const [state, setState] = useState<ReadyState | null>(null);
    const [busy, setBusy] = useState(false);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!on) return;
        void api<ReadyState>('GET', '/ready')
            .then(setState)
            .catch(() => undefined);
        const tick = window.setInterval(() => setNow(Date.now()), 30_000);
        return () => window.clearInterval(tick);
    }, [on]);

    if (!on || !state) return null;
    const mine =
        state.mine && new Date(state.mine.until).getTime() > now
            ? state.mine
            : null;
    const friends = state.friends.filter(
        (f) => new Date(f.until).getTime() > now,
    ).length;

    const toggle = () => {
        setBusy(true);
        const req = mine
            ? stopReady()
            : api<ReadyState>('PUT', '/ready', { minutes: 120 }).then((r) => {
                  toast.success(tr('Друзі бачать, що ви готові грати.'));
                  return r;
              });
        req.then(setState)
            .catch(() => undefined)
            .finally(() => setBusy(false));
    };

    return (
        <button
            type="button"
            role="switch"
            aria-checked={!!mine}
            disabled={busy}
            onClick={toggle}
            className="gc-ready-toggle"
        >
            <span className="min-w-0 text-left">
                <span className="block text-[15px] font-semibold">
                    {tr('Готовий грати')}
                </span>
                <span className="block truncate text-[13px] text-[var(--gc-text-2)]">
                    {mine
                        ? [
                              mine.game?.name,
                              tr('ще {left}', { left: left(mine.until, now) }),
                          ]
                              .filter(Boolean)
                              .join(' · ')
                        : friends > 0
                          ? tr('Готові друзі: {count}', { count: friends })
                          : tr('Друзі побачать, що ти вільний')}
                </span>
            </span>
            <span className={cn('gc-switch', mine && 'is-on')} aria-hidden>
                <span />
            </span>
        </button>
    );
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
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
                <div className="min-w-0">
                    <h1 className="gc-lobby-hero__title">
                        {greeting(new Date().getHours())},{' '}
                        {auth.user.first_name}.{' '}
                        <span className="gc-lobby-hero__muted">{second}</span>
                    </h1>
                    {facts.length > 0 && (
                        <p className="gc-lobby-hero__facts">
                            {facts.join(' · ')}
                        </p>
                    )}
                </div>
                <ReadyToggle />
            </div>
        </m.header>
    );
}

/**
 * «Зараз»: живі плитки — голосова кімната з друзями, трансляція друга, найближча подія сім’ї.
 * Немає нічого живого — секції немає.
 */
type NowData = {
    shifts: {
        id: number;
        title: string;
        family: string;
        live: boolean;
        starts_at: string;
        ends_at: string;
        foreman: string | null;
        mine: boolean;
        progress: number;
        goal: number | null;
        href: string;
    }[];
    chats: {
        id: number;
        title: string;
        avatar_url: string | null;
        unread: number;
        preview: string | null;
        author: string | null;
        href: string;
        media: {
            kind: 'voice' | 'image';
            url: string;
            duration: number | null;
            width: number | null;
            height: number | null;
        } | null;
    }[];
    /** Живі вікторини в моїх спільнотах (№225). */
    quizzes?: {
        id: number;
        title: string;
        community: string;
        index: number;
        total: number;
        href: string;
    }[];
    /** Свіжі досягнення друзів (тиждень). */
    achievements?: {
        user: UserCard;
        key: string;
        title: string;
        icon: string;
        at: string;
    }[];
};

const hm = (iso: string) =>
    new Date(iso).toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
    });

/** «Зараз» з усіх розділів (/me/now): зміни сім’ї й обговорення; оновлення раз на хвилину. */
function useNow() {
    const [data, setData] = useState<NowData | null>(null);
    useEffect(() => {
        const load = () =>
            void api<NowData>('GET', '/me/now')
                .then(setData)
                .catch(() => undefined);
        load();
        const timer = window.setInterval(load, 60_000);
        return () => window.clearInterval(timer);
    }, []);
    return data;
}

/** Досягнення друзів: хто що відкрив за тиждень — привітати можна зі сторінки друга. */
function FriendAchievements({
    items,
}: {
    items: NonNullable<NowData['achievements']>;
}) {
    return (
        <div className="gc-now-tile gc-now-tile--list">
            <span className="gc-now-tile__kicker">{tr('Друзі відкрили')}</span>
            <ul className="mt-1 space-y-1">
                {items.slice(0, 4).map((item) => {
                    const Icon = BADGE_ICONS[item.icon] ?? Award;
                    return (
                        <li key={`${item.user.id}-${item.key}`}>
                            <Link
                                href={`/${item.user.username}`}
                                className="gc-achievement-row"
                            >
                                <UserAvatar
                                    user={item.user}
                                    size="sm"
                                    showOnline={false}
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold">
                                        {item.user.first_name ?? item.user.name}
                                    </span>
                                    <span className="block truncate text-xs text-[var(--gc-text-2)]">
                                        {item.title}
                                    </span>
                                </span>
                                <span
                                    className="gc-achievement-row__icon"
                                    aria-hidden
                                >
                                    <Icon className="size-4" />
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

/** Плитка обговорення: останнє повідомлення й відповідь просто з лобі. */
function ChatTile({ chat }: { chat: NowData['chats'][number] }) {
    const [text, setText] = useState('');
    const [sent, setSent] = useState(false);
    const [busy, setBusy] = useState(false);
    const image = chat.media?.kind === 'image' ? chat.media : null;
    const voice = chat.media?.kind === 'voice' ? chat.media : null;
    const send = (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim()) return;
        setBusy(true);
        api('POST', `/messages/${chat.id}`, { body: text.trim() })
            .then(() => {
                setText('');
                setSent(true);
            })
            .catch(() => toast.error(tr('Не вдалося надіслати.')))
            .finally(() => setBusy(false));
    };

    const reply = sent ? (
        <span className="relative text-sm text-[var(--gc-live)]">
            {tr('Відповідь надіслано.')}
        </span>
    ) : (
        <form onSubmit={send} className="relative flex items-center gap-1.5">
            <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={tr('Відповісти…')}
                aria-label={tr('Відповідь у «{title}»', { title: chat.title })}
                maxLength={2000}
                className="gc-glass-m gc-glass-input"
            />
            {text.trim() ? (
                <button
                    type="submit"
                    disabled={busy}
                    className="gc-glass-s gc-glass-btn gc-glass-btn--icon"
                    aria-label={tr('Надіслати')}
                >
                    <Send className="size-4" />
                </button>
            ) : (
                <VoiceReplyButton
                    chatId={chat.id}
                    onSent={() => setSent(true)}
                />
            )}
        </form>
    );

    // Картинка — заливка всього блоку з її пропорціями; текст і поле — на склі.
    if (image) {
        return (
            <div
                className="gc-media-block"
                style={{ aspectRatio: ratioOf(image.width, image.height) }}
            >
                <img src={image.url} alt="" className="gc-media-block__img" />
                <Link
                    href={chat.href}
                    className="absolute inset-0"
                    aria-label={chat.title}
                />
                <span className="gc-glass-s gc-media-block__author">
                    <span className="truncate">{chat.title}</span>
                </span>
                <div className="gc-media-block__bottom">
                    <div className="gc-glass-caption" aria-hidden />
                    <p className="gc-media-block__caption">
                        {chat.author ? `${chat.author}: ` : ''}
                        {chat.preview ?? tr('Фото')}
                    </p>
                    {reply}
                </div>
            </div>
        );
    }

    return (
        <div className="gc-now-tile">
            <Link href={chat.href} className="gc-now-tile__kicker">
                {chat.title}
                {chat.unread > 0 && ` · ${chat.unread}`}
            </Link>
            {voice ? (
                <>
                    <span className="text-sm font-semibold">
                        {chat.author ?? tr('Голосове повідомлення')}
                    </span>
                    <VoicePlayer url={voice.url} duration={voice.duration} />
                </>
            ) : (
                <Link
                    href={chat.href}
                    className="gc-now-tile__title line-clamp-2"
                >
                    {chat.author ? `${chat.author}: ` : ''}
                    {chat.preview ?? tr('Нове повідомлення')}
                </Link>
            )}
            <div className="mt-auto">{reply}</div>
        </div>
    );
}

/** Живий блок лобі: категорія (для вибору людиною), мітка в куті (що відбувається) і вміст. */
export type LiveBlockData = {
    key: string;
    /** Розділ (категорія) і функціонал розділу (підкатегорія) — як у config/lobby.php. */
    category: string;
    sub: string;
    badge: string;
    tone?: 'live' | 'alert' | 'accent';
    wide?: boolean;
    node: ReactNode;
};

/** Живі блоки «що відбувається зараз» з усіх розділів: голос, ефіри, події, зміни, бесіди, «де зупинились». */
export function useNowBlocks({
    rail,
    streams,
    events,
    resume = null,
}: {
    rail: RailData | null;
    streams: StreamInfo[];
    events: TomorrowEvent[];
    /** «Де зупинились» — перший пункт «Продовжити» (серія, пісня, чернетка). */
    resume?: {
        title: string;
        hint: string;
        href: string;
        image: string | null;
    } | null;
}) {
    const now = useNow();
    const room = rail?.voice?.find((r) => r.count > 0);
    const stream = streams.find((s) => s.live);
    const event = events[0];
    const tiles: LiveBlockData[] = [];

    if (room) {
        tiles.push({
            key: 'voice',
            category: 'voice',
            sub: 'rooms',
            badge: tr('В ефірі'),
            tone: 'live',
            node: (
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
                </Link>
            ),
        });
    }
    if (stream) {
        tiles.push({
            key: 'stream',
            category: 'live',
            sub: 'streams',
            badge: 'LIVE',
            tone: 'alert',
            node: (
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
                    <span className="gc-now-tile__title line-clamp-2">
                        {stream.title ?? stream.game ?? stream.platform_label}
                    </span>
                    <span className="mt-auto">
                        <span className="gc-now-tile__cta">
                            <Play className="size-4" />
                            {tr('Дивитись')}
                        </span>
                    </span>
                </a>
            ),
        });
    }
    if (event) {
        tiles.push({
            key: 'event',
            category: 'events',
            sub: 'mine',
            badge: tr('Подія'),
            tone: 'accent',
            node: (
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
                </Link>
            ),
        });
    }

    for (const shift of now?.shifts ?? []) {
        tiles.push({
            key: `shift-${shift.id}`,
            category: 'families',
            sub: 'shifts',
            badge: shift.live ? tr('Виконується зміна') : tr('Скоро зміна'),
            tone: shift.live ? 'live' : 'accent',
            node: (
                <Link
                    key={`shift-${shift.id}`}
                    href={shift.href}
                    className={cn(
                        'gc-now-tile',
                        shift.live && 'gc-now-tile--shift',
                    )}
                >
                    <span className="gc-now-tile__kicker">
                        {shift.family} ·{' '}
                        {shift.live
                            ? tr('до {time}', { time: hm(shift.ends_at) })
                            : tr('о {time}', { time: hm(shift.starts_at) })}
                    </span>
                    <span className="gc-now-tile__title line-clamp-2">
                        {tr('Зміна')}: {shift.title}
                    </span>
                    <span className="mt-auto text-sm text-[var(--gc-text-2)]">
                        {shift.mine
                            ? tr('Ви бригадир')
                            : shift.foreman
                              ? tr('Бригадир: {name}', { name: shift.foreman })
                              : tr('Вільна — можна взяти')}
                        {shift.goal ? ` · ${shift.progress}/${shift.goal}` : ''}
                    </span>
                </Link>
            ),
        });
    }
    for (const quiz of now?.quizzes ?? []) {
        tiles.push({
            key: `quiz-${quiz.id}`,
            category: 'communities',
            sub: 'quiz',
            badge: tr('Вікторина'),
            tone: 'live',
            node: (
                <Link
                    key={`quiz-${quiz.id}`}
                    href={quiz.href}
                    className="gc-now-tile"
                >
                    <span className="gc-now-tile__kicker">
                        {quiz.community} ·{' '}
                        {tr('питання {n}/{total}', {
                            n: quiz.index,
                            total: quiz.total,
                        })}
                    </span>
                    <span className="gc-now-tile__title line-clamp-2">
                        {quiz.title}
                    </span>
                    <span className="gc-now-tile__cta mt-auto">
                        <Sparkles className="size-4" />
                        {tr('Грати')}
                    </span>
                </Link>
            ),
        });
    }
    const unlocks = now?.achievements ?? [];
    if (unlocks.length > 0) {
        tiles.push({
            key: 'achievements',
            category: 'friends',
            sub: 'achievements',
            badge: tr('Досягнення'),
            tone: 'accent',
            node: <FriendAchievements items={unlocks} />,
        });
    }
    for (const chat of now?.chats ?? []) {
        tiles.push({
            key: `chat-${chat.id}`,
            category: 'messages',
            sub: 'unread',
            badge: tr('Чат'),
            tone: 'accent',
            node: <ChatTile chat={chat} />,
        });
    }
    if (resume) {
        tiles.push({
            key: 'resume',
            category: 'cinema',
            sub: 'continue',
            badge: tr('Продовжити'),
            node: resume.image ? (
                // Постер — заливка блоку: блок бере пропорції самого постера.
                <div className="gc-media-block gc-media-block--natural">
                    <img
                        src={resume.image}
                        alt=""
                        className="gc-media-block__img"
                    />
                    <Link
                        href={resume.href}
                        className="absolute inset-0"
                        aria-label={resume.title}
                    />
                    <div className="gc-media-block__bottom">
                        <div className="gc-glass-caption" aria-hidden />
                        <p className="gc-media-block__caption">
                            <span className="block text-[15px] font-bold">
                                {resume.title}
                            </span>
                            <span className="block text-xs opacity-80">
                                {resume.hint}
                            </span>
                        </p>
                        <Link
                            href={resume.href}
                            className="gc-glass-s gc-glass-btn relative self-start"
                        >
                            <Play className="size-4" />
                            {tr('Далі')}
                        </Link>
                    </div>
                </div>
            ) : (
                <Link href={resume.href} className="gc-now-tile">
                    <span className="gc-now-tile__kicker">
                        {tr('Де ви зупинились')}
                    </span>
                    <span className="gc-now-tile__title line-clamp-2">
                        {resume.title}
                    </span>
                    <span className="mt-auto flex items-center justify-between gap-3">
                        <span className="truncate text-sm text-[var(--gc-text-2)]">
                            {resume.hint}
                        </span>
                        <span className="gc-now-tile__cta">
                            <Play className="size-4" />
                            {tr('Далі')}
                        </span>
                    </span>
                </Link>
            ),
        });
    }

    return tiles;
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
                <div className={cn('gc-widget-grid', editing && 'is-editing')}>
                    {layout.map((item, index) => {
                        const body = render(item.key);
                        if (!editing && !body) return null;
                        return (
                            <WidgetCell
                                key={item.key}
                                full={item.size === 'full'}
                                editing={editing}
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
                            </WidgetCell>
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

/** Клітинка дошки: у перегляді — щільне бенто (висота за вмістом), у налаштуванні — звичайна сітка. */
function WidgetCell({
    full,
    editing,
    children,
}: {
    full: boolean;
    editing: boolean;
    children: ReactNode;
}) {
    const reduce = useReducedMotion();
    const { ref, style } = useRowSpan(!editing);

    return (
        <m.div
            layout={!reduce}
            transition={motionOr(reduce, SNAP)}
            className={cn(
                'gc-widget-cell min-w-0',
                full && 'is-full',
                editing && 'is-editing',
            )}
            style={style}
        >
            <div ref={ref}>{children}</div>
        </m.div>
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

/** Живий віджет «Зараз грає»: обкладинка, перемотка й керування, не заходячи в «Музику». */
export function NowPlayingWidget() {
    const player = usePlayer();
    const track = player.current;
    if (!track) return null;
    const pct =
        player.duration > 0
            ? Math.min(100, (player.position / player.duration) * 100)
            : 0;

    return (
        <section className="gc-player-widget" aria-label={tr('Зараз грає')}>
            {track.cover_url ? (
                <img
                    src={track.cover_url}
                    alt=""
                    className="size-16 shrink-0 rounded-md object-cover"
                />
            ) : (
                <span className="flex size-16 shrink-0 items-center justify-center rounded-md bg-[var(--gc-l3)]">
                    <Music className="size-6 text-[var(--gc-text-2)]" />
                </span>
            )}
            <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">
                    {track.title}
                </p>
                <p className="truncate text-sm text-[var(--gc-text-2)]">
                    {track.artist}
                </p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--gc-l3)]">
                    <div
                        className="h-full rounded-full bg-[var(--gc-accent)]"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
                <button
                    type="button"
                    onClick={prev}
                    aria-label={tr('Попередній трек')}
                    className="gc-widget-tool"
                >
                    <SkipBack className="size-4" />
                </button>
                <button
                    type="button"
                    onClick={toggle}
                    aria-label={player.playing ? tr('Пауза') : tr('Грати')}
                    className="gc-player-widget__play"
                >
                    {player.playing ? (
                        <Pause className="size-5" />
                    ) : (
                        <Play className="size-5" />
                    )}
                </button>
                <button
                    type="button"
                    onClick={next}
                    aria-label={tr('Наступний трек')}
                    className="gc-widget-tool"
                >
                    <SkipForward className="size-4" />
                </button>
            </div>
        </section>
    );
}

type LobbyCategory = {
    key: string;
    label: string;
    new?: boolean;
    subs: { key: string; label: string; new?: boolean }[];
};

/** Нова (за останні 7 днів) категорія чи підкатегорія — червона бірка «New!». */
export function isNewIn(
    catalog: LobbyCategory[],
    category: string,
    sub?: string,
): boolean {
    const c = catalog.find((x) => x.key === category);
    if (!c) return false;
    return !!c.new || (!!sub && !!c.subs.find((s) => s.key === sub)?.new);
}

function NewTag() {
    return <span className="gc-new-tag">New!</span>;
}

/** Компактна стрічка (№297): щільніші картки й менші медіа — більше на екрані. */
function CompactToggle() {
    const { auth } = usePage().props;
    const [on, setOn] = useState(!!auth.user.feed_compact);
    useEffect(() => {
        document.documentElement.classList.toggle('gc-compact', on);
    }, [on]);
    const toggle = () => {
        const next = !on;
        setOn(next);
        api('PUT', '/settings/density', { compact: next }).catch(() => {
            setOn(!next);
            toast.error(tr('Не вдалося зберегти.'));
        });
    };

    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={toggle}
            className={cn('gc-ghost-btn', on && 'text-[var(--gc-text)]')}
        >
            <Rows3 className="size-4" />
            {on ? tr('Компактно') : tr('Просторо')}
        </button>
    );
}

/** Чи показувати блок: увімкнена категорія і (якщо є) її підкатегорія. */
export function shownIn(
    selected: string[],
    category: string,
    sub?: string,
): boolean {
    if (!selected.includes(category)) return false;
    return sub ? selected.includes(`${category}.${sub}`) : true;
}

/**
 * Вибір категорій лобі: людина вмикає категорії й підкатегорії — блоки з’являються самі,
 * коли в них щось відбувається. Окремі блоки обирати не треба.
 */
export function CategoryPicker({
    selected,
    onChange,
}: {
    selected: string[];
    onChange: (next: string[]) => void;
}) {
    // Каталог розділів і їхнього функціоналу — із сервера (config/lobby.php), уже з урахуванням режиму.
    const all: LobbyCategory[] = usePage().props.engagement?.catalog ?? [];
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const save = (next: string[]) => {
        const previous = selected;
        onChange(next);
        setSaving(true);
        api('PUT', '/settings/lobby-categories', { categories: next })
            .catch(() => {
                onChange(previous);
                toast.error(tr('Не вдалося зберегти лобі.'));
            })
            .finally(() => setSaving(false));
    };
    const toggleCategory = (c: LobbyCategory) => {
        const subs = c.subs.map((s) => `${c.key}.${s.key}`);
        if (selected.includes(c.key)) {
            save(selected.filter((k) => k !== c.key));
        } else {
            // Увімкнули категорію без жодної підкатегорії — вмикаємо всі.
            const hasSub = subs.some((k) => selected.includes(k));
            save([...selected, c.key, ...(hasSub ? [] : subs)]);
        }
    };
    const toggleSub = (key: string) =>
        save(
            selected.includes(key)
                ? selected.filter((k) => k !== key)
                : [...selected, key],
        );

    return (
        <div className="mt-5">
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpen((v) => !v)}
                    data-tour="categories"
                    className="gc-ghost-btn"
                >
                    <LayoutGrid className="size-4" />
                    {open ? tr('Готово') : tr('Що показувати')}
                </button>
                <CompactToggle />
            </div>
            {open && (
                <ul
                    className="mt-3 grid gap-2 sm:grid-cols-2"
                    aria-busy={saving}
                    data-test="lobby-categories"
                >
                    {all.map((c) => {
                        const on = selected.includes(c.key);
                        return (
                            <li key={c.key} className="gc-cat-group">
                                <button
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => toggleCategory(c)}
                                    className={cn(
                                        'gc-cat-chip is-main',
                                        on && 'is-on',
                                    )}
                                >
                                    {on ? (
                                        <Eye className="size-3.5" />
                                    ) : (
                                        <EyeOff className="size-3.5" />
                                    )}
                                    {tr(c.label)}
                                    {c.new && <NewTag />}
                                </button>
                                {on && c.subs.length > 1 && (
                                    <span className="flex flex-wrap gap-1">
                                        {c.subs.map((sub) => {
                                            const key = `${c.key}.${sub.key}`;
                                            const subOn =
                                                selected.includes(key);
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    aria-pressed={subOn}
                                                    onClick={() =>
                                                        toggleSub(key)
                                                    }
                                                    className={cn(
                                                        'gc-cat-chip is-sub',
                                                        subOn && 'is-on',
                                                    )}
                                                >
                                                    {tr(sub.label)}
                                                    {sub.new && <NewTag />}
                                                </button>
                                            );
                                        })}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
