import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { PageSkeleton, skeletonFor } from '@/components/gc/skeletons';
import type { PageSkeletonKind } from '@/components/gc/skeletons';

/** Скелетон з’являється, лише якщо сторінка вантажиться довше за цей час — щоб не блимав. */
const DELAY = 180;

/**
 * Поки йде перехід на іншу сторінку, замість старого вмісту — скелетон нової сторінки
 * (вигляд за адресою: стрічка, каталог, сервери, чат…). Сама сторінка лишається змонтованою
 * й прихованою: якщо перехід скасують, вона повернеться без втрати стану.
 */
export function NavigationSkeleton({ children }: { children: ReactNode }) {
    const [kind, setKind] = useState<PageSkeletonKind | null>(null);

    useEffect(() => {
        let timer: number | undefined;
        const stop = () => {
            window.clearTimeout(timer);
            setKind(null);
        };
        // «before», а не «start»: перехід на вже підтягнуту (prefetch) сторінку, що ще вантажиться, «start» не надсилає.
        const offStart = router.on('before', (event) => {
            const visit = event.detail.visit;
            const target = visit.url;
            // Лише справжній перехід: GET на іншу адресу, без часткового перезавантаження й префетчу.
            if (
                visit.method !== 'get' ||
                visit.only.length > 0 ||
                visit.prefetch ||
                target.pathname === window.location.pathname
            ) {
                return;
            }
            window.clearTimeout(timer);
            timer = window.setTimeout(() => {
                // Інший обробник міг скасувати перехід (напр., незбережені зміни).
                if (!event.defaultPrevented) {
                    setKind(skeletonFor(target.pathname));
                }
            }, DELAY);
        });
        const offFinish = router.on('finish', stop);
        const offError = router.on('networkError', stop);
        const offNavigate = router.on('navigate', stop);

        return () => {
            window.clearTimeout(timer);
            offStart();
            offFinish();
            offError();
            offNavigate();
        };
    }, []);

    return (
        <>
            {kind && (
                <div className="gc-nav-skeleton">
                    <PageSkeleton kind={kind} />
                </div>
            )}
            <div hidden={kind !== null} className="contents">
                {children}
            </div>
        </>
    );
}
