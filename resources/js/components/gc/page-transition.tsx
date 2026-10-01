import { usePage } from '@inertiajs/react';
import { useState, type ReactNode } from 'react';
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
 * Обгортка контенту сторінки. На першому показі дочірні блоки з’являються
 * каскадом (.gc-page). Під час переходу View Transitions знімок має бути
 * вже готовою сторінкою, тому каскад із opacity: 0 вимикається.
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
    const [snapshot, setSnapshot] = useState(() => ({
        key: pageKey,
        settled: viewTransitionActive(),
    }));

    if (snapshot.key !== pageKey) {
        setSnapshot({ key: pageKey, settled: viewTransitionActive() });
    }

    const settled =
        snapshot.key === pageKey ? snapshot.settled : viewTransitionActive();

    return (
        <div
            key={pageKey}
            className={cn('gc-page', settled && 'gc-page-settled', className)}
        >
            {children}
        </div>
    );
}
