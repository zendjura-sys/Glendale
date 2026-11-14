import {
    Clock,
    Crown,
    Flame,
    Gamepad2,
    Gem,
    Heart,
    Music,
    Shield,
    ShieldCheck,
    Sparkles,
    Star,
    Trophy,
    Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserRoleCard } from '@/types';

/** Кольори плашок ролей (ключі — StaffRole::COLORS на сервері). */
const COLORS: Record<string, string> = {
    sky: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-200',
    rose: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    violet: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    orange: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
    teal: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
    slate: 'bg-slate-400/15 text-slate-700 dark:text-slate-200',
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
                'inline-flex max-w-[12rem] min-w-0 shrink items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] leading-none font-semibold',
                titleColor(role.color),
                className,
            )}
        >
            {staff && <ShieldCheck className="size-3 shrink-0" />}
            <span className="truncate">{role.name}</span>
        </span>
    );
}

/** Іконки ролей-плашок (ключі — UserRole::ICONS на сервері). */
export const ROLE_ICONS: Record<string, LucideIcon> = {
    crown: Crown,
    gem: Gem,
    star: Star,
    flame: Flame,
    heart: Heart,
    shield: Shield,
    trophy: Trophy,
    sparkles: Sparkles,
    zap: Zap,
    clock: Clock,
    'gamepad-2': Gamepad2,
    music: Music,
};

/** Одна роль-плашка. */
export function RoleChip({
    role,
    className,
}: {
    role: Pick<UserRoleCard, 'name' | 'color' | 'icon' | 'description'>;
    className?: string;
}) {
    const Icon = role.icon ? ROLE_ICONS[role.icon] : null;

    return (
        <span
            title={role.description ?? undefined}
            className={cn(
                'inline-flex max-w-[12rem] min-w-0 shrink items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] leading-none font-semibold',
                titleColor(role.color),
                className,
            )}
        >
            {Icon && <Icon className="size-3 shrink-0" />}
            <span className="truncate">{role.name}</span>
        </span>
    );
}

/** Суцільні кольори точок у стопці «+N». */
const DOTS: Record<string, string> = {
    sky: 'bg-sky-400',
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-300',
    rose: 'bg-rose-400',
    violet: 'bg-violet-400',
    orange: 'bg-orange-400',
    teal: 'bg-teal-400',
    slate: 'bg-slate-300',
};

/** Види ролей у картці «Усі ролі» (порядок показу). */
const KIND_LABELS: [string, string][] = [
    ['premium', 'Преміум'],
    ['award', 'Нагородні'],
    ['holiday', 'Святкові'],
    ['regular', 'Звичайні'],
];

/**
 * Ролі-плашки людини: перші `limit` видно одразу, решта — «стопка»: кольорові точки прихованих ролей і +N.
 * Натиск відкриває картку «Усі ролі», згруповану за видами, з підказками.
 */
export function UserRoles({
    roles,
    limit = 3,
    className,
}: {
    roles?: UserRoleCard[] | null;
    limit?: number;
    className?: string;
}) {
    const reduce = useReducedMotion();
    if (!roles || roles.length === 0) return null;
    const shown = roles.slice(0, limit);
    const rest = roles.slice(limit);

    return (
        <>
            {shown.map((r) => (
                <RoleChip key={r.id} role={r} className={className} />
            ))}
            {rest.length > 0 && (
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger
                        onClick={(e) => e.stopPropagation()}
                        aria-label={tr('Ще ролі: {n}', { n: rest.length })}
                        title={rest.map((r) => r.name).join(', ')}
                        className={cn(
                            'group inline-flex shrink-0 items-center gap-1 rounded-md bg-white/10 py-0.5 pr-1.5 pl-1 text-[11px] leading-none font-semibold text-white/70 transition hover:text-white',
                            className,
                        )}
                    >
                        <span className="flex -space-x-1">
                            {rest.slice(0, 3).map((r, i) => (
                                <span
                                    key={r.id}
                                    className={cn(
                                        'size-2 rounded-full ring-1 ring-black/40 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-[calc(var(--i)*2px)]',
                                        DOTS[r.color] ?? DOTS.sky,
                                    )}
                                    style={{ ['--i' as string]: i }}
                                />
                            ))}
                        </span>
                        +{rest.length}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="start"
                        onClick={(e) => e.stopPropagation()}
                        className="w-64 p-2"
                    >
                        <motion.div
                            initial={reduce ? false : { opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.18 }}
                        >
                            <p className="px-1 pb-1.5 text-xs font-semibold text-white/60">
                                {tr('Усі ролі · {n}', { n: roles.length })}
                            </p>
                            {KIND_LABELS.map(([kind, label]) => {
                                const list = roles.filter(
                                    (r) => (r.kind ?? 'regular') === kind,
                                );
                                if (list.length === 0) return null;

                                return (
                                    <div key={kind} className="px-1 py-1">
                                        <p className="mb-1 text-[10px] text-white/40">
                                            {tr(label)}
                                        </p>
                                        <div className="flex flex-col gap-1">
                                            {list.map((r, i) => (
                                                <motion.div
                                                    key={r.id}
                                                    initial={
                                                        reduce
                                                            ? false
                                                            : {
                                                                  opacity: 0,
                                                                  x: -4,
                                                              }
                                                    }
                                                    animate={{
                                                        opacity: 1,
                                                        x: 0,
                                                    }}
                                                    transition={{
                                                        delay: i * 0.03,
                                                    }}
                                                    className="flex items-center gap-2"
                                                >
                                                    <RoleChip role={r} />
                                                    {r.description && (
                                                        <span className="min-w-0 truncate text-[11px] text-white/45">
                                                            {r.description}
                                                        </span>
                                                    )}
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </motion.div>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </>
    );
}
