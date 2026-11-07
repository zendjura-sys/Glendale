import { Link, usePage } from '@inertiajs/react';
import {
    ChevronDown,
    Flame,
    Gamepad2,
    Headphones,
    Music2,
    ShieldCheck,
    Trophy,
    UsersRound,
} from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ModuleIcon } from '@/components/gc/module-icon';
import { plusNameProps } from '@/components/gc/plus';
import { useRail } from '@/components/gc/rail-widgets';
import { RpDossier } from '@/components/gc/rp-dossier';
import type { RailData } from '@/components/gc/rail-widgets';
import { UserAvatar } from '@/components/gc/user-avatar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useUnreadMessages } from '@/lib/inbox';
import { tr } from '@/lib/i18n';
import { playQueue } from '@/lib/player';
import { cn } from '@/lib/utils';
import type { TrackCard } from '@/types';

/** Основні розділи — великими плитками, решта — у групі, що розгортається. */
const MAIN = [
    'feed',
    'messages',
    'friends',
    'communities',
    'families',
    'servers',
];
const OPEN_KEY = 'gc.dock.more';

/** Непрозора матова картка лівої колонки (рівень 1). */
function DockCard({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn('gc-solid rounded-2xl p-4', className)}>
            {children}
        </section>
    );
}

function Stat({
    icon,
    value,
    label,
}: {
    icon: ReactNode;
    value: ReactNode;
    label: string;
}) {
    return (
        <span className="gc-solid-2 flex min-w-0 flex-col items-center rounded-xl px-1 py-2 text-center">
            <span className="flex items-center gap-1 text-sm font-bold text-white tabular-nums [&_svg]:size-3.5">
                {icon}
                {value}
            </span>
            <span className="mt-0.5 w-full truncate text-[11px] text-white/60">
                {label}
            </span>
        </span>
    );
}

/** 1. Картка гравця: аватар з онлайном, нік, у що грає, пісня профілю й три лічильники. */
function PlayerCard({ me }: { me: RailData['me'] }) {
    const user = usePage().props.auth.user;

    return (
        <DockCard>
            <Link
                href={`/${user.username}`}
                className="flex items-center gap-3"
            >
                <UserAvatar user={user} size="md" />
                <span className="min-w-0">
                    <span
                        style={plusNameProps(user.plus).style}
                        className={cn(
                            'block truncate text-[15px] font-semibold text-white',
                            plusNameProps(user.plus).className,
                        )}
                    >
                        {user.first_name} {user.last_name}
                    </span>
                    <span className="flex items-center gap-1 truncate text-xs text-white/60">
                        {me?.playing ? (
                            <>
                                <Gamepad2 className="size-3.5 shrink-0 text-emerald-400" />
                                <span className="truncate">
                                    {me.playing.label}
                                </span>
                            </>
                        ) : (
                            <>@{user.username}</>
                        )}
                    </span>
                </span>
            </Link>
            {me?.track && (
                <button
                    type="button"
                    onClick={() =>
                        playQueue([me.track as unknown as TrackCard], 0)
                    }
                    className="gc-solid-2 mt-3 flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition hover:bg-[var(--gc-l3)]"
                >
                    {me.track.cover_url ? (
                        <img
                            src={me.track.cover_url}
                            alt=""
                            className="size-9 shrink-0 rounded-lg object-cover"
                        />
                    ) : (
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--gc-l3)] text-sky-400">
                            <Music2 className="size-4" />
                        </span>
                    )}
                    <span className="min-w-0">
                        <span className="block text-[11px] text-white/60">
                            {tr('Пісня профілю')}
                        </span>
                        <span className="block truncate text-[13px] font-medium text-white">
                            {me.track.title}
                        </span>
                    </span>
                </button>
            )}
            {me?.family && <RpDossier family={me.family} />}
            <div className="mt-3 grid grid-cols-3 gap-2">
                <Stat
                    icon={<Trophy className="text-amber-400" />}
                    value={me?.level ?? '—'}
                    label={tr('Рівень')}
                />
                <Stat
                    icon={<Flame className="text-orange-400" />}
                    value={me?.streak ?? 0}
                    label={tr('Стрик')}
                />
                {me?.family ? (
                    <Link href={me.family.href} className="min-w-0">
                        <Stat
                            icon={<ShieldCheck className="text-sky-400" />}
                            value=""
                            label={me.family.name}
                        />
                    </Link>
                ) : (
                    <Link href="/families" className="min-w-0">
                        <Stat
                            icon={<ShieldCheck className="text-sky-400" />}
                            value=""
                            label={tr('Сім’я')}
                        />
                    </Link>
                )}
            </div>
        </DockCard>
    );
}

