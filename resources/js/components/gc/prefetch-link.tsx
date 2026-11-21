import { Link } from '@inertiajs/react';
import type { ComponentProps } from 'react';
import {
    CONTENT_CACHE,
    NAV_CACHE,
    canPrefetch,
    contentPrefetch,
    navPrefetch,
} from '@/lib/prefetch';
import { useDataSaver } from '@/lib/data-saver';

type LinkProps = ComponentProps<typeof Link>;

type Props = LinkProps & {
    /**
     * nav — шапка / меню на ПК (mount+hover).
     * content — картки на ПК (hover). На телефоні prefetch завжди вимкнено.
     */
    kind?: 'nav' | 'content';
};

/**
 * Inertia Link із prefetch лише на ПК.
 * Телефон і data-saver — звичайне посилання без попереднього завантаження.
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
                prefetch={prefetch ?? navPrefetch()}
                cacheFor={cacheFor ?? NAV_CACHE}
                onPointerDown={onPointerDown}
            />
        );
    }

    return (
        <Link
            {...props}
            prefetch={prefetch ?? contentPrefetch()}
            cacheFor={cacheFor ?? CONTENT_CACHE}
            onPointerDown={onPointerDown}
        />
    );
}
