import { usePage } from '@inertiajs/react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { SiteBackground } from '@/components/backgrounds/site-background';
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
            className="mt-10 aspect-[16/10] w-full max-w-[30rem] rounded-3xl bg-cover bg-center shadow-[0_28px_64px_-36px_rgb(0_0_0_/_0.7)] ring-1 ring-white/10"
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
                className="relative mx-auto grid max-w-[1240px] items-start gap-10 px-4 pt-24 pb-12 sm:px-5 lg:min-h-dvh lg:grid-cols-[1fr_minmax(0,460px)] lg:items-center lg:gap-16 lg:pt-32"
            >
                <section className="hidden lg:block">
                    <AnimatePresence mode="wait" initial={false}>
                        <m.div key={`hero-${mode}`} {...fade}>
                            <p className="font-display text-sm font-semibold tracking-[0.22em] text-[#a7a7a7] uppercase">
                                GameCon
                            </p>
                            <h2 className="mt-3 font-display text-[clamp(2.4rem,4.2vw,4rem)] leading-[1.02] font-semibold tracking-[-0.045em] text-balance text-white">
                                {intro.title}
                            </h2>
                            <p className="mt-4 max-w-[36ch] text-[17px] leading-relaxed text-[#a7a7a7]">
                                {intro.text}
                            </p>
                        </m.div>
                    </AnimatePresence>
                    <AuthArt />
                </section>

                <section className="auth-form auth-card relative mx-auto w-full max-w-[440px] rounded-[28px] bg-[#121212]/90 p-7 shadow-[0_20px_50px_rgb(0_0_0_/_0.55)] ring-1 ring-white/10 sm:p-9">
                    <span
                        aria-hidden
                        className="pointer-events-none absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(61_139_255/0.7),transparent)]"
                    />
                    <AnimatePresence mode="wait" initial={false}>
                        <m.div key={component} {...fade}>
                            <h1 className="font-display text-[28px] leading-tight font-semibold tracking-[-0.04em] text-white">
                                {title}
                            </h1>
                            {description && (
                                <p className="mt-2 text-[14px] leading-relaxed text-white/55">
                                    {description}
                                </p>
                            )}
                            <div className="mt-8">{children}</div>
                        </m.div>
                    </AnimatePresence>
                </section>
            </main>
            <SiteFooter className="py-8" />
        </div>
    );
}