/** 2. Bento-меню: основні розділи плитками 2×3, решта — у групі «Усі розділи», що розгортається. */
function BentoMenu() {
    const { nav, auth, counters } = usePage().props;
    const { currentUrl } = useCurrentUrl();
    const unread = useUnreadMessages();
    const reduce = useReducedMotion();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        try {
            setOpen(window.localStorage.getItem(OPEN_KEY) === '1');
        } catch {
            // без сховища — згорнуто
        }
    }, []);

    const items = nav.map((item) => ({
        ...item,
        href: item.key === 'profile' ? `/${auth.user.username}` : item.href,
        badge:
            item.key === 'friends'
                ? (counters?.friend_requests ?? 0)
                : item.key === 'messages'
                  ? unread
                  : 0,
    }));
    const active = (href: string) =>
        currentUrl === href ||
        currentUrl.startsWith(`${href}/`) ||
        currentUrl.startsWith(`${href}?`);
    const main = MAIN.map((k) => items.find((i) => i.key === k)).filter(
        (i): i is (typeof items)[number] => i !== undefined,
    );
    const rest = items.filter((i) => !main.includes(i) && i.key !== 'profile');

    const tile = (item: (typeof items)[number], big: boolean) => (
        <Link
            key={item.key}
            href={item.href}
            prefetch
            aria-current={active(item.href) ? 'page' : undefined}
            className={cn(
                'relative flex min-w-0 items-center gap-2 rounded-xl transition',
                big ? 'flex-col justify-center px-2 py-3' : 'px-2.5 py-2',
                active(item.href)
                    ? 'bg-[var(--gc-active)] text-sky-400'
                    : 'gc-solid-2 text-white/85 hover:bg-[var(--gc-l3)]',
            )}
        >
            <ModuleIcon
                name={item.icon}
                animated
                size={big ? 22 : 18}
                className="shrink-0"
            />
            <span
                className={cn(
                    'min-w-0 truncate font-medium',
                    big ? 'text-xs' : 'text-[13px]',
                )}
            >
                {item.label}
            </span>
            {item.badge > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-4 rounded-full bg-sky-500 px-1 text-center text-[10px] leading-4 font-bold text-white">
                    {item.badge > 99 ? '99+' : item.badge}
                </span>
            )}
        </Link>
    );

    return (
        <DockCard>
            <nav aria-label={tr('Розділи')}>
                <div className="grid grid-cols-2 gap-2">
                    {main.map((item) => tile(item, true))}
                </div>
                {rest.length > 0 && (
                    <>
                        <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => {
                                setOpen((v) => {
                                    try {
                                        window.localStorage.setItem(
                                            OPEN_KEY,
                                            v ? '0' : '1',
                                        );
                                    } catch {
                                        // не критично
                                    }

                                    return !v;
                                });
                            }}
                            className="mt-3 flex w-full items-center gap-2 px-1 text-xs font-semibold text-white/60 hover:text-white"
                        >
                            {tr('Усі розділи')}
                            <span className="text-white/40 tabular-nums">
                                {rest.length}
                            </span>
                            <ChevronDown
                                className={cn(
                                    'ml-auto size-4 transition-transform',
                                    open && 'rotate-180',
                                )}
                            />
                        </button>
                        {open && (
                            <m.div
                                initial={reduce ? false : { opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-2 grid grid-cols-2 gap-1.5"
                            >
                                {rest.map((item) => tile(item, false))}
                            </m.div>
                        )}
                    </>
                )}
                {auth.user.is_admin && (
                    <Link
                        href="/admin"
                        className="gc-solid-2 mt-2 flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] font-medium text-amber-300 hover:bg-[var(--gc-l3)]"
                    >
                        <ShieldCheck className="size-4" />
                        {tr('Адмін-панель')}
                    </Link>
                )}
            </nav>
        </DockCard>
    );
}

