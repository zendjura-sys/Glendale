import { Link, router, usePage } from '@inertiajs/react';
import {
    ChevronDown,
    LayoutDashboard,
    LayoutGrid,
    LogOut,
    Megaphone,
    PanelBottom,
    MessageCircle,
    Settings,
    ShieldCheck,
    UserRound,
    UsersRound,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { Aurora } from '@/components/gc/aurora';
import { IncomingCall } from '@/components/gc/incoming-call';
import { InboxListener } from '@/components/gc/inbox-listener';
import { Logo, LogoMark } from '@/components/gc/logo';
import { ModuleIcon } from '@/components/gc/module-icon';
import { NotificationsMenu } from '@/components/gc/notifications-menu';
import { QuickSearch } from '@/components/gc/quick-search';
import { UserAvatar } from '@/components/gc/user-avatar';
import { VoiceBar } from '@/components/gc/voice-bar';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import { PlayerBar } from '@/components/music/player-bar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useUnreadMessages } from '@/lib/inbox';
import { usePlayer } from '@/lib/player';
import { MOBILE_LABEL } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { PageTransition } from '@/components/gc/page-transition';
import { PlayStoreLink } from '@/components/gc/play-store';

function useIsActive() {
    const { currentUrl } = useCurrentUrl();
    const { auth } = usePage().props;

    return (href: string, key?: string) => {
        if (key === 'profile') {
            return currentUrl === `/${auth.user?.username}`;
        }

        return (
            currentUrl === href ||
            currentUrl.startsWith(`${href}/`) ||
            currentUrl.startsWith(`${href}?`)
        );
    };
}

function Sidebar() {
    const { nav, auth, counters } = usePage().props;
    const isActive = useIsActive();
    const unreadMessages = useUnreadMessages();
    const user = auth.user;

    return (
        <aside className="sticky top-[76px] hidden h-[calc(100dvh-92px)] w-[232px] shrink-0 flex-col [view-transition-name:gc-sidebar] lg:flex">
            <Link
                href={`/${user.username}`}
                className="glass group mb-3 flex items-center gap-3 rounded-2xl p-3 transition hover:border-white/15"
            >
                <UserAvatar user={user} size="md" ring />
                <span className="min-w-0">
                    <span className="flex items-center gap-1 truncate text-sm font-semibold text-white">
                        {user.first_name}
                        {user.is_verified && (
                            <VerifiedBadge className="size-3.5" />
                        )}
                    </span>
                    <span className="block truncate text-xs text-white/45">
                        @{user.username}
                    </span>
                </span>
            </Link>

            <nav className="glass flex flex-col gap-0.5 rounded-2xl p-2">
                {nav.map((item) => {
                    const href =
                        item.key === 'profile'
                            ? `/${user.username}`
                            : item.href;
                    const active = isActive(href, item.key);
                    const badge =
                        item.key === 'friends'
                            ? counters?.friend_requests
                            : item.key === 'messages'
                              ? unreadMessages
                              : 0;

                    return (
                        <Link
                            key={item.key}
                            href={href}
                            prefetch
                            className={cn(
                                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition',
                                active
                                    ? 'nav-active text-white'
                                    : 'text-white/65 hover:bg-white/[0.045] hover:text-white',
                            )}
                        >
                            <ModuleIcon
                                name={item.icon}
                                className={cn(
                                    'size-[19px] transition',
                                    active
                                        ? 'text-[#8fa0ff] drop-shadow-[0_0_8px_rgb(124_140_255/0.9)]'
                                        : 'text-white/45 group-hover:text-white/80',
                                )}
                            />
                            <span className="flex-1">{item.label}</span>
                            {!!badge && (
                                <span className="rounded-full bg-gradient-brand px-1.5 text-[11px] leading-5 font-bold text-white">
                                    {badge}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {user.is_admin && (
                <Link
                    href="/admin"
                    className="glass mt-3 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white/70 transition hover:text-white"
                >
                    <ShieldCheck className="size-[18px] text-gold" />
                    Адмін-панель
                </Link>
            )}

            <PlayStoreLink compact className="mt-3 self-center" />

            <div className="mt-auto px-3 pt-4 text-[11px] leading-relaxed text-white/30">
                © {new Date().getFullYear()} GameCon · Соціальна мережа нового
                покоління
            </div>
        </aside>
    );
}

function UserMenu() {
    const { auth } = usePage().props;
    const user = auth.user;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl py-1 pr-2 pl-1 transition outline-none hover:bg-white/[0.06] data-[state=open]:bg-white/[0.07]">
                <UserAvatar user={user} size="sm" showOnline={false} />
                <span className="hidden text-left leading-tight xl:block">
                    <span className="block text-[13px] font-semibold text-white">
                        {user.first_name}
                    </span>
                    <span className="block text-[11px] text-white/45">
                        {user.is_admin
                            ? 'Адміністратор'
                            : user.role === 'moderator'
                              ? 'Модератор'
                              : 'Учасник'}
                    </span>
                </span>
                <ChevronDown className="hidden size-4 text-white/40 xl:block" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="glass-strong w-60 rounded-2xl border-white/10 p-1.5 text-white"
            >
                <Link
                    href={`/${user.username}`}
                    className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-white/5"
                >
                    <UserAvatar user={user} size="md" showOnline={false} />
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                            {user.name}
                        </span>
                        <span className="block truncate text-xs text-white/45">
                            {user.email}
                        </span>
                    </span>
                </Link>
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuItem
                    asChild
                    className="rounded-lg focus:bg-white/[0.06]"
                >
                    <Link href={`/${user.username}`}>
                        <UserRound /> Моя сторінка
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                    asChild
                    className="rounded-lg focus:bg-white/[0.06]"
                >
                    <Link href="/settings/profile">
                        <Settings /> Налаштування
                    </Link>
                </DropdownMenuItem>
                {user.is_admin && (
                    <DropdownMenuItem
                        asChild
                        className="rounded-lg focus:bg-white/[0.06]"
                    >
                        <Link href="/admin">
                            <LayoutDashboard /> Адмін-панель
                        </Link>
                    </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuItem
                    className="rounded-lg text-rose-300 focus:bg-rose-500/10 focus:text-rose-200"
                    onSelect={() => router.post('/logout')}
                >
                    <LogOut className="text-rose-300" /> Вийти
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function Topbar() {
    const { counters, modules } = usePage().props;
    const unreadMessages = useUnreadMessages();

    return (
        <header className="pointer-events-none fixed inset-x-0 top-0 z-40 bg-transparent [view-transition-name:gc-topbar]">
            <div className="pointer-events-auto mx-auto flex h-16 max-w-[1320px] items-center gap-2 px-3 sm:gap-4 sm:px-5">
                <Link href="/feed" className="shrink-0 lg:w-[232px]">
                    <Logo className="hidden sm:inline-flex" />
                    <LogoMark className="sm:hidden" />
                </Link>
                <QuickSearch className="max-w-[520px] flex-1" />
                <div className="ml-auto flex items-center gap-1">
                    <Link
                        href="/friends?tab=requests"
                        className="relative hidden size-10 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/[0.06] hover:text-white sm:flex"
                        aria-label="Заявки в друзі"
                    >
                        <UsersRound className="size-[19px]" />
                        {!!counters?.friend_requests && (
                            <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-gradient-brand px-1 text-[10px] leading-4 font-bold text-white">
                                {counters.friend_requests}
                            </span>
                        )}
                    </Link>
                    {modules.includes('messages') && (
                        <Link
                            href="/messages"
                            className="relative hidden size-10 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/[0.06] hover:text-white sm:flex"
                            aria-label="Повідомлення"
                        >
                            <MessageCircle className="size-[19px]" />
                            {unreadMessages > 0 && (
                                <span className="absolute top-1.5 right-1.5 flex min-w-4 animate-in items-center justify-center rounded-full bg-gradient-brand px-1 text-[10px] leading-4 font-bold text-white shadow-[0_0_12px_rgb(124_140_255/0.9)] zoom-in-50">
                                    {unreadMessages > 99
                                        ? '99+'
                                        : unreadMessages}
                                </span>
                            )}
                        </Link>
                    )}
                    <NotificationsMenu />
                    <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
                    <UserMenu />
                </div>
            </div>
        </header>
    );
}

function useNavItems() {
    const { nav, auth, counters } = usePage().props;
    const unreadMessages = useUnreadMessages();

    return nav.map((item) => ({
        ...item,
        href: item.key === 'profile' ? `/${auth.user.username}` : item.href,
        badge:
            item.key === 'friends'
                ? (counters?.friend_requests ?? 0)
                : item.key === 'messages'
                  ? unreadMessages
                  : 0,
    }));
}

/** Закріплені користувачем розділи — у панелі (в його порядку), решта — у «Меню». */
function useMobileSplit<T extends { key: string }>(items: T[]) {
    const { auth } = usePage().props;
    const tabs = auth.user.nav_tabs ?? [];
    const primary = tabs
        .map((key) => items.find((i) => i.key === key))
        .filter((i): i is T => i !== undefined);

    return { primary, rest: items.filter((i) => !primary.includes(i)) };
}

function MobileNav() {
    const isActive = useIsActive();
    const items = useNavItems();
    const [open, setOpen] = useState(false);

    const { primary, rest } = useMobileSplit(items);
    const restActive = rest.some((i) => isActive(i.href, i.key));
    const restBadge = rest.reduce((sum, i) => sum + i.badge, 0);

    return (
        <>
            <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0f0a1e]/60 pb-[env(safe-area-inset-bottom)] backdrop-blur-md [view-transition-name:gc-tabbar] lg:hidden">
                <div className="flex items-stretch justify-around">
                    {primary.map((item) => {
                        const active = isActive(item.href, item.key);

                        return (
                            <Link
                                key={item.key}
                                href={item.href}
                                className={cn(
                                    'relative flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition active:scale-95',
                                    active ? 'text-white' : 'text-white/45',
                                )}
                            >
                                {item.badge > 0 && (
                                    <span className="absolute top-1 left-1/2 ml-1.5 min-w-4 rounded-full bg-gradient-brand px-1 text-center text-[10px] leading-4 font-bold text-white">
                                        {item.badge > 99 ? '99+' : item.badge}
                                    </span>
                                )}
                                <ModuleIcon
                                    name={item.icon}
                                    className={cn(
                                        'size-5',
                                        active &&
                                            'text-[#8fa0ff] drop-shadow-[0_0_8px_rgb(124_140_255/0.9)]',
                                    )}
                                />
                                <span className="max-w-full truncate px-0.5">
                                    {MOBILE_LABEL[item.key] ?? item.label}
                                </span>
                            </Link>
                        );
                    })}
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        aria-expanded={open}
                        data-test="mobile-menu"
                        className={cn(
                            'relative flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition active:scale-95',
                            open || restActive ? 'text-white' : 'text-white/45',
                        )}
                    >
                        {restBadge > 0 && (
                            <span className="absolute top-1 left-1/2 ml-1.5 min-w-4 rounded-full bg-gradient-brand px-1 text-center text-[10px] leading-4 font-bold text-white">
                                {restBadge}
                            </span>
                        )}
                        <LayoutGrid
                            className={cn(
                                'size-5',
                                (open || restActive) &&
                                    'text-[#8fa0ff] drop-shadow-[0_0_8px_rgb(124_140_255/0.9)]',
                            )}
                        />
                        Меню
                    </button>
                </div>
            </nav>
            {open && <MobileMenu onClose={() => setOpen(false)} />}
        </>
    );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
    const { auth } = usePage().props;
    const user = auth.user;
    const isActive = useIsActive();
    const { rest: items } = useMobileSplit(useNavItems());

    useEffect(() => {
        const offNavigate = router.on('start', onClose);
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);

        return () => {
            offNavigate();
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = overflow;
        };
    }, [onClose]);

    const extra = [
        {
            href: '/settings/navigation',
            label: 'Налаштувати нижню панель',
            icon: PanelBottom,
        },
        { href: '/settings/profile', label: 'Налаштування', icon: Settings },
        ...(user.is_admin
            ? [{ href: '/admin', label: 'Адмін-панель', icon: ShieldCheck }]
            : []),
    ];

    return (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal>
            <button
                type="button"
                aria-label="Закрити меню"
                onClick={onClose}
                className="absolute inset-0 animate-in bg-black/60 backdrop-blur-sm fade-in-0"
            />
            <div className="glass-strong absolute inset-x-0 bottom-0 max-h-[88dvh] animate-in overflow-y-auto overscroll-contain rounded-t-3xl border-t border-white/10 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+1rem)] duration-200 slide-in-from-bottom">
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />

                <div className="mb-4 flex items-center gap-3">
                    <Link
                        href={`/${user.username}`}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-white/[0.04] p-3"
                    >
                        <UserAvatar user={user} size="md" ring />
                        <span className="min-w-0">
                            <span className="flex items-center gap-1 truncate text-sm font-semibold text-white">
                                {user.name}
                                {user.is_verified && (
                                    <VerifiedBadge className="size-3.5" />
                                )}
                            </span>
                            <span className="block truncate text-xs text-white/45">
                                @{user.username}
                            </span>
                        </span>
                    </Link>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Закрити"
                        className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.04] text-white/60"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4">
                    {items.map((item) => {
                        const active = isActive(item.href, item.key);

                        return (
                            <Link
                                key={item.key}
                                href={item.href}
                                className={cn(
                                    'relative flex aspect-[1/0.9] flex-col items-center justify-center gap-2 rounded-2xl border p-2 text-center text-[12px] leading-tight font-medium transition active:scale-[0.97]',
                                    active
                                        ? 'nav-active border-[#8fa0ff]/30 text-white'
                                        : 'border-white/[0.06] bg-white/[0.03] text-white/75 active:bg-white/[0.08]',
                                )}
                            >
                                {item.badge > 0 && (
                                    <span className="absolute top-2 right-2 min-w-5 rounded-full bg-gradient-brand px-1.5 text-[11px] leading-5 font-bold text-white">
                                        {item.badge}
                                    </span>
                                )}
                                <ModuleIcon
                                    name={item.icon}
                                    className={cn(
                                        'size-6',
                                        active
                                            ? 'text-[#8fa0ff] drop-shadow-[0_0_8px_rgb(124_140_255/0.9)]'
                                            : 'text-[#a9b4ff]',
                                    )}
                                />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>

                <div className="mt-4 grid gap-1 rounded-2xl bg-white/[0.03] p-1.5">
                    {extra.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-white/80 active:bg-white/[0.06]"
                        >
                            <link.icon className="size-[18px] text-white/50" />
                            {link.label}
                        </Link>
                    ))}
                    <PlayStoreLink
                        compact
                        className="mx-1.5 my-1.5 justify-self-start"
                    />
                    <button
                        type="button"
                        onClick={() => router.post('/logout')}
                        className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-rose-300 active:bg-rose-500/10"
                    >
                        <LogOut className="size-[18px]" />
                        Вийти
                    </button>
                </div>
            </div>
        </div>
    );
}

function Announcement() {
    const { site } = usePage().props;

    if (!site.announcement) {
        return null;
    }

    return (
        <div className="gradient-border glass mb-4 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm text-white/80">
            <Megaphone className="mt-0.5 size-4 shrink-0 text-[#a58bff]" />
            <p className="leading-relaxed whitespace-pre-line">
                {site.announcement}
            </p>
        </div>
    );
}

export default function SocialLayout({ children }: PropsWithChildren) {
    const { auth, modules } = usePage().props;
    const { current } = usePlayer();

    return (
        <div className="relative min-h-dvh">
            {modules.includes('messages') && (
                <>
                    <InboxListener userId={auth.user.id} />
                    <IncomingCall userId={auth.user.id} />
                </>
            )}
            <Aurora />
            <Topbar />
            <div
                className={cn(
                    'mx-auto flex max-w-[1320px] gap-5 px-3 pt-[76px] sm:px-5',
                    current ? 'pb-44 lg:pb-28' : 'pb-24 lg:pb-10',
                )}
            >
                <Sidebar />
                <main className="min-w-0 flex-1 [view-transition-name:gc-main]">
                    <Announcement />
                    <PageTransition>{children}</PageTransition>
                </main>
            </div>
            <VoiceBar />
            {modules.includes('music') && <PlayerBar />}
            <MobileNav />
        </div>
    );
}
