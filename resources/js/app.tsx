import type { VisitOptions } from '@inertiajs/core';
import { createInertiaApp } from '@inertiajs/react';
import { installVitals } from '@/lib/vitals';
import { registerOffline } from '@/lib/offline';
import { SkipLink } from '@/components/gc/skip-link';
import { HandoffCard } from '@/components/cinema/handoff-card';
import { CookieConsent } from '@/components/gc/cookie-consent';
import { ErrorBoundary } from '@/components/gc/error-boundary';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { installKeyboardGuard } from '@/lib/keyboard';
import { startSmoothScroll } from '@/lib/smooth-scroll';
import { LazyMotion } from 'motion/react';
import { lazy, Suspense, useEffect } from 'react';
import { bootChimeOnce } from '@/lib/sound-fx';
import { PageSkeleton, skeletonFor } from '@/components/gc/skeletons';
import { syncDataSaverFlag } from '@/lib/data-saver';
import {
    CONTENT_CACHE,
    NAV_CACHE,
    installTouchPrefetch,
    primaryWarmUrls,
    warmIdle,
} from '@/lib/prefetch';
import { warmBootRoutes } from '@/lib/boot-orchestrator';

// Швидкий перший кадр: стартовий файл без макетів. Кожен макет (соцмережа, адмінка, вхід, налаштування) —
// окремим файлом, що вантажиться, коли вперше знадобиться, і далі лишається в кеші.
const socialLayout = () => import('@/layouts/social-layout');
const adminLayout = () => import('@/layouts/admin-layout');
const authLayout = () => import('@/layouts/auth-layout');
const settingsLayout = () => import('@/layouts/settings/layout');
const musicLayout = () => import('@/layouts/music-layout');
const publicLayout = () => import('@/layouts/public-layout');
const SocialLayout = lazy(socialLayout);
const AdminLayout = lazy(adminLayout);
const AuthLayout = lazy(authLayout);
const SettingsLayout = lazy(settingsLayout);
const MusicLayout = lazy(musicLayout);
const PublicLayout = lazy(publicLayout);

// Макет першої сторінки починаємо качати одразу, паралельно зі сторінкою, — без другого очікування.
if (typeof document !== 'undefined') {
    const initial = document.querySelector('script[data-page]')?.textContent;
    const name = initial
        ? ((JSON.parse(initial) as { component?: string }).component ?? '')
        : '';
    if (name.startsWith('auth/')) void authLayout();
    else if (name.startsWith('admin/')) void adminLayout();
    else if (name.startsWith('music/') && name !== 'music/together')
        void musicLayout();
    else if (
        name &&
        name !== 'welcome' &&
        name !== 'start/mode' &&
        name !== 'start/phone' &&
        !name.startsWith('legal/')
    ) {
        void socialLayout();
        if (name.startsWith('settings/')) void settingsLayout();
    }
}

// Анімації: легке ядро одразу, решта можливостей (layout, drag) — окремим файлом після першого кадру.
const motionFeatures = () =>
    import('@/lib/motion-features').then((module) => module.default);

installKeyboardGuard();
installVitals();
startSmoothScroll();

const appName = import.meta.env.VITE_APP_NAME || 'GameCon';

// Клас gc-vt стоїть на <html> ще до рендера нової сторінки, тож каскад
// появи не потрапляє у знімок View Transition (див. PageTransition).
if (
    typeof document !== 'undefined' &&
    document.startViewTransition &&
    !document.documentElement.dataset.vt
) {
    document.documentElement.dataset.vt = '1';
    const startViewTransition = document.startViewTransition.bind(document);

    document.startViewTransition = (callbackOptions) => {
        document.documentElement.classList.add('gc-vt');
        const transition = startViewTransition(callbackOptions);
        const clear = () => document.documentElement.classList.remove('gc-vt');
        transition.finished.then(clear, clear);

        return transition;
    };
}

/**
 * Перший рендер готовий: ховаємо сплеш з app.blade.php, тихо підтягуємо головні розділи
 * (телефон і ПК — одні й ті самі адреси; на дотик гріємо посилання pointerdown’ом)
 * і граємо привітальний акорд — раз за сесію вкладки.
 */
