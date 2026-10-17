import type { VisitOptions } from '@inertiajs/core';
import { createInertiaApp } from '@inertiajs/react';
import { SkipLink } from '@/components/gc/skip-link';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { installKeyboardGuard } from '@/lib/keyboard';
import { LazyMotion } from 'motion/react';
import { lazy, Suspense } from 'react';

// Швидкий перший кадр: стартовий файл без макетів. Кожен макет (соцмережа, адмінка, вхід, налаштування) —
// окремим файлом, що вантажиться, коли вперше знадобиться, і далі лишається в кеші.
const socialLayout = () => import('@/layouts/social-layout');
const adminLayout = () => import('@/layouts/admin-layout');
const authLayout = () => import('@/layouts/auth-layout');
const settingsLayout = () => import('@/layouts/settings/layout');
const SocialLayout = lazy(socialLayout);
const AdminLayout = lazy(adminLayout);
const AuthLayout = lazy(authLayout);
const SettingsLayout = lazy(settingsLayout);

// Макет першої сторінки починаємо качати одразу, паралельно зі сторінкою, — без другого очікування.
if (typeof document !== 'undefined') {
    const initial = document.querySelector('script[data-page]')?.textContent;
    const name = initial
        ? ((JSON.parse(initial) as { component?: string }).component ?? '')
        : '';
    if (name.startsWith('auth/')) void authLayout();
    else if (name.startsWith('admin/')) void adminLayout();
    else if (name && name !== 'welcome' && !name.startsWith('legal/')) {
        void socialLayout();
        if (name.startsWith('settings/')) void settingsLayout();
    }
}

// Анімації: легке ядро одразу, решта можливостей (layout, drag) — окремим файлом після першого кадру.
const motionFeatures = () =>
    import('@/lib/motion-features').then((module) => module.default);

installKeyboardGuard();

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

void createInertiaApp({
    title: (title) => (title ? `${title} · ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            case name === 'welcome':
            case name.startsWith('legal/'):
                return null;
            case name.startsWith('auth/'):
                return AuthLayout;
            case name.startsWith('admin/'):
                return AdminLayout;
            case name.startsWith('settings/'):
                return [SocialLayout, SettingsLayout];
            default:
                return SocialLayout;
        }
    },
    strictMode: true,
    defaults: {
        visitOptions: (_href: string, options: VisitOptions) => ({
            viewTransition: shouldViewTransition(options),
        }),
    },
    withApp(app) {
        return (
            <LazyMotion features={motionFeatures} strict>
                <TooltipProvider delayDuration={0}>
                    <SkipLink />
                    <Suspense fallback={null}>{app}</Suspense>
                    <Toaster />
                </TooltipProvider>
            </LazyMotion>
        );
    },
    progress: {
        color: '#8b6bff',
    },
});
