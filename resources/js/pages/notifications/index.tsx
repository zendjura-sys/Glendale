import { Head } from '@inertiajs/react';
import { Bell, CheckCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AlertNotification } from '@/components/alerts/alert-notification';
import { NotificationRow } from '@/components/gc/notifications-menu';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import type { NotificationItem } from '@/types';

/** «Сповіщення» окремою сторінкою: те саме, що в дзвіночку, — для посилань, палітри команд і розділеного екрана. */
export default function NotificationsPage() {
    const [items, setItems] = useState<NotificationItem[] | null>(null);
    const [unread, setUnread] = useState(0);
    useEffect(() => {
        void api<{ notifications: NotificationItem[]; unread: number }>(
            'GET',
            '/notifications',
        ).then(
            (d) => {
                setItems(d.notifications);
                setUnread(d.unread);
            },
            () => setItems([]),
        );
    }, []);
    const readAll = (): void => {
        void api('POST', '/notifications/read').then(() => {
            setUnread(0);
            setItems(
                (list) => list?.map((n) => ({ ...n, read: true })) ?? null,
            );
        });
    };

    return (
        <>
            <Head title={tr('Сповіщення')} />
            <div className="mx-auto max-w-3xl space-y-3.5">
                <section className="gc-solid flex items-center gap-3 rounded-2xl p-4">
                    <h1 className="flex flex-1 items-center gap-2 font-display text-2xl font-bold text-white">
                        <Bell className="size-6 text-sky-400" />{' '}
                        {tr('Сповіщення')}
                    </h1>
                    {unread > 0 && (
                        <button
                            type="button"
                            onClick={readAll}
                            className="gc-ghost-btn"
                        >
                            <CheckCheck className="size-4" />{' '}
                            {tr('Прочитати всі')}
                        </button>
                    )}
                </section>
                <section className="gc-solid rounded-2xl p-2">
                    {items === null ? (
                        <p className="py-10 text-center text-sm text-white/45">
                            {tr('Завантаження…')}
                        </p>
                    ) : items.length === 0 ? (
                        <div className="py-12 text-center">
                            <Bell className="mx-auto mb-3 size-8 text-white/20" />
                            <p className="text-sm text-white/50">
                                {tr(
                                    "Поки що тихо. Тут з'являться лайки, коментарі та заявки.",
                                )}
                            </p>
                        </div>
                    ) : (
                        items.map((item) =>
                            item.alert ? (
                                <AlertNotification
                                    key={item.id}
                                    item={item}
                                    onOpen={() => undefined}
                                />
                            ) : (
                                <NotificationRow key={item.id} item={item} />
                            ),
                        )
                    )}
                </section>
            </div>
        </>
    );
}
