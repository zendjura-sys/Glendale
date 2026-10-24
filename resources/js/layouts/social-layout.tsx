import { Link, router, usePage } from '@inertiajs/react';
import {
    Bookmark,
    UserPlus,
    ChevronDown,
    Keyboard,
    LayoutDashboard,
    LifeBuoy,
    LogOut,
    Megaphone,
    PanelBottom,
    MessageCircle,
    MessageSquareHeart,
    Settings,
    ShieldCheck,
    UserRound,
    UsersRound,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';
import {
    AnimatePresence,
    m,
    useDragControls,
    useReducedMotion,
} from 'motion/react';
import type { PanInfo } from 'motion/react';
import { motionOr, SNAP } from '@/lib/motion';
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
import { ConnectListener } from '@/components/music/connect-ui';
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
import {
    LanguageMenu,
    LanguageSelect,
} from '@/components/gc/language-switcher';
import { tr } from '@/lib/i18n';
import { PaletteSync } from '@/components/gc/palette-sync';
import {
    ThemeButton,
    ThemeMenuItem,
    ThemeRow,
} from '@/components/gc/theme-toggle';
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

/** Бічне меню, як у класичній соцмережі: простий список без карток, вибраний пункт підсвічено. */
function Sidebar() {
    const { nav, auth, counters } = usePage().props;
    const isActive = useIsActive();
    const unreadMessages = useUnreadMessages();
    const user = auth.user;

    return (
        <aside className="sticky top-[calc(64px+env(safe-area-inset-top))] hidden h-[calc(100dvh-80px)] w-[220px] shrink-0 [scrollbar-width:none] flex-col overflow-y-auto overscroll-contain pb-2 [view-transition-name:gc-sidebar] lg:flex">
            <Link
                href={`/${user.username}`}
                className="gc-side-link mb-1 flex items-center gap-2.5 rounded-xl px-2 py-2 transition"
            >
                <UserAvatar user={user} size="sm" ring />
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

            <nav aria-label={tr('Розділи')} className="flex flex-col">
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
                            className="gc-side-link relative flex min-h-10 items-center gap-3 rounded-xl px-2.5 text-[14px] font-medium transition"
                        >
                            <ModuleIcon
                                name={item.icon}
                                className="size-[19px] shrink-0"
                            />
                            <span className="flex-1 truncate">
                                {item.label}
                            </span>
                            {!!badge && (
                                <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] leading-5 font-bold text-primary-foreground">
                                    {badge > 99 ? '99+' : badge}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {user.is_admin && (
                <>
                    <div className="mx-2.5 my-2 h-px bg-white/[0.06]" />
                    <Link
                        href="/admin"
                        className="gc-side-link flex min-h-10 items-center gap-3 rounded-xl px-2.5 text-[14px] font-medium transition"
                    >
                        <ShieldCheck className="size-[19px] shrink-0 !text-gold" />
                        {tr('Адмін-панель')}
                    </Link>
                </>
            )}

            <PlayStoreLink compact className="mt-3 self-start px-2" />

            <KeyboardHint />

            <div className="mt-auto px-2.5 pt-4 text-xs leading-relaxed text-white/35">
                © {new Date().getFullYear()}{' '}
                {tr('GameCon · Соціальна мережа нового покоління')}
            </div>
        </aside>
    );
}

/** Меню облікового запису (аватар): спільне для шапки сайту й розділу «Музика». */
export function UserMenu() {
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
                    asChild
                    className="rounded-lg focus:bg-white/[0.06]"
                >
                    <Link href="/help">
                        <LifeBuoy /> {tr('Довідка')}
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="hidden rounded-lg focus:bg-white/[0.06] lg:flex"
                    onSelect={openShortcuts}
                >
                    <Keyboard /> {tr('Гарячі клавіші')}
                </DropdownMenuItem>
                <ThemeMenuItem />
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

/** Шапка на всю ширину: матове скло, логотип, пошук і кнопки — як у класичній соцмережі. */
function Topbar() {
    const { counters, modules } = usePage().props;
    const unreadMessages = useUnreadMessages();
    const iconButton =
        'gc-icon-button relative hidden size-10 items-center justify-center rounded-xl transition sm:flex';

    return (
        <header className="pointer-events-none fixed inset-x-0 top-0 z-40 px-3 pt-[calc(env(safe-area-inset-top)+8px)] [view-transition-name:gc-topbar] sm:px-5">
            {/* Шапка — плаваюча капсула з того самого матового скла, що й острів-меню знизу. */}
            <div className="gc-island pointer-events-auto mx-auto flex h-14 max-w-[1320px] items-center gap-2 rounded-full pr-2 pl-3 sm:gap-4 sm:pl-5">
                <Link href="/feed" className="shrink-0 lg:w-[220px]">
                    <Logo className="hidden sm:inline-flex" />
                    <LogoMark className="sm:hidden" />
                </Link>
                <QuickSearch className="max-w-[520px] flex-1" />
                <div className="ml-auto flex items-center gap-0.5">
                    <Link
                        href="/friends?tab=requests"
                        className={iconButton}
                        aria-label={tr('Заявки в друзі')}
                    >
                        <UsersRound className="size-[20px]" />
                        {!!counters?.friend_requests && (
                            <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] leading-4 font-bold text-white">
                                {counters.friend_requests}
                            </span>
                        )}
                    </Link>
                    {modules.includes('messages') && (
                        <Link
                            href="/messages"
                            className={iconButton}
                            aria-label={
                                unreadMessages > 0
                                    ? tr('Повідомлення: {count} непрочитаних', {
                                          count: unreadMessages,
                                      })
                                    : tr('Повідомлення')
                            }
                        >
                            <MessageCircle className="size-[20px]" />
                            {unreadMessages > 0 && (
                                <span
                                    aria-hidden
                                    className="absolute top-0.5 right-0.5 flex h-[18px] min-w-[18px] animate-in items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] leading-none font-bold text-white zoom-in-50"
                                >
                                    {unreadMessages > 99
                                        ? '99+'
                                        : unreadMessages}
                                </span>
                            )}
                        </Link>
                    )}
                    <ThemeButton className="hidden sm:flex" />
                    <WhatsNewButton />
                    <NotificationsMenu />
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

/** Пункт нижньої панелі: іконка й підпис; вибраний — кольором акценту, без підкладок. */
function TabItem({
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
    const className = cn(
        'gc-tab glass-matte-tab relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full pt-1 text-[11px] font-medium transition-colors active:opacity-70',
        active && 'is-active',
    );
    const body = (
        <>
            <span className="relative">
                {icon}
                {badge > 0 && (
                    <span className="absolute -top-1 -right-2.5 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[10px] leading-4 font-bold text-white">
                        {badge > 99 ? '99+' : badge}
                    </span>
                )}
            </span>
            <span className="max-w-full truncate px-0.5">{label}</span>
        </>
    );

    return href ? (
        <Link
            href={href}
            // На телефоні наведення немає: сторінку підтягуємо вже на дотику, до відпускання пальця.
            prefetch={['hover', 'click']}
            aria-current={active ? 'page' : undefined}
            className={className}
        >
            {body}
        </Link>
    ) : (
        <button
            type="button"
            onClick={onClick}
            aria-expanded={expanded}
            data-test="mobile-menu"
            className={className}
        >
            {body}
        </button>
    );
}

/**
 * Нижня панель-острів (як у iOS 26): капсула з вкладками й «язичком» угорі. Замість кнопки «Меню»
 * острів тягнеться вгору — за язичок, свайпом по панелі або тапом — і розгортається в меню з рештою
 * розділів; вкладки лишаються внизу того самого острова. Згорнути: свайп униз, тап по затемненню, Esc.
 */
function MobileNav() {
    const isActive = useIsActive();
    const items = useNavItems();
    const [open, setOpen] = useState(false);
    const reduce = useReducedMotion();
    const drag = useDragControls();
    const close = useCallback(() => setOpen(false), []);

    const { primary, rest } = useMobileSplit(items);
    const restActive = rest.some((i) => isActive(i.href, i.key));
    const restBadge = rest.reduce((sum, i) => sum + i.badge, 0);

    useEffect(() => {
        if (!open) return;
        const offNavigate = router.on('start', close);
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);

        return () => {
            offNavigate();
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = overflow;
        };
    }, [open, close]);

    const onDragEnd = (_: unknown, info: PanInfo) => {
        if (!open && (info.offset.y < -24 || info.velocity.y < -300)) {
            setOpen(true);
        } else if (open && (info.offset.y > 48 || info.velocity.y > 400)) {
            setOpen(false);
        }
    };

    return (
        <>
            <AnimatePresence>
                {open && (
                    <m.button
                        type="button"
                        aria-label={tr('Закрити меню')}
                        onClick={close}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: reduce ? 0 : 0.2 }}
                        className="fixed inset-0 z-[54] bg-black/45 lg:hidden"
                    />
                )}
            </AnimatePresence>
            <nav
                aria-label={tr('Розділи')}
                className={cn(
                    'pointer-events-none fixed inset-x-0 bottom-0 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] lg:hidden',
                    // Розгорнуте меню — над міні-плеєром; згорнута панель — під ним (плеєр стоїть над панеллю).
                    open ? 'z-[55]' : 'z-40',
                )}
            >
                <m.div
                    layout
                    drag="y"
                    dragListener={false}
                    dragControls={drag}
                    dragConstraints={{ top: 0, bottom: 0 }}
                    dragElastic={0.22}
                    onDragEnd={onDragEnd}
                    transition={motionOr(reduce, SNAP)}
                    // Згорнутий острів — капсула (радіус = половина висоти), розгорнуте меню — м'які кути.
                    style={{ borderRadius: open ? 28 : 35 }}
                    data-open={open || undefined}
                    className="gc-island pointer-events-auto mx-auto flex max-w-[560px] flex-col overflow-hidden [view-transition-name:gc-tabbar]"
                >
                    <button
                        type="button"
                        onClick={() => setOpen((value) => !value)}
                        onPointerDown={(e) => drag.start(e)}
                        aria-expanded={open}
                        aria-label={open ? tr('Згорнути меню') : tr('Меню')}
                        data-test="mobile-menu"
                        className="relative flex h-4 w-full shrink-0 touch-none items-start justify-center pt-[3px]"
                    >
                        <span
                            className={cn(
                                'h-1 w-9 rounded-full transition-colors',
                                restActive || open
                                    ? 'bg-primary'
                                    : 'bg-white/25',
                            )}
                        />
                        {restBadge > 0 && !open && (
                            <span className="absolute top-1 left-[calc(50%+1.5rem)] size-2 rounded-full bg-rose-500" />
                        )}
                    </button>
                    <AnimatePresence initial={false}>
                        {open && (
                            <m.div
                                key="menu"
                                role="dialog"
                                aria-label={tr('Меню')}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={motionOr(reduce, SNAP)}
                                className="min-h-0 overflow-hidden"
                            >
                                <div className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-9rem)] overflow-y-auto overscroll-contain px-3 pt-2 pb-1">
                                    <MenuContent onClose={close} />
                                </div>
                            </m.div>
                        )}
                    </AnimatePresence>
                    <div
                        onPointerDown={(e) => drag.start(e)}
                        className="flex touch-none items-stretch px-1 pb-1"
                    >
                        {primary.map((item) => (
                            <TabItem
                                key={item.key}
                                href={item.href}
                                active={!open && isActive(item.href, item.key)}
                                badge={item.badge}
                                label={MOBILE_LABEL[item.key] ?? item.label}
                                icon={
                                    <ModuleIcon
                                        name={item.icon}
                                        className="size-[22px]"
                                    />
                                }
                            />
                        ))}
                    </div>
                </m.div>
            </nav>
        </>
    );
}

