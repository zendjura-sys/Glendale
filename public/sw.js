/*
 * GameCon: сповіщення сайту (Web Push) і офлайн-режим.
 * Файли збірки (/build/) — з кешу; стрічка, повідомлення й сповіщення — спершу мережа,
 * без мережі — остання збережена версія; інші сторінки без мережі — «Немає мережі».
 * Кеш сторінок очищається при виході з акаунта.
 */
const STATIC = 'gc-static-v1';
const PAGES = 'gc-pages-v2';
const OFFLINE = '/offline.html';
/** Що відкривається без інтернету (адреса сторінки або її Inertia-запит). */
const OFFLINE_PATHS = [/^\/feed$/, /^\/messages(\/\d+)?$/, /^\/notifications$/];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(STATIC)
            .then((cache) => cache.addAll([OFFLINE, '/favicon.svg']))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) =>
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter(
                            (key) =>
                                key.startsWith('gc-') &&
                                ![STATIC, PAGES].includes(key),
                        )
                        .map((key) => caches.delete(key)),
                ),
            )
            .then(() => self.clients.claim()),
    ),
);

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // Вихід або вхід — чужі сторінки в кеші не лишаємо.
    if (/^\/(login|logout)/.test(url.pathname)) {
        event.waitUntil(caches.delete(PAGES));

        return;
    }

    if (url.pathname.startsWith('/build/')) {
        event.respondWith(
            caches.open(STATIC).then(async (cache) => {
                const hit = await cache.match(request);
                if (hit) return hit;
                const response = await fetch(request);
                if (response.ok) cache.put(request, response.clone());

                return response;
            }),
        );

        return;
    }

    const navigate = request.mode === 'navigate';
    const inertia = request.headers.get('X-Inertia') === 'true';
    if (!navigate && !inertia) return;
    // Часткові перезавантаження (лише частина пропсів) не зберігаємо — з них сторінку не зібрати.
    const partial = request.headers.has('X-Inertia-Partial-Data');
    const keep =
        !partial &&
        !url.search &&
        OFFLINE_PATHS.some((re) => re.test(url.pathname));
    // Окремі ключі для HTML і для Inertia-відповіді тієї ж адреси.
    const key = new Request(url.pathname + (inertia ? '?__inertia' : ''));

    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response.status === 401 || response.status === 419) {
                    caches.delete(PAGES);
                } else if (keep && response.ok && !response.redirected) {
                    const copy = response.clone();
                    event.waitUntil(
                        caches
                            .open(PAGES)
                            .then((cache) => cache.put(key, copy)),
                    );
                }

                return response;
            })
            .catch(async () => {
                const cached = keep
                    ? await caches.match(key, { cacheName: PAGES })
                    : undefined;
                if (cached) return cached;
                if (navigate) {
                    return (
                        (await caches.match(OFFLINE, { cacheName: STATIC })) ||
                        Response.error()
                    );
                }

                return Response.error();
            }),
    );
});

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
