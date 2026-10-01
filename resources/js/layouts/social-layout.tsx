import { Link, router, usePage } from '@inertiajs/react';
import {
    ChevronDown,
    LayoutDashboard,
    LogOut,
    Megaphone,
    Settings,
    ShieldCheck,
    UserRound,
    UsersRound,
} from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { Aurora } from '@/components/gc/aurora';
import { Logo, LogoMark } from '@/components/gc/logo';
import { ModuleIcon } from '@/components/gc/module-icon';
import { NotificationsMenu } from '@/components/gc/notifications-menu';
import { QuickSearch } from '@/components/gc/quick-search';
import { UserAvatar } from '@/components/gc/user-avatar';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn } from '@/lib/utils';

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
    const user = auth.user;

    return (
        <aside className="sticky top-[76px] hidden h-[calc(100dvh-92px)] w-[232px] shrink-0 flex-col lg:flex">
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
                        item.key === 'friends' ? counters?.friend_requests : 0;

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
                                <span className="bg-gradient-brand rounded-full px-1.5 text-[11px] leading-5 font-bold text-white">
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
    const { counters } = usePage().props;

    return (
        <header className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.06] bg-[#05070f]/70 backdrop-blur-2xl">
            <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-4 px-3 sm:px-5">
                <Link href="/feed" className="shrink-0 lg:w-[232px]">
                    <Logo className="hidden sm:inline-flex" />
                    <LogoMark className="sm:hidden" />
                </Link>
                <QuickSearch className="max-w-[520px] flex-1" />
                <div className="ml-auto flex items-center gap-1">
                    <Link
                        href="/friends?tab=requests"
                        className="relative flex size-10 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                        aria-label="Заявки в друзі"
                    >
                        <UsersRound className="size-[19px]" />
                        {!!counters?.friend_requests && (
                            <span className="bg-gradient-brand absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-bold text-white">
                                {counters.friend_requests}
                            </span>
                        )}
                    </Link>
                    <NotificationsMenu />
                    <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
                    <UserMenu />
                </div>
            </div>
        </header>
    );
}

function MobileNav() {
    const { nav, auth } = usePage().props;
    const isActive = useIsActive();

    return (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-[#070a16]/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl lg:hidden">
            <div className="flex items-stretch justify-around">
                {nav.slice(0, 5).map((item) => {
                    const href =
                        item.key === 'profile'
                            ? `/${auth.user.username}`
                            : item.href;
                    const active = isActive(href, item.key);

                    return (
                        <Link
                            key={item.key}
                            href={href}
                            className={cn(
                                'flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition',
                                active ? 'text-white' : 'text-white/45',
                            )}
                        >
                            <ModuleIcon
                                name={item.icon}
                                className={cn(
                                    'size-5',
                                    active &&
                                        'text-[#8fa0ff] drop-shadow-[0_0_8px_rgb(124_140_255/0.9)]',
                                )}
                            />
                            {item.label}
                        </Link>
                    );
                })}
            </div>
        </nav>
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
    return (
        <div className="relative min-h-dvh">
            <Aurora />
            <Topbar />
            <div className="mx-auto flex max-w-[1320px] gap-5 px-3 pt-[76px] pb-24 sm:px-5 lg:pb-10">
                <Sidebar />
                <main className="min-w-0 flex-1">
                    <Announcement />
                    {children}
                </main>
            </div>
            <MobileNav />
        </div>
    );
}
