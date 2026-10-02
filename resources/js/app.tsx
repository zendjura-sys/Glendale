import type { VisitOptions } from '@inertiajs/core';
import { createInertiaApp } from '@inertiajs/react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import AdminLayout from '@/layouts/admin-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';
import SocialLayout from '@/layouts/social-layout';
import { configureEcho } from '@laravel/echo-react';
import { xsrfToken } from '@/lib/api';
import { installKeyboardGuard } from '@/lib/keyboard';

installKeyboardGuard();

// Мета-тег CSRF застаріває після входу через Inertia, тому авторизуємо канали cookie XSRF-TOKEN.
configureEcho({
    broadcaster: 'reverb',
    authorizer: (channel: { name: string }) => ({
        authorize: (
            socketId: string,
            callback: (
                error: Error | null,
                data: { auth: string } | null,
            ) => void,
        ) => {
            fetch('/broadcasting/auth', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': xsrfToken(),
                },
                body: JSON.stringify({
                    socket_id: socketId,
                    channel_name: channel.name,
                }),
            })
                .then((response) =>
                    response.ok
                        ? response.json()
                        : Promise.reject(new Error(String(response.status))),
                )
                .then((data) => callback(null, data))
                .catch((error: Error) => callback(error, null));
        },
    }),
});

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
            <TooltipProvider delayDuration={0}>
                {app}
                <Toaster />
            </TooltipProvider>
        );
    },
    progress: {
        color: '#8b6bff',
    },
});
