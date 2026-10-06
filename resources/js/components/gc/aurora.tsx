import { cn } from '@/lib/utils';

/**
 * Фон: розмиті плями gc-blue / gc-lilac / gc-pink і шовкова стрічка.
 * Кольори тільки з токенів теми. Рух вимикає prefers-reduced-motion.
 */
export function Aurora({
    className,
    intense = false,
}: {
    className?: string;
    intense?: boolean;
}) {
    return (
        <div
            aria-hidden
            className={cn(
                'gc-aurora noise pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-void',
                intense && 'gc-aurora-intense',
                className,
            )}
        >
            <div className="grid-lines absolute inset-0 opacity-70" />
            <div className="gc-aurora-blob gc-aurora-blob-blue" />
            <div className="gc-aurora-blob gc-aurora-blob-lilac" />
            <div className="gc-aurora-blob gc-aurora-blob-pink" />
            <div className="gc-aurora-blob gc-aurora-blob-cyan" />
            <div className="gc-aurora-silk" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,var(--color-void)_100%)]" />
        </div>
    );
}
