import { NavigationSkeleton } from '@/components/gc/navigation-skeleton';
import type { ReactNode } from 'react';
import { SiteBackground } from '@/components/backgrounds/site-background';
import { SiteFooter } from '@/components/gc/site-footer';
import { GuestHeader } from '@/components/guest/guest-header';
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
    return (
        <>
            <SiteBackground />
            <GuestHeader />
            <div
                className={cn(
                    'relative mx-auto min-h-dvh px-4 pt-24 pb-4 sm:pt-28',
                    narrow ? 'max-w-[860px]' : 'max-w-[1120px]',
                )}
            >
                <main id="main-content">
                    <NavigationSkeleton>{children}</NavigationSkeleton>
                </main>
                <SiteFooter />
            </div>
        </>
    );
}

export default function PublicLayout({ children }: { children: ReactNode }) {
    return <PublicShell>{children}</PublicShell>;
}
