/*
 * GameCon: service worker лише для сповіщень сайту (Web Push).
 * Нічого не кешує — сторінки й файли завжди йдуть із мережі.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
    event.waitUntil(self.clients.claim()),
);

self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { body: event.data ? event.data.text() : '' };
    }
    const title = data.title || 'GameCon';
    event.waitUntil(
        self.registration.showNotification(title, {
            body: data.body || '',
            icon: '/favicon-192.png',
            badge: '/favicon-192.png',
            tag: data.tag || undefined,
            renotify: Boolean(data.tag),
            data: { url: data.url || '/notifications' },
        }),
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = new URL(
        event.notification.data?.url || '/',
        self.location.origin,
    ).href;
    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then((windows) => {
                for (const client of windows) {
                    if (
                        new URL(client.url).origin === self.location.origin &&
                        'focus' in client
                    ) {
                        client.navigate(target);

                        return client.focus();
                    }
                }

                return self.clients.openWindow(target);
            }),
    );
});
