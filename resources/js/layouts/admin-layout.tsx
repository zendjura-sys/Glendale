import { Link, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Blocks,
    Clapperboard,
    Crown,
    FileText,
    Gamepad2,
    Images,
    LayoutDashboard,
    Music2,
    PlugZap,
    Puzzle,
    Server,
    Settings2,
    Shield,
    ShieldAlert,
    Languages,
    Globe2,
    ShieldCheck,
    Sticker,
    UsersRound,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { PropsWithChildren } from 'react';
import { Aurora } from '@/components/gc/aurora';
import { LogoMark } from '@/components/gc/logo';
import { UserAvatar } from '@/components/gc/user-avatar';
import { PlayerBar } from '@/components/music/player-bar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { usePlayer } from '@/lib/player';
import { cn } from '@/lib/utils';
import { PageTransition } from '@/components/gc/page-transition';
import { tr } from '@/lib/i18n';
import { PaletteSync } from '@/components/gc/palette-sync';

const items = [
    { label: tr('Огляд'), href: '/admin', icon: LayoutDashboard, exact: true },
    { label: tr('Користувачі'), href: '/admin/users', icon: UsersRound },
    { label: tr('Записи'), href: '/admin/posts', icon: FileText },
    { label: tr('Модерація'), href: '/admin/moderation', icon: ShieldAlert },
    { label: tr('Мови'), href: '/admin/languages', icon: Languages },
    { label: tr('Країни'), href: '/admin/geo', icon: Globe2 },
    { label: tr('Спільноти'), href: '/admin/communities', icon: Shield },
    { label: tr('Фото'), href: '/admin/photos', icon: Images },
    { label: tr('Музика'), href: '/admin/music', icon: Music2 },
    { label: tr('Кіно'), href: '/admin/cinema', icon: Clapperboard },
    { label: tr('Сервери GTA'), href: '/admin/servers', icon: Server },
    { label: tr('Ігри'), href: '/admin/games', icon: Gamepad2 },
    { label: tr('Сім’ї'), href: '/admin/families', icon: Crown },
    { label: tr('Стікери'), href: '/admin/stickers', icon: Sticker },
    { label: tr('Модулі'), href: '/admin/modules', icon: Blocks },
    { label: tr('Плагіни'), href: '/admin/plugins', icon: Puzzle },
    { label: tr('Інтеграції'), href: '/admin/integrations', icon: PlugZap },
    { label: tr('Налаштування'), href: '/admin/settings', icon: Settings2 },
];

function useActive() {
    const { currentUrl } = useCurrentUrl();

    return (href: string, exact?: boolean) =>
        exact
            ? currentUrl === href || currentUrl.startsWith(`${href}?`)
            : currentUrl === href ||
              currentUrl.startsWith(`${href}/`) ||
              currentUrl.startsWith(`${href}?`);
}

export default function AdminLayout({ children }: PropsWithChildren) {
    const { auth, modules } = usePage().props;
    const isActive = useActive();
    const { current } = usePlayer();
    const { currentUrl } = useCurrentUrl();
    const topNav = useRef<HTMLElement>(null);

    // On phones the section bar scrolls sideways: keep the open section in view.
    useEffect(() => {
        const nav = topNav.current;
        const link = nav?.querySelector<HTMLElement>('[aria-current="page"]');

        if (nav && link) {
            nav.scrollLeft =
                link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2;
        }
    }, [currentUrl]);

    return (
        <div className="relative min-h-dvh">
            <PaletteSync />
            <Aurora className="opacity-70" />

            <aside className="fixed inset-y-0 left-0 z-40 hidden w-[256px] flex-col border-r border-white/[0.06] bg-void/80 p-4 backdrop-blur-2xl [view-transition-name:gc-sidebar] lg:flex">
                <Link
                    href="/admin"
                    className="mb-6 flex items-center gap-3 px-2 pt-1"
                >
                    <LogoMark />
                    <span className="leading-tight">
                        <span className="block font-display text-[15px] font-bold text-white">
                            Game<span className="text-gradient">Con</span>
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium tracking-wider text-gold uppercase">
                            <ShieldCheck className="size-3" />{' '}
                            {tr('Адмін-панель')}
                        </span>
                    </span>
                </Link>

                <nav className="flex flex-col gap-0.5">
                    {items.map(({ label, href, icon: Icon, exact }) => {
                        const active = isActive(href, exact);

                        return (
                            <Link
                                key={href}
                                href={href}
                                prefetch
                                className={cn(
                                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition',
                                    active
                                        ? 'nav-active text-white'
                                        : 'text-white/60 hover:bg-white/[0.045] hover:text-white',
                                )}
                            >
                                <Icon
                                    className={cn(
                                        'size-[18px]',
                                        active
                                            ? 'text-gc-lilac-400 drop-shadow-[0_0_8px_rgb(124_140_255/0.9)]'
                                            : 'text-white/40 group-hover:text-white/75',
                                    )}
                                />
                                {label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="mt-auto space-y-3">
                    <Link
                        href="/feed"
                        className="glass flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition hover:text-white"
                    >
                        <ArrowLeft className="size-4" />{' '}
                        {tr('Повернутися на сайт')}
                    </Link>
                    <div className="flex items-center gap-3 px-2">
                        <UserAvatar
                            user={auth.user}
                            size="sm"
                            showOnline={false}
                        />
                        <span className="min-w-0 leading-tight">
                            <span className="block truncate text-sm font-semibold text-white">
                                {auth.user.name}
                            </span>
                            <span className="block text-xs text-white/40">
                                {tr('Адміністратор')}
                            </span>
                        </span>
                    </div>
                </div>
            </aside>

            <header
                ref={topNav}
                className="sticky top-0 z-30 scrollbar-none flex items-center gap-2 overflow-x-auto border-b border-white/[0.06] bg-void/85 px-3 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur-2xl [view-transition-name:gc-topbar] lg:hidden"
            >
                <Link href="/feed" className="mr-1 shrink-0">
                    <LogoMark className="size-8" />
                </Link>
                {items.map(({ label, href, icon: Icon, exact }) => (
                    <Link
                        key={href}
                        href={href}
                        aria-current={
                            isActive(href, exact) ? 'page' : undefined
                        }
                        className={cn(
                            'flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium',
                            isActive(href, exact)
                                ? 'bg-white/[0.08] text-white'
                                : 'text-white/55',
                        )}
                    >
                        <Icon className="size-3.5" /> {label}
                    </Link>
                ))}
            </header>

            <main
                id="main-content"
                className={cn(
                    'px-4 py-6 sm:px-6 lg:ml-[256px] lg:px-8 lg:py-8',
                    current && 'pb-28 lg:pb-28',
                )}
            >
                <PageTransition className="mx-auto max-w-[1280px] [view-transition-name:gc-main]">
                    {children}
                </PageTransition>
            </main>
            {modules.includes('music') && <PlayerBar standalone />}
        </div>
    );
}
