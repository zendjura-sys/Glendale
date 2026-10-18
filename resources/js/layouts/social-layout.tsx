import { Link, router, usePage } from '@inertiajs/react';
import {
    Bookmark,
    UserPlus,
    ChevronDown,
    Keyboard,
    LayoutDashboard,
    LayoutGrid,
    LogOut,
    Megaphone,
    PanelBottom,
    MessageCircle,
    MessageSquareHeart,
    Settings,
    ShieldCheck,
    UserRound,
    UsersRound,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';
import { LayoutGroup, m, useReducedMotion } from 'motion/react';
import { SiteBackground } from '@/components/backgrounds/site-background';
import { Seasonal } from '@/components/gc/seasonal';
import { IncomingCall } from '@/components/gc/incoming-call';
import { InboxListener } from '@/components/gc/inbox-listener';
import { Logo, LogoMark } from '@/components/gc/logo';
import { ModuleIcon } from '@/components/gc/module-icon';
import { NotificationsMenu } from '@/components/gc/notifications-menu';
import { QuickSearch } from '@/components/gc/quick-search';
import { UserAvatar } from '@/components/gc/user-avatar';
import { VoiceBar } from '@/components/gc/voice-bar';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import { BillingHost } from '@/components/billing/billing-host';
import { PhonePrompt } from '@/components/phone/phone-prompt';
import { PlusMenuCard } from '@/components/gc/plus-card';
import { PlusBadge, plusNameProps, plusNameStyle } from '@/components/gc/plus';
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
import { motionOr, SNAP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { PageTransition } from '@/components/gc/page-transition';
import { PlayStoreLink } from '@/components/gc/play-store';
import {
    LanguageMenu,
    LanguageSelect,
} from '@/components/gc/language-switcher';
import { tr } from '@/lib/i18n';
import { PaletteSync } from '@/components/gc/palette-sync';
import {
    FeedbackDialog,
    KeyboardHint,
    KeyboardShortcuts,
    WhatsNewButton,
    openFeedback,
    openShortcuts,
} from '@/components/gc/site-extras';
import { SiteFooter } from '@/components/gc/site-footer';

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
                        <span style={plusNameStyle(user.plus)}>
                            {user.first_name}
                        </span>
                        {user.is_verified && (
                            <VerifiedBadge className="size-3.5" />
                        )}
                        {user.plus && <PlusBadge className="size-3.5" />}
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
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                                'group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition',
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
                                        ? 'text-gc-lilac-400 drop-shadow-[0_0_8px_rgb(124_140_255/0.9)]'
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
                    {tr('Адмін-панель')}
                </Link>
            )}

            <PlayStoreLink compact className="mt-3 self-center" />

            <KeyboardHint />

            <div className="mt-auto px-3 pt-4 text-xs leading-relaxed text-white/30">
                © {new Date().getFullYear()}{' '}
                {tr('GameCon · Соціальна мережа нового покоління')}
            </div>
        </aside>
    );
}

