import { createInertiaApp } from '@inertiajs/react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import AdminLayout from '@/layouts/admin-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';
import SocialLayout from '@/layouts/social-layout';
import { configureEcho } from '@laravel/echo-react';
import { xsrfToken } from '@/lib/api';

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
