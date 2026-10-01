import { Link, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Blocks,
    FileText,
    Images,
    LayoutDashboard,
    Settings2,
    Shield,
    ShieldCheck,
    Sticker,
    UsersRound,
} from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { Aurora } from '@/components/gc/aurora';
import { LogoMark } from '@/components/gc/logo';
import { UserAvatar } from '@/components/gc/user-avatar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn } from '@/lib/utils';

const items = [
    { label: 'Огляд', href: '/admin', icon: LayoutDashboard, exact: true },
    { label: 'Користувачі', href: '/admin/users', icon: UsersRound },
    { label: 'Записи', href: '/admin/posts', icon: FileText },
    { label: 'Спільноти', href: '/admin/communities', icon: Shield },
    { label: 'Фото', href: '/admin/photos', icon: Images },
    { label: 'Стікери', href: '/admin/stickers', icon: Sticker },
    { label: 'Модулі', href: '/admin/modules', icon: Blocks },
    { label: 'Налаштування', href: '/admin/settings', icon: Settings2 },
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
    const { auth } = usePage().props;
    const isActive = useActive();

    return (
        <div className="relative min-h-dvh">
            <Aurora className="opacity-70" />

            <aside className="fixed inset-y-0 left-0 z-40 hidden w-[256px] flex-col border-r border-white/[0.06] bg-[#060915]/80 p-4 backdrop-blur-2xl lg:flex">
                <Link
                    href="/admin"
                    className="mb-6 flex items-center gap-3 px-2 pt-1"
                >
                    <LogoMark />
                    <span className="leading-tight">
                        <span className="block font-display text-[15px] font-bold text-white">
                            Game<span className="text-gradient">Con</span>
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-medium tracking-wider text-gold uppercase">
                            <ShieldCheck className="size-3" /> Адмін-панель
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
                                            ? 'text-[#8fa0ff] drop-shadow-[0_0_8px_rgb(124_140_255/0.9)]'
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
                        <ArrowLeft className="size-4" /> Повернутися на сайт
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
                            <span className="block text-[11px] text-white/40">
                                Адміністратор
                            </span>
                        </span>
                    </div>
                </div>
            </aside>

            <header className="sticky top-0 z-30 scrollbar-none flex items-center gap-2 overflow-x-auto border-b border-white/[0.06] bg-[#060915]/85 px-3 py-2 backdrop-blur-2xl lg:hidden">
                <Link href="/feed" className="mr-1 shrink-0">
                    <LogoMark className="size-8" />
                </Link>
                {items.map(({ label, href, icon: Icon, exact }) => (
                    <Link
                        key={href}
                        href={href}
                        className={cn(
                            'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium',
                            isActive(href, exact)
                                ? 'bg-white/[0.08] text-white'
                                : 'text-white/55',
                        )}
                    >
                        <Icon className="size-3.5" /> {label}
                    </Link>
                ))}
            </header>

            <main className="px-4 py-6 sm:px-6 lg:ml-[256px] lg:px-8 lg:py-8">
                <div className="mx-auto max-w-[1280px]">{children}</div>
            </main>
        </div>
    );
}
