import { LiveDock, WIDGET_SECTIONS } from '@/components/gc/live-dock';
import { GameCastHeaderButton } from '@/components/gc/gamecast-button';
import { AlertBanner } from '@/components/alerts/alert-banner';
import { Link, router, usePage } from '@inertiajs/react';
import {
    Bookmark,
    ChevronDown,
    Keyboard,
    LayoutDashboard,
    LifeBuoy,
    LogOut,
    Megaphone,
    TriangleAlert,
    Eye,
    MessageSquareHeart,
    Settings,
    UserRound,
    Headset,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { SiteBackground } from '@/components/backgrounds/site-background';
import { Seasonal } from '@/components/gc/seasonal';
import { Konami } from '@/components/gc/konami';
import { AccountSwitcher } from '@/components/gc/account-switcher';
import { useStreamerMode } from '@/components/settings/streamer-mode-switch';
import { IncomingCall } from '@/components/gc/incoming-call';
import { forgetOfflinePages } from '@/lib/offline';
import { InboxListener } from '@/components/gc/inbox-listener';
import { NotificationsMenu } from '@/components/gc/notifications-menu';
import { QuickSearch } from '@/components/gc/quick-search';
import { StatusDialog } from '@/components/gc/status-dialog';
import { UserAvatar } from '@/components/gc/user-avatar';
import { CallStage } from '@/components/gc/call-stage';
import { VoiceBar } from '@/components/gc/voice-bar';
import { BillingHost } from '@/components/billing/billing-host';
import { PhonePrompt } from '@/components/phone/phone-prompt';
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
import { usePlugin } from '@/lib/plugins';
import { cn } from '@/lib/utils';
import { NavigationSkeleton } from '@/components/gc/navigation-skeleton';
import { PageTransition } from '@/components/gc/page-transition';
import { LanguageMenu } from '@/components/gc/language-switcher';
import { tr } from '@/lib/i18n';
import { CommandPalette } from '@/components/gc/command-palette';
import { isPanelView, SplitPanel } from '@/components/gc/split-panel';
import { PaletteSync } from '@/components/gc/palette-sync';
import { ThemeButton, ThemeMenuItem } from '@/components/gc/theme-toggle';
import {
    FeedbackDialog,
    KeyboardShortcuts,
    WhatsNewButton,
    openFeedback,
    openShortcuts,
} from '@/components/gc/site-extras';
import { SiteFooter } from '@/components/gc/site-footer';
import { VkProvider } from '@/components/vk/vk-provider';

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

/** Меню облікового запису (аватар): спільне для шапки сайту й розділу «Музика». */
export function UserMenu() {
    const { auth } = usePage().props;
    const user = auth.user;
    const statusOn = usePlugin('status_emoji');
    const supportOn = usePlugin('support_tickets');
    const [statusOpen, setStatusOpen] = useState(false);

    return (
        <>
            <StatusDialog
                user={user}
                open={statusOpen}
                onOpenChange={setStatusOpen}
            />
            <DropdownMenu>
                <DropdownMenuTrigger
                    aria-label={tr('Меню облікового запису')}
                    className="gc-profile-capsule"
                >
                    <span className="hidden pl-2 text-[14px] font-semibold lg:block">
                        {user.first_name}
                    </span>
                    <UserAvatar user={user} size="sm" showOnline={false} />
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
                    {statusOn && (
                        <DropdownMenuItem
                            onSelect={() => setStatusOpen(true)}
                            className="rounded-lg focus:bg-white/[0.06]"
                        >
                            <span className="flex size-4 items-center justify-center text-sm leading-none">
                                {user.status_emoji ?? '🙂'}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                                {user.status || user.status_emoji
                                    ? (user.status ?? tr('Статус'))
                                    : tr('Встановити статус')}
                            </span>
                        </DropdownMenuItem>
                    )}
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
                    {supportOn && (
                        <DropdownMenuItem
                            asChild
                            className="rounded-lg focus:bg-white/[0.06]"
                        >
                            <Link href="/support">
                                <Headset /> {tr('Підтримка')}
                            </Link>
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                        className="hidden rounded-lg focus:bg-white/[0.06] md:flex"
                        onSelect={openShortcuts}
                    >
                        <Keyboard /> {tr('Гарячі клавіші')}
                    </DropdownMenuItem>
                    <ThemeMenuItem />
                    <LanguageMenu />
                    <DropdownMenuSeparator className="bg-white/5" />
                    <AccountSwitcher variant="menu" />
                    <DropdownMenuItem
                        className="rounded-lg text-rose-300 focus:bg-rose-500/10 focus:text-rose-200"
                        onSelect={() => {
                            forgetOfflinePages();
                            router.post('/logout');
                        }}
                    >
                        <LogOut className="text-rose-300" /> {tr('Вийти')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}

/** Шапка на всю ширину: матове скло, логотип, пошук і кнопки — як у класичній соцмережі. */
function Topbar() {
    return (
        <header className="gc-lobby-top">
            {/* Тонка шапка: лого, пошук (⌘K) і особисте. Розділи — у живому доку знизу. */}
            <div className="gc-lobby-top__bar">
                <Link href="/feed" className="gc-wordmark" aria-label="GameCon">
                    <span className="gc-wordmark__dot" aria-hidden />
                    gamecon
                </Link>
                <QuickSearch className="gc-lobby-search max-w-[460px] min-w-0 flex-1" />
                <GameCastHeaderButton className="hidden md:flex" />
                <HeaderSections />
                <div className="ml-auto flex items-center gap-1">
                    <ThemeButton className="hidden sm:flex" />
                    <WhatsNewButton />
                    <NotificationsMenu />
                    <span className="hidden md:block">
                        <UserMenu />
                    </span>
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

/** ПК і планшет: значки розділів і меню в шапці. */
function HeaderSections() {
    const isActive = useIsActive();
    const items = useNavItems();
    const layout = usePage().props.engagement?.layout ?? [];
    const covered = layout.flatMap((w) => WIDGET_SECTIONS[w.key] ?? []);

    // Шапка ПК і планшета: значки розділів, скільки вміщується, далі «М» (меню з рештою).
    return (
        <LiveDock
            items={items}
            isActive={isActive}
            variant="header"
            covered={covered}
        />
    );
}

/** Живий док: розділи з меню + бейджі непрочитаного. */
function DockHost() {
    const isActive = useIsActive();
    const items = useNavItems();
    const layout = usePage().props.engagement?.layout ?? [];
    const covered = layout.flatMap((w) => WIDGET_SECTIONS[w.key] ?? []);

    return <LiveDock items={items} isActive={isActive} covered={covered} />;
}

function Announcement() {
    const { site } = usePage().props;

    if (!site.announcement) {
        return null;
    }

    return (
        <div className="glass mb-4 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm text-white/80">
            <Megaphone
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-[#a4a6ff]"
            />
            <p className="leading-relaxed whitespace-pre-line">
                {site.announcement}
            </p>
        </div>
    );
}

/** Активний збій зі сторінки статусу: тонкий рядок з посиланням на подробиці. */
/** Адміністратор дивиться сайт очима людини — нагадування й вихід. */
function ViewAsBanner() {
    const { viewAs } = usePage().props;

    if (!viewAs) return null;

    return (
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-amber-400/15 px-4 py-3 text-sm text-amber-100">
            <Eye className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">
                {tr(
                    'Ви бачите сайт очима {name} (@{username}). Лише перегляд.',
                    {
                        name: viewAs.name,
                        username: viewAs.username,
                    },
                )}
            </span>
            <a
                href="/view-as/stop"
                className="shrink-0 font-semibold text-white hover:underline"
            >
                {tr('Вийти')}
            </a>
        </div>
    );
}

function IncidentBanner() {
    const { incident } = usePage().props;

    if (!incident) {
        return null;
    }

    return (
        <Link
            href="/status"
            className="glass mb-4 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white/80 transition hover:text-white"
        >
            <TriangleAlert
                aria-hidden
                className={cn(
                    'size-4 shrink-0',
                    incident.severity === 'major'
                        ? 'text-red-400'
                        : 'text-amber-300',
                )}
            />
            <span className="min-w-0 flex-1 truncate">{incident.title}</span>
            <span className="shrink-0 text-xs text-white/45">
                {tr('Подробиці')}
            </span>
        </Link>
    );
}

/** Остання сторінка сайту поза «Музикою» — куди веде «‹ Назад» у розділі (layouts/music-layout.tsx). */
export const LAST_PAGE_KEY = 'gc:last-page';

export default function SocialLayout({ children }: PropsWithChildren) {
    const { auth, modules } = usePage().props;
    const { url } = usePage();
    const { current } = usePlayer();
    useStreamerMode();
    const paletteOn = usePlugin('command_palette');

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

    // Сторінка в панелі «поруч» (розділений екран) — лише вміст, без шапки, меню й плеєра.
    if (isPanelView()) {
        return (
            <div className="relative min-h-dvh">
                <PaletteSync />
                <SiteBackground />
                <main className="min-w-0 p-3">{children}</main>
            </div>
        );
    }

    return (
        <VkProvider>
            <div className="gc-vk-page relative min-h-dvh">
                <PaletteSync />
                {modules.includes('messages') && (
                    <>
                        <InboxListener userId={auth.user.id} />
                        <IncomingCall userId={auth.user.id} />
                    </>
                )}
                <SiteBackground />
                <Seasonal />
                <Konami />
                <Topbar />
                <div
                    className={cn(
                        'gc-lobby-shell mx-auto w-full max-w-[var(--gc-shell-max)] px-3 pt-[calc(76px+env(safe-area-inset-top))] sm:px-6',
                        current ? 'pb-48' : 'pb-32',
                    )}
                >
                    <main id="main-content" className="gc-vt-main min-w-0">
                        <ViewAsBanner />
                        <IncidentBanner />
                        <AlertBanner />
                        <Announcement />
                        <NavigationSkeleton>
                            <PageTransition>{children}</PageTransition>
                        </NavigationSkeleton>
                        <SiteFooter className="glass-matte gc-footer-card mb-4" />
                    </main>
                </div>
                <VoiceBar />
                <CallStage />
                {modules.includes('music') && (
                    <>
                        <PlayerBar />
                        <ConnectListener />
                    </>
                )}
                <BillingHost />
                <PhonePrompt />
                <DockHost />
                <FeedbackDialog />
                <KeyboardShortcuts username={auth.user.username} />
                {paletteOn && (
                    <>
                        <CommandPalette />
                        <SplitPanel />
                    </>
                )}
            </div>
        </VkProvider>
    );
}
