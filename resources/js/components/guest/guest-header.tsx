import { Link, usePage } from '@inertiajs/react';
import { Logo } from '@/components/gc/logo';
import { ThemeButton } from '@/components/gc/theme-toggle';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Шапка гостьових сторінок (головна, вхід, реєстрація, відкриті сторінки): та сама скрізь,
 * тож перехід між ними — без стрибків. Значок теми поруч із кнопками.
 */
export function GuestHeader() {
    const page = usePage();
    const open = page.props.site?.registration_open !== false;
    const path = page.url.split('?')[0];

    return (
        <header className="fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)]">
            <div className="liquid-glass liquid-glass--dense mx-2 mt-2 flex h-14 items-center gap-2 rounded-2xl px-3 sm:mx-3 sm:px-4 xl:mx-auto xl:max-w-[1240px]">
                <Link href="/" aria-label="GameCon" className="shrink-0">
                    {/* На вузьких екранах — лише знак, щоб кнопки не вилазили за край. */}
                    <Logo compact className="min-[420px]:hidden" />
                    <Logo className="max-[419px]:hidden" />
                </Link>
                <nav className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
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