/** 3. «Голосовий штаб / Хто в грі»: кімнати сімей, де зараз говорять, і друзі, що грають. */
function VoiceHub({ data }: { data: RailData | null }) {
    const voice = data?.voice ?? [];
    const inGame = data?.in_game ?? [];
    if (voice.length === 0 && inGame.length === 0) return null;

    return (
        <DockCard>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Headphones className="size-4 text-sky-400" />
                {voice.length > 0 ? tr('Голосовий штаб') : tr('Хто в грі')}
            </h2>
            <div className="space-y-2">
                {voice.map((room) => (
                    <Link
                        key={room.id}
                        href={room.href}
                        className="gc-solid-2 flex items-center gap-2.5 rounded-xl p-2.5 hover:bg-[var(--gc-l3)]"
                    >
                        <span className="relative flex size-2 shrink-0">
                            <span className="size-2 rounded-full bg-emerald-400" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-white">
                                {room.name}
                            </span>
                            <span className="block truncate text-[11px] text-white/60">
                                {room.owner} ·{' '}
                                {tr('{n} у кімнаті', { n: room.count })}
                            </span>
                        </span>
                        <span className="flex -space-x-2">
                            {room.people.map((p) => (
                                <UserAvatar
                                    key={p.id}
                                    user={p}
                                    size="xs"
                                    showOnline={false}
                                />
                            ))}
                        </span>
                    </Link>
                ))}
                {inGame.map((friend) => (
                    <Link
                        key={friend.id}
                        href={`/${friend.username}`}
                        className="flex items-center gap-2.5 rounded-xl p-1.5 hover:bg-[var(--gc-l2)]"
                    >
                        <UserAvatar user={friend} size="sm" />
                        <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium text-white">
                                {friend.first_name || friend.name}
                            </span>
                            <span className="flex items-center gap-1 truncate text-[11px] text-emerald-400">
                                <Gamepad2 className="size-3 shrink-0" />
                                <span className="truncate">
                                    {friend.playing?.label}
                                </span>
                            </span>
                        </span>
                    </Link>
                ))}
            </div>
            {inGame.length > 0 && (
                <Link
                    href="/friends?tab=online"
                    className="mt-3 flex items-center gap-1.5 px-1 text-xs font-medium text-sky-400"
                >
                    <UsersRound className="size-3.5" />
                    {tr('Усі друзі онлайн')}
                </Link>
            )}
        </DockCard>
    );
}

/**
 * Ліва колонка Spatial Arctic (Gamer Dock): три суцільні матові картки — гравець,
 * bento-меню розділів і голосовий штаб. Без скла: текст читається при будь-якому скролі.
 */
export function GamerDock({ footer }: { footer?: ReactNode }) {
    const { data } = useRail();

    return (
        <aside className="sticky top-[calc(88px+env(safe-area-inset-top))] hidden h-[calc(100dvh-104px)] w-[264px] shrink-0 [scrollbar-width:none] flex-col gap-3 overflow-y-auto overscroll-contain pb-4 [view-transition-name:gc-sidebar] md:flex">
            <PlayerCard me={data?.me} />
            <BentoMenu />
            <VoiceHub data={data} />
            {footer}
        </aside>
    );
}
