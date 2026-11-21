import { ShieldCheck } from 'lucide-react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Значок команди GameCon біля імені: адміністратор чи модератор сайту. */
export function StaffBadge({
    role,
    className,
}: {
    role?: string | null;
    className?: string;
}) {
    if (role !== 'admin' && role !== 'moderator') return null;
    const label =
        role === 'admin'
            ? tr('Адміністрація GameCon')
            : tr('Модератор GameCon');

    return (
        <span title={label} aria-label={label} className="inline-flex">
            <ShieldCheck
                className={cn('size-4 shrink-0 text-sky-400', className)}
            />
        </span>
    );
}
