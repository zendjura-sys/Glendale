import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Кольори плашок ролей (ключі — StaffRole::COLORS на сервері). */
const COLORS: Record<string, string> = {
    sky: 'bg-sky-500/15 text-sky-300',
    emerald: 'bg-emerald-500/15 text-emerald-300',
    amber: 'bg-amber-500/15 text-amber-200',
    rose: 'bg-rose-500/15 text-rose-300',
    violet: 'bg-violet-500/15 text-violet-300',
    orange: 'bg-orange-500/15 text-orange-300',
    teal: 'bg-teal-500/15 text-teal-300',
    slate: 'bg-slate-400/15 text-slate-200',
};

export function titleColor(color: string | null | undefined): string {
    return COLORS[color ?? 'sky'] ?? COLORS.sky;
}

/**
 * Плашка ролі біля ніка: роль команди (зі щитом) має перевагу над власною роллю GameCon+.
 */
export function UserTitle({
    user,
    className,
}: {
    user: {
        staff_title?: { name: string; color: string } | null;
        title?: { name: string; color: string } | null;
    };
    className?: string;
}) {
    const staff = user.staff_title ?? null;
    const role = staff ?? user.title ?? null;
    if (!role) return null;

    return (
        <span
            className={cn(
                'inline-flex max-w-[12rem] shrink-0 items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] leading-none font-semibold',
                titleColor(role.color),
                className,
            )}
        >
            {staff && <ShieldCheck className="size-3 shrink-0" />}
            <span className="truncate">{role.name}</span>
        </span>
    );
}