function UserMenu() {
    const { auth } = usePage().props;
    const user = auth.user;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                aria-label={tr('Меню облікового запису')}
                className="flex min-h-11 items-center gap-2 rounded-xl py-1 pr-2 pl-1 transition outline-none hover:bg-white/[0.06] data-[state=open]:bg-white/[0.07]"
            >
                <UserAvatar user={user} size="sm" showOnline={false} />
                <span className="hidden text-left leading-tight xl:block">
                    <span className="block text-[13px] font-semibold text-white">
                        {user.first_name}
                    </span>
                    <span className="block text-xs text-white/45">
                        {user.is_admin
                            ? tr('Адміністратор')
                            : user.role === 'moderator'
                              ? tr('Модератор')
                              : tr('Учасник')}
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
                        <UserRound /> {tr('Моя сторінка')}
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                    asChild
                    className="rounded-lg focus:bg-white/[0.06]"
                >
                    <Link href="/saved">
                        <Bookmark /> {tr('Збережене')}
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                    asChild
                    className="rounded-lg focus:bg-white/[0.06]"
                >
                    <Link href="/settings/profile">
                        <Settings /> {tr('Налаштування')}
                    </Link>
                </DropdownMenuItem>
                {user.is_admin && (
                    <DropdownMenuItem
                        asChild
                        className="rounded-lg focus:bg-white/[0.06]"
                    >
                        <Link href="/admin">
                            <LayoutDashboard /> {tr('Адмін-панель')}
                        </Link>
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem
                    className="rounded-lg focus:bg-white/[0.06]"
                    onSelect={openFeedback}
                >
                    <MessageSquareHeart /> {tr('Відгук адмінам')}
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="hidden rounded-lg focus:bg-white/[0.06] lg:flex"
                    onSelect={openShortcuts}
                >
                    <Keyboard /> {tr('Гарячі клавіші')}
                </DropdownMenuItem>
                <LanguageMenu />
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuItem
                    className="rounded-lg text-rose-300 focus:bg-rose-500/10 focus:text-rose-200"
                    onSelect={() => router.post('/logout')}
                >
                    <LogOut className="text-rose-300" /> {tr('Вийти')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function Topbar() {
    const { counters, modules } = usePage().props;
    const unreadMessages = useUnreadMessages();

    return (
        <header className="pointer-events-none fixed inset-x-0 top-0 z-40 bg-transparent pt-[env(safe-area-inset-top)] [view-transition-name:gc-topbar]">
            {/* Шапка — острів: плаваюча матова плита з відступом від країв (стиль Dune). */}
            <div className="liquid-glass liquid-glass--dense pointer-events-auto relative mx-2 mt-2 flex h-14 items-center gap-2 rounded-[22px] px-2 sm:mx-3 sm:gap-4 sm:px-3 xl:mx-auto xl:max-w-[1320px]">
                <Link href="/feed" className="shrink-0 lg:w-[232px]">
                    <Logo className="hidden sm:inline-flex" />
                    <LogoMark className="sm:hidden" />
                </Link>
                <QuickSearch className="max-w-[520px] flex-1" />
                <div className="ml-auto flex items-center gap-1">
                    <Link
                        href="/friends?tab=requests"
                        className="relative hidden size-10 items-center justify-center rounded-full bg-black/25 text-white/75 ring-1 ring-white/[0.06] transition hover:bg-black/40 hover:text-white sm:flex"
                        aria-label={tr('Заявки в друзі')}
                    >
                        <UsersRound className="size-[19px]" />
                        {!!counters?.friend_requests && (
                            <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-gradient-brand px-1 text-[11px] leading-4 font-bold text-white">
                                {counters.friend_requests}
                            </span>
                        )}
                    </Link>
                    {modules.includes('messages') && (
                        <Link
                            href="/messages"
                            className="relative hidden size-10 items-center justify-center rounded-full bg-black/25 text-white/75 ring-1 ring-white/[0.06] transition hover:bg-black/40 hover:text-white sm:flex"
                            aria-label={
                                unreadMessages > 0
                                    ? tr('Повідомлення: {count} непрочитаних', {
                                          count: unreadMessages,
                                      })
                                    : tr('Повідомлення')
                            }
                        >
                            <MessageCircle className="size-[19px]" />
                            {unreadMessages > 0 && (
                                <span
                                    aria-hidden
                                    className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] animate-in items-center justify-center rounded-full bg-gradient-brand px-1 text-[11px] leading-none font-bold text-white ring-2 ring-background zoom-in-50"
                                >
                                    {unreadMessages > 99
                                        ? '99+'
                                        : unreadMessages}
                                </span>
                            )}
                        </Link>
                    )}
                    <WhatsNewButton />
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

/** Пункт острова: іконка; вибраний — пігулка акценту з підписом, що «перетікає» між пунктами. */
function IslandTab({
    href,
    onClick,
    expanded,
    active,
    badge,
    label,
    icon,
}: {
    href?: string;
    onClick?: () => void;
    expanded?: boolean;
    active: boolean;
    badge: number;
    label: string;
    icon: ReactNode;
}) {
    const reduce = useReducedMotion();
    const className = cn(
        'relative flex h-11 min-w-11 items-center justify-center rounded-2xl text-sm font-semibold transition-colors active:scale-95',
        active
            ? 'max-w-[45%] flex-none px-2 text-primary-foreground'
            : 'flex-1 bg-black/25 text-white/60 ring-1 ring-white/[0.05]',
    );
    const body = (
        <>
            {active && (
                <m.span
                    layoutId="tabbar-active"
                    transition={motionOr(reduce, SNAP)}
                    className="absolute inset-0 rounded-2xl bg-primary"
                />
            )}
            <span className="relative flex min-w-0 items-center gap-2 px-2">
                <span className="relative shrink-0">
                    {icon}
                    {badge > 0 && (
                        <span className="absolute -top-1.5 -right-2 min-w-4 rounded-full bg-gc-pink px-1 text-center text-[10px] leading-4 font-bold text-white ring-2 ring-popover">
                            {badge > 99 ? '99+' : badge}
                        </span>
                    )}
                </span>
                {active && (
                    <m.span
                        initial={reduce ? false : { opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: 0.08 }}
                        className="truncate"
                    >
                        {label}
                    </m.span>
                )}
            </span>
        </>
    );

    return href ? (
        <Link
            href={href}
            // На телефоні наведення немає: сторінку підтягуємо вже на дотику, до відпускання пальця.
            prefetch={['hover', 'click']}
            aria-current={active ? 'page' : undefined}
            aria-label={label}
            className={className}
        >
            {body}
        </Link>
    ) : (
        <button
            type="button"
            onClick={onClick}
            aria-expanded={expanded}
            aria-label={label}
            data-test="mobile-menu"
            className={className}
        >
            {body}
        </button>
    );
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
            {/* Острів: плаваюча пігулка над краєм екрана; вибраний пункт розкривається з підписом. */}
            <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.625rem)] [view-transition-name:gc-tabbar] lg:hidden">
                <LayoutGroup id="tabbar">
                    <div className="liquid-glass liquid-glass--dense pointer-events-auto flex w-full max-w-[440px] items-center justify-between gap-1 rounded-[22px] p-1.5">
                        {primary.map((item) => (
                            <IslandTab
                                key={item.key}
                                href={item.href}
                                active={isActive(item.href, item.key)}
                                badge={item.badge}
                                label={MOBILE_LABEL[item.key] ?? item.label}
                                icon={
                                    <ModuleIcon
                                        name={item.icon}
                                        className="size-5"
                                    />
                                }
                            />
                        ))}
                        <IslandTab
                            onClick={() => setOpen(true)}
                            expanded={open}
                            active={open || restActive}
                            badge={restBadge}
                            label={tr('Меню')}
                            icon={<LayoutGrid className="size-5" />}
                        />
                    </div>
                </LayoutGroup>
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
            href: '/invite',
            label: tr('Запросити друзів'),
            icon: UserPlus,
        },
        {
            href: '/saved',
            label: tr('Збережене'),
            icon: Bookmark,
        },
        {
            href: '/settings/navigation',
            label: tr('Налаштувати нижню панель'),
            icon: PanelBottom,
        },
        {
            href: '/settings/profile',
            label: tr('Налаштування'),
            icon: Settings,
        },
        ...(user.is_admin
            ? [{ href: '/admin', label: tr('Адмін-панель'), icon: ShieldCheck }]
            : []),
    ];

    return (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal>
            <button
                type="button"
                aria-label={tr('Закрити меню')}
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
                                <span {...plusNameProps(user.plus)}>
                                    {user.name}
                                </span>
                                {user.is_verified && (
                                    <VerifiedBadge className="size-3.5" />
                                )}
                                {user.plus && (
                                    <PlusBadge className="size-3.5" />
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
                        aria-label={tr('Закрити')}
                        className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.04] text-white/60"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                <PlusMenuCard until={user.plus_until} className="mb-4" />

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
                                        ? 'nav-active border-gc-lilac-400/30 text-white'
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
                                            ? 'text-gc-lilac-400 drop-shadow-[0_0_8px_rgb(124_140_255/0.9)]'
                                            : 'text-gc-lilac-200',
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
                    <LanguageSelect className="mx-3 my-1.5" />
                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            openFeedback();
                        }}
                        className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-white/80 active:bg-white/[0.06]"
                    >
                        <MessageSquareHeart className="size-[18px] text-white/50" />
                        {tr('Відгук адмінам')}
                    </button>
                    <button
                        type="button"
                        onClick={() => router.post('/logout')}
                        className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-rose-300 active:bg-rose-500/10"
                    >
                        <LogOut className="size-[18px]" />
                        {tr('Вийти')}
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
            <Megaphone
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-gc-violet-300"
            />
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
            <PaletteSync />
            {modules.includes('messages') && (
                <>
                    <InboxListener userId={auth.user.id} />
                    <IncomingCall userId={auth.user.id} />
                </>
            )}
            <SiteBackground />
            <Seasonal />
            <Topbar />
            <div
                className={cn(
                    'mx-auto flex max-w-[1320px] gap-5 px-3 pt-[calc(76px+env(safe-area-inset-top))] sm:px-5',
                    current ? 'pb-44 lg:pb-28' : 'pb-24 lg:pb-10',
                )}
            >
                <Sidebar />
                <main
                    id="main-content"
                    className="min-w-0 flex-1 [view-transition-name:gc-main]"
                >
                    <Announcement />
                    <PageTransition>{children}</PageTransition>
                    <SiteFooter />
                </main>
            </div>
            <VoiceBar />
            {modules.includes('music') && <PlayerBar />}
            <BillingHost />
            <PhonePrompt />
            <MobileNav />
            <FeedbackDialog />
            <KeyboardShortcuts username={auth.user.username} />
        </div>
    );
}