/** Вміст розгорнутого острова: профіль, GameCon+, решта розділів і службові посилання — пласко, без плиток. */
function MenuContent({ onClose }: { onClose: () => void }) {
    const { auth } = usePage().props;
    const user = auth.user;
    const isActive = useIsActive();
    const { rest: items } = useMobileSplit(useNavItems());

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
        {
            href: '/help',
            label: tr('Довідка'),
            icon: LifeBuoy,
        },
        ...(user.is_admin
            ? [{ href: '/admin', label: tr('Адмін-панель'), icon: ShieldCheck }]
            : []),
    ];
    const row =
        'flex min-h-11 items-center gap-3 rounded-xl px-2 text-left text-[15px] font-medium text-white/85 active:bg-white/[0.06]';

    return (
        <>
            <Link
                href={`/${user.username}`}
                className="flex items-center gap-3 rounded-xl p-2 active:bg-white/[0.06]"
            >
                <UserAvatar user={user} size="md" ring />
                <span className="min-w-0">
                    <span className="flex items-center gap-1 truncate text-[15px] font-semibold text-white">
                        <span {...plusNameProps(user.plus)}>{user.name}</span>
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

            <PlusMenuCard until={user.plus_until} className="my-2" />

            <div className="grid grid-cols-4 gap-y-1">
                {items.map((item) => {
                    const active = isActive(item.href, item.key);

                    return (
                        <Link
                            key={item.key}
                            href={item.href}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                                'relative flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 text-center text-[12px] leading-tight font-medium active:bg-white/[0.06]',
                                active ? 'text-primary' : 'text-white/80',
                            )}
                        >
                            <span className="relative">
                                <ModuleIcon
                                    name={item.icon}
                                    className={cn(
                                        'size-6',
                                        active
                                            ? 'text-primary'
                                            : 'text-gc-lilac-400',
                                    )}
                                />
                                {item.badge > 0 && (
                                    <span className="absolute -top-1 -right-2.5 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[10px] leading-4 font-bold text-white">
                                        {item.badge}
                                    </span>
                                )}
                            </span>
                            {item.label}
                        </Link>
                    );
                })}
            </div>

            <div className="my-2 h-px bg-white/[0.07]" />

            <div className="grid">
                {extra.map((link) => (
                    <Link key={link.href} href={link.href} className={row}>
                        <link.icon className="size-[19px] text-white/50" />
                        {link.label}
                    </Link>
                ))}
                <ThemeRow />
                <LanguageSelect className="mx-2 my-1.5" />
                <button
                    type="button"
                    onClick={() => {
                        onClose();
                        openFeedback();
                    }}
                    className={row}
                >
                    <MessageSquareHeart className="size-[19px] text-white/50" />
                    {tr('Відгук адмінам')}
                </button>
                <PlayStoreLink
                    compact
                    className="mx-2 my-1.5 justify-self-start"
                />
                <button
                    type="button"
                    onClick={() => router.post('/logout')}
                    className={cn(row, 'text-rose-300 active:bg-rose-500/10')}
                >
                    <LogOut className="size-[19px]" />
                    {tr('Вийти')}
                </button>
            </div>
        </>
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

/** Остання сторінка сайту поза «Музикою» — куди веде «‹ Назад» у розділі (layouts/music-layout.tsx). */
export const LAST_PAGE_KEY = 'gc:last-page';

export default function SocialLayout({ children }: PropsWithChildren) {
    const { auth, modules } = usePage().props;
    const { url } = usePage();
    const { current } = usePlayer();

    useEffect(() => {
        if (url.startsWith('/music')) {
            return;
        }

        try {
            sessionStorage.setItem(LAST_PAGE_KEY, url);
        } catch {
            // Приватний режим без сховища — «Назад» поведе в стрічку.
        }
    }, [url]);

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
                    'mx-auto flex max-w-[1320px] gap-5 px-3 pt-[calc(72px+env(safe-area-inset-top))] sm:px-5',
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
                    <SiteFooter className="glass-matte mb-4" />
                </main>
            </div>
            <VoiceBar />
            {modules.includes('music') && (
                <>
                    <PlayerBar />
                    <ConnectListener />
                </>
            )}
            <BillingHost />
            <PhonePrompt />
            <MobileNav />
            <FeedbackDialog />
            <KeyboardShortcuts username={auth.user.username} />
        </div>
    );
}
