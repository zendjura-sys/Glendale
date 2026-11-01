import { Link, usePage } from '@inertiajs/react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { LanguageSelect } from '@/components/gc/language-switcher';
import { Logo } from '@/components/gc/logo';
import { PaletteSync } from '@/components/gc/palette-sync';
import { tr } from '@/lib/i18n';
import { blurSwap } from '@/lib/motion';

/**
 * Вхід і реєстрація — Frosted Glass Split-Screen: фото з адмінки на весь екран (Адмінка → Дизайн),
 * ліва половина прозора з великим заголовком, права — матове скло на всю висоту з формою.
 * На телефоні форма на весь екран поверх того самого фото. Інші сторінки (пароль, 2FA) — той самий макет.
 */

type Mode = 'login' | 'register' | 'other';

function useMode(): Mode {
    const component = usePage().component;

    return component === 'auth/login'
        ? 'login'
        : component === 'auth/register'
          ? 'register'
          : 'other';
}

/** Заголовок лівої половини: що відбувається на цій сторінці. */
function hero(mode: Mode): { title: string; text: string } {
    if (mode === 'register') {
        return {
            title: tr('Ще немає акаунта?'),
            text: tr(
                'Зареєструйтеся — друзі, кіно разом і ваші ігрові сервери в одному місці. Це безкоштовно.',
            ),
        };
    }
    if (mode === 'login') {
        return {
            title: tr('З поверненням!'),
            text: tr('Увійдіть — і продовжимо з того місця, де ви зупинилися.'),
        };
    }

    return {
        title: 'GameCon',
        text: tr('Соцмережа для гравців і кіноманів.'),
    };
}

/** Фон з адмінки на весь екран (телефон — вертикальне фото) і затемнення для читабельності тексту. */
function AuthBackground() {
    const images = usePage().props.site?.auth_images;
    const desktop = images?.site_desktop ?? images?.site_mobile ?? null;
    const mobile = images?.site_mobile ?? images?.site_desktop ?? null;

    return (
        <div aria-hidden className="fixed inset-0 h-dvh w-screen">
            {desktop || mobile ? (
                <>
                    <div
                        className="absolute inset-0 hidden bg-cover bg-center md:block"
                        style={{ backgroundImage: `url(${desktop})` }}
                    />
                    <div
                        className="absolute inset-0 bg-cover bg-center md:hidden"
                        style={{ backgroundImage: `url(${mobile})` }}
                    />
                </>
            ) : (
                // Без фото — темне фірмове тло.
                <div className="absolute inset-0 bg-[#070b14] bg-[radial-gradient(90%_70%_at_15%_85%,rgb(10_132_255/0.28),transparent_60%),radial-gradient(70%_60%_at_85%_15%,rgb(0_200_255/0.16),transparent_60%)]" />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.45),rgba(0,0,0,0.2))]" />
        </div>
    );
}

export default function AuthLayout({
    title = '',
    description = '',
    children,
}: {
    title?: string;
    description?: string;
    children: ReactNode;
}) {
    const mode = useMode();
    const component = usePage().component;
    const reduce = useReducedMotion();
    const fade = blurSwap(reduce);
    const intro = hero(mode);

    return (
        <div className="auth-screen relative min-h-dvh text-white">
            <PaletteSync />
            <AuthBackground />

            <main
                id="main-content"
                className="relative z-10 grid min-h-dvh md:grid-cols-2"
            >
                {/* Ліва половина: прозора, заголовок по центру висоти, вирівняний ліворуч. */}
                <section className="relative hidden flex-col justify-center px-10 py-12 md:flex lg:px-16">
                    <Link
                        href="/"
                        className="absolute top-8 left-10 w-fit lg:left-16"
                        aria-label="GameCon"
                    >
                        <Logo />
                    </Link>
                    <AnimatePresence mode="wait" initial={false}>
                        <m.div
                            key={`hero-${mode}`}
                            className="max-w-[32rem]"
                            {...fade}
                        >
                            <h2 className="font-display text-[clamp(2.4rem,4.2vw,4rem)] leading-[1.05] font-bold tracking-tight text-balance">
                                {intro.title}
                            </h2>
                            <p className="mt-4 max-w-[36ch] text-base leading-relaxed text-white/80">
                                {intro.text}
                            </p>
                        </m.div>
                    </AnimatePresence>
                </section>

                {/* Права половина: матове скло на всю висоту, впритик до країв. */}
                <section className="auth-form auth-panel flex min-h-dvh flex-col px-7 pt-[calc(env(safe-area-inset-top)+2rem)] pb-8 sm:px-12 lg:px-16">
                    <Link
                        href="/"
                        className="mb-10 w-fit md:hidden"
                        aria-label="GameCon"
                    >
                        <Logo />
                    </Link>
                    <div className="flex flex-1 flex-col justify-center">
                        <AnimatePresence mode="wait" initial={false}>
                            <m.div
                                key={component}
                                className="w-full max-w-[420px]"
                                {...fade}
                            >
                                <h1 className="font-display text-3xl font-semibold tracking-tight">
                                    {title}
                                </h1>
                                {description && (
                                    <p className="mt-2 text-sm leading-relaxed text-white/65">
                                        {description}
                                    </p>
                                )}
                                <div className="mt-8">{children}</div>
                            </m.div>
                        </AnimatePresence>
                    </div>
                    <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/60">
                        <LanguageSelect />
                        <Link
                            href="/help/start"
                            className="transition hover:text-white"
                        >
                            {tr('Довідка')}
                        </Link>
                        <Link
                            href="/privacy"
                            className="transition hover:text-white"
                        >
                            {tr('Конфіденційність')}
                        </Link>
                        <Link
                            href="/terms"
                            className="transition hover:text-white"
                        >
                            {tr('Умови')}
                        </Link>
                    </div>
                </section>
            </main>
        </div>
    );
}
