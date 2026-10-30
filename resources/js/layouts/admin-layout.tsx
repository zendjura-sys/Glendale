import * as DialogPrimitive from '@radix-ui/react-dialog';
import { NavigationSkeleton } from '@/components/gc/navigation-skeleton';
import { Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    ChevronLeft,
    Menu,
    Search,
    X,
    Blocks,
    Clapperboard,
    Crown,
    FileText,
    Gamepad2,
    Images,
    LayoutDashboard,
    Palette,
    Phone,
    ListMusic,
    Music2,
    PlugZap,
    Radio,
    Puzzle,
    Server,
    Settings2,
    SlidersHorizontal,
    Shield,
    ShieldAlert,
    ShieldBan,
    MessagesSquare,
    Languages,
    Globe2,
    MapPinOff,
    ShieldCheck,
    Sparkles,
    Sticker,
    Trophy,
    UsersRound,
    Wallet,
    BadgeCheck,
} from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { SiteBackground } from '@/components/backgrounds/site-background';
import { LogoMark } from '@/components/gc/logo';
import { UserAvatar } from '@/components/gc/user-avatar';
import { ConnectListener } from '@/components/music/connect-ui';
import { PlayerBar } from '@/components/music/player-bar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { usePlayer } from '@/lib/player';
import { motionOr, POP, SNAP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { PageTransition } from '@/components/gc/page-transition';
import { tr } from '@/lib/i18n';
import { PaletteSync } from '@/components/gc/palette-sync';

type Item = {
    label: string;
    href: string;
    icon: typeof LayoutDashboard;
    exact?: boolean;
};

/** Розділи адмінки, згруповані як у меню (функція — щоб підписи йшли за мовою). */
function groups(): { title: string; items: Item[] }[] {
    return [
        {
            title: tr('Головне'),
            items: [
                {
                    label: tr('Огляд'),
                    href: '/admin',
                    icon: LayoutDashboard,
                    exact: true,
                },
                {
                    label: tr('Користувачі'),
                    href: '/admin/users',
                    icon: UsersRound,
                },
                { label: tr('Записи'), href: '/admin/posts', icon: FileText },
                {
                    label: tr('Модерація'),
                    href: '/admin/moderation',
                    icon: ShieldAlert,
                },
                {
                    label: tr('Верифікація'),
                    href: '/admin/verification',
                    icon: BadgeCheck,
                },
                {
                    label: tr('Антиспам'),
                    href: '/admin/antispam',
                    icon: ShieldBan,
                },
                {
                    label: tr('Статистика чатів'),
                    href: '/admin/chats',
                    icon: MessagesSquare,
                },
            ],
        },
        {
            title: tr('Контент'),
            items: [
                {
                    label: tr('Спільноти'),
                    href: '/admin/communities',
                    icon: Shield,
                },
                { label: tr('Фото'), href: '/admin/photos', icon: Images },
                {
                    label: tr('Музика'),
                    href: '/admin/music',
                    icon: Music2,
                    exact: true,
                },
                {
                    label: tr('Радіостанції'),
                    href: '/admin/music/radio',
                    icon: Radio,
                },
                {
                    label: tr('Підбірки'),
                    href: '/admin/music/featured',
                    icon: ListMusic,
                },
                {
                    label: tr('Кіно'),
                    href: '/admin/cinema',
                    icon: Clapperboard,
                },
                {
                    label: tr('Сервери GTA'),
                    href: '/admin/servers',
                    icon: Server,
                },
                { label: tr('Ігри'), href: '/admin/games', icon: Gamepad2 },
                { label: tr('Сім’ї'), href: '/admin/families', icon: Crown },
                {
                    label: tr('Стікери'),
                    href: '/admin/stickers',
                    icon: Sticker,
                },
                {
                    label: tr('Сезони'),
                    href: '/admin/seasons',
                    icon: Trophy,
                },
            ],
        },
        {
            title: tr('Гроші'),
            items: [
                { label: 'GameCon+', href: '/admin/plus', icon: Sparkles },
                { label: tr('Білінг'), href: '/admin/billing', icon: Wallet },
                { label: tr('Номери'), href: '/admin/phones', icon: Phone },
            ],
        },
        {
            title: tr('Система'),
            items: [
                {
                    label: tr('Мови'),
                    href: '/admin/languages',
                    icon: Languages,
                },
                {
                    label: tr('Країни'),
                    href: '/admin/geo',
                    icon: Globe2,
                    exact: true,
                },
                {
                    label: tr('Обмеження за країнами'),
                    href: '/admin/geo/restrictions',
                    icon: MapPinOff,
                },
                { label: tr('Дизайн'), href: '/admin/design', icon: Palette },
                {
                    label: tr('Режими'),
                    href: '/admin/modes',
                    icon: SlidersHorizontal,
                },
                { label: tr('Модулі'), href: '/admin/modules', icon: Blocks },
                { label: tr('Плагіни'), href: '/admin/plugins', icon: Puzzle },
                {
                    label: tr('Інтеграції'),
                    href: '/admin/integrations',
                    icon: PlugZap,
                },
                {
                    label: tr('Налаштування'),
                    href: '/admin/settings',
                    icon: Settings2,
                },
            ],
        },
    ];
}

const RAIL_KEY = 'gc.admin-nav';

function readRail(): boolean {
    try {
        return localStorage.getItem(RAIL_KEY) === 'rail';
    } catch {
        return false;
    }
}

function useActive() {
    const { currentUrl } = useCurrentUrl();

    return (href: string, exact?: boolean) =>
        exact
            ? currentUrl === href || currentUrl.startsWith(`${href}?`)
            : currentUrl === href ||
              currentUrl.startsWith(`${href}/`) ||
              currentUrl.startsWith(`${href}?`);
}

/** Вміст меню: однаковий для бічного острова на ПК і висувної панелі на планшеті й телефоні. */
function NavPanel({
    rail,
    onToggle,
    onNavigate,
    layoutKey,
}: {
    rail: boolean;
    onToggle?: () => void;
    onNavigate?: () => void;
    layoutKey: string;
}) {
    const { auth } = usePage().props;
    const isActive = useActive();
    const reduce = useReducedMotion();
    const [query, setQuery] = useState('');
    const q = query.trim().toLowerCase();
    const list = groups()
        .map((group) => ({
            ...group,
            items: group.items.filter((item) =>
                item.label.toLowerCase().includes(q),
            ),
        }))
        .filter((group) => group.items.length > 0);
    const first = list[0]?.items[0];

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div
                className={cn(
                    'flex items-center gap-3 pt-1',
                    rail ? 'justify-center' : 'px-2',
                )}
            >
                <Link
                    href="/admin"
                    className="flex min-w-0 items-center gap-3"
                    onClick={onNavigate}
                >
                    <LogoMark />
                    {!rail && (
                        <span className="min-w-0 leading-tight">
                            <span className="block font-display text-[15px] font-bold text-white">
                                Game<span className="text-primary">Con</span>
                            </span>
                            <span className="flex items-center gap-1 text-xs font-medium text-gold">
                                <ShieldCheck className="size-3" />{' '}
                                {tr('Адмін-панель')}
                            </span>
                        </span>
                    )}
                </Link>
            </div>
            {onToggle && (
                <button
                    type="button"
                    onClick={onToggle}
                    aria-label={
                        rail ? tr('Розгорнути меню') : tr('Згорнути меню')
                    }
                    title={rail ? tr('Розгорнути меню') : tr('Згорнути меню')}
                    className="absolute top-4 -right-3 z-10 flex size-6 items-center justify-center rounded-full bg-[var(--matte-solid)] text-white/70 ring-1 ring-white/15 transition-colors hover:text-white"
                >
                    <ChevronLeft
                        className={cn(
                            'size-3.5 transition-transform duration-300',
                            rail && 'rotate-180',
                        )}
                    />
                </button>
            )}

            {/* Пошук розділу: Enter — перейти до першого знайденого. */}
            {rail ? (
                <button
                    type="button"
                    onClick={onToggle}
                    aria-label={tr('Пошук розділу')}
                    title={tr('Пошук розділу')}
                    className="mx-auto mt-5 flex size-10 items-center justify-center rounded-xl bg-black/25 text-white/60 ring-1 ring-white/[0.06] hover:text-white"
                >
                    <Search className="size-4" />
                </button>
            ) : (
                <label className="mt-5 flex h-10 items-center gap-2 rounded-xl bg-black/25 px-3 ring-1 ring-white/[0.06] focus-within:ring-white/20">
                    <Search className="size-4 shrink-0 text-white/40" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && first) {
                                router.visit(first.href);
                                setQuery('');
                                onNavigate?.();
                            }
                        }}
                        placeholder={tr('Пошук розділу')}
                        aria-label={tr('Пошук розділу')}
                        className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
                    />
                </label>
            )}

            <nav
                data-lenis-prevent
                className="-mx-1 mt-3 min-h-0 flex-1 [scrollbar-width:none] overflow-y-auto overscroll-contain px-1"
            >
                {list.map((group) => (
                    <div key={group.title} className="mt-3 first:mt-0">
                        {rail ? (
                            <span className="mx-auto my-2 block h-px w-6 bg-white/10" />
                        ) : (
                            <p className="mb-1 px-3 text-xs text-white/35">
                                {group.title}
                            </p>
                        )}
                        <div className="flex flex-col gap-0.5">
                            {group.items.map(
                                ({ label, href, icon: Icon, exact }) => {
                                    const active = isActive(href, exact);

                                    return (
                                        <Link
                                            key={href}
                                            href={href}
                                            prefetch
                                            onClick={onNavigate}
                                            aria-current={
                                                active ? 'page' : undefined
                                            }
                                            title={rail ? label : undefined}
                                            aria-label={
                                                rail ? label : undefined
                                            }
                                            className={cn(
                                                'group relative flex h-10 items-center gap-3 rounded-xl text-[14px] font-medium transition-colors',
                                                rail
                                                    ? 'justify-center'
                                                    : 'px-3',
                                                active
                                                    ? 'text-white'
                                                    : 'text-white/60 hover:bg-white/[0.05] hover:text-white',
                                            )}
                                        >
                                            {active && (
                                                <m.span
                                                    layoutId={`admin-nav-${layoutKey}`}
                                                    transition={motionOr(
                                                        reduce,
                                                        SNAP,
                                                    )}
                                                    className="absolute inset-0 rounded-xl bg-primary/15 ring-1 ring-primary/30"
                                                >
                                                    {/* Світна смужка ліворуч, як у референсі. */}
                                                    <span className="absolute top-2 bottom-2 -left-1 w-1 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />
                                                </m.span>
                                            )}
                                            <Icon
                                                className={cn(
                                                    'relative size-[18px] shrink-0',
                                                    active
                                                        ? 'text-primary'
                                                        : 'text-white/40 group-hover:text-white/75',
                                                )}
                                            />
                                            {!rail && (
                                                <span className="relative truncate">
                                                    {label}
                                                </span>
                                            )}
                                        </Link>
                                    );
                                },
                            )}
                        </div>
                    </div>
                ))}
                {list.length === 0 && (
                    <p className="px-3 py-4 text-sm text-white/40">
                        {tr('Нічого не знайдено')}
                    </p>
                )}
            </nav>

            <div className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
                <Link
                    href="/feed"
                    onClick={onNavigate}
                    title={rail ? tr('Повернутися на сайт') : undefined}
                    aria-label={rail ? tr('Повернутися на сайт') : undefined}
                    className={cn(
                        'flex h-10 items-center gap-2 rounded-xl text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white',
                        rail ? 'justify-center' : 'px-3',
                    )}
                >
                    <ArrowLeft className="size-4 shrink-0" />
                    {!rail && tr('Повернутися на сайт')}
                </Link>
                <div
                    className={cn(
                        'flex items-center gap-3',
                        rail ? 'justify-center' : 'px-2',
                    )}
                >
                    <UserAvatar user={auth.user} size="sm" showOnline={false} />
                    {!rail && (
                        <span className="min-w-0 leading-tight">
                            <span className="block truncate text-sm font-semibold text-white">
                                {auth.user.name}
                            </span>
                            <span className="block text-xs text-white/40">
                                {tr('Адміністратор')}
                            </span>
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AdminLayout({ children }: PropsWithChildren) {
    const { modules } = usePage().props;
    const { current } = usePlayer();
    const { currentUrl } = useCurrentUrl();
    const reduce = useReducedMotion();
    const [rail, setRail] = useState(readRail);
    const [drawer, setDrawer] = useState(false);

    const toggleRail = () =>
        setRail((value) => {
            try {
                localStorage.setItem(RAIL_KEY, value ? 'wide' : 'rail');
            } catch {
                // Приватний режим — вибір діє до перезавантаження.
            }

            return !value;
        });

    // Перейшли в інший розділ — висувне меню закривається.
    useEffect(() => setDrawer(false), [currentUrl]);

    return (
        <div className="relative min-h-dvh">
            <PaletteSync />
            <SiteBackground />

            {/* ПК: бічний острів; згортається в смугу з іконками й назад. */}
            <m.aside
                initial={false}
                animate={{ width: rail ? 76 : 260 }}
                transition={motionOr(reduce, SNAP)}
                className="ios-glass fixed top-3 bottom-3 left-3 z-40 hidden flex-col rounded-2xl p-3 [view-transition-name:gc-sidebar] lg:flex"
            >
                <NavPanel rail={rail} onToggle={toggleRail} layoutKey="side" />
            </m.aside>

            {/* Планшет і телефон: шапка-острів. Лого плавно від'їжджає праворуч, звільняючи місце,
                і тоді з'являється квадратна кнопка меню (як у референсі). */}
            <header className="sticky top-0 z-30 px-2 pt-[calc(0.5rem+env(safe-area-inset-top))] lg:hidden">
                {/* Ім'я переходу — на самій капсулі: на обгортці воно ізолює підкладку й ламає розмиття. */}
                <div className="ios-glass relative flex h-14 items-center rounded-2xl px-2 [view-transition-name:gc-topbar]">
                    <m.button
                        type="button"
                        onClick={() => setDrawer(true)}
                        aria-label={tr('Меню адмінки')}
                        aria-expanded={drawer}
                        initial={reduce ? false : { opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={
                            reduce ? { duration: 0 } : { ...POP, delay: 0.45 }
                        }
                        className="absolute left-2 flex size-10 items-center justify-center rounded-xl bg-black/30 text-white ring-1 ring-white/10"
                    >
                        <Menu className="size-5" />
                    </m.button>
                    <m.div
                        initial={reduce ? false : { x: 0 }}
                        animate={{ x: 50 }}
                        transition={
                            reduce ? { duration: 0 } : { ...SNAP, delay: 0.1 }
                        }
                    >
                        <Link
                            href="/admin"
                            className="flex items-center gap-2.5"
                        >
                            <LogoMark className="size-9" />
                            <span className="leading-tight">
                                <span className="block font-display text-[15px] font-bold text-white">
                                    Game
                                    <span className="text-primary">Con</span>
                                </span>
                                <span className="flex items-center gap-1 text-[11px] font-medium text-gold">
                                    <ShieldCheck className="size-3" />{' '}
                                    {tr('Адмін-панель')}
                                </span>
                            </span>
                        </Link>
                    </m.div>
                    <Link
                        href="/feed"
                        aria-label={tr('Повернутися на сайт')}
                        className="ml-auto flex size-10 items-center justify-center rounded-full bg-black/25 text-white/75 ring-1 ring-white/[0.06]"
                    >
                        <ArrowLeft className="size-4" />
                    </Link>
                </div>
            </header>

            <DialogPrimitive.Root open={drawer} onOpenChange={setDrawer}>
                <AnimatePresence>
                    {drawer && (
                        <DialogPrimitive.Portal forceMount>
                            <DialogPrimitive.Overlay forceMount asChild>
                                <m.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden"
                                />
                            </DialogPrimitive.Overlay>
                            <DialogPrimitive.Content
                                forceMount
                                asChild
                                aria-describedby={undefined}
                            >
                                <m.div
                                    initial={
                                        reduce ? { opacity: 0 } : { x: '-105%' }
                                    }
                                    animate={reduce ? { opacity: 1 } : { x: 0 }}
                                    exit={
                                        reduce ? { opacity: 0 } : { x: '-105%' }
                                    }
                                    transition={motionOr(reduce, SNAP)}
                                    className="liquid-glass liquid-glass--dense fixed top-2 bottom-2 left-2 z-50 flex w-[min(300px,calc(100vw-1rem))] flex-col rounded-2xl p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] focus:outline-none lg:hidden"
                                >
                                    <DialogPrimitive.Title className="sr-only">
                                        {tr('Меню адмінки')}
                                    </DialogPrimitive.Title>
                                    <DialogPrimitive.Close
                                        aria-label={tr('Закрити')}
                                        className="absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-xl bg-black/25 text-white/70 hover:text-white"
                                    >
                                        <X className="size-4" />
                                    </DialogPrimitive.Close>
                                    <NavPanel
                                        rail={false}
                                        onNavigate={() => setDrawer(false)}
                                        layoutKey="drawer"
                                    />
                                </m.div>
                            </DialogPrimitive.Content>
                        </DialogPrimitive.Portal>
                    )}
                </AnimatePresence>
            </DialogPrimitive.Root>

            <main
                id="main-content"
                className={cn(
                    'px-4 py-6 transition-[margin] duration-300 sm:px-6 lg:px-8 lg:py-8',
                    rail ? 'lg:ml-[92px]' : 'lg:ml-[276px]',
                    current && 'pb-28 lg:pb-28',
                )}
            >
                <NavigationSkeleton>
                    <PageTransition className="gc-vt-main mx-auto max-w-[1280px]">
                        {children}
                    </PageTransition>
                </NavigationSkeleton>
            </main>
            {modules.includes('music') && (
                <>
                    <PlayerBar standalone />
                    <ConnectListener />
                </>
            )}
        </div>
    );
}
