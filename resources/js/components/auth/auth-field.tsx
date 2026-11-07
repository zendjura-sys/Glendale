import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Поле входу/реєстрації: прозоре, лише нижня лінія (біла при фокусі), монохромна іконка праворуч.
 * Підпис — для читачів екрана (sr-only), видимий — плейсхолдер.
 */
export function AuthField({
    icon: Icon,
    label,
    className,
    ...props
}: ComponentProps<'input'> & { icon: LucideIcon; label: string }) {
    return (
        <label className="relative block">
            <span className="sr-only">{label}</span>
            <Input
                {...props}
                placeholder={props.placeholder ?? label}
                className={cn('pr-9', className)}
            />
            <Icon
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-1 size-4 -translate-y-1/2 text-white/60"
            />
        </label>
    );
}

/** Кнопка форми: прозора пігулка зі стрілкою. */
export function AuthSubmit({
    children,
    disabled,
    ...props
}: ComponentProps<'button'> & { children: ReactNode }) {
    return (
        <button
            type="submit"
            disabled={disabled}
            {...props}
            className="auth-pill inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-white/60 bg-transparent px-6 text-sm font-medium text-white transition hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none disabled:opacity-50"
        >
            {children}
            <ChevronRight className="size-4" />
        </button>
    );
}

/** Підкреслене посилання поруч із кнопкою (перехід між входом і реєстрацією). */
export function AuthSwitch({
    href,
    children,
}: {
    href: string;
    children: ReactNode;
}) {
    return (
        <Link
            href={href}
            className="text-sm text-white/80 underline decoration-white/40 underline-offset-4 transition hover:text-white hover:decoration-white"
        >
            {children}
        </Link>
    );
}
