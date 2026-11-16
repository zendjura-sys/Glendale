import { Link } from '@inertiajs/react';
import type { ComponentProps } from 'react';
import {
    CONTENT_CACHE,
    CONTENT_PREFETCH,
    NAV_CACHE,
    NAV_PREFETCH,
    canPrefetch,
    warm,
} from '@/lib/prefetch';
import { useDataSaver } from '@/lib/data-saver';

type LinkProps = ComponentProps<typeof Link>;

type Props = LinkProps & {
    /**
     * nav — шапка, нижня панель, меню (mount+hover, довгий кеш).
     * content — картки й посилання в стрічці (hover на ПК; дотик — глобальний touch prefetch).
     */
    kind?: 'nav' | 'content';
};

/**
 * Inertia Link із правильним prefetch для телефону й ПК.
 * У режимі економії трафіку — звичайне посилання без попереднього завантаження.
 */
export function PrefetchLink({
    kind = 'content',
    cacheFor,
    prefetch,
    onPointerDown,
    ...props
}: Props) {
    const saveData = useDataSaver();
    const allow = canPrefetch() && !saveData;

    if (!allow) {
        return (
            <Link {...props} prefetch={false} onPointerDown={onPointerDown} />
        );
    }

    if (kind === 'nav') {
        return (
            <Link
                {...props}
                prefetch={prefetch ?? NAV_PREFETCH}
                cacheFor={cacheFor ?? NAV_CACHE}
                onPointerDown={onPointerDown}
            />
        );
    }

    return (
        <Link
            {...props}
            prefetch={prefetch ?? CONTENT_PREFETCH}
            cacheFor={cacheFor ?? CONTENT_CACHE}
            onPointerDown={(event) => {
                // Дубль до глобального touch-prefetch: якщо слухач ще не стоїть.
                if (
                    event.pointerType !== 'mouse' &&
                    typeof props.href === 'string'
                ) {
                    warm(props.href, CONTENT_CACHE);
                }
                onPointerDown?.(event);
            }}
        />
    );
}
