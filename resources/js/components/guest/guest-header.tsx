import { Link, usePage } from '@inertiajs/react';
import { CircleHelp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LanguageButton } from '@/components/gc/language-switcher';
import { Logo } from '@/components/gc/logo';
import { ThemeButton } from '@/components/gc/theme-toggle';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Шапка гостьових сторінок: той самий острів-макет (liquid-glass bar),
 * що й раніше — Quiet Arena лише згущує скло після скролу й додає верхній блік.
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
                    'liquid-glass liquid-glass--dense relative mx-2 mt-2 flex h-14 items-center gap-2 rounded-2xl px-3 transition-[background-color,box-shadow] duration-300 sm:mx-3 sm:px-4 xl:mx-auto xl:max-w-[1240px]',
                    scrolled && 'shadow-[0_18px_48px_-24px_rgb(0_0_0_/_0.75)]',
                )}
            >
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
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
                        className="gc-icon-button flex h-10 items-center justify-center gap-1.5 rounded-xl px-2.5 text-[13px] font-medium transition max-[399px]:hidden"
                    >
                        <CircleHelp className="size-[18px]" />
                        <span className="max-lg:hidden">{tr('Довідка')}</span>
                    </Link>
                    <LanguageButton className="flex" />
                    <ThemeButton className="flex" />
                    <Link
                        href="/login"
                        className={cn(
                            'inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium whitespace-nowrap transition sm:px-4',
                            path === '/login'
                                ? 'bg-white/[0.08] text-white'
                                : 'text-white/75 hover:bg-white/[0.06] hover:text-white',
                        )}
                    >
                        {tr('Увійти')}
                    </Link>
                    {open && (
                        <Link
                            href="/register"
                            className="btn-glow inline-flex min-h-11 items-center rounded-xl px-3.5 text-sm font-semibold whitespace-nowrap sm:px-4"
                        >
                            {tr('Реєстрація')}
                        </Link>
                    )}
                </nav>
            </div>
        </header>
    );
}
