import { Link, usePage } from '@inertiajs/react';
import { CircleHelp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LanguageButton } from '@/components/gc/language-switcher';
import { Logo } from '@/components/gc/logo';
import { ThemeButton } from '@/components/gc/theme-toggle';
import { SheenPillButton } from '@/components/ui/sheen-pill-button';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Guest header — Arena Black floating pill (21st floating-glass navbar craft).
 * Placement unchanged: fixed island under safe-area.
 */
export function GuestHeader() {
    const page = usePage();
    const open = page.props.site?.registration_open !== false;
    const path = page.url.split('?')[0];
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });

        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <header className="fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)]">
            <div
                className={cn(
                    'relative mx-2 mt-2 flex h-14 items-center gap-2 rounded-full bg-[#121212]/90 px-3 ring-1 ring-white/10 backdrop-blur-xl backdrop-saturate-150 transition-[box-shadow,background-color] duration-300 sm:mx-3 sm:px-4 xl:mx-auto xl:max-w-[1240px]',
                    scrolled
                        ? 'bg-[#121212]/95 shadow-[0_12px_32px_rgb(0_0_0_/_0.55)]'
                        : 'shadow-[0_8px_24px_rgb(0_0_0_/_0.35)]',
                )}
            >
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
                />
                <Link href="/" aria-label="GameCon" className="shrink-0">
                    <Logo compact className="min-[420px]:hidden" />
                    <Logo className="max-[419px]:hidden" />
                </Link>
                <nav className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5">
                    <Link
                        href="/help"
                        aria-label={tr('Довідка')}
                        title={tr('Довідка')}
                        className="gc-icon-button flex h-10 items-center justify-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-[#a7a7a7] transition hover:bg-white/5 hover:text-white max-[399px]:hidden"
                    >
                        <CircleHelp className="size-[18px]" />
                        <span className="max-lg:hidden">{tr('Довідка')}</span>
                    </Link>
                    <LanguageButton className="flex" />
                    <ThemeButton className="flex" />
                    <Link
                        href="/login"
                        className={cn(
                            'inline-flex min-h-10 items-center rounded-full px-3 text-sm font-medium whitespace-nowrap transition sm:px-4',
                            path === '/login'
                                ? 'bg-white/10 text-white'
                                : 'text-[#a7a7a7] hover:bg-white/5 hover:text-white',
                        )}
                    >
                        {tr('Увійти')}
                    </Link>
                    {open && (
                        <SheenPillButton
                            href="/register"
                            tone="primary"
                            className="!h-10 !px-4 text-sm"
                        >
                            {tr('Реєстрація')}
                        </SheenPillButton>
                    )}
                </nav>
            </div>
        </header>
    );
}
