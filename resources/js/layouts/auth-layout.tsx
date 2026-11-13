import { Link, usePage } from '@inertiajs/react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { SiteBackground } from '@/components/backgrounds/site-background';
import { LanguageSelect } from '@/components/gc/language-switcher';
import { PaletteSync } from '@/components/gc/palette-sync';
import { Seasonal } from '@/components/gc/seasonal';
import { SiteFooter } from '@/components/gc/site-footer';
import { GuestHeader } from '@/components/guest/guest-header';
import { tr } from '@/lib/i18n';
import { blurSwap } from '@/lib/motion';

/**
 * Вхід і реєстрація — у стилі головної: та сама шапка зі значком теми, фон і футер;
 * ліворуч великий заголовок (і картинка з адмінки, якщо є), праворуч — скляна картка з формою.
 * Світла й темна теми — як на всьому сайті. Інші сторінки (пароль, 2FA) — той самий макет.
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
                'Зареєструйтеся — друзі, команда, ваші сервери й сім’ї в одному місці. Це безкоштовно.',
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
        text: tr('Соцмережа для гравців.'),
    };
}

/** Картинка з адмінки (Адмінка → Дизайн) — у лівій половині як ілюстрація, не на весь екран. */
function AuthArt() {
    const images = usePage().props.site?.auth_images;
    const src = images?.site_desktop ?? images?.site_mobile ?? null;
    if (!src) return null;

    return (
        <div
            aria-hidden
            className="mt-10 aspect-[16/10] w-full max-w-[30rem] rounded-3xl bg-cover bg-center shadow-[0_30px_80px_-30px_rgb(10_132_255/0.55)]"
            style={{ backgroundImage: `url(${src})` }}
        />
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

    // Той самий фон, шапка й футер, що на головній — переходи між ними без стрибків.
    return (
        <div className="relative min-h-dvh">
            <PaletteSync />
            <SiteBackground />
            <Seasonal />
            <GuestHeader />

            <main
                id="main-content"
                className="relative mx-auto grid min-h-dvh max-w-[1240px] items-center gap-10 px-5 pt-28 pb-12 lg:grid-cols-[1fr_minmax(0,460px)] lg:gap-16 lg:pt-32"
            >
                <section className="hidden lg:block">
                    <AnimatePresence mode="wait" initial={false}>
                        <m.div key={`hero-${mode}`} {...fade}>
                            <h2 className="font-display text-[clamp(2.4rem,4.2vw,4rem)] leading-[1.04] font-extrabold tracking-tight text-balance text-white">
                                {intro.title}
                            </h2>
                            <p className="mt-4 max-w-[36ch] text-[17px] leading-relaxed text-white/60">
                                {intro.text}
                            </p>
                        </m.div>
                    </AnimatePresence>
                    <AuthArt />
                </section>

                <section className="auth-form glass-strong w-full rounded-3xl p-6 sm:p-8">
                    <AnimatePresence mode="wait" initial={false}>
                        <m.div key={component} {...fade}>
                            <h1 className="font-display text-3xl font-bold tracking-tight text-white">
                                {title}
                            </h1>
                            {description && (
                                <p className="mt-2 text-sm leading-relaxed text-white/60">
                                    {description}
                                </p>
                            )}
                            <div className="mt-7">{children}</div>
                        </m.div>
                    </AnimatePresence>
                    <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-5 text-sm text-white/55">
                        <LanguageSelect />
                        <Link
                            href="/help/start"
                            className="transition hover:text-white"
                        >
                            {tr('Довідка')}
                        </Link>
                        <Link
                            href="/app"
                            className="transition hover:text-white"
                        >
                            {tr('Застосунок')}
                        </Link>
                    </div>
                </section>
            </main>
            <SiteFooter className="py-8" />
        </div>
    );
}
