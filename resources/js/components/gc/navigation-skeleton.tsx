import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { PageSkeleton, skeletonFor } from '@/components/gc/skeletons';
import type { PageSkeletonKind } from '@/components/gc/skeletons';
import { isPrefetchReady, isPrefetching } from '@/lib/prefetch';

/** Звичайна затримка: скелетон лише якщо відповідь справді довго йде. */
const DELAY_COLD = 160;
/** Prefetch уже летить — трохи довше тримаємо стару сторінку, часто встигає. */
const DELAY_WARM = 280;

/**
 * Поки йде перехід на іншу сторінку, замість старого вмісту — скелетон нової сторінки
 * (вигляд за адресою: стрічка, каталог, сервери, чат…). Сама сторінка лишається змонтованою
 * й прихованою: якщо перехід скасують, вона повернеться без втрати стану.
 *
 * Якщо дані вже в кеші prefetch — скелетон не показуємо (миттєвий безшовний своп).
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
            const href = target.pathname + target.search;
            // Кеш уже є — Inertia віддасть сторінку одразу, скелетон лише блимав би.
            if (isPrefetchReady(href)) {
                window.clearTimeout(timer);
                setKind(null);
                return;
            }
            window.clearTimeout(timer);
            const delay = isPrefetching(href) ? DELAY_WARM : DELAY_COLD;
            timer = window.setTimeout(() => {
                // Інший обробник міг скасувати перехід (напр., незбережені зміни).
                if (!event.defaultPrevented) {
                    setKind(skeletonFor(target.pathname));
                }
            }, delay);
        });
        const offFinish = router.on('finish', stop);
        const offError = router.on('networkError', stop);
        const offNavigate = router.on('navigate', stop);
        // Для перевірки й автотестів: показати скелетон адреси без переходу
        // (window.dispatchEvent(new CustomEvent('gc:skeleton', { detail: '/feed' })), null — сховати).
        const onProbe = (event: Event) => {
            const path = (event as CustomEvent<string | null>).detail;
            setKind(path ? skeletonFor(path) : null);
        };
        window.addEventListener('gc:skeleton', onProbe);

        return () => {
            window.clearTimeout(timer);
            offStart();
            offFinish();
            offError();
            offNavigate();
            window.removeEventListener('gc:skeleton', onProbe);
        };
    }, []);

    return (
        <>
            {kind && (
                <div
                    className="gc-nav-skeleton"
                    aria-busy="true"
                    aria-live="polite"
                >
                    <PageSkeleton kind={kind} />
                </div>
            )}
            <div hidden={kind !== null} className="contents">
                {children}
            </div>
        </>
    );
}
