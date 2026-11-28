import { usePage } from '@inertiajs/react';
import { useState, type ReactNode } from 'react';
import { isCoarsePointer } from '@/lib/prefetch';
import { cn } from '@/lib/utils';

/** Сторінки з власною постійною «оболонкою» анімують лише вміст усередині неї. */
const SHELLS: [prefix: string, key: string][] = [['settings/', 'settings']];

function viewTransitionActive(): boolean {
    return (
        typeof document !== 'undefined' &&
        document.documentElement.classList.contains('gc-vt')
    );
}

/**
 * Обгортка контенту сторінки. На ПК — каскад появи (.gc-page).
 * На телефоні одразу settled: без анімації opacity/translate.
 */
export function PageTransition({
    children,
    className,
    nested = false,
}: {
    children: ReactNode;
    className?: string;
    nested?: boolean;
}) {
    const { component } = usePage();
    const shell = nested
        ? undefined
        : SHELLS.find(([prefix]) => component.startsWith(prefix));
    const pageKey = shell ? shell[1] : component;
    const mobile = typeof window !== 'undefined' && isCoarsePointer();
    const [snapshot, setSnapshot] = useState(() => ({
        key: pageKey,
        settled: mobile || viewTransitionActive(),
    }));

    if (snapshot.key !== pageKey) {
        setSnapshot({
            key: pageKey,
            settled: mobile || viewTransitionActive(),
        });
    }

    const settled =
        mobile ||
        (snapshot.key === pageKey ? snapshot.settled : viewTransitionActive());

    return (
        <div
            key={pageKey}
            className={cn('gc-page', settled && 'gc-page-settled', className)}
        >
            {children}
        </div>
    );
}