function SplashDone({
    user,
    modules,
    dataSaver,
}: {
    user: { username?: string } | null;
    modules?: string[] | null;
    dataSaver?: boolean;
}) {
    useEffect(() => {
        syncDataSaverFlag(
            Boolean(dataSaver) ||
                Boolean(
                    (
                        navigator as Navigator & {
                            connection?: { saveData?: boolean };
                        }
                    ).connection?.saveData,
                ),
        );
        // Під час сплешу вже гріємо ключові маршрути; після — ховаємо скло й акорд.
        warmBootRoutes(user?.username);
        const frame = requestAnimationFrame(() => {
            (
                window as unknown as { gcHideSplash?: () => void }
            ).gcHideSplash?.();
            bootChimeOnce();
            if (user) {
                warmIdle(
                    primaryWarmUrls({
                        username: user.username,
                        modules,
                    }),
                    NAV_CACHE,
                );
            }
        });
        const stopTouch = installTouchPrefetch();

        return () => {
            cancelAnimationFrame(frame);
            stopTouch();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return null;
}

function shouldViewTransition(options: VisitOptions): boolean {
    const method = (options.method ?? 'get').toLowerCase();
    const partial =
        (options.only?.length ?? 0) > 0 ||
        (options.except?.length ?? 0) > 0 ||
        (options.reset?.length ?? 0) > 0;

    if (
        method !== 'get' ||
        options.prefetch ||
        options.preserveState === true ||
        partial
    ) {
        return false;
    }

    if (typeof document === 'undefined' || !document.startViewTransition) {
        return false;
    }

    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

registerOffline();

/** Поки вантажиться макет розділу — скелетон сторінки замість порожнього екрана. */
function BootSkeleton({ name }: { name: string }) {
    if (/^(auth\/|legal\/|welcome|error|wrapped|start\/)/.test(name)) {
        return null;
    }

    return (
        <div className="mx-auto max-w-[1280px] px-4 pt-24 sm:px-6">
            <PageSkeleton kind={skeletonFor(window.location.pathname)} />
        </div>
    );
}

/** Сторінки, які бачать гості (без входу). */
const PUBLIC_PAGES = new Set([
    'profile/show',
    'profile/frozen',
    'games/index',
    'games/show',
    'communities/index',
    'communities/guest',
    'status',
    'transparency',
    'app/index',
    'public/entity',
    // Розробникам: документація й плагіни відкриті гостям.
    'developers/index',
    'developers/oauth',
    'developers/plugins',
    'developers/plugin',
    'developers/sdk',
]);

void createInertiaApp({
    title: (title) => (title ? `${title} · ${appName}` : appName),
    layout: (name, page) => {
        switch (true) {
            // Довідка відкрита гостям: без входу — власна легка оболонка (components/help/help-shell).
            case name.startsWith('help/') &&
                !(page?.props as { auth?: { user?: unknown } } | undefined)
                    ?.auth?.user:
                return null;
            // Профілі й ігри відкриті гостям і пошуковикам — легка оболонка без макета сайту.
            case PUBLIC_PAGES.has(name) &&
                !(page?.props as { auth?: { user?: unknown } } | undefined)
                    ?.auth?.user:
                return PublicLayout;
            case name === 'welcome':
            case name === 'error':
            case name === 'wrapped':
            case name === 'links/show':
            case name === 'start/mode':
            case name === 'start/phone':
            case name.startsWith('legal/'):
                return null;
            case name.startsWith('auth/'):
                return AuthLayout;
            case name.startsWith('admin/'):
                return AdminLayout;
            // «Музика» — у загальній оболонці сайту; вкладки розділу й завантаження — у MusicLayout.
            case name.startsWith('music/') &&
                name !== 'music/together' &&
                name !== 'music/index':
                return [SocialLayout, MusicLayout];
            case name.startsWith('settings/'):
                return [SocialLayout, SettingsLayout];
            default:
                return SocialLayout;
        }
    },
    strictMode: true,
    defaults: {
        // Довший кеш і швидший hover — перехід частіше з готових даних.
        prefetch: {
            cacheFor: CONTENT_CACHE,
            hoverDelay: 40,
        },
        visitOptions: (_href: string, options: VisitOptions) => ({
            viewTransition: shouldViewTransition(options),
        }),
    },
    withApp(app, { page }) {
        const analytics =
            (page.props as { site?: { analytics?: string | null } }).site
                ?.analytics ?? null;
        // «Продовжити на цьому пристрої» — лише для входу й увімкненого «Кіно».
        const handoff = Boolean(
            (page.props as { auth?: { user?: unknown } }).auth?.user &&
            (page.props as { modules?: string[] }).modules?.includes('cinema'),
        );
        const authUser =
            (
                page.props as {
                    auth?: {
                        user?: {
                            username?: string;
                            data_saver?: boolean;
                        } | null;
                    };
                }
            ).auth?.user ?? null;
        const modules = (page.props as { modules?: string[] }).modules ?? null;

        return (
            <LazyMotion features={motionFeatures} strict>
                <TooltipProvider delayDuration={0}>
                    <SplashDone
                        user={authUser}
                        modules={modules}
                        dataSaver={authUser?.data_saver}
                    />
                    <SkipLink />
                    {/* Збій сторінки — картка з кнопкою оновлення; resetKey скидає після переходу. */}
                    <ErrorBoundary resetKey={page.url}>
                        <Suspense
                            fallback={<BootSkeleton name={page.component} />}
                        >
                            {app}
                        </Suspense>
                    </ErrorBoundary>
                    <ErrorBoundary fallback={null}>
                        <Toaster />
                        <CookieConsent analytics={analytics} />
                        <HandoffCard enabled={handoff} />
                    </ErrorBoundary>
                </TooltipProvider>
            </LazyMotion>
        );
    },
    // Тонка сапфірова смужка, лише якщо запит довший за 250 мс.
    progress: {
        color: '#00D2FF',
        delay: 250,
        showSpinner: false,
    },
});
