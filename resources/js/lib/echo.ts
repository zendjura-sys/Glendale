import { configureEcho } from '@laravel/echo-react';
import { xsrfToken } from '@/lib/api';

/*
 * Реалтайм (Reverb/Pusher) налаштовується, коли його вперше імпортує useRealtime —
 * тобто лише на сторінках соцмережі. Гості (головна, вхід) не вантажать клієнт pusher.
 */
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
