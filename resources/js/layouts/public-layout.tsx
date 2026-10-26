import { Link, usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { SiteBackground } from '@/components/backgrounds/site-background';
import { Logo } from '@/components/gc/logo';
import { SiteFooter } from '@/components/gc/site-footer';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Відкриті гостям сторінки (профілі, ігри): без входу макет сайту не потрібен —
 * легка шапка з логотипом, кнопками входу й футер.
 */
export function PublicShell({
    children,
    narrow = false,
}: {
    children: ReactNode;
    narrow?: boolean;
}) {
    const { site } = usePage().props;

    return (
        <>
            <SiteBackground />
            <div
                className={cn(
                    'relative mx-auto min-h-dvh px-4 pt-5 pb-4 sm:pt-8',
                    narrow ? 'max-w-[860px]' : 'max-w-[1120px]',
                )}
            >
                <header className="mb-8 flex items-center gap-3">
                    <Link href="/" aria-label="GameCon">
                        <Logo />
                    </Link>
                    <nav className="ml-auto flex items-center gap-2">
                        <Link
                            href="/login"
                            className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-foreground/70 transition hover:bg-foreground/[0.06] hover:text-foreground"
                        >
                            {tr('Увійти')}
                        </Link>
                        {site.registration_open && (
                            <Link
                                href="/register"
                                className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-sm font-semibold whitespace-nowrap text-primary-foreground transition hover:opacity-90"
                            >
                                {tr('Реєстрація')}
                            </Link>
                        )}
                    </nav>
                </header>
                <main id="main-content">{children}</main>
                <SiteFooter />
            </div>
        </>
    );
}

export default function PublicLayout({ children }: { children: ReactNode }) {
    return <PublicShell>{children}</PublicShell>;
}
