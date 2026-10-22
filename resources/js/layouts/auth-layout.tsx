import { Link, usePage } from '@inertiajs/react';
import {
    AnimatePresence,
    LayoutGroup,
    m,
    useReducedMotion,
} from 'motion/react';
import { useRef } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { AuthBackdrop } from '@/components/auth/auth-backdrop';
import { LanguageSelect } from '@/components/gc/language-switcher';
import { Logo } from '@/components/gc/logo';
import { PaletteSync } from '@/components/gc/palette-sync';
import { SiteFooter } from '@/components/gc/site-footer';
import { tr } from '@/lib/i18n';
import { blurSwap, EASE_OUT, motionOr, SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Макет входу й реєстрації: одна скляна картка, розділена навскіс на форму й «запрошення».
 * Макет постійний (Inertia зберігає його між /login і /register), тож при переході половини
 * міняються місцями анімацією layout, а вміст розмивається й проявляється знову.
 * Інші сторінки (відновлення пароля, 2FA, оскарження) — та сама картка з коротким запрошенням.
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

/** Ліва/права «запрошувальна» половина: що сказати й куди вести. */
function Invite({ mode }: { mode: Mode }) {
    const registrationOpen = usePage().props.site?.registration_open !== false;

    const content =
        mode === 'login'
            ? registrationOpen
                ? {
                      title: tr('Вперше тут?'),
                      text: tr(
                          'Акаунт — за хвилину. Друзі, кіно разом і ваші ігрові сервери вже чекають.',
                      ),
                      href: '/register',
                      action: tr('Створити акаунт'),
                  }
                : {
                      title: tr('Раді бачити'),
                      text: tr(
                          'Реєстрація зараз закрита, але вхід працює як завжди.',
                      ),
                      href: null,
                      action: null,
                  }
            : mode === 'register'
              ? {
                    title: tr('Уже з нами?'),
                    text: tr(
                        'Увійдіть — і продовжимо з того місця, де ви зупинилися.',
                    ),
                    href: '/login',
                    action: tr('Увійти'),
                }
              : {
                    title: tr('GameCon'),
                    text: tr('Соцмережа для гравців і кіноманів.'),
                    href: '/login',
                    action: tr('До входу'),
                };

    return (
        <div className="flex h-full flex-col justify-end">
            {/* На телефоні — компактний рядок під формою: питання й кнопка. */}
            <div className="flex items-center justify-between gap-4 lg:block">
                <h2 className="font-display text-base font-semibold tracking-tight text-balance text-white lg:text-[clamp(1.9rem,3vw,2.6rem)] lg:leading-[1.05] lg:font-bold">
                    {content.title}
                </h2>
                <p className="mt-3 hidden max-w-[30ch] text-[15px] leading-relaxed text-white/55 lg:block">
                    {content.text}
                </p>
                {content.href && (
                    <Link
                        href={content.href}
                        className="inline-flex h-10 shrink-0 items-center rounded-control border border-white/20 px-5 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:mt-7 lg:h-11 lg:px-6"
                    >
                        {content.action}
                    </Link>
                )}
            </div>
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
    const card = useRef<HTMLDivElement>(null);
    // «Рідке скло»: відблиск іде за курсором. Пишемо CSS-змінні напряму — без перерендеру React.
    const glare = (e: PointerEvent<HTMLDivElement>) => {
        const el = card.current;
        if (!el || reduce || e.pointerType !== 'mouse') return;
        const box = el.getBoundingClientRect();
        el.style.setProperty('--lx', `${e.clientX - box.left}px`);
        el.style.setProperty('--ly', `${e.clientY - box.top}px`);
    };
    // Вхід: форма ліворуч, запрошення праворуч; реєстрація — навпаки (як у референсі).
    const inviteFirst = mode === 'register';
    const spring = motionOr(reduce, SWAP);
    const fade = blurSwap(reduce);

    return (
        <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-8 sm:px-6">
            <PaletteSync />
            <AuthBackdrop />

            <main
                id="main-content"
                className="relative z-10 w-full max-w-[440px] lg:max-w-[960px]"
            >
                <Link
                    href="/"
                    className="mb-6 flex justify-center lg:hidden"
                    aria-label="GameCon"
                >
                    <Logo />
                </Link>
                <m.div
                    initial={reduce ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: EASE_OUT }}
                    ref={card}
                    onPointerMove={glare}
                    className="auth-card liquid-glass overflow-hidden rounded-dialog"
                >
                    <span aria-hidden className="liquid-glass__glare" />
                    <LayoutGroup>
                        <div className="relative flex flex-col lg:grid lg:min-h-[600px] lg:grid-cols-2">
                            {/* Запрошення: на ПК — половина зі скошеним краєм, на телефоні — рядок над формою. */}
                            <m.section
                                layout
                                transition={spring}
                                className={cn(
                                    'auth-invite relative order-2 px-7 py-5 sm:px-9 lg:px-12 lg:py-12',
                                    inviteFirst ? 'lg:order-1' : 'lg:order-2',
                                    inviteFirst
                                        ? 'auth-invite--left'
                                        : 'auth-invite--right',
                                )}
                            >
                                <AnimatePresence mode="wait" initial={false}>
                                    <m.div
                                        key={`invite-${mode}`}
                                        className="h-full"
                                        {...fade}
                                    >
                                        <Invite mode={mode} />
                                    </m.div>
                                </AnimatePresence>
                            </m.section>

                            <m.section
                                layout
                                transition={spring}
                                className={cn(
                                    'auth-form relative order-1 px-7 pt-8 pb-8 sm:px-9 lg:px-12 lg:py-12',
                                    inviteFirst ? 'lg:order-2' : 'lg:order-1',
                                )}
                            >
                                {/* Логотип над формою: їде разом із нею на інший бік. */}
                                <Link
                                    href="/"
                                    className="mb-10 hidden w-fit lg:block"
                                    aria-label="GameCon"
                                >
                                    <Logo />
                                </Link>
                                <AnimatePresence mode="wait" initial={false}>
                                    <m.div key={component} {...fade}>
                                        <h1 className="font-display text-xl font-semibold tracking-tight text-white">
                                            {title}
                                        </h1>
                                        {description && (
                                            <p className="mt-1.5 text-sm leading-relaxed text-white/50">
                                                {description}
                                            </p>
                                        )}
                                        <div className="mt-7">{children}</div>
                                    </m.div>
                                </AnimatePresence>
                            </m.section>
                        </div>
                    </LayoutGroup>
                </m.div>

                <div className="mt-5 flex justify-center">
                    <LanguageSelect />
                </div>
                <SiteFooter className="mt-4 border-t-0 px-0" />
            </main>
        </div>
    );
}
